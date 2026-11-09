#!/usr/bin/env bash
set -euo pipefail
source /opt/ckbuilder-week07/env.sh
cd "$(cat "$LAB/source-path.txt")"
GOMAXPROCS=2 go build -p 2 -o "$LAB/perun-demo" . > "$LAB/logs/go-build.log" 2>&1
echo 'Perun Go application compiled successfully.'

