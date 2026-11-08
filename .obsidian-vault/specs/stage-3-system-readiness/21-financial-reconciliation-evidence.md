---
title: Pharmnos Lite Stage 3 Financial Reconciliation Evidence
date: 2026-11-07
status: Partial acceptance — current-source disposable evidence
---

# Evidence

Current-source disposable Purchase GST evidence reconciled accepted snapshots
to invoice totals, canonical line values, supplier ledger credits, stock
movements, posting operations, audit metadata, and request payload hashes.
The 16/16 Purchase GST run also covered duplicate/concurrent finalization,
rollback, retry, discrepancy hold, and cross-tenant denial.

Current-source Sales evidence covered finalization, immutable invoice snapshots,
GST records, stock deduction, customer ledger effects, duplicate/retry/conflict
rollback, payment posting, and finalized mutation rejection.

The fresh current-source Purchase GST application run passed 16/16 and
reconciled accepted snapshots to canonical invoice/line totals, GST
components, received stock and stock movements, supplier ledger postings,
audit metadata, payload hashes, idempotency, retry, concurrency, rollback,
and tenant isolation. Runtime role attributes remained `LOGIN`,
`NOSUPERUSER`, and `NOBYPASSRLS`.

The complete sanitized target-bound artifact is
`26-authorized-disposable-runtime-evidence.json`. This evidence supports the
exercised persisted paths only; it does not establish professional or
statutory accounting acceptance.

## Controlled current-release acceptance map

| Scenario | Disposition | Evidence and limitation |
|---|---|---|
| Purchase GST totals, stock, supplier ledger, audit, retry, rollback, and tenant isolation | Supported and target-bound verified | `26-authorized-disposable-runtime-evidence.json` and `27-current-source-targeted-runtime-evidence.json`; action-path evidence, not browser proof. |
| Sales GST finalization, invoice snapshot, stock, customer ledger, retry, rollback, and immutable history | Supported and target-bound verified for exercised scenarios | `27-current-source-targeted-runtime-evidence.json`; bounded synthetic coverage. |
| Payment within outstanding balance and overpayment rejection | Supported and fail-closed | Current source and focused remediation contract; no unapplied-credit or allocation workflow is claimed. |
| Fully recoverable GST valuation | Supported with explicit classification inputs | `inventory-valuation.service.test.mjs`; recoverable GST is excluded from acquisition cost. This is software behavior, not statutory eligibility confirmation. |
| Nonrecoverable GST valuation | Supported with explicit classification inputs | `inventory-valuation.service.test.mjs`; nonrecoverable GST is included in acquisition cost. |
| Partial GST recovery valuation | Supported with explicit split and reconciliation | `inventory-valuation.service.test.mjs`; split must reconcile to accepted GST. |
| Unresolved GST eligibility/evidence | Supported safe limitation | Remains `PENDING` with null valuation, not assumed recoverable or nonrecoverable. |
| Free quantity, goods receipt semantics, and statutory ITC eligibility automation | Not accepted in current release; policy/V2 dependent | No new ITC engine or receipt workflow was implemented. |
| Credit/debit notes, RCM, e-invoicing/e-way bills, GST returns, imports/exports, SEZ/UIN, multiple registrations | Not applicable to current release — deferred to V2 | No implementation, schema, API, permission, or migration added. |

# Remaining limits

Inventory acquisition cost remains pending without governed ITC eligibility,
recoverability, freight/discount allocation, and statutory rounding policy.
The evidence is not professional or statutory confirmation. Credit/debit notes,
e-invoicing, returns, and other deferred workflows remain outside this release.

The prior target was positively identified by immutable contract and Compose
labels, then disposed through contract-bound cleanup. Its container and project
were verified absent; unrelated stopped containers were preserved.
