import { ccc } from '@ckb-ccc/core';
import { assertLocal, rpc, type DemoConfig } from './config';
import { CKB } from './amounts';
export function createClient(config: DemoConfig) {
  assertLocal(config.rpcUrl);
  return new ccc.ClientPublicTestnet({ url: config.rpcUrl, fallbacks: [], scripts: config.scripts });
}
// CCC's generic private-key signer also discovers ACP cells. This demonstration
// deliberately funds/signs only the exact standard secp lock, never ACP/custom cells.
export class DemoSigner extends ccc.SignerCkbPrivateKey {
  async getAddressObjs() { return [await this.getAddressObjSecp256k1()]; }
  async getRelatedScripts(txLike: ccc.TransactionLike) {
    const owner = await this.getAddressObjSecp256k1();
    const tx = ccc.Transaction.from(txLike);
    for (const input of tx.inputs) {
      const cell = await input.getCell(this.client);
      if (cell.cellOutput.lock.eq(owner.script)) return [{ script: owner.script,
        cellDeps: (await this.client.getKnownScript(ccc.KnownScript.Secp256k1Blake160)).cellDeps }];
    }
    return [];
  }
}
export function demoSigner(client: ccc.Client, config: DemoConfig, index: number) {
  if (index !== 0 && index !== 1) throw new Error('Choose demo account A or B.');
  return new DemoSigner(client, config.accounts[index]);
}
export async function verifyNetwork(config: DemoConfig, client: ccc.Client) {
  const [info, genesis] = await Promise.all([rpc(config.rpcUrl, 'get_blockchain_info'), rpc(config.rpcUrl, 'get_block_hash', ['0x0'])]);
  if (config.chain !== 'ckb_dev' || info.chain !== config.chain || !config.genesis || genesis !== config.genesis) {
    throw new Error('Wrong network or reset Devnet. Signing blocked; rerun setup for the intended local chain.');
  }
  for (const binary of [config.vm, config.bytecode]) {
    const cell = await client.getCellLive(binary.outPoint, true);
    if (!cell || ccc.hashCkb(cell.outputData) !== binary.codeHash || binary.hashType !== 'data2' || binary.cellDep.depType !== 'code' ||
      !ccc.OutPoint.from(binary.outPoint).eq(ccc.OutPoint.from(binary.cellDep.outPoint))) {
      throw new Error('Missing or changed deployment. Run setup again.');
    }
  }
  const secp = await client.getKnownScript(ccc.KnownScript.Secp256k1Blake160);
  for (const dep of secp.cellDeps) {
    if (!await client.getCellLive(dep.cellDep.outPoint, true)) throw new Error('System dependency is no longer live.');
  }
}
export async function balance(client: ccc.Client, lock: ccc.Script) {
  let total = 0n, spendable = 0n, occupied = 0n;
  for await (const cell of client.findCellsOnChain({ script: lock, scriptType: 'lock', scriptSearchMode: 'exact', withData: true })) {
    total += cell.cellOutput.capacity;
    occupied += BigInt(cell.cellOutput.occupiedSize + ccc.bytesFrom(cell.outputData).length) * CKB;
    if (!cell.cellOutput.type && cell.outputData === '0x') spendable += cell.cellOutput.capacity;
  }
  return { total, spendable, occupied };
}
