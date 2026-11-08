---
title: Pharmnos Lite Stage 3 Disposable Database Migration Verification
date: 2026-11-07
status: PASS — current-source disposable verification; candidate remains unapplied elsewhere
---

# Result

The corrected application-path provisioning artifact installed the schema on
the exact contract-bound target `stage3_closure_19f19a43bd`, database
`pharmnos_financial_e2e_19f19a43bd`, loopback port `55526`, with schema artifact
hash `40e3c0efd19fcd01e6b813ca37bf0c95899255fa8e00d0977a1ab27758ced168`.
The target was selected by its immutable contract, not by port or container
convenience.

## Behavioral checks

- Finalized purchase parent deletion: rejected with SQLSTATE `42501`.
- Finalized purchase item deletion: rejected with SQLSTATE `42501`.
- Finalized parent/item readback: both records remained unchanged after the
  rejected operations.
- Bare draft parent deletion with an item: succeeded and cascaded the item;
  before readback was `parent=1,item=1`, after readback was `parent=0,item=0`.
- Evidence-bearing drafts remain intentionally restricted by
  `purchase_gst_evidence_purchase_fkey` (`23503`); this is separate from the
  bare draft cascade contract and was not bypassed.
- Rejected finalized deletion transaction: finalized parent and item remained.
- Restricted runtime role: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; no runtime
  DELETE privilege.
- Normal reads and migration completion: passed.

The original combined item trigger defect was corrected by making the existing
parent and item mutation triggers update-only and assigning finalized delete
decisions to the dedicated delete triggers in `0021`. The corrected artifact
contained both dedicated delete triggers and the fixture-backed behavior was
executed against that exact artifact target.

The target was disposed through the authorized exact Compose project lifecycle;
the container and network were verified absent afterward.

Migration `0021` remains an unapplied candidate in normal/shared environments.
No production or hosted database was touched.

## Current-source evidence hardening

After the runtime evidence above, the runner was corrected so the purchase
delete probe is module-scoped and can execute as part of the application-path
run. The former aggregate trigger-count assertion was replaced with the
read-only named-trigger contract in
`scripts/financial-e2e-trigger-contract.mjs`. It inspects all non-internal
triggers on both governed tables and requires exactly the four expected
guards, their table, enabled state, `BEFORE` timing, single expected event,
row-level mode, public zero-argument function, and function definition
metadata.

Focused regression coverage passes 14/14, including missing, duplicate,
unexpected, misattached, disabled, wrong-function, and non-public-function
guards. The corrected runner and contract pass Node syntax checks and
`git diff --check`. No new disposable target was provisioned for this
hardening step; the behavioral observations above remain target-bound evidence
for the previously authorized source snapshot until the corrected runner is
executed on a newly authorized immutable target.

## Current-source authorized runtime verification

The corrected runner was executed against a fresh immutable target bound to
source commit `c0150084302fbba47230386f378d4cadf65f47ea`:

- Target: `127.0.0.1:55602`, database
  `pharmnos_financial_e2e_20261107b`, Compose project
  `pharmnoslite-financial-e2e-20261107b`.
- Target fingerprint:
  `925039cfb6870476f5b28551a4b018314fc1a59e51d2abd78c0f0786b729636a`.
- Schema artifact hash:
  `40e3c0efd19fcd01e6b813ca37bf0c95899255fa8e00d0977a1ab27758ced168`.
- Named trigger contract: PASS; the exact four governed triggers, function
  schema/signature, timing, events, row-level mode, and enabled state matched.
- Finalized parent and item deletes: rejected with SQLSTATE `42501`; persisted
  `1/1` parent/item records remained unchanged.
- Bare draft deletion: cascaded `1/1` parent/item records to `0/0`.
- Evidence-bearing draft deletion: rejected with SQLSTATE `23503` and
  `purchase_gst_evidence_purchase_fkey`.
- Expected trigger failures were isolated with savepoints so the surrounding
  verification transaction remained valid.

The complete sanitized structured artifact is
`26-authorized-disposable-runtime-evidence.json`. The exact application
Compose project and network were disposed through the authorized lifecycle and
verified absent. No production or shared database was touched.

## Current-source normal migration replay

A separate disposable target was created under an immutable migration-replay
contract for the current working source:

- Target: `127.0.0.1:55604`, database
  `pharmnos_financial_e2e_migration_20261107a`, Compose project
  `pharmnoslite-financial-e2e-migration-20261107a`.
- `pnpm exec prisma migrate deploy`: PASS; all 21 migration directories were
  applied in order through `0021_reject_finalized_purchase_deletes`.
- A second `pnpm exec prisma migrate deploy`: PASS; no pending migrations.
- Database readback: `_prisma_migrations` contained `21` rows, all `21`
  finished, and `0` unfinished rows.
- Restricted runtime role readback and connection: PASS; `LOGIN`,
  `NOSUPERUSER`, and `NOBYPASSRLS`, connected to the same authorized database.

The migration chain does not create the disposable runtime role or its
application grants; those were applied only on this disposable target after
migration replay so the role contract could be verified. This is migration
replay evidence, not proof that the generated financial-E2E provisioning
artifact and Prisma migration chain are interchangeable. The target remains
subject to exact contract-bound disposal and is not a shared or production
database.
