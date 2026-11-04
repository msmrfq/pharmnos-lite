---
title: T13 T19 T25 implementation campaign report 2026-11-04T22-16-03
date: 2026-11-04
status: FINAL CLOSURE RECORDED - T13 T19 T25 ENGINEERING CLOSED
---

## Goal

Deliver the owner-authorized current-release implementation work for DGM-T13,
DGM-T19, and DGM-T25, verify the implementation with independent function-owned
tests and repository gates, reconcile the evidence, and document every
remaining runtime, policy, professional, and independent-acceptance boundary.

## Acceptance Criteria

- [x] Stage 1 documentation baseline and scope reconciliation are recorded.
- [x] T13 current-release validation is consolidated across approved input
      surfaces without adding Version 2 authenticity checks.
- [x] T19 current-release revision-safety guards reject incomplete line
      evidence and preserve atomic rollback.
- [x] T25 current-release input boundaries reject invalid optional monetary
      values and out-of-range discount percentages.
- [x] Function-owned T13 and T25 suites pass with persistent evidence.
- [x] Current T19 source-contract regression coverage passes.
- [x] Full JavaScript regression, lint, syntax, Prisma, and diff checks pass.
- [x] Current-source T19 target-bound runtime verification is complete, and
      T13/T25 approved offline suites are current-source verified.
- [x] Current-source T25 sales application/persistence runtime evidence is
      complete.
- [ ] Independent technical acceptance and professional/statutory confirmation
      are recorded.

## Out of Scope

Production or Live Supabase access, production authorization, destructive
database or Docker operations outside an exact authorized disposable lifecycle,
Git state mutation, professional or statutory certification, T13 checksum or
government-status verification, T19 stale-operation behavior outside the
reviewed-revision contract, T25 e-invoicing, credit/debit notes, ITC
reconciliation, and other Version 2 deferrals.

# T13, T19, and T25 implementation campaign report

## A. Executive outcome

The final closure campaign records T13 as engineering closed on its
current-source 12/12 offline suite, T19 as engineering closed on its
current-source 16/16 target-bound suite, and T25 as engineering closed after
the current-source Sales application/persistence runtime criterion passed. The
authoritative equal-count matrix is **25/25 evidence-supported criteria
(100%)**. No new weighting or deferrals were introduced.

The prior target-bound T19 campaign
[`t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md`](./t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md)
recorded 16/16 scenarios on its exact disposable target before the final
current-source target-bound run. It remains historical evidence for that
source snapshot and is not used in place of the final current-source evidence.

## [PHARMNOS-LITE STATUS]

**Stage:** POST-P7 - PRE-PRODUCTION VALIDATION / GST modernization  
**Completion:** 25/25 = 100% evidence-supported master-matrix criteria
**Done:** T13 12/12 current-source offline; T19 16/16 current-source
target-bound; T25 293/293 current-source offline; T25 current-source Sales
application/persistence read-back; targeted typecheck, lint, syntax, and
cleanup gates
**Remaining:** Independent technical acceptance, professional/statutory
confirmation, and production authorization  
**Blockers:** None for the approved T13/T19/T25 engineering criteria.
Policy/professional and authorization gates remain separate.
**Next:** No further T13/T19/T25 engineering campaign is necessary; obtain only
the separate independent/professional/production decisions.

## Final closure reconciliation - 2026-11-04 23-28-31 IST

The final closure report and current-release baseline supersede the
pre-closure runtime wording in the historical sections below:

- T13: **Engineering Closed**, current-source offline evidence 12/12.
- T19: **Engineering Closed**, current-source target-bound evidence 16/16 on
  the guarded disposable target, with matching source hashes and verified
  cleanup.
- T25: **Engineering Closed**. The current-source calculator suite passed
  293/293, and a separate guarded disposable target passed the current-source
  Sales application/persistence proof with persisted database read-back. The
  Prisma Decimal conversion defect found during the run was fixed in the
  shared decimal adapter and regression-tested.

See the authoritative
[`t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md`](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md)
and
[`t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md`](./t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md).

## B. Documentation work

### Documents reviewed

- [`domestic-gst-modernization.md`](./domestic-gst-modernization.md)
- [`gst-decision-closure-and-engineering-contract-approval.md`](./gst-decision-closure-and-engineering-contract-approval.md)
- [`gst-accounting-decision-question-pack.md`](./gst-accounting-decision-question-pack.md)
- [`gst-calculation-treatment-acceptance-2026-11-01.md`](./gst-calculation-treatment-acceptance-2026-11-01.md)
- [`gst-implementation-tracker-2026-10-31.md`](./gst-implementation-tracker-2026-10-31.md)
- [`t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md`](./t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md)
- [`t13-t19-t25-documentation-reconciliation-matrix-2026-11-04T21-32-19.md`](./t13-t19-t25-documentation-reconciliation-matrix-2026-11-04T21-32-19.md)
- [`t13-t19-t25-documentation-reconciliation-report-2026-11-04T21-32-19.md`](./t13-t19-t25-documentation-reconciliation-report-2026-11-04T21-32-19.md)
- [`PHASE_TRACKER.md`](../PHASE_TRACKER.md) and [`CLAUDE.md`](../CLAUDE.md)
- Decisions `0003` through `0009` and the relevant runtime evidence JSON

### Documents created or modified

- This implementation campaign report.
- The current-release scope baseline and reconciliation matrix/report were
  updated with current 9/9, 292/292, and post-hardening T19 status.
- The active GST master, implementation tracker, acceptance record, phase
  tracker, and canonical briefing were updated to preserve the historical
  target-bound run while making current-source verification limits explicit.
- Generated briefing mirrors were synchronized from the canonical briefing.

### Documentation consistency result

The approved current-release scope remains:

- T13: exactly 15-character supplied-GSTIN validation only.
- T19: reviewed-revision binding, evidence/calculation identity, guarded
  correction, stale rejection, atomic rollback, and existing authorization,
  reconciliation, acceptance-reset, and finalization safeguards.
- T25: demonstrated exact-decimal calculation/treatment paths with explicit
  rounding, independent components, supplier-value preservation, and separate
  commercial round-off.

Checksum, state-prefix, registration-status, and effective-date GSTIN checks;
credit/debit notes; e-invoicing; ITC reconciliation; multiple registrations;
and the other approved Version 2 deferrals remain outside the denominator.
Owner-approved policy direction remains distinct from implementation, runtime
evidence, professional confirmation, and production authorization.

## C. Implementation details

### DGM-T13 - GSTIN validation

**Previous behavior:** GSTIN length checks were repeated across validation
surfaces, making it possible for the exact contract to drift.

**Correction:** [`gstin.ts`](../../src/lib/validation/gstin.ts) now owns the
shared exactly-15-character uppercase alphanumeric expression and format
message. Business profile and onboarding validation reuse it through
[`tenant.schemas.ts`](../../src/lib/validation/tenant.schemas.ts); customer
and supplier validation reuse the same expression through
[`masters.schemas.ts`](../../src/lib/validation/masters.schemas.ts).

**Tests and result:** [`gstin-verification.test.ts`](../../tests/gstin-verification.test.ts)
and [`gstin-verification-test.cjs`](../../scripts/gstin-verification-test.cjs)
passed **9/9**. The evidence is explicitly offline and does not claim
database runtime or GSTIN authenticity.

### DGM-T19 - Purchase GST revision safety

**Previous behavior:** Acceptance could progress after incomplete line-level
evidence and rely on a later finalization guard. That allowed an intermediate
acceptance state that did not prove every current line had an immutable
accepted snapshot.

**Correction:** [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts)
now rejects acceptance when purchase lines are missing or any current line
lacks complete GST evidence. It verifies that the guarded line update affects
every current line and throws inside the surrounding transaction when the
count differs. The existing reviewed record-version, evidence-revision,
calculation-ID, authorization, reconciliation, acceptance-reset, correction,
and finalization guards remain in place.

**Tests and result:** [`purchase-gst-revision-safety-contract.test.mjs`](../../tests/purchase-gst-revision-safety-contract.test.mjs)
passed its current contract test (five source assertions). The full JavaScript
regression suite passed 241/241. The historical target-bound T19 evidence
passed 16/16 before this source hardening; a current-source target-bound rerun
is still required.

### DGM-T25 - GST calculation and treatment boundaries

**Previous behavior:** Invalid optional monetary form values could be
silently converted to zero, and purchase/sales discount percentages were not
bounded at the validation boundary.

**Correction:** Optional monetary validators in
[`masters.schemas.ts`](../../src/lib/validation/masters.schemas.ts) and
[`purchases.schemas.ts`](../../src/lib/validation/purchases.schemas.ts) now
surface non-finite and negative values as validation errors. The shared
percentage validator bounds purchase and sales discounts to 0 through 100.
Exact-decimal service arithmetic and its documented JavaScript-number and
database-precision boundaries remain unchanged.

**Tests and result:** [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts)
and [`gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs) passed
**292/292**. Inclusive purchase workflow enablement, statutory rounding
precedence, cess governance, freight allocation, and inventory valuation
remain fail-closed where policy or professional details are unresolved.

## D. Blocker-resolution log

### 1. Missing immutable target contract

The guarded target-bound runner correctly failed closed when
`FINANCIAL_E2E_TARGET_CONTRACT` was absent. The generic local environment
configuration was not treated as authorization, and no target was selected by
port, database name, timestamp, or similarity. No database or container
operation was performed for that blocked attempt.

**Resolution:** Continue the independent implementation and offline work; keep
the runtime gate closed and document the exact contract required for a future
rerun.

### 2. Historical runtime evidence did not cover current source

The retained 16/16 T19 evidence references source hashes from before the
current line-evidence and immutable-snapshot hardening. Treating it as current
runtime proof would overstate verification.

**Resolution:** Preserve the historical evidence unchanged, update the current
status to implementation/static verification, and require a fresh exact-target
runtime campaign for the current source.

### 3. Prisma validation environment prerequisite

The first local Prisma validation invocation failed because `DIRECT_URL` was
unset. This was an environment prerequisite failure, not a schema failure.

**Resolution:** Rerun with non-secret placeholder `DATABASE_URL` and
`DIRECT_URL` values. Prisma validation then passed without opening a database
connection.

## E. Runtime and safety evidence

The historical disposable T19 target was bound to loopback port `55500`,
database `pharmnos_financial_e2e_t13t19t25_20261104d`, Compose project
`pharmnoslite-financial-e2e-t13t19t25-20261104d`, and restricted role
`pharmnos_e2e_runtime`. Its initialization evidence recorded 33 RLS tables,
84 policies, 16 triggers, 123 constraints, and zero runtime DELETE
privileges. The exact target was disposed through the guarded lifecycle and
verified absent.

Historical evidence:

- T19 application evidence: [`purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json`](./purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json),
  SHA-256 `06D05126BFD44B8AA30A78FB9529BEB63E9E9AFDF04FD813F6812C3CA7DC2E18`
  (pre-hardening source snapshot).
- Infrastructure, initialization, suite, and cleanup artifacts remain linked
  from [`t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md`](./t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md).

Final current-source evidence:

- T13: [`t13-gstin-verification-evidence-t13_gstin_final_20261104_2300.json`](./t13-gstin-verification-evidence-t13_gstin_final_20261104_2300.json),
  SHA-256 `19B6A31559E2FFABF621FCE6ED5BF69E1F9063DC11371F2458F02D4D6B203FEC`;
  12/12 offline.
- T19: [`purchase-gst-application-evidence-t13_t19_t25_final_20261104_2236.json`](./purchase-gst-application-evidence-t13_t19_t25_final_20261104_2236.json),
  SHA-256 `4B59D3ACADD46103691DFA4CABE0E3DC5E37280F6635F39165C85FFC654DF2BD`;
  16/16 target-bound.
- T25: [`t25-gst-calculation-treatment-evidence-t25_gst_final_20261104_2234.json`](./t25-gst-calculation-treatment-evidence-t25_gst_final_20261104_2234.json),
  SHA-256 `656D892ABC4B205656B224D965DC3971F84BF97F57724DCB5B64251E48376A32`;
  superseded 292/292 offline provenance.
- T25 current-source calculation: [`t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793814889348.json`](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793814889348.json),
  SHA-256 `03D81B46F296FF87A5A32744D4F828D3FA186FC3B6185D26B79D5E04FC816117`;
  293/293 offline.
- T25 current-source Sales runtime: [`t25-sales-runtime-t25_sales_1793814909158_be9f4d-suite.json`](./t25-sales-runtime-t25_sales_1793814909158_be9f4d-suite.json),
  SHA-256 `E4D1E4833EBFCCD762DE4D4B9BBA2D150A861914AA1F23EADF0701FFDDCFC094`;
  application/persistence read-back passed with source hashes and verified
  cleanup.

No production or Live Supabase access occurred. No database mutation,
migration, provisioning, cleanup, container lifecycle operation, checkout,
reset, clean, stash, stage, unstage, commit, push, branch change, or history
rewrite was performed during this implementation hardening pass. Existing
worktree changes were preserved.

## F. Outstanding items

- Obtain independent technical acceptance for the evidence; implementation
  work and Copilot verification are not independent acceptance.
- Obtain qualified professional/statutory confirmation for the open GST
  interpretation and accounting boundaries.
- Resolve or explicitly retain the policy gates for non-zero cess, inclusive
  purchase extraction and Rule 35 treatment, statutory rounding precedence,
  discrepancy tolerance details, ITC eligibility, and inventory valuation.
- Keep freight allocation outside the established current-release scope.
- Keep imports/exports, SEZ/deemed exports, UIN, RCM, e-invoicing/e-way bills,
  GST return filing, ITC reconciliation, credit/debit notes, multiple
  registrations, and T13 authenticity checks deferred to Version 2.

## G. Final status

**Stage:** POST-P7 - PRE-PRODUCTION VALIDATION / GST modernization  
**Completion:** 25/25 = 100% evidence-supported criteria
**Done:** T13 12/12 current-source offline; T19 16/16 current-source
target-bound; T25 293/293 current-source offline; T25 current-source Sales
application/persistence read-back; targeted typecheck, lint, syntax, and
cleanup gates
**Remaining:** Independent technical acceptance; professional/statutory
confirmation; unresolved policy details; production authorization  
**Blockers:** None for the approved engineering criteria. Separate
acceptance, professional, and production gates remain unclaimed.
**Next:** No further T13/T19/T25 engineering campaign is necessary; obtain only
the separate independent/professional/production decisions.
