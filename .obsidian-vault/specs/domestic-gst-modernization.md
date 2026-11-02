---
title: Domestic GST Modernization
date: 2026-10-31
status: OWNER AUTHORIZED - ACTIVE GST MODERNIZATION MASTER; EVIDENCE-GATED
---
# Domestic GST Modernization

**Status:** `OWNER AUTHORIZED — ACTIVE GST MODERNIZATION MASTER; EVIDENCE-GATED`
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION
**Last revised:** 2026-10-31 06-20-35 (IST)
**Authority:** Owner, qualified GST/accounting, engineering, security, and
database approvals remain separate prerequisites.

> This document supersedes [gst-specification.md](./gst-specification.md) as
> the active requirements specification for the domestic GST billing
> modernization scope.
>
> Supersession does not erase historical decisions, evidence, test identifiers,
> unresolved questions, or supporting technical requirements. They remain
> traceable through the superseded document and the supporting specifications
> listed in [References](#references).
>
> This is a product and functional specification. It is not implementation
> authorization, migration authorization, testing authorization, pilot
> authorization, or production approval.

## 0. Document hierarchy and authority

This is the **master GST Modernization specification** and the primary entry
point for engineers, reviewers, and approvers. It governs overall GST scope,
architecture, approved feature boundaries, implementation phases,
dependencies, and current readiness.

Supporting documents remain separate and authoritative for their designated
subjects:

| Document | Responsibility |
|---|---|
| [GST Decision Closure and Engineering Contract Approval](./gst-decision-closure-and-engineering-contract-approval.md) | Owner decisions, engineering contracts, authorization boundaries, unresolved decisions, validation gates, and approval records |
| [GST Credit and Debit Note Engineering Contract](./gst-credit-debit-note-engineering-contract.md) | Detailed current-release supplier issuance, recipient processing, commercial adjustment, return, accounting, reporting, IRP, permission, state, scenario, and CDN-01-CDN-27 acceptance contract |
| [GST Accounting Decision Question Pack](./gst-accounting-decision-question-pack.md) | GST professional questions, statutory/accounting decisions, professional review records, and clarification evidence |
| [Purchase GST Persistence and Workflow Design](./purchase-gst-persistence-design.md) | Purchase-side GST persistence, relationships, workflow, and accounting acceptance design |
| [GST Schema Rollout Design Review](./gst-schema-rollout-design-review.md) | Schema, migration, rollout, compatibility, security, and database-integrity design review |

### 0.1 Precedence and conflict resolution

The master governs overall scope and architecture. Each supporting document
governs its designated detailed subject; a master summary must not silently
override a supporting contract. Owner decisions and authorization records are
authoritative in the decision-closure document, professional review records
in the accounting question pack, purchase persistence details in the purchase
design, and schema/rollout details in the schema review.

If documents conflict, record the exact documents, sections, and statements as
`UNRESOLVED` in the relevant decision or review record. Do not silently choose
a version or invent a resolution. The owner's explicit authorization permits
documented GST implementation and associated validation, but no document
independently authorizes deployment, migration execution, or production
operations beyond the applicable control gates.

### 0.2 Current status summary

- **Owner decisions:** recorded where explicitly marked in the decision-closure
  document; recorded direction is not statutory approval.
- **Professional review:** Q-01 through Q-09 are `PROFESSIONALLY REVIEWED —
  OWNER CONFIRMED` as documented in the decision-closure document and question
  pack; reviewer metadata remains unavailable.
- **Engineering validation:** Q-10, Q-14, and Q-15 are `PASS — SCOPED` for
  the disposable local PostgreSQL 17 validation target; this does not
  establish production readiness.
- **Owner authorization:** `OWNER AUTHORIZATION GRANTED` for the complete
  documented GST Modernization scope. **Owner:** Masum Rafique. **Decision
  authority:** explicit owner confirmation dated 2026-10-31 (IST). This
  authorizes the documented GST features, specifications, engineering
  workstreams, supporting implementation activities, and associated
  validation work. It does not replace professional/legal/accounting review,
  database rollout controls, independent security approval, or production
  go/no-go approval.
- **Credit/debit-note scope:** GST credit notes and debit notes are
  **current-release requirements** for both supplier issuance and
  recipient-side processing. This scope approval does not claim that the
  workflows, schema, reporting, e-invoicing, tests, runtime evidence,
  independent acceptance, or production authorization exist.

Supporting documents must be read whenever a task touches their designated
subject. This hierarchy changes document navigation and ownership only; it
does not change any decision, approval, evidence status, or authorization
boundary.

## 1. Objective and product boundary

Pharmnos Lite already has business/workspace profiles, supplier records,
customer records, a product catalogue, and billing workflows. This workstream
modernizes the existing billing section and reuses those records. It does not
create duplicate business, supplier, customer, or GST identity-management
modules.

The first implementation must allow a user to:

1. Select one combined GST Treatment value.
2. Provide transaction-specific domestic place-of-supply information.
3. Use validated seller, counterparty, product, and transaction facts.
4. Calculate applicable GST components automatically.
5. Support product lines with different applicable rates.
6. Produce invoice and print output with a correct tax breakdown.
7. Preserve finalized transaction-time facts and tax components.

Only ordinary supported domestic sales and purchases are included in the first
implementation. The specification does not claim statutory correctness until
the applicable legal/accounting questions are reviewed and the required
implementation and isolated validation evidence exists.

## 2. Status vocabulary and authority

| Status | Meaning |
|---|---|
| `EXISTING` | Directly observed in current source or retained project evidence. |
| `PROPOSED` | Target behavior for this workstream; not implementation authorization. |
| `UNRESOLVED` | Product, legal, accounting, or technical decision is incomplete. |
| `BLOCKED` | Work cannot proceed until a named prerequisite or evidence exists. |
| `DEFERRED` | Intentionally outside first implementation scope. |
| `LEGAL/ACCOUNTING-CONFIRMATION` | Requires qualified review or authoritative source confirmation. |

Existing source behavior must not be described as satisfying a proposed
requirement merely because a similarly named service or field exists.

## 3. Combined GST Treatment control

The user-facing product has **one combined GST Treatment dropdown**, not two
separate dropdowns. It must contain exactly these eight labels:

1. Registered Business – Regular
2. Registered Business – Composition
3. Unregistered Business
4. Consumer
5. Overseas
6. Special Economic Zone
7. Deemed Export
8. UIN Holders

The selected label is a user-facing classification input or hint. It must never
alone determine tax treatment, POS, rate, component, exemption, or statutory
eligibility.

Internally, the implementation must keep separate:

- counterparty registration status;
- composition status and whether it applies to the supplier or recipient;
- special transaction category;
- GSTIN and verification facts;
- seller, recipient, delivery, and legally determined POS facts;
- product tax classification and applicable rule version.

### 3.1 First-phase domestic treatment categories

The first phase represents and validates:

- **Registered Business – Regular:** registered counterparty facts may be
  captured and checked; ordinary domestic tax calculation remains dependent on
  validated transaction facts.
- **Registered Business – Composition:** composition supplier and composition
  recipient are distinct cases. Composition status must not be treated as
  permission to charge ordinary GST or as automatic ITC eligibility. Exact
  invoice, tax, and ITC restrictions require legal/accounting confirmation.
  The option remains visible, but calculation and finalization are blocked
  until the statutory behavior is approved.
- **Unregistered Business:** absence of registration must not be silently
  converted into a registered treatment; the applicable domestic rule and
  evidence requirements remain dependent on approved policy. Its workflow
  remains blocked until separate eligibility and accounting rules are approved.
- **Consumer:** consumer classification identifies the counterparty context,
  not the POS or tax components. Ordinary domestic calculation still requires
  validated transaction facts. Its workflow remains blocked until separate
  recipient rules are approved.

Composition behavior is `LEGAL/ACCOUNTING-CONFIRMATION` and must remain
blocked until applicable restrictions are approved and validated. The first
release direction keeps all eight labels visible, but only Registered Business
— Regular is potentially enabled after its validated transaction facts and
all applicable acceptance gates pass. Composition, Unregistered, and Consumer
remain blocked until their separate rules and acceptance evidence are approved.
Overseas, Special Economic Zone, Deemed Export, and UIN Holders remain
excluded from operational calculation and must fail closed. No category is
considered implemented merely because it appears in the dropdown.

### 3.2 Future categories

The following remain visible in product design but receive no unvalidated
operational calculation in phase one:

- **Overseas:** requires country, export/import direction, customs and
  zero-rating evidence where applicable, and a separate approved rule set.
- **Special Economic Zone:** requires SEZ status, supply direction, document
  and authorization evidence, and separate approved treatment.
- **Deemed Export:** requires the legally applicable transaction and
  documentation facts and separate approved treatment.
- **UIN Holders:** requires UIN identity, purpose, eligibility, and reporting
  evidence and separate approved treatment.

Selecting a future category in phase one must not fall through to ordinary
domestic tax. The workflow must remain visibly unsupported or blocked until its
requirements are approved.

## 4. Place-of-supply interface

### 4.1 Domestic dropdown

The domestic place-of-supply control is a searchable required dropdown with
the maintained state/UT code and display-label pairs below:

| Code | Display label |
|---|---|
| `AP` | Andhra Pradesh |
| `AR` | Arunachal Pradesh |
| `AS` | Assam |
| `BR` | Bihar |
| `CG` | Chhattisgarh |
| `GA` | Goa |
| `GJ` | Gujarat |
| `HR` | Haryana |
| `HP` | Himachal Pradesh |
| `JH` | Jharkhand |
| `KA` | Karnataka |
| `KL` | Kerala |
| `MP` | Madhya Pradesh |
| `MH` | Maharashtra |
| `MN` | Manipur |
| `ML` | Meghalaya |
| `MZ` | Mizoram |
| `NL` | Nagaland |
| `OD` | Odisha |
| `PB` | Punjab |
| `RJ` | Rajasthan |
| `SK` | Sikkim |
| `TN` | Tamil Nadu |
| `TG` | Telangana |
| `TR` | Tripura |
| `UP` | Uttar Pradesh |
| `UT` | Uttarakhand |
| `WB` | West Bengal |
| `AN` | Andaman and Nicobar Islands |
| `CH` | Chandigarh |
| `DD` | Dadra and Nagar Haveli and Daman and Diu |
| `DL` | Delhi |
| `JK` | Jammu and Kashmir |
| `LA` | Ladakh |
| `LD` | Lakshadweep |
| `PY` | Puducherry |

This is the current repository-maintained 28-state/8-UT list represented by
[`indian-states.ts`](../../src/lib/constants/indian-states.ts), which exposes
typed `INDIAN_STATES`, `INDIAN_UNION_TERRITORIES`, and combined
`INDIAN_REGIONS` collections. The alpha codes remain application lookup codes;
the separate GSTIN numeric-prefix mapping must not be treated as a POS or tax
decision. Before implementation, the list and codes require authoritative
maintenance review.

The control must:

- require a supported selection for domestic transactions;
- search by code and display label;
- reject unknown, ambiguous, or unsupported values;
- persist the selected code and display label snapshot with the transaction;
- retain the original submitted value where it is invalid or contradictory for
  review rather than silently normalizing it.

The selected POS is a transaction fact. Existing business, supplier, and
customer addresses provide context and validation input but are not assumed to
be the legally determined POS. Registered address, dispatch location, delivery
location, billing address, and legal POS may differ. The workflow must capture
the applicable delivery and supply facts required by the approved scenario and
may suggest a POS from those facts, but the user must confirm the selected POS
before calculation and finalization, with that confirmation retained as
transaction evidence. The server must validate the confirmed POS against the
submitted facts before calculation, recompute or revalidate it at
finalization, and reject an unsupported, changed, or inconsistent selection.
Client confirmation alone is not sufficient and must not be silently accepted.

### 4.2 International dropdown

Prepare a separate searchable worldwide country dropdown for the future
Overseas workflow. It must not be required for domestic phase-one transactions
and must appear operationally only when Overseas functionality is selected and
implemented under an approved workflow.

### 4.3 Conditional entity information

Future categories may require different information and validation:

| Category | Intended information examples | Phase-one status |
|---|---|---|
| Overseas | Country, export/import direction, customs and export evidence | `DEFERRED` |
| SEZ | SEZ status, authorization/document references, supply direction | `DEFERRED` |
| Deemed Export | Recipient eligibility, authorization and supporting documents | `DEFERRED` |
| UIN Holders | UIN, holder identity, purpose and reporting facts | `DEFERRED` |

A single generic text field is not sufficient as the final model for these
categories. Each requires category-specific fields and validation.

## 5. Domestic calculation contract

The server must calculate from validated transaction facts, including where
relevant:

- seller/business profile and transaction-time identity snapshot;
- supplier or customer record and transaction-time identity snapshot;
- GSTIN, registration status, and registration-state facts;
- actual transaction, dispatch, delivery, and supply facts;
- legally determined place of supply;
- product HSN/SAC and applicable GST rate;
- invoice date;
- approved rule version and source/effective-date revision;
- tax mode, quantity, price, discount, and taxable value.

The client may provide facts and a proposed treatment, but the server must
derive or validate POS, intra/inter-state classification, applicable
components, rates, totals, and posting eligibility.

### 5.1 GSTIN prefix mapping

GSTIN prefix mapping remains a supporting mechanism for:

- registration-state identification;
- consistency checking;
- validation and user feedback.

It must not independently determine complete tax treatment or POS.

The system must handle:

- **Missing GSTIN:** preserve absence; do not infer registration or tax
  treatment from an empty value.
- **Invalid GSTIN:** retain the submitted value as invalid evidence and block
  any workflow that requires a valid GSTIN.
- **GSTIN/state mismatch:** surface the contradiction and block or require
  reviewed resolution; do not silently prefer the prefix or address.
- **Missing POS facts:** fail closed before finalization/reconciliation.
- **Contradictory transaction facts:** fail closed and retain the conflicting
  inputs and reason.
- **Unsupported jurisdiction codes/prefixes:** preserve the raw value and
  block ordinary domestic classification.

The existing helper supports state/UT normalization and treats `97` and `99`
as unsupported for ordinary POS. Historical or uncertain mappings must not be
expanded without authoritative evidence. Prefix `96` has no established
ordinary meaning in the current repository and must remain unknown.

### 5.2 Components and classification

The calculation contract must account for:

- CGST;
- SGST;
- UTGST where legally applicable;
- IGST.

For ordinary domestic phase-one transactions:

- resolved same-state supply uses CGST plus SGST, subject to approved rules;
- resolved intra-UT supply may use CGST plus UTGST only after the UTGST
  contract is approved;
- resolved inter-state supply uses IGST, subject to approved rules;
- unresolved, contradictory, unsupported, or future-category facts block
  calculation and finalization.

The owner-selected UTGST direction does not by itself complete the
implementation contract. The project must define and approve its applicable
UT set, rate split, persistence, rounding, invoice presentation, and validation
before claiming implementation support. Until then, the current sales
CGST/SGST/IGST implementation must not be described as complete UTGST support.

Components are calculated automatically. Users must not manually split a total
GST percentage.

### 5.3 Precision, rounding, and aggregation

The detailed T25 engineering contract is recorded in
[`0009-gst-precision-rounding-engineering-contract.md`](../decisions/0009-gst-precision-rounding-engineering-contract.md)
and records T25-12 as current-release scope approved for supplier issuance and
recipient-side processing; implementation, test, runtime, independent
acceptance, and professional confirmation remain separate gates. The proposed calculation rule
defines:

1. taxable-value precision;
2. component-rate calculation precision;
3. line-level rounding;
4. invoice-level aggregation;
5. invoice-level round-off;
6. tax-inclusive extraction behavior;
7. persistence precision and display precision.

The shared calculator now uses exact coefficient/scale decimal arithmetic,
explicit `HALF_UP` representation, preserved intermediate precision, and
independently calculated tax components. The isolated Section 170
nearest-rupee helper is not automatically applied to intermediate calculations
or invoice totals. Engineering tests demonstrate these behaviors, but they do not constitute
qualified GST/accounting confirmation or production acceptance.
Purchase evidence must preserve original source representations separately from
parsed/calculated values as required by the purchase persistence design.

## 6. Product-level GST

Each invoice line must support:

- product selection from the existing catalogue;
- product-level HSN/SAC classification where applicable under the approved
  classification rules;
- quantity;
- unit price;
- discount where supported by the existing workflow;
- taxable value;
- applicable GST rate;
- CGST, SGST, UTGST, and IGST components as applicable;
- line tax amount;
- final line amount.

Different lines may carry different rates in one invoice. The implementation
must reuse the existing calculation service boundary rather than duplicate
GST arithmetic in UI code, SQL, or separate sales/purchase implementations.

HSN/SAC applicability and any classification exception must come from an
approved authoritative rule or product-classification policy. This
specification does not assume that every line has the same classification
requirement, and it does not invent an exemption for missing or ambiguous
data. If an applicable classification is missing, ambiguous, invalid, or
unsupported, calculation and finalization must remain blocked unless a
separately approved rule explicitly defines the exception and its evidence.

## 7. Tax-inclusive and tax-exclusive modes

### Tax-exclusive

The entered price is the taxable value before GST:

```text
taxable value = quantity × entered unit price − supported discount
GST component(s) = taxable value × applicable component rate(s)
line total = taxable value + GST component(s)
```

### Tax-inclusive

The entered price includes GST:

```text
taxable value = inclusive amount ÷ (1 + applicable GST rate)
GST = inclusive amount − taxable value
```

For multiple components, the approved split must be applied to the extracted
GST using the same rule version and precision policy as tax-exclusive mode.
The implementation must define whether extraction occurs per line or at
invoice level, then apply the approved rounding policy consistently.

Example at an approved 18% rate for an inclusive line amount of ₹1,180:

```text
taxable value = ₹1,180 ÷ 1.18 = ₹1,000
GST = ₹180
CGST = ₹90 and SGST = ₹90 for an approved same-state case
```

This example demonstrates the contract only; the applicable rate and
same-state classification must come from validated transaction facts.

Acceptance must cover both modes, decimal precision, discounts, mixed rates,
line aggregation, invoice totals, and round-off. No mode is accepted based on
display output alone.

## 8. Sales workflow

Sales treats the pharmacy/business as seller and the customer as recipient.
The workflow must:

1. Reuse the existing business profile, customer, product, and batch records.
2. Capture GST Treatment and transaction-specific POS/delivery facts.
3. Validate seller, customer, GSTIN, registration, and state facts.
4. Calculate output GST on the server.
5. Persist transaction-time seller/customer/POS/tax snapshots.
6. Display separate components in invoice and print output.
7. Preserve atomic invoice, stock, ledger, sequence, and audit behavior.
8. Reject duplicate or concurrent finalization without duplicate financial
   effects.

Current source evidence includes ordinary sales component calculation in
[`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts)
and transactional sales actions in
[`sales.actions.ts`](../../src/app/_actions/sales.actions.ts). This evidence
does not prove the proposed treatment control, UTGST, database immutability,
or runtime concurrency guarantees.

## 9. Purchase workflow

Purchases treat the supplier as seller and the pharmacy/business as recipient.
The workflow must:

1. Reuse existing supplier, business, product, and purchase records.
2. Capture supplier invoice information and transaction-specific supply facts.
3. Preserve supplier-declared values and raw representations separately.
4. Calculate expected values using the approved rule version.
5. Preserve accounting-accepted values separately where the approved workflow
   requires them.
6. Reconcile discrepancies without overwriting source evidence.
7. Require explicit authorized acceptance before finalization/posting when
   required by the approved purchase policy.
8. Preserve idempotency, concurrency, atomicity, audit, tenant isolation,
   inventory, supplier-ledger, and Financial E2E protections.

The current purchase reconciliation service preserves the declared/calculated/
accepted distinction, but current purchase calculation still derives aggregate
tax from existing totals and a caller-supplied scenario. That is existing
behavior and does not satisfy this proposed contract. The unresolved purchase
policy, accounting approval, persistence design, and rollout gates remain
binding dependencies.

## 10. Invoice creation and print presentation

Invoice creation and print output must show, where applicable:

- invoice number and date;
- seller identity and GSTIN;
- customer/supplier identity and GSTIN;
- place of supply;
- GST Treatment;
- product description;
- HSN/SAC;
- quantity and unit price;
- taxable value;
- applicable GST rate;
- CGST and SGST separately, or UTGST/IGST as applicable;
- total GST;
- grand total;
- tax-inclusive or tax-exclusive mode.

Finalized invoices must use persisted transaction-time facts and tax
components. Reprinting must not silently substitute mutable current master data
for finalized historical facts. Legacy records without complete snapshots may
use a clearly disclosed fallback only where the existing approved policy allows
it; current values must not be represented as historical truth.

## 11. Architecture and implementation constraints

The agreed hybrid boundary remains mandatory:

### Application services own

- user and transaction facts;
- treatment classification and validation;
- GST calculation and rule selection;
- evidence and fingerprint construction;
- reconciliation and acceptance workflow;
- idempotency, retries, and concurrency orchestration;
- atomic financial workflow coordination.

### Database protections own

- tenant isolation and fail-closed RLS;
- referential and structural integrity;
- tenant-aware relationships and uniqueness;
- immutable finalized history and append-only evidence;
- guarded financial state transitions;
- privilege and authorization boundaries that cannot be bypassed by direct
  client CRUD.

Do not:

- rebuild business, supplier, customer, or GST identity modules;
- duplicate GST calculation in UI and SQL;
- restore prefix-driven tax classification;
- invent historical tax facts or backfill guessed POS;
- weaken purchase reconciliation, idempotency, concurrency, atomicity,
  tenant-isolation, audit, or Financial E2E assets;
- delete existing tests or validation artifacts;
- execute migrations or database changes as part of this specification;
- claim production readiness without current evidence.

## 12. Scope boundary

### First implementation

- ordinary supported domestic sales and purchases;
- domestic intra-state transactions;
- domestic inter-state transactions;
- supported state and UT selection;
- the four domestic GST Treatment categories as the selected first-release
  product scope; Regular is not blanket-blocked and may proceed only when its
  applicable transaction-fact, classification, calculation, and acceptance
  gates pass. Composition, Unregistered, and Consumer remain blocked pending
  their separate approvals;
- automatic CGST/SGST/UTGST/IGST handling, subject to approved rules;
- product-level GST with mixed rates;
- tax-inclusive and tax-exclusive modes;
- invoice persistence and printing;
- sales and purchase regression validation;
- GST credit-note and debit-note requirements for supplier issuance and
  recipient-side processing, subject to the design and evidence gates in
  §12.1.

### Deferred

- Overseas exports/imports;
- SEZ;
- deemed exports;
- UIN holders;
- reverse charge;
- e-invoice and e-way bill;
- GSTR filing;
- ITC reconciliation;
- physical goods-return inventory workflow, replacement logistics, and
  unrelated internal adjustments;
- multiple GST registrations;
- other exceptional statutory workflows.

The eight-option dropdown is a product-design control, not evidence that
deferred categories are enabled.

Credit/debit notes are not deferred product scope. They are current-release
requirements whose implementation and acceptance remain blocked until the
statutory, accounting, schema, reporting, e-invoice, and isolated-runtime
gates in §12.1 close.

## 12.1 Credit and debit notes: legal, accounting, and engineering specification

### 12.1.1 Scope and status

GST credit notes and debit notes are approved current-release product scope
for both:

1. **supplier issuance** for an original sale or other outward supply; and
2. **recipient-side processing** for a note received against an inward
   purchase, including accounting treatment, tax/ITC evidence, reporting
   state, and immutable linkage to the original document.

This is a scope decision, not a claim that the workflow is implemented. At the
time of this specification:

- no dedicated statutory credit/debit-note model or end-to-end action is
  verified in the repository;
- no note allocation, recipient ITC-reversal, reporting, IRP/IRN, retry, or
  note-specific permission contract is verified;
- no isolated runtime acceptance evidence exists for supplier issuance or
  recipient processing;
- legal, accounting, and professional confirmation gates remain open where
  the source register below identifies them as unresolved.

The detailed implementation-ready contract is maintained in the [GST Credit
and Debit Note Engineering Contract](./gst-credit-debit-note-engineering-contract.md).
Its CDN-01-CDN-27 denominator is separate from the DGM-T25 matrix. It records
contract coverage only; implementation, runtime verification, independent
acceptance, and production authorization remain open.

Physical inventory return logistics, replacement shipments, buyer-initiated
commercial claims, and internal accounting corrections are separate concepts.
They must not be silently represented as a GST credit/debit note.

### 12.1.2 Legal baseline and effective-date gates

The implementation must be based on the current consolidated CGST Act, CGST
Rules, applicable notifications/circulars, and the current GST portal/IRP
contracts. The following provisions form the verified source baseline for the
contract; effective-date conflicts, professional application, portal
behavior, implementation, and acceptance remain separate gates:

| Source | Working requirement |
|---|---|
| CGST Act §2(37) | A **credit note** is the supplier's document for reducing the taxable value and/or tax charged in an original tax invoice, subject to the statutory conditions and reporting time limit. |
| CGST Act §2(38) | A **debit note** is the supplier's document for increasing the taxable value and/or tax charged in an original tax invoice; a supplementary invoice is treated within the same statutory concept where applicable. |
| CGST Act §15(3)(a) | A discount recorded before or at the time of supply and duly linked to the relevant invoices may be excluded from transaction value. |
| CGST Act §15(3)(b) | The applicable post-supply-discount rule is effective-dated. The current CBIC consolidated page and the Finance Act 2026 commencement notification are not synchronized; the product must select an approved ruleset for the note date and fail closed while the conflict is unresolved. A commercial discount alone is not a GST reduction. |
| CGST Act §16 | Recipient input-tax-credit eligibility, documentation, receipt, payment, return filing, and reversal/reclaim controls must be kept separate from supplier note issuance. The note workflow must not manufacture ITC eligibility. |
| CGST Act §34(1) | A supplier may issue one or more **credit notes** where the original taxable value or tax exceeds the amount payable, goods are returned, goods/services are deficient, or an applicable Section 15(3)(b) discount is given, subject to the statutory document and reporting rules. |
| CGST Act §34(3) | A supplier shall issue one or more **debit notes** where the original taxable value or tax is less than the taxable value or tax payable, subject to the statutory document and reporting rules. |
| CGST Act §34(2) and §34(4) | Credit-note reporting, recipient communication, tax adjustment, and the applicable cut-off must be enforced from the current law and portal contract, not from a stale hard-coded date. |
| CGST Rules Rule 53(1A) | A debit/credit note must carry the prescribed particulars, including supplier/recipient identity and GSTIN where applicable, a consecutive unique serial number, date, original invoice references, description/value/tax details, and signature/e-signature requirements. |
| CGST Rules Rule 59 | Credit/debit notes must be reported in the appropriate outward-supply return data with the required original-document references and classification. Reporting a commercial adjustment as a statutory note is prohibited. |
| Circular 251/08/2025-GST and Circular 253/10/2025-GST | Circular 251 distinguishes commercial/financial discounts from statutory tax reductions and separately contracted promotional services. Circular 253 withdrew Circular 212/06/2024-GST's prescribed evidence procedure; the substantive statutory conditions remain separate evidence gates. |
| Finance Act 2025 and Notification 16/2025-Central Tax | Notification 16/2025-Central Tax dated 2025-09-17 appoints 2025-10-01 for the specified Finance Act 2025 provisions, including the Section 34(2) amendment represented in the current Section 34 page. The Central Tax notification must not be confused with a Central Tax (Rate) notification. |
| Finance Act 2026 and Notification 03/2026-Central Tax | Notification 03/2026-Central Tax dated 2026-10-26 appoints 2026-11-01 for Sections 153-155. The current consolidated Section 15 page still carries a “yet to be notified” footnote, so the exact effective ruleset and portal synchronization remain a qualified review gate. |

The detailed source register, conflict resolution rule, and effective-dated
implementation contract are in the [GST Credit and Debit Note Engineering
Contract](./gst-credit-debit-note-engineering-contract.md) and the [GST
Accounting Decision Question Pack](./gst-accounting-decision-question-pack.md).
Until the applicable source version and evidence policy are approved, the
affected operation must fail closed rather than use an assumed date, assumed
evidence threshold, or assumed portal category.

### 12.1.3 Document taxonomy and classification rules

Every adjustment must be classified before it reaches accounting or tax
reporting:

| Class | Purpose | GST effect | Required handling |
|---|---|---|---|
| Statutory GST credit note | Supplier reduces value/tax for an eligible §34(1) reason | May reduce supplier output tax when statutory conditions and reporting/evidence gates pass | Dedicated note document, original-invoice allocation, tax-component snapshot, reporting state, and immutable audit |
| Statutory GST debit note | Supplier increases value/tax for an eligible §34(3) reason | Increases supplier output tax and recipient tax/ITC only through a valid document and eligible reporting | Dedicated note document, original-invoice allocation, positive tax components, reporting state, and immutable audit |
| Commercial credit/debit adjustment | Commercial settlement with no GST-value change | No GST tax reduction/increase by itself | Separate commercial document/ledger adjustment; must not appear as a GST note |
| Goods return | Physical movement of goods back to the supplier | May support a GST credit note, but the stock movement and note are separate events | Inventory return transaction plus statutory note only when the legal/document conditions are met |
| Buyer debit claim | Recipient's claim or dispute against a supplier | Not automatically a supplier GST debit note | Workflow for dispute/evidence; supplier-issued debit note is required for supplier tax increase |
| Internal accounting correction | Correction of an internal posting or mapping error | No retrospective alteration of a finalized statutory document | Append-only correcting journal with reason and approval; no GST note unless the legal trigger exists |

The UI, service layer, and persistence layer must preserve this distinction.
Selecting “credit note” or “debit note” must not be a generic shortcut for
changing a finalized invoice total.

### 12.1.4 Statutory grounds and conditions

The following matrix is the minimum reason model for the first release. A
reason is not sufficient by itself; the note must also pass document,
allocation, reporting, evidence, and authorization checks.

| Note | Statutory ground | Supplier-side condition | Recipient-side effect |
|---|---|---|---|
| Credit note | Original taxable value or tax charged exceeds the correct amount | Original invoice and affected line(s) identified; correction reason and calculation preserved | Reduce purchase value/ITC only for the accepted amount; retain supplier note and reversal evidence |
| Credit note | Goods returned | Return quantity, batch/serial where applicable, receipt/acceptance, and original allocation preserved | Reverse the corresponding purchase/stock effect and eligible ITC; do not infer a return from a note alone |
| Credit note | Goods or services deficient/defective | Deficiency/defect evidence, affected quantity/value, approval, and original allocation preserved | Reduce the affected purchase/service value and ITC; retain evidence |
| Credit note | Eligible post-supply discount | Agreement and invoice linkage satisfy §15(3)(b); recipient reversal/declaration or certificate evidence is collected as required | Reverse the relevant ITC and record evidence before accepting supplier tax reduction |
| Debit note | Original taxable value or tax charged is undercharged | Original invoice and affected line(s) identified; positive correction reason and calculation preserved | Increase purchase liability/value and claim additional ITC only when the note and §16 conditions are satisfied |
| Debit note | Supplementary value/tax for a completed supply | Evidence that the additional value/tax relates to the original supply and is not a new unrelated supply | Add the accepted amount to the original purchase allocation and retain the note as a separate document |

No reason may be used to bypass a missing original reference, a missing
recipient membership, an invalid tax component, an unresolved reporting state,
or a required evidence/approval gate.

### 12.1.5 Immutable note data contract

The note must be an additive, append-only document. Finalizing a note must
never rewrite the original invoice, original purchase, original line
quantities, original tax snapshot, or historical ledger entry.

The future note record must retain at least:

- tenant, issuer, recipient, and authenticated actor identifiers;
- note type (`CREDIT_NOTE` or `DEBIT_NOTE`) and statutory reason;
- a unique tenant-scoped note number, issue date, supply date/context, and
  currency;
- original document type, ID, number, date, and one-or-many allocation rows;
- allocated original line IDs, product/batch references where applicable,
  quantity, taxable value, discount basis, and reason evidence;
- per-allocation and aggregate CGST, SGST, UTGST, IGST, cess, taxable, and
  gross values, using the approved decimal/rounding contract;
- whether the adjustment is tax-exclusive or tax-inclusive and the exact
  calculation snapshot used;
- recipient ITC eligibility/reversal status and supporting evidence metadata;
- approval history, actor, timestamps, rejection reason, and immutable
  state transitions;
- reporting period, return section/category, submission attempt and response
  metadata, and reconciliation state;
- e-invoice applicability decision, IRP submission state, IRN, signed QR
  evidence, cancellation state, and failure reason where applicable;
- idempotency key and payload hash for every external submission or retry;
- created/issued/finalized timestamps and an append-only audit trail.

An allocation may not exceed the remaining eligible value or quantity of the
referenced original line. A note may reference multiple original invoices
only when the allocation table preserves each invoice/line split and the
reporting contract supports that shape. A note with an ambiguous or missing
allocation must be rejected.

### 12.1.6 Supplier issuance lifecycle

The supplier-side lifecycle must be explicit:

1. **Draft**: capture note type, statutory reason, original document(s), and
   proposed allocations; no tax or ledger effect is posted.
2. **Validate**: verify tenant access, original finalization, remaining
   unadjusted value/quantity, tax treatment, GSTIN/state facts, decimal
   arithmetic, number uniqueness, and required evidence.
3. **Approve**: require the configured authority for the note reason and
   record the approval decision without mutating the original document.
4. **Issue**: assign the immutable note number/date and freeze the accepted
   statutory snapshot.
5. **Report/submit**: submit to the applicable return or IRP pathway, with
   idempotent retries and explicit failure states.
6. **Post**: create the additive sales/receivable/output-tax ledger effect
   exactly once from the accepted note snapshot.
7. **Reconcile**: match portal/IRP responses and recipient acknowledgement or
   evidence, then retain all attempts and responses.

Failure at any required step must leave the note in an explicit recoverable
state. It must not present a success-shaped response or partially reduce the
original invoice.

### 12.1.7 Recipient-side processing lifecycle

The recipient-side lifecycle must be separate from supplier issuance:

1. **Receive** the supplier note and preserve the source number, date,
   original-document references, tax components, and supplied evidence.
2. **Match** the supplier, tenant, original purchase, GSTIN, tax period, and
   allocation against local records; reject cross-tenant or ambiguous matches.
3. **Classify** the note as statutory, commercial, return-related, buyer claim,
   or internal correction.
4. **Review** quantity/value/defect/discount evidence and record an explicit
   acceptance, partial acceptance, or rejection.
5. **Reverse or add ITC** only for the accepted statutory amount and only under
   the applicable §16/evidence rules. A supplier note must not silently
   delete the recipient's original ITC or inventory history.
6. **Post** an additive purchase/payable/inventory/tax adjustment from the
   accepted note snapshot.
7. **Reconcile** recipient return data, supplier communication, and portal
   data, retaining discrepancies for review.

The recipient must be able to process a supplier-issued note even when the
note is not yet locally accepted, without confusing receipt with acceptance or
ITC reversal.

### 12.1.8 Accounting and ledger contract

Illustrative postings below use an 18% rate only to explain mechanics; the
rate, state component, and statutory rounding must come from the approved
transaction facts and GST rule catalog.

| Event | Supplier-side illustrative effect | Recipient-side illustrative effect |
|---|---|---|
| Credit note for taxable value 100 and tax 18 | Debit sales returns/discount adjustment 100; debit output GST 18; credit receivable 118 | Debit supplier payable 118; credit purchase/inventory/expense 100; credit input GST 18 |
| Debit note for taxable value 100 and tax 18 | Credit sales/other taxable income 100; credit output GST 18; debit receivable 118 | Debit purchase/inventory/expense 100; debit input GST 18; credit supplier payable 118 |
| Commercial discount without §15(3)(b) GST conditions | Record commercial adjustment only; do not reduce output GST | Record commercial adjustment only; do not reverse or claim ITC solely from it |

The actual account mapping must be configured and professionally confirmed.
Ledger amounts, invoice totals, note totals, tax components, and audit
payloads must all derive from the same accepted decimal snapshot. A retry or
concurrent finalization must produce one financial effect and one immutable
note identity.

### 12.1.9 Reporting and e-invoice contract

The implementation must not treat a note as complete merely because it was
saved locally:

- determine whether the note is reportable, in which return period and
  category, and whether an amendment/correction path applies;
- preserve original invoice references in the format required by the return
  and portal contract;
- determine e-invoice applicability from current official thresholds,
  taxpayer type, transaction type, and effective dates;
- use the correct IRP document type and note-specific fields where applicable;
- persist IRN, signed response, QR evidence, submission request hash, response,
  retry count, and cancellation status;
- do not post a final statutory success when IRP/return submission is
  required but has failed or remains unresolved;
- support reconciliation of local note, return data, IRP data, and recipient
  evidence without rewriting the original note snapshot.

Exact note document types, portal categories, amendment rules, applicability
thresholds, and the current Section 34(2) timing must be confirmed from
authoritative current sources before implementation.

### 12.1.10 Worked examples

These are engineering examples, not tax advice. The 18% rate is illustrative.
The acceptance tests must use an approved rate catalog and explicit
rounding mode.

| ID | Fact pattern | Calculation and required outcome |
|---|---|---|
| `CN-01` | Invoice taxable value 1,000, tax 180; the correct value was 800 | Issue a credit note for taxable 200, tax 36, gross 236. Preserve the original invoice and allocate the reduction to the affected line(s). |
| `CN-02` | Ten units at taxable 100 each are returned and accepted | Credit note taxable 1,000, tax 180, gross 1,180; separately record receipt of ten returned units and link the accepted return evidence. |
| `CN-03` | A defective service line worth 500 is accepted at a 20% reduction | Credit note taxable 100, tax 18, gross 118; retain defect/deficiency evidence and the approval for the affected line. |
| `CN-04` | An invoice includes a post-supply discount of 100; agreement and invoice linkage exist; recipient ITC is 18 | Do not reduce tax until the required recipient reversal/declaration or certificate evidence is accepted. Then issue the eligible 100/18/118 credit note and retain the evidence. |
| `DN-01` | Invoice taxable value 1,000, tax 180; the correct value was 1,100 | Issue a debit note for taxable 100, tax 18, gross 118. The recipient may add eligible ITC only after valid receipt and §16 checks. |
| `DN-02` | Additional taxable value 250 was omitted from a completed supply | Issue a debit note for taxable 250, tax 45, gross 295, linked to the original supply; do not create an unrelated new sale. |
| `CN-05` | A 100 post-supply discount has no prior agreement or required linkage | Record a commercial adjustment only. Do not issue a GST-reducing credit note or reduce output tax/recipient ITC. |
| `ALLOC-01` | One note reduces two invoices by 60 and 40 taxable value | Store two allocations, 60/10.80 and 40/7.20 tax. The note total is 100/18/118, with both original references preserved. |
| `ITC-01` | Recipient received a 200 taxable/36 tax credit note | Match the note, reverse the accepted 36 ITC, and retain the reversal evidence. Do not reverse a disputed or rejected amount. |
| `RETURN-01` | Goods return is accepted but no note is issued yet | Post the controlled return movement only if inventory policy permits; keep tax/ledger adjustment pending and do not call the return a finalized GST credit note. |
| `IRP-01` | A note requires e-invoice submission and the IRP rejects it | Keep the note in an explicit submission-failed state, retain the response and idempotency key, and block statutory-final success until corrected and resubmitted. |
| `HISTORY-01` | A finalized original invoice is later corrected | Add a note and additive ledger/reporting events. The original invoice, tax snapshot, number, and audit history remain unchanged. |

### 12.1.11 Integrated supplier/recipient scenarios

The following scenarios define the minimum cross-surface acceptance set. Each
scenario requires database evidence, not only a UI assertion.

| ID | Supplier action | Recipient action | Required assertions |
|---|---|---|---|
| `CDN-E2E-01` | Issue an overcharge credit note | Receive, match, accept, and reverse accepted ITC | Original invoice immutable; note allocation exact; supplier output tax and recipient ITC effects are equal/opposite; one audit chain |
| `CDN-E2E-02` | Issue a goods-return credit note | Confirm return quantity and purchase/stock reversal | Return transaction and note are distinct but linked; no duplicate quantity or tax effect |
| `CDN-E2E-03` | Issue a deficiency/defect credit note | Accept only the affected line/quantity | Partial allocation works; unrelated lines remain unchanged; evidence is mandatory |
| `CDN-E2E-04` | Issue an eligible §15(3)(b) post-supply discount note | Submit required ITC reversal/declaration/certificate evidence | Supplier tax reduction is blocked until evidence; accepted amount and evidence are immutable |
| `CDN-E2E-05` | Issue a debit note for undercharged value | Match additional payable and eligible ITC | Positive delta only; original amount is not rewritten; recipient cannot claim before valid note acceptance |
| `CDN-E2E-06` | Issue a multi-invoice credit note | Allocate it across the matched purchases | Every allocation is explicit; total allocation equals note total; no cross-tenant or over-allocation |
| `CDN-E2E-07` | Submit a note to the applicable IRP/return path | Reconcile the supplier response | IRN/return state, payload hash, retry, and response are persisted; failed submission is not success |
| `CDN-E2E-08` | Retry the same note after a timeout | Process only the resulting accepted note | Idempotency prevents duplicate number, ledger, tax, or ITC effects |
| `CDN-E2E-09` | Partially accept a disputed note | Record accepted and rejected allocations | Accepted and rejected values remain separate; no rejected ITC reversal or supplier tax reduction |
| `CDN-E2E-10` | Issue a commercial discount without statutory conditions | Record the commercial adjustment | No GST note, output-tax reduction, or ITC reversal is created |
| `CDN-E2E-11` | Correct a finalized original through a note | Reconcile historical reports and print views | Original documents render from immutable snapshots; note appears as an additive linked event |
| `CDN-E2E-12` | Attempt a cross-tenant or foreign-supplier reference | Reject the receipt/issue request | Tenant isolation fails closed; no note, ledger, tax, or ITC mutation occurs |

### 12.1.12 Acceptance gates and non-claims

Credit/debit-note work may be marked accepted only when all applicable gates
pass:

1. current official Act, Rules, notification/circular, portal, and IRP
   requirements are verified and recorded;
2. accounting and qualified GST review confirms reason, value, tax, ITC,
   evidence, and reporting behavior;
3. schema, permissions, actions, audit, numbering, allocation, and migration
   design are reviewed without weakening tenant isolation or immutability;
4. unit and integration tests cover every statutory ground, rejection,
   rounding, allocation, evidence, retry, and concurrency case;
5. isolated database runtime tests verify supplier issuance and recipient
   processing using the restricted runtime role;
6. independent acceptance reconciles persisted note, invoice, ledger, tax,
   reporting, IRP, audit, and payload-hash evidence; and
7. production migration, recovery, rollout, and go/no-go authorization are
   separately approved.

Until then, the project must say **scope approved; implementation and
acceptance open**, not “credit/debit notes supported,” “GST compliant,” or
“ITC reversed.” No source, schema, database, or runtime evidence currently
closes these gates.

## 13. Acceptance and traceability matrix

| ID | Expected behavior | Relevant existing source/evidence | New or modified work required | Acceptance evidence | Status |
|---|---|---|---|---|---|
| `DGM-01` | One combined dropdown contains all eight labels | Existing GST documents; no complete current treatment control verified | Add one shared treatment control and internal normalized classification | UI contract and domestic/future-category selection tests | `PROPOSED` |
| `DGM-02` | Four domestic categories follow validated facts; composition supplier/recipient restrictions are distinct | Existing master records lack complete registration/status fields | Define classification model and obtain composition legal/accounting rules | Approved category matrix and workflow tests | `UNRESOLVED` / `LEGAL/ACCOUNTING-CONFIRMATION` |
| `DGM-03` | Domestic POS lists all 28 states and 8 UTs, searchable and required | [`indian-states.ts`](../../src/lib/constants/indian-states.ts) exposes explicitly classified 28-state, 8-UT, and combined collections | Verify authoritative list, build shared dropdown, persist code/label snapshot | 36-entry catalog and validation tests | `PROPOSED` |
| `DGM-04` | GSTIN prefix mapping supports validation only, never sole treatment/POS | [`indian-states.ts`](../../src/lib/constants/indian-states.ts) | Preserve raw prefix and mismatch/unsupported handling | Missing/invalid/mismatch/96/97/99 tests | `EXISTING` with proposed expansion |
| `DGM-05` | POS uses transaction-specific seller, recipient, delivery, and supply facts | Sales uses captured POS state; purchase scenario is caller-supplied | Add complete fact capture and server-side resolution for both workflows | Scenario matrix and fail-closed integration evidence | `PROPOSED` |
| `DGM-06` | CGST/SGST/UTGST/IGST components calculate automatically | [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts) supports CGST/SGST/IGST ordinary paths | Define and approve UTGST contract; unify purchase calculation | Component, rate, rounding, and persistence tests | `PARTIALLY EXISTING` / `UNRESOLVED` UTGST |
| `DGM-07` | Mixed product rates calculate independently per line | Existing sales line calculator accepts line GST rates | Confirm purchase line contract and shared service boundary | Mixed-rate invoice tests | `PROPOSED` |
| `DGM-08` | Tax-inclusive and tax-exclusive modes produce consistent taxable/tax totals | Existing service is primarily tax-exclusive | Add mode contract, extraction, precision, and rounding rules | Examples plus automated acceptance evidence | `PROPOSED` |
| `DGM-09` | Sales reuses business/customer/product records and persists output GST facts | [`sales.actions.ts`](../../src/app/_actions/sales.actions.ts), sales schema | Add treatment and complete transaction-fact snapshots; strengthen duplicate-finalization proof | Authorized sales E2E evidence | `PARTIALLY EXISTING` |
| `DGM-10` | Purchases preserve declared, calculated, accepted values and reconcile without overwrite | [`purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts), persistence design | Replace aggregate/caller-scenario calculation with approved fact-based contract | Purchase reconciliation and posting evidence | `PARTIALLY EXISTING` |
| `DGM-11` | Invoice/print output shows treatment, POS, components, totals, and mode | Sales print snapshot helper and current invoice path | Add required fields and finalized snapshot precedence | Print/reprint acceptance evidence | `PARTIALLY EXISTING` |
| `DGM-12` | Finalized invoices preserve transaction-time facts | Snapshot fields and print fallback exist in current source | Complete immutable history and database enforcement | Mutation/reprint and database immutability evidence | `PROPOSED` / `BLOCKED` |
| `DGM-13` | Missing, invalid, contradictory, or unsupported facts fail closed | `determinePlaceOfSupply()` and finalization guard | Extend to treatment, purchase, UTGST, and future categories | Negative-path and posting-block evidence | `PARTIALLY EXISTING` |
| `DGM-14` | Existing billing, inventory, accounting, tenant, and Financial E2E behavior is preserved | Protected purchase actions, transaction contracts, Financial E2E harness | Run authorized regression and isolated financial validation later | Regression, rollback, idempotency, concurrency, RLS, and atomicity evidence | `BLOCKED` |

Status in this matrix is not legal approval, implementation completion, or
production evidence. Product requirements must be separated from
legal/accounting confirmation and from runtime/database validation.

## 14. Required unresolved decisions and gates

Before implementation acceptance, the project must resolve or explicitly
accept the following:

- composition supplier versus composition recipient treatment;
- UTGST applicability, component split, persistence, and validation;
- authoritative state/UT catalog maintenance;
- GSTIN checksum and verification expectations;
- treatment and POS rules for each supported domestic scenario;
- tax-inclusive extraction and rounding policy;
- purchase line-level calculation and accepted-value precedence;
- mandatory transaction facts and legacy-draft handling;
- rule-version/effective-date/source-revision governance;
- finalized snapshot immutability and database enforcement;
- role separation, acceptance authority, and posting authority;
- sales idempotency and concurrent-finalization protection;
- schema rollout, RLS, grants, forced-RLS, and migration rollback;
- isolated Financial E2E fixtures, cleanup, and execution authorization.

Missing answers must block the affected workflow rather than be inferred.

## 15. References and traceability

The following sources were consulted for this specification:

- [Superseded GST specification](./gst-specification.md)
- [GST audit and validation plan](./gst-audit-validation-and-plan.md)
- [PGST-01 purchase GST workflow policy](./pgst-01-purchase-gst-workflow-policy.md)
- [PGST-01 decision traceability register](./pgst-01-decision-traceability-register.md)
- [Purchase GST persistence design](./purchase-gst-persistence-design.md)
- [GST schema rollout design review](./gst-schema-rollout-design-review.md)
- [Financial E2E validation harness](./financial-e2e-validation-harness.md)
- [Phase Tracker](../PHASE_TRACKER.md)
- [Canonical agent instructions](../CLAUDE.md)
- [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts)
- [`purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts)
- [`indian-states.ts`](../../src/lib/constants/indian-states.ts)
- [`purchases.schemas.ts`](../../src/lib/validation/purchases.schemas.ts)
- [`schema.prisma`](../../prisma/schema.prisma)

These sources were inspected from the repository. No external database,
Supabase project, migration, test runner, or application workflow was
executed. The older specification remains retained as historical evidence and
must continue to be consulted for stable identifiers and supporting
requirements not reprinted here.

## 16. GST Treatment behavior matrix

The matrix separates the selected label from the transaction facts that decide
whether a workflow is eligible. `BLOCKED` means the workflow must not calculate
ordinary domestic GST or post financial effects.

| Treatment | Direction / party | Registration and identity facts | Transaction facts | Calculation eligibility | Document / ITC-accounting consequence | Finalization/posting |
|---|---|---|---|---|---|---|
| Registered Business – Regular | Sale: customer recipient | Customer registration status, GSTIN if claimed, GSTIN shape/checksum status when approved, state and effective-date facts | Seller, recipient, dispatch, delivery, legal POS, product classification, rate revision | `PROPOSED` for supported domestic facts only | Invoice treatment and ITC consequences require approved accounting policy; no ITC claim is inferred by this specification | Eligible only after all facts and approved rules pass |
| Registered Business – Regular | Purchase: supplier seller | Supplier registration status, GSTIN if claimed, state and effective-date facts; pharmacy recipient facts | Supplier invoice, supplier dispatch, delivery, recipient state, legal POS, line classification, declared evidence | `PROPOSED` after PGST-01 and rate/POS approval | Supplier-declared, calculated, and accepted values remain distinct; ITC/accounting treatment requires qualified review | Block until reconciliation and authorized acceptance pass |
| Registered Business – Composition | Sale: customer recipient | Customer composition status and effective period must be independently evidenced; GSTIN facts where applicable | Domestic POS and product facts; exact composition-recipient rule | `BLOCKED` pending qualified statutory/accounting approval | Do not assume ordinary GST charging or recipient ITC treatment | `BLOCKED` until approved rule and document contract |
| Registered Business – Composition | Purchase: supplier seller | Supplier composition status and effective period must be independently evidenced | Supplier invoice/document facts, POS, line classification, declared evidence | `BLOCKED` pending qualified statutory/accounting approval | Do not assume supplier may charge ordinary GST or that ITC is available | `BLOCKED` until approved treatment and acceptance rules |
| Unregistered Business | Sale: customer recipient | Explicit unregistered status; no GSTIN may be silently substituted | Domestic POS, delivery and product facts | `BLOCKED` pending separate rule and evidence approval | Invoice wording and accounting treatment require approval; no ITC inference | Block until required identity/POS facts and acceptance pass |
| Unregistered Business | Purchase: supplier seller | Explicit unregistered status; supplier evidence may have no GSTIN | Supplier invoice/document, POS, product facts, declared evidence | `BLOCKED` pending separate purchase policy approval | Preserve missing registration as evidence; accepted accounting treatment requires review | Block until required evidence and acceptance pass |
| Consumer | Sale: customer recipient | Consumer context; GSTIN is normally absent but any supplied GSTIN must be validated rather than ignored | Domestic POS, delivery and product facts | `BLOCKED` pending separate rule and evidence approval | Consumer label does not determine POS, rate, or components | Block until approved domestic facts and acceptance pass |
| Consumer | Purchase: supplier seller | Not a normal supplier role; supplier identity and invoice facts are still required | Supplier invoice and domestic supply facts | `BLOCKED` unless an approved purchase scenario explicitly permits it | Do not reinterpret a supplier as consumer from a label | Reject unsupported combination |
| Overseas | Either direction | Country, direction, registration/customs evidence and category-specific identity facts | Export/import, customs, delivery and legal rule facts | `DEFERRED` | Separate document, zero-rating, reporting and accounting rules required | Block in phase one |
| Special Economic Zone | Either direction | SEZ status, authorization and entity facts | Supply direction, authorization/document and POS facts | `DEFERRED` | Separate statutory document and accounting treatment required | Block in phase one |
| Deemed Export | Either direction | Recipient eligibility and authorization facts | Deemed-export-specific evidence and transaction facts | `DEFERRED` | Separate document, reporting and accounting treatment required | Block in phase one |
| UIN Holders | Either direction | UIN, holder identity, purpose and eligibility facts | UIN-specific transaction and reporting facts | `DEFERRED` | Separate invoice/reporting and accounting treatment required | Block in phase one |

Any label/party-direction combination not explicitly supported above is
invalid. A selected label never overrides a contradictory GSTIN, state,
delivery, supplier-invoice, or registration fact. The user-facing UI must
explain the block and preserve the submitted evidence for review.

## 17. Domestic place-of-supply scenario matrix

The current catalog contains 36 entries: 28 states and 8 Union Territories.
The source catalog is the maintained repository list; authoritative legal
maintenance of names, historical codes, and UTGST applicability remains a
required approval. `INTRA-UT` is a classification outcome, not a current
implemented calculator mode.

| ID | Scenario | Seller location | Recipient location | Dispatch / delivery facts | POS and classification | Components | Evidence and blocking |
|---|---|---|---|---|---|---|---|
| `DGM-POS-01` | Same-state sale of goods | Business location/registration state at transaction time | Customer's transaction-time supply state | Dispatch and delivery recorded where relevant | Approved ordinary domestic rule; expected `INTRA` | CGST + SGST, subject to approved rule | Require captured POS and seller state; block on missing/contradictory facts |
| `DGM-POS-02` | Inter-state sale of goods | Business location/registration state | Customer's transaction-time supply state in another state/UT | Dispatch and delivery facts required for the selected scenario | Expected `INTER` only after legal rule resolution | IGST, subject to approved rule | Do not derive solely from GSTIN prefix; block unresolved legal scenario |
| `DGM-POS-03` | Same-UT sale | Seller UT location | Recipient/delivery UT location | Delivery and supply facts | Expected `INTRA-UT` where approved | CGST + UTGST only after UTGST approval | Currently blocked pending UTGST contract |
| `DGM-POS-04` | Same-state purchase | Supplier seller state | Pharmacy recipient state | Supplier dispatch and delivery state captured | Expected `INTRA` only after purchase rule approval | CGST + SGST, subject to approved rule | Preserve supplier-declared facts; block caller-only scenario |
| `DGM-POS-05` | Inter-state purchase | Supplier seller state | Pharmacy recipient state in another state/UT | Supplier dispatch, delivery, and invoice facts | Expected `INTER` only after purchase rule approval | IGST, subject to approved rule | Purchase calculation currently aggregate/caller-scenario based; implementation blocked |
| `DGM-POS-06` | Billing and delivery addresses differ | Seller location | Legally relevant recipient/supply location, not automatically billing address | Billing, dispatch, delivery, and reason for selected POS | Scenario-specific legal result | Components follow approved result | Require explicit transaction facts; never substitute billing state silently |
| `DGM-POS-07` | Bill-to/ship-to | Original seller and bill-to party | Ship-to/delivery party and legal recipient facts | Bill-to, ship-to, dispatch, delivery, relationship and document evidence | Scenario-specific legal result | Components follow approved result | `LEGAL/ACCOUNTING-CONFIRMATION`; block until modeled and approved |
| `DGM-POS-08` | Supplier dispatches from third location | Supplier's relevant seller location | Recipient/delivery location | Supplier dispatch location, warehouse/third-party evidence, delivery facts | Scenario-specific legal result | Components follow approved result | `LEGAL/ACCOUNTING-CONFIRMATION`; GSTIN prefix is insufficient |
| `DGM-POS-09` | Services | Not included in current product scope | Not included in current product scope | No service POS contract exists | Not supported | None | Reject or defer; no goods rule may be reused |
| `DGM-POS-10` | Missing/invalid/unsupported location | Any | Any | Missing, malformed, unsupported, or contradictory facts | `UNKNOWN` / `BLOCKED` | None | Preserve raw values and reason; no finalization or posting |

For every supported scenario, the implementation must persist the selected POS
code and display snapshot, the seller/recipient/dispatch/delivery facts used,
the rule version, and the calculation fingerprint. A master address or GSTIN
prefix may support validation but is not a substitute for transaction-time
evidence.

## 18. GSTIN, registration, HSN/SAC, and rate governance

### 18.1 GSTIN and registration contract

The current repository validates GSTIN shape for customer and supplier
records, but does not verify checksum or government status. The business
profile validation is not equivalent to strict GSTIN verification. The
implementation contract is:

- preserve the raw submitted GSTIN exactly as evidence, alongside a normalized
  display form if approved;
- validate the 15-character shape before treating a value as structurally
  valid;
- add checksum validation only after the checksum algorithm and failure
  handling are approved;
- represent registration status separately from GSTIN text;
- represent effective-from/effective-to dates when registration status is used
  for a transaction;
- derive registration-state candidates from the prefix only as supporting
  evidence;
- compare GSTIN-derived state with transaction/address state and block or
  route to review on mismatch;
- preserve unknown, unsupported, `96`, `97`, and `99` prefixes without
  normalization or invented treatment;
- never infer registration status from a prefix alone.

Required approval: qualified GST/accounting owner must approve the checksum
source, registration verification source, effective-date semantics, and
whether an unverifiable GSTIN can be used in each domestic category.

### 18.2 HSN/SAC and rate contract

The product model currently has `hsn_code`; invoice lines snapshot HSN in the
sales model, while purchase lines currently store line rate but do not provide
the complete proposed component snapshot. The following is required:

| Requirement | Current evidence | Target contract | Status |
|---|---|---|---|
| HSN/SAC value | Product `hsn_code`; sales snapshot | Preserve product value and transaction-time snapshot; validate format per approved catalog | Existing but insufficient |
| Goods/services classification | No complete verified GST classification contract | Store a distinct approved classification; services remain out of phase one | Proposed / services deferred |
| Applicable rate | Product/invoice line `gst_rate` exists | Resolve from an approved catalog and transaction date, not a guessed default | Existing but insufficient |
| Exempt/nil/non-GST | No approved complete catalog or rule source | Add only after legal/accounting approval and explicit component/reporting behavior | Blocked |
| Effective dates | Rule-version concept exists in purchase design | Store rule version, effective date, and source revision used at calculation | Proposed |
| Source governance | No approved rate catalog owner/source found | Name the authoritative source, maintainer, reviewer, change log, and effective-date process | Blocked |
| Rate change after draft | Current drafts can contain calculated values | Recalculate or explicitly invalidate stale drafts under approved policy; never silently retain stale rate | Proposed |
| Finalized rate | Sales line stores rate | Persist immutable transaction-time rate and source revision | Proposed / database enforcement blocked |

No pharmacy product may be assigned a rate merely because it is a pharmacy
product. Before implementation, the owner and qualified GST reviewer must
approve the authoritative rate catalog/source, classification fields, rate
maintenance authority, effective-date rules, exempt/nil/non-GST treatment, and
the stale-draft policy.

The HSN catalog acceptance contract additionally requires:

- preloaded/common HSN entries and legally approved HSN-to-rate mappings may
  exist in the governed database catalogs;
- HSN data is database-backed and is not a fixed application-source constant;
- authorized users may add previously unavailable HSN codes and maintain,
  update, activate, or deactivate entries through the application without a
  source-code change or deployment;
- HSN maintenance and GST-rate approval use separate permissions and audit
  trails;
- a new HSN may remain pending classification or rate verification, and its
  creation does not approve a classification or rate;
- rate mappings are effective-dated and reference authoritative notification
  and source revisions;
- missing, ambiguous, expired, or unapproved classification/rate blocks
  calculation and finalization; and
- finalized transactions preserve the exact HSN, classification/rate
  versions, source reference, and transaction-time snapshots. Historical
  transactions never recalculate from current catalog data.

## 19. Tax calculation and precision contract

The following is the required calculation order. Numeric examples are
illustrative only; the precision and statutory rounding policy remain blocked
until approved.

1. Validate tenant, actor, treatment, transaction direction, dates, source
   revisions, product classification, and required seller/recipient/supply
   facts.
2. Resolve tax mode and normalize quantity, unit price, and supported discount
   inputs without losing source representations.
3. Calculate gross line value as quantity multiplied by unit price.
4. Apply only approved discounts in the approved order. The current sales
   source applies percentage discount to line gross before GST; purchase
   discount behavior must be explicitly approved.
5. For tax-exclusive mode, the discounted value is the taxable base.
6. For tax-inclusive mode, extract taxable value and total GST using the
   approved rate and precision policy; do not use a rounded display value as
   the authoritative base.
7. Resolve applicable components from the approved POS classification:
   CGST/SGST, CGST/UTGST, or IGST. Exempt, nil-rated, and non-GST lines use
   only approved classification behavior.
8. Calculate each line independently using the line's own rate and
   classification.
9. Apply the approved component-allocation and rounding policy.
10. Aggregate persisted line taxable values and component amounts into invoice
    totals.
11. Apply approved invoice-level round-off once, preserving signed round-off
    separately from tax.
12. Reconcile displayed values to persisted values using the same canonical
    decimal representation and reject mismatches at finalization.

### 19.1 Precision decisions

The following are explicit blockers rather than guessed policy:

- **Representation/storage:** purchase design proposes raw source strings plus
  parsed `Decimal(20,4)` values; existing sales/purchase monetary fields use
  narrower Prisma decimals. The final precision/scale must be approved and
  applied consistently.
- **Intermediate arithmetic:** authoritative calculation must use a decimal
  strategy; JavaScript floating-point values must not be the financial source
  of truth.
- **Discount order:** current sales behavior is percentage discount before GST;
  purchase line and fixed-discount semantics require approval.
- **Inclusive extraction:** choose per-line or invoice-level extraction for
  mixed rates; per-line is the safer proposed contract but is not approved.
- **Rounding:** choose component, line-total, invoice-total, and round-off
  order from an authoritative accounting/GST policy.
- **Display:** display precision must not change persisted precision.

Required approval: accounting/GST owner and qualified GST reviewer must provide
the precision, rounding, inclusive extraction, discount, and adjustment policy.
Until then, ordinary current sales arithmetic is `EXISTING` behavior only and
cannot be promoted to the complete modernization contract.

## 20. Sales lifecycle and state contract

The current verified sales invoice state enum is `DRAFT`, `FINALIZED`, and
`CANCELLED`. There is no separate persisted `VALIDATED` or `POSTED` state.
The modernization must preserve this public state model unless a separately
approved design changes it.

| Transition | Actor/validation | Database and financial effects | Idempotency/concurrency/failure |
|---|---|---|---|
| New → `DRAFT` | `create_invoice`; valid customer/lines, domestic facts, current source calculation | Existing sales invoice and line rows inside a transaction; no stock/ledger posting | Repeated create requests are not proven idempotent; failure rolls back the transaction |
| `DRAFT` → `CANCELLED` | `cancel_invoice`; only draft | Status, cancellation actor/time | Repeated cancellation rejected; no financial posting |
| `DRAFT` → `FINALIZED` | `finalize_invoice`; reload and validate POS, totals, snapshots, stock, and permissions | Existing transactional stock, ledger, sequence, invoice, snapshots, and audit writes | Existing action rejects finalized/non-draft and stock races; durable sales idempotency and concurrent duplicate proof are `BLOCKED` |
| `FINALIZED` → any other state | No current implemented transition; note scope is approved separately in §12.1 | No direct rewrite | Reject until the additive note workflow is implemented and accepted; never overwrite original evidence |
| `CANCELLED` → any other state | No current approved transition | None | Reject |

Preview is non-authoritative. The server recalculates at draft save and
finalization. A mismatch, missing fact, invalid classification, missing stock,
or unavailable snapshot is an explicit error and leaves the transaction
unposted. A retry may repeat a safe draft operation; finalization retry
semantics require a durable idempotency design and isolated evidence.

## 21. Purchase lifecycle and state contract

The purchase invoice uses the same persisted invoice states, with additional
GST projection/reconciliation statuses and posting-operation records. PGST-01
and the persistence design remain governing policy/design inputs; they are not
silently replaced by this document.

| Transition | Required evidence and actor | Effects | Retry/concurrency/failure |
|---|---|---|---|
| New → `DRAFT` | `create_purchase`; supplier, lines, and valid draft fields; GST evidence may be incomplete | Purchase and lines are created transactionally; evidence/calculation/event rows are created only when the submitted evidence is complete enough for the current source path | Draft save may remain incomplete; transaction rollback on failure |
| `DRAFT` → GST evidence/calculation projection | Active tenant membership for capture; current source and rule revision | Proposed immutable evidence/calculation/event rows and current pointers | Revision/version conflict must fail; no source overwrite |
| `DRAFT` → `MATCHED` | Complete declared/calculated values compare under approved policy | Reconciliation status and event | No automatic acceptance; discrepancy remains review-required |
| `DRAFT` → `RESOLVED` | Authorized discrepancy resolution with rationale and accepted values | Resolution event, new accepted decision path, version/pointers | Stale revision or incomplete accepted values reject |
| `DRAFT` → accounting `ACCEPTED` | `accept_purchase_gst`; active membership, required permission, current evidence/calculation, and permitted source | Immutable accounting decision plus projection/status/event | Version conflict rejects; exact segregation-of-duties permission model remains pending engineering definition and verification |
| `DRAFT` → `FINALIZED` | `finalize_purchase`; supplier, lines, evidence, calculation, reconciled state, accepted decision, duplicate check | Existing combined finalization/posting transaction for stock, supplier ledger, payable/sequence, invoice, and audit effects | Tenant idempotency key and payload hash; duplicate key with changed payload rejects; concurrent version claim rejects; rollback is transactional |
| `DRAFT` → `CANCELLED` | `cancel_purchase`; only draft | Cancellation status/actor/time | Repeated or post-finalization cancellation rejects |
| `FINALIZED`/`CANCELLED` → other state | No approved transition | None | Reject; correction/reversal/notes require separate approved workflow |

Current source confirms purchase idempotency and optimistic version checks in
`finalizePurchaseAction`, but database immutability, applied constraints,
ordinary-role RLS, and runtime concurrency evidence remain unverified.

## 22. Requirements-level persistence and service contracts

No new schema is authorized here. The following is a contract inventory
against existing source and approved designs.

| Contract element | Current location/evidence | Required status |
|---|---|---|
| Business, supplier, customer, product masters | Existing Prisma models and master actions | Existing and reused |
| Invoice state | `InvoiceStatus` in `prisma/schema.prisma` | Existing; preserve `DRAFT/FINALIZED/CANCELLED` |
| GST Treatment | No verified persisted field/control | Proposed addition; representation and migration require approval |
| POS code | `sales_invoices.place_of_supply_code`; purchase supply facts in proposed GST evidence design | Existing but insufficient; persist code, label snapshot, fact provenance |
| Seller/recipient/dispatch/delivery facts | Existing masters plus partial sales/purchase fields | Existing but insufficient; transaction-time fact contract required |
| GSTIN/status/effective dates | Master GSTIN text exists; status/checksum/effective-date fields absent | Existing but insufficient / proposed additions |
| HSN/SAC | Product `hsn_code`, sales line snapshot | Existing but insufficient for governed classification/rate history |
| Rate and rate source | Line `gst_rate`, no approved rate catalog/source contract | Existing but insufficient / blocked governance |
| Taxable and components | Sales line taxable/CGST/SGST/IGST/cess; purchase aggregate and proposed evidence fields | Partially existing; UTGST and complete purchase line persistence unresolved |
| Calculation/rule version | Purchase calculation `rule_version`; no complete sales provenance | Existing but insufficient |
| Supplier-declared values | Purchase evidence types, current action/design | Partially existing; immutable applied persistence unverified |
| Calculated values | Purchase calculation design/source | Partially existing; current calculation is aggregate/caller-scenario based |
| Accepted values | Purchase decision models/actions/design | Partially existing; authority and database immutability unverified |
| Idempotency evidence | `purchase_posting_operations` and request hash | Existing for purchase source path; sales equivalent missing |
| Audit references | Sales/purchase audit event writes | Existing source behavior; applied retention/immutability unverified |
| Finalized snapshots | Sales invoice/item snapshot fields and print logic | Partially existing; legacy fallback and DB immutability remain |
| Tenant-aware relations | GST composite keys proposed in Prisma; ordinary relations remain mixed | Partially existing; applied RLS/FKs unverified |

### 22.1 Service input/output contract

The shared calculation boundary must accept validated seller/recipient
registration facts, transaction supply facts, date/rule revision, line
classification, price/quantity/discount, and tax mode. It must return a
canonical result containing resolved classification, POS, per-line taxable
values, rate snapshots, component amounts, invoice totals, round-off,
provenance/fingerprint, and blocking diagnostics where unresolved.

Purchase reconciliation must accept immutable declared evidence and a
versioned calculated result, then return per-field `MATCHED`, `MISSING`,
`DIFFERENT`, or `INVALID` results. It must never mutate declared evidence.
Acceptance must return an immutable decision bound to the evidence and
calculation revision. Posting must consume only the accepted values permitted
by the approved accounting policy.

Validation errors must distinguish: missing required fact, invalid format,
unsupported category, contradictory facts, stale revision, duplicate
idempotency key, unauthorized actor, unresolved reconciliation, invalid
classification/rate, insufficient stock, and database/concurrency conflict.

## 23. UI, invoice, and historical behavior

- Show one GST Treatment dropdown with the eight exact labels.
- Show the searchable domestic POS dropdown for domestic workflows.
- Show future country/entity fields only when their approved workflow exists;
  otherwise visibly disable and explain the category block.
- Show product-level rate, taxable value, components, and mode in preview.
- Never ask users to manually split total GST.
- Mark preview values as recalculated and non-authoritative until the server
  accepts the draft.
- Require explicit finalization confirmation that summarizes treatment, POS,
  tax mode, total GST, and blocking warnings.
- Display validation errors next to the relevant field and preserve invalid
  source evidence where policy permits.
- Print seller, recipient, supplier/customer, POS, treatment, HSN/SAC, rate,
  taxable value, components, total GST, grand total, and mode from persisted
  finalized facts.
- Reprint complete finalized sales snapshots without reading mutable masters.
- For legacy incomplete records, disclose each fallback and never present
  current master data as verified historical fact.

## 24. Backward compatibility policy

| Existing record | Read/display behavior | New finalization behavior |
|---|---|---|
| Draft missing POS | Remains readable/editable under legacy behavior | Must capture and validate approved POS facts before new GST finalization |
| Finalized aggregate-only sales invoice | Remains operational; print may use disclosed fallback | Must not be silently rewritten or backfilled |
| Purchase without line GST evidence | Existing aggregate totals remain readable | New strict workflow blocks posting until approved evidence/acceptance rules pass |
| Missing GSTIN | Preserve missing status | Block only where the approved treatment/scenario requires registration evidence; never infer |
| Missing HSN/SAC | Preserve missing status | Block where product classification is mandatory; do not invent code |
| Old rate or stale draft | Preserve historical stored value | Reopened draft must follow approved stale-rate policy; no silent recalculation |
| Finalized invoice reprint | Use snapshots when complete; disclose fallback otherwise | No mutable-master substitution for complete finalized data |
| Pre-activation purchase draft | Per PGST-01, do not silently convert | Hold for explicit classification or retain legacy handling; no bypass |

No migration-free compatibility behavior may fabricate POS, rate, GSTIN,
classification, or component values.

## 25. Security, integrity, and failure contract

| Control | Required behavior | Current evidence/status |
|---|---|---|
| Tenant isolation | Every read/write is tenant-scoped; database RLS is fail-closed and independently verified | App context and SQL helper exist; applied RLS/forced RLS/runtime isolation unverified |
| Authorization | Permission checks at action boundaries; acceptance and posting authority separated where approved | Source checks exist; full role/segregation matrix unresolved |
| Direct client CRUD | No direct anonymous or unrestricted authenticated mutation of financial history | Existing SQL grant model is not approved; restricted runtime role decision blocked |
| Referential integrity | Tenant-aware FKs and unique keys prevent cross-tenant/cross-invoice references | Prisma design contains GST composites; applied schema unverified and ordinary relations remain mixed |
| Finalized immutability | Database and service prevent changing finalized identity, tax, stock, ledger, and evidence meaning | Review-only SQL/design; executable enforcement unverified |
| Idempotency | Same request/key returns the same safe result; changed payload under same key rejects | Purchase source path has this design; sales missing; runtime unverified |
| Concurrency | Conditional version claim/locking prevents duplicate financial effects | Purchase source has optimistic/locking logic; sales race proof absent |
| Atomicity | Invoice, stock, ledger, sequence, audit, and applicable evidence changes commit or roll back together | Prisma transaction boundaries observed; database/runtime proof blocked |
| Audit | Capture actor, source, revision, decision, finalization, and failure context without overwriting evidence | Source/design partial; retention and append-only enforcement unresolved |
| Retry/recovery | Retry only with stable idempotency identity; uncertain partial results stop and require reconciliation | Purchase behavior partially present; full recovery policy and sales behavior unresolved |

Unverified controls must remain `BLOCKED` for production claims. The protected
Financial E2E harness is the required future evidence path and must not be
modified or weakened.

## 26. Deterministic acceptance test specification

These are requirements for future authorized tests. No test is claimed to have
run in this documentation task. Where the rule is unresolved, the test is
explicitly blocked rather than given an invented expected tax result.

| Test ID | Workflow/treatment | Input facts and expected result | Persisted/state assertions | Status |
|---|---|---|---|---|
| `DGM-T01` | UI/all | One dropdown exposes exactly eight labels; no second treatment dropdown | Selection is stored as a classification fact, not a component decision | Proposed |
| `DGM-T02` | Sales/Regular domestic same-state | Valid seller/recipient state, POS, GSTIN facts, one approved product/rate, exclusive price | CGST/SGST line and invoice totals; `DRAFT` then `FINALIZED` only after all checks | Blocked pending rate/rounding approval |
| `DGM-T03` | Sales/Regular inter-state | Valid differing states and delivery facts | IGST only under approved rule; snapshots persist | Blocked pending POS/rate approval |
| `DGM-T04` | Sales/Consumer | No GSTIN, valid domestic POS and product/rate facts | Missing GSTIN is preserved; no registration inferred | Blocked pending consumer policy |
| `DGM-T05` | Sales/composition recipient | Composition facts and domestic transaction | Must not calculate ordinary GST without approved composition rule | Blocked legal/accounting |
| `DGM-T06` | Purchase/Regular same-state | Supplier evidence, recipient state, dispatch/delivery, line facts | Declared/calculated/accepted remain distinct; CGST/SGST only after approved rule | Blocked PGST-01/rate approval |
| `DGM-T07` | Purchase/Regular inter-state | Supplier and recipient differ, complete evidence | IGST expected only after approved purchase POS rule | Blocked PGST-01/legal |
| `DGM-T08` | Intra-UT | Supported UT facts and approved UTGST policy | CGST/UTGST persistence and invoice display | Blocked UTGST policy |
| `DGM-T09` | Mixed rates | Two lines with distinct approved rates | Each line has independent taxable/components; invoice aggregates persisted lines | Blocked rate catalog |
| `DGM-T10` | Exclusive mode | Quantity, price, discount, approved rate | Exact-decimal taxable base and independent components; no premature intermediate rounding | Engineering implementation and focused tests passed; owner/professional acceptance pending |
| `DGM-T11` | Inclusive mode | Inclusive amount, approved rate, same POS | Purchase workflow remains blocked; isolated Rule 35 extraction helper preserves declared amount and components | Workflow blocked by policy; helper tests are not operational acceptance |
| `DGM-T12` | Negative/missing POS | Missing, invalid, contradictory, same-UT, or unsupported code | Calculation/finalization blocked; raw fact and reason retained | Demonstrated POS cases pass; `96/97/99` were tested only as unsupported GSTIN prefixes, not POS inputs |
| `DGM-T13` | GSTIN validation | Supplied GSTIN has exactly 15 characters; optional blank remains valid | Current release does not perform checksum, state-prefix, registration-status, or effective-date verification; no prefix-only classification | `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`; implementation and focused tests passed; runtime and independent acceptance remain separate |
| `DGM-T14` | Product classification | Missing/conflicting HSN/SAC/rate or exempt/nil/non-GST classification | Block until approved classification/rate evidence exists | Blocked rate catalog |
| `DGM-T15` | Sales finalization retry | Same draft submitted twice/concurrently | No duplicate stock/ledger/sequence/audit effects; stable idempotent outcome | Blocked sales idempotency design |
| `DGM-T16` | Purchase finalization retry | Same idempotency key and unchanged payload | Same safe result; changed payload rejected | Existing source contract; runtime blocked |
| `DGM-T17` | Purchase reconciliation | Declared/calculated equal, missing, invalid, and differing fields | Correct reconciliation state; source evidence unchanged | Existing pure contract; runtime blocked |
| `DGM-T18` | Unauthorized acceptance | Actor lacks acceptance permission or active membership | Acceptance rejected; no decision/status mutation | Existing source contract; DB proof blocked |
| `DGM-T19` | Stale purchase revision | Evidence correction and posting after current evidence/calculation changes | Correction resets acceptance/decision and increments the GST record version; finalization requires current accepted evidence, calculation, decision, and line snapshots | `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`; current posting safeguards remain; advanced stale acceptance-revision guard is not implemented |
| `DGM-T20` | Atomic rollback | Inject stock/ledger/sequence failure during sales/purchase finalization | No partial invoice, stock, ledger, sequence, or audit effects | Financial E2E blocked |
| `DGM-T21` | Tenant isolation | Tenant A attempts read/write of tenant B facts | Zero rows or denied write under ordinary non-BYPASSRLS role | RLS/database execution blocked |
| `DGM-T22` | Historical reprint | Mutate current master after complete finalization | Print remains snapshot-identical; legacy fallback is disclosed | Runtime/database blocked |
| `DGM-T23` | Unsupported future category | Select Overseas/SEZ/Deemed Export/UIN | Visible unsupported block; no ordinary domestic calculation/posting | Proposed negative contract |
| `DGM-T24` | Legacy purchase draft | Pre-activation/incomplete evidence | Remains editable/held; no silent conversion or posting bypass | PGST-01 policy gate |

Preserve existing identifiers such as `GST-001`–`GST-020`, `D-GST-01`–`D-GST-52`,
`PUR-POS-*`, `SAL-POS-*`, and Financial E2E scenario identifiers. New `DGM-T*`
IDs supplement rather than replace them.

### 26.1 Current-release scope and engineering evidence

The owner-approved current-release GSTIN decision is limited to exact
15-character validation when a GSTIN is supplied. Checksum, state-prefix,
registration-status, and effective-date checks are explicitly deferred to
Version 2. The implementation and focused tests are present; runtime and
independent acceptance remain separate statuses. Unsupported prefixes such as
`96`, `97`, and `99` do not drive POS resolution.

The owner-approved current-release scope defers the advanced stale purchase GST
acceptance-revision guard to Version 2. The dependency inspection found that
evidence correction clears the current accounting decision, resets acceptance
to `NOT_ACCEPTED`, increments `gst_record_version`, and causes finalization to
require current evidence, calculation, acceptance, and accepted line
snapshots. Those current-release posting safeguards remain required and are
not weakened by the deferral. The advanced guard is not implemented or
independently accepted.

### 26.2 Version 2 deferred-scope register

The following items are approved current-release deferrals, not current-release
implementation failures:

- **DGM-T13:** retain exactly 15-character GSTIN validation in the current
  release; defer checksum, state-prefix, registration-status, and effective-date
  verification to Version 2.
- **DGM-T19:** retain current purchase evidence, acceptance, authorization,
  revision, and finalization safeguards; defer advanced stale acceptance-
  revision protection to Version 2.

The shared exact-decimal implementation and focused arithmetic tests are
recorded in
[`0009-gst-precision-rounding-engineering-contract.md`](../decisions/0009-gst-precision-rounding-engineering-contract.md).
The engineering contract is implemented for the demonstrated calculator paths,
but DGM-T25 is not independently accepted until the detailed owner decision and
qualified professional confirmation are recorded.

## 27. Decision and blocker register

| ID | Question | Existing decision/evidence | Required owner/approval | Status and implementation consequence |
|---|---|---|---|---|
| `DGM-B01` | Which composition supplier/recipient rules apply? | PGST-01 and old specification defer composition statutory behavior | Product owner, Accounting/GST, qualified GST professional | `BLOCKED`; affected combinations cannot post |
| `DGM-B02` | Which UTs and rate rules use UTGST? | Current code has no UTGST contract | Accounting/GST and qualified GST professional | `BLOCKED`; intra-UT calculation unavailable |
| `DGM-B03` | What is the authoritative HSN/SAC/rate source and maintainer? | No approved catalog/source found in inspected repository | Product owner, Accounting/GST, qualified GST professional | `BLOCKED`; no guessed rate or classification |
| `DGM-B04` | What checksum/verification/effective-date rules apply to GSTIN? | Shape validation exists; checksum/government verification absent | Accounting/GST and qualified GST professional | `BLOCKED` for workflows requiring verified status |
| `DGM-B05` | Which legal POS rules cover bill-to/ship-to, third dispatch, and delivery mismatch? | Existing source handles narrow state comparison only | Qualified GST professional and Accounting/GST | `BLOCKED`; no prefix/billing fallback |
| `DGM-B06` | What precision, rounding, discount, and inclusive extraction policy applies? | Existing sales two-decimal behavior; purchase design preserves legacy behavior; no complete approved policy | Accounting/GST and qualified GST professional | `BLOCKED`; current arithmetic remains legacy behavior only |
| `DGM-B07` | What domestic treatment field and transaction snapshot representation is approved? | No verified persisted treatment field | Product owner, Engineering, database owner | `BLOCKED`; no migration design may be inferred |
| `DGM-B08` | What is the final acceptance/posting authority and segregation-of-duties matrix? | PGST-01 records separation direction but formal policy is pending | Product owner, Accounting/GST, Security/Architecture | `BLOCKED`; unauthorized acceptance/posting must fail |
| `DGM-B09` | What database role, grants, forced-RLS, immutable triggers, and migration baseline apply? | Rollout review is design-only; live baseline is not durable | Security/Architecture, database owner, Engineering | `BLOCKED`; source SQL is not applied-state proof |
| `DGM-B10` | How are sales duplicate finalization and recovery handled? | Purchase has idempotency design; sales has transaction but no equivalent durable operation record | Engineering, Security/Architecture | `BLOCKED`; no production claim |
| `DGM-B11` | How are legacy drafts activated or classified? | PGST-01 prohibits silent conversion and pilot expansion | Product owner, Accounting/GST, Engineering | `BLOCKED`; drafts remain legacy/held |
| `DGM-B12` | Which corrections, cancellations, reversals, notes, and returns are in scope? | GST credit/debit notes are current-release requirements for supplier issuance and recipient processing; physical-return logistics and unrelated reversals remain separately gated | Product owner, Accounting/finance, and qualified GST reviewer | `SCOPE APPROVED; IMPLEMENTATION/PROFESSIONAL/RUNTIME GATES OPEN`; no new transition may be invented |

## 28. Dependency-ordered implementation sequence

1. **Specification and approval gate:** approve this domestic scope, record
   decisions `DGM-B01`–`DGM-B12`, complete PGST-01 formal review, and retain
   superseded identifiers. No code or schema work before this gate.
2. **Legal/accounting contract gate:** approve composition, UTGST, POS
   scenarios, HSN/SAC/rate source, GSTIN verification, precision, rounding,
   inclusive mode, and purchase accepted-value policy.
3. **Data and service contract gate:** define treatment/POS/snapshot/rule
   representations against the existing modules; validate Prisma feasibility
   and compatibility without applying migrations.
4. **Shared calculation/validation gate:** implement one provider-independent
   decimal calculation boundary and shared validation/error contracts. Add
   unit and contract tests without changing deferred workflows.
5. **Sales workflow gate:** implement approved treatment/POS capture,
   server-side calculation, snapshot persistence, durable sales idempotency,
   and preserve stock/ledger/sequence/audit atomicity.
6. **Purchase workflow gate:** implement only the approved PGST-01 path;
   preserve declared/calculated/accepted values, revision binding, duplicate
   checks, idempotency, concurrency, and combined finalization/posting.
7. **Persistence/security gate:** obtain migration authorization, produce
   additive catalog-guarded rollout, verify tenant-aware constraints, grants,
   forced RLS, immutable history, and guarded transitions in an isolated target.
8. **Invoice/UI gate:** implement shared dropdowns, line displays, modes,
   preview diagnostics, finalization confirmation, snapshot-first printing,
   and explicit legacy fallback disclosure.
9. **Validation gate:** run authorized calculator, workflow, regression,
   rollback, idempotency, concurrency, historical reprint, and protected
   Financial E2E/RLS tests. No live or production connection is implied.
10. **Pilot/release gate:** separately authorize controlled pilot, monitoring,
    rollback, expansion, and production readiness. Product-owner approval
    alone does not waive any technical, accounting, security, or database gate.

Workstreams must follow this order; no later implementation or rollout phase
may proceed while an earlier legal, policy, schema, security, or runtime gate
is blocked.

## 29. Final consistency and evidence review

- The active scope is domestic billing; future dropdown categories are
  visible but operationally blocked.
- The current source supports ordinary sales state comparison and component
  calculation, not the complete domestic contract.
- Purchase source behavior includes reconciliation structures and posting
  safeguards, but its calculation, applied schema, database controls, and
  runtime validation are incomplete.
- `DRAFT/FINALIZED/CANCELLED` is the current verified invoice state model;
  GST reconciliation and posting-operation states are separate purchase
  controls, not replacement invoice states.
- Existing Prisma models and SQL assets are repository evidence only; they do
  not prove applied database state.
- No section authorizes implementation, migration, testing, pilot, production,
  or statutory filing.
- Every unresolved legal/accounting or technical item is listed in the blocker
  register and has a blocking consequence.

This specification is implementation-ready only for requirements that receive
the approvals and evidence identified above. It is intentionally not a claim
that the entire GST workflow is approved, implemented, legally validated, or
production-ready.

## 30. Final decision-gap audit

**Audit date:** 2026-10-31 06-03-02 (IST)  
**Audit type:** Read-only specification, source, and evidence review  
**Audit authority:** This section records evidence and gaps only. It does not
approve a GST rule, authorize implementation, authorize a migration, or grant
pilot or production readiness.

### 30.1 Executive readiness assessment

**Overall status: `BLOCKED — NOT IMPLEMENTATION-READY FOR THE FULL DOMESTIC
GST SCOPE`.**

The specification has a coherent target boundary, preserves the eight-label
product control, distinguishes domestic from deferred categories, records
sales and purchase lifecycle intent, preserves supplier-declared/calculated/
accepted purchase values, and maps the required hybrid application/database
boundary. The repository also now has an explicitly typed 28-state/8-UT/36-
region administrative catalog. These are design and source facts, not complete
legal, accounting, engineering, database, or runtime approval.

The following remain blocking:

- no attributable formal PGST-01 approval;
- Q-01 through Q-09 are recorded as `PROFESSIONALLY REVIEWED — OWNER
  CONFIRMED` based on the project owner's explicit confirmation; no reviewer
  name, membership number, signature, review date, certificate, or attachment
  was supplied, and this confirmation does not authorize implementation;
- composition supplier/recipient rules, UTGST applicability, POS edge cases,
  GSTIN verification, rate governance, and precision/rounding policy;
- governed database-backed HSN and effective-dated HSN-to-rate catalogs,
  approval workflow, catalog audit history, and fail-closed missing-rule
  behavior;
- alignment of the active specification with the owner-selected GST-APP-03
  Option B `calculation_id` relation, followed by engineering/database review;
- treatment/POS/rate/fingerprint persistence representation and migration
  approval;
- restricted runtime role, grant, forced-RLS, immutable-history, and guarded
  transition decisions;
- durable sales idempotency and recovery design, including operation key,
  canonical request hash, conflict handling, and uncertain-outcome recovery;
- isolated database-backed evidence for RLS, atomicity, rollback, concurrency,
  historical immutability, and financial effects; and
- separate implementation, database/migration, testing, pilot, and production
  authorizations.

Implementation of the approved boundary cannot safely begin. The only safe
independent work is documentation maintenance, review-package preparation,
source-level contract analysis, catalog verification, and test-design
preparation that does not change application behavior or database state.
No calculation, workflow, schema, migration, or production work is authorized
by this audit.

### 30.2 Status classification used by this audit

The required audit statuses are applied to findings, not to the existence of
prose in this document:

- `DECIDED`: the project record explicitly selects a direction, while any
  separate implementation or runtime proof may still be pending.
- `PROPOSED`: a target is described but no governing approval is recorded.
- `BLOCKED`: a required decision, approval, or evidence gate is absent.
- `MISSING`: a necessary requirement or contract is absent from the active
  specification or supporting evidence.
- `VERIFIED_EXISTING`: current source or a permitted focused check proves the
  stated behavior; this does not prove legal correctness or database state.
- `NOT_VERIFIED`: the requirement is described or partly implemented, but the
  required source, applied-database, or runtime evidence is unavailable.

The status counts below count consolidated audit findings in §30.3, not every
sentence or acceptance-test row.

The §30.3 register contains **2 `DECIDED`, 0 `PROPOSED`, 16 `BLOCKED`, 1
`MISSING`, 0 `VERIFIED_EXISTING`, and 1 `NOT_VERIFIED`** findings. The
DGM-01–DGM-14 traceability table is intentionally separate because one
requirement may have a proposed decision while its implementation evidence is
verified only in part.

### 30.3 Master decision-gap register

| ID | Area | Unresolved decision | Owner | Dependencies | Blocked work | Interim behavior | Status |
|---|---|---|---|---|---|---|---|
| `DGM-G01` | Product scope | Confirm the four domestic treatment categories, valid sales/purchase direction combinations, and exact unsupported combinations. | Product owner; Accounting/GST | PGST-01; category matrix | Treatment control and workflow routing | Preserve the eight labels; block unapproved combinations. | `BLOCKED` |
| `DGM-G02` | Composition | Decide composition supplier and composition recipient rules separately, including document, charging, and ITC/accounting consequences. | Qualified GST reviewer; Accounting/finance; Product owner | DGM-B01; formal PGST-01 | Composition calculation, posting, and acceptance | Visible category only; no ordinary domestic calculation. | `BLOCKED` |
| `DGM-G03` | Deferred categories | Confirm that Overseas, SEZ, Deemed Export, and UIN Holders remain non-operational in phase one and define the exact user-facing block. | Product owner; qualified GST reviewer | Scope approval | Future-category UI and workflow activation | Keep categories disabled and fail closed. | `DECIDED` |
| `DGM-G04` | POS | Approve the legally applicable facts and rule precedence for same-state, inter-state, same-UT, differing billing/delivery, bill-to/ship-to, and third-location dispatch. | Qualified GST reviewer; Accounting/finance | DGM-B05; scenario evidence | Sales and purchase POS resolver | Require explicit facts; no prefix or billing-state fallback. | `BLOCKED` |
| `DGM-G05` | State/UT catalog | Approve the authoritative catalog source and version, and define whether the application alpha codes remain the stable internal identifiers alongside numeric GSTIN prefixes. | Product owner; Engineering; qualified GST reviewer | Catalog evidence; DGM-B03/DGM-B04 | Shared POS persistence and authoritative mapping claim | Preserve current alpha codes and explicit classifications; do not infer tax treatment. | `BLOCKED` |
| `DGM-G06` | UTGST | Decide the applicable UT set, component split, persistence, display, and validation rules. | Qualified GST reviewer; Accounting/finance | DGM-B02; POS approval | Intra-UT calculation and invoice posting | Same-UT remains blocked; no UTGST is calculated. | `BLOCKED` |
| `DGM-G07` | GSTIN | Decide checksum algorithm/source, verification source, effective dates, mismatch handling, and whether unverifiable values are acceptable by treatment. | Qualified GST reviewer; Accounting/finance | DGM-B04; verification evidence | Registration-dependent validation and acceptance | Shape validation only; preserve raw values and block where verification is required. | `BLOCKED` |
| `DGM-G08` | HSN/SAC and rates | Approve classification granularity, exempt/nil/non-GST behavior, authoritative rate source, maintainer, reviewer, effective-date policy, and stale-draft behavior. | Qualified GST reviewer; Accounting/finance; Product owner | DGM-B03; rate catalog evidence | Rate resolver, mixed-rate workflow, and finalization | Preserve existing line rates; no guessed defaults or statutory claims. | `BLOCKED` |
| `DGM-G09` | Calculation precision | Approve decimal representation/storage scale, intermediate arithmetic, discount order, inclusive extraction level, component allocation, line/invoice rounding, and signed round-off. | Accounting/finance; qualified GST reviewer; Engineering | DGM-B06; purchase precision dependencies | Shared authoritative calculator and financial acceptance | Existing numeric arithmetic remains legacy behavior only. | `BLOCKED` |
| `DGM-G10` | Calculation evidence | Define a deterministic canonical input/output serialization and fingerprint algorithm, including rule/source revision and transaction facts. | Engineering; Security/Architecture; Accounting/finance | Precision contract; treatment/POS/rate contracts | Reproducible calculation records and audit comparison | Store existing source evidence where available; do not claim fingerprints are complete. | `MISSING` |
| `DGM-G11` | Sales posting | Decide durable idempotency key scope, request-hash semantics, concurrent retry result, recovery after uncertain failure, and duplicate audit/sequence behavior. | Engineering; Security/Architecture | DGM-B10; transaction design | Sales finalization hardening and production claim | Existing transaction and draft/finalized guards remain; duplicate proof is absent. | `BLOCKED` |
| `DGM-G12` | Sales corrections | Credit/debit notes are in current-release scope; define immutable note allocations, original-document references, recipient evidence, and additive accounting effects. Physical returns and other reversals remain separately gated. | Product owner; Accounting/finance; qualified GST reviewer | DGM-B12 | Any post-finalization correction workflow | Reject unapproved transitions; do not overwrite original documents or invent note effects. | `DECIDED — SCOPE ONLY` |
| `DGM-G13` | Purchase acceptance | Approve discrepancy materiality/tolerance, accepted-value precedence, evidence timing, authority, delegation, and segregation-of-duties exceptions. | Accounting/finance; qualified GST reviewer; Product owner | PGST-01; PGST-07/08; DGM-B08 | Purchase reconciliation and posting | Preserve declared/calculated/accepted separation; block unresolved or unauthorized acceptance. | `BLOCKED` |
| `DGM-G14` | Purchase lifecycle | Align the active lifecycle with PGST-01’s pilot/legacy-draft rules and define the exact relationship between invoice status and derived GST/reconciliation statuses. | Product owner; Engineering; Accounting/finance | PGST-01; DGM-B11 | Purchase state implementation and legacy routing | Keep `DRAFT/FINALIZED/CANCELLED`; hold legacy/incomplete drafts. | `BLOCKED` |
| `DGM-G15` | Historical compatibility | Approve treatment of aggregate-only invoices, missing POS/HSN/GSTIN, stale rates, reopened drafts, and incomplete snapshots, including any permitted fallback wording. | Accounting/finance; qualified GST reviewer; Product owner | DGM-B11; historical evidence | Reprint, reopen, and migration-free compatibility behavior | Read-only legacy display; no fabricated facts or silent recalculation. | `BLOCKED` |
| `DGM-G16` | Persistence representation | Approve exact treatment/POS/rate/snapshot fields and relation ownership without inventing columns or weakening tenant-aware keys. | Engineering; database owner; Security/Architecture; Product owner | DGM-B07; contract gate | Prisma/schema design and migration plan | Source schema is evidence only; no migration is authorized. | `BLOCKED` |
| `DGM-G17` | `calculation_id` alignment | Align the active specification with the owner-selected GST-APP-03 Option B relation recorded in the purchase persistence addendum; preserve the decision trail before schema work. | Product owner; Engineering; Security/Architecture; database owner | Purchase persistence addendum; schema review | Accounting-decision relation and migration DDL | Treat Option B as a documented direction, not executable authorization. | `BLOCKED` |
| `DGM-G18` | Database security | Approve restricted runtime/bootstrap roles, direct-client access model, grants, forced-RLS policy, `app_metadata` tenant claim behavior, immutable triggers/functions, and guarded transitions. | Security/Architecture; database owner; Engineering | DGM-B09; rollout review | RLS/schema rollout and security acceptance | Existing SQL/design remains review-only; ordinary-role isolation is unverified. | `BLOCKED` |
| `DGM-G19` | Applied database state | Produce a durable sanitized metadata baseline and disposable migration/rollback evidence proving objects, grants, RLS, constraints, and compatibility. | Database owner; Engineering; Security/Architecture | Migration authorization; isolated target | Any claim of persistence, immutability, or runtime RLS | Do not connect to or alter live Supabase; source definitions are not applied-state proof. | `NOT_VERIFIED` |
| `DGM-G20` | Testing/release | Approve test authorization, fixture ownership, database identity, cleanup, failure injection, evidence retention, release thresholds, and separate pilot/production gates. | Engineering; Security/Architecture; Product owner; Accounting/finance | Financial E2E harness; Phase Tracker | Financial E2E, RLS, rollback, concurrency, pilot, and release | Q-10/Q-14/Q-15 passed `PASS — SCOPED` on the retained disposable target; broader Financial E2E, pilot, and release gates remain open. | `PARTIAL` |

**Register ownership note:** Owners are accountable disciplines, not named
approvers. No named accountable owner, reviewer identity, qualification, or
dated approval record was found for the unresolved items. A later approval
package must populate those fields and cite the evidence used.

### 30.3A Owner-selected decision register

The following 14 decisions are now recorded as owner-selected directions.
`DECIDED` means the direction was selected; it does not mean that statutory
review, engineering approval, implementation authorization, database rollout,
or runtime verification is complete. Any blocked dependency remains explicitly
blocked in the final column. These entries extend the existing gap register and
do not replace the historical DGM-B, D-GST, PGST-01, or audit identifiers.

| ID | Decision title | Owner-selected direction | Status | Requirements and constraints | Dependencies / approval conditions | Decision class | Supporting reference | Dependency state |
|---|---|---|---|---|---|---|---|---|
| `DGM-OD-01` | First-release domestic GST treatments | Retain all eight dropdown options; only Registered Business — Regular is potentially enabled after its applicable gates pass; keep Composition, Unregistered, and Consumer blocked pending separate approval; exclude Overseas, SEZ, Deemed Export, and UIN Holders from operational calculation. | `DECIDED` | Blocked or excluded categories must not fall through to ordinary domestic GST. | Separate category eligibility, statutory/accounting rules, and acceptance evidence. | Product decision; statutory/accounting dependency | §§3, 3.1–3.2, 12; DGM-G01–G03; decision-closure BD-01/DGM-OD-03 | `BLOCKED` |
| `DGM-OD-02` | Place-of-Supply selection | System may suggest POS from transaction facts; user confirms it before calculation and finalization. | `DECIDED` | Retain confirmation as transaction evidence; server-side validation must run before calculation and again at finalization; GSTIN prefix alone is insufficient; inconsistent POS is rejected. | Approved POS scenario precedence and server-side validation. | Product decision; engineering/statutory dependency | §4; DGM-G04–G05 | `BLOCKED` |
| `DGM-OD-03` | Consumer and unregistered-party behavior | Keep registered, unregistered, and consumer transactions as separate rule sets; Unregistered and Consumer workflows remain blocked pending separate rule approvals, while Regular remains subject to its applicable acceptance gates and is not blanket-blocked. | `DECIDED` | Do not assume identical eligibility, evidence, tax, or document behavior. | Product, accounting, and qualified GST review of each category. | Product decision; statutory/accounting dependency | §3.1; DGM-G01–G02 | `BLOCKED` |
| `DGM-OD-04` | HSN/SAC and tax-rate governance | Use product-level HSN/SAC and centrally governed effective-dated rate rules with applicable rule versions. | `DECIDED` | Missing, ambiguous, invalid, or unsupported classification blocks calculation/finalization; no unrestricted invoice-level overrides; finalized snapshots preserve applied classification and rate. | Authoritative classification/rate sources, maintainers, reviewers, effective-date and stale-draft policy. | Statutory/accounting approval; engineering contract | §§6, 8, 19, 24; DGM-G08 | `BLOCKED` |
| `DGM-OD-05` | Discounts, inclusive pricing, and rounding | Approve explicit line discount allocation, inclusive/exclusive formulas, decimal precision, rounding stages, and invoice reconciliation before implementation. | `DECIDED` | No arbitrary or silent precision/rounding behavior. | Accounting/GST and engineering precision contract. | Accounting/finance approval; engineering contract | §§7, 19, 26; DGM-G09 | `BLOCKED` |
| `DGM-OD-06` | Purchase GST acceptance | Keep supplier-declared, application-calculated, and accounting-accepted values separate; require authorized acceptance before posting. | `DECIDED` | Preserve original supplier evidence; store acceptance metadata; never overwrite supplier evidence. | Approval permissions, exception handling, discrepancy policy, and segregation of duties. | Product decision; accounting/security dependency | §9; PGST-01; purchase persistence design §§1, 11–15; DGM-G13–14 | `BLOCKED` |
| `DGM-OD-07` | Sales finalization idempotency | Require durable idempotency key and canonical request hash; valid identical retries return the original result; conflicting reuse is rejected. | `DECIDED` | Define key scope, canonicalization, hash algorithm, retention, concurrency, atomicity, and financial posting behavior. | Engineering and security contract plus isolated race/retry evidence. | Engineering contract; verification requirement | §§8, 11; DGM-G11; D-GST-06/D-GST-08 | `BLOCKED` |
| `DGM-OD-08` | GST calculation relation / `calculation_id` | Select GST-APP-03 Option B and align the active specification with the purchase persistence addendum. | `DECIDED` | Preserve the historical decision trail and source references; this documentation entry authorizes no schema or database change. | Active-contract wording must be aligned before schema planning; engineering/database review remains required. | Engineering contract | Purchase persistence design §3 and 2026-10-25 addendum; schema rollout review | `BLOCKED` |
| `DGM-OD-09` | Runtime database access and tenant isolation | Separate bootstrap/provisioning and runtime roles; prohibit direct anonymous CRUD; require tenant-scoped fail-closed RLS and verified runtime permissions. | `DECIDED` | Target architecture is distinct from applied-state evidence; release requires actual grants and policy behavior verification. | Security/Architecture and database-owner approval; isolated ordinary-role tests. | Security/architecture decision; verification requirement | §11; schema rollout review; Financial E2E harness | `BLOCKED` |
| `DGM-OD-10` | Database rollout and provisioning | Use additive, catalog-guarded, repeatable provisioning that stops on missing prerequisites, incompatible objects, or unexpected conflicts. | `DECIDED` | Do not silently skip required GST objects or overwrite, drop, or automatically repair conflicts; preserve migration history and rollout evidence. | Migration authorization, preflight catalog baseline, and rollback evidence. | Engineering/database decision | §11; schema rollout review; APP-08 | Q-15 disposable-target validation `PASS — SCOPED`; partial-failure recovery `NOT VERIFIED`; production migration and rollout authorization `BLOCKED` |
| `DGM-OD-11` | Finalized invoice history and legacy records | Use immutable transaction-time snapshots and never substitute current master data for missing historical facts. | `DECIDED` | Preserve identity, classification, rate, component, and original evidence snapshots; define safe incomplete-legacy display/printing without fabrication. | Historical compatibility policy, database immutability, and legacy reprint evidence. | Product decision; accounting/engineering dependency | §§10, 11, 24; DGM-G15–G19 | `BLOCKED` |
| `DGM-OD-12` | Posting, retries, and concurrency | Application services orchestrate posting, retries, reconciliation, and acceptance; database constraints and guarded transitions enforce integrity and idempotency. | `DECIDED` | Preserve atomic financial posting and consistent sales/purchase contracts; do not rely only on application checks or move all workflow into triggers. | Engineering/security contract and isolated concurrency/rollback evidence. | Engineering architecture decision | §11; purchase persistence design §§15–16; DGM-G11, G18–G20 | `BLOCKED` |
| `DGM-OD-13` | Composition treatment | Keep Composition visible in the dropdown, but block calculation and finalization until statutory behavior is approved. | `DECIDED` | Show a clear pending/blocked state; preserve selected treatment in draft/audit context; never silently fall back to Regular, Consumer, or another treatment. | Qualified GST and accounting approval of supplier/recipient rules. | Product decision; statutory/accounting dependency | §3.1; PGST-01; DGM-G02 | `BLOCKED` |
| `DGM-OD-14` | UTGST support | Support CGST+SGST for legally applicable intra-state supplies, CGST+UTGST for legally applicable intra-UT supplies, and IGST for legally applicable inter-state supplies. | `DECIDED` | Components derive from approved POS and statutory rules; the catalog is identity data only; never infer UTGST solely from GSTIN prefix. | Qualified GST/accounting approval of applicable UT set and component rules; POS confirmation. | Statutory/accounting approval; engineering dependency | §§4–5, 11; State/UT catalog; DGM-G04–G06 | `BLOCKED` |

### 30.4 Requirements traceability audit

| Requirement | Specification section | Decision status | Implementation evidence status | Remaining acceptance criteria |
|---|---|---|---|---|
| `DGM-01` | §§3, 23, 26 | `PROPOSED` | `NOT_VERIFIED`; no complete current eight-label control was found | Exact eight-label UI test, persisted classification, deferred-category block, server-side validation |
| `DGM-02` | §§3.1, 16, 27 | `BLOCKED` | `NOT_VERIFIED`; composition fields/rules are absent or incomplete | Separate supplier/recipient rules, qualified review, accounting consequences, negative tests |
| `DGM-03` | §§4.1, 17, 27 | `DECIDED` for administrative source structure; `BLOCKED` for authoritative legal maintenance | `VERIFIED_EXISTING` for 28/8/36 counts and explicit types; focused runtime check passed | Authoritative catalog approval, shared UI use, POS snapshot, invalid-value tests |
| `DGM-04` | §§5.1, 18.1, 26 | `DECIDED` as a non-authoritative validation boundary | `VERIFIED_EXISTING` for shape/prefix helper behavior; checksum and government status are `NOT_VERIFIED` | Raw preservation, checksum/source decision, mismatch/effective-date tests |
| `DGM-05` | §§4.1, 5, 17 | `BLOCKED` | Sales narrow state comparison is `VERIFIED_EXISTING`; purchase fact resolution is `NOT_VERIFIED` | Approved scenario resolver, delivery/dispatch facts, fail-closed integration |
| `DGM-06` | §§5.2, 17, 19 | `BLOCKED` for complete component support | Ordinary sales CGST/SGST/IGST is `VERIFIED_EXISTING`; UTGST and complete purchase behavior are `NOT_VERIFIED` | UTGST policy, component persistence, purchase/sales parity, rounding tests |
| `DGM-07` | §§6, 13, 19 | `PROPOSED` | Sales line calculation is `VERIFIED_EXISTING`; purchase line-level contract is `NOT_VERIFIED` | Mixed-rate sales/purchase tests and persisted line snapshots |
| `DGM-08` | §§7, 19, 26 | `BLOCKED` | Existing sales service is primarily exclusive/two-decimal behavior; inclusive contract is `NOT_VERIFIED` | Approved extraction/rounding/discount policy and deterministic inclusive tests |
| `DGM-09` | §8, §§20, 22, 25 | `PROPOSED` | Transactional sales path is `VERIFIED_EXISTING`; treatment, durable idempotency, and DB protections are `NOT_VERIFIED` | Server facts, snapshot completeness, duplicate/concurrency, atomic financial E2E |
| `DGM-10` | §9, §§21–22, 25 | `BLOCKED` | Pure reconciliation and source persistence paths are `VERIFIED_EXISTING` in source; applied persistence and approved policy are `NOT_VERIFIED` | PGST-01 approval, line-level fact contract, acceptance/posting, immutable evidence |
| `DGM-11` | §§10, 23, 26 | `PROPOSED` | Snapshot helper and current print behavior are `VERIFIED_EXISTING` only for covered fields; complete treatment/mode output is `NOT_VERIFIED` | Finalized snapshot print, legacy disclosure, component/treatment/mode tests |
| `DGM-12` | §§10, 22, 24–25 | `BLOCKED` | Application snapshot/fallback logic is `VERIFIED_EXISTING`; database immutability is `NOT_VERIFIED` | Mutation-proof database test, complete/legacy reprint fixtures, applied constraints |
| `DGM-13` | §§5.1, 17, 25–26 | `PROPOSED` with blocked extensions | Narrow POS fail-closed helpers are `VERIFIED_EXISTING`; treatment/purchase/rate/UTGST coverage is `NOT_VERIFIED` | Negative matrix for all missing, invalid, contradictory, unsupported cases |
| `DGM-14` | §§11, 25–28 | `BLOCKED` | Source transaction boundaries and protected harness contracts are `VERIFIED_EXISTING`; runtime financial/RLS evidence is `NOT_VERIFIED` | Isolated DB identity, fixtures, rollback, RLS, concurrency, audit, and release evidence |

### 30.5 Implementation dependency map

The dependency order in §28 is retained and clarified as follows:

1. **Independent documentation and evidence preparation:** maintain the
   decision register, collect attributable review artifacts, verify the
   State/UT catalog source, and prepare deterministic test cases. This does
   not require application or database changes.
2. **Product/workflow gate:** approve treatment direction, supported
   combinations, deferred-category behavior, legacy routing, and correction
   scope. Nothing that changes workflow behavior proceeds before this gate.
3. **GST/accounting gate:** approve composition, POS, UTGST, GSTIN, HSN/SAC,
   rate governance, precision, rounding, inclusive extraction, discrepancy,
   and accepted-value rules. Calculation and posting implementation waits.
4. **Engineering contract gate:** resolve treatment/POS/rate snapshots,
   decimal/fingerprint contracts, service outputs, lifecycle transitions,
   idempotency, retry, and recovery. The GST-APP-03 Option B record must be
   aligned here.
5. **Security/database design gate:** approve tenant-aware relations,
   restricted roles, grants, RLS/forced-RLS, immutable evidence, guarded
   transitions, migration preflight, and rollback. No live database operation
   is implied.
6. **Pre-implementation engineering validation:** After requirements/design
   closure, environment prerequisite verification, separately authorized
   disposable provisioning, independent target/role verification, and
   fixture/backup/restore/evidence/cleanup verification, run only the
   authorized Q-10, Q-14, and Q-15 isolated engineering validation. This does
   not authorize GST application implementation.
7. **Consolidated evidence review:** Reassess the engineering gates and record
   the remaining blockers from the retained validation evidence.
8. **Owner authorization and implementation:** Full-scope owner authorization
   is recorded above. Implementation may proceed only within the documented
   requirements and evidence boundaries; unresolved legal/accounting policy,
   migration controls, independent security review, and production approval
   remain separate gates.
9. **GST application implementation:** implement shared
   validation/calculation contracts first, then sales, purchase, persistence
   protections, UI/print, and compatibility behavior in the stated order.
10. **Post-implementation Financial E2E and separate release authorization:**
   Prepare and safety-review Financial E2E separately, then run it only after
   implementation and its environment gates are complete. Pilot, production,
   and release approval remain independent and last.

Tasks 1 can proceed independently. Tasks 2–5 are approval-dependent and
sequential where their outputs are inputs to later tasks. Tasks 6–8 must not
begin merely because the specification is comprehensive.

### 30.6 Final readiness gates

| Gate | Pass evidence required | Current result |
|---|---|---|
| Product/workflow approval | Attributable approval of domestic scope, treatment combinations, deferred categories, legacy behavior, correction scope, and PGST-01 product conditions | `NOT READY` |
| GST/accounting approval | Qualified review artifact covering composition, POS, UTGST, GSTIN, HSN/SAC/rates, precision/rounding, purchase discrepancy and accepted-value policy | `NOT READY` |
| Engineering contract approval | Reviewed service/data/lifecycle/fingerprint/idempotency/recovery contracts, including HSN/rate catalogs and aligned GST-APP-03 Option B status | `NOT READY` |
| Implementation verification | Authorized focused tests and source evidence proving approved sales/purchase behavior, snapshot precedence, negative paths, and compatibility | `NOT READY` |
| Release readiness | Applied-schema/RLS evidence, restricted-role tests, rollback/concurrency/Financial E2E evidence, monitoring, backup/restore, pilot authorization, and production go/no-go record | `NOT READY` |

### 30.6.1 Engineering-gate assessment

Latest retained independent evidence (2026-10-31 IST) supersedes the earlier
source-only wording below for the disposable target: Q-10 is supported by
`q10-application-final.txt`, Q-14 by ordinary-login
`q14-ordinary-login-final.txt`, and Q-15 by
`q15-final.txt`, its raw command log, and
`q15-1793447704646-restore-comparison.json`.
The shared regression is retained in `q10-q14-regression-final.txt`.
These results remain isolated-target evidence and do not authorize GST
implementation or production release.

- **Q-10:** `PASS — SCOPED` for the disposable target. The sales action now has a
  tenant-scoped operation key/hash/result protocol, and isolated replay,
  conflict, rollback, uncertain-outcome, and concurrency cases passed.
- **Q-14:** `PASS — SCOPED` for the disposable target. Applied role, forced-RLS,
  tenant-context, cross-tenant, pooled-session, DDL, and finalized-history
  cases passed.
- **Q-15:** `PASS — SCOPED` for the disposable target. The committed migration baseline,
  repeatability, conflict stop, backup, restore, and comparison cases passed.
  Partial-failure recovery is `NOT VERIFIED` from retained output.

These are assessments of source and documentation evidence only. No
application, schema, SQL, migration, and isolated validation changes were
performed only within the separately authorized Q-10/Q-14/Q-15 scope.
The full-scope owner authorization is now recorded, but these results do not
establish that every GST requirement is implemented or verified, and they do
not authorize production migration, production data changes, deployment, or
release.

### 30.6.2 Consolidated gate recommendation

| Gate group | Status | Current evidence boundary | Required next evidence |
|---|---|---|---|
| Q-01–Q-09 professional-review record | `CLOSED` as a review-status record | Owner confirmation is recorded; no reviewer metadata was invented. | Keep statutory/source limitations and implementation gates separate; no authorization follows from the confirmation. |
| Legal/source and rate governance | `PARTIALLY READY` | Primary legal references and rate indexes are recorded, but product-specific pharmaceutical and State/UT applicability remains `NOT VERIFIED`. | Qualified GST/accounting review of current entries, conditions, amendments, and effective dates. |
| HSN/rate catalogs | `BLOCKED` | Governed catalog requirements are defined; current scalar product fields are insufficient. | Approved database-backed catalogs, separated permissions, audit trail, effective dates, and fail-closed rule selection. |
| Q-10 sales idempotency | `PASS — SCOPED` | Durable sales operation/hash/result protocol and isolated duplicate/conflict/timeout/concurrency evidence passed on the disposable target. | Broader purchase/GST behavior, production/staging behavior, and release gates. |
| Q-14 isolation/security | `PASS — SCOPED` | Applied role/ACL/RLS, tenant-context, cross-tenant, pooled-session, DDL, finalized-history, SEC-DEC-01, and SEC-DEC-02 evidence passed on the disposable target. | SEC-DEC-03 production boundary, production/staging evidence, and release readiness remain separate. |
| Q-15 migration safety | `PASS — SCOPED` | Committed baseline, repeatability, conflict stop, backup/restore, and comparison evidence passed on disposable targets. Partial-failure recovery is `NOT VERIFIED` from retained output. | Production rollout, live-state comparison, and recovery authorization remain separate. |
| Financial E2E/release | `NOT VERIFIED` | Q-10/Q-14/Q-15 isolated validation is retained, but broader Financial E2E and release validation have not run. | Explicit broader-E2E authorization, owned fixtures/cleanup, and release evidence. |
| Implementation authorization | `AUTHORIZED — EVIDENCE-GATED` | Full-scope owner authorization is recorded; implementation and validation remain subject to the documented requirements, unresolved policy boundaries, and evidence gates. | Complete implementation evidence, independent review where required, applied-schema/security evidence, and acceptance review. |

**Recommendation:** `NOT READY — SPECIFIC GATES REMAIN OPEN.` Full-scope owner
authorization is recorded, but the project is not ready for completion,
production rollout, or release. The next milestone is qualified
source/accounting review completion where still unresolved, followed by the
remaining implementation, isolated validation, migration-control, and
acceptance gates.

### 30.6.3 Validation-readiness package

The Q-10, Q-14, and Q-15 validation package requires an explicitly authorized
disposable database, sanitized representative data, dedicated test tenants,
separate bootstrap/runtime roles, verified connection identity, migration
baseline, backup/restore capability, retained evidence, and owned cleanup.
The environment must not share credentials or state with production.

The coordinated cases cover: sales first-post/replay/conflict/concurrency,
timeout and process-interruption recovery, invoice-number and side-effect
uniqueness, cross-tenant idempotency isolation, anonymous/runtime privilege
denial, missing/invalid tenant context, cross-tenant read/write denial,
pool-session context reuse, finalized-history mutation denial, guarded posting
and constraint failures, migration baseline/repeatability, missing
prerequisites, drift/conflicts, partial application, snapshot preservation,
restore, post-migration comparison, and recovery boundaries.

The isolated-validation scope was owner-authorized and executed only against
the loopback, ephemeral target. Q-10, Q-14, and Q-15 results are retained in
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md).
This evidence does not authorize broader GST implementation, production
deployment, or release.

### 30.6.4 Authorized-validation chronology

The earlier authorized preflight stopped before database connection. That
historical event remains preserved: the target container was not running and
the preflight did not establish target identity, effective privileges,
sanitized-data provenance, backup/restore capability, cleanup evidence, or an
approved executable package.

A subsequent validation event on 2026-10-31 (IST) used the loopback-bound,
ephemeral PostgreSQL 17 target `financial-e2e-postgres` with separate
bootstrap, runtime, administrative, and validation roles. The retained
[`financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md`](./financial-e2e-q10-q14-q15-validation-evidence-2026-10-31.md)
records Q-10, Q-14, and Q-15 as `PASS — SCOPED` for that disposable target. The
reported results include Q-10 application-path replay/conflict/rollback/
concurrency cases, Q-14 ordinary-login security and SEC-DEC-01/02 controls,
and Q-15 migration, backup, independent restore, and comparison cases.

Current status is therefore `PASS — SCOPED` for the disposable target only.
The historical preflight is not a simultaneous current failure, and the later
validation does not establish production/staging access, broader Financial
E2E, GST implementation completeness, or release authorization.

### 30.6.5 Environment-provisioning readiness

The intended environment is the local `financial-e2e-postgres` PostgreSQL 17
Compose service with loopback binding, ephemeral `tmpfs`, the
`financial-e2e-isolated` label, and distinct `pharmnos_e2e` bootstrap and
`pharmnos_e2e_runtime` roles. Compose configuration and static safety guards
are present, but they do not prove database identity, role privileges,
sanitized-data provenance, backup/restore capability, or production
non-overlap.

Retained validation status:

- Disposable target definition, Docker/Compose availability, target identity,
  effective role/ACL/RLS readback, coherent migration baseline, backup/restore
  evidence, and executable validation package: `PASS — SCOPED` for the
  retained disposable validation event.
- Production/staging non-overlap, fixture ownership after the run, cleanup
  authorization, and release evidence: `NOT VERIFIED` or not applicable to
  the isolated result.

The required sequence is: verify environment prerequisites; separately
authorize and provision the disposable target; independently verify identity
and roles; prepare run-owned synthetic fixtures; verify backup and restore;
review the executable harness package; then use the received isolated-scope
authorization only when all execution conditions are satisfied to run and
reconcile Q-10/Q-14/Q-15 evidence. Current overall preparation status:
`BLOCKED — ENGINEERING PREREQUISITES REMAIN`.

Passing a gate must not be inferred from a proposal, source inspection,
historical test result, Product-owner direction, or AI review.

### 30.6.6 Owner-input checklist for environment provisioning

The complete actionable owner/engineering checklist, categorized response sheet,
status fields, dependencies, acceptance evidence, and stage impacts are
maintained in [§7.8 of the GST decision closure artifact](./gst-decision-closure-and-engineering-contract-approval.md#78-owner-input-checklist-for-environment-provisioning).
That checklist is authoritative for ENV-01–04, SEC-01–04, DATA-01–04,
BAK-01–03, CLN-01–03, VAL-10–16, and recorded owner decisions OD-01–OD-08.
Owner approval is distinct from technical verification. This section remains
the active specification's readiness boundary: no database, container, SQL,
migration, fixture, backup, restore, cleanup, or validation operation is
permitted until the applicable checklist evidence and authorizations are
complete.
The security and synthetic-fixture decision brief is maintained in [the
closure artifact](./gst-decision-closure-and-engineering-contract-approval.md#security-and-gst-fixture-owner-decision-brief);
SEC-DEC-01, SEC-DEC-02, SEC-DEC-03, and the synthetic fixture/source policy are
recorded there as `OWNER APPROVED`. SEC-DEC-01 and SEC-DEC-02 now also have
independent disposable-target runtime evidence; SEC-DEC-03 and statutory source
verification remain open. The same canonical section contains the owner-review
engineering contracts and frozen FIX-01–FIX-13 manifest. This does not authorize
GST implementation or production use.
The detailed manifest is canonical; any compact scenario matrix is summary-only.

### 30.7 Contradictions and terminology findings

1. **`calculation_id` alignment dependency:** the persistence design addendum
   records owner selection of GST-APP-03 Option B, and this section now records
   that direction. Engineering/database review and active contract alignment
   remain blocked before any schema change.
2. **Owner-confirmed review versus missing metadata:** Q-01 through Q-09 are
   recorded as `PROFESSIONALLY REVIEWED — OWNER CONFIRMED` based on the
   project owner's explicit confirmation. Reviewer identity, membership
   number, signature, date, certificate, and attachment remain unavailable;
   this is a metadata/evidence limitation, not a reversal of the recorded
   review status. Remaining statutory-source limitations and unresolved
   legal/accounting questions remain separate gates, and no implementation
   authorization follows.
3. **Design versus implementation terminology:** the active specification
   sometimes describes purchase evidence/reconciliation as “current source”
   behavior while the persistence and rollout documents describe the same
   structures as design-only or unapplied. Use `source-observed`,
   `design-proposed`, and `applied/runtime-verified` distinctly.
4. **State/UT codes:** the application’s two-letter alpha codes are internal
   lookup identifiers. They are not the official numeric GSTIN prefixes.
   Neither collection membership nor a GSTIN prefix alone determines POS,
   SGST, or UTGST.
5. **Status vocabulary:** `UNRESOLVED`, `DEFERRED`, `PARTIALLY EXISTING`, and
   `BLOCKED` are used in different sections. For implementation handoff,
   `DEFERRED` means out of phase-one scope, while the audit statuses in §30.2
   provide the required decision/evidence classification.

### 30.8 Audit evidence and limitations

Inspected for this audit:

- [CLAUDE.md](../CLAUDE.md), [PHASE_TRACKER.md](../PHASE_TRACKER.md), and
  relevant project guidance;
- this active specification and the retained
  [gst-specification.md](./gst-specification.md);
- [gst-audit-validation-and-plan.md](./gst-audit-validation-and-plan.md);
- [pgst-01-purchase-gst-workflow-policy.md](./pgst-01-purchase-gst-workflow-policy.md);
- [pgst-01-decision-traceability-register.md](./pgst-01-decision-traceability-register.md);
- [purchase-gst-persistence-design.md](./purchase-gst-persistence-design.md);
- [gst-schema-rollout-design-review.md](./gst-schema-rollout-design-review.md);
- [financial-e2e-validation-harness.md](./financial-e2e-validation-harness.md);
- [gst-calculator.service.ts](../../src/domain/services/gst-calculator.service.ts);
- [purchase-gst-reconciliation.service.ts](../../src/domain/services/purchase-gst-reconciliation.service.ts);
- [sales.actions.ts](../../src/app/_actions/sales.actions.ts);
- [purchases.actions.ts](../../src/app/_actions/purchases.actions.ts);
- [schema.prisma](../../prisma/schema.prisma);
- [indian-states.ts](../../src/lib/constants/indian-states.ts);
- [gst-calculator.test.ts](../../tests/gst-calculator.test.ts);
- relevant validation schemas and direct consumers of the State/UT exports.

Checks performed:

- repository status, current branch, HEAD, and current diff inspection;
- source-level State/UT consumer search;
- focused TypeScript check of `indian-states.ts` — passed;
- focused runtime catalog check — 28 states, 8 UTs, 36 combined, zero
  duplicate codes, 36 lookup entries — passed;
- `git diff --check` — passed;
- focused `tsx` test attempt — not runnable because `tsx` is unavailable;
- repository-wide type-check — blocked by an unrelated generated Next.js route
  typing error in `.next/types/app/billing/[invoiceId]/print/page.ts`.

Not verified in this audit:

- any external or live database state, Supabase state, migration, RLS,
  grants, forced-RLS, trigger, role, or immutable-history behavior;
- qualified legal/GST/accounting approval;
- runtime calculation, purchase posting, sales idempotency, concurrency,
  rollback, Financial E2E, or production behavior;
- complete current UI treatment control or all invoice/print fields;
- authoritative legal mapping of every complex POS scenario;
- government GSTIN status/checksum verification;
- authoritative HSN/SAC/rate catalog and effective-date governance.

The current worktree also contains pre-existing changes to
[`indian-states.ts`](../../src/lib/constants/indian-states.ts),
[`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts), the superseded
specification, and the untracked active specification. This audit changed only
the active specification; it did not alter or revert those other changes.

### 30.9 Final audit determination

The active specification is substantially documented and remains a gated
implementation baseline. Full-scope owner authorization is recorded, but this
does not make the specification complete, professionally approved, or ready
for production. The master decision-gap register above is the controlling list
for completion: every implementation
workstream must cite a resolved decision or an explicitly approved interim
behavior, and every runtime/database claim must cite fresh evidence from an
authorized isolated target.

**Final determination: `NO-GO — DOMESTIC GST MODERNIZATION NOT READY FOR
IMPLEMENTATION OR RELEASE`.**

### 30.10 Authoritative cross-document reconciliation register

This register is authoritative for the current cross-document status. The
supporting documents retain their ownership boundaries and must not broaden
these statuses.

| Item | Authoritative section/document | Current status | Evidence boundary or limitation |
|---|---|---|---|
| Q-10 | This document §30.6.1; validation evidence report | `PASS — SCOPED` | Disposable local PostgreSQL target only; broader Financial E2E and production behavior remain open. |
| Q-14 | This document §30.6.1; validation evidence report | `PASS — SCOPED` | Ordinary-login RLS/ACL and SEC-DEC-01/02 controls passed on the disposable target; production security and SEC-DEC-03 readiness remain open. |
| Q-15 | This document §30.6.1; validation evidence report | `PASS — SCOPED` | Migration, repeatability, conflict stop, backup, restore, and comparison passed on disposable targets; partial-failure recovery is `NOT VERIFIED` from retained output; production rollout remains unauthorized. |
| SEC-DEC-01 | Decision closure; schema rollout | `PASS — SCOPED` | Controlled maintenance-trigger behavior passed in the disposable target; not a normal runtime capability or production proof. |
| SEC-DEC-02 | Decision closure; schema rollout | `PASS — SCOPED` | Request/approval/execution separation and denial cases passed in the disposable target; production security remains open. |
| SEC-DEC-03 | Decision closure; schema rollout | `NOT VERIFIED` | Owner-approved boundary is documented, but no complete production/applied-state proof establishes all bootstrap/runtime/admin/validation conditions. |
| GST-APP-03 Option B | Decision closure; schema rollout | `DECIDED — ENGINEERING IMPLEMENTATION AUTHORIZED; PRODUCTION NOT AUTHORIZED` | Owner-selected tenant/invoice-scoped `calculation_id` relation; Prisma source contains the relation, while applied migration and database verification remain separate. |
| Purchase current pointers | Purchase persistence; schema rollout | `DESIGN PRESENT — VALIDATION NOT VERIFIED` | All three Prisma relations and composite keys are present in source; `prisma validate`, generated SQL, cross-tenant rejection, invalid-pointer rejection, historical reads, and deletion behavior still require authorized verification. |
| Purchase line-level calculated values | Purchase persistence §7 | `OWNER-APPROVED; IMPLEMENTED — VALIDATION NOT RUN` | Line-level calculated snapshots are now additive and separate from supplier evidence; unresolved policy inputs still fail closed. |
| Purchase line-level accepted values | Purchase persistence §7 | `OWNER-APPROVED; IMPLEMENTED — VALIDATION NOT RUN` | Line-level accepted snapshots are persisted on acceptance without overwriting supplier evidence; accounting policy questions remain unresolved. |
| Q-01–Q-09 professional review | Accounting question pack; decision closure | `CLOSED — OWNER CONFIRMED` | Preserve exact qualification `PROFESSIONALLY REVIEWED — OWNER CONFIRMED`; independent statutory verification and reviewer metadata are not established. |
| Financial E2E readiness | This document §30.6.2 | `NOT VERIFIED` | Q-10/Q-14/Q-15 are narrower isolated gates; broader financial scenarios have not been executed. |
| GST implementation readiness | This document §30.6 | `NOT APPROVED` | Design and isolated engineering evidence do not authorize application implementation. |
| Production/release readiness | This document §30.6 | `NOT READY` | Production security, migration/recovery, monitoring, pilot, and release authorization remain open. |

The retained evidence report is the only current source for the 2026-10-31
isolated validation event. Earlier preflight-stopped statements are historical
and remain preserved as chronology; they must not be presented as the current
result after the subsequent validation event.
