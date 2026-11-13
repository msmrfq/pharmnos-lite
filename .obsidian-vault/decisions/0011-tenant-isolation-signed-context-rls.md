---
title: Tenant Isolation Architecture — Signed-Context Direct-Path RLS
date: 2026-11-13
status: Accepted
---

## Context

The Core Runtime Integrity investigation found three coexisting tenant-isolation
conventions: (1) a single migration-level RLS policy on `purchase_supplier_documents`
(0020, using `request.jwt.claim.tenant_id`), (2) JWT-based policies in
`prisma/05-rls-tenant-policies.sql` for the PostgREST gateway, and (3) the HMAC-signed
`pharmnos.auth_context` mechanism — which existed **only** inside the disposable E2E
provisioner (`scripts/financial-e2e-provision-local.mjs`) and was therefore not a
deployable production artifact. Twelve tenant-owned tables (including the core
financial reconciliation tables) had no hosted policy at all, and no hosted artifact
used `FORCE ROW LEVEL SECURITY`.

The application's direct data path connects through a `pg` pool
(`src/lib/db/prisma.ts`) and already establishes a transaction-local
`pharmnos.auth_context` GUC via `establishTenantContext()`
(`src/lib/db/tenant-context.ts:45-56`), signed with HMAC-SHA256 and a 60-second TTL
(`src/lib/db/financial-auth-context.ts`). That signed-context path is the mechanism
the application actually uses; it simply had no database side outside the test harness.

## Decision

Adopt a single authoritative direct-path architecture:

- **Tenant identity source:** Supabase Auth subject → exactly one active membership
  (`getServerTenantContext`). Permissions are derived from the membership's role.
- **Database context:** the HMAC-signed, 60-second, transaction-local
  `pharmnos.auth_context` GUC. Missing, expired, malformed, or wrongly-signed context
  returns no rows and therefore **denies** (fail closed).
- **Database enforcement:** `prisma/09-signed-context-tenant-isolation.sql` — an
  idempotent, deployable module that installs `pharmnos_private.auth_context_keys`
  and `auth_context_replays`, the `verify_auth_context()` and
  `financial_context_subject/tenant_id/is_admin()` SECURITY DEFINER functions, and
  `ENABLE` + `FORCE ROW LEVEL SECURITY` with signed-context policies on **all 39**
  tenant-scoped tables. Immutable tables and `audit_logs` receive no UPDATE policy.
- **Runtime role:** the application must connect as a **non-superuser,
  `NOBYPASSRLS`** role for `FORCE RLS` to bind. `postgres`/superuser connections bypass
  RLS by PostgreSQL semantics; this is a deployment requirement, not something a
  per-database migration can impose (roles are cluster-global).
- **Signing secret provisioning:** the operator inserts the value equal to
  `DATABASE_AUTH_CONTEXT_SIGNING_SECRET` into `pharmnos_private.auth_context_keys`
  at deploy time. The module deliberately commits no secret.

The JWT policy set in `prisma/05-rls-tenant-policies.sql` is **retained** as a separate
trust boundary for the PostgREST authenticated gateway. It is not the direct-path
mechanism and was not exercised in this campaign. Both policy sets are PERMISSIVE and
OR together, so neither blocks the other's role.

## Deployment and provisioning sequence

1. `prisma migrate deploy` (migrations `0001`–`0031`).
2. Hosted schema/RLS SQL (`01`, `04`, `02`, `03` per ADR 0001) for Supabase.
3. `09-signed-context-tenant-isolation.sql` (this module).
4. Create the restricted runtime role with `LOGIN NOSUPERUSER NOBYPASSRLS` and table
   grants, and provision the signing secret.
5. Configure the application `DATABASE_URL` to connect as that restricted role.

## Consequences

- Database-level tenant isolation now exists for every tenant-scoped table and is
  deployable, rather than being confined to the disposable E2E provisioner.
- **Prerequisite for switching to the restricted role:** every application read path
  (React Server Component → repository → `prisma` singleton) must establish the
  context before it can read, because these paths currently do not open a transaction
  or set the GUC. Until that per-request context establishment is implemented, the
  application continues to connect as a superuser role and relies on application-level
  `tenant_id` scoping — the current production posture. This switch is tracked as a
  remaining prerequisite, not silently assumed.
- The disposable E2E provisioner remains the test-only installer; it is not promoted
  into production, and the deployable module is the single source of truth for the
  direct-path policy set.

## Evidence

- `src/lib/db/financial-auth-context.ts` — context format, TTL, HMAC, timingSafeEqual.
- `src/lib/db/tenant-context.ts:45-56,66-139` — context establishment and membership
  resolution.
- `prisma/09-signed-context-tenant-isolation.sql` — this module.
- `scripts/financial-e2e-provision-local.mjs:284-402` — the reference implementation
  this module generalizes from.
