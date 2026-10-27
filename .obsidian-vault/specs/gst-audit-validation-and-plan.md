# GST/IGST Audit Validation & Minimum Scope Implementation Plan

**Date:** 2026-10-18
**Time:** 06-03-20 (IST)
**Phase:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Task:** GST/IGST remediation documentation reconciliation

---

## Step 1 — Validation of Original Audit Findings

## GST/IGST Remediation Status Matrix — 2026-10-18

**Scope note:** This matrix replaces the prior standalone closure label. It
records the actual repository state and does not create a formal GST stage.
P0-P3 remain audit priorities, not implementation-stage numbers.

**Summary:** 20 requirements tracked; 7 implemented and verified; 6 partially
implemented/limited; 3 outstanding; 3 blocked pending prerequisites; 1 deferred
by explicit decision; 1 unclear. Financial E2E readiness: **blocked**. The
accepted GST product policy is recorded below, but documentation is not
implementation, migration, runtime, or statutory verification evidence.
Last reviewed: `2026-10-28 00-26-27 (IST)`.

### Batch 3G RLS verifier and privilege review

The local RLS rollout verifier in `scripts/rls-rollout-verifier.mjs` now
requires an explicitly approved target identity and grant set. It rejects
missing or duplicate table metadata, malformed policy/grant metadata, missing
tables, disabled RLS, missing or duplicated tenant policies, wrong policy
roles, wrong `USING`/`WITH CHECK` predicates, missing grants, and unexpected
grants. Its tests are pure snapshot-contract tests; they do not prove that a
snapshot came from a database or that runtime RLS is enforced.

The seven affected tables are:

- `purchase_posting_operations`
- `purchase_gst_evidence_revisions`
- `purchase_gst_line_evidence`
- `purchase_gst_calculations`
- `purchase_gst_accounting_decisions`
- `purchase_gst_reconciliation_events`
- `purchase_gst_reconciliation_event_lines`

The current SQL asset still grants `SELECT, INSERT, UPDATE, DELETE` to the
`authenticated` role for these tables and grants no additive table access to
`anon`. This grant model is **not approved as a final security decision**.
Direct Supabase Data API CRUD remains unapproved pending Security/Architecture
and database-owner review. No grant was revoked and no runtime role model was
changed in Batch 3G.

Decision-ready options:

1. **Revoke direct client `UPDATE`/`DELETE` (recommended default):** keep
   tenant RLS, remove direct client mutation of financial history, and route
   authorized writes through the server-side Prisma action boundary. This
   requires confirmation of the actual Prisma role and its effective grants,
   plus isolated verification of every permitted operation.
2. **Restricted roles or controlled write functions:** separate read access
   from narrowly authorized writes and enforce membership/permission checks in
   the controlled boundary. This requires role ownership, function security
   review, and runtime privilege/RLS tests.
3. **Database immutability controls:** add reviewed triggers or equivalent
   controls for append-only and immutable records. This requires trigger
   lifecycle, bypass-role, migration, and rollback review.

Integrity classification:

- Evidence revisions, calculations, accounting decisions, and reconciliation
  events are intended to be immutable or append-only after creation.
- Reconciliation event lines are historical associations and should not be
  edited or deleted independently.
- Posting operations require controlled state transitions (`PROCESSING` to
  `COMPLETED`) and are not strictly immutable during processing, but completed
  results require protection from unauthorized mutation/deletion.
- Current purchase projection fields and posting-operation processing state are
  legitimate mutable workflow state, subject to authorization and transaction
  rules.

The current RLS policy is tenant isolation only. It does not enforce
application permissions, active membership, segregation of duties, immutable
history, or posting workflow rules. The risk remains open until the privilege
decision is approved and database-backed grants, role behavior, immutability,
and cross-tenant tests pass.

Migration readiness remains blocked: no approved Prisma migration baseline,
live target-schema evidence, or database identity evidence exists in the
repository. A future additive migration requires an approved baseline,
read-only identity/schema/grant preflight, uniqueness and foreign-key conflict
checks, lock review, expand-first compatibility review, and explicit approval
before execution. Destructive bootstrap SQL and unknown historical backfills
remain excluded.

| ID | Requirement | Priority | Current status | Implementation evidence | Test evidence | Dependencies / blockers | Next action |
|---|---|---|---|---|---|---|---|
| GST-001 | Canonical sales GST calculation | P0 | Implemented and verified | `gst-calculator.service.ts`: `splitLineGst()`, `calculateGstTotals()`; `sales.actions.ts`: `computeServerGstTotals()` | `tests/gst-calculator.test.ts`; 243 assertions passed | None for current sales path | Preserve as shared sales calculation path |
| GST-002 | Component-wise rounding and preview/server parity | P0 | Implemented and verified | `splitLineGst()`; billing `_form.tsx` calls `gstCalculator.computeLine()` | ₹10.10 at 5% INTRA/INTER parity assertions; 243 assertions passed | No database-backed parity test | Add integration coverage when isolated DB exists |
| GST-003 | Discount normalization | P0 | Implemented and verified | `toTaxableGstLine()` accepts `trade_discount_pct` and `discount_pct` | Equivalent discount-shape, persisted-fact, state, and purchase-contract assertions; 243 assertions passed | None for current sales path | Preserve; cover purchase semantics separately |
| GST-004 | State name/code normalization | P0 | Partially implemented / limited | `indian-states.ts`: `normalizeState()`, `determinePlaceOfSupply()` | State normalization and supported-prefix tests; 243 assertions passed | Complete authoritative prefix table unavailable | Obtain authoritative mapping evidence before claiming full verification |
| GST-005 | Fail-closed place-of-supply handling | P0 | Implemented and verified | `determinePlaceOfSupply()` returns `UNKNOWN`; `requireResolvedPlaceOfSupply()` rejects unresolved finalization | Missing, invalid, whitespace, `97`, and `99` cases covered | Special-prefix workflow support remains deferred | Preserve fail-closed behavior |
| GST-006 | Sales tax-component persistence | P0 | Partially implemented / limited | Local Prisma schema, SQL asset, draft persistence, and finalization updates add nullable components and taxable amount | No database-backed persistence test | SQL provisioning review/execution required | Verify persistence against an isolated database |
| GST-007 | Sales place-of-supply persistence | P0 | Partially implemented / limited | Local Prisma schema, SQL asset, and finalization update add `place_of_supply_code` | No database-backed persistence test; current value uses customer billing-state proxy | Accepted policy requires captured supply facts; implementation and SQL rollout are not authorized or verified | Implement approved fact capture and verify persistence in an isolated database |
| GST-008 | Purchase intra/inter-state GST calculation | P0 | Outstanding | `purchases.actions.ts` still computes aggregate GST without place-of-supply logic | No purchase GST parity suite | Accepted supplier-evidence/reconciliation policy requires approved rule version and captured transaction facts | Implement after policy model, legal review, and implementation authorization |
| GST-009 | Purchase tax-component persistence | P0 | Partially implemented / limited | Local Prisma schema and purchase form/action capture separate supplier-declared taxable, CGST, SGST, IGST, cess, invoice-total, round-off, provenance, and supply-fact fields; versioned calculations, decisions, reconciliation events, line evidence, correction revisions, and posting-operation projections are represented locally; additive guarded RLS coverage is prepared for all seven new tenant-owned tables | `pnpm prisma generate`, typecheck, pure reconciliation/calculation tests, and static RLS policy coverage pass; no persistence or database test | No migration or database rollout; correction, duplicate, idempotency, concurrency, rollback, and RLS behavior remain database-unverified | Review the local implementation, provision the isolated schema, then verify against an isolated database |
| GST-010 | Business-profile state validation | P0 | Partially implemented / limited | `tenant.schemas.ts`, `onboardNewTenant()`, `BusinessProfileRepository`, and `updateBusinessProfileAction` normalize/reject state values at server boundaries | `businessProfileStateSchema` and settings payload-mapping tests cover names, codes, blank, invalid values, and repository-shaped mapping; pure test evidence only | Database runtime rejection and RLS behavior unverified | Verify the save action against an isolated database |
| GST-011 | Historical invoice tax integrity and printing | P0 | Partially implemented / limited | Print page has snapshot-selection helpers and explicit legacy fallback paths; current print behavior still has legacy recomputation paths | Pure completeness and snapshot-preference assertions; no historical immutability integration test | Finalized snapshot persistence and print parity are not database-verified | Implement snapshot-first printing and verify against an isolated database |
| GST-012 | Schema and historical-data strategy | P0 | Outstanding | Audit/spec documents identify missing fields and backfill questions | Review documented; no approval or migration executed | Explicit human approval required; ambiguous history cannot be guessed | Prepare reviewable schema/backfill proposal |
| GST-013 | Purchase GST regression coverage | P0 | Partially implemented / limited | `purchase-calculator.service.ts` preserves the existing aggregate purchase contract; purchase actions capture evidence, persist versioned calculations, expose accounting acceptance and discrepancy-resolution/correction actions, add stable posting idempotency, duplicate guards, optimistic claiming, and locked invoice-sequence allocation, and fail closed on stale/incomplete acceptance; unauthenticated requests no longer receive a demo-tenant context | `pnpm prisma generate`, `pnpm typecheck`, `git diff --check`, and `tests/purchase-gst-reconciliation.test.ts` passed; the focused suite has 43 assertions including intra/inter-state calculation, resolution, stale/incomplete acceptance, and rounding guards | Action/persistence, duplicate-match classification, concurrent finalization, sequence races, rollback, RLS, and database-backed correction tests remain unverified | Add guarded isolated-database coverage before claiming financial integrity or stage completion |
| GST-014 | Rollback and ledger consistency | P0 | Implemented and verified for application-path database E2E | `finalizeSalesInvoiceAction` performs meaningful first-line stock work before an insufficient-FEFO failure inside the production transaction | GST application runner: invoice status/number/tax/snapshots, sequence, batches, stock movements, customer ledger/balance, and audit state remained unchanged; `GST-014=PASS_APPLICATION_PATH_DATABASE_E2E` | Broader success/payment/cleanup scenarios remain outside this scenario | Preserve transaction boundary and extend only through separately authorized financial E2E |
| GST-015 | Invoice-sequence rollback | P0 | Implemented and verified for application-path database E2E | `finalizePurchaseAction` reaches the same-tenant invoice-number conflict after entering the production transaction | GST application runner: purchase status/sequence, posting operation, stock/batches, stock movements, supplier ledger/balance, and audit state rolled back; `GST-015=PASS_APPLICATION_PATH_DATABASE_E2E` | Broader purchase-success/concurrency/cleanup scenarios remain outside this scenario | Preserve sequence lock/transaction behavior |
| GST-016 | Historical invoice immutability | P0 | Implemented and verified for application-path database E2E | Authenticated print data loader used by the real print page, persisted complete snapshots, explicit missing-snapshot behavior, tenant-qualified retrieval, and finalized-record triggers were exercised | GST application runner retained separate complete and missing-snapshot fixtures; master-data changes did not alter printed snapshot values, missing COMPLETE values remained null, cross-tenant retrieval returned no invoice, and header/line mutations were rejected; `GST-016=PASS_APPLICATION_PATH_DATABASE_E2E` | Legacy backfill strategy remains GST-012; fixtures are retained because cleanup is separately unauthorized | Preserve snapshot-first printing and legacy disclosure rules |
| GST-017 | Authoritative GSTIN prefix verification | P0 | Unclear — further evidence required | `indian-states.ts` preserves mappings and documents source gap | Unit tests verify application mapping only | Comprehensive authoritative source not established | Obtain and archive authoritative mapping evidence |
| GST-018 | Special-prefix handling for `97`/`99` | P0 | Deferred by explicit decision | `UNSUPPORTED_GSTIN_STATE_PREFIXES`; parser returns `null`; ordinary normalization excludes both | `tests/gst-calculator.test.ts` covers both and fail-closed POS | Broader support requires a concrete workflow and evidence | Revisit only under authorized business requirement |
| GST-019 | Financial E2E infrastructure | P0 | Blocked pending prerequisites | Guarded `scripts/financial-e2e.mjs`, target/readiness guards, pure fixture manifest/cleanup ownership contract, and dependency-aware cleanup ordering including the seven GST/posting tables exist | Safety, readiness, ownership, ordering, failure-gating, and static RLS policy coverage tests pass; no database connection or fixture lifecycle executed | Isolated DB identity verification, tenant fixture, schema/RLS rollout, and safe reset lifecycle missing | Provision disposable test environment and apply only after authorization |
| GST-020 | Financial E2E execution | P0 | Partially verified — remains blocked | Guarded application-path runner now covers retained sales/purchase success, rollback, payment, purchase-GST review guard, authenticated historical printing, and tenant A/B RLS/effective-privilege checks on the approved disposable target | Fresh authorized local run passed `TENANT-RLS-PRIVILEGES`, `GST-014`, `GST-015`, `SALES-SUCCESS`, `PURCHASE-SUCCESS`, `PURCHASE-GST-REVIEW-GUARD`, `PAYMENT`, and `GST-016`; fixtures retained; this is database-backed application evidence, not cleanup completion | Cleanup authorization/completion evidence, full legacy/schema compatibility acceptance, GST-012 historical-data decisions, GST-018 `97`/`99` support, and remaining canonical financial acceptance criteria are unresolved | Preserve retained evidence; obtain the remaining owner decisions and separately authorize/execute the missing acceptance stages before changing status to PASS |

### Completed evidence and limitations

The completed sales calculation, rounding, discount, normalization, fail-closed,
and special-prefix work is preserved in the matrix above. The 243 assertions,
typecheck, and lint evidence were recorded previously; they are not claimed as a
fresh execution in this reconciliation. Historical seller/customer snapshots,
complete historical tax components/place of supply, comprehensive prefix
verification, and database-backed finalization/rollback testing remain limited.

`97` remains a special-purpose prefix outside ordinary state/UT normalization.
`99` remains outside ordinary normalization with unresolved workflow semantics.
Neither is mapped to a physical state or UT, and unresolved place of supply
continues to fail closed. Tests verify application policy, not legal validity,
registration authenticity, checksum validity, or universal applicability.

## Accepted GST Product Policy — 2026-10-22

This section is the canonical product-policy record for the next
implementation step. It does not authorize code, schema, migration, database,
deployment, or production changes. The policy requires qualified GST
professional review before production use wherever legal interpretation is
involved.

### Accepted purchase GST policy

#### Supplier evidence, calculation, and accounting acceptance

Purchase processing must preserve supplier-document evidence separately from
application calculations and accounting decisions. At minimum, the design must
represent:

1. **Supplier-declared values:** taxable values, tax rates, CGST, SGST, IGST,
   applicable cess, invoice totals, and every other available source fact.
2. **Application-calculated expected values:** independently calculated from
   the captured transaction facts and an explicit, versioned application rule
   set.
3. **Accounting-accepted values:** the values authorized for posting, with
   their source and decision recorded.

The application must reconcile supplier-declared values against calculated
expected values. It must never overwrite supplier evidence, silently substitute
calculated values, or display calculated values as supplier-declared facts.
Original supplier evidence remains immutable when a discrepancy is reviewed or
resolved. Reconciliation status, discrepancy details, resolution, approver
where applicable, and audit events are separate records from the source
evidence. A disagreement does not make either side automatically correct.

Purchase tax components require separate representations for taxable value,
CGST, SGST, IGST, and applicable cess, with declared and calculated values
distinguishable and missing values distinguishable from verified zero.

#### Discrepancies and posting

- An incomplete or discrepant invoice may be saved as `DRAFT` or
  `REVIEW_PENDING`.
- An unresolved material GST discrepancy must block accounting completion and
  posting.
- Resolution requires an explicit, auditable decision under a documented
  policy; it cannot be an implicit save or recalculation side effect.
- Rounding differences must be classified separately from substantive tax
  discrepancies. No discrepancy tolerance is invented here; the tolerance
  policy remains pending accountant approval.
- Rejected invoices, supplier corrections, credit/debit notes, and later
  reconciliation require separate workflow decisions before implementation.
  No automatic reversal, overwrite, or re-posting behavior is implied by this
  policy.

#### Purchase rounding and place of supply

Existing purchase behavior is preserved: two-decimal line values, whole-unit
invoice rounding, and signed `round_off`. Supplier-stated totals and existing
purchase amount behavior must not be silently changed. Any change requires
explicit approval and regression coverage.

Purchase place of supply must be determined from applicable Indian GST rules
and captured transaction facts. It must not be inferred solely from supplier
state, customer billing state, or a GSTIN prefix. The component model must
support reconciliation and auditability without changing current purchase
behavior until separately authorized.

### Accepted sales GST policy

Sales adopts **Option B: capture actual supply facts**. The workflow must
capture the transaction facts required for the supported supply scenario and
determine place of supply and CGST/SGST versus IGST using applicable Indian GST
rules, seller location, captured transaction facts, and applicable exceptions.
GSTIN-prefix lookup alone is insufficient. Missing required facts or an
unsupported scenario must fail closed; no universal `customer.billing_state`
shortcut or silent fallback is permitted.

Rules must be explicit, versioned, testable, and auditable. The implementation
specification must enumerate supported scenarios and explicitly reject
unsupported scenarios. A qualified GST professional must review the legal
interpretation of each covered scenario before production use.

Current implementation facts are narrower: sales code uses normalized business
profile state and customer billing state for its current proxy path,
`gstCalculator` performs component calculation and fail-closed unresolved POS
handling, and local sales persistence/snapshot helpers exist. This is not
evidence that the accepted transaction-fact policy is implemented or that
database persistence has been rolled out.

### Accepted historical invoice policy

Finalized invoices must preserve immutable transaction-time facts sufficient for
recalculation-independent printing and audit: seller, customer, product/HSN,
taxable value, tax components, and place-of-supply facts, plus the applicable
rule/version metadata required by the implementation design. Reprints must
prefer persisted invoice snapshots over mutable master data.

Missing historical facts must not be fabricated, treated as zero, or rebuilt
from current masters. Aggregate totals remain preserved when detailed facts are
unavailable. Legacy fallback output must disclose unavailable historical detail
and must not present current master data as verified historical data.

Because the application is not deployed to production and current invoices are
test data, a controlled migration/rebuild of test data may be proposed for
review. No data is deleted, reset, or rewritten by this documentation task.
Schema support, migration status, runtime persistence, and immutability
verification remain separate evidence claims.

### Implementation-ready acceptance criteria

The next implementation and validation work must demonstrate, with separate
evidence, that:

1. Supplier-declared purchase values remain unchanged after calculation and
   reconciliation.
2. Calculated expected tax is stored and identified separately.
3. Unresolved material discrepancies allow draft/review-pending saves but block
   accounting completion/posting.
4. Reconciliation resolutions are explicit and auditable.
5. Existing purchase rounding is preserved.
6. Purchase tax components are independently represented.
7. Sales POS comes from required transaction facts and applicable rules, not a
   universal billing-state shortcut.
8. Missing sales facts and unsupported scenarios fail closed.
9. Finalized invoice reprints use persisted transaction snapshots.
10. Missing legacy facts are disclosed, never fabricated.
11. No database, migration, production, or runtime claim is made without
    corresponding evidence.

### Decisions still requiring approval

- Exact purchase discrepancy tolerance and the accounting definition of
  materiality.
- Exact workflow/status names and authority for `REVIEW_PENDING`, resolution,
  rejection, supplier correction, credit/debit notes, and later reconciliation.
- Exact captured facts and supported rule scenarios for each sales and purchase
  supply type.
- Component completeness rules, accounting acceptance precedence, and posting
  behavior when declared and calculated values disagree.
- Controlled test-data migration/rebuild scope and rollback evidence.

### Review and evidence gates

Product/accounting owners must approve the workflow and posting decisions.
Qualified GST/legal review is required for the covered place-of-supply rules,
exceptions, rounding interpretation, and any statutory representation. No
database-backed persistence, migration rollout, production readiness,
historical immutability, or runtime financial verification is established by
this policy record or by the pure test results.

## GSTIN State-Prefix Evidence Review — 2026-10-13

This focused review checks the prefix table in `src/lib/constants/indian-states.ts`.
The implementation preserves the existing supported `01`-`38` mappings and does
not infer a state from an unsupported or special-purpose prefix.

| Prefix set | Application mapping | Classification | Evidence status |
|---|---|---|---|
| `01`-`24` | Existing state/UT codes (`JK` through `GJ`) | Current state/UT inputs | Complete authoritative table not extractable from the supplied sources in this environment; no code change made |
| `25` | `DD` | Historical Daman and Diu input; lossy current merged-UT normalization | Historical treatment unresolved; do not treat as interchangeable with `26` outside this application normalization |
| `26` | `DD` | Historical Dadra and Nagar Haveli / merged-UT input | Historical treatment unresolved; retained unchanged |
| `27` | `MH` | Current Maharashtra | Existing mapping retained |
| `28` | `AP` | Historical Andhra Pradesh input | Historical treatment unresolved; retained unchanged |
| `29`-`36` | Existing state/UT codes (`KA` through `TG`) | Current state/UT inputs | Complete authoritative table not extractable from supplied sources; no code change made |
| `37` | `AP` | Current Andhra Pradesh | Existing mapping retained; current-versus-historical corroboration remains incomplete |
| `38` | `LA` | Current Ladakh | Existing mapping retained; corroborating official table remains incomplete |
| `97` | `null` | Special-purpose `Other Territory` policy | Not a physical state/UT; explicitly unsupported |
| `99` | `null` | Special-purpose `OIDAR` policy | Not a physical state/UT; explicitly unsupported |

### Official sources inspected

1. **Approved Monthly GST Data for Publishing — July 2025**, GST Portal/GSTN:
  <https://tutorial.gst.gov.in/downloads/news/approved_monthly_gst_data_for_publishing_july_2025.pdf>
  The PDF is an official GST Portal source supplied for this review, but its
  contents were not text-extractable through the available tools; no complete
  prefix table or historical mapping was asserted from it.
2. **Advisory dated 19 January 2024 — bulk upload**, CBIC ECCS:
  <https://courier.cbic.gov.in/ECCS/advisory/2024/advsry-01-bulkupload-19jan2024.pdf>
  This is an official CBIC customs-system validation advisory. It is recorded
  as contextual evidence only and is not treated as conclusive proof of GSTIN
  historical state-prefix semantics.
3. **CBIC GST portal directory:**
  <https://www.cbic.gov.in/entities/gst>
  This confirms the official GST/GSTN portal links but does not itself publish
  the required complete prefix table.

The application validates GSTIN shape only. It does not claim checksum or
registration authenticity. Standalone state inputs continue through
`normalizeState()`, while `97` and `99` return `null` from GSTIN prefix parsing
and therefore cannot silently drive place-of-supply classification.

### Finding 1: Core GST Calculator — CONFIRMED ✅

**Audit Claim:** Correctly implements intra/inter logic with HALF_UP rounding.

**Evidence:** `src/domain/services/gst-calculator.service.ts`
- `splitLineGst()` correctly splits: INTRA → CGST+SGST (rate/2 each), INTER → IGST (full rate)
- `round()` uses `Math.round(value * 100) / 100` = HALF_UP to 2 decimals
- `calculateGstTotals()` sums line splits and rounds totals
- `detectPlaceOfSupply()` compares state codes (expects 2-char codes like "MH")

**Contradiction Found:** The calculator expects **state codes** (2-char), but actions pass **state names** (e.g., "Maharashtra"). This creates a silent bug where "Maharashtra" !== "MH" → always INTER.

---

### Finding 2: Sales Tax Calculation & Persistence — MOSTLY CONFIRMED ⚠️

**Audit Claim:** Sales computes GST via `gstCalculator`, stores per-line `gst_rate`/`gst_amount`, header `total_tax`, finalize recomputes and validates.

**Evidence:** `src/app/_actions/sales.actions.ts`
- `createSalesDraftAction` (lines 156-240): Calls `computeServerGstTotals()` → `gstCalculator.computeTotals()` with `placeOfSupply` from `isInterStateFromCustomer()`
- Stores per-line: `gst_rate` (line 223), `gst_amount` (line 224) — **AGGREGATE only, no CGST/SGST/IGST split**
- Stores header: `total_tax: gstTotals.total_tax` (line 197), `round_off: gstTotals.round_off_applied` (line 198), `net_amount: gstTotals.grand_total` (line 199)
- `finalizeSalesInvoiceAction` (lines 273-457): Recomputes via `computeServerGstTotals()`, validates against draft with `__MAX_SALES_TOTALS_MISMATCH_PAISE = 0.02`, updates header with recomputed values

**Confirmed Defects:**
1. **Line items store only aggregate `gst_amount`** — no CGST/SGST/IGST breakdown persisted
2. **Draft uses aggregate line GST** (`lineGst = round2(lineTaxable * rate/100)`) but finalize uses calculator that splits and rounds per-component — mismatch masked by 0.02 tolerance
3. **`isInterStateFromCustomer()` compares state NAMES** (e.g., "Maharashtra") but `detectPlaceOfSupply()` expects CODES (e.g., "MH") — silent INTRA/INTER misclassification

---

### Finding 3: Purchase Tax Calculation & Persistence — CONFIRMED CRITICAL DEFECT ❌

**Audit Claim:** Purchase side has NO intra/inter logic, only aggregate `gst_amount`, no CGST/SGST/IGST split.

**Evidence:** `src/app/_actions/purchases.actions.ts`
- `computeLineTotals()` (lines 73-83): `gst_amount = round2(taxable * (gstPct / 100))` — **pure aggregate, no split**
- `computeInvoiceTotals()` (lines 85-92): Sums aggregate `gst_amount` — no CGST/SGST/IGST
- `createPurchaseDraftAction`: Accepts client-submitted `total_tax`, stores per-line aggregate `gst_amount`
- `finalizePurchaseAction` (lines 240-446): Recomputes via `computeLineTotals()` + `computeInvoiceTotals()` — **still no intra/inter logic**
- No `placeOfSupply` concept anywhere in purchase flow
- Supplier state (`supplier.state`) and business profile state (`businessProfile.state`) are NEVER compared for purchases

**This is a CONFIRMED BLOCKER for any purchase register with GST breakdown.**

---

### Finding 4: State Normalization — PARTIAL VALIDATION ⚠️

**Audit Claim:** No normalization; string comparison only; no GSTIN-based POS.

**Evidence:**
- `isInterStateFromCustomer()` (sales.actions.ts:112): `.trim().toLowerCase()` comparison — normalizes case/whitespace but compares **names**, not codes
- `detectPlaceOfSupply()` (gst-calculator.service.ts:107): Expects **state codes** (2-char), does exact string equality
- Customer/Supplier validation (masters.schemas.ts:140, 180): `billing_state` / `state` validated against `INDIAN_STATE_REGEX = /^[A-Z]{2}$/` — **enforces 2-letter codes**
- Business profile validation (tenant.schemas.ts:12): `state: z.string().optional()` — **NO format enforcement**
- GSTIN validation: Customer/Supplier schemas have `INDIAN_GSTIN_REGEX = /^[0-9A-Z]{15}$/` — **format validated**; Business profile only length check

**Contradiction:** The audit claims "no GSTIN validation" — **FALSE**. Customer/Supplier create/edit DO validate GSTIN format (15 alphanumeric). Business profile does NOT validate GSTIN checksum, only length.

**Critical Gap:** Actions pass state **names** to calculator expecting **codes**. If business profile stores "Maharashtra" and customer stores "MH", comparison fails silently.

---

### Finding 5: Rounding Consistency — CONFIRMED MISMATCH ⚠️

**Audit Claim:** Line-level rounding in actions vs total-level in calculator creates mismatch.

**Evidence:**
| Location | Function | What Gets Rounded |
|----------|----------|-------------------|
| `gst-calculator.service.ts:27` | `round()` | Per-component (CGST, SGST, IGST) in `splitLineGst()`, then sums rounded again in `calculateGstTotals()` |
| `sales.actions.ts:108` | `round2()` | Per-line aggregate `gst_amount` in draft creation |
| `purchases.actions.ts:73` | `round2()` | Per-line aggregate `gst_amount` |

**Actual Mismatch:**
- **Draft creation:** `lineGst = round2(lineTaxable * rate/100)` → single aggregate rounded per line
- **Finalize recomputation:** `gstCalculator.computeTotals()` → `splitLineGst()` rounds CGST/SGST/IGST **separately per line**, then `calculateGstTotals()` rounds sums again
- **Result:** `Σ round(line_taxable * rate/100)` ≠ `round(Σ round(line_taxable * rate/200)) + round(Σ round(line_taxable * rate/200))` for intra-state
- **Tolerance:** `__MAX_SALES_TOTALS_MISMATCH_PAISE = 0.02` (2 paise) masks this but is a compliance risk

**For purchases:** Only aggregate rounding exists — no split to verify.

---

### Finding 6: Invoice Printing — RECOMPUTES, NOT PERSISTED ⚠️

**Audit Claim:** Print page recomputes tax splits independently.

**Evidence:** `src/app/billing/[invoiceId]/print/page.tsx`
- Lines 156-165: `computeLineTaxSplit()` calls `splitLineGst()` with `detectPlaceOfSupply(businessProfile.state, customer.billing_state)` — **recomputes from scratch**
- Lines 167-170: Sums recomputed `cgst_amount`, `sgst_amount`, `igst_amount` for totals display
- Lines 172-176: Reads `invoice.total_tax` (persisted) for "Tax" row in totals table
- **Tax Split column (lines 470-485):** Shows recomputed `split.cgst_amount`/`split.sgst_amount` or `split.igst_amount`
- **Tax summary (lines 520-527):** Shows recomputed `totalCgst`/`totalSgst` or `totalIgst`

**Critical Issue:** Print page uses **current** business profile state and customer state, not the state **at time of finalization**. If either changes, printed invoice shows different tax split than what was finalized.

---

### Finding 7: Ledger & Financial Totals Dependency — CONFIRMED ✅

**Audit Claim:** Ledger entries use recomputed finalized totals.

**Evidence:**
- Sales finalize (sales.actions.ts:415-417): `debit = serverGst.grand_total` (recomputed), customer `receivable_balance` incremented by same
- Purchase finalize (purchases.actions.ts:410-412): `credit = serverTotals.net_amount` (recomputed), supplier `payable_balance` incremented by same
- **Both use finalize-time recomputed values** — correct for accounting consistency
- **But:** If CGST/SGST/IGST split is needed for GSTR-2 reconciliation, purchase side lacks it entirely

---

### Finding 8: GSTIN/State Validation — AUDIT PARTIALLY INCORRECT ⚠️

**Audit Claim:** "No GSTIN validation", "No state code validation"

**Actual State:**
| Entity | GSTIN Validation | State Code Validation |
|--------|------------------|----------------------|
| Customer | ✅ Format (15 alphanumeric) via `INDIAN_GSTIN_REGEX` | ✅ 2-letter code via `INDIAN_STATE_REGEX` |
| Supplier | ✅ Format (15 alphanumeric) | ✅ 2-letter code |
| Business Profile | ❌ Only length ≤15, no format | ❌ No validation |

**Missing:** GSTIN **checksum validation** (not just format), state code **normalization** (name ↔ code mapping), business profile validation parity.

---

### Finding 9: GSTR-1/3B Reports — CONFIRMED MISSING ❌

**Audit Claim:** Only HSN summary exists; no B2B, B2C, document summary, nil/exempt, amendments.

**Evidence:** `src/app/reports/gst-hsn-summary/page.tsx` — only HSN+rate aggregation with CGST/SGST/IGST split based on current tenant/customer states. No other GSTR-1 reports exist.

---

## Step 2 — MVP vs Advanced Compliance Classification

### MVP Financial Correctness (Must Have for Reliable Accounting)

| Feature | Status | Required for MVP? |
|---------|--------|-------------------|
| Correct intra-state (CGST+SGST) calculation | ✅ Calculator has it | **YES** |
| Correct inter-state (IGST) calculation | ✅ Calculator has it | **YES** |
| Consistent place-of-supply determination | ❌ Broken (name vs code) | **YES** |
| Persisted CGST/SGST/IGST split per line (sales) | ❌ Missing | **YES** |
| Persisted CGST/SGST/IGST split per line (purchases) | ❌ Missing | **YES** |
| Place of supply stored on finalized invoice | ❌ Missing | **YES** |
| Rounding consistency (line-level per GST law) | ❌ Mismatch | **YES** |
| Print uses finalized values, not recomputed | ❌ Recomputes | **YES** |
| Purchase intra/inter logic parity with sales | ❌ Missing entirely | **YES** |
| Ledger totals match finalized invoice totals | ✅ Uses recomputed | **YES** |

### Required for Intended Operating Model (Pharma Wholesale India)

| Feature | Status | Required? |
|---------|--------|-----------|
| B2B invoices with GSTIN | ✅ Customer GSTIN stored | **YES** |
| B2C cash sales | ✅ `is_cash_sale` flag | **YES** |
| HSN codes on products | ✅ `products.hsn_code` | **YES** |
| Batch-wise inventory with expiry | ✅ `product_batches` | **YES** |
| FEFO allocation | ✅ `fefoBatchPicker` | **YES** |
| Supplier purchase tracking | ✅ `purchase_invoices` | **YES** |
| Customer/supplier ledgers | ✅ `customer_ledgers`/`supplier_ledgers` | **YES** |
| State-based POS for compliance | ⚠️ Broken | **YES** |

### Advanced Statutory Automation (Post-MVP Backlog)

| Feature | Status | Required for MVP? |
|---------|--------|-------------------|
| GSTR-1 B2B invoice detail (4A/4B/6A/6B) | ❌ Missing | **NO** |
| GSTR-1 B2C large/small (5A/5B/7) | ❌ Missing | **NO** |
| GSTR-1 HSN summary (12) with UOM/qty | ⚠️ Partial | **NO** |
| GSTR-1 Document summary (11) | ❌ Missing | **NO** |
| GSTR-1 Nil/Exempt/Non-GST (8A-8D) | ❌ Missing | **NO** |
| GSTR-1 Export invoices (6A) | ❌ Missing | **NO** |
| GSTR-1 Amendments (9A-9C) | ❌ Missing | **NO** |
| GSTR-3B liability summary | ❌ Missing | **NO** |
| E-Invoice / IRN generation | ❌ Missing | **NO** |
| E-Way Bill generation | ❌ Missing | **NO** |
| RCM (Reverse Charge) | ❌ Missing | **NO** |
| Composition scheme | ❌ Missing | **NO** |
| Export/SEZ zero-rated | ❌ Missing | **NO** |
| Credit/Debit notes with GST adjustment | ❌ Missing | **NO** |
| ITC reconciliation (GSTR-2A/2B) | ❌ Missing | **NO** |
| Multi-GSTIN per tenant | ❌ Missing | **NO** |
| GSTIN checksum validation | ❌ Missing | **NO** (format only is MVP) |

---

## Step 3 — Minimum Safe Data Model Recommendation

> This older recommendation is retained as implementation history. The
> accepted policy above supersedes any universal billing-state or
> supplier-state shortcut and any automatic historical backfill. The fields
> below are proposed only; no schema or migration is authorized by this file.

### Core Principle
**The tax calculator must be the single authoritative implementation** used by:
- Sales draft creation
- Sales finalization
- Purchase draft creation
- Purchase finalization
- Invoice printing
- Reports (HSN summary, future GSTR-1)

### Required Schema Changes

#### 1. Add CGST/SGST/IGST/Cess Split to Line Items

```prisma
model sales_invoice_items {
  // ... existing fields ...
  gst_rate        Decimal  @db.Decimal(5, 2)
  gst_amount      Decimal  @default(0) @db.Decimal(12, 2)  // KEEP for backward compat
  cgst_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  sgst_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  igst_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  cess_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  // line_total = taxable + cgst + sgst + igst + cess
}

model purchase_invoice_items {
  // ... existing fields ...
  gst_rate        Decimal  @db.Decimal(5, 2)
  gst_amount      Decimal  @default(0) @db.Decimal(12, 2)  // KEEP for backward compat
  cgst_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  sgst_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  igst_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  cess_amount     Decimal  @default(0) @db.Decimal(12, 2)  // NEW
  is_rcm          Boolean  @default(false)                 // NEW for future RCM
}
```

**Backward Compatibility:** Keep `gst_amount` as aggregate for existing code
paths. New eligible records may write split fields plus aggregate only after the
declared/calculated/accepted contract is approved. Legacy aggregate-only rows
must retain their aggregate values; no component or POS backfill may fabricate
missing historical facts.

#### 2. Add Place of Supply to Invoice Headers

```prisma
model sales_invoices {
  // ... existing fields ...
  place_of_supply String?  // NEW: 2-char state code, e.g., "MH"
  supply_type     String?  // NEW: "B2B" | "B2C" | "EXPORT" | "SEZ" (for future)
}

model purchase_invoices {
  // ... existing fields ...
  place_of_supply String?  // NEW: 2-char state code
  is_rcm          Boolean  @default(false)  // NEW
}
```

**Backward Compatibility:** Nullable fields are a design option. Finalized
records must capture approved transaction facts at finalization; legacy records
must remain distinguishable when those facts are unavailable.

#### 3. State Code Normalization Utility

Create `src/lib/constants/indian-states.ts`:
```typescript
export const STATE_NAME_TO_CODE: Record<string, string> = {
  "andhra pradesh": "AP", "arunachal pradesh": "AR", "assam": "AS",
  "bihar": "BR", "chhattisgarh": "CG", "goa": "GA", "gujarat": "GJ",
  "haryana": "HR", "himachal pradesh": "HP", "jharkhand": "JH",
  "karnataka": "KA", "kerala": "KL", "madhya pradesh": "MP",
  "maharashtra": "MH", "manipur": "MN", "meghalaya": "ML", "mizoram": "MZ",
  "nagaland": "NL", "odisha": "OD", "punjab": "PB", "rajasthan": "RJ",
  "sikkim": "SK", "tamil nadu": "TN", "telangana": "TS", "tripura": "TR",
  "uttar pradesh": "UP", "uttarakhand": "UK", "west bengal": "WB",
  // UTs
  "andaman and nicobar islands": "AN", "chandigarh": "CH",
  "dadra and nagar haveli and daman and diu": "DN", "delhi": "DL",
  "jammu and kashmir": "JK", "ladakh": "LA", "lakshadweep": "LD",
  "puducherry": "PY",
};

export const STATE_CODE_TO_NAME: Record<string, string> = 
  Object.fromEntries(Object.entries(STATE_NAME_TO_CODE).map(([k, v]) => [v, k]));

export function normalizeState(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  return STATE_NAME_TO_CODE[normalized] ?? normalized.toUpperCase();
}

export function getStateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.substring(0, 2).toUpperCase();
  return STATE_CODE_TO_NAME[code] ? code : null;
}
```

#### 4. Single Authoritative Tax Calculation Flow

**All paths must use `gstCalculator.computeTotals()` with explicit `placeOfSupply`:**

```typescript
// Unified function used by sales, purchases, print, reports
function computeInvoiceGst(
  lines: { quantity: number; rate: number; discountPct: number; gstRate: number }[],
  supplierStateCode: string | null,
  buyerStateCode: string | null
): GstTotals {
  const placeOfSupply = detectPlaceOfSupply(supplierStateCode, buyerStateCode);
  const taxableLines = lines.map(l => ({
    taxable_value: round2(l.quantity * l.rate * (1 - l.discountPct / 100)),
    gst_rate_pct: l.gstRate,
  }));
  return gstCalculator.computeTotals(taxableLines, { placeOfSupply, rounding: "HALF_UP" });
}
```

#### 5. Historical Invoice Immutability

- **Finalized invoices NEVER recompute tax** — they store the split amounts at finalization
- Print page reads `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount` from line items
- Place of supply read from invoice header `place_of_supply`
- If business profile/customer state changes later, historical invoices unchanged

---

## Step 4 — Implementation Plan

### Priority 0: Confirmed defects and policy-aligned proposed fixes

| # | Defect | Evidence | Fix |
|---|--------|----------|-----|
| 1 | Purchase side has no evidence/reconciliation model | `purchases.actions.ts:73-92` — `computeLineTotals()` only aggregate | Capture supplier evidence, calculate expected values from approved facts/rules, reconcile, and block unresolved material posting |
| 2 | Sales path uses a billing-state proxy | Current actions use business profile and customer billing state | Capture required supply facts, apply versioned supported rules, and fail closed when unresolved |
| 3 | Sales line items store only aggregate GST | `sales_invoice_items.gst_amount` only | Add `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount` columns |
| 4 | Purchase line items store only aggregate GST | `purchase_invoice_items.gst_amount` only | Add same split columns + `is_rcm` |
| 5 | No place_of_supply on finalized invoices | Schema lacks field | Add `place_of_supply` to `sales_invoices` and `purchase_invoices` |
| 6 | Print page has legacy recomputation paths | `print/page.tsx:156-170` recomputes | Prefer persisted finalized snapshots; disclose legacy gaps without reconstruction |
| 7 | Rounding mismatch draft vs finalize | Draft: aggregate line-rounded; Finalize: split component-rounded | Use `gstCalculator.computeTotals()` for BOTH draft and finalize; persist split fields |

### Priority 1: Minimum Fixes Before Financial Runtime E2E

**Order of Implementation:**

1. **Define captured supply facts and versioned rules** for each supported sales and purchase scenario; do not rely on GSTIN prefix alone.
2. **Update `gst-calculator.service.ts`** — expose explicit rule/version and unresolved-scenario outcomes while preserving pure calculation behavior.
3. **Update `sales.actions.ts`** — validate required transaction facts, fail closed for unsupported scenarios, and persist approved facts/splits/snapshots.
4. **Update `purchases.actions.ts`** — preserve supplier evidence, calculate separately, reconcile, and block unresolved material posting.
5. **Prisma Migration** — Add split columns + `place_of_supply` to both invoice models
6. **Controlled test-data rebuild option** — only after explicit approval; never infer missing facts from mutable masters
7. **Update `print/page.tsx`** — Read persisted finalized facts; disclose unavailable legacy detail
8. **Update validation schemas** — Add state code validation to business profile; add GSTIN checksum validation (optional for MVP)

### Priority 2: Schema & Migration Implications

**Migration Strategy:**
```sql
-- 1. Add nullable split columns with defaults
ALTER TABLE sales_invoice_items ADD COLUMN cgst_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE sales_invoice_items ADD COLUMN sgst_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE sales_invoice_items ADD COLUMN igst_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE sales_invoice_items ADD COLUMN cess_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE purchase_invoice_items ADD COLUMN cgst_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_invoice_items ADD COLUMN sgst_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_invoice_items ADD COLUMN igst_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_invoice_items ADD COLUMN cess_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE purchase_invoice_items ADD COLUMN is_rcm BOOLEAN DEFAULT FALSE;

ALTER TABLE sales_invoices ADD COLUMN place_of_supply CHAR(2);
ALTER TABLE purchase_invoices ADD COLUMN place_of_supply CHAR(2);
ALTER TABLE purchase_invoices ADD COLUMN is_rcm BOOLEAN DEFAULT FALSE;

-- Do not backfill finalized records from mutable current masters.
-- A separately approved test-data rebuild must preserve aggregate totals and
-- label unavailable historical components/POS as unavailable.
```

**Backward Compatibility:**
- Existing code reading `gst_amount` continues to work
- New eligible code writes both aggregate and split values only when their
  source/evidence status is recorded
- Print page prefers persisted finalized values and discloses legacy gaps; it
  does not present current master data as verified historical data

### Priority 3: Required Regression Tests

**Test Scenarios (to be implemented in financial E2E harness):**

| Test Case | Description | Expected |
|-----------|-------------|----------|
| **Intra-state Sale** | Business MH, Customer MH, 12% GST | CGST 6%, SGST 6%, IGST 0 |
| **Inter-state Sale** | Business MH, Customer KA, 12% GST | CGST 0, SGST 0, IGST 12% |
| **Intra-state Purchase** | Business MH, Supplier MH, 12% GST | CGST 6%, SGST 6%, IGST 0 |
| **Inter-state Purchase** | Business MH, Supplier KA, 12% GST | CGST 0, SGST 0, IGST 12% |
| **Multi-rate Invoice** | Lines at 5%, 12%, 18% | Each line split correctly; totals sum |
| **Rounding Consistency** | Line taxable ₹100.125 @ 18% | Line CGST=₹9.01, SGST=₹9.01 (not ₹9.00 each) |
| **Finalize Idempotency** | Finalize same invoice twice | No double ledger entries, no stock double-decrement |
| **Rollback on Stock Shortfall** | FEFO allocation fails mid-invoice | Full rollback: no stock movement, no ledger, no invoice finalize |
| **Invoice Sequence Rollback** | Finalize fails after sequence increment | Sequence NOT incremented (transaction atomicity) |
| **Print Matches Finalized** | Print finalized invoice | Tax splits match persisted line values exactly |
| **State Change Invariance** | Change customer state after finalize | Printed invoice shows ORIGINAL tax split |
| **Purchase Ledger Match** | Finalize purchase | Supplier ledger credit = purchase `net_amount` |
| **Sales Ledger Match** | Finalize sale | Customer ledger debit = sale `net_amount` |

### Priority 4: Features Safely Deferred to Backlog

| Feature | Reason for Deferral |
|---------|---------------------|
| GSTR-1 B2B/B2C/HSN/Doc/Nil/Export/Amendment reports | Not needed for daily operations; filing can be manual/offline initially |
| GSTR-3B liability summary | Can be computed from ledgers + HSN summary manually |
| E-Invoice / IRN integration | Only mandatory for >₹5Cr turnover; not MVP |
| E-Way Bill integration | Only for inter-state >₹50k; can be manual initially |
| RCM flag & liability | Rare in pharma wholesale; handle manually |
| Credit/Debit notes with GST adjustment | Not in current scope; returns handled separately |
| ITC reconciliation (GSTR-2A/2B) | Requires GSTN API access; post-MVP |
| Multi-GSTIN per tenant | Single GSTIN per tenant is MVP scope |
| GSTIN checksum validation | Format validation sufficient for MVP; checksum adds UX friction |
| Composition scheme | Not applicable to pharma wholesale typically |
| Export/SEZ zero-rated | Not in initial customer base |

### Proposed implementation order — authorization required

The following sequence is implementation-ready but is not authorization to
execute code, schema, migration, database, or production changes:

1. Define versioned purchase evidence, calculation, reconciliation, and
   accounting-acceptance contracts, including explicit status transitions and
   audit events.
2. Define captured sales and purchase supply facts and supported versioned rule
   scenarios; obtain qualified GST review.
3. Add provider-independent domain and persistence support for declared,
   calculated, accepted, component, POS, discrepancy, and snapshot facts
   without changing existing purchase rounding.
4. Add fail-closed actions, review/posting guards, and snapshot-first printing
   with disclosed legacy fallback.
5. Add focused pure tests for the acceptance criteria, then an authorized
   isolated-database run for persistence, rollback, RLS, ledger, sequence,
   cleanup, and historical immutability.
6. Consider a separately approved controlled test-data migration/rebuild only
   after schema review, backup/rollback evidence, and explicit authorization.

## Validation gate

The financial E2E harness must run the approved purchase reconciliation,
sales-fact/POS, snapshot-print, ledger, rollback, sequence, tenant-isolation,
and cleanup scenarios against a separately verified disposable database. All
required scenarios must pass before production-readiness consideration.
Until then, GST-019 and GST-020 remain blocked.

*This document records accepted policy and an implementation-ready proposal.
Application implementation remains separately authorized work.*