---
title: Phase 5 — Billing + Ledgers + Payments
date: 2026-09-30
status: Draft
---

## Goal
Implement the full **Billing operator workflow** end-to-end:
- Sales `/billing/new` with GST intra/inter-state half-half calculation + FEFO batch auto-suggest per product line.
- Sales Finalize transaction (single outer prisma.$transaction 9 steps OUTBOUND + customer ledger inline impact + customer.receivable_balance atomic increment).
- Payment capture for customers (receivable settlement) and suppliers (payable settlement).
- Customer dues aging buckets 0/30/60/90+ per customerLedgerRepository.agingBuckets for-loop counter + Badge display in Customer list.
- Print @media CSS baseline for invoice format.

**Why this phase?** P4 wrote purchase INBOUND stock movements + created product_batches + supplier payable balances frozen. Without P5 Billing outbound FEFO consumption, `product_batches.available_qty` never decrements (stock stays forever at purchased values), customer receivable never rises, no realistic aging for Phase 6 Reports widgets. Phase 5 is the cash-flow heart of the ERP MVP.

---

## Acceptance Criteria (17 total, 5 sub-phase checkpoints)

### P5a — Foundations (Zod sales schemas + GST service spec)
- [ ] **P5a-1:** New `src/lib/validation/sales.schemas.ts` exports minimum:
  - `SalesInvoiceCreateSchema` — snake_case exact Prisma parity keys (customer_id, customer_gst_state, delivery_state_or_ut, is_inter_state, invoice_date, status, gross_amount, total_discount, total_cgst, total_sgst, total_igst, round_off, net_amount, notes).
  - `SalesInvoiceLineCreateSchema` — product_id, batch_id (FEFO-picked), quantity, sale_rate (from line, defaults standard_sale_rate), mrp, trade_discount_pct, cgst_rate, sgst_rate, igst_rate, line_amount_before_tax, line_cgst, line_sgst, line_igst, line_total_after_tax.
  - SalesLine array non-empty min(1) refine at submit.
  - `SalesPaymentCreateSchema` (customer: customer_id, amount, payment_method enum Cash/UPI/Cheque/Bank Transfer/NEFT, reference_no, notes, entry_date). SupplierPaymentCreateSchema mirror (supplier_id).
- [ ] **P5a-2:** `GstCalculatorService` in `src/services/gst-calculator.service.ts` singleton with 3 functions:
  - `calcLineTaxes(amount_before_tax: number, gstRatePct: number, isInterState: boolean) => { cgst, sgst, igst, total_tax }` — intra: cgst = sgst = round_half_up((rate/2)/100 * base, 2); inter: igst = same with full rate; total = sum.
  - `calcInvoiceTotals(lines[]) => { gross, discount, total_cgst, total_sgst, total_igst, round_off, net }` — round_off = net - floor(net) nearest integer HALF_UP to bring to 0 when fraction < 0.50.
  - `determineInterState(businessProfile.gst_state, customer.delivery_state) => boolean` — GSTIN first 2 chars OR delivery_state match; if same = intra else inter.
- [ ] **P5a-3:** Typecheck `pnpm typecheck` exit 0 after P5a files added.

### P5b — `/billing/new` interactive client form + sales draft + finalize SINGLE tx 9 steps
- [ ] **P5b-1:** Route files:
  - RSC `src/app/billing/new/page.tsx` (dbOk degrade pattern): loads customers (repos), products (repos) + existing product batches (per product for FEFO auto-pick). Passes lists to client.
  - Client `src/app/billing/new/_form.tsx` ("use client"): `useFormState<ActionResult<T>, FormData>` bound `createSalesDraftAction` (mirrors purchase form pattern).
- [ ] **P5b-2:** Client form fields: Customer autocomplete (populate GST state from master), Invoice_date today default, Place of supply dropdown auto-filled from customer.state editable override = toggles is_inter_state checkbox, Notes textarea; N line item rows; live totals useMemo (Gross / Discount / CGST / SGST / IGST / Round off / Net); Save Draft button → redirect `/billing?created=<id>`; Finalize disabled until DRAFT save succeeds once.
- [ ] **P5b-3:** Line item row minimum: Product autocomplete (SKU + name + pack + available qty info), **FEFO "Pick batches" helper button** (opens Dialog showing existing batches for product sorted by expiry_date asc with available_qty; operator selects batch & quantity to consume; dialog populates batch_id field + quantity consumed from earliest batch first per FEFO suggestion engine; operator can override manually), Quantity Int ≥ 1, Sale_rate (from product.standard_sale_rate autofill), MRP (product autofill), GST_rate (product autofill), Discount% optional, Line Total auto. Submit fails inline errors if product_id/batch_id/quantity missing OR requested quantity > batch.available_qty.
- [ ] **P5b-4:** `createSalesDraftAction` — DRAFT row + N item rows; NO FEFO stock decrement at draft; NO ledger write yet.
- [ ] **P5b-5:** `finalizeSalesInvoiceAction(salesId)` — wraps EVERYTHING below inside **SINGLE outer prisma.$transaction, default isolation level, 9 steps**:
  1. Load invoice + items + customer for tenant scope. Throw 404 if not owned.
  2. Status check DRAFT → FINALIZED. If already FINALIZED → return ActionResult error "Already finalized" no writes (idempotency / double-click guard).
  3. Server recompute ALL totals using GstCalculatorService from submitted items lines; if delta vs submitted totals > 0.01 → reject with "Totals mismatch" (prevents tampered client-sent values).
  4. **For EACH line item, FEFO decrement loop (critical correctness):**
     - Load batches for product sorted expiry_date ASC where available_qty > 0 (exclude blocked via is_active=false).
     - remaining = line.quantity. For each batch: deduct_qty = min(remaining, batch.available_qty). Write ONE stock_movements OUTBOUND_SALE quantity_delta = -deduct_qty, batch_id = batch.id, unit_rate = line.sale_rate, ref=sales_invoice, ref_id=salesId. Decrement product_batches.available_qty -= deduct_qty inside same tx. remaining -= deduct_qty. Break loop when remaining === 0.
     - If after all eligible batches scanned, remaining > 0 → RAISE error "Insufficient FEFO stock for {product.name}; {remaining} unassigned"; tx rolls back entire invoice.
  5. Block sale of EXPIRED batches: explicit filter where batch.expiry_date < NOW() excluded from FEFO candidate pool in step 4.
  6. Sales invoice row update: status FINALIZED + finalized_at timestamp, totals set to server recomputed values from step 3, auto invoice_no = business_profile.sales_prefix + next_seq.
  7. **Customer ledger impact (INLINE pattern, NEVER call ledgerImpactService inside outer tx):** Write ONE customer_ledgers row entry_type = SALE, debit = net_amount, credit = 0, balance = prev + debit, reference_type='sales_invoice' reference_id=salesId customer_id = invoice.customer_id.
  8. **Customer summary running balance update atomic increment:** customers.receivable_balance = receivable_balance { increment: invoice.net_amount } (Prisma atomic increment — 2 concurrent invoice finalizes for same customer no race).
  9. Return ActionResult success. revalidatePath /billing, /inventory, /dashboard, /customers. Redirect to `/billing?created=<id>&finalized=1`.
- [ ] **P5b-6:** After finalize success, MCP SQL verification (when connectivity restored): stock_movements OUTBOUND_SALE count = batches consumed (for 2-batch FEFO depletion expect 2 movement rows for same product_id with negatives). product_batches.available_qty decrement totals equal line.quantity. customer_ledgers credit+balance increment matches receivable.

### P5b-2 — Sales list paginated + CSV export (mirrors purchases list)
- [ ] **P5b2-1:** `src/app/billing/page.tsx` RSC paginated 25/page (dbOk degrade pattern): columns Invoice no, Customer, Date, Status (FINALIZED badge emerald / DRAFT slate), Gross, Discount, CGST+SGST / IGST combined column, Round off, Net, **Actions**.
- [ ] **P5b2-2:** Export CSV button — DIRECT ref `exportSalesRegisterCsvAction` (no anonymous wrapper, 11 columns UTF-8 BOM: no/date/customer/status/gross/discount/cgst/sgst/igst/roundoff/net created_at en-IN dates; pattern match existing 6 CSV actions).
- [ ] **P5b2-3:** `SaleActionsCell` client component — DRAFT-only shows Finalize emerald + Cancel slate (same pattern PurchaseActionsCell: bound partial action, useTransition pending:disabled, window.confirm, toast + router.refresh). FINALIZED invoices: View button (navigate to detail view, deferred P6; in MVP no edit/delete once finalized per 8.8 "cancellation permission+audit" Phase 6 scope).

### P5c — Payments (customer receivable settlement + supplier payable settlement)
- [ ] **P5c-1:** Customer Payment entry `src/app/billing/payments/new/page.tsx` RSC + client _form: Customer autocomplete, Amount Decimal≥0.01, Payment_method enum Select Cash/UPI/Cheque/Bank Transfer/NEFT, Reference_no free-text optional, Entry_date today default, Notes textarea. Submit calls `createCustomerPaymentAction` server action.
- [ ] **P5c-2:** `createCustomerPaymentAction` transaction (or single atomic pair) — write customer_ledgers entry_type = PAYMENT, debit=0, credit=amount, balance=prev-credit, customer.receivable_balance = { decrement: amount } atomic Prisma (balances never below 0 — if decrement would overshoot to -ve, clamp to 0 + return warning "Payment exceeds total dues; rounded to 0").
- [ ] **P5c-3:** Supplier Payment entry mirror `src/app/purchases/payments/new/page.tsx` — Supplier autocomplete, Amount, Method, Reference, Notes. Server action: `createSupplierPaymentAction` → supplier_ledgers PAYMENT debit=amount credit=0 balance=prev-amount + suppliers.payable_balance { decrement }. Clamp payable ≥ 0.
- [ ] **P5c-4:** Payments list pages (billing/payments & purchases/payments): Paginated 25/page with columns Date / Counterparty / Method / Reference / Amount / Notes — placeholder RSC with dbOk degrade.
- [ ] **P5c-5:** Customer list page Actions column APPEND "Record payment" Button shortcut → navigates prefilled customerId in query param to `/billing/payments/new?customer_id=<id>`. Same Suppliers list → `/purchases/payments/new?supplier_id=<id>`.

### P5d — Aging buckets + Print CSS baseline
- [ ] **P5d-1:** `CustomerLedgerRepository` adds NEW method `async agingBuckets(customerId, ctx): Promise<{ current: number; bucket_31_60: number; bucket_61_90: number; bucket_over_90: number }>`. Implementation rule: FOR-LOOP counter scan customer ledger entries sorted by entry_date; each debit (SALE) classified by age bucket = NOW() - entry_date days; sum debits not yet offset by recent credits (simple unpaid-balance algorithm: each credit applied oldest debit first = FIFO). OUTPUT 4 bucket totals summed per invoice-level unpaid balances. No SQL window functions in MVP to keep portable across Postgres / local SQLite unit tests; pure TypeScript for-loop only.
- [ ] **P5d-2:** Customer list page "Aging" NEW Badge column colSpan existing grid rightmost — 4 color variants: current_≤30 = emerald, 31-60 = yellow, 61-90 = orange, >90 = destructive red. Hover tooltip summary with $ amounts each bucket via Badge title attribute.
- [ ] **P5d-3:** `/app/globals.css` APPEND (no existing @apply — continue 0 @apply rule): `@media print { body { font-family: Inter, Arial; margin: 0 } .no-print { display: none !important } .print-page { padding: 12mm 18mm } @page { size: A4; margin: 15mm } }` — .no-print hides navigation, sidebar, Export buttons, Filter buttons in /billing list / /customers views. Print area baseline sufficient for Phase 6 invoice detail pages.

### P5e — Verification & smoke tests (session closing)
- [ ] **P5e-1:** `pnpm typecheck` exit 0 ✅.
- [ ] **P5e-2:** `pnpm lint` exit 0 ✅ (1 tolerated pre-existing products new useMemo only; 0 new).
- [ ] **P5e-3:** Integrated browser smoke 10+ URLs HTTP 200 after 2 retries swallow pooler P1001 timeouts:
  - `/billing` (list page visible + Export CSV button rendered + Actions column visible)
  - `/billing/new` (form fields visible, add line adds row, totals compute, FEFO pick button opens dialog listing batches for product)
  - Submit valid DRAFT save for 1 product 50 qty → redirect success
  - Finalize same sales invoice → 200, toast "Invoice finalized"; check `/inventory` product available = P4 purchased qty - 50
  - `/billing/payments/new` with payment for 10% of invoice net → customer_ledgers PAYMENT credit written, receivable_balance decremented
  - `/customers` list Aging Badge column rendered 4 color variants for 3+ customers with due ages 0d/45d/120d
  - `/purchases/payments/new` supplier payment submit → suppliers payable decrements
  - `/inventory?tab=movements` StockMovements tab shows new OUTBOUND_SALE rows (delta negative) matching line.quantity
  - `/inventory/products/<id>/edit#batches` → product edit read-only batch card shows available_qty reduced by sale
  - Export Sales CSV click → browser download CSV UTF-8 BOM content-type text/csv HTTP 200
- [ ] **P5e-4:** Integrated browser Print window Ctrl+P on `/billing` — .no-print elements (sidebar nav, Export button) hidden; margins A4. Acceptable: layout not pixel-perfect; navigation just hidden baseline enough.
- [ ] **P5e-5:** Update PHASE_TRACKER.md P5 row → Status DONE completed YYYY-MM-DD Current? NO % 100; P6 Current? YES. Update CLAUDE.md canonical Verified working prepend "Phase 5 CLOSED 100%" bullet; Focus section → P6 widgets/reports/audit. Run sync-agent-briefings.ps1 6/6 mirrors ✅.

---

## Out of Scope (explicit deferred)
- **Sales RETURN (credit note):** Phase 6 Reports scope (requires FEFO RESTORE + reversal ledger + cancellation audit permission). Cancel DRAFT only; FINALIZED invoices no cancellation/return buttons in P5 UI.
- **Mixed payments multi-line on same invoice (part UPI part cash):** Single method per payment only P5; later P5c phase may add multi-line but strictly omitted here.
- **E-invoice / E-way bill IRN generation / QR codes:** Phase 7 Hardening; statutory integrations external. P5 prints basic invoice format DOM without IRN.
- **Customer-specific pricing rules / schedule price list:** P5 product.standard_sale_rate autofill; override manual OK per line, but no pricing tier lookup.
- **Discount types buy-n-get-m, cash discount vs trade discount:** Only line-level Trade_discount_pct P5. Invoice-level cash discount deferred.
- **Currency rounding by tax code type (nearest ₹0.05):** All HALF_UP Decimal(14,2). India 0.50 round up statutory; HALF_UP matches. If CA insists on statutory 0.01 → 0.00, backfill later; do NOT add new logic P5 without compliance confirmation.
- **Customer credit limit enforcement block on finalize if exceeds:** Display only on form sidebar warning red card "Credit limit exceeded". Do NOT block submit MVP (owner may approve verbal); block in Phase 6 with permission role override.
- **Product schedule H strict dispensing prescriptions: Pharmacy retail-specific; MVP wholesale — no Rx fields capture on sales invoice lines.**

---

## Sub-Phase Ordering (strict implementation order — DO NOT REORDER)
1. **P5a:** sales.schemas.ts + gstCalculatorService 3 functions + typecheck.
2. **P5b:** /billing/new routes: RSC page dbOk + client form useFormState, FEFO batch pick dialog helper. Server actions: createDraft + finalizeSalesInvoiceAction SINGLE tx 9 steps INLINE customer ledger + increment receivable_balance atomic.
3. **P5b2:** /billing list paginated + exportSalesRegisterCsvAction direct ref + SaleActionsCell DRAFT Finalize/Cancel.
4. **P5c:** Payments: /billing/payments/new (customer) + /purchases/payments/new (supplier) with decrement atomic running balances.
5. **P5d:** CustomerLedger.agingBuckets for-loop counter → customer list Aging Badge 4 colors. globals.css @media print no-print classes.
6. **P5e:** typecheck/lint/10+ browser smoke URLs. After 17 criteria ticked → phase tracker promote P5→DONE, CLAUDE canonical update, sync 6 mirrors.

---

## Risks, Open Questions, Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| **Nested $transaction inside ledgerImpactService.impactCustomer called within finalizeSalesInvoiceAction (P4 mitigation repeat pattern carryforward)** | Prisma throws "already in transaction" or partials commit — catastrophic sale not decremented stock OR ledger missing. | **MANDATORY RULE: Write customer_ledgers INSERT + customers.receivable_balance atomic { increment } INLINE inside finalize's SINGLE outer tx. NEVER call ledgerImpactService.impactCustomer from inside outer finalize tx; call ONLY outside future standalone actions with their own tx or no tx.** |
| **FEFO loop doesn't decrement all batches before moving to next item — remaining>0 after scanning eligible batches** | Invoice committed partially, stock quantities drift out of sync vs product_batches. | **Step 4 remaining>0 check RAISES error and rolls back ENTIRE transaction.** Client form helper FEFO pick dialog flags insufficient stock BEFORE submit (dialog shows "Available: X" per batch; if total available < line qty → red inline error on line BEFORE Save Draft allowed). |
| **GST rate rounding 1 paisa mismatch between server recompute and client totals** | Finalize step 3 rejects 0.01 threshold → operator confused. | Use SAME GstCalculatorService HALF_UP function on BOTH client _form useMemo AND server step 3; share singleton logic (import in client via `"use client"` server-component boundary import from lib/validation service — server side same import). Threshold 0.02 (2 paise tolerance instead of 0.01 — still safe, reduces false rejects). |
| **Expired batches not filtered from FEFO pool — step 5 removed accidentally** | Operator accidentally sells expired medicine — pharmacy safety violation. | **Unit test scenario:** create 2 batches: batch A expired 2024-01-01 available=100; batch B 2028-01-01 available=50; finalize qty=80 → check: only batch B used (qty 50) + remaining=30 triggers error; expired batch untouched. Use FEFO pick dialog also GREY OUT expired batches with "Expired" label so operator can't select manually. Both client+server double-filter. |
| **Supavisor Free pooler P1001 Connection terminated on finalize click** | Destructive partial perceived data write; operator presses again. | Finalize action SINGLE tx — default Prisma behavior = rolls back on connection loss automatically. Client useTransition pending=true button disabled during submit so double press not possible on operator side; button re-enabled once action returns error/success; dbOk fallback pattern already present RSC pages — server actions themselves add 1 line error message "DB temp unavailable, retry 60s" (no silent swallow). |
| **Aging buckets for-loop algorithm mixes up unpaid invoice balance with credits (payments applied incorrectly)** | Customer shows wrong bucket 90+ days when actually paid recently; owner loses trust. | Keep algorithm P5 SIMPLEST POSSIBLE: oldest unpaid debits subtracted FIRST from newest credits FIFO order. 3 manual test scenarios verified before marking checkbox: (1) sale day 1 + payment day 2 → 100% current, (2) sale day 90 ago no payment → 100% bucket_over_90, (3) mixed 3 invoices at 15/45/100 days + partial payment = each bucket reduced proportionally FIFO. Add 3 inline code comments in the agingBuckets function explaining scenarios for future code reviewers. |

---

## Test / Verification Shortcuts (fast daily work)
1. Quick sanity end-2-end: open `/billing/new`, select Customer=Demo retailer, add 1 line product=CROCIN, click Pick FEFO batch → auto selects earliest batch, Quantity 50, Sale rate ₹120 autofill, GST 12% autofill. Save Draft; Finalize.
2. Open `/inventory` → CROCIN Available = P4 purchased (500) - 50 = 450.
3. MCP execute_sql: `SELECT product_id, movement_type, quantity_delta, unit_rate, batch_id FROM public.stock_movements WHERE reference_id=<salesId>` → 1 OUTBOUND_SALE row with -50.
4. `SELECT id, debit, credit, balance, sale_id FROM public.customer_ledgers WHERE sale_id=<salesId>` → debit=net amount.
5. `SELECT receivable_balance FROM public.customers WHERE id=<custId>` → receivable_balance = seed value + net; then visit `/billing/payments/new?customer_id=<id>` pay full amount → receivable_balance back to 0.
6. Aging: `pnpm typecheck && pnpm lint` after each subphase.
7. Commit message standard: `.trae/rules/git-commit-message.md`

---

## Cross References
- Canonical Phase Tracker → [PHASE_TRACKER.md](file:///E:/PharmnosLite/.obsidian-vault/PHASE_TRACKER.md)
- ADR 0002 Git Boundaries Accepted → `.obsidian-vault/decisions/0002-trae-agent-git-boundary-rules.md`
- Existing purchases finalize 8-step tx pattern → `src/app/_actions/purchases.actions.ts` lines ~180-320 (REUSE pattern exactly; replace INBOUND → OUTBOUND, suppliers → customers, payable → receivable increment direction reversed)
- Zod decimalFromString/integerFromStringGteOne helpers already in purchases.schemas.ts — RE-EXPORT/import directly for sales schemas (no duplicate code!)
- ActionResult shared type → `src/app/auth/_actions/auth.actions.ts:19` (shared across all useFormState forms; never create duplicate ActionResult interfaces)
- Export CSV pattern 5 existing utilities → `src/app/_actions/exports.actions.ts`
- Customer list columns current → `src/app/customers/page.tsx` add Aging Badge column rightmost
- FEFO batch sort already exists inside service at `src/domain/services/fefobatch/` (if any; otherwise implement simple inline sort expiry_date ASC inside finalize step 4 for-loop)
