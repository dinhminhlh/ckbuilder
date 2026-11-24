import type { FiberRpc } from "../vendor/ckbolt/fiber-rpc.schemas";
import { FIBER_RPC_ERROR_PATTERN, FIBER_RPC_METHOD } from "../vendor/ckbolt/fiber-rpc.constants";
import { FiberRpcError, FiberRpcTransportError, isFiberRpcErrorMatching } from "../vendor/ckbolt/fiber-rpc.errors";
import { fromHex, toHex } from "./amounts";
import { GAME, TESTNET_CURRENCY } from "./config";
import { canAcceptMove, canRefund, canSettle, classifyEntry, findHeldTlc, isFinal } from "./entry";
import { sha256Hash } from "./preimage";
import { moveFromPreimage, outcome, preimageForMove, randomMove, type Move } from "./rps";
import type { ArenaState, Payout, Round, StakeStatus } from "./store";

export interface ArenaDeps {
  /** The game server's Fiber node. */
  server: FiberRpc;
  load(): ArenaState;
  save(state: ArenaState): void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** How long to wait for a payment or invoice to reach a final status. */
  pollTimeoutMs?: number;
  /** The server's move for a new round; random by default. Tests fix it. */
  pickServerMove?: () => Move;
  game?: Partial<typeof GAME>;
}

export class ArenaError extends Error {
  override name = "ArenaError";
}

/**
 * The game server's rules for one rock-paper-scissors round against the server:
 * - lose: the server settles the held stake (keeps it);
 * - draw: the server cancels the hold (stake returned);
 * - win: the server cancels the hold and pays the winnings to the player's invoice.
 * Every write is recorded in the state file before it is sent, and an unclear outcome is re-read from the node, never
 * repeated blindly: a round pays winnings at most once.
 */
export class Arena {
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollTimeoutMs: number;
  private readonly pickServerMove: () => Move;
  private readonly game: typeof GAME;

  constructor(private readonly deps: ArenaDeps) {
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.pollTimeoutMs = deps.pollTimeoutMs ?? 60_000;
    this.pickServerMove = deps.pickServerMove ?? randomMove;
    this.game = { ...GAME, ...deps.game };
  }

  /* --------------------------------------------------------------------------------------------- New round */

  /** Commits the server's move and opens a hold invoice for the stake. The preimage is saved before the invoice exists. */
  async createRound(): Promise<Round> {
    const preimage = preimageForMove(this.pickServerMove());
    const paymentHash = sha256Hash(preimage);
    const id = `round-${new Date(this.now()).toISOString().replace(/[-:]/g, "").slice(0, 15)}-${paymentHash.slice(2, 8)}`;

    const state = this.deps.load();
    state.preimages[paymentHash] = preimage;
    this.deps.save(state);

    const created = await this.deps.server.request(FIBER_RPC_METHOD.NEW_INVOICE, {
      amount: toHex(this.game.stake),
      currency: TESTNET_CURRENCY,
      description: `Fiber RPS stake ${id}`,
      hash_algorithm: "sha256",
      expiry: toHex(this.game.entryInvoiceExpirySeconds),
      payment_hash: paymentHash,
      final_expiry_delta: toHex(this.game.entryFinalExpiryDeltaMs),
    });
    if (created.invoice.data.payment_hash.toLowerCase() !== paymentHash) throw new ArenaError("fnn made an invoice for another hash.");

    const round: Round = {
      id,
      createdAt: new Date(this.now()).toISOString(),
      stake: {
        paymentHash,
        invoice: created.invoice_address,
        amount: this.game.stake.toString(),
        finalExpiryDeltaMs: this.game.entryFinalExpiryDeltaMs,
        status: "awaiting_payment",
      },
      payouts: [],
    };
    const next = this.deps.load();
    next.rounds.push(round);
    this.deps.save(next);
    return round;
  }

  /** Re-reads the stake invoice and the held TLC from the server node. */
  async refreshStake(roundId: string): Promise<Round> {
    const round = this.round(roundId);
    const [invoice, channels] = await Promise.all([
      this.deps.server.request(FIBER_RPC_METHOD.GET_INVOICE, { payment_hash: round.stake.paymentHash }),
      this.deps.server.request(FIBER_RPC_METHOD.LIST_CHANNELS, {}),
    ]);
    const tlc = findHeldTlc(channels.channels, round.stake.paymentHash);
    if (tlc && fromHex(tlc.amount) < BigInt(round.stake.amount)) {
      throw new ArenaError(`The held TLC pays ${tlc.amount}, less than the stake. Void the round.`);
    }
    const status = classifyEntry(invoice.status, tlc, this.now(), this.game.minHoldRemainingMs);
    return this.update(roundId, (r) => {
      r.stake.status = status;
      if (tlc) r.stake.heldTlcExpiry = fromHex(tlc.expiry).toString();
      if (isFinal(status) && !r.stake.resolvedAt) r.stake.resolvedAt = new Date(this.now()).toISOString();
    });
  }

  /* ---------------------------------------------------------------------------------------------------- Play */

  /** Takes the player's one move, once the stake is held, and decides the round against the committed move. */
  async play(roundId: string, move: Move): Promise<Round> {
    const round = await this.refreshStake(roundId);
    if (round.playerMove) throw new ArenaError(`This round already has the move ${round.playerMove}.`);
    if (!canAcceptMove(round.stake.status)) throw new ArenaError(`No move while the stake is ${round.stake.status}.`);
    const serverMove = moveFromPreimage(this.preimage(round));
    return this.update(roundId, (r) => {
      r.playerMove = move;
      r.playedAt = new Date(this.now()).toISOString();
      r.outcome = outcome(move, serverMove);
    });
  }

  /**
   * Carries out the decided round: settle on a loss, refund on a draw, refund and pay `winnerInvoice` on a win.
   * Safe to run again: each step checks what is already done.
   */
  async resolve(roundId: string, winnerInvoice?: string): Promise<Round> {
    const round = this.round(roundId);
    if (!round.outcome) throw new ArenaError("The player has not played yet. Play, or void the round.");
    if (round.outcome === "lose") return this.settleStake(roundId);
    if (round.outcome === "win" && !winnerInvoice && !this.hasActivePayout(round)) {
      throw new ArenaError("A won round needs the player's invoice for the winnings.");
    }
    const refunded = await this.refundStake(roundId);
    if (round.outcome === "draw") return refunded;
    if (!this.hasActivePayout(refunded)) await this.payWinnings(roundId, winnerInvoice!);
    return this.round(roundId);
  }

  /** The player paid but never played (or the hold expires before a move): give the stake back. */
  async voidRound(roundId: string): Promise<Round> {
    if (this.round(roundId).playerMove) throw new ArenaError("The player already played; resolve the round instead.");
    return this.refundStake(roundId);
  }

  /** The preimage, once the stake is final, so the player can check the server's committed move. */
  reveal(roundId: string): { paymentHash: string; preimage: string; serverMove: Move } {
    const round = this.round(roundId);
    if (!isFinal(round.stake.status)) throw new ArenaError(`Nothing to reveal while the stake is ${round.stake.status}.`);
    const preimage = this.preimage(round);
    return { paymentHash: round.stake.paymentHash, preimage, serverMove: moveFromPreimage(preimage) };
  }

  /* ----------------------------------------------------------------------------------------- Stake settlement */

  private async settleStake(roundId: string): Promise<Round> {
    const round = await this.refreshStake(roundId);
    if (round.stake.status === "settled") return round;
    if (!canSettle(round.stake.status)) throw new ArenaError(`Cannot settle a stake that is ${round.stake.status}.`);
    const preimage = this.preimage(round);
    this.update(roundId, (r) => (r.stake.settleAttemptedAt ??= new Date(this.now()).toISOString()));
    try {
      await this.deps.server.request(FIBER_RPC_METHOD.SETTLE_INVOICE, { payment_hash: round.stake.paymentHash, payment_preimage: preimage });
    } catch (error) {
      if (!(error instanceof FiberRpcTransportError)) throw error;
      // Unknown outcome: read the invoice instead of sending again.
    }
    return this.waitForStake(roundId, "settled");
  }

  private async refundStake(roundId: string): Promise<Round> {
    const round = await this.refreshStake(roundId);
    if (round.stake.status === "refunded") return round;
    if (!canRefund(round.stake.status, round.stake.settleAttemptedAt !== undefined)) {
      throw new ArenaError(`Cannot refund a stake that is ${round.stake.status}${round.stake.settleAttemptedAt ? " after a settle attempt" : ""}.`);
    }
    this.update(roundId, (r) => (r.stake.cancelAttemptedAt ??= new Date(this.now()).toISOString()));
    try {
      await this.deps.server.request(FIBER_RPC_METHOD.CANCEL_INVOICE, { payment_hash: round.stake.paymentHash });
    } catch (error) {
      if (!(error instanceof FiberRpcTransportError)) throw error;
    }
    return this.waitForStake(roundId, "refunded");
  }

  private async waitForStake(roundId: string, target: StakeStatus): Promise<Round> {
    const deadline = this.now() + this.pollTimeoutMs;
    for (;;) {
      const round = await this.refreshStake(roundId);
      if (round.stake.status === target) return round;
      if (this.now() >= deadline) {
        throw new ArenaError(`Stake is still ${round.stake.status}, not ${target}. Check again later; do not repeat the write.`);
      }
      await this.sleep(1_000);
    }
  }

  /* -------------------------------------------------------------------------------------------------- Winnings */

  private hasActivePayout(round: Round): boolean {
    return round.payouts.some((p) => p.status !== "failed");
  }

  private async payWinnings(roundId: string, playerInvoice: string): Promise<Payout> {
    const round = this.round(roundId);
    if (round.outcome !== "win") throw new ArenaError("Only a won round pays winnings.");
    if (round.stake.status !== "refunded") throw new ArenaError("Return the stake before paying winnings.");
    if (this.hasActivePayout(round)) throw new ArenaError("This round's winnings are already paid or unresolved.");

    const parsed = await this.deps.server.request(FIBER_RPC_METHOD.PARSE_INVOICE, { invoice: playerInvoice });
    const paymentHash = parsed.invoice.data.payment_hash.toLowerCase();
    if (parsed.invoice.currency !== TESTNET_CURRENCY) throw new ArenaError(`Winnings invoices must be ${TESTNET_CURRENCY} (CKB Testnet).`);
    if (fromHex(parsed.invoice.amount) !== this.game.winnings) {
      throw new ArenaError(`The winnings invoice must ask for exactly ${this.game.winnings} shannons.`);
    }
    const used = new Set(this.deps.load().rounds.flatMap((r) => [r.stake.paymentHash, ...r.payouts.map((p) => p.paymentHash)]));
    if (used.has(paymentHash)) throw new ArenaError("This invoice's payment hash was already used.");

    const payout: Payout = {
      paymentHash,
      invoice: playerInvoice,
      amount: this.game.winnings.toString(),
      status: "sending",
      sentAt: new Date(this.now()).toISOString(),
    };
    this.update(roundId, (r) => r.payouts.push(payout)); // recorded before sending

    try {
      await this.deps.server.request(FIBER_RPC_METHOD.SEND_PAYMENT, {
        invoice: playerInvoice,
        max_fee_amount: toHex(this.game.maxRoutingFee),
        tlc_expiry_limit: toHex(this.game.tlcExpiryLimitMs),
        max_parts: "0x1",
      });
    } catch (error) {
      if (error instanceof FiberRpcError) {
        // fnn refused the call. Read whether a session exists anyway before calling it failed.
        if ((await this.readPayment(paymentHash)) === "not_found") {
          return this.setPayout(roundId, paymentHash, { status: "failed", failedError: error.rpcMessage });
        }
      } else if (!(error instanceof FiberRpcTransportError)) {
        throw error;
      }
    }
    return this.waitForPayout(roundId, paymentHash);
  }

  /** Re-reads an unresolved payout. Never sends anything. */
  async recheckPayout(roundId: string): Promise<Payout> {
    const payout = this.round(roundId).payouts.at(-1);
    if (!payout) throw new ArenaError("This round has no payout.");
    if (payout.status === "paid" || payout.status === "failed") return payout;
    if ((await this.readPayment(payout.paymentHash)) === "not_found") {
      return this.setPayout(roundId, payout.paymentHash, { status: "failed", failedError: "fnn has no payment session: it was never sent" });
    }
    return this.waitForPayout(roundId, payout.paymentHash);
  }

  private async waitForPayout(roundId: string, paymentHash: string): Promise<Payout> {
    const deadline = this.now() + this.pollTimeoutMs;
    for (;;) {
      const payment = await this.readPayment(paymentHash);
      if (payment !== "not_found" && payment.status === "Success") {
        return this.setPayout(roundId, paymentHash, { status: "paid", fee: fromHex(payment.fee).toString() });
      }
      if (payment !== "not_found" && payment.status === "Failed") {
        return this.setPayout(roundId, paymentHash, { status: "failed", failedError: payment.failed_error ?? "Failed" });
      }
      if (this.now() >= deadline) return this.setPayout(roundId, paymentHash, { status: "unknown" });
      await this.sleep(1_000);
    }
  }

  private async readPayment(paymentHash: string) {
    try {
      return await this.deps.server.request(FIBER_RPC_METHOD.GET_PAYMENT, { payment_hash: paymentHash });
    } catch (error) {
      if (isFiberRpcErrorMatching(error, FIBER_RPC_ERROR_PATTERN.PAYMENT_NOT_FOUND)) return "not_found" as const;
      throw error;
    }
  }

  /* --------------------------------------------------------------------------------------------------- State */

  round(roundId: string): Round {
    const round = this.deps.load().rounds.find((r) => r.id === roundId);
    if (!round) throw new ArenaError(`No round ${roundId}.`);
    return round;
  }

  latestRound(): Round | undefined {
    return this.deps.load().rounds.at(-1);
  }

  private preimage(round: Round): string {
    const preimage = this.deps.load().preimages[round.stake.paymentHash];
    if (!preimage || sha256Hash(preimage) !== round.stake.paymentHash) throw new ArenaError("The saved preimage is missing or wrong.");
    return preimage;
  }

  private update(roundId: string, change: (round: Round) => void): Round {
    const state = this.deps.load();
    const round = state.rounds.find((r) => r.id === roundId);
    if (!round) throw new ArenaError(`No round ${roundId}.`);
    change(round);
    this.deps.save(state);
    return round;
  }

  private setPayout(roundId: string, paymentHash: string, patch: Partial<Payout>): Payout {
    let result: Payout | undefined;
    this.update(roundId, (r) => {
      const payout = r.payouts.find((p) => p.paymentHash === paymentHash);
      if (!payout) throw new ArenaError(`No payout ${paymentHash} in ${roundId}.`);
      Object.assign(payout, patch);
      if (patch.status === "paid" || patch.status === "failed") payout.resolvedAt = new Date(this.now()).toISOString();
      result = { ...payout };
    });
    return result!;
  }
}
