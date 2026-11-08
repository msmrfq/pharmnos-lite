---
title: Financial Reconciliation Architecture
date: 2026-11-08
status: Documented - Pending Owner Approval
---

## Goal
Record the actual money lifecycle without introducing a new accounting architecture.

## Existing lifecycle

### Sales / receivables
1. A draft is created in `sales_invoices`.
2. Finalization persists the invoice, stock effects, one customer-ledger debit, and the cached customer receivable in one transaction.
3. A customer payment creates one `payments` row, one customer-ledger credit, and reduces the cached receivable under a customer-row lock.
4. Payments are account-level. No allocation row is created and payment actions do not update `sales_invoices.paid_amount` or `balance_due`.

### Purchases / payables
1. A draft is created in `purchase_invoices`.
2. Finalization persists the invoice, stock effects, one supplier-ledger credit, and the cached supplier payable in one transaction.
3. A supplier payment creates one `payments` row, one supplier-ledger debit, and reduces the cached payable under a supplier-row lock.
4. Supplier payments have no purchase-invoice foreign key or allocation.

## Persistence model
- `payments` is a polymorphic payment record with optional customer/supplier and a sales-only optional invoice reference.
- `customer_ledgers` and `supplier_ledgers` are AR/AP subledgers with debit, credit, and running balance.
- Counterparty `receivable_balance` and `payable_balance` are denormalized cached balances.
- There is no chart of accounts, journal header/line model, cash/bank account model, allocation table, refund/reversal model, or financial-period model.

## Ownership boundaries
- Sales and purchase actions currently own posting logic directly.
- `ledger-impact.service.ts` contains parallel posting helpers but is not the active action-path owner.
- Payment idempotency is tenant-scoped and payload-hash protected.
- Payment records are now repository-immutable; a reversal workflow is not yet implemented.

## Verification state
Static contract tests and bounded disposable runtime evidence verify selected transaction paths. They do not prove complete invoice allocation, true invoice aging, reversal/refund behavior, general-ledger accounting, or production readiness.

## Proposed future policy boundary (Pending)

If approved, allocation records will connect immutable source payments to sales or purchase invoices. Gross exposure, unapplied credit/advance, and signed net position will be separate projections. Refunds after allocation will reverse the affected allocation before recording completed cash refund in one atomic transaction. Historical pre-cutover payments will remain legacy-unallocated unless manually allocated with evidence; no historical allocation will be inferred.

Future allocation, refund, allocation-reversal, and payment-reversal transactions must use one deterministic lock order: `(tenant_id, parent_kind, parent_id)` ascending, locking payment, all sorted invoice parents, and any counterparty projection parent required by the operation. They must reread allocations, refunds, reversals, adjustments, and balances after locking, enforce tenant ownership, and commit all effects atomically. A PostgreSQL `CHECK` cannot enforce a cross-row allocation sum, and a trigger alone is not concurrency-safe without this serialization. These are proposals, not implemented behavior.

Payment methods remain descriptive labels, not cash/bank settlement evidence. Unknown methods must be rejected in a future implementation. Current receipt numbering is count-based and not concurrency-safe. Current aging is ledger-entry-date based rather than due-date open-item aging.

Pre-cutover payments are proposed to be tagged `legacy_unallocated`, excluded from post-cutover allocation aggregates, and reclassified only by an audited manual allocation. Opening ledger, cached balance, payment, and invoice-field evidence remains separate from post-cutover allocations. Strict as-of aging excludes events recorded after the as-of timestamp, including backdated events; restatements must be labelled.

## Out of Scope
Recovery/PITR, provider backup work, general-ledger redesign, GST filing/ITC automation, and production database operations.
