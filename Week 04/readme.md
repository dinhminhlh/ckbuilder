# CKB Weekly Report - Week 4

**Reporting Period:** 20 October 2026  
**Publication Date:** 20 October 2026

---

## 1. Week 4 Overview

The goal of Week 4 was to explore CKB smart contract development, understand the on-chain script execution model, and practice deploying and interacting with custom scripts on the Nervos CKB Devnet.

Building on the knowledge gained in Week 3, I started working with the **CCC (Common Chain Connector) SDK** and **ckb-js-vm** to develop a custom lock script. The script validates a secret provided in the transaction witness by comparing its CKB hash with an expected hash embedded in the script arguments.

I also practiced compiling scripts, writing automated tests, querying wallet balances and live cells, and executing deployment, locking, and unlocking transactions on a local CKB Devnet.

**Exercises and features completed in Week 4:**

- Set up a CKB JavaScript on-chain script development environment.
- Explored the project structure and development workflow of `ckb-js-vm`.
- Implemented a custom hash-based lock script.
- Built and compiled the on-chain script into bytecode.
- Wrote and executed automated tests using `ckb-testtool`.
- Queried wallet balances and inspected live cells using the CCC SDK.
- Deployed the script and its required virtual machine binary to the local Devnet.
- Created a locked cell and successfully unlocked it using the correct secret.
- Verified transaction confirmation and recorded transaction metadata.

---

## 2. Exercises Detail

### 2.1. Exercise 01 - CKB Development Environment and CCC SDK

**Objective:** Understand the development architecture and prepare the tools required to build and interact with CKB on-chain scripts.

**Procedure and Results:**

1. **Project Initialization:** Set up a JavaScript-based on-chain script project using `ckb-js-vm` and organized the source code and tests into separate packages.

2. **Dependency Management:** Configured the project using `pnpm` workspaces and installed the required dependencies, including `@ckb-ccc/core`, `@ckb-js-std/core`, and `ckb-testtool`.

3. **Devnet Configuration:** Configured the local CKB Devnet RPC endpoint and used the OffCKB tooling to manage the development node.

4. **Wallet and Cell Inspection:** Used the CCC SDK to query wallet balances and retrieve live cells, including their capacities, output data sizes, and script information.

**Result:** Established a working environment for script development and Devnet interaction. Successfully retrieved wallet and live-cell information from the local network.

### 2.2. Exercise 02 - Custom Lock Script Development

**Objective:** Implement a custom CKB lock script that authorizes transactions by validating a secret stored in the transaction witness.

**Implementation:**

The script was developed in TypeScript and executed on-chain through `ckb-js-vm`.

The main validation logic consists of the following steps:

1. Load the current script arguments and validate their expected length.
2. Read the lock field from the witness associated with the current input group.
3. Calculate the CKB hash of the provided secret.
4. Compare the calculated hash with the expected hash embedded in the script arguments.
5. Return the appropriate exit code depending on the validation result.

The script uses the `HighLevel` APIs from `@ckb-js-std/core` and the bindings provided by `@ckb-js-std/bindings`.

**Validation Results:**

| Exit Code | Condition |
|---|---|
| `0` | The secret matches the expected hash. |
| `10` | The script arguments have an invalid length. |
| `11` | The required witness or lock field is missing or malformed. |
| `12` | The provided secret does not match the expected hash. |

**Result:** Implemented a custom hash-based lock script with explicit validation and error handling.

### 2.3. Exercise 03 - Script Compilation and Automated Testing

**Objective:** Compile the on-chain script and verify its behavior under valid and invalid transaction conditions.

**Tools Used:**

- `ckb-js-vm`
- `ckb-testtool`
- `@ckb-ccc/core`
- `ckb-debugger`
- TypeScript and `pnpm`

**Procedure and Results:**

1. Built the on-chain script and generated the compiled bytecode at `packages/on-chain-script/dist/index.bc`.
2. Created transaction fixtures to simulate CKB inputs, outputs, cell dependencies, and witnesses.
3. Tested valid secrets and incorrect secrets.
4. Tested missing witnesses, missing lock fields, malformed witness data, and invalid script argument lengths.
5. Tested transactions containing multiple inputs to verify that the script reads the witness belonging to the correct input group.
6. Verified that an explicitly provided empty byte sequence is handled as a valid secret when its hash matches the expected value.

**Result:** Implemented automated tests covering successful authorization, invalid inputs, malformed witness data, and input-group-specific witness validation.

### 2.4. Exercise 04 - Deploying the Script to CKB Devnet

**Objective:** Deploy the compiled on-chain script and its required virtual machine binary to the local CKB Devnet.

**Procedure:**

1. Compiled the custom lock script into bytecode.
2. Prepared deployment transactions for the `ckb-js-vm` binary and the compiled script.
3. Constructed transaction inputs, outputs, and capacity requirements using the CCC SDK.
4. Submitted the signed deployment transaction to the local Devnet.
5. Verified the transaction status and saved the deployment metadata, including code hashes, output references, and cell dependencies.

**Deployment Result:**

- Transaction status: `committed`
- Transaction hash:

  `0xf7a2040937d8881c4d35f66a215b68a37187294f5ee1bb6e149da2f7897f1bf5`

The deployment transaction successfully published the required binaries as on-chain cells.

### 2.5. Exercise 05 - Locking and Unlocking CKB

**Objective:** Apply the custom lock script to a CKB cell and verify that the cell can only be unlocked when the correct secret is provided.

**Procedure and Results:**

1. **Create a Locked Cell:** Constructed a lock script using the deployed virtual machine, the custom script code hash, and the hash of the expected secret.
2. **Lock Transaction:** Submitted the transaction that created a cell protected by the custom lock script.
3. **Unlock Transaction:** Provided the correct secret through the transaction witness and submitted a transaction to spend the locked cell.
4. **Transaction Verification:** Confirmed that both the lock and unlock transactions were committed on the Devnet.
5. **Capacity Verification:** Retrieved the resulting transaction information and verified the capacity transferred to the recipient after transaction fees.

**Transaction Results:**

| Operation | Transaction Hash | Status |
|---|---|---|
| Deploy | `0xf7a2040937d8881c4d35f66a215b68a37187294f5ee1bb6e149da2f7897f1bf5` | Committed |
| Lock | `0x529aba7018cecb532389c75dfa8d850b91bb199d9d8e635a88967f7dc300b888` | Committed |
| Unlock | `0x751e6799f2aad5d17ea993c02f8fe341fb1743687c2cb7e9a57e07483c65d373` | Committed |

The unlock operation returned approximately `199.99999655 CKB` to the recipient, with the transaction fee deducted.

**Result:** Successfully completed the deployment, locking, and unlocking lifecycle of a custom CKB lock script on the local Devnet.

---

## 3. Summary and Key Learnings

Week 4 provided practical experience with CKB script development and transaction execution. The exercises helped reinforce the relationship between script arguments, transaction witnesses, cell dependencies, and lock-script validation.

The main takeaways were:

- **CKB Script Architecture:** Learned how custom scripts define the conditions under which cells can be spent.
- **Witness Validation:** Understood how a lock script retrieves and validates witness data associated with its input group.
- **Hash-Based Authorization:** Implemented a secret-verification mechanism using the CKB hashing function.
- **Automated Testing:** Used `ckb-testtool` to simulate transactions and test both successful and unsuccessful validation scenarios.
- **CCC SDK Integration:** Practiced querying live cells, constructing transactions, calculating fees, and submitting transactions.
- **Deployment Workflow:** Learned how to deploy script binaries, register cell dependencies, and track transaction confirmation.
- **Cell Model:** Gained a deeper understanding of how CKB cells, capacities, scripts, and transaction witnesses work together.

The project also demonstrated that script correctness should be verified through both automated tests and actual Devnet transactions.

---

## 4. Plan for Week 5

The next stage will focus on expanding the understanding of CKB smart contracts and application development.

1. Study CKB transaction structures, cell dependencies, script arguments, and witness serialization in greater depth.
2. Explore additional lock-script patterns and understand how transaction validation works across multiple inputs.
3. Learn how to debug script execution and investigate transaction failures using `ckb-debugger` and `ckb-cli`.
4. Explore how the CCC SDK can be integrated into a simple application for interacting with CKB.
5. Improve automated test coverage and document the development and deployment workflow.
6. Continue studying the CKB application ecosystem and identify opportunities to build a small practical application using the Cell Model.

---

## 5. References

- [Nervos CKB Documentation](https://docs.nervos.org/)
- [CCC - Common Chain Connector](https://github.com/ckb-devrel/ccc)
- [ckb-js-vm](https://github.com/nervosnetwork/ckb-js-vm)
- [A Little Book of ckb-js-vm](https://nervosnetwork.github.io/ckb-js-vm/)
- [ckb-testtool](https://github.com/nervosnetwork/ckb-testtool)
- [ckb-debugger](https://github.com/nervosnetwork/ckb-standalone-debugger)
