import assert from 'node:assert/strict';
import { ccc } from '@ckb-ccc/core';
import { read, save, json, rpc, call, ckbUrl, verifyTransfer, format } from './lib.mjs';

async function main() {
  const state = read('runtime/lab-state.json');
  assert.ok(state.channelId && !state.operation, 'Finish/recheck the existing operation first.');
  const ready = read('evidence/02-channel-ready.json');
  const closed = read('evidence/04-channel-closed.json');
  const vector = read('evidence/05-perun-signature-vector.json');
  assert.ok(ready && closed && vector && state.payments.length, 'Required stage evidence missing.');
  assert.ok(Object.values(vector.results).every(Boolean));
  const chain = await rpc(ckbUrl, 'get_blockchain_info');
  const genesis = await rpc(ckbUrl, 'get_block_hash', ['0x0']);
  assert.equal(chain.chain, 'ckb_testnet'); assert.equal(genesis, state.genesis);
  const cache = new Map();
  async function tx(hash) {
    if (!cache.has(hash)) cache.set(hash, await rpc(ckbUrl, 'get_transaction', [hash]));
    const value = cache.get(hash);
    assert.equal(value?.tx_status?.status, 'committed');
    return value.transaction;
  }
  async function fee(transaction) {
    let inputs = 0n;
    for (const input of transaction.inputs) {
      const previous = await tx(input.previous_output.tx_hash);
      inputs += BigInt(previous.outputs[Number(BigInt(input.previous_output.index))].capacity);
    }
    return inputs - transaction.outputs.reduce((sum, o) => sum + BigInt(o.capacity), 0n);
  }
  const point = ready.channels.alice.channel_outpoint;
  const fundingHash = point.slice(0, 66), index = Buffer.from(point.slice(66), 'hex').readUInt32LE();
  const funding = await tx(fundingHash), closure = await tx(closed.closeTxHash);
  assert.ok(closure.inputs.some(i => i.previous_output.tx_hash === fundingHash && BigInt(i.previous_output.index) === BigInt(index)));
  const recipients = {};
  for (const who of ['alice', 'bob']) {
    const info = await call(who, 'node_info');
    assert.equal(info.chain_hash, genesis);
    const liveChannel = (await call(who, 'list_channels', { include_closed: true })).channels.find(c => c.channel_id === state.channelId);
    assert.equal(liveChannel?.state?.state_name, 'Closed');
    assert.equal(liveChannel.shutdown_transaction_hash, closed.closeTxHash);
    const lock = ccc.Script.from({ codeHash: info.default_funding_lock_script.code_hash, hashType: info.default_funding_lock_script.hash_type, args: info.default_funding_lock_script.args });
    const outputs = closure.outputs.filter(o => ccc.Script.from({ codeHash: o.lock.code_hash, hashType: o.lock.hash_type, args: o.lock.args }).eq(lock));
    assert.equal(outputs.length, 1); assert.equal(outputs[0].type, null);
    recipients[who] = { capacityCKB: format(outputs[0].capacity), lockArgs: outputs[0].lock.args };
  }
  for (const payment of state.payments) {
    const recorded = read(`evidence/payment-${payment.paymentHash}.json`);
    assert.equal(recorded?.verified, true);
    verifyTransfer(recorded.before, recorded.after, payment.amountShannons, recorded.payment.fee);
    const sent = await call('alice', 'get_payment', { payment_hash: payment.paymentHash });
    const received = await call('bob', 'get_invoice', { payment_hash: payment.paymentHash });
    assert.equal(sent.status, 'Success'); assert.equal(received.status, 'Paid');
  }
  const result = {
    capturedAt: new Date().toISOString(), source: 'Fresh CKB Testnet and Fiber RPC audit', channelId: state.channelId,
    fundingTxHash: fundingHash, fundingStatus: 'committed', fundingCapacityCKB: format(funding.outputs[index].capacity),
    closeTxHash: closed.closeTxHash, closeStatus: 'committed', fundingInputConsumed: true,
    fundingFeeCKB: format(await fee(funding)), closeFeeCKB: format(await fee(closure)), recipients,
    payments: state.payments, senderAndReceiverRechecked: true, perunSignatureExercisePassed: true,
    perunDevnetDemoExecuted: false,
  };
  save('evidence/06-final-audit.json', result);
  console.log(json(result));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
