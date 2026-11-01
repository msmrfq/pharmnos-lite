---
title: Authenticated Database Trust Boundary Security Review
date: 2026-11-01
status: Partially remediated
severity: High
---

# Independent Security Review — Authenticated Database Trust Boundary

## Verdict

**FAIL / NO-GO for the stronger authenticated-database trust boundary.**
Conditional pass applies only to the documented server-only web threat model,
with the forged-GUC risk explicitly retained as a HIGH residual finding.

## Review scope

Reviewed the accepted ADR, trust-boundary specification, Supabase
authentication adapter, tenant-context resolver, Prisma pool configuration,
RLS review contract, financial server actions, API routes, raw SQL usage,
focused tests, and restricted-role evidence.

## Findings

### HIGH — Forged transaction-local identity claims

**Status:** FAIL. **Confidence:** 10/10.

`src/lib/db/tenant-context.ts:46-47` establishes RLS identity using mutable
transaction-local GUCs. The restricted runtime role can execute
`pg_catalog.set_config`, and the evidence artifact records successful forged
subject and tenant claims:

`.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json`

The direct probe is implemented in
`scripts/financial-e2e-trust-boundary-audit.mjs:39-58`. A principal with SQL
execution under the runtime role can set a target tenant claim and attempt
tenant-scoped reads. Transaction-local scope prevents pool leakage but does
not authenticate the claim.

**Reproduction:**

```sql
BEGIN;
SELECT set_config('request.jwt.claim.tenant_id', '<target-tenant>', true);
SELECT * FROM public.products;
ROLLBACK;
```

**Required remediation:** Keep the runtime credential server-only and prohibit
arbitrary SQL execution. If arbitrary SQL under this role is in scope, select
and implement a stronger database-verifiable assertion, trusted identity
gateway, or authenticated Supabase Data API boundary. Do not treat this
finding as fixed by transaction-local claims.

### HIGH — Expired or malformed session behavior not independently verified

**Status:** NOT VERIFIED.

`src/adapters/auth/supabase-auth.adapter.ts:148-158` uses the Supabase server
client's `getSession()` path. No independent live expiry/tampering test or
`getUser()` verification evidence was supplied in this review. This is an
evidence gap, not proof of an exploitable bypass.

**Required remediation:** Add a disposable authenticated-session test covering
expired, malformed, and tampered session material, and document whether the
adapter's session verification contract is sufficient for the deployment
threat model.

**Remediation status:** Partially fixed at the source boundary. The adapter
now requires a successful Supabase `getUser()` verification and matching
session/user IDs before accepting identity. Live expired, malformed, tampered,
and revoked-session behavior remains NOT VERIFIED.

### MEDIUM — Deployment secret isolation not independently verified

**Status:** NOT VERIFIED operationally; source review PASS.

`src/lib/db/prisma.ts:24` reads `DATABASE_URL` server-side, and no
`NEXT_PUBLIC_` database credential was found. The only database API route,
`src/app/api/health/db/route.ts:13-21`, accepts a fixed health token and runs
`SELECT 1`; no arbitrary SQL endpoint was found. Deployment configuration and
browser-bundle output were not independently inspected.

**Required remediation:** Verify production build output and deployment
configuration contain no database credentials, service-role key, or arbitrary
SQL interface.

### MEDIUM — RLS review contract contains an undeclared alias

**Status:** NOT VERIFIED.

`prisma/financial-e2e-rls-policies.review.sql:81` references `u.external_id`
without declaring the `u` alias in that displayed predicate. The file is
explicitly review-only, so executable production impact was not established.

**Required remediation:** Correct the review contract alias and rerun its
static/catalog guard before any executable artifact is generated. This report
does not authorize a database change.

**Remediation status:** Fixed as a review-contract defect. The executable
disposable provisioner already used the explicit `public.users AS u` join.
The review contract now matches that join, and the artifact manifest hash was
updated. No production policy was changed.

## Required review questions

| Question | Result |
|---|---|
| Server-only web threat model clearly defined | PASS |
| Arbitrary SQL excluded by application controls | PASS by source review; operational isolation NOT VERIFIED |
| Client input can influence authenticated subject/tenant | PASS for application paths |
| Financial operations covered by RLS | NOT VERIFIED independently for executable production artifacts |
| Claims established before protected queries | PASS for reviewed financial transactions |
| Pool isolation and cross-tenant denial | PASS based on supplied campaign evidence; not rerun independently |
| SQL injection/unsafe raw SQL/exposed credentials | PASS by source review; deployment isolation NOT VERIFIED |
| Forged-GUC risk acceptable within documented model | CONDITIONAL PASS only for server-only web threat model |

## Evidence and limitations

- Restricted-role artifact:
  `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json`
- SHA-256:
  `FE25C097F16E1A95C4C615E4077339A4FD35075CB61ECA5512FD16724B2262C6`
- Runtime role: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`.
- No production or Live Supabase access was used.
- Deployment secret isolation, live session expiry/tampering behavior,
  executable production RLS artifacts, and independent rerun of the database
  campaign were not verified.
- Existing evidence was preserved and no production readiness or GST Stage 1
  closure is claimed.

## Steps to Reproduce

1. Connect to the approved disposable target using the restricted runtime role.
2. Begin a transaction.
3. Execute `set_config` for a forged subject or tenant claim.
4. Query a tenant-scoped table.
5. Roll back and inspect the result and transaction context.

## Expected Behaviour

Only the server-verified authenticated subject and its active membership should
establish authorization in the application threat model. A principal with
arbitrary SQL under the shared runtime role is outside Option A's accepted
scope and requires a stronger architecture.

## Actual Behaviour

The restricted runtime role can set forged transaction-local GUC claims. The
claims are isolated to the transaction but are not cryptographically
authenticated.

## Root Cause

RLS predicates consume caller-settable PostgreSQL GUCs while the shared runtime
role retains `set_config` execution. Option A relies on server-only custody of
that role rather than providing a database-verifiable identity assertion.
