import { createHash, randomBytes } from "node:crypto";

/**
 * Hold invoices use SHA-256: the game server keeps a random 32-byte preimage secret and gives the player only its hash.
 * The entry TLC can be claimed only with the preimage, so the server settles (reveals it) or cancels (refunds).
 * Invoices must say `hash_algorithm: "sha256"`; fnn's default (ckb_hash, blake2b) would not match this hash.
 */

const HASH256 = /^0x[0-9a-f]{64}$/;

export function newPreimage(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function sha256Hash(preimage: string): string {
  if (!HASH256.test(preimage)) throw new Error("A preimage is 32 bytes of 0x lowercase hex.");
  return `0x${createHash("sha256").update(Buffer.from(preimage.slice(2), "hex")).digest("hex")}`;
}

export const isHash256 = (value: string): boolean => HASH256.test(value);
