# Phase 7 — Tasks / Implementation Queue

Map every `rule` / `rubric` AC to atomic, dependency-ordered vertical slices. Order: T1(RLS SQL) → T2(JWT claims) → T3(Storage smoke + 42501) → T4-T6 (3 reports + 3 CSV) → T7(reports landing Deferred badges remove) → T8-T9(EXPLAIN + indexes) → T10(pagination JS slice audit+fix) → T11(Backup SOP ADR 0003) → T12(Go-live OPERATIONAL_GUIDE checklist 28) → T13(typecheck) → T14(lint ≤1 legacy) → T15(30 routes HTTP 200 smoke) → T16(final gates AC19/20/21/diff-empty).

---

## Task 1: RLS SQL file + MCP deploy (FR1, AC1, AC2)
- **Coverage:** AC1 (file exists, 19 CREATE POLICY count), AC2 (deploy via MCP execute_sql + pg_policies count=19 post-deploy)
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New: `prisma/05-rls-tenant-policies.sql` (idempotent; deploy via MCP execute_sql NOT SQL Editor paste)
- **Prerequisites:** None. Requires MCP Supabase installed (already — 2026-09-30 verified list_tables=19 OAuth grant).
- **Test Requirements (TR):**
  - **TR1.1 (rule AC1):** `prisma/05-rls-tenant-policies.sql` grep `CREATE POLICY "tenant_isolation_policy" ON` returns exactly 19 lines. Tables enumerated in the exact order of 01-apply-schema-with-rls.sql L770-788 (tenants, users, roles, role_permissions, memberships, business_profiles, customers, suppliers, products, product_batches, sales_invoices, sales_invoice_items, purchase_invoices, purchase_invoice_items, stock_movements, payments, customer_ledgers, supplier_ledgers, audit_logs).
  - **TR1.2 (rule AC1):** Helper function `create or replace function public.jwt_tenant_id() returns uuid` exists; returns `NULL` on invalid/missing; never throws.
  - **TR1.3 (rule AC2):** Deploy using Supabase MCP `execute_sql` tool (NOT dashboard SQL Editor paste). After deploy run MCP SQL: `SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname='tenant_isolation_policy'` → returns 19.
  - **TR1.4 (rule AC1):** `ALTER TABLE IF EXISTS … ENABLE ROW LEVEL SECURITY` 19 lines or idempotent DO block (no-op on re-run).
  - **TR1.5 (rule AC1 idempotency):** Deploy file TWICE via MCP — second run MUST NOT error (idempotent). Save output as completion evidence.
- **Completion Evidence (fill when marked completed):**

## Task 2: JWT app_metadata.tenant_id inject + backfill (FR2, AC3, AC4)
- **Coverage:** AC3 (updateUserById in onboardNewTenant post-commit), AC4 (ensureAppMetadataTenantId helper)
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - `src/app/auth/_actions/auth.actions.ts` — (a) append `updateUserById` call AFTER `prisma.$transaction` onboarding commits; wrap in try/catch, never throw, warning-only log/return ok. (b) add helper `ensureAppMetadataTenantId(externalUserId, prismaTenantId)` wired inside sign-in success or requireServerTenantContext.
  - If needed add `import` of Supabase service-role admin client from `src/adapters/auth/supabase-auth.adapter.ts` — but KEEP @supabase import inside adapters, expose method `setAppMetadataTenantId(externalUserId, tenantId): Promise<void>` on IAuthAdapter interface + implement in supabase-auth adapter (to avoid leaking SDK import into auth.actions.ts directly — NFR1 AC20 rule).
- **Prerequisites:** T1 done (not strictly — but deploy order: SQL first, claim injection 2nd). Can code in parallel with T1; verify together.
- **Test Requirements (TR):**
  - **TR2.1 (rule AC3):** Grep `updateUserById` OR newly named `setAppMetadataTenantId` inside `onboardNewTenant` → found exactly once OUTSIDE the `$transaction` block (post-commit), inside try/catch.
  - **TR2.2 (rule AC4):** Helper `ensureAppMetadataTenantId` function defined; grep `requireServerTenantContext` OR sign-in return success path → calls it once. NOT inside finalize*Action hot paths.
  - **TR2.3 (rule AC3):** `auth-adapter.interface.ts` if extended → method `setAppMetadataTenantId(external_id, tenant_id): Promise<void>` added; supabase-auth.adapter.ts implements. @supabase/supabase-js import still lives ONLY inside `src/adapters/auth/supabase-auth.adapter.ts` (AC20 check later T16 not here).
  - **TR2.4 (rule AC3 error safety):** catch block never re-throws; returns ok. No `redirect()` or `throw new Error()` inside updateUserById branch.
  - **TR2.5 (rule):** `pnpm typecheck` exit 0 after changes locally scoped check before T13.
- **Completion Evidence:**

## Task 3: Storage smoke script + 42501 remediation MCP execute_sql (FR3, AC5)
- **Coverage:** AC5 all 6 steps (ensure → upload → list → signedUrl → delete → list-empty) plus 42501 remediation if needed
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New: `scripts/storage-smoke.mjs` (plain ES Module; use `fs.readFileSync('.env.local').split('\n').filter…parse` to load env without dotenv if not installed). Imports `storageAdapter` from `src/adapters/storage/index.ts` OR re-implement minimal Supabase client using built-in fetch if TS import awkward in mjs — fallback plan: copy-only the 7-method logic into script body (no new npm). But PREFERRED: just run as `node -r ts-node/register`? NO ts-node not installed. Fallback: Plain mjs using Supabase Storage REST endpoints directly with service_role key Authorization header — raw fetch. This approach guarantees zero new npm.
  - If any 42501 throws during run: fix via new SQL `prisma/06-storage-grants-post-42501-fix.sql` applied via MCP execute_sql. Never paste in dashboard.
- **Prerequisites:** T1 done optionally. Can parallel with T2/T4 report builds.
- **Test Requirements (TR):**
  - **TR3.1 (rule AC5):** Script runs 6 steps end-to-end, prints exact line `P7 Storage Smoke: PASS` last stdout line.
  - **TR3.2 (rule AC5):** After PASS, `storageAdapter.list(bucket, 'smoketest/')` returns empty array (delete worked).
  - **TR3.3 (rule AC5 42501):** If ANY permission/ownership error encountered → resolution is via Supabase MCP `execute_sql` tool GRANTs (create policy, grant select/insert on storage.buckets storage.objects to authenticated/service_role). SOP: if step failed, write fix SQL; run via MCP; re-run smoke. Record fix SQL file path if created.
  - **TR3.4 (rule Constraint 5):** Storage admin DDL applied through MCP execute_sql tool only. Dashboard SQL Editor NEVER used for storage.* tables. (Verified by self-declaration in evidence + file written only as .sql in prisma/ run via MCP tool.)
  - **TR3.5 (rule ENV Path-A):** Grep .env.example `SUPABASE_STORAGE_BUCKET=pharmnos-documents` matches process.env.SUPABASE_STORAGE_BUCKET actual runtime value used in script. If not match → fail until fixed (was Path-A resolved 2026-09-30; double-check).
- **Completion Evidence:**

## Task 4: Batch-Expiry report 10 cols + export CSV (FR4a, AC6, AC7, AC8 part, AC9, AC15)
- **Coverage:** AC6 route HTTP 200; AC7 exportBatchExpiryCsvAction appended exports.actions.ts DIRECT ref; AC8 reports landing remove Badge (done T7 after all 3); AC9 direct function ref no anonymous; AC15 dbOk banner.
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New `src/app/reports/batch-expiry/page.tsx` — RSC let dbOk degrade banner, filters dropdown near_expiry_days (60/90/180/365) + status + search, sort days_left asc, 10 cols table, 50/page paginated Prev/Next.
  - Append `exportBatchExpiryCsvAction` to `src/app/_actions/exports.actions.ts`.
- **Prerequisites:** None. Can run parallel with T5/T6.
- **Test Requirements (TR):**
  - **TR4.1 (rule AC6):** HTTP 200 route `/reports/batch-expiry` smoke (T15 includes it but self-check here).
  - **TR4.2 (rule AC7 export):** Exports file last lines grep `exportBatchExpiryCsvAction` → 1 function exists. Direct ref.
  - **TR4.3 (rule AC9):** New page.tsx ExportCsvButton action `<ExportCsvButton action={exportBatchExpiryCsvAction}>` direct binding only; grep anonymous `=> await export…` zero matches.
  - **TR4.4 (rule AC15):** page contains `let dbOk = isPostgresConfigured()` + AlertTriangle amber banner degrade notice exact text.
  - **TR4.5 (rule cols):** Table `<thead>` contains ≥10 cols headers rendered Batch/SKU/Product/Pack/Schedule/Received/Available/Expiry/Days Left/Status.
  - **TR4.6 (rule AC24 R4 design / rubric 0-2 pre-check):** uses existing CardCanvas, #f5f5f5 cards, #111 Export CTA; no neon/dark.
- **Completion Evidence:**

## Task 5: GST HSN Summary paginated + CSV (FR4b, AC6/7/9/10/15)
- **Coverage:** AC6 route HTTP 200; AC7 exportGstHsnSummaryCsvAction appended; AC9 direct ref; AC10 rubric portable TS aggregates; AC15 dbOk.
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New `src/app/reports/gst-hsn-summary/page.tsx` RSC let dbOk, filters from/to dates HTML5, counterparty select (All/B2B/Unregistered).
  - Append `exportGstHsnSummaryCsvAction` exports.actions.ts.
- **Prerequisites:** None. Parallel with T4/T6.
- **Test Requirements (TR):**
  - **TR5.1 (rule AC6):** route HTTP 200.
  - **TR5.2 (rule AC7):** `exportGstHsnSummaryCsvAction` function appended in exports file.
  - **TR5.3 (rule AC9):** action prop DIRECT binding.
  - **TR5.4 (rubric R2 / AC10 0-2 portable aggregates):** group by hsn+gst_rate_pct in TS only — no raw Postgres GROUP BY in repository method. Score 2 if pure TS loops; 1 fallback 1 SQL ok.
  - **TR5.5 (rule AC15):** dbOk banner pattern present.
  - **TR5.6 (rule cols):** 10 cols in table (HSN/Description/UQC/Qty/Taxable Value/Rate %/CGST/SGST/IGST/Total Amount + footer if desired).
- **Completion Evidence:**

## Task 6: Daybook report paginated 8 cols + opening/closing + CSV (FR4c, AC6/7/9/10/15)
- **Coverage:** AC6 HTTP 200; AC7 exportDaybookCsvAction; AC9 direct; AC10 portable TS running balance; AC15 banner.
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New `src/app/reports/daybook/page.tsx` RSC let dbOk, filters date range (default today), voucher types All/Sales/Purchase/Payment Received/Payment Made/Stock Adjust.
  - Append `exportDaybookCsvAction` exports.actions.ts.
- **Prerequisites:** None. Parallel T4-T6 together.
- **Test Requirements (TR):**
  - **TR6.1 (rule AC6):** route HTTP 200.
  - **TR6.2 (rule AC7):** `exportDaybookCsvAction` exists in exports file; `grep '^export.*export.*Action' src/app/_actions/exports.actions.ts` count = 13 (10 old + 3 new T4/5/6).
  - **TR6.3 (rule AC9):** action DIRECT no anonymous wrapper.
  - **TR6.4 (rule AC6 + FR4c):** Footer 3 summary cards Total Debits ₹ / Total Credits ₹ / Net Movement ₹ rendered; opening balance seeded Σ ledgers before from-date; running running_balance cumulative column.
  - **TR6.5 (rubric AC10 R2):** Opening balance calc + running balance cumulative → pure TS; no window functions. Score 2 = pure TS; 1 = 1 SQL CTE ok; 0 vendor SQL only.
  - **TR6.6 (rule AC15):** dbOk banner present.
- **Completion Evidence:**

## Task 7: Reports landing remove 3 Deferred Phase 7 badges → alive href (FR2→FR4, AC8)
- **Coverage:** AC8 zero Phase 7 Deferred badges on 3 cards (batch-expiry/gst/daybook); 0 href # count across 8 cards.
- **Priority:** medium
- **Status:** pending
- **Files to edit:**
  - `src/app/reports/page.tsx` — go to 3 Deferred badges and replace Badge component with alive Link to new routes.
- **Prerequisites:** T4/T5/T6 files created (routes must exist).
- **Test Requirements (TR):**
  - **TR7.1 (rule AC8):** grep `src/app/reports/page.tsx` `Phase 7` string count = 0 OR ≤1 only in non-Badge text comments. Deferred Badge count 0.
  - **TR7.2 (rule AC8):** grep `href="#"` src/app/reports/page.tsx count = 0.
  - **TR7.3 (rule):** 3 new route href paths `/reports/batch-expiry`, `/reports/gst-hsn-summary`, `/reports/daybook` exact.
- **Completion Evidence:**

## Task 8: EXPLAIN ANALYZE top-5 queries via MCP execute_sql (FR5.1, AC11 part)
- **Coverage:** AC11 (EXPLAIN actually run; evidence saved)
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - None (read-only tool operation). Evidence written to completion evidence of this task AND as line-comments prefix inside next T9 new SQL file `prisma/07-post-release-index-review.sql`.
- **Prerequisites:** T1 (RLS policies deployed — plans may differ; but acceptable to do pre-T1 on service role bypass).
- **Test Requirements (TR):**
  - **TR8.1 (rule):** MCP `execute_sql` ran EXPLAIN ANALYZE on 5 exact queries of FR5.1. Each plan output pasted in completion evidence as code blocks.
  - **TR8.2 (rule AC11):** For any query plan showing Seq Scan rows > 200, mark "needs index candidate". At least 2 such queries exist (typical).
  - **TR8.3 (rule):** Plans are NOT truncated. If MCP output limited, run each EXPLAIN separately.
- **Completion Evidence:**

## Task 9: Composite index SQL file create-concurrent-if-not-exists (FR5.2, AC11 full + deploy MCP)
- **Coverage:** AC11 full (≥2 new indexes; each with preceding line comment -- from EXPLAIN ANALYZE FR5.1 query X: seq scan rows N cost M → proposal)
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - New: `prisma/07-post-release-index-review.sql`
  - Deploy via MCP execute_sql (one CREATE INDEX per MCP call CONCURRENTLY so no lock table).
- **Prerequisites:** T8 done (need actual EXPLAIN evidence before adding indexes).
- **Test Requirements (TR):**
  - **TR9.1 (rule AC11 count):** Grep `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_` count ≥ 2 inside new SQL file.
  - **TR9.2 (rule AC11 comments):** Every CREATE line has line-comment directly above matching format `-- from EXPLAIN ANALYZE FR5.1 query <1-5>: seq scan rows <N> cost <M> -> proposal`.
  - **TR9.3 (rule):** Deploy each statement via MCP execute_sql CONCURRENTLY individually. No locks.
  - **TR9.4 (rule AC19 no schema edits):** schema.prisma unchanged; all via SQL file.
- **Completion Evidence:**

## Task 10: Pagination grep audit + fix all `.slice(skip` JS-level → DB skip/take (FR5.3, AC12)
- **Coverage:** AC12 zero JS-level slice pagination post-findMany.
- **Priority:** medium
- **Status:** pending
- **Files to edit:**
  - All 15 files under `src/repositories/*.ts` — grep both patterns: `.findMany(` NOT containing options `skip:` AND `take:`; AND grep line patterns `.slice(skip, skip +` or similar.
  - Rewrite any offending pattern → native Prisma skip/take in findMany options object.
  - If BaseRepository abstract: can add defaults but must still remain explicit per-list call.
- **Prerequisites:** None. Can parallel T4/T5/T6 reports.
- **Test Requirements (TR):**
  - **TR10.1 (rule AC12):** grep -r `\.slice\(skip.*skip \+` src/repositories/ count = 0 after fixes.
  - **TR10.2 (rule AC12):** grep -r `.findMany(` src/repositories/ -A 3 | grep `skip:` count = findMany count or almost-equal (some getByIds special may be exempt if <20 rows — document if ≤20 exempt).
  - **TR10.3 (rule):** pnpm typecheck exit 0 after changes. pnpm lint 0 new warnings.
- **Completion Evidence:**

## Task 11: Backup SOP ADR 0003 vault (FR6.1, AC13)
- **Coverage:** AC13 decisions/0003-backup-sop.md ADR format Status=Accepted; 3-2-1 rule, pg_dump exact commands, placeholders, no secrets.
- **Priority:** medium
- **Status:** pending
- **Files to edit:**
  - New `.obsidian-vault/decisions/0003-backup-sop.md` (vault canonical only; no project root copies per vault-first rule L159 CLAUDE.md).
  - Format: copy ADR structure from existing `0001-supabase-sql-editor-paste-workaround.md` / `0002-trae-agent-git-boundary-rules.md` (Status, Context, Decision, Consequences, then SOP section).
- **Prerequisites:** None (parallel with T12).
- **Test Requirements (TR):**
  - **TR11.1 (rule AC13):** File exists at exact vault path. Structure: Title + Status=Accepted + Context + Decision + Consequences + SOP.
  - **TR11.2 (rule AC13 NO secrets):** Grep file for `postgres://` or `eyJhbGciOi` patterns → 0 matches. Placeholders like [DATABASE_URL from .env.local NOT COMMITTED] used instead.
  - **TR11.3 (rule AC13 SOP content):** Contains (a) Supabase PITR 7-day note; (b) 3-2-1 rotation rule text; (c) exact `pg_dump` commands: schema-only separate + data-only gzip; filename format template includes env + YYYYMMDD; (d) restore drill steps (1 create DB, 2 schema, 3 data, 4 small count products WHERE check).
- **Completion Evidence:**

## Task 12: OPERATIONAL_GUIDE.md Go-live 28-item checklist (FR6.2, AC14, AC22 rubric)
- **Coverage:** AC14 28+ ordered checkboxes; AC22 rubric release completeness 0-2 score.
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - Existing `.obsidian-vault/OPERATIONAL_GUIDE.md` — append new section "## Go-live Release Checklist (Phase 7)" with 28+ ordered `- [ ] ` items exactly matching spec FR6.2 list (1-28).
- **Prerequisites:** None. Parallel with T11.
- **Test Requirements (TR):**
  - **TR12.1 (rule AC14 count):** grep `- [ ]` in the new section count ≥ 28. Ordered items from git tag to HTTP 30-route smoke last.
  - **TR12.2 (rule AC14 NO secrets):** Postgres DSN / JWT literal 0 occurrences. Placeholders only.
  - **TR12.3 (rubric AC22 R3 completeness 0-2):** Self-check score. 2 = no gaps; 1 = 1 small gap acceptable; 0 = missing any FEFO finalize or RLS block simulate. Score in completion evidence ≥ 1.5.
  - **TR12.4 (rule AC14):** Section starts exactly "## Go-live Release Checklist (Phase 7)" or near-enough with proper heading.
- **Completion Evidence:**

## Task 13: Full typecheck exit 0 (FR7.1, AC16)
- **Coverage:** AC16 pnpm typecheck exit 0 after all T1-T12 merged code.
- **Priority:** high
- **Status:** pending
- **Files to edit:** None (command only; only if errors appear fix now).
- **Prerequisites:** ALL tasks T1-T12 done (code + vault docs written; vault docs don't affect typecheck — but T1/T2/T3/T4/T5/T6/T7/T9/T10 code changes all merged first so global check once).
- **Test Requirements (TR):**
  - **TR13.1 (rule AC16):** `cd E:\PharmnosLite ; pnpm typecheck` exit code 0. No TS2xxx errors unresolved. Save truncated output if large.
  - **TR13.2 (rule):** If any errors exist → resolve within this task. Do NOT advance.
- **Completion Evidence:**

## Task 14: Full lint exit 0, ≤1 legacy warning only (FR7.2, AC17)
- **Coverage:** AC17 pnpm lint exit 0; 0 new warnings; total warnings count ≤ 1 tolerated pre-existing products-new useMemo.
- **Priority:** high
- **Status:** pending
- **Files to edit:** Only if lint errors/warnings produced; otherwise none.
- **Prerequisites:** T13 passes typecheck first.
- **Test Requirements (TR):**
  - **TR14.1 (rule AC17):** `pnpm lint` exit 0.
  - **TR14.2 (rule AC17 count):** Warning lines in output count ≤ 1. If 1 → exact line matched known legacy `products/new useMemo deps`. If new warnings appeared ≥2 → remediate within this task.
  - **TR14.3 (rule AC9/828080665):** 0 digest 828080665 collision warnings. Evidence no anonymous action wrappers.
- **Completion Evidence:**

## Task 15: HTTP routes smoke ≥ 30 URLs, 100% HTTP 200, zero 500 (FR7.3, AC18)
- **Coverage:** AC18 ≥30 routes HTTP 200; 0 500; includes FR4 new 3 routes + 2 print + core 15 + masters slug detail/edit.
- **Priority:** high
- **Status:** pending
- **Files to edit:**
  - Ad-hoc Node script (don't commit if ad-hoc temp file in scratch; or write to node fetch smoke inline like P6). Use existing pattern from P6 session write-file reuse.
- **Prerequisites:** T14 lint passes, pnpm dev server running localhost:3000 or port used.
- **Test Requirements (TR):**
  - **TR15.1 (rule AC18 count):** Routes ≥30 tested. Write list to evidence. Count of [OK ] 200 lines = N; total lines N.
  - **TR15.2 (rule AC18 zero failures):** 500 count = 0. 404 count ≤ 1 expected `/products/new` alias not exists route.
  - **TR15.3 (rule AC18 new routes specifically):** 3 new routes /reports/batch-expiry, /reports/gst-hsn-summary, /reports/daybook all 200 individually confirmed.
  - **TR15.4 (rule AC15 banner):** (optional for smoke HTTP). DB connected = real values; pooler disconnected = amber placeholders BOTH return HTTP 200; no crash scenario.
- **Completion Evidence:**

## Task 16: Final gates — AC19 diff-empty, AC20 @supabase only inside src/adapters/**, AC21 cross-tenant RLS block simulation, package/pnpm/schema diff empty
- **Coverage:** AC19 empty package.json/pnpm-lock.yaml/schema.prisma diff; AC20 @supabase imports only adapters; AC21 cross-tenant 0 rows; Constraint 2 zero schema edits; Constraint 1 zero new packages; NFR1 import location.
- **Priority:** high
- **Status:** pending
- **Files to edit:** None normally. Only if fixes required.
- **Prerequisites:** T15 smoke pass.
- **Test Requirements (TR):**
  - **TR16.1 (rule AC19):** `git diff --name-only package.json pnpm-lock.yaml prisma/schema.prisma` returns 0 lines (empty diff). AC19 pass.
  - **TR16.2 (rule AC20):** `grep -r "@supabase/supabase-js" src/ --include=*.ts --include=*.tsx` returns hits ONLY inside `src/adapters/auth/` + `src/adapters/storage/`. Zero hits in `src/app/**`, `src/lib/**` outside adapters, `src/repositories/**`. AC20 pass.
  - **TR16.3 (rule AC21):** Via MCP execute_sql simulate cross-tenant access: (a) set app.current_setting to a fake UUID; (b) SELECT count(*) FROM any business table; expects 0 rows if RLS; if service role bypass override, use a SET ROLE authenticated sandbox approach or temporarily switch session if MCP allows; else run via test user SELECT. Record method + result 0 rows = pass.
  - **TR16.4 (rule Constraint 3):** Grep hot files `finalizePurchaseAction` / `finalizeSalesInvoiceAction` — number of lines touched inside outer prisma.$transaction body = ZERO. Confirms zero rewrite of these hot-correctness paths (no changes expected in P7).
- **Completion Evidence:**

---

## Summary of Dependencies
Run order recommendation:
1. **Parallel wave 1 (after start):** T1(RLS SQL + deploy MCP), T2(JWT claims + adapter method add), T3(storage smoke script + 42501 fix via MCP as needed), T4+T5+T6 (3 reports + 3 CSVs — no shared files except exports.actions.ts, so write T4 append first T5 second T6 third to avoid parallel subagent collision), T10 pagination audit+fix, T11(Backup SOP), T12(Go-live checklist) — total 4 independent groups can run at once if using subagents.
2. **Sequential wave 2 after wave 1 group completes:** T7(reports landing fix badges), T8(EXPLAIN via MCP 5 queries) → T9(index file + MCP deploy).
3. **Verification gates T13→T14→T15→T16 after all write/code changes done.** Never run verify gates before all files merged.
