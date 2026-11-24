import type { FiberRpc, RpcChannel, RpcScript } from "../vendor/ckbolt/fiber-rpc.schemas";
import { FIBER_CHANNEL_CLOSED_STATE, FIBER_CHANNEL_READY_STATE, FIBER_RPC_METHOD } from "../vendor/ckbolt/fiber-rpc.constants";
import { fromHex, formatCkb, toHex } from "./amounts";
import { CHANNEL, FIBER_VERSION, NODES, TESTNET_CKB_RPC, TESTNET_GENESIS } from "./config";
import type { ArenaState } from "./store";

/**
 * Lab plumbing around the game: checks that both nodes are the expected Testnet nodes, reads balances, and opens and
 * closes the one channel between the demo player and the game server. Channel writes follow the Week 6 rules: an
 * operation marker is saved before the write, and an unfinished one blocks any new write until it is rechecked.
 */

export interface LabDeps {
  server: FiberRpc;
  player: FiberRpc;
  load(): ArenaState;
  save(state: ArenaState): void;
  ckbRpc?: (method: string, params: unknown[]) => Promise<unknown>;
  sleep?: (ms: number) => Promise<void>;
}

export async function ckbRpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(TESTNET_CKB_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`CKB ${method}: HTTP ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(`CKB ${method}: ${body.error.message}`);
  return body.result;
}

export const snapshot = (c: RpcChannel) => ({
  channel_id: c.channel_id,
  state: c.state.state_name,
  local_balance: formatCkb(fromHex(c.local_balance)),
  remote_balance: formatCkb(fromHex(c.remote_balance)),
  offered_tlc_balance: formatCkb(fromHex(c.offered_tlc_balance)),
  received_tlc_balance: formatCkb(fromHex(c.received_tlc_balance)),
  pending_tlcs: c.pending_tlcs.length,
  channel_outpoint: c.channel_outpoint ?? null,
  shutdown_transaction_hash: c.shutdown_transaction_hash ?? null,
});

export class Lab {
  private readonly ckb: (method: string, params: unknown[]) => Promise<unknown>;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly deps: LabDeps) {
    this.ckb = deps.ckbRpc ?? ckbRpc;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async network() {
    const [genesis, server, player] = await Promise.all([
      this.ckb("get_block_hash", ["0x0"]),
      this.deps.server.request(FIBER_RPC_METHOD.NODE_INFO),
      this.deps.player.request(FIBER_RPC_METHOD.NODE_INFO),
    ]);
    if (genesis !== TESTNET_GENESIS) throw new Error("The CKB RPC is not CKB Testnet.");
    for (const [name, info] of [["server", server], ["player", player]] as const) {
      if (info.chain_hash !== TESTNET_GENESIS) throw new Error(`The ${name} node is not on CKB Testnet.`);
      if (info.version !== FIBER_VERSION) throw new Error(`The ${name} node runs fnn ${info.version}; this lab expects ${FIBER_VERSION}.`);
    }
    if (server.pubkey === player.pubkey) throw new Error("Server and player are the same node.");
    return { server, player };
  }

  /** Plain CKB (no type script, no data) at a lock: what a node can use to fund a channel. */
  async plainBalance(lock: RpcScript): Promise<bigint> {
    let total = 0n;
    let after: string | undefined;
    for (;;) {
      const page = (await this.ckb("get_cells", [
        {
          script: lock,
          script_type: "lock",
          script_search_mode: "exact",
          filter: { script_len_range: ["0x0", "0x1"], output_data_len_range: ["0x0", "0x1"] },
        },
        "asc",
        "0x64",
        ...(after ? [after] : []),
      ])) as { objects: { output: { capacity: string } }[]; last_cursor: string };
      for (const cell of page.objects) total += fromHex(cell.output.capacity);
      if (page.objects.length < 100) return total;
      after = page.last_cursor;
    }
  }

  async channelPair() {
    const state = this.deps.load();
    if (!state.channelId) return undefined;
    const [server, player] = await Promise.all([
      this.deps.server.request(FIBER_RPC_METHOD.LIST_CHANNELS, { include_closed: true }),
      this.deps.player.request(FIBER_RPC_METHOD.LIST_CHANNELS, { include_closed: true }),
    ]);
    const s = server.channels.find((c) => c.channel_id === state.channelId);
    const p = player.channels.find((c) => c.channel_id === state.channelId);
    return s && p ? { server: s, player: p } : undefined;
  }

  async status() {
    const { server, player } = await this.network();
    const [serverPlain, playerPlain, pair] = await Promise.all([
      this.plainBalance(server.default_funding_lock_script),
      this.plainBalance(player.default_funding_lock_script),
      this.channelPair(),
    ]);
    const state = this.deps.load();
    return {
      nodes: {
        server: { pubkey: server.pubkey, version: server.version, plainOnChainCKB: formatCkb(serverPlain) },
        player: { pubkey: player.pubkey, version: player.version, plainOnChainCKB: formatCkb(playerPlain) },
      },
      channelId: state.channelId ?? null,
      channel: pair ? { server: snapshot(pair.server), player: snapshot(pair.player) } : null,
      unresolvedOperation: state.operation ?? null,
    };
  }

  async connect() {
    const { server } = await this.network();
    await this.deps.player.request(FIBER_RPC_METHOD.CONNECT_PEER, { pubkey: server.pubkey, address: NODES.server.p2p, save: false });
    return this.poll("player and server connected", async () => {
      const peers = await this.deps.player.request(FIBER_RPC_METHOD.LIST_PEERS);
      return peers.peers.some((p) => p.pubkey === server.pubkey) ? peers : undefined;
    }, 20_000);
  }

  /** The player proposes a private channel; the server accepts and adds the same amount, so both sides can pay. */
  async openChannel(fundingPerSide: bigint) {
    const state = this.deps.load();
    if (state.operation) throw new Error(`A ${state.operation.kind} operation is unresolved. Run channel:recheck.`);
    if (state.channelId) {
      const pair = await this.channelPair();
      if (pair && pair.server.state.state_name !== FIBER_CHANNEL_CLOSED_STATE) throw new Error("A game channel is already open.");
    }
    if (fundingPerSide < CHANNEL.minFundingPerSide || fundingPerSide > CHANNEL.maxFundingPerSide) {
      throw new Error(`Fund ${formatCkb(CHANNEL.minFundingPerSide)}-${formatCkb(CHANNEL.maxFundingPerSide)} CKB per side.`);
    }
    const { server, player } = await this.network();
    const existing = await this.deps.player.request(FIBER_RPC_METHOD.LIST_CHANNELS, { pubkey: server.pubkey });
    if (existing.channels.length) throw new Error("The player already has a channel with the server. Inspect it before opening another.");
    for (const [name, info] of [["server", server], ["player", player]] as const) {
      const plain = await this.plainBalance(info.default_funding_lock_script);
      if (plain < fundingPerSide + CHANNEL.onChainReserve) {
        throw new Error(`The ${name} node needs ${formatCkb(fundingPerSide + CHANNEL.onChainReserve)} plain CKB; it has ${formatCkb(plain)}. Use the Testnet faucet.`);
      }
    }

    state.operation = { kind: "open_channel", at: new Date().toISOString(), fundingPerSide: fundingPerSide.toString() };
    delete state.channelId;
    this.deps.save(state);
    const opened = await this.deps.player.request(FIBER_RPC_METHOD.OPEN_CHANNEL, { pubkey: server.pubkey, funding_amount: toHex(fundingPerSide), public: false });
    const withTemp = this.deps.load();
    withTemp.operation!.temporaryChannelId = opened.temporary_channel_id;
    this.deps.save(withTemp);
    return this.acceptAndWait();
  }

  private async acceptAndWait(): Promise<Record<string, unknown>> {
    const state = this.deps.load();
    const op = state.operation;
    if (op?.kind !== "open_channel" || !op.temporaryChannelId || !op.fundingPerSide) throw new Error("No saved channel proposal.");
    if (!op.acceptAttempted) {
      op.acceptAttempted = true;
      this.deps.save(state);
      const accepted = await this.deps.server.request(FIBER_RPC_METHOD.ACCEPT_CHANNEL, {
        temporary_channel_id: op.temporaryChannelId,
        funding_amount: toHex(BigInt(op.fundingPerSide)),
      });
      const next = this.deps.load();
      next.channelId = accepted.channel_id;
      this.deps.save(next);
    }
    return this.recheck();
  }

  /** Finishes whatever channel operation is recorded, by reading the nodes and the chain. Sends nothing new. */
  async recheck(): Promise<Record<string, unknown>> {
    const state = this.deps.load();
    const op = state.operation;
    if (!op) return { resolved: "nothing to recheck" };
    if (op.kind === "open_channel") {
      if (!state.channelId) {
        const { server } = await this.network();
        const candidates = (await this.deps.player.request(FIBER_RPC_METHOD.LIST_CHANNELS, { pubkey: server.pubkey })).channels;
        if (candidates.length !== 1) {
          if (op.temporaryChannelId && !op.acceptAttempted) return this.acceptAndWait();
          throw new Error("The channel proposal is in an unclear state. Inspect both nodes; do not open another channel.");
        }
        state.channelId = candidates[0].channel_id;
        this.deps.save(state);
      }
      const ready = await this.poll("both sides ChannelReady", async () => {
        const pair = await this.channelPair();
        return pair?.server.state.state_name === FIBER_CHANNEL_READY_STATE && pair.player.state.state_name === FIBER_CHANNEL_READY_STATE ? pair : undefined;
      }, 15 * 60_000);
      const done = this.deps.load();
      delete done.operation;
      this.deps.save(done);
      const fundingTx = ready.server.channel_outpoint?.slice(0, 66) ?? null;
      return { channelId: done.channelId, fundingTxHash: fundingTx, server: snapshot(ready.server), player: snapshot(ready.player) };
    }
    // close_channel
    const closed = await this.poll("both sides Closed", async () => {
      const pair = await this.channelPair();
      return pair?.server.state.state_name === FIBER_CHANNEL_CLOSED_STATE && pair.player.state.state_name === FIBER_CHANNEL_CLOSED_STATE && pair.player.shutdown_transaction_hash
        ? pair
        : undefined;
    }, 15 * 60_000);
    const closeTx = closed.player.shutdown_transaction_hash!;
    const tx = await this.poll("close transaction committed", async () => {
      const value = (await this.ckb("get_transaction", [closeTx])) as {
        tx_status: { status: string; block_hash?: string };
        transaction: { inputs: { previous_output: { tx_hash: string; index: string } }[]; outputs: { capacity: string; lock: RpcScript }[] };
      } | null;
      return value?.tx_status.status === "committed" ? value : undefined;
    }, 15 * 60_000);
    const outpoint = closed.player.channel_outpoint;
    if (!outpoint || !/^0x[0-9a-f]{72}$/i.test(outpoint)) throw new Error("Unexpected funding OutPoint; inspect the close by hand.");
    const fundingHash = outpoint.slice(0, 66).toLowerCase();
    const fundingIndex = Buffer.from(outpoint.slice(66), "hex").readUInt32LE();
    const consumesFunding = tx.transaction.inputs.some(
      (i) => i.previous_output.tx_hash.toLowerCase() === fundingHash && Number(fromHex(i.previous_output.index)) === fundingIndex,
    );
    if (!consumesFunding) throw new Error("The close transaction does not spend the channel's funding cell.");
    const done = this.deps.load();
    delete done.operation;
    this.deps.save(done);
    return {
      channelId: done.channelId,
      closeTxHash: closeTx,
      blockHash: tx.tx_status.block_hash,
      consumesFundingCell: true,
      outputs: tx.transaction.outputs.map((o) => ({ capacityCKB: formatCkb(fromHex(o.capacity)), lockArgs: o.lock.args })),
    };
  }

  /** Cooperative close from the player side; each balance returns to its node's own lock. */
  async closeChannel() {
    const state = this.deps.load();
    if (state.operation) throw new Error(`A ${state.operation.kind} operation is unresolved. Run channel:recheck.`);
    const pair = await this.channelPair();
    if (!pair) throw new Error("No game channel is tracked.");
    if (pair.server.state.state_name !== FIBER_CHANNEL_READY_STATE || pair.server.pending_tlcs.length || pair.player.pending_tlcs.length) {
      throw new Error("Close only a ready channel with no pending TLCs: settle or refund open rounds first.");
    }
    const { player } = await this.network();
    state.operation = { kind: "close_channel", at: new Date().toISOString() };
    this.deps.save(state);
    await this.deps.player.request(FIBER_RPC_METHOD.SHUTDOWN_CHANNEL, {
      channel_id: state.channelId!,
      force: false,
      close_script: player.default_funding_lock_script,
      fee_rate: toHex(CHANNEL.closeFeeRate),
    });
    return this.recheck();
  }

  private async poll<T>(what: string, work: () => Promise<T | undefined>, timeoutMs: number): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = await work();
      if (value !== undefined) return value;
      if (Date.now() >= deadline) throw new Error(`${what}: still not reached. Run channel:recheck later; do not repeat the write.`);
      console.error(`waiting: ${what}`);
      await this.sleep(3_000);
    }
  }
}
