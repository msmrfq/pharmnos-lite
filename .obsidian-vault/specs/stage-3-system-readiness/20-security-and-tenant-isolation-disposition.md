---
title: Pharmnos Lite Stage 3 Security and Tenant Isolation Disposition
date: 2026-11-07
status: UNRESOLVED — independent security review
---

# Verified

- Runtime role was `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`.
- Runtime DELETE privilege was absent.
- Cross-tenant reads and inactive-membership access were denied in the
  target-bound application campaign.
- Transaction-local subject and tenant claims were isolated across concurrent
  runtime connections.
- Unauthorized finalized invoice mutations were rejected.

# Residual blocker

The database RLS design consumes request claim GUCs. A role that can execute
arbitrary SQL can set those GUCs, so cryptographic claim authenticity is not
proven by the application-path evidence. The server-only application boundary
remains the accepted scoped architecture direction, but direct arbitrary SQL
access and stronger signed/per-request identity binding remain unresolved.
This finding is not downgraded or claimed fixed.

## Independent review disposition

The independent security reviewer classified this as **ACCEPTED WITH EVIDENCE
only for the documented server-only application threat model; UNRESOLVED for
unconditional readiness**. A holder of the runtime SQL credential can set the
claim GUCs and forge another tenant's identity. The precondition is runtime
credential compromise, an SQL-capable internal service, or future arbitrary-SQL
exposure. Impact includes cross-tenant reads and tenant-scoped writes.

Compensating controls are server-only database access, `NOSUPERUSER`,
`NOBYPASSRLS`, transaction-local claim setup, server-side `getUser()` identity
verification, and no arbitrary SQL endpoint. These controls do not establish
cryptographic claim authenticity. Evidence: `src/lib/db/tenant-context.ts`,
`src/lib/db/prisma.ts`, `src/adapters/auth/supabase-auth.adapter.ts`, and
`authenticated-database-trust-boundary-evidence-1793519941211.json`.

## Controlled financial-closure re-review

The fresh independent security review returned **REJECT** for unconditional
Stage 3 acceptance, with confidence 9/10. ST3-B remains rejected because a
holder of the runtime SQL credential or an arbitrary-SQL-capable internal
service can set `request.jwt.claim.sub` and `request.jwt.claim.tenant_id`
before querying RLS-protected tables. Server-only access, restricted role
attributes, server-side `getUser()` verification, and cross-tenant denial
reduce exposure but do not make those claim GUCs cryptographically authentic.

The reviewer accepted exact target binding and cleanup as evidenced by
`27-current-source-targeted-runtime-evidence.json` and
`28-current-source-targeted-cleanup-evidence.json`, but confirmed that this
does not close the trust-boundary residual risk or ST3-J.
