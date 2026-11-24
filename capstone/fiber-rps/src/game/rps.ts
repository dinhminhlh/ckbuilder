import { randomBytes, randomInt } from "node:crypto";
import { sha256Hash } from "./preimage";

/**
 * Rock-paper-scissors with the server's move committed inside the hold invoice.
 *
 * The entry hold invoice carries only sha256(preimage). The preimage is 32 bytes: byte 0 is the server's move
 * (1 rock, 2 paper, 3 scissors) and bytes 1..31 are random, so the hash shows nothing about the move. The player sees
 * the hash before choosing. After the round, the server reveals the preimage: the player checks the hash and reads
 * the move, so the server cannot have changed its move after seeing the player's.
 */

export const MOVES = ["rock", "paper", "scissors"] as const;
export type Move = (typeof MOVES)[number];
export type Outcome = "win" | "lose" | "draw";

const CODE: Record<Move, number> = { rock: 1, paper: 2, scissors: 3 };
const BEATS: Record<Move, Move> = { rock: "scissors", paper: "rock", scissors: "paper" };

export function parseMove(value: string | undefined): Move {
  const move = value?.toLowerCase();
  if (!MOVES.includes(move as Move)) throw new Error(`A move is one of: ${MOVES.join(", ")}.`);
  return move as Move;
}

export const randomMove = (): Move => MOVES[randomInt(3)];

/** From the player's side. */
export function outcome(player: Move, server: Move): Outcome {
  if (player === server) return "draw";
  return BEATS[player] === server ? "win" : "lose";
}

export function preimageForMove(move: Move): string {
  return `0x${CODE[move].toString(16).padStart(2, "0")}${randomBytes(31).toString("hex")}`;
}

export function moveFromPreimage(preimage: string): Move {
  if (!/^0x[0-9a-f]{64}$/.test(preimage)) throw new Error("A preimage is 32 bytes of 0x lowercase hex.");
  const move = MOVES.find((m) => CODE[m] === parseInt(preimage.slice(2, 4), 16));
  if (!move) throw new Error("This preimage does not encode a move.");
  return move;
}

/** What a player runs on the revealed preimage: the hash must match the invoice, and the move is read from byte 0. */
export function verifyReveal(paymentHash: string, preimage: string): Move {
  if (sha256Hash(preimage) !== paymentHash.toLowerCase()) throw new Error("The revealed preimage does not match the invoice's payment hash.");
  return moveFromPreimage(preimage);
}
