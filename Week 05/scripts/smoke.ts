import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { ccc } from '@ckb-ccc/core';
import type { DemoConfig } from '../src/lib/config';
import { rpc } from '../src/lib/config';
import { createClient, demoSigner, verifyNetwork, balance } from '../src/lib/client';
import { prepareCreate, prepareUnlock, prepareMixedUnlock } from '../src/lib/hashlock';
import { findByHash } from '../src/lib/cells';
import { broadcast, verifyReceipt } from '../src/lib/transactions';
async function main() {
  const config = JSON.parse(readFileSync('public/config.local.json','utf8')) as DemoConfig;
  const client = createClient(config), signer = demoSigner(client, config, 0);
  await verifyNetwork(config, client);
  const b = await demoSigner(client,config,1).getAddressObjSecp256k1();
  const before = await balance(client,b.script);
  // Random secret stays in process memory. Receipts never contain witness data.
  const secret = randomBytes(32).toString('hex');
  const created = await prepareCreate(config,client,signer,secret,'200');
  let committed = false;
  const update = (r: {hash:string;stage:string}) => { console.log(`${r.stage}: ${r.hash}`); committed = r.stage === 'committed'; };
  const lockHash = await broadcast(config,client,signer,created,update);
  assert.ok(committed,'create did not commit; recheck hash before rerunning');
  const outPoint = { txHash:lockHash,index:0 };
  assert.ok((await findByHash(client,config,created.digest)).some(c => c.outPoint.eq(ccc.OutPoint.from(outPoint))));
  await assert.rejects(() => prepareUnlock(config,client,outPoint,'incorrect',b.toString()),/Wrong secret/);
  const mixed = process.argv.includes('--mixed');
  const unlocked = mixed ? await prepareMixedUnlock(config,client,signer,outPoint,secret,b.toString()) : await prepareUnlock(config,client,outPoint,secret,b.toString());
  const unlockHash = await broadcast(config,client,signer,unlocked,update);
  assert.ok(committed,'unlock did not commit; recheck hash before rerunning');
  await verifyReceipt(config,unlocked,unlockHash);
  const freshClient = createClient(config);
  assert.equal(await freshClient.getCellLive(outPoint,true),undefined);
  const recipient = await freshClient.getCellLive({txHash:unlockHash,index:0},true);
  assert.ok(recipient?.cellOutput.lock.eq(b.script)); assert.equal(recipient?.cellOutput.capacity,unlocked.amount);
  const after = await balance(freshClient,b.script);
  assert.equal(after.total-before.total,unlocked.amount);
  await assert.rejects(() => prepareUnlock(config,freshClient,outPoint,secret,b.toString()),/Stale\/dead/);
  const actualFee = async (hash: ccc.Hex) => {
    const tx = await client.getTransaction(hash); assert.ok(tx); return (await tx.transaction.getFee(client)).toString();
  };
  const result = { source:'CLI smoke (not UI evidence)',mixedSignedFeeInput:mixed,genesis:config.genesis,lockHash,unlockHash,spentOutPoint:outPoint,
    oldCellStatus:(await rpc(config.rpcUrl,'get_live_cell',[{tx_hash:lockHash,index:'0x0'},false])).status,
    recipientAddress:b.toString(),receivedShannons:unlocked.amount.toString(),createFeeShannons:await actualFee(lockHash),unlockFeeShannons:await actualFee(unlockHash),
    recipientBalanceDeltaShannons:(after.total-before.total).toString(),freshClientRequery:true,wrongSecretLocalCheck:true,staleCellCheck:true };
  mkdirSync('evidence',{recursive:true});writeFileSync(`evidence/smoke${mixed ? '-mixed' : ''}.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}
main().catch(() => { console.error('Smoke verification failed. Preserve submitted hashes; inspect their chain status before rerunning. Transaction/witness details are omitted.');process.exitCode=1; });
