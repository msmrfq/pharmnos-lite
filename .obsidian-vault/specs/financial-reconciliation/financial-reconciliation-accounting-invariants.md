---
title: Financial Reconciliation Accounting Invariants
date: 2026-11-08
status: Documented - Pending Owner Approval
---

`Documented` means this document is prepared. It does not mean implemented, runtime-verified, independently accepted, or owner-approved.

## Signed balance terminology

- **Gross customer receivable** = outstanding finalized sales-invoice exposure plus approved debit adjustments.
- **Unapplied customer credit** = valid customer receipts/credits not allocated to sales invoices.
- **Net customer position** = gross customer receivable minus unapplied customer credit. Positive means the customer owes Pharmnos; negative means Pharmnos holds a net customer credit.
- **Gross supplier payable** = outstanding finalized purchase-invoice exposure plus approved credit adjustments owed to the supplier.
- **Unapplied supplier advance** = valid supplier payments not allocated to purchase invoices.
- **Net supplier position** = gross supplier payable minus unapplied supplier advance. Positive means Pharmnos owes the supplier; negative means the supplier owes Pharmnos or Pharmnos holds excess advance.

Examples:

1. Customer receipt ₹500 before invoices: gross AR ₹0, unapplied credit ₹500, net position **-₹500**.
2. Invoice ₹800 plus unapplied receipt ₹500: gross AR ₹800, credit ₹500, net position **₹300**.
3. Allocate ₹500: gross AR ₹300, credit ₹0, net position **₹300**. Allocation changes invoice/open-credit composition, not the net position.
4. Supplier payment ₹1,000 before invoices: gross AP ₹0, advance ₹1,000, net position **-₹1,000**.

## Proposed future equations (Pending)

- Invoice outstanding = finalized invoice exposure + approved adjustments − valid allocations.
- Payment usable amount = source payment amount − valid allocations − completed refunds/reversals.
- Unapplied customer credit = usable customer receipts/credits not allocated to sales invoices.
- Unapplied supplier advance = usable supplier payments not allocated to purchase invoices.
- Net customer position = gross customer receivable − unapplied customer credit.
- Net supplier position = gross supplier payable − unapplied supplier advance.

These are future policy equations. The current schema has no allocation/refund model and current payment actions remain account-level.

## Current verified source behavior

- Payment, subledger row, and cached counterparty update are written transactionally in active payment actions.
- Payment retries use tenant-scoped idempotency keys and payload hashes.
- Current actions reject account-level overpayment; they do not represent advances.
- Invoice `paid_amount` and `balance_due` are not maintained by standalone payment actions.
- Current aging buckets positive ledger rows by entry date and skips credits; it is not open-item aging.
- Payment and ledger repository mutation is blocked, but reversal workflows are absent.
- Stock changes are inventory safeguards, not accounting reconciliation evidence.

## Proposed allocation/refund invariants

- Allocation amount > 0 and <= both payment usable amount and invoice outstanding at commit.
- Refund of allocated money reverses the corresponding allocation in the same transaction before recording the completed refund.
- Refund of unapplied credit does not alter invoice allocations.
- Repeated requests with the same idempotency key/payload are write-free; conflicting payloads fail.
- Reversal, refund, allocation reversal, and adjustment preserve source records and audit links.
- Gross exposure, unapplied credit/advance, and signed net position must never be conflated.

## PostgreSQL concurrency boundary

An ordinary PostgreSQL `CHECK` constraint cannot enforce a cross-row `SUM()` limit over allocation records. A trigger alone is not sufficient unless the transaction serializes all competing allocations on a stable parent row. The proposed future transaction is:

1. Validate tenant and party ownership.
2. Lock the payment row and target invoice row in deterministic order by `(tenant_id, entity_kind, entity_id)`; for multi-invoice allocation, sort all target invoice IDs before locking.
3. Re-read active allocations, completed refunds/reversals, and invoice adjustments after locks.
4. Compute usable payment and invoice outstanding amounts.
5. Reject if either requested allocation exceeds the recomputed remainder.
6. Insert allocation and update maintained projections in the same transaction.
7. Commit; any failure rolls back every effect.

The same canonical lock protocol applies to allocation creation, refund completion, allocation reversal, payment reversal, and multi-invoice allocation: `(tenant_id, parent_kind, parent_id)` ascending, with all target invoice IDs sorted before locking. Allocation versus refund, allocation versus reversal, refund versus allocation reversal, concurrent refunds, and multi-invoice versus single-invoice allocation therefore contend on the same payment, invoice, and projection-bearing counterparty parents. A future balance-bearing refund/reversal parent must be added to this ordered set before implementation; none exists today. Deadlocks and serialization failures roll back the full operation and are retried with the same idempotency key. Guarded aggregate updates may reduce read work, but they still require the same parent locks and must not be described as safe from a lock-free stale read.

## Required future concurrency tests

Two allocations competing for one payment, two competing for one invoice, stale reads collectively exceeding a balance, concurrent same-key retries, and tenant-crossing references must demonstrate no over-allocation, no duplicate effect, and no cross-tenant link.

## Historical cutover invariant

At the approved cutover boundary, per counterparty: `legacy payment amount = legacy allocations (zero by default) + legacy unapplied amount`, and the opening ledger balance must reconcile independently to the cached balance. Legacy payments are tagged `legacy_unallocated` and excluded from post-cutover allocation and unapplied aggregates until one audited manual allocation reclassifies the exact amount. The reclassification reduces legacy-unallocated and creates the post-cutover allocation atomically, preventing double counting. Reports keep legacy and post-cutover columns separate; pre-event as-of reports do not show later manual allocations.

## Aging and temporal invariants

Future aging uses a due date snapshotted at invoice finalization. A later credit-term edit does not alter finalized invoices. As-of date is explicit; boundaries are current/not-yet-due, 1-30, 31-60, 61-90, and >90 days based on due date. Allocations, adjustments, refunds, and reversals use their effective date only when the report's as-of date includes the recorded event. Reports must show both effective date and recorded timestamp and must not backdate knowledge.

Payment creation, allocation, allocation reversal, completed refund, payment reversal, credit note, and invoice adjustment affect strict as-of reports only when recorded by the as-of timestamp. A refund request has no balance effect. A backdated event recorded later is excluded from a strict knowledge-as-of report and may appear only in an explicitly labelled restatement.

## Scope

Bounded AR/AP only; no claim of cash/bank reconciliation, general ledger, or full double-entry accounting.
