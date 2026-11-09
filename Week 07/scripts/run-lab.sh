#!/usr/bin/env bash
set -euo pipefail
source /opt/ckbuilder-week07/env.sh
SCRIPTS='/mnt/e/ckbuilder/Week 07/scripts'
if [ "${1:-run}" = audit ] && [ ! -f "$LAB/demo-attempt.json" ]; then
  echo 'No existing demo to audit. Run the lab deliberately first.'
  exit 1
fi
cleanup() {
  # Stop only the exact CKB processes belonging to this isolated Devnet.
  local expected devnet file pid
  expected=$(readlink -f "$LAB/tools/bin/ckb")
  devnet=$(realpath "$(cat "$LAB/source-path.txt")/devnet")
  for file in "$LAB/miner.pid" "$LAB/node.pid"; do
    [ -f "$file" ] || continue
    pid=$(cat "$file")
    if [ "$(readlink -f "/proc/$pid/exe" 2>/dev/null || true)" = "$expected" ] &&
       [ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" = "$devnet" ]; then
      kill -INT "$pid" 2>/dev/null || true
      for attempt in $(seq 1 50); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
      done
    fi
  done
}
trap cleanup EXIT
# Keep one foreground WSL command alive throughout setup, demo and verification.
# Returning the WSL client early can stop child nodes on this Windows setup.
bash "$SCRIPTS/start-devnet.sh"
if [ -f "$LAB/demo-attempt.json" ]; then
  echo 'Existing demo attempt found. Auditing existing results; no new channel/payment.'
  python3 "$SCRIPTS/audit-chain.py"
  exit 0
fi
python3 "$SCRIPTS/preflight.py"
python3 "$SCRIPTS/run-demo.py"
python3 "$SCRIPTS/audit-chain.py"

