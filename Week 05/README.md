# CKB Weekly Report - Week 5

**Reporting Period:** 27 October 2026  
**Publication Date:** 29 October 2026

---

## 1. Week 5 Overview

The goal of Week 5 was to build a practical decentralized application (dApp) on Nervos CKB by integrating the custom hash-lock script developed in Week 4 with a web interface and the CCC (Common Chain Connector) SDK.

During this week, I developed a React and TypeScript application that allows users to create hash-locked cells, query existing cells, review transactions, and unlock cells by providing the correct secret. The application interacts with a local CKB Devnet through the CCC SDK and verifies transaction results directly against the chain.

The project combines on-chain script execution with off-chain transaction construction, wallet signing, submission, and verification. It also introduces safeguards for local network configuration, transaction confirmation, cell status validation, and secret handling.

**Exercises and features completed in Week 5:**

- Developed a React and TypeScript interface for a CKB hash-lock dApp.
- Integrated the CCC SDK for wallet and blockchain interactions.
- Implemented hash-locked cell creation with configurable capacity and secret.
- Implemented on-chain cell discovery using a secret hash or transaction OutPoint.
- Added transaction review and validation before broadcasting.
- Implemented hash-lock cell unlocking and recipient address selection.
- Verified transaction confirmation, spent-cell status, and recipient outputs.
- Added automated contract tests and utility tests.
- Tested standard and mixed-input transaction flows on the local Devnet.
- Implemented safeguards for network validation, stale cells, transaction fees, and sensitive data.

---

## 2. Exercises Detail

### 2.1. Exercise 01 - CKB dApp Architecture and CCC SDK Integration

**Objective:** Build a web application that interacts with the CKB blockchain and connects the existing hash-lock script to a user-friendly interface.

**Technologies Used:**

- React 19
- TypeScript 5.8
- Vite 6.3
- CCC SDK (`@ckb-ccc/core` 1.23.0)
- OffCKB 0.4.13
- CKB Devnet

**Implementation:**

1. **Application Structure:** Organized the project into UI components, blockchain utilities, transaction builders, configuration management, and automated tests.

2. **Blockchain Client:** Integrated the CCC SDK to connect to the local Devnet, retrieve account addresses, query balances, and access live cells.

3. **Account Management:** Implemented two public, disposable demo accounts for testing cell creation and transfers between addresses.

4. **Network Verification:** Added checks for the local RPC endpoint, chain identifier, genesis block hash, and deployed script dependencies before preparing transactions.

5. **Balance Monitoring:** Displayed spendable, total, and occupied capacity to help users understand the capacity available for transactions.

**Result:** Established a working application architecture connecting a React frontend to CKB blockchain operations through the CCC SDK.

### 2.2. Exercise 02 - Hash-lock Cell Creation

**Objective:** Allow users to create a CKB cell protected by the custom hash-lock script developed in Week 4.

**Implementation:**

1. Accepted a secret as UTF-8 input and calculated its CKB hash.
2. Constructed the hash-lock script arguments using the required virtual machine configuration, bytecode hash, hash type, and expected secret hash.
3. Calculated the minimum occupied capacity required by the resulting lock script.
4. Built a transaction that transfers the specified capacity into a newly locked cell.
5. Selected eligible plain cells from the active demo account to fund the transaction.
6. Estimated transaction fees and change before presenting the transaction for review.
7. Validated the funding inputs again before broadcasting the signed transaction.

**Technical Details:**

The custom hash-lock uses 67 bytes of script arguments:

| Component | Size |
|---|---:|
| Loader flags | 2 bytes |
| Script bytecode hash | 32 bytes |
| Hash type | 1 byte |
| Expected secret hash | 32 bytes |
| Total | 67 bytes |

For an empty-data, untyped cell protected by this lock, the required occupied capacity is **108 CKB**.

**Result:** Implemented the transaction preparation workflow for creating hash-locked cells, including capacity checks, funding selection, fee estimation, and input validation.

### 2.3. Exercise 03 - Querying Hash-lock Cells

**Objective:** Discover existing hash-locked cells and determine whether they are available to spend.

**Features Implemented:**

1. **Query by Secret Hash:** Search the local Devnet for cells associated with a specified expected secret hash.

2. **Query by OutPoint:** Retrieve a specific output using its transaction hash and output index.

3. **Cell Information:** Display the cell capacity, expected secret hash, full OutPoint, and current status.

4. **Live-cell Verification:** Check the chain before allowing a cell to be selected for unlocking.

5. **Spent-cell Handling:** Distinguish live cells from historical outputs and avoid treating an unknown RPC response as definitive proof that a cell has been spent.

**Result:** Implemented cell discovery and status verification using on-chain data rather than relying solely on local application history.

### 2.4. Exercise 04 - Unlocking Cells and Transferring Capacity

**Objective:** Spend a hash-locked cell by providing the correct secret and transfer its capacity to a selected recipient.

**Procedure and Results:**

1. Selected a live hash-locked cell from the query results.
2. Entered the secret and calculated its CKB hash.
3. Compared the calculated hash with the expected hash stored in the lock script arguments.
4. Rejected incorrect secrets before transaction submission.
5. Constructed an unlocking transaction with the required cell dependencies and witness data.
6. Calculated the transaction fee and deducted it from the recipient's output capacity.
7. Broadcast the transaction and monitored its confirmation status.
8. Verified the committed transaction, the consumed input, and the recipient output.

The application supports two predefined demo accounts and a custom address on the configured network.

**Result:** Implemented the complete hash-lock spending workflow, from secret validation and transaction construction to broadcasting and verification.

### 2.5. Exercise 05 - Transaction Verification and Error Handling

**Objective:** Improve transaction reliability by validating network configuration, transaction inputs, confirmation status, and final outputs.

**Implementation:**

- **Network Safety:** Restricted demo signing to an explicitly configured local HTTP loopback RPC endpoint and the expected CKB Devnet.
- **Deployment Verification:** Checked the deployed VM and script dependencies against their expected hashes.
- **Stale Input Protection:** Revalidated transaction inputs before broadcasting to reduce failures caused by cells that had already been spent.
- **Fee and Capacity Validation:** Checked available funding, occupied capacity, change, and recipient capacity after fees.
- **Confirmation Tracking:** Distinguished committed, rejected, failed, pending, and unknown-confirmation states.
- **Receipt Verification:** Compared the committed recipient output against the reviewed transaction.
- **Sensitive Data Handling:** Avoided storing secrets in local storage, URLs, transaction logs, or evidence files. Only transaction hashes and status information were persisted for recovery and rechecking.

The application also prevents a new transaction from being submitted while a previous transaction remains unresolved.

**Result:** Added safeguards to improve the reliability of transaction execution and make transaction status reporting more accurate.

### 2.6. Exercise 06 - Automated Testing and Devnet Integration

**Objective:** Verify the contract and application logic through automated tests and actual local Devnet transactions.

**Tools Used:**

- `ckb-testtool`
- `ckb-debugger`
- CCC SDK
- TypeScript test runner
- Vite build tooling

**Testing Results:**

| Test Category | Result |
|---|---|
| Hash-lock contract tests | 12/12 passed |
| Utility and transaction logic tests | 6/6 passed |
| Native debugger fixtures | Correct and incorrect secret cases verified |
| Standard transaction flow | Lock and unlock committed and verified |
| Mixed-input transaction flow | Lock and unlock committed and verified |
| Incorrect secret handling | Rejected |
| Stale-cell handling | Rejected |
| Recipient output verification | Passed |
| Production build | Passed |

The contract tests covered correct and incorrect secrets, missing witnesses, missing lock fields, malformed witness data, invalid script arguments, and witness selection for the appropriate input group.

The utility tests covered CKB amount parsing, hash calculation, script argument construction, occupied capacity, witness preservation, local RPC restrictions, OutPoint validation, and transaction confirmation handling.

The integration tests exercised both a standard unlocking transaction and a mixed-input transaction containing a separate signed funding input. Both flows verified the committed recipient output and balance changes using a fresh client.

**Result:** All 18 contract and utility tests passed, and both tested Devnet transaction flows completed their verification steps successfully.

---

## 3. Summary and Key Learnings

Week 5 focused on turning the custom hash-lock script from Week 4 into a functional blockchain application.

The main takeaways were:

- **dApp Architecture:** Learned how to connect a React and TypeScript frontend with the CKB blockchain through the CCC SDK.
- **Transaction Construction:** Practiced building transactions, selecting eligible cells, calculating fees, and reviewing outputs before submission.
- **Cell Discovery:** Learned to query cells using script information, expected hashes, and transaction OutPoints.
- **Script Integration:** Applied the existing hash-lock contract to create and spend cells through a web interface.
- **Transaction Verification:** Verified committed transactions, consumed inputs, recipient outputs, and balance changes.
- **Testing and Debugging:** Combined automated contract tests, utility tests, debugger fixtures, and Devnet integration tests.
- **Application Safety:** Improved handling of secrets, stale cells, unresolved transactions, network configuration, and transaction errors.

This week demonstrated how CKB's Cell Model and programmable lock scripts can be integrated into a practical application with an end-to-end transaction workflow.

---

## 4. Plan for Week 6

The next stage will focus on expanding the application and exploring additional CKB development concepts.

1. Study CKB transaction structure, cell dependencies, script groups, and witness serialization in greater depth.
2. Explore additional script patterns and improve understanding of transaction validation.
3. Extend the application with more comprehensive transaction history and cell status tracking.
4. Improve error reporting, automated integration tests, and recovery from interrupted transactions.
5. Explore additional CCC SDK capabilities for building CKB applications.
6. Investigate how the current hash-lock dApp can be extended into a more complete application demonstrating CKB's Cell Model.

---

## 5. References

- [Nervos CKB Documentation](https://docs.nervos.org/)
- [CCC - Common Chain Connector](https://github.com/ckb-devrel/ccc)
- [ckb-js-vm](https://github.com/nervosnetwork/ckb-js-vm)
- [A Little Book of ckb-js-vm](https://nervosnetwork.github.io/ckb-js-vm/)
- [ckb-testtool](https://github.com/nervosnetwork/ckb-testtool)
- [CKB Standalone Debugger](https://github.com/nervosnetwork/ckb-standalone-debugger)
