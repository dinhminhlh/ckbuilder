import { ccc } from '@ckb-ccc/core';
import { openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, endpoints, ckbUrl, read, save, json, amount, hex, format, stateName, channelSnapshot, paymentSummary, verifyTransfer, rpc, call, sleep } from './lib.mjs';

const command = process.argv[2] ?? 'status';
const stateFile = 'runtime/lab-state.json';
const state = read(stateFile, { payments: [] });
const persist = () => save(stateFile, state);
const client = new ccc.ClientPublicTestnet({ url: ckbUrl, fallbacks: [] });
const scriptFrom = value => ccc.Script.from({ codeHash: value.code_hash, hashType: value.hash_type, args: value.args });

async function network() {
  const [chain, genesis, alice, bob] = await Promise.all([
    rpc(ckbUrl, 'get_blockchain_info'), rpc(ckbUrl, 'get_block_hash', ['0x0']), call('alice', 'node_info'), call('bob', 'node_info')]);
  if (chain.chain !== 'ckb_testnet' || alice.chain_hash !== genesis || bob.chain_hash !== genesis || alice.version !== '0.9.1' || bob.version !== '0.9.1' || alice.pubkey === bob.pubkey) {
    throw new Error('Expected two distinct v0.9.1 nodes on CKB Testnet.');
  }
  if (state.genesis && state.genesis !== genesis) throw new Error('Recorded network changed. Inspect node state.');
  state.genesis = genesis;
  persist();
  return { alice, bob, genesis };
}
async function funds(info) {
  const output = {};
  for (const who of ['alice', 'bob']) {
    const lock = scriptFrom(info[who].default_funding_lock_script);
    let plain = 0n, total = 0n;
    for await (const cell of client.findCellsOnChain({ script: lock, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
      total += cell.cellOutput.capacity;
      if (!cell.cellOutput.type && cell.outputData === '0x') plain += cell.cellOutput.capacity;
    }
    output[who] = { address: ccc.Address.fromScript(lock, client).toString(), plainCKB: format(plain), totalCKB: format(total) };
  }
  return output;
}
async function channels(who) { return (await call(who, 'list_channels', { include_closed: true })).channels; }
async function views(allowMissing = false) {
  const [a, b] = await Promise.all([channels('alice'), channels('bob')]);
  const alice = a.find(c => c.channel_id === state.channelId), bob = b.find(c => c.channel_id === state.channelId);
  if (allowMissing && (!alice || !bob)) return undefined;
  return { alice: channelSnapshot(alice), bob: channelSnapshot(bob) };
}
async function poll(description, work, timeout = 60000) {
  const deadline = Date.now() + timeout;
  do {
    const result = await work();
    if (result) return result;
    console.log(`Waiting: ${description}`);
    await sleep(2000);
  } while (Date.now() < deadline);
  throw new Error(`${description}: still unresolved. Run recheck; do not repeat the write.`);
}
function recordOperation(kind, data = {}) {
  if (state.operation) throw new Error(`Previous ${state.operation.kind} operation unresolved. Run recheck; inspect runtime/lab-state.json.`);
  state.operation = { kind, at: new Date().toISOString(), ...data };
  persist();
}
function clearOperation() { delete state.operation; persist(); }
function evidence(name, data) {
  const result = { capturedAt: new Date().toISOString(), source: 'live RPC; not simulated', genesis: state.genesis, ...data };
  save(`evidence/${name}.json`, result);
  console.log(json(result));
}
async function verifiedPayment() {
  const pending = state.operation;
  if (pending?.kind !== 'payment' || !pending.paymentHash) throw new Error('No recoverable payment operation. Inspect status.');
  const payment = await poll('payment terminal status', async () => {
    const result = await call('alice', 'get_payment', { payment_hash: pending.paymentHash });
    return ['Success', 'Failed'].includes(result.status) ? result : undefined;
  });
  if (payment.status === 'Failed') {
    evidence(`payment-${pending.paymentHash}`, { payment: paymentSummary(payment), verified: false });
    clearOperation();
    throw new Error('Payment failed. Review channel liquidity and error in evidence before trying another payment.');
  }
  const invoice = await call('bob', 'get_invoice', { payment_hash: pending.paymentHash });
  if (invoice.status !== 'Paid') throw new Error('Sender succeeded but receiver invoice is not Paid. Recheck.');
  const after = await poll('settled channel balances', async () => {
    const value = await views();
    try { verifyTransfer(pending.before, value, pending.amountShannons, payment.fee); return value; } catch { return undefined; }
  });
  evidence(`payment-${pending.paymentHash}`, { channelId: state.channelId, before: pending.before, after,
    amountCKB: format(pending.amountShannons), payment: paymentSummary(payment), receiverInvoiceStatus: invoice.status, verified: true });
  state.payments.push({ paymentHash: pending.paymentHash, amountShannons: pending.amountShannons, status: payment.status });
  clearOperation();
}
async function recheck(info) {
  if (state.operation?.kind === 'payment') return verifiedPayment();
  if (state.operation?.kind === 'open') {
    const candidates = (await channels('alice')).filter(c => c.pubkey === info.bob.pubkey && stateName(c) !== 'Closed');
    if (!state.channelId && candidates.length === 1) {
      const other = await channels('bob');
      if (other.some(c => c.channel_id === candidates[0].channel_id && c.pubkey === info.alice.pubkey)) {
        state.channelId = candidates[0].channel_id; persist();
      }
    }
    if (!state.channelId) throw new Error('Opening saved or uncertain. Inspect both channel lists; use accept only if acceptance was never attempted. Do not open a second channel.');
    const current = await poll('both channels ready', async () => {
      const v = await views(true);
      return v?.alice.state === 'ChannelReady' && v?.bob.state === 'ChannelReady' ? v : undefined;
    });
    evidence('02-channel-ready', { channelId: state.channelId, channels: current });
    clearOperation();
    return;
  }
  if (state.operation?.kind === 'close') {
    const current = await poll('cooperative channel closure', async () => {
      const v = await views();
      return v.alice.state === 'Closed' && v.bob.state === 'Closed' && v.alice.shutdown_transaction_hash ? v : undefined;
    });
    const hash = current.alice.shutdown_transaction_hash;
    if (current.bob.shutdown_transaction_hash !== hash) throw new Error('Close transaction hashes differ.');
    const tx = await poll('close transaction committed', async () => {
      const value = await rpc(ckbUrl, 'get_transaction', [hash]);
      return value?.tx_status?.status === 'committed' ? value : undefined;
    });
    const funding = current.alice.channel_outpoint;
    if (typeof funding !== 'string' || !/^0x[0-9a-f]{72}$/i.test(funding)) throw new Error('Unexpected funding OutPoint; inspect closure manually.');
    const fundingHash = funding.slice(0, 66);
    const fundingIndex = Buffer.from(funding.slice(66), 'hex').readUInt32LE();
    if (!tx.transaction.inputs.some(i => i.previous_output.tx_hash === fundingHash && BigInt(i.previous_output.index) === BigInt(fundingIndex))) {
      throw new Error('Close transaction does not consume the channel funding Cell.');
    }
    evidence('04-channel-closed', { channelId: state.channelId, channels: current, closeTxHash: hash, transactionStatus: tx.tx_status.status,
      fundingInputVerified: true, outputs: tx.transaction.outputs, balances: await funds(info) });
    clearOperation();
    return;
  }
  console.log('No unresolved write operation.');
}
async function accept(info) {
  const op = state.operation;
  if (op?.kind !== 'open' || !op.temporaryChannelId) throw new Error('No saved channel proposal to accept.');
  if (op.acceptAttempted) throw new Error('Acceptance already attempted. Run recheck and inspect channels; do not duplicate acceptance.');
  op.acceptAttempted = true; persist();
  const accepted = await call('bob', 'accept_channel', { temporary_channel_id: op.temporaryChannelId, funding_amount: hex(op.fundingShannons) });
  state.channelId = accepted.channel_id; persist();
  return recheck(info);
}
async function main() {
  if (!['status', 'funds', 'connect', 'open', 'accept', 'pay', 'recheck', 'close'].includes(command)) {
    throw new Error('Commands: status | funds | connect | open [CKB per side=500] | accept | pay [CKB=1] | recheck | close');
  }
  const info = await network();
  if (command === 'status' || command === 'funds') {
    const balances = await funds(info);
    const [a, b] = await Promise.all([channels('alice'), channels('bob')]);
    evidence('01-node-status', { nodes: { alice: { pubkey: info.alice.pubkey, version: info.alice.version }, bob: { pubkey: info.bob.pubkey, version: info.bob.version } },
      balances, channels: { alice: a.map(channelSnapshot), bob: b.map(channelSnapshot) }, unresolved: state.operation ?? null });
    return;
  }
  if (command === 'connect') {
    await call('alice', 'connect_peer', { pubkey: info.bob.pubkey, address: '/ip4/127.0.0.1/tcp/8238', save: false });
    const peers = await poll('Alice/Bob peer connection', async () => {
      const [alice, bob] = await Promise.all([call('alice', 'list_peers'), call('bob', 'list_peers')]);
      return alice.peers.some(p => p.pubkey === info.bob.pubkey) && bob.peers.some(p => p.pubkey === info.alice.pubkey) ? { alice, bob } : undefined;
    }, 20000);
    evidence('01b-peers-connected', peers); return;
  }
  if (command === 'recheck') return recheck(info);
  if (command === 'accept') return accept(info);
  if (command === 'open') {
    if (state.channelId) throw new Error('A channel is already tracked. Inspect it instead of opening another.');
    const n = amount(process.argv[3] ?? '500');
    if (n < amount('200') || n > amount('1000')) throw new Error('This lab funds 200–1000 Testnet CKB per side.');
    const existing = (await channels('alice')).filter(c => c.pubkey === info.bob.pubkey && stateName(c) !== 'Closed');
    if (existing.length) throw new Error('A channel with Bob already exists. Inspect/recover it before opening another.');
    const balances = await funds(info);
    for (const who of ['alice', 'bob']) if ((balances[who].plainCKB === '0' ? 0n : amount(balances[who].plainCKB)) < n + amount('200')) throw new Error(`Fund ${who} from Testnet faucet first: need at least ${format(n + amount('200'))} plain CKB.`);
    recordOperation('open', { fundingShannons: n.toString() });
    const opened = await call('alice', 'open_channel', { pubkey: info.bob.pubkey, funding_amount: hex(n), public: false });
    state.operation.temporaryChannelId = opened.temporary_channel_id; persist();
    console.log('Proposal saved; accepting from Bob.');
    return accept(info);
  }
  if (command === 'pay') {
    const n = amount(process.argv[3] ?? '1');
    if (n > amount('10')) throw new Error('This learning lab limits one payment to 10 Testnet CKB.');
    if (state.operation) throw new Error('Previous operation unresolved. Run recheck.');
    const before = await views();
    for (const c of Object.values(before)) if (c.state !== 'ChannelReady' || c.pending_tlcs) throw new Error('Channel must be ready with no pending TLCs.');
    if (BigInt(before.alice.local_balance) < n) throw new Error('Insufficient outbound channel balance.');
    const created = await call('bob', 'new_invoice', { amount: hex(n), currency: 'Fibt', description: 'CKBuilder Week 06 direct payment', expiry: '0xe10' });
    const hash = created.invoice.data.payment_hash;
    recordOperation('payment', { amountShannons: n.toString(), paymentHash: hash, before });
    await call('alice', 'send_payment', { invoice: created.invoice_address, max_fee_amount: '0x0', max_parts: '0x1' });
    return verifiedPayment();
  }
  if (command === 'close') {
    const current = await views();
    if (current.alice.state !== 'ChannelReady' || current.bob.state !== 'ChannelReady' || current.alice.pending_tlcs || current.bob.pending_tlcs) throw new Error('Channel must be ready and have no pending TLCs before cooperative close.');
    recordOperation('close', { channelId: state.channelId });
    await call('alice', 'shutdown_channel', { channel_id: state.channelId, close_script: info.alice.default_funding_lock_script, fee_rate: '0x3e8', force: false });
    return recheck(info);
  }
}

let lock;
try {
  // Serialize commands so concurrent terminals cannot submit duplicate operations.
  lock = openSync(resolve(root, 'runtime/cli.lock'), 'wx');
  await main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (lock !== undefined) { closeSync(lock); unlinkSync(resolve(root, 'runtime/cli.lock')); }
}
