import { hexFrom, hashCkb, hashTypeToBytes, Transaction, WitnessArgs } from "@ckb-ccc/core";
import { readFileSync } from "node:fs";
import { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS, DEFAULT_SCRIPT_CKB_JS_VM } from "ckb-testtool";
const secret = hexFrom(Buffer.from("Week04 demo secret", "utf8"));
const witness = (lock: `0x${string}`) => hexFrom(WitnessArgs.from({ lock }).toBytes());
function fixture(args = hashCkb(secret), witnesses: `0x${string}`[] = [witness(secret)], shifted = false) {
  const r = Resource.default();
  const deploy = (data: Buffer) => r.mockCell(r.createScriptUnused(), undefined, hexFrom(data));
  const vm = deploy(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM));
  const code = deploy(readFileSync("../on-chain-script/dist/index.bc"));
  const always = deploy(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS));
  const js = r.createScriptByData(code, "0x");
  const lock = r.createScriptByData(vm, hexFrom("0x0000" + js.codeHash.slice(2) + hexFrom(hashTypeToBytes(js.hashType)).slice(2) + args.slice(2)));
  const other = r.createScriptByData(always, "0x");
  const cells = shifted ? [r.mockCell(other), r.mockCell(lock)] : [r.mockCell(lock)];
  const tx = Transaction.from({cellDeps: [vm, code, always].map(c => Resource.createCellDep(c, "code")), inputs: cells.map(c => Resource.createCellInput(c)), outputs: [Resource.createCellOutput(other)], outputsData: ["0x"], witnesses});
  const v = Verifier.from(r, tx); v.debugger = require("../../../scripts/paths.cjs").debuggerPath(); return v;
}
jest.setTimeout(120_000);
test("correct UTF-8 secret", async () => { await fixture().verifySuccess(true); });
test("wrong secret -> 12", async () => { await fixture(undefined, [witness("0xdead")]).verifyFailure(12); });
test("missing witness -> 11", async () => { await fixture(undefined, []).verifyFailure(11); });
test("missing lock field -> 11", async () => { await fixture(undefined, [hexFrom(WitnessArgs.from({}).toBytes())]).verifyFailure(11); });
test("malformed Molecule witness -> 11", async () => { await fixture(undefined, ["0x01"]).verifyFailure(11); });
test.each(["0x", "0x01", "0x" + "00".repeat(31), "0x" + "00".repeat(33)])("invalid args %s -> 10", async (args) => { await fixture(args as `0x${string}`).verifyFailure(10); });
test("hash-lock at input 1 reads its group witness", async () => { await fixture(undefined, [witness("0xdead"), witness(secret)], true).verifySuccess(true); });
test("input 0 correct cannot authorize input 1 wrong -> 12", async () => { await fixture(undefined, [witness(secret), witness("0xdead")], true).verifyFailure(12); });
test("empty byte secret is valid when explicitly present", async () => { await fixture(hashCkb("0x"), [witness("0x")]).verifySuccess(); });


