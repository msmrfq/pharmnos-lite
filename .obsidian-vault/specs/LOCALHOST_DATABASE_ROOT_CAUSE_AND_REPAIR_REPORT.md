---
title: Localhost Database Root Cause and Repair Report
date: 2026-10-31
status: EVIDENCE-GATED
---

# Localhost Database Root Cause and Repair Report

## Summary

The reported `Database is not configured` message was not evidence that
`DATABASE_URL` was missing. The application had non-empty database and
Supabase configuration, but database-backed pages converted tenant-context
failures into the same generic configuration message.

The active localhost process was left running throughout this investigation.
After the narrow error-classification repair, the affected pages render the
actual authentication requirement. Database records were not claimed as
loaded because no authenticated workspace session was available for the
runtime checks.

## Initial symptoms

The following localhost routes returned HTTP 200 but displayed the generic
database message:

- `/customers`
- `/suppliers`
- `/inventory`
- `/purchases`
- `/billing`

The root route returned HTTP 500 during the initial probe. The database health
route returned HTTP 401 because `DB_HEALTHCHECK_TOKEN` is not configured.

## Baseline and preservation

- Branch: `main`
- HEAD: `1dee2d8046e640cc4e7d1fc1055016adb0890e3c`
- Existing staged and unstaged changes were preserved.
- No reset, checkout, clean, stash, commit, push, migration, database reset,
  or destructive operation was performed.
- The existing port-3000 Node process was not stopped.

## Configuration inspection

`.env.local` exists and contains non-empty entries for:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

No values or credentials are recorded here. No `.env`, development override,
or production override file was present.

Sanitized URL inspection identified:

- `DATABASE_URL`: PostgreSQL Supabase pooler endpoint on port `6543`.
- `DIRECT_URL`: PostgreSQL endpoint on port `5432`.

TCP reachability to both configured endpoints succeeded. This proves network
reachability only; it does not prove authentication, schema availability,
tenant membership, or application query success.

## Root cause

`requireServerTenantContext()` first obtains the Supabase session and then
loads the user’s active tenant membership through Prisma. It can fail because
the request has no authenticated session, the account has no active
membership, or the database operation fails.

The affected page modules caught all such failures and set `dbOk = false`.
Their render path then displayed `Database is not configured`, conflating:

1. Missing database configuration.
2. Missing authentication.
3. Missing tenant membership.
4. Database connectivity, schema, or authorization failures.

The localhost response after the repair contains the accurate message:
`Database is configured, but you must sign in to access workspace data.`
This is consistent with the current unauthenticated browser request and does
not bypass tenant or database guards.

## Technical correction

Added `src/lib/db/database-errors.ts` with a narrow, non-secret error
classification helper. Updated the top-level customer, supplier, inventory,
purchase, and billing pages so that:

- Missing configuration still reports missing configuration.
- Missing authentication reports that sign-in is required.
- Missing tenant membership reports that workspace membership is required.
- Other failures report that workspace data could not be loaded.
- No database query, authorization check, or tenant guard is bypassed.

## Runtime verification

With the existing localhost process still running:

| Route | HTTP result | Observed result |
|---|---:|---|
| `/customers` | 200 | Accurate sign-in requirement |
| `/suppliers` | 200 | Accurate sign-in requirement |
| `/inventory` | 200 | Accurate sign-in requirement |
| `/purchases` | 200 | Accurate sign-in requirement |
| `/billing` | 200 | Accurate sign-in requirement |

Validation commands:

- `pnpm typecheck` — passed.
- `pnpm exec next lint --file ...` for the five affected pages and helper —
  passed with no warnings or errors.
- `git diff --check` — passed.

No authenticated record retrieval, create/update test, `SELECT 1`, migration
inspection, or disposable PostgreSQL runtime test was executed. The configured
hosted endpoint has not been treated as an authorized disposable target, and
the project rollout documentation keeps live Supabase rollout at `NO-GO`.

## Files changed

- `src/lib/db/database-errors.ts`
- `src/app/customers/page.tsx`
- `src/app/suppliers/page.tsx`
- `src/app/inventory/page.tsx`
- `src/app/purchases/page.tsx`
- `src/app/billing/page.tsx`

## Remaining owner/environment dependencies

To complete database runtime verification, the owner must provide or authorize
all of the following without exposing credentials in repository documents:

1. A confirmed non-production or disposable PostgreSQL target.
2. A valid authenticated Supabase user for that target.
3. An active tenant membership and required role/permissions.
4. Authorization to run read-only connectivity and schema checks.
5. If required, a configured `DB_HEALTHCHECK_TOKEN` for the protected health
   route.

Until those dependencies exist, the localhost application is correctly
reporting the authentication/workspace prerequisite, but database-backed
records cannot be claimed as runtime-verified.

## Security and data preservation

No credentials were printed, copied, or committed. No production endpoint was
queried, no migration was executed, no RLS or authorization control was
disabled, and no existing business record was modified or deleted.

## Post-repair independent verification

Verification was performed on 2026-10-31 after the UI and Prisma runtime
repair. No existing Next.js, Prisma, or database-related process was stopped,
killed, restarted, or replaced during this verification pass.

### Repository and process state

- Branch remained `main`.
- HEAD remained `1dee2d8046e640cc4e7d1fc1055016adb0890e3c`.
- Final porcelain status contained 96 staged entries, 10 unstaged entries, and
  5 untracked entries. The pre-existing staged boundary was not staged or
  unstaged by this verification pass; the additional entries are the
  documented repair/report and continuation changes from the earlier work.
- No files were reset, cleaned, stashed, committed, or pushed.
- The running Next process tree remained active on port 3000.
- No PostgreSQL or Prisma database server process was identified.
- `git diff --check` passed.

### Prisma runtime verification

The schema generator uses `prisma-client-js` with the `driverAdapters`
preview feature, and the datasource uses `DATABASE_URL` plus `DIRECT_URL`.
`src/lib/db/prisma.ts` constructs a `pg.Pool`, wraps it in `PrismaPg`, and
passes the adapter to `PrismaClient`.

The normal runtime generation command had already completed successfully:

`pnpm exec prisma generate` — passed; Prisma Client 5.22.0 generated.

The running application no longer reports the prior
`--no-engine`/adapter incompatibility. Database-backed pages load HTTP 200
without a Next.js server error.

For CLI validation, Prisma does not automatically load `.env.local` in the
shell used for the check. Running validation with the existing
`DATABASE_URL` and `DIRECT_URL` values injected only into the child process
produced:

- `pnpm exec prisma validate` — passed.
- `pnpm typecheck` — passed.

No environment value was printed or written.

### Browser UI verification

The following routes were opened in the localhost browser and rendered their
expected public or authenticated application layout:

| Route | Result | Evidence |
|---|---:|---|
| `/` | PASS | Landing layout, navigation, hero, sections, and footer rendered |
| `/auth/sign-in` | PASS | Sign-in form and workspace authentication layout rendered |
| `/customers` | PASS | Authenticated shell, navigation, content area, and accurate sign-in state rendered |
| `/suppliers` | PASS | Authenticated shell, navigation, content area, and accurate sign-in state rendered |
| `/inventory` | PASS | Authenticated shell, navigation, content area, and accurate sign-in state rendered |
| `/purchases` | PASS | Authenticated shell, navigation, content area, and accurate sign-in state rendered |
| `/billing` | PASS | Authenticated shell, navigation, content area, and accurate sign-in state rendered |

The CSS request
`/_next/static/css/app/layout.css` returned HTTP 200. No missing Next CSS
asset or Prisma/Next server error was observed. Browser console output had
one non-functional `GET /favicon.ico` 404 on each route; this did not affect
layout or application behavior.

The database-backed pages displayed:

`Database is configured, but you must sign in to access workspace data.`

This is the correct state for the unauthenticated browser session.

### Authentication and database runtime status

No authorized test account credentials were available in the session, so no
sign-in, session creation, tenant membership resolution, authenticated
Prisma query, `SELECT 1`, migration-state query, or module-level record
retrieval was performed.

The configured PostgreSQL endpoints remain hosted Supabase endpoints. Their
TCP ports were previously reachable, but network reachability is not an
authenticated database session and is not sufficient to authorize querying
the target. Customers, suppliers, inventory, purchases, sales dependencies,
and billing data therefore remain unverified at the database-runtime level.

### Current verdict

**LOCALHOST UI RESTORED — DATABASE RUNTIME NOT VERIFIED**

Files changed by the two repair passes were:

- `src/lib/db/database-errors.ts`
- `src/app/customers/page.tsx`
- `src/app/suppliers/page.tsx`
- `src/app/inventory/page.tsx`
- `src/app/purchases/page.tsx`
- `src/app/billing/page.tsx`
- `.obsidian-vault/specs/LOCALHOST_DATABASE_ROOT_CAUSE_AND_REPAIR_REPORT.md`

No tracked generated Prisma or Next CSS artifact was intentionally edited.
The normal Prisma generation refreshed ignored/generated client output only.

Required owner actions before database-runtime completion:

1. Provide or authorize a confirmed non-production/disposable PostgreSQL
   target.
2. Provide an authorized test account for that target.
3. Ensure that account has an active tenant membership and required
   permissions.
4. Authorize read-only connectivity, schema, migration-state, and
   module-level data-loading checks.
