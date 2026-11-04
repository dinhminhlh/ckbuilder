import test from 'node:test';
import assert from 'node:assert/strict';
import { runVector } from '../scripts/perun-vector.mjs';

test('upstream Perun signature verifies and rejects balance/version/channel/final-flag mutations', () => {
  const vector = runVector();
  assert.equal(vector.encodedBytes, 185);
  assert.deepEqual(vector.results, {
    originalSignatureValid: true, changedBalanceRejected: true, changedVersionRejected: true,
    changedChannelRejected: true, changedFinalFlagRejected: true,
  });
});
