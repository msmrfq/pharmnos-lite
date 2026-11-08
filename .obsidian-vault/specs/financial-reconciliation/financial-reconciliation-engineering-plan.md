---
title: Financial Reconciliation Engineering Plan
date: 2026-11-08
status: Owner Approved Policy - Runtime Incomplete
---

## Goal
Sequence safe corrections without silently choosing accounting policy.

## Completed in this campaign
1. Protect payment history at the repository boundary.
2. Make outbound stock decrement concurrency-safe.
3. Make multi-movement stock posting atomic.
4. Reject invalid movement quantities and prevent new-batch double counting.
5. Add focused regression contracts.

## Decision gate
Decisions A–O and the 13 scenario resolutions were owner-approved on 2026-11-08. The approval authorizes policy direction, not a claim that the workflows below are implemented or independently accepted. Commercial credit-note and debit-adjustment workflows remain outside the receipt-provisioning correction.

## Next work after approval
1. Audit existing payments for null/duplicate idempotency keys, invalid party combinations, and cache/ledger mismatches without inferring historical allocations.
2. Add only the additive allocation/reversal/adjustment model required by approved policy.
3. Make invoice balance fields transactionally authoritative or remove them from authoritative reporting.
4. Add refund states and enforce allocated-refund ordering: reverse allocation, reopen invoice, record refund, recompute usable amount, atomically.
5. Add isolated PostgreSQL tests for allocation, refund rollback, reversal, cached-balance reconciliation, tenant references, and concurrency.
6. Add finalized due-date snapshots, explicit as-of/effective/recorded-date semantics, and report bucket tests.
7. Reject unknown payment methods and replace count-based receipt numbering with a tenant-scoped serialized unique sequence.
8. Define the formal historical cutover timestamp, opening reconciliation, legacy-unallocated reporting, and audited manual allocation process.
9. Reconcile generated provisioning with the migration chain before any deployment.

## Future acceptance criteria (not authorization)

- Customer and supplier reports expose gross exposure, unapplied credit/advance, and signed net position separately.
- Allocation preserves net position while changing invoice outstanding and unapplied amount equally.
- No active allocation or refund sequence can over-allocate payment or invoice balances under concurrency.
- Refund requests, approvals, completed refunds, reversals, and allocation reversals are distinct and idempotent.
- Unknown payment methods fail validation; method labels never imply bank/cash reconciliation.
- Receipt numbers are unique and serialized per tenant under concurrent creation.
- Historical cutover preserves legacy payments, performs no inferred allocation, and has signed opening reconciliation evidence.
- Every allocation, refund completion, allocation reversal, and payment reversal uses the same ordered parent-lock protocol and post-lock reread; retryable failures roll back and retry the complete idempotent operation.
- Legacy-unallocated payments are excluded from post-cutover aggregates until an audited manual reclassification, preventing double counting.
- Aging tests cover each event type, strict knowledge-as-of behavior, and explicitly labelled restatements for later-recorded backdated events.

## Separate inventory workstream
Decision J recommends retaining the prior stock movement safeguards as a separate inventory-integrity workstream. They must not be counted as accounting-policy closure evidence.

## Dependencies
Data audit precedes strict constraints or backfills. Runtime evidence must use an explicitly authorized disposable target. S-09 multi-invoice allocation must be atomic, S-10 uses a single ₹700 payment, and S-18 commercial credit-note review must not be coupled to GST. S-37 distinguishes invoice face from outstanding; S-38 reduces a ₹2,000 payable by ₹100 to ₹1,900.

## Explicit non-goals
Do not redesign into a general ledger, add provider recovery work, run production migrations, infer historical allocations, or claim complete financial reconciliation from static tests.
