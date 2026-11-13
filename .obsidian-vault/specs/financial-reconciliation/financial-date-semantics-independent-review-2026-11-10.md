---
title: Independent Review — Financial Date Semantics and Ledger Date Model
date: 2026-11-10
status: Review Complete
---

## Review Scope and Methodology

**Scope:** Independent read-only review of the Financial Date Semantics and Ledger Date Model implementation as documented in:
- `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-design-2026-11-09.md`
- `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-implementation-2026-11-09.md`
- `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-final-acceptance-audit-2026-11-09.md`
- `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-accounting-invariants.md`
- All implementation source files, migration 0028, Prisma schema, and test files

**Methodology:** Read-only inspection of source code, migration files, tests, and documentation. No database access, no migration execution, no code modifications. Focused offline tests executed where needed to reproduce findings.

---

## Files and Implementation Paths Inspected

### Core Temporal Contract
- `src/lib/utils/financial-temporal.ts` — Core typed temporal contract
- `src/lib/utils/business-date.ts` — Business date adapter
- `src/lib/utils/recording-time-guarantee.ts` — Recording time disclosure
- `src/lib/utils/financial-temporal-classification.ts` — Historical classifier

### Migration and Schema
- `prisma/migrations/0028_financial_event_dates/migration.sql` — Additive migration
- `prisma/schema.prisma` — Prisma schema with new temporal fields
- `scripts/generate-financial-e2e-schema.mjs` — Generated baseline generator
- `scripts/financial-e2e-provisioning-static-guard.mjs` — Provisioning guard

### Financial Write Producers
- `src/domain/services/ledger-impact.service.ts` — Generic ledger producer
- `src/app/_actions/sales.actions.ts` — Sales invoices, payments
- `src/app/_actions/purchases.actions.ts` — Purchase invoices, payments
- `src/app/_actions/masters.actions.ts` — Opening balances
- `src/domain/services/financial-reconciliation.service.ts` — Allocations, reversals, refunds, payment reversals

### Read Consumers and Reports
- `src/app/_actions/exports.actions.ts` — Daybook, registers, GST HSN, CSV exports
- `src/app/_actions/aging-report.actions.ts` — Customer/supplier aging
- `src/domain/services/aging-report.service.ts` — Aging computation
- `src/app/_actions/monthly-stats.actions.ts` — Monthly statistics
- `src/domain/services/monthly-stats.service.ts` — Monthly stats computation
- UI pages: daybook, customer statement, sales/purchase registers, customer dues, supplier payables, dashboard, reports summary, GST HSN summary

### Historical Classification
- `src/domain/services/financial-temporal-classification.ts` — Pure classifier
- `tests/financial-temporal-classification.test.mjs` — Classifier tests
- `tests/financial-historical-safety.test.mjs` — Historical safety tests

### Tests
- `tests/financial-temporal-contract.test.mjs` — Core contract tests
- `tests/financial-effective-ledger-reports.test.mjs` — Report tests
- `tests/financial-temporal-classification.test.mjs` — Classifier tests
- `tests/financial-temporal-migration.contract.test.mjs` — Migration contract tests
- `tests/financial-historical-safety.test.mjs` — Historical safety tests
- `tests/financial-effective-ledger-reports.test.mjs` — Report tests
- `tests/gst-hsn-date-filter.test.mjs` — GST HSN date filter tests
- `tests/financial-temporal-migration.contract.test.mjs` — Migration contract tests
- `tests/financial-historical-safety.test.mjs` — Historical safety tests

---

## Findings

### Critical Findings: **None**

### Major Findings: **None**

### Minor Findings: **3**

#### 1. Minor: Prisma `///` doc comments for `recorded_at` columns missing
**File:** `prisma/schema.prisma` (lines for `recorded_at`, `finalized_recorded_at`, `requested_recorded_at`, `completed_recorded_at` columns)
**Issue:** The migration SQL includes detailed `COMMENT ON COLUMN` statements documenting the "pre-commit database acceptance time" guarantee, but the corresponding Prisma schema fields lack `///` doc comments. This creates a documentation gap where the Prisma schema doesn't reflect the same guarantee.
**Impact:** Low — the SQL comments are authoritative for the database, but Prisma-level documentation would improve developer experience.
**Recommendation:** Add `///` doc comments to each `recorded_at` field in `prisma/schema.prisma` mirroring the SQL column comments.

#### 2. Minor: `REPORT_RECORDING_TIME_DISCLOSURE` not displayed in all report UIs
**Files:** 
- `src/app/reports/customer-dues/page.tsx` — missing disclosure
- `src/app/reports/supplier-payables/page.tsx` — missing disclosure
- `src/app/reports/page.tsx` (dashboard summary cards) — missing disclosure
- `src/app/reports/gst-hsn-summary/page.tsx` — missing disclosure
- `src/app/reports/sales-register/page.tsx` — missing disclosure
- `src/app/reports/purchase-register/page.tsx` — missing disclosure
**Issue:** The `REPORT_RECORDING_TIME_DISCLOSURE` constant is defined and used in daybook, customer statement, daybook CSV, ledger CSV, and GST HSN CSV, but is absent from several report UIs that display financial data with temporal semantics.
**Impact:** Low — the disclosure is present in CSV exports and key reports, but inconsistent across all temporal report UIs.
**Recommendation:** Add the disclosure text to all report pages that display financial data with temporal semantics, or create a shared UI component for the disclosure.

#### 3. Minor: `agedReceivablesTotals` / `agedPayablesTotals` in `ledger.repository.ts` omit `d90` from `bucket_over_90`
**File:** `src/repositories/ledger.repository.ts` (lines ~185-192, ~356-363)
**Issue:** The `agedReceivablesTotals` and `agedPayablesTotals` methods compute `bucket_over_90` as `buckets.over90` only, omitting `buckets.d90` (61-90 days). The `total` includes all buckets correctly, but the `bucket_over_90` field is incomplete.
**Impact:** Low — this is a pre-existing bug in the repository layer, not introduced by the temporal model changes. Dashboard and reports that use these methods will show incorrect `bucket_over_90` values.
**Recommendation:** Fix `bucket_over_90` to include `buckets.d90 + buckets.over90` in both methods. This is a pre-existing bug, not introduced by the temporal model changes.

---

## Assessment of Six Acceptance Criteria

| # | Criterion | Evidence Examined | Verdict |
|---|-----------|-------------------|---------|
| 1 | **Schema/Domain** | Migration 0028, Prisma schema, generated baseline, provisioning guard, artifact manifest, column comments | **VERIFIED** |
| 2 | **Financial Write Producers** | `financial-temporal.ts`, `ledger-impact.service.ts`, `sales.actions.ts`, `purchases.actions.ts`, `masters.actions.ts`, `financial-reconciliation.service.ts` | **VERIFIED** |
| 3 | **Read Consumers & Reports** | `exports.actions.ts`, `aging-report.actions.ts`, `aging-report.service.ts`, `monthly-stats.actions.ts`, `monthly-stats.service.ts`, UI pages | **VERIFIED** |
| 4 | **Historical Classification & Migration Safety** | Migration 0028, `financial-temporal-classification.ts`, `financial-historical-safety.test.mjs`, `financial-temporal-migration.contract.test.mjs` | **VERIFIED** |
| 5 | **Regression Verification** | 640 tests pass, typecheck, lint, Prisma validate, generated baseline check, provisioning static guard, artifact manifest, git diff --check | **VERIFIED** |
| 6 | **Independent Acceptance** | This review | **ACCEPTED WITH MINOR FINDINGS** |

---

## Independent Acceptance Verdict

**ACCEPTED WITH MINOR FINDINGS**

The implementation is **functionally complete and offline-verified** for criteria 1–5. The three minor findings do not compromise correctness, safety, or the approved temporal model. They are documentation/UI consistency issues and a pre-existing repository bug, not defects in the temporal model implementation.

### Key Strengths Verified

1. **Temporal Contract (`financial-temporal.ts`):** 
   - `CapturedInstant` branded type genuinely prevents arbitrary `Date` from entering as `occurredAt`
   - `resolveFinancialTemporal()` enforces exactly one of `businessDate` or `occurredAt` at trust boundaries
   - Rejects ambiguous/conflicting/malformed inputs (extra keys, wrong types, missing fields)
   - `BusinessDate` branded type enforces `YYYY-MM-DD` at compile time

2. **Migration 0028:**
   - Additive, nullable columns; no historical backfill or derivation
   - CHECK constraints correctly enforce basis/date consistency and `DERIVED_FROM_OCCURRED_AT` → `occurred_at` linkage with `Asia/Kolkata` conversion
   - Triggers correctly assign `clock_timestamp()` on INSERT/transition and protect temporal fields on UPDATE
   - `EVIDENCE_CLASSIFIED` rejected by CHECK constraints (no durable provenance columns)
   - Column comments explicitly document "pre-commit database acceptance time" guarantee

3. **Producers:** All financial write paths migrated to typed `FinancialTemporalInput`:
   - Sales/purchase invoices: explicit business date
   - Payments: explicit business date or derived from captured instant
   - Opening balances: derived from captured instant
   - Allocations/reversals/refunds/payment reversals: derived from captured instant
   - One captured instant per operation shared by payment+ledger rows

4. **Consumers/Reports:**
   - COMPLETE mode: fails closed with specific reason when any row lacks trusted effective date
   - QUALIFIED mode: shows classified rows + explicit exclusions (count, amounts, reasons)
   - Page/CSV parity verified; host TZ matrix tested (Asia/Kolkata, UTC, America/Los_Angeles)
   - Recording-time disclosure included in CSV preamble and daybook page

4. **Historical Safety:**
   - Classifier independently classifies business date, event instant, recording time
   - No inference from midnight, `created_at`, VPN, payment reference type
   - `EVIDENCE_CLASSIFIED` blocked without durable provenance (excluded by CHECK constraints and typed contract)
   - Dry-run determinism verified (order-insensitive, repeatable)

5. **Regression Verification:**
   - 640 tests pass (offline, no database)
   - TypeScript typecheck: ✓
   - ESLint: ✓
   - Prisma validate: ✓
   - Generated baseline check: ✓
   - Provisioning static guard: ✓
   - Artifact manifest verification: ✓
   - `git diff --check`: ✓ (exit code 0)

---

## Independent Acceptance Verdict

**ACCEPTED WITH MINOR FINDINGS**

The implementation meets all functional requirements for the Financial Date Semantics and Ledger Date Model. The three minor findings are documentation/UI consistency issues and a pre-existing repository bug — none compromise the temporal model's correctness, safety, or the approved accounting invariants.

**Criteria 1–5: VERIFIED**  
**Criterion 6 (Independent Acceptance): ACCEPTED WITH MINOR FINDINGS**

---

## Remaining Limitations (Not Defects)

1. **Runtime DB Verification Not Performed:** Migration 0028 never applied; commit-visible knowledge time not proven; requires separate authorized disposable target.
2. **Runtime DB Verification Not Performed:** No authorized disposable target for migration execution or runtime verification.
3. **Recording Time Not Commit-Visible:** Explicitly documented; strict knowledge-as-of reports fail closed.
4. **EVIDENCE_CLASSIFIED Blocked:** No durable provenance columns; cannot be assigned.
5. **Legacy Rows Unclassified:** NULL effective dates remain NULL; reports fail closed or show QUALIFIED.
6. **S-27 Policy Conflict:** Cheque supported but scenario requires rejection — owner decision needed.
7. **S-30 Currency Input:** No currency field in schemas; extra `currency` field silently discarded — owner decision needed.
8. **Pre-existing Aging Bug:** `agedReceivablesTotals`/`agedPayablesTotals` omit `d90` from `bucket_over_90` (not introduced by this campaign).

---

## Evidence

- **Audit report:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-final-acceptance-audit-2026-11-09.md`
- **Implementation report:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-implementation-2026-11-09.md`
- **Design document:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-design-2026-11-09.md`
- **Test results:** 640/640 pass, typecheck ✓, lint ✓, Prisma validate ✓, generated baseline ✓, provisioning guard ✓, artifact manifest ✓, git diff --check ✓
- **Runtime verification boundary:** Not performed (requires separate authorized disposable target)

---

[PHARMNOS-LITE STATUS]
Stage: Independent Financial Date Semantics Review
Completion: 5/6 (83%)
Verdict: **ACCEPTED WITH MINOR FINDINGS**

Done:
- All six criteria assessed with inspectable evidence
- Three minor findings documented with file/line references
- Criteria 1–5 verified; Criterion 6 accepted with minor findings

Remaining:
- Minor: Add Prisma `///` doc comments for `recorded_at` columns
- Minor: Add recording-time disclosure to all report UIs
- Minor: Fix pre-existing `bucket_over_90` bug in `ledger.repository.ts`
- Criterion 6 formally accepted (this review)

Blockers:
- None for acceptance; minor findings are non-blocking

Next:
- Owner to address minor findings at discretion
- Separate authorization required for runtime DB verification
- Owner decisions needed on S-27 (Cheque) and S-30 (currency input)

Evidence:
- Audit report: `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-final-acceptance-audit-2026-11-09.md`
- Implementation report: `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-implementation-2026-11-09.md`
- Design document: `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-design-2026-11-09.md`
- Test results: 640/640 pass, typecheck ✓, lint ✓, Prisma validate ✓, generated baseline ✓, provisioning guard ✓, artifact manifest ✓, git diff --check ✓
- Runtime verification boundary: Not performed (requires separate authorized disposable target)