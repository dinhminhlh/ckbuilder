# Week03 — tạo toàn bộ source bằng copy–paste

Các file đã có trong ZIP. Chỉ dùng bản này nếu muốn tự tạo file bằng paste. Chạy trong thư mục trống, sau đó làm theo RUN_WEEK03.md. Không paste lên file đang sửa.

```powershell
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force .\ui | Out-Null
```

## package.json

```powershell
@'
{
  "dependencies": {
    "@ckb-ccc/core": "1.23.0",
    "@ckb-ccc/spore": "1.6.15",
    "@types/node": "22.20.5",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "tsx": "4.23.0",
    "typescript": "5.8.3",
    "vite": "7.1.7"
  },
  "name": "week03-rebuild",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "tsc --noEmit",
    "dev": "vite",
    "api": "tsx server.ts",
    "build": "tsc --noEmit && vite build"
  }
}
'@ | Set-Content -Encoding UTF8 '.\package.json'
```

## pnpm-workspace.yaml

```powershell
@'
packages:
  - '.'
allowBuilds:
  esbuild: true
'@ | Set-Content -Encoding UTF8 '.\pnpm-workspace.yaml'
```

## tsconfig.json

```powershell
@'
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "skipLibCheck": true, "noEmit": true,
    "jsx": "react-jsx", "esModuleInterop": true,
    "types": ["node", "vite/client"]
  },
  "include": ["*.ts", "ui/*.tsx"]
}
'@ | Set-Content -Encoding UTF8 '.\tsconfig.json'
```

## .gitignore

```powershell
@'
node_modules/
dist/
private/
*.key
*.env
'@ | Set-Content -Encoding UTF8 '.\.gitignore'
```

## lab.ts

```powershell
@'
import { ccc } from '@ckb-ccc/core';
import * as spore from '@ckb-ccc/spore';
import { SCRIPTS_SPORE_TESTNET, SCRIPTS_CLUSTER_TESTNET,
  SCRIPTS_SPORE_MAINNET, SCRIPTS_CLUSTER_MAINNET } from '@ckb-ccc/spore/advanced';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RPC = 'http://127.0.0.1:8114';
const stringify = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? x.toString() : x, 2);
const read = (n: string) => JSON.parse(readFileSync(join(ROOT, n), 'utf8').replace(/^\uFEFF/, ''));
const save = (n: string, v: unknown) => writeFileSync(join(ROOT, n), stringify(v));
const state = () => existsSync(join(ROOT, 'state.json')) ? read('state.json') : {};
const patchState = (v: object) => save('state.json', { ...state(), ...v });

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const b = await r.json();
  if (b.error) throw new Error(stringify(b.error));
  return b.result;
}

function exportedScripts() {
  const args = ['system-scripts', '--network', 'devnet', '--export-style', 'ccc'];
  const text = process.platform === 'win32'
    ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'offckb.cmd ' + args.join(' ')], { encoding: 'utf8' })
    : execFileSync('offckb', args, { encoding: 'utf8' });
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Cannot parse OffCKB script export');
  return JSON.parse(text.slice(start, end + 1));
}

function localInfo(genesis: any, candidates: (spore.SporeScriptInfoLike | undefined)[]) {
  for (const transaction of genesis.transactions) {
    for (let index = 0; index < transaction.outputs_data.length; index++) {
      const codeHash = ccc.hashCkb(transaction.outputs_data[index]);
      const info = candidates.find(x => x?.codeHash === codeHash);
      if (info) return { ...info, cellDeps: [{ cellDep: {
        outPoint: { txHash: transaction.hash, index }, depType: 'code' as const } }] };
    }
  }
  throw new Error('No supported Spore/Cluster binary in genesis. Use the standard OffCKB 0.4.13 devnet.');
}

async function initialize() {
  await rpc('get_tip_header', []);
  const genesis = await rpc('get_block_by_number', ['0x0']);
  const scripts = exportedScripts();
  for (const n of ['Secp256k1Blake160', 'AnyoneCanPay', 'NervosDao', 'XUdt']) {
    if (!scripts[n]) throw new Error(`Devnet export missing ${n}`);
  }
  const info = {
    genesisHash: genesis.header.hash, scripts,
    spore: localInfo(genesis, [...Object.values(SCRIPTS_SPORE_TESTNET), ...Object.values(SCRIPTS_SPORE_MAINNET)]),
    cluster: localInfo(genesis, [...Object.values(SCRIPTS_CLUSTER_TESTNET), ...Object.values(SCRIPTS_CLUSTER_MAINNET)]),
  };
  save('devnet.json', info);
  mkdirSync(join(ROOT, 'private'), { recursive: true });
  for (const who of ['a', 'b']) {
    const p = join(ROOT, 'private', `${who}.key`);
    if (!existsSync(p)) writeFileSync(p, '0x' + randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  const a = await wallet('a'), b = await wallet('b');
  save('accounts.json', { a: a.address, b: b.address });
  console.log('RPC ready:', RPC);
  console.log('Wallet A:', a.address);
  console.log('Wallet B:', b.address);
  console.log('Devnet scripts discovered; existing private keys preserved.');
}

async function wallet(who = 'a') {
  if (!['a', 'b'].includes(who)) throw new Error('Wallet must be a or b');
  if (!existsSync(join(ROOT, 'devnet.json'))) throw new Error('Run: pnpm exec tsx lab.ts init');
  const cfg = read('devnet.json');
  const client = new ccc.ClientPublicTestnet({ url: RPC, fallbacks: [], scripts: cfg.scripts });
  const key = readFileSync(join(ROOT, 'private', who + '.key'), 'utf8').replace(/^\uFEFF/, '').trim();
  const signer = new ccc.SignerCkbPrivateKey(client, key);
  const obj = await signer.getRecommendedAddressObj();
  return { cfg, client, signer, lock: obj.script, address: obj.toString() };
}

async function finish(tx: ccc.Transaction, who: string, label: string, newState: object = {}) {
  const { signer, client } = await wallet(who);
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000n);
  const txHash = await signer.sendTransaction(tx);
  console.log(label + ' tx:', txHash);
  // Save IDs and transaction hash immediately, even if confirmation waiting fails.
  patchState({ ...newState, lastTx: txHash, lastAction: label });
  const records = existsSync(join(ROOT, 'transactions.json')) ? read('transactions.json') : [];
  records.push({ action: label, txHash, status: 'sent', ...newState });
  save('transactions.json', records);
  const result = await client.waitTransaction(txHash);
  if (!result) throw new Error(`Confirmation pending: ${txHash}. Check the tx before repeating this command.`);
  records[records.length - 1].status = 'committed'; save('transactions.json', records);
  console.log('Status: committed');
  return txHash;
}

const amount128 = (n: bigint) => {
  if (n < 0n || n >= 1n << 128n) throw new Error('Amount outside uint128 range');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) { bytes[i] = Number(n & 255n); n >>= 8n; }
  return ccc.hexFrom(bytes);
};
const decode128 = (data: ccc.Hex) => {
  const b = ccc.bytesFrom(data);
  if (b.length !== 16) throw new Error('This lab supports basic 16-byte xUDT cells only');
  let n = 0n; for (let i = 15; i >= 0; i--) n = (n << 8n) | BigInt(b[i]); return n;
};
const requiredId = (name: 'clusterId' | 'sporeId') => {
  const id = state()[name]; if (!id) throw new Error(`No ${name}: run its create command first`); return id;
};

export async function run(command: string, who = 'a', amount = '100') {
  if (command === 'init') { await initialize(); return; }
  const { signer, client, lock, address, cfg } = await wallet(who);
  console.log('Network: OffCKB Devnet'); console.log('Wallet:', address);
  if (command === 'accounts') { console.log(stringify(read('accounts.json'))); return; }
  if (command === 'balance') {
    const balance = ccc.fixedPointToString(await client.getBalanceSingle(lock));
    console.log('Balance:', balance, 'CKB'); return { address, balance };
  }
  if (command === 'cells') {
    const cells = []; let total = 0n;
    for await (const c of client.findCellsByLock(lock, undefined, true)) {
      total += c.cellOutput.capacity;
      cells.push({ outPoint: c.outPoint, capacityCKB: ccc.fixedPointToString(c.cellOutput.capacity),
        lock: c.cellOutput.lock, type: c.cellOutput.type ?? null, data: c.outputData });
    }
    const result = { address, count: cells.length, totalCKB: ccc.fixedPointToString(total), cells };
    console.log(stringify(result)); return result;
  }
  if (command === 'transactions') {
    const rows = [];
    for await (const t of client.findTransactionsByLock(lock, undefined, true, 'desc')) {
      rows.push(t); if (rows.length === 10) break;
    }
    console.log(stringify(rows)); return rows;
  }
  if (command === 'ckb-transfer') {
    const receiver = await wallet(who === 'a' ? 'b' : 'a');
    if (!/^\d+(\.\d{1,8})?$/.test(amount) || ccc.fixedPointFrom(amount) < ccc.fixedPointFrom('61'))
      throw new Error('Use an amount of at least 61 CKB with at most 8 decimals');
    const tx = ccc.Transaction.from({ outputs: [{ capacity: ccc.fixedPointFrom(amount), lock: receiver.lock }], outputsData: ['0x'] });
    const txHash = await finish(tx, who, 'CKB transfer');
    const cell = await client.getCellLive({ txHash, index: 0 }, true);
    if (!cell || !cell.cellOutput.lock.eq(receiver.lock)) throw new Error('Receiver output not verified');
    console.log('Receiver:', receiver.address); console.log('Received:', amount, 'CKB');
    return { txHash, receiver: receiver.address, amount, status: 'committed' };
  }
  if (command.startsWith('xudt-')) {
    const saved = state();
    const type = ccc.Script.from({ ...cfg.scripts.XUdt, args: saved.xudtArgs ?? lock.hash() });
    if (command === 'xudt-issue') {
      const n = BigInt(amount); if (n <= 0n) throw new Error('Token amount must be positive');
      // Owner mode: type args = issuer lock hash; a normal issuer input authorizes minting.
      const tx = ccc.Transaction.from({ outputs: [{ lock, type }], outputsData: [amount128(n)] });
      await tx.addCellDepInfos(client, cfg.scripts.XUdt.cellDeps);
      await finish(tx, who, 'Issue xUDT', { xudtArgs: type.args });
      console.log('Type args:', type.args); console.log('Issued:', amount);
      return;
    }
    if (!saved.xudtArgs) throw new Error('Run xudt-issue first');
    let total = 0n; const cells = [];
    for await (const c of client.findCellsByLock(lock, type, true)) { cells.push(c); total += decode128(c.outputData); }
    if (command === 'xudt-balance') { console.log('xUDT:', total.toString()); console.log('Type args:', type.args); return; }
    if (command !== 'xudt-transfer') throw new Error('Unknown xUDT command');
    const n = BigInt(amount); if (n <= 0n || n > total) throw new Error('Invalid amount or insufficient xUDT');
    const receiver = await wallet(who === 'a' ? 'b' : 'a');
    const tx = ccc.Transaction.from({});
    for (const c of cells) tx.addInput(c);
    tx.addOutput({ lock: receiver.lock, type }, amount128(n));
    if (total > n) tx.addOutput({ lock, type }, amount128(total - n));
    await tx.addCellDepInfos(client, cfg.scripts.XUdt.cellDeps);
    await finish(tx, who, 'Transfer xUDT');
    console.log('Receiver:', receiver.address); console.log('Transferred:', amount); return;
  }
  if (command === 'cluster-create') {
    const { tx, id } = await spore.createSporeCluster({ signer,
      data: { name: 'Daniel CKBuilder Week 03', description: 'Week 03 Devnet practice' }, scriptInfo: cfg.cluster });
    await finish(tx, who, 'Create Cluster', { clusterId: id });
    console.log('Cluster ID:', id); return;
  }
  if (command === 'cluster-query' || command === 'cluster-transfer') {
    const id = requiredId('clusterId');
    const found = await spore.findCluster(client, id, [cfg.cluster]);
    if (!found) throw new Error('Cluster not live on this Devnet');
    if (command === 'cluster-query') {
      console.log(stringify({ id, ...found.clusterData, owner: ccc.Address.fromScript(found.cell.cellOutput.lock, client).toString(), outPoint: found.cell.outPoint })); return;
    }
    if (!found.cell.cellOutput.lock.eq(lock)) throw new Error('Select the CURRENT Cluster owner');
    const receiver = await wallet(who === 'a' ? 'b' : 'a');
    const { tx } = await spore.transferSporeCluster({ signer, id, to: receiver.lock, scripts: [cfg.cluster] });
    await finish(tx, who, 'Transfer Cluster');
    const after = await spore.findCluster(client, id, [cfg.cluster]);
    if (!after?.cell.cellOutput.lock.eq(receiver.lock)) throw new Error('Cluster new owner not verified');
    console.log('New owner:', receiver.address); return;
  }
  if (command === 'spore-create') {
    const clusterId = requiredId('clusterId');
    const found = await spore.findCluster(client, clusterId, [cfg.cluster]);
    if (!found || !found.cell.cellOutput.lock.eq(lock)) throw new Error('Create using the CURRENT Cluster owner');
    // Supply the local cluster proof explicitly; never modify frozen SDK configurations.
    const seed = ccc.Transaction.from({});
    await seed.completeInputsAddOne(signer);
    // Minimum-capacity proxy output releases the rest for Spore capacity and fees.
    seed.addOutput({ lock }, '0x');
    seed.addCellDeps({ outPoint: found.cell.outPoint, depType: 'code' });
    const { tx, id } = await spore.createSpore({ signer, tx: seed, scriptInfo: cfg.spore,
      clusterMode: 'skip', data: { contentType: 'text/plain', content: new TextEncoder().encode("Hello CKBuilders! Daniel's clustered Spore."), clusterId } });
    await finish(tx, who, 'Create Spore', { sporeId: id });
    console.log('Spore ID:', id); return;
  }
  if (['spore-query', 'spore-transfer', 'spore-melt'].includes(command)) {
    const id = requiredId('sporeId');
    const found = await spore.findSpore(client, id, [cfg.spore]);
    if (!found) {
      if (command === 'spore-query') { console.log('Spore ID:', id); console.log('Live Spore: NOT FOUND'); return; }
      throw new Error('Spore not live: already melted, or Devnet changed');
    }
    if (command === 'spore-query') {
      console.log(stringify({ id, owner: ccc.Address.fromScript(found.cell.cellOutput.lock, client).toString(),
        contentType: found.sporeData.contentType, content: ccc.bytesTo(found.sporeData.content, 'utf8'),
        clusterId: found.sporeData.clusterId, outPoint: found.cell.outPoint })); return;
    }
    if (!found.cell.cellOutput.lock.eq(lock)) throw new Error('Select the CURRENT Spore owner');
    const receiver = await wallet(who === 'a' ? 'b' : 'a');
    const result = command === 'spore-transfer'
      ? await spore.transferSpore({ signer, id, to: receiver.lock, scripts: [cfg.spore] })
      : await spore.meltSpore({ signer, id, scripts: [cfg.spore] });
    if (command === 'spore-melt') result.tx.addOutput({ lock }, '0x');
    const txHash = await finish(result.tx, who, command === 'spore-transfer' ? 'Transfer Spore' : 'Melt Spore');
    const after = await spore.findSpore(client, id, [cfg.spore]);
    if (command === 'spore-transfer') {
      if (!after?.cell.cellOutput.lock.eq(receiver.lock)) throw new Error('Spore new owner not verified');
      console.log('New owner:', receiver.address);
    } else {
      if (after || await client.getCellLive(found.cell.outPoint, true)) throw new Error('Melt state not verified');
      console.log('Original Cell: spent'); console.log('Live Spore: NOT FOUND');
      console.log('Capacity returned through outputs of:', txHash);
    }
    return;
  }
  throw new Error('Unknown command: ' + command);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, who, amount] = process.argv.slice(2);
  run(command, who, amount).catch(e => { console.error(e.message); process.exitCode = 1; });
}
'@ | Set-Content -Encoding UTF8 '.\lab.ts'
```

## server.ts

```powershell
@'
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { run } from './lab.js';

let busy = false;
createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  };
  const origin = req.headers.origin;
  if (origin && !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin)) {
    send(403, { error: 'Local UI origin required' }); return;
  }
  const u = new URL(req.url ?? '/', 'http://127.0.0.1:3001');
  try {
    if (req.method === 'GET' && u.pathname === '/api/accounts') {
      send(200, JSON.parse(readFileSync(new URL('./accounts.json', import.meta.url), 'utf8'))); return;
    }
    const action = u.pathname.replace('/api/', '');
    const readOnly = ['balance', 'cells', 'transactions'].includes(action);
    if (!(readOnly && req.method === 'GET') && !(action === 'ckb-transfer' && req.method === 'POST')) {
      send(404, { error: 'Unknown endpoint' }); return;
    }
    if (busy) { send(409, { error: 'Another request is running' }); return; }
    busy = true;
    try { send(200, await run(action, u.searchParams.get('wallet') ?? 'a', u.searchParams.get('amount') ?? '100')); }
    finally { busy = false; }
  } catch (e) { send(400, { error: e instanceof Error ? e.message : String(e) }); }
}).listen(3001, '127.0.0.1', () => console.log('Week03 API: http://127.0.0.1:3001 (private keys remain on server)'));
'@ | Set-Content -Encoding UTF8 '.\server.ts'
```

## vite.config.ts

```powershell
@'
import { defineConfig } from 'vite';
export default defineConfig({ server: { host: '127.0.0.1', port: 5173, strictPort: true,
  proxy: { '/api': 'http://127.0.0.1:3001' } } });
'@ | Set-Content -Encoding UTF8 '.\vite.config.ts'
```

## index.html

```powershell
@'
<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Week03 CKB Transfer</title></head><body><div id="root"></div><script type="module" src="/ui/main.tsx"></script></body></html>
'@ | Set-Content -Encoding UTF8 '.\index.html'
```

## ui/main.tsx

```powershell
@'
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [wallet, setWallet] = useState('a');
  const [accounts, setAccounts] = useState<Record<string, string> | null>(null);
  const [amount, setAmount] = useState('100');
  const [output, setOutput] = useState('Chọn Connect để dùng tài khoản Devnet cục bộ.');
  const [busy, setBusy] = useState(false);
  async function request(action: string, method = 'GET') {
    setBusy(true);
    try {
      const r = await fetch(`/api/${action}?wallet=${wallet}&amount=${encodeURIComponent(amount)}`, { method });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      if (action === 'accounts') setAccounts(data);
      setOutput(JSON.stringify(data, null, 2));
    } catch (e) { setOutput(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <main style={{ maxWidth: 1000, margin: '35px auto', fontFamily: 'Segoe UI', padding: 20 }}>
    <h1>Week03 · CKB Transfer</h1>
    <p>OffCKB Devnet · RPC 127.0.0.1:8114 · tài khoản cục bộ, private key giữ ở backend.</p>
    <select value={wallet} disabled={busy} onChange={e => setWallet(e.target.value)}>
      <option value="a">Wallet A → B</option><option value="b">Wallet B → A</option>
    </select>{' '}
    <button disabled={busy} onClick={() => request('accounts')}>Connect local account</button>
    {accounts && <p style={{ overflowWrap: 'anywhere' }}>Đang chọn: {accounts[wallet]}</p>}
    <div style={{ display: 'flex', gap: 10, margin: '20px 0', flexWrap: 'wrap' }}>
      {['balance', 'cells', 'transactions'].map(a => <button key={a} disabled={busy || !accounts} onClick={() => request(a)}>Query {a}</button>)}
    </div>
    <label>CKB gửi (tối thiểu 61): <input value={amount} disabled={busy} onChange={e => setAmount(e.target.value)} /></label>{' '}
    <button disabled={busy || !accounts} onClick={() => request('ckb-transfer', 'POST')}>Send CKB</button>
    <p>{busy ? 'Đang xử lý; giao dịch cần chờ committed…' : 'Kết quả:'}</p>
    <pre style={{ background: '#132036', color: '#e7f0ff', padding: 20, overflow: 'auto', maxHeight: 600 }}>{output}</pre>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
'@ | Set-Content -Encoding UTF8 '.\ui\main.tsx'
```

Sau khi tạo file: `pnpm install`, `pnpm run check`, `pnpm run build`. Lệnh init và toàn bộ lifecycle nằm trong RUN_WEEK03.md.
