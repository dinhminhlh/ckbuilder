#!/usr/bin/env python3
import datetime, hashlib, json, pathlib, re, subprocess, time, urllib.request
ROOT=pathlib.Path('/opt/ckbuilder-week07')
WIN=pathlib.Path('/mnt/e/ckbuilder/Week 07')
SRC=pathlib.Path((ROOT/'source-path.txt').read_text().strip())
URL='http://127.0.0.1:8114'
def rpc(method,params=None):
 request=urllib.request.Request(URL,json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params or []}).encode(),{'Content-Type':'application/json'})
 reply=json.load(urllib.request.urlopen(request,timeout=20))
 if 'error' in reply: raise RuntimeError(str(reply['error']))
 return reply['result']
def cells(lock):
 result=[];cursor=None
 while True:
  params=[{'script':lock,'script_type':'lock','script_search_mode':'exact','with_data':True},'asc','0x64']
  if cursor: params.append(cursor)
  page=rpc('get_cells',params)
  result.extend(page['objects'])
  if not page['objects']: return result
  assert page['last_cursor']!=cursor
  cursor=page['last_cursor']
def accounts():
 result={}
 for who in ('alice','bob'):
  text=(SRC/f'devnet/accounts/{who}.txt').read_text()
  args=re.search(r'^lock_arg:\s*(0x[0-9a-f]+)',text,re.M).group(1)
  lock={'code_hash':'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8','hash_type':'type','args':args}
  live=cells(lock)
  result[who]={'lock':lock,'capacityShannons':str(sum(int(c['output']['capacity'],16) for c in live)),'cellCount':len(live)}
 return result
def main():
 assert rpc('get_blockchain_info')['chain']=='ckb_dev'
 records=[]
 for folder in ('migrations/dev','migrations_vc/dev'):
  files=list((SRC/'devnet/contracts'/folder).glob('*.json'))
  assert len(files)==1,files
  data=json.loads(files[0].read_text())
  for recipe in data['cell_recipes']:
   point={'tx_hash':recipe['tx_hash'],'index':hex(recipe['index'])}
   for attempt in range(60):
    live=rpc('get_live_cell',[point,True])
    if live['status']=='live': break
    tx=rpc('get_transaction',[point['tx_hash']])
    if tx and tx['tx_status']['status']=='rejected': raise RuntimeError(str(tx['tx_status']))
    time.sleep(1)
   assert live['status']=='live',recipe['name']
   actual='0x'+hashlib.blake2b(bytes.fromhex(live['cell']['data']['content'][2:]),digest_size=32,person=b'ckb-default-hash').hexdigest()
   assert actual==recipe['data_hash']
   assert rpc('get_transaction',[point['tx_hash']])['tx_status']['status']=='committed'
   records.append({'name':recipe['name'],'outPoint':point,'codeHash':actual,'live':True,'deploymentStatus':'committed'})
 before=accounts()
 assert all(int(a['capacityShannons'])>=1000*100000000 for a in before.values())
 result={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'live isolated CKB Devnet RPC','chain':'ckb_dev','genesis':rpc('get_block_hash',['0x0']),'tipBeforeDemo':rpc('get_tip_header')['number'],'deployedScripts':records,'accounts':before}
 (WIN/'evidence/04-devnet-deployment.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__': main()

