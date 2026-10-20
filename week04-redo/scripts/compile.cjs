const fs = require("node:fs");
const { DEFAULT_SCRIPT_CKB_JS_VM: vm } = require("ckb-testtool");
const js = "packages/on-chain-script/dist/index.js";
const bc = "packages/on-chain-script/dist/index.bc";
fs.writeFileSync(bc, "");
const { spawnSync } = require("node:child_process");
const { debuggerPath } = require("./paths.cjs");
const result = spawnSync(debuggerPath(), ["--read-file", js, "--bin", vm, "--", "-c", bc], {stdio:"inherit"});
if (result.error || result.status !== 0 || fs.statSync(bc).size === 0) {
  console.error(result.error ?? "Bytecode compilation failed");
  process.exitCode = 1;
} else console.log("Bytecode compiled by CKB JS VM / native ckb-debugger.");
