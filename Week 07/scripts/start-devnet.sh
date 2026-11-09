#!/usr/bin/env bash
set -euo pipefail
source /opt/ckbuilder-week07/env.sh
SRC=$(cat "$LAB/source-path.txt")
DEVNET=$(realpath "$SRC/devnet")
EXPECTED=/opt/ckbuilder-week07/source/perun-network-perun-examples-6e975e7/payment-channel-ckb/devnet
[ "$DEVNET" = "$EXPECTED" ] || { echo 'Unexpected Devnet path'; exit 1; }
cd "$DEVNET"
if [ ! -f ckb.toml ]; then
  ./setup-devnet.sh > "$LAB/logs/devnet-init.log" 2>&1
fi
if ! curl -fsS --max-time 2 -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"get_tip_header","params":[]}' http://127.0.0.1:8114 > /dev/null 2>&1; then
  nohup ckb run > "$LAB/logs/ckb-node.log" 2>&1 &
  echo $! > "$LAB/node.pid"
fi
python3 - <<'PY'
import json,time,urllib.request
for _ in range(60):
 try:
  r=urllib.request.Request('http://127.0.0.1:8114',json.dumps({'jsonrpc':'2.0','id':1,'method':'get_tip_header','params':[]}).encode(),{'Content-Type':'application/json'})
  data=json.load(urllib.request.urlopen(r,timeout=2))
  assert 'result' in data
  break
 except Exception: time.sleep(1)
else: raise SystemExit('CKB RPC not ready')
PY
if [ ! -f "$LAB/miner.pid" ] || ! kill -0 "$(cat "$LAB/miner.pid")" 2>/dev/null; then
  nohup ckb miner > "$LAB/logs/ckb-miner.log" 2>&1 &
  echo $! > "$LAB/miner.pid"
fi
if [ ! -f "$LAB/accounts-exported" ]; then
  ./print_accounts.sh > "$LAB/logs/accounts-export.log" 2>&1
  touch "$LAB/accounts-exported"
fi
if [ ! -f "$LAB/accounts-funded" ]; then
  ./fund_accounts.expect > "$LAB/logs/accounts-funding.log" 2>&1
  touch "$LAB/accounts-funded"
fi
if [ ! -f "$LAB/contracts-deployed" ]; then
  ./deploy_contracts.sh > "$LAB/logs/deployment.log" 2>&1
  touch "$LAB/contracts-deployed"
fi
echo 'Perun Devnet setup steps finished. Verify RPC/deployment before running the demo.'

