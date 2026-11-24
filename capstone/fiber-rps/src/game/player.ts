import type { FiberRpc } from "../vendor/ckbolt/fiber-rpc.schemas";
import { FIBER_RPC_METHOD } from "../vendor/ckbolt/fiber-rpc.constants";
import { FiberRpcTransportError } from "../vendor/ckbolt/fiber-rpc.errors";
import { toHex } from "./amounts";
import { GAME, TESTNET_CURRENCY } from "./config";

/**
 * The lab's demo player: the Week 6 Alice node, driven from the CLI. In the web version (Week 10) the player pays the
 * stake invoice and gives a winnings invoice from their own Fiber wallet instead.
 */
export class DemoPlayer {
  constructor(private readonly node: FiberRpc) {}

  /**
   * Pays the stake hold invoice. The payment stays Inflight while the server holds it, so this does not wait for
   * Success. A transport error leaves the outcome unknown: read `paymentStatus` before paying again.
   */
  async payEntry(invoice: string): Promise<{ paymentHash: string; status: string; outcomeUnknown?: true }> {
    const parsed = await this.node.request(FIBER_RPC_METHOD.PARSE_INVOICE, { invoice });
    const paymentHash = parsed.invoice.data.payment_hash;
    try {
      const sent = await this.node.request(FIBER_RPC_METHOD.SEND_PAYMENT, {
        invoice,
        max_fee_amount: toHex(GAME.maxRoutingFee),
        tlc_expiry_limit: toHex(GAME.tlcExpiryLimitMs),
        max_parts: "0x1",
      });
      return { paymentHash, status: sent.status };
    } catch (error) {
      if (error instanceof FiberRpcTransportError) return { paymentHash, status: "unknown", outcomeUnknown: true };
      throw error;
    }
  }

  /** A plain invoice (the node keeps the preimage) for a won round's winnings. */
  async winningsInvoice(roundId: string, amount: bigint = GAME.winnings): Promise<string> {
    const created = await this.node.request(FIBER_RPC_METHOD.NEW_INVOICE, {
      amount: toHex(amount),
      currency: TESTNET_CURRENCY,
      description: `Fiber RPS winnings ${roundId}`,
      hash_algorithm: "sha256",
      expiry: toHex(10 * 60),
    });
    return created.invoice_address;
  }

  async paymentStatus(paymentHash: string) {
    return this.node.request(FIBER_RPC_METHOD.GET_PAYMENT, { payment_hash: paymentHash });
  }

  async invoiceStatus(paymentHash: string) {
    return this.node.request(FIBER_RPC_METHOD.GET_INVOICE, { payment_hash: paymentHash });
  }
}
