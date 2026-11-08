---
title: Financial Reconciliation Policy Matrix
date: 2026-11-08
status: Owner Approved Policy - Implementation Incomplete
---

The table below preserves initial-audit behavior and proposed impacts as historical context. Owner approval of Decisions A–O and the 13 scenario resolutions is reflected below; it does not prove implementation or runtime acceptance. See the [decision log](./financial-reconciliation-decision-log.md) and [scenario matrix](./financial-reconciliation-scenario-matrix.md) for the approved terms.

Commercial credit notes exceeding the invoice balance require review, do not post while pending, and on approval apply up to outstanding with the approved excess becoming linked, audited unapplied credit. Rejection leaves balances unchanged. This is not a GST or tax workflow. An approved commercial debit adjustment of ₹100 reducing supplier gross payable ₹2,000 yields ₹1,900. Neither approval establishes that these workflows exist.

| Policy area | Current behavior | Recommended policy | Owner approval | Implementation impact |
|---|---|---|---|---|
| Allocation | Account-level payments; active actions write no allocation | Manual allocation; many-to-many payment/invoice support; partial allocation | Owner-approved | Add allocation records, locks, guarded transactions, and open-item reporting |
| Advances/unallocated money | No advance model; excess payments rejected | Separate customer credit and supplier advance; no settlement without allocation | Owner-approved | Derive usable/unallocated balances and report separately |
| Overpayments | Rejected above account dues | Explicit choice: retain credit, allocate elsewhere, or refund | Owner-approved | Prevent negative invoice balances; add choice workflow |
| Refunds | Not implemented | Distinct immutable refund linked to source payment/credit | Owner-approved | Add refund linkage, limits, compensating ledger effect |
| Invoice adjustments | Note enum exists but no complete workflow | Separate credit/debit note or adjustment from cash refund | Owner-approved | Add invoice adjustment source and reconciliation rules |
| Reversals | Posted payment mutation blocked; no reversal action | Immutable compensating reversal/repost | Owner-approved | Add source linkage, reason, idempotency, and audit |
| Aging | Ledger entry-date buckets; credits skipped | Due-date open-item aging after allocations/adjustments | Owner-approved | Capture/derive due dates and calculate remaining invoice exposure |
| Authoritative balance | Cached counterparty balance plus ledger; invoice fields stale | Immutable source + allocations/adjustments authoritative; caches are projections | Owner-approved | Add reconciliation checks and projection refresh rules |
| Ledger scope | Bounded AR/AP subledgers | Keep AR/AP; no general-ledger redesign | Owner-approved | Limit acceptance claims and test scope |
| Database integrity | Tenant validation mostly application-level; limited payment idempotency | PostgreSQL structural backstops plus application transactional policy | Owner-approved | Add constraints/FKs/triggers only after data audit and approval |
| Stock changes | Prior campaign added concurrency/atomicity safeguards | Retain separately from accounting acceptance | Owner-approved | Separate inventory evidence and acceptance criterion |
| Balance terminology | Prior text conflated gross exposure, credit/advance, and net position | Report gross exposure, unapplied amount, and signed net position separately | Owner-approved | Normalize equations and reports |
| Refund after allocation | No workflow | Reverse allocation before completed refund in one transaction | Owner-approved | Refund linkage, bounded totals, idempotency |
| Refund request | Not implemented | Request records intent; completion changes money only after approval | Owner-approved | State model and approval evidence |
| Allocation concurrency | No allocation model | Deterministic parent-row locks and post-lock aggregate reread | Owner-approved | PostgreSQL transaction and race tests |
| Historical cutover | No cutover boundary | Preserve legacy-unallocated records; no inferred allocations; signed opening reconciliation | Owner-approved | Cutover timestamp, labels, manual-allocation audit |
| Aging temporal basis | Entry-date ledger buckets; no due-date snapshot | Finalized due-date snapshot; explicit as-of date and effective/recorded timestamps | Owner-approved | Due-date fields and historical report rules |
| Payment method fidelity | Unknown values map to CREDIT in `paymentMethodToPrismaMode` | Reject unknown values or require explicit supported mapping | Owner-approved | Validation and mapping tests |
| Receipt numbering | `count + 1` per tenant | Serialized tenant sequence plus unique constraint | Owner-approved | Sequence migration and concurrency test |
| Currency | No currency model in payment/invoice records | Single-currency boundary; reject unsupported mismatch | Outside A-O; not newly approved | Explicit validation and UI disclosure |
| Credit transfer | No transfer workflow | Prohibit cross-counterparty transfers unless separately approved | Outside A-O; not newly approved | Permission, audit, and source linkage |
| Shared lock protocol | No allocation/refund/reversal model | All future workflows lock `(tenant_id, parent_kind, parent_id)` ascending; sorted invoices; reread aggregates after locks | Owner-approved | Common transaction helper and pairwise race tests |
| Historical double counting | No cutover model | `legacy_unallocated` records are excluded from post-cutover aggregates until one audited reclassification | Owner-approved | Opening reconciliation and report separation |
| Aging event timing | Entry-date-only reporting | Strict as-of includes events recorded by T only; later-recorded backdated events require labelled restatement | Owner-approved | Effective/recorded timestamps and event-specific tests |
