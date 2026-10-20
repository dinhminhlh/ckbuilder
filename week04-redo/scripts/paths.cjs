const path = require("node:path");
exports.debuggerPath = () => process.env.CKB_DEBUGGER ?? path.resolve(__dirname,
  "../.offckb/offckb-nodejs/Data/tools/ckb-debugger.exe");
