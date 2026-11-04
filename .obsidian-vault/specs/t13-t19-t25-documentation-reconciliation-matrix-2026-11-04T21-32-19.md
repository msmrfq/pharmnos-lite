---
title: Which documents support T13, T19, and T25?
date: 2026-11-04
status: ACTIVE RECONCILIATION MATRIX
contentType: Reference
---

## Goal

Map every current-release T13, T19, T25, and shared requirement to its
authority, dependent documents, implementation, tests, evidence, and current
documentation status.

## Acceptance criteria

- [x] Authority and mirror relationships are explicit
- [x] Current-release requirements have source references
- [x] Implementation and test references are qualified
- [x] Runtime and professional evidence boundaries are explicit
- [x] Historical conflicts are preserved and resolved by chronology

## Out of scope

- Rewriting historical campaign evidence
- Source, test, schema, migration, fixture, or runtime changes
- New product requirements or accounting interpretations

# Documentation reconciliation matrix

## TL;DR

The current baseline is consistent after separating owner-approved direction
from engineering readiness and professional confirmation. The final closure
campaign records T13 as engineering closed on current-source offline evidence,
T19 as engineering closed on current-source target-bound evidence, and T25 as
engineering closed after current-source Sales application/persistence
verification. Independent and professional acceptance remain separate.

## Authority and dependency map

| Document | Authority or dependency role | Current disposition |
|---|---|---|
| [Current-release scope baseline](./t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md) | Canonical current T13/T19/T25 scope, policy classification, deferrals, and remaining decisions | New canonical reconciliation baseline |
| [Domestic GST Modernization](./domestic-gst-modernization.md) | Overall scope and architecture entry point | Active master; historical draft sections remain, with current addendum pointing to this baseline |
| [Decision closure and engineering contract approval](./gst-decision-closure-and-engineering-contract-approval.md) | Owner decisions, engineering contracts, authorization, and unresolved gates | Active decision authority; current-status addendum reconciles older gate wording |
| [Accounting decision question pack](./gst-accounting-decision-question-pack.md) | Professional and statutory questions, source limitations, and qualified-review dependencies | Active professional-question authority; owner policy records do not close its unresolved questions |
| [Schema rollout design review](./gst-schema-rollout-design-review.md) | Schema, rollout, compatibility, and database-integrity design | Review-only; no applied-state or production claim |
| [0003 through 0008 policy decisions](../decisions/0003-inventory-gst-valuation-policy.md) | Owner-approved policy direction | Canonical for the direction in each decision; implementation remains pending |
| [0009 precision and rounding contract](../decisions/0009-gst-precision-rounding-engineering-contract.md) | Current T25 engineering boundary and T13/T19 scope language | Canonical engineering contract; not professional confirmation or runtime acceptance |
| [Purchase GST persistence design](./purchase-gst-persistence-design.md) | Purchase persistence and revision-safety design | Dependent design; source and applied database states remain distinct |
| [Final runtime campaign](./t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md) and [T19 evidence](./purchase-gst-application-evidence-t13_t19_t25_runtime_20261104_212000.json) | Historical target-bound execution evidence | Canonical evidence for the 21-20-00 T19 source snapshot; no current-source runtime or scope authority |
| [Implementation campaign report](./t13-t19-t25-implementation-campaign-report-2026-11-04T22-16-03.md) and [final closure report](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md) | Current implementation, final decisions, and evidence reconciliation | Final closure report is the latest status record |
| [GST acceptance review](./gst-calculation-treatment-acceptance-2026-11-01.md) and [implementation tracker](./gst-implementation-tracker-2026-10-31.md) | Chronological acceptance and engineering status | Dependent status records; corrected wording points to the baseline |
| [CLAUDE.md](../CLAUDE.md), [PHASE_TRACKER.md](../PHASE_TRACKER.md), and generated mirrors | Agent briefing and navigation | Mirrors and status summaries; they do not override canonical decisions |

## Requirement reconciliation matrix

| Requirement ID | Function | Requirement | Authority | Dependents | Implementation and tests | Evidence | Documentation status |
|---|---|---|---|---|---|---|---|
| T13-01 | T13 | Accept supplied GSTIN only at exactly 15 characters | 0009, DGM-T13; domestic specification §26 | Tenant validation and master forms | `tenant.schemas.ts`, `masters.schemas.ts`, `gstin.ts`, `gstin-verification.test.ts` | T13 current-source offline evidence, 12/12, source identity recorded | ENGINEERING CLOSED |
| T13-02 | T13 | Preserve optional blank GSTIN behavior | Domestic specification §26 | Tenant and master forms | `gstin-verification.test.ts` | T13 offline evidence, blank and omitted cases | ENGINEERING CLOSED |
| T13-03 | T13 | Do not infer POS or treatment from GSTIN prefix | 0009, DGM-T13 | POS and treatment services | GSTIN suite and current resolver boundary | T13 offline evidence, unsupported-prefix case | ENGINEERING CLOSED |
| T13-V2-01 | T13 | Defer checksum verification | 0009, DGM-T13 | Future verification provider | No current implementation | No current evidence | DEFERRED |
| T13-V2-02 | T13 | Defer state-prefix verification | 0009, DGM-T13 | Future verification provider | No current implementation | No current evidence | DEFERRED |
| T13-V2-03 | T13 | Defer registration-status and effective-date verification | 0009, DGM-T13 | Future verification provider | No current implementation | No current evidence | DEFERRED |
| T19-01 | T19 | Bind acceptance to reviewed record version | 0009, DGM-T19; decision closure §3.2 | Purchase persistence and finalization | `purchases.actions.ts`, revision-safety contract test | Current-source target-bound evidence, 16/16, source hashes match | ENGINEERING CLOSED |
| T19-02 | T19 | Bind operations to evidence revision ID and calculation ID | 0009, DGM-T19 | Purchase GST records and pointers | `purchases.actions.ts`, revision-safety contract test | Current-source target-bound evidence, 16/16 | ENGINEERING CLOSED |
| T19-03 | T19 | Bind acceptance and discrepancy resolution to reviewed revision | 0009, DGM-T19 | Reconciliation state machine | `purchases.actions.ts`, reconciliation tests | Current-source target-bound evidence, 16/16 | ENGINEERING CLOSED |
| T19-04 | T19 | Guard corrections, reject stale revisions, and roll back stale child writes | 0009, DGM-T19 | Purchase actions and audit events | `purchases.actions.ts`, boundary and revision-safety tests | Current-source target-bound evidence, 16/16 | ENGINEERING CLOSED |
| T19-05 | T19 | Preserve authorization, reconciliation, acceptance-reset, and finalization safeguards | Domestic specification DGM-T19; decision closure BD-13/BD-14 | Purchase action and persistence design | Purchase actions, boundary tests | Current-source target-bound evidence, 16/16 | ENGINEERING CLOSED |
| T19-06 | T19 | Keep T19 separate from complete purchase accounting and exceptional workflows | 0009, DGM-T19; 0003, 0008 | Purchase policy and valuation decisions | Purchase reconciliation and persistence tests | Policy and runtime evidence boundaries | CONSISTENT |
| T19-07 | T19 | Obtain independent acceptance separately from runtime execution | Runtime campaign report acceptance criteria | Evidence and review records | No independent acceptance record | Runtime report explicitly does not claim it | UNRESOLVED |
| T25-01 | T25 | Use exact-decimal arithmetic for demonstrated paths | 0009, T25-01 | Calculator and purchase services | `decimal.ts`, GST and purchase calculators | T25 current-source offline evidence, 293/293, including Prisma Decimal regression | CONSISTENT |
| T25-02 | T25 | Preserve intermediate precision and explicit HALF_UP behavior | 0009, T25-02 through T25-04 | Calculator output and persistence | Decimal service and calculator tests | T25 offline evidence | CONSISTENT |
| T25-03 | T25 | Calculate CGST, SGST/UTGST, and IGST independently | 0009, T25-11 | Sales and purchase totals | GST and purchase calculators | T25 offline evidence | CONSISTENT |
| T25-04 | T25 | Preserve supplier-declared, calculated, and accepted values separately | 0003, 0008, 0009, T25-09 | Purchase reconciliation and valuation | Purchase calculator, reconciliation service, tests | T25 and T19 evidence boundaries | CONSISTENT |
| T25-05 | T25 | Preserve purchase and sales totals and separate commercial round-off | 0009, T25-08 and T25-10 | Purchase posting and sales finalization | GST and purchase calculators; Sales action and read-back harness | T25 offline evidence plus current-source Sales persistence read-back | CONSISTENT |
| T25-06 | T25 | Support approved inclusive and exclusive engineering paths | 0005 and 0009 | Purchase pricing workflow | GST and purchase calculators | T25 offline evidence; purchase workflow remains gated | CONSISTENT |
| T25-07 | T25 | Preserve calculated-versus-declared discrepancies | 0008; accounting question pack Q-08 | T19 reconciliation and accepted-value posting | Reconciliation service and tests | T19 runtime evidence for exercised paths | CONSISTENT |
| T25-08 | T25 | Distinguish rounded serialization, JavaScript number boundaries, and NUMERIC storage | 0009 engineering contract; schema rollout review | Persistence and schema validation | Decimal tests and schema review | No universal losslessness claim | CONSISTENT |
| T25-09 | T25 | Obtain target-bound runtime and independent acceptance separately | Runtime campaign report acceptance criteria | Evidence and review records | T19 target-bound purchase path plus current-source T25 Sales persistence run | T25 Sales suite source hashes, persisted read-back, and cleanup evidence; independent acceptance separate | CONSISTENT |
| POL-01 | Shared | Cess governance and non-zero cess fail-closed behavior | 0004; accounting question pack Q-07/Q-09 | T25 and purchase workflow | No complete non-zero cess workflow | Owner direction exists; rule and professional evidence open | CONSISTENT |
| POL-02 | Shared | Inclusive extraction, mixed-rate reconciliation, and residual adjustment | 0005; accounting question pack Q-07 | T25 and purchase workflow | Helper and calculator paths only | Purchase workflow remains gated | CONSISTENT |
| POL-03 | Shared | Invoice-wide freight allocation is not an approved current-release feature | 0006; domestic specification §19 | T19 purchase accounting | No feature added | Policy explicitly blocks unsupported allocation | CONSISTENT |
| POL-04 | Shared | Explicit line discounts remain distinct from post-supply note workflows | 0006; Version 2 register | T19 and T25 | Existing line behavior only | Linked notes remain deferred | CONSISTENT |
| POL-05 | Shared | High-level rounding direction is approved, but statutory boundary remains open | 0007, 0009, Q-07 | T25 and professional review | Decimal and calculator paths | Section 170 confirmation not claimed | CONSISTENT |
| POL-06 | Shared | Arithmetic tolerance cannot override policy or eligibility differences | 0008; accounting question pack Q-08 | T19 reconciliation | Reconciliation service and tests | Exact threshold and authority remain open | CONSISTENT |
| POL-07 | Shared | ITC eligibility controls valuation; ITC reconciliation is deferred | 0003; accounting question pack Q-08/Q-09 | Purchase valuation and T19 | Inventory valuation remains fail-closed | Eligibility evidence not established | CONSISTENT |
| SCH-01 | Shared | Schema and rollout review is not applied-state proof | Schema rollout design review, status and evidence boundary | Prisma and database owners | No migration executed in this campaign | Review-only and production NO-GO | CONSISTENT |
| EVD-01 | Shared | Runtime evidence does not equal independent acceptance or professional confirmation | Runtime campaign report and evidence JSON | All three functions | Separate suites and evidence | T19 runtime only; T13/T25 offline | CONSISTENT |
| V2-01 | Shared | Imports, exports, SEZ, deemed exports, UIN, RCM, e-invoicing, returns, ITC reconciliation, notes, and multiple registrations remain deferred | Baseline and 0009 | All GST workflows | No implementation added | Intentional exclusion | DEFERRED |
| V2-02 | T13 | Checksum, state-prefix, registration-status, and effective-date verification remain deferred | 0009, DGM-T13 | GSTIN verification | No implementation added | Intentional exclusion | DEFERRED |
| HIST-01 | Shared | Earlier preflight and runtime-pending records remain historical | Earlier campaign reports and acceptance addenda | Current baseline and latest report | No historical evidence rewritten | Latest chronology is explicit | OBSOLETE |
| PROD-01 | Shared | Production rollout, applied schema, and release approval remain outside this campaign | Schema rollout review and decision closure | Release gates | No production action | Production remains NO-GO | OUTSIDE CURRENT SCOPE |

## Final closure reconciliation - 2026-11-04 22-46-36 IST

The final campaign supersedes the earlier runtime-gap wording without
rewriting historical evidence:

- T13 is engineering closed on the current-source offline suite at 12/12.
  The approved architecture does not require a target-bound T13 run.
- T19 is engineering closed on current-source target-bound evidence at 16/16.
  The source hashes in the application artifact match the current worktree,
  and lifecycle cleanup is verified absent.
- T25 is engineering closed. Its offline calculation suite passed 293/293,
  the T19 target run supplies purchase application evidence, and the separate
  current-source T25 Sales run supplies application/persistence read-back with
  source hashes and verified cleanup.

The equal-count matrix is therefore **25/25 (100%) evidence-supported**.
Independent technical acceptance, professional/statutory confirmation, and
production authorization remain separate and are not represented as passes.

## Historical conflict resolution

The 2026-11-04 18-12-40 campaign stopped before database connection because the
immutable target contract was absent. The later 21-20-00 campaign used an
authorized disposable target and completed T19 runtime verification. The earlier
report remains unchanged as historical evidence, while this matrix and the
latest report use the later result.

Older sections that call the policy topics “unresolved” are retained when they
describe unresolved detail or professional confirmation. They no longer mean
that the owner-approved high-level direction is absent. The policy records and
this baseline are the controlling interpretation.

## Evidence boundary

Offline suites prove source-level behavior and deterministic fixtures. Static
contract checks prove wiring and boundaries. Target-bound runtime proves only
the exercised disposable application path. Independent technical acceptance,
professional/statutory confirmation, applied production schema, and release
approval require separate evidence.
