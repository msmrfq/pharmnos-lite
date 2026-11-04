---
title: GST and Accounting Decision Question Pack
date: 2026-10-31
status: OWNER AUTHORIZED - APPROVED GST ACCOUNTING DECISION PACK; PROFESSIONAL GATES SEPARATE
---

## Goal

## Acceptance Criteria

## Out of Scope

# GST and Accounting Decision Question Pack

**Status:** `OWNER AUTHORIZATION GRANTED — COMPLETE GST MODERNIZATION SCOPE;
PROFESSIONAL/ACCOUNTING AND PRODUCTION GATES REMAIN OPEN`
**Scope:** Domestic GST Modernization first-release decisions  
**Prepared:** 2026-10-31 (IST)  
**Owner:** Masum Rafique
**Owner decision:** Complete documented GST Modernization scope authorized on
2026-10-31 (IST), including documented features, specifications, engineering
workstreams, supporting implementation activities, and associated validation
work. This does not constitute qualified professional/legal/accounting
approval, independent security approval, migration execution authorization, or
production release approval.
**Authority:** Review aid only for statutory/accounting questions. This
document does not approve statutory treatment, accounting policy, migration
execution, pilot, or production use.

## 1. Executive briefing

Pharmnos Lite has a proposed domestic GST architecture and owner-selected engineering directions, but material statutory and accounting decisions remain unapproved. This pack converts those gaps into answerable questions for a qualified GST reviewer, accounting/finance owner, and authorized business owner.

The first release is intentionally narrow:

- retain the existing eight-option combined treatment dropdown;
- permit only explicitly approved, fact-supported workflows;
- fail closed for unsupported, contradictory, stale, or incomplete facts;
- preserve supplier-declared, application-calculated, and accounting-accepted purchase values separately;
- persist transaction-time facts and calculation versions rather than reconstructing history from mutable masters;
- keep Composition, Unregistered, Consumer, Overseas, SEZ, Deemed Export, and UIN workflows blocked until their decisions are approved;
- keep database rollout, runtime verification, and production authorization separate from business decision closure.

The conservative owner-agreed product direction is only a candidate boundary: Registered Business – Regular may be supported after all applicable gates pass; the other seven labels remain blocked or deferred as specified below. The existing eight-option dropdown must remain. The label must not collapse supplier scheme/status, recipient registration, customer type, transaction category, GSTIN evidence, seller registration/location, delivery facts, or POS facts into one legal rule.

The questions below are neutral. Selecting an answer requires the role and evidence specified in each question. Owner-agreed product direction is not qualified GST/accounting approval, engineering-contract approval, security/database evidence, or implementation authorization.

**Document responsibility and hierarchy:** The [Domestic GST Modernization
master specification](./domestic-gst-modernization.md) is the overall scope
and architecture entry point. This document owns GST professional questions,
statutory/accounting decisions, professional review records, and clarification
evidence. The [GST Decision Closure and Engineering Contract
Approval](./gst-decision-closure-and-engineering-contract-approval.md) owns
owner decisions and engineering authorization records; [Purchase GST
Persistence and Workflow Design](./purchase-gst-persistence-design.md) owns
purchase persistence details; and [GST Schema Rollout Design
Review](./gst-schema-rollout-design-review.md) owns schema and rollout details.
Read this pack when a task involves its designated subject. A master summary
does not override a detailed accounting record; conflicts must be recorded with
exact locations and left unresolved pending responsible review. This hierarchy
does not change professional review status or authorize implementation.

### 2.1 Owner-confirmed professional review

The project owner explicitly confirms that Q-01 through Q-09 were reviewed and
signed off by a qualified Indian GST professional. This record identifies no
reviewer name, membership number, signature, review date, certificate, or
attachment because none was supplied. The confirmation records review status
only; it does not authorize implementation, migration, testing, database
access, pilot activity, or production use.

## 2. Glossary

| Term | Meaning in this pack |
|---|---|
| POS | Place of supply under the applicable GST law; it is not inferred solely from a GSTIN prefix. |
| GSTIN | Goods and Services Tax Identification Number; format validity is distinct from registration status and effective dates. |
| Regular | Normal GST registration/taxpayer treatment; not a blanket authorization for every transaction type. |
| Composition | A separate statutory scheme with distinct eligibility, charging, document, and ITC consequences. |
| UIN | Unique Identity Number holder; treatment and evidence must be separately approved. |
| HSN/SAC | Product/service classification used for tax and invoice purposes. |
| Declared value | Supplier-stated value or tax fact preserved as evidence. |
| Calculated value | Value produced by the application from captured facts and a versioned rule set. |
| Accepted value | Value explicitly accepted for accounting/posting by an authorized actor. |
| Finalization | The guarded transition from editable draft to an invoice whose tax and financial facts are historical evidence. |
| Fail closed | Refuse calculation, finalization, acceptance, or posting when required evidence is absent or contradictory. |
| Rule version | Effective-dated, source-referenced tax/classification rule used for a calculation. |

## 3. Priority and status legend

- **P0:** blocks any first-release workflow or creates a statutory/accounting risk.
- **P1:** blocks a particular supported workflow or durable historical evidence.
- **P2:** later-phase or owner-operating-policy decision; must not be silently assumed.
- **Unresolved:** answer required.
- **Source research incomplete:** primary source or amendment status needs revalidation.
- **Professional interpretation required:** law exists but application to this product scenario needs qualified review.
- **Owner approval required:** product/accounting operating choice remains open.

## 4. Prioritized reviewer questions

### Q-01 — Treatment eligibility and first-release transaction directions

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded, with policy limitations still open.
**Decision area:** Treatment and transaction eligibility.  
**Exact question:** Which supplier/recipient combinations for Registered Business – Regular, Registered Business – Composition, Unregistered Business, Consumer, Overseas, SEZ, Deemed Export, and UIN Holders are permitted in the first release, and which must remain blocked?  
**Why needed:** The display label cannot safely determine tax, POS, document type, exemption, or ITC behavior.  
**Current project direction:** Preserve all eight labels. Registered Business – Regular is a candidate for support subject to every applicable gate. Registered Business – Composition, Unregistered Business, Consumer, Overseas, SEZ, Deemed Export, and UIN Holders remain blocked or deferred pending their separate rules and evidence. Composition status is supplier-side unless a separately approved recipient rule applies; a buyer's composition status must not automatically determine the supplier's tax treatment.  
**Established:** Treatment direction is a product boundary, not a legal conclusion; CGST Act section 31 distinguishes tax invoice and bill of supply; IGST Act section 7 treats SEZ supplies as inter-State. Supplier scheme/status, recipient registration, recipient/customer type, transaction category, GSTIN evidence, seller registration/location, delivery facts, and POS are separate facts.  
**Unresolved:** Permitted directions, evidence, document behavior, registration prerequisites, and accounting treatment for each combination.  
**Authoritative sources:** [CGST Act, 2017, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489), sections 10, 31; [IGST Act, 2017, India Code](https://www.indiacode.nic.in/handle/123456789/2159?sam_handle=123456789/1362), sections 7–8; [CBIC Composition FAQ](https://cbic-gst.gov.in/pdf/faq-manual/faq-composition-levy-revised.pdf).  
**Source limitations:** The Acts and FAQ do not decide Pharmnos’ product eligibility matrix, current amendments for every category, or accounting acceptance policy.  
**Scenario:** A Regular seller invoices a Composition buyer in another State; a UIN buyer requests a tax invoice; a local sale is described as Consumer but the buyer later requests GST credit. Decide whether each is supported, what evidence is mandatory, and what document is issued.  
**Answer choices:** (A) support only Registered Business – Regular after all gates pass and block the other seven labels; (B) approve named additional combinations with a separate rule/evidence matrix; (C) another explicitly documented scope that does not make the display label the tax rule.  
**Consequences:** Changes allowed workflows, document type, tax components, POS inputs, validation, persisted treatment facts, reporting, and blocked-state messaging.  
**Reviewer role:** Qualified GST reviewer; accounting/finance owner; authorized business owner for scope.  
**Approval evidence:** Named approver and role, date, exact matrix, statutory authority, rationale, effective date, and treatment-rule owner.  
**Dependencies:** Q-02, Q-03, Q-04, Q-05, Q-06, Q-07.  

### Q-02 — POS fact hierarchy and confirmation

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded.
**Decision area:** Place of supply and transaction facts.  
**Exact question:** For each domestic goods scenario, which applicable statutory POS rule determines the result, what verified facts are required, and how should the system handle conflicting bill-to, ship-to, dispatch, delivery, recipient, and third-party-direction facts?  
**Why needed:** A billing state, GSTIN prefix, or manual dropdown override can produce the wrong tax component. The application must apply the legally relevant rule rather than allow a user-selected POS to override it.  
**Current project direction:** Use the applicable statutory rule and verified supplier, recipient, movement, delivery, and transaction facts; show a non-authoritative suggestion; require user confirmation as evidence of review; validate server-side before calculation and revalidate at finalization. Missing, contradictory, changed, or unsupported facts fail closed.  
**Established:** IGST Act section 10(1)(a) addresses goods involving movement by the supplier, recipient, or any other person, subject to the provision's conditions. Section 10(1)(b) addresses delivery by the supplier to a recipient or other person on a third person's direction. Section 10(1)(ca), effective from 2023-10-01 according to official Circular 209/3/2024-GST, addresses supplies to an unregistered person by reference to the recipient address/state recorded in the invoice, with the statutory fallback where it is not recorded. Sections 7–8 distinguish inter-State and intra-State supply.  
**Unresolved:** Rule precedence for each supported wholesale scenario, including supplier location from which the supply is made and relevant GST registration, recipient registration/status and recorded address, bill-to/ship-to, dispatch, delivery, movement termination, third-party direction, and statutory exceptions.  
**Authoritative sources:** [IGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/2159?sam_handle=123456789/1362), sections 7–8 and 10(1)(a), 10(1)(b), 10(1)(ca); [CBIC IGST Act PDF](https://cbic-gst.gov.in/htdocs-cbec/gst/igst-act.pdf); [GST Council Circular 209/3/2024-GST](https://gstcouncil.gov.in/sites/default/files/2024-09/circular-no-209-03-2024.pdf); [CGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489), section 31.  
**Source limitations:** The statutory provisions do not provide a Pharmnos-specific data model or resolve every fact pattern without professional interpretation.  
**Scenario:** Seller in Maharashtra bills a Karnataka customer, dispatches from Gujarat, and delivers to a Karnataka warehouse owned by a third party. Identify seller location, recipient, movement end, POS, evidence, and whether the invoice may finalize.  
**Answer choices:** (A) approve a named statutory rule and fact matrix for each supported scenario; (B) approve workflow-specific matrices where different statutory provisions apply; (C) block any scenario not covered by an approved rule. In every option, a manual selection may confirm the displayed result but may not override the legally determined POS.  
**Consequences:** Determines CGST/SGST/UTGST/IGST, mandatory fields, confirmation UI, revalidation, snapshot contents, and fail-closed paths.  
**Reviewer role:** Qualified GST reviewer; engineering owner records the approved contract only.  
**Approval evidence:** Scenario matrix with authority, examples, reviewer signature/identity, date, and unresolved-case policy.  
**Dependencies:** Q-01, Q-03, Q-05, Q-08.  

### Q-03 — GSTIN and registration verification

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded. Source limitations remain recorded.
**Decision area:** Counterparty verification.  
**Exact question:** What source and evidence establish GSTIN validity, registration status, effective dates, cancellation/suspension, and state consistency, and what must happen when verification is absent, stale, invalid, or mismatched?  
**Why needed:** Shape validation is not checksum or current registration verification.  
**Current project direction:** Preserve raw values; do not use prefixes as the sole tax/POS rule; fail closed where the approved workflow requires verified facts.  
**Established:** Current repository validation checks shape only; no verified verification service is claimed.  
**Unresolved:** Verification source, refresh interval, evidence retention, offline behavior, effective-date comparison, supplier/recipient asymmetry, and mismatch handling.  
**Authoritative sources:** [GST portal](https://www.gst.gov.in/); [CGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489), registration and invoice provisions.  
**Source limitations:** Portal availability, access terms, API capability, checksum semantics, and legal effect of portal status require current verification and reviewer confirmation.  
**Scenario:** A supplier GSTIN has valid shape but is cancelled before the invoice date; a recipient GSTIN state differs from the delivery state. Decide whether to block, allow with evidence, or route to review.  
**Answer choices:** (A) verified-on-create and rechecked at finalization; (B) verified only when required by treatment; (C) no external verification in first release, with explicit blocked scope.  
**Consequences:** Changes master-data fields, verification events, cache expiry, finalization gates, retry/error behavior, and historical snapshots.  
**Reviewer role:** Qualified GST/accounting reviewer; authorized business owner for operating tolerance.  
**Approval evidence:** Source, verification method, status semantics, effective-date policy, retention period, and named owner.  
**Dependencies:** Q-01, Q-02, Q-06.  

### Q-04 — HSN/SAC classification and exceptions

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded. Source limitations remain recorded.
**Decision area:** Classification and invoice eligibility.  
**Exact question:** For each first-release product type, what HSN/SAC granularity and evidence are mandatory, who owns classification, and which documented exceptions permit calculation or invoicing without a complete classification?  
**Why needed:** A free-form optional code cannot establish classification or rate eligibility.  
**Current project direction:** Product-level classification where applicable; missing, ambiguous, invalid, or unsupported required classification blocks; no invented digit count or exception.  
**Established:** Rule 46 and related notifications prescribe invoice particulars; requirements are turnover- and invoice-context-sensitive.  
**Unresolved:** Goods-only scope, digit requirements applicable to this taxpayer, classification evidence, effective dates, ambiguity handling, and rate linkage. HSN 3004 must not be treated as universally 5% or universally 0% for life-saving medicines; classification, tariff description, notification entry, conditions, exemptions, and effective date must be established for the actual product.  
**Authoritative sources:** [CGST Rules, 2017, CBIC](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf), rule 46; [Notification 78/2020-Central Tax, CBIC](https://www.cbic.gov.in/resources//htdocs-cbec/gst/notfctn-78-central-tax-english-2020.pdf); [CBIC Circular 90/09/2019-GST](https://cbic-gst.gov.in/pdf/circular-cgst-90.pdf).  
**Source limitations:** The rule/notification materials are amendment-sensitive; the Notification 78 link is corrected to the 78 document and does not establish a universal HSN 3004 rate. They do not classify Pharmnos products or establish a universal exception.  
**Scenario:** A medicine has two plausible classifications and the rate catalog has different outcomes. Decide whether to block, require reviewer classification, or use a controlled rule with retained evidence.  
**Answer choices:** (A) block until approved classification; (B) permit a reviewed provisional classification with explicit non-posting state; (C) another evidence-based exception.  
**Consequences:** Changes product fields, catalog governance, rate selection, invoice readiness, audit evidence, and stale-draft handling.  
**Reviewer role:** Qualified GST reviewer; business owner for catalog ownership.  
**Approval evidence:** Classification source, code, rationale, effective date, reviewer, and exception rule if any.  
**Dependencies:** Q-01, Q-07.  

#### HSN master and rate-catalog engineering prerequisite

The inspected repository currently stores product `hsn_code` and `gst_rate`
scalars; no governed database-backed HSN catalog, HSN-to-rate catalog,
effective-dated approval workflow, or catalog audit trail was verified.
Accordingly, the acceptance contract requires preloaded/common HSN entries and
legally approved HSN-to-rate mappings to be held in governed database-backed
catalogs, with search/selection, authorized manual entry, update/activation/
deactivation, duplicate prevention, classification hierarchy/code-length
governance, audit trails, pending classification or rate-verification states,
separate HSN-maintenance and rate-approval permissions, and
effective-dated mappings linked to authoritative notification/source
revisions. Adding an HSN must not by itself establish or approve a GST rate or
legal classification. Missing, ambiguous, expired, or unapproved
classification/rate must block calculation and finalization. Finalized
transactions must preserve the exact HSN, classification/rate versions, source
reference, and transaction-time snapshots; historical transactions must never
recalculate from current catalog data. No catalog entry, classification, or
rate is approved by this note.

### Q-05 — Tax components for States and Union Territories

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded. Source limitations remain recorded.
**Decision area:** CGST/SGST/UTGST/IGST applicability.  
**Exact question:** For each approved POS scenario, when does the product apply CGST+SGST, CGST+UTGST, or IGST, and what seller/recipient registration and territory facts are mandatory?  
**Why needed:** Current ordinary paths cover intra-state and inter-state components but do not establish the proposed UTGST behavior.  
**Current project direction:** Same-state ordinary path uses CGST+SGST; inter-State uses IGST; UTGST is not yet implemented or legally finalized.  
**Established:** IGST sections 7–8 provide the inter-/intra-State framework; the repository has an explicit State/UT catalog.  
**Unresolved:** Applicable UTGST scenarios, exceptions, component display, rate sourcing, and mixed-territory handling.  
**Authoritative sources:** [IGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/2159?sam_handle=123456789/1362), sections 7–8; [CGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489).  
**Source limitations:** The links establish the framework, not the complete current rate or UT-specific policy for every scenario.  
**Scenario:** A seller and delivery location are in a Union Territory, while the registered recipient’s principal address is elsewhere. Decide component selection and evidence.  
**Answer choices:** (A) support only ordinary State and IGST paths; (B) add named UTGST paths after approval; (C) block unresolved territory combinations.  
**Consequences:** Changes calculator outputs, schema fields, invoice presentation, reconciliation, rate catalog, and tests.  
**Reviewer role:** Qualified GST reviewer; accounting owner.  
**Approval evidence:** Component matrix by territory/POS, source provisions, examples, effective date, and reviewer sign-off.  
**Dependencies:** Q-01, Q-02, Q-07.

### Q-06 — Tax-rate governance and historical reproducibility

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded. Source limitations remain recorded.
**Decision area:** HSN/SAC and effective-dated rate rules.  
**Exact question:** Which centrally governed, effective-dated tax-rule record governs each approved product classification, and how are rate changes prevented from rewriting historical invoices?  
**Why needed:** A numeric rate stored on a product cannot reproduce historical tax without an effective-dated rule version.  
**Current project direction:** Central, effective-dated, source-referenced rules with reproducible historical selection; no invented rate or exemption.  
**Established:** Classification and tax-rate determination are separate decisions. The rule model must retain HSN/SAC classification and description; Central, Integrated, and State/UT components; rate and exemption conditions; notification number, schedule and entry; effective-from/effective-to dates; source revision; and approval evidence. A medicine's HSN alone is insufficient to determine its rate. Historical invoices must retain transaction-time classification and tax-rule snapshots.  
**Unresolved:** Source hierarchy, amendment monitoring, future-dated rates, rate validity at supply date, stale drafts, superseded/withdrawn notifications, and version retention.  
**Authoritative sources:** [CBIC GST portal](https://cbic-gst.gov.in/); [CBIC notifications](https://www.cbic.gov.in/htdocs-cbec/gst/index); [GST Council rate notification 1/2017-Central Tax (Rate)](https://gstcouncil.gov.in/en/node/4422); [India Code CGST Act](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489).  
**Source limitations:** Portal indexes and notifications must be checked for supersession and applicability; no source here authorizes a Pharmnos catalog entry.  
**Scenario:** A draft uses rate version V1, then a future-dated notification changes the rate before finalization. Decide whether to reprice, preserve V1, or block for review.  
**Answer choices:** (A) finalization uses rule effective on supply date; (B) draft locks a reviewed version; (C) block stale or superseded drafts pending explicit revalidation.  
**Consequences:** Changes catalog tables, source metadata, calculation IDs, stale detection, immutable classification/rate snapshots, historical invoice rendering, and migration compatibility. Later rate changes must never rewrite historical invoices.  
**Reviewer role:** Qualified GST reviewer; accounting owner; business owner for operating controls.  
**Approval evidence:** Source hierarchy, versioning policy, effective-date rule, refresh owner, and sample approved records.  
**Dependencies:** Q-04, Q-05, Q-07, Q-09.  

### Q-07 — Taxable value, discounts, pricing mode, and rounding

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded.
**Decision area:** Tax calculation and accounting policy.  
**Exact question:** What approved calculation contract governs quantity and unit-price precision, discount precision and allocation, taxable-value and tax-component precision, intermediate arithmetic, line/invoice rounding, residual allocation, invoice-total reconciliation, tax-inclusive/exclusive pricing, mixed-rate discounts, and pre-supply, at-supply, and qualifying post-supply discounts?  
**Why needed:** Current arithmetic uses JavaScript numeric values and two-decimal behavior; tax-inclusive pricing and consistent draft/finalization policy are unresolved. No numeric storage type, including a possible PostgreSQL `Decimal(20,4)` candidate, is approved by this pack.  
**Current project direction:** Owner-approved records `0005`, `0007`, and
`0009` establish the demonstrated current-release engineering direction:
use one authoritative exact-decimal calculator, preserve source
representations, distinguish inclusive and exclusive paths, and separate
commercial round-off from tax. Keep unsupported purchase workflows, unresolved
thresholds, statutory boundaries, and professional-confirmation questions
blocked until their required evidence exists.
**Established:** CGST Act section 15 addresses transaction value, inclusions, and conditions for discounts. Section 15(3) distinguishes discounts given before or at supply and qualifying post-supply discounts.  
**Unresolved:** Discount classes, ITC evidence, inclusive pricing, quantity/unit-price and decimal scale, intermediate arithmetic, line versus invoice rounding, statutory rounding requirements, residual allocation, negative round-off, invoice reconciliation, and mixed-rate invoices.  
**Authoritative sources:** [CGST Act section 15, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489); [CBIC Circular 92/11/2019-GST](https://cbic-gst.gov.in/pdf/circular-cgst-92.pdf), subject to current-status verification. Circular 105/24/2019-GST is not operative and must not be used.  
**Source limitations:** Circular 105/24/2019-GST was withdrawn ab initio by Circular 112/31/2019-GST; Circular 92/11/2019-GST and all rate/discount guidance remain amendment-sensitive. Statutory sources do not select Pharmnos' accounting rounding policy.  
**Scenario:** Two lines have different rates; an invoice-level discount produces a fractional allocation and a one-paise residual. Decide allocation, rounding, displayed round-off, and persisted values.  
**Answer choices:** (A) approve a line-first contract with documented allocation and reconciliation; (B) approve an invoice-level contract with documented allocation and reconciliation; (C) support only explicitly approved pricing/discount modes and block all others. The answer must specify the numeric representation after review; no `Decimal(20,4)` or other type is pre-approved.  
**Consequences:** Changes calculator APIs, monetary types, invoice totals, purchase reconciliation, snapshots, print output, and regression fixtures.  
**Reviewer role:** Qualified GST reviewer and accounting/finance owner.  
**Approval evidence:** Signed numerical policy with precision, rounding examples, discount evidence requirements, and effective date.  
**Dependencies:** Q-01, Q-04, Q-05, Q-06, Q-10. Q-13 is limited to transaction-time evidence and source snapshots and does not repeat this precision decision.  

### Q-08 — Purchase declared/calculated/accepted values and reconciliation

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded.
**Decision area:** Purchase accounting and reconciliation.  
**Exact question:** What discrepancy thresholds, materiality rules, evidence, authority, segregation of duties, and revision behavior determine whether supplier-declared and system-calculated values may become accounting-accepted values, without treating acceptance as proof of ITC eligibility?  
**Why needed:** These three value types must remain separate; acceptance is not a recalculation shortcut.  
**Current project direction:** Preserve all three values; acceptance is explicit
and guarded; posting is service-led with database integrity and idempotency
protections. Decision `0008` records owner-approved high-level discrepancy
direction, while threshold, materiality, authority, segregation, and statutory
ITC conditions remain unresolved.
**Established:** Supplier-declared values are invoice evidence; system-calculated values are Pharmnos' expected values; accounting-accepted values are an explicit authorized decision. Acceptance must require user identity, authorization, timestamp, rationale/evidence, current evidence/calculation linkage, and immutable audit history. Purchase acceptance remains required before posting.  
**Unresolved:** Threshold units, tax-component versus total comparison, acceptance roles, stale acceptance, correction/rejection, GSTR-2B matching use, reversals, other statutory ITC conditions, and posting eligibility.  
**Authoritative sources:** [CGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489), sections 16 and 34 where applicable; [CGST Rules, CBIC](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf); [GST portal](https://www.gst.gov.in/) for official return/statement context.  
**Source limitations:** A GSTR-2B match is not automatic proof of ITC eligibility; statutory ITC/document rules do not define Pharmnos' internal materiality, acceptance authority, or segregation-of-duties policy. Portal availability and matching semantics require current qualified review.  
**Scenario:** Supplier declares ₹1,000 tax, application calculates ₹1,002, and a revised supplier invoice later changes the declared amount. Decide whether to accept, reject, revise, or block posting and what evidence is retained.  
**Answer choices:** (A) exact match only, with explicit acceptance still required; (B) threshold-based acceptance with reason, evidence, and authority; (C) manual review above a named threshold. Every answer must separately define ITC review and must prohibit silent replacement of supplier-declared tax or automatic conversion of a match into acceptance.  
**Consequences:** Changes reconciliation state machine, roles, event log, calculation relation, posting guard, idempotency, and audit exports.  
**Reviewer role:** Accounting/finance owner; qualified GST reviewer; authorized business owner for roles.  
**Approval evidence:** Threshold table, actor matrix, required rationale, revision policy, and sample accepted/rejected cases.  
**Dependencies:** Q-07, Q-09, Q-11, Q-12.  

### Q-09 — Purchase calculation source facts and GST treatment

**Priority/status:** P0 — `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded.
**Decision area:** Purchase calculation and supplier-side facts.  
**Exact question:** Which supplier invoice facts, recipient facts, POS facts, line classifications, discounts, and declared values are mandatory before purchase calculation, and which supplier-side versus recipient-side treatment differences must be represented?  
**Why needed:** Current purchase calculation is aggregate and caller-supplied scenario based; it does not establish a fact-specific line-level contract.  
**Current project direction:** Move toward line-level, fact-based calculation while preserving supplier evidence and avoiding fabricated historical facts.  
**Established:** Purchase design separates immutable evidence, versioned calculations, accounting decisions, and append-only events.  
**Unresolved:** Required input set, supplier-declared tax authority, reverse-charge/exception scope, treatment of incomplete supplier invoices, GSTR-2B matching evidence, reversals, and other ITC conditions.  
**Authoritative sources:** [CGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489); [IGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/2159?sam_handle=123456789/1362); [CGST Rules, CBIC](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf).  
**Source limitations:** Sources do not determine the business’ accounting acceptance of supplier-declared values or whether excluded statutory cases are in release scope.  
**Scenario:** Supplier invoice has one line with a missing HSN and an aggregate tax total that differs from a fact-based calculation. Decide whether calculation, reconciliation, acceptance, and posting may proceed independently.  
**Answer choices:** (A) block calculation; (B) calculate only supported lines and hold invoice; (C) preserve declared evidence and require manual review.  
**Consequences:** Changes purchase schemas, line evidence, calculation versioning, reconciliation, posting, error states, and the separation between accounting acceptance and ITC eligibility review.  
**Reviewer role:** Qualified GST reviewer and accounting owner.  
**Approval evidence:** Required-facts matrix, unsupported-case policy, treatment-specific rules, and named acceptance authority.  
**Dependencies:** Q-01, Q-04, Q-05, Q-06, Q-07, Q-08.  

### Q-10 — Sales finalization, stale drafts, and durable idempotency

**Priority/status:** P0 — `PASS — SCOPED; broader GST implementation is owner-authorized and remains evidence-gated`.
**Decision area:** Sales finalization and financial integrity.  
**Exact question:** Which facts must be revalidated and recalculated at finalization, and what exact behavior applies to duplicate, conflicting, concurrent, timed-out, and retrying finalization requests?  
**Why needed:** A successful response is not proof that only one invoice, stock movement, ledger entry, and sequence allocation occurred.  
**Current project direction:** Service-led atomic posting with database safeguards, guarded transitions, idempotency, and concurrency protections; the disposable Q-10 validation package now passes.
**Established:** The sales action uses a tenant-scoped operation record, canonical request hash, atomic result recording, replay/conflict handling, and database uniqueness; isolated evidence is retained.
**Unresolved:** Broader GST implementation policy and production/release validation remain separate.
**Authoritative sources:** [CGST Act section 31, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489); financial behavior is primarily an internal control decision.  
**Source limitations:** GST law does not prescribe Pharmnos’ distributed-request protocol or database concurrency design.  
**Scenario:** Two browser tabs finalize the same draft with different shipping states; the first request times out after commit. Decide the response and audit evidence for both requests.  
**Answer choices:** (A) one immutable result returned for the same fingerprint; (B) conflict for a different fingerprint; (C) explicit unknown-result lookup before retry.  
**Consequences:** Changes API contracts, unique keys, transaction boundaries, locks, audit events, UI recovery, and E2E tests.  
**Reviewer role:** Authorized business owner for workflow; engineering owner for implementation contract; accounting owner for financial effects.  
**Approval evidence:** Finalization state machine, idempotency matrix, conflict examples, and owner sign-off.  
**Dependencies:** Q-02, Q-06, Q-07, Q-11, Q-12.  

#### Q-10 source-level engineering evidence

| Requirement | Status | Evidence and limitation |
|---|---|---|
| Durable operation/idempotency key | `PASS — SCOPED` | Retained disposable-target validation observed one durable operation for the successful application path. |
| Canonical request-payload hash | `PASS — SCOPED` | Same-key different-payload rejection passed in the retained application-path run. |
| Same key + same payload retry | `PASS — SCOPED` | Exact replay returned the original result without duplicate effects. |
| Same key + different payload rejection | `PASS — SCOPED` | `q10-application-final.txt` records `conflictingKeyReuse: CONFLICT_REJECTED`; the separate `q10-q14-regression-final.txt` records the same-key/different-payload assertion as `PASS`. |
| Concurrent duplicate handling | `PASS — SCOPED` | Retained evidence observed `COMMITTED+CONFLICT`; the historical harness accepted one `COMMITTED` and one `REPLAY` or `CONFLICT`, and no duplicate financial effects were observed. The owner-approved target contract now requires one `COMMITTED` and one `REPLAY`; the retained conflict outcome is not a replay and does not prove the revised contract. |
| Transactional operation/result persistence | `PASS — SCOPED` | Invoice, stock, ledger, operation, and related effects were checked in the disposable target. |
| Failure recovery and retry semantics | `PASS — SCOPED` | Pre-commit rollback and client-response-loss replay passed; this is not production evidence. |
| Tenant scoping and authorization | `PASS — SCOPED` | The action path and disposable runtime tests enforced tenant-scoped visibility and authorization. |
| Unique database constraints/conflict handling | `PASS — SCOPED` | The strengthened action path uses the durable operation contract and transaction-scoped advisory lock; production schema/application rollout remains separate. |
| Audit evidence and observability | `PARTIAL` | Financial effects and operation state were verified, but production retention, monitoring, and audit-operational policy remain open. |

#### Q-10 assertion-level scope

| Assertion | Evidence | Result | Limitation / follow-up |
|---|---|---|---|
| Same-key replay | `q10-application-final.txt`; dated validation report | `PASS — SCOPED` | Disposable target only. |
| Conflicting payload | `q10-application-final.txt`; `q10-q14-regression-final.txt` | `PASS — SCOPED` | Production deployment and retention policy remain open. |
| Concurrent identical/conflicting requests | `q10-application-final.txt`; barrier regression | `PASS — SCOPED` | Concurrent identical observed `COMMITTED+CONFLICT`, accepted by the historical harness as one `COMMITTED` plus one `REPLAY` or `CONFLICT`; no duplicate financial effects were observed. `CONFLICT` is not described as replay. The owner-approved strict target requires `COMMITTED+REPLAY`, which remains `NOT RUN` after implementation. No production load or failure-domain evidence. |
| Atomic rollback and uncertain outcome recovery | `q10-application-final.txt`; `q10-q14-regression-final.txt` | `PASS — SCOPED` | Broader financial workflows remain unverified. |
| Authorization and tenant isolation | Q-10/Q-14 retained package | `PASS — SCOPED` | Production role/grant state remains separate. |
| Audit retention/operational monitoring | No sufficient retained production evidence | `NOT VERIFIED` | Define retention, alerting, and operational review before release. |

The implementation and isolated evidence are retained in
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md).
This closes Q-10 for the disposable target only; GST implementation and release
authorization remain separate.

### Q-11 — Immutable historical facts and legacy records

**Priority/status:** P0 — OWNER AUTHORIZED; professional interpretation and
evidence validation remain required.
**Decision area:** Historical compatibility and invoice printing.  
**Exact question:** What minimum immutable transaction-time facts are required for new finalized invoices, and how should legacy invoices with incomplete POS, classification, or component facts be displayed and reprinted without fabricating history?  
**Why needed:** Current master data cannot be silently substituted for historical truth.  
**Current project direction:** Persist facts and calculation outputs for new records; disclose explicit fallback for legacy records; never guess unavailable POS.  
**Established:** Current printing prefers persisted values where complete and has a disclosed fallback path; database immutability is unverified.  
**Unresolved:** Required snapshot fields, legacy labels, correction/reprint wording, backfill prohibition/permission, and export behavior.  
**Authoritative sources:** [CGST Act section 31, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489); [CGST Rules, CBIC](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf), invoice particulars.  
**Source limitations:** Statutes do not define this product’s legacy disclosure wording or evidence-retention implementation.  
**Scenario:** A 2024 invoice has only aggregate GST and no recorded POS; the customer requests a reprint after the customer master state changed. Decide exact display, warning, and whether any backfill is permitted.  
**Answer choices:** (A) reprint only persisted facts with an “incomplete historical facts” notice; (B) allow a separately approved correction document; (C) block reprint until evidence is supplied.  
**Consequences:** Changes snapshot schema, print templates, correction workflows, migration policy, audit logs, and support procedures.  
**Reviewer role:** Qualified GST reviewer; accounting owner; authorized business owner.  
**Approval evidence:** Snapshot checklist, legacy wording, reprint policy, backfill decision, and authority.  
**Dependencies:** Q-02, Q-04, Q-06, Q-10.  

### Q-12 — Purchase acceptance, posting, and correction lifecycle

**Priority/status:** P0 — OWNER AUTHORIZED; accounting policy and evidence
validation remain required.
**Decision area:** Purchase posting and reconciliation history.  
**Exact question:** What state transitions, roles, correction documents, reversal behavior, and posting prerequisites apply after a purchase calculation is accepted or posted?  
**Why needed:** Acceptance and posting must not silently mutate historical evidence or create duplicate stock/ledger effects.  
**Current project direction:** Append-only evidence/reconciliation events, guarded accounting decisions, service-led posting, idempotency, and transaction-level atomicity.  
**Established:** The persistence design proposes immutable revisions, optimistic versions, actor relations, and posting operations; rollout and runtime behavior are not verified.  
**Unresolved:** Rejection versus correction, post-acceptance revision, reversal/cancellation scope, role separation, and uncertain posting outcomes.  
**Authoritative sources:** [CGST Act sections 31 and 34, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489); [CGST Rules, CBIC](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf).  
**Source limitations:** Product controls, accounting workflow, and excluded correction documents require owner/professional decisions.  
**Scenario:** An accepted purchase is posted, then the supplier supplies a revised invoice. Decide whether to append a revision, reverse and repost, issue a correction, or block.  
**Answer choices:** (A) append-only revision with controlled reacceptance; (B) reversal/correction workflow; (C) block post-acceptance changes in first release.  
**Consequences:** Changes states, event types, permissions, posting operations, stock/ledger atomicity, and audit exports.  
**Reviewer role:** Accounting/finance owner; qualified GST reviewer; authorized business owner.  
**Approval evidence:** State diagram, actor matrix, correction authority, document policy, and examples.  
**Dependencies:** Q-08, Q-09, Q-10, Q-11.  

### Q-13 — Transaction-time evidence and source snapshots

**Priority/status:** P1 — OWNER AUTHORIZED; engineering, professional, and
evidence validation remain required.
**Decision area:** Transaction-time reproducibility and audit evidence.  
**Exact question:** What immutable transaction-time facts, source revision identifiers, effective timestamp semantics, raw input representations, calculation inputs/outputs, and historical tax-rule snapshots are mandatory for every finalized sales and purchase record?  
**Why needed:** Historical reproducibility requires more than a final aggregate tax amount and must not be reconstructed from mutable master data.  
**Current project direction:** Persist transaction-time identity, POS, classification, tax-rule, evidence, and calculation snapshots; preserve raw source values; do not fabricate historical facts.  
**Established:** The persistence design separates raw supplier strings from parsed values and requires immutable evidence/calculation/decision records; the database and runtime controls remain unverified.  
**Unresolved:** Minimum snapshot fields, effective-date/time-zone contract, source revision identifiers, legacy fallback wording, and reprint behavior. Precision and rounding are decided only in Q-07.  
**Authoritative sources:** [CGST Act section 15, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489); [CGST Rules, CBIC](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf); internal accounting and engineering contracts for serialization and retention.  
**Source limitations:** GST law does not prescribe the application’s database snapshot shape or timestamp serialization.  
**Scenario:** A medicine invoice is finalized before a rate amendment becomes effective, then reprinted after the product master and rate catalog change. Decide which classification, notification entry, rate, components, source revision, and display values remain immutable.  
**Answer choices:** (A) persist the complete transaction-time snapshot and use it for all reprints; (B) persist a minimum approved snapshot with disclosed legacy fallback; (C) block finalization/reprint when required evidence is absent.  
**Consequences:** Changes snapshot schemas, calculation IDs, print/export behavior, audit payloads, legacy compatibility, and EC-11 acceptance evidence.  
**Reviewer role:** Accounting owner and qualified GST reviewer for historical evidence; engineering owner for the serialization contract.  
**Approval evidence:** Snapshot checklist, effective-time policy, source-version fields, retention rule, reprint policy, and named approvals.  
**Dependencies:** Q-04, Q-06, Q-07, Q-10, Q-11.  

### Q-14 — Security, tenant isolation, and database enforcement acceptance

**Priority/status:** P0 — `PASS — SCOPED; PRODUCTION EVIDENCE REMAINS SEPARATE`.
**Decision area:** Engineering-only hybrid architecture and access control.  
**Exact question:** What engineering and security evidence must exist before GST workflows are enabled to prove restricted backend access, separate bootstrap/runtime roles, tenant-scoped forced RLS, no anonymous CRUD, guarded historical transitions, and tenant-aware composite relations? This is not a GST practitioner approval question.  
**Why needed:** Application checks alone cannot prove cross-tenant isolation or immutable financial history.  
**Current project direction:** GST-APP-01 through GST-APP-08 require a service-led hybrid boundary, fail-closed RLS, Option B composite `calculation_id`, guarded nullable pointers, and additive catalog-guarded rollout.  
**Established:** Applied role, grants, forced RLS, tenant-context denial, cross-tenant denial, pooled-session reset, DDL denial, and finalized-history protection passed in the disposable target.
**Unresolved:** Production evidence and broader release threshold remain separate.
**Authoritative sources:** Internal approved architecture decisions and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) for platform behavior; statutory sources do not establish technical controls.  
**Source limitations:** Review SQL is not deployed evidence; Supabase documentation does not prove this repository’s configuration.  
**Scenario:** An authenticated user attempts to read another tenant’s calculation and update a finalized decision through a direct API path. Define expected denial, audit event, and evidence.  
**Answer choices:** (A) service-only access plus forced RLS defense in depth; (B) a separately approved role/policy model; (C) keep workflow disabled until the stated controls are verified.  
**Consequences:** Changes grants, RLS, triggers, service boundaries, test authorization, rollout gates, and operational monitoring.  
**Reviewer role:** Authorized business owner for acceptance; security/database reviewer; engineering owner. A qualified GST practitioner may review business implications but cannot approve the technical controls.  
**Approval evidence:** Sanitized catalog baseline, role/grant report, RLS/trigger tests, cross-tenant denial evidence, and approver.  
**Dependencies:** Q-08, Q-10, Q-12, Q-15, Q-16.  

#### Q-14 evidence assessment

| Evidence layer | Result | Finding |
|---|---|---|
| Written design | `VERIFIED_IN_SOURCE` | Security and RLS review artifacts define bootstrap/runtime separation, fail-closed tenant predicates, forced RLS, restricted grants, immutable-history controls, and no direct browser CRUD. |
| Executable SQL present | `PARTIAL` | Review-only SQL exists for grants, RLS policy contracts, security controls, and provisioning guards; it is explicitly incomplete/non-executable as an approval package. |
| Applied database state | `VERIFIED_IN_ISOLATED_TARGET` | The disposable target identity, role attributes, grants, forced-RLS state, policies, triggers, and constraints were captured by the retained Q-14 validation run. |
| Runtime tests | `VERIFIED_IN_ISOLATED_TARGET` | Authorized isolated cross-tenant read/write, role, privilege, forced-RLS, pooled-session, and finalized-history mutation scenarios passed. |

**Q-14 result:** `PASS — SCOPED` for the disposable target. Evidence is retained in
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md).

### Q-15 — Schema rollout and migration authorization

**Priority/status:** P0 — `PASS — SCOPED; PRODUCTION ROLLOUT REMAINS SEPARATE`.
**Decision area:** Engineering-only persistence and rollout.  
**Exact question:** After business decisions are approved, what additive schema rollout, catalog preflight, conflict stop conditions, compatibility window, rollback boundary, and explicit authorization are required before applying GST persistence changes, including the selected GST-APP-03 Option B tenant- and invoice-scoped `calculation_id` relation? This is not a GST practitioner approval question.  
**Why needed:** Owner-selected Option B is a design constraint, not migration authorization.  
**Current project direction:** GST-APP-03 Option B is the selected design direction; rollout remains additive, catalog-guarded, repeatable, and stop-on-conflict; no production migration/backfill without explicit approval.  
**Established:** A committed Prisma baseline, repeatability, conflict stop, backup, restore, and source/restore comparison passed in disposable targets. Partial-failure recovery is not independently verified from the retained raw output.
**Unresolved:** Production migration owner, production target identity, and release authorization.
**Authoritative sources:** Internal schema rollout review and [Prisma migration documentation](https://www.prisma.io/docs/orm/prisma-migrate); legal sources do not authorize deployment.  
**Source limitations:** Design documents are proposals and cannot establish live catalog state or safe rollback.  
**Scenario:** Preflight finds an existing object with the expected name but incompatible type. Decide whether to stop, rename, or require manual remediation.  
**Answer choices:** (A) stop on any conflict; (B) approved compatibility adapter; (C) defer migration until a separately reviewed remediation exists.  
**Consequences:** Determines migration SQL, deployment gates, rollback evidence, legacy reads, and operational runbooks.  
**Reviewer role:** Authorized business owner; database/security reviewer; engineering release owner. A qualified GST practitioner may confirm business requirements only, not authorize migration.  
**Approval evidence:** Sanitized baseline, dry-run report, conflict policy, rollback/restore evidence, authorization, and change window.  
**Dependencies:** Q-06, Q-08, Q-11, Q-12, Q-14, Q-16.  

#### Q-15 evidence assessment

| Requirement | Status | Finding |
|---|---|---|
| Additive-only behavior | `VERIFIED_IN_ISOLATED_TARGET` | The committed disposable baseline applied successfully without application-table partial state on conflict. |
| Catalog-guarded prerequisites | `VERIFIED_IN_ISOLATED_TARGET` | Conflicting catalog objects stopped migration before application tables were created. |
| Stop-on-conflict | `PASS` | Conflict validation stopped with an explicit Prisma migration ledger failure row. |
| Repeatability | `PASS` | Repeated migration invocation completed without duplicate application. |
| Partially provisioned schemas | `PASS — SCOPED` | The final summary reports this result, but the retained raw output does not include the queried table/ledger counts or a separate recovery/retry result; partial-state recovery is therefore `NOT VERIFIED` independently. |
| RLS policy coverage | `PASS` | Restored schema comparison matched 27 RLS tables and 74 policies. |
| Constraints and indexes | `PASS` | Fresh migration and restore comparisons completed successfully. |
| Rollback/recovery | `NOT VERIFIED` | Backup/restore and conflict-stop evidence are retained, but the raw output does not directly demonstrate recovery/retry from the partial migration state; production rollback remains separate. |
| Prisma migration-history compatibility | `PASS` | The committed PostgreSQL baseline and migration ledger validated successfully. |
| Existing-data preservation | `PASS — SCOPED` | Source and restored synthetic counts matched. |
| Application-service compatibility | `PASS — SCOPED` | The current schema, generated artifacts, and isolated migration package validated together. |

**Q-15 result:** `PASS — SCOPED` for the disposable validation target, with partial-failure recovery `NOT VERIFIED`. Evidence is
retained in
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md).
The committed migration package, sanitized backup, disposable target,
repeatability, conflict-stop, restore, and Prisma-history evidence are retained
in the dated validation artifact. The final summary reports partial-failure
recovery, but the retained raw output does not expose the state query or a
recovery/retry action; that assertion remains `NOT VERIFIED`. Production
migration remains separately unauthorized.

### Q-16 — First-release owner scope and implementation gate

**Priority/status:** P0 — OWNER AUTHORIZED; engineering evidence and separate
implementation gates remain required.
**Decision area:** Engineering-only release authorization.  
**Exact question:** Which approved decisions and verified engineering controls are sufficient to authorize implementation design, isolated testing, controlled pilot, migration, and production rollout as separate gates? This is an owner/release-governance question, not a GST practitioner decision.  
**Why needed:** Closing questions must not be mistaken for implementation authorization.  
**Current project direction:** Stage 1 business/statutory closure remains the
policy boundary; the five owner-approved engineering contracts may now be
implemented and validated in isolated targets. Live Supabase rollout,
production migration, production data modification, and GST release remain
NO-GO.
**Established:** BD-01–BD-16 and EC-01–EC-14 are tracked, with business and database/security gates open.  
**Unresolved:** Named gate owners, required evidence for each transition, pilot scope, and explicit exclusions.  
**Authoritative sources:** Internal decision-closure artifact, Phase Tracker, financial E2E harness, and approved project instructions.  
**Source limitations:** Internal documents govern project authorization, not statutory interpretation.  
**Scenario:** All Regular-path decisions are approved, but RLS and durable idempotency evidence is missing. Decide whether implementation, isolated tests, pilot, or production may proceed.  
**Answer choices:** (A) allow only design work; (B) allow authorized isolated implementation/testing after a separate gate; (C) keep all work blocked until named evidence exists.  
**Consequences:** Changes project status, permissible engineering actions, pilot controls, migration authorization, and go/no-go records.  
**Reviewer role:** Authorized business owner; engineering/security/database owners; qualified GST/accounting reviewers only for the business/statutory prerequisites.  
**Approval evidence:** Gate matrix, named approvers, dates, evidence links, scope exclusions, and explicit authorization text.  
**Dependencies:** Q-01 through Q-15.  

## 5. Scenario sheets

### 5.1 POS and treatment scenarios

For each scenario, the reviewer must record: seller registration/location, recipient identity/status, bill-to, ship-to, dispatch, delivery end, movement actor, treatment label, invoice date, supply date, evidence, POS, tax component, document, and blocked/allowed outcome.

| Scenario | Decision questions exposed |
|---|---|
| Same-State seller and recipient, goods move to recipient warehouse | Q-01, Q-02, Q-05 |
| Seller in Maharashtra, recipient in Karnataka, dispatch in Gujarat, delivery to Karnataka third-party warehouse | Q-02, Q-05 |
| State seller supplies a Union Territory recipient and delivery ends in that UT | Q-02, Q-05 |
| Regular seller to Composition buyer | Q-01, Q-03 |
| Regular seller to an unregistered business with a valid business identity but no GSTIN | Q-01, Q-03, Q-11 |
| Consumer later requests a business invoice | Q-01, Q-03, Q-11 |
| Supply to SEZ, overseas party, deemed-export claimant, or UIN holder | Q-01; fail closed until separately approved |

### 5.2 Tax component and classification scenarios

| Scenario | Decision questions exposed |
|---|---|
| Same-State goods with one approved HSN and one ambiguous HSN | Q-04, Q-05, Q-06 |
| Mixed-rate invoice with one line at a future-dated rate | Q-04, Q-06, Q-07, Q-13 |
| UT delivery with unclear seller/recipient registration facts | Q-02, Q-03, Q-05 |
| Valid GSTIN shape but cancelled status before supply date | Q-03 |

### 5.3 Discount and pricing scenarios

| Scenario | Decision questions exposed |
|---|---|
| Line discount recorded on invoice before supply | Q-07 |
| Post-supply discount under a pre-existing agreement linked to invoices | Q-07, Q-08 |
| Post-supply discount conditional on dealer activity | Q-07 |
| Tax-inclusive price with mixed rates and fractional taxable values | Q-07 |
| Invoice-level discount creates a rounding residual | Q-07 |

### 5.4 Purchase reconciliation scenarios

| Scenario | Decision questions exposed |
|---|---|
| Declared and calculated totals match exactly | Q-08, Q-09 |
| Declared tax differs by a small amount within a proposed threshold | Q-08 |
| Missing HSN on one supplier line but aggregate tax is present | Q-04, Q-08, Q-09 |
| Accepted purchase receives a revised supplier invoice | Q-08, Q-12 |
| Posting request is retried after an uncertain timeout | Q-10, Q-12, Q-14 |

## 6. Dependency map

```text
Q-01 treatment scope
 ├─ Q-02 POS facts ─┬─ Q-03 GSTIN evidence
 │                  └─ Q-05 tax components
 ├─ Q-04 HSN/SAC ───┬─ Q-06 rates/versioning
 │                  └─ Q-07 taxable value/rounding
 └─ Q-09 purchase facts

Q-06 + Q-07 ── Q-08 purchase reconciliation ── Q-12 posting/correction
Q-02 + Q-06 + Q-07 ── Q-10 sales finalization/idempotency
Q-02 + Q-04 + Q-06 ── Q-11 historical compatibility
Q-04 + Q-06 + Q-10 + Q-11 ── Q-13 transaction-time snapshots

Q-08 + Q-10 + Q-12 ── Q-14 security/database acceptance
Q-14 + Q-11 ── Q-15 schema rollout authorization
Q-01..Q-15 ── Q-16 release gate authorization
```

## 7. Source register and limitations

| Source | Use | Verification/limitation |
|---|---|---|
| [CGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/7771?sam_handle=123456789/2489) | Supply, valuation, invoice, composition, ITC/correction framework | Official indexed text was accessible; reviewer must check consolidated amendments and effective dates before relying on a provision. |
| [IGST Act, India Code](https://www.indiacode.nic.in/handle/123456789/2159?sam_handle=123456789/1362) | Inter-/intra-State and POS framework | India Code handle was identified but direct retrieval returned 403; alternate official [CBIC Act PDF](https://cbic-gst.gov.in/htdocs-cbec/gst/igst-act.pdf) was located. Current consolidated text/effective amendments remain `NOT VERIFIED` by direct retrieval. |
| [CGST Rules, CBIC PDF](https://cbic-gst.gov.in/pdf/cgst-rules-30122017.pdf) | Invoice particulars and procedural rules | Accessible official PDF; dated copy and later amendments must be rechecked. |
| [CBIC Composition FAQ](https://cbic-gst.gov.in/pdf/faq-manual/faq-composition-levy-revised.pdf) | Composition orientation only | FAQ is guidance, not a substitute for current Act/Rules and professional advice. |
| [CBIC Circular 90/09/2019-GST](https://cbic-gst.gov.in/pdf/circular-cgst-90.pdf) | Invoice/POS clarification context | Circular is historical and amendment-sensitive; verify current applicability. |
| [Circular No. 209/3/2024-GST, dated 2024-06-26](https://gstcouncil.gov.in/sites/default/files/2024-09/circular-no-209-03-2024.pdf) | “Clarification on the provisions of clause (ca) of section 10(1) of the Integrated Goods and Services Tax Act, 2017 relating to place of supply of goods to unregistered persons” | Official GST Council PDF and title verified; supports Q-02 and the 2023-10-01 effective-date check. It does not resolve every POS scenario or approve Pharmnos policy. |
| [CBIC Circular 92/11/2019-GST, dated 2019-03-07](https://cbic-gst.gov.in/pdf/circular-cgst-92.pdf) | Promotion/discount context under section 15(3) | Official circular; current operation and later amendments must be rechecked. It does not decide internal accounting policy. |
| [CBIC Circular 112/31/2019-GST, dated 2019-10-03](https://cbic-gst.gov.in/pdf/circular-cgst-112.pdf) | Withdrawal status of Circular 105/24/2019-GST | Operative withdrawal notice; it withdrew Circular 105/24/2019-GST ab initio. Circular 105 is not operative guidance and is not used as authority here. |
| [Notification 78/2020-Central Tax, dated 2020-10-15](https://www.cbic.gov.in/resources//htdocs-cbec/gst/notfctn-78-central-tax-english-2020.pdf) | HSN/SAC invoice context | Official notification URL located, but direct PDF retrieval returned 500 in this review; current status/effective amendments are `NOT VERIFIED`. This is not the Notification 79/2020 PDF. |
| [Notification 1/2017-Central Tax (Rate), dated 2017-06-28](https://gstcouncil.gov.in/sites/default/files/gst%20rates/1-2017%28R%29%20dt.%2028.06.2017%20-%20Rate%20noti.pdf) | Original goods-rate schedule and entry framework | Official rate notification; current amendments, schedules, conditions, exemptions, and effective dates must be checked before any product rule is approved. It does not establish a universal HSN 3004 rate. |
| [Notification 1/2017-Integrated Tax (Rate), CBIC rate-notification index](https://cbic-gst.gov.in/htdocs-cbec/gst/int-tax-rate-notfns-2017) | Integrated-tax rate source for inter-State supplies | Official CBIC index URL was located, but the complete current entry/amendment chain for the Pharmnos product scope was not directly verified; applicable entry, conditions, and effective dates remain `NOT VERIFIED` and block rate approval. |

## 8. Current-release reconciliation note

The earlier final boundary in §12.4 is retained as historical chronology for
the 2026-10-31 question-pack review. The later owner instruction and decisions
`0003` through `0009` authorize the current T13/T19/T25 engineering scope and
record high-level policy direction. They do not close the professional,
statutory, implementation, target-bound runtime, independent-acceptance, or
production gates listed in this pack and in the
[current-release scope baseline](./t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md).
| [GST Council CGST rate notifications](https://gstcouncil.gov.in/en/cgst-rate-notification) | Central Tax (Rate) amendment discovery | Official index lists Notification 01/2025-Central Tax (Rate) as amending Notification 01/2017-Central Tax (Rate), but the complete pharmaceutical entry, conditions, amendment chain, and effective-date applicability were not established here; `NOT VERIFIED`. |
| [GST Council SGST rate notifications](https://gstcouncil.gov.in/en/sgst-rate-notifications) | State-wise SGST component source discovery | Official state-wise index located; no complete state-by-state notification and amendment matrix was verified for the supported scenarios; `NOT VERIFIED`. |
| [CBIC Union Territory Tax notifications](https://cbic-gst.gov.in/hindi/union-territory-tax.html) | UTGST component source discovery | Official UTGST notification index located, including historical notifications, but the applicable current entry and amendment chain for each supported UT scenario were not fully verified; `NOT VERIFIED`. |
| [GST portal](https://www.gst.gov.in/) | Possible registration/status evidence | No verification API, access, status semantics, or retained evidence capability is claimed for this repository. |
| [CBIC notifications index](https://www.cbic.gov.in/htdocs-cbec/gst/index) | Amendment discovery for Central/Integrated/State/UT rate sources | Index is a starting point; each applicable notification must be checked for entry, conditions, effective date, amendment, supersession, withdrawal, and applicability. No universal medicine-rate table is inferred. |
| [GST Council rate notifications](https://gstcouncil.gov.in/gst-rates) | Official rate-schedule discovery | Use only as a source index; the applicable notification and current amendment history must be retained with the approved rule. |
| [GST portal return/statement services](https://www.gst.gov.in/) | GSTR-2B and registration/status context | A GSTR-2B match is evidence for reconciliation, not automatic proof of ITC eligibility. Portal access, status semantics, and retained evidence remain unverified for this repository. |
| [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) | Technical control behavior only | Does not prove Pharmnos’ deployed policies, grants, roles, or tenant isolation. |

No source in this register approves Pharmnos’ product policy, engineering implementation, database migration, or production release. Where a source was not directly verified in the repository or current official text, the question remains source-research-incomplete rather than approved.

### 7.1 Legal-reference audit fields

| Reference | Issuing authority and date | Relevant provision/entry and effective date | Current status and decision supported |
|---|---|---|---|
| Central Goods and Services Tax Act, 2017 | Parliament of India; consolidated India Code text | Section 15 valuation/discounts; section 31 invoice/document framework; applicable dates depend on each provision/amendment | Operative Act subject to amendments; supports Q-01, Q-07, Q-08, Q-11, Q-13 but does not choose Pharmnos policy. |
| Integrated Goods and Services Tax Act, 2017 | Parliament of India; India Code handle and CBIC Act PDF | Sections 7–8; section 10(1)(a), 10(1)(b), and 10(1)(ca); amendment/effective-date history must be checked for the transaction date | Official source locations identified, but current consolidated text was not directly retrievable in this review; `NOT VERIFIED` for current status; supports Q-01, Q-02, Q-05, Q-09. |
| Central Goods and Services Tax Rules, 2017, rule 46 | Ministry of Finance/CBIC; official CBIC PDF dated 2017-12-30, amended thereafter | Invoice particulars including classification/POS fields as applicable; current effective requirements require amendment review | Operative rules subject to amendments; supports Q-04 and Q-11, but the retrieved dated PDF is not itself a current consolidated guarantee. |
| Notification No. 78/2020-Central Tax | Ministry of Finance/CBIC; 2020-10-15 | HSN/SAC invoice particulars; effective 2021-04-01 per the official guidance, subject to later amendments | Official notification; current applicability and amendments require revalidation; supports Q-04 only. |
| Notification No. 1/2017-Central Tax (Rate) | Ministry of Finance/CBIC; 2017-06-28 | Central-tax goods-rate schedules and entries; effective from the GST commencement framework, subject to amendments | Original rate notification, amended over time; supports rate-governance research in Q-06, not a universal HSN 3004 rate. |
| Notification No. 1/2017-Integrated Tax (Rate) | Ministry of Finance/CBIC; 2017-06-28 | Integrated-tax goods-rate schedules and entries; current entry/effective date must be checked against amendments | Official index located, but the complete current entry/amendment chain for the Pharmnos product scope was not verified; Q-05/Q-06 remain `NOT VERIFIED`. |
| Notification No. 01/2025-Central Tax (Rate) | Ministry of Finance/CBIC; 2025 | Amends Notification No. 01/2017-Central Tax (Rate) | Official GST Council index entry located; specific pharmaceutical impact, conditions, and effective-date applicability remain `NOT VERIFIED`. |
| State SGST rate notifications | Respective State governments; GST Council state-wise index | State-specific component schedules and amendments | Official state-wise index located, but no complete state-by-state current matrix was verified; Q-05/Q-06 remain `NOT VERIFIED`. |
| Union Territory Tax (Rate) notifications | Ministry of Finance/CBIC | UTGST component schedules and amendments | Official CBIC index located, but current scenario-specific applicability and amendment chain remain `NOT VERIFIED`; Q-05/Q-06 remain blocked. |
| Circular No. 92/11/2019-GST | CBIC; 2019-03-07 | Discount and sales-promotion clarification context | Official circular; current operation must be rechecked; supports issue identification in Q-07, not an approved formula. |
| Circular No. 90/09/2019-GST | CBIC; 2019-02-18 | Rule 46(n), inter-State invoice POS/state particulars | Official circular URL and subject were located; current status and any later amendment were not independently established in this review; supports Q-02/Q-04 only as contextual guidance. `NOT VERIFIED` for current status. |
| Circular No. 209/3/2024-GST | CBIC/GST Council; 2024-06-26 | “Clarification on the provisions of clause (ca) of section 10(1) ... relating to place of supply of goods to unregistered persons”; effective-date clarification stated as 2023-10-01 | Official PDF and title verified; supports Q-02 and the invoice-address/state evidence requirement. It does not establish a universal POS rule. |
| Revised FAQ on Composition Levy | CBIC; publication/revision date not established from the retrieved page | Composition-scheme orientation and procedure | Official guidance source, but exact revision date/current status and legal completeness were not established; supports Q-01 only as orientation. `NOT VERIFIED` as a current legal authority. |
| Circular No. 105/24/2019-GST | CBIC; 2019-06-28 | Secondary/post-supply discount guidance | Withdrawn ab initio by Circular No. 112/31/2019-GST; not operative and not used as authority. |
| Circular No. 112/31/2019-GST | CBIC; 2019-10-03 | Withdraws Circular No. 105/24/2019-GST ab initio | Operative withdrawal notice; supports the source-status correction in Q-07. |

The current Central, Integrated, and State/UT rate entries, conditions, amendments, supersession, withdrawal, and effective dates are not fully verified for the Pharmnos product catalogue. Q-06 therefore remains `BLOCKED — SOURCE RESEARCH INCOMPLETE` until a qualified reviewer approves the rule catalogue and source revision evidence.

## 8. Reviewer response template

Copy this block once for each question:

```text
Question ID:
Decision area:
Answer selected:
Permitted scope / blocked scope:
Rationale:
Statutory or authoritative source:
Provision / notification / circular and effective date:
Scenario(s) considered:
Required evidence:
Accounting consequence:
Product and engineering consequence:
Dependencies resolved:
Reviewer name and role:
Business owner:
Decision date (IST):
Follow-up owner and due date:
Status after review:
```

## 9. Consolidated unresolved-decision register

| ID | Priority | Topic | Status | Primary reviewer |
|---|---:|---|---|---|
| Q-01 | P0 | Treatment eligibility and directions | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded | GST reviewer + business owner |
| Q-02 | P0 | POS fact hierarchy | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded | GST reviewer |
| Q-03 | P0 | GSTIN/status verification | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; source limitations remain; full-scope owner authorization recorded | GST/accounting reviewer |
| Q-04 | P0 | HSN/SAC and exceptions | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; catalog engineering remains unverified | GST reviewer |
| Q-05 | P0 | State/UT tax components | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded | GST reviewer + accounting owner |
| Q-06 | P0 | Rate governance/versioning | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; source limitations remain; full-scope owner authorization recorded | GST reviewer + accounting owner |
| Q-07 | P0 | Value, discounts, pricing, rounding | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded | GST reviewer + accounting owner |
| Q-08 | P0 | Purchase reconciliation acceptance and ITC distinction | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded | Accounting owner + GST reviewer |
| Q-09 | P0 | Purchase input facts and ITC evidence | `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; full-scope owner authorization recorded | GST reviewer + accounting owner |
| Q-10 | P0 | Sales finalization/idempotency | `PASS — SCOPED` | Business + engineering owner |
| Q-11 | P0 | Historical facts/legacy print | AWAITING QUALIFIED GST/ACCOUNTING REVIEW; full-scope project-owner authorization recorded | GST/accounting reviewer |
| Q-12 | P0 | Purchase posting/correction | AWAITING ACCOUNTING/POLICY APPROVAL; engineering implementation is owner-authorized and evidence-gated | Accounting owner |
| Q-13 | P1 | Transaction-time snapshots and source evidence | ENGINEERING CONTRACT REVIEW AND QUALIFIED APPROVAL PENDING; full-scope project-owner authorization recorded | Accounting + engineering owner |
| Q-14 | P0 | Security and tenant evidence | `PASS — SCOPED` | Security/database reviewer + owner |
| Q-15 | P0 | Rollout authorization | `PASS — SCOPED` | Database/security + business owner |
| Q-16 | P0 | Release gate authorization | AWAITING RELEASE AUTHORIZATION; PRODUCTION AND GST RELEASE NOT AUTHORIZED | Authorized business owner + release owners |

## 10. Required traceability

### 10.1 BD-01 through BD-16

| Closure decision | Question coverage |
|---|---|
| BD-01 | Q-01 |
| BD-02 | Q-01, Q-03 |
| BD-03 | Q-01, Q-03, Q-11 |
| BD-04 | Q-01, Q-03, Q-11 |
| BD-05 | Q-02 |
| BD-06 | Q-03 |
| BD-07 | Q-04 |
| BD-08 | Q-06 |
| BD-09 | Q-05 |
| BD-10 | Q-07 (discount allocation/treatment only) |
| BD-11 | Q-07 (pricing mode only) |
| BD-12 | Q-07 (precision/rounding only) |
| BD-13 | Q-08 (separation and acceptance only) |
| BD-14 | Q-08, Q-09 (discrepancy, revision, and posting consequences) |
| BD-15 | Q-10 (sales finalization) |
| BD-16 | Q-11, Q-13 (historical policy and transaction-time evidence) |

### 10.2 DGM-OD-01 through DGM-OD-14

The existing owner decisions remain preserved and are not reopened. Mapping was audited against the active specification titles and meanings: `DGM-OD-01` treatment scope → Q-01; `DGM-OD-02` POS selection → Q-02; `DGM-OD-03` consumer/unregistered behavior → Q-01 and Q-03; `DGM-OD-04` HSN/SAC and rate governance → Q-04 and Q-06; `DGM-OD-05` discounts, inclusive pricing, and rounding → Q-07; `DGM-OD-06` purchase GST acceptance → Q-08; `DGM-OD-07` sales finalization idempotency → Q-10; `DGM-OD-08` calculation relation / `calculation_id` → Q-15; `DGM-OD-09` runtime access and tenant isolation → Q-14; `DGM-OD-10` database rollout/provisioning → Q-15; `DGM-OD-11` finalized history and legacy records → Q-11 and Q-13; `DGM-OD-12` posting, retries, and concurrency → Q-10 and Q-12; `DGM-OD-13` Composition treatment → Q-01; `DGM-OD-14` UTGST support → Q-05. Where a question covers only the implementation consequence, the source decision remains separately unresolved or blocked as stated in the source documents.

### 10.3 EC-01 through EC-14

| Engineering contract | Question coverage and release dependency |
|---|---|
| EC-01 Treatment and transaction eligibility | Q-01–Q-04 |
| EC-02 POS resolver | Q-02 |
| EC-03 GSTIN verification | Q-03 |
| EC-04 HSN/SAC and effective-dated rates | Q-04, Q-06 |
| EC-05 Tax calculation, discounts, pricing mode, and rounding | Q-07 |
| EC-06 Sales calculation and finalization | Q-10 |
| EC-07 Purchase line calculation and reconciliation | Q-09 |
| EC-08 Purchase accounting acceptance | Q-08 |
| EC-09 Idempotency, request hash, and retry | Q-10 |
| EC-10 Posting, atomicity, concurrency, and reconciliation | Q-12 |
| EC-11 Historical compatibility | Q-11, Q-13 |
| EC-12 Tenant/RLS/integrity | Q-14 |
| EC-13 Additive rollout | Q-15 |
| EC-14 Financial E2E authorization | Q-16 and the evidence gates in Q-14/Q-15 |

### 10.4 Complete traceability audit

The following matrix records the semantic audit, not merely the presence of an
identifier. `FULL COVERAGE` means the mapped question requests the source
decision; it does not mean the decision is approved. `PARTIAL COVERAGE` means
the question addresses an implementation consequence but does not resolve the
source decision itself. `NOT VERIFIED` is used where the required source or
runtime evidence has not been established.

#### BD-01 through BD-16

| ID and source decision | Question(s) | Audit result | Required downstream update | Closure evidence/status |
|---|---|---|---|---|
| BD-01 — treatments permitted in first release | Q-01 | FULL COVERAGE | Active treatment matrix and product scope record | Owner-agreed candidate direction plus qualified GST/accounting review; BLOCKED |
| BD-02 — Composition supplier/recipient rules | Q-01 | FULL COVERAGE | Treatment/document/ITC contract | Direction remains blocked; qualified review and owner evidence required |
| BD-03 — Unregistered recipient treatment/evidence | Q-01, Q-03, Q-11 | FULL COVERAGE | Eligibility, identity, POS, invoice, and legacy evidence rules | Qualified review and evidence matrix required; BLOCKED |
| BD-04 — Consumer treatment/evidence | Q-01, Q-03, Q-11 | FULL COVERAGE | Consumer workflow/document/evidence contract | Consumer remains blocked; qualified review and owner evidence required |
| BD-05 — POS facts and confirmation | Q-02 | FULL COVERAGE | POS rule/fact matrix and server-validation contract | Statutory scenario matrix, reviewer rationale, and finalization evidence; BLOCKED |
| BD-06 — GSTIN/registration validation | Q-03 | FULL COVERAGE | Verification-source and effective-date contract | Source, status semantics, evidence retention, and professional review; BLOCKED |
| BD-07 — HSN/SAC mandatory rules/exceptions | Q-04 | FULL COVERAGE | Classification and exception catalog policy | Current rule and product classification evidence; BLOCKED |
| BD-08 — rate selection/versioning | Q-06 | FULL COVERAGE | Effective-dated tax-rule catalog and source governance | Current amendment-reviewed notifications, source revision, and approval; BLOCKED |
| BD-09 — tax components | Q-05 | FULL COVERAGE | State/UT component matrix | Qualified review of POS, UTGST, and component notifications; BLOCKED |
| BD-10 — discount allocation/tax treatment | Q-07 | FULL COVERAGE | Discount and taxable-value contract | Signed GST/accounting formula and evidence policy; BLOCKED |
| BD-11 — inclusive/exclusive pricing | Q-07 | FULL COVERAGE | Pricing-mode and extraction contract | Approved formula, precision, and failure behavior; BLOCKED |
| BD-12 — precision/rounding | Q-07 | FULL COVERAGE | Calculation precision and rounding contract | Approved numeric representation, vectors, and reconciliation policy; BLOCKED |
| BD-13 — purchase value separation/acceptance | Q-08 | FULL COVERAGE | Acceptance roles, evidence, and immutable decision contract | Authorized acceptance matrix and audit evidence; BLOCKED |
| BD-14 — purchase discrepancies | Q-08, Q-12 | FULL COVERAGE | Reconciliation, correction, and posting state contract | Threshold, revision, correction, and posting evidence; BLOCKED |
| BD-15 — sales finalization gates | Q-10 | FULL COVERAGE | Finalization/idempotency/state contract | Owner approval plus isolated engineering evidence; PROPOSED/blocked |
| BD-16 — historical facts/legacy invoices | Q-11, Q-13 | FULL COVERAGE | Snapshot, print, legacy, and backfill policy | Owner/accounting/GST review and immutable snapshot evidence; PROPOSED/blocked |

#### DGM-OD-01 through DGM-OD-14

| ID and source decision | Question(s) | Audit result | Required downstream update | Closure evidence/status |
|---|---|---|---|---|
| DGM-OD-01 — first-release domestic treatments | Q-01 | FULL COVERAGE | Treatment behavior matrix | Source documents contain a scope conflict recorded in §10.5; owner direction preserved; BLOCKED |
| DGM-OD-02 — POS selection | Q-02 | FULL COVERAGE | POS resolver and confirmation contract | Statutory fact matrix and server validation evidence; BLOCKED |
| DGM-OD-03 — Consumer/unregistered behavior | Q-01, Q-03 | FULL COVERAGE | Separate category rules | Consumer and Unregistered remain blocked; qualified review required |
| DGM-OD-04 — HSN/SAC and rate governance | Q-04, Q-06 | FULL COVERAGE | Classification/rate catalog contract | Current sources, revisions, effective dates, and approval; BLOCKED |
| DGM-OD-05 — discounts/inclusive pricing/rounding | Q-07 | FULL COVERAGE | Calculation contract | Approved formula and deterministic evidence; BLOCKED |
| DGM-OD-06 — purchase GST acceptance | Q-08 | FULL COVERAGE | Acceptance and audit contract | Explicit authorized acceptance before posting; BLOCKED |
| DGM-OD-07 — sales finalization idempotency | Q-10 | FULL COVERAGE | Durable operation/hash/retry contract | Duplicate/conflict/uncertain-outcome evidence passed on the disposable target; `PASS — SCOPED` |
| DGM-OD-08 — GST-APP-03 Option B `calculation_id` | Q-15 | FULL COVERAGE | Schema relation and rollout contract | Explicit owner design direction exists; migration and database evidence absent; BLOCKED |
| DGM-OD-09 — runtime access/tenant isolation | Q-14 | FULL COVERAGE | Roles, grants, RLS, and integrity contract | Applied catalog and ordinary-role isolation evidence passed on the disposable target; `PASS — SCOPED` |
| DGM-OD-10 — additive database rollout | Q-15 | FULL COVERAGE | Migration/preflight/rollback contract | Disposable-target validation completed `PASS — SCOPED`; production rollout, partial-failure recovery proof, and migration authorization remain `BLOCKED` |
| DGM-OD-11 — finalized history/legacy records | Q-11, Q-13 | FULL COVERAGE | Snapshot and legacy compatibility contract | Immutable history and reprint evidence; BLOCKED |
| DGM-OD-12 — posting/retries/concurrency | Q-10, Q-12 | FULL COVERAGE | Atomic posting and concurrency contract | Isolated rollback/race/idempotency evidence passed on the disposable target; `PASS — SCOPED` |
| DGM-OD-13 — Composition treatment | Q-01 | FULL COVERAGE | Composition-specific treatment contract | Qualified statutory/accounting approval; BLOCKED |
| DGM-OD-14 — UTGST support | Q-05 | FULL COVERAGE | State/UT component contract | Qualified review of applicable UT rules and sources; BLOCKED |

#### EC-01 through EC-14

| ID and source contract | Question(s) | Audit result | Required downstream update | Closure evidence/status |
|---|---|---|---|---|
| EC-01 — treatment and transaction eligibility | Q-01, Q-03, Q-04 | FULL COVERAGE | Domain treatment/fact contract | Approved matrix and negative cases; BLOCKED BY BUSINESS DECISION |
| EC-02 — POS resolution/confirmation | Q-02 | FULL COVERAGE | POS resolver contract | Scenario and finalization tests; BLOCKED BY BUSINESS DECISION |
| EC-03 — GSTIN/counterparty identity | Q-03 | FULL COVERAGE | Verification contract | Approved source/status evidence; BLOCKED BY BUSINESS DECISION |
| EC-04 — HSN/SAC/effective-dated rates | Q-04, Q-06 | FULL COVERAGE | Classification/rate catalog contract | Current source and mixed-rate/stale-draft evidence; BLOCKED BY BUSINESS DECISION |
| EC-05 — calculation/discount/pricing/rounding | Q-07 | FULL COVERAGE | Authoritative calculation contract | Decimal/deterministic vectors and approval; BLOCKED BY BUSINESS DECISION |
| EC-06 — sales calculation/finalization | Q-10 | FULL COVERAGE | Atomic finalization contract | Rollback/concurrency/idempotency evidence; BLOCKED BY BUSINESS DECISION |
| EC-07 — purchase calculation/reconciliation | Q-09 | FULL COVERAGE | Purchase line calculation contract | Declared/calculated/reconciliation evidence; BLOCKED BY BUSINESS DECISION |
| EC-08 — purchase accounting acceptance | Q-08 | FULL COVERAGE | Acceptance authorization contract | Actor, timestamp, rationale, current-link, and audit evidence; BLOCKED BY BUSINESS DECISION |
| EC-09 — idempotency/hash/retry | Q-10 | FULL COVERAGE | Operation-key contract | Durable operation/hash/retry and isolated concurrency evidence passed on the disposable target; `PASS — SCOPED` |
| EC-10 — posting/atomicity/concurrency | Q-12 | FULL COVERAGE | Posting state/transaction contract | Atomic rollback and concurrency evidence passed on the disposable target; `PASS — SCOPED` |
| EC-11 — immutable snapshots/history | Q-11, Q-13 | FULL COVERAGE | Snapshot and legacy contract | Immutable/reprint evidence; PROPOSED — OWNER APPROVAL REQUIRED |
| EC-12 — Tenant/RLS/integrity | Q-14 | FULL COVERAGE | Security/database controls | Applied grants, forced RLS, trigger, and cross-tenant evidence passed on the disposable target; `PASS — SCOPED` |
| EC-13 — Additive rollout | Q-15 | FULL COVERAGE | Migration/preflight/rollback contract | Committed migration baseline, sanitized backup, applied validation, and rollback evidence passed on disposable targets; `PASS — SCOPED` |
| EC-14 — Financial E2E authorization | Q-14, Q-15, Q-16 | FULL COVERAGE | Harness authorization and evidence gate | Disposable identity/fixture/RLS/atomicity evidence; NOT VERIFIABLE |

### 10.5 Cross-document conflicts and disposition

The source documents contained one material scope inconsistency. It has been
corrected in the active specification without silently weakening any gate:

1. The active specification's former `DGM-OD-01` wording conflicted with its
   `DGM-OD-03` row, the decision-closure artifact (`BD-01` through `BD-04`),
   and the owner-selected direction. The exact owner direction is now
   consistent across the decision register, active specification, and closure
   artifact: all eight labels remain visible; only Regular is potentially
   enabled after its gates pass; Composition, Unregistered, and Consumer remain
   blocked; and Overseas, SEZ, Deemed Export, and UIN Holders remain excluded
   from operational calculation.
   **Disposition:** The active specification's DGM-OD-01 wording and the
   surrounding treatment paragraph were corrected. No statutory behavior,
   implementation authorization, or approval gate was weakened.

2. No file matching an engineering-readiness-assessment filename was present.
   The closest current engineering evidence is the GST schema rollout design
   review and the Financial E2E/security review set. Their statuses remain
   design-only, `NO-GO`, blocked, or not verifiable. **Disposition:** no
   readiness conclusion is inferred from a missing assessment file.

All other reviewed directions are consistent: the eight labels remain; POS
confirmation is evidence rather than legal authority; classification and rates
are separate; purchase acceptance precedes posting; ITC eligibility is
separate; Option B is a design direction only; and implementation remains
unauthorized.

### 10.4 Active specification sections

The pack covers the active specification’s treatment scope (§§3–3.2), POS (§4), classification and rates (§§5–7), lifecycle and historical printing (§§8–10), hybrid boundary (§11), implementation boundary (§12), readiness gates and matrices (§§14–16), blockers (§§27–30), and DGM-OD-01 through DGM-OD-14 (§30.3A).

## 11. Seven quality-control reviews

| Review | Result | Evidence/check performed |
|---|---|---|
| A — Coverage | **PASS** | Q-01–Q-16 map to every BD-01–BD-16 and EC-01–EC-14; DGM-OD-01–DGM-OD-14 are preserved and cross-referenced. |
| B — Legal accuracy | **PARTIAL** | POS sections 10(1)(a), 10(1)(b), and 10(1)(ca) were checked against the Act-source locations and Circular 209/3/2024-GST; section 15 discount principles, Notification 78/2020-Central Tax, and Circular 112/31/2019-GST were also checked against official sources. Circular 105 is not used as operative guidance. Current pharmaceutical rate amendments, State/UT entries, and current status of some contextual sources remain `NOT VERIFIED`. |
| C — Accounting completeness | **PASS** | Taxable value, discounts, pricing mode, precision, rounding, declared/calculated/accepted values, acceptance authority, posting, correction, and history are covered. |
| D — Scenario completeness | **PASS** | POS, treatment, components, discounts, pricing, mixed rates, classification, purchase reconciliation, retries, and legacy reprints have concrete scenario sheets. |
| E — Engineering traceability | **PASS** | Each material decision maps to product behavior, persisted evidence, validation, state transitions, security, rollout, and E2E gates. |
| F — Contradiction/ambiguity | **PASS WITH PROFESSIONAL DEPENDENCY** | Dropdown labels are separated from rules; owner direction is separated from statutory approval; blocked/excluded cases and dependencies are explicit; unresolved legal interpretation is not silently selected. |
| G — Reviewer usability | **PASS** | Executive briefing, glossary, priority, exact questions, neutral answers, consequences, roles, evidence template, source register, dependency map, and consolidated register are included. |

## 12. Verification-workstream classification

| Workstream | Classification | Evidence and remaining limitation |
|---|---|---|
| Legal-source verification | **PARTIAL** | Primary Act URLs and relevant sections were identified; current section 10(1)(ca) wording and Circular 105 withdrawal were verified through official sources, and the rate-notification indexes and 2025 Central Tax (Rate) amendment entry were located. Product-specific pharmaceutical, Integrated, State SGST, and UTGST rate applicability and complete amendment chains remain `NOT VERIFIED`; qualified review is required. |
| Full BD/DGM-OD/EC traceability | **VERIFIED** | All BD-01–BD-16, DGM-OD-01–DGM-OD-14, and EC-01–EC-14 have complete semantic audit rows with question, result, downstream update, and closure evidence. The corrected DGM-OD-01 wording now matches DGM-OD-03 and the closure artifact. |
| Cross-document consistency | **PARTIAL** | Owner direction, Q-01–Q-09 `PROFESSIONALLY REVIEWED — OWNER CONFIRMED` status, §16 treatment statuses, POS, rate governance, purchase controls, Option B, security boundaries, and authorization status are aligned. Rate-source completeness and production/runtime readiness remain unresolved; Q-10/Q-14/Q-15 disposable-target evidence is retained and scoped. |

### 12.2 Consolidated gate recommendation

| Gate group | Classification | Evidence boundary and next action |
|---|---|---|
| Q-01–Q-09 professional-review record | `CLOSED` as a review-status record | Owner confirmation is recorded without invented reviewer metadata. It does not authorize implementation or replace unresolved source/evidence gates. |
| Legal/source and rate governance | `PARTIALLY READY` | Rate indexes and selected legal sources are recorded; current pharmaceutical, Integrated, State/UT entries and amendment applicability remain `NOT VERIFIED`. Obtain qualified review. |
| HSN/rate catalogs | `BLOCKED` | Current scalar product HSN/rate fields do not satisfy the governed catalog requirement. Approve catalogs, permissions, audit history, effective dates, and fail-closed behavior before implementation. |
| Q-10 sales idempotency | `PASS — SCOPED` | The dated validation artifact records application-path replay, conflict, rollback, timeout/recovery, concurrency, and persisted-effect assertions on the disposable target. Broader financial and production behavior remains open. |
| Q-14 database isolation/security | `PASS — SCOPED` | Ordinary-login role/RLS/tenant negative tests and SEC-DEC-01/02 controls passed on the disposable target. Production security and SEC-DEC-03 readiness remain open. |
| Q-15 migration safety/recovery | `PASS — SCOPED` | The dated validation artifact records baseline, repeatability, conflict stop, backup, independent restore, and comparison results on disposable targets. Partial-failure recovery is `NOT VERIFIED` from retained output. Production rollout remains unauthorized. |
| Financial E2E and release | `NOT VERIFIED` | Q-10/Q-14/Q-15 isolated gates passed within scope; broader Financial E2E and release validation have not executed. |
| Implementation authorization | `BLOCKED` | No implementation authorization is present; request it only after all blocking gates close. |

**Consolidated recommendation:** `NOT READY — SPECIFIC GATES REMAIN OPEN.`
The next steps are qualified review of unresolved legal/source matters, then
separately authorized isolated engineering and migration validation. This pack
does not request or grant implementation authorization.

### 12.2.1 Validation authorization boundary

The defined Q-10, Q-14, and Q-15 isolated-validation scope was authorized and
subsequently executed on the verified disposable loopback target. The retained
evidence report records the target roles, tests, results, and limitations.
That authorization and evidence do not authorize bypassing separate
implementation, production migration, broader Financial E2E, cleanup,
destruction, or release gates. Live, shared, staging, and production databases
remain excluded.

### 12.2.2 Authorized-validation chronology

The earlier preflight-stopped event is historical and remains preserved: it
ended before database connection because the target was not running and its
identity, privileges, fixtures, backup/restore prerequisites, and executable
package were not established.

A subsequent 2026-10-31 (IST) validation event passed Q-10, Q-14, and Q-15 for
the disposable local PostgreSQL target, including the dedicated SEC-DEC-01/02
control run. The dated validation artifact is the evidence source. It does not
establish production/staging access, broader Financial E2E, or release
readiness.

### 12.2.3 Environment-provisioning package status

The validated disposable target was the local loopback/ephemeral
`financial-e2e-postgres` Compose service with separate bootstrap, runtime,
administrative, and validation roles. The evidence report establishes those
conditions for the retained run; it does not establish production/staging
equivalence or release readiness.

The isolated validation sequence is complete for the retained disposable run.
The subsequent sequence remains: review evidence and reassess gates; implement
the owner-authorized GST scope within the documented gates; then run broader
post-implementation Financial E2E and obtain separate release authorization.
Production remains separately governed and unapproved.

Before provisioning, the canonical owner decisions and prerequisite checklist
in [§7.8 of the GST decision closure artifact](./gst-decision-closure-and-engineering-contract-approval.md#78-owner-input-checklist-for-environment-provisioning)
must be reconciled. It does not authorize validation execution, implementation,
migration, pilot, or production use.

### 12.3 Owner-input closure checklist

The complete categorized checklist and practical owner response sheet are
maintained in [§7.8 of the GST decision closure artifact](./gst-decision-closure-and-engineering-contract-approval.md#78-owner-input-checklist-for-environment-provisioning).
It is the authoritative closure record for environment, security, data,
backup, cleanup, Q-10, Q-14, and Q-15 inputs, including recorded owner
decisions OD-01–OD-08. Owner-approved requirements remain distinct from technical verification. The
full-scope owner authorization does not bypass these prerequisites and does
not authorize production migration, production data modification, production
security approval, deployment, or release.
The security and synthetic-fixture decision brief, including unresolved source
limitations and scenario boundaries, is maintained in [the closure artifact](./gst-decision-closure-and-engineering-contract-approval.md#security-and-gst-fixture-owner-decision-brief).
The owner has approved SEC-DEC-01 (controlled bootstrap/maintenance trigger
exception only), SEC-DEC-02 (segregated soft-delete permissions and protected
history), SEC-DEC-03 (separate privileged-role boundaries), and the
synthetic-only fixture/source policy. The 13 FIX-01–FIX-13 scenarios remain
unchanged and are classified in the closure artifact as software-behavior,
illustrative non-statutory, or statutory/legal-source-dependent tests.
Engineering has now verified SEC-DEC-01 and SEC-DEC-02 in the disposable target;
SEC-DEC-03 remains a separate role-boundary contract and broader production
security remains unverified.
The canonical brief now contains the reviewable SEC-DEC-01 through SEC-DEC-03
engineering contracts and the frozen FIX-01–FIX-13 manifest, including
preconditions, negative assertions, evidence, cleanup, gate mapping, and source
status. This package remains design-only and does not authorize provisioning or
execution. The detailed manifest is canonical; any compact scenario matrix is
summary-only.

### 12.4 Remaining unresolved verification items

| Issue | Affected ID/question | Source/location | Why unresolved | Resolver and evidence required |
|---|---|---|---|---|
| Current pharmaceutical rate and HSN 3004 entry | BD-08/BD-09, Q-04/Q-06 | Notification 1/2017-Central Tax (Rate), Integrated/State/UT rate series | Amendment chain and current entry/conditions were not fully retrieved and verified | Qualified GST reviewer; current notification/entry, amendment chain, effective date, and product classification evidence |
| Current Integrated and State/UT component sources | BD-09, DGM-OD-14, Q-05/Q-06 | CBIC rate indexes and relevant State/UT notifications | No single verified source set establishes every State/UT scenario | Qualified GST reviewer; applicable notification, entry, conditions, and effective-date matrix |
| Current status of Circular 90 and Composition FAQ | BD-02/BD-05/BD-07, Q-01/Q-02/Q-04 | CBIC Circular 90/09/2019-GST; CBIC Composition FAQ | Current status/revision was not independently established | Qualified GST reviewer; current official copy and status check |
| GSTIN verification and GSTR-2B operational evidence | BD-06/BD-13/BD-14, Q-03/Q-08/Q-09 | GST portal and project source contracts | Portal capability, status semantics, retained evidence, and ITC decision process are not established | GST/accounting reviewer and owner; source/access policy, evidence sample, and ITC-control decision |
| Sales idempotency and concurrency evidence | DGM-OD-07/12, EC-09/10, Q-10 | Sales finalization action and purchase idempotency comparison | Sales source lacks durable operation/hash/result protocol; static inspection cannot prove runtime behavior | Engineering owner; approved contract plus isolated duplicate, conflict, timeout, retry, and concurrency evidence |
| Database/RLS/Financial E2E evidence | DGM-OD-09/10/12, EC-09/10/12/13/14, Q-14–Q-16 | Schema rollout review and Financial E2E artifacts | Design documents are not applied-state or runtime evidence | Engineering/security/database owners; authorized isolated catalog, RLS, atomicity, concurrency, rollback, and identity evidence |

## 12. Final boundary and status

This pack records the project owner's confirmation that Q-01 through Q-09
were reviewed and signed off by a qualified Indian GST professional, without
inventing reviewer metadata. That confirmation does not close BD-01 through
BD-16, approve DGM-OD-01 through DGM-OD-14 for implementation, approve
EC-01 through EC-14, authorize migrations, authorize database access,
authorize test/E2E execution, authorize a pilot, or authorize production.

**Final status: `OWNER DECISIONS RECORDED — ISOLATED Q-GATES PASS; GST WORK
REMAINS UNAUTHORIZED`**

The latest retained 2026-10-31 IST evidence supports Q-10, Q-14, and Q-15 as
`PASS` for the isolated local PostgreSQL target. Raw outputs are
`q10-application-final.txt`, `q14-ordinary-login-final.txt`,
`q10-q14-regression-final.txt`, and `q15-final.txt`; the detailed restore
comparison is `q15-1793447704646-restore-comparison.json` with raw command
output in `q15-1793447704646-raw-output.txt`. GST
implementation, provisioning, migration, pilot, and production activity remain
unauthorized.
