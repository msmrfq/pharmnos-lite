---
title: Financial E2E Runtime Role Credential Drift
date: 2026-11-01
time: 03-56-09
status: Open
---

## Steps to Reproduce
1. Start the existing disposable `financial-e2e` PostgreSQL container on loopback `127.0.0.1:55432`.
2. Load local `.env.financial-e2e` variables without recording secret values.
3. Connect with `TEST_DATABASE_URL` as `pharmnos_e2e`; observe success.
4. Connect with `FINANCIAL_E2E_RUNTIME_DATABASE_URL` and its documented runtime password as `pharmnos_e2e_runtime`.
5. Run `node scripts\q10-application-path-validation.cjs`.

## Expected Behaviour
The restricted runtime role authenticates successfully, remains
`LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`, and permits guarded Q10 and
purchase application-path verification.

## Actual Behaviour
The bootstrap role connects successfully. The runtime role has the required
restricted attributes, but authentication fails reproducibly with PostgreSQL
SQLSTATE `28P01`. The corrected Q10 harness reaches Prisma but cannot execute
financial assertions.

## Root Cause
The disposable runtime role predates the current credential source and its
password does not match the configured disposable runtime credential.
`scripts\financial-e2e-provision-local.mjs` creates
`pharmnos_e2e_runtime` only when absent and does not reconcile an existing
role password. The Q10 harness previously ignored the explicit runtime
password source; that separate defect was corrected in
`scripts\q10-application-path-validation.cjs`.

## Resolution Plan
- Establish a fresh authorized disposable initialization attempt with a new
  ephemeral target, or explicitly authorize rotation of this disposable role
  credential.
- Verify runtime identity and restricted attributes.
- Run Q10, purchase restricted-role RLS, security behavior, and rollback
  recovery checks.
- Record sanitized, run-bound evidence and cleanup results.

Do not modify shared or production credentials, weaken RLS, or remove the
connected-initialization safety gate.
