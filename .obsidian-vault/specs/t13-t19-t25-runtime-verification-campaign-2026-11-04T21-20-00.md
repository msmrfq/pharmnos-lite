---
title: T13 T19 T25 runtime verification campaign 2026-11-04T21-20-00
date: 2026-11-04
status: T19 RUNTIME VERIFIED — INDEPENDENT ACCEPTANCE NOT CLAIMED
---

## Goal

Complete the owner-authorized T13, T19, and T25 current-release campaign with
three independently executable function-owned suites, persistent evidence, and
contract-bound disposable runtime verification where required.

## Acceptance Criteria

- [x] Exactly three function-owned suite entry points remain in use.
- [x] T13 owns its GSTIN length assertions, offline fixtures, command, and
      persistent evidence.
- [x] T19 owns its purchase GST revision-safety assertions, target-bound
      fixtures, command, and persistent evidence.
- [x] T25 owns its GST calculation/treatment assertions, offline fixtures,
      command, and persistent evidence.
- [x] T19 target identity, restricted runtime role, schema, execution, and
      evidence-recording gates passed on an authorized disposable target.
- [x] T19 completed 16/16 target-bound scenarios with zero failures.
- [x] The exact target was disposed through the guarded lifecycle and verified
      absent.
- [x] Final offline suites, regression, typecheck, lint, syntax, Prisma, and
      diff checks passed.
- [ ] Independent technical acceptance is recorded.
- [ ] Professional statutory/tax confirmation is recorded.

## Out of Scope

Production or Live Supabase access, production authorization, deferred T13
checksum/state-prefix/registration-status/effective-date checks, T19 stale
operation behavior outside the approved reviewed-revision guard, T25
credit/debit-note workflow and e-invoice output, destructive Git operations,
and any accounting or statutory certification unsupported by qualified
professional evidence.

## Executive result

The three-suite architecture is implemented and independently executable.
T13 and T25 are offline verified; T19 is target-bound runtime verified against
an exact disposable target. The target was created, initialized, exercised,
evidence-recorded, and disposed only through the guarded lifecycle. No
production or Live Supabase resource was accessed.

The runtime result is **not** a blanket T13/T19/T25 acceptance. T19's
application evidence reports `16 passed`, `0 failed`, and `executionStatus:
PASS`, but its business verdict remains `PARTIALLY_ACCEPTED` because the
owner-approved policy directions still have implementation gates, unresolved
threshold or statutory details, and professional-confirmation dependencies as
applicable. T13 and T25 target-bound application verification was not required
to claim their offline suite results and was not run in this campaign.
Independent technical acceptance and professional statutory/tax confirmation
are not claimed.

## 1. Before/after suite architecture

| Function | Before this campaign | Final independently executable suite |
|---|---|---|
| DGM-T13 | GSTIN assertions were embedded in broader validation coverage and lacked a function-owned evidence boundary | `pnpm test:t13:gstin`; [`scripts/gstin-verification-test.cjs`](../../scripts/gstin-verification-test.cjs) owns five length-only scenarios and writes persistent offline evidence |
| DGM-T19 | Purchase revision-safety coverage depended on the broader application harness and needed explicit suite/evidence ownership | `pnpm test:t19:purchase-gst`; [`scripts/purchase-gst-application-acceptance.cjs`](../../scripts/purchase-gst-application-acceptance.cjs) owns target-bound fixtures, assertions, execution, and evidence |
| DGM-T25 | Calculator coverage existed but did not have the final function-owned evidence boundary | `pnpm test:t25:gst-calculation`; [`scripts/gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs) owns 289 exact-decimal and treatment assertions and writes persistent offline evidence |

Shared target-contract, lifecycle, Compose, provisioning, and safety helpers
remain shared infrastructure only. No combined T13/T19/T25 runner was created.

## 2. Campaign-owned code and test inventory

The following repository files are the campaign-relevant implementation and
test surface. Existing unrelated worktree changes were preserved and were not
reverted, staged, committed, or rewritten.

### Suite and evidence ownership

- [`package.json`](../../package.json)
- [`scripts/offline-suite-runner.cjs`](../../scripts/offline-suite-runner.cjs)
- [`scripts/gstin-verification-test.cjs`](../../scripts/gstin-verification-test.cjs)
- [`scripts/gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs)
- [`scripts/purchase-gst-application-acceptance.cjs`](../../scripts/purchase-gst-application-acceptance.cjs)
- [`tests/gstin-verification.test.ts`](../../tests/gstin-verification.test.ts)
- [`tests/gst-calculator.test.ts`](../../tests/gst-calculator.test.ts)
- [`tests/t13-t19-t25-suite-boundary.test.mjs`](../../tests/t13-t19-t25-suite-boundary.test.mjs)
- [`tests/purchase-gst-application-boundary.test.mjs`](../../tests/purchase-gst-application-boundary.test.mjs)

### Contract-bound runtime infrastructure

- [`scripts/financial-e2e-target-contract.mjs`](../../scripts/financial-e2e-target-contract.mjs)
- [`scripts/financial-e2e-target-lifecycle.mjs`](../../scripts/financial-e2e-target-lifecycle.mjs)
- [`scripts/financial-e2e-compose.mjs`](../../scripts/financial-e2e-compose.mjs)
- [`scripts/financial-e2e-provision-local.mjs`](../../scripts/financial-e2e-provision-local.mjs)
- [`tests/financial-e2e-target-lifecycle.test.mjs`](../../tests/financial-e2e-target-lifecycle.test.mjs)
- [`tests/financial-e2e-compose.test.mjs`](../../tests/financial-e2e-compose.test.mjs)

The final runtime correction specifically touched the Compose tmpfs
inspection path, ordinary-endpoint restoration, discrepancy revision-field
initialization, and their focused regression tests.

## 3. Independent commands and final results

| Function | Exact command | Classification | Result |
|---|---|---|---|
| DGM-T13 | `pnpm test:t13:gstin` | Offline | 5 passed, 0 failed, total 5 |
| DGM-T19 | `pnpm test:t19:purchase-gst` | Target-bound disposable runtime | 16 passed, 0 failed, total 16 |
| DGM-T25 | `pnpm test:t25:gst-calculation` | Offline | 289 passed, 0 failed, total 289 |

T13 evidence:
[`t13-gstin-verification-evidence-t13_gstin_verification_1793806462413.json`](./t13-gstin-verification-evidence-t13_gstin_verification_1793806462413.json),
SHA-256
`4439BEDEFA1204FF75065FEB6B9A26B4A280D9923C658E4D484D51EA145F6B4D`.

T25 evidence:
[`t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793806462413.json`](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793806462413.json),
SHA-256
`0D27D72D7280F8184A25BB5526316312B4C172CCE35BC68543486526C4E0BCE9`.

T19 evidence:
[`purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json`](./purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json),
SHA-256
`06D05126BFD44B8AA30A78FB9529BEB63E9E9AFDF04FD813F6812C3CA7DC2E18`.

The T19 evidence identifies `databaseAccessed: true`, `targetBound: true`,
the restricted application role, bootstrap fixture/assertion usage, the exact
command, 16 scenarios, zero failures, and successful evidence recording. It
does not contain credentials or connection strings.

## 4. Target identity and lifecycle evidence

The authorized disposable target was:

| Field | Verified value |
|---|---|
| Host and port | `127.0.0.1:55500` |
| Database | `pharmnos_financial_e2e_t13t19t25_20261104d` |
| Compose project | `pharmnoslite-financial-e2e-t13t19t25-20261104d` |
| Service/profile | `financial-e2e-postgres` / `financial-e2e` |
| Image | `postgres:17-alpine` |
| Storage/isolation | tmpfs, `financial-e2e-isolated`, restart policy `no` |
| Bootstrap role | `pharmnos_e2e` |
| Runtime role | `pharmnos_e2e_runtime` |
| Schema artifact SHA-256 | `508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5` |
| Target fingerprint | `22610cf2365b7504d9299989fba0695513ce686a68a9d5bb743b231c18726990` |

Initialization evidence verified 33 RLS tables, 84 policies, 16 triggers,
123 constraints, zero runtime DELETE privileges, and restricted runtime role
attributes (`LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`).

Infrastructure evidence:
[`financial-e2e-infrastructure-evidence-t13_t19_t25_runtime_20261104_212000.json`](./financial-e2e-infrastructure-evidence-t13_t19_t25_runtime_20261104_212000.json),
SHA-256
`84DE8D0E5B3D7099DB2DC13F7D31F180F22B02EB2E3645580ADDD85D0E86011E`.

Initialization evidence:
[`financial-e2e-initialization-evidence-t13_t19_t25_runtime_20261104_212000.json`](./financial-e2e-initialization-evidence-t13_t19_t25_runtime_20261104_212000.json),
SHA-256
`BBA988C523AE528B17F1592534510367B5875F7DC974C474DCECAE4E5E3858F6`.

Suite lifecycle evidence:
[`financial-e2e-suite-evidence-t13_t19_t25_runtime_20261104_212000.json`](./financial-e2e-suite-evidence-t13_t19_t25_runtime_20261104_212000.json),
SHA-256
`3755FD0DDE437FFE018A7BF6D581B1CC857CDF275DF21901332484530F5B0C1A`.

Cleanup evidence:
[`financial-e2e-cleanup-evidence-t13_t19_t25_runtime_20261104_212000.json`](./financial-e2e-cleanup-evidence-t13_t19_t25_runtime_20261104_212000.json),
SHA-256
`CCBA93069FBFBDE54FD2334902FD78A73D082152ABDD6B8702F381509D49AF4F`.

Cleanup completed through the guarded `DISPOSABLE_TARGET_DISPOSAL` path.
The exact Compose project had zero remaining containers and zero remaining
networks after disposal. The retained operator-owned target on port `55460`
was not selected or modified.

## 5. Requirement-by-requirement result

### DGM-T13 — GSTIN verification

| Requirement | Result |
|---|---|
| Exactly 15-character GSTIN length validation | Implemented and offline verified, 5/5 |
| Checksum validation | Approved Version 2 deferral |
| State-prefix validation | Approved Version 2 deferral |
| Registration-status validation | Approved Version 2 deferral |
| Effective-date validation | Approved Version 2 deferral |

Target-bound database verification was not run for T13. The offline evidence
is explicitly classified as offline and is not runtime acceptance.

### DGM-T19 — Purchase GST revision safety

| Requirement | Result |
|---|---|
| Acceptance binds reviewed GST record version, evidence revision ID, and calculation ID | Target-bound scenarios passed |
| Discrepancy resolution binds the reviewed revision and calculation | Target-bound scenario passed |
| Guarded correction updates reject stale revisions and preserve atomic rollback | Target-bound scenarios passed |
| Authorization, reconciliation, acceptance reset, and finalization safeguards | Target-bound scenarios passed |
| Persisted accepted values and posting payload reconciliation | Target-bound scenarios passed |

T19 runtime execution is verified, but the evidence-level business verdict is
`PARTIALLY_ACCEPTED` because cess, inclusive-tax, freight allocation,
discount allocation, rounding precedence, and discrepancy-tolerance policy
blockers remain. No broader stale-operation claim is made.

### DGM-T25 — GST calculation and treatment

| Requirement | Result |
|---|---|
| Exact-decimal arithmetic and precision handling | Implemented and offline verified |
| Explicit rounding and independent CGST/SGST/IGST components | Implemented and offline verified |
| Supplier-declared value preservation | Implemented and offline verified |
| Purchase/sales totals and separate commercial round-off | Implemented and offline verified |
| Approved current-release treatment paths | Implemented and offline verified |
| Credit/debit-note workflow and e-invoice output | Approved Version 2 deferrals |

T25's 289/289 result is offline calculator evidence. It is not a claim that
the offline suite exercised a database target.

## 6. Regression and safety verification

| Command | Result |
|---|---|
| `pnpm test:t13:gstin` | 5/5 passed |
| `pnpm test:t25:gst-calculation` | 289/289 passed |
| `node --test` over all 37 `*.test.mjs` files | 241/241 passed, 0 failed |
| `pnpm typecheck` | Passed |
| Changed-file ESLint | Passed |
| `node --check` for changed runtime/test files | Passed |
| `pnpm exec prisma validate` with placeholder `DATABASE_URL` and `DIRECT_URL` | Passed; schema-only validation |
| `git diff --check` | Passed |

The first Prisma validation attempt failed because `DIRECT_URL` was unset.
It was not a code or schema failure; the command was rerun with non-secret
placeholder URLs and passed. No database connection occurred during Prisma
validation.

## 7. Acceptance and authorization status

| Status | T13 | T19 | T25 |
|---|---|---|---|
| Implemented | Yes | Yes | Yes |
| Static/test verified | Yes | Yes | Yes |
| Offline verified | Yes | N/A for target-bound suite | Yes |
| Target-bound runtime verified | Not run | Yes, 16/16 | Not run |
| Owner/business approval | Campaign authorization only | Campaign authorization only | Campaign authorization only |
| Independently technically accepted | Not claimed | Not claimed | Not claimed |
| Qualified professional confirmation | Required where statutory/accounting interpretation applies | Required for unresolved accounting policies | Required where statutory/accounting interpretation applies |
| Production authorized | No | No | No |

Owner approval authorized the campaign and disposable operations. It does not
substitute for independent technical review or qualified professional
confirmation.

## 8. Git and safety preservation

No checkout, reset, clean, stash, restore, stage, unstage, commit, push,
branch change, or history rewrite was performed. Existing staged, unstaged,
and untracked work was preserved. No production, Live Supabase, or retained
operator-owned target was accessed.

## [PHARMNOS-LITE STATUS]

**Stage:** POST-P7 — PRE-PRODUCTION VALIDATION / T13-T19-T25 runtime
verification and acceptance

**Completion:** 22/25 = 88% evidence-supported master-matrix criteria remain
the authoritative overall matrix. T19 target-bound runtime is now verified;
independent technical acceptance is still unclaimed, and T13/T25 database
runtime was not run.

**Done:** Three function-owned suites; T13 5/5 offline; T19 16/16
target-bound with zero failures; T25 289/289 offline; exact target identity,
restricted role, schema, lifecycle evidence, cleanup absence, regression,
typecheck, lint, syntax, Prisma, and diff checks.

**Remaining:** Independent technical acceptance; professional statutory/tax
confirmation; unresolved accounting-policy blockers; T13/T25 target-bound
runtime if separately required by the acceptance authority.

**Blockers:** Accounting-policy and professional-confirmation boundaries remain
open; the T19 evidence verdict is `PARTIALLY_ACCEPTED`.

**Owner Approval:** Approved for this disposable campaign; not production
approval.

**Runtime Verification:** T13 offline; T19 verified; T25 offline.

**Independent Acceptance:** Not accepted / not claimed.

**Production Authorization:** NOT GRANTED.

**Next:** Obtain independent technical review and qualified professional
confirmation for the remaining accounting/statutory boundaries; do not
promote this disposable runtime result to production authorization.
