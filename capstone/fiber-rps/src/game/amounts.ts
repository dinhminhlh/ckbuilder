/** CKB amounts as bigint shannons (1 CKB = 100,000,000 shannons). fnn sends and expects them as 0x hex. */

export const SHANNONS_PER_CKB = 100_000_000n;

/** "1.5" -> 150000000n. Positive, at most 8 decimals. */
export function ckb(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value)) throw new Error(`Not a CKB amount with at most 8 decimals: ${value}`);
  const [whole, fraction = ""] = value.split(".");
  const shannons = BigInt(whole) * SHANNONS_PER_CKB + BigInt(fraction.padEnd(8, "0"));
  if (shannons <= 0n) throw new Error("A CKB amount must be positive.");
  return shannons;
}

/** 150000000n -> "1.5" */
export function formatCkb(shannons: bigint): string {
  const sign = shannons < 0n ? "-" : "";
  const abs = shannons < 0n ? -shannons : shannons;
  const fraction = (abs % SHANNONS_PER_CKB).toString().padStart(8, "0").replace(/0+$/, "");
  return `${sign}${abs / SHANNONS_PER_CKB}${fraction ? `.${fraction}` : ""}`;
}

export const toHex = (value: bigint | number): string => `0x${BigInt(value).toString(16)}`;

export function fromHex(value: string | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (!/^0x[0-9a-f]+$/i.test(value)) throw new Error(`Not a 0x hex quantity: ${value}`);
  return BigInt(value);
}
