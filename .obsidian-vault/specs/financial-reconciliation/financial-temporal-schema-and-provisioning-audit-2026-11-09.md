---
title: Financial temporal schema, migration and provisioning audit
date: 2026-11-09
status: Static audit complete - runtime not performed
---

## Goal

Audit migration `0028_financial_event_dates`, `prisma/schema.prisma`, the generated empty-schema baseline, review artifacts, manifest, provisioner and static guard for additive compatibility, honest recorded-time semantics, provenance safety and tenant-control coverage. No database was accessed; nothing here is runtime, Auth, browser or concurrency evidence.

## Acceptance Criteria

- [x] Migration is additive: nullable columns, no defaults, no drops/renames, no historical `UPDATE`/backfill (static guard and tests).
- [x] No fabricated `occurred_at` or `recorded_at`: triggers only assign `recorded_at`-family columns, never dates or instants.
- [x] AMBIGUOUS, UNCLASSIFIED and never-classified NULL are three distinct stored states.
- [x] EVIDENCE_CLASSIFIED is rejected by every basis CHECK, is not producible by the typed contract, and no evidence-reference column exists.
- [x] Every recorded-time column carries an honest SQL `COMMENT` and Prisma `///` doc; schema, migration, baseline, manifest and guards agree.
- [x] Tenant controls (grants, RLS review, provisioner) cover `payment_allocations`, `allocation_reversals`, `payment_refunds` and `payment_reversals`. The review artifact's required-table list omitted them (earlier gap): closed and now enforced by the guard.
- [ ] Runtime proof on a disposable target (not authorized, not performed).

## Recorded-time guarantee

`recorded_at`, `finalized_recorded_at`, `requested_recorded_at` and `completed_recorded_at` hold `clock_timestamp()` assigned inside a `BEFORE INSERT` (or status-transition) trigger. It is the database server wall clock **while the statement executes in a still-open transaction, before commit**. It is **not** commit-visible time, **not** commit order, and **not** proof of what was known or visible at that instant. Wall-clock values need not be monotonic and are rounded to milliseconds (`TIMESTAMPTZ(3)`).

- Callers cannot supply it: any non-NULL value on INSERT raises `42501`; application code never writes these columns.
- UPDATE cannot rewrite it: `protect_financial_recorded_at` (six event tables), `guard_invoice_financial_dates` (both invoices) and `guard_refund_financial_dates` (refunds) reject any change. Runtime role is `NOSUPERUSER`, does not own the tables, so it cannot disable triggers.
- Finalization/completion times are set only on the transition into FINALIZED/COMPLETED (or an INSERT already FINALIZED).
- `audit_logs.created_at` and legacy `*_at @default(now())` columns (`allocated_at`, `reversed_at`, `requested_at`) are independent timestamps with their own semantics; asynchronous audit writes carry their own `created_at` and are not tied to `recorded_at`.
- Name kept (`recorded_at`); the guarantee is documented in SQL comments, Prisma docs and `src/lib/utils/recording-time-guarantee.ts` (`RECORDING_TIME_GUARANTEE = "DB_STATEMENT_EXECUTION_PRE_COMMIT"`, `RECORDING_TIME_DISCLOSURE`).

## Mixed-version behaviour

An old application (no temporal fields) writing after 0028 produces rows with NULL `effective_date`, `effective_date_basis` and `occurred_at`, plus a database-assigned recorded time. These rows are unclassified-by-NULL; reports must exception them and must not treat them as classified. They remain distinguishable from pre-0028 rows (all NULL, including recorded time). No default classifies them, no NOT NULL guard rejects them, and no trigger rejects NULL dates. Rollback is a read switch only: all new columns and evidence are retained.

## Historical classification matrix

Rule for every row: no safe classification exists without durable evidence, so legacy rows stay NULL (unknown). `created_at`, midnight appearance, `entry_date` shape, VPN or reference type are not evidence. Consumers must exception NULL/AMBIGUOUS/UNCLASSIFIED/EVIDENCE_CLASSIFIED rows and never guess.

| Entity / table | Legacy source columns | Safe classification rule | Unclassifiable cases | Consumer behaviour |
|---|---|---|---|---|
| `sales_invoices` | `invoice_date`, `due_date`, `status`, `created_at` | None without evidence. | Every pre-0028 invoice; finalized rows are immutable for `effective_date`/`due_date_business` so they can never be set later. | Fail closed on NULL effective/due date; invoice registers, aging and monthly summaries exception or disable. |
| `purchase_invoices` | `invoice_date`, `due_date`, `status`, `created_at` | None without evidence. | Same as sales. | Same as sales. |
| `payments` | `payment_date`, `created_at`, `reference_no` | None; a legacy `payment_date` may be a UTC-midnight marker or an instant with no provenance. | All pre-0028 rows; rows by old writers after 0028 (NULL basis, recorded time present). | Payment credit/advance date nullable; legacy replay without source provenance fails closed. |
| `customer_ledgers` | `entry_date`, `created_at`, `entry_type` | None; `entry_date` mixes date markers and instants with no per-row provenance. | All pre-0028 rows and old-writer rows. | Daybook/statements exception unknown dates; effective-date readers trust only EXPLICIT and DERIVED_FROM_OCCURRED_AT with a consistent instant. |
| `supplier_ledgers` | `entry_date`, `created_at`, `entry_type` | Same as customer ledgers. | Same. | Same. |
| `payment_allocations` | `allocated_at`, `created_at`, `legacy_unallocated` | None; `allocated_at` defaults to insert time, not a business fact. | All pre-0028 rows (including `legacy_unallocated`). | Allocation date unknown; no as-of reconstruction from them. |
| `allocation_reversals` | `reversed_at`, `created_at` | None. | All pre-0028 rows. | Same. |
| `payment_reversals` | `reversed_at`, `created_at` | None. | All pre-0028 rows. | Same. |
| `payment_refunds` | `requested_at`, `approved_at`, `rejected_at`, `completed_at`, `cancelled_at` | None; request and completion are separate events with separate fields, and completed facts only attach on the COMPLETED transition. | Pre-0028 requests and completions; completions by old writers (NULL completed date/basis, recorded time present). | Completion date unknown unless basis is EXPLICIT/DERIVED with a consistent instant. |
| Opening-balance ledger rows | `entry_date`, `entry_type = OPENING_BALANCE`, `created_at` | None; an opening date supplied at the time was a business date, but legacy rows do not record which. | All pre-0028 opening rows; new rows are EXPLICIT (supplied) or DERIVED (undated) via the typed contract. | Treated like other ledger rows; exceptioned when basis is NULL. |

## Residual limitations

- No runtime migration, trigger, CHECK, RLS, restricted-role or mixed-version proof; static guards and string/parse tests only.
- Recorded time is pre-commit; strict commit-visible as-of reporting remains unsupported.
- NULL to AMBIGUOUS/UNCLASSIFIED reclassification of a legacy row is blocked by the immutability triggers (unknown stays NULL); AMBIGUOUS/UNCLASSIFIED are only representable on new rows.
- No CHECK ties `requested_business_date`, allocation/reversal `effective_date` to their `occurred_at`; producers derive both from one instant (typed contract) but the database does not enforce it.
- `payment_receipt_sequences` is not listed in the security review artifact's required-table block (pre-existing, outside temporal scope; the connected provisioner applies its policies and grants).
- Insert-time NOT NULL guards are intentionally absent (old-writer compatibility); bypass protection is application-level plus producer static guards.
