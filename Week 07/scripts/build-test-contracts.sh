#!/usr/bin/env bash
set -euo pipefail
source /opt/ckbuilder-week07/env.sh
SRC=$(cat "$LAB/source-path.txt")
WIN='/mnt/e/ckbuilder/Week 07'
mkdir -p "$LAB/logs" "$WIN/evidence"
cd "$SRC/devnet/contracts"
# The complete logs stay private in runtime; export status and checksums separately.
(
  source ./setup_env.sh build
  make build CARGO_ARGS=--locked
) > "$LAB/logs/contracts-build.log" 2>&1
python3 - "$SRC" "$WIN" <<'PY'
import hashlib,json,pathlib,sys,datetime
src,win=map(pathlib.Path,sys.argv[1:])
bins=src/'devnet/contracts/build/release'
records=[{'name':p.name,'size':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(bins.iterdir()) if p.is_file()]
assert len(records)>=6 and all(x['size']>0 for x in records)
out={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'native RISC-V contract build in isolated WSL','exitCode':0,'binaries':records}
(win/'evidence/02-contract-build.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
PY
(
  source ./setup_env.sh test
  make test
) > "$LAB/logs/contracts-tests.log" 2>&1
python3 - "$LAB/logs/contracts-tests.log" "$WIN/evidence/03-contract-tests.json" <<'PY'
import datetime,json,pathlib,re,sys
log=pathlib.Path(sys.argv[1]).read_text(errors='replace')
summary=re.findall(r'test result: .*',log)
assert summary and all('FAILED' not in s and '0 failed' in s for s in summary)
result={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'upstream Rust contract tests executed in WSL','exitCode':0,'summaries':summary,'tests':re.findall(r'^test .+ \.\.\. (?:ok|FAILED)',log,re.M)}
pathlib.Path(sys.argv[2]).write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
PY

