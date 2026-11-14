---
title: RLS Runtime Provisioning Runbook (Direct Prisma Path)
date: 2026-11-14
status: Runbook — execution blocked by read-path prerequisite
---

# RLS Runtime Provisioning Runbook (Direct Prisma Path)

## Goal

Deploy the signed-context tenant-isolation module and a restricted runtime role
to an authorized PostgreSQL target, idempotently, with explicit verification and
rollback. This runbook is a procedure, not an executed result.

## Critical prerequisite — do not skip

**Do not point the application at the restricted runtime role until every read
path establishes a tenant context.**

The read-path audit found that RSC loaders, report loaders, dashboard queries,
print views, and exports call repositories without a transaction-scoped
`pharmnos.auth_context`. Under the restricted role, those queries return zero
rows (fail closed). Under the current privileged role, RLS does not bind at all.
Cutting over the role without fixing read paths would produce empty screens and
reports while appearing to "enable security."

The prerequisite is a request-scoped transaction (or equivalent data-layer)
design that calls `establishTenantContext` for every query. It requires
architecture approval and is not implemented by this campaign.

## Authorized preconditions

- [ ] An explicitly authorized target is identified by host, port, database,
      and run id. Never use production or a shared database for a rehearsal.
- [ ] The target is empty or its contents are disposable.
- [ ] `DATABASE_AUTH_CONTEXT_SIGNING_SECRET` is generated (at least 32
      characters) and stored only in the operator secret store / process
      environment.
- [ ] A distinct non-superuser runtime role name is chosen for production
      (the `pharmnos_e2e_runtime` name in `scripts/setup-runtime-role.sql` is a
      disposable-verification example).
- [ ] A rollback connection using the existing privileged role is available.

No credential value may be written into a script, SQL file, shell history,
report, or evidence artifact.

## Deployment sequence

All steps are idempotent or safe to re-run. Preserve the order.

### 1. Apply schema migrations

```bash
pnpm exec prisma migrate deploy
```

Do not use `prisma migrate dev` or `prisma db push`. The `(tenant_id,
invoice_no)` uniqueness is a partial index created by migration 0031; Prisma
cannot express it, and schema-push tooling can replace it with a full index.

Expected: 31 migrations applied, `prisma migrate status` reports up to date.

### 2. Apply the signed-context RLS module

```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f prisma/09-signed-context-tenant-isolation.sql
```

The module is idempotent: it creates the private schema and tables if absent,
recreates policies, and re-enables and forces RLS.

Expected: 39 tenant-scoped tables with `ENABLE` + `FORCE` RLS and
`signed_ctx_select`; audit/immutable tables have no update policy; catalog
tables are select-only.

### 3. Create or update the restricted runtime role

Use `scripts/setup-runtime-role.sql` as the template, replacing the role name
for production. It performs an idempotent create-or-alter and takes the password
as a psql variable:

```bash
psql "$DIRECT_URL" \
  -v runtime_password="$RUNTIME_DB_PASSWORD" \
  -v signing_secret="$DATABASE_AUTH_CONTEXT_SIGNING_SECRET" \
  -v ON_ERROR_STOP=1 \
  -f scripts/setup-runtime-role.sql
```

Required role attributes:

- `LOGIN`
- `NOSUPERUSER`
- `NOBYPASSRLS`
- no `CREATEDB`, no `CREATEROLE`
- no ownership of tenant tables

Required privileges:

- `USAGE` on schema `public`
- `SELECT, INSERT, UPDATE` on all tables in `public` (no `DELETE`)
- `USAGE, SELECT, UPDATE` on all sequences in `public`
- no access to `pharmnos_private.auth_context_keys` or
  `pharmnos_private.auth_context_replays`
- no direct `EXECUTE` on `pharmnos_private.verify_auth_context`; only the
  public `financial_context_*` wrappers

If a grant is missing after a future migration, add it explicitly. Do not grant
`ALL PRIVILEGES` or `BYPASSRLS` to compensate.

### 4. Align the signing secret

The application signs contexts with
`DATABASE_AUTH_CONTEXT_SIGNING_SECRET`. The database verifies them with
`pharmnos_private.auth_context_keys.signing_secret`. The two values must be the
same, or every request fails closed.

- Load the secret into the application environment.
- Insert/rotate the matching row through the psql-variable path.
- Never commit either copy.

### 5. Reconnect with the restricted role

Point the application `DATABASE_URL` (and `DIRECT_URL` for migrations, if
separate) at the restricted role only after read paths are fixed. Keep the
privileged role available for migration and rollback.

### 6. Verification queries

Run these as the restricted role. They are read-only.

```sql
-- Role attributes: expect nosuperuser = true, nobypassrls = true
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = current_user;

-- Tenant tables with RLS forced
SELECT count(*) AS forced_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND c.relforcerowsecurity;

-- Policies per protected table
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Least privilege: DELETE must be false for tenant tables
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = current_user
  AND privilege_type = 'DELETE'
ORDER BY table_name;

-- Fail-closed proof: without establishTenantContext, expect zero rows
SELECT count(*) FROM public.customers;

-- Same-tenant proof: inside a transaction that calls
-- establishTenantContext(), expect only this tenant's rows
BEGIN;
SELECT set_config(
  'pharmnos.auth_context',
  '<signed context produced by the application helper>',
  true
);
SELECT count(*) FROM public.customers;
COMMIT;
```

Expected: role is non-superuser and NOBYPASSRLS; forced-table count matches the
deployed tenant-table count; no `DELETE` privilege; uncontextualized reads
return zero; contextualized reads return only the bound tenant.

Never paste a real signed context or secret into a saved file. Use the
application helper or a disposable run-scoped value.

### 7. Application checks

- Sign in as a tenant A user; confirm dashboard, product/customer/supplier
  lists, billing, purchase, inventory, reports, print views, and exports return
  tenant A data only.
- Sign in as a tenant B user; confirm no tenant A row is visible.
- Attempt a cross-tenant id lookup; expect not-found/denied, not data.
- Confirm a missing or expired context fails closed.

## Rollback

Rollback is configuration-only and does not modify data:

1. Restore the previous `DATABASE_URL` / `DIRECT_URL`.
2. Restart the application.
3. Keep the RLS module installed; it is inert for a superuser/BYPASSRLS role.
4. Do not drop policies or disable RLS as a "fix". That silently removes tenant
   isolation.

If the restricted role itself must be retired:

```sql
ALTER ROLE <runtime_role> NOLOGIN;
```

Then revoke grants after confirming no session is using it.

## Failure behavior

| Failure | Expected behavior |
|---|---|
| Signing secret missing or shorter than 32 characters | Application throws before opening a transaction. |
| Context missing, malformed, expired, wrong signature, or replayed nonce | Policy predicate false; zero rows; statement denied. |
| Runtime role is superuser or `BYPASSRLS` | RLS does not bind; deployment is invalid and must be rejected. |
| A tenant table lacks `FORCE RLS` | Isolation is incomplete; deployment must fail verification. |
| Read path lacks context | Zero rows. This is correct fail-closed behavior and a product defect until fixed. |
| Migration adds a table without policies | Unprotected table; verification must fail and block cutover. |

## Current status

| Item | Status |
|---|---|
| `09-signed-context-tenant-isolation.sql` present and idempotent | Yes |
| Restricted-role template present | Yes (disposable naming) |
| Runtime role provisioning automated for production | **No** |
| Signing-secret provisioning automated | **No — manual operator step** |
| Read paths establish context | **No — release blocker** |
| Runbook executed against an authorized target | **No — no Docker daemon, no authorized target** |

## Evidence from the prior runtime campaign

The 2026-11-14 disposable PostgreSQL campaign applied the module and proved
39 tables with forced RLS, 103 policies, restricted-role fail-closed behavior,
and cross-tenant isolation (cases `ENV-02`, `ENV-03`, `AC-01`..`AC-15`,
`APP-01`..`APP-07`). That evidence validates the module, not this deployment
procedure on a production topology. It also proves the read-path gap: `APP-03`
returns zero rows without context.

## References

- `decisions/0011-tenant-isolation-signed-context-rls.md`
- `bugs/authenticated-database-trust-boundary-security-review-2026-11-01.md`
- `prisma/09-signed-context-tenant-isolation.sql`
- `scripts/setup-runtime-role.sql`
- `src/lib/db/tenant-context.ts`
- `specs/evidence/postgres-runtime-verification-2026-11-14.json`
