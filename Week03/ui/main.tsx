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
