import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const endpoints = { alice: 'http://127.0.0.1:8227', bob: 'http://127.0.0.1:8237' };
export const ckbUrl = 'https://testnet.ckbapp.dev/';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function json(value) { return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2); }
export function read(relative, fallback) {
  const path = resolve(root, relative);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) : fallback;
}
export function save(relative, value) {
  const path = resolve(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path + '.tmp', json(value) + '\n');
  renameSync(path + '.tmp', path);
}
export function amount(value) {
  if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value)) throw new Error('Use a positive decimal CKB amount with up to 8 decimals.');
  const [whole, decimal = ''] = value.split('.');
  const result = BigInt(whole) * 100000000n + BigInt(decimal.padEnd(8, '0'));
  if (result <= 0n || result > 0xffffffffffffffffn) throw new Error('CKB amount outside positive uint64 range.');
  return result;
}
export const hex = value => '0x' + BigInt(value).toString(16);
export function format(value) {
  const n = BigInt(value), sign = n < 0n ? '-' : '', abs = n < 0n ? -n : n;
  const tail = (abs % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
  return sign + (abs / 100000000n) + (tail ? '.' + tail : '');
}
export function stateName(channel) { return channel?.state?.state_name; }
export function channelSnapshot(channel) {
  if (!channel) throw new Error('Tracked channel missing from node.');
  return { channel_id: channel.channel_id, state: stateName(channel), pubkey: channel.pubkey,
    local_balance: channel.local_balance, remote_balance: channel.remote_balance,
    offered_tlc_balance: channel.offered_tlc_balance, received_tlc_balance: channel.received_tlc_balance,
    channel_outpoint: channel.channel_outpoint, shutdown_transaction_hash: channel.shutdown_transaction_hash,
    pending_tlcs: channel.pending_tlcs?.length ?? 0 };
}
export function paymentSummary(value) {
  return { payment_hash: value.payment_hash, status: value.status, fee: value.fee,
    created_at: value.created_at, last_updated_at: value.last_updated_at, failed_error: value.failed_error };
}
export function verifyTransfer(before, after, paid, fee) {
  const n = BigInt(paid), f = BigInt(fee);
  for (const view of [before.alice, before.bob, after.alice, after.bob]) {
    if (view.state !== 'ChannelReady' || view.pending_tlcs || BigInt(view.offered_tlc_balance) || BigInt(view.received_tlc_balance)) {
      throw new Error('Channel is not ready/settled; recheck before asserting balance changes.');
    }
  }
  if (before.alice.channel_id !== after.alice.channel_id || before.bob.channel_id !== after.bob.channel_id || after.alice.channel_id !== after.bob.channel_id) {
    throw new Error('Channel identifiers do not match.');
  }
  const al = BigInt(before.alice.local_balance), ar = BigInt(before.alice.remote_balance);
  if (al - BigInt(after.alice.local_balance) !== n + f || BigInt(after.bob.local_balance) - BigInt(before.bob.local_balance) !== n ||
      al + ar !== BigInt(after.alice.local_balance) + BigInt(after.alice.remote_balance) ||
      BigInt(after.alice.local_balance) !== BigInt(after.bob.remote_balance) || BigInt(after.bob.local_balance) !== BigInt(after.alice.remote_balance)) {
    throw new Error('Observed channel balances do not match this direct payment. Recheck; do not resend.');
  }
  if (f !== 0n) throw new Error('This two-node direct-channel lab expects no intermediary routing fee.');
  return true;
}
export async function rpc(url, method, params = [], fetchImpl = fetch) {
  if (![...Object.values(endpoints), ckbUrl].includes(url)) throw new Error('Endpoint is outside this Testnet lab.');
  let response;
  try {
    response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  } catch { throw new Error(`${method}: response unavailable; state may be unknown. Recheck before retrying a write.`); }
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}; recheck before retrying a write.`);
  const result = await response.json();
  if (result.error) throw new Error(`${method}: RPC error ${result.error.code}: ${result.error.message}`);
  if (!Object.hasOwn(result, 'result')) throw new Error(`${method}: malformed RPC response.`);
  return result.result;
}
export const call = (who, method, value) => rpc(endpoints[who], method, value === undefined ? [] : [value]);
