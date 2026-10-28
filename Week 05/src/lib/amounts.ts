export const CKB = 100_000_000n;
export function parseCkb(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value)) throw new Error('Enter a non-negative CKB amount with at most 8 decimals.');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * CKB + BigInt(fraction.padEnd(8, '0'));
  if (result > 0xffffffffffffffffn) throw new Error('Capacity exceeds uint64.');
  return result;
}
export function formatCkb(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const fraction = (abs % CKB).toString().padStart(8, '0').replace(/0+$/, '');
  return `${sign}${abs / CKB}${fraction ? '.' + fraction : ''}`;
}
