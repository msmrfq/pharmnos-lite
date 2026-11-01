---
title: Authenticated Database Trust Boundary
date: 2026-11-01
status: DECISION RECORDED - IMPLEMENTATION AND SECURITY ACCEPTANCE GATED
---

# Authenticated Database Trust Boundary

## Finding

The application verifies the Supabase session in server-side code, resolves
`users.external_id` and an active membership, and uses Prisma transactions.
The database policies consume transaction-local `request.jwt.claim.sub` and
`request.jwt.claim.tenant_id` settings. The restricted PostgreSQL runtime role
can also execute `pg_catalog.set_config`, so arbitrary SQL executed with that
role can substitute those settings. Transaction-local isolation prevents
pool leakage but does not establish authenticity.

This is a HIGH trust-boundary blocker. The 16/16 purchase campaigns prove the
intended server path and RLS behavior, not resistance to arbitrary SQL under
the same database credential.

## Current trust boundaries

1. Supabase Auth verifies the browser session and server cookies.
2. `getServerTenantContext()` resolves the session subject to an internal user
   and exactly one active membership.
3. Prisma uses `DATABASE_URL` and a pooled PostgreSQL connection.
4. Purchase transactions set local subject and tenant claims.
5. RLS evaluates those claims for tenant and subject predicates.

The application server is trusted. The PostgreSQL runtime credential must be
treated as secret and unavailable to browsers and untrusted SQL callers.
The disposable harness deliberately installs a synthetic session and is not
proof that a caller with SQL execution cannot forge claims.

## Options

### Option A — Trusted server-only database boundary (recommended minimum)

Keep Supabase session verification and all database access inside the server
runtime. Do not expose the runtime connection string, Prisma endpoint, or
arbitrary SQL execution to clients. Establish claims only inside server-owned
transactions and retain fail-closed RLS.

This prevents the relevant web threat when the runtime credential is actually
server-only. It does not protect against a compromised application server or
any principal already granted arbitrary SQL under the runtime role. Pool
behavior remains transaction-local. Operational impact is limited to secret
management, network isolation, and an explicit no-arbitrary-SQL contract.

### Option B — Database-verifiable signed assertion

The server would verify the Supabase session and provide a short-lived,
signed assertion to a database boundary that verifies the signature before
deriving identity. The signing key would require ownership, rotation,
provisioning, incident recovery, and deployment controls.

This can resist forged GUC values, but introduces a new secret and verification
component. It is not authorized by the current repository decisions and must
not be added without an ADR and operational key-management plan.

### Option C — Per-request database identity or role

Use a trusted proxy or database gateway that authenticates the request and
binds it to a per-request database principal or server-managed identity.

This gives a stronger database boundary but requires new roles, pooling
semantics, provisioning, rotation, monitoring, and likely migration work. It
is substantially larger than the current MVP architecture.

### Option D — Direct Supabase Auth JWT/RLS boundary

Use Supabase's authenticated Data API/PostgREST path so the platform supplies
the verified JWT context and policies use the platform-authenticated subject.
The server would still retain service-layer transaction logic where needed.

This changes the Prisma/provider-independent persistence path and requires
careful treatment of financial transactions, grants, and connection pooling.
It is not a drop-in replacement for the current purchase workflow.

## Recommendation

Adopt Option A as the minimum accepted boundary for the current architecture:
server-only authenticated access, no client-visible database credentials, no
arbitrary SQL endpoint, and explicit operational controls preventing untrusted
code from using the runtime role. Keep the current RLS and transaction-local
claims as defense in depth, not as proof of JWT authenticity.

The architecture decision record
`.obsidian-vault/decisions/authenticated-database-trust-boundary-ADR-2026-11-01.md`
adopts Option A for the current web threat model: server-only database access,
no client-visible runtime credentials, no arbitrary SQL endpoint, and
transaction-local claims as defense in depth. This is not a claim that GUCs
are cryptographically authenticated.

If arbitrary SQL under the runtime role is in scope, Option A is insufficient
and Option B, C, or D must be selected and designed before security acceptance.

## Required acceptance tests

- Valid Supabase session resolves one active membership.
- Missing, expired, invalid, inactive, or ambiguous identity fails closed.
- Caller tenant and subject fields cannot override the server session.
- Runtime credentials are absent from clients and no arbitrary SQL endpoint
  exists.
- Pooled transactions do not leak local claims after commit or rollback.
- A separately authorized SQL principal cannot impersonate a user; this
  requires the selected stronger boundary if that principal can use the same
  runtime role.

## Current status

The current implementation passes the intended restricted-role purchase
campaign with distinct internal/external IDs and transaction-local isolation.
It does not pass forged-GUC resistance against a principal already able to run
arbitrary SQL under the runtime role. That residual risk is explicitly
accepted only for the scoped server-only threat model; independent security
acceptance, GST Stage 1 closure, and production authorization remain open.

## Option A verification — 2026-11-01 14-13-13 IST

- Server-side identity resolution is implemented in
  `src/adapters/auth/supabase-auth.adapter.ts` and
  `src/lib/db/tenant-context.ts`; the browser does not supply the session
  subject or database credentials.
- Active membership resolution now rejects zero active memberships and more
  than one active membership in both the server resolver and the focused
  financial E2E adapter contract.
- `src/app/api/health/db/route.ts` exposes only an authenticated-by-secret
  `SELECT 1` health probe; no arbitrary SQL input or database execution
  endpoint was found under `src/app/api/`.
- No `$queryRawUnsafe` or `$executeRawUnsafe` usage was found under `src/`.
  Application raw SQL uses Prisma tagged-template parameters or fixed SQL.
- Existing restricted-role evidence remains the runtime proof for role
  attributes and transaction-local forged-GUC behavior:
  `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json`,
  SHA-256
  `FE25C097F16E1A95C4C615E4077339A4FD35075CB61ECA5512FD16724B2262C6`.
- Focused tests passed: **41/41** across authenticated context,
  application-hosted boundary, internal invocation, provisioning, and static
  RLS contracts. TypeScript typecheck and `git diff --check` passed.
- Verification outcome: Option A assumptions are supported for the scoped
  server-only web threat model. The HIGH residual risk remains for arbitrary
  SQL under the runtime role and must not be reported as fixed.
- Session identity verification was hardened to require Supabase `getUser()`
  success and a matching verified/session user ID. Live expiry, malformed,
  tampered, and revoked-session behavior remains unverified.
- The review-only role-permission predicate alias was corrected to match the
  executable provisioner's explicit `public.users AS u` join. The artifact
  manifest was updated; no database was changed.
