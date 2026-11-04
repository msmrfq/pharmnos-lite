---
title: How the T13, T19, and T25 documentation is reconciled
date: 2026-11-04
status: FINAL RECONCILIATION RECORDED - T13 T19 T25 ENGINEERING CLOSED
contentType: Reference
---

## Goal

Record the documentation-only reconciliation campaign, its sources, corrections,
remaining decisions, evidence boundaries, and Git preservation result.

## Acceptance criteria

- [x] The current-release baseline is authoritative and traceable
- [x] The reconciliation matrix covers T13, T19, T25, and shared requirements
- [x] All seven policy topics are classified
- [x] Dependency and mirror relationships are documented
- [x] Documentation changes and unchanged historical records are listed
- [x] Remaining decisions identify exact resolvers and evidence
- [x] No implementation scope was expanded

## Out of scope

- Source code, tests, schemas, migrations, fixtures, package configuration, and
  runtime infrastructure
- Database or Docker operations
- Production or Live Supabase access
- Git mutations
- New accounting, statutory, or professional conclusions

# Documentation reconciliation report

## TL;DR

The T13, T19, and T25 documentation now has one current-release baseline.
Owner-approved policy direction is no longer conflated with implementation
readiness or professional confirmation. The final equal-count matrix is 25/25
evidence-supported, with no verified failures. The final closure and
implementation reports are recorded in the
[final closure report](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md)
and
[current implementation campaign report](./t13-t19-t25-implementation-campaign-report-2026-11-04T22-16-03.md).

T13 is Engineering Closed on current-source offline evidence 12/12. T19 is
Engineering Closed on current-source target-bound evidence 16/16 with matching
source hashes and verified cleanup. T25 is Engineering Closed: its
current-source calculator suite passed 293/293, purchase application behavior
was exercised by the T19 target, and the separate Sales application/persistence
criterion passed with database read-back on a guarded disposable target.

## [PHARMNOS-LITE STATUS]

**Stage:** Documentation reconciliation  
**Completion:** 7/7 documentation deliverables verified (100%); underlying
engineering matrix is 25/25 evidence-supported (100%)
**Done:** Current-release scope baseline, requirement matrix, policy register,
dependency map, change log, remaining decision register, final closure report,
and implementation campaign report are recorded. Version 2 deferrals and
evidence boundaries are explicit.
**Remaining:** Qualified professional/statutory confirmation, independent
technical acceptance, applied schema/security evidence, and production
authorization
**Blockers:** No documentation blocker remains. The remaining blockers are
evidence or approval gates listed in the baseline remaining decision register.  
**Next:** Preserve the final closure record; no additional T13/T19/T25
implementation campaign is planned in this execution.

## Executive summary

T13, T19, and T25 now have a consistent, authoritative, and traceable
documentation baseline for current-release scope. The baseline does not claim
complete GST compliance, professional confirmation, production readiness, or
independent technical acceptance.

T13 is limited to exact 15-character validation when a GSTIN is supplied.
Checksum, state-prefix, registration-status, and effective-date checks remain
Version 2 deferrals.

T19 includes reviewed-revision binding, evidence and calculation identity,
guarded correction, stale revision rejection, atomic rollback, authorization,
reconciliation, acceptance-reset, finalization safeguards, and the current
line-evidence/immutable-snapshot guard. The current-source target-bound suite
verified 16/16 scenarios; independent acceptance and complete business
acceptance remain separate.

T25 includes the demonstrated exact-decimal calculator and purchase arithmetic
paths, independent components, supplier-value preservation, totals, round-off
separation, approved inclusive/exclusive engineering paths, and current input
validation boundaries. T25 is offline verified at 292/292 and purchase
application behavior was exercised by the T19 target; current-source sales
application/persistence evidence remains the one open engineering criterion.

## Documents discovered and reviewed

| Document group | Documents reviewed | Role |
|---|---|---|
| Scope and architecture | [domestic-gst-modernization.md](./domestic-gst-modernization.md), [gst-specification.md](./gst-specification.md), [gst-audit-validation-and-plan.md](./gst-audit-validation-and-plan.md) | Historical and active GST scope context |
| Owner decisions and engineering contracts | [gst-decision-closure-and-engineering-contract-approval.md](./gst-decision-closure-and-engineering-contract-approval.md), [0003](../decisions/0003-inventory-gst-valuation-policy.md) through [0009](../decisions/0009-gst-precision-rounding-engineering-contract.md) | Owner direction, engineering boundaries, and open gates |
| Professional and accounting questions | [gst-accounting-decision-question-pack.md](./gst-accounting-decision-question-pack.md), [pgst-01-purchase-gst-workflow-policy.md](./pgst-01-purchase-gst-workflow-policy.md) | Professional/statutory questions and purchase policy boundaries |
| Schema and persistence | [gst-schema-rollout-design-review.md](./gst-schema-rollout-design-review.md), [purchase-gst-persistence-design.md](./purchase-gst-persistence-design.md) | Review-only schema and purchase persistence design |
| Current acceptance records | [gst-calculation-treatment-acceptance-2026-11-01.md](./gst-calculation-treatment-acceptance-2026-11-01.md), [gst-implementation-tracker-2026-10-31.md](./gst-implementation-tracker-2026-10-31.md), [t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md) | Chronological acceptance and final implementation status |
| Runtime evidence | [t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md](./t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md), [purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json](./purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json), and related T13/T25 evidence | Target-bound or offline execution evidence |
| Briefing and mirrors | [CLAUDE.md](../CLAUDE.md), [PHASE_TRACKER.md](../PHASE_TRACKER.md), [AGENT.md](../AGENT.md), and [AI_BRIEFING.md](../AI_BRIEFING.md) | Navigation and status mirrors |

## Documents updated

| File | Reason | Authority or mirror role |
|---|---|---|
| [t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md](./t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md) | Establishes the current T13/T19/T25 baseline, policy classifications, deferrals, and remaining decisions | Canonical reconciliation baseline |
| [t13-t19-t25-documentation-reconciliation-matrix-2026-11-04T21-32-19.md](./t13-t19-t25-documentation-reconciliation-matrix-2026-11-04T21-32-19.md) | Maps requirements to authority, implementation, tests, evidence, and consistency status | Canonical reconciliation matrix |
| [t13-t19-t25-documentation-reconciliation-report-2026-11-04T21-32-19.md](./t13-t19-t25-documentation-reconciliation-report-2026-11-04T21-32-19.md) | Records campaign result, change log, limitations, and preservation proof | Canonical completion report |
| [t13-t19-t25-implementation-campaign-report-2026-11-04T22-16-03.md](./t13-t19-t25-implementation-campaign-report-2026-11-04T22-16-03.md) | Records the authorized implementation changes, current evidence, blocker resolution, and remaining gates | Current implementation report |
| [t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md) | Records the final suite decisions, evidence matrix, target lifecycle, and T25 Sales persistence closure | Final closure report |
| [domestic-gst-modernization.md](./domestic-gst-modernization.md) | Adds the current policy and T25 engineering boundary without erasing historical draft chronology | Canonical scope and architecture document |
| [gst-decision-closure-and-engineering-contract-approval.md](./gst-decision-closure-and-engineering-contract-approval.md) | Reconciles T13, discount, inclusive, rounding, and discrepancy statuses with current owner decisions | Canonical decision and contract document |
| [gst-accounting-decision-question-pack.md](./gst-accounting-decision-question-pack.md) | Distinguishes owner-approved direction from unresolved professional questions | Canonical professional-question document |
| [t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md](./t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md) | Clarifies why T19 is runtime verified but not independently accepted | Historical campaign report with current clarification |
| [gst-calculation-treatment-acceptance-2026-11-01.md](./gst-calculation-treatment-acceptance-2026-11-01.md) | Corrects the wording of accounting-policy gates without changing the 22/25 result | Historical acceptance record with current clarification |
| [gst-implementation-tracker-2026-10-31.md](./gst-implementation-tracker-2026-10-31.md) | Aligns tracker wording with the owner decision records | Dependent implementation tracker |
| [PHASE_TRACKER.md](../PHASE_TRACKER.md) | Updates the active GST modernization status and links the reconciliation baseline | Canonical phase tracker |
| [CLAUDE.md](../CLAUDE.md) | Updates the current-state wording and points to the reconciliation baseline | Canonical briefing source |
| Generated briefing mirrors | Synchronized from [CLAUDE.md](../CLAUDE.md) | Mirrors only; not independently edited |

## Documents left unchanged

Historical campaign evidence, JSON evidence, daily notes, source code, tests,
schemas, migrations, fixtures, environment files, package configuration, and
runtime scripts were not rewritten. Their historical values and evidence
limitations remain intact. Older reports that describe an earlier preflight or
runtime state remain useful chronology and are not current status authorities.

The schema rollout review remains unchanged in substance because it is already
explicitly review-only and says that rollout, applied-state verification, and
production use require separate authorization.

## Conflicts resolved

| Conflict | Resolution |
|---|---|
| Blocker wording implied that cess, rounding, or tolerance had no approved direction | The baseline now cites decisions 0004, 0007, and 0008 as owner-approved direction while retaining implementation, threshold, and professional-confirmation gates |
| Older scope tables described T13 as pending owner approval | The current baseline and decision addendum identify exact 15-character validation as owner-approved current scope with four Version 2 verification deferrals |
| Older T19 records treated the latest runtime result as pending | The 21-20-00 report remains historical target-bound evidence; the current implementation report downgrades current T19 runtime status because later source hardening changed its source hashes |
| Inclusive and exclusive treatment wording mixed target behavior with accepted implementation | The baseline distinguishes owner-approved engineering direction from the still-gated purchase workflow |
| T19 policy blockers were described as a complete purchase-accounting requirement | The baseline keeps T19 revision safeguards in scope and keeps ITC valuation, invoice-wide freight, linked notes, and other exceptional workflows outside or pending |

## Conflicts remaining

- The accounting question pack still contains unresolved professional and
  statutory questions. Those questions are intentionally not converted into
  owner-approved legal conclusions.
- Exact discrepancy thresholds, materiality units, actor authority, and
  segregation rules remain unresolved even though high-level tolerance
  direction is approved.
- Exact Section 170 aggregation and tax-head treatment remain subject to
  qualified confirmation.
- T13 target-bound runtime is not required by its approved offline suite
  architecture; T25 Sales target-bound application/persistence evidence is
  recorded. Independent technical acceptance remains open for all three.
- Applied schema, production security, migration, recovery, and release
  approval remain outside this documentation campaign.

## Version 2 exclusions verified

The baseline and dependent records consistently identify imports and exports,
SEZ and deemed exports, UIN transactions, Reverse Charge Mechanism, e-invoicing
and e-way bills, GST return filing, ITC reconciliation, credit/debit notes and
exceptional workflows, and multiple GST registrations as Version 2 deferrals.
The T13 checksum, state-prefix, registration-status, and effective-date checks
are also consistently deferred. No current-release wording adds an indirect
requirement for these workflows.

## Test and evidence references confirmed

| Surface | Exact command or evidence | Classification | Limitation |
|---|---|---|---|
| T13 | `pnpm test:t13:gstin` | Independent current-source offline suite, 9/9 | Does not prove database runtime or GSTIN authenticity |
| T19 | `pnpm test:t19:purchase-gst` | Current-source contract-tested suite; historical target-bound application suite | Historical 16/16 evidence predates the latest hardening and does not prove current runtime, independent acceptance, or statutory correctness |
| T25 | `pnpm test:t25:gst-calculation` | Independent current-source offline calculation suite, 292/292 | Does not prove target-bound application runtime or statutory correctness |
| Shared static contracts | `pnpm exec node --test .\tests\*.test.mjs` and focused contract selectors recorded in the campaign report | Static and regression verification | Does not replace target-bound or professional evidence |
| Schema and rollout | [Schema rollout review](./gst-schema-rollout-design-review.md) | Design review | No migration or applied-state claim |

The three suites remain independent. No combined T13/T19/T25 runner was
introduced.

## Remaining decision register

See the detailed register in [the current-release baseline](./t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md#remaining-decision-register).
The remaining items are evidence or confirmation gates for the approved
boundary, not permission to expand scope.

## Documentation change log

| Change | Files | Result |
|---|---|---|
| Added current-release scope baseline | New baseline document | One authority for T13/T19/T25 scope, deferrals, policy classifications, and remaining decisions |
| Added requirement matrix and dependency map | New matrix document | Traceable source, implementation, test, evidence, and status mapping |
| Added reconciliation report | This document | Durable campaign record and completion evidence |
| Clarified current T25 policy status | Domestic specification and decision closure | Owner-approved engineering direction is distinct from statutory confirmation and implementation gates |
| Clarified T13 and purchase policy statuses | Decision closure and accounting question pack | Current owner decisions no longer appear absent, while unresolved questions remain open |
| Clarified runtime and blocker wording | Runtime campaign report, acceptance report, implementation tracker, implementation campaign report, and briefing source | Historical T19 runtime remains preserved; current-source runtime and independent acceptance remain separate |
| Synchronized dependent mirrors | Generated briefing files | Mirrors reflect canonical briefing content |

## Git working-tree preservation evidence

Before this campaign's edits, the existing porcelain status was captured in
the session state file
`C:\Users\Masum Rafique\.copilot\session-state\36655790-940b-43b8-a4bc-ed460b133e52\git-status-doc-reconciliation-baseline.txt`.
No Git command that changes state was executed. No checkout, reset, clean,
restore, stash, stage, commit, push, branch switch, or history rewrite was
performed.

After the documentation edits, verification must show that every path newly
changed by this campaign is one of the listed documentation files and that all
pre-existing source, test, configuration, and evidence paths retain their
prior status.

## Completion determination

The documentation reconciliation campaign is complete. It produces a
consistent and traceable current-release documentation baseline recording
Engineering Closed status for T13, T19, and T25 without claiming independent
technical acceptance, professional confirmation, or production approval.

The remaining open items require qualified professional confirmation, exact
owner or accounting decisions, independent technical acceptance, or separate
production gates. They are not documentation inconsistencies and must not be
resolved by rewriting historical records.
