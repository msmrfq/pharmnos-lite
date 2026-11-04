---
title: T13 T19 T25 continuous closure campaign 2026-11-04T20-40-54
date: 2026-11-04
status: BLOCKED — EXACT IMMUTABLE TARGET CONTRACT ABSENT
---

## Goal

Complete the owner-authorized T13, T19, and T25 campaign with exactly three
function-owned suites, persistent evidence, safe runtime verification where
required, and separate acceptance decisions.

## Acceptance Criteria

- [x] Exactly three independently executable function-owned suites are present.
- [x] T13 and T25 produce persistent offline evidence with explicit offline
      classification.
- [x] T19 is independently gated by the immutable target contract and fails
      closed before connection when the contract is absent.
- [x] Safe static, offline, type, lint, syntax, Prisma, regression, and diff
      checks are complete.
- [x] The target-bound blocker and its non-mutating evidence are recorded.
- [ ] Target-bound T19 runtime evidence is produced.
- [ ] Target-bound application/persisted-value evidence required for the
      current T13/T19/T25 campaign is produced.
- [ ] Owner/business acceptance is recorded for all three functions.
- [ ] Independent technical acceptance is recorded.

## Out of Scope

Target selection by port, database name, container name, timestamp, or
historical similarity; speculative contract generation; production or Live
Supabase access; database or Docker lifecycle operations without the exact
contract; Version 2 GST features; statutory certification; and destructive Git
operations.

## Executive result

The engineering and suite-boundary endpoint is satisfied, but the campaign
cannot reach target-bound runtime or acceptance. The repository has exactly
three function-owned entry points:

| Function | Suite command | Classification | Result |
|---|---|---|---|
| DGM-T13 | `pnpm test:t13:gstin` | Offline | 5/5 passed |
| DGM-T19 | `pnpm test:t19:purchase-gst` | Target-bound | Blocked before connection |
| DGM-T25 | `pnpm test:t25:gst-calculation` | Offline | 289/289 passed |

The exact immutable target contract was absent from both the process
environment and `.env.financial-e2e`. The generic local configuration pointed
at the non-authorized default endpoint and did not provide the contract,
binding, fingerprint, or phase authorizations. Read-only Docker inspection
also could not connect because the Docker daemon was unavailable. No database
connection, SQL operation, fixture mutation, provisioning, initialization,
container operation, cleanup, production access, or prohibited Git operation
occurred.

The prior master matrix remains **22/25 evidence-supported criteria (88%)**.
This campaign closes no additional target-bound criteria; the three
current-scope runtime and independent-acceptance criteria remain unverified.

## 1. Before/after suite architecture

| Function | Assertions and regression scenarios | Fixture ownership | Execution | Persistent evidence |
|---|---|---|---|---|
| DGM-T13 | [`tests/gstin-verification.test.ts`](../../tests/gstin-verification.test.ts) owns the five length-only scenarios; checksum, state-prefix, registration-status, and effective-date checks remain deferred | Inline offline input fixtures owned by the T13 suite | [`scripts/gstin-verification-test.cjs`](../../scripts/gstin-verification-test.cjs) | [`t13-gstin-verification-evidence-t13_gstin_verification_1793804954523.json`](./t13-gstin-verification-evidence-t13_gstin_verification_1793804954523.json) |
| DGM-T19 | The purchase revision-safety acceptance runner owns reviewed-revision, stale-correction, rollback, authorization, reconciliation, reset, and finalization assertions | Target-bound fixture identifiers are generated and recorded by the T19 runner | [`scripts/purchase-gst-application-acceptance.cjs`](../../scripts/purchase-gst-application-acceptance.cjs) | Target-bound artifact is not produced because the contract gate stopped before connection |
| DGM-T25 | [`tests/gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) owns the exact-decimal, precision, rounding, component, supplier-value, total, snapshot, and POS regression scenarios | Inline offline calculation fixtures owned by the T25 suite | [`scripts/gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs) | [`t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793804954519.json`](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793804954519.json) |

The suite-boundary contract rejects combined-runner assumptions. The
pre-existing broader Sales GST application harness remains supplemental
coverage and is not a fourth function-owned suite or T13 evidence.

No source or test implementation change was required during this closure
pass; the previously implemented suite split and lifecycle safeguards passed
fresh verification. The remaining gap is authorized target readiness and
runtime evidence, not a safe reason to bypass the gate.

## 2. Target readiness and fail-closed evidence

### Observed configuration

- `FINANCIAL_E2E_TARGET_CONTRACT` was absent from the process environment and
  from `.env.financial-e2e`.
- `FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING`,
  `FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT`, and all five phase
  authorization variables were absent from `.env.financial-e2e`.
- `.env.financial-e2e` contained only generic target settings for
  `127.0.0.1:55432/pharmnos_financial_e2e`; that endpoint was not selected.
- `docker ps` was attempted as a read-only inspection and failed because the
  Docker Desktop Linux daemon was unavailable. No Docker lifecycle command was
  attempted.

### Gate results

| Command | Result | Meaning |
|---|---|---|
| `pnpm exec node .\scripts\financial-e2e-preprovisioned-verify.mjs` | Exit 1: `PREPROVISIONED=FAIL FINANCIAL_E2E_TARGET_CONTRACT is required.` | Contract preflight failed closed before database work |
| `pnpm test:t19:purchase-gst` | Exit 1: `FINANCIAL_E2E_TARGET_CONTRACT is required.` | T19 stopped before its first `connect()` call |
| `docker ps --format ...` | Exit 1: Docker daemon unavailable | Target/container identity could not be inspected; no target was selected |

The consolidated machine-readable record is
[`t13-t19-t25-continuous-closure-evidence-2026-11-04T20-40-54.json`](./t13-t19-t25-continuous-closure-evidence-2026-11-04T20-40-54.json),
SHA-256
`6F4C0DD775862530461CA56A611ED7A68F68F5156CE1F659ADE4B88A629D97F2`.

## 3. Requirement-by-requirement matrix

### DGM-T13 — GSTIN verification

| Requirement | Implementation | Assertion and evidence | Result |
|---|---|---|---|
| Supplied GSTIN has exactly 15 characters; optional blank remains valid | [`src/lib/validation/tenant.schemas.ts`](../../src/lib/validation/tenant.schemas.ts) lines 33-37 and 67-71 | Five dedicated T13 scenarios in [`tests/gstin-verification.test.ts`](../../tests/gstin-verification.test.ts); 5/5 offline evidence | `IMPLEMENTED; OFFLINE VERIFIED; TARGET-BOUND RUNTIME NOT VERIFIED` |
| Checksum validation | Not part of current release | Approved Version 2 deferral | `DEFERRED` |
| State-prefix validation | Not part of current release | Approved Version 2 deferral; unsupported prefixes are not used for current-release classification | `DEFERRED` |
| Registration-status validation | Not part of current release | Approved Version 2 deferral | `DEFERRED` |
| Effective-date validation | Not part of current release | Approved Version 2 deferral | `DEFERRED` |

T13 engineering/offline completion is 1/1 current-release criterion. Full
runtime and owner/business acceptance remain open because the campaign
requires the missing target contract for the target-bound portion.

### DGM-T19 — Purchase GST revision safety

| Requirement | Implementation and assertion | Result |
|---|---|---|
| Acceptance binds the reviewed GST record version, evidence revision ID, and calculation ID | [`src/lib/validation/purchases.schemas.ts`](../../src/lib/validation/purchases.schemas.ts) lines 175-198; [`src/app/_actions/purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) lines 143 and 713-738; focused contract test | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Discrepancy resolution uses the same reviewed revision guard | [`src/lib/validation/purchases.schemas.ts`](../../src/lib/validation/purchases.schemas.ts) lines 201-212; action guard and focused contract test | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Correction uses guarded parent updates | [`src/app/_actions/purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) line 1160 and the focused contract test | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Stale correction child writes roll back atomically | Owner-approved T19 contract and action transaction path; focused contract test | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Authorization and reconciliation safeguards remain enforced | Purchase action guards and [`tests/purchase-gst-revision-safety-contract.test.mjs`](../../tests/purchase-gst-revision-safety-contract.test.mjs) | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Acceptance-reset safeguards remain enforced | Purchase action state transition checks and focused contract coverage | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Finalization requires current accepted evidence, calculation, decision, line snapshots, and record version | [`src/app/_actions/purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) line 1230 onward; focused contract coverage | `STATIC VERIFIED; TARGET-BOUND NOT VERIFIED` |
| Broader stale-operation behavior outside the reviewed revision-token guard | Explicitly outside the approved current-release contract | `VERSION 2 BOUNDARY` |

T19 engineering/static completion is 7/7 current-release safeguards verified
by source contracts. No target-bound T19 evidence artifact exists because the
runner stopped before connection.

### DGM-T25 — GST calculation and treatment

The authoritative engineering contract is
[`0009-gst-precision-rounding-engineering-contract.md`](../decisions/0009-gst-precision-rounding-engineering-contract.md).

| Requirement | Implementation and offline assertion coverage | Result |
|---|---|---|
| T25-01 exact-decimal arithmetic | [`src/lib/decimal.ts`](../../src/lib/decimal.ts), GST and purchase calculators, exact-decimal scenarios | `OFFLINE VERIFIED; TARGET-BOUND NOT VERIFIED` |
| T25-02 at least six-decimal internal precision | Decimal coefficient/scale path and precision scenarios | `OFFLINE VERIFIED; TARGET-BOUND NOT VERIFIED` |
| T25-03 no premature intermediate rounding | No-premature-rounding vectors in the T25 suite | `OFFLINE VERIFIED; TARGET-BOUND NOT VERIFIED` |
| T25-04 explicit `HALF_UP` rounding | Decimal, GST, and purchase rounding scenarios | `OFFLINE VERIFIED; TARGET-BOUND NOT VERIFIED` |
| T25-07 Section 170 rounding isolated at the applicable boundary | Isolated helper and boundary scenarios; legal aggregation boundary is not inferred | `ENGINEERING OFFLINE VERIFIED; QUALIFIED PROFESSIONAL CONFIRMATION REQUIRED` |
| T25-08 commercial `Round_Off_Amount` remains separate | Purchase total and round-off scenarios | `OFFLINE VERIFIED; TARGET-BOUND PERSISTENCE NOT VERIFIED` |
| T25-09 supplier-declared purchase values remain separate | Purchase declared/calculated/accepted-value scenarios and source contract | `OFFLINE VERIFIED; TARGET-BOUND PERSISTENCE NOT VERIFIED` |
| T25-10 sales calculations and issued values are preserved | Sales calculation and snapshot scenarios | `OFFLINE VERIFIED; TARGET-BOUND PERSISTENCE NOT VERIFIED` |
| T25-11 CGST, SGST/UTGST, and IGST are independent | Independent component and POS scenarios; UTGST remains unsupported | `OFFLINE VERIFIED; TARGET-BOUND PERSISTENCE NOT VERIFIED` |
| T25-05 e-invoice item monetary representation | Approved Version 2 deferral | `DEFERRED` |
| T25-06 e-invoice item-tax reconciliation output | Approved Version 2 deferral | `DEFERRED` |
| T25-12 credit/debit-note reference preservation workflow | Approved Version 2 deferral; no supported workflow | `DEFERRED` |

T25 offline engineering completion is 9/9 current-release engineering
criteria. The offline suite does not establish database persistence,
application-path acceptance, statutory treatment, or professional
confirmation.

## 4. Verification commands and actual results

| Command | Result |
|---|---|
| `pnpm test:t13:gstin` | 5 passed, 0 failed, 5 total |
| `pnpm test:t25:gst-calculation` | 289 passed, 0 failed, 289 total |
| `pnpm exec node --test .\tests\t13-t19-t25-suite-boundary.test.mjs .\tests\financial-e2e-target-contract.test.mjs .\tests\financial-e2e-target-lifecycle.test.mjs .\tests\financial-e2e-compose.test.mjs .\tests\purchase-gst-revision-safety-contract.test.mjs` | 26 passed, 0 failed; static and mocked lifecycle coverage only |
| `pnpm exec node --test .\tests\*.test.mjs` | 240 passed, 0 failed, 0 skipped |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed with no warnings or errors |
| `pnpm exec prisma validate` with isolated placeholder URLs | Passed; schema validation only, no database connection |
| `node --check` on relevant campaign scripts | Passed |
| `git diff --check` | Passed |

Fresh offline evidence:

- T13: [`t13-gstin-verification-evidence-t13_gstin_verification_1793804954523.json`](./t13-gstin-verification-evidence-t13_gstin_verification_1793804954523.json),
  SHA-256 `0CF31897099B368331262E00BDABC822FEE440676ACAEE5359F29841901F4CCB`.
- T25: [`t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793804954519.json`](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793804954519.json),
  SHA-256 `3989FF27EEE46621F2AA4E6D434832C02EB1A425CF32DAC63BF499A50C72F26D`.

The T19 command intentionally produced no success-shaped evidence artifact.
Its contract failure occurred before database connection and before fixture
creation.

## 5. Acceptance and authorization status

| Function | Implementation | Static/offline verification | Target-bound runtime | Owner/business acceptance | Independent technical acceptance | Professional confirmation |
|---|---|---|---|---|---|---|
| DGM-T13 | Implemented | Verified offline | Not verified | Not accepted; campaign authorization is not acceptance | Not accepted | Not required for the 15-character engineering rule |
| DGM-T19 | Implemented | Verified by source contracts | Not verified | Not accepted | Not accepted | Not applicable to the revision guard |
| DGM-T25 | Implemented for approved demonstrated engineering scope | Verified offline | Not verified | Not accepted | Not accepted | Required for Section 170/statutory/accounting boundaries |

No genuinely independent technical review occurred. Owner authorization to
perform this campaign is not represented as independent acceptance or
professional GST/accounting confirmation.

## 6. Changed-file inventory and Git preservation

Created during this closure pass:

- This report:
  [`t13-t19-t25-continuous-closure-campaign-2026-11-04T20-40-54.md`](./t13-t19-t25-continuous-closure-campaign-2026-11-04T20-40-54.md).
- Machine-readable evidence:
  [`t13-t19-t25-continuous-closure-evidence-2026-11-04T20-40-54.json`](./t13-t19-t25-continuous-closure-evidence-2026-11-04T20-40-54.json).
- Fresh T13 and T25 offline evidence artifacts listed above.

No application source, test, dependency manifest, schema, migration,
provisioning, or lifecycle implementation file was changed during this
closure pass. Existing staged, unstaged, and untracked work was preserved.
No checkout, reset, clean, stash, restore, stage, unstage, commit, push,
branch change, or history rewrite was performed.

## 7. Remaining blocker and exact next action

The blocker is external and safety-critical: target-bound execution requires a
new, exact, immutable disposable-target contract with verified loopback
identity, database name, bootstrap/runtime roles, credential-source names,
Compose project/service/profile, current schema artifact fingerprint,
authorization timestamp, future expiry, ordinary database separation, and
phase-specific authorization. The Docker daemon must also be available for
read-only target identity inspection.

After those prerequisites are supplied, execute only the existing guarded
infrastructure/initialization/suite/evidence lifecycle. Do not select the
generic `55432` endpoint or any retained target by similarity, and do not
perform production or Live Supabase operations.

## [PHARMNOS-LITE STATUS]

**Stage:** POST-P7 — PRE-PRODUCTION VALIDATION / GST Modernization —
T13/T19/T25 continuous closure

**Completion:** 22/25 = 88% evidence-supported master-matrix criteria
(unchanged); 0/3 additional target-bound criteria closed in this campaign.

**Done:** Exactly three function-owned suites are verified; T13 5/5 offline
and T25 289/289 offline evidence are persistent; T19 fails closed before
connection; static, full regression, type, lint, syntax, Prisma, and diff
gates pass.

**Remaining:** Target-bound T19 and application/persisted-value verification
for the current T13/T19/T25 campaign; owner/business acceptance; independent
technical acceptance; qualified professional confirmation where required.

**Blockers:** Exact immutable disposable-target contract is absent; phase
authorizations are absent; Docker read-only inspection is unavailable.

**Owner Approval:** Campaign execution authorized; per-function acceptance is
not recorded.

**Runtime Verification:** Not verified.

**Independent Acceptance:** Not accepted.

**Production Authorization:** NOT GRANTED.

**Next:** Supply and verify the exact immutable disposable-target contract and
phase authorizations, then run only the existing guarded target-bound
workflow.
