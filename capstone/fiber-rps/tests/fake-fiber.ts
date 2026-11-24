import type { FiberRpc, FiberRpcCalls, FiberRpcParams, FiberRpcResult, RpcChannel } from "../src/vendor/ckbolt/fiber-rpc.schemas";
import { FiberRpcError, FiberRpcTransportError } from "../src/vendor/ckbolt/fiber-rpc.errors";
import { emptyState, type ArenaState } from "../src/game/store";

/**
 * An in-memory stand-in for the game server's fnn node: just enough of v0.9.1's invoice, TLC and payment behaviour to
 * test the arena's rules. Tests move it along by hand (`holdTlc`, `dropTlc`, `finishPayment`).
 */
export class FakeServerNode implements FiberRpc {
  calls: { method: string; params: unknown }[] = [];
  invoices = new Map<string, { address: string; amount: bigint; status: string; hold: boolean; preimage?: string }>();
  /** Invoices the "player" made, readable by parse_invoice. */
  foreignInvoices = new Map<string, { paymentHash: string; amount: bigint; currency: string }>();
  payments = new Map<string, { status: string; fee: string }>();
  tlcs: { payment_hash: string; amount: string; expiry: string; status: unknown }[] = [];
  /** Next send_payment: "ok" creates an Inflight session; "transport" creates it but loses the answer; "refuse" creates nothing. */
  sendMode: "ok" | "transport" | "refuse" = "ok";
  /** When set, an Inflight payment reaches this status the next time get_payment reads it. */
  autoComplete?: "Success" | "Failed";

  async request<M extends keyof FiberRpcCalls>(method: M, ...params: FiberRpcParams<M>): Promise<FiberRpcResult<M>> {
    const p = params[0] as Record<string, any>;
    this.calls.push({ method, params: p });
    return this.handle(method, p) as FiberRpcResult<M>;
  }

  private handle(method: string, p: Record<string, any>): unknown {
    switch (method) {
      case "new_invoice": {
        const hash = p.payment_hash as string;
        const address = `fibt-entry-${hash.slice(2, 10)}`;
        this.invoices.set(hash, { address, amount: BigInt(p.amount), status: "Open", hold: true });
        return { invoice_address: address, invoice: this.invoice(hash, BigInt(p.amount)) };
      }
      case "get_invoice": {
        const inv = this.invoices.get(p.payment_hash);
        if (!inv) throw new FiberRpcError(method, -32000, "invoice not found");
        return { invoice_address: inv.address, invoice: this.invoice(p.payment_hash, inv.amount), status: inv.status };
      }
      case "list_channels":
        return { channels: [this.channel()] };
      case "settle_invoice": {
        const inv = this.invoices.get(p.payment_hash)!;
        if (inv.status !== "Received") throw new FiberRpcError(method, -32000, `Invoice is ${inv.status}`);
        inv.preimage = p.payment_preimage;
        inv.status = "Paid";
        this.tlcs = this.tlcs.filter((t) => t.payment_hash !== p.payment_hash);
        return null;
      }
      case "cancel_invoice": {
        const inv = this.invoices.get(p.payment_hash)!;
        if (inv.preimage || inv.status === "Paid") throw new FiberRpcError(method, -32000, "PaymentPreimageAlreadyExists");
        inv.status = "Cancelled";
        this.tlcs = this.tlcs.filter((t) => t.payment_hash !== p.payment_hash);
        return { invoice_address: inv.address, invoice: this.invoice(p.payment_hash, inv.amount), status: "Cancelled" };
      }
      case "parse_invoice": {
        const f = this.foreignInvoices.get(p.invoice);
        if (!f) throw new FiberRpcError(method, -32000, "invalid invoice");
        return { invoice: { currency: f.currency, amount: `0x${f.amount.toString(16)}`, data: { timestamp: "0x0", payment_hash: f.paymentHash, attrs: [] } } };
      }
      case "send_payment": {
        const f = this.foreignInvoices.get(p.invoice)!;
        if (this.sendMode === "refuse") throw new FiberRpcError(method, -32000, "Failed to build route");
        this.payments.set(f.paymentHash, { status: "Inflight", fee: "0x0" });
        if (this.sendMode === "transport") throw new FiberRpcTransportError(method, "timeout", "no answer");
        return { payment_hash: f.paymentHash, status: "Inflight", fee: "0x0" };
      }
      case "get_payment": {
        const pay = this.payments.get(p.payment_hash);
        if (!pay) throw new FiberRpcError(method, -32000, `InvalidParameter: Payment session not found: ${p.payment_hash}`);
        if (this.autoComplete && pay.status === "Inflight") pay.status = this.autoComplete;
        return { payment_hash: p.payment_hash, status: pay.status, fee: pay.fee };
      }
      default:
        throw new Error(`fake node: ${method} not modelled`);
    }
  }

  private invoice(hash: string, amount: bigint) {
    return { currency: "Fibt", amount: `0x${amount.toString(16)}`, data: { timestamp: "0x0", payment_hash: hash, attrs: [] } };
  }

  private channel(): RpcChannel {
    return {
      channel_id: "0xchannel",
      pubkey: "02player",
      state: { state_name: "ChannelReady" },
      local_balance: "0x0",
      remote_balance: "0x0",
      pending_tlcs: this.tlcs.map((t) => ({ ...t, forwarding_channel_id: null })),
    };
  }

  /** The player's entry TLC arrives and is held: invoice Received. */
  holdTlc(paymentHash: string, expiryMs: number) {
    const inv = this.invoices.get(paymentHash)!;
    inv.status = "Received";
    this.tlcs.push({ payment_hash: paymentHash, amount: `0x${inv.amount.toString(16)}`, expiry: `0x${expiryMs.toString(16)}`, status: { Inbound: "Committed" } });
  }

  /** The held TLC times out but fnn leaves the invoice Received (the v0.9.1 gotcha). */
  dropTlc(paymentHash: string) {
    this.tlcs = this.tlcs.filter((t) => t.payment_hash !== paymentHash);
  }

  addPlayerInvoice(invoice: string, paymentHash: string, amount: bigint, currency = "Fibt") {
    this.foreignInvoices.set(invoice, { paymentHash, amount, currency });
  }

  finishPayment(paymentHash: string, status: "Success" | "Failed") {
    this.payments.get(paymentHash)!.status = status;
  }

  count(method: string): number {
    return this.calls.filter((c) => c.method === method).length;
  }
}

export function memoryStore() {
  let state: ArenaState = emptyState();
  return {
    load: () => structuredClone(state),
    save: (next: ArenaState) => {
      state = structuredClone(next);
    },
  };
}
