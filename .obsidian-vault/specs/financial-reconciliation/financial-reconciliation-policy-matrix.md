---
title: Financial Reconciliation Policy Matrix
date: 2026-11-08
status: Pending Owner Approval
---

| Policy area | Current behavior | Recommended policy | Owner approval | Implementation impact |
|---|---|---|---|---|
| Allocation | Account-level payments; active actions write no allocation | Manual allocation; many-to-many payment/invoice support; partial allocation | Pending | Add allocation records, locks, guarded transactions, and open-item reporting |
| Advances/unallocated money | No advance model; excess payments rejected | Separate customer credit and supplier advance; no settlement without allocation | Pending | Derive usable/unallocated balances and report separately |
| Overpayments | Rejected above account dues | Explicit choice: retain credit, allocate elsewhere, or refund | Pending | Prevent negative invoice balances; add choice workflow |
| Refunds | Not implemented | Distinct immutable refund linked to source payment/credit | Pending | Add refund linkage, limits, compensating ledger effect |
| Invoice adjustments | Note enum exists but no complete workflow | Separate credit/debit note or adjustment from cash refund | Pending | Add invoice adjustment source and reconciliation rules |
| Reversals | Posted payment mutation blocked; no reversal action | Immutable compensating reversal/repost | Pending | Add source linkage, reason, idempotency, and audit |
| Aging | Ledger entry-date buckets; credits skipped | Due-date open-item aging after allocations/adjustments | Pending | Capture/derive due dates and calculate remaining invoice exposure |
| Authoritative balance | Cached counterparty balance plus ledger; invoice fields stale | Immutable source + allocations/adjustments authoritative; caches are projections | Pending | Add reconciliation checks and projection refresh rules |
| Ledger scope | Bounded AR/AP subledgers | Keep AR/AP; no general-ledger redesign | Pending | Limit acceptance claims and test scope |
| Database integrity | Tenant validation mostly application-level; limited payment idempotency | PostgreSQL structural backstops plus application transactional policy | Pending | Add constraints/FKs/triggers only after data audit and approval |
| Stock changes | Prior campaign added concurrency/atomicity safeguards | Retain separately from accounting acceptance | Pending | Separate inventory evidence and acceptance criterion |
| Balance terminology | Prior text conflated gross exposure, credit/advance, and net position | Report gross exposure, unapplied amount, and signed net position separately | Pending | Normalize equations and reports |
| Refund after allocation | No workflow | Reverse allocation before completed refund in one transaction | Pending | Refund linkage, bounded totals, idempotency |
| Refund request | Not implemented | Request records intent; completion changes money only after approval | Pending | State model and approval evidence |
| Allocation concurrency | No allocation model | Deterministic parent-row locks and post-lock aggregate reread | Pending | PostgreSQL transaction and race tests |
| Historical cutover | No cutover boundary | Preserve legacy-unallocated records; no inferred allocations; signed opening reconciliation | Pending | Cutover timestamp, labels, manual-allocation audit |
| Aging temporal basis | Entry-date ledger buckets; no due-date snapshot | Finalized due-date snapshot; explicit as-of date and effective/recorded timestamps | Pending | Due-date fields and historical report rules |
| Payment method fidelity | Unknown values map to CREDIT in `paymentMethodToPrismaMode` | Reject unknown values or require explicit supported mapping | Pending | Validation and mapping tests |
| Receipt numbering | `count + 1` per tenant | Serialized tenant sequence plus unique constraint | Pending | Sequence migration and concurrency test |
| Currency | No currency model in payment/invoice records | Single-currency boundary; reject unsupported mismatch | Pending | Explicit validation and UI disclosure |
| Credit transfer | No transfer workflow | Prohibit cross-counterparty transfers unless separately approved | Pending | Permission, audit, and source linkage |
| Shared lock protocol | No allocation/refund/reversal model | All future workflows lock `(tenant_id, parent_kind, parent_id)` ascending; sorted invoices; reread aggregates after locks | Pending | Common transaction helper and pairwise race tests |
| Historical double counting | No cutover model | `legacy_unallocated` records are excluded from post-cutover aggregates until one audited reclassification | Pending | Opening reconciliation and report separation |
| Aging event timing | Entry-date-only reporting | Strict as-of includes events recorded by T only; later-recorded backdated events require labelled restatement | Pending | Effective/recorded timestamps and event-specific tests |
