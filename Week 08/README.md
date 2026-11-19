# CKB Weekly Report — Week 8

**Reporting period:** 10–16 November 2026  
**Last updated:** 19 November 2026  
**Status:** In progress. Catalogue reconciliation and capstone proposal prepared; participant study and remaining Playground execution evidence pending.

## 1. Objectives and recorded results

| Roadmap objective | Recorded result | Remaining work |
|---|---|---|
| Academy positions 4–6 | Recovered eight-entry catalogue from pinned source; prepared source-linked review notes | Confirm programme numbering; participant study records and evidence |
| Audit CCC Playground | Inventoried all 13 Playground-tagged examples in pinned upstream gallery; mapped five related earlier screenshots | Execute uncovered required examples; verify actual broadcast for transfers |
| Prepare capstone proposal | Defined CKB Cell Studio scope, data format, flows, acceptance criteria and Week 9–12 milestones | Participant discusses proposal with Neon; approval not yet recorded |

Work was prepared with AI coding assistance. No personal study completion, wallet signing, or Neon approval is claimed. The schedule follows the agreed six-week roadmap and the Week 7 report.

## 2. Academy review

[Academy review](ACADEMY.md) lists all eight source-catalogue entries and the planned Week 8 group. The public repository exports three local courses followed by five community courses. Source order provides a concrete provisional mapping; programme-specific numbering still needs confirmation.

The original Cryptape transaction article was accessible. The L1 GitBook and workshop video were not retrievable through the review tool. Notes distinguish inspected source material, preparation questions, and unverified participant progress. Week 7 study evidence remains outstanding; Week 8 preparation does not close that gap.

## 3. CCC evidence audit and practical supplement

[CCC inventory](evidence/02-ccc-inventory.json) records example links, source commit, paths and SHA256 checksums for earlier related screenshots. The 13 examples are the current pinned gallery scope, not an assertion that the programme requires every newly added example.

Earlier screenshots cover related transfer, signing, balance, cells and transaction queries. The transactions screenshot belongs to the Week 2 frontend, so it is not Playground execution evidence. Inspection of `Week_02/CCC model/02_Transaction_Successfull.png` shows transaction construction/rendering; its filename alone does not establish broadcast or commitment.

Missing mapped Playground evidence: Transfer All CKB; Transfer UDT Token; the two Custom UI examples; NervosDAO Deposit & Withdraw; Create Spore DOB; Transfer Spore DOB; DOB Cookbook — Colorful Loot. Other-week token/DOB reports are related practice and are not silently counted as these exact examples.

The runnable CCC query supplement uses the public Testnet example address and no wallet keys. It queries balance, up to ten live Cells, and up to ten transaction records. It records block tips around execution and states the limits of separate RPC reads. This adds reproducible SDK evidence for capstone read flows; it does not claim Playground UI completion or ownership of the queried address. A zero balance or empty result is a valid query result, not evidence of a payment.

## 4. Capstone proposal

[CKB Cell Studio proposal](CAPSTONE.md) defines wallet connection and public note CRUD on Testnet, a versioned UTF-8 Cell format, integer capacity accounting, safe input selection, transaction status handling, error cases and observable acceptance criteria. Week 8 delivers the proposal; application implementation begins in Week 9.

## 5. Verification and evidence

| File | What it proves |
|---|---|
| [Academy catalogue](evidence/01-academy-catalogue.json) | Eight entries and source ordering retrieved from a pinned repository |
| [CCC inventory](evidence/02-ccc-inventory.json) | Gallery scope and existence/checksums of mapped prior screenshots |
| [Live queries](evidence/03-live-queries.json) | Successful read-only public Testnet query results with timestamp and limits |
| [Academy catalogue screenshot](evidence/04-academy-catalogue.png) | All eight catalogue entries; personal study remains unverified |
| [CCC inventory screenshot](evidence/05-ccc-inventory.png) | Thirteen examples and the existence of mapped earlier evidence; not completion of all examples |
| [Query summary screenshot](evidence/06-query-summary.png) | Recorded timestamp, Node version, Testnet RPC, address, tips and balance |
| [Query details screenshot](evidence/07-query-details.png) | Sample counts, three Cell OutPoints and three transaction records |

On 10 November the query command completed with exit code 0: ten live Cells and ten transaction records were returned, with Testnet tip 23,019,483 at both ends of the capture. The source inventory also completed successfully with eight Academy entries and thirteen Playground examples. The local Node version was 20.18.1 and emitted dependency engine warnings during installation; use the documented supported version for reproduction.

Review on 19 November: the pinned source inventory was regenerated successfully (eight Academy entries, thirteen Playground examples), all five mapped screenshot checksums matched, and the live query command again exited with code 0, returning ten Cells and ten transaction records at tip 23,115,270. The current JSON files contain this later verification, not a backdated Week 8 execution. The evidence display now includes sample OutPoints and transaction hashes. Participant Academy records, new Playground screenshots, and the Neon discussion record remain absent; the report remains in progress.

Four participant-supplied screenshots of the recorded results are now attached above. They match the JSON records, including the captured timestamps and query tip. A garbled dash in the terminal heading is cosmetic; the display script now uses an ASCII dash. These screenshots document the catalogue, inventory and SDK queries, rather than participant Academy study or new Playground execution.

Reproduce the source inventory from repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "Week 08/scripts/catalogue.ps1"
```

Reproduce SDK queries with Node.js 20.19 or newer (required by the resolved cryptography dependencies):

```powershell
cd "Week 08"
npm ci --ignore-scripts
npm run verify:queries
# Optional: query a different public Testnet address
npm run verify:queries -- YOUR_CKT_ADDRESS
```

Network failures must be reported as failures, not converted into successful evidence. Dependencies, caches and private runtime data are excluded from the submission.

## 6. Next milestone

Complete participant Academy 4–6 records, resolve outstanding Week 7 study records, and add required Playground execution evidence. Discuss the capstone scope with Neon. Week 9 then targets Academy 7–8, interactive tutorial, and a working wallet/create/read MVP.

## References

- [Pinned Academy catalogue](https://github.com/Flouse/ckb-academy/tree/370f31f5dc432c5a4b07c81a7731e292235bc420/site/src/content/courses).
- [Pinned CCC gallery](https://github.com/ckb-devrel/ccc/blob/9ffef01a181751dacf1edde83ed43fcfb4646ded/packages/docs/content/docs/code-examples.mdx).
- [CCC Playground](https://live.ckbccc.com/).
- [Cryptape transaction tutorial](https://blog.cryptape.com/construct-and-send-your-first-ckb-transaction).
