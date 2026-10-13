# CKB Weekly Report - Week 3

**Reporting period:** 13 October 2026  
**Publication date:** 13 October 2026  

---

## 1. Week 3 Overview

The goal of Week 3 was to dive deeper into learning and practicing with two important asset standards on Nervos CKB: **xUDT** (Extensible User-Defined Token) and **Spore Protocol** (Digital Objects / DOB).

By directly running wallet applications and supporting tools on the CKB Devnet, I successfully tested the complete lifecycle of Fungible Tokens (xUDT) and Non-Fungible Digital Objects (Spore) from creation, balance checking, and transferring, to melting assets.

**Exercises & features completed in Week 3:**
- Managed & checked CKB and xUDT wallet balances (Check Balance)
- Transferred xUDT tokens to a specified address (Transfer xUDT)
- Created & embedded Digital Object data (Create Spore / DOB)
- Queried information & transferred Spores on-chain (Query & Transfer Spore)
- Burned/reclaimed Spore storage capacity (Melt Spore)

---

## 2. Exercises Detail

### 2.1. Exercise 01 - xUDT (Extensible User-Defined Token)

**Objective:** Practice interacting with fungible tokens according to the xUDT standard on the CKB Devnet environment.

**Procedure & Results:**
1. **Wallet & Balance Check (Check Balance):** Initialized test accounts and accurately queried the capacity (CKB) as well as xUDT balances stored on Live Cells.
2. **Transfer xUDT:** Executed an xUDT token transfer transaction to the recipient address. The transaction was confirmed and successfully committed on the Devnet with full Cell Inputs/Outputs information.

---

### 2.2. Exercise 02 - Spore Protocol (Digital Objects / DOB)

**Objective:** Create, interact with, and manage Digital Objects (DOB/Spore) storing data directly on-chain within the Cell Model platform.

**Procedure & Results:**
1. **Create & Initialize Spore:** Embedded file content into Cell Data and issued a new Spore. The initialization transaction returned a successful `Committed` status.
2. **Query & Transfer Spore:** Verified the on-chain storage content of the Spore Cell via its ID, then executed a transaction to transfer ownership of the Spore to another wallet address.
3. **Melt Spore:** Performed the Spore cell destruction operation to free up data and reclaim the initial CKBytes (Capacity) back to the user's wallet.

---

## 3. Summary & Next Week's Direction

In Week 3, direct interaction with xUDT and Spore Protocol helped reinforce clear concepts regarding **Type Scripts** and how CKB manages asset states directly within **Cell Data**.

### Plan for Week 4:
1. Learn the CKB application development architecture using the **CCC (Common Chain Connector)** SDK.
2. Begin approaching **CKB Smart Contract (Script Development)** programming using the **Rust** language.
3. Practice using supporting tools such as `ckb-debugger` and `ckb-cli` to test scripts.