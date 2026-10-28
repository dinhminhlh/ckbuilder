import test from 'node:test';
import assert from 'node:assert/strict';
import { ccc } from '@ckb-ccc/core';
import { parseCkb, formatCkb } from '../src/lib/amounts';
import { secretBytes, secretHash, minimumCapacity, setGroupWitness } from '../src/lib/hashlock';
import { parseOutPoint, lockFor } from '../src/lib/cells';
import { assertLocal, type DemoConfig } from '../src/lib/config';
import { confirm } from '../src/lib/transactions';

test('CKB amounts preserve all eight decimals and large integers', () => {
  for (const amount of ['0', '0.00000001', '200.12345678', '184467440737.09551615']) assert.equal(formatCkb(parseCkb(amount)), amount);
  for (const invalid of ['-1','1e3','NaN','1.000000001','01','1.',' 1','184467440737.09551616']) assert.throws(() => parseCkb(invalid));
});
test('UTF-8 bytes use CKB hash, including explicit empty bytes', () => {
  assert.equal(secretBytes('秘密🔑'), ccc.hexFrom(Buffer.from('秘密🔑', 'utf8')));
  assert.equal(secretHash('秘密🔑'), ccc.hashCkb(Buffer.from('秘密🔑', 'utf8')));
  assert.equal(secretHash(''), ccc.hashCkb('0x'));
});
test('VM args have a 35-byte loader and actual occupied capacity is 108 CKB', () => {
  const config = { vm: { codeHash: '0x'+'11'.repeat(32) }, bytecode: { codeHash: '0x'+'22'.repeat(32) } } as DemoConfig;
  const script = lockFor(config, '0x'+'33'.repeat(32));
  assert.equal(ccc.bytesFrom(script.args).length, 67);
  assert.equal(script.args.slice(0,6),'0x0000');
  assert.equal(minimumCapacity(script),10800000000n);
  assert.equal(script.args.slice(-64),'33'.repeat(32));
});
test('setting group input 1 preserves input 0 standard signature and other witness fields', () => {
  const signed = ccc.hexFrom(ccc.WitnessArgs.from({ lock: '0x'+'ab'.repeat(65) }).toBytes());
  const other = ccc.hexFrom(ccc.WitnessArgs.from({ inputType:'0x1122',outputType:'0x3344' }).toBytes());
  const tx = ccc.Transaction.from({ witnesses:[signed,other,'0x9988'] });
  setGroupWitness(tx,1,'0xdead');
  assert.equal(tx.witnesses[0], signed); assert.equal(tx.witnesses[2], '0x9988');
  const witness = ccc.WitnessArgs.fromBytes(tx.witnesses[1]);
  assert.equal(witness.lock,'0xdead'); assert.equal(witness.inputType,'0x1122'); assert.equal(witness.outputType,'0x3344');
});
test('loopback and OutPoint guards reject invalid or public destinations', () => {
  assertLocal('http://127.0.0.1:8114');
  for (const url of ['https://testnet.ckb.dev','http://example.com','http://127.0.0.1.evil.test','http://user:pass@localhost:8114']) assert.throws(() => assertLocal(url));
  assert.throws(() => parseOutPoint('0x'+'01'.repeat(32), '4294967296'));
  assert.throws(() => parseOutPoint('0x01', '0'));
});
test('zero confirmation deadline means unknown, never failure', async () => {
  assert.equal(await confirm({} as DemoConfig, '0x'+'00'.repeat(32) as ccc.Hex, 0),'confirmation unknown');
});
