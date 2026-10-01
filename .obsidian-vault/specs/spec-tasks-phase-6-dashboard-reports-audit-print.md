# Phase 6 — Tasks / Implementation Queue

Map every rule/rubric AC to one or more implementation tasks with atomic vertical slices. Dependency order: P6a → P6b → P6c → P6d → P6e. DO NOT reorder across subphases.

---

## Task 1: Repository aggregate methods (FR1.1, AC1, R1 portability)
- **Coverage:** AC1, R1
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - `src/repositories/purchase-invoice.repository.ts` (append `monthlyStats` mirror pattern)
  - `src/repositories/product-batch.repository.ts` (append `stockValuation` 4-field aggregate)
  - `src/repositories/ledger.repository.ts` (append `agedReceivablesTotals` inside CustomerLedgerRepository + `agedPayablesTotals` inside SupplierLedgerRepository, reuse existing getOldestOverdueDays per customer via for-loop)
- **Prerequisites:** none
- **Test Requirements (TR):**
  - **TR1.1 (rule):** Grep `monthlyStats` returns 2 locations in both Sales + Purchase repo classes.
  - **TR1.2 (rule):** 4 new method signatures export on classes; `pnpm typecheck` exit 0.
  - **TR1.3 (rule):** Zero Postgres window functions/CTEs in new methods (R1 portability). Pure TS for-loops only for aging totals. Grep `OVER(`, `window`, `WITH` → 0 matches in method bodies.
  - **TR1.4 (rubric R1 / 2):** Portability score — 2 = all TS pure loops; 1 = one vendor-SQL still present (≤1 tolerated); 0 = >1. Score ≥ 1 = pass. Record score + evidence here.
- **Completion Evidence (fill when marked completed):**

## Task 2: Dashboard real KPIs + Recent activity 10 rows (FR1.2–FR1.4, AC2, AC11)
- **Coverage:** AC2, FR1.2/1.3/1.4, AC11 dbOk
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - `src/app/dashboard/page.tsx` — replace `const metrics = [...]` P2 demo hardcoded values with real aggregates from repos.*; add dbOk banner notice; Promise.all parallel; add recent activity 10 rows below metrics/quicklinks.
- **Prerequisites:** Task 1 completed
- **Test Requirements (TR):**
  - **TR2.1 (rule):** Grep dashboard/page.tsx hardcoded P2 demo strings (["₹ 42,820", "₹ 12,84,300", "18 items", "7 batches", "Rajesh Kumar"]) → count ≤ 1 (Comments OK).
  - **TR2.2 (rule AC11):** `let dbOk` pattern present; try/catch inside Promise.all; degrade HTTP 200 on catch `dbOk = false`.
  - **TR2.3 (rule):** 6 parallel repo calls Promise.all; no N+1.
  - **TR2.4 (rule):** pnpm typecheck exit 0; lint exit 0.
  - **TR2.5 (rubric R5 / 2):** Empty/error state quality. Score: 2 = prominent yellow banner "⚠️ Showing placeholder…" + degraded grid shows; 1 = banner missing but grid works; 0 = red errors visible. Score ≥ 1.
  - **TR2.6 (rubric R4 / 2):** UI design fidelity. Score: 2 = all tokens match (white #fff, #111 CTAs, #f5f5f5 cards); 1 = minor one color mismatch; 0 = dark CTAs / breakouts. Score ≥ 1.5.
- **Completion Evidence:**

## Task 3: Reports landing page + 5 alive links + 3 Deferred badges (FR2.1, AC3)
- **Coverage:** FR2.1, AC3 dead links zero count
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - `src/app/reports/page.tsx` — remove `href="#"` from 8 cards; 5 link to real routes; 3 (Batch expiry / GST summary / Daybook) disable href or Badge label "Deferred P7" grey; remove kpis demo cards top section (KPI 4 demo cards hide).
- **Prerequisites:** none
- **Test Requirements (TR):**
  - **TR3.1 (rule):** Grep `href="#"` in reports/page.tsx = 0 matches.
  - **TR3.2 (rule):** 5 real route URLs navigate in browser HTTP 200 (even with placeholder pages); 3 deferred cards render disabled Badge.
  - **TR3.3 (rule):** kpis 4 demo cards hidden/removed.
  - **TR3.4 (rubric R4 / 2):** UI design fidelity. Score ≥ 1.5.
- **Completion Evidence:**

## Task 4: Sales Register report paginated 50 + filter + CSV export (FR2.2, FR2.5 part, AC4, AC11)
- **Coverage:** AC4, FR2.2, FR2.5 1/5 actions
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New `src/app/reports/sales-register/page.tsx` RSC — dbOk degrade, filters start/end date HTML5 inputs + hidden form submit, customer combobox, 11 cols table, 50/page paginated Prev/Next.
  - Append `exportSalesRegisterDetailedCsvAction` to `src/app/_actions/exports.actions.ts` DIRECT function ref export (14 cols filter enriched).
- **Prerequisites:** Task 3 alive route defined
- **Test Requirements (TR):**
  - **TR4.1 (rule):** Table 11 cols headers rendered.
  - **TR4.2 (rule AC4):** ExportCsvButton ref DIRECT — no anonymous `=> async` wrapper inside `action` prop; direct `exportSalesRegisterDetailedCsvAction` ref bound. Grep the binding.
  - **TR4.3 (rule):** CSV download HTTP 200 content-type text/csv UTF-8 BOM on browser 1 smoke click.
  - **TR4.4 (rule AC11):** let dbOk degrade present.
  - **TR4.5 (rule):** pnpm typecheck/lint exit 0.
- **Completion Evidence:**

## Task 5: Purchase Register mirror report + CSV (FR2.3 part, FR2.5, AC4, AC11)
- **Coverage:** FR2.3 mirror, FR2.5 2/5, AC4
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New `src/app/reports/purchase-register/page.tsx`
  - Append `exportPurchaseRegisterDetailedCsvAction` exports.actions.ts
- **Prerequisites:** Task 3 route alive; Purchase list existing patterns imported
- **Test Requirements:** Mirror TR4.x 1:1 with Supplier filter replacing Customer counterparty.

## Task 6: Customer Dues Aging report 4-buckets cols + CSV (FR2.3 aging part, FR2.5 3/5, R3 Aging correctness rubric, AC11)
- **Priority:** high
- **Status:** pending
- **Files to edit:** New `src/app/reports/customer-dues/page.tsx`; Append CSV action.
- **Prerequisites:** Task1 agedReceivablesTotals exists; use existing getOldestOverdueDays per row.
- **Test Requirements:**
  - TR6.1 (rule): 10 cols render incl. 4 aging buckets.
  - TR6.2 (rule): CSV 10 cols direct ref.
  - TR6.3 (rubric R3 / 2): 3 aging test scenarios manual; score ≥ 1.5.

## Task 7: Supplier Payables Aging mirror report + CSV (FR2.3 mirror, FR2.5 4/5, AC11)
- **Priority:** high
- **Status:** pending
- **Files:** New `src/app/reports/supplier-payables/page.tsx`; Append CSV action.
- **Test Requirements:** Mirror Task6 with payable dir signs reversed.

## Task 8: Stock Valuation report 10 cols + summary footer card + CSV (FR2.4, FR2.5 5/5, AC4, AC11)
- **Priority:** medium
- **Status:** pending
- **Files to edit:**
  - New `src/app/reports/stock-valuation/page.tsx`
  - Append `exportStockValuationCsvAction` exports.actions.ts
- **Prerequisites:** Task 1 stockValuation method done.
- **Test Requirements:**
  - TR8.1 (rule): Footer valuation card with method disclosure note "At avg purchase rate".
  - TR8.2 (rule AC4): Export direct ref. No digest 828080665 at lint.
  - TR8.3 (rule): pnpm typecheck/lint 0.

## Task 9: AuditLogRepository.list method + variant Badge map (FR3.1, FR3.3, AC5)
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - `src/repositories/audit-log.repository.ts` append list method match BaseRepository pattern L65
  - New `src/components/audit-badge-map.ts` or inside audit page.tsx const: shared `AUDIT_BADGE_MAP` snake_case keys enum parity Prisma
- **Prerequisites:** Grep Prisma audit_logs.audit_type real enum values FIRST (before writing map — snake 100% parity).
- **Test Requirements:**
  - TR9.1 (rule AC5): grep old demo literal strings "Rajesh Kumar (Admin)", "Neha (Inventory)", "System", "Blocked Expired in 30 days; auto-flagged" count ≤ 1 in new audit page fallback empty only.
  - TR9.2 (rule): map keys = enum values exact; variant types match shadcn Badge valid variants (success, default, warning, destructive, secondary).

## Task 10: Audit page paginated 25/page filters render real timeline (FR3.2, FR3.4, AC5, AC11)
- **Priority:** high
- **Status:** pending
- **Files to edit:** `src/app/audit/page.tsx`
- **Prerequisites:** Task 9 list method + badge map
- **Test Requirements:**
  - TR10.1 (rule AC5): 6 mock logs arrays replaced with real list call or empty fallback.
  - TR10.2 (rule): Filters row DateRange/User/Module/Action/Keyword search rendered.
  - TR10.3 (rule FR3.4): Empty state "No activity yet — create an invoice" card shows when rows = 0.
  - TR10.4 (rule AC11): let dbOk degrade pattern.
  - TR10.5 (rubric R4 / 2): UI tokens score ≥ 1.5.

## Task 11: Invoice print route /billing/[invoiceId]/print dual layout (FR4.1–FR4.2, AC6, AC11, R2 Print fidelity rubric)
- **Priority:** high
- **Status:** pending
- **Files to create:**
  - New folder `src/app/billing/[invoiceId]/print/` + `page.tsx` RSC
  - Optional `_invoice-print-layouts.tsx` component
- **Prerequisites:** P5d @media print in globals.css (already exists)
- **Test Requirements:**
  - TR11.1 (rule): DRAFT/CANCELLED ids show graceful "Cannot print draft/cancelled invoice. Finalize first." card HTTP 200 not crash.
  - TR11.2 (rule AC6): 10 cols table incl Batch + Expiry visible; CGST/SGST split OR IGST single row per correct state comparison.
  - TR11.3 (rule FR4.2): Thermal 80mm div class=".thermal-print" present; page break after; font-size condensed.
  - TR11.4 (rule AC11): let dbOk degrade pattern.
  - TR11.5 (rubric R2 / 2): Print layout fidelity. Score: 2 = 80mm no scroll horizontal fits; A4 clean letterhead + signature block; 1 = minor overflow 1 line clips; 0 = layout broken. Score ≥ 1. Record screenshots.

## Task 12: Customer Statement print /customers/[customerId]/statement/print 90-day default + Aging header buckets card (FR4.3, AC7, AC11, R3)
- **Priority:** high
- **Status:** pending
- **Files:** New `src/app/customers/[customerId]/statement/print/page.tsx`
- **Test Requirements:**
  - TR12.1 (rule AC7): Row 1 = Opening balance seeded before from-date.
  - TR12.2 (rule): 8 cols table with Running balance column cumulative correct.
  - TR12.3 (rule): 4-bucket Aging summary card values header = customer.aging totals.
  - TR12.4 (rubric R3 / 2): Aging correctness scenarios. Score ≥ 1.5.

## Task 13: Actions cell Print + Statement shortcut Links (FR4.4, FR4.5)
- **Priority:** medium
- **Status:** pending
- **Files:** `src/app/billing/_actions-cell.tsx` (FINALIZED add Link "🖨️ Print" opens new tab to /billing/[id]/print); `src/app/customers/page.tsx` MasterActionsCell or actions col append "Statement" Link opens new tab `/customers/[id]/statement/print`.
- **Test Requirements:**
  - TR13.1 (rule): FINALIZED rows Print visible; DRAFT/CANCELLED Print button hidden/disabled.
  - TR13.2 (rule): Customer list 10th aging col + actions still visible; Statement button appears.
  - TR13.3 (rule): Both buttons `target="_blank" rel="noopener"`.

## Task 14: Sticky no-print bar Print PDF / Back buttons (FR4.4)
- **Priority:** low
- **Status:** pending
- **Files:** Common component `src/components/ui/print-toolbar.tsx`; or directly inline in routes Task 11 + Task 12 pages. Buttons: [Back] `window.history.back()`, [🖨️ Print / Download PDF] `window.print()`. Class="no-print sticky top-4 z-40 flex gap-2 print:hidden" → but already `.no-print` global rule.
- **Test Requirements:**
  - TR14.1 (rule): Ctrl+P on both print pages — toolbar NOT on paper (DOM display:none via .no-print).
  - TR14.2 (rule): Buttons clickable.

## Task 15: Verification block — typecheck / lint / 15 URL smoke / vault promote (P6e AC8 AC9 AC10 AC12)
- **Priority:** high
- **Status:** pending
- **Files to edit:** `.obsidian-vault/PHASE_TRACKER.md`, `.obsidian-vault/CLAUDE.md`. Run `& .\sync-agent-briefings.ps1`.
- **Test Requirements:**
  - TR15.1 (rule AC8): `pnpm typecheck` exit 0; `pnpm lint` exit 0.
  - TR15.2 (rule AC9): IntegratedBrowser 15 URLs sequential all HTTP 200.
  - TR15.3 (rule AC10): P6 tracker P6→DONE P7→CURRENT; sync script exit 0.
  - TR15.4 (rule AC12): `git diff --name-only package.json pnpm-lock.yaml` → empty (zero installs P6).
  - TR15.5 (rubric): combined overall AC pass rate ≥ 12/12 rules + 5/5 rubrics meet threshold = overall pass.

---

## Cancellation log (user approved only)
No cancelled tasks yet.

---

## Dependencies graph (for reference)
```
T1 → T2, T6, T8
T3 → T4, T5, T6, T7, T8 (routes alive)
T9 → T10
T11 → T13 (Print shortcut)
T12 → T13 (Statement shortcut)
T1, T2, T4, T5, T6, T7, T8, T10, T11, T12, T13, T14 → all must complete before → T15
```
