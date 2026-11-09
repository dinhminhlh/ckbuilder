# CKB Weekly Report - Week 7

**Reporting Period:** 03–09 November 2026  
**Last Updated:** 09 November 2026  
**Status:** In progress — Perun practical work verified; Academy modules 1–3 still require completion evidence.

---

## 1. Week 7 Overview

Week 7 combines completion of the Perun practical exercise with a review of the remaining CKBuilder programme requirements.

Following the revised Week 7–12 roadmap, this week's priorities are to document the Perun results, reconcile the official eight-module Academy checklist, and complete or verify the first three Academy modules. The remaining schedule reserves time for CCC Playground, the Academy interactive tutorial, and the CKB Cell Studio capstone.

The Perun exercise progressed beyond Week 6's local signature fixture to native Rust contract tests and the official two-party Go application on a private CKB Devnet.

**Completed work:**

- Reviewed the programme deliverables and recorded the remaining six-week roadmap.
- Prepared an isolated Ubuntu WSL2 development environment.
- Compiled six deployable Perun RISC-V contract binaries.
- Passed the three top-level upstream Rust tests.
- Deployed and verified the required scripts on Devnet.
- Opened a two-party channel, exchanged payments, and finalized its state.
- Verified settlement independently through CKB RPC.

**Remaining Week 7 work:**

- Confirm the exact names and links of the eight Academy modules.
- Record completion evidence and participant notes for modules 1–3.
- Add participant screenshots and personal learning reflections.

**Work attribution:** Environment preparation, instrumentation, execution, and technical verification were completed with AI coding assistance. The results below describe recorded execution rather than claiming that all course study or participant review has been completed.

---

## 2. Exercises Detail

### 2.1. Exercise 01 - Programme Review and Academy Progress

**Objective:** Align the remaining work with the programme's required learning and final application deliverables.

The review identified existing practical evidence for CKB transfers, Cell data storage, tokens, DOBs, custom lock scripts, CCC integration, and node operation. However, this does not establish completion of all eight Academy modules.

| Week 7 Learning Milestone | Recorded Status |
|---|---|
| Review mandatory deliverables | Completed |
| Record Week 7–12 roadmap and capstone scope | Completed |
| Confirm the official eight-module Academy list | Pending |
| Verify Academy modules 1–3 | Pending completion evidence |
| Record participant reflections and screenshots | Pending |

Module numbers are checklist positions from the programme requirements. Exact module titles have not been substituted with independently chosen topics.

**Result:** The remaining work has a defined schedule, while Academy completion remains explicitly unverified.

### 2.2. Exercise 02 - Perun Development Environment

**Objective:** Prepare the Linux toolchain required by the official Perun CKB example.

| Component | Recorded Version |
|---|---|
| WSL distribution | CKBuilderWeek07, Ubuntu 24.04.5 LTS |
| Go | 1.23.4 |
| Rust / Cargo | 1.85.0 |
| CKB | 0.201.0 |
| ckb-cli | 1.13.0 |
| Clang | 18.1.3 |

A dedicated distribution kept the Devnet accounts, node data, and build caches separate from earlier weeks. Ubuntu and Go downloads were checked against publisher SHA256 values; CKB archive hashes were also recorded.

The official example was pinned to commit:

`6e975e7d2f61a80d1d13b71330a2415086b82242`

**Result:** A compatible environment was available for native contract compilation and the Go application.

### 2.3. Exercise 03 - Contract Compilation and Automated Tests

**Objective:** Build the actual CKB scripts and verify their behavior using upstream Rust tests.

Six deployable binaries were compiled:

- perun-channel-lockscript.
- perun-channel-typescript.
- perun-funds-lockscript.
- perun-vchannel-lockscript.
- perun-vchannel-typescript.
- sample-udt.

| Top-level Test | Result |
|---|---|
| test_signature | Passed |
| channel_test_bench | Passed |
| channel_vc_test_bench | Passed |

**Result:** All three top-level tests passed, with zero failures. The channel benches cover multiple internal scenarios; the reported count follows the test runner's top-level results.

### 2.4. Exercise 04 - Devnet Deployment and Channel Opening

**Objective:** Verify deployed dependencies and establish a two-party Perun channel.

**Procedure and Results:**

1. Initialized the private Devnet and funded Alice and Bob.
2. Deployed the ordinary and virtual-channel script dependencies.
3. Verified six live code Cells against their migration data hashes.
4. Confirmed the deployment transactions were committed.
5. Opened the channel with an initial allocation of 100 CKB per participant.
6. Compared both participants' channel views.

| Item | Recorded Result |
|---|---|
| Chain | ckb_dev |
| Alice wallet capacity before demo | 50,000 CKB |
| Bob wallet capacity before demo | 50,000 CKB |
| Initial channel allocation | 100 CKB / 100 CKB |
| Initial state version | 0 |
| Initial final flag | False |

**Channel ID:**

`0x8531afbca303f5e6b3fcaf62408452ea6023d8ebeed4fbf4f91ff15f297bce77`

The payment allocation totaled 200 CKB. It was distinct from the full on-chain capacity footprint: the channel-state Cell had a capacity of 804 CKB, with additional funding Cells involved.

**Result:** The application established the channel with matching participant views.

### 2.5. Exercise 05 - Payments and State Progression

**Objective:** Exchange payments while conserving the total allocation and tracking state versions.

| Stage | Version | Alice Allocation | Bob Allocation | Final |
|---|---:|---:|---:|---|
| Channel opened | 0 | 100 CKB | 100 CKB | No |
| Alice sends Bob 10 CKB | 1 | 90 CKB | 110 CKB | No |
| Bob sends Alice 5 CKB | 2 | 95 CKB | 105 CKB | No |
| State finalized for settlement | 3 | 95 CKB | 105 CKB | Yes |

Observation hooks recorded the channel ID, version, final flag, and allocations after protocol operations. Both participant views matched at each captured stage, and the allocation total remained 200 CKB.

**Result:** Both payments completed, followed by finalization at version 3.

### 2.6. Exercise 06 - Settlement and Independent Verification

**Objective:** Verify the final result against committed CKB transactions.

The independent audit decoded channel-state data from outputs, matched the channel ID, and checked the committed spending transactions.

**Verified Results:**

- Both recorded channel outputs had committed spending proofs and were no longer live.
- Settlement consumed the channel input.
- The settlement transaction created no successor output for this channel.
- Recipient outputs matched the expected Alice and Bob lock scripts.
- Both participants agreed on the final 95/105 allocation.

| Operation | Transaction Hash | Status | Fee |
|---|---|---|---:|
| First funding step | 0x9e1dcfd2ce735f968ccb2aaa83d8a6c93d4d51e50abb24f65d534e85d44ee4bf | Committed | 1 CKB |
| Second funding step | 0xca14216dd4f2aba2154b30f6540e6bfd7eb7fbe43400bc0cc60429656d4bd50a | Committed | 1 CKB |
| Settlement | 0xf3d937021d52ba528dad247ddb1b1b5243aa952644af39346f995c3cb80d290d | Committed | 1 CKB |

| Wallet | Capacity Before | Capacity After |
|---|---:|---:|
| Alice | 50,000 CKB | 49,993 CKB |
| Bob | 50,000 CKB | 50,004 CKB |

Combined wallet capacity decreased by 3 CKB, matching the recorded fees. The allocation updates transferred a net 5 CKB from Alice to Bob. These are the observed fees of the upstream demonstration, not production fee recommendations.

**Result:** The application exited with code 0, and the settlement was confirmed independently through RPC. Node and miner processes were stopped after verification, with their local data preserved.

The existing Devnet was audited again on 09 November 2026. The audit passed without opening another channel or sending another payment. It also checked the recorded participant-view flags and the 200 CKB total at every captured state. The refreshed RPC audit is recorded in `evidence/10-final-audit.json`.

---

## 3. Summary and Key Learnings

The technical results illustrate:

- **Versioned channel states:** Payments change allocations and advance versions; finalization advances the version without changing the final allocation.
- **Conservation:** Both participants agreed on each captured state, with the allocation total fixed at 200 CKB.
- **On-chain verification:** Application completion was checked against committed spending transactions and recipient outputs.
- **Capacity accounting:** Wallet capacity, payment allocation, and channel storage capacity represent different quantities.
- **Programme tracking:** Practical code evidence and Academy course-completion evidence must be tracked separately.

The Perun work used a private Devnet. No separate public Testnet Perun channel, interactive dispute application, cross-chain payment, or Fiber multi-hop payment was demonstrated. Academy modules 1–3 are not reported as completed without the corresponding study records.

---

## 4. Plan for Week 8

In line with the revised six-week roadmap:

1. Resolve any remaining Week 7 Academy checklist gaps and progress through the next planned group, modules 4–6, using the confirmed official module list.
2. Audit the CCC Playground examples already completed and add missing programme evidence.
3. Define the CKB Cell Studio capstone around wallet connection and creating, reading, updating, and deleting public note Cells.
4. Prepare the application's user flow and acceptance criteria for discussion with Neon.
5. Prioritize Academy, the tutorial, and capstone milestones over additional dispute or multi-hop experiments.

The schedule targets completion of Academy and its interactive tutorial by the end of Week 9, followed by capstone implementation, testing, and handover by the end of Week 12.

---

## 5. References

- [CKB Academy](https://academy.ckb.dev/courses).
- [Pinned official Perun CKB example](https://github.com/perun-network/perun-examples/tree/6e975e7d2f61a80d1d13b71330a2415086b82242/payment-channel-ckb).
- [Contracts bundled with the example](https://github.com/perun-network/perun-examples/tree/6e975e7d2f61a80d1d13b71330a2415086b82242/payment-channel-ckb/devnet/contracts).
- [Perun CKB backend](https://github.com/perun-network/perun-ckb-backend).
- [Nervos CKB documentation](https://docs.nervos.org/).
- [Programme completion roadmap](../README.md).

---

## 6. Evidence

The recorded technical evidence is available in the following files:

| Evidence | Recorded Content |
|---|---|
| [Environment](evidence/01-environment.json) | Distribution, source commit, tool versions, and archive hashes |
| [Contract build](evidence/02-contract-build.json) | Binary sizes, checksums, and successful compilation |
| [Rust tests](evidence/03-contract-tests.json) | Three passing top-level tests |
| [Devnet deployment](evidence/04-devnet-deployment.json) | Genesis, live scripts, committed deployment, and initial balances |
| [Channel opened](evidence/05-channel-open.json) | Version 0 and allocation 100/100 |
| [Alice pays Bob](evidence/06-alice-pays-bob.json) | Version 1 and allocation 90/110 |
| [Bob pays Alice](evidence/07-bob-pays-alice.json) | Version 2 and allocation 95/105 |
| [Final state](evidence/08-channel-settled.json) | Version 3, final flag, and allocation 95/105 |
| [Application execution](evidence/09-demo-execution.json) | Execution timestamps and exit code 0 |
| [Independent audit](evidence/10-final-audit.json) | Committed settlement, spent proofs, fees, and recipient verification |

Participant screenshots and Academy study evidence have not yet been attached to this report.

Submission review on 09 November: the Perun practical milestone is verified, but Week 7 remains incomplete against the roadmap until the official eight-module list, study records for modules 1–3, and participant reflections/screenshots are supplied. The Academy courses URL returned no readable course list during this review; no module titles or completion records have been inferred.
