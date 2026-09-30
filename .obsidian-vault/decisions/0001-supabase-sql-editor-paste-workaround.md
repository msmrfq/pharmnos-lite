---
title: Prisma → Supabase SQL Editor Paste Workaround for Supavisor Rate Limit
date: 2026-09-29
status: Accepted
working_phase: P2 (Dashboard + Cloud Go-Live) — closed 2026-09-29 (current phase now P3 Core Masters CRUD; see PHASE_TRACKER.md at project root)
---

## Context
Phase 2 cloud deployment required seeding a brand-new Supabase Free (Mumbai ap-south-1, project-ref lizyjqkckysgvffwcqvb) project that had just been provisioned with the modern Supavisor pooled fleet. After approximately 30 successive tight-loop diagnostic probes of the Postgres wire ports (raw OS TCP sockets + `pnpm exec prisma validate` + `pnpm db push` / `pnpm db seed` retries) attempting to isolate an initial credential/URI-format issue, a new connection-level failure appeared.

Differential diagnosis eliminated 4 successive hypotheses before landing on a single reproducible pattern:
1. Raw OS-level TCP sockets to `aws-0-ap-south-1.pooler.supabase.com` ports 5432/6543 — both **connected** every attempt (~20 ms).
2. Lightweight `prisma validate` (one-shot auth handshake with no prepared statements) **succeeded** every attempt and printed the "valid 🚀" banner.
3. Every subsequent Prisma Client operation that triggered a full prepared-statement session (`prisma db push` full schema DDL batch, `prisma db seed`, or even a single `prisma.tenants.count()`) **failed with P1001** "Can't reach database server", empty libpq error code/message, timeout exactly 5 s with no Postgres greeting bytes.
4. Same P1001 pattern reproduced identically when switching from native Prisma driver to `@prisma/adapter-pg` + Pool wrapper (with `previewFeatures = ["driverAdapters"]` enabled in schema.prisma generator).
5. Same P1001 pattern reproduced identically on port 6543 (Transaction mode pooler) vs port 5432 (Session mode pooler). Earlier deprecated direct-host `db.*.supabase.co:5432` returned 0 DNS A records (legacy endpoint removed post-Supavisor, no longer an option).

The only hypothesis consistent with all 5 observations is that Supavisor's free-tier per-IP per-project *new authenticated Postgres wire session* rate limiter was tripped by the ~30 earlier diagnostic probes in a tight loop. Short unauthenticated handshakes (`validate`) and raw TCP connects are whitelisted as health/allowlist checks; real multi-statement prepared-statement sessions are rate-limited with a silent drop/no-greeting behavior.

## Decision
For schema creation, index creation, role/RLS/GRANT application, demo-tenant seeding, and post-seed verification counts on fresh Supabase projects, we **use the Supabase SQL Editor HTTPS paste workflow** as the default first-resort provisioning method. Specifically we produce four deterministic idempotent SQL paste files inside `prisma/`:

1. `01-apply-schema-with-rls.sql` — offline DDL (produced via `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`), wrapped with a DROP IF EXISTS CASCADE idempotency block at the top and GRANTs + 19× ENABLE ROW LEVEL SECURITY at the bottom.
2. `04-drift-probe-and-fix.sql` — two parts: (Part 1 silent fixes) 14 UNIQUE INDEX IF NOT EXISTS, 36 secondary lookup INDEX IF NOT EXISTS, repeated 19× ENABLE RLS, repeated GRANTs for `authenticated`/`anon`/`prisma`, enum USAGE grants DO block; then (Part 2 probe) single 8-row SELECT grid comparing actual vs expected for tables_count/unique_indexes_count/rls_enabled_count/enum_types_count/permissionaction_enum_labels_count + tenants/roles/rp row counts.
3. `02-seed-demo-tenant.sql` — demo tenant + roles/59 permissions/admin user/admin membership idempotent inserts using 8x plain `DO $$ BEGIN IF count=0 THEN INSERT VALUES END IF; END $$;` blocks (0 ON CONFLICT, 0 CTE, no stacking of Postgres parser edge cases — see bug 42601 for why ON CONFLICT stacking is a hard parser error).
4. `03-verify-post-seed-counts.sql` — 3 grids (A row counts, B per-role permission sum matrix, C drill-down exact value asserts) confirming 1/4/59/1/1 seed rows match `prisma/seed.ts ROLE_PERMISSION_SETS` canonical payload.

The Prisma CLI path (`prisma db push`, `prisma db seed`) is still used for LOCAL development on a local Postgres instance. We do NOT remove it from `package.json` scripts. We simply use SQL Editor paste for the FIRST-time provisioning of any Supabase Cloud project, and on future projects we first confirm REST/Auth connectivity over HTTPS, then paste the SQL bundle, running Prisma Client over pg wire only for runtime writes (which have request-per-second rates orders of magnitude lower than the diagnostic probe loop so are extremely unlikely to trigger the same rate limiter).

## Consequences
Positive:
- First-time cloud provisioning is **deterministic and connection-problem-immune**; it goes through the same HTTPS Management API path Supabase dashboard uses internally.
- We never have to debug Prisma P1001 vs 28P01 vs libpq blank-error disambiguation during first-time setup; all errors are exact Postgres parser/constraint errors surfaced with line numbers.
- The 4 SQL files produced can be re-executed / re-pasted idempotently (IF NOT EXISTS, WHERE NOT EXISTS, DO blocks) on partial-failure / accidental re-run — never create duplicate rows or break schema.
- No dependency on user IP allowlist configuration (SQL Editor path works from any browser IP the user is logged in through).

Neutral:
- Seed data now lives in TWO places: `prisma/seed.ts` (Prisma/ts-node native path, used for local dev + unit tests) and `prisma/02-seed-demo-tenant.sql` (SQL Editor paste, used only for cloud provisioning). Payloads MUST remain identical; the counts-matrix-drilldown Grid B (per-role sums 28/9/12/10) + Grid C exact string asserts act as the invariant check preventing drift. CI task TBD in later phases will diff the two.

Negative:
- First-time setup requires ~4 human clicks (Open → New Query → Paste → Run) per file, approximately 60 seconds of copy-paste UI. We considered eliminating this by enabling the Supabase MCP server (`mcp.supabase.com/mcp`) to apply the SQL programmatically, but deferred to Phase 3 security review because the MCP asks for full project write scopes; current Trae workspace only has `integrated_browser` MCP registered.
- Sign-up flow runtime (which uses Prisma Client / Prisma repository writes) still runs over the pg wire path. If any user sees P1001 at sign-up time (low-probability since throttle state ages out 1–2 hours after last probe), we will apply a secondary fix (global PrismaClient singleton reuse helper + per-second global backoff ≤ 3 new conns/s, connect_timeout 10 s bump) and record it as a follow-on ADR; no action taken today.
- We add a project rule to avoid tight diagnostic loops against Supavisor poolers in future: max 2 Prisma validate + 1 push + 1 seed per 10-minute window during connection debugging.
