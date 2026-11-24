import type { RpcChannel, RpcPendingTlc } from "../vendor/ckbolt/fiber-rpc.schemas";
import { FIBER_TLC_DIRECTION_INBOUND, FIBER_TLC_STATE_COMMITTED } from "../vendor/ckbolt/fiber-rpc.constants";
import { fromHex } from "./amounts";
import type { StakeStatus } from "./store";

/**
 * The rules for the held stake, as pure functions so they are tested without nodes.
 *
 * fnn v0.9.1 facts behind them (CKBolt docs/research/fiber-node.md 2.1 and 7.1):
 * - A hold invoice goes Open -> Received (TLC held) -> Paid (settled), or Cancelled.
 * - If a held TLC times out, the invoice can still read Received with no TLC left, and settle_invoice would then
 *   "succeed" without any money arriving. So "held" requires the TLC itself in list_channels.pending_tlcs.
 * - cancel_invoice works in Received as long as no preimage was stored.
 */

/** The inbound, committed TLC for `paymentHash` on any of the server's channels. */
export function findHeldTlc(channels: readonly RpcChannel[], paymentHash: string): RpcPendingTlc | undefined {
  const hash = paymentHash.toLowerCase();
  for (const channel of channels) {
    for (const tlc of channel.pending_tlcs) {
      if (tlc.payment_hash.toLowerCase() === hash && isInboundCommitted(tlc.status)) return tlc;
    }
  }
  return undefined;
}

function isInboundCommitted(status: unknown): boolean {
  if (typeof status !== "object" || status === null) return false;
  return (status as Record<string, unknown>)[FIBER_TLC_DIRECTION_INBOUND] === FIBER_TLC_STATE_COMMITTED;
}

export function classifyEntry(
  invoiceStatus: string,
  heldTlc: RpcPendingTlc | undefined,
  nowMs: number,
  minHoldRemainingMs: number,
): StakeStatus {
  switch (invoiceStatus) {
    case "Open":
      return "awaiting_payment";
    case "Paid":
      return "settled";
    case "Cancelled":
      return "refunded";
    case "Expired":
      return "expired";
    case "Received": {
      if (!heldTlc) return "tlc_missing";
      const remaining = Number(fromHex(heldTlc.expiry)) - nowMs;
      return remaining >= minHoldRemainingMs ? "held" : "held_expiring";
    }
    default:
      throw new Error(`Unknown invoice status from fnn: ${invoiceStatus}`);
  }
}

/** True when the player may submit a move. */
export const canAcceptMove = (status: StakeStatus): boolean => status === "held";

/** Settle only a TLC that is actually held; settling anything else stores the preimage for nothing. */
export const canSettle = (status: StakeStatus): boolean => status === "held" || status === "held_expiring";

export const canRefund = (status: StakeStatus, settleAttempted: boolean): boolean =>
  !settleAttempted && (status === "awaiting_payment" || status === "held" || status === "held_expiring" || status === "tlc_missing");

export const isFinal = (status: StakeStatus): boolean => status === "settled" || status === "refunded" || status === "expired";
