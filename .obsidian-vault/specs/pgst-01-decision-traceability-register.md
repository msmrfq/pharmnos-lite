# PGST-01 — D-GST Decision Traceability Register

**Date:** 2026-10-24  
**Phase:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Status:** Traceability register only; PGST-01 remains `PENDING — NOT APPROVED`  
**Implementation authorization:** `NOT GRANTED`  

This register is the original and authoritative D-GST-01–D-GST-52 decision
register and the canonical repository source, cross-referencing the decisions
against the [PGST-01 policy](./pgst-01-purchase-gst-workflow-policy.md) and the
[purchase GST persistence design](./purchase-gst-persistence-design.md).

### Source provenance

The D-GST identifiers and selected wording in this file are the original
Product Owner decision content supplied to the agent context when this
register was created. This file is the authoritative D-GST-01–D-GST-52
decision register and canonical repository source. No separate source register
was created in the repository. No decision may be silently reconstructed,
expanded, or altered.

A traceability entry does not prove implementation, runtime validation,
professional review, or formal approval.

## 1. Status vocabulary and evidence boundaries

- `DOCUMENTED`: The selected direction is clearly recorded in canonical
  documentation.
- `PARTIALLY DOCUMENTED`: The direction exists, but policy, design, authority,
  implementation, or evidence details remain incomplete.
- `NOT DOCUMENTED`: No sufficient canonical repository evidence was found.
- `CONTRADICTED`: Current code or documentation conflicts with the selected
  direction.
- `UNVERIFIABLE`: The requirement is described, but execution or independent
  evidence is unavailable.

Pure-domain tests, source inspection, SQL assets, and design proposals do not
prove database enforcement or runtime behavior. The current purchase path is
[finalizePurchaseAction](../../src/app/_actions/purchases.actions.ts#L217-L419),
the pure reconciliation boundary is
[purchase-gst-reconciliation.service.ts](../../src/domain/services/purchase-gst-reconciliation.service.ts#L135-L248),
and the current purchase models are in
[schema.prisma](../../prisma/schema.prisma#L397-L468).

### Verified evidence reference index

The following direct references were verified during the documentation audit.
They distinguish source/design evidence from executed validation evidence:

| Evidence | Direct repository reference | Evidence class |
|---|---|---|
| Selected F-08 architecture and required posting rechecks | [PGST-01 policy §12.11](./pgst-01-purchase-gst-workflow-policy.md#1211-f-08-finalizationposting-boundary-review) | Policy/design; not implementation proof |
| Formal approval prerequisites and pending status | [PGST-01 policy §§11.3–11.4](./pgst-01-purchase-gst-workflow-policy.md#113-formal-approval-prerequisites-versus-later-gates) | Governance documentation |
| F-03/F-07/F-08 dispositions | [PGST-01 policy §12.8](./pgst-01-purchase-gst-workflow-policy.md#128-product-level-recommendations-for-f-03-f-07-and-f-08) | Product/policy documentation |
| Supplier evidence, acceptance, legacy, and atomic workflow design | [Persistence design §§11–15](./purchase-gst-persistence-design.md#11-state-acceptance-and-posting-rules) | Design proposal; not implementation proof |
| Current combined purchase transaction | [`finalizePurchaseAction`](../../src/app/_actions/purchases.actions.ts#L217-L419) | Source inspection |
| Current purchase schema | [`purchase_invoices` and `purchase_invoice_items`](../../prisma/schema.prisma#L397-L468) | Source inspection |
| Pure reconciliation and acceptance guard | [`reconcilePurchaseGstEvidence`](../../src/domain/services/purchase-gst-reconciliation.service.ts#L135-L197) and [`canCompletePurchaseAccounting`](../../src/domain/services/purchase-gst-reconciliation.service.ts#L203-L248) | Pure-domain source |
| Pure reconciliation tests | [purchase-gst-reconciliation.test.ts](../../tests/purchase-gst-reconciliation.test.ts#L1-L210) | Test source; not executed by this task |
| Permission boundary | [`requirePermission`](../../src/lib/db/tenant-context.ts#L25-L31) | Source inspection |
| RLS configuration | [05-rls-tenant-policies.sql](../../prisma/05-rls-tenant-policies.sql#L43-L61) and purchase/audit policies at [lines 170–224](../../prisma/05-rls-tenant-policies.sql#L170-L224) | SQL source; runtime not verified |
| Financial validation requirements and blockers | [Financial Verification Matrix](./financial-e2e-validation-harness.md#financial-verification-matrix) and [fixture lifecycle contract](./financial-e2e-validation-harness.md#pure-readiness-and-fixture-lifecycle-contract) | Planned validation; not executed |
| GST implementation evidence matrix | [GST remediation status matrix](./gst-audit-validation-and-plan.md#L12-L47) | Documentation/source inspection; runtime not verified |

## 2. Decision traceability matrix

| ID | Selected decision | Policy / design evidence | Current evidence and status | Implementation / validation status | Follow-up and responsible role |
|---|---|---|---|---|---|
| D-GST-01 | Preserve supplier-declared and calculated values separately; unresolved discrepancies block posting. | Policy §§1.3–1.7; persistence §§1, 11 | Policy/design documented; current schema/action do not persist or enforce it. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Persist immutable evidence and posting guard; Engineering + Accounting/GST |
| D-GST-02 | Missing required GST values remain missing and block posting; drafts can remain editable. | Policy §§1.2–1.3; persistence §§11, 14 | Pure reconciliation distinguishes missing values; strict posting enforcement is absent. `PARTIALLY DOCUMENTED` | Pure tests only; runtime unverified. | Approve required fields and fail-closed transitions; Accounting/GST + Engineering |
| D-GST-03 | Preserve original evidence and create linked correction versions. | Policy §7; persistence §§4, 14–15 | Immutable revision design exists; current schema has no such records. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Approve and implement revision chain; Engineering |
| D-GST-04 | Separately authorize evidence entry, discrepancy resolution, accounting acceptance, and posting. | Policy §§1.3–1.5, 12.8; persistence §§10–11 | Separation is documented; current authorization/action surfaces are incomplete. `PARTIALLY DOCUMENTED` | Not implemented; authorization unverified. | Complete authority matrix and enforcement; Accounting/GST + Security/Architecture + Engineering |
| D-GST-05 | Preserve posted history and use authorized linked corrections or reversals. | Policy §§7, 9; persistence §§14–15 | Direction and design are recorded; correction/reversal lineage is not implemented. `PARTIALLY DOCUMENTED` | Runtime unverified. | Approve correction/reversal policy and model; Accounting/GST + Engineering |
| D-GST-06 | Use idempotent posting retries and reject request-key reuse with different data. | Policy §12.11; persistence idempotency design | Design requirement exists; no current operation record or key handling. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Define durable idempotency model; Engineering + Security/Architecture |
| D-GST-07 | Material pre-posting changes invalidate affected accounting acceptance. | Policy §§1.4–1.5; persistence §§11, 15 | Revision binding is proposed; current action has no GST revision checks. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Add transaction-time revision checks; Engineering |
| D-GST-08 | Concurrent posting must not produce duplicate financial effects. | Policy §12.11; persistence §§12, 15 | Requirement is documented, but no race evidence exists. `UNVERIFIABLE` | No authorized isolated execution. | Define isolation/locking and run race tests; Engineering |
| D-GST-09 | Required financial database writes are atomic; external effects have reliable recovery. | [finalizePurchaseAction](../../src/app/_actions/purchases.actions.ts#L217-L419); [persistence §15](./purchase-gst-persistence-design.md#15-atomic-workflow-boundaries); [Financial Verification Matrix](./financial-e2e-validation-harness.md#financial-verification-matrix) | Existing transaction boundary is inspected; rollback/recovery is not proven. `PARTIALLY DOCUMENTED` | Runtime unverified. | Failure-injection and external-effect review; Engineering |
| D-GST-10 | Preserve append-only audit history subject to approved retention and lawful deletion rules. | Policy §§4, 7; persistence §§8, 12 | Append-only direction exists; retention/deletion and persistence enforcement are missing. `PARTIALLY DOCUMENTED` | Not verified. | Accounting/GST, legal/privacy, Security/Architecture |
| D-GST-11 | Preserve legacy drafts and block noncompliant posting. | Policy §§1.1, 1.3, 1.7; persistence §14; F-03 | Policy boundary exists; current draft finalization does not apply it. `PARTIALLY DOCUMENTED` | Current behavior is incomplete/contradictory; runtime unverified. | Implement explicit legacy eligibility; Engineering + Accounting/GST |
| D-GST-12 | Preserve original supplier invoice evidence and link extracted values to its source version. | Policy §1.7; persistence §§4, 7 | Provenance design exists; current persistence is aggregate-only. `PARTIALLY DOCUMENTED` | Not implemented. | Approve source/provenance model; Accounting/GST + Engineering |
| D-GST-13 | Correct extraction errors through controlled, auditable corrections and repeat affected checks. | Policy §§7, 12.8; persistence §§4, 14–15 | Correction concept exists; workflow is absent. `PARTIALLY DOCUMENTED` | Not implemented. | Define correction/reassessment workflow; Accounting/GST + Engineering |
| D-GST-14 | Block confirmed duplicate invoices; review uncertain matches and preserve evidence. | No dedicated canonical section or implementation found. | Duplicate matching policy is absent. `NOT DOCUMENTED` | Not implemented; runtime unverified. | Define matching and review authority; Accounting/GST + Engineering |
| D-GST-15 | Preserve original posted purchases after cancellation and record linked corrections or reversals. | Policy §§7, 9; persistence §14 | History-preservation direction exists; no linked reversal implementation. `PARTIALLY DOCUMENTED` | Not implemented. | Accounting/GST determination and Engineering design |
| D-GST-16 | Record supplier credit/debit notes as separate linked documents. | Policy correction references; persistence §§14–15 | Note-specific treatment/model not found. `NOT DOCUMENTED` | Not implemented. | Accounting/GST and qualified GST determination; Engineering |
| D-GST-17 | Preserve supplier-issued invoice numbers separately from internal purchase identifiers. | [`purchase_invoices.supplier_invoice_no` and `invoice_no`](../../prisma/schema.prisma#L397-L425) | Separate fields exist at schema level, but historical preservation and correction behavior are unverified. `PARTIALLY DOCUMENTED` | Schema fields are present; runtime persistence, correction linkage, and historical invoice reproduction are unverified. | Verify persistence, correction linkage, and historical invoice reproduction; Engineering + Accounting/GST |
| D-GST-18 | Preserve original supplier context and use an auditable correction workflow. | Policy §1.7; persistence §§4, 14 | Provenance/correction direction exists; current implementation absent. `PARTIALLY DOCUMENTED` | Not implemented. | Approve mandatory provenance and correction fields; Accounting/GST + Engineering |
| D-GST-19 | Use versioned, explicitly approved GST calculation rules. | Policy §§6–7; persistence §§7, 11; service `rule_version` | Rule-version requirement exists; approved rule register absent. `PARTIALLY DOCUMENTED` | Pure service only; no persisted version. | Qualified GST professional + Accounting/GST |
| D-GST-20 | Preserve previous calculations and create new versions when recalculation is required. | Persistence §7 | Immutable calculation design exists; current schema/action lack it. `PARTIALLY DOCUMENTED` | Not implemented. | Engineering design and implementation |
| D-GST-21 | Require authorized discrepancy review with documented reason and audit record. | [Policy §12.8](./pgst-01-purchase-gst-workflow-policy.md#128-product-level-recommendations-for-f-03-f-07-and-f-08); [resolution fields](../../src/domain/services/purchase-gst-reconciliation.service.ts#L203-L248); [persistence §11](./purchase-gst-persistence-design.md#11-state-acceptance-and-posting-rules); [pure tests](../../tests/purchase-gst-reconciliation.test.ts#L1-L210) | Required metadata is documented; durable authority/event enforcement absent. `PARTIALLY DOCUMENTED` | Pure tests are source evidence only and were not executed by this task. | Accounting/GST authority and Engineering persistence |
| D-GST-22 | Define required GST fields by approved transaction scenario. | Policy §§1.1, 6; F-06 | Scenario boundary is described; approved field matrix absent. `PARTIALLY DOCUMENTED` | Not implementation-ready. | Qualified GST professional + Accounting/GST |
| D-GST-23 | Use approved scenario-specific tax-rate and place-of-supply rules; escalate uncertainty. | Policy §6; persistence §11 | Fail-closed direction exists; legal rules/effective dates absent. `PARTIALLY DOCUMENTED` | Not implemented. | Qualified GST determination |
| D-GST-24 | Preserve invoice- and line-level evidence with approved aggregation and rounding rules. | Persistence §§4, 13; policy §7 | Design supports evidence; current purchase schema stores aggregate GST only. `PARTIALLY DOCUMENTED` | Existing rounding behavior only; GST persistence unverified. | Accounting/GST approval and additive schema design |
| D-GST-25 | Mark unverified evidence and block posting where verification is required. | Policy §§1.3–1.4; persistence §11 | Fail-closed requirement documented; verification state absent. `PARTIALLY DOCUMENTED` | Not implemented. | Define status and guard; Engineering |
| D-GST-26 | Correct posted financial facts through linked authorized transactions, not direct rewriting. | Policy §§7, 9; persistence §§14–15 | Design direction exists; current models/actions do not enforce it. `PARTIALLY DOCUMENTED` | Not implemented. | Accounting/GST + Engineering |
| D-GST-27 | Establish approved evidence-retention periods, access controls, legal holds, and deletion/redaction rules. | No complete canonical determination found. | Requirements remain open. `NOT DOCUMENTED` | No approved policy. | Accounting/GST, legal/privacy, Security/Architecture |
| D-GST-28 | Protect historical audit records through persistence-layer controls. | Policy §7; persistence §12 | Limitations and possible controls are documented; no applied protection evidence. `PARTIALLY DOCUMENTED` | Runtime unverified. | Security/Architecture + Engineering |
| D-GST-29 | Enforce tenant ownership across server and database access; test cross-tenant denial. | Tenant-scoped action; RLS SQL; financial E2E matrix | Application/RLS assets exist; execution is absent. `PARTIALLY DOCUMENTED` | Runtime unverified. | Isolated tenant/RLS validation; Engineering + Security/Architecture |
| D-GST-30 | Deny by default and prevent demo-tenant/development bypasses in protected workflows. | Policy §§1.1, 5; `requirePermission` | `requirePermission` returns early for the demo tenant. `CONTRADICTED` | Current code conflicts; no security validation. | Remove/constrain/isolate bypass; Engineering + Security/Architecture |
| D-GST-31 | Require separate acceptance and posting permissions; different people are not universally required unless approved policy says so. | Policy §§1.4–1.5, 12.8; persistence §§10–11 | Separation documented; final organizational rule absent. `PARTIALLY DOCUMENTED` | Not implemented. | Accounting/GST + Security/Architecture |
| D-GST-32 | Use database-enforced transaction, concurrency, version, and uniqueness safeguards. | Persistence §§2, 12, 15 | Proposed safeguards exist; current schema lacks GST revisions/idempotency. `PARTIALLY DOCUMENTED` | Runtime unverified. | Engineering design and isolated validation |
| D-GST-33 | Persist durable tenant-scoped idempotency identities and outcomes. | Persistence idempotency design; policy §12.11 | Design exists; current model/action absent. `PARTIALLY DOCUMENTED` | Not implemented. | Engineering + Security/Architecture |
| D-GST-34 | Use atomic financial writes and reliable retry-safe handling of external effects. | Current Prisma transaction; financial E2E matrix | Internal boundary exists; reliable retry/recovery is not evidenced. `PARTIALLY DOCUMENTED` | Runtime unverified. | Engineering failure/retry review |
| D-GST-35 | Use layered duplicate invoice matching; block confirmed duplicates and review uncertain matches. | No dedicated policy/code evidence found. | Matching policy absent. `NOT DOCUMENTED` | Not implemented. | Accounting/GST + Engineering |
| D-GST-36 | Preserve original invoice/extraction values and record auditable corrections. | Policy §1.7; persistence §§4, 14 | Design direction exists; current persistence absent. `PARTIALLY DOCUMENTED` | Not implemented. | Engineering after review |
| D-GST-37 | Preserve legacy drafts without fabricating missing evidence or acceptance. | F-03; policy §§1.1, 1.3, 1.7; persistence §14 | Product decision documented; current finalization path does not enforce it. `PARTIALLY DOCUMENTED` | Implementation gap; runtime unverified. | Engineering |
| D-GST-38 | Use a dedicated disposable test database, synthetic fixtures, and reports outside resettable data. | [Financial E2E safety requirements](./financial-e2e-validation-harness.md#safety-requirements); [fixture lifecycle contract](./financial-e2e-validation-harness.md#pure-readiness-and-fixture-lifecycle-contract) | Harness contract documented. `DOCUMENTED` | No database execution. | Engineering to provision authorized environment |
| D-GST-39 | Validate GST, purchases, sales interactions, inventory, integrity, authorization, tenancy, concurrency, rollback, idempotency, audit, and cleanup. | [Financial Verification Matrix](./financial-e2e-validation-harness.md#financial-verification-matrix); [GST remediation status matrix](./gst-audit-validation-and-plan.md#L12-L47) | Required validation is documented. `DOCUMENTED` | Database scenarios not executed. | Engineering + Security/Architecture after authorization |
| D-GST-40 | Require Accounting/GST, qualified professional where applicable, Engineering, Security/Architecture review, and authorized approval. | Policy §§5, 11.3, 12 | Governance requirement documented. `DOCUMENTED` | No completed review/approval evidence. | Named reviewers and authorized approver |
| D-GST-41 | No automatic discrepancy tolerance; every discrepancy, including one-paisa differences, requires review unless a specifically approved rule exists. | Policy §12.8; persistence §§11, 13 | No invented tolerance is documented; approved exception rule absent. `PARTIALLY DOCUMENTED` | Professional determination pending. | Accounting/GST + qualified GST professional |
| D-GST-42 | Never silently ignore discrepancies; exceptions require qualified review, versioned rule, rationale, and audit evidence. | Policy §§1.4, 12.8; persistence §11; service | Direction and pure metadata are documented; qualified durable enforcement absent. `PARTIALLY DOCUMENTED` | Pure tests only. | Accounting/GST + Engineering |
| D-GST-43 | Initially support only explicitly enumerated, reviewed, approved purchase scenarios; unsupported/uncertain scenarios remain draft-only. | Policy §§1.1, 6; F-06 | Scope principle documented; final scenario enumeration absent. `PARTIALLY DOCUMENTED` | Not implementation-ready. | Qualified GST professional + Accounting/GST |
| D-GST-44 | Block posting when tax treatment is uncertain; do not guess rates, place of supply, eligibility, or treatment. | Policy §6; persistence §11 | Fail-closed policy documented. `DOCUMENTED` | Current action does not yet enforce GST scenario gating. | Engineering after professional rule approval |
| D-GST-45 | Use an explicitly permissioned accounting role configured by the organization, with auditable role assignments. | Policy §12.8; persistence §10 | Authorized-role direction documented; configured authority matrix absent. `PARTIALLY DOCUMENTED` | Current helper is generic and has demo bypass. | Accounting/GST + Security/Architecture |
| D-GST-46 | Permit the same person to accept and post only when separately authorized and approved policy allows it. | Policy §§1.4–1.5, 12.8 | Separation is documented; same-actor organizational rule unresolved. `PARTIALLY DOCUMENTED` | Not implemented. | Accounting/GST + Security/Architecture |
| D-GST-47 | Preserve rejected supplier invoice evidence and block posting until authorized resolution or replacement. | Policy §§1.3–1.7; persistence §§4, 11, 14 | Preservation/fail-closed direction exists; rejection state and replacement workflow incomplete. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Accounting/GST + Engineering |
| D-GST-48 | Handle supplier corrections, credit notes, and debit notes as linked versions or separate documents, with effects governed by approved scenario-specific rules and authorization. | Policy §§7, 9; persistence §§4, 14–15 | General correction-chain design exists; note-specific treatment absent. `PARTIALLY DOCUMENTED` | Not implemented; professional determination pending. | Accounting/GST + qualified GST professional + Engineering |
| D-GST-49 | Reproduce finalized invoices from persisted snapshots and linked evidence, including accepted values and applicable rule/calculation versions. | Policy §7; persistence §§1, 11, 14 | Requirement documented; current purchase schema/action lack snapshot/evidence persistence. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Accounting/GST + Engineering |
| D-GST-50 | Persist tenant-scoped idempotency keys, canonical payload fingerprints, status, and outcome. | Policy §12.11; persistence idempotency design | Design requirement documented; current model/action absent. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Engineering + Security/Architecture |
| D-GST-51 | Revalidate accepted evidence/calculation revisions and purchase version inside posting using database-enforced conditional transitions and atomic writes. | Policy §12.11; persistence §§11, 15 | Selected Alternative 3A requirement documented; current action does not perform these checks. `PARTIALLY DOCUMENTED` | Not implemented; runtime unverified. | Engineering |
| D-GST-52 | Define and verify transaction isolation/concurrency and database-enforced invoice-sequence uniqueness, including race-condition tests in an isolated database. | [Policy §12.11](./pgst-01-purchase-gst-workflow-policy.md#1211-f-08-finalizationposting-boundary-review); [persistence §§12 and 15](./purchase-gst-persistence-design.md#12-tenant-guarantees-and-application-only-invariants); [Financial Verification Matrix](./financial-e2e-validation-harness.md#financial-verification-matrix) | Validation requirement documented; no isolated race or sequence evidence. `UNVERIFIABLE` | No database execution. | Engineering + Security/Architecture |

## 3. Critical gaps and contradictions

### 3.1 Demo-tenant permission bypass

`requirePermission` returns before checking permissions when the tenant is the
demo tenant:

```ts
if (ctx.tenantId === DEMO_TENANT_ID) return;
```

Location: [tenant-context.ts](../../src/lib/db/tenant-context.ts), symbol
`requirePermission`.

This contradicts the deny-by-default protected-workflow requirement in
D-GST-30. Engineering and Security/Architecture must decide whether the bypass
is removed, constrained to explicitly non-protected demo behavior, or otherwise
isolated before activation.

### 3.2 Missing persisted GST workflow records

The current purchase models contain ordinary purchase totals and aggregate
`gst_amount`, but no persisted supplier evidence revisions, calculation
versions, reconciliation records, accounting decisions, current pointers, or
GST record version. The persistence design describes these as a proposal; it
does not establish implementation or migration.

### 3.3 Missing posting-time GST revalidation

`finalizePurchaseAction` checks tenant-scoped purchase identity and ordinary
purchase status, recalculates current totals, and performs the financial
writes. It does not revalidate current GST evidence, calculation, reconciliation,
acceptance, accepted values, or GST revision/version inside the transaction.

### 3.4 Missing durable idempotency

The current action uses a Prisma transaction but has no durable tenant-scoped
idempotency key, canonical payload fingerprint, operation status, or stored
outcome. Equivalent retries and changed-payload key reuse are therefore not
verified.

### 3.5 Unverified concurrency, sequence, rollback, RLS, and cross-tenant denial

The SQL/RLS assets and transaction code are repository evidence of intended
configuration only. The financial E2E harness explicitly requires an isolated
database and records these behaviors as unverified or blocked.

### 3.6 Missing duplicate-invoice, note, correction, reversal, retention, and
historical reproduction implementation

The policy/design direction is incomplete or design-only for duplicate invoice
matching, dedicated credit/debit-note documents, correction/reversal lineage,
retention/legal holds/deletion/redaction, and persisted historical invoice
snapshots.

## 4. Review and approval register

| Review | Reviewer identity | Authority/qualification | Outcome | Date | Evidence references | Conditions/follow-up |
|---|---|---|---|---|---|---|
| Accounting/GST | `NOT SUPPLIED — STATUS ASSERTED BY PRODUCT OWNER DIRECTIVE` | `NOT SUPPLIED` | `PASSED — PRODUCT OWNER CONFIRMED; REVIEW ARTIFACT NOT SUPPLIED` | `NOT SUPPLIED` | Current-session Product Owner directive | Detailed reviewer identity, authority, rationale, conditions, and source artifact remain to be supplied. |
| Qualified GST professional | `NOT SUPPLIED — STATUS ASSERTED BY PRODUCT OWNER DIRECTIVE` | `NOT SUPPLIED` | `PASSED — PRODUCT OWNER CONFIRMED; REVIEW ARTIFACT NOT SUPPLIED` | `NOT SUPPLIED` | Current-session Product Owner directive | Detailed reviewer identity, qualification, scope, rationale, conditions, and source artifact remain to be supplied. |
| Engineering | `NOT SUPPLIED` | `NOT SUPPLIED` | `PENDING` | `PENDING` | `NOT SUPPLIED` | Review Alternative 3A persistence, transaction, idempotency, concurrency, rollback, sequence, and validation design. |
| Security/Architecture | `NOT SUPPLIED` | `NOT SUPPLIED` | `PENDING` | `PENDING` | `NOT SUPPLIED` | Review authorization, demo bypass, tenant isolation, RLS, replay, immutability, retention, and correction security. |
| Product Owner specification confirmation | Product Owner decision supplied in current conversation | Product Owner | `RECORDED — PRODUCT DECISION ONLY` | 2026-10-24 | Current conversation; policy §12.11 | Does not approve PGST-01 or implementation. |
| Authorized formal PGST-01 approver | `NOT SUPPLIED` | `NOT SUPPLIED` | `PENDING — NOT APPROVED` | `PENDING` | `NOT SUPPLIED` | Requires completed reviews, dossier, conditions, authority basis, policy version, and approval record. |

## 5. Governance status

- **F-08:** `SELECTED — PRODUCT OWNER; REVIEWS PENDING`
- **Alternative 3A:** `SELECTED — PRODUCT OWNER`
- **Accounting/GST review:** `PASSED — PRODUCT OWNER CONFIRMED; REVIEW ARTIFACT NOT SUPPLIED`
- **Qualified GST determination:** `PASSED — PRODUCT OWNER CONFIRMED; REVIEW ARTIFACT NOT SUPPLIED`
- **Engineering review:** `PENDING`
- **Security/Architecture review:** `PENDING`
- **PGST-01:** `PENDING — NOT APPROVED`
- **Implementation authorization:** `NOT GRANTED`

Alternative 3A requires separate authorized accounting acceptance before
posting, followed by transaction-time revalidation of accepted evidence,
calculation/reconciliation revisions, purchase ownership, authorization,
idempotency identity, and optimistic/concurrency state. These remain
requirements, not verified implementation behavior.

## 6. Required follow-up sequence

1. Obtain the Accounting/GST and qualified GST determinations.
2. Resolve the authorization matrix and demo-tenant bypass.
3. Complete Engineering and Security/Architecture design reviews.
4. Approve the persistence, migration, idempotency, concurrency, rollback,
   correction, reversal, and historical-reproduction designs.
5. Authorize implementation separately from PGST-01 approval.
6. Execute the guarded isolated-database validation only after its own
   authorization and safety prerequisites are satisfied.
7. Record the formal PGST-01 approval or conditions in the approval register.

No step above authorizes implementation, migration, database execution, pilot
activation, or production rollout.
