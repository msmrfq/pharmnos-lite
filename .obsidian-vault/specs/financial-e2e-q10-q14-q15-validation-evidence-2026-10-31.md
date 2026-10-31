---
title: Q-10, Q-14, Q-15 Isolated Validation Evidence
date: 2026-10-31
status: PASS for disposable local validation target; production readiness not established
---

## Goal

## Acceptance Criteria

## Out of Scope

# Q-10, Q-14, Q-15 Isolated Validation Evidence

**Date:** 2026-10-31 (IST)  
**Scope:** Disposable local PostgreSQL 17 validation only  
**Production/staging access:** None  
**Owner authorization:** Masum Rafique granted authorization for the complete
documented GST Modernization scope on 2026-10-31 (IST), including associated
validation work. This evidence remains limited to the disposable target and
does not establish production readiness, migration execution approval,
independent security approval, or release approval.

## Target and package

- Service: `financial-e2e-postgres`
- Binding: loopback `127.0.0.1:55432`
- Database: `pharmnos_financial_e2e`
- Storage: Compose `tmpfs`
- Bootstrap role: `pharmnos_e2e`
- Runtime role: `pharmnos_e2e_runtime`
- Admin role: `pharmnos_e2e_admin`
- Validation role: `pharmnos_e2e_validation`
- Runtime attributes: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`
- Provisioning result: `PASS`

## SEC-DEC-03 fresh runtime validation

The expanded role-based validator passed against the separately identified
run-owned database `pharmnos_financial_e2e_sec03_1793461994253b` on the local
loopback PostgreSQL service. The actual roles were `pharmnos_e2e`,
`pharmnos_e2e_runtime`, `pharmnos_e2e_admin`, and
`pharmnos_e2e_validation`.

Passed checks included:

- Bootstrap had no admin or validation membership.
- Runtime was `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, and did not own governed tables.
- Governed tables had enabled and forced RLS; catalog/reference tables excluded
  from tenant governance remained inaccessible to runtime.
- Public application routines had no SECURITY DEFINER ownership and no PUBLIC
  EXECUTE.
- Same-tenant SELECT, INSERT, and UPDATE succeeded.
- Cross-tenant SELECT and UPDATE were filtered; cross-tenant INSERT and DELETE
  were rejected.
- Missing and invalid tenant context returned no rows.
- Runtime DDL and the privileged Q14 routine were rejected.

The runtime role has no DELETE grant by design, so an authorized same-tenant
DELETE is not an applicable positive operation; the negative DELETE boundary
was verified. Direct PostgreSQL validation sets the transaction/session GUC
itself and therefore does not prove cryptographic binding to an application
identity. Application-authenticated tenant resolution remains a separate
boundary and still requires its own runtime evidence. Independent security
approval and production authorization remain open.

### Credential-isolation correction

The original validator changed the password of the shared
`pharmnos_e2e_runtime` role before connecting. That path is no longer
acceptable because PostgreSQL roles are cluster-global and the configured
credential became inconsistent. The validator now creates run-specific
`LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS` roles that inherit only the approved
disposable bootstrap/runtime/admin/validation role capabilities, uses random
in-memory credentials, and drops only those run-specific roles during cleanup.
It does not alter any shared role password. The prior runtime result must not
be treated as evidence for this corrected credential path until the owner
authorizes a fresh isolated-role execution. The owner authorized
`pharmnos_financial_e2e_sec03_1793461994253b`; the corrected validator passed
all recorded scenarios on run `sec03-1793462674375` and cleaned its run-specific
roles and fixtures.
- Static artifact guard: `PASS`
- Applied controls: 27 RLS tables, 74 policies, operation-state guard, restricted operation column updates, zero runtime DELETE privileges

## Q-10 result: PASS

Latest retained application-path output: `q10-application-final.txt`, exit code
0. The run invoked the real action through the restricted runtime connection.

Corrective runs `q10-q14-1793421457888` and
`q10-application-path-validation.cjs` passed:

- The real `finalizeSalesInvoiceAction` was invoked with a mocked authenticated
  tenant context against the restricted runtime database connection.
- Missing, empty, malformed, and short keys were rejected by the application
  action; the billing caller now supplies a unique valid key.
- First request committed.
- Exact replay returned the original result.
- Application-path replay produced one durable operation, one stock movement,
  one ledger entry, and a finalized invoice.
- Same-key different-payload request was rejected.
- Client response loss after commit was recoverable by replay lookup.
- Failure before commit rolled back operation, stock movement, and invoice state.
- Concurrent identical requests produced one commit and one conflict, with one operation and one set of financial effects.
- Concurrent conflicting requests produced one commit and one conflict.
- Concurrent requests are serialized by a transaction-scoped advisory lock;
  no Prisma unique-constraint diagnostic or unhandled race error was emitted.
- An explicit two-client barrier demonstrated overlap in the SQL regression
  cases; concurrent application calls produced one commit and one deterministic
  conflict-shaped response.
- Tenant-scoped operation visibility was enforced.

## Q-14 result: PASS

Latest retained ordinary-login output: `q14-ordinary-login-final.txt`,
run `q14-1793447733823`, exit code 0. Admin and validation used separate
ordinary `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS` connections; maintenance denial
used the runtime connection. The target database contained existing synthetic
finalized invoices, and the finalized-target rejection plus before/after
invoice, item, and audit snapshots passed.

The output also records authenticated identity, effective role attributes, and
effective table/function grant counts for bootstrap, runtime, admin, and
validation connections. Bootstrap is explicitly marked superuser/BYPASSRLS and
was used only for fixture/catalog verification; the tested control operations
used ordinary runtime, admin, and validation logins.

Corrective run `q10-q14-1793421457888` passed:

- Four-role catalog presence and runtime `LOGIN`/`NOSUPERUSER`/`NOBYPASSRLS`
  checks.
- Effective runtime column grant, schema, function, sequence, membership, and
  PUBLIC privilege checks.
- Runtime identity and `NOSUPERUSER`/`NOBYPASSRLS` verification.
- Missing and invalid tenant context denial.
- Public schema access denial.
- Tenant A cross-tenant read and write denial.
- Runtime DDL denial.
- Pooled-session context reset without tenant leakage.
- Finalized invoice mutation denial.
- Tenant isolation of operation records.

The runtime role, RLS, ACL, pooled-session, operation-state, and immutable-history
checks passed. Dedicated run `q14-1793428169511` then passed both remaining
security decisions through the actual role-bound database functions:

- SEC-DEC-01 authorized allowlisted maintenance passed; unauthorized, protected,
  and unknown trigger attempts were denied.
- Simulated operation failure and simulated restoration failure both attempted
  restoration and returned recovered/fail-closed results.
- Independent verification confirmed the eligible trigger and protected trigger
  were enabled after every scenario; the catalog contained one eligible and
  eleven excluded triggers.
- SEC-DEC-02 passed separate runtime request, admin approval, and validation
  execution with same-actor, unauthorized-role, duplicate, cross-tenant,
  finalized-history, and expired-request denials.
- The valid soft-delete changed only the supported `is_active` lifecycle field.
  Rejected and expired operations left the target active, and request/approval/
  execution/denial audit records were retained.

The dedicated output is retained from `node scripts/q14-security-controls-validation.mjs`;
the broader `q10-q14-1793428172549` regression also passed. This establishes
Q-14 for the disposable local validation target only; it does not authorize
production rollout.

## Q-15 result: PASS — SCOPED RUNTIME VERIFIED

Latest independent recovery rerun `q15-1793461099812` passed:

- Fresh Prisma baseline migration.
- Repeated migration invocation with no duplicate application.
- Conflicting catalog object stopped migration.
- Partial-failure state was limited to the Prisma ledger with an unfinished
  failed row and no application tables.
- Explicit `prisma migrate resolve --rolled-back 0001_baseline` cleared the
  failed migration state.
- Recovery retry reapplied all six migrations successfully with no unfinished
  migration rows.

Backup/restore also passed twice:

- Backup format: plain SQL from `pg_dump`, with privileges retained.
- Backup checksum, backup SQL, and raw command output are retained in
  `q15-1793461099812-backup.sql` and
  `q15-1793461099812-raw-output.txt`.
- Every non-Prisma public table was compared using deterministic row counts and
  canonical row checksums against both independent restores. Catalog evidence
  compared tables, RLS/FORCE RLS, constraints and definitions, indexes,
  policies, triggers, grants, and Q-15 role attributes.
- Restore comparison output is retained in
  `q15-1793461099812-restore-comparison.json`.

This is scoped disposable PostgreSQL evidence only. Independent migration and
recovery review, production migration approval, and production rollout remain
open.

The disposable databases and validation environment remain retained pending
owner review and separately authorized destruction.
