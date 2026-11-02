---
title: GST credit and debit note engineering contract
date: 2026-11-02
status: OWNER AUTHORIZED - IMPLEMENTATION-READY CONTRACT; IMPLEMENTATION AND ACCEPTANCE UNVERIFIED
---

# GST Credit and Debit Note Engineering Contract

**Working stage:** POST-P7 - PRE-PRODUCTION VALIDATION  
**Document type:** Implementation-ready business and engineering contract  
**Owner scope:** Approved for the current release  
**Implementation status:** Not implemented  
**Runtime status:** Not run  
**Independent acceptance:** Not verified  
**Production status:** Not authorized

## 1. Purpose, authority, and status vocabulary

This document is the detailed current-release contract for GST credit notes,
GST debit notes, recipient-side processing, commercial/financial adjustments,
physical goods returns, accounting effects, inventory effects, return
reporting, IRP/e-invoice boundaries, permissions, and evidence.

It is a companion to the [Domestic GST Modernization
specification](./domestic-gst-modernization.md), the [GST Schema Rollout Design
Review](./gst-schema-rollout-design-review.md), the [GST Accounting Decision
Question Pack](./gst-accounting-decision-question-pack.md), and the [GST
Decision Closure and Engineering Contract
Approval](./gst-decision-closure-and-engineering-contract-approval.md). This
document owns the detailed note contract. The [GST Audit Validation and
Minimum Scope Implementation Plan](./gst-audit-validation-and-plan.md), [GST
Implementation Tracker](./gst-implementation-tracker-2026-10-31.md), [GST
Calculation and Treatment Acceptance](./gst-calculation-treatment-acceptance-2026-11-01.md),
and [GST Precision and Rounding Engineering
Contract](../decisions/0009-gst-precision-rounding-engineering-contract.md)
provide status and traceability references. The companion documents continue
to own their designated subjects. A conflict must be recorded with both
locations; it must not be resolved by silently choosing a convenient summary.

No application code, Prisma model, migration, SQL, database, container,
process, or Git history was changed to produce this contract.

### 1.1 Mandatory status distinctions

| Status | Meaning |
|---|---|
| `OWNER SCOPE APPROVED` | Current-release inclusion is authorized by the owner. |
| `LEGAL BASELINE VERIFIED` | The cited operative provision or official source has been verified; this does not decide the product's application policy. |
| `CONTRACT FINALIZED` | Requirements, invariants, state transitions, permissions, and acceptance evidence are specified here. |
| `IMPLEMENTED` | Application/schema/configuration code exists and is reviewed. |
| `RUNTIME VERIFIED` | The relevant workflow was executed against an authorized isolated database and evidence was retained. |
| `INDEPENDENTLY ACCEPTED` | A separate review confirms the implementation meets this contract. |
| `PRODUCTION AUTHORIZED` | A separate release authority approved production use. |

This document is `OWNER SCOPE APPROVED` and `CONTRACT FINALIZED` only.
Documentation completeness must not be reported as implementation or acceptance.

### 1.2 Current-release scope

The current release includes:

1. supplier-issued statutory GST credit notes against one or more original
   outward invoices;
2. supplier-issued statutory GST debit notes against one or more original
   outward invoices;
3. recipient-side processing of supplier-issued statutory credit notes and
   debit notes against posted inward purchases;
4. separate commercial/financial adjustments that do not alter GST;
5. physical return authorization, receipt, inspection, and stock movement as
   separate evidence related to, but not proved by, a GST note;
6. additive customer/supplier ledger, ITC, output-tax, reporting, IRP, and
   audit evidence; and
7. corrections through new documents or append-only events, never by rewriting
   finalized invoice or note evidence.

The scope does not make a legal conclusion for an unsupported transaction
treatment. Composition, Unregistered, Consumer, Overseas, SEZ, Deemed Export,
UIN, UTGST, non-zero cess, inclusive pricing, and unresolved precision or
rounding branches remain subject to their existing gates. A note workflow must
fail closed when a required fact or approved rule is missing.

## 2. Verified repository baseline

The following is the repository baseline used by this contract. Existing
primitives are not treated as an implemented note workflow.

| Surface | Repository evidence | Contract consequence |
|---|---|---|
| Sales lifecycle | [`sales.actions.ts`](../../src/app/_actions/sales.actions.ts) creates, finalizes, posts stock, posts the customer ledger, records audit, and uses `sales_posting_operations` idempotency/payload hashes. | A note must use the same tenant-qualified transaction, lock, idempotency, and immutable-snapshot discipline without mutating a finalized sale. |
| Purchase lifecycle | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) captures supplier-declared, calculated, and accepted GST evidence; finalizes stock and supplier ledger effects; and guards posting. | Recipient notes must reference the accepted purchase snapshot and preserve declared/calculated/accepted separation. |
| GST arithmetic | [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts) and [`decimal.ts`](../../src/lib/decimal.ts) provide exact-decimal calculation boundaries and component splitting. | Note calculations must reuse the shared decimal boundary and a versioned rounding contract. |
| Ledger | [`ledger-impact.service.ts`](../../src/domain/services/ledger-impact.service.ts) has customer and supplier running-balance services and generic `CREDIT_NOTE`/`DEBIT_NOTE` enum values. | Generic enum values are only primitives. Note posting must add explicit note references, correct balance semantics, and idempotent single-effect guards. |
| Inventory | `StockMovementType` includes `SALES_RETURN_IN` and `PURCHASE_RETURN_OUT`. | These movements are usable only after physical return authorization and inspection; a note alone must never create a movement. |
| Source documents | `sales_invoices`, `sales_invoice_items`, `purchase_invoices`, and `purchase_invoice_items` are tenant-owned and finalized with persisted tax facts. | New note tables must use tenant-safe composite references and `ON DELETE RESTRICT` to historical source evidence. |
| Purchase GST evidence | `purchase_gst_evidence_revisions`, `purchase_gst_line_evidence`, `purchase_gst_calculations`, `purchase_gst_accounting_decisions`, and reconciliation events preserve revision and acceptance history. | Recipient notes must point to the source purchase and its accepted snapshot/revision rather than reconstructing values from mutable product or supplier masters. |
| Audit | `AuditEventType` currently covers invoice, purchase, stock, master-data, and authentication events only. | Note-specific append-only events are required; existing audit events are not sufficient evidence. |
| Authorization | [`constants.ts`](../../src/lib/permissions/constants.ts) defines `PermissionAction`, tenant role mappings, and `hasPermission`. | Additive note capabilities must be separate permissions. Existing sales, purchase, inventory, ledger, or report permission is not an implicit tax-adjustment permission. |
| Reporting | The repository has HSN/GST summary and CSV export surfaces but no verified GSTR-1, CDNR/CDNUR, GSTR-1A, IRP, or IRN workflow. | Reporting and IRP records/adapters are required by the contract; no portal integration may be claimed until independently tested. |
| Tenant security | Actions use tenant-qualified queries and server tenant context; the project separately tracks restricted-runtime and RLS evidence. | Every new table, unique key, FK, policy, permission check, and event must carry tenant identity and be tested under an ordinary restricted runtime role. |

## 3. Legal and portal source register

The source register below records the operative baseline used for contract
design. It deliberately distinguishes source retrieval from qualified
interpretation. Official pages were checked on 2026-11-02 unless a different
date is stated.

| Provision/source | Official source and date | Operative requirement used by this contract | Product requirement | Status |
|---|---|---|---|---|
| CGST Act, 2017, Sections 2(37), 2(38), 15, 16, and 34 | [CBIC Section 15](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section15_v1.00.html), [Section 16](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter5/section16_v1.00.html), and [Section 34](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter7/section34_v1.00.html). Act No. 12 of 2017; enacted 2017-04-12; enforced from 2017-07-01; current consolidated pages accessed 2026-11-02. | Section 34 distinguishes supplier credit notes for excess value/tax, returned goods, deficiencies, and applicable discount grounds, and supplier debit notes for undercharged value/tax. Section 34(2) contains the credit-note return deadline and the `if availed` ITC-reversal/output-tax restriction; Section 34(4) does not import the credit-note cut-off to debit notes. Section 16 makes possession of a supplier invoice/debit note only one ITC condition among several. | Separate credit and debit reason codes, dates, eligibility, recipient ITC evidence, output-tax review, and reporting state. Never treat issuance as automatic tax adjustment or ITC entitlement. | Legal framework verified; application interpretation remains gated where source versions conflict. |
| Section 15(3)(b), Finance Act 2026 Section 153 | [CBIC consolidated Section 15 page](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/active/chapter4/section15_v1.00.html) displays the pre-amendment agreement/invoice-linkage text with a footnote stating that the substitution is “w.e.f. yet to be notified”. [CBIC Notification No. 03/2026-Central Tax](https://taxinformation.cbic.gov.in/view-pdf/1010780/ENG/Notifications), dated 2026-10-26, appoints 2026-11-01 for Finance Act 2026 Sections 153-155. | The primary commencement notification conflicts with the stale consolidated page. The enacted post-supply-discount text must be read with the commencement notification; the precise portal/consolidated-text synchronization is not yet independently reconciled. | Store an effective-dated `gst_note_ruleset_version`. Support both pre-amendment and post-amendment rule definitions, but fail closed for GST-reducing post-supply discounts while the qualified reviewer has not selected the effective ruleset for the transaction date. Do not silently use the old agreement/linkage test or silently activate the new rule. | `CONFLICT — QUALIFIED LEGAL REVIEW AND SOURCE-SYNCHRONIZATION GATE`. This supersedes the earlier assumption that the 2026 amendment was necessarily future-only; it does not claim that product behavior is approved. |
| Finance Act 2025 Section 34(2) amendment and commencement | [CBIC Notification No. 16/2025-Central Tax](https://taxinformation.cbic.gov.in/view-pdf/1010466/ENG/Notifications), dated 2025-09-17, appointing 2025-10-01 for the specified Finance Act 2025 provisions. | The current Section 34 page includes the `if availed` recipient-ITC condition and the output-tax-incidence condition. The notification is Central Tax, not Central Tax (Rate); the similarly numbered rate notification must not be substituted. | Output-tax eligibility is a separate state and evidence review. Recipient reversal is required only where attributable ITC was availed and the applicable rule requires reversal; no blanket reversal may be inferred for a recipient that never availed it. | Commencement source verified; transitional and portal mapping still require professional confirmation. |
| CGST Rule 36 | [CBIC Rule 36](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter5/rule36_v1.00.html), current consolidated page accessed 2026-11-02. | ITC requires prescribed documentary and statutory conditions; a supplier-issued Section 34 debit note is not, by itself, proof that every Section 16 condition is met. | Recipient debit-note processing must record document possession, supplier reporting/communication, receipt, business use, payment/return conditions, blocked-credit review, and the applicable time limit separately. | Current rule page verified; full amendment history and professional application gate remain open. |
| CGST Rule 53(1A) | [CBIC Rule 53](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule53_v1.00.html), current page accessed 2026-11-02. Rule 53(1A) inserted by Notification No. 03/2019-Central Tax dated 2019-01-29 with effect from 2019-02-01, as shown in the official page footnote. | A Section 34 note requires supplier identity, document nature, financial-year-unique serial number no longer than 16 characters, issue date, recipient identity/address/GSTIN or UIN where applicable, one or more original invoice/bill references, taxable value/rate/tax credited or debited, and signature/digital signature. | Header and allocation models must support multiple original invoices, unregistered recipient delivery state/code, tax-head values, and immutable identity snapshots. | Particulars verified; signing/e-sign implementation remains an engineering/professional gate. |
| CGST Rule 59 | [CBIC Rule 59](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter8/rule59_v1.00.html), current consolidated page accessed 2026-11-02. | Outward-supply details include credit/debit notes issued for earlier invoices; current page also describes electronic availability and GSTR-1A interaction. | Persist reporting category, period, original references, amendments, payload, response, and reconciliation independently from document state. | Current rule page verified; portal field/version contract remains to be captured. |
| GSTR-1 CDNR/CDNUR and Table 9C | [GST portal Table 9C guidance](https://tutorial.gst.gov.in/contextualhelp/Einv/CDNRA.htm) and [Table 9B CDNUR guidance](https://tutorial.gst.gov.in/contextualhelp/Einv/CDNUR.htm), accessed 2026-11-02. | Registered-recipient notes use CDNR; unregistered/export cases use CDNUR; amendments to prior notes use Table 9C. Portal guidance permits taxable value zero for certain tax-rate-difference cases and maintains processed/pending records. | Do not map all notes to one report category. Store the exact category and the portal's processed/pending/error response. | Portal guidance verified; complete schema/version mapping remains implementation evidence. |
| GSTR-1A | [GST portal GSTR-1A FAQ](https://tutorial.gst.gov.in/userguide/returns/FAQs_Creation_of_Outward_Supplies_Return_in_GSTR-1A.htm?rhsearch=3B&rhhlterm=3b), accessed 2026-11-02. | Same-period additions/amendments may be made after GSTR-1 and before GSTR-3B; the window is based on the applicable filer/due-date conditions, not the Section 34 credit-note deadline. | Reporting state must distinguish GSTR-1, GSTR-1A, and later amendment/reconciliation; do not use GSTR-1A to extend the statutory credit-note cut-off. | Portal guidance verified; live submission acceptance not implemented. |
| Circular 251/08/2025-GST | [CBIC Circular 251/08/2025-GST](https://taxinformation.cbic.gov.in/view-pdf/1003287/ENG/Circulars), dated 2025-09-12. | Financial/commercial credit notes that do not reduce original taxable value or supplier tax liability do not automatically require recipient ITC reversal. Manufacturer/dealer discounts and separately contracted promotional services must be classified from their actual facts. | A commercial adjustment is a separate document class with no GST effect by issuance. A separate promotional service is assessed as a separate supply only when its contract and consideration support that conclusion. | Circular and date verified; professional fact-pattern review remains required. |
| Circular 253/10/2025-GST | [CBIC Circular 253/10/2025-GST](https://taxinformation.cbic.gov.in/view-pdf/1003292/ENG/Circulars), dated 2025-10-01. | Circular 212/06/2024-GST's prescribed CA/CMA certificate/recipient-undertaking procedure was withdrawn. The withdrawal does not repeal the substantive Section 15/34 conditions. | Do not make the withdrawn procedure a mandatory workflow. Retain generic evidence fields for agreement/rule version, recipient ITC status, supplier reporting, tax-incidence review, and reviewer decision. | Withdrawal verified; remaining evidence standard must be approved by a qualified reviewer. |
| Rule 48(4), Notification 13/2020-CT, Notification 10/2023-CT | [CBIC Rule 48](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule48_v1.00.html), [Notification 13/2020-CT](https://taxinformation.cbic.gov.in/view-pdf/1000623/ENG/Notifications), and [Notification 10/2023-CT](https://taxinformation.cbic.gov.in/view-pdf/1009732/ENG/Notifications). Notification 10/2023 dated 2023-05-10 makes the five-crore threshold effective 2023-08-01. | E-invoicing applicability is based on the notified aggregate-turnover and supply/document class, not merely a tenant toggle. The notified exclusions and later amendments must be evaluated. | Store an applicability decision and source/version. A statutory GST note is submitted to IRP only when the current rule says it is required. A commercial-only adjustment is not submitted as a statutory note. | Threshold and source verified; taxpayer-specific AATO and exclusions remain configuration/professional inputs. |
| Notification 04/2026-CT | [CBIC Notification 04/2026-Central Tax](https://taxinformation.cbic.gov.in/view-pdf/1010781/ENG/Notifications), dated 2026-10-26, effective 2027-01-01. | The official notification expands the notified e-invoice supply classes from 2027-01-01 to include specified reverse-charge supplies from unregistered persons and imports of services. | Treat it as a future effective-dated configuration; do not apply it to a pre-2027 note. | Future rule verified; not current as of 2026-11-02. |
| IRP 30-day advisory | [IRP advisory 270325](https://einvoice1.gst.gov.in/Documents/advisory270325.pdf), issued 2025-03-27 for 2025-04-01 operation. | Taxpayers with AATO of at least Rs. 10 crore cannot report an invoice, credit note, or debit note older than 30 days where IRN reporting is required. This is an IRP submission restriction, not the Section 34(2) credit-note deadline. | Compute and persist `irp_submission_deadline` separately from `gst_adjustment_deadline`; reject late IRP submission before the adapter call and retain the evidence. | Advisory verified; current IRP behavior must be rechecked at implementation. |

### 3.1 Source conflict resolution rule

The official commencement notification is the primary effective-date source for
Finance Act 2026 Sections 153-155, while the CBIC consolidated Section 15 page
has not synchronized its footnote. Until a qualified reviewer records the exact
effective rule version and the portal behavior:

1. the application may create a reviewable draft or a commercial adjustment;
2. it must not post a GST-reducing post-supply discount;
3. it must not claim supplier output-tax reduction or recipient ITC reversal
   eligibility from issuance alone; and
4. the contract must retain both rule candidates and the source conflict in the
   configuration/audit record.

This is a fail-closed product gate, not a decision to disregard the
commencement notification.

## 4. Product taxonomy and non-confusion rules

### 4.1 Document classes

| Class | Original supply/tax value changes? | Tax/reporting effect | Inventory effect | Required object |
|---|---:|---|---|---|
| Statutory GST credit note | Yes, downward where eligible | May reduce supplier output tax after eligibility, evidence, and reporting gates | Only if a separate physical return is accepted | `gst_adjustment_notes` with `CREDIT_NOTE` |
| Statutory GST debit note | Yes, upward where eligible | Increases supplier output tax; recipient ITC remains independently reviewed | Normally none | `gst_adjustment_notes` with `DEBIT_NOTE` |
| Commercial/financial credit adjustment | No | No GST reduction and no automatic ITC reversal | None unless separately agreed | `commercial_adjustments` |
| Commercial debit adjustment | No | No GST increase and no automatic ITC grant | None unless separately agreed | `commercial_adjustments` |
| Physical goods return | Physical quantity changes | May support a GST note, but does not prove one | `SALES_RETURN_IN` or `PURCHASE_RETURN_OUT` after inspection | Return/inspection/inventory objects |
| Internal accounting correction | No statutory supply change | No GST/IRP/reporting effect | None unless separately approved | Append-only journal/correction object |

The UI must present statutory notes and commercial adjustments as different
creation paths, numbering series, permissions, states, reports, and print
templates. A `CREDIT_NOTE`/`DEBIT_NOTE` ledger enum is not a substitute for
this classification.

### 4.2 Statutory reason codes

The first-release reason catalog is:

- `EXCESS_TAXABLE_VALUE`;
- `EXCESS_TAX_CHARGED`;
- `FULL_GOODS_RETURN`;
- `PARTIAL_GOODS_RETURN`;
- `DEFICIENT_GOODS`;
- `DEFICIENT_SERVICES`;
- `QUALIFYING_POST_SUPPLY_DISCOUNT`;
- `UNDERSTATED_TAXABLE_VALUE`;
- `UNDERCHARGED_TAX`;
- `ADDITIONAL_CONSIDERATION`.

The code is a claim requiring evidence, not proof. `QUALIFYING_POST_SUPPLY_DISCOUNT`
requires an effective legal ruleset and approved evidence. A commercial
discount must use `commercial_adjustments` even if its user-facing reason is
similar.

### 4.3 Universal non-automation rules

1. Issuing or receiving a note never proves physical return, inspection,
   recipient ITC reversal, supplier output-tax eligibility, or portal
   acceptance.
2. A supplier debit note never automatically grants recipient ITC.
3. A supplier credit note never silently reduces recipient ITC; the recipient
   must review actual ITC availed, supplier communication/reporting, receipt,
   and applicable Section 16 conditions.
4. A commercial adjustment never changes GST or ITC by issuance alone.
5. A finalized source invoice is immutable. Corrections are new notes, new
   commercial adjustments, or append-only correcting events.
6. A note uses positive component magnitudes plus an explicit document/effect
   direction. The implementation must not encode every business meaning as an
   unexplained negative total.
7. Missing, contradictory, stale, unsupported, or cross-tenant facts block
   approval, issuance, posting, or reporting as applicable.

## 5. Shared transaction and calculation contract

### 5.1 Inputs and snapshots

At draft creation the actor supplies:

- document class and credit/debit direction;
- statutory reason or commercial reason;
- source invoice(s), source line(s), and allocation quantities/values;
- issue date and proposed reporting period;
- issuer and recipient identity;
- POS/supply facts, tax treatment, tax rate/rule version, and tax heads;
- physical return/inspection reference where relevant;
- discount agreement/evidence reference where relevant; and
- idempotency key and client payload.

At approval/issue the service re-reads all source rows under the tenant
transaction, verifies that each source is finalized and eligible, resolves the
effective rule version, recalculates from exact decimals, and stores immutable
snapshots of:

- supplier and recipient identity/address/GSTIN/UIN;
- source invoice number/date and source line values;
- HSN/SAC and effective tax-rule identifiers;
- POS and supply facts;
- taxable value, rate, CGST, SGST/UTGST, IGST, cess, and gross effect;
- legal deadline calculations;
- calculation and rounding contract versions; and
- request payload hash and actor/membership.

The original source's current mutable master data is never used to render or
reconcile an issued note.

### 5.2 Amount and tax-head contract

- Taxable value and every tax head are stored as non-negative decimal
  magnitudes. `CREDIT_NOTE` or `DEBIT_NOTE` and the effect direction determine
  the accounting/reporting sign.
- `CGST`, `SGST`, `UTGST`, `IGST`, and `CESS` are separate fields. A rounded
  aggregate cannot be split into components.
- A note must match the source tax-head policy unless an approved statutory
  correction reason explicitly permits the difference. Inter-state and
  intra-state components cannot be silently swapped.
- Non-zero cess is blocked until the existing cess policy/governance gate is
  closed. A note may not hide unsupported cess in `gst_amount`.
- Inclusive pricing, freight, discount allocation, and statutory rounding
  precedence use their own approved versioned rules. If the applicable rule is
  unresolved, the note remains reviewable but cannot be issued/post tax.

### 5.3 Decimal, rounding, and representation

- Calculation uses the shared exact-decimal service and does not use
  JavaScript binary arithmetic for financial decisions.
- Intermediate calculations retain the service's explicit high-precision
  scale. The note stores `calculation_version`, `rounding_mode`,
  `calculation_scale`, `tax_component_scale`, and a canonical calculation
  payload hash.
- Persisted GST evidence follows the repository's existing `NUMERIC(20,4)`
  evidence convention until a separate T25 precision decision authorizes a
  different scale. Display/reporting/ledger values use the applicable
  two-decimal boundary and explicit `HALF_UP`, never an implicit language or
  database default.
- The note total is reconciled from its persisted line/component snapshot. A
  commercial round-off is a separate field and cannot alter taxable value or
  GST.
- The contract rejects an allocation if source remaining value, quantity,
  tax, or cumulative issued amount is exceeded at the chosen precision.

### 5.4 Dates and deadlines

The model must distinguish:

| Date/period | Meaning |
|---|---|
| `source_invoice_date` | Immutable snapshot of the original source document date. |
| `note_issue_date` | Legal document issue date and numbering/FY input. |
| `gst_adjustment_deadline` | Computed Section 34 eligibility deadline for a credit note; never used for debit-note reporting. |
| `reporting_period` | Return period in which the note is declared. |
| `gstr1a_window_end` | Portal window for same-period GSTR-1A additions/amendments. |
| `irp_submission_deadline` | IRP-specific submission restriction, including the 30-day rule when applicable. |
| `recipient_itc_period` | Recipient return period in which reversal/additional-ITC treatment is reviewed or posted. |
| `accounting_posted_at` | Timestamp of the local ledger effect. |
| `reported_at` / `irn_generated_at` | External acknowledgement timestamps. |

`created_at` is never substituted for a legal or reporting date.

## 6. Supplier-side workflows

### 6.1 Supplier sales GST credit note

**Actor and permission:** A user with `create_gst_note_draft` creates the
draft. `review_gst_note` validates it. `approve_gst_note` approves it.
`issue_gst_note` assigns the immutable number and issues it. The same actor
must not approve and post without an explicitly recorded segregation-of-duties
exception.

**Preconditions**

1. The source sales invoice belongs to the authenticated tenant, is finalized,
   and has persisted tax/source facts.
2. The customer/recipient snapshot is available, and registered/unregistered
   classification is not inferred solely from a GSTIN prefix.
3. The reason is one of the approved statutory grounds.
4. Every affected line and quantity/value allocation is identifiable.
5. The cumulative prior statutory and commercial allocations do not exceed the
   source's eligible amount. Commercial adjustments do not consume statutory
   tax allocation unless the legal rule explicitly links them.
6. The current effective legal, tax, POS, HSN/SAC, and rounding rules are
   available and approved for the source date/note date.

**Validation and approval**

- Re-read the source under a tenant transaction and advisory lock.
- Validate Rule 53 particulars and financial-year-unique note numbering.
- Validate original invoice references, line allocation, tax heads, rate,
  POS, and identity snapshots.
- For a qualifying post-supply discount, validate the effective Section
  15(3)(b) ruleset, agreement/invoice linkage if that version requires it, and
  recipient ITC evidence or review status. Do not make the withdrawn Circular
  212 certificate procedure mandatory.
- For a return, require a separate return/inspection record; the note form
  cannot mark stock received merely because the note is issued.
- For an original invoice already reported or e-invoiced, create reporting/IRP
  obligations and preserve original report/IRN references.

**State transitions**

```text
DRAFT -> VALIDATED -> APPROVED -> ISSUED
ISSUED -> COMMUNICATION_PENDING -> COMMUNICATED
ISSUED -> REPORTING_PENDING / IRP_PENDING
REPORTING_PENDING -> REPORTED or REPORTING_ERROR
IRP_PENDING -> IRN_ACKNOWLEDGED or IRP_REJECTED
```

`ISSUED` is a document state, not proof of output-tax adjustment. The
independent `output_tax_review`, `reporting`, `irp`, `ledger`, and
`inventory_return` states continue separately.

**Effects**

- GST: issue the immutable component snapshot; reduce supplier output tax only
  after the output-tax eligibility and reporting states permit it.
- Commercial: reduce the customer's amount due only when the accounting
  posting transition succeeds.
- Inventory: no movement from the note. A separately accepted return may add
  `SALES_RETURN_IN`; deficiency/discount notes do not change quantity.
- Ledger: one customer ledger credit equal to the accepted gross commercial
  effect, with `reference_type = gst_adjustment_note` and an explicit note FK.
  The source invoice ledger row is never edited.
- Reporting: map registered recipients to CDNR and unregistered/export cases
  to CDNUR; amendments use the note-amendment path/Table 9C. Persist pending
  and rejected attempts.
- Audit: append draft, validation, approval, issue, communication, evidence,
  output-tax decision, reporting, IRP, inventory, ledger, and reconciliation
  events.

**Failure/correction**

- A rejected validation leaves the draft editable and records a reason.
- A rejected IRP or GSTR-1 attempt leaves the note issued but unreported; a
  corrected retry uses a new attempt number and payload hash.
- A post-issue error is corrected with a new note/amendment where legally
  permitted, never by changing the issued number or snapshot.
- If the credit-note deadline or IRP 30-day deadline is passed, the service
  fails closed and records the reason; it does not silently convert the note
  into a commercial adjustment.

**Idempotency/concurrency:** The tenant-scoped idempotency key and canonical
payload hash are unique. A retry with the same hash returns the prior result;
the same key with a different hash is a conflict. The source invoice and
allocation rows are locked while cumulative eligibility and the one-time
ledger/tax effects are checked.

### 6.2 Supplier sales GST debit note

The debit-note workflow shares the document, numbering, allocation, and
snapshot controls but has distinct legal and accounting behavior.

**Supported reasons:** `UNDERSTATED_TAXABLE_VALUE`, `UNDERCHARGED_TAX`, and
`ADDITIONAL_CONSIDERATION`. The service must not apply the Section 34(2)
credit-note cut-off to a debit note.

**Preconditions and validation**

- The original source is finalized and the undercharge is supported by a
  recalculation, contract, delivery/quantity evidence, or other approved
  evidence.
- The additional taxable value and tax-head amounts are positive magnitudes.
- A debit note cannot be used to increase a source line beyond the approved
  contract/actual additional supply without review.
- Tax-head/POS consistency is checked; an inter-state debit note cannot become
  intra-state because a customer master changed.
- Recipient communication and any IRP/reporting obligation are recorded.

**Effects**

- GST: the supplier's output tax increases only after `output_tax_review =
  ELIGIBLE` and reporting/IRP requirements are satisfied.
- Ledger: customer ledger debit equals the accepted gross additional amount.
- Inventory: no stock movement unless a separate additional physical supply
  exists and is independently invoiced/recorded.
- Recipient: the note is available for purchase liability and possible ITC
  review, but no ITC is posted automatically.
- Reporting: declare in the issue month; no Section 34(2) credit cut-off is
  copied to the debit note.

**Correction/cancellation:** An unreported draft may be cancelled by an
authorized actor. An issued note is not deleted. IRP cancellation, if
applicable, follows the current IRP window; after that window an amendment or
replacement path is used only if the legal/portal contract allows it.

## 7. Recipient-side workflows

### 7.1 Recipient purchase GST credit note

**Actor:** The recipient's purchase user records an incoming note with
`receive_gst_note`; a reviewer uses `review_recipient_itc`; an authorized
accounting user uses `post_gst_note_accounting` only after review.

**Preconditions**

1. The recipient tenant has a finalized purchase invoice matching the supplier,
   original invoice number/date, amount, and party snapshot.
2. The incoming note is tied to a supplier document, but supplier issuance is
   not treated as local acceptance.
3. The note's tax components, reason, and source allocations are available.
4. Any physical return is separately authorized, received, inspected, and
   accepted or rejected by quantity.

**Review**

- Match the note to one or more purchase invoices and lines using tenant-safe
  source keys and supplier identity snapshots.
- Check whether the original purchase is posted, included in the recipient's
  ITC records, consumed/sold/transferred, or physically returned.
- Check supplier reporting/communication and relevant statement evidence.
- Determine `ITC_AVAILED`, `ITC_NOT_AVAILED`, `ITC_PARTIALLY_AVAILED`,
  `ITC_NOT_ELIGIBLE`, `ITC_DISPUTED`, or `ITC_PENDING_EVIDENCE`.
- Do not silently reduce ITC on receipt. If attributable ITC was never
  availed, record that fact and do not manufacture a reversal.

**Effects**

- GST/ITC: post only the accepted reversal amount and reviewer evidence. A
  disputed or uncommunicated note remains pending/disputed.
- Commercial: reduce supplier payable only after the accepted accounting
  transition.
- Inventory: a physical return uses `PURCHASE_RETURN_OUT` only for accepted
  quantity; consumed/sold stock does not become negative stock.
- Ledger: one supplier ledger debit for the accepted gross amount, with an
  explicit note reference. The original purchase ledger remains unchanged.
- Reporting/reconciliation: persist the supplier's note number, return period,
  statement match, discrepancy, and resolution.
- Audit: append receipt, match, ITC review, reversal, dispute, posting, and
  reconciliation events.

**Failure/correction:** A mismatch creates a discrepancy case, not an
automatic rejection or posting. A later supplier correction is a new incoming
document/amendment linked to the prior review. Duplicate notes with the same
supplier number, supplier identity, source, and payload hash are idempotent;
different values with the same external number are a conflict.

### 7.2 Recipient purchase GST debit note

**Preconditions**

- The source purchase is finalized and the supplier debit note references it.
- The additional value/tax is supported by supplier communication and
  document evidence.
- Receipt of goods/services, business use, blocked-credit restrictions,
  payment conditions, supplier furnishing/statement evidence, and the
  applicable Section 16(4) time limit are separately reviewed.

**Effects**

- Purchase liability increases only after the recipient accepts the note.
- Potential ITC is recorded as `PENDING_REVIEW` or `ELIGIBLE_FOR_CLAIM`; it is
  not automatically credited because the supplier issued a debit note.
- No stock increase occurs unless the additional supply itself is separately
  received and accepted.
- Supplier ledger credit equals the accepted gross amount; the original
  purchase remains immutable.
- Reporting/matching state records whether the supplier note was furnished,
  communicated, reflected in the relevant statement, disputed, or rejected.

**Dispute/correction:** A missing statement record, duplicate supplier number,
tax-head mismatch, or unsupported receipt keeps the note in review/dispute.
The service must not grant ITC to make the accounting balance convenient.

## 8. Commercial and financial adjustments

`commercial_adjustments` is a distinct object, flow, number series, permission
set, print label, and report category. It may represent:

- a commercial discount;
- goodwill;
- settlement adjustment;
- a financial credit note where original taxable value and supplier GST
  liability remain unchanged; or
- a separately contracted promotional service adjustment only when the facts
  support a separate supply assessment.

**Workflow**

1. Create a commercial draft against one or more commercial source invoices or
   settlement references.
2. Record the commercial reason, amount, currency, agreement/reference, and
   customer/supplier approval.
3. Validate that taxable value, tax components, original GST report, and IRN
   are unchanged.
4. Approve and post only the customer/supplier ledger settlement effect.
5. Reconcile the settlement and append audit evidence.

Commercial issuance must not create a `gst_adjustment_notes` row, CDNR/CDNUR
row, IRP submission, output-tax reduction, or ITC reversal. If a later fact
shows that statutory tax must change, create a statutory note under its own
workflow; do not upgrade the commercial adjustment in place.

## 9. Physical return, inspection, and inventory

A physical return has its own lifecycle:

```text
RETURN_REQUESTED
  -> AUTHORIZED
  -> IN_TRANSIT
  -> RECEIVED
  -> INSPECTED
  -> PARTIALLY_ACCEPTED / ACCEPTED / REJECTED
  -> RESTOCKED / QUARANTINED / REPAIRED / SCRAPPED
```

Each return stores original source line, requested quantity, received
quantity, accepted quantity, rejected/damaged quantity, batch/lot, inspection
actor, inspection reason, stock destination, and linked note ID if one exists.

| Scenario | Inventory rule | GST note rule |
|---|---|---|
| Full return | Restock only the inspected accepted quantity; rejected quantity is quarantined or written off by separate policy. | A full credit note may reference the accepted returned quantity; it cannot exceed it. |
| Partial return | `SALES_RETURN_IN` or `PURCHASE_RETURN_OUT` equals accepted quantity only. | Allocate taxable/tax values to the accepted quantity; remaining source line stays open. |
| Damaged goods returned | Quarantine or approved write-off/restock path is explicit. | Credit note may use returned accepted quantity or deficiency reason; do not infer one from the other. |
| Damaged goods retained | No stock movement. | Deficiency credit note may reduce value/tax only after evidence and approval. |
| Deficient goods, no return | No quantity change. | Credit note uses deficiency reason and evidence. |
| Multiple lots | Allocate each batch/lot inspection separately. | Note allocation may span multiple source lines/lots. |
| Goods consumed/sold | Do not reverse unavailable stock. | Recipient ITC/commercial review is independent of inventory. |
| Part invoice value adjusted | Only allocated lines/quantities change. | Unallocated invoice values and tax remain unchanged. |

Inventory valuation remains governed by the existing approved policy. This
contract does not invent an acquisition-cost or ITC-apportionment rule.

## 10. Worked end-to-end scenarios

All amounts below are illustrative. No HSN/SAC or real statutory rate is
assigned. The examples use an illustrative 18% rate, with 9% CGST and 9% SGST
for an intra-state example and 18% IGST for an inter-state example.

### Scenario A - Full sales return

**Assumptions:** Finalized sales invoice `S-1001`, ten units at illustrative
taxable value Rs. 100 each; taxable Rs. 1,000, CGST Rs. 90, SGST Rs. 90,
gross Rs. 1,180. Customer returns all ten units; inspection accepts all ten.

| Stage | Evidence and state | Effect |
|---|---|---|
| Source | `sales_invoice = FINALIZED`, line snapshot and original customer/POS snapshot | Customer receivable was debited Rs. 1,180; stock was reduced by ten units. |
| Return | `RETURN_REQUESTED -> AUTHORIZED -> RECEIVED -> INSPECTED -> ACCEPTED` | `SALES_RETURN_IN` adds ten units only after inspection. |
| Note | `DRAFT -> VALIDATED -> APPROVED -> ISSUED`, `CREDIT_NOTE`, reason `FULL_GOODS_RETURN`; allocation is ten units | Note snapshot is taxable Rs. 1,000, CGST Rs. 90, SGST Rs. 90; it does not edit `S-1001`. |
| Accounting | Ledger posting succeeds once | Customer ledger credit Rs. 1,180 reduces receivable; output-tax review is separate. |
| Reporting/IRP | CDNR for a registered customer or CDNUR for an eligible unregistered/export case; IRP only if applicable | Reporting/IRP acknowledgements are persisted; the note is not `REPORTED` merely because it was issued. |
| Audit | Source, return, inspection, note, posting, report, and reconciliation events | Evidence proves both the physical return and tax document without conflating them. |

### Scenario B - Partial sales return

**Assumptions:** Invoice `S-1002` has line A, two units at Rs. 150 (taxable
Rs. 300), and line B, three units at Rs. 200 (taxable Rs. 600), all at the
illustrative 18% intra-state rate. One unit of line B is returned and
accepted. The original taxable total is Rs. 900; the note allocation is
taxable Rs. 200, CGST Rs. 18, SGST Rs. 18, gross Rs. 236.

- Return inspection accepts one line-B unit; line A and two line-B units remain
  unchanged.
- The note contains one line allocation, not a negative invoice total.
- Customer ledger credit is Rs. 236; remaining source receivable is reduced
  only by that posted amount.
- `SALES_RETURN_IN` is one unit of line B; no stock movement is created for
  line A.
- CDNR/CDNUR and IRP category are resolved from recipient and applicability
  facts. The note's cumulative allocation guard prevents a second note from
  returning more than the remaining two line-B units.
- Audit records actual returned quantity, accepted quantity, tax allocation,
  ledger reference, and reporting result.

### Scenario C - Deficient goods without return

**Assumptions:** Invoice `S-1003` taxable value Rs. 1,000, CGST Rs. 90, SGST
Rs. 90. A documented defect affects taxable value Rs. 100. The buyer retains
the goods; no physical return is accepted.

- A deficiency evidence record supports a credit note for taxable Rs. 100,
  CGST Rs. 9, SGST Rs. 9, gross Rs. 118.
- No `SALES_RETURN_IN` is created and available quantity is unchanged.
- Customer ledger credit is Rs. 118 only after note accounting posting.
- Supplier output-tax eligibility and recipient ITC review are separate states.
- The note is reported as a statutory note only after its legal reason,
  reporting, and deadline checks pass. The deficiency record is immutable and
  linked to the note.

### Scenario D - Commercial discount

**Assumptions:** The supplier grants a Rs. 50 goodwill settlement after a
finalized invoice. It does not reduce original taxable value or supplier GST
liability.

- Create `commercial_adjustment = CREDIT`, not a statutory GST note.
- Customer ledger credit is Rs. 50; no GST component is stored as credited tax.
- Original invoice, GSTR-1, and IRN remain unchanged.
- Recipient ITC is not automatically reversed.
- No CDNR/CDNUR or IRP submission is created.
- Audit records the agreement/settlement reference and the explicit
  `GST_UNCHANGED` decision.
- If the facts later satisfy a statutory ground, a separate GST credit note
  must be created; the commercial record remains historical evidence.

### Scenario E - Qualifying post-supply discount

**Assumptions:** Original invoice taxable value Rs. 2,000 and tax Rs. 360.
The approved effective rule version permits a Rs. 200 post-supply discount
linked to the original invoice. The recipient availed attributable ITC of
Rs. 36 and reverses it with evidence.

- The service stores the agreement/linkage evidence only if required by the
  selected effective Section 15(3)(b) ruleset, plus the recipient reversal
  evidence and source allocation.
- The GST credit note snapshot is taxable Rs. 200 and tax Rs. 36; gross
  effect Rs. 236.
- Supplier output-tax eligibility becomes `ELIGIBLE` only after evidence and
  deadline checks; issuance alone is not enough.
- Customer ledger credit is Rs. 236; recipient ITC reversal is Rs. 36 only
  after the recipient review/posting transition.
- If the 2026 source conflict is unresolved for the note date, the note
  remains reviewable but cannot be issued as a GST-reducing note; a separate
  commercial adjustment is the only permitted settlement path.

### Scenario F - Non-qualifying post-supply discount

**Assumptions:** A Rs. 200 settlement discount has no qualifying legal
evidence under the effective ruleset, or the required source invoice linkage
is absent.

- Create a Rs. 200 commercial adjustment, not a GST credit note.
- Original taxable value and tax remain unchanged; no tax components are
  credited, no output tax is reduced, and no ITC reversal is automatically
  required.
- Customer/supplier ledger settlement is Rs. 200.
- Audit records the failed statutory qualification and the commercial
  classification. The UI must not offer a “convert to GST note” action without
  restarting statutory validation.

### Scenario G - Supplier debit note

**Assumptions:** Original sale taxable value Rs. 1,000 and tax Rs. 180.
An additional taxable value Rs. 100 and tax Rs. 18 is contractually due.

- Create a statutory debit note with taxable Rs. 100, CGST Rs. 9, SGST Rs. 9,
  gross Rs. 118, linked to the original invoice.
- Customer ledger debit is Rs. 118; the original invoice remains unchanged.
- Supplier output tax increases after reporting/IRP eligibility.
- Recipient records a purchase liability/additional cost review and possible
  ITC of Rs. 18 only after Section 16 evidence, supplier reporting, receipt,
  payment, and blocked-credit checks.
- No stock movement occurs unless the additional supply is separately
  received. The note is reported in the issue month; the credit-note deadline
  is not copied.

### Scenario H - Purchase-side supplier credit note

**Assumptions:** Purchase `P-2001` was posted for taxable Rs. 1,000 and tax
Rs. 180. The supplier issues a credit note for taxable Rs. 200 and tax Rs. 36.
The goods were partly consumed and the note is not yet visible in the
recipient's statement.

- Receive and match the supplier note to `P-2001`; keep it
  `ITC_PENDING_EVIDENCE` or `DISPUTED` while statement/communication evidence
  is missing.
- No stock quantity is reduced because no accepted physical return exists.
- If the recipient had availed attributable ITC Rs. 36, a reviewer may approve
  reversal with evidence. If it had not been availed, record `NOT_AVAILED` and
  do not create a reversal.
- Supplier ledger debit is Rs. 236 only after commercial/accounting acceptance.
- A supplier reporting discrepancy creates a reconciliation case; it does not
  silently reduce ITC or payable.
- A later supplier amendment is linked as a new document/event.

### Scenario I - Multiple notes and multiple invoices

**Assumptions:** Invoice `S-3001` has three eligible source allocations and
invoice `S-3002` has two. Credit note `CN-1` allocates Rs. 100 taxable from
`S-3001` line 1 and Rs. 50 taxable from `S-3002` line 2. A later `CN-2`
allocates Rs. 75 taxable from `S-3001` line 1.

- `CN-1` has two source-document rows and two line allocations. `CN-2` has a
  separate source-document row and cannot reuse more than the remaining
  eligible amount from `S-3001` line 1.
- Each note has its own financial-year-unique number, tax-component snapshot,
  approval, reporting, and ledger effect.
- The cumulative allocation query is locked per source line. A duplicate
  supplier number or repeated idempotency hash is rejected/replayed safely.
- A third note that would exceed the original line value is `REJECTED` with
  no ledger, inventory, ITC, output-tax, or reporting side effect.
- Reconciliation reports source amount, cumulative statutory amount,
  commercial amount, remaining amount, and any disputed amount separately.

### Scenario J - Rejected IRP or GSTR-1 reporting

**Assumptions:** A valid issued credit note is submitted to IRP or GSTR-1,
but the external service rejects the payload for a correctable field error.

- Document state remains `ISSUED`; `irp_state = REJECTED` or
  `reporting_state = REPORTING_ERROR`; output-tax adjustment is not marked
  reported/accepted solely because local issuance succeeded.
- The immutable failed attempt stores endpoint/provider, attempt number,
  idempotency key, payload hash, request metadata, response code, and
  sanitized response.
- A correction creates a new attempt with the corrected canonical payload.
  Replaying the same corrected payload returns the prior successful attempt;
  submitting a different payload under the same idempotency key is a conflict.
- On success, store IRN/acknowledgement or reporting reference and transition
  only that external state to `ACKNOWLEDGED`/`REPORTED`.
- Accounting/output-tax posting uses a separate guarded effect and cannot
  double-post when the reporting callback is retried.
- Audit records failure, correction, retry, success, and final reconciliation.

## 11. Additive conceptual data model

This is a conceptual design only. It is not Prisma schema or migration SQL.
Names are proposed to make ownership and state dimensions explicit.

### 11.1 Entities and relationships

| Entity | Purpose and important fields | Tenant/keys/immutability |
|---|---|---|
| `gst_adjustment_notes` | Statutory note header: `id`, `tenant_id`, `document_class = STATUTORY_GST`, `note_type`, `reason_code`, `note_number`, `financial_year`, `issue_date`, `reporting_period`, issuer/recipient IDs, `status`, `calculation_version`, `rounding_version`, aggregate snapshots, deadlines, idempotency hash. | `@@unique([tenant_id, note_number, financial_year])`; tenant-owned; number, issue date, source class, and issued snapshots immutable after `ISSUED`. |
| `gst_adjustment_note_lines` | Note lines with product/service snapshot, description, source line identity, quantity, unit/value allocation, rate, taxable, CGST, SGST/UTGST, IGST, cess, line total, and calculation hash. | Tenant-owned; immutable after issue; positive magnitude fields plus explicit effect direction. |
| `gst_adjustment_note_source_documents` | One row per referenced `sales_invoices` or `purchase_invoices`, with source kind, source header ID, original number/date snapshot, source status, and source hash. | Use separate nullable tenant-safe FKs for sales/purchase, with a check that exactly one is set. Supports one note to many invoices and many notes to one invoice. `ON DELETE RESTRICT`. |
| `gst_adjustment_note_source_allocations` | Links a note line to an original invoice line and stores allocated quantity, taxable value, each tax head, remaining-before/after, and allocation basis. | Separate sales-line and purchase-line composite FKs; unique `(tenant_id, note_line_id, source_line_id)`; cumulative over-allocation rejected under lock. |
| `gst_adjustment_note_party_snapshots` | Immutable issuer/recipient name, address, GSTIN/UIN, registration classification, state/code, and evidence status. | Tenant-owned; source master changes do not change snapshots. |
| `gst_adjustment_note_tax_snapshots` | Versioned POS, tax treatment, HSN/SAC, rate rule, component policy, cess policy, taxable/tax components, precision/rounding metadata, and canonical payload hash. | Tenant-owned and immutable; source and rule IDs are retained alongside copied values. |
| `gst_adjustment_note_output_tax_reviews` | `eligibility_status`, legal basis, deadline, ITC availed status, incidence-passed status, evidence references, reviewer, decision/reason, decided time. | One-to-one or versioned review rows; never a boolean on the header; append corrections. |
| `gst_adjustment_note_itc_reviews` | Recipient-side review: document possession, supplier communication, statement match, receipt, payment, business use, blocked-credit status, ITC availed amount, reversal/additional-ITC amount, review status, reviewer/evidence. | Tenant-owned recipient evidence; immutable decisions with append-only superseding revisions. |
| `gst_adjustment_note_return_refs` | Return authorization, receipt, inspection, accepted/rejected quantity, batch/lot, and linked stock movement references. | Explicit FKs to return/inspection/movement objects; note does not prove return. |
| `gst_adjustment_note_inventory_refs` | Accepted stock movement ID, movement kind, quantity, batch, valuation policy version, and posting status. | One movement effect per accepted allocation; idempotent and tenant-safe. |
| `gst_adjustment_note_ledger_refs` | Customer/supplier ledger entry IDs, effect direction, accepted amount, posting operation, and reversal/correction link. | One ledger effect per posting state; source invoice ledger row is never updated. |
| `gst_adjustment_note_reporting_attempts` | Provider, return period, category (`CDNR`, `CDNUR`, `TABLE_9C`, `GSTR1A`), attempt number, payload/hash, status, response/error, submitted/acknowledged times. | Append-only; unique `(tenant_id, note_id, provider, payload_hash)`; sanitized response only. |
| `gst_adjustment_note_irp_attempts` | Applicability decision, AATO/rule version, document type, IRP endpoint, attempt, payload/hash, IRN, ack/QR/signature evidence, status, cancellation state. | Append-only; no update to a successful payload; IRN cancellation and amendment states separate. |
| `gst_adjustment_note_events` | Append-only state/event history with actor, membership, previous/new state, reason, evidence hash, request ID, and timestamp. | Tenant-owned and immutable; source and note history are `ON DELETE RESTRICT`. |
| `gst_adjustment_note_idempotency` | Operation name, idempotency key, canonical payload hash, result reference, status, and expiry/retention policy. | Unique `(tenant_id, operation, idempotency_key)`; conflict on hash mismatch. |
| `commercial_adjustments` | Separate commercial-only header, lines, source references, reason, amount, settlement state, and `GST_UNCHANGED` decision. | Must not FK to statutory-note state tables; may reference source invoice and ledger with explicit class. |

### 11.2 Source references and cross-tenant prevention

The source model must not use a single unconstrained `source_id` for both sales
and purchases. It must use actual composite references:

```text
(tenant_id, sales_invoice_id)
  REFERENCES sales_invoices(tenant_id, id)

(tenant_id, sales_invoice_item_id)
  REFERENCES sales_invoice_items(tenant_id, sales_invoice_id, id)

(tenant_id, purchase_invoice_id)
  REFERENCES purchase_invoices(tenant_id, id)

(tenant_id, purchase_invoice_item_id)
  REFERENCES purchase_invoice_items(tenant_id, purchase_id, id)
```

The exact target keys must be verified in the live schema before migration.
If a target composite key is absent, migration stops; it does not weaken the
FK or fall back to an application-only check. Every note table receives the
same tenant-scoped RLS, active-membership, and permission guards as the
project's approved database design. `ON DELETE RESTRICT` applies to source
invoices, source lines, note allocations, immutable snapshots, events, and
posting references.

### 11.3 Numbering and financial year

- Numbering is per tenant, document class, note type/series, and financial
  year.
- The number is at most 16 characters and uses only the permitted configured
  alphabet, numerals, hyphen, and slash.
- A sequence reservation and note issue occur in one transaction. A failed
  issue does not leave a usable issued number or partial financial effect.
- Gaps caused by a rolled-back reservation are retained as reserved/audited
  sequence events rather than reused silently.
- A source invoice's number is never reused as the note number.

### 11.4 Deletion and correction policy

Drafts may be cancelled under permission before issue if no external or
financial effect exists. Issued notes, source allocations, snapshots,
reporting/IRP attempts, ITC evidence, ledger references, inventory references,
and events are never hard-deleted. A legal correction is a new note,
amendment, or append-only superseding review. Administrative retention or
anonymization must preserve the evidence hash and tenant relationship.

## 12. Independent state machines

These are separate state dimensions. A universal `status` field is prohibited.
Every transition executes within a tenant transaction, checks the required
permission and source state, records an event, and either commits all local
effects or commits none.

| Machine | States | Transition contract |
|---|---|---|
| Draft note | `DRAFT`, `VALIDATED`, `REJECTED`, `CANCELLED` | Creator saves/edit; validator checks source, allocation, particulars, rule version, and hash; rejection is editable; cancellation is only before issue. |
| Approved note | `PENDING`, `APPROVED`, `REJECTED`, `SUPERSEDED` | Reviewer with `approve_gst_note` confirms evidence, separation of duties, and totals; a changed payload returns to `DRAFT`; approval is not issue or posting. |
| Issued note | `NOT_ISSUED`, `ISSUED`, `VOIDED` | Issuer with `issue_gst_note` reserves number and freezes snapshot; voiding is only through an approved legal/portal path and never deletes history. |
| Delivered/communicated | `PENDING`, `SENT`, `ACKNOWLEDGED`, `DELIVERY_FAILED`, `DISPUTED` | Communication adapter or manual evidence records recipient delivery; retry uses idempotency; delivery does not prove acceptance/ITC. |
| IRP submission | `NOT_APPLICABLE`, `PENDING`, `SUBMITTING`, `ACKNOWLEDGED`, `REJECTED`, `RETRYABLE_ERROR`, `CANCEL_PENDING`, `CANCELLED` | Applicability resolver records rule/AATO/exclusion; submitter uses `submit_gst_note_irp`; every attempt is immutable; retry only with same/different hash rules. |
| IRN generated | `NOT_GENERATED`, `GENERATED`, `CANCELLATION_ELIGIBLE`, `CANCELLED`, `AMENDMENT_REQUIRED` | IRN and signed response are stored; cancellation follows current IRP window; no in-place IRP amendment is assumed. |
| IRP rejected | `NOT_REJECTED`, `REJECTED`, `CORRECTION_DRAFTED`, `RESUBMITTED`, `RESOLVED` | Rejection creates a correction task; a new payload is validated before resubmission; a rejected attempt never counts as reporting success. |
| GSTR-1 reporting | `NOT_REQUIRED`, `PENDING`, `SUBMITTED`, `PROCESSED`, `REJECTED`, `RETRYABLE_ERROR`, `RECONCILED` | Reporter chooses CDNR/CDNUR/9C from facts; response and portal category are stored; `PROCESSED` is required before reconciliation. |
| GSTR-1 rejection/error | `NONE`, `ERROR`, `CORRECTION_REQUIRED`, `RESUBMITTED`, `CLEARED` | Error details are sanitized and retained; correction cannot mutate the original attempt; retries are idempotent. |
| Amendment | `NOT_AMENDED`, `REQUESTED`, `APPROVED`, `SUBMITTED`, `ACCEPTED`, `REJECTED` | Amendment references the original note and reason; it creates a new immutable payload/attempt; the original remains visible. |
| Cancellation | `NOT_CANCELLED`, `REQUESTED`, `APPROVED`, `SUBMITTED`, `ACCEPTED`, `REJECTED`, `NOT_PERMITTED` | Cancel actor must have `cancel_gst_note`; legal/IRP/reporting windows and existing effects are checked; a cancelled record is not deleted. |
| Recipient ITC review | `NOT_REQUIRED`, `PENDING`, `MATCHED`, `NOT_AVAILED`, `AVAILED_PENDING_REVERSAL`, `ELIGIBLE_FOR_REVIEW`, `DISPUTED`, `REJECTED`, `ACCEPTED` | Reviewer records each Section 16/document/statement/receipt/payment condition; supplier issuance never transitions this machine automatically. |
| Recipient ITC reversal | `NOT_REQUIRED`, `PENDING`, `APPROVED`, `POSTED`, `REJECTED`, `REVERSED`, `SUPERSEDED` | `record_recipient_itc_reversal` posts only the approved attributable amount; if ITC was not availed, the state is `NOT_REQUIRED`, not a zero-value fake posting. |
| Supplier output-tax eligibility | `NOT_REVIEWED`, `ELIGIBLE`, `INELIGIBLE`, `PENDING_EVIDENCE`, `DISPUTED`, `SUPERSEDED` | `approve_supplier_output_tax_adjustment` checks reason, deadline, `if availed` ITC status, incidence, reporting, and effective legal ruleset; issuance alone cannot set `ELIGIBLE`. |
| Inventory return | `NOT_REQUIRED`, `REQUESTED`, `AUTHORIZED`, `RECEIVED`, `INSPECTED`, `PARTIALLY_ACCEPTED`, `ACCEPTED`, `REJECTED`, `RESTOCKED`, `QUARANTINED`, `SCRAPPED` | Inventory actor controls physical states; stock movement is created exactly once for accepted quantity; note and return states remain independent. |
| Ledger posting | `NOT_REQUIRED`, `PENDING`, `POSTING`, `POSTED`, `CONFLICT`, `ROLLED_BACK`, `REVERSED` | Accounting actor posts one signed effect using note idempotency/payload hash and advisory lock; failure rolls back all local effects; reversal is a new controlled effect. |
| Settlement | `OPEN`, `PARTIALLY_SETTLED`, `SETTLED`, `DISPUTED`, `WRITTEN_OFF` | Payment/settlement is distinct from note issue and ledger posting; allocations are explicit and retry-safe. |

### 12.1 Transition evidence contract

For every row above the implementation must record:

- initiating actor, authenticated user, tenant, and membership;
- required permission and separation-of-duties result;
- previous state and new state;
- source/note revision and payload hash;
- validation result and evidence references;
- local side effects (ledger, stock, ITC, output tax, report, IRP);
- external request/response identifiers when applicable;
- failure reason and retryability; and
- whether a new corrective transition is permitted.

## 13. Permission and segregation-of-duties contract

The current `PermissionAction` enum has no note-specific permissions. The
implementation must add capabilities using the existing snake_case convention
and store assignments through `role_permissions`. It must not infer them from
`create_invoice`, `finalize_invoice`, `create_purchase`, or `finalize_purchase`.

### 13.1 Required capabilities

| Capability | Required use |
|---|---|
| `create_gst_note_draft` | Start a statutory note draft. |
| `edit_gst_note_draft` | Edit only an unissued draft. |
| `view_gst_note` | View note, source, evidence, and state. |
| `review_gst_note` | Validate source allocations, tax, particulars, and evidence. |
| `approve_gst_note` | Approve a validated note under separation of duties. |
| `issue_gst_note` | Reserve number and freeze/issue the note. |
| `amend_gst_note` | Create and submit an amendment/correction. |
| `cancel_gst_note` | Request/approve permitted cancellation. |
| `post_gst_note_accounting` | Post customer/supplier ledger and settlement effects. |
| `review_recipient_itc` | Review supplier note and Section 16 evidence. |
| `record_recipient_itc_reversal` | Approve/post an attributable ITC reversal or record not-availed outcome. |
| `approve_supplier_output_tax_adjustment` | Decide supplier output-tax eligibility. |
| `manage_gst_note_return` | Authorize/inspect physical returns and stock effects. |
| `submit_gst_note_reporting` | Submit or record GSTR-1/GSTR-1A attempts. |
| `reconcile_gst_note_reporting` | Reconcile portal response and source books. |
| `submit_gst_note_irp` | Submit and reconcile IRP/IRN attempts. |
| `view_gst_note_compliance` | View ITC, output-tax, reporting, IRP, and audit evidence. |
| `manage_gst_note_configuration` | Maintain effective-dated rule, series, and provider configuration. |

### 13.2 Role assignment boundary

No new system role is required by this contract. Tenant `roles` receive
explicit capabilities:

- billing users may create/edit/view drafts and receive source documents, but
  do not automatically receive approval, output-tax, ITC, IRP, or posting
  permission;
- inventory users may manage return/inspection states but cannot issue a
  statutory tax note solely because stock was received;
- manager/accounting users may review/approve/output-tax/ITC/report/reconcile
  according to the tenant's approved segregation matrix;
- admin receives the existing catalog-level capabilities, but state guards
  still prevent one actor from silently approving and posting the same note
  unless a recorded owner-approved exception exists.

Every action checks active membership, tenant ID, explicit capability, source
ownership, and state transition. The permission matrix is part of CDN-22
acceptance; it is not complete when only the enum is added.

## 14. Accounting, inventory, tax, reporting, and reconciliation contract

### 14.1 Ledger effect matrix

| Event | Customer ledger | Supplier ledger | GST/ITC |
|---|---|---|---|
| Supplier sales GST credit note | Credit accepted gross effect | None | Output-tax review and reporting separate |
| Supplier sales GST debit note | Debit accepted gross effect | None | Output-tax increase/reporting separate |
| Recipient purchase GST credit note | None | Debit accepted gross effect | ITC reversal only after review; no automatic reduction |
| Recipient purchase GST debit note | None | Credit accepted gross effect | Additional ITC only after Section 16 review |
| Commercial customer credit | Credit commercial amount | None | No GST/ITC effect |
| Commercial supplier credit | None | Debit commercial amount | No GST/ITC effect |

The sign and entry type are explicit. Existing ledger services must be
extended or wrapped so a supplier credit note correctly reduces payable; a
generic `CREDIT_NOTE` enum alone does not establish that behavior.

### 14.2 Reporting and IRP

The provider-independent reporting boundary must expose:

```text
prepare(note, reporting_context) -> canonical payload + hash
submit(attempt) -> accepted/rejected response
reconcile(attempt, external_state) -> reconciliation result
amend(note, correction) -> new immutable attempt
cancel(note, cancellation_context) -> accepted/rejected/not-permitted
```

The adapter must never accept a commercial adjustment as a statutory note
payload. `CDNR`, `CDNUR`, `TABLE_9C`, and `GSTR1A` remain separate categories.
IRP applicability is calculated from taxpayer AATO, supply/document class,
effective date, and notified exclusion. The IRP 30-day deadline is stored
separately from the Section 34 credit-note deadline.

### 14.3 Reconciliation

A reconciliation view/report must show, for each note:

- source invoice/line amount and cumulative allocated amount;
- statutory note amount, commercial adjustment amount, and remaining source
  amount separately;
- supplier issue/recipient receipt/statement match;
- output-tax eligibility and ITC review/reversal states;
- ledger posting references and amount;
- accepted inventory quantity versus note quantity;
- GSTR-1/GSTR-1A category, period, attempt status, and external reference;
- IRP applicability, IRN, cancellation/amendment state; and
- unresolved discrepancies, owner, next action, and evidence hash.

## 15. CDN-01-CDN-27 acceptance matrix

This is a separate note-contract denominator. It must not alter or be added to
the existing 25-row DGM-T25/DGM acceptance matrix.

`Contract coverage` measures whether this document specifies a requirement.
`Implementation/acceptance` measures code, schema, runtime, and independent
evidence. Because this campaign is documentation-only, every row is
`NOT IMPLEMENTED / NOT VERIFIED` unless a future campaign supplies direct
evidence. The weighted implementation score is therefore **0/100 (0%)**.
The contract coverage score is **100/100 (100%)** and is not an acceptance
claim.

| ID | Weight | Testable acceptance criterion | Contract coverage | Implementation/acceptance status | Required evidence |
|---|---:|---|---|---|---|
| `CDN-01` | 3 | Statutory GST notes, commercial adjustments, physical returns, and internal corrections are distinct document classes and cannot cross-post implicitly. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | UI/service/schema separation and negative cross-class tests |
| `CDN-02` | 4 | Supplier credit-note grounds support excess value/tax, full/partial return, deficiency, and qualifying discount with reason-specific evidence. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Pure validation plus isolated supplier CN run |
| `CDN-03` | 3 | Supplier debit notes support undercharged value/tax/additional consideration without importing the credit-note cut-off. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Isolated debit-note run and date-boundary tests |
| `CDN-04` | 5 | One note can reference multiple original invoices and lines through tenant-safe source and allocation rows. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Schema catalog evidence and multi-invoice runtime run |
| `CDN-05` | 4 | Multiple notes against one source cannot cumulatively exceed eligible quantity/value/tax under concurrency. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Lock/concurrency evidence and over-allocation rejection |
| `CDN-06` | 4 | Recipient purchase credit notes require match, receipt/statement evidence, ITC status, and explicit acceptance before posting. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Recipient CN scenarios including not-availed ITC |
| `CDN-07` | 4 | Recipient purchase debit notes never grant ITC without independent Section 16 review and evidence. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Debit-note ITC-negative tests and review evidence |
| `CDN-08` | 3 | Commercial/financial adjustments cannot create GST tax, ITC, CDNR/CDNUR, or IRP effects. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Cross-class negative tests and ledger evidence |
| `CDN-09` | 4 | Physical returns have authorization/receipt/inspection/accepted-quantity states and a note cannot prove a return. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Return/inventory/note split run |
| `CDN-10` | 4 | POS, tax treatment, CGST, SGST/UTGST, IGST, cess, HSN/SAC, and rate-rule snapshots are persisted and tax heads remain consistent. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Component/policy tests and persisted snapshot query |
| `CDN-11` | 4 | Exact-decimal calculations, explicit scale/mode/version, no premature rounding, and separate round-off are enforced. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Decimal midpoint, mixed-rate, and persistence tests |
| `CDN-12` | 4 | Issued source and note snapshots are immutable; corrections use a new document/event. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Restricted-role update rejection and correction run |
| `CDN-13` | 3 | Note numbering is tenant- and financial-year-unique, no longer than 16 permitted characters, and transactionally reserved. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Sequence/catalog evidence and rollback test |
| `CDN-14` | 4 | Supplier output-tax eligibility is a separate guarded state requiring reason, deadline, ITC/incidence evidence, and reporting. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Eligibility negative/positive scenarios |
| `CDN-15` | 5 | Recipient ITC review distinguishes availed/not-availed/pending/disputed/reversed and never uses a single boolean. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | ITC evidence state matrix and audit query |
| `CDN-16` | 4 | Customer/supplier ledger effects are additive, correct in direction, linked to the note, and single-effect idempotent. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Ledger amount/hash/retry evidence |
| `CDN-17` | 3 | Accepted inventory quantities are driven only by inspected return evidence and existing valuation policy. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Stock movement and valuation policy evidence |
| `CDN-18` | 4 | GSTR-1 CDNR/CDNUR mapping is fact-specific, persisted, and reconciled independently of note issue. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Provider payload/category and reconciliation evidence |
| `CDN-19` | 2 | GSTR-1A same-period amendment/addition is distinct from Section 34 timing and Table 9C amendment. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Reporting state transition tests |
| `CDN-20` | 4 | IRP applicability uses current AATO/supply/exclusion rules; commercial notes are excluded; required statutory notes carry IRN evidence. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Applicability matrix and IRP adapter run |
| `CDN-21` | 3 | IRP retry, rejection, IRN, cancellation, and reconciliation preserve immutable attempts and enforce current deadlines. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Rejected/retry/idempotency and cancellation evidence |
| `CDN-22` | 3 | Note creation, approval, issue, output-tax, ITC, inventory, ledger, reporting, IRP, and compliance permissions are distinct and SOD-guarded. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Permission/RLS matrix and negative authorization tests |
| `CDN-23` | 4 | All note objects and source references are tenant-scoped, composite-FK protected, RLS-covered, and cross-tenant access fails closed. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Catalog/RLS/restricted-role evidence |
| `CDN-24` | 3 | Idempotency keys, payload hashes, advisory locks, and transaction rollback prevent duplicate note effects and partial posting. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Concurrency/retry/rollback campaign |
| `CDN-25` | 3 | Append-only audit events capture actor, membership, state, evidence, payload hash, external IDs, and correction history. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Audit completeness and immutable-history evidence |
| `CDN-26` | 5 | Scenarios A-J pass, including full/partial return, deficiency, commercial discount, qualifying/non-qualifying discount, supplier debit, recipient credit/debit, multiple notes, and rejected reporting. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Full isolated application-path evidence |
| `CDN-27` | 4 | Effective-dated legal/portal configuration, professional confirmations, migration gates, rollout/rollback controls, and source conflict handling are enforced. | `DOCUMENTED` | `NOT IMPLEMENTED / NOT VERIFIED` | Config catalog, approval records, migration preflight, and release sign-off |
| **Total** | **100** |  | **100/100** | **0/100 (0%)** | Independent acceptance package |

## 16. Configuration and effective-date register

These values must be data/configuration with source and approval metadata, not
unreviewed constants in action code:

| Configuration | Required fields | Fail-closed condition |
|---|---|---|
| `gst_note_ruleset_version` | Version, effective from/to, source URL, provision, approved-by, status | No matching version for note/source date or conflicting active versions |
| `section34_credit_deadline_rule` | FY anchor, 30-Nov/annual-return calculation, transitional rule, source | Date cannot be derived with evidence |
| `post_supply_discount_rule` | Agreement/linkage requirement, ITC evidence requirement, legal effective date | Source conflict or no qualified approval |
| `note_reason_catalog` | Code, direction, required evidence, allowed source class | Reason has no approved evidence contract |
| `note_number_series` | Tenant, document class, series, FY, max length, permitted characters, next sequence | Collision, invalid format, or sequence transaction failure |
| `tax_component_policy` | POS, rate, component split, cess support, HSN/SAC/rule version | Missing/ambiguous/expired rule |
| `reporting_category_map` | Recipient class, supply class, CDNR/CDNUR/9C/GSTR1A category, effective date | No exact portal mapping |
| `irp_applicability` | AATO, preceding FY, supply/document class, exclusions, effective date | Missing taxpayer data or outdated rule |
| `irp_deadline` | 30-day rule, AATO threshold, note date, implementation date | Deadline cannot be calculated |
| `itc_review_policy` | Evidence types, availed/not-availed handling, review authority, blocked-credit rules | Policy does not distinguish availed from not availed |
| `sod_policy` | Create/review/approve/issue/post actor separation and exception authority | Same actor performs incompatible transitions without approved exception |

Configuration changes are versioned and audited. A new legal source version
does not rewrite historical notes; it applies only from its effective date.

## 17. Professional confirmation and release gates

The existing Q-17 through Q-25 records remain the professional/accounting gate
register. The contract maps them as follows:

| Question | Required confirmation before implementation acceptance |
|---|---|
| Q-17 | Statutory grounds, date/cut-off, Rule 53 particulars, Rule 59/portal mapping, and Finance Act commencement/transitional interpretation |
| Q-18 | Effective post-supply-discount rule, agreement/linkage status, recipient evidence, and Circular 253 consequence |
| Q-19 | ITC possession, communication, receipt, payment, blocked-credit, availed/not-availed, reversal, and additional-ITC handling |
| Q-20 | Multiple original references, allocation basis, numbering/FY uniqueness, and cumulative adjustment policy |
| Q-21 | Customer/supplier ledger, settlement, physical return, stock, and unresolved valuation policy |
| Q-22 | GSTR-1 CDNR/CDNUR/9C/GSTR-1A fields, IRP applicability, IRN/cancellation/amendment, and 30-day restriction |
| Q-23 | Statutory versus commercial taxonomy and separate promotional-service treatment |
| Q-24 | Immutable history, correction, amendment, cancellation, retention, and audit requirements |
| Q-25 | Release gate, evidence package, restricted-runtime acceptance, independent review, and production authorization |

Owner scope approval is already recorded. It does not close these gates. The
implementation campaign must record the professional reviewer, source version,
decision date, and exact changed rule before enabling any previously blocked
branch.

## 18. Implementation sequence and verification plan

This sequence is an implementation plan, not execution authorization:

1. **Close source/configuration gates.** Reconcile the Finance Act 2026
   commencement conflict, confirm current Rule 48/IRP/portal behavior, and
   record effective-dated rules.
2. **Add domain types and provider-independent services.** Implement taxonomy,
   reason/evidence contracts, allocation calculator, tax snapshot, date
   calculator, and separate state dimensions without changing existing
   invoice behavior.
3. **Add additive schema under the rollout review.** Verify composite parent
   keys, create note/commercial/return/evidence/attempt/event/idempotency
   objects, apply `ON DELETE RESTRICT`, and stop on catalog conflicts.
4. **Add RLS and permissions.** Add tenant policies, grants, explicit
   capability checks, SOD guards, immutable-history protections, and
   restricted-role negative tests.
5. **Implement supplier workflows.** Draft, validate, approve, issue, output
   tax review, customer ledger, reporting, IRP, and reconciliation.
6. **Implement recipient workflows.** Receive/match, ITC review/reversal,
   supplier ledger, discrepancy, statement matching, and reconciliation.
7. **Implement physical return and commercial workflows.** Keep stock and
   commercial settlement separate from statutory tax effects.
8. **Implement adapters.** Add provider-independent GSTR-1/GSTR-1A and IRP
   attempt persistence; no portal success is claimed before integration
   evidence.
9. **Run focused tests.** Cover pure decimal/allocation/state/permission
   contracts and negative non-confusion cases.
10. **Run isolated application acceptance.** Execute scenarios A-J with a
    disposable database, ordinary restricted runtime role, RLS, concurrency,
    rollback, idempotency, ledger, stock, reporting, IRP, and immutable
    history evidence.
11. **Independent acceptance and release.** Review CDN-01-CDN-27 separately
    from DGM-T25, then obtain explicit production authorization. Live Supabase
    migration and production release remain NO-GO until their own gates pass.

## 19. Explicit non-goals and deferred boundaries

- This campaign does not implement code, tests, Prisma models, SQL, migrations,
  database changes, runtime campaigns, portal calls, or production changes.
- The existing DGM-T25 25-row denominator and evidence JSON are unchanged.
- The contract does not claim GSTR-1, GSTR-3B, GSTR-2B, IRP, IRN, e-invoice,
  or filing integration exists today.
- E-way bills, RCM, export/SEZ/deemed-export, composition, consumer,
  unregistered, UIN, multi-GSTIN, credit/debit note financing, and statutory
  filing automation beyond the defined adapter boundary are not silently
  enabled.
- The contract does not create an ITC approval rule from a supplier document.
- The contract does not create a stock movement from a tax note.
- The contract does not invent freight/discount allocation, cess, inclusive
  pricing, inventory acquisition-cost, or statutory rounding policy.
- No historical invoice or purchase is rewritten to fit the note design.

## 20. References

- [Domestic GST Modernization](./domestic-gst-modernization.md)
- [GST Schema Rollout Design Review](./gst-schema-rollout-design-review.md)
- [GST Accounting Decision Question Pack](./gst-accounting-decision-question-pack.md)
- [GST Audit Validation and Plan](./gst-audit-validation-and-plan.md)
- [GST Modernization Implementation Tracker](./gst-implementation-tracker-2026-10-31.md)
- [GST Decision Closure and Engineering Contract Approval](./gst-decision-closure-and-engineering-contract-approval.md)
- [GST Precision and Rounding Engineering Contract](../decisions/0009-gst-precision-rounding-engineering-contract.md)
- [GST calculation/treatment acceptance evidence](./gst-calculation-treatment-acceptance-evidence-2026-11-01.json)
