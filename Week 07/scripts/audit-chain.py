#!/usr/bin/env python3
"""Independently verify the observed Perun states against committed Devnet transactions."""
import datetime,json,pathlib,struct
from preflight import rpc, accounts
WIN=pathlib.Path('/mnt/e/ckbuilder/Week 07')
def read(name): return json.loads((WIN/'evidence'/name).read_text())
def fields(hexdata):
 data=bytes.fromhex(hexdata[2:]) if isinstance(hexdata,str) else hexdata
 assert len(data)>=8 and struct.unpack_from('<I',data)[0]==len(data)
 first=struct.unpack_from('<I',data,4)[0]
 assert first%4==0 and 8<=first<=len(data)
 count=first//4-1
 offsets=list(struct.unpack_from('<'+'I'*count,data,4))+[len(data)]
 assert offsets==sorted(offsets)
 return [data[offsets[i]:offsets[i+1]] for i in range(count)]
def main():
 before=read('04-devnet-deployment.json')
 execution=read('09-demo-execution.json')
 assert execution['exitCode']==0
 assert rpc('get_block_hash',['0x0'])==before['genesis']
 assert rpc('get_blockchain_info')['chain']=='ckb_dev'
 names=['05-channel-open','06-alice-pays-bob','07-bob-pays-alice','08-channel-settled']
 expected=[('10000000000','10000000000'),('9000000000','11000000000'),('9500000000','10500000000'),('9500000000','10500000000')]
 snapshots=[]
 for version,(name,allocation) in enumerate(zip(names,expected)):
  item=read(name+'.json')
  assert item['aliceView']==item['bobView']
  assert item['viewsMatch'] is True
  s=item['aliceView']
  assert (s['aliceShannons'],s['bobShannons'])==allocation
  assert s['version']==version and s['isFinal']==(version==3)
  assert int(item['totalShannons'])==int(s['aliceShannons'])+int(s['bobShannons'])==20000000000
  snapshots.append(s)
 channel=snapshots[0]['channelId']
 assert all(s['channelId']==channel for s in snapshots)
 pcts=next(d['codeHash'] for d in before['deployedScripts'] if d['name']=='pcts')
 tip=int(rpc('get_tip_header')['number'],16)
 transactions=[]
 for number in range(int(before['tipBeforeDemo'],16)+1,tip+1):
  block=rpc('get_block_by_number',[hex(number)])
  for tx in block['transactions'][1:]:
   transactions.append((number,tx))
 channel_outputs=[]
 for number,tx in transactions:
  for index,(output,data) in enumerate(zip(tx['outputs'],tx['outputs_data'])):
   if output['type'] and output['type']['code_hash']==pcts:
    status=fields(data);state=fields(status[0])
    found='0x'+state[0].hex()
    if found==channel:
     channel_outputs.append({'txHash':tx['hash'],'index':index,'blockNumber':number,'stateVersion':int.from_bytes(state[2],'little'),'capacityShannons':str(int(output['capacity'],16))})
 assert channel_outputs,'No committed Perun channel output found'
 points={(o['txHash'],o['index']) for o in channel_outputs}
 closes=[]
 for number,tx in transactions:
  consumed=[i['previous_output'] for i in tx['inputs'] if (i['previous_output']['tx_hash'],int(i['previous_output']['index'],16)) in points]
  produces=any(o['txHash']==tx['hash'] for o in channel_outputs)
  if consumed and not produces: closes.append((number,tx,consumed))
 assert len(closes)==1,'Expected one channel settlement'
 for channel_output in channel_outputs:
  point={'tx_hash':channel_output['txHash'],'index':hex(channel_output['index'])}
  assert rpc('get_live_cell',[point,False])['status']!='live'
  assert any(any(i['previous_output']==point for i in tx['inputs']) for _,tx in transactions),'Missing committed spent proof'
 number,close,consumed=closes[0]
 assert rpc('get_transaction',[close['hash']])['tx_status']['status']=='committed'
 for point in consumed:
  assert rpc('get_live_cell',[point,False])['status']!='live'
 recipients={}
 for who,account in before['accounts'].items():
  outputs=[o for o in close['outputs'] if o['lock']==account['lock'] and o['type'] is None]
  assert outputs,f'Missing settlement output for {who}'
  recipients[who]={'lock':account['lock'],'outputCapacityShannons':str(sum(int(o['capacity'],16) for o in outputs))}
 txcache={}
 def previous(hash):
  if hash not in txcache:
   value=rpc('get_transaction',[hash])
   assert value['tx_status']['status']=='committed'
   txcache[hash]=value['transaction']
  return txcache[hash]
 related=[]
 for height,tx in transactions:
  touches=any(o['txHash']==tx['hash'] for o in channel_outputs) or tx['hash']==close['hash']
  if not touches: continue
  assert rpc('get_transaction',[tx['hash']])['tx_status']['status']=='committed'
  input_capacity=sum(int(previous(i['previous_output']['tx_hash'])['outputs'][int(i['previous_output']['index'],16)]['capacity'],16) for i in tx['inputs'])
  output_capacity=sum(int(o['capacity'],16) for o in tx['outputs'])
  assert input_capacity>=output_capacity
  related.append({'txHash':tx['hash'],'blockNumber':height,'status':'committed','feeShannons':str(input_capacity-output_capacity),'kind':'settlement' if tx['hash']==close['hash'] else 'channel funding'})
 result={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'fresh independent CKB Devnet RPC audit','genesis':before['genesis'],'channelId':channel,'stateVersions':[s['version'] for s in snapshots],'allocations':[{'aliceShannons':s['aliceShannons'],'bobShannons':s['bobShannons'],'isFinal':s['isFinal']} for s in snapshots],'bothParticipantsAgree':True,'allocationConserved':True,'channelOutputs':channel_outputs,'settlementTxHash':close['hash'],'settlementStatus':'committed','channelInputConsumed':True,'noSuccessorChannelOutput':True,'settlementRecipients':recipients,'transactions':related,'walletsAfter':accounts()}
 (WIN/'evidence/10-final-audit.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()

