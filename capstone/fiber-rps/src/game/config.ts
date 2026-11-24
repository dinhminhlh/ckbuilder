import { ckb } from "./amounts";

/** CKB Testnet genesis hash. Every node must report it as `chain_hash`; the game refuses any other chain. */
export const TESTNET_GENESIS = "0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606";
export const TESTNET_CKB_RPC = "https://testnet.ckbapp.dev/";
export const FIBER_VERSION = "0.9.1";
/** Invoice currency on CKB Testnet. */
export const TESTNET_CURRENCY = "Fibt";

/** Loopback-only node endpoints: the game server's node and the lab's demo player node (the Week 6 Bob and Alice). */
export const NODES = {
  server: { name: "server", url: "http://127.0.0.1:8237", p2p: "/ip4/127.0.0.1/tcp/8238" },
  player: { name: "player", url: "http://127.0.0.1:8227", p2p: "/ip4/127.0.0.1/tcp/8228" },
} as const;

const MINUTE = 60_000;

export const GAME = {
  /** What the player puts in: held by the server until the round is decided. */
  stake: ckb("1"),
  /** Paid to a winning player on top of the returned stake. */
  winnings: ckb("1"),
  /** Seconds a player has to pay the stake invoice. */
  entryInvoiceExpirySeconds: 15 * 60,
  /**
   * The held stake TLC must outlive the round. fnn fails a held TLC about 160 min + 60 s before its expiry, so the
   * guaranteed hold window is final_expiry_delta - 160 min: 6 h gives about 3 h 20 min.
   */
  entryFinalExpiryDeltaMs: 6 * 60 * MINUTE,
  /** Refuse to accept a move when the held TLC has less than this left before fnn would fail it. */
  minHoldRemainingMs: (160 + 30) * MINUTE,
  /** Upper bound on the expiry the payer's node may put on a payment's TLCs. */
  tlcExpiryLimitMs: 24 * 60 * MINUTE,
  /** Two nodes on one direct channel: no routing fee. */
  maxRoutingFee: 0n,
  rpcTimeoutMs: 15_000,
} as const;

export const CHANNEL = {
  minFundingPerSide: ckb("200"),
  maxFundingPerSide: ckb("1000"),
  /** Plain CKB each node keeps outside the channel for fees and cell capacity. */
  onChainReserve: ckb("200"),
  /** Cooperative close fee rate, shannons per 1000 bytes. */
  closeFeeRate: 1000n,
} as const;
