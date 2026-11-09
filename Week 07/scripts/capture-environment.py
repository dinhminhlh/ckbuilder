#!/usr/bin/env python3
import datetime,hashlib,json,pathlib,platform,subprocess
ROOT=pathlib.Path('/opt/ckbuilder-week07')
WIN=pathlib.Path('/mnt/e/ckbuilder/Week 07')
def version(command):return subprocess.check_output(command,text=True,stderr=subprocess.STDOUT).strip().splitlines()[0]
archives=[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size} for p in sorted((ROOT/'downloads').glob('*.tar.gz'))]
result={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'distribution':'CKBuilderWeek07 - Ubuntu 24.04.5 LTS','kernel':platform.release(),'architecture':platform.machine(),'versions':{'go':version(['go','version']),'rustc':version(['rustc','--version']),'cargo':version(['cargo','--version']),'ckb':version(['ckb','--version']),'ckbCli':version(['ckb-cli','--version']),'clang':version(['clang-18','--version'])},'sourceCommit':'6e975e7d2f61a80d1d13b71330a2415086b82242','archiveHashes':archives,'notes':'Ubuntu/Go downloads checked against publisher SHA256; CKB release archive hashes recorded for reproduction.'}
(WIN/'evidence/01-environment.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

