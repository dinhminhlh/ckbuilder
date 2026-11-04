import assert from 'node:assert/strict';
import { ccc } from '@ckb-ccc/core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { read, save, json } from './lib.mjs';

// Educational port of the pinned upstream Rust test_signature fixture.
// Verifies signed bytes only. It does not start a Perun node or execute CKB scripts.
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const u64 = n => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
function table(fields) {
  let offset = 4 * (fields.length + 1);
  const offsets = fields.map(field => { const current = offset; offset += field.length; return u32(current); });
  return Buffer.concat([u32(offset), ...offsets, ...fields]);
}
function dynvec(items) { return items.length ? table(items) : u32(4); }
export function encodeState(a = 10n, b = 11n, version = 10n, channelId = Buffer.alloc(32), isFinal = true) {
  const zeroSubBalances = table([Buffer.alloc(16), dynvec([])]);
  const defaultSubAlloc = table([Buffer.alloc(32), zeroSubBalances]);
  const balances = table([Buffer.concat([u64(a), u64(b)]), dynvec([]), dynvec([defaultSubAlloc])]);
  // Bool is a Molecule union: True = variant 0 with one zero byte; False = variant 1.
  return table([channelId, balances, u64(version), Buffer.concat([u32(isFinal ? 0 : 1), Buffer.alloc(1)])]);
}
const keccak = bytes => ccc.bytesFrom(new ccc.HasherKeecak256().update(bytes).digest());
export const stateDigest = bytes => keccak(Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32'), keccak(bytes)]));
function compactDer(signature) {
  const der = Buffer.from(signature, 'hex');
  assert.equal(der[0], 0x30); assert.equal(der[1], der.length - 2); assert.equal(der[2], 2);
  const rLen = der[3], sMarker = 4 + rLen;
  assert.equal(der[sMarker], 2);
  const sLen = der[sMarker + 1];
  assert.equal(sMarker + 2 + sLen, der.length);
  const pad = bytes => {
    const unpadded = bytes[0] === 0 ? bytes.subarray(1) : bytes;
    assert.ok(unpadded.length <= 32);
    return Buffer.concat([Buffer.alloc(32 - unpadded.length), unpadded]);
  };
  return Buffer.concat([pad(der.subarray(4, sMarker)), pad(der.subarray(sMarker + 2))]);
}
export function runVector() {
  const pin = read('reference/perun-source.json');
  const fixture = read('reference/perun-signature-fixture.json');
  assert.equal(fixture.sourceCommit, pin.commit);
  const signature = fixture.signatureDer, publicKey = fixture.publicKey;
  // CCC accepts compact r||s followed by a recovery byte. Verification uses
  // the supplied public key; this fixture does not perform key recovery.
  const sig = Buffer.concat([compactDer(signature), Buffer.from([0])]);
  const key = Buffer.from(publicKey, 'hex');
  const valid = bytes => ccc.verifyMessageSecp256k1(stateDigest(bytes), sig, key);
  const original = encodeState();
  assert.equal(ccc.hexFrom(stateDigest(original)), fixture.localDerivedDigest);
  const results = {
    originalSignatureValid: valid(original),
    changedBalanceRejected: !valid(encodeState(9n, 12n)),
    changedVersionRejected: !valid(encodeState(10n, 11n, 11n)),
    changedChannelRejected: !valid(encodeState(10n, 11n, 10n, Buffer.alloc(32, 1))),
    changedFinalFlagRejected: !valid(encodeState(10n, 11n, 10n, Buffer.alloc(32), false)),
  };
  assert.ok(Object.values(results).every(Boolean), 'Upstream signature vector did not verify; inspect serialization/hash before recording completion.');
  return { source: 'Local JS verification of the pinned upstream Perun Rust signature fixture; no Perun channel execution',
    sourceCommit: pin.commit, upstreamTest: 'payment-channel-ckb/devnet/contracts/tests/src/tests.rs::test_signature',
    encodedBytes: original.length, messageHex: ccc.hexFrom(original), digest: ccc.hexFrom(stateDigest(original)), results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = { capturedAt: new Date().toISOString(), ...runVector() };
    save('evidence/05-perun-signature-vector.json', result);
    console.log(json(result));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
