import { ccc } from '@ckb-ccc/core';
import { CKB, parseCkb } from './amounts';
import { lockFor, expectedHash } from './cells';
import { verifyNetwork } from './client';
import type { DemoConfig } from './config';
export const secretBytes = (text: string) => ccc.hexFrom(new TextEncoder().encode(text));
export const secretHash = (text: string) => ccc.hashCkb(secretBytes(text));
export const plainFilter = { scriptLenRange: [0, 1] as [number, number], outputDataLenRange: [0, 1] as [number, number] };
export type Review = { kind: 'create' | 'unlock'; tx: ccc.Transaction; signed: boolean; sender: string; destination: string;
  amount: bigint; fee: bigint; change: bigint; spent?: ccc.OutPoint; digest: ccc.Hex };
export function minimumCapacity(lock: ccc.Script) { return BigInt(ccc.CellOutput.from({ lock }).occupiedSize) * CKB; }
export async function prepareCreate(config: DemoConfig, client: ccc.Client, signer: ccc.SignerCkbPrivateKey, secret: string, amount: string): Promise<Review> {
  await verifyNetwork(config, client);
  if (!secret.length) throw new Error('Enter a UTF-8 secret. The UI rejects empty input; the contract supports empty bytes.');
  const digest = secretHash(secret), lock = lockFor(config, digest), capacity = parseCkb(amount);
  if (capacity < minimumCapacity(lock)) throw new Error(`Hash-lock minimum occupied capacity is ${minimumCapacity(lock) / CKB} CKB.`);
  const tx = ccc.Transaction.from({ outputs: [{ lock, capacity }], outputsData: ['0x'] });
  await tx.completeInputsByCapacity(signer, undefined, plainFilter);
  await tx.completeFeeBy(signer, 1000n, plainFilter);
  const owner = await signer.getAddressObjSecp256k1();
  await validatePlainInputs(client, tx, owner.script);
  return { kind: 'create', tx, signed: true, sender: owner.toString(), destination: lock.hash(), amount: capacity,
    fee: await tx.getFee(client), change: tx.outputs.slice(1).reduce((sum, o) => sum + o.capacity, 0n), digest };
}
async function validatePlainInputs(client: ccc.Client, tx: ccc.Transaction, owner: ccc.Script) {
  for (const input of tx.inputs) {
    const cell = await client.getCellLive(input.previousOutput, true);
    if (!cell || !cell.cellOutput.lock.eq(owner) || cell.cellOutput.type || cell.outputData !== '0x') {
      throw new Error('Funding input is stale or is not a plain demo-account cell. Refresh and review again.');
    }
  }
}
export async function prepareUnlock(config: DemoConfig, client: ccc.Client, outPoint: ccc.OutPointLike, secret: string, destination: string): Promise<Review> {
  await verifyNetwork(config, client);
  const cell = await client.getCellLive(outPoint, true);
  if (!cell) throw new Error('Stale/dead cell. Refresh chain state.');
  if (cell.cellOutput.type || cell.outputData !== '0x') throw new Error('Only untyped, empty-data hash-lock cells are supported by this demo.');
  const digest = expectedHash(config, cell);
  if (secretHash(secret) !== digest) throw new Error('Wrong secret: its CKB hash does not match this cell.');
  let recipient: ccc.Address;
  try { recipient = await ccc.Address.fromString(destination, client); }
  catch { throw new Error('Invalid destination address. Use account A/B or a valid ckt address for this configured Devnet.'); }
  const tx = ccc.Transaction.from({ cellDeps: [config.vm.cellDep, config.bytecode.cellDep], inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ lock: recipient.script, capacity: cell.cellOutput.capacity }], outputsData: ['0x'], witnesses: [] });
  setGroupWitness(tx, 0, secretBytes(secret));
  const fee = tx.estimateFee(1000n);
  tx.outputs[0].capacity -= fee;
  if (tx.outputs[0].capacity < minimumCapacity(recipient.script)) throw new Error('Recipient capacity would be below occupied minimum after fee.');
  return { kind: 'unlock', tx, signed: false, sender: cell.cellOutput.lock.hash(), destination: recipient.toString(),
    amount: tx.outputs[0].capacity, fee, change: 0n, spent: cell.outPoint, digest };
}
export function setGroupWitness(tx: ccc.Transaction, firstGroupInputIndex: number, secret: ccc.Hex) {
  const prior = tx.witnesses[firstGroupInputIndex];
  const args = prior && prior !== '0x' ? ccc.WitnessArgs.fromBytes(prior) : ccc.WitnessArgs.from({});
  args.lock = secret;
  while (tx.witnesses.length <= firstGroupInputIndex) tx.witnesses.push('0x');
  tx.witnesses[firstGroupInputIndex] = ccc.hexFrom(args.toBytes());
}
// Integration/debug variant: a real signed secp fee input at index 0, and the
// hash-lock group at index 1. The normal UI uses the smaller one-input unlock.
export async function prepareMixedUnlock(config: DemoConfig, client: ccc.Client, signer: ccc.SignerCkbPrivateKey, point: ccc.OutPointLike, secret: string, destination: string): Promise<Review> {
  const review = await prepareUnlock(config, client, point, secret, destination);
  const owner = await signer.getAddressObjSecp256k1();
  let funding: ccc.Cell | undefined;
  for await (const cell of client.findCellsOnChain({ script: owner.script, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
    if (!cell.cellOutput.type && cell.outputData === '0x') { funding = cell; break; }
  }
  if (!funding) throw new Error('Missing plain fee-funding cell.');
  const custom = await client.getCellLive(point, true);
  if (!custom) throw new Error('Stale/dead cell.');
  const tx = ccc.Transaction.from({ cellDeps: [config.vm.cellDep, config.bytecode.cellDep],
    inputs: [{previousOutput: funding.outPoint}, {previousOutput: custom.outPoint}],
    outputs: [{lock: review.tx.outputs[0].lock, capacity: custom.cellOutput.capacity}], outputsData:['0x'], witnesses:[] });
  setGroupWitness(tx, 1, secretBytes(secret));
  await tx.completeFeeBy(signer, 1000n, plainFilter);
  return {...review, tx, signed:true, amount:custom.cellOutput.capacity, fee:await tx.getFee(client),
    change:tx.outputs.slice(1).reduce((sum,o)=>sum+o.capacity,0n)};
}
