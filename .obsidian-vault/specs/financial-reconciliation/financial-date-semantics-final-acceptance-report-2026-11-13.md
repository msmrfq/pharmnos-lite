---
title: Financial Date Semantics and Ledger Date Model — Final Acceptance Report
date: 2026-11-13
status: Final Acceptance — PARTIALLY VERIFIED (runtime unverified)
---

# Financial Date Semantics and Ledger Date Model — Final Acceptance Report

## Executive Verdict

**Stage:** Financial Date Semantics — Final Acceptance and Evidence Reconciliation
**Completion:** **6/7 (86%)**
**Verdict:** **PARTIALLY VERIFIED**

The aging contract is resolved and the current implementation is correct. The five aging
buckets are mutually exclusive (`current`, `1–30`, `31–60`, `61–90`, `>90`), and
`bucket_over_90: buckets.over90` is the correct value for a strictly-greater-than-90 field in
both receivables and payables. The alternative `buckets.d90 + buckets.over90` double-counts the
61–90 range and breaks `sum(buckets) === total`; it is rejected.

The earlier cleanup report's Finding 3 is retracted. The formula change did exist transiently in
an unrelated agent-checkpoint lineage (`e1b61f8`), was reverted (`4acfdbd`), and never landed on
`main`. The current source and tests were not changed to match the false report.

Offline verification passes: 640/640 tests, typecheck, lint, schema validation, generated-schema
check, provisioning guard, and Git whitespace checks. A narrow additivity assertion and the
missing GST HSN CSV disclosure were added. Runtime migration/trigger verification remains
**unverified** because no explicitly authorized, uniquely identified disposable PostgreSQL target
was supplied. Production/release approval is **NO-GO** and is outside this acceptance.

---

## 1. Repository Baseline and Git Integrity

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `e47f86e0148f39c33efa5750d58ba6a5312f69ae` |
| Parent | `c767d1fe97b866f924e6715443eaac179ac21c15` |
| Pre-existing untracked file | `.obsidian-vault/specs/project-engineering-knowledge-dossier.md` |
| Staged changes | none |
| Unstaged changes | four intended files (see below) |
| New deliverable | this report |

The financial-date campaign commit `e47f86e` changes 14 files: three audit/review/cleanup
documents, six report pages, `financial-temporal.ts`, and four tests. It does **not** include
`src/repositories/ledger.repository.ts` or `tests/financial-ist-timezone.test.mjs`.

Intentional 2026-11-13 working-tree changes:

| File | Change |
|---|---|
| `src/domain/services/gst-hsn-date-filter.ts` | Added the shared recording-time disclosure row to the GST HSN CSV preamble. |
| `tests/gst-hsn-date-filter.test.mjs` | Asserted the disclosure is present in qualified and complete CSV modes. |
| `tests/financial-ist-timezone.test.mjs` | Added the explicit AR/AP summary additivity assertion. |
| `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-minor-findings-cleanup-2026-11-10.md` | Corrected the false Finding 3 and the overstated closure claims. |
| `.obsidian-vault/specs/project-engineering-knowledge-dossier.md` | Corrected the "no commits / never happened" history and the "ambiguous contract" conclusion. |
| `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-final-acceptance-report-2026-11-13.md` | This report. |

No commits, pushes, merges, resets, cleans, stashes, rebases, deployments, or database
connections were performed. User work was preserved.

---

## 2. The Aging Semantic Contract

### 2.1 Approved contract

`financial-reconciliation-accounting-invariants.md:79` defines the boundaries as
`current/not-yet-due, 1-30, 31-60, 61-90, and >90 days based on due date`.

The implemented classification predicates confirm strictly nested exclusive ranges:

```ts
// getAgingBuckets, customer and supplier mirrors
if (daysOverdue <= 0) current += amount;
else if (daysOverdue <= 30) d30 += amount;
else if (daysOverdue <= 60) d60 += amount;
else if (daysOverdue <= 90) d90 += amount;
else over90 += amount;
```

Therefore:

- `current` = not yet due or due today (age ≤ 0)
- `d30` = 1–30
- `d60` = 31–60
- `d90` = 61–90
- `over90` = strictly > 90
- `total` = `current + d30 + d60 + d90 + over90`

### 2.2 Summary fields

The legacy summary surface is:

```ts
current_30: buckets.current + buckets.d30,
bucket_31_60: buckets.d60,
bucket_61_90: buckets.d90,
bucket_over_90: buckets.over90,
total: buckets.total,
```

`current_30` is a deliberate legacy aggregate of not-overdue and 1–30 days. It is not a sixth
range and does not change the exclusivity of `bucket_31_60`, `bucket_61_90`, or
`bucket_over_90`.

### 2.3 Why the alternative is rejected

With the committed fixture (`current=3`, `d30=7`, `d60=11`, `d90=15`, `over90=9`,
`total=45`), the proposed `bucket_over_90 = d90 + over90` produces:

```text
current_30    = 10
bucket_31_60  = 11
bucket_61_90  = 15
bucket_over_90 = 15 + 9 = 24
sum = 10 + 11 + 15 + 24 = 60
total = 45
```

The `15` in 61–90 is counted twice. The alternative is not a "more inclusive" reading of the
same field; it changes the contract and violates additivity. No owner decision is required
because the approved invariant already names the exclusive ranges.

---

## 3. AR/AP Calculation Evidence

Both aggregation paths were inspected directly:

| Evidence | Receivables | Payables |
|---|---|---|
| `getAgingBuckets` | `src/repositories/ledger.repository.ts:147` | `src/repositories/ledger.repository.ts:316` |
| Summary method | `agedReceivablesTotals` (`:192`) | `agedPayablesTotals` (`:362`) |
| `bucket_over_90` | `:198` → `buckets.over90` | `:368` → `buckets.over90` |
| `total` | all five buckets | all five buckets |
| Unclassified due date | throws fail-closed error | throws fail-closed error |

Both methods use the same IST calendar-day difference helper (`calendarDayDifference`) and the
same fail-closed check. The bucket predicates themselves are **duplicated inline** in each
method (`:176-180` and `:346-350`) rather than extracted into one shared classifier; that is a
drift risk, not a present defect, and both copies currently match. A material finalized invoice
with a NULL `due_date_business` is not silently bucketed; the summary fails closed.

**Consumer note:** these two legacy summary methods currently have no call sites in `src/`.
Dashboard and report pages use `aging-report.actions.ts` and
`aging-report.service.ts` (invoice-level `computeAging`). The legacy field is therefore not
currently user-visible, but it remains part of the tested repository contract and must stay
correct.

---

## 4. Boundary, Exclusivity, and Additivity Evidence

### 4.1 Boundary coverage

Both `tests/financial-ist-timezone.test.mjs` and `tests/ledger-aging.test.mjs` exercise the same
ages for **both** customer and supplier repositories:

```text
-1, 0, 1, 29, 30, 31, 32, 59, 60, 61, 62, 89, 90, 91, 92, 119, 120, 121, 122
```

This covers every required boundary: 0/current, 1/1–30, 30/1–30, 31/31–60, 60/31–60,
61/61–90, 90/61–90, 91/>90, 120/>90, 121/>90. Each row is asserted to land in exactly one
bucket, with all other buckets zero.

### 4.2 Summary fixture and additivity

The summary test pins:

```js
// source buckets
{ current: 3, d30: 7, d60: 11, d90: 15, over90: 9, total: 45 }

// summary
{ current_30: 10, bucket_31_60: 11, bucket_61_90: 15, bucket_over_90: 9, total: 45 }
```

A new explicit assertion (2026-11-13) verifies both parties:

```js
summary.current_30
  + summary.bucket_31_60
  + summary.bucket_61_90
  + summary.bucket_over_90
  === summary.total
```

The existing exact-value assertion plus this invariant means the overlapping formula fails twice:
the `bucket_over_90` value becomes 24, and the exposed buckets sum to 60 instead of 45.

### 4.3 Test result

Focused run:

```text
pnpm exec node --test tests/financial-ist-timezone.test.mjs tests/ledger-aging.test.mjs tests/gst-hsn-date-filter.test.mjs
33 tests, 33 pass, 0 fail, exit code 0
```

---

## 5. Temporal Architecture Verification (Offline)

### 5.1 Typed contract

`src/lib/utils/financial-temporal.ts`:

- `CapturedInstant` is branded; a bare `Date` does not type-check as an occurred-at instant.
- `FinancialTemporalInput` allows exactly one of `businessDate` or `occurredAt`.
- `resolveFinancialTemporal` rejects extra keys, conflicting fields, malformed dates, and invalid
  instants.
- A date-only input round-trips as a UTC-midnight marker with `occurredAt: null` and basis
  `EXPLICIT`; no instant is invented.
- A genuine instant derives its IST business date via `businessDateToday` and basis
  `DERIVED_FROM_OCCURRED_AT`.
- `legacyTimestamp` preserves the old `entry_date`/`payment_date` value without making it
  authoritative.

### 5.2 Migration 0028

`prisma/migrations/0028_financial_event_dates/migration.sql`:

- Adds nullable `effective_date`, `due_date_business`, `finalized_recorded_at`, `occurred_at`,
  `recorded_at`, and basis columns across invoices, payments, ledgers, allocations, reversals,
  and refunds.
- Creates the `FinancialDateBasis` enum.
- Adds CHECK constraints tying `EXPLICIT`/`DERIVED_FROM_OCCURRED_AT` to a present date and
  `DERIVED_FROM_OCCURRED_AT` to a matching `occurred_at` in `Asia/Kolkata`.
- Rejects `EVIDENCE_CLASSIFIED` until durable provenance exists.
- Assigns recording time with `clock_timestamp()` in `BEFORE INSERT`/status-transition triggers.
- Protects `recorded_at`, `effective_date`, `occurred_at`, and basis from updates.
- Is strictly additive: no `UPDATE`, `DELETE`, `INSERT`, `DROP`, `RENAME`, `NOT NULL`, or default
  backfill for historical rows.
- Documents recording time honestly as **pre-commit statement execution time**, not
  commit-visible time and not knowledge-as-of.

### 5.3 Historical classification and report completeness

- `financial-temporal-classification.ts` classifies business date, event instant, and recording
  time independently, rejects missing/untrusted/foreign evidence, and never infers a date from
  midnight, `created_at`, host time, VPN, or payment type.
- `financial-report-completeness.ts` defaults to COMPLETE, fails closed with a specific reason
  when material rows have unknown or untrusted dates, and offers QUALIFIED only as an explicit
  opt-in with exclusion counts, amounts, and reason codes.
- Tests cover host-timezone independence (`Asia/Kolkata`, UTC, `America/Los_Angeles`), date-only
  round trips, DST boundaries, NULL legacy rows, mixed-version inserts, and immutable temporal
  fields.

All of the above is **offline/contract verification only**. No migration was executed.

---

## 6. Recording-Time Disclosure Coverage

The shared text is:

> "Recording time is the database statement time captured before commit; it is NOT
> commit-visible and NOT proof of knowledge-as-of. This is an effective-date view of the current
> records, not a historical knowledge-time snapshot."

Verified coverage:

| Surface | Evidence |
|---|---|
| Customer dues page | `src/app/reports/customer-dues/page.tsx:169` |
| Supplier payables page | `src/app/reports/supplier-payables/page.tsx:166` |
| Reports summary cards | `src/app/reports/page.tsx:149,159` |
| GST HSN page | `src/app/reports/gst-hsn-summary/page.tsx:243` |
| Sales register | `src/app/reports/sales-register/page.tsx:163` |
| Purchase register | `src/app/reports/purchase-register/page.tsx:157` |
| Daybook | `src/app/reports/daybook/page.tsx:149` |
| Customer statement / print | `src/app/customers/[customerId]/...` via `recordingTimeDisclosure` |
| Ledger CSV / daybook / statement | `ledgerCsvPreamble`; `exports.actions.ts:254,709` |
| Register CSV | `registerCsvPreamble` in `financial-report-completeness.ts` |
| GST HSN CSV | **Added 2026-11-13** in `hsnCsvPreamble`, with regression assertions |
| `recording-time-guarantee.ts` | Constant and disclosure match the SQL comments |

Surfaces that deliberately do **not** carry it, with reasons:

| Surface | Why no disclosure | Assessment |
|---|---|---|
| `/dashboard` | Displays aging totals as a landing summary, not a report or export | Residual UI observation; no recorded-time column shown |
| Customer dues / supplier payables **CSV** (`agingReportCsvRows`, `aging-report.service.ts:265-293`) | The CSV has no `recorded_at` or `finalized_recorded_at` column. It emits `Snapshot instant (UTC)` and `Recorded balance (cached)` — a computation instant and a cached party balance, neither of which is database-assigned recorded time. | **Asymmetry:** the HTML pages show the disclosure, the CSV does not. Documented as an open residual; no production source changed in this acceptance. |
| Stock valuation (`stock-valuation/page.tsx`) | Current-state inventory valuation; no financial event date or recorded time | Scoped out |
| Batch expiry (`batch-expiry/page.tsx`) | Current-state expiry view; no financial event date or recorded time | Scoped out |

The independent review's claim that the GST HSN CSV already contained the disclosure was false.
That gap is now closed. The aging-CSV asymmetry is the remaining genuine page/CSV inconsistency
of the same class; it is disclosed here rather than repaired because this acceptance is limited
to narrow documentation and test corrections.

---

## 7. Previous Report Corrections

### 7.1 Cleanup report Finding 3 — retracted

`financial-date-semantics-minor-findings-cleanup-2026-11-10.md` claimed both summary methods
were changed to `buckets.d90 + buckets.over90` and the timezone expectation changed from 9 to 24.

False as a description of the committed tree:

- Current source: `bucket_over_90: buckets.over90` at `:198` and `:368`.
- Current test: `bucket_over_90: 9`.
- `git log --all -S"buckets.d90 + buckets.over90"` (unscoped) also matches the documents that
  quote the formula, including `e47f86e`. The path-scoped form is the precise one:
  `git log --all -S"buckets.d90 + buckets.over90" -- src/repositories/ledger.repository.ts tests/financial-ist-timezone.test.mjs`
  yields exactly:
  - `e1b61f8` — added the formula and changed the test to 24.
  - `4acfdbd` — reverted both.
- Both commits live under `refs/agents/0b818677-…/checkpoints/turn/*`; neither is an ancestor
  of `main`/`e47f86e`. `git merge-base` finds no common ancestor with that lineage.
- `e47f86e` does not include `ledger.repository.ts` or `financial-ist-timezone.test.mjs`.

The accurate statement is: the change happened transiently in an unmerged agent checkpoint and
was reverted; it never landed on `main`. The report now says this and withdraws its 6/6 verdict.

### 7.2 Cleanup report Finding 2 — narrowed

The six report pages do display the disclosure. The original "page/CSV parity maintained" claim
was not true for the GST HSN CSV. That is corrected and the CSV gap is closed.

### 7.3 Independent review — two findings rejected or corrected

`financial-date-semantics-independent-review-2026-11-10.md`:

- Finding 3 recommended `buckets.d90 + buckets.over90`. Rejected: it double-counts 61–90 and
  breaks additivity.
- Its statement that the disclosure was already used in the GST HSN CSV was false at that tree
  state. Corrected by the 2026-11-13 change.

The review's third minor finding claimed the Prisma `///` documentation was missing. That finding
was **stale at the time it was written**, not accurate: all ten "Pre-commit database acceptance
time" comments already existed in the reviewed tree `f47db68` and in the earlier parent
`c767d1f` (`git show c767d1f:prisma/schema.prisma` → 10 matches; `f47db68` → 10; HEAD → 10).
The cleanup report's earlier "already satisfied" assessment was right. No Prisma documentation
was added by the cleanup, and this report no longer credits it with any.

### 7.4 Knowledge dossier

The dossier's earlier wording that the formula change "never happened" was too strong. It now
records the transient checkpoint commits, the revert, the non-ancestry, and the resolved
exclusive contract. Its "semantic contract ambiguous / owner decision required" conclusion is
replaced with the approved exclusive contract, and the two leftover "get an owner decision first"
and "contains the falsified Finding 3" statements were corrected in the same pass.

---

## 8. Offline Verification Table

Commands were run in `E:\PharmnosLite` with the exact exit codes below. No exit code was hidden
behind a pipeline.

| # | Command | Exit | Result |
|---:|---|---:|---|
| 1 | `pnpm exec node --test tests/financial-ist-timezone.test.mjs tests/ledger-aging.test.mjs tests/gst-hsn-date-filter.test.mjs` | 0 | 33/33 pass |
| 2 | `pnpm exec node --test tests/*.test.mjs` | 0 | 640/640 pass, 0 fail |
| 3 | `pnpm exec tsc --noEmit --incremental false` | 0 | No type errors |
| 4 | `pnpm lint` | 0 | No ESLint warnings or errors |
| 5 | `pnpm exec prisma validate` (no env) | 1 | P1012: `DATABASE_URL`/`DIRECT_URL` unset — environmental, not a schema defect |
| 6 | `pnpm exec prisma validate` (schema-only placeholder URLs) | 0 | Schema valid; no connection made |
| 7 | `pnpm exec node scripts/generate-financial-e2e-schema.mjs --check` | 0 | Generated baseline matches |
| 8 | `pnpm exec node scripts/financial-e2e-provisioning-static-guard.mjs` | 0 | `PROVISIONING_STATIC_GUARD=PASS` |
| 9 | `git diff --check` | 0 | No whitespace errors; one LF→CRLF advisory |
| 10 | `git diff --cached --check` | 0 | No staged whitespace errors |

Notes:

- The plain `prisma validate` failure is an environment-variable issue. The schema validates when
  syntactically valid placeholder URLs are supplied; nothing connected to PostgreSQL.
- The provisioning static guard reported `DESTRUCTIVE_STATEMENTS=none`,
  `FORBIDDEN_PRIVILEGES=absent`, and the expected GST/RLS table counts.
- The artifact-manifest check was not rerun in this acceptance; it is not claimed as fresh
  evidence.

---

## 9. Runtime Verification Status

**Status: BLOCKED / UNVERIFIED.**

No explicitly authorized, uniquely identified disposable local PostgreSQL target was supplied.
A locally running PostgreSQL service would not by itself constitute authorization, and no
Supabase/hosted/shared database may be used. Therefore migration 0028 was **not executed**, and
the following remain contract-tested only:

1. Actual application of migration 0028.
2. Schema/catalog consistency after migration.
3. `clock_timestamp()` trigger behavior and pre-commit semantics.
4. CHECK-constraint rejection of invalid basis/date/instant combinations.
5. Date-only and timestamp round trips through Prisma/PostgreSQL.
6. Trigger immutability under update/concurrency.
7. Rollback/isolation behavior and relevant financial-date queries.

Prerequisite for closing this criterion: an explicit authorization naming a unique loopback
local PostgreSQL target, an isolated disposable database name, and permission to create/apply/
destroy it. Until then, runtime must stay unverified.

---

## 10. Independent Review Result

A fresh read-only review was commissioned against the final working tree, separate from the
implementation work. The reviewer was instructed not to modify files, not to connect to a
database, and to verify the aging contract, history, corrections, disclosures, migration claims,
and Git scope from source. It ran in an isolated session with no context from this author's
conclusions except the list of files to inspect.

**Result: ACCEPT WITH FINDINGS.** No Critical findings. Two Major and five Minor findings, all
documentation/evidence-coverage issues. The reviewer changed nothing and made no database
connection.

What the reviewer independently confirmed:

- AR and AP predicates and summaries, with `bucket_over_90: buckets.over90` at `:198` and `:368`.
- The 19-age boundary set is identical for both parties; the summary fixture is `{3,7,11,15,9,45}`
  → `{10,11,15,9,45}`; the additivity assertion would fail on the alternative (`60 ≠ 45`).
- Focused 33/33, full 640/640, `tsc` 0, lint 0, schema check 0, guard PASS, both diff checks 0.
- Checkpoint commits `e1b61f8` (add) and `4acfdbd` (revert) exist, `--is-ancestor` exits 1 for
  both, no merge base with HEAD, and `git show --stat HEAD` excludes both aging files.
- Migration 0028 is additive with no backfill and its tests make no runtime claim.
- Working tree contains only the intended files; nothing staged; no destructive Git operation.

Findings and their disposition in this report:

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | Major | Aging CSV exports lack the recording-time disclosure, contradicting a blanket page/CSV parity claim | **Accepted.** Verified: `agingReportCsvRows` emits no recorded-time column. Disclosed and scoped in §6; criterion E narrowed to recorded-time surfaces; residual recorded in §12. No production edit made. |
| 2 | Major | The report/dossier asserted a completed review before it existed | **Accepted.** The report was already changed to PENDING before the review returned; it now records the real result. Dossier `[REV]` label defined and wording corrected. |
| 3 | Minor | "Prisma `///` finding was accurate" was false | **Accepted and corrected** in §7.3 — the finding was stale; the comments predate the review. |
| 4 | Minor | Dossier leftovers: "get an owner decision first", "contains the falsified Finding 3", wrong test line | **Accepted and corrected.** Line corrected to `:190`. |
| 5 | Minor | "Same classification helper" — the predicates are duplicated inline | **Accepted and corrected** in §3. |
| 6 | Minor | Unscoped `git log -S` enumeration was incomplete | **Accepted and corrected** in §7.1 with the path-scoped command. |
| 7 | Minor | Disclosure inventory omitted stock valuation, batch expiry and the aging CSVs | **Accepted.** Added to §6 with explicit reasons; `/dashboard` confirmed to have no match at all. |

The review also noted that it read a 508-line snapshot of this report and that the dossier is
untracked, so its corrections cannot be diff-verified against an earlier version. Both are
accurate and are why the evidence index states the dossier's provenance.

This is independent of the implementation claims in the sense that it re-read the final tree. It
is **not** runtime database acceptance and does not cure criterion G.

---

## 11. Completion Score (A–G)

| # | Criterion | Verdict | Evidence |
|---:|---|---|---|
| A | Aging contract established and both calculations correct | **PASS** | Approved exclusive ranges; predicates and `bucket_over_90` at both sites |
| B | Boundary, exclusivity, and reconciliation tests verified | **PASS** | All required ages for AR/AP; exact summary fixture; new additivity assertion |
| C | Previous closure claims accurately reconciled | **PASS** | Finding 3 retracted; checkpoint history and revert documented; report/dossier corrected |
| D | Temporal implementation and historical classification verified offline | **PASS** | Typed contract, migration checks/triggers, classifier, completeness, host-TZ tests |
| E | Recording-time disclosures on every surface that displays recorded time | **PASS (scoped)** | Reports, statements, ledger/register CSV, GST HSN CSV; aging CSV and inventory views explicitly scoped out in §6 |
| F | Offline verification and Git integrity verified | **PASS** | 640/640, typecheck, lint, schema checks, guard, diff checks; intended files only |
| G | Runtime migration/trigger verification or documented prerequisite | **UNVERIFIED** | No authorized disposable target; runtime remains blocked |

**Score: 6/7 (86%).** Criterion G is deliberately not counted as passed because the runtime
evidence does not exist. Documenting the prerequisite is not a substitute for executing it.

Criterion E is marked **PASS (scoped)** rather than unconditional PASS. The scope is stated so
the score is auditable: the disclosure is required, and present, on surfaces that actually render
database-assigned recorded time. The aging CSV renders none, so its omission is an asymmetry
rather than a contract violation; it is nevertheless listed as an open residual instead of being
quietly excluded. If the owner decides the disclosure must appear on every financial export
regardless of whether recorded time is displayed, criterion E becomes open and the score drops
to 5/7 (71%).

---

## 12. Remaining Gaps and Owner Decisions

1. **Runtime migration/trigger verification** — blocked on explicit disposable-target
   authorization. This is the only scored criterion that remains unverified.
2. **Production/release readiness** — NO-GO. The latest recorded Stage 3 gate is NO-GO (10/100)
   and the latest production-readiness verdict is NO-GO. This report does not change either.
3. **`/dashboard` and aging-CSV disclosure asymmetry** — the dashboard displays aging totals
   without the disclosure, and `agingReportCsvRows` exports `Snapshot instant (UTC)` plus
   `Recorded balance (cached)` without it while the HTML pages show it. Neither renders a
   `recorded_at` column, so this is a consistency issue, not a contract breach. A one-line
   addition to `agingReportCsvRows` plus a test would close the CSV half.
4. **Duplicated bucket predicates** — AR (`:176-180`) and AP (`:346-350`) reimplement the same
   classification inline. They currently match; extracting one classifier would remove the drift
   risk the reviewer flagged.
5. **Legacy aging surface** — `agedReceivablesTotals`/`agedPayablesTotals` have no production
   call sites. Keep them correct or make an explicit deprecation decision; do not "fix" them to
   the overlapping formula.
6. **`EVIDENCE_CLASSIFIED`** — intentionally unusable without durable provenance; this is a
   design boundary, not a defect.
7. **S-27 (Cheque)** and **S-30 (currency input)** — owner decisions remain outside this campaign.
8. **No CI / no committed browser E2E / no runtime database test in the repository** — the suite
   is strong offline evidence, not release proof.
9. **Artifact-manifest check** — not rerun in this acceptance; do not cite it as fresh evidence.

---

## 13. Final Status

```text
[PHARMNOS-LITE STATUS]
Stage: Financial Date Semantics — Final Acceptance
Completion: 6/7 (86%)
Verdict: PARTIALLY VERIFIED

Done:
- Established the exclusive five-bucket contract and confirmed `bucket_over_90 = over90` in both AR and AP.
- Rejected `d90 + over90`: it double-counts 61–90 and makes the exposed buckets sum to 60 against total 45.
- Verified boundary coverage for ages -1..122 on both parties and added explicit summary additivity assertions.
- Retracted cleanup Finding 3 and documented the transient checkpoint history (`e1b61f8` add, `4acfdbd` revert, no ancestry with main).
- Closed the GST HSN CSV recording-time disclosure gap and corrected the overstatement about page/CSV parity.
- Corrected the knowledge dossier's history and contract conclusions, including its leftover
  "owner decision required" and "falsified Finding 3" statements.
- Reproduced 640/640 tests, typecheck exit 0, lint exit 0, schema validation exit 0 with placeholders,
  generated-schema check exit 0, provisioning guard exit 0, and Git diff checks exit 0.
- Obtained a fresh independent read-only review of the final tree: ACCEPT WITH FINDINGS, no Critical
  defect; its seven findings were verified and are dispositioned in §10.
- Preserved all user work; no commits, pushes, resets, stashes, deployments, or database connections.

Remaining:
- Runtime migration/trigger/constraint verification on an authorized disposable local PostgreSQL target.
- `/dashboard` and aging-CSV disclosure asymmetry; duplicated AR/AP bucket predicates.
- Legacy aging deprecation decision.
- S-27 and S-30 owner decisions.

Blockers:
- No explicitly authorized, uniquely identified disposable PostgreSQL target; runtime evidence cannot be manufactured.

Next:
- Obtain written authorization for a unique loopback disposable database, apply 0028, and verify triggers,
  constraints, round trips, immutability, and rollback/isolation.
- Keep production/release status at NO-GO until runtime and the remaining gates are separately closed.
```

### Status separation

| Dimension | Status |
|---|---|
| Implementation | Correct for the reviewed scope; no aging source defect. |
| Offline verification | **PASS** — 640/640 plus static checks. |
| Runtime/database verification | **UNVERIFIED / BLOCKED** — no authorized target. |
| Independent acceptance | **ACCEPT WITH FINDINGS** — fresh read-only review of the final tree; no Critical defect; Major/Minor findings dispositioned in §10. |
| Production/release approval | **NO-GO** — not changed by this report. |

---

## Evidence Index

- `src/repositories/ledger.repository.ts` — aging predicates, summaries, `bucket_over_90`.
- `tests/financial-ist-timezone.test.mjs` — boundaries, IST midnight, summary fixture, additivity.
- `tests/ledger-aging.test.mjs` — AR/AP boundary exclusivity and summary reproduction.
- `tests/gst-hsn-date-filter.test.mjs` — GST HSN CSV disclosure and filter contract.
- `src/domain/services/gst-hsn-date-filter.ts` — GST HSN CSV preamble.
- `src/domain/services/financial-report-completeness.ts` — COMPLETE/QUALIFIED contract and CSV preambles.
- `src/domain/services/aging-report.service.ts` — production invoice-level aging.
- `src/app/_actions/aging-report.actions.ts` — dashboard/report aging loader.
- `src/lib/utils/financial-temporal.ts` — typed temporal contract.
- `src/lib/utils/recording-time-guarantee.ts` — pre-commit disclosure.
- `src/domain/services/financial-temporal-classification.ts` — independent historical classifier.
- `prisma/migrations/0028_financial_event_dates/migration.sql` — additive schema, CHECKs, triggers, comments.
- `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-accounting-invariants.md:79` — approved aging boundaries.
- `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-minor-findings-cleanup-2026-11-10.md` — corrected cleanup report.
- `.obsidian-vault/specs/financial-reconciliation/financial-date-semantics-independent-review-2026-11-10.md` — prior review (Finding 3 rejected).
- `.obsidian-vault/specs/project-engineering-knowledge-dossier.md` — corrected knowledge dossier.
