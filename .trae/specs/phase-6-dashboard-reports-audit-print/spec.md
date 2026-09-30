# Phase 6 — Dashboard Reports + Audit Views + Print Templates (SPEC)

## Problem
Pharmnos Lite shipped five code phases P1–P5 that freeze master data + purchase inbound + sales outbound FEFO consumption + customer/supplier payments with atomic running balances (receivable/payable). However, the day-to-day operator visibility artifacts are still P2 scaffolding placeholders: dashboard shows hardcoded ₹ demo KPI numbers even after 100 real invoices, 8 report card links are `href="#"` dead stubs, audit log renders 6 mock rows, and there is no way for the pharmacist to hand a paper invoice to a customer or print a statement while chasing 90+ day dues. This breaks the core MVP promise: "replace the daily essentials of heavy ERP tools."

## Users
- **Owner / Proprietor** (owner-role): opens dashboard first thing morning to check MTD sales, receivable overdue, near-expiry value, low stock count. Prints customer statements when collecting dues.
- **Billing operator / Cashier**: prints invoices (A4 + 80mm thermal) immediately after finalize. Uses Sales register daily tally reconciliation.
- **Purchase operator**: runs purchase register + supplier payables report weekly payment cycle.
- **Inventory manager**: stock valuation closing monthly filing; low stock / near-expiry alerts dashboard widgets.

## Goals
1. Populate dashboard P2 KPI card placeholders with real running aggregates using repository aggregate methods.
2. Deliver 5 paginated India pharmacy wholesale standard reports (Sales / Purchase registers, Customer dues / Supplier payables aging, Stock valuation), each with CSV export.
3. Replace 6 audit-log mock rows with real paginated timeline render, filters Date/User/Module/Action, variant Badges.
4. Print invoice detail view (A4 + 80mm thermal dual layout) and customer account statement 90-day default using P5 @media print baseline + browser native window.print() — no PDF library installs.
5. Graceful dbOk degrade always HTTP200 never 500 for Supavisor pooler P1001 environment.

## Non-Goals
1. Do NOT add return/credit note / FINALIZED invoice cancellation — Phase 7.
2. Do NOT add e-invoice IRN, E-way bills, or QR generation — Phase 7.
3. Do NOT add audit_log.write() calls inside P4/P5 hot server action paths (finalize*Action, payment creates) — too risky correctness regression; render EXISTING rows only — Phase 7 blanket write wrapper.
4. Do NOT install @react-pdf/renderer, exceljs, chart.js/recharts (npm i 0 new dependencies phase-wide).
5. Do NOT add RLS policy SQL, Storage adapter IStorageAdapter wire, CSV bulk import master — Phase 7.
6. Do NOT add charts, sparklines, dashboard graphs; numbers + 10 recent activity rows MVP.

---

## Functional Requirements

### FR1 Dashboard Aggregates
- FR1.1 Four Repository aggregate methods written (mirror existing SalesInvoice.monthlyStats pattern):
  1. PurchaseInvoiceRepository.monthlyStats(ctx, monthsBack=1)
  2. ProductBatchRepository.stockValuation(ctx) returns total_value_inr, sku_count, batches_count, near_expiry_60d_value
  3. CustomerLedgerRepository.agedReceivablesTotals(ctx) returns {current_30, bucket_31_60, bucket_61_90, bucket_over_90} (sum across all customers via for-loop not SQL windows)
  4. SupplierLedgerRepository.agedPayablesTotals(ctx) mirror
- FR1.2 dashboard/page.tsx RSC Promise.all parallel repo calls; let dbOk degrade banner notice.
- FR1.3 Four KPI cards real values: TodaySales→MTDNet, Receivables→sum 4 buckets, LowStock→count, NearExpiry→near_expiry_60d_value formatted ₹.
- FR1.4 Recent activity 10 rows real auditLogs.list pagination take 10.

### FR2 Five Reports + Five CSV Exports
- FR2.1 reports/page.tsx landing: 5 cards alive (href real routes), 3 deferred Badge Deferred-P7 (no dead #).
- FR2.2 sales-register / purchase-register 50/page RSC + filters (start/end date HTML5, counterparty select, status tab).
- FR2.3 customer-dues / supplier-payables aging 4-bucket columns (Current≤30, 31–60, 61–90, 90+) + receivable/payable totals + export.
- FR2.4 stock-valuation report 10 cols + footer summary ₹ card "At avg purchase rate".
- FR2.5 exports.actions.ts: 5 new actions DIRECT function refs (no anonymous wrapper): exportSalesRegisterDetailedCsvAction, exportPurchaseRegisterDetailedCsvAction, exportCustomerDuesCsvAction, exportSupplierPayablesCsvAction, exportStockValuationCsvAction.
- FR2.6 All 5 routes `let dbOk` degrade HTTP200 never 500; prominent banner "Showing placeholder rows until DB connected." if pooler timeout.

### FR3 Audit Timeline
- FR3.1 AuditLogRepository.list(params, ctx): PagedResult + optional filters (dateFrom/dateTo, actor_id, audit_type enum, event_type enum, search keyword).
- FR3.2 audit/page.tsx paginated 25/page replace mock rows; 7 cols + filters row.
- FR3.3 Variant Badge mapping: Product/default, Purchase/success, Sale/success, Payment/success, Adjustment/destructive, User/default, Tenant/default; 1 shared AUDIT_BADGE_MAP 100% enum parity Prisma schema.
- FR3.4 If audit_logs table empty (no writes yet in MVP path) → graceful "No activity yet — start by creating an invoice!" empty state, no red errors.

### FR4 Print Templates
- FR4.1 billing/[invoiceId]/print RSC FINALIZED-only; grace DRAFT/CANCELLED cards.
- FR4.2 Dual A4 + 80mm thermal layout side by side; break after thermal; totals big + bold.
- FR4.3 customers/[customerId]/statement/print RSC 90-day default date range from/to query; opening balance seed; running balance col per row; aging summary 4-bucket header card.
- FR4.4 Both print routes sticky no-print bar two buttons: Back / Print PDF. Buttons not on paper.
- FR4.5 Actions cells links: /billing SaleActionsCell FINALIZED rows → Print Link opens new tab; /customers MasterActionsCell → Statement button opens new tab.

### FR5 Graceful Degrade + UX Guardrails (cross-cutting)
- FR5.1 Every new RSC page dashboard/reports/audit/print let dbOk pattern catch Supavisor timeouts → degrade HTTP200 placeholder page; never uncaught 500.
- FR5.2 All numbers ₹ en-IN toLocaleString (Intl.NumberFormat "en-IN" style currency INR).
- FR5.3 All dates toLocaleDateString "en-IN" (dd/mm/yyyy or d MMM yyyy existing pattern).
- FR5.4 Snake_case 100% Prisma parity on all new CSV header col names, form input names if any.

---

## Non-Functional Requirements

### NFR1 Performance
- Dashboard 6 parallel aggregates ≤ 2.5s total (Supabase free); otherwise paginate recent activity 10 rows only.
- Report pages paginated ≤50 rows per render; CSV export 10k rows max before "export exceeded; filter date range" error.
- No client-side N+1 fetches on any new route; all data RSC single Promise.all.

### NFR2 Build Health
- pnpm typecheck exit 0 at phase end.
- pnpm lint exit 0; max 1 pre-existing products-new useMemo warning tolerated.
- Next.js digest 828080665 not triggered (export buttons direct function refs NEVER anonymous wrappers).

### NFR3 Security / Data Integrity
- All routes use requireServerTenantContext (dashboard/reports/audit) OR getTenantContextOrNull graceful degrade; tenant_scoped WHERE clause always applied on every repo call.
- Print /billing/[id]/print 404s NOT crash when id invalid OR not owned by current tenant (grace HTTP200 placeholder).
- NO audit_log.write() inside P4/P5 server actions. (zero regression risk).

### NFR4 Accessibility / UI
- Follow DESIGN.md: white canvas #fff, light-gray cards #f5f5f5, black primary CTAs #111, dark footer #101010, Inter font, no dark mode, minimal motion.
- Buttons Export/Print have visible focus-visible rings; tables aria-label appropriate; contrast ≥ 4.5:1 text/#111.

### NFR5 Portability
- Repository aggregate methods pure TypeScript for-loops (not Postgres-only window functions) → portable to local SQLite unit tests P7.
- Print templates CSS only (no vendor libs) → works on Chrome, Edge, Safari, Brave India-common browsers.

---

## Constraints
1. Zero new npm installs phase-wide (no chart libs / no xlsx / no pdf libs).
2. Edit schema.prisma → banned; no new columns / models / enums Prisma.
3. DO NOT modify P4 Purchase finalize / P5 Sales finalize / payment actions — zero correctness regressions. Wrap / add / compose; never rewrite.
4. Vault-first docs rule L159: formal planning/reference docs ONLY inside `.obsidian-vault/` never project root.
5. ADR 0002 Git gates active — NEVER commit until user literal `"commit this"` exact line; NEVER push until exact standalone `git push origin main --force-with-lease`.
6. Environment: Supabase Free Mumbai, pooler P1001 timeouts are environmental — graceful degrade is the solution, NOT configuration code changes / pooler retry loops P6.

## Dependencies
1. Prisma client 5.22.0 existing.
2. Repository pattern: BaseRepository existing L1-50.
3. `@radix-ui/*` shadcn/ui + tailwind + globals.css P5 @media print block L323-379.
4. P5d `CustomerLedgerRepository.getOldestOverdueDays()` method reused FR2.3 aging reports.
5. P5 Export CSV helpers existing exports.actions.ts FR2.5.

## Assumptions
1. billing/purchases/actions ALREADY populate audit_logs rows for critical write paths; if zero rows exist → FR3.4 empty state acceptable; AC P6c-3 honored.
2. business_profile.invoice_prefix + GSTIN fields populated from onboarding (empty graceful "Set up business profile in Settings" grey placeholder on invoice letterhead).
3. Operator browsers India use English; dates/format en-IN is correct.

## Open Questions (answered by next Approve review if possible, default fallback used if no answer)
1. **Q1:** Stock valuation method FIFO vs Average purchase rate vs Last Purchase Rate? **Default fallback:** Average purchase rate × available qty; note footer "At avg purchase rate".
2. **Q2:** Customer statement default date range? 30/60/90/180 days? **Default fallback:** 90 days.
3. **Q3:** Do we show HSN code cols on invoice print + sale register? **Default fallback:** No (HSN + GST Summary = P7 Deferred Report); product name+pack enough.
4. **Q4:** Owner wants "Credit limit exceeded" red warning card on /billing/new form sidebar? **Default fallback:** NO — that's P5 customer-specific pricing rule out-of-scope; deferred.

User can override Q1-Q4 verbally in Approve step. Otherwise defaults apply.

---

## Acceptance Criteria (typed rule / rubric)

### Rule Acceptance Criteria (binary pass)
| ID | Type | Condition | Observable evidence |
|---|---|---|---|
| AC1 | rule | P6a-1 four repo aggregate methods exist & export correct signatures | Grep `monthlyStats` on PurchaseInvoiceRepository + 3 methods names appear in file; typecheck passes |
| AC2 | rule | Dashboard 4 KPI cards do NOT contain P2 demo hardcoded strings `₹ 42,820` / `₹ 12,84,300` / `18 items` / `7 batches` anywhere in rendered JSX tree OR conditional if aggregates zero → 0 formatted | browser snapshot of /dashboard; grep dashboard/page.tsx hardcoded strings deleted or replaced |
| AC3 | rule | reports/page.tsx 8 report cards ZERO href=# dead links; 5 cards route real pages navigate HTTP 200; 3 cards Badge "Deferred P7" and no href or disabled | IntegratedBrowser GET /reports + 5 subsequent navigations all 200 |
| AC4 | rule | 5 report routes each have Export CSV button bound DIRECT export action ref name NOT anonymous; 5 new exports.actions.ts functions exported match naming pattern | lint check digest 828080665 absent; grep anonymous => async bound wrapper count = 0 |
| AC5 | rule | /audit paginated real timeline NO mock rows; 6 original demo log strings ("Rajesh Kumar (Admin)", "Neha (Inventory)", "Blocked Expired in 30 days; auto-flagged") removed from JSX OR only rendered as fallback when real list empty but hidden class when data>0 | grep audit/page.tsx mock literal strings count ≤ 2 |
| AC6 | rule | billing/[invoiceId]/print FINALIZED invoice renders: letterhead business name, 10-col item table with Batch/Expiry visible, totals section with CGST/SGST or IGST depending interstate/intrastate, 80mm thermal condensed duplicate on right / page break after | browser snapshot print route invoice Id; Ctrl+P print preview shows 2 layouts no buttons |
| AC7 | rule | Customer statement /customers/[id]/statement/print → row 1 = Opening balance with amount from before from-date; last row Running balance matches customer.receivable_balance if any; 4 aging buckets header card sums match | snapshot row 1 contains "Opening balance"; numbers reconcile manually 1 test case |
| AC8 | rule | `pnpm typecheck` exit 0 ✅; `pnpm lint` exit 0 ✅ tolerating ≤ 1 pre-existing products-new warning | terminal exit codes both 0 |
| AC9 | rule | 15 URL smoke tests HTTP 200 each; 0 uncaught 500 server errors; dbOk degrade OK when pooler down | IntegratedBrowser MCP 15 URLs sequential success status codes |
| AC10 | rule | PHASE_TRACKER.md updated — P6 row DONE 100% NO; P7 YES; overall 85%; CLAUDE.md canonical phase updated; sync-agent-briefings.ps1 exit 0 6/6 mirrors | files timestamp modified > now; script exit 0 |
| AC11 | rule | Every new report/dashboard/print route page has `let dbOk` degrade pattern NEVER const dbOk or unguarded prisma call outside try-catch | code review 8 routes; grep `let dbOk` present on each |
| AC12 | rule | NO `npm install` / `pnpm add` executed phase-wide; package.json and pnpm-lock.yaml unchanged Git diff | `git diff --name-only package.json pnpm-lock.yaml` returns empty |

### Rubric Acceptance Criteria (evaluative scoring)
| ID | Dimension | Scale (0-2) / Threshold | Anchors | Evidence source |
|---|---|---|---|---|
| R1 | Portability of aggregates | scale 0-2, PASS ≥1 | 0=Postgres window functions & CTEs only; 1=TS for-loops but 1-2 window calls; 2=all TS pure for-loops no vendor SQL | code review aggregate method bodies |
| R2 | Print layout fidelity thermal + A4 | scale 0-2, PASS ≥1 | 0=single layout broken; 1=two layouts show on Ctrl+P but minor overflow; 2=80mm thermal fits no scroll; A4 perfect letterhead/totals block | screenshot evidence browser print preview 2 invoices (long, short) |
| R3 | Aging bucket correctness for mixed overdue | scale 0-2, PASS ≥1.5 | 0=90+ day invoices show Current; 1=3/4 scenarios correct; 2=3 manual scenarios: paid fully=0 Current, 90day=90+, 3 mixed + partial payment FIFO | 3 scenario snapshots + manual numbers match |
| R4 | UI adherence DESIGN.md spec | scale 0-2, PASS ≥1.5 | 0=dark CTAs + 3D + animations heavy; 1=white canvas + light cards 90% ok one mismatch; 2=100% white #fff canvas, #111111 CTAs, #f5f5f5 cards, Inter, no dark mode | visual diff dashboard/reports/audit snapshots against DESIGN.md tokens |
| R5 | Empty & error state UX | scale 0-2, PASS ≥1 | 0=red crashes, raw stack traces leaked; 1=degrade placeholders show but banner missing notice; 2=prominent yellow banner "⚠️ Showing placeholder numbers until DB is connected" + "No activity yet" empty states pleasant | screenshots 4 error/empty states |
