---
title: Financial Reconciliation Scenario Evidence Classification
date: 2026-11-09
status: Classification complete - financial verification incomplete
---

## Goal

Classify all 38 owner-approved scenarios without changing their definitions or conducting database work. The authoritative amounts and complete expectations are in the [scenario matrix](./financial-reconciliation-scenario-matrix.md); the existing overall status is in the [campaign outcomes](./receipt-policy-runtime-campaign-2026-11-08.md#scenario-outcomes).

## Acceptance Criteria

- [x] Account for each scenario once, distinguish source, offline assertions and historical/current runtime evidence, and reconcile primary blocked reasons.
- [x] Preserve existing scenario statuses and identify missing or ambiguous evidence without treating a timeout as an assertion failure.
- [x] Identify the minimum verification work and authorization boundary.

## Out of Scope

Database connections, runtime execution, implementation changes, policy changes, migrations, production operations, recovery and independent acceptance.

## Reading the evidence

The current matrix reports **3 PASS / 0 FAIL / 35 BLOCKED**. PASS is scoped to the recorded synthetic-session/restricted-role checks, not genuine Supabase Auth or independent acceptance. BLOCKED is not synonymous with a failed test or missing implementation. No status is changed in this report.

Evidence keys used in each row:

- **A**: [payment actions](../../../src/app/_actions/sales.actions.ts); **V**: [payment schemas](../../../src/lib/validation/sales.schemas.ts); **P**: [payment repository](../../../src/repositories/payment.repository.ts).
- **R**: [reconciliation service](../../../src/domain/services/financial-reconciliation.service.ts), especially `allocatePayment`, `reverseAllocation`, `requestRefund`, `completeRefund` and `reversePayment`; **RA**: [reconciliation actions](../../../src/app/_actions/reconciliation.actions.ts). `allocatePayment` operates on one invoice inside its own serializable transaction; independent calls do not establish atomic multi-invoice allocation.
- **L**: [ledger repository](../../../src/repositories/ledger.repository.ts); its due-date aging helper is not a knowledge-as-of/restatement report.
- **H**: [runtime harness](../../../scripts/financial-reconciliation-runtime-harness.cjs), including actual before/after, audit and replay assertions. Its `blockedScenarios` text includes superseded policy descriptions and is not authoritative for approved expectations.
- **F**: [foundation contracts](../../../tests/financial-reconciliation-foundation-contract.test.mjs); **C**: [customer advance contracts](../../../tests/customer-advances-contract.test.mjs); **U**: [supplier advance contracts](../../../tests/supplier-advances-contract.test.mjs); **Q**: [receipt sequencing contracts](../../../tests/payment-receipt-sequencing-contract.test.mjs); **D**: [receipt provisioning and approved-row contracts](../../../tests/financial-reconciliation-receipt-provisioning.test.mjs). These are predominantly source-text/SQL/policy assertions; they do not execute the full financial invariant. In particular, D checks fragments of the approved matrix, not implementation.
- **E/M**: current-source [generated-baseline suite](./empty16673f97e5e9-suite.json) and [migration-replay suite](./replaycab6b49cae03-suite.json). Both recorded PASS for S-01, S-04 and S-28. Their [E](./empty16673f97e5e9-campaign.json) and [M](./replaycab6b49cae03-campaign.json) recorded source hashes match the current files listed in those artifacts. That does not assert a complete hash inventory for all possible dependencies.
- **B**: [historical full suite](./replay5d1b46962e3d-suite.json); **T**: [historical S-16 suite](./replay90e2ad24bdf3-suite.json); **O**: [older S-08 suite](./replay0a68a1e4655e-suite.json). Their corresponding [B](./replay5d1b46962e3d-campaign.json), [T](./replay90e2ad24bdf3-campaign.json), and [O](./replay0a68a1e4655e-campaign.json) campaign hashes differ for current Prisma schema, reconciliation service and harness. The results are real historical evidence, not proof for the current source; hash mismatch alone does not demonstrate a behavioral regression or identify which change matters.

**Offline result notation:** `28/28 P` means the present classification ran the five F/C/U/Q/D test files together using `node --test` and all 28 tests passed, with zero skipped. A row referencing a subset means the relevant subset of that run passed, not that 28 tests individually exercised that row. `Partial` describes the assertions, not a financial pass. `Not covered` means no inspected offline assertion establishes the scenario-specific behavior, even if D checks the policy text. The prior [final campaign](./receipt-policy-runtime-campaign-2026-11-08.md#final-contract-verification-across-both-provisioning-modes--2026-11-09) separately records 367/367 JavaScript tests; the exact per-scenario behavioral mapping cannot be inferred from that aggregate.

**Runtime notation:** `Not run` means no exact current-source scenario result was found, not that related primitives were never exercised. B, T and O results use synthetic fixtures and a restricted application role; they do not establish genuine Auth. `Historical PASS` below is the assertion-level result at the time, not an endorsement of current-source applicability.

## Scenario evidence table

| Scenario | Implementation | Offline coverage | Latest offline result | Current-source runtime | Historical runtime | Block reason | Evidence references |
|---|---|---|---|---|---|---|---|
| S-01 customer advance | Implemented: payment and ledger action | Q, C partial source checks | 28/28 P | E/M PASS | Earlier passes | — | A, P, H, E, M |
| S-02 allocate ₹500 | Implemented: one-payment allocation | F/C partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, RA, P, H, B |
| S-03 allocate ₹300 | Implemented: partial allocation | F/C partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, RA, P, H, B |
| S-04 supplier advance | Implemented: payment and ledger action | Q/U partial | 28/28 P | E/M PASS | Earlier passes | — | A, P, H, E, M |
| S-05 supplier partial allocation | Implemented: allocation | F/U partial | 28/28 P | No assertion result; full runner timed out | B PASS; source changed | STALE_RUNTIME_EVIDENCE; timeout secondary | R, P, H, B, M |
| S-06 supplier remaining allocation | Implemented: allocation and limit guard | F/U partial | 28/28 P | No assertion result; full runner timed out | B PASS; source changed | STALE_RUNTIME_EVIDENCE; timeout secondary | R, P, H, B, M |
| S-07 customer partial settlement | Implemented primitive; exact operation not verified | F/C/D partial | 28/28 P | Not run | B BLOCKED | RUNTIME_NOT_RUN | R, RA, P, F, D, B |
| S-08 two payments, one invoice | Implemented: separate allocation calls | F/C/D partial | 28/28 P | Not run | O PASS with two separate allocations/replays; B BLOCKED | STALE_RUNTIME_EVIDENCE | R, P, H, O, B |
| S-09 one payment, two invoices atomically | Partial: single-invoice allocation exists; combined atomic operation not established | F/C/D partial; no atomic-batch assertion | 28/28 P | Not run | B BLOCKED | IMPLEMENTATION_MISSING | R, RA, F, D, B |
| S-10 two allocations from one payment | Implemented primitive and limit guard; exact sequence unverified | F/C/D partial | 28/28 P | Not run | B BLOCKED | RUNTIME_NOT_RUN | R, P, F, D, B |
| S-11 refund unapplied customer credit | Implemented refund lifecycle | F/C partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, RA, H, F, B |
| S-12 partial allocated refund | Implemented partial reversal and refund | F partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, H, F, B |
| S-13 full allocated refund | Implemented refund and limit guard | F partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, H, F, B |
| S-14 allocation reversal | Implemented reversal | F partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, H, F, B |
| S-15 whole payment reversal | Implemented reversal and ledger posting | F partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, H, F, B |
| S-16 refund ledger failure rollback | Implemented transactional refund; failure-path result depends on DB | F partial; no executed failure injection offline | 28/28 P | Not run | T PASS with injected failure and safe retry; source changed | STALE_RUNTIME_EVIDENCE | R, H, F, T |
| S-17 refund replay | Implemented refund idempotency | F partial | 28/28 P | Not run | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, H, F, B |
| S-18 commercial customer credit note | Missing review/approval and linked adjustment workflow | D policy text only | 28/28 P; behavior not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | R, RA, D, B; [decision](./financial-reconciliation-decision-log.md) |
| S-19 finalized edit and linked adjustment | Partial: immutability protections exist; linked audited adjustment integration missing | No inspected complete offline assertion | Not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | A, R, B; [prior investigation](./classification-runtime-campaign-2026-11-08.md#classification-of-the-24-previously-blocked-scenarios) |
| S-20 knowledge-as-of and restatement | Partial: aging by due date is not bitemporal reporting | No inspected complete offline assertion | Not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | L, R, B; prior investigation |
| S-21 finalized terms snapshot and audited attempt | Partial: stored due date; complete audited adjustment path not established | No inspected complete offline assertion | Not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | A, L, B; prior investigation |
| S-22 same-payment concurrent allocation | Implemented locks/limits and reversal primitives; exact race unverified | F/D partial structural and policy checks | 28/28 P | Exact race not run | B related race regression, not exact fixture | RUNTIME_NOT_RUN | R, H, F, D, B |
| S-23 two-payment invoice race | Implemented locks/limits and reversal primitives; exact race unverified | F/D partial | 28/28 P | Exact race not run | B related race regression, not exact fixture | RUNTIME_NOT_RUN | R, H, F, D, B |
| S-24 controlled stale-read race | Implemented locks/limits and reversal primitives; exact race unverified | F/D partial | 28/28 P | Exact race not run | B related race regression, not exact fixture | RUNTIME_NOT_RUN | R, H, F, D, B |
| S-25 legacy cutover without inference | Missing full cutover, opening-ledger classification and exclusion workflow | No inspected complete offline assertion | Not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | P, R, L, B; prior investigation |
| S-26 audited legacy reclassification | Missing complete reclassification and historical as-of workflow | No inspected complete offline assertion | Not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | P, R, L, B; prior investigation |
| S-27 reject Cheque | Conflicts with implementation: Cheque is explicitly allowed and mapped to CHEQUE | F checks acceptance/mapping, opposite to scenario | 28/28 P for existing behavior; rejection not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING; policy conflict | V, A, F, B |
| S-28 synchronized receipt sequence | Implemented transactional sequence and retry machinery | Q/D partial SQL and source checks | 28/28 P | E/M PASS incl. retries, exhaustion, rollback, tenant denial | Earlier passes | — | P, H, Q, D, E, M |
| S-29 reject cross-tenant references | Implemented tenant and ownership guards | F partial static guard checks | 28/28 P | Exact scenario not run; receipt tenant denial is narrower | B PASS; source changed | STALE_RUNTIME_EVIDENCE | R, RA, H, F, B, E, M |
| S-30 reject unsupported currency | Missing explicit currency validation: payment input has no currency field | Q asserts absence of modeled currency, not rejection | 28/28 P for absence; rejection not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | V, A, P, Q, B |
| S-31 two supplier payments, one invoice | Implemented individual allocation primitive; exact sequence unverified | F/U/D partial | 28/28 P | Not run | B BLOCKED | RUNTIME_NOT_RUN | R, RA, P, F, D, B |
| S-32 one supplier payment, two invoices | Implemented individual allocation primitive; exact sequence unverified | F/U/D partial | 28/28 P | Not run | B BLOCKED | RUNTIME_NOT_RUN | R, RA, P, F, D, B |
| S-33 supplier partial settlement | Implemented allocation primitive; exact fixture unverified | F/U/D partial | 28/28 P | Not run | B BLOCKED | RUNTIME_NOT_RUN | R, RA, P, F, D, B |
| S-34 supplier partial allocation | Implemented allocation | F/U partial | 28/28 P | No assertion result; full runner timed out | B PASS; source changed | STALE_RUNTIME_EVIDENCE; timeout secondary | R, P, H, B, M |
| S-35 supplier full allocation | Implemented allocation | F/U partial | 28/28 P | No assertion result; full runner timed out | B PASS; source changed | STALE_RUNTIME_EVIDENCE; timeout secondary | R, P, H, B, M |
| S-36 supplier refund | Implemented refund lifecycle and supplier posting | F/U partial | 28/28 P | No assertion result; full runner timed out | B PASS; source changed | STALE_RUNTIME_EVIDENCE; timeout secondary | R, H, F, B, M |
| S-37 reverse and repost corrected supplier payment atomically | Partial: reversal and payment creation exist separately; combined atomic replacement not established | F partial; no combined-operation assertion | 28/28 P | Not run | B BLOCKED | IMPLEMENTATION_MISSING | R, A, F, D, B |
| S-38 commercial supplier debit adjustment | Missing approved commercial adjustment workflow | D policy text only | 28/28 P; behavior not covered | Not run | B BLOCKED | IMPLEMENTATION_MISSING | R, RA, D, B; [decision](./financial-reconciliation-decision-log.md) |

O's S-08 PASS includes ₹400 and ₹600 separate allocations, replay, invoice state and audit counts. B later recorded S-08 BLOCKED against an earlier conflicting scenario formulation; owner-approved expectations were subsequently corrected. O is useful historical evidence, but differs in source hashes and is not a current-source pass. The campaign's “fifteen additional cases” refers to B/T and did not include this earlier S-08 pass.

## Blocked breakdown and status reconciliation

Primary reason applies to the **existing** 35 blocked rows; it identifies the most direct obstacle to the complete current-source scenario, not every missing layer.

| Primary reason | Count | Scenarios |
|---|---:|---|
| STALE_RUNTIME_EVIDENCE | 16 | S-02, S-03, S-05, S-06, S-08, S-11–S-17, S-29, S-34–S-36 |
| RUNTIME_NOT_RUN | 8 | S-07, S-10, S-22–S-24, S-31–S-33 |
| IMPLEMENTATION_MISSING | 11 | S-09, S-18–S-21, S-25–S-27, S-30, S-37, S-38 |
| **Total** | **35** | |

The replay full-runner invocation timed out without a result artifact. It is not known whether any particular supplier assertion was reached, so `RUNTIME_TIMEOUT` is a secondary campaign-level limitation for S-05, S-06 and S-34–S-36, not a claimed individual test timeout or failure. No assertion result or underlying timeout cause is available. The timeout also prevents claiming current-source supplier allocation/reversal/refund-cache regression results.

No evidence justifies changing the existing overall statuses: previous and proposed remain 3 PASS / 0 FAIL / 35 BLOCKED. The historical S-08 discovery changes its evidence dimension, not its overall BLOCKED status. An explicit, separate four-dimensional report—implementation, offline assertion coverage/result, current vs historical runtime, overall verification—avoids treating all blocked cases alike.

## Verification gap analysis

1. Implemented primitives lack complete current runtime evidence for all 16 stale-evidence rows and the eight `RUNTIME_NOT_RUN` rows. Some, notably S-22–S-24, still need exact synchronization and reversal assertions rather than a generic race.
2. No inspected offline test fully exercises the accounting invariants in any of the 38 scenarios. F/C/U/Q/D provide useful partial contracts; S-19–S-21 and S-25–S-26 have no inspected scenario-specific offline assertion, and S-27/S-30 specifically lack the required rejection test. Policy-text tests for S-18/S-38 are not workflow tests.
3. B/T pass results for S-02, S-03, S-05, S-06, S-11–S-17, S-29 and S-34–S-36 and O's S-08 pass are historical: recorded schema/service/harness hashes changed. Whether particular historical behavior remains applicable cannot be proved from hashes alone. These results are not erased or described as demonstrated defects.
4. Exact historical-to-current source differences and all uninspected possible tests remain uncertain. S-19/S-21 have partial protection but full adjustment/audit integration is not demonstrated. S-27 contradicts supported Cheque behavior; changing either policy or implementation requires separate owner direction, not an assumption. S-30 does not model currency; the existing test proves absence, not fail-closed rejection.
5. Evidence supports missing end-to-end workflows for S-09, S-18–S-21, S-25–S-27, S-30, S-37 and S-38, while preserving the distinction between absent workflow and existing primitives. S-18 is commercial, not a GST credit note; S-38 uses the approved ₹100 commercial adjustment. No accounting decision is changed.
6. S-01/S-04/S-28 have sufficient existing current-source runtime evidence for their **scoped recorded assertions**; no repeat database run is needed for that layer. The offline source/policy and schema-artifact assertions in F/C/U/Q/D likewise need no database to verify their own static claims, but cannot substitute for the matrix's persisted financial, rollback or concurrency outcomes. Genuine Supabase Auth and independent acceptance remain separate.

## Minimal next verification plan

1. **Offline, no database:** inspect relevant historical source snapshots if available and map exact differences and test assertions to each scenario; add or execute focused behavioral tests only under a separately authorized implementation/test task. Resolve the S-27 policy-versus-supported-method conflict without silently changing either. Assess exact missing workflows and fixture definitions before asking for runtime.
2. **Disposable runtime, only when separately authorized:** run current-source exact fixtures for stale and unrun scenarios after any required workflow and test gaps are addressed. Capture persisted balances, ledgers, audit, idempotency and synchronized race/rollback assertions. Isolate the supplier regression harness and preserve subprocess output so a timeout cannot erase assertion progress; do not infer why the previous invocation timed out.
3. **Fresh explicit user authorization:** required before creating or connecting to any new disposable target, executing runtime tests, changing financial behavior or policy, or pursuing genuine Auth/integration acceptance. This classification did none of those.
