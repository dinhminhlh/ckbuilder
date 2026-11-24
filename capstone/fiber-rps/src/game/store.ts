import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Move, Outcome } from "./rps";

export type StakeStatus =
  | "awaiting_payment" // invoice Open
  | "held" // invoice Received and the TLC is still held with time to spare
  | "held_expiring" // held, but too close to expiry to accept a move: refund it
  | "tlc_missing" // invoice says Received but no held TLC: never settle
  | "settled" // invoice Paid: the server kept the stake
  | "refunded" // invoice Cancelled: the stake went back to the player
  | "expired"; // nobody paid in time

export type PayoutStatus = "sending" | "paid" | "failed" | "unknown";

export interface Payout {
  paymentHash: string;
  invoice: string;
  amount: string;
  status: PayoutStatus;
  fee?: string;
  failedError?: string;
  sentAt: string;
  resolvedAt?: string;
}

export interface Round {
  id: string;
  createdAt: string;
  stake: {
    /** Also the server's move commitment: sha256 of a preimage whose first byte is the move. */
    paymentHash: string;
    invoice: string;
    amount: string;
    finalExpiryDeltaMs: number;
    status: StakeStatus;
    /** Absolute ms of the held TLC's expiry, once seen. */
    heldTlcExpiry?: string;
    /** Set before settle_invoice is sent: from then on the preimage may be stored in fnn and a refund is impossible. */
    settleAttemptedAt?: string;
    cancelAttemptedAt?: string;
    resolvedAt?: string;
  };
  playerMove?: Move;
  playedAt?: string;
  /** From the player's side. */
  outcome?: Outcome;
  /** Winnings for a won round; a failed attempt may be followed by one with a new invoice. */
  payouts: Payout[];
}

export interface Operation {
  kind: "open_channel" | "close_channel";
  at: string;
  fundingPerSide?: string;
  temporaryChannelId?: string;
  acceptAttempted?: boolean;
}

export interface ArenaState {
  version: 2;
  channelId?: string;
  operation?: Operation;
  rounds: Round[];
  /** Hold-invoice preimages by payment hash. Secret until the round is decided; never written to evidence before. */
  preimages: Record<string, string>;
}

export const emptyState = (): ArenaState => ({ version: 2, rounds: [], preimages: {} });

/** A JSON file written atomically (write then rename), so a crash never leaves half a state file. */
export class JsonStore {
  constructor(private readonly path: string) {}

  load(): ArenaState {
    if (!existsSync(this.path)) return emptyState();
    const state = JSON.parse(readFileSync(this.path, "utf8")) as ArenaState;
    if (state.version !== 2) throw new Error(`Unknown state version in ${this.path}`);
    return state;
  }

  save(state: ArenaState): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(`${this.path}.tmp`, `${JSON.stringify(state, null, 2)}\n`);
    renameSync(`${this.path}.tmp`, this.path);
  }
}

/** One command at a time: a second terminal cannot send a duplicate payment while the first is running. */
export function withLock<T>(path: string, work: () => Promise<T>): Promise<T> {
  mkdirSync(dirname(path), { recursive: true });
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch {
    throw new Error(`Another command is running (lock ${path}). If none is, delete the lock file after checking.`);
  }
  return work().finally(() => {
    closeSync(fd);
    unlinkSync(path);
  });
}
