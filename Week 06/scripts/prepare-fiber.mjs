import { createECDH } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const template = resolve(root, 'runtime/bin/config/testnet/config.yml');
if (!existsSync(template)) throw new Error('Run scripts/Install-Fiber.ps1 first.');
for (const [name, rpc, p2p] of [['alice', 8227, 8228], ['bob', 8237, 8238]]) {
  const dir = resolve(root, 'runtime', name);
  mkdirSync(resolve(dir, 'ckb'), { recursive: true });
  const keyPath = resolve(dir, 'ckb/key');
  if (!existsSync(keyPath)) {
    const ecdh = createECDH('secp256k1');
    ecdh.generateKeys();
    writeFileSync(keyPath, ecdh.getPrivateKey().toString('hex'), { flag: 'wx', mode: 0o600 });
  }
  const configPath = resolve(dir, 'config.yml');
  if (!existsSync(configPath)) {
    const config = readFileSync(template, 'utf8')
      .replace('"/ip4/0.0.0.0/tcp/8228"', `"/ip4/127.0.0.1/tcp/${p2p}"`)
      .replace('"127.0.0.1:8227"', `"127.0.0.1:${rpc}"`)
      .replace('announce_listening_addr: true', 'announce_listening_addr: false')
      .replace('  chain: testnet', '  chain: testnet\n  auto_accept_channel_ckb_funding_amount: 0\n  announce_private_addr: true');
    writeFileSync(configPath, config, { flag: 'wx' });
  }
  console.log(`${name}: Testnet config prepared; RPC ${rpc}, P2P ${p2p}. Existing keys/config preserved.`);
}
