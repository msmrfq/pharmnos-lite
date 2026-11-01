---
title: Authenticated Database Trust Boundary
date: 2026-11-01
status: Accepted with residual risk
accepted: 2026-11-01
---

## Context

The application verifies Supabase sessions in server-side code, resolves the
authenticated subject through `users.external_id` to an internal user and one
active membership, and performs financial work through Prisma transactions.
The transaction establishes `request.jwt.claim.sub` and
`request.jwt.claim.tenant_id` with `set_config(..., true)`, after which
PostgreSQL RLS evaluates tenant and subject predicates.

The restricted runtime role is deliberately `LOGIN`, `NOSUPERUSER`, and
`NOBYPASSRLS`, but it can execute PostgreSQL's `pg_catalog.set_config`.
Restricted-role evidence reproduced setting forged transaction-local claims.
This proves that GUC values are not cryptographic proof of identity. It does
not prove that ordinary browser users can execute arbitrary SQL: the current
application exposes no database credential or arbitrary SQL endpoint to them.

This decision separates the intended web threat model from a stronger threat
model in which an attacker, SQL injection, compromised server component, or
direct credential holder can execute arbitrary SQL under the runtime role.

## Threat model

### Protected scenarios

- Normal authenticated requests enter through the server-side Supabase Auth
  adapter; the browser does not choose the server session subject.
- Malicious user-controlled fields cannot override the resolved tenant:
  the application boundary rejects a requested tenant override, and purchase
  actions use the resolved `TenantContext`.
- Missing, invalid, inactive, or ambiguous membership fails closed.
- Tenant-scoped writes and reads are additionally constrained by forced RLS,
  tenant predicates, grants, and transaction-local claim scope.
- Pool reuse does not retain transaction-local claims after commit or rollback;
  this is covered by the restricted purchase acceptance campaign.

### Not protected by Option A

- A principal that already has arbitrary SQL execution under the same runtime
  credential can set the request GUCs and attempt to act on those claims.
- A compromised application server can use its server credentials and invoke
  trusted code or issue SQL.
- Direct database access with the runtime credential is outside the web
  authentication boundary.

SQL injection is not assumed to be possible for ordinary users merely because
the role can call `set_config`; it remains a separate application security
threat that must be prevented by parameterized queries, input validation, and
no arbitrary SQL endpoint. Conversely, server-side session verification does
not neutralize a successful SQL injection.

## Existing architecture evidence

- Server session resolution and the guarded disposable test session are in
  `src/adapters/auth/supabase-auth.adapter.ts`.
- `getServerTenantContext()` resolves the session subject by
  `users.external_id`, requires exactly one active membership, and derives
  roles and permissions in `src/lib/db/tenant-context.ts`.
- `establishTenantContext()` sets claims transaction-locally in
  `src/lib/db/tenant-context.ts`.
- Prisma creates a PostgreSQL pool with a maximum of 10 connections in
  `src/lib/db/prisma.ts`; financial actions establish claims inside their
  transaction before tenant-scoped operations.
- The RLS contract requires forced RLS and fail-closed claim predicates in
  `prisma/financial-e2e-rls-policies.review.sql`.
- The application boundary rejects caller-supplied tenant overrides in
  `tests/financial-e2e-app-hosted-boundary.test.mjs`.
- Restricted-role runtime evidence is recorded in
  `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json`.

The former `public.authenticated_subject_user_id()` SECURITY DEFINER helper is
not part of the current design. It was removed because it introduced
privileged ownership, public-schema execution, search-path, and forced-RLS
risks without making caller-controlled GUCs authentic.

## Options considered

### Option A — Trusted server-side identity establishment

Keep Supabase session verification, membership resolution, and all database
access inside the server runtime. Keep the runtime credential secret,
maintain no arbitrary SQL endpoint, establish claims only in server-owned
transactions, and retain fail-closed RLS.

This is the smallest change and is compatible with Prisma pooling and the
provider-independent service boundary. It mitigates browser attacks,
caller-controlled request fields, cross-tenant access, and pool leakage. It
does not mitigate arbitrary SQL under the runtime role or a compromised
application server. Operational cost is limited to secret handling, network
isolation, code review, parameterized SQL, and explicit runtime-role
restrictions. Recovery is ordinary credential rotation and application
rollback.

### Option B — Database-verifiable signed identity assertions

A trusted authentication component would sign a short-lived assertion and a
database boundary would verify it before deriving identity. This can prevent a
caller with only GUC-setting ability from inventing another subject, but it
requires a protected verification mechanism and a signing-key lifecycle:
ownership, rotation, expiry, revocation, deployment, compromise response, and
recovery. It adds a new cryptographic secret and database verification path,
and is not justified for the current web-only threat model without an
owner-approved key-management design.

### Option C — Stronger database role or credential separation

A trusted gateway could bind each request to a server-managed database
principal or identity. This can narrow the impact of a compromised shared
runtime credential, but role-per-user would be operationally unmanageable.
A small set of service roles or a gateway still requires pooling, tenant
switching, rotation, monitoring, provisioning, and recovery design. It is
larger than the current MVP boundary and does not automatically solve
compromise of the gateway itself.

### Existing Supabase-supported mechanism

Supabase Auth plus the authenticated Data API/PostgREST path can provide
platform-managed JWT context for RLS. It is not a drop-in replacement for the
current Prisma financial workflow: the repository uses provider-independent
repositories and transaction-led posting, so adopting this path would require
redesigning grants, transaction boundaries, and financial mutation handling.
The service-role path is not an identity boundary and must not be exposed to
clients.

## Decision

Adopt **Option A — Trusted server-side identity establishment** for the
current application and intended web threat model.

This is safer than the alternatives for the current scope because it preserves
the existing verified-session path, active-membership checks, forced RLS,
restricted runtime role, and transaction-local pooling behavior without
introducing an unowned signing key or a role/gateway migration. The application
must treat database credentials as server-only secrets and must not expose an
arbitrary SQL path.

This decision does **not** claim forged-GUC resistance against arbitrary SQL
under the runtime role. That is a residual risk and an explicit approval gate.
If the owner includes that principal in the required threat model, Option A is
insufficient and a new ADR must select and design Option B, C, or the
authenticated Supabase Data API path before security acceptance.

## Security guarantees

Under the Option A assumptions, the system provides:

1. Server-verified subject-to-internal-user resolution through
   `external_id`.
2. Active, unique membership enforcement with fail-closed missing and
   ambiguous cases.
3. Caller tenant-override rejection at the application boundary.
4. Tenant-scoped forced RLS for the restricted runtime role.
5. Transaction-local claims that do not leak across pooled transactions.
6. No authorization dependency on the removed SECURITY DEFINER helper.
7. Atomic financial operations within the existing Prisma transaction
   boundaries.

## Residual risks

- The restricted runtime role can set request claim GUCs. Evidence classifies
  this as a HIGH residual trust-boundary finding, not as ordinary-user
  impersonation evidence.
- A compromised server or leaked runtime credential can bypass the intended
  application authentication boundary by issuing SQL.
- The synthetic financial E2E session is target-guarded test infrastructure,
  not proof of Supabase JWT cryptographic authenticity.
- RLS and application-path acceptance do not replace independent security
  review, production migration approval, or professional GST approval.

## Required implementation work

- Keep all database credentials out of browser bundles and client-visible
  responses.
- Keep the runtime role restricted and prohibit arbitrary SQL endpoints.
- Preserve parameterized Prisma queries and review every raw SQL path.
- Preserve server-side session verification and membership resolution.
- Preserve transaction-local claim setup and rollback/pool-isolation tests.
- If the stronger arbitrary-SQL threat model is adopted, stop before
  implementation and create a new approved design for signed assertions,
  gateway identity, or authenticated Data API access.

## Required adversarial tests

- Valid, missing, expired, malformed, inactive, and ambiguous identity paths.
- Distinct `users.id` and `users.external_id` mapping.
- Caller tenant override and forged request-field rejection.
- Cross-tenant reads and writes with no persisted unauthorized effects.
- Transaction-local claim isolation across pooled connections, commit, and
  rollback.
- Runtime role attributes, grants, forced RLS, and absence of public helper
  execution.
- A separately labeled forged-GUC probe showing the residual risk; it must
  not be reported as a passing authentication test.
- Source-bound evidence and independent disposable-target cleanup.

## Migration and operational implications

No schema, credential, role, production, or Live Supabase change is authorized
by this ADR. The current implementation remains additive and compatible with
the existing disposable provisioning contract. Deployment operations must
ensure that only trusted server processes can reach the runtime database
credential. Credential rotation must be handled through the existing secret
management process without copying secrets into vault documentation.

## Explicit approval gates

- Owner approval is required before selecting a stronger boundary for the
  arbitrary-SQL threat model.
- Independent security review remains required; this ADR is not a security
  approval.
- Connected initialization, migration, historical backfill, production
  deployment, and Live Supabase operations remain separately gated.
- GST Stage 1 remains **IN PROGRESS** and production remains **NO-GO**.

## Consequences

The current web architecture has a clear, minimal trust boundary and avoids
an unnecessary cryptographic or role-per-user system. The tradeoff is an
explicit residual risk: database-level impersonation by a principal already
holding arbitrary SQL capability is not solved by transaction-local GUCs.
