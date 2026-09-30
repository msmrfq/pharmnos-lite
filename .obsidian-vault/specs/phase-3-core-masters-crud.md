---
title: Phase 3 Core Masters CRUD — Products / Customers / Suppliers
date: 2026-09-29
status: Draft
working_phase: P3 (CURRENT — next code build begins here; active 2026-09-30+)
full_tracker: `PHASE_TRACKER.md` at project root (working phase numbering P1…P7 mandatory project-wide; original PRD §29 6 phases = historical reference only)
---

## Goal
Bring the 3 core masters (Products, Customers, Suppliers) from route-shell UI into the first real usable feature. After this spec ships, a signed-in Rajesh Kumar admin user of the Maharashtra Pharma Distributors demo tenant can:
1. Browse the first 25 products in a paginated inventory list, visually see low-stock pills, FEFO batch expiry, and MRP/PTR pricing — then click a top CTA to go directly to product creation.
2. Create a new product with one or more SKU batches (each with its own batch number, manufacturing/expiry dates, quantities) and see a success toast on redirect back to the inventory grid with the newly created row inserted at top or first page.
3. Create customers (with credit limit and opening receivable balance automatically posting to their customer ledger) and suppliers (with credit terms and opening payable balance automatically posting to their supplier ledger).

This spec covers the PRIORITY-ONE part of PRD §20 data model + §21 page execution order: Masters CRUD before transactions.

## Acceptance Criteria
### Inventory / Products list (`/inventory` route)
- [ ] React Server Component. **Uses `repos.products.list(ctx, { page: 1, pageSize: 25, include: { batches: true } })` exclusively. TenantContext uses a hard-coded `tn_maharashtra_pharma_0000000000001` tenant_id for Phase 3 MVP demo mode (until sign-up populates real tenant from live session via auth middleware) — clearly marked TODO comment with follow-up ticket.**
- [ ] Table columns exactly match `ui-screen-concept` screen 5 inventory grid (in this order): SKU, Product name, Schedule class, HSN code, MRP, PTR, Pack size, Available qty (summed across all product_batches.available_qty for that product_id — computed by repository list helper), FEFO nearest batch expiry, Low stock pill (red/gray based on product.low_stock_threshold vs available sum).
- [ ] Top CTA cluster on page preserves the 4 buttons / tabs already rendered in the existing route shell: **[+ New Product]** CTA (→ /inventory/products/new redirect), Export (button, no-op disabled for this spec with aria-disabled tooltip), Low Stock tab (no-op, active/passive state toggles in URL only), Near Expiry tab (same). Next spec (Phase 3b) activates tabs.
- [ ] Pagination controls at bottom: Prev / `Page 1 of X` / Next. Disabled correctly when no rows or only one page. Hitting reload on ?page=2 returns exactly page 2 (RSC uses URL searchParams page, coerced to positive integer default 1).
- [ ] Design tokens strictly match DESIGN.md: white canvas, light-gray cards `#f5f5f5`, Inter font, black CTA pill for [+ New Product], no dark mode, no 3D gradients, minimal hover-state underline only.
- [ ] TypeScript strict mode typechecks 0 errors; `pnpm lint` exit 0; HTTP 200 on `/inventory` with 0 console errors on render.

### New Product creation (`/inventory/products/new` + server action)
- [ ] Zod schema `productCreateSchema` written + exported from `src/lib/validation/masters.schemas.ts`. Validates required fields: `sku (string min 3)`, `name (string min 2)`, `schedule_class (union ScheduleClass)`, `hsn_code (string)`, `pack_size (string)`, `mrp / ptr (Decimal coerced from formData string via Prisma.Decimal wrapper transform)`, `low_stock_threshold (int ≥0)`, optional `description`, mandatory nested `batches[]` array with at least 1 child, each child `batch_no manufacture_date expiry_date received_qty mrp ptr` valid; computes and writes `expiry_order = YYYYMMDD integer per batch` (YYYY pad, MM pad, DD pad concatenated → FEFO sortable with ORDER BY expiry_order ASC).
- [ ] Server action `"use server"` `createProductAction(formData: FormData): Promise<ActionResult<Product>>`:
  1. safeParse the schema; if invalid return state.errors = flatten().fieldErrors for per-field inline paragraphs (aria-describedby pattern already used on auth forms).
  2. Build TenantContext; assertPostgresConfigured guard before any DB call.
  3. **Single `prisma.$transaction`** that writes Product row + N ProductBatch rows atomically (repos.products.create wraps this; if no such method yet, add it — do not perform two separate non-atomic writes).
  4. On success call useToast `{ variant: 'success', title: "Product created", description: product.name }` via the toaster primitive; redirect to `/inventory`.
  5. On any unexpected Prisma error return state.error = "Product could not be created. Please try again." — no raw Prisma stack leakage to form state.
- [ ] Client form component `"use client"` with `useFormState(createProductAction, initial)`, `useFormStatus` pending Submit button (label changes to "Creating…" while pending, disabled). Each field shows red inline error if state.errors.field exists; banner at top if state.error global string.
- [ ] Smoke tests: submitting empty form shows inline errors, submitting invalid decimal MRP shows coercion error, submitting with 1 batch + 2 batch rows → create rows, then go back to `/inventory` grid paginated first page → newly created product with 1 or 2 batches shows with sum available qty correct (FEFO row = nearest expiry).

### Customers master
- [ ] `customerCreateSchema` in masters.schemas.ts: `full_name min 2 / company_name optional / contact_phone 10-digit regex / email format optional / gstin 15-char regex optional / state 2-alpha ISO / city / address / credit_limit Decimal coerced ≥ 0 / opening_balance Decimal coerced / opening_balance_type enum debit_credit`.
- [ ] `/customers/new` server action `createCustomerAction` → tx creates customer row then **immediately** writes `customer_ledgers` OPENING_BALANCE entry via `domainServices.ledgerImpact.impactCustomer(ctx, { entryDate today, counterparty customer_id, type OPENING_BALANCE, amount opening_balance, direction debit_or_credit })` **inside same transaction**, then updates `customer.receivable_balance` column with the running balance the ledgerImpact helper returns. End state: customer.created + customer_ledgers.rows = 1 + customer.receivable_balance populated exactly = opening_balance magnitude (with sign per direction).
- [ ] `/customers` list RSC via repos.customers.list with columns: Name, Company, Phone, GSTIN, State, Credit limit, Receivable balance (red pill if balance > 0), [+ New Customer] CTA at top.

### Suppliers master
- [ ] `supplierCreateSchema` in masters.schemas.ts mirror of customer: name, contact_phone, email, gstin, state, city, address, credit_days int (how long payables can age), opening_balance Decimal coerced, opening_balance_type debit_credit.
- [ ] `/suppliers/new` server action `createSupplierAction` → tx writes supplier then via `ledgerImpact.impactSupplier` SUPPLIER_LEDGERS OPENING_BALANCE row + supplier.payable_balance column updated.
- [ ] `/suppliers` list RSC columns: Name, Contact, GSTIN, State, Credit days, Payable balance, [+ New Supplier] CTA.

### Non-functional acceptance criteria
- [ ] `pnpm typecheck` exit 0. `pnpm lint` exit 0. `pnpm exec prisma validate` valid 🚀.
- [ ] Browser smoke on 5 new/modified routes: `/inventory`, `/inventory/products/new`, `/customers`, `/customers/new`, `/suppliers`, `/suppliers/new` — all HTTP 200, 0 console errors.
- [ ] Create 3 products via the new form, then go to `/inventory` and screenshot first page as evidence file stored alongside this spec.

## Out of Scope
This spec deliberately does **NOT** cover:
- Activating Low Stock / Near Expiry tabs / filters (Phase 3b).
- Export CSV button on inventory (Phase 3b — needs CSV writer + stream RSC).
- Edit / Delete masters (Phase 3c — soft delete pattern via is_active boolean + audit log rows).
- Attachments / document upload via Storage adapter (deferred until bug `bugs/supabase-storage-bucket-env-mismatch.md` resolved).
- Real session auth middleware wiring (Phase 3c — currently uses hard-coded TN demo tenant_id for MVP).
- Real RLS policies + `app_metadata.tenant_id` JWT claim injection (security hardening step, optional defense-in-depth after this spec ships).
