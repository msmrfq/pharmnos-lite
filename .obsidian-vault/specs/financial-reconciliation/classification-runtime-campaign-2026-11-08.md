---
title: Financial Reconciliation Classification and Runtime Campaign
date: 2026-11-08
status: Partially Verified - Not Accepted
---

## Goal

Classify the 24 previously blocked scenarios and verify the independently executable cases without changing approved policy, accounting functionality, or historical evidence.

## Acceptance Criteria

- [x] Classify each previously blocked scenario against the exact matrix wording.
- [x] Execute the independently eligible cases on authorized migration-replayed disposable targets, without repeating accepted matrix cases.
- [x] Preserve failures and distinguish them from fixture and external-auth limitations.
- [ ] Resolve the reported failures, policy contradictions, missing functionality, and independent acceptance.

## Out of Scope

Production, hosted Supabase, provider recovery, accounting implementation changes, and policy amendments.

## Baseline and evidence

At campaign start, HEAD was `fcea2f25975a64b0d0f986b93f58a352abaefc17`: 14 PASS, 0 FAIL, 24 BLOCKED. The baseline was [replay5d1b46962e3d-suite.json](./replay5d1b46962e3d-suite.json); its 16 focused regressions are separate from the matrix. Porcelain-v2 status, staged/unstaged statistics, staged patch, and hashes of 1,358 existing tracked/non-ignored untracked files were captured in the session workspace. Earlier architecture and matrix frontmatter describe proposed policy; the [decision log](./financial-reconciliation-decision-log.md) records owner approval of A-O. Approval does not repair conflicting matrix arithmetic.

The verbatim initial, final, ledger, audit and retry expectations for every previously blocked row are reproduced below from the unchanged [scenario matrix](./financial-reconciliation-scenario-matrix.md); they are not revised by this report. Each row is independent.

| ID | Initial state and operation | Final financial fields | Ledger, audit, idempotency, and failure expectation |
|---|---|---|---|
| S-01 | Customer: gross AR ₹0; credit ₹0; net AR ₹0; invoice outstanding ₹0; payment ₹500; active allocation ₹0; usable ₹500; refundable ₹500. Record `PAY-001` as an advance. | Gross AR ₹0; credit ₹500; net AR -₹500; invoice outstanding ₹0; active allocation ₹0; usable ₹500; refundable ₹500. | Customer-credit ledger entry; retry with same key is write-free; no rejection. |
| S-04 | Supplier: gross AP ₹0; advance ₹0; net AP ₹0; invoice outstanding ₹0; `PAY-003` ₹1,000; active allocation ₹0; usable ₹1,000; refundable ₹1,000. Record advance. | Gross AP ₹0; advance ₹1,000; net AP -₹1,000; invoice outstanding ₹0; active allocation ₹0; usable ₹1,000; refundable ₹1,000. | Supplier-advance ledger entry; retry is write-free. |
| S-07 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-003` outstanding ₹1,000; `PAY-004` payment amount ₹400; active allocation ₹0; usable ₹400; refundable ₹400. Allocate ₹400. | Gross AR ₹600; credit ₹0; net AR ₹600; invoice outstanding ₹600; active allocation ₹400; usable ₹0; refundable ₹400. | Partial settlement recorded atomically. |
| S-08 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-004` outstanding ₹1,000; `PAY-005` ₹400 and `PAY-006` ₹600; active allocations ₹0; usable total ₹1,000; refundable total ₹1,000. Allocate both. | Gross AR ₹0; credit ₹0; net AR ₹0; invoice outstanding ₹0; active allocations ₹1,000; each payment usable ₹0; refundable total ₹1,000. | Two payment allocations remain separately traceable. |
| S-09 | Customer: gross AR ₹2,000; credit ₹0; net AR ₹2,000; `SI-005` outstanding ₹1,000 and `SI-006` outstanding ₹1,000; `PAY-007` ₹1,500; active allocation ₹0; usable ₹1,500; refundable ₹1,500. Allocate ₹1,000 to `SI-005` and ₹500 to `SI-006`. | Gross AR ₹500; credit ₹0; net AR ₹500; `SI-005` outstanding ₹0; `SI-006` outstanding ₹500; active allocation ₹1,500; usable ₹0; refundable ₹1,500. | One payment/many invoices; both allocations are atomic and bounded. |
| S-10 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-007` outstanding ₹1,000; `PAY-008` payment amount ₹700; active allocation ₹0; usable ₹700; refundable ₹700. Allocate ₹400 and ₹300. | Gross AR ₹300; credit ₹0; net AR ₹300; invoice outstanding ₹300; active allocation ₹700; usable ₹0; refundable ₹700. | Many payments/one invoice; third allocation above ₹1,000 is rejected. |
| S-16 | Customer: gross AR ₹0; credit ₹0; net AR ₹0; `SI-012` outstanding ₹0; `PAY-014` payment amount ₹1,000; active allocation ₹1,000; usable ₹0; refundable ₹1,000. `REF-004` requests ₹200, but ledger insert fails. | Gross AR ₹0; credit ₹0; net AR ₹0; invoice outstanding ₹0; active allocation ₹1,000; usable ₹0; refundable ₹1,000. | Allocation reversal, refund, and ledger effect all roll back; retry is safe. |
| S-18 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-013` outstanding ₹1,000; no payment; active allocation ₹0; usable ₹0; refundable ₹0. Submit ₹1,100 credit note. | Pending policy: either reject excess ₹100 or separately approve it; on rejection final gross AR ₹1,000, credit ₹0, net AR ₹1,000, invoice outstanding ₹1,000, allocation ₹0, usable ₹0, refundable ₹0. | Validation/approval failure has no ledger effect; audit records the rejected request. |
| S-19 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; finalized `SI-014` outstanding ₹1,000; payment amount ₹0; active allocation ₹0; usable ₹0; refundable ₹0. Attempt direct edit. | Gross AR ₹1,000; credit ₹0; net AR ₹1,000; invoice outstanding ₹1,000; active allocation ₹0; usable ₹0; refundable ₹0. | Direct edit rejected; linked adjustment/reversal is required and audited. |
| S-20 | Customer: gross AR ₹500; credit ₹0; net AR ₹500; `SI-015` outstanding ₹500; `PAY-015` payment amount ₹500 effective before as-of date but recorded after it; active allocation ₹0; usable ₹500; refundable ₹500. | Strict knowledge-as-of: gross AR ₹500, credit ₹0, net AR ₹500, invoice outstanding ₹500, active allocation ₹0, usable ₹500, refundable ₹500. Explicit restatement: gross AR ₹0, credit ₹0, net AR ₹0, invoice outstanding ₹0, active allocation ₹500, usable ₹0, refundable ₹500. | Effective and recorded timestamps are both shown; no silent backdating. |
| S-21 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-016` outstanding ₹1,000; payment amount ₹0; active allocation ₹0; usable ₹0; refundable ₹0. Change terms from 30 to 60 days after finalization. | Gross AR ₹1,000; credit ₹0; net AR ₹1,000; invoice outstanding ₹1,000; active allocation ₹0; usable ₹0; refundable ₹0; due date remains the finalized 30-day snapshot. | Terms change affects new invoices only unless approved adjustment; audit records attempt. |
| S-22 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-017` outstanding ₹1,000; `PAY-016` payment amount ₹500; active allocation ₹0; usable ₹500; refundable ₹500. Two transactions each request ₹400. | Gross AR ₹600; credit ₹0; net AR ₹600; invoice outstanding ₹600; active allocation ₹400; usable ₹100; refundable ₹500. Exactly one succeeds; other retries against remaining ₹100 and fails. | Same payment and invoice locks serialize; no over-allocation. |
| S-23 | Customer: gross AR ₹500; credit ₹0; net AR ₹500; `SI-018` outstanding ₹500; `PAY-017` and `PAY-018` payment amounts ₹400 each; active allocations ₹0; total usable ₹800; refundable total ₹800. Concurrent requests each allocate ₹400. | Gross AR ₹100; credit ₹0; net AR ₹100; invoice outstanding ₹100; active allocation ₹400; one payment usable ₹0, the other ₹400; refundable total ₹800. | Invoice lock serializes; second request is rejected after reread because only ₹100 remains. |
| S-24 | Customer: gross AR ₹500; credit ₹0; net AR ₹500; `SI-019` outstanding ₹500; `PAY-019` payment amount ₹500; active allocation ₹0; usable ₹500; refundable ₹500. Two stale reads request ₹300 each. | Gross AR ₹200; credit ₹0; net AR ₹200; invoice outstanding ₹200; active allocation ₹300; usable ₹200; refundable ₹500. One request commits; the other fails/retries because total cannot exceed ₹500. | Parent lock and post-lock reread prove stale-read race is safe. |
| S-25 | Customer: gross AR ₹1,000; credit ₹0; net AR ₹1,000; `SI-020` outstanding ₹1,000; legacy `PAY-020` payment amount ₹500; active allocation ₹0; usable ₹500; refundable ₹500. Cut over without inference. | Gross AR ₹1,000; legacy credit ₹500; reported net AR ₹500; invoice outstanding ₹1,000; active allocation ₹0; post-cutover usable ₹0 for allocation purposes; legacy refundable ₹500. | Legacy payment is tagged once in opening ledger; excluded from post-cutover allocation and credit projections. |
| S-26 | Customer opening state: gross AR ₹1,000; legacy credit ₹500; reported net AR ₹500; `SI-020` outstanding ₹1,000; legacy `PAY-020` ₹500; new allocation ₹0; legacy usable ₹500. Manually allocate ₹500 with evidence. | Gross AR ₹500; legacy credit ₹0; net AR ₹500; invoice outstanding ₹500; new active allocation ₹500; payment usable ₹0; refundable ₹500. | Legacy report records reclassification; new report shows audited allocation; historical as-of reports retain pre-event view. |
| S-27 | Validation case: gross AR/AP, unapplied, net, invoice, payment, allocation, usable, refundable all do not apply because unsupported `Cheque` is rejected before persistence. | All applicable financial fields remain 0/no record. | No payment, ledger, or audit financial effect; method never maps to `CREDIT`. |
| S-28 | Control case: no invoice/payment financial state; two receipt requests for one tenant. | All financial fields do not apply; two unique serialized receipt numbers are returned or the transaction retries. | Tenant sequence/unique constraint; count-based generation is rejected as unsafe. |
| S-30 | Validation case: single-currency policy, submitted amount has unsupported currency; all financial fields do not apply because no record is created. | No financial change; all applicable fields remain 0/no record. | Explicit currency rejection; no implicit conversion or idempotent financial effect. |
| S-31 | Supplier: gross AP ₹2,000; advance ₹0; net AP ₹2,000; `PI-021` outstanding ₹2,000; `PAY-021` ₹750 and `PAY-022` ₹1,250; active allocation ₹0; usable ₹2,000; refundable ₹2,000. Allocate both. | Gross AP ₹0; advance ₹0; net AP ₹0; invoice outstanding ₹0; active allocation ₹2,000; usable ₹0; refundable ₹2,000. | Two supplier payments reconcile exactly; duplicate allocation keys are write-free. |
| S-32 | Supplier: gross AP ₹3,000; advance ₹0; net AP ₹3,000; `PI-022` outstanding ₹2,000 and `PI-023` outstanding ₹1,000; `PAY-023` ₹3,000; active allocation ₹0; usable/refundable ₹3,000. Allocate ₹2,000 and ₹1,000. | Gross AP ₹0; advance ₹0; net AP ₹0; both invoices outstanding ₹0; active allocation ₹3,000; usable ₹0; refundable ₹3,000. | One supplier payment/many invoices; totals cannot exceed ₹3,000. |
| S-33 | Supplier: gross AP ₹2,000; advance ₹0; net AP ₹2,000; `PI-024` outstanding ₹2,000; `PAY-024` payment amount ₹750; active allocation ₹0; usable ₹750; refundable ₹750. Allocate ₹750. | Gross AP ₹1,250; advance ₹0; net AP ₹1,250; invoice outstanding ₹1,250; active allocation ₹750; usable ₹0; refundable ₹750. | Partial supplier settlement is traceable. |
| S-37 | Supplier: gross AP ₹2,000; advance ₹0; net AP ₹2,000; `PI-027` outstanding ₹2,000; `PAY-028` ₹1,100 with active allocation ₹1,100; usable ₹0; refundable ₹1,100. Reverse and repost corrected payment ₹900. | Gross AP ₹1,100; advance ₹0; net AP ₹1,100; invoice outstanding ₹1,100; active allocation ₹900; usable ₹0; refundable ₹900. | Original, reversal, replacement, and audit reason are atomic; no direct edit. |
| S-38 | Supplier: gross AP ₹2,000; advance ₹0; net AP ₹2,000; `PI-028` outstanding ₹2,000; `PAY-029` payment amount ₹750; active allocation ₹750; usable ₹0; refundable ₹750. Apply approved debit adjustment ₹100. | Gross AP ₹1,350; advance ₹0; net AP ₹1,350; invoice outstanding ₹1,350; active allocation ₹750; usable ₹0; refundable ₹750. | Adjustment changes commercial exposure, not cash; source and approval are audited. |

## Runtime and failure analysis

Both `replay86e7403b9bf5` and `replay90e2ad24bdf3` used fresh run-bound contracts, checked the exact Compose target, checked an empty database, replayed and checksum-verified all 27 Prisma migrations, provisioned and tested the restricted role, and verified cleanup. They did not use hosted Supabase. The first run's [suite evidence](./replay86e7403b9bf5-suite.json) records S-01 and S-04 as FAIL: both payment actions returned PostgreSQL `42501` for `payment_receipt_sequences`. The same error arose in the selected S-28 receipt call after the barrier; the initial harness aborted before emitting a separate S-28 record. S-28 is a runtime FAIL based on that call's failure, not a concurrency PASS; its persisted no-mutation assertions did not run. The first evidence file's `derived` objects are hypothetical fixture expectations, not observed values, because `persisted` is null.

For all three runs, recorded schema, reconciliation-service, reconciliation-action, and security-harness hashes match current files. The prior baseline and first-run harness hashes differ from the current harness because this campaign changed the harness; the follow-up S-16 harness hash matches. The prior baseline did not record hashes for every application dependency, so its evidence should not be read as a complete current-source build manifest.

The root cause is a provisioning coverage defect: `payment_receipt_sequences` is created by migration 0025 and used by `allocatePaymentReceiptNo`, but is absent from `directTenantTables` in [financial-e2e-provision-local.mjs](../../../scripts/financial-e2e-provision-local.mjs). Its table grants and tenant RLS must be designed and tested together; simply granting unrestricted access would not be a safe fix. Existing security probes did not cover this table. No privileges or policies were altered during this campaign.

The initial harness exception also prevented S-16 from executing. After repairing harness error isolation, a second target within this same campaign ran only that unexecuted case. [replay90e2ad24bdf3-suite.json](./replay90e2ad24bdf3-suite.json) proves the controlled ledger-insert failure left payment, allocation, invoice, refund status, audit count, ledger and cache unchanged; retry completed once and a second retry was write-free. The temporary, customer-scoped fault trigger was removed before target cleanup. No previously accepted matrix scenario was rerun.

The customer and supplier actions used guarded synthetic sessions and stubbed Supabase metadata updates. Genuine Supabase Auth remains unverified. Historical supplier payable-cache and race regressions remain separate evidence, not new matrix passes.

## Classification of the 24 previously blocked scenarios

These are **pre-runtime primary classifications**, one per scenario; the final table below records new runtime failures. `Y` under decision means an owner clarification or policy decision is required; `N` does not authorize implementation. `Run` means safely executable at classification time, not that it passed. Each exact expectation is the corresponding verbatim row above.

Paths: `H` = [runtime harness](../../../scripts/financial-reconciliation-runtime-harness.cjs); `A` = [payment actions](../../../src/app/_actions/sales.actions.ts); `R` = [reconciliation service](../../../src/domain/services/financial-reconciliation.service.ts); `P` = [payment repository](../../../src/repositories/payment.repository.ts); `L` = [ledger repository](../../../src/repositories/ledger.repository.ts); `V` = [payment validation](../../../src/lib/validation/sales.schemas.ts). Prior blocked status and reason are recorded in `replay5d1b46962e3d`; new evidence is cited in the final table.

| ID | Primary classification | Reason and exact prerequisite | Paths | Run | Decision |
|---|---|---|---|---|---|
| S-01 | IMPLEMENTED_RUNTIME_NOT_VERIFIED | New customer, no invoices, ₹500 advance, action/ledger/cache/retry fixture needed. Now fails restricted-role receipt access. | A, P, H | Yes | N |
| S-04 | IMPLEMENTED_RUNTIME_NOT_VERIFIED | New supplier, no invoices, ₹1,000 advance, action/ledger/cache/retry fixture needed. Now fails restricted-role receipt access. | A, P, H | Yes | N |
| S-07 | POLICY_CONFLICT | Initial ₹400 usable implies ₹400 credit, not zero; initial net is ₹600, not ₹1,000. | R, P, H | No | Y |
| S-08 | POLICY_CONFLICT | Initial ₹1,000 usable implies ₹1,000 credit, not zero; initial net is ₹0, not ₹1,000. | R, P, H | No | Y |
| S-09 | POLICY_CONFLICT | Initial ₹1,500 usable implies ₹1,500 credit and net ₹500, not zero credit/net ₹2,000. Atomic two-invoice operation also requires proof. | R, P, H | No | Y |
| S-10 | POLICY_CONFLICT | Initial ₹700 usable implies ₹700 credit and net ₹300; one stated payment also conflicts with “many payments”. | R, P, H | No | Y |
| S-16 | IMPLEMENTED_FIXTURE_MISSING | Exact target-scoped ledger-insert fault, rollback readback and retry fixture needed; now PASS. | R, H | Yes | N |
| S-18 | POLICY_CONFLICT | Matrix explicitly leaves excess credit-note rejection versus separate approval pending; credit-note workflow is deferred. | R, H | No | Y |
| S-19 | APPLICATION_INTEGRATION_MISSING | Finalized edit protection is not the required linked, audited adjustment/reversal workflow. | A, R, H | No | N |
| S-20 | FUNCTIONALITY_MISSING | Strict knowledge-as-of and explicit event-time restatement/reporting are not established by the due-date aging helper. | L, R, H | No | Y |
| S-21 | APPLICATION_INTEGRATION_MISSING | A stored due date is not evidence of the specified audited terms-change attempt and approved adjustment workflow. | A, L, H | No | N |
| S-22 | POLICY_CONFLICT | Initial credit is ₹500 and final credit ₹100 under usable-credit equation; net remains ₹500, not ₹1,000 then ₹600. | R, P, H | No | Y |
| S-23 | POLICY_CONFLICT | Initial credit is ₹800 and final credit ₹400; net remains -₹300, not ₹500 then ₹100. | R, P, H | No | Y |
| S-24 | POLICY_CONFLICT | Initial ₹500 and final ₹200 usable imply equal credit; net remains ₹0, not ₹500 then ₹200. | R, P, H | No | Y |
| S-25 | FUNCTIONALITY_MISSING | Formal cutover, opening ledger classification, legacy exclusion and projection/report readback are missing; a schema flag alone is insufficient. | P, R, L, H | No | N |
| S-26 | FUNCTIONALITY_MISSING | Audited legacy reclassification and retained historical as-of view are missing. | P, R, L, H | No | N |
| S-27 | FUNCTIONALITY_MISSING | `Cheque` is accepted and mapped to `CHEQUE`; the matrix requires its rejection. Exact no-write rejection cannot pass. | V, A, H | No | Y |
| S-28 | IMPLEMENTED_FIXTURE_MISSING | Two concurrent restricted-role sequence calls, barrier and no-financial-row readback needed. Now fails receipt-table permission before numbers return. | P, H | Yes | N |
| S-30 | FUNCTIONALITY_MISSING | Payment input does not model currency or explicitly reject an unsupported currency. | V, A, P, H | No | N |
| S-31 | POLICY_CONFLICT | ₹2,000 usable implies ₹2,000 advance and initial net ₹0, not advance ₹0/net ₹2,000. | R, P, H | No | Y |
| S-32 | POLICY_CONFLICT | ₹3,000 usable implies ₹3,000 advance and initial net ₹0, not advance ₹0/net ₹3,000. | R, P, H | No | Y |
| S-33 | POLICY_CONFLICT | ₹750 usable implies ₹750 advance and initial net ₹1,250, not advance ₹0/net ₹2,000. | R, P, H | No | Y |
| S-37 | POLICY_CONFLICT | Replacing active ₹1,100 allocation with ₹900 increases stated outstanding ₹2,000 to ₹2,200, not ₹1,100; atomic repost is also unverified. | R, P, H | No | Y |
| S-38 | POLICY_CONFLICT | Reducing stated outstanding ₹2,000 by a ₹100 commercial adjustment gives ₹1,900, not ₹1,350; debit-adjustment workflow is also absent. | R, L, H | No | Y |

Classification totals: POLICY_CONFLICT 13; FUNCTIONALITY_MISSING 5; APPLICATION_INTEGRATION_MISSING 2; IMPLEMENTED_FIXTURE_MISSING 2; IMPLEMENTED_RUNTIME_NOT_VERIFIED 2; EXTERNAL_AUTH_DEPENDENCY 0; INSUFFICIENT_EVIDENCE 0. Genuine Auth is an independent campaign-level limitation, not the primary explanation for any of these 24 exact rows.

## Final 38-scenario matrix

`B` denotes the pre-campaign `replay5d1b46962e3d` evidence; `F` denotes `replay86e7403b9bf5`; `R` denotes `replay90e2ad24bdf3`. Classification in the preceding table applies to previously blocked rows. The previous PASS evidence remains historical runtime evidence, not independent acceptance.

| ID | Previous | Final | Classification / reason | Evidence |
|---|---|---|---|---|
| S-01 | BLOCKED | FAIL | Receipt-sequence permission denied | F |
| S-02 | PASS | PASS | Previously verified | B |
| S-03 | PASS | PASS | Previously verified | B |
| S-04 | BLOCKED | FAIL | Receipt-sequence permission denied | F |
| S-05 | PASS | PASS | Previously verified | B |
| S-06 | PASS | PASS | Previously verified | B |
| S-07 | BLOCKED | BLOCKED | Policy conflict | B |
| S-08 | BLOCKED | BLOCKED | Policy conflict | B |
| S-09 | BLOCKED | BLOCKED | Policy conflict | B |
| S-10 | BLOCKED | BLOCKED | Policy conflict | B |
| S-11 | PASS | PASS | Previously verified | B |
| S-12 | PASS | PASS | Previously verified | B |
| S-13 | PASS | PASS | Previously verified | B |
| S-14 | PASS | PASS | Previously verified | B |
| S-15 | PASS | PASS | Previously verified | B |
| S-16 | BLOCKED | PASS | Ledger failure rollback and retry verified | R |
| S-17 | PASS | PASS | Previously verified | B |
| S-18 | BLOCKED | BLOCKED | Pending policy | B |
| S-19 | BLOCKED | BLOCKED | Linked adjustment integration missing | B |
| S-20 | BLOCKED | BLOCKED | Temporal report missing | B |
| S-21 | BLOCKED | BLOCKED | Audited terms workflow missing | B |
| S-22 | BLOCKED | BLOCKED | Policy conflict | B |
| S-23 | BLOCKED | BLOCKED | Policy conflict | B |
| S-24 | BLOCKED | BLOCKED | Policy conflict | B |
| S-25 | BLOCKED | BLOCKED | Formal cutover missing | B |
| S-26 | BLOCKED | BLOCKED | Reclassification/history missing | B |
| S-27 | BLOCKED | BLOCKED | Cheque rejection missing | B |
| S-28 | BLOCKED | FAIL | Receipt-sequence permission denied; no individual result emitted | F |
| S-29 | PASS | PASS | Previously verified cross-tenant ownership | B |
| S-30 | BLOCKED | BLOCKED | Currency rejection missing | B |
| S-31 | BLOCKED | BLOCKED | Policy conflict | B |
| S-32 | BLOCKED | BLOCKED | Policy conflict | B |
| S-33 | BLOCKED | BLOCKED | Policy conflict | B |
| S-34 | PASS | PASS | Previously verified | B |
| S-35 | PASS | PASS | Previously verified | B |
| S-36 | PASS | PASS | Previously verified | B |
| S-37 | BLOCKED | BLOCKED | Policy conflict | B |
| S-38 | BLOCKED | BLOCKED | Policy conflict | B |

**Totals: 15 PASS / 3 FAIL / 20 BLOCKED = 38; 39.47% runtime verified.** Only S-16 is newly verified. Prior passing assertions were not rerun and do not establish independent acceptance.

## Owner decisions and next action

1. For S-07, S-08, S-09, S-10, S-22, S-23, S-24, S-31, S-32 and S-33, may the matrix credit/advance and signed-net figures be corrected to match approved Decision K and the approved unapplied equations, without changing policy? For S-10, is the fixture one payment or multiple payments?
2. For S-37 and S-38, what are the correct initial invoice face/outstanding amounts and final outstanding values for the stated reversal/repost or ₹100 adjustment?
3. For S-18, should an excess credit note be rejected or handled by separately approved excess treatment? The workflow itself is deferred.
4. For S-20, which effective and recorded events should the strict knowledge-as-of and explicitly restated views include?
5. For S-27, should the matrix reject `Cheque` despite the currently supported `CHEQUE` method, or should the rejection fixture use a genuinely unknown method?

Next: separately authorize a narrow receipt-sequence provisioning and tenant-RLS correction, with restricted-role cross-tenant and payment-action regression tests. No accounting or security implementation change is authorized by this classification campaign.

## Checks and preservation

Full JavaScript modules: 357/357; focused reconciliation/target/artifact/static-guard tests: 59/59; typecheck without incremental writes: PASS; lint without cache: PASS; Prisma validation using nonconnecting placeholders: PASS. A production Next build passed in a same-drive isolated copy using existing generated Prisma client and dependencies; the first cross-drive isolated attempt failed because Windows/webpack resolved the dependency junction as an invalid cross-drive path. No dependency installation was performed. Both isolated build copies were removed after their junctions were inspected and detached.

Both new Compose targets were cleaned up with verified-absent evidence, and their ports no longer accepted connections. The pre-existing `scenario20261108l` container remained listed; it was not inspected internally or modified. No hosted database operation was made by the campaign.

Final HEAD matches baseline. The staged diff and staged statistics match the captured baseline after line-ending normalization. Of 1,358 existing tracked/non-ignored untracked files hashed at baseline, 1,356 remain byte-for-byte unchanged; no baseline file was removed. The two intentionally edited pre-existing dirty files are the canonical briefing and runtime harness. Their staged content is unchanged, but the original unstaged bytes inside those two files were not separately captured, so byte-for-byte preservation of every pre-existing edit cannot be claimed. Thirteen new non-ignored files are this report and the six evidence files for each of the two targets. Ignored files were not included in the hash baseline. Briefing mirrors were not synchronized because doing so could overwrite pre-existing user changes.
