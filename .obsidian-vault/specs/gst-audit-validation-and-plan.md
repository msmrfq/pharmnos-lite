# GST/IGST Audit Validation & Minimum Scope Implementation Plan

**Date:** 2026-10-13  
**Time:** 22-12-11 (IST)  
**Phase:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Task:** GST/IGST remediation documentation reconciliation

---

## Step 1 — Validation of Original Audit Findings

## GST/IGST Remediation Status Matrix — 2026-10-13

**Scope note:** This matrix replaces the prior standalone closure label. It
records the actual repository state and does not create a formal GST stage.
P0-P3 remain audit priorities, not implementation-stage numbers.

**Summary:** 20 requirements tracked; 4 implemented and verified; 2 partially
implemented/limited; 7 outstanding; 5 blocked pending prerequisites; 1 deferred
by explicit decision; 1 unclear. Financial E2E readiness: **blocked**. Last
reviewed: `2026-10-13 22-12-11 (IST)`.

| ID | Requirement | Priority | Current status | Implementation evidence | Test evidence | Dependencies / blockers | Next action |
|---|---|---|---|---|---|---|---|
| GST-001 | Canonical sales GST calculation | P0 | Implemented and verified | `gst-calculator.service.ts`: `splitLineGst()`, `calculateGstTotals()`; `sales.actions.ts`: `computeServerGstTotals()` | `tests/gst-calculator.test.ts`; 206 assertions passed | None for current sales path | Preserve as shared sales calculation path |
| GST-002 | Component-wise rounding and preview/server parity | P0 | Implemented and verified | `splitLineGst()`; billing `_form.tsx` calls `gstCalculator.computeLine()` | ₹10.10 at 5% INTRA/INTER parity assertions; 206 assertions passed | No database-backed parity test | Add integration coverage when isolated DB exists |
| GST-003 | Discount normalization | P0 | Implemented and verified | `toTaxableGstLine()` accepts `trade_discount_pct` and `discount_pct` | Equivalent discount-shape assertions in `tests/gst-calculator.test.ts` | None for current sales path | Preserve; cover purchase semantics separately |
| GST-004 | State name/code normalization | P0 | Partially implemented / limited | `indian-states.ts`: `normalizeState()`, `determinePlaceOfSupply()` | State normalization and supported-prefix tests; 206 assertions passed | Complete authoritative prefix table unavailable | Obtain authoritative mapping evidence before claiming full verification |
| GST-005 | Fail-closed place-of-supply handling | P0 | Implemented and verified | `determinePlaceOfSupply()` returns `UNKNOWN`; `requireResolvedPlaceOfSupply()` rejects unresolved finalization | Missing, invalid, whitespace, `97`, and `99` cases covered | Special-prefix workflow support remains deferred | Preserve fail-closed behavior |
| GST-006 | Sales tax-component persistence | P0 | Outstanding | Prisma `sales_invoice_items` stores aggregate `gst_amount` only | No database-backed persistence test | Schema change and approval required | Review schema/migration design before implementation |
| GST-007 | Sales place-of-supply persistence | P0 | Outstanding | Prisma `sales_invoices` has no `place_of_supply` field | No persistence test | Schema change and historical strategy required | Define immutable persisted field and migration plan |
| GST-008 | Purchase intra/inter-state GST calculation | P0 | Outstanding | `purchases.actions.ts` still computes aggregate GST without place-of-supply logic | No purchase GST parity suite | Purchase semantics and state inputs must be defined | Implement purchase calculation after approval |
| GST-009 | Purchase tax-component persistence | P0 | Outstanding | Purchase line schema stores aggregate `gst_amount` only | No persistence test | Schema change and purchase calculation required | Design purchase component fields with GST-006 |
| GST-010 | Business-profile state validation | P0 | Outstanding | Business profile state validation is weaker than customer/supplier state validation | No dedicated profile-state test | State normalization policy and validation contract required | Add validation after contract approval |
| GST-011 | Historical invoice tax integrity and printing | P0 | Partially implemented / limited | Print page reads persisted aggregate totals and discloses unavailable split; no current-state tax recomputation | Static review only; no historical immutability integration test | Historical snapshots/components are absent from schema | Persist required snapshots before claiming full integrity |
| GST-012 | Schema and historical-data strategy | P0 | Outstanding | Audit/spec documents identify missing fields and backfill questions | Review documented; no approval or migration executed | Explicit human approval required; ambiguous history cannot be guessed | Prepare reviewable schema/backfill proposal |
| GST-013 | Purchase GST regression coverage | P0 | Outstanding | No purchase equivalent to the sales GST regression suite | No purchase GST execution evidence | Depends on GST-008 and GST-009 | Add tests after purchase implementation |
| GST-014 | Rollback and ledger consistency | P0 | Blocked pending prerequisites | Sales/purchase transactions use outer Prisma transactions in actions | No isolated database execution | Disposable database, fixtures, and reset lifecycle missing | Provision isolated E2E environment |
| GST-015 | Invoice-sequence rollback | P0 | Blocked pending prerequisites | Sequence update occurs inside finalization transaction | No rollback execution evidence | Same isolated database and failure injection requirements as GST-014 | Add rollback scenario to guarded E2E harness |
| GST-016 | Historical invoice immutability | P0 | Blocked pending prerequisites | Current schema does not snapshot seller/customer/tax components | No historical fixture test | Requires persisted snapshots and isolated fixture | Define persistence model, then test mutation isolation |
| GST-017 | Authoritative GSTIN prefix verification | P0 | Unclear — further evidence required | `indian-states.ts` preserves mappings and documents source gap | Unit tests verify application mapping only | Comprehensive authoritative source not established | Obtain and archive authoritative mapping evidence |
| GST-018 | Special-prefix handling for `97`/`99` | P0 | Deferred by explicit decision | `UNSUPPORTED_GSTIN_STATE_PREFIXES`; parser returns `null`; ordinary normalization excludes both | `tests/gst-calculator.test.ts` covers both and fail-closed POS | Broader support requires a concrete workflow and evidence | Revisit only under authorized business requirement |
| GST-019 | Financial E2E infrastructure | P0 | Blocked pending prerequisites | Guarded `scripts/financial-e2e.mjs` / `financial:e2e:safe` exists | Harness preflight exists; runtime not executed | Isolated DB, tenant fixture, and safe reset lifecycle missing | Provision disposable test environment |
| GST-020 | Financial E2E execution | P0 | Blocked pending prerequisites | No production code claim made | No financial runtime execution | GST correctness gates plus GST-019 infrastructure | Execute only after GST-006-016 prerequisites are resolved |

### Completed evidence and limitations

The completed sales calculation, rounding, discount, normalization, fail-closed,
and special-prefix work is preserved in the matrix above. The 206 assertions,
typecheck, and lint evidence were recorded previously; they are not claimed as a
fresh execution in this reconciliation. Historical seller/customer snapshots,
complete historical tax components/place of supply, comprehensive prefix
verification, and database-backed finalization/rollback testing remain limited.

`97` remains a special-purpose prefix outside ordinary state/UT normalization.
`99` remains outside ordinary normalization with unresolved workflow semantics.
Neither is mapped to a physical state or UT, and unresolved place of supply
continues to fail closed. Tests verify application policy, not legal validity,
registration authenticity, checksum validity, or universal applicability.

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

**Backward Compatibility:** Keep `gst_amount` as aggregate (CGST+SGST+IGST+Cess) for existing code paths. New code writes all four split fields + aggregate. Migration backfills split fields from `gst_amount` using place_of_supply on parent invoice.

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

**Backward Compatibility:** Nullable fields. Migration backfills from business profile state vs customer/supplier state at finalization time.

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

### Priority 0: Confirmed Defects Blocking Financial Correctness

| # | Defect | Evidence | Fix |
|---|--------|----------|-----|
| 1 | Purchase side has no intra/inter logic | `purchases.actions.ts:73-92` — `computeLineTotals()` only aggregate | Add `computePurchaseGstTotals()` using `gstCalculator` with supplier vs business profile state |
| 2 | State name vs code mismatch | `isInterStateFromCustomer()` passes names; `detectPlaceOfSupply()` expects codes | Add `normalizeState()` utility; use in all POS determinations |
| 3 | Sales line items store only aggregate GST | `sales_invoice_items.gst_amount` only | Add `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount` columns |
| 4 | Purchase line items store only aggregate GST | `purchase_invoice_items.gst_amount` only | Add same split columns + `is_rcm` |
| 5 | No place_of_supply on finalized invoices | Schema lacks field | Add `place_of_supply` to `sales_invoices` and `purchase_invoices` |
| 6 | Print page recomputes instead of reading persisted splits | `print/page.tsx:156-170` recomputes | Read persisted split fields; fallback to recompute only for legacy drafts |
| 7 | Rounding mismatch draft vs finalize | Draft: aggregate line-rounded; Finalize: split component-rounded | Use `gstCalculator.computeTotals()` for BOTH draft and finalize; persist split fields |

### Priority 1: Minimum Fixes Before Financial Runtime E2E

**Order of Implementation:**

1. **Create `src/lib/constants/indian-states.ts`** — State name↔code mapping, `normalizeState()`, `getStateCodeFromGstin()`
2. **Update `gst-calculator.service.ts`** — Ensure `detectPlaceOfSupply` documented to expect codes; add `normalizeState` import
3. **Update `sales.actions.ts`** — Use `normalizeState()` for business/customer state before POS detection; use `gstCalculator.computeTotals()` for draft creation too (not just finalize); persist split fields
4. **Update `purchases.actions.ts`** — Add `computePurchaseGstTotals()` mirroring sales logic with supplier vs business profile state; persist split fields
5. **Prisma Migration** — Add split columns + `place_of_supply` to both invoice models
6. **Backfill Migration** — For existing finalized invoices, compute splits from `gst_amount` using stored header states
7. **Update `print/page.tsx`** — Read persisted split fields; use `invoice.place_of_supply` for display
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

-- 2. Backfill for finalized invoices
UPDATE sales_invoice_items sii
SET cgst_amount = CASE 
  WHEN si.place_of_supply = bp.state_code THEN sii.gst_amount / 2 ELSE 0 END,
    sgst_amount = CASE 
  WHEN si.place_of_supply = bp.state_code THEN sii.gst_amount / 2 ELSE 0 END,
    igst_amount = CASE 
  WHEN si.place_of_supply != bp.state_code THEN sii.gst_amount ELSE 0 END
FROM sales_invoices si
JOIN business_profiles bp ON bp.tenant_id = si.tenant_id
WHERE si.status = 'FINALIZED' AND sii.cgst_amount = 0;

-- Similar for purchase_invoice_items using supplier.state
```

**Backward Compatibility:**
- Existing code reading `gst_amount` continues to work
- New code writes both aggregate and split
- Print page prefers split fields, falls back to recompute for NULL splits (drafts/legacy)

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

### Priority 5: Dependencies & Suggested Order

```
1. indian-states.ts (utility)                    ← No deps
       ↓
2. gst-calculator.service.ts (ensure POS uses codes)  ← Uses 1
       ↓
3. sales.actions.ts (draft + finalize use calculator) ← Uses 2
       ↓
4. purchases.actions.ts (add intra/inter logic)      ← Uses 2
       ↓
5. Prisma schema + migration (split fields + POS)    ← Uses 3,4
       ↓
6. Backfill migration script                         ← Uses 5
       ↓
7. print/page.tsx (read persisted splits)            ← Uses 5
       ↓
8. Validation schema updates (business profile)      ← Independent
       ↓
9. Financial E2E tests (all scenarios above)         ← Uses 1-7
```

---

## Summary: Minimum Safe Scope for MVP

**Must Implement Before Financial E2E:**
1. ✅ State code normalization utility
2. ✅ Purchase intra/inter GST logic (parity with sales)
3. ✅ Persisted CGST/SGST/IGST/Cess split on ALL line items (sales + purchases)
4. ✅ `place_of_supply` on finalized invoice headers
5. ✅ Single authoritative `gstCalculator.computeTotals()` for draft + finalize + print
6. ✅ Print page reads persisted splits (not recompute)
7. ✅ Rounding: line-level component rounding per GST law (calculator already does this)
8. ✅ Migration + backfill for existing finalized invoices

**Can Defer:**
- All GSTR-1/3B report generation
- E-Invoice, E-Way Bill, RCM, Credit/Debit notes, ITC reconciliation
- GSTIN checksum validation (format only for MVP)
- Multi-GSTIN, Composition, Export/SEZ

**Validation Gate:** Financial E2E harness runs all 12 regression test scenarios above against disposable test database. All must pass before production deployment consideration.

---

*This validation and plan is based on read-only code inspection. No files modified. Awaiting approval to proceed with implementation.*