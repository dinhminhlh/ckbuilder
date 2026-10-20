import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, hashCkb } from "@ckb-js-std/core";

function main() {
  // 35 loader bytes followed by the 32-byte application digest.
  const args = HighLevel.loadScript().args;
  if (args.byteLength !== 67) return 10;
  let secret: ArrayBuffer | undefined;
  try {
    secret = HighLevel.loadWitnessArgs(0, bindings.SOURCE_GROUP_INPUT).lock;
  } catch {
    return 11;
  }
  if (secret === undefined) return 11;
  const expected = new Uint8Array(args.slice(35));
  const actual = new Uint8Array(hashCkb(secret));
  for (let i = 0; i < 32; i++) {
    if (expected[i] !== actual[i]) return 12;
  }
  return 0;
}

bindings.exit(main());
