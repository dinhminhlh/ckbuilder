# CKB Weekly Report - Week 1

**Reporting period:** 11 September 2026  
**Publication date:** 11 September 2026  

---

## 📖 1. Week 1 Overview

The goal of Week 1 was to establish a local development workflow, understand basic CKB concepts, and complete the introductory dApp exercises. By interacting directly with the Nervos dApp examples, I gained hands-on experience with the CKB Cell Model, basic transactions, data storage, and custom token issuance.

**Completed Exercises for Week 1:**
- [x] Transfer CKB (Simple Transfer)
- [x] Store Data on Cell
- [x] Create Fungible Token (xUDT)

---

## 🚀 2. Exercises Detail

### Exercise 01 - Transfer CKB

**Objective:** To learn how to transfer CKB between accounts on a local CKB Devnet using a frontend dApp.

**Procedure & Results:**
*   Cloned the `docs.nervos.org.git` repository and navigated to the `examples/dApp/simple-transfer` directory[cite: 10].
*   Installed dependencies and started the local server using `npm install && NETWORK=devnet npm start`[cite: 10].
*   Accessed the "View and Transfer Balance" dApp interface, which showed an initial total capacity of 42,000,000 CKB[cite: 9].
*   Successfully submitted a transfer of 62 CKB to a recipient address on the Devnet[cite: 8].

### Exercise 02 - Store Data on Cell

**Objective:** To understand how arbitrary application data can be written to and read back from a CKB cell.

**Procedure & Results:**
*   Initialized the `store-data-on-cell` application and synchronized the Devnet system scripts with OffCKB[cite: 7].
*   Loaded the dApp, displaying a starting capacity of 41,999,937 CKB[cite: 6].
*   Wrote the message "hello common knowledge base!" into a cell[cite: 5].
*   Successfully read the message back from the blockchain, confirming the data was properly stored on-chain[cite: 5].

### Exercise 03 - Create Fungible Token (xUDT)

**Objective:** To issue a custom fungible token (xUDT) on the Devnet, query its status, and perform a token transfer.

**Procedure & Results:**
*   Started the `xudt` dApp example locally via the terminal[cite: 4].
*   **Step 1:** Issued a custom token with a total amount of 42[cite: 3].
*   **Step 2:** Queried the newly issued token using its unique xUDT args, verifying that Cell #0 hosted the 42 tokens[cite: 2].
*   **Step 3:** Successfully transferred 21 custom tokens to a designated receiver address[cite: 1].

---

## 🧠 3. Final Reflection & Next Steps

Week 1 provided a solid foundation in interacting with the CKB blockchain. By running the official dApp examples locally, I practically observed how transactions consume and create cells, how transaction fees are applied, and how data and custom tokens are managed within the Cell Model.

### Goals for Week 2:
1. Complete the remaining foundational exercises, specifically creating Digital Objects (DOBs) and building custom lock scripts.
2. Dive deeper into the Common Chain Connector (CCC) to understand how to build custom application flows from scratch.
3. Begin exploring CKB Script development to understand the underlying logic that secures cells and validates transactions.