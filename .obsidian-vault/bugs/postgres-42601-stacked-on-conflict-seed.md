---
title: Postgres 42601 Parser Error on Stacked INSERT ON CONFLICT Clauses (Seed Idempotency)
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. Design an idempotent seed row for the `public.memberships` table. Primary key `id TEXT` has unique; composite unique `(tenant_id, user_id)` also exists.
2. Write a single INSERT statement with two conflict targets stacked one after another, like:
   ```sql
   INSERT INTO public.memberships (id, tenant_id, user_id, role_id, status, invited_by, joined_at, created_at, updated_at)
   VALUES ('mb_rajesh_admin_0000000000001', 'tn_maharashtra_pharma_0000000000001', 'usr_rajesh_kumar_0000000000001', 'rl_admin_maha_0000000000001', 'active', 'usr_rajesh_kumar_0000000000001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
   ON CONFLICT (id) DO NOTHING
   ON CONFLICT (tenant_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id, status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP;
   ```
3. Paste into Supabase SQL Editor → Run.

## Expected Behaviour
Either:
- Parser accepts stacked ON CONFLICT clauses (naive expectation), inserting the row on fresh DB, doing nothing on id PK hit, updating role_id/status on composite unique hit.
- OR if PostgreSQL standard explicitly forbids stacking, a clean alternative upsert path documented for composite-key + secondary-unique cases in Prisma's upsert-equivalent SQL generation docs.

## Actual Behaviour
- `ERROR:  42601: syntax error at or near "ON" LINE 178: ON CONFLICT (tenant_id, user_id) DO UPDATE` — parser aborts at second ON CONFLICT token; no rows written, no partial effects.
- Stacked ON CONFLICT clauses are syntactically invalid in PostgreSQL Standard regardless of logical intent. Max one `ON CONFLICT ... DO ...` clause per INSERT; no way to add a second.
- This caused 3 successive seed file rewrites (~25 minutes) and user escalated from seed failure to full live-schema drift verify to isolate.

## Root Cause
Misunderstanding of PostgreSQL standard: the ON CONFLICT clause is a single syntactic unit of the INSERT statement; it accepts exactly one conflict target (either PK/unique inference) and at most one DO NOTHING / DO UPDATE branch. No stacking. To upsert against two different unique constraints and apply different behavior on each, you must use alternative idempotency patterns:
1. Pure INSERT-only cases where duplicates should be skipped → CTE `WITH _new AS (INSERT INTO SELECT ... WHERE NOT EXISTS (SELECT 1 FROM table WHERE constraint_keys_match) RETURNING 1) SELECT count(*) FROM _new`. (Note: outer WHERE NOT EXISTS cannot see VALUES column names in some older PG versions → use DO blocks instead.)
2. Upsert cases where the row SHOULD be updated when the secondary unique matches → PL/pgSQL `DO $$ DECLARE vars BEGIN SELECT id INTO var FROM memberships WHERE tenant_id=… AND user_id=… LIMIT 1; IF FOUND THEN UPDATE … ELSE INSERT … END IF; END $$;`.

## Severity
Low. Fixed in the seed SQL file today by full rewrite to 8x plain DO block insert-only patterns (case 2 used solely for memberships). No 42601 errors remain. Filed as a permanent project rule to avoid future 25-minute rewrite cycles.

## Remediation Checklist
- [x] `prisma/02-seed-demo-tenant.sql` fully rewritten: 0 ON CONFLICT clauses anywhere; all inserts are either DO block IF count=0 THEN INSERT VALUES, or membership-specific SELECT-INTO + IF FOUND UPDATE ELSE INSERT pattern.
- [x] All future idempotent SQL scripts (any .sql paste file, any migration up.sql) in the project will use DO block / WHERE NOT EXISTS CTE patterns exclusively. Never stack ON CONFLICT.
- [ ] Optional: add project linting step that runs a simple regex grep `ON CONFLICT.*ON CONFLICT` against .sql files in a CI pre-commit hook to catch regressions automatically.
