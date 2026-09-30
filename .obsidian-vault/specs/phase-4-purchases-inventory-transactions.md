---
title: Phase 4 — Purchases + Inventory Transactions
date: 2026-09-30
status: Draft
---

## Goal
Implement the full **Purchase entry → Stock receipt → Supplier ledger impact** cycle end-to-end, plus:
- Activate stock adjustments from `/inventory` (Qty corrections).
- Batch Management tab (low/near expiry buttons already visible; labels changed from "(Phase 4)").
- CSV import baseline for future purchase batch uploads.
- Purchase Register paginated list + CSV export (mirrors Customers/Suppliers export UX).

**Why this phase?** P3 set up all 3 static masters (Products/Customers/Suppliers). Without P4 purchase INBOUND movements, `product_batches.available_qty` and supplier payable balances remain frozen at 0 from seed — no realistic stock values for Phase 5 Billing FEFO outbound consumption or Phase 6 Reports.

---

## Acceptance Criteria (17 total, 5 sub-phase checkpoints)

### P4a — Foundations (Zod schemas, 3 server actions + CSV export action)
- [ ] **P4a-1:** New `src/lib/validation/purchases.schemas.ts` exports at minimum:
  - `PurchaseInvoiceCreateSchema` — snake_case exact Prisma parity keys (`invoice_no, supplier_id, supplier_invoice_no, invoice_date, status, gross_amount, total_discount, total_tax, round_off, net_amount, notes`).
  - `PurchaseInvoiceLineCreateSchema` — `product_id, batch_no, expiry_date, quantity, mrp, purchase_rate, trade_discount_pct, gst_rate, line_amount`.
  - `PurchaseInvoiceLineCreateInput` array non-empty `min(1)` enforced at submit via `.refine()`.
  - `PurchaseInvoiceFinalizeActionInput`, `PurchaseAdjustStockActionInput`.
- [ ] **P4a-2:** Typecheck `pnpm typecheck` exit 0 after new schemas are added (no new TS warnings vs baseline).
- [ ] **P4a-3:** `src/app/_actions/purchases.actions.ts` exports 4+ `"use server"` functions with signature `(_prevState, formData): Promise<ActionResult<T>>` or bound partial for `finalize`, each calling `requireServerTenantContext()` + `assertPostgresConfigured` defensive guard per P3 exports.actions pattern.
- [ ] **P4a-4:** New `exportPurchaseRegisterCsvAction` server action matches pattern of 5 existing CSV actions, tenant-scoped, columns = Invoice no, Date, Supplier, Status, Gross, Discount, Tax, Round off, Net, Created at. Outputs UTF-8 BOM + CSV escape per `exports.actions.ts` pattern.

### P4b — `/purchases/new` client form + supplier autocomplete
- [ ] **P4b-1:** Client page at `src/app/purchases/new/page.tsx` (replace existing placeholder `<Card "Phase X" />`) uses "use client", `useFormState<ActionResult<TPurchaseCreateOutput>, FormData>` bound to `createPurchaseDraftAction`.
- [ ] **P4b-2:** Form has: Supplier autocomplete/combobox (populated from session context repo suppliers list, async, 50ms debounced filter by business_name — OR synchronous Select if dataset <500 on demo tenant); supplier_invoice_no free-text; invoice_date Calendar (today default); status hard-coded DRAFT until finalize button; Notes textarea; dynamic N line item rows; Totals read-only row (Gross / Discount / Tax / Round off / Net) computed client-side from rows; Save Draft (Submit) + Finalize 2-button group (Finalize disabled until DRAFT save succeeds once).
- [ ] **P4b-3:** Line item row minimum skeleton: Product select/datalist (SKU + name + pack concatenated), Batch_no required, Expiry_date date picker, Quantity Int min(1), MRP Decimal 2dp, Purchase_rate Decimal 2dp, Trade_discount% optional, GST_rate Decimal inherit from product when product_id selected. Line row Total computed per row. "Add line item" button appends new empty row. Delete icon per line. Submit `safeParse` fails with inline field errors if any line product_id/batch_no/quantity missing.
- [ ] **P4b-4:** Submit success → `revalidatePath('/purchases')` + redirect `/purchases?created=<invoiceId>`; toast success banner fires (uses existing `SuccessCreatedToast` extended purchase created).
- [ ] **P4b-5:** Lint `pnpm lint` exit 0 — no new ESLint warnings beyond the tolerated products/new useMemo deps baseline.

### P4c — Transactional create + Finalize (the big one)
- [ ] **P4c-1:** `createPurchaseDraftAction` creates ONE `purchase_invoices` DRAFT row + N related `purchase_invoice_items` rows (insert items array loop inside transaction; do NOT write batches or stock movements for DRAFT).
- [ ] **P4c-2:** `finalizePurchaseAction(purchaseId)` — wraps EVERYTHING below inside SINGLE `prisma.$transaction` with default isolation level (serializable if supported, else read committed):
  1. Load purchase + items + supplier for tenant scope (throw 404 if not tenant-owned).
  2. Status check DRAFT → FINALIZED only; if already FINALIZED, return ActionResult status:error with "Already finalized" without touching data.
  3. For EACH item line: upsert `product_batches` by unique (tenant_id, product_id, batch_no):
     - If batch does NOT exist → create, set received_qty = qty, available_qty = qty, purchase_id = purchaseId, supplier_id = purchase.supplier_id, mrp = line.mrp, purchase_rate = line.purchase_rate, expiry_date = line.expiry_date.
     - If batch EXISTS → increment `received_qty += qty`, increment `available_qty += qty`; leave original mrp/purchase_rate/expiry/supplier (mixing supplier batches is rare — do NOT overwrite; we already tracked via line-level separate purchase).
  4. For EACH item line (after batch upsert resolved → batch_id known): create one `stock_movements` row with `movement_type = INBOUND_PURCHASE`, `quantity_delta = +line.quantity`, `batch_id = resolvedBatch.id`, `reference_type = 'purchase_invoice'`, `reference_id = purchaseId`, `unit_rate = line.purchase_rate`, created_by = ctx.userId.
  5. Update purchase itself: status FINALIZED, finalized_at = now(), update totals in case rows changed between draft and finalize.
  6. **Ledger impact (supplier side):** Using inline pattern NOT `ledgerImpactService.impactSupplier()` (that function creates its own `$transaction` internally — avoid nested transactions). Write ONE `supplier_ledgers` row inside same tx: `entry_type = PURCHASE`, `debit = 0`, `credit = purchase.net_amount`, `balance = running previous balance + credit`. Reference: `purchase_id = purchaseId, reference_type = 'purchase_invoice', reference_id = purchaseId`.
  7. **Running balance summary update (suppliers row)**: update `suppliers.payable_balance += purchase.net_amount` (the summary column; use `update({ where: { id: supplierId, tenant_id }, data: { payable_balance: { increment: net } } })` — Prisma atomic increment avoids race between 2 purchase finalizes concurrent for same supplier).
  8. Return ActionResult status:success → `revalidatePath('/purchases')` + `revalidatePath('/inventory')` + `revalidatePath('/dashboard')` + redirect `/purchases?created=<id>&finalized=1`.
- [ ] **P4c-3:** Idempotency: re-calling finalize with same id on already-finalized returns status error "already finalized" and ZERO writes (guards double-click on submit button).
- [ ] **P4c-4:** After success, product_batches total received quantity on demo tenant = seed received_qty (0) + test purchase qty (use 500 on integration verification); increment visible on /inventory list Available column after revalidation.

### P4d — Purchase list paginated + CSV export + Stock adjustments + Batch activation
- [ ] **P4d-1:** `src/app/purchases/page.tsx` RSC — requires session ctx + `let dbOk = isPostgresConfigured()` try/catch fallback pattern (same as customers/suppliers), renders columns: Invoice no, Supplier, Date, Status (FINALIZED badge green / DRAFT gray), Gross, Discount, Tax, Round off, Net, Actions (Actions column header already labelled Phase 4 placeholder before this spec; MasterActionsCell reusable pattern for View / Finalize DRAFT / Soft Cancel FINALIZED).
- [ ] **P4d-2:** Above the purchase list table header: Export CSV button uses real `ExportCsvButton` wired to `exportPurchaseRegisterCsvAction` (not placeholder).
- [ ] **P4d-3:** Inventory tabs: Low stock & Near expiry — disable the aria-disabled/title="Phase 4" text we added in P3. Replace with plain `<Link>` active routes. They already render; only the tab labels deactivation pending.
- [ ] **P4d-4:** Stock Adjustment: `/inventory` page renders a small dialog (use existing shadcn `Dialog` primitive) on "Adjust stock" button click — opens per product. Form: batch selector (datalist of existing batches for product), Quantity delta signed Int (+/-), Reason dropdown (Damaged, Expired write-off, Found / Stock count correction, Other), Notes. Submit calls `createStockAdjustmentAction` (in purchases.actions or stock.actions if separate) → writes ONE `stock_movements` type INBOUND_ADJUST/OUTBOUND_ADJUST; updates batches.available_qty += delta (positive or negative). Single $transaction.
- [ ] **P4d-5:** Batch Management placeholder buttons in Low/Near pages ("Manage batch" buttons labelled Phase 4 disabled before spec): make them `<Link to="/inventory/products/${productId}/edit#batches">` scroll anchors (batches section for Product edit page deferred Phase 6; for now, clicking navigates to product edit with a read-only batches list — if batches section doesn't exist yet, add a static card in product edit _form listing existing batches batch_no/expiry/available_qty — NO EDIT capability for batches inside Product edit, that's reserved for purchase inbound only; only Stock Adjustment changes qty on existing batches).

### P4e — Validation & smoke tests (session closing)
- [ ] **P4e-1:** `pnpm typecheck` exit 0 ✅.
- [ ] **P4e-2:** `pnpm lint` exit 0 ✅ (1 tolerated existing useMemo deps warning only; 0 new).
- [ ] **P4e-3:** Integrated browser smoke 10 URLs HTTP 200 no console errors after 2 retries (swallow pooler timeouts per dbOk guard):
  - `/purchases` (list Actions column visible + Export CSV button rendered)
  - `/purchases/new` (form fields visible, add line adds row, totals compute)
  - submit a valid DRAFT save → redirect `/purchases?created=<id>` success toast
  - submit same purchase FINALIZE → 200, toast "Purchase finalized"
  - `/inventory` → Available column changed from 0 → qty we just finalized (500)
  - Low stock → active route HTTP 200
  - Near expiry → active route HTTP 200
  - `/inventory/products/<realId>/edit` → renders Batches info card at bottom of _form with matching batch_no/qty we just purchased (read only)
  - Stock Adjustment dialog open → submit -1 Damaged → available qty drops 1
  - Export Purchases CSV → click button → triggers browser download CSV BOM prefix ✔ (verified via HTTP 200 content-type text/csv response).

---

## Out of Scope (explicit deferred)
- **Purchase RETURN (credit note):** Phase 5 later (requires OUTBOUND purchase reversal ledger movement; separate action). Cancel only sets DRAFT → CANCELLED without reversing stock in this P4.
- **Supplier Payment capture (payable settlement):** Explicitly Phase 5 Billing & Payments scope (Payment repository + cash/upi modes + update supplier.payable_balance). P4 writes ledger credit on purchase only.
- **Batch EDIT of Product batches via `/edit#batches` form save:** Read-only list only; edits to existing batch qty happen via Stock Adjustment dialog (correct accounting trail in stock_movements).
- **GST HSN/SAC tax code slabs / inter-vs-intra-state logic:** We reuse GST `gstCalculatorService` logic in Phase 5 Billing because purchase discount/tax splits are simpler in P4 (gst_rate per line, inherited from product; invoice-level totals only computed here). If Phase 5 splits CGST+SGST vs IGST, we backfill split fields into purchase_invoice items at that time.
- **Multi-currency / foreign suppliers:** Indian market MVP → INR only Decimal(14,2).
- **CSV IMPORT (baseline):** Export ONLY per P4a-4/P4d-2. Import scaffolding NOT coded in P4 (button import disabled Phase 5 label like Phase3 did for Tabs — P6 import baseline).
- **PDF / Print Purchase Invoice:** Phase 6 Reports & Audit scope alongside Sales print CSS.

---

## Sub-Phase Ordering (strict implementation order — DO NOT REORDER)
1. **P4a:** Schemas + actions shell + csv export action.
2. **P4b:** `/purchases/new` DRAFT form (valid DRAFT save works → test).
3. **P4c:** Finalize action with full $transaction (4 entities touched 8 steps above) → verify with a purchase of 500 qty end-to-end.
4. **P4d:** List + Export real button + activate Low/Near tabs + Stock Adjustment dialog + product edit Batches info card.
5. **P4e:** Checkpoint verify typecheck/lint/10 smoke URLs. After all pass → update `PHASE_TRACKER.md` row P4 status 0% → 100% (only after 17 acceptance criteria checkmarks are actually ticked inside this spec file).

---

## Risks, Open Questions, Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| **Nested $transaction inside ledgerImpactService.impactSupplier (P3a bug pattern repeat)** | Finalize action tx double-wraps if service called → Prisma throws "already in transaction" or partials commit. | **Use INLINE supplier_ledgers INSERT + suppliers payable_balance atomic increment inside finalize's outer $transaction ONLY. Never call ledgerImpactService helpers from within a transaction; call them only outside from future actions that don't wrap their own tx.** |
| **GST rounding half-up on purchase totals (mismatch with supplier invoice pennies)** | 1 paisa variance between client totals vs server recompute causes ActionResult error and user frustration. | **Server recomputes ALL totals (gross, discount, tax, round off, net) server-side inside finalize action from lines.** Do NOT trust client-sent net_amount. Client values for totals are display-only preview. Enforce HALF_UP rounding per gstCalculatorService (already available singleton). If mismatch vs user-entered, return a warning field but still save — OR block. Decision for P4: **block submit with explicit "Totals mismatch vs calculated; please review" — avoids downstream ledger discrepancy.** |
| **Pooler connection timeout P1001 on submit (Supabase Free env)** | 500 red screen on finalize click → destructive partially committed data perceived. | **dbOk swallow guard applied on RSC pages already.** For server actions themselves: add a 3× exponential backoff retry inside BaseRepository.create/update wrappers (already written inside BaseRepository.query; extend to .transaction wrapper if not). If all retries fail: return ActionResult.status=error "Database temporarily unavailable, please try in 60 seconds"; transaction already rolled back atomic per default, no partial writes. |
| **Batch no reuse across suppliers (Pharmacy practice: same batch number format like MNF0926 used by 2 manufacturers)** | If we key batch only by (tenant, product, batch_no) per schema @@unique, we'd combine stock from 2 suppliers for same product+batch_no incorrectly. | **Keep the current @@unique; document in supplier UI: when receiving goods, if supplier reused a batch_no, prefix with their GSTIN suffix or internal suffix.** Pharmacy practice this is extremely rare (batch numbers include manufacturer MFR prefix already); we won't add supplier_id to unique key for now (would break FEFO next-batch selection which orders only by product+expiry). |
| **User clicks Finalize twice rapidly (race condition)** | 2nd call increments batches twice. | Finalize action step 2: first status check DRAFT → FINALIZED transition inside tx. If NOT DRAFT, throw. Combine with client `useTransition isPending:true` → button disabled during pending. Atomic per Postgres row lock on purchase status column. |
| **Negative available_qty on Stock Adjustment write-off (oversight)** | Available goes -ve. | `createStockAdjustmentAction` explicitly rejects OUTBOUND_ADJUST with available_qty BEFORE < quantity_delta ABS. Also Prisma transaction data integrity check: before UPDATE check if (current available) + delta is negative → return error. |

---

## Test / Verification Shortcuts (fast daily work)
1. Quick sanity: open `/purchases/new`, fill 1 line product=CROCIN 500 qty batch=CR926 expiry=2028-09-30 → Save Draft; press Finalize.
2. Open `/inventory` → search CROCIN → Available 500.
3. Open DB via MCP: `execute_sql SELECT batch_no, available_qty, received_qty, purchase_id, supplier_id FROM public.product_batches WHERE product_id = <id>` → 1 row with qtys 500.
4. Stock Movements row count: `SELECT count(*) FROM public.stock_movements WHERE reference_id=<purchaseId>` → 1 INBOUND_PURCHASE +qty=500.
5. Supplier Ledger: `SELECT supplier_id, credit, balance, purchase_id FROM public.supplier_ledgers WHERE purchase_id=<id>` → credit = net of purchase, balance previous + net.
6. `pnpm typecheck && pnpm lint` always before committing P4 checkpoint tasks.
7. **Commit message standard:** Follow git commit rules from `.trae/rules/git-commit-message.md`

---

## Cross References
- Canonical Phase Tracker → [PHASE_TRACKER.md](file:///E:/PharmnosLite/.obsidian-vault/PHASE_TRACKER.md)
- ADR 0001: Supabase paste → `.obsidian-vault/decisions/0001-supabase-sql-editor-paste-workaround.md`
- ADR 0002 (Git boundaries Accepted): `.obsidian-vault/decisions/0002-trae-agent-git-boundary-rules.md`
- Existing schemas for Product/Customer/Supplier (parity pattern) → `src/lib/validation/masters.schemas.ts`
- Existing 5 CSV export actions pattern → `src/app/_actions/exports.actions.ts`
- Zod ActionResult type used by useFormState → re-use from `src/app/_actions/masters.actions.ts`
- Seed 4 roles & permissions: permission create_purchase / edit_purchase / view_purchase / finalize_purchase already seeded (see prisma/02-seed-demo-tenant.sql 59 role_permission rows).
