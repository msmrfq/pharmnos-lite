---
title: Financial Reconciliation Gap Analysis
date: 2026-11-08
status: Documented - Pending Owner Approval
---

## Goal
Classify confirmed reconciliation gaps and separate them from policy decisions.

## Confirmed defects and missing safeguards

| Severity | Gap | Root cause | Impact |
|---|---|---|---|
| Critical | Payments are not invoice-allocated | `payments` has no allocation model and active actions write account-level payments | Invoice payment status, invoice aging, and invoice-level settlement cannot be trusted |
| High | Payment history was mutable through repository update/delete | Repository exposed direct mutation without a compensating workflow | Historical receipts could be rewritten or removed |
| High | No refund, reversal, or void lifecycle | No status/linkage/compensating-entry model exists | Corrections cannot preserve a complete audit trail |
| High | Invoice payment fields are not maintained by payment actions | Account-level payment design is disconnected from invoice cached fields | Invoice fields diverge from account ledger/payment totals |
| High | Stock outbound was check-then-decrement | Availability read and decrement were separate concurrency decisions | Concurrent sales could oversell a batch |
| High | `recordMany` opened one transaction per movement | Batch orchestration called public methods independently | A later failure could leave earlier movements committed |
| Medium | Cached balances and ledger sums are duplicate sources of truth | Both are read by reports and payment forms | Drift is possible after unsupported/direct writes |
| Medium | Payment methods are lossy | Unsupported UI methods fall through to `CREDIT` | Payment evidence can misstate the real method |
| Medium | Receipt numbers are count-based | No serialized tenant sequence exists | Concurrent creation can collide or reuse numbers |
| Medium | No live concurrency/invariant suite | Existing tests are primarily source contracts | Database races and enforcement remain partly unproven |

## Policy-dependent gaps
- FIFO, manual, or no invoice allocation.
- Advance and overpayment treatment.
- Purchase-payment allocation.
- Refund/reversal accounting semantics.
- Finalized invoice cancellation and credit/debit-note behavior.
- General ledger, cash/bank accounts, and accounting periods.
- Gross versus unapplied versus signed-net terminology was previously ambiguous; the decision pack now defines them separately.
- Refund-after-allocation ordering, historical cutover, allocation concurrency, due-date snapshots, payment-method rejection, and receipt numbering remain pending future policy/engineering work.
- The proposed shared lock order, legacy-unallocated exclusion, and event-specific as-of rules are documentation corrections only; no implementation evidence exists.

No policy-dependent behavior was invented in this campaign.

## Implemented corrections
- Payment repository update/delete now fail closed with an explicit reversal-required error.
- Outbound stock uses a conditional decrement and rejects a lost race.
- `recordMany` uses one transaction.
- Newly created inbound batches no longer double-count the initial quantity.
- Invalid finite/rounded-zero movement quantities are rejected.

## Out of Scope
Recovery/PITR and production operations.

## Source evidence boundary

The current `payments` schema has no allocation/refund/status model; active customer/supplier payment actions write account-level ledger effects and reject account-level overpayment. `getAgingBuckets` uses positive ledger rows by entry date and skips credits. `paymentMethodToPrismaMode` maps unknown methods to `CREDIT`, and `PaymentRepository.getNextReceiptNo` uses tenant payment count plus one. These are source findings, not proposed behavior.
