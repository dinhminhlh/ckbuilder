const path = require("node:path");
const fs = require('node:fs');
exports.debuggerPath = () => {
  const candidates = [process.env.CKB_DEBUGGER, path.resolve(__dirname,
    '../.offckb/offckb-nodejs/Data/tools/ckb-debugger.exe'), 'G:/tools/ckb-debugger/ckb-debugger.exe'];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) throw new Error('ckb-debugger is missing. Set CKB_DEBUGGER to the installed executable; no global installation is performed.');
  return found;
};
