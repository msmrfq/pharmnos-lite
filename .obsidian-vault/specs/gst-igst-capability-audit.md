# GST/IGST Capability Audit Report

**Date:** 2026-10-02  
**Time:** 04-14-16 (IST)  
**Phase:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Audit Type:** Read-only capability assessment

## Historical Status and Current Reconciliation

This document records the GST/IGST capability audit as assessed on **2026-10-02**. Its findings, status descriptions, and P0–P3 priorities represent the evidence and implementation state assessed at that time; they must not be interpreted automatically as the current implementation status.

For the consolidated, evidence-based status of each GST/IGST remediation requirement, refer to `gst-audit-validation-and-plan.md`, which maintains the current remediation status matrix.

Where this historical audit and the current status matrix differ, use the current matrix to understand the latest documented remediation status, while retaining this audit as the historical record. A changed status must be supported by implementation or test evidence; the existence of a newer document alone does not establish that a requirement has been implemented or verified.

The historical priorities P0–P3 remain audit-priority classifications. They do not define new project phases or replace the established P1–P7 project tracker. GST/IGST remediation remains subject to the outstanding requirements, documented limitations, and validation prerequisites in the current status matrix. Neither this audit nor the matrix, by itself, constitutes statutory GST compliance approval or production-readiness approval.

---

## Executive Summary

Pharmnos Lite implements a **functional but incomplete** GST/IGST compliance system. The core calculation engine correctly handles intra-state (CGST+SGST) and inter-state (IGST) tax splits with HALF_UP 2-decimal rounding. However, several critical gaps exist for production GST compliance in India.

**Overall Capability Score: 65/100** — Suitable for MVP demo, **not production-ready** for GST filing.

---

## Capability Matrix

| Capability Area | Status | Score | Notes |
|-----------------|--------|-------|-------|
| **Core Calculation Engine** | ✅ Complete | 95/100 | Correct intra/inter logic, HALF_UP rounding, multi-rate support |
| **Sales Invoice Tax Persistence** | ✅ Complete | 90/100 | `sales_invoice_items.gst_rate`, `gst_amount`, `sales_invoices.total_tax` stored |
| **Purchase Invoice Tax Persistence** | ✅ Complete | 90/100 | `purchase_invoice_items.gst_rate`, `gst_amount`, `purchase_invoices.total_tax` stored |
| **Place of Supply Detection** | ⚠️ Partial | 60/100 | Only compares state strings; no GSTIN-based logic, no POS for exports/SEZ |
| **Invoice Print (Tax Display)** | ✅ Complete | 85/100 | Shows CGST/SGST or IGST per line + totals; HSN codes displayed |
| **GST HSN Summary Report (GSTR-1)** | ⚠️ Partial | 70/100 | Aggregates by HSN+rate; splits CGST/SGST/IGST; no B2B/B2C sections, no document types |
| **GSTR-1 Return Filing Ready** | ❌ Missing | 20/100 | No B2B invoice-level detail, no B2C summary, no HSN summary by rate, no nil/exempt/non-GST |
| **GSTR-3B Return Filing Ready** | ❌ Missing | 10/100 | No outward/inward tax liability summary, no ITC eligibility, no reverse charge |
| **E-Invoice / IRN Generation** | ❌ Missing | 0/100 | No integration with NIC/GSTN e-invoice APIs |
| **E-Way Bill Generation** | ❌ Missing | 0/100 | No integration with NIC e-way bill APIs |
| **Reverse Charge Mechanism (RCM)** | ❌ Missing | 0/100 | No RCM flag on purchases, no liability creation |
| **Composition Scheme Support** | ❌ Missing | 0/100 | No composition taxpayer handling |
| **Export/SEZ Zero-Rated Supply** | ❌ Missing | 0/100 | No LUT/bond tracking, no zero-rated classification |
| **Credit/Debit Notes GST Impact** | ❌ Missing | 0/100 | No credit/debit note models or GST adjustment logic |
| **ITC Reconciliation (GSTR-2A/2B)** | ❌ Missing | 0/100 | No purchase register with GSTIN matching, no auto-reconciliation |
| **Multi-GSTIN (Same PAN)** | ❌ Missing | 0/100 | Single `business_profiles.gstin` per tenant only |
| **State Code Validation** | ❌ Missing | 0/100 | No validation of 2-digit state codes against GST state code list |
| **GSTIN Validation (Checksum)** | ❌ Missing | 0/100 | No GSTIN format/validation on customer/supplier/business profile |

---

## Detailed Findings

### 1. Core GST Calculator (`src/domain/services/gst-calculator.service.ts`)

**Strengths:**
- Correctly implements `splitLineGst()` with INTRA (CGST+SGST) and INTER (IGST) logic
- HALF_UP rounding to 2 decimals via `round()` function
- Supports standard GST rates: 0, 0.25, 3, 5, 12, 18, 28%
- `detectPlaceOfSupply(supplierState, buyerState)` compares state strings
- `computeTotals()` returns full breakdown: taxable, CGST, SGST, IGST, cess, round-off, grand total
- Exports `gstCalculator` singleton with default INTRA, HALF_UP, Maharashtra

**Issues:**
- `detectPlaceOfSupply()` only compares state **names** (not codes) — "Maharashtra" vs "MH" mismatch risk
- No support for **POS determination by GSTIN** (first 2 digits = state code)
- No handling of **export (zero-rated)**, **SEZ**, **deemed export** POS rules
- No **cess** calculation (only placeholder `cess_amount: 0`)
- No **rounding per line** vs **rounding on total** configuration (GST law requires line-level rounding for B2B)
- `GstRate` type allows any `number` — should restrict to valid GST rates only

### 2. Sales Finalization (`src/app/_actions/sales.actions.ts`)

**Flow:**
1. `createSalesDraftAction` — computes GST via `computeServerGstTotals()` using `isInterStateFromCustomer()`
2. Stores per-line `gst_rate`, `gst_amount` in `sales_invoice_items`
3. Stores header `total_tax`, `round_off`, `net_amount` in `sales_invoices`
4. `finalizeSalesInvoiceAction` — **recomputes** GST server-side and validates against stored draft totals (mismatch tolerance: `__MAX_SALES_TOTALS_MISMATCH_PAISE`)

**Issues:**
- `isInterStateFromCustomer()` compares `businessProfile.state` vs `customer.billing_state` as **strings** — case-sensitive, no normalization
- No GSTIN-based POS detection (GSTIN[0:2] = state code)
- Draft stores **client-submitted** totals; finalize **recomputes** — good security but draft totals may be wrong
- No **line-level rounding** enforcement (GST law: tax computed per line, rounded per line)
- `round2()` used for line calculations — but `gstCalculator` uses `round()` with HALF_UP — **inconsistency risk**

### 3. Purchase Finalization (`src/app/_actions/purchases.actions.ts`)

**Flow:**
1. `createPurchaseDraftAction` — client submits totals including `total_tax`
2. `finalizePurchaseAction` — **recomputes** via `computeLineTotals()` + `computeInvoiceTotals()` (simple sum, no CGST/SGST/IGST split)
3. Stores per-line `gst_rate`, `gst_amount` in `purchase_invoice_items`
4. Stores header `total_tax`, `round_off`, `net_amount` in `purchase_invoices`

**Critical Gap:**
- **Purchase side has NO intra/inter-state logic** — `computeLineTotals()` just does `taxable * gst_rate / 100`
- No `placeOfSupply` concept for purchases
- No CGST/SGST/IGST split stored for purchases — only aggregate `gst_amount`
- **Cannot generate purchase register with CGST/SGST/IGST breakdown** for GSTR-2 reconciliation

### 4. Invoice Print (`src/app/billing/[invoiceId]/print/page.tsx`)

**Strengths:**
- Recomputes line splits via `splitLineGst()` using `detectPlaceOfSupply(businessProfile.state, customer.billing_state)`
- Displays per-line **Tax Split** column: CGST+SGST (intra) or IGST (inter)
- Shows HSN codes from `product.hsn_code`
- Totals section shows "Tax summary: CGST ₹X + SGST ₹Y" or "Tax summary: IGST ₹Z"
- Business GSTIN, State, Drug License displayed in letterhead

**Issues:**
- Uses same string-comparison POS detection as actions
- No **GSTIN of recipient** validation for B2B invoices
- No **invoice type** (B2B/B2C/Export) classification
- No **place of supply** code (state code) printed — only "Intra-state/Inter-state" label

### 5. GST HSN Summary Report (`src/app/reports/gst-hsn-summary/page.tsx`)

**Strengths:**
- Aggregates by HSN code + GST rate
- Splits CGST/SGST/IGST based on `tenantState` vs `customer.billing_state`
- Filters: date range, B2B (has GSTIN) / Unregistered / All
- CSV export via `exportGstHsnSummaryCsvAction`
- Shows: HSN, Description, Rate%, Taxable Value, CGST, SGST, IGST, Total Tax, Invoice Count, Total Value

**Gaps for GSTR-1:**
| GSTR-1 Section | Covered? | Gap |
|----------------|----------|-----|
| **B2B Invoices** (4A, 4B, 4C, 6A, 6B) | ❌ | No invoice-level detail with GSTIN, invoice no, date, value, POS |
| **B2C Large Invoices** (5A, 5B) | ❌ | No inter-state B2C > ₹2.5L detail |
| **B2C Small Invoices** (7) | ❌ | No consolidated intra/inter-state summary by rate |
| **HSN Summary** (12) | ⚠️ Partial | Has HSN+rate aggregation but no UOM, qty, no nil/exempt/non-GST |
| **Document Summary** (11) | ❌ | No document type (invoice, credit note, debit note) counts |
| **Nil/Exempt/Non-GST** (8A, 8B, 8C, 8D) | ❌ | No tracking of nil-rated, exempt, non-GST supplies |
| **Export Invoices** (6A) | ❌ | No export classification, no LUT/bond reference |
| **Amendments** (9A, 9B, 9C) | ❌ | No amendment tracking |

### 6. Data Model (Prisma Schema)

**GST Fields Present:**
| Model | Fields |
|-------|--------|
| `products` | `gst_rate` (Decimal 5,2), `hsn_code` (String?) |
| `sales_invoices` | `total_tax` (Decimal 14,2), `round_off` (Decimal 10,2) |
| `sales_invoice_items` | `gst_rate` (Decimal 5,2), `gst_amount` (Decimal 12,2) |
| `purchase_invoices` | `total_tax` (Decimal 14,2), `round_off` (Decimal 10,2) |
| `purchase_invoice_items` | `gst_rate` (Decimal 5,2), `gst_amount` (Decimal 12,2) |
| `business_profiles` | `state` (String?), `gstin` (String?), `default_gst_rate` (Decimal 5,2?) |
| `customers` | `billing_state` (String?), `gstin` (String?) |
| `suppliers` | `state` (String?), `gstin` (String?) |

**Missing Fields for Compliance:**
- `sales_invoices`: `place_of_supply` (state code), `supply_type` (B2B/B2C/Export/SEZ), `e_invoice_irn`, `e_invoice_date`, `e_way_bill_no`, `e_way_bill_date`
- `sales_invoice_items`: `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount` (currently only aggregate `gst_amount`)
- `purchase_invoice_items`: `cgst_amount`, `sgst_amount`, `igst_amount`, `cess_amount`, `is_rcm` (boolean)
- `customers`/`suppliers`: `gstin_verified` (boolean), `state_code` (2-char)
- `business_profiles`: `gstin_verified`, `constitution_of_business`, `registration_type` (Regular/Composition/SEZ/ISD)

### 7. Rounding Consistency Audit

| Location | Function | Mode | Precision |
|----------|----------|------|-----------|
| `gst-calculator.service.ts` | `round()` | HALF_UP | 2 decimals |
| `sales.actions.ts` | `round2()` | HALF_UP (Math.round) | 2 decimals |
| `purchases.actions.ts` | `round2()` | HALF_UP (Math.round) | 2 decimals |
| `gst-calculator.service.ts` | `calculateGstTotals()` | HALF_UP on **total** | 2 decimals |
| `sales.actions.ts` line calc | `round2()` per line | HALF_UP per line | 2 decimals |

**Finding:** Sales actions use `round2()` per line (line-level rounding) while GST calculator rounds **totals**. This creates a **mismatch** between stored line `gst_amount` (line-rounded) and recomputed totals (total-rounded). The finalize validation tolerance (`__MAX_SALES_TOTALS_MISMATCH_PAISE`) masks this but is a compliance risk.

---

## Remediation Plan (Priority Order)

### P0 — Critical (Block Production GST Filing)

| # | Task | Effort | File(s) |
|---|------|--------|---------|
| 1 | Add CGST/SGST/IGST split columns to `sales_invoice_items` and `purchase_invoice_items` | M | `prisma/schema.prisma`, migrations |
| 2 | Implement purchase-side intra/inter-state logic with POS detection | M | `purchases.actions.ts`, `gst-calculator.service.ts` |
| 3 | Add `place_of_supply` (state code) to `sales_invoices` and `purchase_invoices` | S | `prisma/schema.prisma`, actions |
| 4 | Implement GSTIN validation (format + checksum) on create/update | S | `validation/` schemas, actions |
| 5 | Add state code normalization (name ↔ code mapping) | S | `lib/constants/indian-states.ts` (new) |

### P1 — High (GSTR-1 Filing Ready)

| # | Task | Effort | File(s) |
|---|------|--------|---------|
| 6 | Build B2B invoice detail report (GSTR-1 4A/4B/6A/6B) | L | `reports/gstr1-b2b/` (new) |
| 7 | Build B2C large invoice report (GSTR-1 5A/5B) | M | `reports/gstr1-b2c-large/` (new) |
| 8 | Build B2C small consolidated report (GSTR-1 7) | M | `reports/gstr1-b2c-small/` (new) |
| 9 | Enhance HSN Summary for GSTR-1 12 (add UOM, qty, nil/exempt) | M | `reports/gst-hsn-summary/page.tsx` |
| 10 | Build Document Summary report (GSTR-1 11) | M | `reports/gstr1-doc-summary/` (new) |
| 11 | Add nil/exempt/non-GST supply tracking | M | `products` schema, sales actions, reports |

### P2 — Medium (GSTR-3B / Operational)

| # | Task | Effort | File(s) |
|---|------|--------|---------|
| 12 | Build GSTR-3B liability summary (outward/inward/ITC) | L | `reports/gstr3b/` (new) |
| 13 | Add RCM flag on purchase lines + liability creation | M | `purchase_invoice_items`, `purchases.actions.ts` |
| 14 | Add credit/debit note models with GST adjustment | L | `prisma/schema.prisma`, new actions |
| 15 | Add export/SEZ zero-rated supply classification | M | `sales_invoices`, actions, print |

### P3 — Low (Advanced Compliance)

| # | Task | Effort | File(s) |
|---|------|--------|---------|
| 16 | E-Invoice API integration (NIC sandbox → production) | XL | New adapter, actions, webhook |
| 17 | E-Way Bill API integration | XL | New adapter, actions |
| 18 | GSTR-2A/2B auto-reconciliation (purchase register ↔ GSTN) | XL | New service, scheduled job |
| 19 | Multi-GSTIN support (same PAN, multiple registrations) | L | `business_profiles` → `business_gstins` (new model) |
| 20 | Composition scheme support | M | `business_profiles.registration_type`, conditional logic |

---

## Code References for Remediation

### Core Files to Modify
```
prisma/schema.prisma                          # Add missing columns, new models
src/domain/services/gst-calculator.service.ts # Enhance POS, rounding, cess, validation
src/app/_actions/sales.actions.ts             # Line-level rounding, POS by GSTIN
src/app/_actions/purchases.actions.ts         # Add intra/inter logic, CGST/SGST/IGST split
src/app/billing/[invoiceId]/print/page.tsx    # Print POS code, GSTIN validation badge
src/app/reports/gst-hsn-summary/page.tsx      # Enhance for GSTR-1 12 compliance
src/lib/validation/sales.schemas.ts           # GSTIN validation, state code validation
src/lib/validation/purchases.schemas.ts       # GSTIN validation, RCM flag
src/repositories/sales-invoice.repository.ts  # New query methods for GSTR-1 reports
src/repositories/purchase-invoice.repository.ts # New query methods for purchase register
```

### New Files Needed
```
src/lib/constants/indian-states.ts            # State name ↔ code mapping, GST state codes
src/lib/validation/gstin.ts                   # GSTIN format + checksum validation
src/app/reports/gstr1-b2b/page.tsx            # GSTR-1 B2B invoice detail
src/app/reports/gstr1-b2c-large/page.tsx      # GSTR-1 B2C large invoices
src/app/reports/gstr1-b2c-small/page.tsx      # GSTR-1 B2C consolidated
src/app/reports/gstr1-doc-summary/page.tsx    # GSTR-1 document summary
src/app/reports/gstr1-nil-exempt/page.tsx     # GSTR-1 nil/exempt/non-GST
src/app/reports/gstr3b/page.tsx               # GSTR-3B liability summary
src/app/reports/purchase-register-gst/page.tsx # Purchase register with CGST/SGST/IGST
src/adapters/gstn/                            # E-invoice, e-way bill, GSTR-2A/2B adapters
```

---

## Validation Checklist for Production Readiness

Before deploying for real GST filing, verify:

- [ ] All 19 public tables have RLS enabled (✅ verified)
- [ ] `jwt_tenant_id()` uses fixed `search_path` (✅ verified)
- [ ] Purchase invoices store CGST/SGST/IGST split (❌)
- [ ] Sales invoices store CGST/SGST/IGST split per line (❌)
- [ ] Place of supply stored as state code on invoices (❌)
- [ ] GSTIN validation on customer/supplier/business profile create (❌)
- [ ] State code normalization (name ↔ 2-char code) (❌)
- [ ] Line-level rounding matches GST law (⚠️ mismatch risk)
- [ ] GSTR-1 B2B invoice detail report generates valid JSON/CSV (❌)
- [ ] GSTR-1 HSN summary includes UOM, qty, nil/exempt (❌)
- [ ] GSTR-3B liability summary matches books (❌)
- [ ] Purchase register shows CGST/SGST/IGST for ITC reconciliation (❌)
- [ ] E-invoice IRN generation works in NIC sandbox (❌)
- [ ] E-way bill generation works for inter-state > ₹50k (❌)
- [ ] RCM purchases create reverse charge liability (❌)
- [ ] Credit/debit notes adjust GST liability correctly (❌)
- [ ] Export invoices marked zero-rated with LUT/bond ref (❌)

---

## Conclusion

The current implementation provides a **solid foundation** for GST calculation and invoice-level tax persistence. The `gstCalculator` service is well-designed and correctly implements the core math. However, **production GST compliance requires significant additional work** — primarily around:

1. **Data model completeness** (CGST/SGST/IGST split storage, POS codes, GSTIN validation)
2. **Purchase-side tax symmetry** (currently missing intra/inter logic entirely)
3. **GSTR-1/3B report generation** (only HSN summary exists, incomplete)
4. **Statutory integrations** (e-invoice, e-way bill, GSTR-2A reconciliation)

**Recommendation:** Prioritize P0 items before any production deployment involving real GST filing. The P1 items can be built incrementally but are required for first GSTR-1 filing. P2/P3 items are for ongoing compliance automation.

---

*Generated by read-only GST/IGST capability audit. No code modifications made.*