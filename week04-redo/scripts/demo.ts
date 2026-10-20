import { ccc } from "@ckb-ccc/core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { DEFAULT_SCRIPT_CKB_JS_VM } from "ckb-testtool";

const root = resolve(__dirname, "..");
process.chdir(root);
const config = JSON.parse(readFileSync(existsSync("config.local.json") ? "config.local.json" : "config.example.json", "utf8").replace(/^\uFEFF/, ""));
config.rpcUrl = process.env.CKB_RPC_URL ?? config.rpcUrl;
const runtime = resolve(root, "runtime");
mkdirSync(runtime, { recursive: true });
const json = (value: unknown) => JSON.stringify(value, (_, v) => typeof v === "bigint" ? `0x${v.toString(16)}` : v, 2);
function save(name: string, value: unknown) { writeFileSync(resolve(runtime, name + ".json"), json(value) + "\n"); }
function load(name: string) { return JSON.parse(readFileSync(resolve(runtime, name + ".json"), "utf8")); }
async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(config.rpcUrl, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const data = await response.json() as { result: any; error?: unknown };
  if (data.error) throw new Error(`RPC ${method}: ${json(data.error)}`);
  return data.result;
}

type Binary = { codeHash: ccc.Hex; hashType: "data2"; outPoint: ccc.OutPointLike; cellDep: ccc.CellDepLike; size: number };
async function main() {
  const command = process.argv[2];
  if (!["query", "deploy", "lock", "unlock"].includes(command)) throw new Error("Expected query/deploy/lock/unlock");
  const url = new URL(config.rpcUrl);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("Demo only accepts a local Devnet RPC.");
  const info = await rpc("get_blockchain_info");
  if (info.chain !== "ckb_dev") throw new Error(`Refusing non-Devnet chain: ${info.chain}`);
  const genesis = await rpc("get_block_hash", ["0x0"]);
  let scripts;
  if (config.systemScriptsFile) {
    scripts = JSON.parse(readFileSync(resolve(config.systemScriptsFile), "utf8").replace(/^\uFEFF/, ""));
  } else {
    const text = execFileSync(process.execPath, ["scripts/offckb.cjs", "system-scripts", "--export-style", "ccc"],
      { encoding: "utf8", windowsHide: true });
    scripts = JSON.parse(text.slice(text.indexOf("{")));
  }
  if (!scripts.Secp256k1Blake160?.cellDeps?.length) throw new Error("Missing actual Devnet secp metadata.");
  const client = new ccc.ClientPublicTestnet({ url: config.rpcUrl, fallbacks: [], scripts });
  for (const dep of scripts.Secp256k1Blake160.cellDeps) {
    if (!await client.getCellLive(dep.cellDep.outPoint, true)) throw new Error("System deps not live. Export metadata from this Devnet.");
  }
  // Public, prefunded OffCKB demo account; no real/private wallet configuration.
  const accounts = JSON.parse(readFileSync("node_modules/@offckb/cli/account/account.json", "utf8"));
  const account = accounts[config.demoAccountIndex];
  if (!account) throw new Error("Invalid demoAccountIndex");
  const signer = new ccc.SignerCkbPrivateKey(client, account.privkey);
  const owner = await signer.getAddressObjSecp256k1();
  const queryAddress = config.address ? await ccc.Address.fromString(config.address, client) : owner;
  const recipient = config.recipientAddress ? await ccc.Address.fromString(config.recipientAddress, client) : owner;
  const secret = ccc.hexFrom(Buffer.from(config.secretUtf8, "utf8"));
  const digest = ccc.hashCkb(secret);
  const feeRate = BigInt(config.feeRate);
  async function committed(txHash: ccc.Hex) {
    const deadline = Date.now() + config.timeoutMs;
    while (Date.now() < deadline) {
      const tx = await rpc("get_transaction", [txHash]);
      const status = tx?.tx_status?.status;
      if (status === "committed") return tx.tx_status;
      if (status === "rejected") throw new Error(`Transaction rejected: ${tx.tx_status.reason}`);
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Commit timeout (${config.timeoutMs} ms), txHash=${txHash}. Check pending.json before retrying.`);
  }
  async function send(tx: ccc.Transaction, sign: boolean, kind: string) {
    const fee = await tx.getFee(client);
    const txHash = sign ? await signer.sendTransaction(tx) : await client.sendTransaction(tx);
    save("pending", { kind, genesis, txHash, submittedAt: new Date().toISOString() });
    console.log(`${kind} submitted ${txHash}`);
    const status = await committed(txHash);
    const receipt = { kind, genesis, txHash, status: status.status, blockHash: status.block_hash,
      feeShannons: fee.toString(), at: new Date().toISOString() };
    save(`${kind}-${txHash}`, receipt);
    console.log(json(receipt));
    return txHash;
  }
  async function metadata() {
    const d = load("deployment") as { genesis: string; vm: Binary; bytecode: Binary };
    if (d.genesis !== genesis) throw new Error("Genesis changed: deploy again.");
    for (const binary of [d.vm, d.bytecode]) {
      const cell = await client.getCellLive(binary.outPoint, true);
      if (!cell || ccc.hashCkb(cell.outputData) !== binary.codeHash) throw new Error("Deployment missing/changed: deploy again.");
      if (binary.hashType !== "data2" || binary.cellDep.depType !== "code" ||
          !ccc.OutPoint.from(binary.cellDep.outPoint).eq(ccc.OutPoint.from(binary.outPoint))) {
        throw new Error("Invalid deployment dependency metadata.");
      }
    }
    return d;
  }
  function lockScript(d: { vm: Binary; bytecode: Binary }) {
    return ccc.Script.from({ codeHash: d.vm.codeHash, hashType: d.vm.hashType,
      args: ccc.hexFrom("0x0000" + d.bytecode.codeHash.slice(2) +
        ccc.hexFrom(ccc.hashTypeToBytes(d.bytecode.hashType)).slice(2) + digest.slice(2)) });
  }
  if (command === "query") {
    const rows = [];
    let plain = 0n;
    for await (const cell of client.findCellsByLock(queryAddress.script)) {
      const plainCell = !cell.cellOutput.type && cell.outputData === "0x";
      if (plainCell) plain += cell.cellOutput.capacity;
      rows.push({ outPoint: cell.outPoint, capacityCkb: ccc.fixedPointToString(cell.cellOutput.capacity),
        type: cell.cellOutput.type ?? null, dataBytes: ccc.bytesFrom(cell.outputData).length, plainCell });
    }
    const total = await client.getBalanceSingle(queryAddress.script);
    const result = { genesis, address: queryAddress.toString(), totalCapacityCkb: ccc.fixedPointToString(total),
      plainCellCapacityCkb: ccc.fixedPointToString(plain),
      note: "Total includes typed/data cells. Plain-cell capacity is only a funding candidate; ownership, maturity and fees still apply.",
      liveCells: rows };
    save("query", result); console.log(json(result)); return;
  }
  if (command === "deploy") {
    const binaries = [readFileSync(DEFAULT_SCRIPT_CKB_JS_VM), readFileSync("packages/on-chain-script/dist/index.bc")];
    if (binaries.some(b => !b.length)) throw new Error("Empty binary: run build first.");
    const tx = ccc.Transaction.from({
      outputs: binaries.map(() => ({ lock: owner.script })), outputsData: binaries.map(ccc.hexFrom),
    });
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, feeRate);
    const txHash = await send(tx, true, "deploy");
    const records = binaries.map((bin, index): Binary => ({
      codeHash: ccc.hashCkb(bin), hashType: "data2", size: bin.length,
      outPoint: { txHash, index }, cellDep: { outPoint: { txHash, index }, depType: "code" },
    }));
    save("deployment", { genesis, rpcUrl: config.rpcUrl, vm: records[0], bytecode: records[1] });
    return;
  }
  const d = await metadata();
  const lock = lockScript(d);
  if (command === "lock") {
    const capacity = ccc.fixedPointFrom(config.lockCapacityCkb);
    const minimum = ccc.fixedPointFrom(ccc.CellOutput.from({ lock }).occupiedSize);
    if (capacity < minimum) throw new Error(`Capacity must be at least ${ccc.fixedPointToString(minimum)} CKB`);
    const tx = ccc.Transaction.from({ outputs: [{ lock, capacity }], outputsData: ["0x"] });
    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, feeRate);
    const txHash = await send(tx, true, "lock");
    const state = { genesis, outPoint: { txHash, index: 0 }, lock, digest, capacityCkb: config.lockCapacityCkb };
    save("locked", state); save(`locked-${txHash}`, state);
    return;
  }
  const state = load("locked");
  if (state.genesis !== genesis) throw new Error("Locked cell belongs to another network.");
  const cell = await client.getCellLive(state.outPoint, true);
  if (!cell) throw new Error("Cell is no longer live. Run lock to create a new cell.");
  if (!cell.cellOutput.lock.eq(lock)) throw new Error("Secret/config/deployment does not match locked cell.");
  const tx = ccc.Transaction.from({
    cellDeps: [d.vm.cellDep, d.bytecode.cellDep],
    inputs: [{ previousOutput: cell.outPoint }],
    outputs: [{ lock: recipient.script, capacity: cell.cellOutput.capacity }],
    outputsData: ["0x"],
    witnesses: [ccc.hexFrom(ccc.WitnessArgs.from({ lock: secret }).toBytes())],
  });
  // This transaction has exactly one input, so its group's first input is index 0.
  // Fully serialized witness is present before calculating the serialized-size fee.
  const fee = tx.estimateFee(feeRate);
  tx.outputs[0].capacity -= fee;
  if (tx.outputs[0].capacity < ccc.fixedPointFrom(tx.outputs[0].occupiedSize)) throw new Error("Insufficient recipient occupied capacity after fee.");
  const txHash = await send(tx, false, "unlock");
  const oldCell = await rpc("get_live_cell", [{ tx_hash: cell.outPoint.txHash, index: ccc.numToHex(cell.outPoint.index) }, false]);
  if (oldCell.status === "live") throw new Error("Unlock committed but old cell is still live.");
  const result = { genesis, txHash, spentOutPoint: cell.outPoint, oldCellStatus: oldCell.status,
    recipientAddress: recipient.toString(), receivedCkb: ccc.fixedPointToString(tx.outputs[0].capacity) };
  save("unlocked", result); console.log(json(result));
}
main().catch(error => {
  // Avoid dumping signer objects or request structures containing account secrets.
  console.error(error instanceof Error ? error.message : "Unexpected error");
  process.exitCode = 1;
});
