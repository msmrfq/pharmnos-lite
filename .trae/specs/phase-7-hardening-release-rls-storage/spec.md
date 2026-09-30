# Phase 7 — Hardening + Release (SPEC)

## Problem
Pharmnos Lite shipped six code phases P1–P6 with master data CRUD, purchases FEFO inbound, sales FEFO consumption with customer/supplier atomic running balances (receivable/payable), 5 paginated reports, audit timeline, invoice A4+80mm thermal + customer statement print routes. However, today the system is NOT production-ready for multi-tenant go-live:
1. **RLS policies are ENABLED but empty (default deny).** Step 1 `prisma/01-apply-schema-with-rls.sql` lines 770-788 ran `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on all 19 business tables but ZERO `CREATE POLICY` clauses exist. Data API currently returns 0 rows for tenant-scoped queries; cross-tenant reads are only blocked by application-layer `tenant_id` where-clauses NOT by the database.
2. **JWT claim `app_metadata.tenant_id` is never injected.** `auth.actions.ts` L114 `onboardNewTenant` creates tenant + user rows in Postgres but does NOT call `supabase.auth.admin.updateUserById` to set `app_metadata.tenant_id` on the Supabase Auth user record. Even if we created RLS policies that check `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`, JWTs emitted by Supabase today do NOT carry this claim.
3. **Storage adapter is implemented but NOT end-to-end verified.** `src/adapters/storage/supabase-storage.adapter.ts` lines 1-105 implements the 7-method IStorageAdapter interface, bucket `pharmnos-documents` was created via MCP execute_sql on 2026-09-30, but NO smoke scenario (upload/download/delete 1 small test file) has ever been run; bucket DDL/GRANT was known to 42501 when using SQL Editor paste (supabase_storage_admin ownership — workaround: use MCP execute_sql).
4. **3 core India pharmacy CSV reports are still Phase-7 Deferred Badges on `/reports` landing:** Batch-expiry (drug license compliance filing), GST HSN summary (GSTR-1 monthly B2B HSN aggregate cols), Daybook (daily debit/credit summary for cash/bank reconciliation). These 3 are blocking go-live filing.
5. **Slow queries + pagination correctness is unmeasured.** `BaseRepository<T>` list pattern `skip/take/count` is used across 15 repos; but `products.list` in [product.repository.ts](file:///E:/PharmnosLite/src/repositories/product.repository.ts#L49) runs a wide `include: { batches: { where: { available_qty: { gt: 0 } }, take: 3 } }` subquery which is N+1-like without composite index verification; `EXPLAIN ANALYZE` has never been run on any repo method; some reports may be slicing in-memory arrays after `findMany({take:10000})` instead of DB-level pagination — no evidence either way.
6. **Go-live checklist does not exist.** Today, if a real human signs up via Supabase Auth → onboarding → billing/purchases → RLS, no one has end-to-end walked the path; PITR/dump backup SOP is undocumented; there is zero written evidence of what "working system" means for go-live.

The explicit user directive is: *"start phase 7 and deliver ready all working system"* — so the goal is "a new pharmacy owner can sign up today and everything works, end-to-end, with zero placeholder code paths."

## Users
- **Real first human pharmacy owner (Owner-ADMIN):** signs up via `/auth/sign-up` with real email/password → workspace created → JWT carries tenant_id → RLS blocks all cross-tenant rows → can upload one purchase invoice PDF to storage → can run 8 reports + print A4/thermal invoice/statement → collects dues from customer → system is production-ready today.
- **DevOps + Release operator (you + maintainer):** runs `pnpm typecheck`, `pnpm lint`, HTTP 30-route smoke, EXPLAIN ANALYZE top-5 slow, 1 storage upload smoke, RLS cross-tenant block verify — all green → go-live.
- **Auditor / Compliance officer:** cross-tenant reads impossible (RLS + application-layer double-block); storage private bucket; export CSVs carry only current tenant rows; audit log timeline carries app-side actor_id that maps to real users.

## Goals
1. **RLS policies deployed + enforced on 19 tables.** Write `prisma/05-rls-tenant-policies.sql` idempotent — 19× `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (no-op if already enabled) + 19× `CREATE POLICY … TO authenticated USING (tenant_id = jwt_tenant_id())` + UPDATE-side `WITH CHECK` clause matching USING + 1 helper Postgres function `jwt_tenant_id() returns uuid` that safely extracts `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid` with NULL fallback. Deploy via **Supabase MCP execute_sql** NOT SQL Editor paste (adherence to 42501 workaround rule).
2. **JWT claim injection wired end-to-end.** Inside `signUpAction` / `onboardNewTenant` success path, call `supabase.auth.admin.updateUserById(userAuthId, { app_metadata: { tenant_id } })` immediately after tenant row is created. Add guarded `ensureAppMetadataTenantId()` helper so existing 2026-09-29 demo-tenant seeded user (who signed up pre-this-code) also gets backfilled claim on next login if missing.
3. **Storage IStorageAdapter 1 upload smoke scenario verified.** Run once: upload 1 small blob (1 KB random or short text) via `storageAdapter.upload(pharmnos-documents, smoketest/p7-YYYYMMDD.txt, …)` → assert file exists via `list` → call `getSignedUrl` → then `delete` cleanup. Any 42501 → fix via MCP execute_sql storage DDL/GRANT (NOT dashboard paste). After smoke, bucket ready for real purchase/sales invoice PDF uploads P8.
4. **3 deferred CSV reports + 3 paginated report pages shipped** (Batch-expiry / GST HSN summary / Daybook), each with `let dbOk` degrade banner + direct function ref ExportCsvButton (no anonymous wrapper).
5. **Top-5 slow query index review + DB-level pagination enforced everywhere.** EXPLAIN ANALYZE on: products.list, salesInvoices.list with date filters, auditLogs.list with user+event filters, customer_ledgers 90-day window, customer dues aging loop. Add missing composite btree indexes (as separate `prisma/07-post-release-index-review.sql` idempotent). Confirm: every `list()` method actually uses Prisma `skip/take` at DB level — no in-memory array `.slice(skip, skip+take)` after unbounded `findMany`.
6. **1-page Backup SOP vault doc + Go-live end-to-end checklist.** Backup SOP: `decisions/0003-backup-sop.md` (or OPERATIONAL_GUIDE.md section) — Supabase PITR (7 days free) + manual weekly `pg_dump` schema-only + data-only gzip rotation 3-2-1 rule. Go-live checklist: 28-item bullet list covers sign-up → onboarding → JWT decoded → RLS cross-tenant block Postgres simulate SET → 8 report renders → 2 print → 1 finalize*Action smoke with SQL row-level data check → all 30 routes HTTP 200.
7. **Build health + smoke: typecheck 0, lint ≤1 legacy warning, 30+ routes HTTP 200 (no 500 crash).**

## Non-Goals
1. Do NOT install react-pdf / exceljs / recharts / chart.js or any new npm package. phase-wide `pnpm-lock.yaml` diff empty rule (AC12 P6 inherited).
2. Do NOT rewrite P4 purchase finalize / P5 sales finalize / payment create server action inner transaction logic — too risky correctness regression. Wrap audit_log.write() calls if needed; never change FEFO depletion, clamp logic, totals mismatch thresholds, inline ledger rows — Constraint 3 active.
3. Do NOT edit schema.prisma — no new columns / models / enums — 19 frozen models AC12 (P6 AC inherited, P7 PHASE_TRACKER L30 confirms 19 tables).
4. Do NOT implement e-invoice IRN / E-way bill / QR codes / return/credit note — out of scope for MVP (P8 later).
5. Do NOT implement Supabase Storage signed URL on the client side; storage adapter only runs server-side today. Browser file upload widget (drag-drop file input into purchase invoice attachments) NOT required — P8.
6. Do NOT rewrite the `memberships`/`roles` access control matrix or the P3 `SystemRole` enum; permission-check wrapper missing-today is explicitly NOT a P7 go-live blocker (future P8).
7. Do NOT touch `globals.css` @media print blocks or P6 print routes — they pass 22/22 HTTP 200 smoke; only modify if typecheck/lint forces (unlikely).

---

## Functional Requirements

### FR1 RLS 19 Tables + Helper Function (idempotent SQL)
- **FR1.1** Write `prisma/05-rls-tenant-policies.sql` — single SQL file, idempotent safe to re-run many times on same DB:
  1. Idempotent DROP IF EXISTS helper function `create or replace function public.jwt_tenant_id() returns uuid …` that reads `auth.jwt()` JSONB `app_metadata.tenant_id` and casts to uuid safely; returns NULL if missing/invalid (never throws a 500).
  2. 19× `ALTER TABLE IF EXISTS … ENABLE ROW LEVEL SECURITY` — duplicates no-op but runs inside DO block IF NOT EXISTS check OR plain ALTER (Postgres allows re-ENABLE no-op behavior since PG12+; safe).
  3. 19× `DROP POLICY IF EXISTS "tenant_isolation_policy" ON table_name; CREATE POLICY "tenant_isolation_policy" ON table_name AS PERMISSIVE FOR ALL TO authenticated USING (tenant_id = public.jwt_tenant_id()) WITH CHECK (tenant_id = public.jwt_tenant_id());` — one policy per 19 tables exactly matching 01-apply-schema-with-rls.sql L770-788 table enum order.
  4. Exempt `tenants` table row-level rule carefully: most tenants rows read/write only match own id BUT allow initial seed boot (app_metadata.tenant_id NULL for fresh sign-up → needs to allow INSERT then claim backfilled). If exemption complex → simplest approach: 2 policies on `tenants` (one authenticated USING id=jwt_tenant_id, one for onboard admin user on the same memberships graph). If simpler: use application-layer Supabase service role during seed; otherwise document and default fallback: `tenants` policy works same-as-others because after sign-up (when policies enforce) user's JWT *already* has the claim.
- **FR1.2** Deploy this file via **Supabase MCP `execute_sql` tool** NOT SQL Editor dashboard paste. Run line by line if file >1MB; otherwise whole file. If one statement errors mid-file (e.g., 42501 storage.objects DDL not applicable since this file only writes public.* tables), separate idempotent blocks. Expected final state: `list_tables = 19` ALL have row_security = enabled AND a policy named "tenant_isolation_policy" visible via `SELECT * FROM pg_policies WHERE schemaname='public';` → 19 rows returned count.

### FR2 JWT Claim app_metadata.tenant_id Injection
- **FR2.1** Inside [auth.actions.ts](file:///E:/PharmnosLite/src/app/auth/_actions/auth.actions.ts) `onboardNewTenant` success path after the outer transaction commits (NOT inside the tx), call: `supabase.auth.admin.updateUserById(external_user_id, { app_metadata: { tenant_id: tenant.id } });`. Handle NOT throw: if auth admin call fails (network / env not configured), LOG a warning BUT still return the tenant (onboarding itself does not fail — RLS enforcement on read paths just returns 0 rows gracefully not crash).
- **FR2.2** Backfill safety: Inside `requireServerTenantContext()` or sign-in success hook, run 1 guard `ensureAppMetadataTenantId(userExternalId, prismaTenantId)`: if user already has a membership in the tenant AND app_metadata.tenant_id is missing, call updateUserById once and return. This fixes the seeded demo tenant user from 2026-09-29 who was created pre-FR2.1.
- **FR2.3** Add a small TS-only assertion unit check style: decode any JWT shape mock (string/json parse in comments of the code) — but NOT a runtime npm package dependency. In-browser jwt.io manual end-to-end referenced in go-live checklist.

### FR3 Storage Adapter Smoke Scenario
- **FR3.1** Write a small `scripts/storage-smoke.mjs` or `src/scripts/storage-smoke.ts` (use Node runner, no new ts-node or deps installed — leverage tsx if present else plain mjs). Steps:
  1. Load `.env.local` env vars (dotenv if installed — if not, use Node's readFileSync parse ENV file lines).
  2. Run `await storageAdapter.ensureBucket(process.env.SUPABASE_STORAGE_BUCKET ?? 'pharmnos-documents', false)`.
  3. `upload` 1 short UTF-8 text file `Buffer.from(…)` key `smoketest/p7-${YYYYMMDD}-${randomHex6}.txt` with mimetype `text/plain`.
  4. `list` prefix smoketest/ → assert file shows up, size >0.
  5. `getSignedUrl(bucket, key, { expiresInSeconds: 60 })` → assert URL string starts with https://.
  6. `delete` the smoke file; second `list` returns empty array for smoketest/ prefix.
- **FR3.2** If ANY of these steps throw 42501 permission errors on storage.buckets / storage.objects → **fix immediately via MCP `execute_sql`** GRANTs to `authenticated` / `service_role` roles per Supabase storage standard permissions. DO NOT use Dashboard SQL Editor paste (it runs as postgres role not owner; workaround: MCP).
- **FR3.3** After successful smoke: a one-line console log "P7 Storage Smoke: PASS". Do NOT commit the actual smoke script outputs or env var values to git (ignore via .gitignore scripts/*.mjs? No — script source itself allowed committed; runtime env not committed already protected).

### FR4 3 Deferred CSV Reports + Paginated Pages
**FR4a Batch-Expiry Report:**
- Route `/reports/batch-expiry`, RSC `let dbOk` degrade banner.
- Filters: `expiry_within_days` (60/90/180/365 dropdown, default 60 same as business_profile.near_expiry_days), `status` (Active/Blocked/Expired tabs-like filter), optional search (SKU/name/batch_no).
- Table cols: 10 cols (Batch No / SKU / Product / Pack / Schedule / Received Qty / Available Qty / Expiry Date | formatted dd-MMM-yyyy | / Days Left | integer red if ≤0 / Status Badge).
- Sort default: days_left asc nulls last.
- New `exportBatchExpiryCsvAction` 11 cols headers (add supplier name from purchase inbound if available, else empty).
- New button on landing `/reports`: remove "Deferred Phase 7" Badge → alive href.

**FR4b GST HSN Summary Report (GSTR-1 B2B filing):**
- Route `/reports/gst-hsn-summary`, RSC `let dbOk`.
- Filters: date range required (startDate, endDate — HTML5 inputs, default this MTD), counterparty (All / B2B Customers with GSTIN / Unregistered).
- Aggregation logic: group FINALIZED sales_invoice_items by `products.hsn_code` + gst_rate_pct → rows: `HSN | Description (concatenate distinct product names ≤120 chars) | UQC (PCS default) | Total Qty sum(quantity) | Taxable Value = sum(gross - discount) | Rate % | CGST half | SGST half | IGST if inter | Total Tax = cgst+sgst+igst | Amount Total = taxable + tax`.
- Use pure TypeScript in-memory aggregate (portable R2 score, no Postgres GROUP BY window = SQLite dev parity allowed).
- New `exportGstHsnSummaryCsvAction` 11 cols + filename `gst-hsn-summary-YYYYMMDD-YYYYMMDD.csv`.

**FR4c Daybook (Daily Debit/Credit Summary):**
- Route `/reports/daybook`, RSC `let dbOk`.
- Filters: date range (default today), optional voucher types filter (All / Sales / Purchase / Payment Received / Payment Made / Stock Adjust).
- Table rows: per voucher, 8 cols (Date | Voucher No (invoice_no or payment_code) | Particulars (counterparty or reason) | Voucher Type Badge variant | Debit ₹ | Credit ₹ | Running Balance ₹ cumulative | Narration/Remarks metadata 100 chars).
- Opening balance = sum(customer_ledgers + supplier_ledgers) before from date; closing = opening + Σ(debit) - Σ(credit).
- New `exportDaybookCsvAction` 9 cols header.
- Footer 3 summary cards: Total Debits, Total Credits, Net Movement.

**FR4d common:**
- All 3 routes: ExportCsvButton action prop DIRECT export function ref NOT anonymous `=>` wrapper → Next.js digest 828080665 collision-safe.
- `/reports` landing: original T6 3 Deferred Badges (Batch-expiry / GST-Summary / Daybook) → all alive real href routes; removed Deferred Badges Clock icon.

### FR5 Index Review + DB-level Pagination Enforcement
- **FR5.1** EXPLAIN ANALYZE (Postgres EXPLAIN ANALYZE) on these 5 specific queries:
  1. `products.list(ctx)` with `search` = 3 chars AND `skip=0, take=50` → check: does it use `products_tenant_id_name_idx` (btree tenant_id + name)? If Seq Scan with filter, add composite index candidate.
  2. `salesInvoices.list(ctx)` with `customer_id=X` + `startDate=2026-09-01` + `endDate=2026-09-30` → check uses composite `(tenant_id, customer_id, invoice_date)`? If not → propose.
  3. `auditLogs.list(ctx)` with `event_type=INVOICE_FINALIZED` + `actor_id=Y` → composite idx check.
  4. `customerLedgers list(ctx, customer_id, from=<90d ago>)` → composite `(tenant_id, customer_id, entry_date)` usage.
  5. Customer dues aging full repo call.
- **FR5.2** Deliver a new idempotent SQL file `prisma/07-post-release-index-review.sql`: for EACH missing composite index that EXPLAIN shows Seq Scan rows > 200, add `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_NAME ON table (col1, col2, col3);`. Never drop existing indexes (from 01-apply L469-640 they exist 14 unique + 36 secondary = 50 total indexes; only add new ones).
- **FR5.3** Grep audit: Scan all 15 `*.repository.ts` files. Rule: every list() method MUST call Prisma `.findMany({ skip, take })` at the DB level. It is a FAIL if any code does `.findMany({ where })` without skip/take, then later `.slice(skip, skip + take)` at JS layer. If found → rewrite to DB skip/take immediately.
- **FR5.4** No schema.prisma edits allowed by Constraint. New indexes are pure raw SQL in the new .sql file (Prisma schema can stay frozen). Deploy indexes via MCP execute_sql — run individually CONCURRENTLY so no DB table lock.

### FR6 Backup SOP + Go-live Checklist Vault Docs
- **FR6.1 Backup SOP:**
  - Create `.obsidian-vault/decisions/0003-backup-sop.md` (or append section to `.obsidian-vault/OPERATIONAL_GUIDE.md` — whichever fits better with existing ADR/template structures; default: ADR `decisions/0003-backup-sop.md` with status=Accepted).
  - Contents: (a) Supabase PITR Free-tier 7-day retention always on; (b) manual weekly 3-2-1 rotation: 1 local .sql.gz laptop, 1 encrypted cloud blob (Google Drive), 1 USB/airgap; (c) `pg_dump` exact commands for schema-only and data-only, gzip, filename template `pharmnos-<env>-<YYYYMMDD>-<schema|data>.sql.gz`; (d) restore drill steps 1-2-3 with 1 small table count verification (e.g., SELECT count(*) FROM products = N); (e) never commit the dumps to git, never include secrets in plain.
- **FR6.2 Go-live end-to-end checklist:**
  - Create `.obsidian-vault/OPERATIONAL_GUIDE.md` new section "Go-live Release Checklist (P7)" — 28+ bullet items in order: (1) git status clean / tag v0.1.0; (2) ENV diff verify .env.local matches .env.example template; (3) `pnpm install --frozen-lockfile`; (4) `pnpm typecheck` → 0; (5) `pnpm lint` → ≤1 warning; (6) Vercel Hobby deploy hook or vercel --prod; (7) Supabase Auth new real email signup /dashboard opens; (8) onboarding tx new tenant.id row created; (9) auth admin updateUser app_metadata.tenant_id populated → verify via JWT decoded jwt.io app_metadata.tenant_id == tenants.id; (10) RLS cross-tenant block: Postgres `SET app.current_user_id = other_tenant_user; SELECT count(*) FROM products;` → expects 0 rows; (11) 3 masters list renders; (12) 1 new product SKU; (13) 1 purchase FINALIZE DRAFT → FEFO batches OK; (14) 1 sale FINALIZE → customer receivable increments; (15) 1 customer payment clamp scenario; (16) Inventory batches/movements/Adjust all 5 tabs HTTP 200; (17) 8 reports renders 25 rows paginated; (18) 5+3=8 CSV downloads all 200 (10 exports actions total count today existing10 + new3 = 13); (19) Dashboard 4 KPI cards values not demo strings; (20) Audit log Recent activity shows INVOICE_FINALIZED Badge color correct; (21) Print routes A4 + 80mm layout paper (no toolbar visible — no-print class); (22) Customer statement Badge colors correct; (23) Storage upload smoke PASS; (24) EXPLAIN top5 no Seq Scan > 300 rows; (25) `/audit` filters work; (26) Final 30-route HTTP 200 smoke script output all green grep zero 500; (27) Sentry/error monitoring (none MVP — deferred); (28) Announce/notify stakeholders.

### FR7 Build Health + HTTP Routes Smoke
- **FR7.1** `pnpm typecheck` exit 0 always.
- **FR7.2** `pnpm lint` exit 0 with exactly 1 tolerated legacy warning (inventory/products/new useMemo deps). No new ESLint warnings introduced in P7 code (exports CSVs / RLS / index SQL comments — TypeScript files only; new TS files 0 warnings; modified files no new warnings).
- **FR7.3** Node fetch smoke ≥ 30 routes (add new 3 reports / batch-expiry, gst-hsn-summary, daybook, plus any RSC new route files introduced) → 100% HTTP 200 zero 500 crash count. Routes that gracefully degrade dbOk display amber banner and HTTP 200.

---

## Non-Functional Requirements

### NFR1 Security / Tenancy Correctness
- **Rule:** For every 19 business tables, a cross-tenant Postgres SELECT returns 0 rows after P7 deployed (verified via EXPLAIN + actual count). Application layer tenant where-clause AND DB-level policy double-block.
- **Rule:** No Supabase SDK import anywhere except inside `src/adapters/**`. If `@supabase/supabase-js` import appears in `app/`, `lib/`, `repositories/` outside adapters → NFR1 FAIL. Storage admin deploy only via MCP execute_sql.
- **Rule:** All new files under vault formal docs live ONLY at `.obsidian-vault/**` (not project root except mirror/shortcuts per ADR 0002 / CLAUDE.md L159-160).

### NFR2 Build Health
- **Rule:** package.json / pnpm-lock.yaml diff empty. Zero new dependencies installed. AC12 P6 inherited.
- **Rule:** schema.prisma diff empty. 19 frozen models. No migrations run.
- **Rule:** Zero new @apply directives inside globals.css (existing ones = 0 anyway; keep 0).

### NFR3 Portability
- **Rubric R2 Portable aggregates (0-2):** For new FR4 GST HSN + Daybook aggregates, pure TypeScript in-memory for-loops (no Postgres-only CTEs/window functions) → portable SQLite local dev tests future. Score: 2=100% TS loops; 1=1 SQL GROUP BY still used; 0=both SQL vendor-specific. Pass ≥ 1.5.
- **Rule:** RLS SQL file uses only standard Postgres features (pg_stat_statements / pg_jwt extensions not required). auth.jwt() built-in only (Supabase default).

### NFR4 Performance
- **Rule:** EXPLAIN ANALYZE top-5 query plans no Seq Scan with rows > 300 AND Seq Scan cost > 1000 after adding FR5.2 indexes. If unavoidable (e.g., 60-row full table), document and accept.
- **Rule:** All new FR4 report routes paginated 50/page max (default; daybook per-day 100 ok).

### NFR5 Accessibility / UI (P6 inherited)
- **Rule:** UI tokens match DESIGN.md: white canvas #ffffff, light-gray cards #f5f5f5, black CTAs #111111, Inter font, no dark mode, minimal motion.
- **Rule:** New FR4 3 reports filter buttons Export have focus-visible rings; tables aria-label correct; Badge variants use existing shadcn UI 6 variants (success/destructive/warning/default/secondary/outline) — no custom #ff8800 orange hex colors outside tailwind theme.

---

## Constraints
1. **Constraint 1:** Zero new npm packages phase-wide — no `react-pdf`, no `exceljs`, no `recharts`, no `pg` re-install etc — all exists; `package.json` / `pnpm-lock.yaml` post-phase diff empty.
2. **Constraint 2:** schema.prisma frozen 19 models — no columns, no enums, no Prisma migrate dev. All RLS and new indexes live in pure .sql files prisma/05-*.sql and 07-*.sql. Deploy via MCP execute_sql tool.
3. **Constraint 3:** NEVER rewrite P4 purchase finalize / P5 sales finalize transactions or payment clamp FEFO loops. These are hot correctness paths. Add audit_log.write wrapper only if needed (no requirement actually — FR1 RLS is at SQL policy level, not at app side. Do NOT add audit calls if not required by FR).
4. **Constraint 4:** NEVER auto commit / auto push. ADR 0002 rules active: (a) commit ONLY after user types VERBATIM standalone line `"commit this"`. (b) push ONLY after commit done AND user types EXACT standalone command line `git push origin main --force-with-lease`.
5. **Constraint 5:** Storage admin (bucket DDL, policies, grants on storage schema) — use SUPABASE MCP execute_sql ALWAYS. DO NOT paste in Supabase Dashboard SQL Editor (owner = supabase_storage_admin not postgres role, causes 42501 ownership errors — documented workaround established 2026-09-30).
6. **Constraint 6:** All FR4/FR5/FR6/FR7 new RSC DB-interacting pages and print routes / storage scripts MUST inherit `let dbOk` = isPostgresConfigured() pattern + prominent amber banner: "⚠️ Showing placeholder values until database is connected. Try again in 60 seconds." — never HTTP 500. Never uncaught pooler P1001.
7. **Constraint 7:** Vault-first planning/docs formal reference: spec.md CANONICAL lives at `.obsidian-vault/specs/phase-7-hardening-release-rls-storage.md` (write this first). Mirrors only inside .trae/specs for the Spec Mode skill artifacts; never create a spec at project root outside vault.

## Dependencies
1. Existing 19 Prisma tables (01-apply L136 line models list).
2. Existing [base-repository.ts](file:///E:/PharmnosLite/src/lib/db/base-repository.ts#L31) paged() helper; ListParams {skip, take}.
3. Existing export pattern in [exports.actions.ts](file:///E:/PharmnosLite/src/app/_actions/exports.actions.ts#L298) 10 export actions already exist → append 3 new direct.
4. [SupabaseStorageAdapter](file:///E:/PharmnosLite/src/adapters/storage/supabase-storage.adapter.ts#L27) full IStorageAdapter 7 methods (upload/download/getPublicUrl/getSignedUrl/delete/list/ensureBucket).
5. `@supabase/supabase-js` already existing only inside adapters.
6. Supabase MCP installed & operational (list_tables=19, execute_sql, storage policies fixed 2026-09-30).
7. ENV template `.env.example` lines `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET=pharmnos-documents` (Path-A resolved 2026-09-30).

## Assumptions
1. 01-apply-schema-with-rls.sql ran successfully once on 2026-09-29 → RLS is already enabled on all 19 tables → 19 ALTER TABLE ENABLE in FR1.1 are pure no-ops (safe).
2. On Supabase Free tier, `auth.jwt()` function is pre-installed in the auth schema (Supabase default) — FR1.1 helper function can call it.
3. `supabase.auth.admin.updateUserById` requires SUPABASE_SERVICE_ROLE_KEY set and valid; falls back gracefully if missing (no crash on sign-up, warning log only).
4. EXPLAIN ANALYZE on Supabase Free via MCP execute_sql is allowed — it returns EXPLAIN plan text.
5. Seeded demo tenant from 2026-09-29 has an external_id user row in users table matching Supabase Auth; FR2.2 `ensureAppMetadataTenantId` on next login will backfill.

## Open Questions (default fallback used in the plan; user can override in Approve)
1. **Q1:** Daybook Opening Balance scope — include customer + supplier ledgers, or include cash/bank? **Default fallback:** Customer + Supplier Ledgers only (payments already write there; cash/bank separate = not in 19 frozen models P7-Constraint 2 no schema edit → out).
2. **Q2:** GST HSN Summary — intra vs inter-state split columns separate or combined? **Default fallback:** 3 columns (CGST + SGST + IGST) always; if intra-state → IGST col = 0; vice-versa. (Matches P5 invoice print columns.)
3. **Q3:** Storage Smoke script — .mjs file OR run via ad-hoc tsx? **Default fallback:** plain `scripts/storage-smoke.mjs` reads .env.local manually (no dotenv required, fs+split parse).
4. **Q4:** Backup SOP location — standalone `decisions/0003-backup-sop.md` (ADR format) OR section in OPERATIONAL_GUIDE.md? **Default fallback:** ADR `decisions/0003-backup-sop.md` (fits existing decisions/ folder pattern with 0001,0002 ADRs).
5. **Q5:** P7 release name / tag v0.1.0 in go-live checklist — include? **Default fallback:** Yes (include as item 1 checklist, not enforced actual git tag unless user says at end).

---

## Acceptance Criteria
All ACs are typed as `rule` or `rubric` per Spec Mode Verification Vocabulary.

| ID | Type | Text |
|----|------|------|
| AC1 | rule | `prisma/05-rls-tenant-policies.sql` file exists; contains one `jwt_tenant_id()` helper function + exactly 19 `CREATE POLICY "tenant_isolation_policy" ON <table>` clauses covering the 19 tables (tenants, users, roles, role_permissions, memberships, business_profiles, products, product_batches, customers, suppliers, purchase_invoices, purchase_invoice_items, sales_invoices, sales_invoice_items, payments, stock_movements, customer_ledgers, supplier_ledgers, audit_logs) — count via grep = 19 policies. |
| AC2 | rule | Supabase MCP `execute_sql` deploy of FR1.1 file succeeds; after deploy, `SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname='tenant_isolation_policy';` returns 19 rows verified by MCP. |
| AC3 | rule | [auth.actions.ts](file:///E:/PharmnosLite/src/app/auth/_actions/auth.actions.ts) `onboardNewTenant` function post-commit calls `supabase.auth.admin.updateUserById(external_user_id, { app_metadata: { tenant_id: tenantRow.id } })` (greppable exact string updateUserById inside this file). Function call is AFTER `$transaction` commit block; wrapped in try/catch that never throws — on failure returns {ok:true} still. |
| AC4 | rule | `ensureAppMetadataTenantId(externalUserId, tenantId)` helper function exists in same auth.actions.ts or shared lib; called inside `requireServerTenantContext()` OR sign-in success flow. If app_metadata.tenant_id missing but membership exists → ONE updateUserById silent backfill. |
| AC5 | rule | `storageAdapter.upload` smoke scenario runs end-to-end: ensure → upload → list-found → signedUrl https → delete → list-empty. Produces stdout "P7 Storage Smoke: PASS". If any 42501 during steps → remediated via MCP execute_sql GRANT/Policy not dashboard SQL paste. Storage env SUPABASE_STORAGE_BUCKET pharmnos-documents verified matches .env.example Path-A. |
| AC6 | rule | 3 NEW paginated report routes render HTTP 200: `/reports/batch-expiry`, `/reports/gst-hsn-summary`, `/reports/daybook`. All 3 routes have `let dbOk` degrade amber banner dbOk=false. |
| AC7 | rule | 3 NEW export function actions appended to [exports.actions.ts](file:///E:/PharmnosLite/src/app/_actions/exports.actions.ts): `exportBatchExpiryCsvAction`, `exportGstHsnSummaryCsvAction`, `exportDaybookCsvAction`. Count of lines matching `^export.*export.*Action` in this file = 13 (pre-phase 10 + 3 new). |
| AC8 | rule | `/reports/page.tsx` landing Deferred Phase 7 Badge count for batch-expiry/gst-hsn/daybook → 0. Grep "Phase 7" inside reports page → only in optional notes, not as Badge on 3 cards. All 8 report cards have href real routes (href # count zero). |
| AC9 | rule | In ALL FR4 report 3 route files, ExportCsvButton `action` prop uses DIRECT function ref (exportXxxCsvAction identifier) — never anonymous arrow `async () => await exportXxx…` wrapper. Verified by grep of the 3 new page.tsx files `action={export` matches `action={` count; no lines contain `action={async`. |
| AC10 | rubric | **R2 Portable aggregates (FR4b + FR4c) 0-2.** GST HSN summary group-by + Daybook running balance in pure TypeScript for-loops (no postgres-only CTE/window functions in new code). Score 2 if 100% TS; 1 if one SQL GROUP BY fallback; 0 vendor SQL. Threshold ≥ 1.5 pass. |
| AC11 | rule | `prisma/07-post-release-index-review.sql` file exists with ≥2 composite CREATE INDEX CONCURRENTLY IF NOT EXISTS statements (FR5.2) each accompanied by preceding line comment `-- from EXPLAIN ANALYZE FR5.1 query X: seq scan rows N cost M -> proposal`. EXPLAIN top-5 runs actually executed via MCP execute_sql; results written as completion evidence. |
| AC12 | rule | FR5.3 Pagination audit Grep across src/repositories/** 15 files: no `.findMany` without passing `skip:` and `take:` in the options object, followed by JS `.slice(skip, skip+take)`. If any such pattern discovered pre-P7 and existed earlier → still rewrite now to DB level as part of this AC. Zero .slice pagination post-P7 codebase. |
| AC13 | rule | Backup SOP doc written to `.obsidian-vault/decisions/0003-backup-sop.md` using ADR template with Status=Accepted, Context/Decision/Consequences/SOP 1-2-3 sections + pg_dump exact commands with placeholders `[DB-URL-FROM-ENV-LOCAL-NOT-COMMITTED]` (never actual URLs). No env secret values literal in the markdown file. |
| AC14 | rule | Go-live checklist written inside `.obsidian-vault/OPERATIONAL_GUIDE.md` new section "Go-live Release Checklist (Phase 7)" ≥ 28 ordered items covering sign-up → onboarding → JWT → RLS block simulate → 8 reports → 2 print → finalize smoke → CSV → HTTP smoke. Checklist items are checkboxes `- [ ] `. No password literals. |
| AC15 | rule | All new RSC files (FR4 3 reports + storage smoke if any TS page) → has `let dbOk = isPostgresConfigured()` declaration followed by try/ctx+repo/catch→dbOk=false degrade with AlertTriangle amber banner "Showing placeholder until DB connected try again 60s". Never HTTP 500. |
| AC16 | rule | `pnpm typecheck` exit 0 after all P7 code. No TypeScript errors. |
| AC17 | rule | `pnpm lint` exit 0. New warnings count = 0. Total warnings count ≤ 1 (legacy products-new useMemo deps tolerated). No new Next.js digest collision warnings 828080665. |
| AC18 | rule | HTTP routes smoke ≥ 30 URLs. 100% HTTP 200. Count of HTTP 500 = 0. All 3 FR4 new routes included + 2 print routes still 200 + 15 core P6 routes + masters detail/edit slug routes. Node fetch smoke script output saved as evidence. |
| AC19 | rule | package.json diff empty. pnpm-lock.yaml diff empty. schema.prisma diff empty. No new node_modules. Verified via git status or git diff --name-only after all edits zero matches in these files. |
| AC20 | rule | NFR1 @supabase/supabase-js import location grep: `src/adapters/**` → all allowed. `src/app/**`, `src/lib/**`, `src/repositories/**` → 0 lines. |
| AC21 | rule | RLS correctness: After deploy policies, simulate cross-tenant access scenario via MCP SQL: set jwt to fake app_metadata tenant_id UUID of another workspace; SELECT count(*) FROM any business table → returns 0 rows expected; actual row count 0 verified; if 0 NOT returned AC21 FAIL must remediate. |
| AC22 | rubric | **R3 Overall release readiness 0-2.** All checklist items 1-28 conceptually cover sign-up → RLS → finalize → reports → print → CSV smoke; no obvious critical missing step. Score 2 = no gaps; 1 = one small gap (e.g. forgot email verify drill, acceptable if noted deferred); 0 = big gap missing full FEFO scenario. Threshold ≥ 1.5 pass. |
| AC23 | rubric | **R4 UI design fidelity new FR4 pages 0-2.** 3 new reports follow DESIGN.md tokens (#ffffff canvas, #f5f5f5 cards, #111 CTAs, Inter font, minimal Badges). Score 2 = perfect match; 1 = one minor (e.g. wrong border radius); 0 = dark mode neon patterns visible. Threshold ≥ 1.5 pass. |

---
_Next step: map 23 AC → tasks.md queue dependency order._
