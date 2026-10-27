# PGST-01 — Purchase GST Workflow Policy

**Status:** PENDING — PRODUCT-OWNER INPUTS RECORDED; ENGINEERING/SECURITY AND FORMAL APPROVAL PENDING
**Official phase:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Product decision-maker:** Project Owner / Product Owner  
**Accountable policy owner:** Not confirmed  
**Implementation authorization:** NOT GRANTED  
**Database/migration authorization:** NOT GRANTED  
**Testing authorization:** NOT GRANTED  
**Controlled-pilot authorization:** NOT GRANTED  
**Production-rollout authorization:** NOT GRANTED

This record captures the consolidated Product-owner decision register
PD-01–PD-35, together with unresolved external reviews. It does not
constitute complete PGST-01 policy approval, authorize implementation, or
establish database, testing, pilot, or production readiness.

## 1. Recorded Product-owner decisions

The following decisions were explicitly supplied by the Project Owner /
Product Owner on **2026-10-24**. They are recorded as Product-owner decisions,
not as Accounting/GST approval, qualified GST-professional review, Engineering
approval, Security/Architecture approval, or implementation authorization.

### 1.1 Controlled-pilot scope

**APPROVED BY PRODUCT OWNER — PRODUCT DECISION ONLY**

Apply the new purchase-GST workflow only to a specifically selected pilot
cohort. Apply it only to new purchases created after explicit pilot activation
for that cohort. Purchases outside the pilot retain existing behavior; the
pilot must not expand silently, and legacy behavior must not be represented as
satisfying the new GST controls.

Existing drafts created before activation must not be silently converted to the
new workflow. They must be held for explicit classification under the
forthcoming legacy-posting and evidence policies.

The Product-owner decision does not identify the cohort or authorize pilot
activation. The cohort, included and excluded businesses, purchase scenarios,
users, roles, and activation conditions remain unresolved.

**Real pilot business and tenant:** `NOT IDENTIFIED — PRODUCT NOT YET IN USE`

**Proposed future profile:** One future business, with explicitly selected
authorized users and documented supported domestic purchase scenarios. This is
a planning boundary only; it does not identify a real business, tenant, user,
or transaction population.

The initial planning boundary is limited to ordinary, documented domestic
purchase scenarios. Special, ambiguous, unsupported, or legally unresolved
scenarios remain outside the planning boundary until the required specialist
reviews are complete. Missing required facts or evidence must not permit
finalization or posting.

The actual business/tenant identity, user assignments, scenario suitability,
and pre-activation draft inventory must be verified before any pilot
activation decision.

The scope decision must identify:

- included and excluded tenants and businesses;
- included and excluded purchase scenarios;
- included users and roles;
- permitted draft creators, reviewers, reconcilers, accounting acceptors,
  and finalizers/posters;
- behavior for purchases outside the pilot;
- authority to change the cohort; and
- conditions for expanding the scope.

No tenant, business, user, role, identifier, date, or cohort selection is
recorded by this proposal.

**Pending external review:** Accounting/GST review for accounting and posting
implications; qualified GST-professional review where tax interpretation is
involved.

### 1.2 Controlled-pilot operating boundaries

**APPROVED BY PRODUCT OWNER — PRODUCT DECISION ONLY**

The following additional pilot boundaries are approved as Product direction:

1. **Incomplete pilot drafts:** Saving and editing are permitted, but
   finalization and posting are blocked until required evidence,
   reconciliation, accounting acceptance, and other applicable controls pass.
2. **Role separation:** Creation, reconciliation/review, accounting acceptance,
   and finalization/posting should be separate where feasible. Exact
   permissions and exceptions remain subject to PGST-08 and Security/
   Architecture review.
3. **Activation prerequisite:** Applicable approvals and activation gates must
   be satisfied before enabling the workflow. Product-owner approval alone is
   insufficient.
4. **Disable and rollback:** An authorized disable mechanism must be defined
   before activation. Disabling must not erase audit history or silently
   revert transactions already processed.
5. **Pilot exit:** Success criteria, monitoring, issue escalation, and
   exit/rollback conditions must be defined before pilot authorization. The
   pilot must not automatically expand to general production.

These are Product-owner decisions only. They do not define a cohort, dates,
users, role assignments, thresholds, success metrics, named approvers, or
pilot authorization.

**Pending review:** Accounting/GST, Engineering, Security/Architecture, and
qualified GST-professional review where applicable. Exact role permissions,
exceptions, evidence requirements, disable/rollback mechanics, monitoring,
exit criteria, and gate ownership remain open.

### 1.3 Incomplete drafts

**APPROVED BY PRODUCT OWNER — PRODUCT DECISION ONLY**

Incomplete purchase drafts may be saved and edited under approved draft rules.
Saving or editing a draft does not establish GST compliance, review
submission, reconciliation, accounting acceptance, finalization, or posting.

Finalization and inventory/supplier-accounting posting remain blocked until all
approved GST controls pass.

**Pending external review:** Accounting/GST confirmation of posting
restrictions. Minimum evidence and stage-specific requirements remain assigned
to PGST-03.

### 1.4 Workflow model

**APPROVED BY PRODUCT OWNER — PRODUCT DECISION ONLY**

Prefer a small persisted lifecycle-status set supported by separate evidence,
calculation, reconciliation, accounting-decision, and audit-event records.
Review states may be derived where practical.

Derived UI state must never substitute for required immutable evidence,
reconciliation events, accounting decisions, authorization evidence, or audit
provenance.

**Pending technical review:** Engineering and Security/Architecture review of
representation and enforcement.

### 1.5 Posting architecture

**SELECTED BY PRODUCT OWNER — PRODUCT DECISION ONLY**

Defer the choice between:

- **Alternative 3A:** retain the combined finalization-and-posting transaction
  as a compatibility candidate; or
- **Alternative 3B:** separate finalization from accounting-completion and
  posting operations.

Alternative 3A is selected as the Product Owner's preferred boundary. This
selection does not authorize implementation. The boundary must still review atomicity,
authorization, idempotency, retries, concurrency, rollback, invoice
sequencing, inventory, supplier-ledger and payable effects, and historical
integrity.

**Pending review:** Accounting/GST and Engineering, with Security/Architecture
review where authorization or integrity is affected.

### 1.6 Activation and authorization sequence

**APPROVED BY PRODUCT OWNER — PRODUCT DECISION ONLY**

Retain the following eight distinct gates:

1. Policy approval.
2. Technical design approval.
3. Separate implementation authorization.
4. Database/migration authorization where applicable.
5. Isolated validation readiness.
6. Successful isolated database-backed financial validation.
7. Separate controlled-pilot authorization.
8. Separate general production-rollout authorization.

This Product-owner decision retains the proposed sequence; it does not approve
any gate, assign gate-level owners or authorizers, or grant any authorization.
Approval of one gate does not approve or waive another.

**Pending external review:** Accounting/GST, Engineering, and
Security/Architecture as applicable. Formal gate authorizers and accountable
owners remain unassigned.

### 1.7 Product decision conditions

**Confirmed Product-owner direction: supplier-invoice values**

Supplier-declared values and tax amounts must be preserved as declared source
values, including their original representation, source, and provenance.
Missing, conflicting, unreadable, or unsupported information must not be
fabricated or silently resolved through assumptions. Supplier-declared values
must not be silently changed, replaced, normalized, substituted, or
overwritten by application-calculated values.

Application calculations must remain distinguishable from supplier-declared
values, reconciliation results, and accounting-accepted values. Reconciliation
must not modify supplier evidence. Where declared and calculated values differ,
the discrepancy must be recorded and handled under the approved review and
accounting process. This direction confirms Product behavior only; it does
not settle tax rules, thresholds, rounding interpretation, accounting
precedence, or qualified GST-professional review.

The following remain unresolved despite the Product-owner decisions:

- pilot cohort, scope boundaries, exclusions, and activation conditions;
- specialist treatment of the already accepted supported and excluded purchase
  scenarios;
- users, roles, and segregation of duties;
- classification and evidence requirements for pre-activation drafts;
- minimum supplier evidence and capture timing beyond preservation of the
  supplier's source values;
- accounting acceptance and discrepancy rules; and
- gate-level owners, authorizers, and evidence;
- disable/rollback mechanics, monitoring, success criteria, escalation, and
  pilot exit conditions.

The proposed future pilot profile remains subject to later verification of the
actual tenant identity, user assignments, scenario suitability, and
pre-activation draft inventory.

When a future business is proposed, record it as **CANDIDATE NOMINATED FOR
ASSESSMENT — NOT SELECTED FOR ACTIVATION**. The nomination record must capture
the verified business boundary, proposed users and roles, supported scenarios
and exclusions, pre-activation draft inventory status, and known evidence
gaps. No real candidate is currently identified by this policy.

## 1.8 Consolidated Product-owner decision register

The following register consolidates the 35 Product-owner decisions supplied
for this policy. Each entry remains an approved Product direction only.
Required specialist and technical reviews, closure evidence, formal PGST-01
approval, and later operational authorizations remain separate and pending
unless explicitly recorded elsewhere in this policy.

### 1.8.1 Pilot scope, nomination, roles, and legacy drafts

| ID | Approved Product direction | Canonical section | Required review | Outstanding conditions and authorization dependencies |
|---|---|---|---|---|
| PD-01 | Plan for one future business and a specifically bounded pilot cohort; the real business remains unidentified. | §1.1 | Accounting/GST, qualified GST professional, Engineering, Security/Architecture | No real business, tenant, cohort, or user assignment exists; pilot authorization is not granted. |
| PD-02 | Apply the new workflow only to purchases created after explicit pilot activation. | §1.1, §1.6 | Engineering | Activation timing and routing enforcement remain undefined. |
| PD-03 | Preserve existing behavior outside the pilot without representing legacy behavior as satisfying the new GST controls. | §1.1, §4 | Accounting/GST, Engineering | Legacy disclosure and routing remain to be reviewed. |
| PD-04 | Require explicit, auditable classification of pre-activation drafts; do not silently convert them. | §1.1, §1.7, §4 | Accounting/GST, Engineering | Classification, posting treatment, and evidence rules remain unresolved. |
| PD-05 | Permit incomplete pilot drafts to be saved and edited, but block finalization/posting until controls pass. | §1.2, §1.3, §4 | Accounting/GST, Engineering, Security/Architecture | Required evidence and stage-specific controls remain unresolved. |
| PD-06 | Do not silently fall back to legacy processing for unsupported, ambiguous, legally unresolved, or incomplete cases. | §1.1, §1.3, §4 | Accounting/GST, qualified GST professional, Engineering | Scenario classification and fail-closed enforcement remain pending. |
| PD-07 | Nominate a future business for assessment, not activation; record its boundary, users/roles, scenarios/exclusions, draft inventory, and evidence gaps. | §1.1, §1.7 | Product, then all relevant specialist/technical reviewers | No candidate currently exists; actual nomination fields are candidate-dependent. |
| PD-08 | Limit pilot access to explicitly selected authorized users and roles; do not grant access to all business users by default. | §1.1, §1.2, §2 | Security/Architecture, Accounting/GST | User assignments, role matrix, exceptions, and segregation of duties remain open. |
| PD-09 | Keep demo data and separately authorized disposable validation fixtures distinct from a real pilot and inactive by default. | §1.1, §9 | Engineering, Security/Architecture | Fixture ownership, database identity, cleanup, and validation authorization remain blocked. |

### 1.8.2 Mandatory controls, evidence, calculation, reconciliation, and posting

| ID | Approved Product direction | Canonical section | Required review | Outstanding conditions and authorization dependencies |
|---|---|---|---|---|
| PD-10 | Do not permit manual bypass of mandatory GST controls; unmet controls remain non-postable. | §1.3, §4, §5 | Accounting/GST, Engineering, Security/Architecture | The complete control list and enforcement evidence are pending. |
| PD-11 | Preserve supplier evidence and prior decisions; do not silently change, replace, normalize, substitute, or overwrite declared values; record correction details and trigger reassessment where relevant. | §1.7, §4, §7 | Accounting/GST, qualified GST professional, Engineering | Product preservation direction is confirmed; mandatory evidence, capture timing, correction, and reassessment workflow remain unresolved. |
| PD-12 | Do not fabricate historical tax facts or silently infer missing information; hold affected purchases when required review or acceptance cannot occur. | §7, §9 | Accounting/GST, qualified GST professional | Legacy disclosure and hold-state rules remain pending. |
| PD-13 | Prevent silent deletion or rewriting of consequential GST evidence, decisions, acceptance, and financial history. | §4, §7 | Security/Architecture, Engineering, qualified GST professional | Retention, deletion exceptions, legal requirements, and technical enforcement remain open. |
| PD-14 | Keep reconciliation and accounting acceptance distinct; a match or resolved discrepancy does not independently authorize posting. | §1.3, §1.4, §5 | Accounting/GST, Engineering | Acceptance authority and posting-guard evidence remain pending. |
| PD-15 | Ensure retries and repeated finalization/posting do not duplicate effects or silently overwrite concurrent decisions. | §1.5, §5 | Engineering, Security/Architecture, Accounting/GST | Alternative 3A/3B, idempotency, concurrency, and runtime evidence remain unresolved. |
| PD-16 | Require traceable audit events for consequential GST actions, including actor, target, timestamp, reason, context, outcome, and retry correlation where relevant. | §1.4, §5 | Engineering, Security/Architecture | Event model, actor rules, provenance, and immutable audit enforcement remain pending. |
| PD-17 | Trace supplier evidence to its source, purchase, and supported decisions, preserving original representation and distinguishing original evidence, entered values, calculations, reconciliation, accepted values, and corrections. | §1.7, §4, §7 | Accounting/GST, qualified GST professional, Engineering | Product provenance and non-fabrication direction is confirmed; mandatory evidence, capture metadata, and unreadable/conflicting-evidence handling remain open. |
| PD-18 | Preserve calculation inputs, sources, rule/version, outputs, and recalculation history without authorizing changes to current rounding behavior. | §7 | Accounting/GST, qualified GST professional, Engineering | Rule versions, precision, component completeness, and rounding interpretation remain pending. |
| PD-19 | Distinguish pending evidence, pending reconciliation, matched, discrepancy, resolution pending, resolved, and rejected/correction-required outcomes. | §1.4, §4 | Accounting/GST, Engineering | Final status vocabulary and transition authority remain open; this is not a finalized schema. |
| PD-20 | Keep draft readiness distinct from posting authorization; require all controls before finalization/posting and preserve traceable correction, cancellation, and reversal workflows. | §1.3, §1.5, §4, §5 | Accounting/GST, Engineering, Security/Architecture | Lifecycle transitions and accounting workflows remain pending. |
| PD-21 | Require specialist/technical reviews, verified scope and users, classified drafts, rollback arrangements, monitoring/exit criteria, and separate authorization before pilot activation. | §1.2, §1.6, §5, §8, §9 | Accounting/GST, qualified GST professional, Engineering, Security/Architecture | No activation authorization has been granted. |

### 1.8.3 Pilot governance and readiness

| ID | Approved Product direction | Canonical section | Required review | Outstanding conditions and authorization dependencies |
|---|---|---|---|---|
| PD-22 | Provide pilot monitoring with an owner and backup, review frequency, escalation, pause/disable authority, remediation/resumption criteria, and reporting against approved criteria. | §1.2, §5, §10 | Product, Accounting/GST, Engineering, Security/Architecture | Owners, monitoring design, and authorization remain unassigned. |
| PD-23 | Measure pilot success across control compliance, financial integrity, evidence/reconciliation quality, reliability, auditability, readiness, and safety/exit conditions. | §1.2, §5 | Product, Accounting/GST, Engineering, Security/Architecture | Thresholds, sources, review periods, and pass/fail rules remain open. |
| PD-24 | Require documented assessment and authorization for material scope changes, with rationale, impact, decision owner, and effective point. | §1.1, §1.2, §5 | Product and affected specialist/technical reviewers | Scope-change authority and evidence remain unassigned. |
| PD-25 | Limit pilot data access to approved purposes and role-appropriate access, protecting supplier documents, tax identifiers, financial information, audit records, exports, and diagnostics. | §1.2, §2, §5 | Security/Architecture, Engineering, qualified GST professional where applicable | Access controls, retention, deletion, and legal exceptions remain pending. |
| PD-26 | Link each material GST decision to the purchase, evidence, calculation, reconciliation, accounting decision, authorization, and resulting financial action where applicable. | §1.4, §5 | Engineering, Security/Architecture, Accounting/GST | Traceability and database-backed evidence remain unverified. |
| PD-27 | Require dispute reasons/evidence, independent review where feasible, preserved history, reassessment after changes, and escalation outside approved scope. | §4, §7 | Accounting/GST, qualified GST professional, Security/Architecture | Dispute workflow, separation rules, and escalation authority remain unresolved. |
| PD-28 | Block finalization/posting when a mandatory control cannot be verified; hold and escalate interrupted or uncertain-integrity actions. | §1.3, §4, §5 | Engineering, Accounting/GST, Security/Architecture | Recovery behavior and runtime proof are absent. |
| PD-29 | Require pilot closeout against approved criteria, accounting for pilot purchases, unresolved-risk recording, reviews, and an explicit complete/extend/pause/terminate outcome. | §1.2, §5, §10 | Product, Accounting/GST, Engineering, Security/Architecture | Closeout owner, evidence, and authorization are not assigned. |
| PD-30 | Require ongoing governance through periodic review, incident and inconsistency review, scope/policy reassessment, follow-up, and pause/disablement when criteria cease to be satisfied. | §1.2, §10 | Product, Accounting/GST, Engineering, Security/Architecture | Governance cadence and accountability remain open. |
| PD-31 | Require a consolidated readiness dossier containing policy, register, reviews, validation evidence, limitations, defects, residual-risk decisions, and operational/activation records. | §8, §9, §10 | Product and all required reviewers/formal authorizer | The dossier is not yet complete; completeness does not prove legal or technical safety. |
| PD-32 | Give every unresolved requirement or finding a unique reference, impact, accountable role, reviewer, closure evidence, disposition, and readiness consequence. | §4, §6, §9 | Product and relevant reviewer | The policy's unresolved-item register remains incomplete relative to this requirement. |
| PD-33 | Version the readiness dossier with revision date, owner, change traceability, superseded versions, reassessment after evidence changes, and explicit status. | §8, §9 | Product, formal approver, all relevant reviewers | Dossier versioning and ownership are not yet recorded. |
| PD-34 | Keep Product direction, specialist review, formal policy approval, implementation, database operations, validation, pilot activation, and production rollout distinct, each with scope, authority, conditions, and effective point. | §1.6, §5, §8, §9 | Product, formal authorizers, relevant reviewers | Eight gates exist, but owners, authorizers, evidence, and effective points remain blank. |
| PD-35 | Reconcile the decision register before policy consolidation, preserve decision identities, and require separate authorization before editing the canonical policy. | §1.8, §10 | Product and policy-file authorizer | This consolidation is documentation-only; later changes require their own authorization. |

These entries preserve the distinction between approved Product direction,
specialist or technical review, formal PGST-01 approval, and operational
authorization. No entry above constitutes formal PGST-01 approval.

## 2. Authority and review boundaries

| Discipline | Proposed responsibility | Status |
|---|---|---|
| Product | Workflow, draft behavior, controlled-pilot direction, scope, and user experience. | Product decision recorded by Project Owner / Product Owner on 2026-10-24; policy approval remains pending. |
| Accounting/GST | Accounting acceptance authority, posting restrictions, discrepancy handling, legacy treatment, and accounting policy. | Review pending. |
| Qualified GST professional | Applicable tax treatment, place of supply, CGST/SGST/IGST/cess, tax-related rounding, historical disclosure, and correction/reversal questions where professional review is required. | Review pending; no legal conclusion recorded. |
| Engineering | State/event design, transaction boundary, atomicity, idempotency, retries, concurrency, rollback, and schema implications. | Technical review pending. |
| Security/Architecture | Authorization enforcement, tenant isolation, provenance, immutability, relation scope, and bypass prevention. | Review pending. |
| Formal stakeholders/authorizers | Actual decisions, accountable owners, required evidence, and explicit outcomes for each gate. | No names or outcomes recorded. |

## 3. Recorded Product-owner decision table

| Product decision | Actual Product-owner response | Conditions or modifications | Decision-maker | Decision date | Approval status |
|---|---|---|---|---|---|
| Controlled pilot only for a specifically selected cohort; new workflow applies only to purchases created after explicit activation, while purchases outside the pilot retain existing behavior. | Approved by Product Owner. | Existing pre-activation drafts must not be silently converted; cohort, boundaries, exclusions, scenarios, users, roles, and activation conditions remain pending. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; EXTERNAL APPROVALS PENDING |
| Incomplete pilot drafts may be saved and edited, but finalization/posting is blocked until required controls pass. | Approved by Product Owner. | Required evidence, reconciliation, acceptance, and applicable controls remain to be defined and reviewed. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; EXTERNAL APPROVALS PENDING |
| Separate creation, reconciliation/review, accounting acceptance, and finalization/posting where feasible. | Approved by Product Owner. | Exact permissions and exceptions remain subject to PGST-08 and Security/Architecture review. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; EXTERNAL APPROVALS PENDING |
| Require approvals and activation gates before enabling; Product-owner approval alone is insufficient. | Approved by Product Owner. | Gate owners, authorizers, evidence, and outcomes remain pending; pilot authorization is not granted. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; GATE AUTHORIZATIONS PENDING |
| Define authorized disable/rollback before activation without erasing audit history or silently reverting processed transactions. | Approved by Product Owner. | Mechanism, authority, and transaction-handling details remain pending technical and security review. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; ACTIVATION NOT AUTHORIZED |
| Define pilot success criteria, monitoring, escalation, and exit/rollback conditions before authorization; do not auto-expand to production. | Approved by Product Owner. | Metrics, thresholds, monitoring ownership, escalation path, and exit criteria remain pending. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; PILOT/PRODUCTION AUTHORIZATIONS PENDING |
| Incomplete drafts may be saved and edited; finalization and posting remain blocked until approved GST controls pass. | Approved by Product Owner. | None supplied; accounting controls and minimum evidence remain pending. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; EXTERNAL APPROVALS PENDING |
| Compact persisted lifecycle-status model supported by distinct evidence, calculation, reconciliation, accounting-decision, and audit-event records; derived UI states must not replace evidence or authorization. | Approved by Product Owner. | None supplied; technical representation and enforcement remain pending. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; EXTERNAL APPROVALS PENDING |
| Select Alternative 3A combined finalization/posting. | Selected by Product Owner. | Preserve the existing atomic purchase-finalization boundary; accounting acceptance remains a separate authorized action before posting; posting must recheck current evidence/calculation revisions, reconciliation status, accounting decision and accepted values, actor authorization, tenant/purchase ownership, and optimistic-version or equivalent concurrency controls. | Project Owner / Product Owner | 2026-10-24 | SELECTED — IMPLEMENTATION NOT AUTHORIZED; ENGINEERING, SECURITY/ARCHITECTURE, AND ACCOUNTING/GST REVIEW PENDING |
| Retain eight distinct policy, design, implementation, migration, validation, pilot, and rollout gates. | Approved by Product Owner. | None supplied; gate owners, authorizers, evidence, and outcomes remain pending. | Project Owner / Product Owner | 2026-10-24 | PRODUCT DECISION RECORDED; GATE AUTHORIZATIONS PENDING |

These entries record Product-owner decisions only. They do not constitute
Accounting/GST approval, qualified GST-professional review, Engineering or
Security/Architecture approval, PGST-01 policy approval, or any implementation
or activation authorization.

## 4. Unresolved decision table

| Question | Owner/reviewer | Required evidence | Dependency | Outcome | Approval status |
|---|---|---|---|---|---|
| What is the exact pilot cohort and boundary? | Product; Accounting/GST | Cohort, tenant/business, user/role, and scenario matrix. | PGST-01 |  | PENDING |
| Which purchase scenarios are supported or excluded? | Product; Accounting/GST; qualified GST professional where applicable | Approved scenario matrix and professional review where tax interpretation is involved. | PGST-01, PGST-03 |  | PENDING |
| Which roles may create, review, reconcile, accept, finalize, and post? | Accounting/GST; Security/Architecture | Role and segregation-of-duties matrix. | PGST-08 |  | PENDING |
| How are pre-activation drafts treated? | Product; Accounting/GST | Legacy classification and transition rules. | PGST-02, PGST-03 | Product Owner direction decided in §12.8: preserve as legacy until explicit classification; no silent conversion or invented facts; posting remains blocked. Accounting treatment and enforcement remain pending. | DECIDED — PRODUCT OWNER CONFIRMED; REVIEW PENDING |
| What evidence is required at each stage? | Accounting/GST; qualified GST professional where applicable | Minimum-evidence and capture-timing matrix. | PGST-03 |  | PENDING |
| How are discrepancies resolved? | Accounting/GST; qualified GST professional where applicable | Materiality, tolerance, resolution, and acceptance policy. | PGST-07, PGST-08 | Product Owner direction decided in §12.8: reconciliation remains separate from acceptance; unresolved discrepancies cannot be accepted; authorized accounting acceptance requires complete evidence and auditable decision metadata. Materiality, tolerance, and tax interpretation remain pending review. | DECIDED — PRODUCT OWNER CONFIRMED; REVIEW PENDING |
| Will the final boundary be 3A or 3B? | Accounting/GST; Engineering; Security/Architecture as applicable | Separate boundary analysis covering atomicity, rollback, retries, concurrency, and financial effects. | PGST-11, PGST-14 |  | PENDING |
| How are logical states represented? | Engineering; Product; Security/Architecture | Approved status/event/persistence design. | PGST-09 through PGST-12 |  | PENDING |
| What evidence is required before testing and pilot? | Engineering; Accounting/GST; Security/Architecture | Isolated database-backed financial evidence and rollback results. | PGST-11 through PGST-13 |  | PENDING |
| Who is accountable for each authorization gate? | Product and formal stakeholders | Completed owner/authorizer matrix and dated outcomes. | All gates |  | PENDING |
| What is the formal PGST-01 outcome? | Proposed Product owner and required reviewers | Decision record with conditions, evidence, date, and outcome. | PGST-01 |  | PENDING |

## 5. Activation-gate record

| Gate | Purpose | Accountable owner | Authorizer/reviewer | Required evidence | Failure handling | Outcome |
|---|---|---|---|---|---|---|
| Policy approval | Approve workflow policy, scope direction, posting restrictions, and dependencies. |  | Product; Accounting/GST; qualified GST professional where relevant. | Completed decision record, scope outcome, conditions, reviewer outcomes, date. | Failure blocks technical design approval. | PENDING |
| Technical design approval | Approve state/event, evidence, authorization, transaction, tenant, immutability, and correction design. |  | Engineering; Product; Security/Architecture; Accounting/GST for financial behavior. | Approved technical design, state/event mapping, authorization matrix, risks, and rollback design. | Failure blocks implementation authorization. | PENDING |
| Implementation authorization | Permit defined application or schema implementation. |  | Product owner; Engineering; Security/Architecture; Accounting/GST where financial behavior changes. | Authorized scope, acceptance criteria, rollback owner, and implementation boundaries. | Failure blocks implementation. | NOT GRANTED |
| Database/migration authorization | Permit schema changes, migrations, backfills, or destructive actions where applicable. |  | Engineering; Security/Architecture; Product and Accounting/GST where financial history is affected. | Migration plan, compatibility review, rollback plan, database identity, and destructive-action approval. | Failure blocks applicable database work. | NOT GRANTED |
| Isolated validation readiness | Confirm safe readiness for an independently verified disposable database. |  | Engineering; Security/Architecture; Product and Accounting/GST for scenario coverage. | Disposable database identity, applied schema, owned fixtures, isolation plan, cleanup authorization, and recovery plan. | Failure blocks financial validation. | NOT READY |
| Isolated financial validation completion | Confirm runtime evidence for GST gates, posting, rollback, history, and financial effects. |  | Engineering; Accounting/GST; Security/Architecture; qualified GST professional where applicable. | Executed isolated evidence for discrepancies, acceptance, stock, ledger, payable, sequence, rollback, retries, concurrency, and history. | Failure blocks pilot authorization. | PENDING |
| Controlled-pilot authorization | Permit restricted operation for the approved cohort. |  | Product; Accounting/GST; Engineering; Security/Architecture; qualified GST professional where applicable. | Cohort definition, entry/exit criteria, monitoring, incident response, rollback authority, and pilot evaluation plan. | Failure blocks pilot activation. | NOT GRANTED |
| General production-rollout authorization | Permit activation beyond the controlled pilot. |  | Product; Accounting/GST; Engineering; Security/Architecture; other required reviewers. | Successful pilot evaluation, risk disposition, backup/restore, monitoring, connectivity, secret protection, and support readiness. | Failure blocks general rollout. | NOT GRANTED |

No owner, reviewer, authorizer, date, or outcome is populated without verified
stakeholder evidence.

## 6. Pending dependencies

All decisions below remain separate and **PENDING**:

- **PGST-02:** Legacy purchase classification and posting treatment.
- **PGST-03:** Minimum supplier evidence and capture timing.
- **PGST-04:** Deletion, cancellation, archival, and retention.
- **PGST-05:** Precision and rounding beyond the provisional baseline.
- **PGST-06:** Cess and signed `round_off` treatment.
- **PGST-07:** Discrepancy materiality, tolerance, and resolution.
- **PGST-08:** Acceptance authority, segregation of duties, and accepted-value precedence.
- **PGST-09:** Human and system provenance.
- **PGST-10:** Immutability and correction protection.
- **PGST-11:** Idempotency, retries, concurrency, atomicity, and rollback.
- **PGST-12:** Tenant-aware relationship integrity.
- **PGST-13:** Historical snapshots and legacy disclosure.
- **PGST-14:** Post-posting corrections, reversals, and applicable credit/debit notes.

After PGST-01 receives a formal recorded outcome, conduct the coordinated
**PGST-02/PGST-03 workshop**. Keep those decisions separate and record their
compatibility explicitly.

## 7. Qualified GST-professional review

Review is required where applicable for:

- supported purchase scenarios and required transaction facts;
- place-of-supply treatment;
- CGST, SGST, IGST, and cess;
- supplier evidence requirements;
- precision, tax-related rounding, and discrepancy interpretation;
- value precedence where supplier-declared and calculated values differ;
- legacy treatment and any proposed exception;
- historical tax disclosure; and
- corrections, reversals, credit notes, and debit notes.

No legal conclusion or completed professional review is claimed by this record.

## 8. Formal decision record

**Decision ID:** `PGST-01`  
**Title:** Purchase GST workflow, pilot scope, and activation sequence

**Proposed policy:** Status-based validation; incomplete drafts may be saved,
but acceptance, finalization, and posting require approved server-side controls.

**Recommended scope:** New purchases within a specifically defined and
separately authorized controlled-pilot cohort.

**Recommended activation sequence:** Policy approval → technical design
approval → implementation authorization → database/migration authorization
where applicable → isolated validation readiness → successful isolated
database-backed financial validation → controlled-pilot authorization →
general production-rollout authorization.

**Alternative 3A/3B outcome:** Separate later technical/accounting decision.

**Product decision-maker:** Project Owner / Product Owner  
**Product decision date:** 2026-10-24  
**Product decision evidence:** Explicit Product-owner decision supplied for this record; no signature or external supporting document supplied.

**Policy accountable owner:**  
`________________________________________`

**Required reviewers:**  
`________________________________________`

**Required authorizers by gate:**  
`________________________________________`

**Selected scope and cohort:**  
`________________________________________`

**Scope boundaries and pre-activation draft treatment:**  
`________________________________________`

**Conditions and deferred dependencies:**  
`________________________________________`

**Decision date:**  
`________________________________________`

**Evidence references:**  
`________________________________________`

**PGST-01 formal outcome:**  
`[ ] APPROVED` `[ ] RETURNED FOR REVISION` `[x] PENDING`

**Recorded Product-owner inputs:**  
`[x] Product inputs recorded` `[ ] Complete policy approval`

Product-owner input recording does not imply Accounting/GST approval,
qualified GST-professional review, Engineering approval,
Security/Architecture approval, implementation, database or migration,
testing, controlled-pilot, or production authorization.

## 9. Current blockers and authorization status

- PGST-01 remains **PENDING — NOT APPROVED**.
- Pilot cohort and scope boundaries are unresolved.
- Role and segregation-of-duties rules are unresolved.
- Classification and evidence details for pre-activation drafts are unresolved.
- Minimum evidence and stage-specific requirements are unresolved.
- Accounting acceptance and discrepancy rules are unresolved.
- Alternative 3A versus 3B is unresolved.
- Accounting/GST, qualified GST-professional, Engineering, and
  Security/Architecture reviews remain pending.
- Gate-level owners, authorizers, and evidence remain unassigned.
- Technical design and all later validation evidence are pending.
- Implementation authorization is **NOT GRANTED**.
- Database/migration authorization is **NOT GRANTED**.
- Testing and isolated financial validation authorization is **NOT GRANTED**.
- Controlled-pilot authorization is **NOT GRANTED**.
- Production-rollout authorization is **NOT GRANTED**.

## 10. Recommended next action

Complete the unresolved pilot scope, role and authorization fields, obtain the
required Accounting/GST, qualified GST-professional, Engineering, and
Security/Architecture reviews, and record the formal PGST-01 outcome. The
coordinated PGST-02/PGST-03 workshop remains dependent on that formal outcome.
Do not implement, migrate, test against a financial database, activate the
pilot, or roll out to production without the separate required authorizations.

## 11. Closure and evidence register

This section records the closure assessment from the read-only PGST-01
completion review. A documented question, design proposal, source inspection,
or pure test does not by itself close a substantive policy, technical, or
validation requirement. No finding below is a formal approval, implementation
authorization, database/migration authorization, testing authorization,
controlled-pilot authorization, or production-rollout authorization.

| Finding | Related Product decisions | Current evidence and closure condition | Responsible discipline | Status | Approval consequence |
|---|---|---|---|---|---|
| F-01 | PD-01, PD-07 | No real business, tenant, or cohort exists; the policy records `NOT IDENTIFIED — PRODUCT NOT YET IN USE`. Closure requires a verified future candidate nomination and suitability record. | Product | BLOCKED — EXTERNAL DEPENDENCY | Candidate scope and pilot activation remain blocked. |
| F-02 | PD-07, PD-08 | No participating users, role assignments, or segregation matrix exists. Closure requires candidate-specific assignments and an access matrix. | Product; Security/Architecture | BLOCKED — EXTERNAL DEPENDENCY | Technical approval and pilot activation remain blocked. |
| F-03 | PD-04, PD-05 | Product Owner confirmed the §12.8 legacy-draft treatment on 2026-10-24: preserve and explicitly classify pre-activation drafts; never silently convert them or invent missing facts; editing does not create strict-workflow eligibility; strict-workflow purchases require all controls before finalization/posting. Accounting/GST treatment and technical enforcement remain pending. | Product Owner; Accounting/GST; Engineering | DECIDED — PRODUCT OWNER CONFIRMED; EXTERNAL/TECHNICAL REVIEW PENDING | Product-decision dependency closed; formal approval, implementation, and pilot remain gated by required reviews. |
| F-04 | PD-06, PD-10, PD-28 | Fail-closed direction is recorded, but the complete mandatory-control matrix and enforcement evidence are absent. Closure requires specialist and technical review. | Accounting/GST; Engineering; Security/Architecture | OPEN — SPECIALIST REVIEW | Formal approval and implementation remain blocked. |
| F-05 | PD-11, PD-17 | Product direction now confirms preservation of supplier-declared values, original representation, provenance, and non-fabrication. Mandatory evidence, capture timing, source-quality rules, and persistence enforcement still lack specialist/technical approval. | Accounting/GST; qualified GST professional; Engineering | OPEN — SPECIALIST REVIEW | Formal approval and implementation remain blocked. |
| F-06 | PD-01, PD-06, PD-18 | The Product Owner has accepted ordinary, documented domestic purchase scenarios as the planning boundary and excluded unsupported or legally unresolved scenarios. Existing aggregate purchase behavior and rounding are documented; applicable rule versions, components, precision, cess, and professional interpretation remain unresolved. | Accounting/GST; qualified GST professional | OPEN — SPECIALIST REVIEW | Formal approval, implementation, and pilot remain blocked. |
| F-07 | PD-14, PD-19 | Product Owner confirmed the §12.8 acceptance boundary on 2026-10-24: reconciliation and acceptance remain separate; only an explicitly authorized accounting role or named authority may accept; accepted values, evidence/reconciliation references, rationale, actor, timestamp, and append-only decision event are required; unresolved discrepancies and incomplete, stale, missing, or unauthorized inputs fail closed. Exact accounting policy and enforcement remain pending. | Product Owner; Accounting/GST; Engineering; Security/Architecture | DECIDED — PRODUCT OWNER CONFIRMED; EXTERNAL/TECHNICAL REVIEW PENDING | Product-decision dependency closed; formal approval and technical design remain gated by required reviews. |
| F-08 | PD-15 | Product Owner selected Alternative 3A in §12.11 on 2026-10-24. The selection preserves the existing atomic purchase-finalization boundary, but Engineering, Security/Architecture, and Accounting/GST reviews remain pending; implementation is not authorized. | Product Owner; Engineering; Accounting/GST; Security/Architecture | SELECTED — PRODUCT OWNER; REVIEW PENDING | Technical design, implementation, and database authorization remain blocked pending required reviews. |
| F-09 | PD-15, PD-20 | Design and source inspection do not prove idempotency, concurrency, atomicity, recovery, or rollback against a database. Closure requires authorized isolated runtime evidence. | Engineering | BLOCKED — VALIDATION | Validation and pilot activation remain blocked. |
| F-10 | PD-13, PD-16, PD-26 | Immutable evidence, append-only history, audit provenance, and traceability are proposed but not implemented or verified. Closure requires technical enforcement review and evidence. | Engineering; Security/Architecture | OPEN — TECHNICAL REVIEW | Formal approval, implementation, and database work remain blocked. |
| F-11 | PD-12 | Historical disclosure principles are recorded, but historical immutability and representative runtime behavior are unverified. Closure requires specialist policy and isolated validation evidence. | Accounting/GST; qualified GST professional; Engineering | OPEN — SPECIALIST REVIEW | Formal approval and production readiness remain blocked. |
| F-12 | PD-13, PD-25 | Access, retention, deletion exceptions, and sensitive-data handling lack approved policy and security evidence. | Security/Architecture; qualified GST professional | OPEN — TECHNICAL REVIEW | Formal approval and production rollout remain blocked. |
| F-13 | PD-22, PD-23, PD-24 | Monitoring ownership, cadence, thresholds, escalation, and scope-change handling remain unassigned. | Product; Engineering; Security/Architecture | OPEN — TECHNICAL REVIEW | Pilot activation and production rollout remain blocked. |
| F-14 | PD-21, PD-29, PD-30 | Disablement, rollback, resumption, closeout, and ongoing governance are required but lack an approved operating mechanism. | Product; Engineering; Security/Architecture; Accounting/GST | OPEN — TECHNICAL REVIEW | Pilot activation and production rollout remain blocked. |
| F-15 | PD-31, PD-33 | A complete versioned readiness dossier with review records, validation evidence, defects, and risk decisions is not available. | Formal governance; Product | BLOCKED — AUTHORIZATION | Formal PGST-01 approval remains blocked. |
| F-16 | PD-32, PD-34 | Eight gates are documented, but owners, authorizers, conditions, evidence, and effective points are not populated because no verified authority record exists. | Formal governance | BLOCKED — AUTHORIZATION | Formal approval and all later gates remain blocked. |
| F-17 | PD-09, PD-21 | Pure fixture and safety contracts exist, but database identity, owned fixtures, cleanup execution, RLS, and financial execution remain unverified. | Engineering; Security/Architecture | BLOCKED — VALIDATION | Database/migration and validation gates remain blocked. |
| F-18 | PD-34 | Separate implementation, database/migration, testing, pilot, and production authorizations are absent. | Formal governance | BLOCKED — AUTHORIZATION | Each corresponding gate remains not granted. |

### 11.1 Evidence classification

The purchase persistence document is a design proposal only. Existing purchase
workflow documents and source inspection describe current aggregate GST and
finalization behavior; they do not prove the proposed PGST-01 controls.
Reconciliation, GST, fixture-lifecycle, and readiness tests are pure evidence
only. No database-backed persistence, RLS, tenant-isolation, rollback,
historical-immutability, or financial E2E evidence is recorded.

### 11.2 Engineering and Security/Architecture review conclusions

Read-only source inspection confirms the following current behavior and
limitations:

- `finalizePurchaseAction` is tenant-scoped, permission-checked, and wrapped
  in one Prisma transaction that updates purchase stock, supplier ledger,
  payable balance, invoice sequencing, and a purchase-finalized audit event.
- The current purchase workflow recalculates aggregate purchase totals from
  stored line items and preserves the existing aggregate GST and rounding
  baseline. It does not persist the proposed supplier-evidence, calculation,
  reconciliation, or accounting-acceptance records.
- The pure reconciliation service keeps supplier-declared, calculated, and
  accounting-accepted values distinct and rejects incomplete or invalid
  accepted values. Its own documentation states that authorization and
  persistence-backed audit verification remain responsibilities of a later
  workflow.
- Existing source inspection does not establish database-backed immutable
  evidence, append-only history, role separation, concurrent-decision
  protection, or runtime tenant-isolation behavior.

These are source-inspection conclusions, not Engineering or
Security/Architecture approvals. The Alternative 3A versus 3B decision,
enforcement design, schema compatibility, idempotency under concurrency,
recovery, and security validation remain open.

### 11.3 Formal approval prerequisites versus later gates

The following are prerequisites for formal PGST-01 approval: a reviewed policy
scope and exclusions; Accounting/GST and qualified GST-professional review of
the substantive tax and accounting questions; Engineering and
Security/Architecture review of the policy's technical enforceability; a
versioned dossier containing those records and unresolved-condition
dispositions; and a verified authorized approval record. No such complete set
is present.

Implementation, database/migration, isolated validation, controlled-pilot, and
production authorizations remain separate later gates. Their evidence is not
claimed as a prerequisite already satisfied by this documentation review, and
none is granted by this record.

### 11.4 Documentation review result

The closure review resolved the policy's Product Owner decision-register
traceability and evidence-classification documentation gaps. It did not close
any substantive specialist, technical, candidate-dependent, validation, or
authorization finding. The formal outcome therefore remains:

**PGST-01: PENDING — NOT APPROVED**

## 12. Consolidated specialist review and approval record

This section is the review worksheet and approval record for this policy. It
does not record a review, approval, authorization, or waiver until the
responsible reviewer or authorizer completes the applicable fields with
verifiable evidence. Reviewers must assess the policy as bounded by the
ordinary, documented domestic purchase scenarios in §1.1 and by the settled
supplier-invoice direction in §1.7.

### 12.1 Review record header

| Field | Entry |
|---|---|
| Policy reviewed | PGST-01 — Purchase GST Workflow Policy |
| Policy version/revision reviewed | `[TO BE COMPLETED]` |
| Review package source | This policy, §§1–11, PD-01–PD-35, F-01–F-18, and the purchase GST persistence design |
| Review period | `[TO BE COMPLETED]` |
| Formal PGST-01 status before review | `PENDING — NOT APPROVED` |
| Formal PGST-01 outcome | `[TO BE COMPLETED BY AUTHORIZED APPROVER]` |

### 12.2 Accounting/GST review

The reviewer must answer each question, record the rationale and conditions,
and cite the evidence used. A Product-owner direction is not an Accounting/GST
answer.

| Ref | Policy / finding | Question requiring an actual decision | Reviewer decision, rationale, conditions, evidence, identity, qualification, date |
|---|---|---|---|
| AG-01 | §1.1, §1.3, §4; F-03, F-04 | What treatment applies to incomplete and pre-activation drafts, and exactly what must be true before accounting completion, finalization, or posting? | `[TO BE COMPLETED]` |
| AG-02 | §1.7, §4; F-05, F-06 | What supplier-document evidence is mandatory at each stage, when must it be captured, and how are missing, unreadable, conflicting, or corrected source values handled without changing the preserved source? | `[TO BE COMPLETED]` |
| AG-03 | §1.7, §4; F-05, F-06, F-07 | How must supplier-declared, application-calculated, reconciled, and accounting-accepted values be compared, recorded, and authorized when they differ? | `[TO BE COMPLETED]` |
| AG-04 | §1.7, §4, §7; F-06, F-07, F-11 | Which discrepancy, acceptance, historical, correction, reversal, credit-note, debit-note, and later-reconciliation outcomes are permitted, and who may approve each? | `[TO BE COMPLETED]` |
| AG-05 | §1.7, §4, §6; F-06, F-11 | Does the bounded policy correctly preserve the existing two-decimal line values, whole-unit invoice rounding, signed `round_off`, and aggregate purchase behavior pending separately approved changes? Identify any required specialist interpretation without inventing a tolerance. | `[TO BE COMPLETED]` |
| AG-06 | §§1.2, 1.6, 5; F-07, F-14 | What accounting controls, role separation, posting restrictions, and unresolved conditions must be present for policy approval, and which may remain conditions of later gates? | `[TO BE COMPLETED]` |

**Accounting/GST reviewer record**

- Reviewer identity: `NOT SUPPLIED — STATUS ASSERTED BY PRODUCT OWNER DIRECTIVE`
- Role/authority: `NOT SUPPLIED`
- Decision: `PASSED — PRODUCT OWNER CONFIRMED; UNDERLYING REVIEW RECORD NOT SUPPLIED`
- Rationale and conditions: `The attached Product Owner directive states that Accounting/GST review passed. Detailed reviewer rationale and conditions remain to be supplied.`
- Evidence references: `Product Owner directive supplied in the current session; no independent review artifact is present in the repository.`
- Review date: `NOT SUPPLIED`

### 12.3 Qualified GST-professional review

No GST rule, legal conclusion, threshold, or scenario treatment is presumed by
this worksheet. The reviewer must state the covered facts, applicable
interpretation, exclusions, and any required professional limitations.

| Ref | Policy / finding | Question requiring an actual decision | Reviewer decision, rationale, conditions, evidence, identity, qualification, date |
|---|---|---|---|
| GSTP-01 | §§1.1, 1.7; F-06 | Are the ordinary, documented domestic purchase scenarios an appropriate bounded review scope? Identify scenarios that must be excluded or separately assessed. | `[TO BE COMPLETED]` |
| GSTP-02 | §§1.1, 1.7; F-05, F-06 | What transaction facts and supplier evidence are required for the covered scenarios, including treatment of missing, conflicting, or unreadable information? | `[TO BE COMPLETED]` |
| GSTP-03 | §§1.7, 4, 7; F-05, F-06, F-07 | What applicable treatment governs tax components, place of supply, cess where applicable, supplier-versus-calculated differences, and accepted-value decisions for the covered facts? | `[TO BE COMPLETED]` |
| GSTP-04 | §1.7, §7; F-06, F-11 | What precision, tax-related rounding, historical disclosure, and legacy-record limitations are professionally required? | `[TO BE COMPLETED]` |
| GSTP-05 | §4, §7; F-03, F-07, F-11 | What treatment is required for corrections, reversals, credit/debit notes, rejected invoices, and post-posting reassessment? | `[TO BE COMPLETED]` |
| GSTP-06 | §§1.2, 1.6, 5, 8; F-04, F-14 | What professional conditions must be satisfied before policy approval, and which are instead conditions for implementation, pilot, or production use? | `[TO BE COMPLETED]` |

**Qualified GST-professional reviewer record**

- Reviewer identity: `NOT SUPPLIED — STATUS ASSERTED BY PRODUCT OWNER DIRECTIVE`
- Qualification/authority: `NOT SUPPLIED`
- Decision: `PASSED — PRODUCT OWNER CONFIRMED; UNDERLYING REVIEW RECORD NOT SUPPLIED`
- Scope and exclusions: `Indian GST guideline review and covered GST scope are asserted complete by the Product Owner directive; detailed reviewer scope record remains to be supplied.`
- Rationale and conditions: `The attached Product Owner directive states that qualified GST-professional review passed. Detailed rationale and conditions remain to be supplied.`
- Evidence references: `Product Owner directive supplied in the current session; no independent review artifact is present in the repository.`
- Review date: `NOT SUPPLIED`

### 12.4 Engineering review

Engineering review must distinguish policy enforceability and design evidence
from later implementation and database-backed validation.

| Ref | Policy / finding | Question requiring an actual decision | Reviewer decision, rationale, conditions, evidence, identity, date |
|---|---|---|---|
| ENG-01 | §§1.3, 1.4, 4, 5; F-04, F-07, F-10 | Can the proposed lifecycle and separate evidence, calculation, reconciliation, accounting-decision, and audit-event records enforce the required fail-closed finalization/posting boundary? | `[TO BE COMPLETED]` |
| ENG-02 | §1.5; F-08 | Which boundary, 3A or 3B, is technically and financially suitable, and what are the consequences for atomicity, sequencing, retries, concurrency, and recovery? | `[TO BE COMPLETED]` |
| ENG-03 | §§1.4, 1.7; F-05, F-10 | How will supplier source representation/provenance, versioned calculations, reconciliation decisions, accepted values, and correction history be persisted without overwriting source evidence? | `[TO BE COMPLETED]` |
| ENG-04 | §§1.2, 1.6, 5; F-08, F-09, F-17 | What transaction, idempotency, retry, concurrency, recovery, rollback, and tenant-aware relationship controls are required, and which require later isolated runtime proof? | `[TO BE COMPLETED]` |
| ENG-05 | §§5, 6, 11; F-10, F-13, F-14, F-16 | What technical evidence is required for design approval, and what evidence is explicitly deferred to implementation, database/migration, validation, pilot, or production gates? | `[TO BE COMPLETED]` |

**Engineering reviewer record**

- Reviewer identity: `[TO BE COMPLETED]`
- Role/authority: `[TO BE COMPLETED]`
- Decision: `[PENDING — ACCEPT / ACCEPT WITH EXPLICIT CONDITIONS / REJECT / DEFER]`
- Rationale and conditions: `[TO BE COMPLETED]`
- Evidence references: `[TO BE COMPLETED]`
- Review date: `[TO BE COMPLETED]`

### 12.5 Security/Architecture review

Security/Architecture review must assess enforceability and risk without
claiming that implementation, RLS, immutability, or runtime isolation has been
verified.

| Ref | Policy / finding | Question requiring an actual decision | Reviewer decision, rationale, conditions, evidence, identity, date |
|---|---|---|---|
| SEC-01 | §§1.2, 2, 5; F-02, F-12 | What tenant, membership, and authorization boundaries are required so users can access only permitted supplier evidence, purchases, decisions, exports, logs, and diagnostics? | `[TO BE COMPLETED]` |
| SEC-02 | §§1.2, 1.6, 5; F-04, F-07, F-12 | What role separation and privileged-action controls are required for creation, review, reconciliation, accounting acceptance, finalization, posting, correction, disablement, and rollback? | `[TO BE COMPLETED]` |
| SEC-03 | §§1.4, 1.7, 5; F-10, F-12 | How must immutable source evidence, append-only decisions/events, provenance, audit history, and correction chains be protected from unauthorized alteration or deletion? | `[TO BE COMPLETED]` |
| SEC-04 | §§2, 5, 6; F-12, F-14 | What retention, deletion, archival, legal-exception, and sensitive-data minimization rules require policy conditions or later operational controls? | `[TO BE COMPLETED]` |
| SEC-05 | §§1.2, 1.6, 5; F-13, F-14, F-17 | What failure modes could bypass mandatory controls, and what disablement, incident, recovery, monitoring, and validation evidence is required before each later gate? | `[TO BE COMPLETED]` |

**Security/Architecture reviewer record**

- Reviewer identity: `[TO BE COMPLETED]`
- Role/authority: `[TO BE COMPLETED]`
- Decision: `[PENDING — ACCEPT / ACCEPT WITH EXPLICIT CONDITIONS / REJECT / DEFER]`
- Rationale and conditions: `[TO BE COMPLETED]`
- Evidence references: `[TO BE COMPLETED]`
- Review date: `[TO BE COMPLETED]`

### 12.6 Consolidated approval decision

This record may be completed only after the required review records above are
real, attributable, and supported by evidence. An open finding may be listed
as a condition only when the completed governance record expressly permits that
condition for policy approval; it must not be relabeled as an accepted
residual risk without that authority.

| Field | Entry |
|---|---|
| Required Accounting/GST review outcome | `PASSED — PRODUCT OWNER CONFIRMED; REVIEW ARTIFACT NOT SUPPLIED` |
| Required qualified GST-professional outcome where applicable | `PASSED — PRODUCT OWNER CONFIRMED; REVIEW ARTIFACT NOT SUPPLIED` |
| Required Engineering enforceability outcome | `[PENDING]` |
| Required Security/Architecture enforceability outcome | `[PENDING]` |
| F-01–F-18 disposition summary and evidence references | `[TO BE COMPLETED]` |
| Conditions and limitations permitted for policy approval | `[TO BE COMPLETED]` |
| Policy approval decision | `[PENDING — APPROVE / APPROVE WITH EXPLICIT CONDITIONS / REJECT / DEFER]` |
| Authorized approver identity | `[TO BE COMPLETED]` |
| Authority basis | `[TO BE COMPLETED]` |
| Approval decision date | `[TO BE COMPLETED]` |
| Approval record/evidence reference | `[TO BE COMPLETED]` |

Approval of PGST-01, if later recorded by an authorized approver, does not
grant the separate technical design, implementation, database/migration,
testing, isolated-validation, controlled-pilot, or production-rollout gates.
Those gates remain governed by §5 and must be recorded independently.

### 12.7 AI-led internal review and disposition

**Review type:** Internal AI-led policy review
**Review date:** 2026-10-24
**Review status:** Recommendation only; no external review, professional
certification, formal approval, or authorization is recorded.

The review assessed Accounting and purchase-workflow consistency, GST
scenario/evidence handling, Engineering enforceability and transaction
safety, and Security/Architecture controls. It treated the Product Owner's
supplier-value direction in §1.7 as settled: supplier-declared values remain
source values with their original provenance; they are not silently altered,
normalized, replaced, or fabricated; and declared, calculated, reconciled, and
accounting-accepted values remain distinct.

#### AI-reviewed conclusions

- The policy is internally coherent on the separation of source evidence,
  calculation, reconciliation, accounting acceptance, finalization, and
  posting.
- The purchase persistence design is a design proposal, not proof of schema
  enforcement, immutability, tenant isolation, or runtime transaction safety.
- Current source inspection supports only the documented aggregate purchase
  behavior and existing transaction boundary; it does not prove the proposed
  GST workflow is implemented.
- No GST legal interpretation, threshold, tolerance, professional conclusion,
  or tax-rule certification was inferred.
- Pure tests, source inspection, and design review are not database-backed
  validation.
- The policy's fail-closed direction is appropriate as Product direction, but
  its enforceability remains subject to technical review and later validation.

#### F-01–F-18 dispositions

| Finding | AI disposition | Basis and remaining boundary |
|---|---|---|
| F-01 | **Accepted as a bounded design limitation** | §1.1 deliberately leaves the real pilot business and tenant unidentified. This limits pilot activation, but an identified business is not required to define the bounded policy. |
| F-02 | **Accepted as a bounded design limitation** | §1.1–§1.2 leave candidate users and assignments open. Candidate-specific access evidence remains required before technical approval or pilot activation. |
| F-03 | **Resolved by existing documented Product Owner direction** | Product Owner confirmed the §12.8 legacy-draft treatment on 2026-10-24. The policy now preserves pre-activation drafts as legacy until explicit classification, prohibits silent conversion or invented facts, prevents editing from creating strict-workflow eligibility, and blocks posting until controls pass. Accounting treatment and technical enforcement remain external/later-gate dependencies. |
| F-04 | **Requires implementation or database-backed validation at a later gate** | Product fail-closed direction is recorded in §§1.2–1.3; enforcement evidence is absent and cannot be claimed from the design. |
| F-05 | **Resolved by existing documented Product Owner direction** | §1.7 settles preservation of supplier values, provenance, and non-fabrication. Mandatory evidence timing and source-quality implementation remain later review/workflow conditions. |
| F-06 | **Product Owner directive records qualified GST review passed; detailed artifact not supplied** | §1.1 bounds the scenarios. The attached directive states that the Indian GST guideline and qualified GST-professional review passed; reviewer identity, qualification, scope record, and detailed determination are not present in the repository. |
| F-07 | **Resolved by existing documented Product Owner direction** | Product Owner confirmed the §12.8 acceptance boundary on 2026-10-24. Reconciliation remains separate from acceptance; authorized accounting authority, complete evidence and decision fields, append-only event recording, and fail-closed conditions are now Product direction. Exact accounting policy and technical enforcement remain pending. |
| F-08 | **Selected by Product Owner; technical review and validation remain open** | PD-15 and §12.8 record Alternative 3A as selected by the Product Owner. Engineering and Security/Architecture review, implementation evidence, and runtime validation remain separate gates. |
| F-09 | **Requires implementation or database-backed validation at a later gate** | Source inspection and pure contracts do not prove idempotency, concurrency, atomicity, recovery, or rollback. |
| F-10 | **Requires implementation or database-backed validation at a later gate** | The persistence design proposes immutable and append-only structures, but no runtime enforcement or database evidence exists. |
| F-11 | **Product Owner directive records qualified GST review passed; runtime evidence remains open** | Historical disclosure, corrections, reversals, and related tax treatment are asserted as reviewed by the directive, but no underlying professional artifact is supplied and runtime immutability remains a later-gate requirement. |
| F-12 | **Unresolved blocker** | Security/Architecture review is required by §11.3 for technical enforceability, while retention and deletion policy also require decisions not present in repository evidence. |
| F-13 | **Accepted as a bounded design limitation** | Monitoring and scope-change controls are expressly deferred to pilot governance in §§1.2, 5, and 10; they do not need to be invented for this policy review. |
| F-14 | **Accepted as a bounded design limitation** | Disablement, rollback, closeout, and ongoing governance are later activation and operating controls under §§1.2 and 5, not claimed as complete here. |
| F-15 | **Unresolved blocker** | §11.3 requires a versioned dossier containing review records and dispositions; the AI review cannot substitute for the required external records. |
| F-16 | **Unresolved blocker** | §5 and §11.3 require verified authority, owners, authorizers, conditions, and a dated outcome; none is evidenced. |
| F-17 | **Requires implementation or database-backed validation at a later gate** | The financial harness explicitly records database identity, fixtures, cleanup, RLS, and financial execution as unverified. |
| F-18 | **Requires implementation or database-backed validation at a later gate** | PD-34 and §5 keep implementation, database, testing, pilot, and production authorizations separate; none is granted by this review. |

The dispositions above are AI recommendations except where the Product Owner
directive explicitly records a passed specialist review or Product Owner
selection. A passed status asserted by the directive does not substitute for
the underlying review artifact, technical review, runtime validation, formal
PGST-01 approval, or implementation authorization.

#### Governance determination

PGST-01 cannot be approved solely as an internal AI-led product-policy
decision under the current governance. The current Product Owner directive
records Accounting/GST and qualified GST-professional review as passed, but the
underlying review artifacts are not supplied here. Section 5 names those
reviews, and §11.3 also requires Engineering and Security/Architecture review
before formal PGST-01 approval.
Section 11.3 also requires a versioned dossier and a verified authorized
approval record. The policy contains no rule permitting those required reviews
to be waived or replaced by an AI review.

The truthful internal outcome is therefore a **policy recommendation for
external review**, while the formal outcome remains:

**PGST-01: PENDING — NOT APPROVED**

### 12.8 Product-level recommendations for F-03, F-07, and F-08

The following records the recommendations previously derived from the already
recorded Product Owner direction and the existing persistence design. The
Product Owner has now adopted the F-03 and F-07 recommendations below.
F-08 is selected as Alternative 3A by the Product Owner, subject to the
required reviews; this selection does not authorize implementation.

#### F-03 — Drafts and transitions

**Existing direction:** §§1.1 and 1.3 prohibit silently converting
pre-activation drafts, permit incomplete drafts to be saved and edited, and
block finalization and posting until the approved controls pass.

**AI recommendation:** Treat every pre-activation draft as a legacy draft
until it is explicitly classified under an approved legacy treatment. Do not
silently migrate it into the strict workflow, infer missing supplier facts, or
permit it to post through the new workflow. A draft that is edited after
activation must retain its original provenance and must not acquire new
workflow eligibility merely because it was edited. New post-activation
purchases may enter the strict workflow only when the required evidence,
reconciliation, accounting acceptance, and authorization checks pass.

**Rationale:** This is the narrowest interpretation of the settled
non-conversion and non-fabrication directions and is consistent with the
persistence design's §14 statement that legacy drafts require approved
treatment and cannot gain an unreviewed posting bypass.

**Product Owner confirmation:** Confirmed on 2026-10-24. This is a Product
decision, not Accounting/GST approval or Engineering approval.

**Status:** `DECIDED — PRODUCT OWNER CONFIRMED`; Accounting/GST review remains
required for the accounting treatment and Engineering review remains required
for enforceability.

#### F-07 — Reconciliation and accounting acceptance

**Existing direction:** §§1.4 and 1.7 distinguish reconciliation from
accounting acceptance. The persistence design's §§7 and 11 require complete
accepted values, a decision reference, rationale, actor, timestamp, and
explicit authorization; `MATCHED` or `RESOLVED` must not imply acceptance.

**AI recommendation:** Permit accounting acceptance only through an
explicitly authorized accounting role or named authority recorded by the
approved role matrix. Require the relevant preserved supplier evidence,
calculation/reconciliation result, discrepancy disposition where applicable,
complete accepted values, decision reference, rationale, approver, timestamp,
and an append-only decision event. A successful calculation, a `MATCHED`
result, or a resolved discrepancy must not itself grant acceptance. An
unresolved discrepancy, missing evidence, stale revision, incomplete accepted
values, or unauthorized actor must fail closed.

**Rationale:** This applies the already documented separation of declared,
calculated, reconciled, and accepted values without inventing a discrepancy
tolerance or legal precedence rule. The exact accounting role, delegation
rules, segregation exceptions, and accepted-value policy remain specialist
decisions.

**Product Owner confirmation:** Confirmed on 2026-10-24. This is a Product
decision, not Accounting/GST, qualified GST-professional, Engineering, or
Security/Architecture approval.

**Status:** `DECIDED — PRODUCT OWNER CONFIRMED`; Accounting/GST and
qualified GST-professional review remain required where tax interpretation is
involved, and Engineering/Security review is required for enforcement.

#### F-08 — Persistence architecture

**Existing definitions:** §1.5 defines Alternative 3A as retaining a
combined finalization-and-posting transaction and Alternative 3B as separating
finalization from accounting-completion and posting. The persistence design
does not select either label. Its §15 instead specifies that each transition
and append-only event commits atomically, including a final-posting operation
containing eligibility recheck, stock, supplier ledger, payable, sequence,
invoice finalization, version, and finalization event.

**AI recommendation:** Prefer **Alternative 3A** as the Product-facing
compatibility direction, subject to Engineering, Accounting/GST, and
Security/Architecture approval. It best matches the existing purchase
finalization behavior and the persistence design's atomic final-posting row,
while allowing evidence capture, calculation/reconciliation, correction, and
accounting-decision operations to remain separate guarded transitions before
posting. The recommendation does not authorize implementation and does not
preclude a later reviewed decision for Alternative 3B.

**Rationale:** A combined finalization/posting boundary reduces the risk of
partial stock, supplier-ledger, payable, invoice-sequence, and audit effects
after the eligibility recheck. This is a design rationale, not runtime proof;
the persistence design expressly leaves transaction atomicity, authorization,
concurrency, rollback, and database enforcement subject to later review and
validation.

**Status:** `SELECTED — PRODUCT OWNER CONFIRMED; REVIEW PENDING`; Engineering,
Security/Architecture, and Accounting/GST review remain required before
implementation. This selection does not constitute formal PGST-01 approval.

### 12.9 AI review issue reconciliation

The internal review found no contradiction in the settled supplier-value
direction, the prohibition on fabricating historical facts, or the separation
between policy approval and later gates. The following material dependencies
remain explicit:

| Issue | Evidence reviewed | Disposition | Remaining dependency |
|---|---|---|---|
| Legacy and incomplete draft transitions | §§1.1, 1.3; persistence design §14 | Product Owner direction confirmed; no silent conversion or posting bypass | Accounting/GST review plus Engineering enforcement review |
| Reconciliation versus accounting acceptance | §§1.4, 1.7; persistence design §§7, 11 | Product Owner control boundary confirmed; accounting policy and enforcement remain open | Accounting/GST, qualified GST-professional where relevant, Engineering, and Security review |
| Finalization/posting boundary | §1.5; persistence design §15 | Alternative 3A selected by Product Owner; required technical/accounting/security reviews remain pending | Engineering, Security/Architecture, and Accounting/GST review before implementation |
| Source preservation and provenance | §1.7; persistence design §§1, 13, 14 | Resolved as Product direction; not runtime verified | Implementation and later database-backed validation |
| Tenant isolation, immutability, auditability, and recovery | §§1.4, 1.6, 5, 11; persistence design §§8, 12, 15, 16 | Design requirements identified; no runtime claim made | Security/Architecture and Engineering review, then authorized validation |

### 12.10 Implementation-readiness handoff

This handoff is a documentation-only boundary for later authorized work. It
does not authorize implementation, schema changes, migrations, tests, or
database execution.

#### Ready for implementation design

- Preserve supplier-declared raw values, original representation, source
  provenance, and missing values without silent normalization or substitution.
- Keep declared, calculated, reconciled, and accounting-accepted values
  separate.
- Apply the confirmed F-03 legacy-draft boundary: no silent conversion,
  invented facts, or posting bypass.
- Apply the confirmed F-07 acceptance boundary: explicit authorized
  accounting acceptance, complete evidence and decision metadata, append-only
  decision history, and fail-closed checks.
- Preserve existing purchase rounding and aggregate behavior until an
  authorized replacement is implemented and validated.
- Maintain tenant-aware ownership, audit traceability, correction history, and
  separate authorization gates.

#### Remaining Product and review dependencies

- **F-08 / PD-15:** Alternative 3A is selected by the Product Owner.
  Engineering, Security/Architecture, and Accounting/GST review must still
  complete before implementation.
- Accounting/GST and qualified GST-professional review remain required for
  evidence timing, tax treatment, discrepancies, rounding, historical facts,
  corrections, reversals, and accepted-value policy.
- Engineering and Security/Architecture review remain required for
  enforceability, authorization, tenant isolation, immutability, audit
  integrity, transaction boundaries, recovery, and bypass prevention.
- Formal PGST-01 approval still requires the review dossier and authorized
  approval record in §§5 and 11.3.

#### Database and migration prerequisites

Before any schema or migration authorization, the persistence design must
undergo exact schema validation, compatibility review, immutable-history and
append-only enforcement design, tenant-relation review, migration/rollback
planning, and destructive-action approval where applicable. No backfill may
invent historical supplier or tax facts. The existing purchase behavior must
remain available until the approved workflow is implemented and validated.

#### Required later validation

Authorized implementation and isolated validation must cover, at minimum:

- finalization/posting eligibility and rollback;
- idempotency, retries, stale revisions, concurrent decisions, and atomicity;
- tenant isolation and authorization failures;
- immutable evidence, append-only history, correction and reversal paths;
- unresolved discrepancies, missing evidence, invalid accepted values, and
  unauthorized actors;
- stock, supplier ledger, payable, invoice sequence, and audit consistency;
- legacy drafts and historical records without fabricated facts.

Pure tests or source inspection must not be reported as database-backed proof.
The GST audit matrix remains the authoritative traceability source for
GST-001 through GST-020: GST-001–GST-007 cover the existing sales-side
calculation/persistence limitations, GST-008–GST-018 cover purchase and
related GST policy/implementation requirements, and GST-019–GST-020 cover
isolated financial validation infrastructure and execution. The policy
requirements above are the purchase-policy inputs for those matrix entries;
their recorded statuses and evidence are not changed by this handoff.

#### Sequenced implementation plan

1. Obtain the required formal PGST-01 reviews and record the authorized policy
   outcome.
2. Resolve F-08/PD-15 and approve the technical design boundary.
3. Authorize implementation scope, acceptance criteria, and rollback owner.
4. Validate the schema design and authorize migrations only after compatibility
   and rollback review.
5. Implement evidence, calculation, reconciliation, acceptance, and guarded
   posting in provider-independent layers while preserving current behavior
   outside the approved scope.
6. Execute the separately authorized isolated database-backed validation,
   including financial rollback and tenant-isolation evidence.
7. Obtain separate controlled-pilot authorization before activation; production
   rollout remains a separate gate.

### 12.11 F-08 finalization/posting boundary review

**Review scope:** Focused comparison of PD-15 Alternative 3A and Alternative
3B using the current purchase workflow, the purchase GST persistence design,
the reconciliation service, and the documented validation constraints.

**Existing definitions:**

- **Alternative 3A:** Keep finalization and accounting posting in one combined
  transaction. The existing purchase action is the relevant compatibility
  baseline: stock batches and movements, invoice sequence, purchase status,
  supplier ledger, payable balance, and the finalization audit event are
  committed inside one outer Prisma transaction.
- **Alternative 3B:** Separate finalization from accounting completion and
  posting operations. This requires durable intermediate states, recovery for
  finalized-but-not-posted purchases, idempotent posting, and explicit
  safeguards against a purchase remaining indefinitely between stages.

Alternative 3B is a policy boundary definition, not an existing implementation
or a claim that those intermediate states or safeguards currently exist.

#### Evidence-based comparison

| Criterion | Expected control and repository evidence | Safer fit / limitation |
|---|---|---|
| Supplier-evidence preservation | Supplier evidence must remain immutable and separate from calculations and accepted values. The persistence design §§1, 7, 11, and 14 specifies this; current purchase code does not persist those records. | Both alternatives can preserve evidence if the posting guard reads immutable revision pointers. Neither is implemented or runtime-verified. |
| Accounting acceptance and segregation | Acceptance must occur before posting through an authorized accounting action; `MATCHED` and `RESOLVED` do not imply acceptance. This is required by policy §12.8 and persistence design §11. | 3A provides a shorter guarded path after acceptance; 3B can expose a durable accounting-complete state, but adds transition and access-control complexity. |
| Eligibility and stale revisions | Posting must recheck evidence, calculation, reconciliation, acceptance, current pointers, and optimistic version inside the posting boundary. The persistence design §15 proposes this; no current action performs it. | 3A has a single final eligibility boundary. 3B requires the same recheck at posting and protection against changes between finalization and posting. |
| Financial atomicity | Stock, supplier ledger, payable, invoice sequence, invoice status, and audit event must succeed or fail together. `finalizePurchaseAction` currently groups these effects in one transaction. | 3A best preserves the observed atomic compatibility baseline. 3B must define whether finalization is financially inert and ensure posting is independently atomic. |
| Idempotency and retries | The persistence design proposes `(tenant_id, operation, idempotency_key)` uniqueness, payload comparison, and optimistic tokens; current purchase finalization has no equivalent GST idempotency workflow. | 3A has fewer durable stages to retry. 3B needs separate idempotency for completion and posting plus protection from duplicate financial effects. |
| Concurrent requests | Concurrent finalization or acceptance must reject stale versions or serialize safely. No runtime evidence exists. | 3A reduces the number of cross-stage races. 3B requires durable state-transition locking and race handling across both stages. |
| Failure recovery | A failed combined transaction should leave no partial financial effects. A separated model must recover and reconcile finalized-but-not-posted records. | 3A is safer for atomic failure if the transaction is correctly implemented. 3B is preferable only if operational recovery and replay are required and fully designed. |
| Legacy drafts and aggregate-only purchases | Legacy records must remain readable without fabricated facts and must not gain a new posting bypass. Persistence design §14 and F-03 establish this boundary. | Both can preserve legacy behavior; 3A has fewer transition states. Neither authorizes legacy conversion. |
| Tenant isolation and authorization | Existing finalization is tenant-scoped and permission-checked. Proposed GST actor ownership and acceptance authorization are design requirements, not runtime proof. | Both require server-side tenant and role checks. 3B creates more privileged transition endpoints and therefore a larger authorization surface. |
| Corrections, reversals, and append-only history | Evidence revisions, decisions, and events must be immutable/append-only; persistence design §§8, 11, 12, and 15 define the target. | Both can support correction chains. 3B must also preserve the history of each intermediate posting state and recovery attempt. |
| Testability and operations | Existing pure tests cover reconciliation and rounding only. Financial E2E, RLS, rollback, concurrency, and database persistence remain unverified. | 3A is smaller to validate initially. 3B is more observable by stage but requires additional recovery, monitoring, reconciliation, and stuck-state tests. |

#### Recommendation

**AI recommendation:** Select **Alternative 3A** as the preferred boundary.
The Product Owner confirmed that selection on 2026-10-24. It aligns with the existing `finalizePurchaseAction`
transaction and the persistence design's §15 `Final posting` row, which
includes eligibility recheck, stock, supplier ledger, payable, sequence,
invoice finalization, version, and finalization event.

Under this recommendation, accounting acceptance must occur in a separate
authorized action before posting. The 3A posting transaction must then
re-read and verify the current evidence revision, calculation, reconciliation
status, accounting decision, decision reference, accepted values, actor
authorization, and optimistic version before applying financial effects. A
`MATCHED` result, a calculation result, or a prior UI state must never bypass
that check.

The strongest argument against 3A is that a combined boundary couples GST
eligibility and financial posting into one critical transaction. If the
workflow requires human accounting completion, long-running review, external
reconciliation, operational replay, or independently observable posting
stages, 3B may be preferable. In that case, 3B must first specify durable
states such as finalized-pending-posting and posted, ownership and expiry
handling for stuck records, idempotent posting keys, recovery/replay rules,
duplicate-effect prevention, and monitoring/escalation for every intermediate
state.

The Product Owner selection is a policy decision, not runtime evidence or
external approval. No runtime evidence proves the selected boundary.

#### Required decision entry

| Decision ID | Decision | Current status | Required decision-maker/review |
|---|---|---|---|
| PD-15 / F-08 | **SELECTED — Alternative 3A**, combined finalization/posting, preserving the existing atomic purchase-finalization boundary and requiring separate authorized accounting acceptance before posting plus the listed eligibility, ownership, authorization, and concurrency rechecks. | `SELECTED — PRODUCT OWNER; REVIEWS PENDING` | Product Owner confirmed in the current conversation; Engineering, Security/Architecture, and Accounting/GST reviews remain pending. Implementation is not authorized. |

Selection of either alternative would not constitute formal PGST-01 approval,
implementation authorization, database/migration authorization, validation
authorization, pilot authorization, or production authorization.
