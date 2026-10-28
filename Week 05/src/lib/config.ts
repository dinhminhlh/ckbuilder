import { ccc } from '@ckb-ccc/core';
export type Binary = { codeHash: ccc.Hex; hashType: 'data2'; outPoint: ccc.OutPointLike; cellDep: ccc.CellDepLike; size: number };
export type DemoConfig = {
  rpcUrl: string; genesis: ccc.Hex; chain: 'ckb_dev';
  scripts: NonNullable<ConstructorParameters<typeof ccc.ClientPublicTestnet>[0]>['scripts'];
  accounts: [ccc.Hex, ccc.Hex]; vm: Binary; bytecode: Binary;
};
export function assertLocal(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || parsed.username || parsed.password) {
    throw new Error('Demo signing requires an explicit HTTP loopback Devnet RPC.');
  }
}
export async function rpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  assertLocal(url);
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Node unavailable: HTTP ${response.status}`);
  const body = await response.json();
  // Never echo RPC payloads: unlock witnesses contain a revealed secret.
  if (body.error) throw new Error(`RPC ${method} failed (code ${body.error.code}). Check node/debug fixtures; transaction details are intentionally omitted.`);
  return body.result;
}
export async function loadConfig(): Promise<DemoConfig> {
  const res = await fetch('/config.local.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Missing deployment. Run npm run setup after building the contract.');
  const config = await res.json() as DemoConfig;
  assertLocal(config.rpcUrl);
  return config;
}
