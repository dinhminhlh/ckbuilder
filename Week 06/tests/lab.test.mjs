import test from 'node:test';
import assert from 'node:assert/strict';
import { amount, format, hex, verifyTransfer, rpc, endpoints, paymentSummary } from '../scripts/lib.mjs';

test('CKB conversion preserves one shannon and maximum capacity without float rounding', () => {
  for (const text of ['0.00000001', '1', '500', '200.12345678', '184467440737.09551615']) assert.equal(format(amount(text)), text);
  assert.equal(hex(amount('1')), '0x5f5e100');
  for (const text of ['0', '-1', '01', '1e3', '1.000000001', 'NaN', '184467440737.09551616']) assert.throws(() => amount(text));
});

function snapshots(a, b) {
  const common = { channel_id: 'channel-1', state: 'ChannelReady', offered_tlc_balance: '0x0', received_tlc_balance: '0x0', pending_tlcs: 0 };
  return { alice: { ...common, local_balance: hex(a), remote_balance: hex(b) }, bob: { ...common, local_balance: hex(b), remote_balance: hex(a) } };
}

test('direct payment requires matching settled balance changes at both nodes', () => {
  const before = snapshots(amount('500'), amount('500'));
  const after = snapshots(amount('499'), amount('501'));
  assert.equal(verifyTransfer(before, after, amount('1'), 0n), true);
  assert.throws(() => verifyTransfer(before, before, amount('1'), 0n));
  after.bob.local_balance = hex(amount('502'));
  assert.throws(() => verifyTransfer(before, after, amount('1'), 0n));
});

test('pending TLC or a different channel cannot be counted as verified payment', () => {
  const before = snapshots(amount('500'), amount('500'));
  const pending = snapshots(amount('499'), amount('501'));
  pending.alice.pending_tlcs = 1;
  assert.throws(() => verifyTransfer(before, pending, amount('1'), 0n));
  pending.alice.pending_tlcs = 0;
  pending.bob.channel_id = 'another-channel';
  assert.throws(() => verifyTransfer(before, pending, amount('1'), 0n));
});

test('unavailable send response never silently retries the mutation', async () => {
  let attempts = 0;
  await assert.rejects(rpc(endpoints.alice, 'send_payment', [{}], async () => { attempts++; throw new Error('reset'); }), /state may be unknown/);
  assert.equal(attempts, 1);
});

test('RPC distinguishes rejection, HTTP error and malformed responses', async () => {
  await assert.rejects(rpc(endpoints.alice, 'open_channel', [{}], async () => ({ ok: true, json: async () => ({ error: { code: -1, message: 'rejected' } }) })), /RPC error -1/);
  await assert.rejects(rpc(endpoints.alice, 'node_info', [], async () => ({ ok: false, status: 503 })), /HTTP 503/);
  await assert.rejects(rpc(endpoints.alice, 'node_info', [], async () => ({ ok: true, json: async () => ({}) })), /malformed/);
  await assert.rejects(rpc('https://mainnet.ckbapp.dev/', 'node_info'), /outside this Testnet lab/);
});

test('public payment evidence omits preimage and custom records', () => {
  const value = paymentSummary({ payment_hash: 'hash', status: 'Success', fee: '0x0', payment_preimage: 'secret', custom_records: { private: 'value' } });
  assert.equal(Object.hasOwn(value, 'payment_preimage'), false);
  assert.equal(Object.hasOwn(value, 'custom_records'), false);
});
