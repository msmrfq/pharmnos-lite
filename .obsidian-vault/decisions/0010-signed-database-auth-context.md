---
title: Signed database authentication context
date: 2026-11-05
status: Accepted
---

## Context
Direct Prisma connections establish tenant context with transaction-local
`request.jwt.claim.*` GUCs. Those values are caller-settable by any holder of
the runtime SQL credential, so RLS could be made to evaluate as another user or
tenant.

## Decision
Use one short-lived HMAC-signed `pharmnos.auth_context` value for direct
application and disposable-runtime connections. The application authenticates
the user through Supabase and signs the subject, tenant, version, and expiry.
PostgreSQL verifies the value in a bootstrap-owned `SECURITY DEFINER` function
using a key stored in a private schema. RLS policies call only the public
verification wrappers; they do not read raw identity GUCs. The runtime role
cannot read the key, execute the verifier directly, or modify the protected
schema and functions. Missing, malformed, expired, or forged contexts return
no identity and fail closed.

Each context also carries a random nonce. A bootstrap-owned replay table binds
that nonce to the first PostgreSQL transaction that presents it; committed
reuse in another transaction is rejected. Reuse within the original
transaction is allowed because policy evaluation invokes the verification
wrappers multiple times.

Supabase/PostgREST JWT verification remains the identity boundary for hosted
API requests. Per-tenant database roles and database-side JWT verification are
rejected as operationally unsafe or incompatible with direct Prisma pooling.

## Consequences
The signing secret must be supplied to both the application and authorized
disposable provisioning through `DATABASE_AUTH_CONTEXT_SIGNING_SECRET`; it is
never logged or included in evidence. Key rotation requires a reviewed
provisioning change. Context lifetime is limited to 60 seconds, and committed
replay is rejected by transaction binding. The transaction-local setting
prevents connection-pool leakage. Existing
server-side tenant membership and permission checks remain required.
