---
title: Financial Reconciliation Test Report
date: 2026-11-08
status: Documented - Pending Owner Approval
---

## Goal
Record executed evidence and proposed future tests. `Documented` means this report is prepared; it does not mean reconciliation is implemented, runtime-verified, independently accepted, or owner-approved.

## Executed

| Test | Result | Evidence |
|---|---|---|
| Payment integrity contract | 7/7 passed in the previous implementation campaign | `node --test tests/payment-integrity-contract.test.mjs` (historical evidence) |
| Stock integrity contract | 5/5 passed in the previous implementation campaign | `node --test tests/stock-adjustment-integrity-contract.test.mjs` (historical evidence) |
| TypeScript typecheck | Passed in the previous implementation campaign | `pnpm typecheck` (historical evidence) |
| Existing broad static suite | 328/328 passed in the previous implementation campaign | `node --test tests/*.mjs` (historical evidence) |

No implementation or database tests were run in this documentation-only correction campaign.

## Covered by current contracts
- Payment permissions, row locking, idempotency replay, payload conflict, and overpayment guard.
- Payment repository mutation rejection.
- Stock adjustment authorization and idempotency.
- Conditional outbound stock decrement.
- Atomic `recordMany` contract.
- Rounded-zero movement rejection and new-batch quantity initialization.

## Not yet runtime-verified
- Fully/partially paid invoice allocation for sales and purchases.
- Multiple payments against one invoice.
- Unallocated advances and overpayments.
- Allocation correction, refunds, and reversals.
- Duplicate real-world payment references.
- Concurrent database payment operations against a disposable PostgreSQL target.
- Cross-tenant foreign-key rejection and database financial checks.
- Complete invoice/payment/ledger/outstanding-balance equality.
- All 38 expanded scenarios in the scenario matrix, including explicit initial/final arithmetic fields.
- Concurrent allocation, refund rollback, historical cutover, due-date as-of reporting, unsupported method rejection, receipt sequencing, and currency rejection.

## Mandatory scenario disposition
Scenarios requiring invoice allocation or reversal remain blocked by missing policy/model support; they are documented, not falsely marked passed.

## Proposed future test groups

- Arithmetic: gross exposure, unapplied credit/advance, and signed net position for customer and supplier examples.
- Refunds: unapplied refund, partial/full allocated refund, allocation reversal ordering, rollback, and idempotent retry.
- Concurrency: same payment, same invoice, stale aggregate race, same-key retry, and cross-tenant reference.
- Cutover: preserved legacy payments, no inferred allocations, opening reconciliation, and audited manual historical allocation.
- Aging: finalized due-date snapshot, explicit as-of date, effective versus recorded timestamps, backdated events, and term changes.
- Controls: unsupported payment method rejection, serialized tenant receipt numbers, credit-note excess handling, transfer prohibition, and currency mismatch.
- Lock protocol: allocation/refund/allocation-reversal/payment-reversal pairwise races, sorted multi-invoice locking, deadlock/serialization retry, and post-lock aggregate rereads.
- Cutover/as-of: opening equation, `legacy_unallocated` exclusion, audited manual reclassification, every event type at strict as-of T, and labelled restatement for later-recorded backdated events.

## Out of Scope
Recovery/PITR and production acceptance.
