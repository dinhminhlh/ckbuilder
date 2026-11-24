import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Arena, ArenaError } from "../src/game/arena";
import { GAME } from "../src/game/config";
import { sha256Hash } from "../src/game/preimage";
import { moveFromPreimage, verifyReveal, type Move } from "../src/game/rps";
import { FakeServerNode, memoryStore } from "./fake-fiber";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 24, 12);
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

function setup(serverMove: Move = "rock") {
  const node = new FakeServerNode();
  const store = memoryStore();
  let now = NOW;
  const arena = new Arena({
    server: node,
    ...store,
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
    pollTimeoutMs: 5_000,
    pickServerMove: () => serverMove,
  });
  return { node, store, arena };
}

/** A round whose stake is paid and held. */
async function held(serverMove: Move = "rock") {
  const ctx = setup(serverMove);
  const round = await ctx.arena.createRound();
  ctx.node.holdTlc(round.stake.paymentHash, NOW + 6 * HOUR);
  return { ...ctx, round };
}

describe("stake and commitment", () => {
  it("commits the server's move in a SHA-256 hold invoice, preimage saved first", async () => {
    const { node, store, arena } = setup("paper");
    const round = await arena.createRound();
    const call = node.calls.find((c) => c.method === "new_invoice")!.params as Record<string, string>;
    assert.equal(call.hash_algorithm, "sha256");
    assert.equal(call.payment_hash, round.stake.paymentHash);
    assert.equal(call.payment_preimage, undefined, "a hold invoice must not carry the preimage");
    assert.equal(BigInt(call.final_expiry_delta), BigInt(GAME.entryFinalExpiryDeltaMs));
    assert.equal(BigInt(call.amount), GAME.stake);
    const preimage = store.load().preimages[round.stake.paymentHash];
    assert.equal(sha256Hash(preimage), round.stake.paymentHash);
    assert.equal(moveFromPreimage(preimage), "paper");
  });

  it("takes no move before the stake is held, and only one move", async () => {
    const { node, arena } = setup();
    const round = await arena.createRound();
    await assert.rejects(arena.play(round.id, "rock"), /awaiting_payment/);
    node.holdTlc(round.stake.paymentHash, NOW + 6 * HOUR);
    await arena.play(round.id, "paper");
    await assert.rejects(arena.play(round.id, "scissors"), /already has the move paper/);
  });

  it("takes no move when the hold is close to expiry; the round can be voided", async () => {
    const { node, arena } = setup();
    const round = await arena.createRound();
    node.holdTlc(round.stake.paymentHash, NOW + GAME.minHoldRemainingMs - 1);
    await assert.rejects(arena.play(round.id, "rock"), /held_expiring/);
    assert.equal((await arena.voidRound(round.id)).stake.status, "refunded");
  });

  it("reveals nothing before the stake is final", async () => {
    const { arena, round } = await held();
    await arena.play(round.id, "rock");
    assert.throws(() => arena.reveal(round.id), /Nothing to reveal while the stake is held/);
  });
});

describe("resolving a round", () => {
  it("lose: settles the stake and the reveal proves the server's move", async () => {
    const { node, arena, round } = await held("paper");
    const played = await arena.play(round.id, "rock");
    assert.equal(played.outcome, "lose");
    const resolved = await arena.resolve(round.id);
    assert.equal(resolved.stake.status, "settled");
    assert.equal(node.count("cancel_invoice"), 0);
    assert.equal(node.count("send_payment"), 0);
    const revealed = arena.reveal(round.id);
    assert.equal(verifyReveal(round.stake.paymentHash, revealed.preimage), "paper");
  });

  it("draw: refunds the stake and pays nothing", async () => {
    const { node, arena, round } = await held("scissors");
    assert.equal((await arena.play(round.id, "scissors")).outcome, "draw");
    const resolved = await arena.resolve(round.id);
    assert.equal(resolved.stake.status, "refunded");
    assert.equal(node.count("settle_invoice"), 0);
    assert.equal(node.count("send_payment"), 0);
  });

  it("win: refunds the stake, then pays the winnings once", async () => {
    const { node, arena, round } = await held("scissors");
    assert.equal((await arena.play(round.id, "rock")).outcome, "win");
    await assert.rejects(arena.resolve(round.id), /needs the player's invoice/);
    assert.equal(node.count("cancel_invoice"), 0, "nothing is done without the invoice");

    node.addPlayerInvoice("fibt-win", hash(1), GAME.winnings);
    node.autoComplete = "Success";
    const resolved = await arena.resolve(round.id, "fibt-win");
    assert.equal(resolved.stake.status, "refunded");
    assert.equal(resolved.payouts[0].status, "paid");
    assert.equal(node.count("settle_invoice"), 0);

    node.addPlayerInvoice("fibt-win-2", hash(2), GAME.winnings);
    await arena.resolve(round.id, "fibt-win-2");
    assert.equal(node.count("send_payment"), 1, "running resolve again pays nothing more");
  });

  it("win: checks the winnings invoice (amount, network, reused hash)", async () => {
    const { node, arena, round } = await held("rock");
    await arena.play(round.id, "paper");
    node.addPlayerInvoice("too-much", hash(3), GAME.winnings + 1n);
    node.addPlayerInvoice("mainnet", hash(4), GAME.winnings, "Fibb");
    node.addPlayerInvoice("stake-hash", round.stake.paymentHash, GAME.winnings);
    await assert.rejects(arena.resolve(round.id, "too-much"), /exactly/);
    await assert.rejects(arena.resolve(round.id, "mainnet"), /Fibt/);
    await assert.rejects(arena.resolve(round.id, "stake-hash"), /already used/);
    assert.equal(node.count("send_payment"), 0);
  });

  it("win: an unanswered payout is rechecked, never resent", async () => {
    const { node, arena, round } = await held("paper");
    await arena.play(round.id, "scissors");
    node.sendMode = "transport";
    node.addPlayerInvoice("fibt-win", hash(5), GAME.winnings);
    const resolved = await arena.resolve(round.id, "fibt-win");
    assert.equal(resolved.payouts[0].status, "unknown");

    node.addPlayerInvoice("fibt-win-2", hash(6), GAME.winnings);
    await arena.resolve(round.id, "fibt-win-2");
    assert.equal(node.count("send_payment"), 1);

    node.finishPayment(hash(5), "Success");
    assert.equal((await arena.recheckPayout(round.id)).status, "paid");
  });

  it("win: a refused payout with no session fails, and a new invoice can be paid", async () => {
    const { node, arena, round } = await held("scissors");
    await arena.play(round.id, "rock");
    node.sendMode = "refuse";
    node.addPlayerInvoice("fibt-a", hash(7), GAME.winnings);
    assert.equal((await arena.resolve(round.id, "fibt-a")).payouts[0].status, "failed");

    node.sendMode = "ok";
    node.autoComplete = "Success";
    node.addPlayerInvoice("fibt-b", hash(8), GAME.winnings);
    assert.equal((await arena.resolve(round.id, "fibt-b")).payouts[1].status, "paid");
  });

  it("never settles when the invoice says Received but the TLC is gone", async () => {
    const { node, arena, round } = await held("paper");
    await arena.play(round.id, "rock");
    node.dropTlc(round.stake.paymentHash);
    await assert.rejects(arena.resolve(round.id), /tlc_missing/);
    assert.equal(node.count("settle_invoice"), 0);
  });

  it("cannot void a played round, and cannot refund after a settle attempt", async () => {
    const { node, arena, round } = await held("paper");
    await arena.play(round.id, "rock");
    await assert.rejects(arena.voidRound(round.id), /already played/);
    await arena.resolve(round.id);
    const error = await arena.voidRound(round.id).catch((e: unknown) => e);
    assert.ok(error instanceof ArenaError);
    assert.equal(node.count("cancel_invoice"), 0);
  });
});
