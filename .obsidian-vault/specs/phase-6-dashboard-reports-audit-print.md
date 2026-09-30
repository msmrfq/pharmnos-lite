---
title: Phase 6 — Dashboard Reports + Audit Views + Print Templates
date: 2026-09-30
status: Draft
---

## Goal
Populate P2 dashboard shells with **real running aggregate data** (no more hard-coded ₹ demo numbers), ship 5 paginated standard pharmacy wholesale reports for India, turn the audit-log placeholder into a real timeline, and add browser-native print templates (invoice A4 + 80mm thermal, customer account statement) that use the P5 @media print baseline.

**Why this phase?** P1–P5 froze data correctness and every core transaction path. P4 purchases increase stock+payable, P5 sales decrease stock+increase receivable, payments adjust running balances. Without P6 aggregates: the 4 dashboard KPI cards still show P2 placeholder ₹42,820 today-sales demo numbers even after 100 real invoices posted. Reports folder has 8 href=# dead report links; audit timeline still shows 6 mock rows. Print templates are the last missing link for the MVP "replace daily ERP essentials" promise — operators need to hand a paper invoice to customer and print statement when collecting dues. P6 is the first real **visibility** phase (the owner can actually look at the dashboard and trust the numbers).

---

## Acceptance Criteria (22 total, 5 sub-phase checkpoints)

### P6a — Dashboard: Real KPI widgets replace P2 hard-coded demo values
- [ ] **P6a-1:** Repository methods — ADD mirror aggregate methods (no delete existing):
  - `PurchaseInvoiceRepository.monthlyStats(ctx, monthsBack=1)` — mirror SalesInvoice.monthlyStats L108 pattern, aggregate `gross_amount/total_discount/total_tax/net_amount/paid_amount/balance_due` status FINALIZED, month start date computed client-agnostic.
  - `ProductBatchRepository.stockValuation(ctx)` — aggregate sum(available_qty × avg_purchase_rate OR last_purchase_rate) per batch; return `{ total_value_inr: number, sku_count: number, batches_count: number, near_expiry_60d_value: number }`.
  - `CustomerLedgerRepository.agedReceivablesTotals(ctx)` — 4 numbers sum(all customers): `{ current_30: number, bucket_31_60: number, bucket_61_90: number, bucket_over_90: number }` — REUSE existing `getOldestOverdueDays` + per-customer running balance unpaid via per-customer for-loop (NO SQL window fns, keep portable).
  - `SupplierLedgerRepository.agedPayablesTotals(ctx)` — same mirror 4 buckets for suppliers.
- [ ] **P6a-2:** `src/app/dashboard/page.tsx` RSC `let dbOk` degrade to placeholder HTTP200 never 500; Promise.all parallel repos calls: salesMonthlyStats, purchaseMonthlyStats, stockValuation, agedReceivables, agedPayables, countLowStock = repos.products.listLowStock? or fallback.
- [ ] **P6a-3:** Dashboard 4 metric cards (`metrics = [...]` const L39 P2 demo) → replace values with real formatted ₹ en-IN numbers; **change 1:** Today's sales (L40) → MTD Sales net (salesMonthlyStats._sum.net_amount || 0); **change 2:** Receivables (L48) → Aged total (sum of 4 buckets receivable, `change` = aged.31_60+61_90+90+ overdue accounts count via customers.filter(recv>0) count; variant=warning if overdue >0 else success). **change 3:** Low stock (L56) → real low-stock count. **change 4:** Near-expiry (L64) → stockValuation.near_expiry_60d_value formatted "₹ X at risk". Icons + quickLinks (L74) unchanged.
- [ ] **P6a-4:** Dashboard **"Recent activity" table (below KPI row)** — P2 demo 6 mock rows → real `repos.auditLogs.list(params, ctx)` take=10 newest: 6 cols Timestamp (en-IN), User (actor.name), Module (audit_type mapped label), Action (event_type mapped), Ref (truncate link target_id if known entity → href), Detail / Notes; variant Badge color map (Created=success, Edited=default, Finalized/Cancelled/Adjusted=destructive) match existing P5 patterns in audit page.tsx.
- [ ] **P6a-5:** Typecheck exit 0; lint exit 0 (1 pre-existing products new useMemo tolerated).

### P6b — 5 Paginated Reports (Sales Register / Purchase Register / Customer Dues / Supplier Payables / Stock Valuation)
- [ ] **P6b-1:** Report landing page `src/app/reports/page.tsx` — KPI demo cards (L27-32) hidden (remove or 0); 8 dead links `href="#"` — 5 of them replaced with REAL subroutes, 3 remaining (Batch expiry / GST summary / Daybook) render disabled Badge "Deferred P7" or grey + remove href (no dead # links left on reports page).
- [ ] **P6b-2:** Sales Register route `src/app/reports/sales-register/page.tsx` RSC `let dbOk` paginated 50/page: DateRangePicker client (or simple Start/End date HTML5 inputs + hidden formName submit), optional Customer combobox filter (all or one). Table 11 cols: Invoice no / Date / Customer / GSTIN / Cash sale? / Status / Gross / Discount / Tax / Net / Paid / Balance due. Rightmost ExportCsvButton DIRECT ref new action `exportSalesRegisterDetailedCsvAction` 14 cols matching P5 export but add filter columns (GSTIN, payment terms). Pattern match billing list page.
- [ ] **P6b-3:** Purchase Register route `src/app/reports/purchase-register/page.tsx` mirror: Supplier combobox, date range, 11 cols Purchase no / Date / Supplier / Invoice ref / Status / Gross / Discount / Tax / Net / Paid / Balance; Export purchase CSV detailed direct ref.
- [ ] **P6b-4:** Customer Dues route `src/app/reports/customer-dues/page.tsx`: Aging report. 10 cols Customer code / Business / Contact / State / Credit limit / Receivable / Current ≤30 / 31-60 / 61-90 / 90+. For-loop use existing `getOldestOverdueDays` + unpaid running balance per customer; Aging per-bucket amounts computed per row. Rightmost Export CSV; Badge 4 colors if row overdue >0.
- [ ] **P6b-5:** Supplier Payables mirror route 10 cols + 4 buckets payable; Export CSV.
- [ ] **P6b-6:** Stock Valuation report `src/app/reports/stock-valuation/page.tsx`: 10 cols Product code / Name / Pack / Schedule / Total batches / Received Qty / Available Qty / Avg Purchase Rate ₹ / Current Value ₹ / Expiry status (Active / Near-Expiry amber). Total valuation footer row summary card. Export CSV direct function ref 10 cols; NEVER anonymous wrapper (Next digest 828080665).
- [ ] **P6b-7:** New exports actions added to `src/app/_actions/exports.actions.ts` — register exportSalesRegisterDetailedCsvAction, exportPurchaseRegisterDetailedCsvAction, exportCustomerDuesCsvAction, exportSupplierPayablesCsvAction, exportStockValuationCsvAction (5 new actions; pattern match 7 existing utilities).
- [ ] **P6b-8:** All 5 report routes include `let dbOk` = false pattern; on Supavisor P1001 timeout degrade HTTP200 placeholder with "Showing placeholder rows until database is connected." note; never 500.

### P6c — Audit Log real timeline (replace mock 6 logs)
- [ ] **P6c-1:** AuditLogRepository add missing `list(params: ListParams, ctx): Promise<PagedResult>` method (extend base same pattern as SalesRepository L65); support filters: date range, actor_id user, audit_type module dropdown, event_type action, search keyword (message/notes). Pattern match existing list implementations.
- [ ] **P6c-2:** `src/app/audit/page.tsx` RSC rewrite paginated 25/page. 7 cols: Timestamp, User (actor display_name fallback email), Module (audit_type label + Badge variant map: Product=default, Purchase=success, Sale=success, Payment=success, Adjustment=destructive, User=default, Tenant=default), Action (event_type short label past tense Created/Edited/Finalized/Cancelled/Paid/Adjusted/Blocked), Reference (bold target entity short code or link /truncate long IDs), Detail Notes human summary, Diff Column — human-readable "X: 5 → 8" key pairs if JSON diff `old_value`/`new_value` exist else dash. Client Filters row: Date Range from/to, User dropdown, Module, Action (mapped), Search button.
- [ ] **P6c-3:** audit_logs entries for 4 most critical write paths ALREADY populated by app today (Sales Finalize / Purchase Finalize / Create Customer Payment / Create Supplier Payment / Stock Adjustment) — if not written today → defer writing new "create auditLog wrapper" to P7. This AC ONLY requires that IF existing rows in audit_logs from prior activity exist, they render. Do NOT add audit_log.write() calls inside existing server finalize actions (too risky rewrite P4/P5 correctness).
- [ ] **P6c-4:** Typecheck exit 0; lint exit 0 (0 new warnings).

### P6d — Print templates (Invoice detail + Customer statement + 80mm Thermal)
- [ ] **P6d-1:** Invoice print route `src/app/billing/[invoiceId]/print/page.tsx` RSC — dbOk guard + requireServerTenantContext + repos.salesInvoices.getById(id, ctx); if status not FINALIZED → "Cannot print draft/cancelled invoice. Finalize first." graceful card placeholder with Back to Billing link. If FINALIZED: render `<div class="invoice-print">` then `<div class="print-area">`. 2 layouts side-by-side CSS flex print break A4 & Thermal:
  - (Left / A4) Pharmacy letterhead style header: Business name + address + GSTIN (from business_profile) top-left; Invoice no + Date + Place of supply + Due date (invoice_date + payment_terms_days) top-right; Customer block: Business/Contact/Address/State/GSTIN below header; 10-col item table: Sl / Product + Pack / Batch / Expiry / Qty / MRP / Rate ₹ / Disc % / GST % / Line Total ₹; footer totals block rows Gross / Discount / Taxable value / CGST (if intra, half) / SGST (if intra, half) / IGST (if inter, combined) / Round off / TOTAL NET ₹ in big bold; Received amount / Balance due; Payment mode; Authorized signatory — blank signature box.
  - (Right / Thermal 80mm) Narrow 320px duplicate: no GSTIN, condensed font 10pt, 6 cols only: Sl/Product/Qty/Rate/Line Total; totals block simplified Net only; no signature; business footer contact + phone + "Thank you, visit again!".
- [ ] **P6d-2:** Customer statement print `src/app/customers/[customerId]/statement/print/page.tsx` RSC: Date range `?from=&to=` default last 90 days. Customer header block + Summary card Aging 4 buckets values (Current / 31-60 / 61-90 / 90+ total = receivable). 8-col ledger table Date / Ref (invoice or payment) / Type (INV/ PYMT / OPBAL OPENING BALANCE first row) / Debit / Credit / Running Balance / Days since entry / Aging bucket label + Badge. Running balance col = prev_balance + debit - credit; opening balance row seeded from balance sum before `from` date.
- [ ] **P6d-3:** Print CSS reuse P5d globals.css @media print block (A4 margin 14/12mm, .no-print hidden, tables collapsed, th exact color). Add 2 rules ONLY if still missing after P5d previous appending: (a) thermal 80mm `.thermal-print { max-width: 80mm; padding: 4mm }` @media print same, (b) `.print-total-big { font-size: 20px font-weight: 700 }` bold totals visible in prints.
- [ ] **P6d-4:** Both print routes render `.no-print` sticky fixed top bar with TWO buttons: [🔙 Back] → browser history back; [🖨️ Print / Download PDF] → `window.print()` onClick native browser dialog (use PDF printer = save as PDF — this is the MVP, no React PDF renderer library added). Both buttons class="no-print" so they are NOT on the paper.
- [ ] **P6d-5:** `/billing` SaleActionsCell FINALIZED rows: Change "View" placeholder button (if any today) or ADD "🖨️ Print" rightmost button → Link target `/billing/${invoice.id}/print` opens new tab. Same `/customers` list Actions column → rightmost "Statement" button → `/customers/${customer.id}/statement/print` opens new tab.

### P6e — Verification + Session closing (typecheck / lint / 15 URL smoke / vault phase promote)
- [ ] **P6e-1:** `pnpm typecheck` exit 0 ✅.
- [ ] **P6e-2:** `pnpm lint` exit 0 ✅. Tolerance: 1 pre-existing `products new useMemo` warning ONLY. 0 new warnings.
- [ ] **P6e-3:** IntegratedBrowser MCP 15 URL smoke HTTP 200 (allow 2 retries for pooler timeouts; graceful dbOk degrade placeholder 200 OK):
  - `/dashboard` (KPI 4 cards NOT showing P2 demo ₹42,820 → show aggregate or "Loading aggregates…" + recent activity 10 real audit rows render)
  - `/reports` (landing 5 real report cards href not #; 3 deferred Badges visible)
  - `/reports/sales-register` (date range filters, Export button, pagination, table headers 11 cols)
  - `/reports/purchase-register` (mirror)
  - `/reports/customer-dues` (Aging 4-buckets cols 10 visible, Export)
  - `/reports/supplier-payables` (mirror)
  - `/reports/stock-valuation` (10 cols, footer valuation summary card ₹ total)
  - `/audit` (Filters Date/User/Module/Action visible, 7 real cols; mock 6 logs P2 demo values NOT rendered)
  - `/billing/<existing-finalized-invoice-id>/print` (FINALIZED existing 1 invoice → layout renders: A4 letterhead, Thermal 80mm condensed; two .no-print buttons Back + Print clickable)
  - `/billing/<invalid id>/print` → graceful not found HTTP 200 not crash
  - `/billing/<DRAFT id>/print` → "Cannot print draft/cancelled invoice. Finalize first." card visible
  - `/customers/<existing-customer-id>/statement/print` (90-day default; opening balance row; running balance; 4 aging summary values; Print button)
  - Billing list → SaleActionsCell row shows Print button to FINALIZED invoice only; Customer list Actions cell has new Statement button.
  - Export CSV clicks on 2 report pages → browser download text/csv 200 content-type, UTF-8 BOM ok.
- [ ] **P6e-4:** Update `.obsidian-vault/PHASE_TRACKER.md` — L29 P6 row Status `🔴 NOT STARTED → ✅ DONE (completed YYYY-MM-DD)` Current? NO % 100. L30 P7 Current? YES. Overall project progress ~85%. Matrix P6 █████ 100% DONE. `.obsidian-vault/CLAUDE.md` — "Verified working" prepend P6 CLOSED bullet; "Focus right now" 4-item P7 list (RLS policies, Storage adapter, CSV import, backup SOP). Run `& .\sync-agent-briefings.ps1` exit 0 6/6 mirrors.

---

## Out of Scope (explicit deferred)

Explicit do-not-build items — if operator asks, redirect to correct future phase:
1. **Return / Credit note + Cancel FINALIZED:** Phase 7. Cancel DRAFT allowed; FINALIZED Cancel permission+audit+FEFO RESTORE requires ledger reversal. No "Cancel" buttons on FINALIZED rows today.
2. **E-invoice IRN / E-way bill / QR codes:** Phase 7 Hardening. Statutory integration = external.
3. **Write audit_log.write() inside finalize*Action / createPaymentAction today:** Phase 7 blanket. Today: IF audit rows already exist from older code, render them P6c. Adding write() inside P4/P5 hot paths = correctness regression risk; skip.
4. **GST Summary report (B2B / B2C / HSN) + Daybook ledger:** P6 reports = 5 core only. Reports landing page GST/Daybook/Batch-expiry Badge "Deferred P7".
5. **New PDF renderer library (react-pdf / @react-pdf/renderer):** P6 print = browser-native window.print() + @media css ONLY. No npm install any new PDF deps.
6. **Charts.js / Recharts dashboard sparklines / Trend graphs:** KPI cards numbers only + Recent activity 10 table rows = MVP. Charts P7.
7. **Excel (xlsx) exports exports:** CSV UTF-8 only today (matches P3/P4/P5). Excel library install deferred.
8. **Tenant-scope RLS policies on 19 tables:** Phase 7 Hardening, DO NOT add RLS SQL / policy changes now — keep Prisma tenant_id WHERE clauses only (existing pattern).
9. **Storage adapter IStorageAdapter wired: Phase 7. P6 attachments = no-requirement, no document uploads yet.

---

## Sub-Phase Ordering (strict implementation order — DO NOT REORDER)
1. **P6a:** Dashboard 4 repo aggregate methods → dashboard page real KPIs + recent activity 10 rows.
2. **P6b:** Reports landing 5 alive links + 3 "Deferred" Badges dead-links removed → 5 report routes → 5 new export CSV direct function refs in exports.actions.ts.
3. **P6c:** AuditLogRepository.list → audit page.tsx paginated filters + mapping type badges.
4. **P6d:** Invoice print route [invoiceId]/print → Customer statement print → both Back/Print no-print buttons + link from list Actions cells (Print/Statement).
5. **P6e:** typecheck/lint/15 URL smoke HTTP 200 + vault phase promote P6→DONE, P7 CURRENT. sync-agent-briefings.ps1 6 mirrors OK.

---

## Risks, Open Questions, Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Running balance in Customer statement print miscalculated after partial payments (P5d aging bucket correctness carry-forward)** | Overstated/understated dues = owner loses trust, customers overpay/underpay. | REUSE P5d `getOldestOverdueDays` for-loop FIFO pattern; opening balance computed by summing ledger rows BEFORE `from` date (debits - credits summed with balance sign). Add 2 inline comments with scenarios in statement.tsx print loop. 3 manual smoke scenarios verify: (i) paid fully 0, (ii) part paid, (iii) unpaid 90+ days. |
| **Stock Valuation using "last purchase rate × available" vs weighted avg per batch gives 10%+ drift for high turnover SKUs.** | Total valuation number unreliable on dashboard "Stock" card. | MVP Use AVG purchase rate column per product (easy aggregate across all batches); comment in code: "// TODO P7: weighted avg per batch if CA insists on method disclosure". Footer card disclose method "At average purchase rate". |
| **window.print() on invoice 80mm thermal vs A4 dual layout → browser print dialog default A4 cuts off thermal.** | Operator prints wrong paper size. | Print CSS: `.print-layouts { display: flex; gap: 16mm; break-inside: avoid } .thermal-print { width: 80mm; max-width: 80mm } @media print { .thermal-print { page-break-after: always } }` so A4 prints page 1, thermal prints separate auto on 80mm if paper selected. Guide: tell operator "In print dialog → More settings → Paper size: A4 or 80mm roll". |
| **Aggregate queries slow on large tenants (10k invoices, Supabase Free row limits 500MB)** | dashboard/report pages take 10+s or 504 gateway timeout. | MonthlyStats aggregates WHERE `invoice_date gte < 1month` — already indexed? If not: suggest index (defer creating SQL today). Report pages all paginated 50 rows; exports add `LIMIT 10000` warning comment inside csv action code "break if rows exceed 10k — split export not MVP". |
| **Audit timeline "Module" variant Badge color dictionary 12 entries type mismatch vs DB audit_type enum values.** | Badge always grey default; mapping broken. | Create shared `AUDIT_BADGE_MAP` const in `src/components/audit/shared.ts` (or existing badge dict) + grep enum audit_type Prisma schema for exact values. 100% snake_case exact keys match. |
| **Supabase pooler P1001 free Mumbai → all report dashboard data rows show 0 numbers (dbOk degrade) but operator thinks it's real zero 😱** | Owner looks at P6 dashboard "Sales MTD: ₹0" and panics even though 100 real invoices exist. | Add prominent banner notice: "⚠️ Showing placeholder numbers until DB connected. Try again in 60 seconds." inside `.dashboard-banner` top of page IF dbOk=false. Same notice on all 5 report pages + audit. Graceful never 500. |

---

## Test / Verification Shortcuts (fast daily work)
1. Dashboard sanity: Open `/dashboard` — 4 KPI cards do NOT still show P2 demo strings "₹ 42,820 / Receivables ₹ 12,84,300". If match P2 → AC P6a-3 FAIL.
2. Reports smoke: Open `/reports`, all 5 report buttons click → new page loads headers correct, Export button visible, "Showing placeholder rows until database is connected" if dbOk. 0 href=# dead links.
3. Print invoice: `/billing/<finalizedId>/print` → press Ctrl+P → print preview shows A4 layout + Thermal on next page. Back + Print buttons not on paper (no-print CSS).
4. Statement sanity: `/customers/<id>/statement/print` → first row "Opening balance" with sum before `from` date; 90+ day bucket if exists red Badge.
5. Audit 10 recent: `/audit` → module Badge colors match Purchase=green, Sale=green, Adjustment=destructive. Date filter applies on submit.
6. After every sub-block: `pnpm typecheck` → `pnpm lint` (fast — 30s total).
7. Commit message: `.trae/rules/git-commit-message.md` pattern (scope P6a, P6b, etc).

---

## Cross References
- Canonical Phase Tracker: [PHASE_TRACKER.md](file:///E:/PharmnosLite/.obsidian-vault/PHASE_TRACKER.md)
- P5 AC closure / existing patterns (reuse not rewrite): `.obsidian-vault/specs/phase-5-billing-ledgers-payments.md`
- Existing aggregates (salesMonthlyStats): [sales-invoice.repository.ts](file:///E:/PharmnosLite/src/repositories/sales-invoice.repository.ts#L108-L119)
- Aging P5d method reused: [ledger.repository.ts](file:///E:/PharmnosLite/src/repositories/ledger.repository.ts#L89-L114) (getOldestOverdueDays)
- P5d @media print reuse: [globals.css](file:///E:/PharmnosLite/src/app/globals.css#L323-L379)
- Export CSV helper: exports.actions.ts 7 existing utilities
- ActionResult shared type: auth.actions.ts L19
- ADR 0002 Git gates (NO commit until literal; NO push until exact): `.obsidian-vault/decisions/0002-trae-agent-git-boundary-rules.md`
