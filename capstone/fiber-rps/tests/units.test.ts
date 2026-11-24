import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ckb, formatCkb, fromHex, toHex } from "../src/game/amounts";
import { classifyEntry, findHeldTlc } from "../src/game/entry";
import { newPreimage, sha256Hash } from "../src/game/preimage";
import { MOVES, moveFromPreimage, outcome, parseMove, preimageForMove, verifyReveal } from "../src/game/rps";
import { FiberRpcClient } from "../src/vendor/ckbolt/fiber-rpc.client";
import { FiberRpcError, FiberRpcTransportError } from "../src/vendor/ckbolt/fiber-rpc.errors";

describe("amounts", () => {
  it("converts CKB and shannons exactly", () => {
    assert.equal(ckb("1"), 100_000_000n);
    assert.equal(ckb("0.3"), 30_000_000n);
    assert.equal(formatCkb(ckb("498.99999472")), "498.99999472");
    assert.equal(toHex(ckb("1")), "0x5f5e100");
    assert.equal(fromHex("0x5f5e100"), 100_000_000n);
    assert.throws(() => ckb("0"));
    assert.throws(() => ckb("1.123456789"));
    assert.throws(() => ckb("-1"));
  });
});

describe("preimage", () => {
  it("hashes with SHA-256 (the known vector for 32 zero bytes)", () => {
    assert.equal(sha256Hash(`0x${"00".repeat(32)}`), "0x66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925");
    const p = newPreimage();
    assert.match(p, /^0x[0-9a-f]{64}$/);
    assert.notEqual(newPreimage(), p);
  });
});

describe("rock-paper-scissors", () => {
  it("decides every pair from the player's side", () => {
    const table: Record<string, string> = {
      "rock-rock": "draw", "rock-paper": "lose", "rock-scissors": "win",
      "paper-rock": "win", "paper-paper": "draw", "paper-scissors": "lose",
      "scissors-rock": "lose", "scissors-paper": "win", "scissors-scissors": "draw",
    };
    for (const p of MOVES) for (const s of MOVES) assert.equal(outcome(p, s), table[`${p}-${s}`], `${p} vs ${s}`);
  });

  it("encodes the move in byte 0 of a random preimage, and verifies a reveal", () => {
    for (const move of MOVES) {
      const preimage = preimageForMove(move);
      assert.match(preimage, /^0x0[123][0-9a-f]{62}$/);
      assert.equal(moveFromPreimage(preimage), move);
      assert.equal(verifyReveal(sha256Hash(preimage), preimage), move);
    }
    assert.notEqual(preimageForMove("rock"), preimageForMove("rock"), "the 31 random bytes hide the move");
    assert.throws(() => verifyReveal(sha256Hash(preimageForMove("rock")), preimageForMove("rock")), /does not match/);
    assert.throws(() => moveFromPreimage(`0x04${"00".repeat(31)}`), /does not encode a move/);
    assert.equal(parseMove("Rock"), "rock");
    assert.throws(() => parseMove("lizard"));
  });
});

describe("stake classification", () => {
  const tlc = (expiry: number, status: unknown = { Inbound: "Committed" }) => ({
    amount: "0x5f5e100",
    payment_hash: "0xAB",
    expiry: `0x${expiry.toString(16)}`,
    status,
  });
  const channel = (pending: ReturnType<typeof tlc>[]) => ({
    channel_id: "0x1",
    pubkey: "02",
    state: { state_name: "ChannelReady" },
    local_balance: "0x0",
    remote_balance: "0x0",
    pending_tlcs: pending,
  });

  it("finds only an inbound committed TLC for the hash, case-insensitively", () => {
    assert.ok(findHeldTlc([channel([tlc(1)])], "0xab"));
    assert.equal(findHeldTlc([channel([tlc(1, { Outbound: "Committed" })])], "0xab"), undefined);
    assert.equal(findHeldTlc([channel([tlc(1, { Inbound: "LocalRemoved" })])], "0xab"), undefined);
    assert.equal(findHeldTlc([channel([tlc(1)])], "0xcd"), undefined);
  });

  it("maps invoice status plus TLC to the game's entry status", () => {
    const now = 1_000_000;
    assert.equal(classifyEntry("Open", undefined, now, 100), "awaiting_payment");
    assert.equal(classifyEntry("Received", tlc(now + 100), now, 100), "held");
    assert.equal(classifyEntry("Received", tlc(now + 99), now, 100), "held_expiring");
    assert.equal(classifyEntry("Received", undefined, now, 100), "tlc_missing");
    assert.equal(classifyEntry("Paid", undefined, now, 100), "settled");
    assert.equal(classifyEntry("Cancelled", undefined, now, 100), "refunded");
    assert.equal(classifyEntry("Expired", undefined, now, 100), "expired");
    assert.throws(() => classifyEntry("Weird", undefined, now, 100));
  });
});

describe("vendored CKBolt RPC client", () => {
  const client = (answer: () => Promise<{ ok: boolean; status: number; text(): Promise<string> }>) =>
    new FiberRpcClient({ url: "http://127.0.0.1:8237", timeoutMs: 1_000, httpPost: answer });

  it("returns a validated result", async () => {
    const rpc = client(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: { channel_id: "0x9" } }) }));
    assert.deepEqual(await rpc.request("accept_channel", { temporary_channel_id: "0x1", funding_amount: "0x1" }), { channel_id: "0x9" });
  });

  it("turns a node error into FiberRpcError and a lost answer into FiberRpcTransportError", async () => {
    const refused = client(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "invoice not found" } }) }));
    await assert.rejects(refused.request("get_invoice", { payment_hash: "0x1" }), FiberRpcError);
    const down = client(async () => {
      throw new Error("ECONNREFUSED");
    });
    await assert.rejects(down.request("node_info"), FiberRpcTransportError);
  });
});
