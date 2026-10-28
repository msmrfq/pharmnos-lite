# Pharmnos Lite GST Master Specification

**Status:** `PROPOSED MASTER REFERENCE — READY FOR OWNER REVIEW`
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION
**Last revised:** 2026-10-28 21-20-00 (IST)
**Authority:** Project owner approval remains required. This document consolidates
the current evidence and recorded product decisions; it does not itself grant
implementation, migration, testing, pilot, or production authorization.

> **Status labels**
>
> - `OWNER-APPROVED`: explicitly recorded product-owner decision. This is not
>   necessarily accounting, legal, security, or engineering approval.
> - `EXISTING-REQUIREMENT`: requirement recorded in an existing project source.
> - `CURRENT-IMPLEMENTATION`: behavior observed in the repository.
> - `PROPOSED`: recommended behavior not yet approved.
> - `UNRESOLVED`: evidence or decision is insufficient.
> - `LEGAL/ACCOUNTING-CONFIRMATION`: requires qualified professional or
>   authoritative source confirmation.

## 1. Purpose, authority, and scope

This is the consolidated reference for GST-related requirements and intended
behavior in Pharmnos Lite. It covers:

- Business, customer, supplier, product, and transaction GST facts.
- Purchase supplier-invoice evidence and reconciliation.
- Sales tax calculation and captured supply facts.
- Place of supply and jurisdiction-code handling.
- Tax-component persistence, invoice snapshots, and finalization.
- Financial effects, reporting, exports, corrections, and release gates.
- Legacy data, migrations, tests, and evidence requirements.

The application is a pharmacy wholesale system for India. GST behavior must
remain provider-independent and must not couple domain rules directly to
Supabase or Vercel.

This specification does **not** by itself authorize:

- Application implementation.
- Schema or migration execution.
- Historical-data backfill or correction.
- Database provisioning or production access.
- Pilot activation or production rollout.
- Statutory filing, e-invoice, e-way bill, or portal submission.

### 1.1 Scope boundary

The immediate core scope is ordinary, supported domestic purchase and sales
transactions with explicit facts sufficient for the approved rules. Advanced
features remain separate unless explicitly approved:

- GSTR-1/GSTR-3B filing and submission.
- E-invoice and e-way bill integration.
- Reverse charge.
- Imports and exports.
- SEZ and deemed exports.
- UIN workflows.
- Composition-specific statutory behavior.
- ITC reconciliation.
- Credit/debit notes and returns.
- Multiple GST registrations.

These are specified as decision and dependency areas below, not represented as
implemented capabilities.

Inventory is out of implementation scope for this GST specification. The
specification covers purchases, sales, and GST only. Preservation of the
existing purchase/sales-to-Inventory interfaces may be checked, but no Inventory
UI, schema, stock logic, batch logic, FEFO workflow, or inventory-process change
is authorized by this document. This specification is not implementation
completion, statutory correctness, security verification, release approval, or
production authorization.

## 2. Source inventory and conflict resolution

### 2.1 Canonical and supporting sources

| Source | Role | Status |
|---|---|---|
| [`gst-audit-validation-and-plan.md`](./gst-audit-validation-and-plan.md) | Existing GST matrix, findings, accepted policy, test IDs | `EXISTING-REQUIREMENT`; current status source until this document is owner-reviewed |
| [`pgst-01-purchase-gst-workflow-policy.md`](./pgst-01-purchase-gst-workflow-policy.md) | Purchase policy and product-owner decision register | Product decisions recorded; formal PGST-01 pending |
| [`pgst-01-decision-traceability-register.md`](./pgst-01-decision-traceability-register.md) | Original canonical D-GST-01–D-GST-52 decision register and evidence traceability matrix | `PENDING — NOT APPROVED`; authoritative decision source for the decision IDs but not implementation authorization |
| [`purchase-gst-persistence-design.md`](./purchase-gst-persistence-design.md) | Purchase evidence, calculation, acceptance, revision, and persistence design | Design only; implementation not authorized |
| [`gst-disposable-assertion-mapping-2026-10-25.md`](./gst-disposable-assertion-mapping-2026-10-25.md) | GST Disposable Test Suite assertion/evidence mapping | Review-only; connected proof still required |
| [`financial-e2e-validation-harness.md`](./financial-e2e-validation-harness.md) | Broader financial E2E and cleanup contract | Acceptance contract; does not prove execution |
| [`gst-igst-capability-audit.md`](./gst-igst-capability-audit.md) | Historical capability audit | Historical findings; later evidence supersedes only where explicit |
| [`gst-schema-rollout-design-review.md`](./gst-schema-rollout-design-review.md) | Schema rollout and compatibility review | Design/review evidence |
| [`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md) | Rollout and disposable-readiness gates | Review-only approval contract |
| [`PHASE_TRACKER.md`](../PHASE_TRACKER.md) | Current project stage and sequence | Project workflow authority |
| [`CLAUDE.md`](../CLAUDE.md) | Agent operating context | Context, not a substitute for this specification |
| [`src/domain/services/gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts) | Current sales calculator | Current implementation evidence |
| [`src/domain/services/purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts) | Current purchase aggregate calculator | Current implementation evidence |
| [`src/domain/services/purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts) | Purchase evidence/reconciliation model | Current implementation evidence |
| [`prisma/schema.prisma`](../../prisma/schema.prisma) | Current persistence model | Current implementation evidence; rollout not implied |

### 2.2 Conflict rules

1. Explicit owner approval governs product scope only within its stated scope.
2. Formal accounting, legal, security, and engineering approval is not inferred
   from product-owner decisions.
3. Current code demonstrates behavior, not statutory correctness.
4. A test demonstrates only the behavior and evidence level it actually runs.
5. Ambiguous historical facts are preserved and blocked from guessed
   recalculation.
6. This document records conflicts rather than silently selecting a winner.
7. A requirement is not complete until its acceptance evidence and approval
   dependencies are satisfied.

## 3. Domain terminology and classification

### 3.1 Distinct concepts

| Concept | Meaning | Must not be confused with |
|---|---|---|
| Party classification | Registered regular, composition, unregistered, consumer, or other approved category | Place of supply |
| GST registration facts | GSTIN, registration status, registration type, and evidence | Tax rate |
| Jurisdiction identity | State/UT, historical code, special-purpose code, country, or unknown identity | A complete tax decision |
| Place of supply | Transaction-time legal determination based on applicable facts and rule version | Customer billing state used as a proxy |
| Transaction category | Domestic, export, SEZ, deemed export, UIN, or other supported scenario | Party classification |
| Tax treatment | CGST + SGST/UTGST, IGST, exempt/nil/non-GST, zero-rated, or unresolved | GSTIN prefix alone |
| Supplier evidence | Values appearing on the supplier's source invoice | Application-calculated expectation |
| Accounting accepted values | Values explicitly accepted for posting after review | Supplier-declared values |
| Snapshot | Immutable transaction-time fact stored for finalized records | Mutable master data |

### 3.2 Classification inputs

Classification may use only captured, attributable facts:

- Business registration status and GSTIN.
- Supplier/customer registration status and GSTIN.
- Transaction-time seller, supplier, recipient, delivery, and supply facts.
- Product HSN/tax classification and transaction-time tax rate.
- Invoice date and effective rule version.
- Export, SEZ, import, UIN, reverse-charge, or other scenario facts where
  separately approved.

A customer label, numeric code, GSTIN prefix, or current billing address alone
must not determine complete tax treatment.

### 3.3 Contradictory facts

The transaction must be blocked or held for review when, for example:

- A GSTIN is malformed or its claimed state conflicts with captured facts.
- A required state or country is missing.
- A special transaction category lacks its required evidence.
- Supplier-declared and calculated values materially differ.
- The selected scenario conflicts with captured locations.
- A finalized record is missing mandatory snapshot facts.

No silent fallback to a guessed state, zero tax, or current master value is
permitted.

## 4. GST Treatment categories

The repository currently does not model all categories as a complete treatment
enum. The following table distinguishes intended scope from current behavior.

| Category | Intended meaning | Required facts | Purchase | Sales | Status |
|---|---|---|---|---|---|
| Registered Business — Regular | Registered counterparty with regular GST registration | Valid GSTIN/evidence, registration status, location, transaction facts | Applicable | Applicable | `PROPOSED`; legal confirmation required |
| Registered Business — Composition | Registered composition taxpayer | Registration type and applicable invoice restrictions | Applicable where approved | Applicable where approved | `UNRESOLVED`; do not infer from label |
| Unregistered Business | Business without GST registration | Explicit classification and location evidence | Applicable | Applicable | `PROPOSED` |
| Consumer | Consumer/cash customer | Consumer classification and supply facts | Usually not a supplier category | Cash/B2C workflow | `PROPOSED`; current `is_cash_sale` is not a full classification |
| Overseas | Party or transaction involving another country | Country, export/import facts, documentation | Import workflow | Export workflow | `UNRESOLVED`; not implemented |
| Special Economic Zone | SEZ unit/developer and supply context | SEZ evidence, transaction category, documentation | Applicable where approved | Applicable where approved | `UNRESOLVED`; not implemented |
| Deemed Export | Approved deemed-export transaction | Statutory transaction facts and evidence | Applicable where approved | Applicable where approved | `UNRESOLVED`; not implemented |
| UIN holder | Special recipient category where legally applicable | UIN and approved transaction context | Applicable where approved | Applicable where approved | `UNRESOLVED`; not implemented |

### 4.1 Classification rules

- Classification is explicit data, not a UI-only label.
- A missing classification may remain on a draft only if the workflow allows
  incomplete drafts; it must block finalization where it affects tax or
  reporting.
- A category must not be used to bypass place-of-supply or evidence rules.
- Unsupported categories must fail closed with an actionable message.
- Legal/accounting review is required before any category is enabled for
  production.

### 4.2 Reference treatment model

The eight labels below are required reference categories from the product
owner's treatment model. They are not a complete statutory enum, do not grant
permission to transact, and do not map one-to-one to a tax component. A
category is a combination of user-entered intent, verified master-data facts,
transaction facts, and server-derived classification. The server must reject a
label that contradicts the verified facts.

| Reference category | Required facts and validation | POS/component interaction | Evidence, persistence, and downstream behavior |
|---|---|---|---|
| Registered Business – Regular | Verified GST registration, GSTIN format/status, legal name, relevant location, supply and delivery facts | Registration does not determine POS. Resolve POS from the applicable supply rule; use CGST+SGST/UTGST or IGST only after that resolution | Persist category, verified party revision, transaction facts, rule version, components, and evidence. Use the same finalized facts for invoice, accounting, reports, and exports |
| Registered Business – Composition | Verified composition status and effective date, GSTIN, party location, supply facts, and any invoice/tax restrictions | Composition status does not independently determine intra/inter-state treatment or tax components. Block if the applicable composition restriction is unsupported | Persist the verified status and source evidence. Do not treat a composition label as proof that ordinary tax can be charged or claimed |
| Unregistered Business | Explicit unregistered status, recipient identity where available, location/delivery facts, and transaction type | Resolve POS from the transaction rule; recipient registration status alone cannot select CGST, SGST/UTGST, or IGST | Preserve the supplied facts and evidence. B2C/B2B reporting classification must be derived from the approved rule, not from a UI label |
| Consumer | Consumer/cash intent plus delivery and supply facts; `is_cash_sale` is not sufficient by itself | Resolve POS and tax components from actual supply facts. Consumer classification does not make a transaction domestic, intra-state, exempt, or zero-rated by itself | Persist the classification and transaction-time facts. Invoice and reports must use the finalized classification; unsupported consumer variants block finalization |
| Overseas | Country, import/export direction, customs/document facts, supplier/recipient role, and place-of-supply rule | Overseas is not interchangeable with export, import, SEZ, or zero-rated treatment. Use no domestic component until the supported cross-border rule is approved | Persist country, direction, documentary evidence, rule version, and outcome. Unsupported cross-border flows remain blocked and are not posted as ordinary domestic GST |
| Special Economic Zone | Verified SEZ unit/developer status, location, supply direction, authorization/evidence, and applicable documentation | SEZ status does not itself select IGST or zero tax. Determine the applicable supply and zero-rated/tax treatment under an approved SEZ rule | Persist SEZ evidence and transaction classification. Invoice, reconciliation, reports, and exports must use the approved outcome or block |
| Deemed Export | Specific statutory deemed-export condition, eligible recipient/supplier facts, domestic movement facts, and required evidence | Deemed export is not an export and does not automatically imply zero-rating or IGST. The applicable treatment must be an approved rule outcome | Persist the condition, evidence, rule version, and treatment decision. Do not silently use the ordinary domestic path |
| UIN Holders | Verified UIN, eligible holder identity, transaction purpose, recipient facts, and required documentation | UIN status does not independently determine POS or components. Apply only an approved UIN reporting/treatment rule | Persist UIN evidence and the transaction-time decision. Unsupported UIN claims block the affected workflow and cannot be hidden in a generic customer category |

For every category the minimum server result is one of:

1. `SUPPORTED` with a resolved category, POS/supply result, component set,
   rate/rule version, evidence references, and posting authorization; or
2. `BLOCKED` with a machine-readable reason such as missing evidence,
   contradiction, unsupported legal scenario, invalid input, or unresolved
   jurisdiction.

The category is a classification input, not authorization to post. Purchase
reconciliation must retain supplier evidence and calculated values separately
for every category. Sales finalization must persist the category and all
transaction-time facts used to reach the result. A category change creates a
new revision and invalidates dependent calculations and accounting acceptance.

### 4.3 Category acceptance coverage

Each category requires, at minimum, a valid-facts test, missing-facts test,
contradictory-facts test, unsupported-rule test, persistence/snapshot test, and
invoice/report/export parity test. The tests are `PROPOSED` and `UNVERIFIED`;
the repository does not currently implement or execute a complete eight-category
model. No category is production-enabled by this specification.

## 5. Jurisdiction codes 96, 97, and 99

These values are distinct. No code may be normalized into another.

### 5.1 Current repository behavior

| Code | GSTIN-prefix parser | Standalone state normalization | Ordinary POS comparison | Current status |
|---|---|---|---|---|
| `96` | No mapping; returns `null` | Rejected | Cannot resolve | `UNRESOLVED`; no meaning inferred |
| `97` | Explicitly unsupported; returns `null` | Rejected | Cannot resolve | `CURRENT-IMPLEMENTATION`; special-purpose workflow unresolved |
| `99` | Explicitly unsupported; returns `null` | Rejected | Cannot resolve | `CURRENT-IMPLEMENTATION`; special-purpose workflow unresolved |

Evidence: [`indian-states.ts`](../../src/lib/constants/indian-states.ts:67),
[`gst-calculator.test.ts`](../../tests/gst-calculator.test.ts:148), and the
canonical audit matrix.

### 5.2 Required policy

- Standalone jurisdiction-code normalization and GSTIN-prefix parsing remain
  separate.
- A numeric prefix must not be accepted by `normalizeState()`.
- `getStateCodeFromGstin()` must not return an ordinary state for `96`, `97`,
  or `99` without an approved authoritative definition.
- `determinePlaceOfSupply()` must return `UNKNOWN` when these values are the
  only location evidence.
- No tax component, report classification, or invoice outcome may be inferred
  from one of these codes alone.
- The original code must be retained as source evidence if it is captured in a
  future supported workflow.

### 5.3 Closure requirements

Before any code `96`, `97`, or `99` is enabled:

1. Identify the exact field and transaction context.
2. Obtain authoritative GST/GSTN/CBIC evidence.
3. Obtain product-owner and qualified GST/accounting approval.
4. Define storage, normalization, POS, tax, invoice, and reporting behavior.
5. Add positive, negative, boundary, and historical tests.
6. Verify database persistence and report/export behavior in an authorized
   isolated environment.

### 5.4 Explicit 96/97/99 coverage matrix

The following matrix is the required evidence disposition. It deliberately
does not convert a prefix into a GST treatment merely because it appears in a
test or unsupported-prefix list.

| Case | Exact repository meaning established | Representation/evidence | Expected behavior | Required acceptance test | Status/blocker |
|---|---|---|---|---|---|
| `96` | No exact meaning is established. It is absent from the active state map and has no verified standalone normalization or implemented transaction treatment | No active constant, enum, schema field, calculator branch, or dedicated test establishes a meaning; historical/document references are insufficient to identify the field context | Preserve the raw source value when captured, classify jurisdiction as unknown, do not infer POS or components, and block affected finalization/reconciliation until an authoritative context-specific rule exists | Test raw-value preservation, rejection by state/POS helpers, missing/contradictory context, no ordinary-domestic fallback, snapshot/report behavior, and approved resolution once meaning is established | `BLOCKED — PENDING OWNER/GST-PROFESSIONAL DECISION` |
| `97` | Current code establishes only that it is an unsupported special-purpose GSTIN prefix, not an ordinary state or tax category | `UNSUPPORTED_GSTIN_STATE_PREFIXES`/parser behavior returns no state; no approved schema or calculator treatment exists | Retain the original prefix as evidence, reject ordinary state normalization and prefix-only POS, and block unsupported special-purpose transactions; never map it to CGST/SGST, IGST, zero-rated, SEZ, or UIN without proof | Test parser rejection, explicit category/context requirement, no tax-component inference, no report reconstruction, immutable preservation, and authorized supported-rule path | `BLOCKED — AUTHORITATIVE CONTEXT AND LEGAL TREATMENT MISSING` |
| `99` | Current code establishes only that it is an unsupported special-purpose GSTIN prefix, not an ordinary state or tax category | Same parser/unsupported-prefix evidence as `97`; no approved schema, calculator, report, or posting treatment exists | Same fail-closed behavior as `97`; `99` must remain distinct and must not be normalized to `97` or any state | Test distinct raw preservation, parser/POS rejection, unsupported-category blocking, no component inference, invoice/report/export handling, and approved supported-rule path | `BLOCKED — AUTHORITATIVE CONTEXT AND LEGAL TREATMENT MISSING` |

The cases are therefore not resolved by the existing dropdowns, parser, or
tests. The owner and qualified GST professional must identify, for each case,
the exact source field, statutory context, supported transaction variants,
required facts, treatment, persistence, reporting, and correction path. Until
then, `96`, `97`, and `99` are negative/blocked cases only. This matrix
supersedes any stale statement that assigns `96` a normalization or treats
`97`/`99` as ordinary states.

### 5.5 D-GST-30 verification discrepancy

D-GST-30 is recorded in the decision register as `CONTRADICTED` and states:
"Deny by default and prevent demo-tenant bypasses in protected workflows."
The current source implementation in [`tenant-context.ts`](../../src/lib/db/tenant-context.ts:18-L31)
shows `requirePermission()` performing a direct permission-membership check;
there is no current demo bypass, tenant override, or explicit protected-workflow
exception in the checked source. This means the source evidence does not
corroborate the original security finding as currently recorded. The discrepancy
is therefore `NOT VERIFIED` pending reconciliation of the original review note,
actual production code, and the approved RBAC policy.

Until that reconciliation is completed, protected financial workflows remain
`BLOCKED`, and no authorization status may be inferred from the current code or
from documentation alone. Required evidence for closure is: reviewer-signed
security finding or retraction, permission matrix, tenant role model,
post-approval access-control design, isolated database permission tests, and
proof that protected financial workflows deny by default.

## 6. State mapping and place of supply

### 6.1 Current ordinary mapping

`GSTIN_STATE_PREFIX_TO_CODE` currently maps prefixes `01`–`38`, with historical
lossy mappings:

- `25` → `DD`
- `26` → `DD`
- `28` → `AP`

Current mappings include `37` → `AP` and `38` → `LA`. Prefix `39` is undefined.
The original prefix is lost when the helper returns only the two-letter code.

This mapping is application behavior, not a complete authoritative legal
mapping. Historical semantics remain unresolved.

### 6.2 POS rule

For the currently supported ordinary domestic sales path:

1. Capture the transaction-time place-of-supply state.
2. Normalize it through the canonical state helper.
3. Compare it with the seller/business state using the approved rule.
4. Return `INTRA` when resolved states match.
5. Return `INTER` when resolved states differ.
6. Return `UNKNOWN` for missing or invalid required facts.
7. Fail closed before finalization when the result is `UNKNOWN`.

The current implementation uses `determinePlaceOfSupply()` and
`requireResolvedPlaceOfSupply()`. It does not implement all statutory scenarios.

### 6.3 Prohibited shortcuts

- Do not use `customer.billing_state` as a universal POS rule.
- Do not use GSTIN-prefix lookup alone as POS.
- Do not infer a delivery state from a billing address without an approved
  transaction rule.
- Do not interpret an unavailable historical value as zero or current master
  data as historical fact.

### 6.4 Deterministic classification and tax-resolution flow

The implementation contract must resolve GST in this order; later steps must
not override an earlier blocking result:

1. Validate the tenant, actor permission, request idempotency key, and input
   revision.
2. Capture the reference treatment category as a hint or explicit fact, then
   verify it against party master data and the transaction facts.
3. Resolve seller registration/location, recipient registration/location,
   supply type, delivery facts, document direction, and any special evidence.
4. Determine place of supply using the applicable scenario rule and the
   transaction-time facts. GSTIN prefix, billing state, and category alone are
   never sufficient.
5. Classify intra-state/inter-state or an approved special treatment. If the
   rule is not supported or facts conflict, return `BLOCKED`; do not default to
   ordinary domestic GST.
6. Select the approved HSN/SAC rate and effective-date rule, recording the
   rule version and source revision.
7. Select valid components for the resolved treatment, calculate at the
   required precision, apply the approved rounding policy, and produce the
   persisted result.
8. Revalidate the result at finalization/posting against the same revision,
   evidence, rule version, and fingerprint. Only then may the existing atomic
   accounting and Inventory boundary be entered.

User-entered facts may include the proposed category, delivery/supply facts,
source-document values, and supporting references. Master data may provide
verified party registration and location revisions. The server must derive POS,
intra/inter-state classification, applicable components, rate selection,
calculation, and posting eligibility. Client-supplied scenario values such as
the current purchase `supply_scenario` are not authoritative.

## 7. Rates, calculations, and rounding

### 7.1 Sales calculation

Current sales calculation:

- Takes line quantity, sale rate, discount, GST rate, and explicit POS type.
- Calculates taxable value after discount.
- Intra-state: CGST and SGST at half the applicable rate.
- Inter-state: IGST at the full applicable rate.
- Rounds components and totals to two decimals using the existing HALF_UP-style
  implementation.
- Applies invoice-level round-off.

The server recalculates at draft creation and finalization. Client preview is
not authoritative.

### 7.2 Tax-component contract

| Component | Current implementation evidence | Intended contract | Current disposition |
|---|---|---|---|
| CGST | Sales calculator persists/calculates it for `INTRA`; purchase evidence/calculation can carry it | Valid only with the corresponding intra-state/approved union-territory rule | Sales ordinary path exists; purchase posting contract incomplete |
| SGST | Sales calculator persists/calculates it for `INTRA`; purchase evidence/calculation can carry it | Valid only where the approved state component applies | Sales ordinary path exists; purchase posting contract incomplete |
| UTGST | No field or approved service/schema contract | Must be separately represented and selected only by an approved UTGST rule; never alias to SGST or IGST | `BLOCKED — NO APPROVED CONTRACT` |
| IGST | Sales calculator persists/calculates it for `INTER`; purchase evidence/calculation can carry it | Valid for an approved inter-state or special treatment rule | Sales ordinary path exists; purchase posting contract incomplete |
| Cess | Sales snapshot/calculator and purchase evidence model can carry cess, but current ordinary sales value is zero/default | Apply only with an approved product/rate rule and preserve source/calculated/accepted values separately | Representation exists; applicability and rate governance incomplete |

The valid combination is determined by the resolved rule, not by recipient
category: ordinary intra-state sales currently produce CGST plus SGST; ordinary
inter-state sales produce IGST; a future UTGST rule must produce CGST plus UTGST
where legally applicable; cess is additive only when supported. Components
must sum to the persisted GST total, while supplier-declared, calculated, and
accounting-accepted values remain separate for purchases. If the schema cannot
represent the applicable component, the operation must block rather than
discarding it or folding it into another component.

### 7.3 Rates, effective dates, precision, and reconciliation

- Rates must come from an approved, versioned HSN/SAC rule source with an
  effective-from/effective-to interval. The repository has a rule-version
  concept (`purchase-gst-rules-v1`) but no approved rate-governance source or
  complete effective-date implementation.
- A finalized transaction records the selected HSN/SAC, rate, effective date,
  rule version, source revision, taxable base, components, and rounding policy.
  Recalculation uses that snapshot, not today's master data.
- Calculation precision, display precision, legal rounding, invoice-level
  adjustment, and comparison tolerance are separate concepts. Existing sales
  and purchase behavior uses two-decimal component/line values; purchase
  invoice totals use whole-unit rounding and signed `round_off`.
- The purchase reconciliation service compares canonical decimal values and
  reports missing or different values; no approved materiality tolerance is
  currently defined. Binary floating-point artifacts must not create a false
  discrepancy, but this does not authorize a legal/accounting tolerance.
- The required contract is: calculate and persist at the approved precision,
  preserve the supplier's stated total, compare like-for-like rounded values,
  classify any remaining difference as review-required, and record any
  accountant-approved tolerance as a versioned policy decision. Until that
  decision exists, all non-equivalent differences remain unresolved.

### 7.4 Current purchase rounding limitation

`purchase-calculator.service.ts` currently rounds line values to two decimals,
rounds the invoice amount to whole units, and persists signed `round_off`.
`purchase-gst-reconciliation.service.ts` compares evidence fields using
canonical decimal equality. This is verified implementation behavior, not an
approved end-to-end accounting contract. A future implementation must define
whether reconciliation compares pre-round, line-round, or invoice-round values
and how a permitted difference is authorized. No convenient tolerance may be
introduced during implementation.

### 7.5 Purchase calculation

Current purchase calculation:

- Calculates gross, discount, aggregate GST, line total, and invoice totals.
- Preserves two-decimal line values.
- Applies whole-unit invoice rounding.
- Persists signed `round_off`.
- Does not currently split posting values into CGST, SGST/UTGST, IGST, and cess.

Supplier evidence and application calculation are stored separately in the
local design/implementation, but existing aggregate purchase totals must not be
represented as supplier-declared component evidence.

### 7.6 Rates

The current forms submit a line-level GST rate. Products also have a GST-rate
master field. The authoritative override/default relationship is not fully
approved.

Proposed rule:

- Product master provides a default.
- The transaction captures the rate used.
- The server validates the rate against the approved rule set and effective
  date.
- Finalized records retain the transaction-time rate and rule version.
- Changes to product master data never recalculate finalized records.

This is `PROPOSED` until owner and qualified GST/accounting approval.

### 7.7 Unsupported pricing modes

Inclusive-tax pricing, exempt/nil-rated/non-GST distinctions, cess rules beyond
captured fields, reverse charge, imports, exports, and special zero-rated
flows are not complete current capabilities. They require explicit scope and
rule approval.

## 8. Purchase workflow specification

### 8.1 Purchase purpose

Purchase records represent a supplier-issued document entered into Pharmnos
Lite. They are not automatically an electronic invoice import or proof that
the supplier's document is authentic.

### 8.2 Required purchase inputs

- Supplier identity and supplier invoice number.
- Invoice date.
- Product, batch, expiry, quantity, free quantity.
- MRP, purchase rate, sale rate, discount, and transaction GST rate.
- Supplier-declared taxable value, CGST, SGST, IGST, cess, invoice total, and
  signed round-off where evidence is available.
- Supplier, recipient, and delivery state facts.
- Explicit supply scenario where the purchase GST workflow requires it.
- Source-document reference and capture provenance.

### 8.3 Three-value rule

The system must distinguish:

1. Supplier-declared source evidence.
2. Application-calculated expected values.
3. Accounting-accepted values for posting.

No value may silently overwrite another. The original source evidence remains
available after review or correction.

### 8.4 Purchase lifecycle

```text
Supplier/master data
  → purchase entry
  → validation and draft save
  → source evidence capture
  → application calculation
  → reconciliation
  → accounting acceptance or explicit resolution
  → finalization guard
  → atomic batch/stock/ledger/audit posting
```

Incomplete or discrepant drafts may be saved and edited. A material unresolved
discrepancy must block accounting completion and posting.

### 8.5 Reconciliation states

| State | Meaning | Posting |
|---|---|---|
| `NOT_RECONCILED` | Evidence or calculation is not complete | Block |
| `MATCHED` | Required compared values match under the approved rule | Permit only after accounting acceptance |
| `DISCREPANCY_REQUIRES_REVIEW` | Missing, invalid, or different values exist | Block |
| `RESOLVED` | Explicit auditable decision accepted values | Permit only when acceptance is complete |

Tolerance for substantive discrepancies is not invented here. Rounding
differences and material discrepancies require separate approved policy.

### 8.6 Purchase posting

Finalization must verify current evidence, calculation, decision, status,
version, and totals inside one transaction. On success it may:

- Upsert product batches.
- Create inward stock movements.
- Allocate a tenant-scoped purchase number.
- Mark the purchase finalized.
- Complete the idempotent posting operation.
- Create supplier ledger/payable effects.
- Write the audit event.

On failure, no partial financial effects may remain.

### 8.7 Purchase scenarios

| Scenario | Required facts | Current behavior | Intended rule |
|---|---|---|---|
| Same Indian state | Supplier, recipient, delivery states and approved rule | Explicit scenario can be captured; aggregate posting remains | Component calculation after approved rule |
| Different Indian states | Same | Explicit scenario can be captured | Component calculation after approved rule |
| Other Territory | Exact code/context and legal rule | Unsupported | Hold and fail closed |
| Another country/import | Country and import evidence | Unsupported | Separate approved import workflow |

### 8.8 Purchase tax-component posting contract

The current repository evidence defines a three-value rule and a purchase
amount contract in [`purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts:1-L283).
The verifiable contract present in source is as follows:

| Field | Source / evidence | Meaning | Persistence status | Permitted use |
|---|---|---|---|---|
| `taxable_value` | `PurchaseGstAmountFacts` | Taxable base reported by supplier or calculated by the application | `CURRENT-IMPLEMENTATION`; nullable fields recorded in local design and schema | Reconcile supplier declaration against expected value; never overwrite source evidence |
| `cgst` | `PurchaseGstAmountFacts` | Intra-state component as a line/document component where applicable | `CURRENT-IMPLEMENTATION`; nullable field, not yet fully server-posted as a verified accounting policy | Compare and accept only after explicit review |
| `sgst` | `PurchaseGstAmountFacts` | Intra-state component as a line/document component where applicable | `CURRENT-IMPLEMENTATION`; nullable field | Compare and accept only after explicit review |
| `utgst` | Not currently used as a source field | Separate UTGST component where state-specific rules require it | `PROPOSED`; no approved schema/field contract yet | Blocked pending approval and schema decisions |
| `igst` | `PurchaseGstAmountFacts` | Inter-state component or other approved legal category | `CURRENT-IMPLEMENTATION`; nullable field | Compare and accept only after explicit review |
| `cess` | `PurchaseGstAmountFacts` | Additional cess component where supported by the evidence | `CURRENT-IMPLEMENTATION`; nullable field | Compare and accept only after explicit review |
| `invoice_total` | `PurchaseGstAmountFacts` | Supplier-declared or calculated invoice total | `CURRENT-IMPLEMENTATION`; nullable field | Reconcile document totals and block posting when incomplete |
| `round_off` | `PurchaseGstAmountFacts` | Signed invoice rounding value used by the current purchase flow | `CURRENT-IMPLEMENTATION`; preserved in aggregate flow | Must retain current purchase behavior and not silently change supplier totals |

The current source distinguishes the following concepts:

1. Supplier-declared values (`SupplierDeclaredPurchaseGstEvidence.amounts`)
2. Application-calculated expected values (`CalculatedPurchaseGstExpected.amounts`)
3. Accounting-accepted values (`AccountingAcceptedPurchaseGst.amounts`)

`reconcilePurchaseGstEvidence()` marks a value as `MATCHED`, `DIFFERENT`, `INVALID`, or `MISSING`; if any required field is missing or materially differs, the result becomes `DISCREPANCY_REQUIRES_REVIEW` and posting is blocked. This is a source-supported contract for review and rejection, but it does not prove database enforcement, accounting approval, or final statutory rule approval.

Legacy aggregate-only purchases remain a special case. The application must preserve the original supplier totals and any aggregate-only historical facts, disclose missing component detail, and refrain from fabricating historical tax components from current master data or aggregate total values. Any change to rounding, posting policy, or component field semantics remains `BLOCKED` until explicit accounting and product-owner approval.

### 8.9 Purchase place-of-supply decision matrix

The repository supports the ordinary domestic decision flow only where the required state and supply facts are captured and resolved. The current source evidence includes `PurchaseGstSupplyFacts` and `determinePlaceOfSupply()`.

| Scenario ID | Transaction category | Required inputs | Decision rule | Expected output | Persisted transaction facts | Outcome |
|---|---|---|---|---|---|---|
| `PUR-POS-01` | Same-state domestic purchase | Supplier state, recipient state, delivery state, and transaction facts | Resolve states; if equal and valid, treat as intra-state | `INTRA` and intra-state component treatment | Supplier state, recipient state, delivery state, supply scenario, rule version | `CURRENT-IMPLEMENTATION` for ordinary domestic rules |
| `PUR-POS-02` | Different-state domestic purchase | Supplier state, recipient state, delivery state, and transaction facts | Resolve states; if different and valid, treat as inter-state | `INTER` and IGST treatment | Same as above | `CURRENT-IMPLEMENTATION` for ordinary domestic rules |
| `PUR-POS-03` | Missing/invalid state facts | Missing supplier or buyer state, malformed code, or unsupported special code | Fail closed; return `UNKNOWN` | No tax treatment may be inferred | Preserve original facts and capture block reason | `CURRENT-IMPLEMENTATION` with fail-closed guard |
| `PUR-POS-04` | Other territory / special purpose / unsupported state code | `96`, `97`, `99`, or other unsupported category | Do not infer from prefix or location label alone | `BLOCKED` | Persist original facts and unresolved status | `BLOCKED` pending legal/accounting decision |
| `PUR-POS-05` | Import/export/SEZ/UIN/reverse-charge | Country, import/export, statutory context, or approved special scenario | Explicit scenario approval required | `BLOCKED` | No enabled output without approved rule and evidence | `UNRESOLVED` |

No purchase place-of-supply scenario may be enabled by GSTIN-prefix lookup alone, customer billing state alone, or a silent fallback to current master data.

## 9. Sales workflow specification

### 9.1 Sales purpose

Sales invoices are Pharmnos Lite-issued documents. They must use captured
transaction facts and server-side calculations rather than trusting a
client-side tax assumption.

### 9.2 Required sales inputs

- Customer or approved cash-sale context.
- Captured place-of-supply state/facts.
- Invoice date and reference.
- Product and HSN/tax classification.
- Actual FEFO batch.
- Quantity, free quantity, sale rate, MRP, discount, and applicable rate.
- Customer GSTIN/classification where relevant.

### 9.3 Sales lifecycle

```text
Customer/master data
  → sales entry and FEFO selection
  → client preview
  → server-validated draft
  → finalization-time recalculation
  → immutable tax/snapshot persistence
  → atomic stock, ledger, sequence, and audit effects
  → print/report/export
```

The client preview explicitly states that the server recomputes on finalization.

### 9.4 Sales finalization

Finalization must:

1. Reload the tenant-qualified draft.
2. Resolve captured POS.
3. Fail closed for missing/invalid POS.
4. Recalculate GST on the server.
5. Compare stored draft totals to calculated totals.
6. Verify required snapshot facts.
7. Persist taxable and component tax values.
8. Deduct FEFO batches and write outward movements.
9. Allocate the invoice number.
10. Persist seller, customer, product, HSN, batch, and POS snapshots.
11. Write customer ledger and receivable effects.
12. Write the audit event.

All effects must be atomic.

### 9.5 Sales scenarios

| Scenario | Required facts | Current status | Intended behavior |
|---|---|---|---|
| Same Indian state | Seller state and captured POS | Implemented for ordinary states | CGST + SGST/UTGST under approved rule |
| Different Indian states | Seller state and captured POS | Implemented for ordinary states | IGST under approved rule |
| Other Territory | Exact code and supply facts | Unsupported | Fail closed until approved |
| Another country | Country/export/import facts | Unsupported | Separate approved workflow |

### 9.6 Sales place-of-supply decision matrix

| Scenario ID | Transaction category | Required inputs | Rule / source | Expected classification | Persisted facts | Outcome |
|---|---|---|---|---|---|---|
| `SAL-POS-01` | Same-state domestic sale | Seller state, captured transaction state, and buyer state | `determinePlaceOfSupply()` + approved domestic rule | `INTRA` | Transaction-time POS, seller state, buyer state, tax components | `CURRENT-IMPLEMENTATION` |
| `SAL-POS-02` | Different-state domestic sale | Seller state, captured transaction state, and buyer state | `determinePlaceOfSupply()` + approved domestic rule | `INTER` | Transaction-time POS, seller state, buyer state, tax components | `CURRENT-IMPLEMENTATION` |
| `SAL-POS-03` | Missing or invalid state facts | One or both states missing, malformed, or unsupported | Fail closed before finalization | `UNKNOWN` | Preserve source facts and block reason | `CURRENT-IMPLEMENTATION` with blocked finalization |
| `SAL-POS-04` | Other territory / special GSTIN prefix | `96`, `97`, `99`, or other unsupported code in required state context | `UNKNOWN`; no silent classification | `BLOCKED` | Preserve fact and unresolved status | `BLOCKED` |
| `SAL-POS-05` | Export / import / SEZ / UIN / reverse charge | Country, statutory category, and approved rule set | Explicit approved rule required | `BLOCKED` | No production usage without approved policy | `UNRESOLVED` |

The sales path is intentionally constrained to the supported ordinary domestic path. It must not infer tax treatment from a GSTIN prefix or customer billing state where actual supply facts are missing, contradictory, or unsupported.

## 10. Persistence, snapshots, finalization, and audit

### 10.1 Authoritative finalized sales facts

Finalized sales records must use persisted transaction-time values for:

- Seller identity and address.
- Seller state and GSTIN.
- Customer identity and address.
- Customer state and GSTIN.
- Place of supply.
- Product name, generic name, HSN.
- Batch/expiry facts.
- Quantity, rate, discount, taxable value.
- GST rate and tax components.
- Invoice totals and round-off.

Printing must prefer snapshots. Legacy fallback must disclose unavailable facts
and must not present current master data as verified historical data.

### 10.2 Purchase history

Purchase history must preserve:

- Supplier source-document evidence.
- Application calculation and rule version.
- Accounting decision and decision reference.
- Reconciliation events and correction chain.
- Existing aggregate purchase totals and rounding behavior.
- Supplier and transaction facts sufficient for later review.

Complete immutable supplier/product snapshots are not yet fully implemented and
remain a required design/implementation dependency.

### 10.3 Immutability

Finalized financial records must not be edited in a way that changes their
original tax, identity, stock, ledger, or source-evidence meaning. Corrections
must create an auditable related record or approved reversal. No correction
workflow is implied where the accounting design is unresolved.

### 10.4 Cancellation

Current drafts can be cancelled. A finalized invoice is not treated as
reversible merely because a status enum or UI control exists. Finalized
cancellation, returns, and notes require separate approved accounting design.

## 11. Invoices, reports, reconciliation, returns, and exports

### 11.1 Invoice representation

Persisted finalized tax fields are authoritative for the transaction. Current
master data may provide display fallback only for incomplete legacy records,
with disclosure.

### 11.2 Reports and exports

Future report and export behavior must:

- Use persisted finalized POS and tax components.
- Include approved adjustments and reversals.
- Identify missing or contradictory mandatory facts.
- Avoid silently omitting unresolved records.
- Distinguish internal management reports from statutory return preparation.
- Never claim filing or portal integration without external evidence.

The following report and export contracts are discovered in the repository:

| Workflow | Current implementation / source | Data source | Status |
|---|---|---|---|
| GST HSN summary / export | `gst-calculator.service.ts` + report/export path in the app | Current business/customer state plus tax data | `CURRENT-IMPLEMENTATION`; known gap; do not treat as final statutory contract |
| Sales CSV / invoice export | Current export path in the app | Finalized sales record fields and tax values | `PROPOSED` / partially implemented; must use finalized persisted facts |
| Purchase reconciliation report | `purchase-gst-reconciliation.service.ts` | Supplier evidence, expected values, reconciliation events | `CURRENT-IMPLEMENTATION` for pure reconciliation logic; DB-backed report not verified |
| Invoice print / reprint | Sales print and snapshot flow | Persisted invoice snapshots, finalized tax facts | `CURRENT-IMPLEMENTATION`; historical snapshot precedence is required |
| Internal ledger / payable / receivable summaries | Current accounting and ledger flows | Finalized ledger and stock state | `PARTIALLY IMPLEMENTED`; depends on approved posting and reconciliation policy |
| Statutory return readiness / GSTR-9 readiness | Not available as a verified implementation | Finalized tax records plus approved rules | `BLOCKED`; no implementation claim permitted |

Current GST HSN report and CSV export derive interstate status from current
business/customer state. This is a known gap and must not be treated as the
authoritative final design.

### 11.3 Returns and notes

Returns, credit notes, and debit notes are deferred but must eventually:

- Reference the original finalized document.
- Preserve original batch, rate, taxable, and component tax facts.
- Enforce quantity/value limits.
- Reverse or adjust stock atomically.
- Reverse or adjust customer/supplier ledger effects atomically.
- Preserve the original invoice unchanged.
- Be idempotent and auditable.
- Feed reports and exports consistently.

The `CREDIT_NOTE` and `DEBIT_NOTE` enum values do not prove these workflows
exist.

## 12. Validation, errors, bulk operations, and authorization

### 12.1 Validation stages

| Stage | Required checks |
|---|---|
| Entry | Required fields, shape, numeric bounds, supported scenario |
| Draft save | Preserve incomplete drafts where allowed; reject structurally invalid data |
| Finalization | Recalculate, reconcile, verify current versions, resolve POS, enforce snapshots and permissions |
| Return/export | Verify original references, mandatory facts, adjustment status, and report eligibility |

### 12.2 Error handling

Errors must identify the blocking condition and required next action. No broad
catch may return a success-shaped fallback. Unresolved mandatory tax facts must
not be overridden by a user-selected value.

### 12.3 Bulk operations

Future bulk actions must define:

- Per-record validation result.
- Atomicity boundary.
- Retry/idempotency behavior.
- Failed-record identification.
- No partial financial effects without explicit approved semantics.

### 12.4 Authorization and separation of duties

Existing permission checks and tenant context are required for sensitive server
actions. Purchase policy records a product-owner preference for separating
creation, review, accounting acceptance, and posting where feasible. Exact
roles, exceptions, and segregation-of-duties rules remain pending PGST-08 and
security/architecture review.

## 13. Concurrency, idempotency, inventory, and financial effects

- Finalization must remain inside one database transaction.
- Sales must use tenant-qualified FEFO selection and conditional decrements.
- Purchase posting uses a tenant-scoped idempotency key and optimistic version.
- Purchase invoice sequence allocation uses row/advisory locking in the current
  action.
- Duplicate finalization must not create duplicate stock, ledger, sequence, or
  audit effects.
- GST work must preserve existing inventory contracts and must not redesign
  inventory.
- Database-backed proof requires the authorized disposable target and retained
  evidence; static tests are not runtime proof.

## 14. Legacy data and migrations

### 14.1 Legacy principles

- Do not infer historical POS from current customer billing state.
- Do not infer supplier-declared GST facts from aggregate totals.
- Do not recalculate finalized tax from current product rates.
- Do not convert missing values to zero.
- Preserve historical aggregate totals when detailed facts are unavailable.
- Disclose incomplete historical facts.

### 14.2 Migration classifications

| Change | Classification |
|---|---|
| Add nullable tax-component or snapshot fields | Additive migration, separately approved |
| Add purchase evidence tables | Additive migration, separately approved |
| Backfill POS from mutable masters | Unsafe to infer automatically |
| Backfill supplier evidence | Manual review or source-document capture |
| Normalize historical codes | Manual review required |
| Rewrite finalized transactions | Prohibited without explicit correction plan |

Any migration requires identity/schema/grant preflight, compatibility review,
backup/recovery plan, conflict checks, rollback strategy, and explicit approval.

## 15. GST Disposable Test Suite and acceptance criteria

### 15.1 Checkpoint

The repository records GST-001 through GST-020 in
[`gst-disposable-assertion-mapping-2026-10-25.md`](./gst-disposable-assertion-mapping-2026-10-25.md).
The expectation package remains review-only and not owner-approved for
connected execution. Connected database evidence must not be inferred from
static artifacts.

The current canonical matrix records:

- GST-001 through GST-005: pure sales/state behavior substantially verified.
- GST-006 through GST-013: locally represented or partially verified, with
  database rollout and/or policy blockers.
- GST-014 and GST-015: prior application-path rollback database evidence.
- GST-016: prior authenticated print/snapshot database evidence.
- GST-017: authoritative prefix verification unresolved.
- GST-018: special-prefix behavior unresolved for `97` and `99`.
- GST-019 and GST-020: blocked pending complete authorized evidence and gates.

The exact historical run artifacts remain the evidence source; this document
does not upgrade their scope.

### 15.2 Acceptance matrix

| ID | Requirement | Acceptance evidence | Current status |
|---|---|---|---|
| GST-001 | Canonical sales calculation | Pure calculator tests and server-path review | `CURRENT-IMPLEMENTATION`; prior pure evidence |
| GST-002 | Rounding and preview parity | Component/preview assertions plus integration proof | Partially verified |
| GST-003 | Discount normalization | Unit and finalized persistence evidence | Partially verified |
| GST-004 | State normalization | Mapping tests plus authoritative evidence | Limited |
| GST-005 | Fail-closed POS | Missing/invalid/special input tests and finalization guard | Implemented locally |
| GST-006 | Sales tax-component persistence | Authorized isolated database assertion | Limited; runtime evidence required |
| GST-007 | Sales POS persistence | Captured-facts schema and database assertion | Limited; policy/runtime blockers |
| GST-008 | Purchase component calculation | Approved rule version and regression suite | Outstanding |
| GST-009 | Purchase component persistence | Evidence/calculation/accepted-value database test | Limited |
| GST-010 | Business state validation | Server boundary and database evidence | Limited |
| GST-011 | Historical invoice integrity | Snapshot-first print and immutability E2E | Limited/prior evidence |
| GST-012 | Schema/legacy strategy | Owner-approved migration/backfill decision | Outstanding |
| GST-013 | Purchase regression coverage | Pure plus authorized database tests | Limited |
| GST-014 | Sales rollback/ledger consistency | Application-path database E2E | Prior PASS evidence |
| GST-015 | Purchase sequence rollback | Application-path database E2E | Prior PASS evidence |
| GST-016 | Historical invoice immutability/print | Authenticated application-path E2E | Prior PASS evidence |
| GST-017 | Authoritative prefix verification | Official source and context matrix | Unresolved |
| GST-018 | `97`/`99` special handling | Approved policy and tests | Blocked |
| GST-019 | Disposable financial verification | Target, role, fixtures, scenarios, cleanup, evidence | Blocked until all gates |
| GST-020 | Broad GST acceptance | Every prerequisite and evidence class | Blocked |

### 15.3 Required regression matrix

At minimum, approved implementation must test:

- Intra-state and inter-state sales.
- Missing/invalid state and unsupported prefixes.
- Historical prefixes `25`, `26`, `28`, `37`.
- Explicit `96`, `97`, and `99` fail-closed cases.
- Discounts, line rounding, invoice rounding, and signed round-off.
- Purchase evidence match, discrepancy, correction, and accounting resolution.
- Draft/finalization parity.
- Stock, ledger, sequence, and audit rollback.
- Duplicate finalization and concurrent edits.
- Snapshot printing after master-data mutation.
- Report/export parity with finalized persisted facts.
- Returns and tax reversal after those workflows are approved.

### 15.4 Reference-category and 96/97/99 acceptance matrix

The following are proposed acceptance tests, not executed results. `Existing`
means repository code or a test exists; it does not mean the requirement has
passed.

| ID | Scenario and purpose | Required facts/setup | Expected behavior | Relevant area | Evidence status |
|---|---|---|---|---|---|
| CAT-01 | Registered Business - Regular domestic intra-state sale | Verified regular GST registration, seller/POS facts, HSN/rate | Server resolves ordinary intra-state treatment, persists CGST+SGST, and finalizes atomically | Sales action, GST calculator, invoice snapshot | `PROPOSED; UNVERIFIED` |
| CAT-02 | Registered Business - Composition restriction | Verified composition status and a transaction requiring a restricted treatment | Block with an explicit reason; never infer ordinary tax from the label | Classification and authorization | `PROPOSED; UNVERIFIED` |
| CAT-03 | Unregistered Business and Consumer distinction | Explicit party facts, delivery facts, and transaction type | Resolve approved B2C treatment without treating either label as POS | Sales classification/reporting | `PROPOSED; UNVERIFIED` |
| CAT-04 | Overseas | Country, direction, customs/document evidence | Do not post as ordinary domestic GST; resolve only an approved cross-border rule | Sales/purchase special treatment | `PROPOSED; UNVERIFIED` |
| CAT-05 | SEZ | Verified SEZ party and required supply evidence | Keep SEZ distinct from overseas/deemed export; block if the approved rule is absent | Special treatment | `PROPOSED; UNVERIFIED` |
| CAT-06 | Deemed Export | Specific statutory condition and evidence | Keep deemed export distinct from export and ordinary domestic treatment | Special treatment | `PROPOSED; UNVERIFIED` |
| CAT-07 | UIN Holder | Verified UIN, eligibility, purpose, documentation | Apply only an approved UIN rule; otherwise block | Special treatment/reporting | `PROPOSED; UNVERIFIED` |
| CASE-96 | Unknown `96` context | Raw prefix/value plus no authoritative transaction meaning | Preserve raw value, return unknown, block POS/tax/finalization, and disclose in legacy output | State helper, classifier, snapshots, reports | `PROPOSED; BLOCKED` |
| CASE-97 | Unsupported special-purpose `97` | GSTIN with prefix `97`, no approved special rule | Parser/POS rejects ordinary state interpretation; no component or report inference | State helper, calculator, reports | `Existing rejection; treatment UNVERIFIED` |
| CASE-99 | Unsupported special-purpose `99` | GSTIN with prefix `99`, no approved special rule | Same fail-closed behavior as `97`, while preserving distinct raw evidence | State helper, calculator, reports | `Existing rejection; treatment UNVERIFIED` |
| CLASS-01 | Contradictory category and master data | Composition label with regular verified status, or category inconsistent with facts | Block and retain both proposed and verified values in audit history | Classification service | `PROPOSED; UNVERIFIED` |
| HIST-01 | Master data changes after finalization | Finalized snapshot, then mutate party/product/state masters | Reprint/report uses persisted transaction-time facts, not current masters | Print, reports, exports | `Partially implemented; runtime UNVERIFIED` |
| PUR-01 | Supplier/system mismatch and acceptance | Supplier evidence, calculated revision, explicit accepted values | Preserve all three value sets; unresolved mismatch cannot post; acceptance binds to revision | Purchase reconciliation/actions | `Partially implemented; posting consistency UNVERIFIED` |
| ROUND-01 | Decimal and invoice rounding | Line values, whole-unit invoice rounding, signed round-off, near-boundary difference | Preserve current purchase behavior and classify unresolved tolerance as review | Purchase calculator/reconciliation | `Existing pure behavior; policy UNVERIFIED` |
| INV-01 | GST failure rollback | Invalid POS or unresolved purchase reconciliation during finalization | No partial invoice, ledger, sequence, or Inventory effects | Existing transaction boundary | `Existing transaction tests; broad evidence UNVERIFIED` |
| TEN-01 | Tenant and authorization boundary | Two tenants, acceptance/posting roles, duplicate request | Deny cross-tenant access and unauthorized/self-approval cases; no duplicate effects | Tenant/RLS/actions | `Static tests executed; live E2E UNVERIFIED` |

No row above is a statutory filing test. Filing, e-invoice, e-way bill,
returns, credit/debit notes, and other excluded workflows require separate
approved specifications.

## 16. Decision register

### 16.1 Canonical D-GST and PGST decision register

The authoritative repository register for the product-level decision IDs is
[`pgst-01-decision-traceability-register.md`](./pgst-01-decision-traceability-register.md).
It documents the original D-GST-01 through D-GST-52 records and the current
status of each decision item. The register explicitly states that PGST-01
remains `PENDING — NOT APPROVED` and that implementation authorization is `NOT
GRANTED`.

The current decision dispositions are not all equal. The register distinguishes
`DOCUMENTED`, `PARTIALLY DOCUMENTED`, `NOT DOCUMENTED`, `CONTRADICTED`, and
`UNVERIFIABLE`; several decisions are still blocked pending engineering,
Security/Architecture, Accounting/GST, and GST-professional review. This
document preserves those distinctions rather than reclassifying them as approved
requirements.

| ID | Selected decision | Current disposition | Evidence status |
|---|---|---|---|
| D-GST-01 | Preserve supplier-declared and calculated values separately; unresolved discrepancies block posting. | `PARTIALLY DOCUMENTED` | Policy/design exists; runtime enforcement absent |
| D-GST-02 | Missing required GST values remain missing and block posting; drafts may remain editable. | `PARTIALLY DOCUMENTED` | Pure reconciliation exists; enforcement not verified |
| D-GST-03 | Preserve original evidence and create linked correction versions. | `PARTIALLY DOCUMENTED` | Design-level correction chain only |
| D-GST-04 | Separate authorization for evidence entry, discrepancy resolution, accounting acceptance, and posting. | `PARTIALLY DOCUMENTED` | Governance requirement only |
| D-GST-05 | Preserve posted history and use authorized linked corrections or reversals. | `PARTIALLY DOCUMENTED` | Policy/design only |
| D-GST-06 | Use idempotent posting retries and reject request-key reuse with different data. | `PARTIALLY DOCUMENTED` | Design requirement only |
| D-GST-07 | Material pre-posting changes invalidate affected accounting acceptance. | `PARTIALLY DOCUMENTED` | Proposed revision binding only |
| D-GST-08 | Concurrent posting must not produce duplicate financial effects. | `UNVERIFIABLE` | No isolated concurrent validation |
| D-GST-09 | Required financial database writes are atomic; external effects have reliable recovery. | `PARTIALLY DOCUMENTED` | Transaction boundary reviewed; recovery unverified |
| D-GST-10 | Preserve append-only audit history under approved retention rules. | `PARTIALLY DOCUMENTED` | Retention and protection remain open |
| D-GST-11 | Preserve legacy drafts and block noncompliant posting. | `PARTIALLY DOCUMENTED` | Product / design intent only |
| D-GST-12 | Preserve original supplier invoice evidence and link extracted values to source version. | `PARTIALLY DOCUMENTED` | Source provenance design only |
| D-GST-13 | Correct extraction errors through controlled, auditable corrections. | `PARTIALLY DOCUMENTED` | Workflow absent |
| D-GST-14 | Block confirmed duplicate invoices and review uncertain matches. | `NOT DOCUMENTED` | Matching policy absent |
| D-GST-15 | Preserve posted purchases through correction or reversal. | `PARTIALLY DOCUMENTED` | History-preservation direction only |
| D-GST-16 | Record supplier credit/debit notes as linked documents. | `NOT DOCUMENTED` | Note-specific treatment absent |
| D-GST-17 | Preserve supplier invoice numbers separately from internal purchase identifiers. | `PARTIALLY DOCUMENTED` | Schema fields exist; historical behavior unverified |
| D-GST-18 | Preserve original supplier context and use auditable corrections. | `PARTIALLY DOCUMENTED` | Provenance/correction design only |
| D-GST-19 | Use versioned, explicitly approved GST calculation rules. | `PARTIALLY DOCUMENTED` | Rule version concept exists; approval absent |
| D-GST-20 | Preserve previous calculations and create new versions when recalculation is required. | `PARTIALLY DOCUMENTED` | Design-only revision path |
| D-GST-21 | Require authorized review and recovery before posting suspicious values. | `PARTIALLY DOCUMENTED` | Policy coverage exists; enforcement absent |
| D-GST-22 | Define required GST fields by approved transaction scenario. | `PARTIALLY DOCUMENTED` | Scenario matrix incomplete |
| D-GST-23 | Use approved scenario-specific tax-rate and place-of-supply rules; escalate uncertainty. | `PARTIALLY DOCUMENTED` | Fail-closed direction exists; legal rules absent |
| D-GST-24 | Preserve invoice- and line-level evidence with approved aggregation and rounding rules. | `PARTIALLY DOCUMENTED` | Design exists; aggregate-only model remains |
| D-GST-25 | Mark unverified evidence and block posting where verification is required. | `PARTIALLY DOCUMENTED` | Fail-closed requirement only |
| D-GST-26 | Correct posted financial facts through linked transactions, not direct rewriting. | `PARTIALLY DOCUMENTED` | Design direction exists; implementation absent |
| D-GST-27 | Establish approved evidence-retention periods and deletion/redaction rules. | `NOT DOCUMENTED` | No complete canonical policy |
| D-GST-28 | Protect historical audit records through persistence-layer controls. | `PARTIALLY DOCUMENTED` | Controls discussed but unverified |
| D-GST-29 | Enforce tenant ownership across server and database access; test cross-tenant denial. | `PARTIALLY DOCUMENTED` | RLS assets exist; runtime not verified |
| D-GST-30 | Deny by default and prevent demo-tenant bypasses in protected workflows. | `CONTRADICTED` / `NOT VERIFIED` | Current source evidence does not show a demo bypass; `requirePermission()` is a direct permission check, so the original claim remains under reconciliation |
| D-GST-31 | Require separate acceptance and posting permissions unless approved otherwise. | `PARTIALLY DOCUMENTED` | Separation documented; authority model unresolved |
| D-GST-32 | Use database-enforced transaction, concurrency, version, and uniqueness safeguards. | `PARTIALLY DOCUMENTED` | Proposed safeguards exist; not implemented |
| D-GST-33 | Persist durable tenant-scoped idempotency identities and outcomes. | `PARTIALLY DOCUMENTED` | Design requirement only |
| D-GST-34 | Use atomic financial writes and reliable retry-safe handling of external effects. | `PARTIALLY DOCUMENTED` | Transaction boundary exists; recovery evidence absent |
| D-GST-35 | Use layered duplicate-invoice matching and review for uncertain matches. | `NOT DOCUMENTED` | Matching policy absent |
| D-GST-36 | Preserve original invoice/extraction values and record auditable corrections. | `PARTIALLY DOCUMENTED` | Design direction exists; current persistence absent |
| D-GST-37 | Preserve legacy drafts without fabricating missing evidence or acceptance. | `PARTIALLY DOCUMENTED` | Product decision exists; enforcement absent |
| D-GST-38 | Use a dedicated disposable test database, synthetic fixtures, and reports outside resettable data. | `DOCUMENTED` | Contract exists; no database execution |
| D-GST-39 | Validate GST, purchases, sales interactions, inventory, integrity, authorization, tenancy, concurrency, rollback, idempotency, audit, and cleanup. | `DOCUMENTED` | Validation requirement exists; execution pending |
| D-GST-40 | Require Accounting/GST, qualified professional, Engineering, Security/Architecture review, and authorization. | `DOCUMENTED` | Governance requirement exists; reviewer artifacts pending |
| D-GST-41 | No automatic discrepancy tolerance; every discrepancy requires review unless approved. | `PARTIALLY DOCUMENTED` | Approved tolerance rule absent |
| D-GST-42 | Never silently ignore discrepancies; exceptions require review, versioning, and evidence. | `PARTIALLY DOCUMENTED` | Policy exists; durable enforcement absent |
| D-GST-43 | Initially support only explicitly reviewed and approved purchase scenarios. | `PARTIALLY DOCUMENTED` | Scope principle exists; scenario enumeration incomplete |
| D-GST-44 | Block posting when tax treatment is uncertain; do not guess rates or place of supply. | `DOCUMENTED` | Fail-closed policy documented |
| D-GST-45 | Use an explicitly permissioned accounting role configured by the organization. | `PARTIALLY DOCUMENTED` | Authority matrix absent |
| D-GST-46 | Permit the same person to accept and post only when separately authorized. | `PARTIALLY DOCUMENTED` | Same-user rule unresolved |
| D-GST-47 | Preserve rejected supplier invoice evidence and block posting until resolution. | `PARTIALLY DOCUMENTED` | Preservation direction exists; enforcement absent |
| D-GST-48 | Handle supplier corrections, credit notes, and debit notes as linked versions or documents. | `PARTIALLY DOCUMENTED` | Note-specific treatment absent |
| D-GST-49 | Reproduce finalized invoices from persisted snapshots and linked evidence. | `PARTIALLY DOCUMENTED` | Snapshot and reproduction requirement exists |
| D-GST-50 | Persist tenant-scoped idempotency keys, payload fingerprints, status, and outcome. | `PARTIALLY DOCUMENTED` | Design requirement only |
| D-GST-51 | Revalidate accepted evidence/calculation revisions and purchase version inside posting. | `PARTIALLY DOCUMENTED` | Design requirement only |
| D-GST-52 | Define and verify transaction isolation/concurrency and database-enforced invoice-sequence uniqueness. | `UNVERIFIABLE` | No database execution or evidence |

`PGST-01` remains `PENDING — NOT APPROVED`. The current repository state is
therefore: documented decision content exists, but implementation authorization,
formal approval of the policy and workflow, and runtime evidence remain out of
scope for this specification until separate review completes.

### 16.2 Recorded product-owner decisions

The purchase policy records product-owner decisions on 2026-10-24 covering:

- Controlled-pilot boundaries.
- Incomplete drafts may be saved and edited.
- Finalization/posting is blocked until approved controls pass.
- Role separation is preferred where feasible.
- Disable/rollback and pilot-exit criteria are required before activation.

These remain `OWNER-APPROVED — PRODUCT DECISION ONLY`. They do not constitute
formal PGST-01 approval or implementation authorization.

### 16.3 Recommended technical defaults

The following are `PROPOSED`:

1. Use a hybrid master/transaction model.
2. Use captured transaction facts, not customer billing state alone, for sales.
3. Preserve supplier evidence, calculated values, and accepted posting values
   separately.
4. Persist finalized tax components and transaction-time snapshots.
5. Make reports and exports use finalized persisted facts.
6. Treat GSTIN prefix as evidence/validation input, not sole POS authority.
7. Keep unsupported scenarios fail closed.
8. Implement returns as original-document-referencing adjustment workflows.

### 16.4 Required approval and confirmation

Owner approval and legal/accounting confirmation remain required for:

- Discrepancy materiality and tolerance.
- GST treatment categories.
- Purchase component posting rule.
- Composition, export, SEZ, deemed-export, UIN, import, and reverse-charge scope.
- Codes `25`, `26`, `28`, `37`, `96`, `97`, and `99`.
- GSTIN checksum/authenticity requirements.
- Legacy backfill and correction.
- Returns, credit notes, and debit notes.
- Production release.

## 17. Implementation phases and gates

Implementation remains deferred until this specification is reviewed.

1. **Review and approve this specification.**
2. **Freeze the GST Disposable Test Suite checkpoint.**
3. **Centralize approved domain rules and validation.**
4. **Align schema, snapshots, and purchase accepted-value persistence.**
5. **Complete purchase evidence/reconciliation UI and workflow.**
6. **Complete sales captured-supply-facts workflow.**
7. **Align printing, reports, exports, and historical reconciliation.**
8. **Implement separately approved returns/corrections.**
9. **Run authorized isolated database verification and cleanup.**
10. **Conduct Broad Financial E2E review.**
11. **Complete Invoice Modernization.**
12. **Complete Live Supabase readiness and separately approved rollout.**
13. **Perform post-rollout validation and production Go/No-Go.**

Every phase requires focused tests, acceptance evidence, rollback planning, and
no claim beyond the evidence actually produced.

### 17.1 Release and security gates

| Gate ID | Purpose | Accountable approver role | Required evidence | Pass criteria | Block/fail condition | Current status |
|---|---|---|---|---|---|---|
| `REL-01` | Specification review and approval | Product owner | Reviewed GST master specification and sign-off record | Specification accepted and remaining blockers are named | Unresolved legal/policy blockers or missing evidence | `PENDING` |
| `REL-02` | Security review for protected financial workflows | Security/Architecture | Permission matrix, tenant model, review note, access-control tests | Protected workflows deny by default and evidence is verified | D-GST-30 remains unverified or contradicted | `BLOCKED` |
| `REL-03` | Purchase accounting contract review | Accounting/GST and product owner | Contract for taxable value, components, posting states, rounding, and discrepancy handling | All component rules are approved or explicitly blocked | Missing approval for component applicability, rounding, or posting authority | `BLOCKED` |
| `REL-04` | POS rule approval | Accounting/GST + qualified review | Supported-scope matrix, transaction-fact requirements, fail-closed cases | Ordinary domestic scenarios are approved; unsupported scenarios remain blocked | Unsupported jurisdiction rules or missing facts are treated as enabled | `BLOCKED` |
| `REL-05` | Reports and exports contract review | Product owner + Finance | Report, export, and reconciliation acceptance criteria | Each report/export has a source record contract and measurable expected output | Report calculation depends on mutable state without approved correction | `BLOCKED` |
| `REL-06` | Historical data and snapshot review | Product owner + Accounting/GST | Legacy-data handling rules and snapshot-preservation contract | Historical records are preserved without fabricated values | Recalculation from mutable master data or inferred historical values is used | `BLOCKED` |
| `REL-07` | Isolated database evidence and cleanup review | Engineering + Security/Architecture + Accounting | Finite disposable database target, fixtures, scenarios, cleanup evidence, artifacts | Broad financial lifecycle tests run in a clean isolated environment | Evidence is lacking or cleanup cannot be proven | `BLOCKED` |
| `REL-08` | Release authorization | Product owner + Engineering + Security | All earlier gate evidence plus rollback plan | Product release is explicitly approved after all gates pass | Any gate remains blocked or unverified | `NOT AUTHORIZED` |

The release gate hierarchy is intentionally separate from implementation status. A specification can be complete and still remain unapproved for implementation or production release.

## 18. Bidirectional traceability

### 18.1 Requirement → evidence → implementation → test

| Requirement area | Governing source / evidence | Implementation reference | Evidence status | Test / acceptance evidence |
|---|---|---|---|---|
| Sales calculation | GST-001; `gst-calculator.service.ts` | `splitLineGst()`, `calculateGstTotals()` in `gst-calculator.service.ts` | `CURRENT-IMPLEMENTATION` | Pure calculation tests; no production database proof |
| POS fail closed | GST-005; `determinePlaceOfSupply()` in `indian-states.ts` | `determinePlaceOfSupply()`, `requireResolvedPlaceOfSupply()` | `CURRENT-IMPLEMENTATION` | Local mapping/POS assertions; unresolved scenario coverage remains limited |
| Purchase evidence contract | D-GST-01, D-GST-02, D-GST-41, D-GST-44; purchase reconciliation service | `purchase-gst-reconciliation.service.ts` | `PARTIALLY DOCUMENTED` / `CURRENT-IMPLEMENTATION` | Pure validation exists; database enforcement and approval remain pending |
| Purchase component posting | D-GST-22, D-GST-23, D-GST-24, D-GST-41 | `purchase-gst-reconciliation.service.ts`; purchase actions/schema | `PARTIALLY DOCUMENTED` | Field-level contract exists, but rule approval and implementation enforcement remain outstanding |
| Sales and purchase snapshot integrity | D-GST-49; historical invoice policy | Sales print and invoice snapshot paths | `PARTIALLY IMPLEMENTED` | Prior GST-016 evidence exists but not a complete legal approval |
| RLS and tenant isolation | D-GST-29; tenant context and SQL policy assets | `tenant-context.ts`; RLS SQL assets | `PARTIALLY DOCUMENTED` | Static and policy-level evidence only; runtime verification pending |
| Standard domestic POS support | `PUR-POS-01`, `PUR-POS-02`, `SAL-POS-01`, `SAL-POS-02` | `determinePlaceOfSupply()` and sales/purchase actions | `CURRENT-IMPLEMENTATION` | Local state and logic tests; broader transaction approval pending |
| Unsupported prefixes | GST-017, GST-018; `UNSUPPORTED_GSTIN_STATE_PREFIXES` | `indian-states.ts` | `CURRENT-IMPLEMENTATION` / `BLOCKED` | Evidence exists that `97` and `99` are unsupported; no production approval |
| D-GST decision register | `pgst-01-decision-traceability-register.md` | Source-level register and policy files | `PENDING — NOT APPROVED` | Register preserves decisions; no implementation authorization |

### 18.2 Decision / requirement register

| ID | Governing source | Disposition | Specification section | Evidence status | Outstanding dependency |
|---|---|---|---|---|---|
| D-GST-01 through D-GST-52 | `pgst-01-decision-traceability-register.md` | Preserved as recorded; current disposition retained | 16.1 and 18 | `DOCUMENTED`, `PARTIALLY DOCUMENTED`, `CONTRADICTED`, or `UNVERIFIABLE` as recorded | Pending approval, implementation, or evidence |
| PGST-01 | `pgst-01-purchase-gst-workflow-policy.md` | `PENDING — NOT APPROVED` | 16.1, 16.2, 17.1 | `PENDING` | Product-owner and accounting/GST approval |
| GST-001 to GST-020 | `gst-audit-validation-and-plan.md` | Status retained as documented | 15.2 | Mixed: implemented, partially verified, blocked, or unresolved | Controlled database verification and policy review |

### 18.3 Reverse traceability

| Specification area | Governing requirement or decision | Status | Source evidence |
|---|---|---|---|
| Purchase three-value rule | D-GST-01, D-GST-02, D-GST-41, D-GST-44 | `PARTIALLY DOCUMENTED` | Purchase reconciliation design and source contracts |
| Purchase component contract | D-GST-22, D-GST-23, D-GST-24, D-GST-41 | `BLOCKED` | Approved component policy and accounting acceptance are absent |
| Sales POS rule | GST-005, D-GST-23, `SAL-POS-01` to `SAL-POS-05` | `CURRENT-IMPLEMENTATION` for ordinary domestic case | Sales calculation and POS source logic |
| Purchase POS rule | D-GST-23, `PUR-POS-01` to `PUR-POS-05` | `CURRENT-IMPLEMENTATION` for ordinary domestic case; unresolved beyond that | Purchase supply-fact and POS source contracts |
| Report/export contracts | GST-011, GST-012, GST-013, D-GST-49 | `BLOCKED` unless approved rule exists | Report/export sources and mutable-state gap |
| D-GST-30 security gate | D-GST-30 | `NOT VERIFIED` | Source inspection of permission helper does not confirm the alleged bypass |
| Release gates | D-GST-39, D-GST-40, D-GST-52 | `PENDING` | No runtime evidence or approval record |

This section deliberately does not silently reclassify any unresolved decision as approved. Where implementation, tests, or approvals are absent, they are explicit blockers.

### 18.4 Legal and source traceability boundary

The repository establishes application behavior and product-design intent, not
the legal meaning of every GST category or special-purpose code. Before a
scenario is enabled, the review record must cite the applicable primary source
(for example, the relevant CGST/IGST Act or Rules provision, CBIC notification
or circular, GST Portal guidance, or other official authority), its effective
date/version, the exact requirement supported, and any uncertainty. A generic
link or a GSTIN prefix table is not sufficient evidence.

The current evidence supports only these non-statutory conclusions:

- The application has ordinary domestic `INTRA`/`INTER` calculation behavior
  for the inspected sales path.
- `96` has no established meaning in the active repository.
- `97` and `99` are rejected as unsupported special-purpose prefixes and are
  not established as ordinary state codes.
- The eight reference labels are a product classification model and are not
  evidence that every corresponding statutory workflow is supported.

No legal source has been recorded here as proving a treatment for `96`, `97`,
`99`, composition, overseas, SEZ, deemed export, UIN, UTGST, or any special
rate. Those are `LEGAL/ACCOUNTING-CONFIRMATION` dependencies and remain
blocked until the source, effective date, interpretation, and approval are
recorded by the responsible owner and qualified GST professional.

## 19. Open issues and closure criteria

| ID | Open issue | Blocking effect | Closure criteria |
|---|---|---|---|
| OPEN-01 | Formal PGST-01 approval pending | Purchase implementation/activation blocked | Attributable approval and scope recorded |
| OPEN-02 | GST professional/legal review pending | Covered statutory scenarios cannot be claimed | Written review for each supported scenario |
| OPEN-03 | Prefix authority for historical/special codes incomplete | GST-017/018 blocked | Official context-specific evidence and approved behavior |
| OPEN-04 | Purchase component posting not complete | Purchase accounting acceptance incomplete | Approved rules, implementation, database E2E |
| OPEN-05 | Historical backfill strategy unresolved | GST-012 blocked | Owner-approved additive/manual-review strategy |
| OPEN-06 | Reports/exports use mutable state | Historical reporting not authoritative | Persisted-fact report/export parity tests |
| OPEN-07 | Returns absent | Corrections and reversal scope incomplete | Approved model, implementation, and E2E |
| OPEN-08 | Disposable database evidence gate | GST-019/GST-020 blocked | Verified identity, fixtures, scenarios, cleanup, artifacts |
| OPEN-09 | Reference treatment categories are not implemented as verified classifications | Eight-category scope cannot be enabled or claimed complete | Approved category/fact/rule matrix, server validation, persistence, downstream parity, and category acceptance evidence |
| OPEN-10 | `96` has no evidence-grounded meaning | Any `96` transaction treatment would be guesswork | Owner and qualified GST professional identify field context, legal meaning, supported facts, treatment, and tests |
| OPEN-11 | `97` and `99` are only proven as unsupported prefixes | Special-purpose transactions cannot be posted or reported | Authoritative context-specific meaning, approved treatment, distinct persistence, and isolated tests |
| OPEN-12 | UTGST is not represented by an approved component contract | UTGST-applicable transactions cannot be represented safely | Accounting/GST approval, schema/service contract, rule selection, and component/report tests |
| OPEN-13 | Purchase POS remains caller-supplied | Calculated purchase GST can be based on an unverified scenario | Server-derived POS from captured facts, contradiction checks, and posting-time revalidation |
| OPEN-14 | Accepted purchase values are not proven to drive invoice/item posting | Accounting decision can diverge from payable, ledger, report, or stock values | One approved source-of-truth contract plus persistence and rollback evidence |
| OPEN-15 | Rate governance and effective-date behavior are incomplete | Historical recalculation and statutory correctness are not reproducible | Approved versioned source, effective intervals, HSN/SAC selection, and tests |
| OPEN-16 | Historical snapshots and report/export source-of-truth are incomplete | Mutable masters or aggregate tax can change historical output | Persisted component/category snapshots and parity tests for invoices, HSN, and exports |
| OPEN-17 | Acceptance permissions, self-approval, and separation of duties remain unresolved | Unauthorized or conflicted accounting acceptance is possible | Attributable role matrix, owner/accounting decision, enforcement, and authorization tests |
| OPEN-18 | Duplicate matching, revision invalidation, and idempotency are incomplete | Repeated or changed requests may create inconsistent financial effects | Durable request identity, revision fingerprint, uniqueness, concurrency, and rollback evidence |
| OPEN-19 | Master-data create/change authorization coverage is incomplete | Untrusted registration/location facts may enter GST resolution | Approved permissions for create/change, audit evidence, and cross-tenant tests |
| OPEN-20 | Legal traceability for special categories and codes is incomplete | Product design could be mistaken for statutory approval | Primary-source review recorded per supported scenario, with date/version and remaining uncertainty |

## 20. Document scope and status notes

This section records the current working scope and status boundaries for the GST
master specification. The file is maintained as a documentation-only proposal and
remains subject to owner review before any implementation, migration, rollout, or
statutory filing authorization is granted.

The substantive scope and policy details remain in the sections above, including:

- the explicit Inventory boundary, where Inventory implementation is out of scope
  and only preservation of the existing Purchases/Sales-to-Inventory interfaces may
  be checked;
- the purchase tax-component contract;
- the domestic purchase and sales POS matrices;
- the report/export and reconciliation requirements;
- the D-GST-30 `CONTRADICTED / NOT VERIFIED` status and the related blocked
  security gates;
- the existing release gates and the decision/acceptance traceability.

The document intentionally does not treat unresolved GST, security, accounting,
POS, reporting, concurrency, database-isolation, or cleanup issues as resolved.
