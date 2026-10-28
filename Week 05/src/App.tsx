import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ccc } from '@ckb-ccc/core';
import { loadConfig, rpc, type DemoConfig } from './lib/config';
import { createClient, demoSigner, balance, verifyNetwork } from './lib/client';
import { expectedHash, findByHash, lockFor, parseOutPoint, chainCellStatus } from './lib/cells';
import { formatCkb } from './lib/amounts';
import { minimumCapacity, prepareCreate, prepareUnlock, secretHash, type Review } from './lib/hashlock';
import { broadcast, confirm, verifyReceipt, type Receipt } from './lib/transactions';

type Session = { config: DemoConfig; client: ccc.ClientPublicTestnet };
type KnownCell = { cell: ccc.Cell; status: 'live' | 'spent' | 'unknown' };
export function App() {
  const [session, setSession] = useState<Session>();
  const [account, setAccount] = useState(0), [addresses, setAddresses] = useState<string[]>([]);
  const [funds, setFunds] = useState<Awaited<ReturnType<typeof balance>>>();
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState(''), [show, setShow] = useState(false), [amount, setAmount] = useState('200');
  const [query, setQuery] = useState(''), [cells, setCells] = useState<KnownCell[]>([]), [selected, setSelected] = useState<ccc.Cell>();
  const [outHash, setOutHash] = useState(''), [outIndex, setOutIndex] = useState('0');
  const [unlockSecret, setUnlockSecret] = useState(''), [destination, setDestination] = useState('B'), [customAddress, setCustomAddress] = useState('');
  const [review, setReview] = useState<Review>(), [receipt, setReceipt] = useState<Receipt | undefined>(() => {
    const hash = localStorage.getItem('week05.lastTx');
    const stage = localStorage.getItem('week05.lastStage');
    return hash && stage && !['committed','rejected','failed'].includes(stage)
      ? { hash: hash as ccc.Hex, stage: 'confirmation unknown', message: 'Previous submission needs a chain recheck before another transaction.' } : undefined;
  });
  const gate = useRef(false);
  const [lastHash, setLastHash] = useState(() => localStorage.getItem('week05.lastTx') ?? '');
  const digest = secretHash(secret);
  async function action(work: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) {
      setReceipt(previous => {
        if (previous?.stage !== 'signing') return previous;
        localStorage.setItem('week05.lastStage','failed');
        return {...previous,stage:'failed',message:'Signing/preparation failed before broadcast. Refresh and review again.'};
      });
      // SDK errors may embed RPC transactions/witnesses; only show our curated errors.
      const message = e instanceof Error ? e.message : '';
      const kind = e instanceof Error ? e.constructor.name : '';
      if (/InsufficientCapacity/.test(kind)) { setError('Insufficient spendable plain-cell funds for capacity, occupied change and fees. Refresh or choose the other demo account.'); return; }
      setError(/^(Wrong |Stale|Reviewed|Hash-lock minimum|Enter |Recipient capacity|This OutPoint|Expected |Output index|Only untyped|Demo signing|Wrong network|Missing |System dependency|Committed,|Commitment|Recipient output|Invalid destination)/.test(message)
        ? message : 'Operation unavailable. Check node readiness, deployment, address and sufficient plain demo-account capacity, then refresh.');
    } finally { gate.current = false; setBusy(false); }
  }
  async function refresh(s = session, index = account) {
    if (!s) return;
    setReady(false);
    await verifyNetwork(s.config, s.client);
    const aa = await Promise.all([0, 1].map(async i => (await demoSigner(s.client, s.config, i).getAddressObjSecp256k1()).toString()));
    setAddresses(aa);
    setFunds(await balance(s.client, (await ccc.Address.fromString(aa[index], s.client)).script));
    const statuses = await Promise.all(cells.map(async row => {
      const status = await chainCellStatus(s.config,row.cell.outPoint,localStorage.getItem('week05.lastUnlock') ?? undefined);
      return { cell: row.cell, status };
    }));
    setCells(statuses); setReady(true);
  }
  useEffect(() => { let mounted = true;
    void action(async () => { const config = await loadConfig(); const s = { config, client: createClient(config) };
      if (mounted) { setSession(s); await refresh(s, 0); }
    }); return () => { mounted = false; };
  }, []);
  function saveReceipt(next: Receipt) {
    setReceipt(next); setLastHash(next.hash); localStorage.setItem('week05.lastTx', next.hash); localStorage.setItem('week05.lastStage',next.stage);
  }
  const unresolved = receipt && ['submitted','confirming','confirmation unknown'].includes(receipt.stage);
  const disabled = busy || !ready || !!unresolved;
  return <main>
    <header><div className="eyebrow">CKB BUILDER · WEEK 05</div><div className="badge">Devnet — Demo accounts</div><h1>Hash-lock Lab<span>A secret. A cell. A verifiable spend.</span></h1>
      <p>Anyone who knows the secret can satisfy this contract. Funding a cell does not give an account exclusive ownership. Revealing the secret in an unlock witness makes it public when broadcast.</p></header>
    <section className="account"><div><h2><i className={ready ? 'on' : ''}/>{ready ? 'Devnet ready' : 'Devnet unavailable / checking'}</h2><small>{session?.config.rpcUrl ?? 'Awaiting local deployment configuration'}</small></div>
      <label>Active demo account<select disabled={busy} value={account} onChange={e => { const next = Number(e.target.value); setAccount(next); setReview(undefined); setFunds(undefined); void action(() => refresh(session, next)); }}><option value={0}>Account A</option><option value={1}>Account B</option></select></label>
      <button disabled={busy || !session} onClick={() => void action(() => refresh())}>Refresh chain</button>
      <div className="address"><code>{addresses[account] ?? '—'}</code><button disabled={!addresses[account]} onClick={() => void navigator.clipboard.writeText(addresses[account])}>Copy address</button></div>
      <div className="metrics"><div><small>Spendable plain capacity*</small><strong>{funds ? formatCkb(funds.spendable) : '—'} <em>CKB</em></strong></div><div><small>Total capacity</small><strong>{funds ? formatCkb(funds.total) : '—'} <em>CKB</em></strong></div><div><small>Occupied capacity</small><strong>{funds ? formatCkb(funds.occupied) : '—'} <em>CKB</em></strong></div></div>
      <small>* Plain untyped, empty-data funding candidates. Maturity and fees still apply. Keys belong only to public disposable OffCKB accounts.</small></section>
    {error && <div role="alert" className="error">{error}</div>}
    <div className="columns"><section><div className="eyebrow">01 / CREATE</div><h2>Create a hash-lock cell</h2>
      <fieldset disabled={disabled}><label>Secret · UTF-8 bytes<div className="input-row"><input aria-label="Create secret" autoComplete="off" type={show ? 'text' : 'password'} value={secret} onChange={e => { setSecret(e.target.value); setReview(undefined); }}/><button onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div></label>
      <label>Capacity · CKB<input aria-label="Capacity" inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setReview(undefined); }}/></label>
      <small>Minimum for this lock: {session ? formatCkb(minimumCapacity(lockFor(session.config, digest))) : '—'} CKB</small>
      <label>Expected CKB secret hash<code className="hash">{digest}</code></label>
      <button className="primary" onClick={() => void action(async () => { if (!session) return; setReceipt(undefined); setReview(await prepareCreate(session.config, session.client, demoSigner(session.client, session.config, account), secret, amount)); })}>Review create transaction</button></fieldset>
    </section><section><div className="eyebrow">02 / DISCOVER</div><h2>Query hash-lock cells</h2>
      <fieldset disabled={disabled}><label>Expected secret hash<input aria-label="Search hash" placeholder="0x… (32 bytes)" value={query} onChange={e => setQuery(e.target.value)}/></label>
      <div className="input-row"><button onClick={() => setQuery(digest)}>Use hash preview</button><button onClick={() => void action(async () => { if (!session) return; const found = await findByHash(session.client, session.config, query); setCells(found.map(cell => ({ cell, status: 'live' }))); setSelected(undefined); setReview(undefined); })}>Find live cells</button></div>
      <details><summary>Look up an exact OutPoint</summary><label>Transaction hash<input aria-label="OutPoint transaction hash" value={outHash} onChange={e => setOutHash(e.target.value)}/></label><label>Output index<input aria-label="OutPoint index" value={outIndex} onChange={e => setOutIndex(e.target.value)}/></label><button onClick={() => void action(async () => { if (!session) return; const point = parseOutPoint(outHash, outIndex);
        const status = await rpc(session.config.rpcUrl, 'get_live_cell', [{ tx_hash: point.txHash, index: ccc.numToHex(point.index) }, true]);
        if (status.status !== 'live') {
          const state = await chainCellStatus(session.config,point,localStorage.getItem('week05.lastUnlock') ?? undefined);
          const previous = await rpc(session.config.rpcUrl,'get_transaction',[point.txHash]);
          const output = previous?.transaction?.outputs?.[Number(point.index)];
          if (previous?.tx_status?.status !== 'committed' || !output) { setError(`OutPoint status: ${state}. No committed source output found.`); return; }
          const script = (o:any) => ({codeHash:o.code_hash,hashType:o.hash_type,args:o.args});
          const cell = ccc.Cell.from({outPoint:point,cellOutput:{capacity:output.capacity,lock:script(output.lock),type:output.type ? script(output.type) : undefined},outputData:previous.transaction.outputs_data[Number(point.index)]});
          expectedHash(session.config,cell);setCells([{cell,status:state}]);setSelected(undefined);setReview(undefined);return;
        }
        const cell = await session.client.getCellLive(point, true); if (!cell) throw new Error('Stale/dead cell.'); expectedHash(session.config, cell); setCells([{ cell, status: 'live' }]);
      })}>Look up cell</button></details></fieldset>
      <div className="cell-list">{cells.length === 0 ? <p className="muted">Query the chain by secret hash or exact OutPoint. No local history is treated as a live cell.</p> : cells.map(({ cell, status }) => <article key={`${cell.outPoint.txHash}:${cell.outPoint.index}`} className={selected?.outPoint.eq(cell.outPoint) ? 'selected' : ''}>
        <strong>{formatCkb(cell.cellOutput.capacity)} CKB <span className="tag">{status}</span></strong><small>Hash-lock cell · expected hash</small><code>{session && expectedHash(session.config, cell)}</code><small>Full OutPoint</small><code>{cell.outPoint.txHash}:{cell.outPoint.index}</code>
        <button disabled={disabled || status !== 'live'} onClick={() => { setSelected(cell); setReview(undefined); setUnlockSecret(''); }}>Select for unlock</button></article>)}</div>
    </section></div>
    <section><div className="eyebrow">03 / UNLOCK</div><h2>Reveal & send</h2><p>{selected ? `Selected ${selected.outPoint.txHash}:${selected.outPoint.index}` : 'Select a live hash-lock cell above.'}</p>
      <fieldset disabled={disabled || !selected}><div className="columns"><label>Secret · UTF-8<input aria-label="Unlock secret" type="password" autoComplete="off" value={unlockSecret} onChange={e => { setUnlockSecret(e.target.value); setReview(undefined); }}/></label><label>Destination<select value={destination} onChange={e => { setDestination(e.target.value); setReview(undefined); }}><option>A</option><option>B</option><option>Custom same-network address</option></select></label></div>
      {destination !== 'A' && destination !== 'B' && <label>Destination address<input value={customAddress} onChange={e => { setCustomAddress(e.target.value); setReview(undefined); }}/></label>}
      <button className="primary" onClick={() => void action(async () => { if (!session || !selected) return; setReceipt(undefined); const address = destination === 'A' ? addresses[0] : destination === 'B' ? addresses[1] : customAddress;
        setReview(await prepareUnlock(session.config, session.client, selected.outPoint, unlockSecret, address)); })}>Review unlock transaction</button></fieldset>
    </section>
    {review && <section className="review"><div className="eyebrow">TRANSACTION REVIEW</div><h2>{review.kind === 'create' ? 'Create hash-lock cell' : 'Unlock to recipient'}</h2><dl><dt>From / authorizing lock</dt><dd><code>{review.sender}</code></dd><dt>Destination {review.kind === 'create' ? 'lock hash' : 'address'}</dt><dd><code>{review.destination}</code></dd><dt>Resulting capacity</dt><dd>{formatCkb(review.amount)} CKB</dd><dt>Estimated fee · 1000 shannons/kB</dt><dd>{formatCkb(review.fee)} CKB ({review.fee.toString()} shannons)</dd><dt>Change</dt><dd>{formatCkb(review.change)} CKB</dd></dl>
      <button className="primary" disabled={disabled} onClick={() => void action(async () => { if (!session) return; const current = review;
        setReview(undefined);
        await broadcast(session.config, session.client, demoSigner(session.client, session.config, account), current, next => {
          saveReceipt(next);
          if (current.kind === 'unlock' && next.stage === 'committed') localStorage.setItem('week05.lastUnlock',next.hash);
        });
        setSecret(''); setUnlockSecret(''); setQuery(current.digest); await refresh();
        if (current.kind === 'create') { const found = await findByHash(session.client, session.config, current.digest); setCells(found.map(cell => ({ cell, status: 'live' }))); }
      })}>Confirm & submit to Devnet</button><button disabled={busy} onClick={() => setReview(undefined)}>Cancel review</button></section>}
    <section aria-live="polite"><div className="eyebrow">TRANSACTION STATUS</div><h2>{error ? 'failed' : busy && !receipt ? 'preparing' : receipt?.stage ?? 'Ready when you are'}</h2><p>{receipt?.message ?? 'Submitted hashes remain available for recheck after a refresh. Secrets are never stored.'}</p>
      {lastHash && <><code className="hash">{lastHash}</code><button disabled={busy || !session} onClick={() => void action(async () => { if (!session) return; await verifyNetwork(session.config, session.client); const hash = lastHash as ccc.Hex; const stage = await confirm(session.config, hash, 10000);
        if (stage === 'committed' && review && review.tx.hash() === hash) await verifyReceipt(session.config, review, hash);
        saveReceipt({ hash, stage, message: 'Status re-queried from chain. Use exact OutPoint lookup to inspect cell state.' }); await refresh(); })}>Recheck transaction</button></>}
    </section><footer>Local Devnet only · Week04 contract semantics preserved · No real funds</footer>
  </main>;
}
