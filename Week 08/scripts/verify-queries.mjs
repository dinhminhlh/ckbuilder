// Read-only companion to CCC Playground's balance/cell/transaction examples.
import { ccc } from '@ckb-ccc/ccc';
import { writeFile } from 'node:fs/promises';

const address = process.argv[2] ?? 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqflz4emgssc6nqj4yv3nfv2sca7g9dzhscgmg28x';
if (!address.startsWith('ckt1')) throw new Error('Use a CKB Testnet address.');
// HTTP keeps this one-shot CLI from retaining an idle WebSocket connection.
const rpcUrl = 'https://testnet.ckb.dev';
const client = new ccc.ClientPublicTestnet({ url: rpcUrl });
const { script: lock } = await ccc.Address.fromString(address, client);
const tipBefore = await client.getTip();
const balance = await client.getBalanceSingle(lock);
const cells = [];
for await (const cell of client.findCellsByLock(lock)) {
  cells.push({ outPoint: cell.outPoint, capacityShannons: cell.cellOutput.capacity.toString(), dataBytes: (cell.outputData.length - 2) / 2 });
  if (cells.length === 10) break;
}
const transactions = [];
for await (const tx of client.findTransactionsByLock(lock, null, true)) {
  transactions.push({ txHash: tx.txHash, blockNumber: tx.blockNumber.toString() });
  if (transactions.length === 10) break;
}
const tipAfter = await client.getTip();
const result = {
  capturedAt: new Date().toISOString(), source: 'live CCC SDK public Testnet queries; no signer and no transaction broadcast',
  sdkVersion: '1.3.6', nodeVersion: process.version, rpcUrl, address, tipBefore: tipBefore.toString(), tipAfter: tipAfter.toString(),
  balanceShannons: balance.toString(), balanceCKB: ccc.fixedPointToString(balance),
  cells, transactions, limitPerList: 10,
  note: 'Lists are limited samples, not full history. Balance and samples are separate RPC reads, not an atomic snapshot. This is not wallet ownership or Playground UI completion evidence.'
};
await writeFile(new URL('../evidence/03-live-queries.json', import.meta.url), JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2) + '\n');
console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
