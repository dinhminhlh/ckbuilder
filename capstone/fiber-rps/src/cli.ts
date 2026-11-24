import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FiberRpcClient } from "./vendor/ckbolt/fiber-rpc.client";
import { Arena } from "./game/arena";
import { ckb, formatCkb } from "./game/amounts";
import { GAME, NODES } from "./game/config";
import { Lab } from "./game/lab";
import { DemoPlayer } from "./game/player";
import { parseMove, randomMove, verifyReveal } from "./game/rps";
import { JsonStore, withLock, type Round } from "./game/store";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const store = new JsonStore(resolve(root, "runtime/state.json"));
const deps = { load: () => store.load(), save: (s: Parameters<JsonStore["save"]>[0]) => store.save(s) };
const server = new FiberRpcClient({ url: NODES.server.url, timeoutMs: GAME.rpcTimeoutMs });
const playerNode = new FiberRpcClient({ url: NODES.player.url, timeoutMs: GAME.rpcTimeoutMs });
const arena = new Arena({ server, ...deps });
const lab = new Lab({ server, player: playerNode, ...deps });
const player = new DemoPlayer(playerNode);

const USAGE = `Fiber RPS: rock-paper-scissors over Fiber (CKB Testnet only)

  status                          nodes, on-chain CKB, game channel
  connect                         player node dials the server node
  channel:open [CKB per side]     player opens, server accepts (default 500 each)
  channel:recheck                 finish an unresolved open/close by reading state
  channel:close                   cooperative close, verified on chain

  round:new                       server commits its move; hold invoice for the stake
  player:pay [round]              demo player pays the stake (it stays held)
  round:check [round]             read the stake invoice and the held TLC
  round:play <move|random> [round]  the player's move: rock, paper or scissors
  round:resolve [round]           lose: settle; draw: refund; win: refund + pay winnings
  round:void [round]              no move was played: refund the stake
  round:recheck-payout [round]    re-read unresolved winnings, sends nothing
  round:reveal [round]            the preimage; the player checks the server's move
  round:show [round]              the saved round (no secrets)

Options: --save <file.json>  also write the result, with a timestamp, as evidence.
[round] defaults to the latest round.`;

const pickRound = (id?: string): string => {
  const found = id ?? arena.latestRound()?.id;
  if (!found) throw new Error("No round yet. Run round:new.");
  return found;
};

const describeRound = (round: Round) => ({
  id: round.id,
  createdAt: round.createdAt,
  stake: {
    status: round.stake.status,
    amountCKB: formatCkb(BigInt(round.stake.amount)),
    paymentHash: round.stake.paymentHash,
    invoice: round.stake.invoice,
    heldTlcExpiresAt: round.stake.heldTlcExpiry ? new Date(Number(round.stake.heldTlcExpiry)).toISOString() : null,
    settleAttemptedAt: round.stake.settleAttemptedAt ?? null,
    cancelAttemptedAt: round.stake.cancelAttemptedAt ?? null,
    resolvedAt: round.stake.resolvedAt ?? null,
  },
  playerMove: round.playerMove ?? null,
  outcome: round.outcome ?? null,
  payouts: round.payouts.map((p) => ({
    status: p.status,
    amountCKB: formatCkb(BigInt(p.amount)),
    feeCKB: p.fee ? formatCkb(BigInt(p.fee)) : null,
    paymentHash: p.paymentHash,
    failedError: p.failedError ?? null,
    sentAt: p.sentAt,
    resolvedAt: p.resolvedAt ?? null,
  })),
});

async function run(command: string, args: string[]): Promise<unknown> {
  switch (command) {
    case "status":
      return lab.status();
    case "connect":
      return lab.connect();
    case "channel:open":
      return lab.openChannel(ckb(args[0] ?? "500"));
    case "channel:recheck":
      return lab.recheck();
    case "channel:close":
      return lab.closeChannel();
    case "round:new":
      return describeRound(await arena.createRound());
    case "player:pay": {
      const round = arena.round(pickRound(args[0]));
      const paid = await player.payEntry(round.stake.invoice);
      return { round: round.id, player: paid, note: "A held stake stays Inflight at the player until the server settles or refunds it." };
    }
    case "round:check": {
      const round = await arena.refreshStake(pickRound(args[0]));
      const playerView = await player.paymentStatus(round.stake.paymentHash).catch((e: Error) => ({ error: e.message }));
      const pair = await lab.channelPair();
      return { round: describeRound(round), playerPayment: playerView, channelPendingTlcs: pair ? { server: pair.server.pending_tlcs, player: pair.player.pending_tlcs } : null };
    }
    case "round:play": {
      const move = args[0] === "random" ? randomMove() : parseMove(args[0]);
      return describeRound(await arena.play(pickRound(args[1]), move));
    }
    case "round:resolve": {
      const id = pickRound(args[0]);
      const current = arena.round(id);
      const needsInvoice = current.outcome === "win" && !current.payouts.some((p) => p.status !== "failed");
      const invoice = needsInvoice ? await player.winningsInvoice(id) : undefined;
      const round = await arena.resolve(id, invoice);
      const winnings = round.payouts.at(-1);
      return {
        round: describeRound(round),
        playerStakePayment: await player.paymentStatus(round.stake.paymentHash),
        playerWinningsInvoice: winnings ? (await player.invoiceStatus(winnings.paymentHash)).status : null,
      };
    }
    case "round:void":
      return describeRound(await arena.voidRound(pickRound(args[0])));
    case "round:recheck-payout":
      return arena.recheckPayout(pickRound(args[0]));
    case "round:reveal": {
      const revealed = arena.reveal(pickRound(args[0]));
      const checkedByPlayer = verifyReveal(revealed.paymentHash, revealed.preimage);
      return { ...revealed, playerCheck: { hashMatches: true, serverMoveFromPreimage: checkedByPlayer } };
    }
    case "round:show":
      return describeRound(arena.round(pickRound(args[0])));
    default:
      console.log(USAGE);
      return undefined;
  }
}

const argv = process.argv.slice(2);
const saveAt = argv.indexOf("--save");
const savePath = saveAt >= 0 ? argv[saveAt + 1] : undefined;
if (saveAt >= 0) argv.splice(saveAt, 2);
const [command = "help", ...args] = argv;
const json = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);

try {
  const readOnly = command === "status" || command === "round:show" || command === "round:reveal" || command === "help";
  const result = readOnly ? await run(command, args) : await withLock(resolve(root, "runtime/cli.lock"), () => run(command, args));
  if (result !== undefined) {
    console.log(json(result));
    if (savePath) {
      const path = resolve(process.cwd(), savePath);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${json({ capturedAt: new Date().toISOString(), command: `rps ${[command, ...args].join(" ")}`, source: "live RPC, CKB Testnet", result })}\n`);
      console.error(`saved ${path}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
}
