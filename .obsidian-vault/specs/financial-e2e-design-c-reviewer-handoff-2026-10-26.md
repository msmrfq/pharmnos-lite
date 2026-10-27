# Pharmnos Lite Design C Reviewer Handoff

**Date:** 2026-10-26
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION
**Handoff mode:** Manual
**Decision record:** `financial-e2e-owner-decisions-2026-10-25.md`
**Decision C:** Option 1 — Omit mutable-table runtime DELETE policies
**Decision status:** Owner-selected design; technical sign-offs pending
**Live Supabase:** `NO-GO`
**Connected initialization:** Disabled and fail-closed

## Reviewer assignments

| Review | Responsible role | Reviewer | Status |
|---|---|---|---|
| Security/architecture | Security/architecture reviewer | Not assigned | Pending |
| Database | Database reviewer | Not assigned | Pending |
| Application/financial integrity | Application/financial-integrity reviewer | Not assigned | Pending |

No individual reviewer identities, contact details, signatures, or completed
communications are established in the project records. This package is ready
for manual owner distribution; it does not claim delivery.

## Shared decision context

The owner selected Option 1 in the project-owner conversation dated
`2026-10-25`. The selection preserves the no-runtime-DELETE posture and does
not define a mutable-table runtime DELETE policy family
([`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md)).

The selection is design-only. It does not authorize implementation, SQL,
grant/RLS changes, database initialization, tests, cleanup, connected access,
expectation population, manifest approval, deployment, or production activity.
Decisions A and B remain approved interim directions.

## Security/architecture review request

### Existing evidence

- The security review separates bootstrap and runtime roles, runtime schema
  access, default privileges, and table grants
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-45)).
- Runtime DELETE is revoked for immutable GST-history tables, `tenants`, and
  `audit_logs`
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:60-81)).
- SQL privileges and RLS policy behavior are separate review layers
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125);
  [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31)).
- No caller-invocable privileged function is established; a future controlled
  function requires separate approval
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:139-155)).
- Local GST cleanup uses bootstrap DELETE and temporarily disables user
  triggers
  ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)).

### Reviewer questions

1. Confirm or reject the no-runtime-DELETE posture for all application/runtime
   principals.
2. Define prohibited or required conditions for role inheritance, ownership,
   `PUBLIC`, and default ACLs.
3. Define the cleanup trust boundary and whether bootstrap cleanup is allowed.
4. Decide whether trigger disabling during GST cleanup is prohibited,
   conditionally permitted, or must be replaced.
5. Define audit evidence and tenant-isolation controls for any cleanup path.
6. Confirm that grants and RLS policy assertions remain separately evaluated.

### Sign-off

- **Decision:** `Not recorded — pending`
- **Conditions or requested changes:** ______________________________
- **Reviewer:** `Not assigned`
- **Date (IST):** ______________________________

## Database review request

### Existing evidence

- Option 1 requires no mutable-table runtime DELETE policy family.
- The RLS review defines SELECT/INSERT/UPDATE families and no DELETE policy
  for immutable GST history
  ([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31);
  [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:130-131)).
- Prisma relations include mixed `CASCADE`, `RESTRICT`, and `SET NULL`
  behavior
  ([`schema.prisma`](../../prisma/schema.prisma:215-237);
  [`schema.prisma`](../../prisma/schema.prisma:454-467);
  [`schema.prisma`](../../prisma/schema.prisma:941-947)).
- The fixture lifecycle requires run ownership, explicit authorization, and
  dependency-aware cleanup, but does not establish a runtime DELETE requirement
  ([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:1-29);
  [`financial-e2e-validation-harness.md`](financial-e2e-validation-harness.md:67-113)).

### Reviewer questions

1. Confirm the exact table and policy expectations under Option 1.
2. Define catalog evidence for effective and inherited DELETE privileges,
   owners, `PUBLIC`, default ACLs, sequences, and routines.
3. Define how absent mutable-table DELETE policies are represented.
4. Assess FK dependencies and `ON DELETE` consequences for cleanup.
5. Assess whether disposable database/schema destruction can replace row-level
   cleanup.
6. If row-level cleanup is unavoidable, define the acceptable bootstrap-only
   boundary and verification evidence.

### Sign-off

- **Decision:** `Not recorded — pending`
- **Table/policy expectations:** ______________________________
- **Catalog evidence:** ______________________________
- **FK/ownership findings:** ______________________________
- **Cleanup feasibility:** ______________________________
- **Reviewer:** `Not assigned`
- **Date (IST):** ______________________________

## Application/financial-integrity review request

### Existing evidence

- Master-data actions named `delete...Action` perform soft deactivation:
  [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235),
  [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414),
  [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:565-589).
- Invoice correction uses cancellation/recreation
  ([`sales.actions.ts`](../../src/app/_actions/sales.actions.ts:248-273);
  [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts:751-780);
  [`billing/[invoiceId]/edit/page.tsx`](../../src/app/billing/[invoiceId]/edit/page.tsx:46-49)).
- Ledger, stock-movement, and audit repositories reject physical deletion and
  require reversal or append-only history
  ([`ledger.repository.ts`](../../src/repositories/ledger.repository.ts:35-49);
  [`ledger.repository.ts`](../../src/repositories/ledger.repository.ts:195-210);
  [`stock-movement.repository.ts`](../../src/repositories/stock-movement.repository.ts:38-53);
  [`audit-log.repository.ts`](../../src/repositories/audit-log.repository.ts:49)).
- Physical-delete repository methods exist, but no textual active callers were
  found in the reviewed application source.

### Reviewer questions

1. Confirm whether any supported product or administrative workflow requires
   physical deletion.
2. Classify unreferenced repository delete methods as supported, legacy,
   unsupported, or indeterminate where evidence permits.
3. Review permissions for active master-data soft-delete actions.
4. Confirm invoice, payment, GST, stock, ledger, and audit correction,
   reversal, retention, and atomicity invariants.
5. Confirm idempotency, rollback, audit, and tenant-isolation requirements.
6. Confirm that disposable cleanup is test-only and outside application
   runtime privileges.

### Sign-off

- **Decision:** `Not recorded — pending`
- **Repository method classification:** ______________________________
- **Permission findings:** ______________________________
- **Financial correction/retention invariants:** ______________________
- **Cleanup invariants:** ______________________________
- **Reviewer:** `Not assigned`
- **Date (IST):** ______________________________

## Separate fixture-cleanup decision

No cleanup mechanism is selected or authorized by Option 1. Review the
following alternatives separately:

| Alternative | Existing evidence | Unknowns requiring review |
|---|---|---|
| Disposable database/schema destruction | Isolated target identity and separate cleanup authorization are required ([`financial-e2e-validation-harness.md`](financial-e2e-validation-harness.md:67-113)). | Provider support, ownership, permissions, target lifetime, discard authorization, retention, and evidence. |
| Separately authorized bootstrap-only cleanup | Local scripts use ordered bootstrap DELETE; the lifecycle requires owned resources, authorization, and actual completion evidence ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145); [`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)). | Privilege boundary, trigger behavior, GST-history safety, audit, rollback, tenant isolation, and connected verification. |
| Retain fixtures until target discard | Cleanup is a separate gate and immediate deletion is not required by the pure lifecycle contract ([`financial-e2e-validation-harness.md`](financial-e2e-validation-harness.md:83-113)). | Target lifetime, stale-fixture isolation, storage/cost, retention, discard authorization, and evidence. |

## Remaining blockers

1. Reviewer identities must be assigned for all three review roles.
2. The owner must distribute this package through the approved manual channel.
3. Security, database, and application/financial-integrity sign-offs must be
   recorded in the owner record.
4. The cleanup alternative must be reviewed and separately approved.
5. No sign-off authorizes SQL, grants/RLS changes, initialization, connected
   access, tests, cleanup, expectation population, manifest approval, or
   deployment.
