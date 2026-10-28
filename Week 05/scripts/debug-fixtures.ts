import { ccc } from '@ckb-ccc/core';
import { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS, DEFAULT_SCRIPT_CKB_JS_VM } from 'ckb-testtool';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

async function main() {
  const resource = Resource.default();
  const deploy = (path: string) => resource.mockCell(resource.createScriptUnused(),undefined,ccc.hexFrom(readFileSync(path)));
  const vm = deploy(DEFAULT_SCRIPT_CKB_JS_VM), bytecode = deploy('packages/on-chain-script/dist/index.bc'), always = deploy(DEFAULT_SCRIPT_ALWAYS_SUCCESS);
  const application = resource.createScriptByData(bytecode,'0x');
  // Public synthetic bytes are generated only for debug fixtures. Never use a UI secret.
  const fixtureBytes = '0x010203' as ccc.Hex;
  const lock = resource.createScriptByData(vm,`0x0000${application.codeHash.slice(2)}${ccc.hexFrom(ccc.hashTypeToBytes(application.hashType)).slice(2)}${ccc.hashCkb(fixtureBytes).slice(2)}`);
  const other = resource.createScriptByData(always,'0x');
  const inputs = [resource.mockCell(other),resource.mockCell(lock)];
  mkdirSync('runtime/debug',{recursive:true});mkdirSync('evidence',{recursive:true});
  const debuggerPath = createRequire(import.meta.url)('./paths.cjs').debuggerPath();
  const results = [];
  for (const [name, bytes, expected] of [['wrong','0xdead',12],['correct',fixtureBytes,0]] as const) {
    const tx = ccc.Transaction.from({ cellDeps:[vm,bytecode,always].map(c => Resource.createCellDep(c,'code')),
      inputs:inputs.map(c => Resource.createCellInput(c)), outputs:[Resource.createCellOutput(other)], outputsData:['0x'],
      witnesses:['0x',ccc.hexFrom(ccc.WitnessArgs.from({lock:bytes}).toBytes())] });
    const file = `runtime/debug/${name}.json`;
    writeFileSync(file,JSON.stringify(Verifier.from(resource,tx).txFile(),null,2));
    const run = spawnSync(debuggerPath,['--tx-file',file,'--cell-type','input','--cell-index','1','--script-group-type','lock'],{encoding:'utf8',windowsHide:true});
    if (run.error) throw run.error;
    const code = Number(/Run result: (-?\d+)/.exec(run.stdout)?.[1]);
    assert.equal(code,expected);
    const log = `Fixture: ${name}; hash-lock group at input 1\nProcess exit: ${run.status}\n${run.stdout}\n${run.stderr}`;
    writeFileSync(`evidence/debug-${name}.txt`,log); console.log(log);
    results.push({fixture:file,scriptExitCode:code,processExitCode:run.status});
  }
  writeFileSync('evidence/debug-results.json',JSON.stringify(results,null,2)+'\n');
}
main().catch(() => {console.error('Debugger fixture check failed. Check CKB_DEBUGGER and built bytecode.');process.exitCode=1;});
