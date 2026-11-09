#!/usr/bin/env python3
import datetime,json,os,pathlib,subprocess
ROOT=pathlib.Path('/opt/ckbuilder-week07')
WIN=pathlib.Path('/mnt/e/ckbuilder/Week 07')
SRC=pathlib.Path((ROOT/'source-path.txt').read_text().strip())
marker=ROOT/'demo-attempt.json'
if marker.exists(): raise SystemExit('Demo already attempted. Inspect evidence/chain before creating another channel.')
record={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'running'}
marker.write_text(json.dumps(record))
env=os.environ.copy()
env['WEEK07_EVIDENCE']=str(WIN/'evidence')
with (ROOT/'logs/perun-demo.log').open('w') as output:
 try:
  result=subprocess.run([str(ROOT/'perun-demo')],cwd=SRC,env=env,stdout=output,stderr=subprocess.STDOUT,timeout=300)
  record['exitCode']=result.returncode
 except subprocess.TimeoutExpired:
  record['exitCode']=124
record['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
record['status']='completed' if record['exitCode']==0 else 'failed; inspect chain before retrying'
marker.write_text(json.dumps(record,indent=2)+'\n')
(WIN/'evidence/09-demo-execution.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
raise SystemExit(record['exitCode'])

