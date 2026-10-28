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
