const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
if (args.some(a => ["clean", "reset", "accounts"].includes(a))) {
  throw new Error("Wrapper blocks reset/clean and account-key output.");
}
async function main() {
  if (args[0] === "node" && args[1] !== "stop") {
    try {
      const res = await fetch("http://127.0.0.1:8114", {method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({id:1,jsonrpc:"2.0",method:"get_blockchain_info",params:[]}),
        signal:AbortSignal.timeout(2000)});
      if (res.ok) throw new Error("RPC 8114 is already running; reuse it. No second node started.");
    } catch (e) { if (e.message.includes("already running")) throw e; }
  }
  const local = path.join(root, ".offckb");
  const child = spawn(process.execPath, [path.join(root, "node_modules/@offckb/cli/build/index.js"), ...args], {
    stdio:"inherit", windowsHide:true,
    env:{...process.env, PATH: path.join(root,"node_modules/.bin") + path.delimiter + process.env.PATH,
      APPDATA:local, LOCALAPPDATA:local,
      XDG_DATA_HOME:local, XDG_CONFIG_HOME:local, XDG_CACHE_HOME:local},
  });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
main().catch(e => { console.error(e.message); process.exitCode=1; });
