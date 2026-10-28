import { ccc } from '@ckb-ccc/core';
import { rpc, type DemoConfig } from './config';
export function digestHex(value: string): ccc.Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('Expected a 32-byte hex hash (0x + 64 hex digits).');
  return value.toLowerCase() as ccc.Hex;
}
export function lockFor(config: DemoConfig, digest: string): ccc.Script {
  return ccc.Script.from({ codeHash: config.vm.codeHash, hashType: 'data2', args:
    `0x0000${config.bytecode.codeHash.slice(2)}${ccc.hexFrom(ccc.hashTypeToBytes('data2')).slice(2)}${digestHex(digest).slice(2)}` });
}
export function expectedHash(config: DemoConfig, cell: ccc.Cell): ccc.Hex {
  const args = cell.cellOutput.lock.args;
  if (ccc.bytesFrom(args).length !== 67 || !cell.cellOutput.lock.eq(lockFor(config, '0x' + args.slice(-64)))) {
    throw new Error('This OutPoint does not use this Week05 hash-lock deployment.');
  }
  return ('0x' + args.slice(-64)) as ccc.Hex;
}
export function parseOutPoint(txHash: string, index: string): ccc.OutPoint {
  digestHex(txHash);
  if (!/^(0|[1-9]\d*)$/.test(index) || BigInt(index) > 0xffffffffn) throw new Error('Output index must be a uint32 decimal integer.');
  return ccc.OutPoint.from({ txHash: txHash as ccc.Hex, index: Number(index) });
}
export async function findByHash(client: ccc.Client, config: DemoConfig, hash: string) {
  const cells: ccc.Cell[] = [];
  // CCC advances the cursor until the last page. Exact 67-byte args only.
  for await (const cell of client.findCellsOnChain({ script: lockFor(config, hash), scriptType: 'lock', scriptSearchMode: 'exact', withData: true }, 'asc', 50)) cells.push(cell);
  return cells;
}
export async function chainCellStatus(config: DemoConfig, point: ccc.OutPoint, spendProof?: string): Promise<'live'|'spent'|'unknown'> {
  const live = await rpc(config.rpcUrl, 'get_live_cell', [{tx_hash:point.txHash,index:ccc.numToHex(point.index)},false]);
  if (live.status === 'live') return 'live';
  if (live.status === 'dead') return 'spent';
  if (spendProof) {
    const tx = await rpc(config.rpcUrl,'get_transaction',[digestHex(spendProof)]);
    if (tx?.tx_status?.status === 'committed' && tx.transaction.inputs.some((input:any) =>
      input.previous_output.tx_hash === point.txHash && BigInt(input.previous_output.index) === BigInt(point.index))) return 'spent';
  }
  return 'unknown';
}
