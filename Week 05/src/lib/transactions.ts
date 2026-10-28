import { ccc } from '@ckb-ccc/core';
import { rpc, type DemoConfig } from './config';
import { verifyNetwork } from './client';
import type { Review } from './hashlock';
export type Stage = 'preparing' | 'signing' | 'submitted' | 'confirming' | 'committed' | 'rejected' | 'failed' | 'confirmation unknown';
export type Receipt = { hash: ccc.Hex; stage: Stage; message: string };
export async function confirm(config: DemoConfig, hash: ccc.Hex, timeoutMs = 120000): Promise<Stage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let result;
    try { result = await rpc(config.rpcUrl, 'get_transaction', [hash]); } catch { return 'confirmation unknown'; }
    if (result?.tx_status?.status === 'committed') return 'committed';
    if (result?.tx_status?.status === 'rejected') return 'rejected';
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return 'confirmation unknown';
}
export async function verifyReceipt(config: DemoConfig, review: Review, hash: ccc.Hex) {
  const result = await rpc(config.rpcUrl, 'get_transaction', [hash]);
  if (result?.tx_status?.status !== 'committed') throw new Error('Commitment could not be verified. Recheck.');
  if (review.spent) {
    const old = await rpc(config.rpcUrl, 'get_live_cell', [{ tx_hash: review.spent.txHash, index: ccc.numToHex(review.spent.index) }, false]);
    const consumed = result.transaction.inputs.some((input: any) => input.previous_output.tx_hash === review.spent!.txHash && BigInt(input.previous_output.index) === BigInt(review.spent!.index));
    // Some nodes return unknown for a spent output; a committed transaction
    // consuming this exact OutPoint is the authoritative proof of spending.
    if (!consumed || old.status === 'live') throw new Error('Committed, but spent-input verification is incomplete. Recheck.');
  }
  const output = result.transaction.outputs[0];
  const expected = review.tx.outputs[0];
  if (BigInt(output.capacity) !== expected.capacity || !ccc.Script.from({ codeHash: output.lock.code_hash, hashType: output.lock.hash_type, args: output.lock.args }).eq(expected.lock)) {
    throw new Error('Recipient output did not match the reviewed transaction.');
  }
}
export async function broadcast(config: DemoConfig, client: ccc.Client, signer: ccc.SignerCkbPrivateKey, review: Review, update: (r: Receipt) => void) {
  await verifyNetwork(config, client);
  for (const input of review.tx.inputs) if (!await client.getCellLive(input.previousOutput, true)) throw new Error('Reviewed input is now stale/dead. Prepare again.');
  // Sign first, compute/persist the deterministic hash before attempting broadcast.
  update({hash: review.tx.hash(),stage:'signing',message:review.signed ? 'Signing with the active public demo account…' : 'Preparing secret-authorized transaction; no depositor signature required.'});
  const tx = review.signed ? await signer.signTransaction(review.tx) : review.tx;
  const hash = tx.hash();
  update({ hash, stage: 'signing', message: 'Transaction ready; submitting to local Devnet.' });
  try { await client.sendTransaction(tx); }
  catch { update({ hash, stage: 'confirmation unknown', message: 'Broadcast response unavailable. Recheck this hash before retrying.' }); return hash; }
  update({ hash, stage: 'submitted', message: 'Broadcast accepted. Secret is now public in the unlock witness.' });
  update({ hash, stage: 'confirming', message: 'Waiting for commitment…' });
  const stage = await confirm(config, hash);
  if (stage === 'committed') {
    try { await verifyReceipt(config, review, hash); }
    catch { update({ hash, stage: 'confirmation unknown', message: 'Committed status observed; output/lifecycle verification incomplete. Recheck this hash.' }); return hash; }
  }
  update({ hash, stage, message: stage === 'committed' ? 'Committed; input lifecycle and intended output verified.' : 'Keep this hash and recheck chain status.' });
  return hash;
}
