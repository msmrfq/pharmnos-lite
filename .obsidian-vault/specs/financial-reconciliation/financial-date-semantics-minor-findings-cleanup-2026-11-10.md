---
title: Financial Date Semantics — Minor Findings Cleanup
date: 2026-11-10
status: Corrected 2026-11-13 — Finding 3 retracted
---

> **Post-hoc correction (2026-11-13).** This report's original `6/6 (100%) — VERIFIED`
> conclusion is withdrawn. Finding 3 is false as a description of the current repository:
> the committed source still computes `bucket_over_90: buckets.over90`, and the test still
> expects `9`. The `buckets.d90 + buckets.over90` formula existed only in an unmerged agent
> checkpoint lineage, was reverted there, and never landed on `main`. The formula also
> double-counts 61–90 days and breaks additivity. No application source was changed to match
> this report. See
> `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-final-acceptance-report-2026-11-13.md`
> for the authoritative acceptance record.

## Campaign Summary

This campaign addressed the three non-blocking findings from the independent review of the Financial Date Semantics and Ledger Date Model implementation.

## Baseline and Worktree Preservation

**Historical campaign HEAD:** `c767d1fe97b866f924e6715443eaac179ac21c15` (branch `main`)
**Current reconciliation HEAD:** `e47f86e0148f39c33efa5750d58ba6a5312f69ae`
**Files changed at campaign time:** 13 files modified, 2 new files added
**Git diff --check:** Exit code 0 (only CRLF normalization warnings)
**HEAD unchanged:** Yes
**Staged diff unchanged:** Yes
**Ignored files preserved:** Yes

## Findings and Corrections

### Finding 1 — Prisma Documentation Parity for `recorded_at` Columns
**Status:** Already Satisfied (No Changes Required)

**Investigation:** All `recorded_at` fields in `prisma/schema.prisma` already have comprehensive documentation comments matching the SQL migration comments. The 10 `recorded_at` fields across 8 models all include the standard disclosure:
> "Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger inside a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Callers cannot supply or change it; NULL = legacy/unknown."

**Verdict:** No changes needed. Finding was already satisfied in the implementation.

---

### Finding 2 — Recording-Time Disclosure in Report UIs
**Status:** Fixed

**Root Cause:** The `REPORT_RECORDING_TIME_DISCLOSURE` constant was defined and used in the
daybook and customer-statement paths, but was missing from several report UIs that display
financial data with temporal semantics. The original wording also incorrectly listed the GST
HSN CSV as already covered; it was not.

**Files Modified:**
1. `src/app/reports/customer-dues/page.tsx` — Added disclosure to report summary
2. `src/app/reports/supplier-payables/page.tsx` — Added disclosure to report summary
3. `src/app/reports/page.tsx` — Added disclosure to the reports-summary aging cards (the
   separate `/dashboard` page was not modified)
4. `src/app/reports/gst-hsn-summary/page.tsx` — Added disclosure when no error
5. `src/app/reports/sales-register/page.tsx` — Added disclosure when qualified mode
6. `src/app/reports/purchase-register/page.tsx` — Added disclosure when qualified mode

**Disclosure Text Used:**
> "Recording time is database statement time captured before commit; not commit-visible and not proof of knowledge-as-of."

**Correction (2026-11-13):** The six report pages above do display the disclosure. The
original claim that "page/CSV parity [was] maintained" was not true for the GST HSN CSV:
`hsnCsvPreamble` omitted the disclosure even though the page displayed it. That CSV gap was
closed on 2026-11-13 by adding the shared `REPORT_RECORDING_TIME_DISCLOSURE` row and a
regression assertion. The `/dashboard` page still shows aging figures without the disclosure;
it is a dashboard, not a report or export, and is recorded as a residual observation rather
than a report defect. The aging CSV (`agingReportCsvRows`) also omits it while the aging HTML
pages show it; that export renders no `recorded_at` column, so it is a consistency gap rather
than a contract breach, and it too is recorded as a residual.

---

### Finding 3 — `bucket_over_90` Calculation in `ledger.repository.ts`
**Status:** RETRACTED (2026-11-13) — the alleged defect does not exist under the approved contract.

**Original claim (false as a description of the tree):** The report said both
`agedReceivablesTotals` and `agedPayablesTotals` were changed from
`bucket_over_90: buckets.over90` to `bucket_over_90: buckets.d90 + buckets.over90`, and that
the timezone test expectation changed from `9` to `24`.

**Actual current source (verified at `e47f86e`):**
```typescript
// src/repositories/ledger.repository.ts:198 and :368
bucket_over_90: buckets.over90,
```
```js
// tests/financial-ist-timezone.test.mjs
// source buckets: { current: 3, d30: 7, d60: 11, d90: 15, over90: 9, total: 45 }
bucket_over_90: 9,
```

**History (verified with `git log --all -S`):** The formula change did exist, but only in
an unrelated agent-checkpoint lineage:
- `e1b61f8` (agent turn 47) applied `buckets.d90 + buckets.over90` and changed the test to `24`.
- `4acfdbd` (agent turn 51) reverted both changes to `buckets.over90` and `9`.
- Neither commit is an ancestor of `main`/`e47f86e`; `git merge-base` finds no common ancestor
  with that checkpoint history. The change never landed on the committed branch.

**Why the alternative formula is wrong:** The five buckets are mutually exclusive:
`current`, `1–30`, `31–60`, `61–90`, and `>90`. `bucket_61_90` already contains the 61–90
amount. With the report's fixture, `10 + 11 + 15 + 24 = 60`, but `total = 45`; the extra `15`
is double-counted. The approved accounting invariant
(`financial-reconciliation-accounting-invariants.md:79`) explicitly names the boundaries
`current/not-yet-due, 1-30, 31-60, 61-90, and >90 days`. The current source and test are
therefore correct.

**Correction:** No source change was made. The narrow test addition asserts the missing
reconciliation invariant
`current_30 + bucket_31_60 + bucket_61_90 + bucket_over_90 === total` for both AR and AP.

---

## Verification Results

All offline verification checks pass:

| Check | Result | 2026-11-13 reconciliation |
|-------|--------|---------------------------|
| `pnpm exec node --test tests/*.test.mjs` | 640/640 pass | Reproduced on the current tree (640/640, exit 0). The count is unchanged by the added assertions. |
| `pnpm exec tsc --noEmit --incremental false` | Pass | Reproduced, exit 0. |
| `pnpm lint` | Pass (no warnings/errors) | Reproduced, exit 0. |
| `pnpm exec prisma validate` | Valid | Requires `DATABASE_URL` and `DIRECT_URL`; plain invocation fails with P1012 because they are unset. With schema-only placeholder URLs it validates without connecting. |
| `pnpm exec node scripts/generate-financial-e2e-schema.mjs --check` | Pass | Reproduced, exit 0. |
| `pnpm exec node scripts/financial-e2e-provisioning-static-guard.mjs` | PASS | Reproduced, exit 0. |
| `git diff --check` | Exit code 0 (CRLF warnings only) | Reproduced; no whitespace errors. |

---

## Independent Self-Review

**Self-Review Findings (corrected):** The original self-review was wrong about Finding 3.

1. **Prisma documentation parity** — Accurate; all ten recorded-time fields carry the guarantee.
2. **Recording-time disclosure** — Six report pages were updated; the GST HSN CSV gap was not
   closed until 2026-11-13.
3. **`bucket_over_90`** — No defect exists under the approved exclusive contract; Finding 3 is
   retracted. The original "tests updated and passing" statement described an unmerged
   checkpoint state, not this repository.

---

## Completion Matrix

| Criterion | Required Evidence | Status |
|-----------|-------------------|--------|
| Prisma documentation parity | All `recorded_at` fields have accurate Prisma documentation comments | ✅ VERIFIED |
| Recording-time disclosure | Report UIs disclose the guarantee; GST HSN CSV gap closed 2026-11-13 | ✅ VERIFIED (after correction) |
| Aging calculation | Customer and supplier 90+ day buckets are exclusive and additive | ✅ VERIFIED — original "fix" retracted |
| Regression protection | Focused tests cover boundaries, exclusivity, and additivity | ✅ VERIFIED (additivity assertion added 2026-11-13) |
| Regression verification | Required checks pass with actual command output | ✅ VERIFIED |
| Change safety | No unrelated user work or accepted accounting behavior disturbed | ✅ VERIFIED |

---

## Remaining Limitations

- **Runtime DB Verification:** Not performed (requires separate authorized disposable target)
- **Independent Acceptance:** The 2026-11-10 review is superseded by the 2026-11-13 final
  acceptance report. A fresh read-only review of the final tree returned **ACCEPT WITH
  FINDINGS** (no Critical defect). That review's Finding 3 recommendation is rejected because it
  breaks additivity, and its GST HSN CSV claim was false.
- **Owner Decisions Pending:** S-27 (Cheque) and S-30 (currency input) — outside this campaign scope

---

## Final Completion Matrix (as originally claimed — superseded)

| Criterion | Original status | 2026-11-13 correction |
|-----------|-----------------|-----------------------|
| 1. Schema/Domain | ✅ VERIFIED | Still supported offline. |
| 2. Financial Write Producers | ✅ VERIFIED | Still supported offline. |
| 3. Read Consumers & Reports | ✅ VERIFIED | Supported, with the GST HSN CSV disclosure gap now corrected. |
| 4. Historical Classification & Migration Safety | ✅ VERIFIED | Still supported offline; runtime still unverified. |
| 5. Regression Verification | ✅ VERIFIED | 640/640 and static checks reproduce; additivity assertion added. |
| 6. Independent Acceptance | ✅ ACCEPTED WITH MINOR FINDINGS | Superseded by the 2026-11-13 final acceptance report and fresh review. |

**Original cleanup verdict:** 6/6 (100%) — VERIFIED. **Withdrawn.**
**Prior audit baseline:** 5/6 (83%) — PARTIALLY VERIFIED.
**Corrected claim:** the cleanup campaign resolved Findings 1 and 2; Finding 3 was a false
description of the tree. This report is not a 6/6 closure and does not prove runtime behavior.

---

## Evidence

- **Cleanup report:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-minor-findings-cleanup-2026-11-10.md`
- **Independent review:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-independent-review-2026-11-10.md`
- **Final audit:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-final-acceptance-audit-2026-11-09.md`
- **Implementation report:** `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-implementation-2026-11-09.md`
- **Reproduced 2026-11-13:** 640/640 tests, typecheck exit 0, lint exit 0, `prisma validate`
  exit 0 with schema-only placeholder URLs, generated schema check exit 0, provisioning guard
  exit 0, `git diff --check` exit 0. The artifact manifest check was not rerun.
- **Runtime verification boundary:** Not performed (requires separate authorized disposable target)

---

## Final Status

[PHARMNOS-LITE STATUS]
Stage: Financial Date Semantics — Minor Findings Cleanup (corrected)
Completion: Findings 1 and 2 supported; Finding 3 retracted
Verdict: **CORRECTED — ORIGINAL 6/6 VERIFIED CLAIM WITHDRAWN**

Done:
- Finding 1 (Prisma docs): Verified, no changes needed
- Finding 2 (Recording-time disclosure): Six report pages updated; the GST HSN CSV omission was closed on 2026-11-13
- Finding 3 (`bucket_over_90`): Retracted. Current exclusive contract is correct; the alternative double-counts 61–90
- Additivity assertion added for AR and AP summary buckets
- 640/640 tests, typecheck, lint, generated baseline, provisioning guard, and `git diff --check` reproducibly pass

Remaining:
- Runtime database verification requires an explicitly authorized disposable target
- `/dashboard` still displays aging totals without the recording-time disclosure (not a report/export)
- Owner decisions pending on S-27 (Cheque) and S-30 (currency input)

Blockers:
- No authorized disposable PostgreSQL target for migration/trigger verification

Next:
- Use the 2026-11-13 final acceptance report as the authoritative record
- Obtain explicit runtime-target authorization before claiming database verification

Evidence:
- Final acceptance report: `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-final-acceptance-report-2026-11-13.md`
- Cleanup report: this document (corrected)
- Independent review: `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-independent-review-2026-11-10.md` (its Finding 3 recommendation is rejected)
- Final audit: `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-and-ledger-date-model-final-acceptance-audit-2026-11-09.md`
- Test results: 640/640 pass, static checks pass; runtime not performed