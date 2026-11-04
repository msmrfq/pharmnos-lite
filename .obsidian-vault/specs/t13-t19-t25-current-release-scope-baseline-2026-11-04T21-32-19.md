---
title: How T13, T19, and T25 are scoped for the current release
date: 2026-11-04
status: ACTIVE RECONCILIATION BASELINE - FINAL CLOSURE RECORDED
contentType: Reference
---

Last reconciled: 2026-11-04 23-28-31 (IST)

## Goal

Define one traceable current-release baseline for GSTIN validation, purchase
GST revision safety, and GST calculation and treatment without expanding the
approved product scope.

## Acceptance criteria

- [x] Current-release requirements are separated from implementation evidence
- [x] Version 2 deferrals are listed without treating them as failures
- [x] Owner-approved policy direction is separated from engineering readiness
- [x] Professional and statutory confirmation dependencies are explicit
- [x] Runtime, offline, independent-acceptance, and production statuses are
      separated
- [x] Remaining decisions identify the exact evidence or approval needed

## Out of scope

- Source code, tests, schemas, migrations, fixtures, and runtime changes
- Production or Live Supabase access
- New accounting or statutory interpretations
- Credit/debit-note, e-invoice, ITC-reconciliation, or other deferred
  workflows
- Claims of independent technical acceptance or professional confirmation

# Current-release scope baseline

## TL;DR

T13 is length-only GSTIN validation. T19 is reviewed-revision purchase safety.
T25 is the demonstrated exact-decimal calculation contract. T13 is engineering closed on current-source offline evidence, T19 is
engineering closed on a current-source target-bound run, and T25 is
engineering closed after the current-source Sales application/persistence
criterion passed on a guarded disposable target. Owner-approved policy records
establish direction, but unresolved thresholds, statutory boundaries,
independent acceptance, professional confirmation, and production authorization
remain separate.

## Authority and status rules

The documents below have distinct responsibilities:

| Authority | Responsibility | Status use |
|---|---|---|
| [Domestic GST Modernization](./domestic-gst-modernization.md) | Overall GST scope and architecture | Retains historical design chronology and points to this baseline for current T13/T19/T25 status |
| [GST Decision Closure and Engineering Contract Approval](./gst-decision-closure-and-engineering-contract-approval.md) | Owner decisions, engineering contracts, authorization boundaries, and unresolved gates | Governs owner direction and engineering contract wording |
| [GST Accounting Decision Question Pack](./gst-accounting-decision-question-pack.md) | Professional and statutory questions and source limitations | Governs questions that still require qualified confirmation |
| [GST Schema Rollout Design Review](./gst-schema-rollout-design-review.md) | Schema, rollout, compatibility, and database-integrity design | Review-only; it does not prove applied state or authorize rollout |
| Decisions [0003](../decisions/0003-inventory-gst-valuation-policy.md) through [0008](../decisions/0008-purchase-gst-discrepancy-tolerance-policy.md) | Owner-approved accounting policy direction | Product authorization with engineering implementation pending; not professional or legal advice |
| [GST precision and rounding engineering contract](../decisions/0009-gst-precision-rounding-engineering-contract.md) | Demonstrated T25 engineering boundary and deferrals | Owner-approved engineering scope; professional confirmation and runtime evidence remain separate |
| Runtime campaign reports and JSON evidence | Historical execution and result evidence | Evidence only; they do not redefine scope |

Use these status terms consistently:

- **Implemented**: source behavior exists
- **Offline verified**: a dedicated local suite passed
- **Target-bound runtime verified**: the behavior passed against an identified
  disposable database target
- **Independent acceptance**: a separate technical review accepted the evidence
- **Professional confirmation**: a qualified GST, accounting, or statutory
  review confirmed the relevant interpretation
- **Not accepted**: the evidence or approval gate is incomplete

A blocker report records an open gate. It does not, by itself, prove that a
policy lacks owner approval. Decisions [0003](../decisions/0003-inventory-gst-valuation-policy.md)
through [0008](../decisions/0008-purchase-gst-discrepancy-tolerance-policy.md)
are the authoritative owner-approval records for their policy direction.

## Stage 1 Completion and authorized implementation boundary
Stage 1 Documentation verification is complete for the authorized continuous
implementation campaign. The canonical scope, policy prerequisites, Version 2
deferrals, engineering acceptance criteria, existing evidence limits, runtime
gaps, and independent/professional acceptance boundaries were reconciled
against the master specification, schema rollout review, decision closure,
accounting question pack, decisions `0003` through `0009`, runtime evidence,
acceptance records, and the phase tracker.

The authorized implementation boundary for Stage 2 is:

- T13: consolidate and regression-test the existing exactly-15-character
  supplied-GSTIN validation across its approved input surfaces without adding
  checksum, prefix, registration-status, or effective-date verification.
- T19: preserve and close only reviewed-revision binding, evidence/calculation
  identity, guarded correction, stale rejection, atomic rollback,
  authorization, reconciliation, acceptance-reset, and finalization safeguards.
- T25: implement and test the demonstrated exact-decimal purchase and sales
  paths, independent components, supplier-value preservation, commercial
  round-off separation, and deterministic inclusive extraction helpers where
  the policy defines the arithmetic. Keep workflow enablement fail-closed when
  governance, residual, statutory, or professional details are unresolved.

No deferred workflow, unsupported allocation rule, ITC-reconciliation feature,
professional conclusion, production operation, or destructive operation is
authorized by this boundary.

## Current implementation campaign addendum - 2026-11-04 22-16-03 IST

The authorized implementation work is complete to the safe repository
boundary. T13 is current-source offline verified at 9/9, T25 is current-source
offline verified at 292/292, and the current T19 revision-safety contract test
passes. The T19 acceptance hardening now requires complete line evidence and
an immutable accepted snapshot for every current line, with an affected-row
guard inside the transaction.

The historical 16/16 target-bound T19 campaign remains valid for the source
snapshot it exercised, but its recorded source hashes predate this addendum's
T19 hardening. It must not be used as current-source runtime proof. A fresh
contract-bound runtime campaign is required before target-bound verification
can be claimed for the current implementation.

## Final closure addendum - 2026-11-04 23-28-31 IST

The final consolidated campaign updated the status without expanding the
approved scope:

- **T13: Engineering Closed.** The current-source function-owned suite passed
  12/12. It covers exact length, optional blank/omitted values, whitespace,
  non-string values, onboarding, customer, and supplier surfaces. The suite
  remains offline by design; no target-bound claim is made.
- **T19: Engineering Closed.** The current-source target-bound suite passed
  16/16 on a fresh guarded disposable target. The evidence source hashes match
  the current worktree, restricted runtime attributes were verified, and
  ownership-bound disposal was verified absent.
- **T25: Engineering Closed.** The current-source exact-decimal suite passed
  293/293, and a separate guarded disposable target passed the current-source
  Sales application/persistence proof with database read-back. The observed
  Prisma Decimal conversion defect was fixed surgically in the shared decimal
  adapter and covered by a regression assertion.

The 25-criterion matrix is now **25/25 (100%) evidence-supported** using one
point per criterion because no unequal weights are documented. Independent
technical acceptance, qualified professional/statutory confirmation, and
production authorization remain separate gates.

## T13: GSTIN verification

| Requirement | Authoritative source | Implementation, test, and evidence | Current status |
|---|---|---|---|
| Accept a supplied GSTIN only when its length is exactly 15 characters | [0009, DGM-T13 current-release scope](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t13-current-release-scope); [domestic specification, §26](./domestic-gst-modernization.md#26-deterministic-acceptance-test-specification) | [`tenant.schemas.ts`](../../src/lib/validation/tenant.schemas.ts), [`masters.schemas.ts`](../../src/lib/validation/masters.schemas.ts), [`gstin.ts`](../../src/lib/validation/gstin.ts), and [`gstin-verification.test.ts`](../../tests/gstin-verification.test.ts) | Implemented and current-source offline verified 12/12 |
| Preserve the optional blank behavior where the field is not required | [domestic specification, §26](./domestic-gst-modernization.md#26-deterministic-acceptance-test-specification) | [`gstin-verification.test.ts`](../../tests/gstin-verification.test.ts) | Implemented and offline verified |
| Do not use a GSTIN prefix to infer POS, state, or treatment | [0009, DGM-T13 current-release scope](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t13-current-release-scope) | [`gstin-verification.test.ts`](../../tests/gstin-verification.test.ts) and current validation boundaries | Implemented and offline verified |
| Checksum verification | [0009, DGM-T13 current-release scope](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t13-current-release-scope) | No current-release implementation or acceptance claim | Version 2 deferral |
| State-prefix verification | [0009, DGM-T13 current-release scope](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t13-current-release-scope) | No current-release implementation or acceptance claim | Version 2 deferral |
| Registration-status and effective-date verification | [0009, DGM-T13 current-release scope](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t13-current-release-scope) | No current-release implementation or acceptance claim | Version 2 deferral |

T13 is not full GSTIN authenticity or government-status verification. The
current suite proves only the approved length boundary, optional behavior, and
input rejection semantics across the approved validation surfaces. Target-bound
database execution is not applicable to the approved offline suite; independent
acceptance remains separate.

## T19: Purchase GST revision safety

| Requirement | Authoritative source | Implementation, test, and evidence | Current status |
|---|---|---|---|
| Bind acceptance to the reviewed purchase GST record version | [0009, DGM-T19 scope and resolution](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t19-current-release-scope-and-resolution); [decision closure, §3.2](./gst-decision-closure-and-engineering-contract-approval.md#32-current-release-scope-decisions) | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts), [`purchase-gst-revision-safety-contract.test.mjs`](../../tests/purchase-gst-revision-safety-contract.test.mjs), and current T19 evidence | Implemented and current-source target-bound verified 16/16 |
| Require the current evidence revision ID and calculation ID | [0009, DGM-T19 scope and resolution](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t19-current-release-scope-and-resolution) | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) and current T19 evidence | Implemented and current-source target-bound verified 16/16 |
| Bind acceptance and discrepancy resolution to the reviewed revision | [0009, DGM-T19 scope and resolution](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t19-current-release-scope-and-resolution) | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) and current T19 evidence | Implemented and current-source target-bound verified 16/16 |
| Guard correction updates and reject stale revisions | [0009, DGM-T19 scope and resolution](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t19-current-release-scope-and-resolution) | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) and current T19 evidence | Implemented and current-source target-bound verified 16/16 |
| Preserve atomic rollback on stale or failed correction | [0009, DGM-T19 scope and resolution](../decisions/0009-gst-precision-rounding-engineering-contract.md#dgm-t19-current-release-scope-and-resolution) | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) and current T19 evidence | Implemented and current-source target-bound verified 16/16 |
| Enforce authorization, reconciliation, acceptance-reset, and finalization safeguards | [domestic specification, DGM-T19](./domestic-gst-modernization.md#26-deterministic-acceptance-test-specification); [decision closure, BD-13 and BD-14](./gst-decision-closure-and-engineering-contract-approval.md#3-stage-1-business-statutory-and-accounting-decision-register) | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts), [`purchase-gst-application-boundary.test.mjs`](../../tests/purchase-gst-application-boundary.test.mjs), and current T19 evidence | Current-source target-bound suite passes 16/16 |

Historical T19 evidence recorded 16/16 target-bound scenarios, but it does not
establish current-source runtime verification because its source hashes predate
the current line-evidence and immutable-snapshot guards. It also does not
establish independent technical acceptance, professional confirmation,
production readiness, or a complete purchase-accounting system.

## T25: GST calculation and treatment

| Requirement | Authoritative source | Implementation, test, and evidence | Current status |
|---|---|---|---|
| Use exact-decimal arithmetic for demonstrated financial paths | [0009, T25-01](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix) | [`decimal.ts`](../../src/lib/decimal.ts), [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts), [`purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts), and [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) | Implemented and current-source offline verified 293/293 |
| Preserve intermediate precision and use explicit `HALF_UP` representation | [0009, T25-02 through T25-04](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix) | [`decimal.ts`](../../src/lib/decimal.ts) and [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) | Implemented and offline verified |
| Calculate CGST, SGST/UTGST, and IGST independently | [0009, T25-11](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix) | [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts), [`purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts), and [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) | Implemented and offline verified |
| Preserve supplier-declared, calculated, and accepted purchase values separately | [0003](../decisions/0003-inventory-gst-valuation-policy.md), [0008](../decisions/0008-purchase-gst-discrepancy-tolerance-policy.md), and [0009, T25-09](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix) | [`purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts), [`purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts), and [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) | Implemented and offline verified for demonstrated paths |
| Preserve purchase and sales totals and keep commercial round-off separate from GST | [0009, T25-08 and T25-10](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix) | [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts), [`purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts), and [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) | Implemented and offline verified |
| Support approved inclusive and exclusive calculation paths without mixing formulas | [0005](../decisions/0005-inclusive-purchase-pricing-policy.md), [0009, T25-01 through T25-04](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix) | [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts), [`purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts), and [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts) | Engineering path implemented and offline verified; purchase workflow remains gated |
| Preserve calculated-versus-declared discrepancies and do not infer acceptance from arithmetic tolerance | [0008](../decisions/0008-purchase-gst-discrepancy-tolerance-policy.md), [accounting question pack, Q-08](./gst-accounting-decision-question-pack.md#q-08-purchase-declaredcalculatedaccepted-values-and-reconciliation) | [`purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts) and [`purchase-gst-reconciliation.test.ts`](../../tests/purchase-gst-reconciliation.test.ts) | Implemented and contract-tested; exact threshold and authority details remain open |
| Distinguish serialized rounded values, JavaScript `number` boundaries, and PostgreSQL `NUMERIC(20,4)` storage | [0009, engineering contract](../decisions/0009-gst-precision-rounding-engineering-contract.md#engineering-contract) | [`decimal.ts`](../../src/lib/decimal.ts), [`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts), and [schema rollout review](./gst-schema-rollout-design-review.md) | Documented boundary; universal losslessness is not claimed |

T25 current-source purchase application behavior is exercised by the final T19
target-bound run, and current-source Sales application/persistence behavior is
verified by the separate T25 Sales target run. The Sales proof read back
taxable 100, CGST 9, SGST 9, IGST 0, total GST 18, round-off 0, net/balance
118, customer receivable 250 to 368, supplier payable 125 to 125, and the
expected stock, ledger, and audit records. Section 170 aggregation, e-invoice
representation, and statutory tax-head treatment still require qualified
confirmation.

## Explicit Version 2 deferrals

These are approved exclusions from the current release:

1. Imports and exports
2. SEZ and deemed exports
3. UIN transactions
4. Reverse Charge Mechanism
5. E-invoicing and e-way bills
6. GST return filing
7. ITC reconciliation
8. Credit/debit notes and exceptional workflows
9. Multiple GST registrations
10. T13 GSTIN checksum verification
11. T13 GSTIN state-prefix validation
12. T13 registration-status verification
13. T13 effective-date verification

The T25 contract also records e-invoice item-total reconciliation and
credit/debit-note preservation as Version 2. The absence of these workflows is
an intentional boundary, not a current-release failure.

## Policy decision register

The classifications below apply to the seven policy topics reviewed during
this campaign. The owner-approved records establish product direction. They do
not settle every implementation detail or provide professional/statutory
confirmation.

| Policy topic | Classification | Authoritative source | Approved direction | Remaining boundary |
|---|---|---|---|---|
| Non-zero cess governance | B: current-release policy prerequisite; E: professional/statutory confirmation dependency | [0004, Decision and Engineering requirements](../decisions/0004-cess-governance-policy.md); [accounting question pack, Q-07 and Q-09](./gst-accounting-decision-question-pack.md#q-07-taxable-value-discounts-pricing-mode-and-rounding) | Cess is separate, source-backed, effective-dated, and blocked when governance or utilization treatment is unavailable | The rule catalog, utilization treatment, and implementation evidence remain open; zero-cess flows do not prove non-zero cess support |
| Inclusive-tax purchase extraction and Rule 35 | B: current-release policy prerequisite; E: professional/statutory confirmation dependency | [0005, Decision and Engineering requirements](../decisions/0005-inclusive-purchase-pricing-policy.md); [accounting question pack, Q-07](./gst-accounting-decision-question-pack.md#q-07-taxable-value-discounts-pricing-mode-and-rounding) | Inclusive and exclusive modes are distinct; inclusive extraction preserves supplier amount, extracted taxable value, tax, mixed rates, and residual adjustments | Governed purchase workflow, precision examples, residual policy, and qualified confirmation remain open |
| Invoice-wide freight allocation | D: outside established current-release scope | [0006, Decision and Consequences](../decisions/0006-freight-discount-allocation-policy.md); [domestic specification, §19](./domestic-gst-modernization.md#19-tax-calculation-and-precision-contract) | Freight and inventory-cost allocation remain separate; unsupported allocation cases fail closed | No approved invoice-wide freight feature may be inferred; do not add it to T19 or T25 |
| Explicit line discounts, invoice-wide discounts, and linked post-supply notes | B for supported explicit line discounts; C for linked credit/debit-note and exceptional workflows | [0006, Decision and Engineering requirements](../decisions/0006-freight-discount-allocation-policy.md); [Version 2 deferrals](#explicit-version-2-deferrals) | Explicit line discounts remain supported where supplied; proportional or post-supply cases require a governed workflow | Unallocated or post-supply cases remain blocked; linked note workflows are deferred |
| Statutory rounding precedence and residual adjustment | B: current-release policy prerequisite; E: professional/statutory confirmation dependency | [0007](../decisions/0007-gst-rounding-precision-policy.md); [0009, T25-04 and T25-07](../decisions/0009-gst-precision-rounding-engineering-contract.md#owner-decision-matrix); [accounting question pack, Q-07](./gst-accounting-decision-question-pack.md#q-07-taxable-value-discounts-pricing-mode-and-rounding) | Preserve intermediate precision, use an explicit engineering precedence, separate commercial round-off, and isolate Section 170 rounding | The legally applicable aggregation boundary and exact statutory interpretation remain unconfirmed; implementation evidence is not professional confirmation |
| Discrepancy tolerance and authorized reconciliation | B: current-release policy prerequisite | [0008](../decisions/0008-purchase-gst-discrepancy-tolerance-policy.md); [accounting question pack, Q-08](./gst-accounting-decision-question-pack.md#q-08-purchase-declaredcalculatedaccepted-values-and-reconciliation) | Policy differences block automatic acceptance; arithmetic differences require attributable authorized reconciliation | Exact threshold, materiality, actor, segregation, and evidence matrix remain unresolved; tolerance never proves ITC eligibility |
| ITC eligibility and inventory valuation | B: current-release policy prerequisite; E: professional/statutory confirmation dependency; ITC reconciliation is C | [0003](../decisions/0003-inventory-gst-valuation-policy.md); [accounting question pack, Q-08 and Q-09](./gst-accounting-decision-question-pack.md#q-08-purchase-declaredcalculatedaccepted-values-and-reconciliation) | Recoverable, non-recoverable, and partially recoverable GST remain separate; unresolved eligibility keeps valuation pending | Transaction-level eligibility evidence and valuation activation remain open; the deferred ITC reconciliation workflow must not be added indirectly |

No policy topic is classified as an approved universal accounting or statutory
rule. Owner approval authorizes the stated product direction and fail-closed
boundaries only.

## Remaining decision register

| ID | Exact decision needed | Affected function | Resolver and evidence |
|---|---|---|---|
| R-01 | Confirm the legally applicable Section 170 aggregation boundary and tax-head treatment | T25 | Qualified GST/accounting review with source citation, examples, and effective date |
| R-02 | Approve the governed inclusive purchase extraction, mixed-rate reconciliation, and residual adjustment examples | T25 and purchase workflow | Accounting/GST owner plus qualified reviewer; focused calculator and persisted-value evidence |
| R-03 | Define discrepancy thresholds, materiality units, authority, segregation, stale-decision behavior, and evidence fields | T19 | Accounting/finance owner and qualified GST reviewer; actor matrix and accepted/rejected examples |
| R-04 | Confirm current HSN/SAC, rate, POS, UTGST, and cess source governance for supported scenarios | Shared T13/T19/T25 inputs | Qualified GST reviewer; effective-dated source matrix and catalog evidence |
| R-05 | Define transaction-level ITC eligibility evidence before enabling authoritative inventory valuation | T19 purchase accounting | Accounting/GST owner and qualified reviewer; policy version, evidence, and valuation scenarios |
| R-06 | Run target-bound T13 and T25 application verification and obtain independent technical acceptance for all three suites | T13, T19, T25 | Authorized disposable target contract, sanitized runtime evidence, and separate review record |
| R-07 | Complete applied-schema, production-security, rollout, recovery, and release gates | Shared release boundary | Authorized database/security owners; applied-state catalog, RLS, recovery, and release evidence |

These decisions do not expand current-release scope. They close evidence and
confirmation gates for the already approved boundary.
