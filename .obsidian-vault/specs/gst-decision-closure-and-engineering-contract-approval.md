---
title: GST Decision Closure and Engineering Contract Approval
date: 2026-10-31
status: OWNER AUTHORIZED - APPROVED GST ENGINEERING CONTRACT; EVIDENCE-GATED
---

## Goal

## Acceptance Criteria

## Out of Scope

# GST Decision Closure and Engineering Contract Approval

**Date:** 2026-10-31  
**Time:** 06-50-00 (IST)  
**Stage:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Status:** `OWNER AUTHORIZED — APPROVED COMPLETE GST MODERNIZATION SCOPE;
IMPLEMENTATION EVIDENCE-GATED; PRODUCTION SEPARATELY GOVERNED`

## 1. Purpose and authority boundary

This artifact records a read-only business, statutory, accounting, and
engineering contract assessment for the active
[Domestic GST Modernization specification](./domestic-gst-modernization.md).
It does not replace that specification, the superseded GST specification, the
PGST-01 policy, or the purchase persistence design.

No owner-selected direction is treated as statutory approval. No recommendation
in this document is an implementation, migration, testing, pilot, or
production authorization. A status of `DECIDED` means only that the project
record selected a direction; it does not prove professional approval or
engineering evidence.

**Document responsibility and hierarchy:** The [Domestic GST Modernization
master specification](./domestic-gst-modernization.md) is the overall scope
and architecture entry point. This document owns detailed owner decisions,
engineering contracts, authorization boundaries, unresolved decisions,
validation gates, and approval records. The [GST Accounting Decision Question
Pack](./gst-accounting-decision-question-pack.md) owns professional/statutory
questions; [Purchase GST Persistence and Workflow Design](./purchase-gst-persistence-design.md)
owns purchase persistence details; and [GST Schema Rollout Design
Review](./gst-schema-rollout-design-review.md) owns schema and rollout details.
Read those documents when their subjects are relevant. If a summary conflicts
with a designated detailed contract, record the exact conflict here as
unresolved rather than silently overriding it. This hierarchy does not change
any decision, approval, or authorization boundary.

### 1.1 Owner-confirmed professional review

The project owner confirms that Q-01 through Q-09 were reviewed and signed off
by a qualified Indian GST professional. This is recorded as
`PROFESSIONALLY REVIEWED — OWNER CONFIRMED`. No reviewer name, membership
number, signature, review date, certificate, or attachment was supplied, so no
such metadata is asserted here. The confirmation does not authorize
implementation, migration, testing, database access, pilot activity, or
production use.

### 1.2 Full-scope owner authorization and historical five-workstream decision

On **2026-10-31**, **Masum Rafique**, the Project Owner, granted explicit
authorization for the **complete documented GST Modernization scope**,
including all documented GST features, specifications, engineering workstreams,
supporting implementation activities, and associated validation work. This is
an owner authorization decision, not professional, legal, accounting,
independent security, migration-execution, deployment, or production-release
approval.

The five previously recorded engineering decisions remain historically
accurate and are retained as the first explicitly documented implementation
workstream authorization: Q-10 strict idempotency; Q-15 fail-closed migration
and recovery; purchase GST pointer runtime integrity; SEC-DEC-03 production
security controls; and purchase line-level calculated and accounting-accepted
GST values. The 2026-10-31 owner decision now extends authorization beyond
those five workstreams to the complete documented GST Modernization scope.

The approved contracts preserve GST-APP-03 Option B, all three current invoice
pointers, supplier-declared evidence, historical records, tenant isolation,
and fail-closed behavior for unresolved accounting policy. Runtime and
production evidence remain separately gated and must be labeled `NOT VERIFIED`
or `NOT RUN` until directly demonstrated.

The current source baseline was rechecked before this assessment. The current
worktree contains pre-existing changes and the untracked active specification;
none were reverted or overwritten.

## 2. Evidence standard

Each decision is classified using:

- `DECIDED`: an existing owner decision selects a direction and the decision
  does not require inventing a statutory conclusion.
- `PROPOSED — OWNER APPROVAL REQUIRED`: a product or accounting direction is
  possible but no attributable approval is recorded.
- `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED`: authoritative evidence is
  incomplete, conflicting, time-sensitive, or requires qualified
  interpretation.
- `NOT APPLICABLE`: the subject is outside the approved first-release boundary.

Where a source establishes a legal framework but not the exact application
policy, this artifact records the framework and leaves the application decision
blocked.

The engineering prerequisite for HSN/rate governance is a database-backed HSN
catalog and separate effective-dated HSN-to-rate catalog with preloaded or
manually maintained entries, authorized maintenance, separate
classification/rate approval permissions, audit history, duplicate
prevention, pending verification states, and fail-closed calculation and
finalization when an applicable rule is missing, ambiguous, expired, or
unapproved. HSN entries may be added without a source deployment, but adding
an HSN does not approve its classification or rate. Finalized transactions
must preserve the exact HSN, classification/rate versions, source reference,
and transaction-time snapshots; historical transactions must never recalculate
from current catalog data. The current scalar product fields do not satisfy
that prerequisite.

## 3. Stage 1 — Business, statutory, and accounting decision register

| ID | Exact question | Current owner-selected direction | Proposed resolution / consequence | Status | Responsible approver |
|---|---|---|---|---|---|
| `BD-01` | Which treatments can operate in the first release? | Preserve all eight dropdown labels; Regular is not blanket-blocked; Composition, Unregistered, and Consumer remain separately gated; Overseas, SEZ, Deemed Export, and UIN Holders fail closed. | Enable only the Regular workflow after its transaction-fact, classification, calculation, and acceptance gates pass. No label may silently inherit another treatment's tax behavior. | `DECIDED` for product boundary; statutory behavior remains gated | Authorized business owner; qualified GST/accounting reviewer for tax behavior |
| `BD-02` | What is required for Composition supplier and recipient workflows? | Keep Composition visible but blocked. Supplier and recipient cases remain distinct. | Do not calculate or post ordinary GST for Composition until the applicable charging, invoice/document, ITC/accounting, and eligibility rules are approved for each direction. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer and authorized business owner |
| `BD-03` | What treatment and evidence apply to Unregistered recipients? | Do not silently convert an unregistered party into Regular. | Approve the permitted transaction direction, identity evidence, invoice wording, POS facts, and accounting consequences separately. Until then, block the workflow. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer |
| `BD-04` | What treatment and evidence apply to Consumers? | Consumer is a separate counterparty context, not a POS or tax shortcut. | Approve consumer identity/POS evidence, document behavior, and any applicable accounting/reporting treatment separately. Until then, block the workflow. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer and authorized business owner |
| `BD-05` | Which facts determine POS and how is POS confirmed? | Use seller, recipient, dispatch, delivery, transaction, and legally relevant supply facts; allow a system suggestion; require user confirmation; validate before calculation and revalidate at finalization. | Adopt a fact-specific POS resolver. Confirmation is transaction evidence, not proof of legal correctness. Contradictory, unsupported, changed, or incomplete facts block. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST reviewer; engineering owner for contract interpretation |
| `BD-06` | How are GSTIN and registration facts validated? | Proposed current-release scope is exact 15-character validation when supplied; preserve raw values and never use GSTIN prefixes to determine POS or treatment. | Keep checksum, state-prefix, registration-status, and effective-date verification in Version 2; approve absent/invalid/unverified behavior and any future verification source. | `PENDING — OWNER APPROVAL` | Authorized business owner; qualified GST/accounting reviewer for deferred verification |
| `BD-07` | When is HSN/SAC mandatory and what exceptions exist? | Product-level classification is required where applicable; exceptions must come from an approved authoritative rule; missing, ambiguous, invalid, or unsupported required classification blocks. | Approve the classification policy and exact exception evidence. Do not invent rates, exemptions, digit counts, or statutory classifications. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST reviewer and authorized business owner |
| `BD-08` | Which rates apply and how are they versioned? | Use centrally governed, effective-dated rules with source revisions and reproducible historical selection. | Name the authoritative source, maintainer, reviewer, effective-date precedence, stale-draft behavior, and historical rule-version retention. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer; authorized business owner |
| `BD-09` | Which tax components apply? | Owner direction preserves CGST+SGST for legally applicable intra-state supplies, CGST+UTGST for applicable intra-UT supplies, and IGST for applicable inter-state supplies. | Approve the relevant UT set, component selection rules, POS precedence, and exceptions. Same-UT remains blocked until approved. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer |
| `BD-10` | How are discounts allocated and taxed? | Discount must affect taxable value under an approved policy; the active specification requires explicit line-level behavior. | Approve line allocation, order of operations, invoice-level discounts, post-supply treatment, and evidence requirements. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer |
| `BD-11` | Are tax-inclusive and tax-exclusive prices supported? | Both modes are specified as target behavior; inclusive extraction must use the approved rate and precision policy. | Approve supported modes, extraction level, component allocation, discount interaction, and failure behavior for ambiguous pricing mode. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Qualified GST/accounting reviewer; engineering owner |
| `BD-12` | What precision and rounding rules apply? | Owner-approved T25 contract uses exact decimal arithmetic, preserved intermediate precision, explicit `HALF_UP`, independent components, and visible commercial round-off; e-invoice and credit/debit-note capabilities remain Version 2 deferrals. | Preserve the detailed matrix in `0009-gst-precision-rounding-engineering-contract.md`; obtain qualified confirmation for the Section 170 boundary, statutory interpretation, and any future e-invoice representation. | `OWNER APPROVED — CURRENT RELEASE SCOPE; PROFESSIONAL CONFIRMATION REQUIRED` | Authorized business owner; accounting/finance owner and qualified GST reviewer |
| `BD-13` | How are purchase values separated and accepted? | Preserve supplier-declared, application-calculated, and accounting-accepted values as separate facts and decisions. | Approve acceptance authority, evidence, delegation, segregation-of-duties rules, accepted-value precedence, and immutable decision records. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Accounting/finance owner; qualified GST reviewer |
| `BD-14` | What happens when purchase values differ? | Reconciliation must preserve source evidence and block unresolved or unauthorized posting. | Approve materiality/tolerance, review states, resolution evidence, correction/revision behavior, and posting prerequisites. | `BLOCKED — STATUTORY/ACCOUNTING REVIEW REQUIRED` | Accounting/finance owner; qualified GST reviewer |
| `BD-15` | What must pass before sales finalization? | Server recalculation, validated facts, complete snapshots, totals checks, inventory, ledger, sequence, audit, and atomic transaction behavior are required. | Approve the finalization fact matrix, stale-draft handling, duplicate/concurrent result, and correction/reversal scope. | `PROPOSED — OWNER APPROVAL REQUIRED` | Authorized business owner; accounting/finance and engineering reviewers |
| `BD-16` | What historical facts are required and how are legacy invoices handled? | Finalized records use transaction-time snapshots; incomplete legacy records must not gain fabricated facts or silently recalculate from mutable masters. | Approve minimum snapshot fields, disclosed fallback wording, read-only legacy behavior, reopen/correction rules, and migration/backfill prohibition or policy. | `PROPOSED — OWNER APPROVAL REQUIRED` | Authorized business owner; accounting/finance and qualified GST reviewer |

### 3.1 Preserved owner decision mapping

The following existing decisions remain unchanged:

- `DGM-OD-01` through `DGM-OD-03`: first-release treatment scope, POS
  selection, and separate Consumer/Unregistered behavior.
- `DGM-OD-04`: HSN/SAC and effective-dated tax-rate governance.
- `DGM-OD-05`: discount allocation, inclusive/exclusive pricing, and high-level
  rounding direction; the detailed T25 contract is approved for the
  demonstrated current-release engineering scope in
  `decisions/0009-gst-precision-rounding-engineering-contract.md`.
- `DGM-OD-06`: separation and authorized acceptance of purchase GST values.
- `DGM-OD-07`: durable sales finalization idempotency.
- `DGM-OD-08`: GST-APP-03 Option B `calculation_id` direction.
- `DGM-OD-09`: restricted runtime/bootstrap access and tenant isolation.
- `DGM-OD-10`: additive, catalog-guarded database rollout.
- `DGM-OD-11`: finalized invoice history and legacy-record handling.
- `DGM-OD-12`: service-led posting, retries, atomicity, and concurrency.
- `DGM-OD-13`: Composition treatment.
- `DGM-OD-14`: CGST/SGST, CGST/UTGST, and IGST direction.

These IDs remain in the active specification exactly once and remain marked
`DECIDED`. Their dependent statutory, accounting, engineering, database, and
runtime gates remain open.

### 3.2 Current-release scope decisions

The owner explicitly approved the following scope boundaries in the final
audit correction instruction. This records scope approval only; implementation,
runtime verification, and independent acceptance remain separate statuses.

- DGM-T13 is `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`: retain
  exactly 15-character length-only validation; defer checksum, state-prefix,
  registration-status, and effective-date checks to Version 2.
- DGM-T19 was previously recorded as `CURRENT RELEASE SCOPE APPROVED — VERSION 2
  DEFERRED`. The owner-directed T19 resolution now implements the reviewed-
  revision guard in the current engineering path while preserving all current
  purchase-posting safeguards and audit controls. Acceptance, discrepancy
  resolution, and correction require the current record version, evidence
  revision, and calculation ID; correction uses an optimistic guarded parent
  update and rolls back child writes on a stale revision. Finalization remains
  dependent on current accepted evidence and line snapshots. Focused source
  evidence exists; runtime verification and independent acceptance remain
  separate and unclaimed.
- DGM-T25 engineering implementation is present in
  [`0009-gst-precision-rounding-engineering-contract.md`](../decisions/0009-gst-precision-rounding-engineering-contract.md).
  The current-release engineering scope is owner-approved; e-invoice output
  and credit/debit-note workflows remain Version 2 deferrals. Runtime and
  independent acceptance remain separate, and qualified professional
  confirmation is still required for statutory boundaries.

The T13/T19 scope and resolution decisions do not constitute qualified GST/legal
confirmation, runtime verification, or independent acceptance. T25 current-
release engineering scope is owner-approved with Version 2 deferrals; runtime
verification, independent acceptance, and qualified professional confirmation
remain open.

## 4. Decision paper and consequences

### 4.1 First-release scope

**Potentially enabled:** Registered Business — Regular, but only after its
approved transaction-fact, POS, classification, rate, calculation, acceptance,
security, and verification gates pass.

**Blocked:** Registered Business — Composition, Unregistered Business, and
Consumer until their separate rules and acceptance evidence are approved.

**Explicitly excluded from operational calculation:** Overseas, Special
Economic Zone, Deemed Export, and UIN Holders. They remain visible only if the
product chooses to display them and must fail closed without falling through to
ordinary domestic GST.

### 4.2 Unresolved questions requiring named answers

The following questions require written answers from the responsible role; no
answer is inferred here:

1. Which Composition supplier and recipient directions are permitted, and what
   invoice, charging, ITC, and accounting behavior applies to each?
2. Which Unregistered and Consumer transaction directions are in scope, and
   what identity, POS, document, and accounting evidence is mandatory?
3. Which seller, recipient, dispatch, delivery, bill-to, ship-to, and
   third-location facts control POS for each supported scenario?
4. What is the approved source and verification process for GSTIN checksum and
   registration status?
5. Which HSN/SAC classifications are mandatory, and what exact authoritative
   exceptions are permitted?
6. Which effective-dated rate source, revision precedence, and stale-draft
   behavior must be used?
7. Which Union Territories and legal conditions qualify for UTGST, and how is
   it split and displayed?
8. How are line and invoice discounts allocated, including post-supply
   discounts?
9. Are inclusive and exclusive prices both enabled at first release, and what
   extraction/rounding policy applies?
10. What precision, line rounding, invoice aggregation, and signed round-off
    policy is accepted?
11. Who may accept purchase discrepancies, under what delegation and
    segregation-of-duties controls?
12. What tolerance, resolution, correction, and posting behavior applies to
    purchase mismatches?
13. What durable sales idempotency/retry result and uncertain-failure recovery
    behavior is approved?
14. What correction, cancellation, return, credit-note, debit-note, and
    reversal behavior is in or out of this release?
15. What minimum historical snapshots and disclosed legacy fallback wording
    are approved?

### 4.3 Stage 1 closure outcome

Stage 1 is **not closed**. `BD-01` is closed only as a product-boundary
direction. `BD-02` through `BD-14` remain blocked by missing professional interpretation
or accounting approval. Full-scope owner authorization is recorded for
BD-15/BD-16 and the complete GST Modernization scope, but Stage 2 still cannot
declare implementation contracts fully approved until their technical and
evidence gates are satisfied.

## 5. Sources consulted

The following primary or official government sources were consulted for the
legal framework. They support the stated statutory framework; they do not
resolve every Pharmnos-specific policy question.

| Source | Issuing authority / date | Claim supported | URL |
|---|---|---|---|
| Integrated Goods and Services Tax Act, 2017, especially sections 7, 8, 10 and 11 | Government of India / CBIC; Act enacted 2017, current applicability requires amendment review | Inter-state/intra-state framework and statutory POS provisions for goods | [CBIC IGST Act page](https://cbic-gst.gov.in/hindi/IGST-bill-e.html) |
| Central Goods and Services Tax Act, 2017, especially section 15 | Government of India / CBIC; updated CBIC publication dated 2021-08-01 | Transaction value and statutory discount/valuation framework | [CBIC CGST Act publication](https://cbic-gst.gov.in/pdf/CGST-Act-Updated-01082021.pdf) |
| CGST Rules, 2017, Rule 46 and invoice particulars | Government of India / CBIC; rule text is amendment-sensitive | Tax-invoice particulars include HSN/SAC subject to applicable notifications and classes of persons | [CBIC invoice rules PDF](https://cbic-gst.gov.in/pdf/invoice-gst-rules17052017.pdf) |
| CBIC GST portal and GST portal material | CBIC / GSTN; current notifications and portal guidance are time-sensitive | Official publication location for notifications, circulars, rate and invoice updates | [CBIC GST portal](https://cbic-gst.gov.in/) and [GST portal](https://www.gst.gov.in/) |

The available sources do not by themselves establish the exact current
classification exceptions, GSTIN verification service contract, all rate
revisions, all UTGST applicability cases, or Pharmnos-specific accounting
acceptance policy. Those items remain professional-review dependencies.

## 6. Stage 2 — Engineering contract dependency assessment

Because Stage 1 is not closed, no contract below is
`APPROVED FOR IMPLEMENTATION PLANNING`. The statuses identify the blocking
dependency without authorizing implementation.

| ID | Contract and purpose | Required inputs / authoritative source | Preconditions and behavior | Persisted evidence / failure behavior | Responsibilities and acceptance evidence | Status |
|---|---|---|---|---|---|---|
| `EC-01` | Treatment and transaction eligibility | Treatment selection from the approved product contract; registration, composition, category, POS, and classification facts from validated transaction inputs | Separate recipient status, composition status, special category, GSTIN, POS, and classification; unsupported combinations fail closed | Persist treatment and facts at transaction time; reject missing/contradictory/unsupported combinations | Service validates and routes; DB constrains tenant ownership and finalized immutability; treatment matrix and negative tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-02` | POS resolution and confirmation | Seller, recipient, dispatch, delivery, bill-to/ship-to, and transaction facts; legal precedence from `BD-05` | Suggestion is non-authoritative; user confirmation is evidence; server validates before calculation and revalidates at finalization | Persist supplied facts, suggestion, confirmation, validated POS, and rule revision; changed or contradictory facts block | Service resolves and fingerprints; DB protects finalized facts; scenario matrix and finalization tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-03` | GSTIN and counterparty identity | Master records plus approved checksum/status source from `BD-06` | Validate shape, checksum/status when required, registration-state consistency, and absent/unverified behavior | Preserve raw and normalized values with verification evidence; do not infer POS from prefix | Service owns verification policy; DB owns tenant-scoped references; positive/negative identity tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-04` | HSN/SAC and effective-dated rates | Product classification and approved authoritative rate catalog from `BD-07`/`BD-08` | Resolve line-level classification/rate by effective date and source revision; missing required data blocks | Persist classification, rate, source revision, effective timestamp, and fingerprint | Service selects rules; DB preserves immutable finalized references; governed HSN/rate catalogs, approval audit, mixed-rate, and stale-draft tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-05` | Tax calculation, discounts, pricing mode, and rounding | Approved precision, discount, inclusive/exclusive, component, and rate contracts | One authoritative calculator; no UI/SQL duplicate arithmetic; unsupported modes block | Persist canonical inputs/outputs, components, precision, rule revision, and signed round-off | Service calculates and hashes; DB preserves facts; deterministic vectors and decimal acceptance evidence required | `BLOCKED BY BUSINESS DECISION` |
| `EC-06` | Sales calculation and finalization | EC-01 through EC-05 plus inventory, customer, profile, and batch facts | Recalculate server-side, validate snapshots and totals, then atomically post invoice, stock, ledger, sequence, and audit effects | Finalized facts are immutable; duplicate/concurrent requests produce one financial result | Service coordinates transaction; DB guards finalized mutation and tenant integrity; rollback/concurrency tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-07` | Purchase line calculation and reconciliation | Supplier evidence, line classification, supply facts, approved rules, and source precision | Calculate line-level expected values; preserve declared/calculated/accepted values; mismatches enter review | Immutable source revisions, calculations, event links, and raw representations; unresolved mismatch blocks posting | Service reconciles; DB owns append-only history and composite Option B relations; line-level acceptance tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-08` | Purchase accounting acceptance | Authorized accounting role, decision reference, rationale, accepted values, and evidence revision | Acceptance must be explicit, authorized, linked to current evidence/calculation, and segregated where required | Immutable decision; stale or incomplete acceptance blocks finalization | Service checks authority and linkage; DB protects history and pointers; authorization/stale-decision tests required | `BLOCKED BY BUSINESS DECISION` |
| `EC-09` | Idempotency, request hash, and retry | Durable operation key and canonical request serialization | Same key and same hash returns/reconciles the same result; same key with different hash blocks; uncertain failures are recoverable | Persist operation, hash, status, result, and audit linkage | Sales operation/hash/result protocol and duplicate/conflict/retry/concurrency evidence passed in the disposable target | `PASS — SCOPED` |
| `EC-10` | Posting, atomicity, concurrency, and reconciliation | Approved lifecycle states, inventory/ledger facts, operation key, and version | Guard transitions, serialize sequence/stock effects, rollback all financial effects on failure, and reconcile result state | Operation transitions are guarded; audit and reconciliation events are durable | Service and database protocol passed isolated failure/concurrency validation; broader GST workflow approval remains separate | `PASS — SCOPED` |
| `EC-11` | Immutable snapshots and historical compatibility | Approved minimum snapshots and legacy policy from `BD-16` | Finalized output uses persisted facts; legacy fallback is disclosed and never presented as historical truth | Immutable seller/customer/POS/classification/tax snapshots; no fabricated backfill | Service selects snapshot/fallback; DB blocks finalized mutation; print/reprint and legacy tests required | `PROPOSED — OWNER APPROVAL REQUIRED` |
| `EC-12` | Tenant isolation, roles, RLS, and integrity | GST-APP-01, GST-APP-02, GST-APP-04, GST-APP-05, GST-APP-06 | Restricted bootstrap/runtime roles, no direct anonymous CRUD, fail-closed forced RLS, guarded finalized/history transitions | Tenant-aware composite keys, policies, grants, triggers, and audit evidence | Applied grants, forced RLS, trigger, and ordinary-role cross-tenant/mutation evidence passed in the disposable target | `PASS — SCOPED` |
| `EC-13` | Additive, catalog-guarded, repeatable rollout | GST-APP-08, approved schema, live catalog preflight, Option B relation | Stop on conflicts, preserve legacy compatibility, apply idempotently only after explicit authorization, and support rollback | Sanitized metadata baseline, migration ledger, conflict report, and recovery evidence | Committed baseline, repeatability, conflict stop, backup/restore, and comparison passed in disposable targets; partial-failure recovery is not independently verified from retained raw output | `PASS — SCOPED` |
| `EC-14` | Financial E2E verification and authorization | Approved contracts, disposable target, identity evidence, owned fixtures, cleanup authorization | No live/ordinary target; broader E2E remains separately gated | Durable sanitized evidence for RLS, atomicity, rollback, idempotency, concurrency, history, and financial effects | Q-10/Q-14/Q-15 package passed for the disposable target; broader Financial E2E and release authorization remain separate | `PARTIAL — Q-10/Q-14/Q-15 PASS — SCOPED; BROADER E2E NOT VERIFIED` |

### 6.0 Current T25 engineering evidence

The current campaign implemented the shared exact-decimal boundary in
[`src/lib/decimal.ts`](../../src/lib/decimal.ts), integrated it into the sales
and purchase calculators, removed duplicate form arithmetic, and added focused
precision, component, inclusive-helper, Section 170-isolation, preservation,
and T13 length-only assertions. Existing PostgreSQL financial fields already
use `NUMERIC`; no schema change was required.

The focused calculator run passed `294/294` assertions and `pnpm typecheck`
passed, including explicit evidence for already-rounded two-decimal
serialization, arithmetic after JavaScript-number conversion, and the
high-precision number boundary. This is engineering evidence only. The
Section 170 aggregation boundary, e-invoice obligations, and other statutory
interpretations require qualified professional confirmation; runtime and
independent acceptance remain unverified.

### 6.1 Hybrid architecture responsibilities

Application services own treatment validation, POS resolution, calculation,
rule selection, evidence and fingerprint construction, reconciliation,
acceptance orchestration, idempotency, retries, concurrency coordination, and
atomic workflow sequencing.

The database owns tenant enforcement, structural and referential integrity,
tenant-aware uniqueness, immutable evidence/history, finalized-record
protection, guarded posting transitions, and privilege boundaries. Triggers
must not become a substitute for missing business rules or service contracts.

The purchase design must preserve GST-APP-03 Option B: `calculation_id`
relations are purchase-aware composite relations using tenant and purchase
identity. This remains a selected design direction, not schema or migration
authorization.

## 7. Required gates

| Gate | Result | Minimum evidence for PASS |
|---|---|---|
| Business/statutory | `BLOCKED` | Attributable qualified GST/accounting decisions for BD-02 through BD-14 and owner decisions for BD-15/BD-16, with current authoritative sources and effective dates. |
| Calculation | `BLOCKED` | Approved deterministic treatment/POS/classification/rate/discount/pricing/precision contract and reproducible calculation vectors. |
| Sales/purchase | `BLOCKED` | Approved finalization, acceptance, reconciliation, idempotency, retry, concurrency, and posting contracts with isolated behavioral evidence. |
| Security/database | `BLOCKED` | Applied and verified roles, grants, forced RLS, immutable-history protections, guarded transitions, Option B keys, and catalog-guarded migration evidence. |
| Compatibility | `BLOCKED` | Approved snapshot/legacy policy, disclosed fallback behavior, migration/backfill decision, and historical reprint/regression evidence. |
| Verification | `BLOCKED` | Explicitly authorized disposable Financial E2E target, verified identity, owned fixtures, cleanup evidence, and durable sanitized results. |

No gate passes by implication from another gate. Stage 1 remains open, so Stage
2 remains dependency assessment only.

### 7.1 Consolidated GST Modernization gate reassessment

| Gate | Status | Evidence reviewed and what is proven | Remaining evidence / dependency | Blocks implementation authorization |
|---|---|---|---|---|
| Q-01–Q-09 professional-review record | `CLOSED` as a review-status record | The owner-confirmed status is recorded as `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; no reviewer metadata was invented. | Remaining legal-source limitations, product operating evidence, and implementation gates are separate and unresolved. | Yes |
| Legal/source and rate governance | `PARTIALLY READY` | Relevant Act sections, Circular 209/3/2024-GST, Circular 112/31/2019-GST, rate indexes, and the 2025 Central Tax (Rate) index entry were recorded. | Current pharmaceutical entries, HSN 3004 conditions, Integrated/State/UT amendment chains, and effective-date applicability require qualified review. | Yes |
| HSN/rate catalog contract | `BLOCKED` | The requirement is documented: governed database catalogs, separate classification/rate approval, audit history, effective dates, and fail-closed behavior. Current products retain scalar HSN/rate fields only. | Approved catalog model, permissions, source evidence, workflow, and historical snapshot design. | Yes |
| Q-10 sales idempotency | `PASS — SCOPED` | Sales operation model, tenant-scoped key/hash, atomic result recording, replay/conflict handling, and unique constraints were exercised in the disposable target. | Broader GST implementation, purchase posting, and release gates remain separate. | No |
| Q-14 database isolation/security | `PASS — SCOPED` | Applied runtime role, forced RLS, tenant-context denial, cross-tenant denial, pooled-session reset, DDL denial, finalized-history protection, and SEC-DEC-01/02 cases passed in the disposable target. | SEC-DEC-03 and production/staging security evidence remain separate. | No |
| Q-15 migration safety/recovery | `PASS — SCOPED` | Committed Prisma baseline, repeatability, catalog conflict stop, backup, restore, and source/restore comparison passed in disposable targets. Partial-failure recovery is `NOT VERIFIED` from retained output. | Production rollout, backup policy, and release gates remain separate. | No |
| Historical compatibility | `BLOCKED` | Source snapshots and disclosed legacy behavior are documented as intended controls. | Approved legacy/reprint policy, immutable applied protections, and regression evidence. | Yes |
| Financial E2E verification | `NOT VERIFIED` | Q-10/Q-14/Q-15 isolated gates executed, but broader financial scenarios have not been executed. | Broader-E2E authorization, owned fixtures/cleanup, and durable sanitized results. | Yes |

### Latest Q-gate reconciliation (2026-10-31 IST)

The earlier Q-gate rows above are preserved as historical closure context. The
latest retained disposable-target evidence supports Q-10, Q-14, and Q-15 as
`PASS — SCOPED`: application-path Q-10 output is `q10-application-final.txt`;
ordinary-login SEC-DEC-01/02 output is `q14-ordinary-login-final.txt`;
shared regression output is `q10-q14-regression-final.txt`; and the
strengthened row-level restore comparison is `q15-1793447704646-restore-comparison.json`
with run output `q15-final.txt` and raw command log
`q15-1793447704646-raw-output.txt`. These results do not authorize GST
implementation, production rollout, or live database operations.
| Implementation authorization | `BLOCKED` | No implementation authorization has been granted by any reviewed artifact. | Separate project-owner authorization after the preceding gates close. | Yes |

**Consolidated readiness recommendation:** `NOT READY — SPECIFIC GATES REMAIN
OPEN.` The next milestone is to obtain the missing qualified legal/accounting
source decisions and engineering-owner approvals, then establish authorized
isolated database and migration evidence. This review does not request, infer,
or grant implementation authorization.

## 7.2 Q-10 — Sales idempotency contract

### Current source evidence

`finalizeSalesInvoiceAction` now obtains tenant context and permission, derives
a tenant-scoped idempotency key, hashes canonical finalization inputs, claims a
sales operation inside the same Prisma transaction as invoice, stock, ledger,
balance, numbering, and audit writes, and records the committed result. Exact
replay, conflicting payload rejection, uncertain-outcome lookup, and database
uniqueness are covered by the isolated validation evidence in
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md).

The purchase finalization path is stronger: it has a tenant-scoped
`purchase_posting_operations` record, unique idempotency key, request hash,
same-key conflict detection, processing/completed states, and a guarded
version transition. This pattern is comparative evidence, not proof of sales
behavior.

### Required target contract

| Requirement | Application responsibility | Database responsibility | Current status |
|---|---|---|---|
| Tenant-scoped operation identity | Require authorized tenant context and operation ownership | Unique `(tenant_id, idempotency_key)` and `(tenant_id, sales_invoice_id)` | `PASS` |
| Canonical request and hash | Deterministically serialize finalization inputs and hash them | Persist hash with operation | `PASS` |
| Same key/same payload | Return the original durable result without repeating effects | Persist result/status atomically | `PASS` |
| Same key/different payload | Reject with a conflict | Enforce key uniqueness and compare hash | `PASS` |
| Concurrent duplicates | Claim one operation and reconcile the loser | Unique claim and transaction | `PASS` |
| Business-result atomicity | Perform invoice, stock, ledger, balance, numbering, audit, and operation writes in one transaction | Enforce FK/unique/finalized protections | `PASS` |
| Timeout/unknown outcome | Provide operation lookup before retry; never blindly repost | Retain operation/result state | `PASS` |
| Transient/permanent failure | Mark retryable versus terminal failures explicitly | Preserve terminal result and audit | `MISSING` |
| Authorization and audit | Validate permission, tenant, actor, correlation, and outcome | Protect audit/history rows | `PARTIAL` |
| Retention/replay | Define retention, support lookup, and prohibit replay after terminal expiry | Retain required evidence | `NOT_VERIFIABLE` |

The smallest compatible design is a sales-specific posting-operation model
following the established purchase pattern, extended with durable result
status and outcome fields. The service owns canonicalization, retry semantics,
and orchestration; the database owns tenant-scoped uniqueness, operation
state integrity, foreign keys, and finalized-record protection. This is a
target contract, not implementation authorization.

## 7.3 Q-14 — Security proof contract and isolated test package

The review SQL defines intended bootstrap/runtime separation, restricted
grants, fail-closed tenant predicates, forced RLS, and immutable-history
controls. It does not prove applied roles, ownership, inheritance, default
ACLs, `BYPASSRLS`, connection-pool context behavior, or runtime denial.

The minimum authorized disposable test package is:

| Test | Preconditions and identity | Expected result | Evidence |
|---|---|---|---|
| Anonymous access | No anonymous CRUD grant; anonymous principal | Denied | Role identity, SQL error, ACL snapshot |
| Bootstrap boundary | Runtime role, tenant A | Bootstrap DDL/privileged operation denied | Role attributes and denial output |
| Missing/invalid tenant context | Runtime role, no claim or invalid claim | Read/write denied or zero rows according to contract | Session setting, role, query result |
| Cross-tenant read/write | Runtime role, tenant A context, tenant B row | Read and write denied | Tenant IDs, query output, audit result |
| Pool/session reuse | Same pooled connection, tenant A then tenant B | No context leakage | Connection/session identifiers and ordered results |
| Finalized history mutation | Runtime role, finalized GST/history row | UPDATE/DELETE denied | Row identity, SQLSTATE/output, unchanged-row proof |
| Guarded posting | Runtime role, invalid status/version transition | Rejected atomically | Before/after state and error |
| Structural integrity | Runtime role, invalid tenant FK/unique relation | Constraint failure | Constraint name and transaction outcome |

The isolated package passed with retained sanitized evidence in
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md).

## 7.4 Q-15 — Migration safety and recovery contract

The repository contains Prisma schema definitions, review-only SQL, and a
committed baseline exercised by the retained disposable Q-15 run. The additive
provisioning wrapper remains intentionally non-executable for a populated
database, while the separate Q-15 runner applied the baseline to a disposable
target and retained migration, backup, restore, and comparison artifacts.

The migration package must, before authorization, include:

1. A reviewed Prisma migration baseline consistent with the schema and SQL
   artifact ordering.
2. Catalog checks for required tables, columns, enum labels, constraints,
   indexes, ownership, RLS state, roles, and incompatible objects.
3. Stop-on-conflict and stop-on-missing-prerequisite behavior.
4. Explicit handling for partially applied states, with no silent repair.
5. Additive compatibility for existing rows and historical snapshots.
6. A sanitized representative backup or equivalent dataset.
7. Baseline/post-migration schema comparisons and repeatability results.
8. Backup restore, recovery, rollback or forward-recovery boundary evidence.
9. A migration ledger, operator identity, timestamps, logs, unresolved-risk
   register, and explicit change-window authorization.

The retained disposable validation passed baseline apply, repeat execution,
incompatible-object stop, backup restore, and post-restore schema/control
comparison. The final summary reports partial-failure recovery, but the raw
output does not expose the queried partial-state counts or a recovery/retry
action; partial-failure recovery is therefore `NOT VERIFIED` independently.
Q-15 remains `PASS — SCOPED` for the disposable target, while production
rollout, migration authorization, and recovery readiness remain separately
gated.

## 7.5 Isolated-validation authorization gate

Owner authorization for the defined Q-10, Q-14, and Q-15 isolated-validation
scope was received and the retained evidence report records a subsequent
successful disposable-target run. That result does not bypass separate
implementation, production migration, broader Financial E2E, cleanup,
destruction, or release gates. Live, shared, staging, production, or
unverified databases must not be used as substitutes.

## 7.6 Authorized-validation chronology and execution result

The earlier preflight event at `2026-10-31 08-22-35 IST` stopped before any
database connection. The repository-declared local target was not running and
the preflight did not establish independent identity, role privileges,
sanitized-data provenance, backup/restore capability, or cleanup evidence.
That event remains historical and is not deleted.

A subsequent validation event on 2026-10-31 (IST) used the loopback-bound,
ephemeral PostgreSQL 17 target with separate bootstrap, runtime,
administrative, and validation roles. The retained evidence report records
Q-10, Q-14, and Q-15 as `PASS — SCOPED` for that disposable target, including
the dedicated SEC-DEC-01/02 control run and Q-15 restore comparison.
Production/staging access, broader Financial E2E, GST implementation, and
release authorization remain unverified or unauthorized.

## 7.7 Isolated-validation environment preparation package

This section records the retained Q-10, Q-14, and Q-15 disposable validation
environment and its remaining authorization boundaries. It does not authorize
production, staging, or live-database execution.

### Environment architecture

| Area | Intended design | Current evidence | Status |
|---|---|---|---|
| Disposable PostgreSQL | Local-only `financial-e2e-postgres`, PostgreSQL 17 Alpine, loopback port binding, ephemeral `tmpfs`, no restart | `docker-compose.financial-e2e.yml` declares the service, profile, loopback binding, `tmpfs`, and `financial-e2e-isolated` label; the retained run used the disposable target | `PASS — SCOPED` |
| Database identity | Expected database `pharmnos_financial_e2e`; verify database, server, endpoint, application marker, and role before any mutation | The dated validation report records the connected disposable target and role identities; no production/staging equivalence is established | `PASS — SCOPED` |
| Network boundary | Loopback-only endpoint; no production, staging, shared, or Supabase endpoint | The dated validation report identifies loopback binding and no production/staging access | `PASS — SCOPED` |
| Bootstrap role | `pharmnos_e2e` provisions and performs approved catalog/bootstrap work only | The dated validation report records the separate bootstrap role and scoped use | `PASS — SCOPED` |
| Runtime role | `pharmnos_e2e_runtime` performs ordinary tenant-scoped operations and is not superuser/BYPASSRLS | Ordinary-login Q-14 evidence records `LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS` runtime attributes | `PASS — SCOPED` |
| Sanitized dataset | Synthetic or explicitly sanitized tenant-separated fixtures with finalized GST/history rows and no production secrets/data | Harness documents fixture ownership and lifecycle, but no dataset artifact or provenance record is available | `NOT VERIFIED` |
| Backup/restore | Disposable-target backup, restore to a separate disposable target, schema/data comparison, retained logs | The dated Q-15 evidence report records backup, independent restores, row/checksum and catalog comparisons | `PASS — SCOPED` |
| Cleanup/destruction | Run-owned resources only; identity rechecked; recovery evidence retained before destruction; explicit cleanup authorization | Fixture lifecycle specifies ownership and gated cleanup; no execution authorization or cleanup result exists | `PARTIAL` |
| Executable validation package | Approved migration baseline, enabled runner, reviewed expectations, evidence output, and recovery scripts | Q-10/Q-14/Q-15 outputs and the committed Prisma baseline are summarized in the dated evidence report | `PASS — SCOPED` |

The retained validation report supplies the independent disposable-target
identity and role evidence for the isolated run. This does not establish
production/staging equivalence, broader Financial E2E, or release readiness.

### Prerequisite register

| Prerequisite | Current evidence | Status | Required action | Required owner approval |
|---|---|---|---|---|
| Local disposable target definition | Compose service/profile, loopback binding, `tmpfs`, no-restart policy, isolation label | `PASS — SCOPED` | Provision only after the remaining prerequisites are approved | Environment owner confirms this exact target |
| Docker/Compose availability | Local Docker daemon and Compose configuration were available/valid during static preflight | `PASS — SCOPED` | Recheck immediately before provisioning | None beyond environment owner |
| Ordinary database comparison target | Safety code requires `DATABASE_URL` and non-overlap | `NOT VERIFIED` | Supply a redacted ordinary-target identity or approved explicit non-production comparison procedure; never expose its secret | Owner approves comparison method and target |
| Database identity readback | The retained validation report records the connected disposable database, server endpoint, application marker, and role readback | `PASS — SCOPED` | Production/staging equivalence remains unverified | Owner approves exact disposable endpoint and role |
| Bootstrap/runtime roles | Names and intended grants exist in examples/review SQL | `PASS — SCOPED` | Production/staging role state remains unverified | Security/database owner approves role package |
| Anonymous denial | Review contract requires no browser/anonymous CRUD | `PASS — SCOPED` | Production/staging and broader direct-access evidence remain unverified | Security owner approves anonymous-denial scope |
| Tenant-separated synthetic fixtures | Fixture lifecycle contract exists | `NOT VERIFIED` | Create only synthetic, run-owned tenants/users/products/invoices/history after authorization; record provenance | Data owner approves fixture contents |
| Backup/restore capability | `q15-1793447704646-backup.sql`, `q15-1793447704646-raw-output.txt`, `q15-final.txt`, and `q15-1793447704646-restore-comparison.json` are retained | `PASS — SCOPED` | Production recovery and retention remain unverified | Owner approves backup/restore and retention |
| Cleanup/destruction | Run-owned manifest and explicit cleanup gate are specified | `PARTIAL` | Verify target identity, freeze resource set, retain evidence, then separately authorize cleanup | Owner approves exact resources and destruction |
| Migration baseline | The committed baseline was applied and repeated on the disposable target; the conflict run is retained in the Q-15 evidence | `PASS — SCOPED` | Partial-failure recovery and production migration remain unauthorized | Engineering/database owner approves migration artifact |
| Harness execution | The authorized Q-10/Q-14/Q-15 runners produced retained disposable-target outputs | `PASS — SCOPED` | Broader Financial E2E and production execution remain unverified | Owner approves exact Q-10/Q-14/Q-15 test scope |
| Evidence retention | Sanitized evidence contract exists | `PARTIAL` | Name evidence directory, hashes, run ID, target binding, logs, query outputs, and retention period | Owner approves retention and access |

### Engineering-prerequisite closure matrix

This matrix is the authoritative engineering assessment of what remains open
after OD-01 through OD-08 were recorded. `OWNER APPROVED` is recorded in §7.8
where applicable; it is not technical verification. Static or documentation
closure cannot substitute for runtime proof.

| ID | Requirement | Current status | Responsibility | Missing evidence | Minimum closure action | Acceptance criteria | Dependency | Stage |
|---|---|---|---|---|---|---|---|---|
| ENV-C01 | Confirm the exact PostgreSQL 17 disposable target and database identity | `PASS — SCOPED` | `RUNTIME PROOF` | Production/staging equivalence remains unverified | Preserve the retained identity readback and target binding | Fresh readback matches approved database, endpoint, marker, and role; no production/shared target | OD-01; ENV-02 | Runtime validation |
| ENV-C02 | Prove separation from development, staging, production, and shared databases | `NOT VERIFIED` | `JOINT INPUT` | No ordinary-target comparison result or redacted comparison record | Approve a secret-free comparison method and capture target/non-overlap evidence | Target URL/name/endpoint/marker are distinct and positively bound to disposable scope | ENV-C01; OD-01 | Pre-provisioning / runtime validation |
| ENV-C03 | Prove loopback/network, port, storage, and restart isolation | `PASS — SCOPED` | `ENGINEERING INPUT` | Production/staging equivalence remains unverified | Preserve the retained loopback/ephemeral-target evidence | Loopback-only binding, isolated ephemeral storage, expected port, no shared volume/network, no restart persistence | OD-01; ENV-C02 | Static inspection / runtime validation |
| ENV-C04 | Record project engineering ownership and owner-authorized destruction boundary | `OWNER APPROVED` | `OWNER INPUT` | Final run-owned resource/accountability record | Record owner role, engineering operator boundary, and destruction authority in the run manifest | Ownership and destruction authority are unambiguous and limited to disposable resources | OD-02, OD-06 | Documentation / pre-provisioning |
| SEC-C01 | Separate bootstrap and runtime roles | `PASS — SCOPED` | `JOINT INPUT` | Production/staging equivalence remains unverified | Preserve the retained ordinary-login role evidence | Bootstrap and runtime identities match approved roles; runtime is `LOGIN`, non-superuser, non-`BYPASSRLS` | OD-03; ENV-C01 | Runtime validation |
| SEC-C02 | Prove grants, revocations, ownership, default ACLs, and effective privileges | `PASS — SCOPED` | `RUNTIME PROOF` | Production/staging privilege state remains unverified | Preserve the retained catalog and effective-privilege evidence | Required bootstrap privileges exist; prohibited runtime/direct privileges and inherited bypasses are absent | SEC-C01 | Runtime validation |
| SEC-C03 | Prove RLS/FORCE RLS, fail-closed tenant context, cross-tenant denial, and direct CRUD denial | `PASS — SCOPED` | `RUNTIME PROOF` | Production/staging policy state remains unverified | Preserve the retained negative/positive tenant-test evidence | Same-tenant permitted; missing/invalid context and cross-tenant reads/writes denied; anonymous/direct CRUD denied as specified | SEC-C02; OD-07 | Runtime validation |
| SEC-C04 | Prove finalized GST and reconciliation history cannot be altered or deleted by runtime paths | `PASS — SCOPED` | `RUNTIME PROOF` | Production/staging immutability state remains unverified | Preserve the retained mutation-denial evidence | Runtime role cannot mutate/delete finalized immutable history; attempted violations are rejected and evidenced | SEC-C02, SEC-C03 | Runtime validation |
| DATA-C01 | Prepare reproducible synthetic tenant/user fixture manifest | `PARTIAL` | `ENGINEERING INPUT` | Owner/source approval and runtime ownership/loading evidence remain absent | Review the frozen manifest, assign run ID/owner, and load only after identity proof | Manifest contains fictional tenants/users and deterministic identifiers, provenance, owner, and cleanup mapping | OD-04; ENV-C01 | Pre-provisioning |
| DATA-C02 | Cover tenant-separated products, suppliers, customers, draft/finalized sales and purchases | `PARTIAL` | `ENGINEERING INPUT` | Runtime fixture creation and cross-tenant scenario evidence remain absent | Review the manifest relationships, then load later after identity proof | Every required resource has tenant ownership, lifecycle state, and cleanup dependency | DATA-C01 | Pre-provisioning / runtime validation |
| DATA-C03 | Cover HSN/GST scenarios without asserting unsupported legal rates | `PARTIAL` | `JOINT INPUT` | Qualified source evidence and runtime fail-closed results remain absent | Use the frozen neutral/pending/source-status classifications; do not invent rates | Scenarios cover supported, missing, ambiguous, expired, unapproved, mixed-rate, and fail-closed cases with source provenance | DATA-C01; DATA-C02 | Documentation / runtime validation |
| BAK-C01 | Define disposable backup scope, method, destination, encryption, access, and retention | `OWNER APPROVED` | `JOINT INPUT` | No approved operational record or bound destination | Record the approved backup method and secret-free retention/access boundary | Scope covers required schema/data/evidence; destination and retention are disposable and access-controlled | OD-05; OD-06 | Documentation / pre-provisioning |
| BAK-C02 | Demonstrate restore to a separate disposable target and compare results | `PASS — SCOPED` | `RUNTIME PROOF` | Production recovery and retention remain unverified | Preserve the retained Q-15 backup, restore, and comparison evidence | Restored target identity is independently verified; schema, fixtures, snapshots, and recovery state compare as expected | BAK-C01; ENV-C01 | Runtime validation |
| BAK-C03 | Record recovery limitations and destructive-test boundary | `OWNER APPROVED` | `JOINT INPUT` | No completed recovery decision/evidence package | Record what rollback/forward recovery can and cannot prove; separately authorize destructive tests | Recovery boundary, failure handling, and evidence retention are explicit | BAK-C01, BAK-C02 | Documentation / runtime validation |
| CLN-C01 | Prove cleanup/destruction covers only run-owned disposable resources | `PARTIAL` | `JOINT INPUT` | No frozen resource snapshot, fresh identity check, or destruction result | Generate and freeze a run-owned cleanup manifest after validation; re-identify target before destruction | Containers, volumes, fixtures, credentials, and temporary artifacts are accounted for; excluded resources remain untouched | OD-06; ENV-C01; DATA-C01 | Post-validation |
| Q10-C01 | Execute sales durable operation/idempotency, hash, replay, conflict, retry, and concurrency cases | `PASS — SCOPED` | `RUNTIME PROOF` | Broader financial workflows and production behavior remain unverified | Preserve the retained application and regression outputs | Same-key/same-payload replays original result; changed payload rejects; retries and concurrent requests cannot duplicate effects | OD-07; SEC-C03; DATA-C02 | Runtime validation |
| Q14-C01 | Execute effective role, grant, RLS, tenant-isolation, direct-access, and history-protection cases | `PASS — SCOPED` | `RUNTIME PROOF` | SEC-DEC-03 and production security remain unverified | Preserve the retained ordinary-login and dedicated security outputs | All Q-14 assertions pass under ordinary runtime role with identity-bound evidence | SEC-C01–04; OD-07 | Runtime validation |
| Q15-C01 | Establish coherent additive migration baseline and catalog guards | `PASS — SCOPED` | `ENGINEERING INPUT` | Production migration and live-state comparison remain unverified | Preserve the retained Q-15 migration outputs | Baseline is additive, repeatable, catalog-guarded, stop-on-conflict, and compatible with legacy snapshots | OD-07; DATA-C02 | Documentation / pre-provisioning |
| Q15-C02 | Prove repeatability, missing-prerequisite/conflict handling, partial failure recovery, compatibility, and backup/restore | `PARTIAL` | `RUNTIME PROOF` | Partial-failure recovery, production recovery, and release authorization remain unverified | Preserve the retained Q-15 migration, backup, restore, and comparison evidence | Repeated apply is safe/no-op where exact; conflicts stop; partial-failure recovery remains to be demonstrated; legacy/history preserved; restore succeeds | Q15-C01; BAK-C02; ENV-C01 | Runtime validation |
| EVID-C01 | Retain complete evidence and conduct consolidated gate reassessment | `NOT VERIFIED` | `JOINT INPUT` | No run ID, evidence location, hashes, logs, reports, or owner review | Freeze sanitized evidence package and record consolidated decision | Evidence is target-bound, complete, access-controlled, retained through owner review, and maps to Q-10/Q-14/Q-15 acceptance | Q10-C01; Q14-C01; Q15-C02; OD-08 | Post-validation |

#### Closure modality and parallel work

The following can proceed without provisioning: documentation of the migration
package, fixture manifest, backup/restore runbook, evidence-retention format,
security finding dispositions, and executable-package review. The retained
disposable run supplies scoped evidence for ENV-C01, SEC-C01–C04, BAK-C02,
Q10-C01, Q14-C01, and Q15-C01/Q15-C02. ENV-C02, fixture provenance, cleanup,
SEC-DEC-03, broader Financial E2E, implementation authorization, and release
remain open.

### Security and GST fixture owner decision brief

The owner-approved decisions below record policy direction only; they do not
grant provisioning, database access, validation execution, implementation, or
production authorization. This brief preserves OD-01–OD-08,
DGM-OD-01–DGM-OD-14, and Q-01–Q-09 professional-review status.

#### Security decisions

| Decision ID | Existing requirement and unresolved question | Reasonable options and consequence | Recommended option | Acceptance evidence | Decision owner | Stage impact |
|---|---|---|---|---|---|---|---|
| SEC-DEC-01 | Cleanup must use run-owned disposable resources; the current cleanup behavior disables user triggers before deleting GST-history rows. Should trigger disabling ever be permitted? | A: prohibit trigger disabling; cleanup may proceed only through approved constraints/functions, safest but may require a different cleanup design. B: permit only a bootstrap-only, target-bound path with transaction/failure handling and post-cleanup trigger-state proof; more complex and higher risk. | **Option B — OWNER APPROVED, narrowly controlled exception.** Disabling integrity or security triggers is prohibited during normal runtime. A bootstrap or maintenance exception requires explicit authorization, audit evidence, target binding, failure handling, and verification that triggers are restored. Finalized GST/reconciliation history must never be deleted by ordinary runtime paths. | Before implementation, document the authorized principal, target/resource scope, transaction and failure recovery, trigger-state pre/post checks, audit record, and proof that the runtime role cannot delete immutable history. | Project owner; security/database engineering owns implementation controls | Engineering closure required before cleanup design or Q-14; does not authorize implementation. |
| SEC-DEC-02 | Product, customer, and supplier actions visibly support `is_active=false`, but required operation-level permissions are not established. Who may request, approve, and execute soft deletion? | A: segregate request/approval/execution by named project roles; strongest control, more workflow. B: permit an authorized tenant role to execute with audit; simpler, weaker segregation. C: prohibit soft deletion during validation; safest fixture boundary, but does not resolve product policy. | **Recommended policy — OWNER APPROVED.** Separate permissions are required for requesting, approving, and executing soft deletion. Finalized invoices cannot be changed or deleted through soft deletion; GST snapshots, immutable audit records, reconciliation history, and historical references remain protected and valid. | Engineering must define the exact permission matrix, tenant scoping, approval state transitions, audit fields, enforcement boundary, and negative unauthorized-action tests. Authorized actions must retain actor, tenant, reason, and time evidence. | Project owner; application/security engineering owns permission and enforcement details | Engineering closure required before application implementation; fixture cleanup remains separately gated. |
| SEC-DEC-03 | Bootstrap, runtime, administrative, and validation boundaries must not allow ownership, superuser, or `BYPASSRLS` to defeat controls. What privileged boundary is approved? | A: bootstrap provisions/inspects only; runtime is `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, no forbidden DELETE; no callable admin function. B: add a narrowly scoped administrative function; requires owner, safe search path, explicit checks, revoked `PUBLIC` execute, and audit. | **Recommended boundary — OWNER APPROVED.** Separate bootstrap, runtime, administrative, and validation roles are required. Runtime roles must not be superuser or `BYPASSRLS`; privileged maintenance must be explicitly authorized and auditable; tenant isolation must be enforced by database controls and application services. No effective privilege or RLS enforcement is claimed by this approval. | Engineering must capture role attributes, memberships, ownership, `PUBLIC` and default ACLs, effective privileges, RLS/FORCE RLS configuration, and negative runtime tests. | Project owner; security/database engineering owns verification | `NOT VERIFIED`; blocks the relevant production security and provisioning authorization, not the already completed scoped disposable Q-14 tests. |

Soft deletion must not rewrite or remove finalized invoices, GST snapshots,
reconciliation events, audit evidence, ledger facts, or stock/history records.
Historical transactions may continue to reference inactive masters through
transaction-time snapshots; current-master deactivation must not be used to
reconstruct or alter history. Database protections and runtime negative tests
are required in addition to application permission checks.

#### Owner-approved synthetic GST fixture and source policy

Synthetic data only is approved: no production, staging, or real-customer data.
The existing FIX-01 through FIX-13 matrix is preserved without removing or
altering scenarios. Fixtures must cover preloaded HSN entries, authorized
manual HSN additions, and missing, ambiguous, expired, or unapproved mappings.
No statutory rate may be invented or presented as legally verified. Tax-related
scenarios intended to represent legal facts require authoritative source
evidence; unavailable or unverified sources remain explicitly marked as such.
Supplier-declared, application-calculated, and accounting-accepted purchase
values remain distinct, and accounting acceptance is not evidence of statutory
ITC eligibility.

| Scenario IDs | Classification | Source/evidence status |
|---|---|---|
| FIX-01, FIX-05, FIX-06, FIX-07, FIX-08, FIX-12 | Software-behavior fixture | Engineering-defined mechanics; no statutory conclusion |
| FIX-02, FIX-03, FIX-04, FIX-09, FIX-10 | Software behavior with illustrative or pending catalog values | Any illustrative value is non-statutory; legal classification/rate source is required and remains `NOT VERIFIED` where unavailable |
| FIX-11, FIX-13 | Software-behavior migration/recovery fixture | Schema, backup, restore, and recovery evidence required; no legal source claim |

#### Compact synthetic GST fixture scenario matrix — summary only

The detailed [Frozen synthetic fixture manifest](#frozen-synthetic-fixture-manifest)
below is canonical and governs all scenario requirements, evidence, cleanup,
and source-status decisions. This compact matrix is retained only as a
navigation summary and must not be maintained as an independent requirement
set.

All values below are software-test fixtures, not statutory conclusions. Where a
rate is needed for mechanics, use a clearly labelled placeholder or a catalog
entry whose legal source is separately verified; do not infer a rate from HSN
3004 or any treatment label. A pending/unapproved fixture must fail closed.

| Scenario ID | Purpose and synthetic entities/data | Expected behavior and failure conditions | Evidence to capture | Mapping | Approval |
|---|---|---|---|---|---|
| FIX-01 | Two fictional tenants `TENANT-A` and `TENANT-B`; separate fictional users, memberships, products, supplier, customer, invoices | Same-tenant access may proceed; cross-tenant read/write and operation-key reuse must fail closed | Tenant/user IDs, role assignments, denial results, target identity | Q-14 | Engineering + runtime proof |
| FIX-02 | Product with preloaded/common HSN catalog entry and source revision reference | Selection resolves only an approved effective-dated catalog rule; absent source/rule blocks calculation | Catalog version, source reference, effective date, selected snapshot | Q-10/Q-15 | GST/accounting owner + engineering |
| FIX-03 | Product with authorized manual HSN entry; separate pending classification/rate state | Entry is database-backed and auditable; creation does not approve classification/rate; pending rule blocks calculation/finalization | Actor permission, audit event, pending state, fail-closed result | Q-14/Q-15 | Joint input |
| FIX-04 | Effective-dated mappings plus missing, ambiguous, expired, and unapproved rule variants; mixed-rate invoice | Valid rule at transaction date may calculate; invalid variants block; mixed rates remain line-specific | Rule IDs/versions, dates, source references, line outputs, rejection reason | Q-10/Q-15 | Qualified GST reviewer for sources; engineering |
| FIX-05 | Draft domestic sale with fictional seller/recipient/delivery facts and product lines | Draft validates required facts and preserves inputs; unsupported or contradictory facts fail closed | Input fingerprint, POS decision, rule version, validation result | Q-10 | Joint input |
| FIX-06 | Finalized sale with immutable tax/POS/HSN/rule snapshots | Reprint uses snapshots; mutation/deletion of finalized history is denied; inactive masters do not change output | Before/after snapshots, print output, mutation denial, audit log | Q-10/Q-14 | Engineering + runtime proof |
| FIX-07 | Same fictional sale request submitted twice with same idempotency key and payload | Second request returns original successful result without duplicate invoice, stock, ledger, or audit effects | Operation row, canonical hash, result identity, effect counts | Q-10 | Engineering + runtime proof |
| FIX-08 | Same key with changed payload; retry after simulated uncertain response; concurrent identical requests | Changed payload rejects; retry is safe/original-result; concurrency produces one durable effect | Hash conflict, response/result replay, locks/unique result, side-effect counts | Q-10 | Engineering + runtime proof |
| FIX-09 | Fictional purchase with supplier-declared values distinct from application-calculated values | Declared evidence remains unchanged; calculation is separate; material discrepancy blocks accounting completion/posting | Evidence revision, calculation, discrepancy, state transition, audit event | Q-10/Q-15 | Accounting/GST owner + engineering |
| FIX-10 | Purchase with accounting-accepted values after explicit discrepancy resolution | Accepted values record authority and reason; acceptance is not proof of statutory ITC eligibility | Decision record, actor, reason, accepted snapshot, reconciliation event | Q-10 | Accounting/GST owner + qualified GST reviewer |
| FIX-11 | Valid additive migration against approved disposable baseline | Required objects apply with catalog guards and preserve legacy snapshots | Target identity, pre/post catalog, migration ledger, hashes, logs | Q-15 | Engineering/database owner |
| FIX-12 | Repeat migration, missing prerequisite, conflicting object, partial failure | Exact repeat is safe/no-op; missing/conflict stops without silent repair; recovery boundary is explicit | Exit status, conflict object, transaction/recovery evidence, unchanged protected data | Q-15 | Engineering/database owner |
| FIX-13 | Backup disposable target and restore to a separate disposable target | Restore is independently identified and compares schema, fixtures, snapshots, and recovery state | Backup metadata, restore identity, comparison output, retained logs | Q-15 | Joint input + runtime proof |

### Engineering closure contracts

These contracts translate the owner-approved policies into reviewable design
requirements. They are not application code, SQL, migration instructions, or
runtime evidence. A contract marked `REQUIRED` remains unimplemented until its
acceptance evidence is produced on the separately authorized disposable target.

#### SEC-DEC-01 — controlled maintenance exception contract

| Contract area | Required rule |
|---|---|
| Permitted resources | Only run-owned resources in the approved disposable target: temporary fixture rows, temporary staging metadata, and test-run artifacts explicitly listed in the frozen manifest. No production, staging, demo, shared-development, tenant-master, finalized-invoice, GST-snapshot, ledger, stock-history, audit-history, reconciliation-history, or source-evidence resource qualifies. |
| Permitted operations | Disable only named user triggers for a narrowly scoped maintenance operation when an approved cleanup design cannot preserve the required integrity path. The operation must be bounded to the listed resource set and transaction; trigger disabling is never a general cleanup capability. |
| Eligible-trigger allowlist | The authorization must name an exact allowlist of trigger identifiers and owning tables. A trigger is eligible only when its documented purpose is limited to disposable-fixture cleanup bookkeeping and an independent reviewer confirms that purpose and impact. No wildcard, table-family, or future-trigger inclusion is permitted. |
| Trigger classification | Before execution, capture each allowlisted trigger's name, table, event/timing, owner, definition hash, documented purpose, dependencies, and impact classification. Classify it as cleanup bookkeeping only; any integrity, security, tenant-isolation, audit, immutability, referential-integrity, or finalized-history purpose is ineligible. |
| Authorized actor | A separately provisioned bootstrap or maintenance principal, never the runtime application role and never an anonymous or ordinary tenant principal. The actor identity, role attributes, target identity, and authorization reference must be recorded before execution. |
| Authorization | A written owner-approved maintenance authorization must identify purpose, target, resource IDs, trigger names, actor, start/end window, rollback plan, and evidence-retention location. Each run requires a unique authorization ID and correlation ID. |
| Preconditions | Independently verify disposable target identity, run ownership, frozen resource snapshot, no protected-resource references, the allowlist and trigger classifications, trigger enabled state, transaction capability, backup/evidence readiness, and absence of an active scenario. Abort on any mismatch. |
| Audit evidence | Record authorization ID, run ID, correlation ID, actor/session, target marker, resource hash, trigger-state hash before and after, timestamps, operation result, failure state, and post-check results. Do not record credentials or connection strings. |
| Failure handling | Roll back the transaction where possible; on any uncertain outcome, stop further scenarios, preserve the failure evidence, re-identify the target and resource set, and require a new authorization before retry or cleanup. A failure to restore triggers is a security incident and blocks all further use. |
| Restoration verification | In the same controlled boundary, verify every named trigger is restored to its recorded enabled state. Independently re-read trigger metadata after transaction completion, compare definitions and enabled state, and retain the sanitized result. |
| Post-maintenance checks | Revalidate target identity, trigger state, protected-table constraints, role privileges, RLS/FORCE RLS state, resource ownership, and absence of protected-row mutation. Produce a signed/reviewed maintenance result before fixture readiness can be restored. |
| Uncertainty rule | If trigger purpose, definition, dependency, affected rows, tenant impact, or finalized-history impact is uncertain, fail closed and prohibit the exception. Independent pre- and post-maintenance verification is mandatory. |
| Prohibited operations | Never disable triggers classified as tenant isolation, audit, immutability, referential integrity, security, or finalized-history controls; alter or delete finalized financial/GST evidence; bypass RLS; change tenant context; grant privileges; change ownership; disable audit controls; or use the exception to repair schema drift or silently remove conflicts. |

**Acceptance status:** `DESIGN READY FOR OWNER REVIEW — IMPLEMENTATION AND
RUNTIME EVIDENCE REQUIRED`. The exception does not authorize deletion or
alteration of immutable financial history.

#### SEC-DEC-02 — soft-delete permission and lifecycle contract

The following logical permissions are separate capabilities. Their names are
contract identifiers, not claims that the current application already enforces
them.

The verified application lifecycle contains `DRAFT`, `FINALIZED`, and
`CANCELLED`; it has no separate persisted `POSTED` or `REVERSED` state. The
following matrix therefore distinguishes supported states and explicitly marks
unsupported states for engineering confirmation.

| Transaction state | Request soft-delete | Approve | Execute | Correct alternative | Immutable history |
|---|---|---|---|---|---|
| `DRAFT` / unposted | Permitted only for an eligible tenant-scoped master or draft transaction | Permitted with requester/executor separation | Permitted after approval and version/state re-check | Cancellation may be used for a draft invoice where the existing lifecycle supports it | Existing draft evidence and audit events remain auditable; no finalized history exists |
| Posted but not finalized | **Unsupported by current application lifecycle; engineering confirmation required** | Not permitted until a state contract exists | Not permitted | Use an explicitly approved rollback/correction workflow; do not infer one | Any posting effects and audit/ledger/stock records remain immutable unless a separate approved reversal contract exists |
| `FINALIZED` | Prohibited | Prohibited | Prohibited | No current transition; corrections, returns, notes, or reversal require a separately approved workflow | Invoice, GST snapshots, audit, ledger, stock/history, and reconciliation evidence remain immutable |
| `CANCELLED` | Prohibited for the cancelled transaction | Prohibited | Prohibited | No current transition; reversal/reinstatement requires a separately approved workflow | Cancellation actor/time and prior evidence remain immutable |
| `REVERSED` | **Unsupported by current application lifecycle; engineering confirmation required** | Not permitted | Not permitted | No reversal operation may be inferred or introduced by this contract | Original and any future reversal evidence must remain immutable |
| GST snapshots, audit history, reconciliation history | Prohibited in every state | Prohibited | Prohibited | Append a separately authorized correction/reconciliation event where supported | Always immutable; historical references remain valid |

| Principal/capability | Permitted action | Prohibited action |
|---|---|---|
| `SOFT_DELETE_REQUEST` requester | Submit a tenant-scoped request with reason and affected IDs for an eligible `DRAFT`/unposted record | Approve, execute, self-approve, target finalized/cancelled/history records, or cross tenant |
| `SOFT_DELETE_APPROVE` approver | Approve or reject an eligible request; must differ from requester and executor | Approve finalized/cancelled/unsupported states, self-approve, or alter history |
| `SOFT_DELETE_EXECUTE` executor | Set the approved eligible master/draft record inactive after rechecking tenant, state, version, and approval | Direct physical delete, bypass approval, mutate posted/finalized/history records, or cross tenant |
| `SOFT_DELETE_ADMIN_OVERRIDE` administrator | Cancel/suspend a request only if a separate owner-approved administrative contract exists and the action is audited | Bypass separation of duties, state guards, RLS, finalized-history protections, or approve and execute the same request |
| Runtime application role | Invoke only the authorized request path | Direct approval/execution bypass, unrestricted DML, physical deletion, or history mutation |

Required state transitions are `REQUESTED -> APPROVED -> EXECUTED` or
`REQUESTED -> REJECTED/CANCELLED`. Stale, duplicate, cross-tenant, missing-
reason, self-approved, post-finalization, and already-inactive requests must
fail closed. The executor must re-read tenant, state, version, and approval
identity immediately before mutation.

Each request, decision, and execution must emit an immutable audit event with
request ID, tenant ID, actor membership, permission, target type/ID, prior and
new state, reason, correlation ID, timestamp, approval linkage, and result.
Historical transactions may continue to reference inactive masters through
transaction-time snapshots; deactivation must never reconstruct history.

**Remaining engineering decisions:** exact application role names, tenant
permission assignments, approval expiry, cancellation rules, administrative
override prohibition/authorization, database enforcement boundary, and
retention/search behavior. These must be resolved before implementation.

**Acceptance status:** `DESIGN READY FOR OWNER REVIEW — PERMISSION IMPLEMENTATION
AND NEGATIVE RUNTIME EVIDENCE REQUIRED`.

#### SEC-DEC-03 — role and privilege package

| Role | Intended use | Superuser/BYPASSRLS | Ownership | DDL/DML boundary | RLS and audit requirements |
|---|---|---|---|---|---|
| Bootstrap | Create/alter the disposable database package, roles, grants, policies, and controlled test fixtures during authorized setup | Must not be used as evidence of runtime isolation; exact attributes require verification | May own bootstrap-created objects only within the disposable target | DDL only within authorized setup; DML limited to setup/fixture operations; no production/shared target access | Must record target, actor, authorization, catalog changes, and grant changes |
| Runtime | Application reads/writes through approved service paths | `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; no inherited bypass | Must not own protected tables, policies, or privileged routines | No DDL; no direct unrestricted CRUD; no DELETE on immutable history, tenants, or audit logs; tenant-scoped DML only | RLS and `FORCE ROW LEVEL SECURITY` required; missing/invalid tenant context fails closed |
| Administrative | Reserved for separately authorized maintenance or incident handling; not required for the current validation package | Must not be superuser or `BYPASSRLS` by default; any exception requires separate owner approval and evidence | Must not silently own application data objects | No privilege escalation, ownership transfer, RLS bypass, or protected-history mutation; maintenance only as explicitly authorized | Every use requires authorization, correlation, audit, and post-use privilege review |
| Validation | Runs approved Q-10/Q-14/Q-15 checks against the disposable target | Must be ordinary non-superuser/non-`BYPASSRLS`; never use owner or inspection bypass as proof | Must not own application objects | Read-only catalog inspection plus approved scenario mutations through the runtime boundary; no ad hoc DDL | Must prove same/cross-tenant behavior, direct CRUD denial, and finalized-history protection |

All roles require separate credentials, least-privilege grants, no unintended
`PUBLIC` or default-ACL access, and an auditable provisioning record. Schema,
table, sequence, routine, ownership, membership, inheritance, and `EXECUTE`
privileges must be inspected separately. RLS must be enabled and forced on
the governed tables, while privilege restrictions remain independently
enforced. No `SECURITY DEFINER` routine is part of this package; any future
routine requires separate authorization, fixed search path, explicit tenant
checks, revoked `PUBLIC` execute, and review.

**Acceptance status:** `DESIGN READY FOR OWNER REVIEW — EFFECTIVE PRIVILEGE,
APPLIED RLS, AND NEGATIVE RUNTIME EVIDENCE REQUIRED`. This package intentionally
does not claim that any role, grant, ownership, or RLS control is currently
applied.

#### Frozen synthetic fixture manifest

The detailed manifest below is the canonical scenario source. The earlier
compact scenario matrix is retained only as a summary; it must not be used to
add, remove, or reinterpret requirements. Where wording differs, this detailed
manifest governs.

The manifest is frozen at FIX-01 through FIX-13. All identifiers, names,
documents, users, and values are fictional and run-owned. No production,
staging, demo, or real-customer data may be copied or derived. A fixture
loader must reject any non-run-owned resource, unsupported resource type,
duplicate identifier, storage object, or missing provenance. No scenario may
use a statutory rate or classification unless its authoritative source is
attached and independently verified.

| ID / objective | Synthetic entities and relationships | Preconditions and actions | Expected and negative assertions | Evidence, gate, cleanup, source status |
|---|---|---|---|---|
| FIX-01 — tenant isolation | `TENANT-A/B`; separate fictional users, memberships, products, supplier, customer, invoices, and operation keys | Verify target identity; create isolated tenant graph; attempt same-tenant and cross-tenant reads/writes and key reuse | Same-tenant permitted; cross-tenant access, context omission, invalid context, and key reuse fail closed | Identity, memberships, denial logs; Q-14; dependency cleanup; software-only |
| FIX-02 — preloaded HSN catalog | Fictional products reference preloaded catalog entries and source-revision placeholders | Load only approved catalog records with source status; calculate on effective date | Approved effective rule resolves and snapshots; missing source/rule blocks | Catalog/version/source status and snapshot; Q-10/Q-15; remove only run-owned rows; legal source `NOT VERIFIED` unless supplied |
| FIX-03 — manual HSN and pending classification | Fictional product, authorized maintenance actor, pending classification/rate record | Request and record manual HSN; leave classification/rate pending; attempt calculation/finalization | Authorized entry audited; pending rule does not approve itself; calculation/finalization fails closed; unauthorized entry denied | Permission/audit/pending evidence; Q-14/Q-15; dependency cleanup; legal value not asserted |
| FIX-04 — rule lifecycle and mixed rates | Fictional mixed-line invoice with valid, missing, ambiguous, expired, and unapproved rule variants | Evaluate each line at transaction date; no invented rate | Valid sourced rule may calculate; every invalid variant rejects; line rules remain independent | Rule IDs, dates, source status, outputs/rejections; Q-10/Q-15; cleanup lines/invoice first; legal sources `NOT VERIFIED` where absent |
| FIX-05 — draft POS facts | Fictional seller, recipient, billing/delivery facts, products, and draft sale | Submit complete, missing, contradictory, and unsupported fact sets | Complete supported facts preserve fingerprint/POS; missing or contradictory facts fail closed | Input fingerprint, POS decision, validation result; Q-10; cleanup draft graph; legal POS source required for statutory case |
| FIX-06 — finalized snapshot immutability | Fictional finalized sale with tax/POS/HSN/rule snapshots and inactive current master | Reprint before/after master deactivation; attempt update/delete; retain protected rows throughout validation | Output uses stored snapshots; finalized mutation/deletion denied; inactive master cannot rewrite history. No scenario-level cleanup path may delete finalized rows. | Snapshot diff, print result, denial/audit, retained-evidence manifest; Q-10/Q-14; retain finalized synthetic evidence until validation/consolidated review; whole disposable environment destruction is a separate owner-authorized operation requiring positive target re-identification, retained evidence, explicit authorization, and destruction verification; statutory values illustrative unless sourced |
| FIX-07 — idempotent replay | Fictional draft sale, one operation key, deterministic payload | Submit identical request twice | One invoice/stock/ledger/audit effect; second returns original durable result | Operation row/hash/result/effect counts; Q-10; cleanup after evidence; software-only |
| FIX-08 — conflict, retry, concurrency | Fictional sale and same key with changed payload plus concurrent clients | Submit conflicting payload, retry after uncertain response, and concurrent identical requests | Conflict rejected; retry reconciles original result; exactly one durable effect | Hash conflict, replay, lock/unique result, counts; Q-10; cleanup after evidence; software-only |
| FIX-09 — purchase evidence separation | Fictional supplier, purchase, lines, supplier-declared values, calculated values, reconciliation event | Capture declaration; calculate separately; introduce material discrepancy | Declaration immutable; calculation separate; discrepancy blocks accounting completion/posting | Revision/calculation/event/state/audit; Q-10/Q-15; dependency cleanup; legal ITC not inferred |
| FIX-10 — accounting acceptance boundary | Fictional purchase discrepancy and authorized accounting actor | Resolve discrepancy with reason; record accepted values | Acceptance records authority/reason/snapshot; does not assert statutory ITC eligibility | Decision actor/reason/reconciliation event; Q-10; cleanup after evidence; statutory eligibility source `NOT VERIFIED` |
| FIX-11 — valid additive migration | Disposable baseline, fictional legacy rows/snapshots, approved migration package | Apply migration after catalog/precondition checks | Required objects apply additively; legacy snapshots preserved; no shared target | Target identity, catalog, migration ledger/hash/log; Q-15; restore/cleanup boundary; no statutory claim |
| FIX-12 — migration failure/recovery | Separate disposable copies with missing prerequisite, conflict object, and partial-failure setup | Repeat migration; induce prerequisite/conflict/failure; recover | Repeat is safe/no-op; missing/conflict stops without repair; recovery boundary and protected-data comparison are explicit | Exit status, conflict, recovery and comparison evidence; Q-15; restore before destruction; no statutory claim |
| FIX-13 — backup/restore | Disposable source and separately identified disposable restore target containing only manifest resources | Back up source; restore; independently verify target identity and compare schema/fixtures/snapshots/state | Restore target is distinct; comparisons match approved scope; limitations retained | Backup metadata, restore identity, comparison/log retention; Q-15; separate-target cleanup; no statutory claim |

The manifest is `READY FOR OWNER REVIEW` as a design artifact. Fixture
creation, loading, backup, restore, cleanup, and scenario execution remain
unauthorized until the staged gates and separate provisioning authorization are
complete.

#### Source-reference and evidence rules for fixtures

For each tax-related fixture, retain the authoritative Act, notification,
circular, rate entry, amendment chain, effective date, classification source,
and reviewer decision when those facts are intended to be legal rather than
mechanical. The current record does not establish a complete product-specific
pharmaceutical rate, Integrated Tax, State SGST, or UTGST source set; those
remain `NOT VERIFIED`. Until verified, use neutral/pending/unapproved catalog
states and test fail-closed behavior. Q-01–Q-09 professional review remains
owner-confirmed only and does not extend to new fixture decisions.

#### Owner decision sheet and responsibility boundary

SEC-DEC-01, SEC-DEC-02, SEC-DEC-03, and the synthetic GST fixture/source
policy are `OWNER APPROVED`. Engineering must still define the exact
permission matrix, manifest, migration package, evidence format, trigger
exception controls, and cleanup plan. Joint acceptance is required for fixture
contents involving historical GST facts, backup/restore boundaries, security
control implementation, and the executable Q-10/Q-14/Q-15 package.
Runtime proofs remain engineering execution responsibilities after separate
provisioning authorization; the owner does not certify technical behavior.

### Staged execution plan

| Stage | Entry criteria | Permitted actions | Completion evidence |
|---|---|---|---|
| 1. Requirements/design closure | Requirements, owner decisions, contracts, and scope are recorded | Documentation and design review only | Approved review package |
| 2. Environment prerequisite verification | Target, credentials, roles, fixtures, backup/restore, retention, and cleanup requirements identified | Verify prerequisites without connecting to an unverified target | Prerequisite register |
| 3. Authorized disposable provisioning | Owner authorization and verified provisioning inputs complete | Provision only the declared disposable target | Target metadata and redacted identity |
| 4. Independent target/role verification | Target exists and is independently identified | Read-only identity, role, ACL, ownership, RLS, and endpoint checks | Sanitized catalog and role report |
| 5. Fixture/backup/evidence/cleanup verification | Target and roles pass; fixture and recovery decisions approved | Prepare synthetic fixtures, verify backup/restore, evidence retention, and cleanup boundary | Frozen fixture, backup/restore, evidence, and cleanup records |
| 6. Pre-implementation engineering validation | Q-10/Q-14/Q-15 scope and executable package approved | Run only authorized isolated engineering validation | Sanitized Q-10/Q-14/Q-15 results |
| 7. Consolidated evidence review | Validation results retained and failures classified | Reconcile gates and reassess readiness | Consolidated gate register and owner decision |
| 8. Owner authorization and implementation evidence | Full-scope owner authorization is recorded; engineering and validation gates reviewed | Implement within approved requirements and evidence boundaries | Implementation and acceptance evidence |
| 9. GST application implementation | Owner authorization and approved package complete | Implement the approved GST scope | Implementation and regression evidence |
| 10. Financial E2E/release authorization | Post-implementation Financial E2E evidence and release criteria complete | Authorize Financial E2E and release separately | Release decision and production go/no-go |

### Minimum validation scope

- **Q-10:** first post, same-key replay, conflicting payload, concurrent
  duplicate, timeout/unknown outcome, transient/permanent failure, invoice
  numbering, stock/ledger uniqueness, tenant key isolation, audit/recovery.
- **Q-14:** anonymous denial, bootstrap/runtime privilege separation,
  missing/invalid tenant context, cross-tenant read/write denial, pooled
  session isolation, finalized-history mutation denial, guarded transitions,
  and invalid-FK/unique-constraint rejection.
- **Q-15:** baseline apply, schema consistency, repeatability, missing
  prerequisite, drift/conflict stop, partial-state recovery, historical
  snapshot preservation, backup restore, post-migration comparison, and
  approved recovery boundary.

The historical package result was `BLOCKED — ENGINEERING PREREQUISITES REMAIN`.
The later disposable-target Q-10/Q-14/Q-15 validation completed within its
authorized scope, but partial-failure recovery, cleanup, production security,
production migration, and implementation authorization remain open. No
application, schema, SQL, migration, database, backup, fixture, cleanup, or
Financial E2E operation beyond that separately authorized disposable scope is
authorized by this package.

### 7.8 Owner-input checklist for environment provisioning

Record each item before provisioning. These inputs do not authorize validation
execution, application implementation, migration, pilot, or production use.
Secret values must never be placed in this checklist or retained in evidence;
credential provisioning must use the approved local secret-management method.

#### Recorded owner decisions

| Decision ID | Owner decision | Status | Conditions | Remaining engineering evidence | Dependencies | Stage impact |
|---|---|---|---|---|---|---|
| OD-01 | Approved documented local Docker Compose PostgreSQL 17 disposable target | `OWNER APPROVED` | Independent isolation verification is mandatory; no provisioning or connection is authorized by this decision | Target identity, network/storage separation, and ordinary-target comparison | ENV-02, ENV-03 | Provisioning remains blocked |
| OD-02 | Approved project engineering team ownership and operation; owner retains authorization authority | `OWNER APPROVED` | Operate only within separately approved scope; destruction remains owner-authorized | Ownership record and run-owned resource accountability | ENV-01, ENV-04 | Provisioning and cleanup accountability |
| OD-03 | Approved local untracked environment configuration or appropriate local secret store | `OWNER APPROVED` | Never print, commit, or document secrets; verify target identity and credential scope before connection | Secure provisioning procedure and credential-scope evidence without secret values | ENV-03, SEC-01 | Connection remains blocked |
| OD-04 | Approved synthetic data only: fictional tenants, users, products, suppliers, customers, invoices, and GST scenarios | `OWNER APPROVED` | No production, staging, or real-customer data; fixture ownership, provenance, and cleanup remain engineering requirements | Frozen manifest, provenance, ownership, and cleanup evidence | DATA-01–04 | Fixture preparation remains blocked |
| OD-05 | Approved mandatory successful backup and restore demonstration for the disposable database | `OWNER APPROVED` | Does not authorize production backup or restoration | Backup scope, isolated restore target, successful comparison, and retained evidence are satisfied for the disposable run; production recovery remains unverified | BAK-01–03 | Production rollout and recovery authorization remain blocked |
| OD-06 | Approved retention until owner review of the consolidated report, then owner-authorized destruction | `OWNER APPROVED` | Preserve logs, evidence, reports, and final state before destruction; reuse requires separate approval | Positive target re-identification, cleanup plan, destruction result, and credential/artifact accounting | CLN-01–03 | Cleanup remains separately gated |
| OD-07 | Conditionally approved Q-10, Q-14, and Q-15 scope | `OWNER APPROVED` | Historical pre-execution condition: execute only after all applicable prerequisites are independently verified and the approved disposable target is confirmed. Later authorized disposable Q-10/Q-14/Q-15 validation completed within that limited scope. | Reviewed executable package and Q-10/Q-14/Q-15 runtime evidence | VAL-10, VAL-14, VAL-15 | Historical validation execution was blocked before the later authorized disposable run; production and broader validation remain separately gated |
| OD-08 | Approved separate validation and implementation gates | `OWNER APPROVED` | Consolidated report, owner review, correction/retest, and separate implementation proposal are required; no production, deployment, or release authorization | Consolidated evidence review and explicit later implementation decision | VAL-16 | Implementation and production remain unauthorized |

#### A. Environment target and isolation

| Item ID | Required input | Input type | Responsible role | Status | Dependency | Acceptance evidence | Stage impact |
|---|---|---|---|---|---|---|---|
| ENV-01 | Approve the disposable execution location, endpoint, database/container identity, and owner | Owner decision | Project owner; engineering/database owner | `OWNER APPROVED` | None | Recorded target decision and redacted identity record | Blocks provisioning until engineering evidence |
| ENV-02 | Define loopback/network, port, volume, storage, and restart boundaries; prove no ordinary, staging, or production overlap | Joint approval | Engineering/database owner; security owner | `ENGINEERING INPUT REQUIRED` | ENV-01 | Sanitized network/storage isolation record and ordinary-target comparison result | Blocks provisioning |
| ENV-03 | Define independent target verification before connection, including database/server/role/application-marker readback | Engineering evidence | Engineering/database owner | `PASS — SCOPED` | ENV-01, ENV-02 | Retained disposable identity evidence matches the approved target; production/staging comparison remains open | Blocks production/staging use and fixture reuse |
| ENV-04 | Define target ownership and who may authorize destruction | Owner decision | Project owner | `OWNER APPROVED` | ENV-01 | Project engineering ownership and owner authorization boundary recorded | Blocks provisioning and cleanup until evidence |

#### B. Database roles and permissions

| Item ID | Required input | Input type | Responsible role | Status | Dependency | Acceptance evidence | Stage impact |
|---|---|---|---|---|---|---|---|
| SEC-01 | Confirm `pharmnos_e2e` bootstrap and `pharmnos_e2e_runtime` runtime identities and intended use | Owner decision | Project owner; database/security owner | `OWNER APPROVED` | ENV-01 | Approved role-boundary record | Blocks provisioning until effective verification |
| SEC-02 | Verify role attributes, inheritance, ownership, `PUBLIC`/default ACLs, grants, revocations, and `BYPASSRLS` state | Engineering evidence | Database/security owner | `PASS — SCOPED` | SEC-01, ENV-03 | Retained disposable catalog and effective-privilege evidence; production/staging state remains open | Blocks production security |
| SEC-03 | Verify forced RLS, fail-closed tenant context, cross-tenant denial, anonymous/direct CRUD denial, and finalized GST/reconciliation history protection under the owner-approved privileged boundary | Engineering evidence | Security/database owner | `PASS — SCOPED` | SEC-02 | Retained disposable policy/privilege readback and negative access results; SEC-DEC-03 and production security remain open | Blocks production security |
| SEC-04 | Implement and evidence the owner-approved cleanup-trigger exception, soft-delete authorization boundary, and privileged-function restrictions | Engineering evidence | Security/database owner; engineering owner | `PASS — SCOPED` | SEC-02 | Retained SEC-DEC-01/02 negative and recovery results; cleanup authorization and SEC-DEC-03 remain open | Blocks production security and cleanup |

#### C. Sanitized data and fixtures

| Item ID | Required input | Input type | Responsible role | Status | Dependency | Acceptance evidence | Stage impact |
|---|---|---|---|---|---|---|---|
| DATA-01 | Record the owner-approved synthetic-only fixture boundary; prohibit real-derived data unless separately approved and sanitized | Owner decision | Project owner; accounting/GST owner | `OWNER APPROVED` | None | Synthetic-only fixture-source decision and prohibited-data boundary | Blocks fixture preparation until engineering evidence |
| DATA-02 | Define run-owned tenants, users, permissions, products, batches, customers, suppliers, invoices, ledgers, stock, audit rows, and legacy records | Joint approval | Engineering owner; accounting/GST owner | `OWNER INPUT REQUIRED` | DATA-01 | Frozen fixture manifest with permitted categories and provenance | Blocks fixture preparation |
| DATA-03 | Approve GST classification/rate fixtures, captured seller/recipient/supply facts, purchase declared/calculated/accepted values, mixed-rate cases, and unsupported/fail-closed cases without inventing legal rates | Joint approval | Accounting/GST owner; qualified GST reviewer | `OWNER INPUT REQUIRED` | DATA-02 | Reviewed scenario matrix and source references; no assumed HSN/rate | Blocks Q-10 and Q-15 scenarios |
| DATA-04 | Assign fixture ownership and removal authority; record that production/demo tenants and data are excluded | Owner decision | Project owner; engineering owner | `OWNER APPROVED` | DATA-02 | Engineering ownership, owner destruction authority, and exclusion boundary | Blocks cleanup until evidence |

#### D. Backup and restore

| Item ID | Required input | Input type | Responsible role | Status | Dependency | Acceptance evidence | Stage impact |
|---|---|---|---|---|---|---|---|
| BAK-01 | Approve backup scope, destination, encryption, access restrictions, retention, and operator boundary | Owner decision | Project owner; engineering/database owner | `OWNER APPROVED` | ENV-01, DATA-02 | Approved backup/retention record with no secret values | Blocks provisioning and Q-15 until evidence |
| BAK-02 | Define an isolated restore target and comparison set for schema, fixtures, snapshots, and recovery state | Engineering input | Engineering/database owner | `PASS — SCOPED` | BAK-01 | Retained restore-target identity and comparison output; production recovery remains unverified | Blocks production recovery authorization |
| BAK-03 | Establish restore evidence and any destructive recovery-test authorization; written procedure alone is insufficient | Joint approval | Engineering/database owner; project owner | `OWNER APPROVED` | BAK-02 | Retained disposable backup/restore result and comparison output are present; production backup, rollback, recovery authorization, and any destructive recovery test remain separate | Blocks production backup/rollback/recovery authorization |

#### E. Cleanup and destruction

| Item ID | Required input | Input type | Responsible role | Status | Dependency | Acceptance evidence | Stage impact |
|---|---|---|---|---|---|---|---|
| CLN-01 | Define resources that may be destroyed and resources that must never be touched | Owner decision | Project owner | `OWNER APPROVED` | ENV-01, DATA-04 | Disposable-only destruction boundary and exclusion list | Blocks cleanup |
| CLN-02 | Require positive re-identification of target, frozen run-owned resource set, credentials, volumes, containers, and temporary artifacts before destruction | Engineering input | Engineering/database owner | `ENGINEERING INPUT REQUIRED` | ENV-03, DATA-04 | Fresh identity match and immutable cleanup snapshot | Blocks cleanup |
| CLN-03 | Define retained cleanup evidence, failure handling, and destruction authorization | Joint approval | Project owner; security/operations owner | `OWNER APPROVED` | CLN-01, CLN-02 | Retain report/evidence until owner review, then record destruction authorization, result, logs, and retention | Blocks cleanup closure |

#### F. Validation evidence and approvals

| Item ID | Required input | Input type | Responsible role | Status | Dependency | Acceptance evidence | Stage impact |
|---|---|---|---|---|---|---|---|
| VAL-10 | Approve and package Q-10 cases: first post, same-key replay, conflicting payload rejection, canonical request hash, retry/original-result behavior, unknown outcome recovery, concurrency, invoice/stock/ledger uniqueness, and tenant-key isolation | Joint approval | Engineering owner; project owner | `OWNER APPROVED` | SEC-02, DATA-02, DATA-03 | Reviewed executable package and sanitized isolated results; disposable Q-10 validation completed `PASS — SCOPED` | Production authorization and broader Financial E2E validation remain separate |
| VAL-14 | Approve and package Q-14 cases: bootstrap/runtime privilege separation, RLS/FORCE RLS, invalid tenant context, cross-tenant denial, pooled-session isolation, anonymous/direct CRUD denial, finalized-history mutation denial, guarded transitions, and constraint rejection | Joint approval | Security/database owner; project owner | `OWNER APPROVED` | SEC-02, SEC-03, DATA-02 | Applied catalog/ACL/RLS evidence and reproducible negative results; disposable Q-14 validation completed `PASS — SCOPED` | SEC-DEC-03 and production security verification remain separate |
| VAL-15 | Produce and review the additive migration baseline, catalog guards, stop-on-conflict behavior, repeatability, partial-state handling, legacy compatibility, backup/restore, rollback/recovery boundary, and evidence ledger | Engineering evidence | Engineering/database owner | `PARTIAL` | ENV-03, BAK-01–03, DATA-02 | Retained disposable migration/restore evidence; partial-failure recovery and production authorization remain open | Blocks production migration and recovery authorization |
| VAL-16 | Complete consolidated evidence review and separately decide whether GST application implementation may be authorized | Joint approval | Project owner; engineering/security/database owners | `OWNER INPUT REQUIRED` | VAL-10, VAL-14, VAL-15 | Gate reassessment and explicit implementation decision | Blocks stages 8–9 |

#### Practical owner response sheet

| Response ID | Decision ID | Recorded owner response | Status | Conditions and remaining evidence |
|---|---|---|---|---|
| OWNER-01 | OD-01 | Approved documented local Docker Compose PostgreSQL 17 disposable target | `OWNER APPROVED` | Independent isolation, target identity, and ordinary-target comparison remain required; provisioning is not authorized by this response. |
| OWNER-02 | OD-04 | Approved synthetic-only fictional tenants, users, products, suppliers, customers, invoices, and GST scenarios | `OWNER APPROVED` | No production, staging, or real-customer data; manifest, provenance, ownership, and cleanup evidence remain required. |
| OWNER-03 | OD-02 | Project engineering team owns and operates the disposable environment; owner retains authorization authority | `OWNER APPROVED` | Run-owned accountability and destruction boundary must be recorded; no individual name or secret is requested. |
| OWNER-04 | OD-05, OD-06 | Successful disposable backup/restore is mandatory; retain environment until owner review, then destroy only after owner approval | `OWNER APPROVED` | Backup/restore result, retention evidence, positive target re-identification, destruction result, and credential/artifact accounting remain required. |
| OWNER-05 | OD-03, OD-07 | Approved local secret-store handling and conditional Q-10/Q-14/Q-15 scope | `OWNER APPROVED` | Secrets remain outside documentation; effective roles, grants, RLS, tenant isolation, and validation evidence remain unverified. |
| OWNER-06 | OD-07 | Q-10 covers sales idempotency/replay/conflict/retry/concurrency; Q-14 covers roles/RLS/tenant isolation/history; Q-15 covers migration/recovery/backup-restore | `OWNER APPROVED` | Execution requires independent prerequisite verification and confirmed disposable target plus reviewed executable package. |
| OWNER-07 | OD-06 | Owner approval is required for consolidated-report retention completion and subsequent destruction | `OWNER APPROVED` | Cleanup requires fresh target/resource re-identification, frozen run-owned resource set, retained evidence, and destruction authorization. |
| OWNER-08 | OD-08 | Validation, consolidated review, correction/retest, and GST implementation authorization remain separate stages | `OWNER APPROVED` | No GST implementation, production access, deployment, or release authorization follows from validation approval. |

No password, token, connection string, or other secret is requested here.
Secure credentials must be provisioned through the approved ignored local
environment or equivalent secret store and verified without copying values into
documentation or evidence.

## 8. Contradictions and handling

1. The active specification preserves `DGM-OD-01` through `DGM-OD-14` as
   `DECIDED`, while the same specification records statutory, engineering,
   database, and runtime dependencies as blocked. This is not a contradiction:
   decision status is separated from implementation and evidence status.
2. The active source has a two-state sales calculator (`INTRA`/`INTER`), while
   `DGM-OD-14` includes UTGST. The owner direction is preserved; implementation
   support is not claimed until UTGST rules are approved.
3. Prisma contains GST models and Option B composite relations. The retained
   Q-15 run proves migration application, repeatability, conflict handling,
   backup, restore, and comparison on disposable targets; it does not prove
   production or live-database application. Source schema remains design
   evidence outside that scoped run.
4. Existing executable-looking RLS assets cover older tables, while the
   security review artifacts require complete GST-table coverage, forced RLS,
   restricted roles, and immutable triggers. The review artifacts are treated
   as target controls, not applied security evidence.
5. Purchase source code contains idempotency and acceptance paths, while the
   active policy and E2E harness require database-backed proof. Source
   safeguards are reported as partial, not complete.

## 9. Closure conclusion

Stage 1 has a recorded owner-confirmed professional-review status for Q-01
through Q-09. The five engineering blocker decisions are now owner-approved for
scoped implementation and isolated validation. SEC-DEC-03, the
synthetic-fixture contracts, and the FIX-01–FIX-13 manifest remain open until
their required evidence is produced. Legal/source, HSN/rate catalog,
historical compatibility, and broader Financial E2E evidence remain open.
Production migration, production data modification, production security
approval, deployment, and GST release remain governed by their separate
authorization and go/no-go controls and are not granted by this owner
authorization.

**Final status: `Q-10 PASS — SCOPED; Q-14 PASS — SCOPED; Q-15 PASS —
SCOPED for the disposable local validation target; complete GST Modernization
scope OWNER-AUTHORIZED for implementation and associated validation by Masum
Rafique on 2026-10-31 — production migration, production security approval,
deployment, and GST release remain separately governed and unapproved`.**

## 10. Files and execution record

### Files read

- [Canonical project instructions](../CLAUDE.md)
- [Phase Tracker](../PHASE_TRACKER.md)
- [Active GST specification](./domestic-gst-modernization.md)
- [Superseded GST specification](./gst-specification.md)
- [GST audit and validation plan](./gst-audit-validation-and-plan.md)
- [PGST-01 policy](./pgst-01-purchase-gst-workflow-policy.md)
- [PGST-01 traceability register](./pgst-01-decision-traceability-register.md)
- [Purchase persistence design](./purchase-gst-persistence-design.md)
- [GST schema rollout review](./gst-schema-rollout-design-review.md)
- [Financial E2E harness](./financial-e2e-validation-harness.md)
- [GST calculator](../../src/domain/services/gst-calculator.service.ts)
- [Purchase calculator](../../src/domain/services/purchase-calculator.service.ts)
- [Purchase reconciliation service](../../src/domain/services/purchase-gst-reconciliation.service.ts)
- [Sales actions](../../src/app/_actions/sales.actions.ts)
- [Purchase actions](../../src/app/_actions/purchases.actions.ts)
- [Sales validation](../../src/lib/validation/sales.schemas.ts)
- [Purchase validation](../../src/lib/validation/purchases.schemas.ts)
- [Master validation](../../src/lib/validation/masters.schemas.ts)
- [Prisma schema](../../prisma/schema.prisma)
- [RLS review artifact](../../prisma/financial-e2e-rls-policies.review.sql)
- [Security controls review artifact](../../prisma/financial-e2e-security-controls.review.sql)
- [Financial E2E safety tests](../../tests/financial-e2e-safety.test.mjs)

### Execution boundary

The five owner-approved decisions authorize scoped application, Prisma,
migration, test, and security-control changes. No production database,
Supabase project, production configuration, deployment, or release activity is
authorized by this document.
