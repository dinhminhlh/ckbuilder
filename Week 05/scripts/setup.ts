import { ccc } from '@ckb-ccc/core';
import { TESTNET_SCRIPTS } from '@ckb-ccc/core/advanced';
import { DEFAULT_SCRIPT_CKB_JS_VM } from 'ckb-testtool';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { rpc, assertLocal, type DemoConfig, type Binary } from '../src/lib/config';
import { createClient, verifyNetwork, demoSigner } from '../src/lib/client';
import { plainFilter } from '../src/lib/hashlock';
import { confirm } from '../src/lib/transactions';

async function main() {
  const rpcUrl = process.env.CKB_RPC_URL ?? 'http://127.0.0.1:8114';
  assertLocal(rpcUrl);
  const info = await rpc(rpcUrl, 'get_blockchain_info');
  if (info.chain !== 'ckb_dev') throw new Error('Setup refuses every chain except ckb_dev.');
  const genesis = await rpc(rpcUrl, 'get_block_hash', ['0x0']);
  const block = await rpc(rpcUrl, 'get_block_by_number', ['0x0']);
  const genesisTx = block.transactions[0];
  const findType = (hash: string) => genesisTx.outputs.findIndex((o: any) => o.type && ccc.Script.from({ codeHash: o.type.code_hash, hashType: o.type.hash_type, args: o.type.args }).hash() === hash);
  const secpIndex = findType(ccc.hexFrom(TESTNET_SCRIPTS.Secp256k1Blake160!.codeHash));
  const daoIndex = findType(ccc.hexFrom(TESTNET_SCRIPTS.NervosDao!.codeHash));
  // The data binary hash is verified against the standard secp data constant.
  const dataIndex = genesisTx.outputs_data.findIndex((d: ccc.Hex) => ccc.hashCkb(d) === '0x9799bee251b975b82c45a02154ce28cec89c5853ecc14d12b7b8cccfc19e0af4');
  if ([secpIndex, daoIndex, dataIndex].some(i => i < 0)) throw new Error('Cannot discover standard system cells in this Devnet genesis.');
  const dep = (index: number) => ({ cellDep: { outPoint: { txHash: genesisTx.hash, index }, depType: 'code' as const } });
  const scripts = {
    Secp256k1Blake160: { codeHash: TESTNET_SCRIPTS.Secp256k1Blake160!.codeHash, hashType: 'type' as const, cellDeps: [dep(secpIndex), dep(dataIndex)] },
    NervosDao: { codeHash: TESTNET_SCRIPTS.NervosDao!.codeHash, hashType: 'type' as const, cellDeps: [dep(daoIndex)] },
  };
  // Only public, disposable accounts from the installed OffCKB package. No key input.
  const publicAccounts = JSON.parse(readFileSync('node_modules/@offckb/cli/account/account.json', 'utf8'));
  const config = { rpcUrl, genesis, chain: 'ckb_dev', scripts, accounts: [publicAccounts[0].privkey, publicAccounts[1].privkey] } as DemoConfig;
  const client = createClient(config), signer = demoSigner(client, config, 0);
  const binaries = [readFileSync(DEFAULT_SCRIPT_CKB_JS_VM), readFileSync('packages/on-chain-script/dist/index.bc')];
  mkdirSync('runtime', { recursive: true }); mkdirSync('public', { recursive: true });
  const output = 'public/config.local.json';
  if (existsSync(output) && !process.argv.includes('--redeploy')) {
    const old = JSON.parse(readFileSync(output, 'utf8')) as DemoConfig;
    if (old.genesis !== genesis || old.vm.codeHash !== ccc.hashCkb(binaries[0]) || old.bytecode.codeHash !== ccc.hashCkb(binaries[1])) {
      throw new Error('Deployment differs from this chain/build. Review the intended RPC, then use npm run setup -- --redeploy.');
    }
    await verifyNetwork(old, createClient(old));
    console.log('Existing Week05 deployment and system dependencies verified live.'); return;
  }
  if (existsSync('runtime/deploy-pending.json')) {
    const pending = JSON.parse(readFileSync('runtime/deploy-pending.json', 'utf8'));
    if (pending.genesis === genesis) {
      const status = await rpc(rpcUrl, 'get_transaction', [pending.txHash]);
      if (status?.tx_status?.status !== 'rejected' && status?.tx_status?.status !== 'committed') throw new Error(`Previous deployment unresolved: ${pending.txHash}. Recheck before deploying again.`);
      if (status?.tx_status?.status === 'committed' && !existsSync(output)) {
        saveDeployment(pending.txHash); return;
      }
    }
  }
  const owner = await signer.getAddressObjSecp256k1();
  const tx = ccc.Transaction.from({ outputs: binaries.map(() => ({ lock: owner.script })), outputsData: binaries.map(b => ccc.hexFrom(b)) });
  await tx.completeInputsByCapacity(signer, undefined, plainFilter); await tx.completeFeeBy(signer, 1000n, plainFilter);
  const signed = await signer.signTransaction(tx), txHash = signed.hash();
  writeFileSync('runtime/deploy-pending.json', JSON.stringify({ txHash, genesis }));
  await client.sendTransaction(signed);
  console.log(`Week05 deployment submitted: ${txHash}`);
  const stage = await confirm(config, txHash);
  if (stage !== 'committed') throw new Error(`Deployment ${stage}: ${txHash}. Keep pending metadata and recheck.`);
  saveDeployment(txHash);
  function saveDeployment(txHash: ccc.Hex) {
    const records = binaries.map((b, index): Binary => ({ codeHash: ccc.hashCkb(b), hashType: 'data2', size: b.length,
      outPoint: { txHash, index }, cellDep: { outPoint: { txHash, index }, depType: 'code' } }));
    const result = { ...config, vm: records[0], bytecode: records[1] };
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    // Separate evidence contains no demo keys.
    writeFileSync('runtime/deployment-public.json', JSON.stringify({ rpcUrl, genesis, vm: records[0], bytecode: records[1] }, null, 2) + '\n');
    console.log(`Week05 deployment committed: ${txHash}. Public demo-only browser configuration generated.`);
  }
}
main().catch(e => { console.error('Setup failed:', e instanceof Error ? e.message.slice(0, 600) : 'Unknown error'); process.exitCode = 1; });
