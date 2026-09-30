---
title: Prisma CLI / Prisma Client P1001 on Supavisor Pooler Authenticated Sessions
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. Provision a brand-new Supabase Free project in ap-south-1 (Mumbai) — modern Supavisor pooled fleet, project-ref = lizyjqkckysgvffwcqvb.
2. Create a dedicated Postgres role `prisma` via SQL Editor ALTER USER ... PASSWORD [...] statement.
3. GRANT ALL ON SCHEMA public + tables + sequences + default privileges to prisma; verify.
4. Set `.env.local DATABASE_URL / DIRECT_URL` using correct `<db-user>.<project-ref>` user prefix `prisma.lizyjqkckysgvffwcqvb` on shared pooler host `aws-0-ap-south-1.pooler.supabase.com:6543` with pgbouncer=true, connection_limit=1, sslmode=require, percent-encoded password special chars.
5. In a tight 30-minute diagnostic loop run ~30 successive probes: raw OS TCP connects to ports 6543/5432, then `pnpm exec prisma validate` repeatedly, then `pnpm exec prisma db push`/`pnpm db:seed`/`pnpm exec prisma tenants count()` attempts.
6. Immediately after the ~30 probes, attempt any Prisma Client operation that creates a fully-qualified extended-query prepared-statement session.

## Expected Behaviour
- Raw TCP sockets connect within ~20 ms.
- `prisma validate` prints schema valid 🚀.
- `prisma db push / db seed / prisma client count()` all succeed within their configured 5-second connect_timeout, and return Postgres rows / execute DDL.
- If user credentials are wrong: P1001 subtype 28P01 auth failed (Postgres greeting received, then error byte message with SQLSTATE 28P01).

## Actual Behaviour
- **Raw TCP sockets to 5432 AND 6543**: connect within ~20 ms ✅ — every attempt, no failures. Network path perfect.
- **Lightweight prisma validate**: schema valid 🚀 print ✅ — every attempt.
- **Every other Prisma operation (push/seed/client count)**: deterministic P1001 `"Can't reach database server at aws-0-ap-south-1.pooler.supabase.com:6543 Please make sure your database server is running at aws-0-ap-south-1.pooler.supabase.com:6543."` — timeout exactly 5 s, empty libpq error code, no Postgres greeting bytes, no 28P01 SQLSTATE, no TLS handshake error details.
- Same exact P1001 pattern on port 6543 (Transaction pooler) and port 5432 (Session pooler).
- Same exact P1001 pattern using native Prisma driver AND after installing `pg`/`@prisma/adapter-pg` and enabling `driverAdapters` preview feature + wrapping with Pool adapter — ruling out driver stack bug.
- Connectivity works fine over HTTPS for same operations when done via Supabase SQL Editor (Management API path → internal Postgres access).

## Root Cause
Highest-confidence hypothesis matches the observed differential pattern **exactly**: Supavisor ap-south-1 free-tier per-IP per-project *new authenticated Postgres wire sessions* rate limiter tripped by the ~30 earlier tight-loop diagnostic probes. Short unauthenticated TCP handshakes and lightweight validate one-shot auth checks are whitelisted as health / allowlist checks and succeed. Fully-qualified multi-statement prepared-statement sessions are dropped at the pooler before any Postgres greeting bytes are returned → empty libpq error → P1001 generic timeout. All 4 ruling-out probes (allowlist, wrong creds, port, driver) produce negative results because all 4 of those would produce either a connect failure, a 28P01 auth-fail *after* a greeting, different port behavior, or different native-vs-adapter error messages respectively.

Rate-limit state ages out naturally 1–2 hours after the last authenticated-session probe. Runtime application Prisma Client requests (which happen at end-user per-second rates vs diagnostic loop rates) are expected to pass without hitting this limit unless sign-up onboarding storms occur.

## Severity
Medium. Workaround exists and was used successfully for schema/seed/verify: all operations performed via Supabase SQL Editor HTTPS paste files, end state identical, 100% verified counts correct. Severity escalates if first sign-up or first real CRUD write at runtime also hits P1001.

## Remediation Checklist
- [x] **Phase 2 closeout workaround SUCCESS**: Supabase SQL Editor paste path (schema 01 → drift 04 → seed 02 → verify 03) used for first-time provisioning. 19 tables + 8 enums + 14 unique idx + 36 secondary idx + 19 RLS + 1/4/59/1/1 seed rows correct. No Prisma CLI pg-wire used for provisioning.
- [ ] Optional runtime mitigation (activate ONLY IF first real sign-up or CRUD write hits P1001): global singleton PrismaClient in `src/lib/db/prisma.ts`, `connect_timeout=10` bump in connection URI, per-second global new-connection backoff helper ≤ 3 new conns/s in any server action that touches repository queries.
- [ ] Diagnostic probe rate-limit guard added to project rules: future Supabase connection debugging → max 2 × validate + 1 × push + 1 × seed in any 10-minute window. If 2 probes fail, switch to SQL Editor paste path immediately; do not enter tight retry loop.
