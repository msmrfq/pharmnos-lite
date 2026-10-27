# Pharmnos Lite Design C Remediation Decisions

**Date:** 2026-10-26  
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Decision C:** Option 1 — Omit mutable-table runtime DELETE policies  
**Decision C status:** Owner-selected design; not technically approved  
**Assigned reviewer:** Masum Rafique  
**Technical sign-offs:** Security/architecture, database, and application/financial-integrity reviews pending  
**Fixture cleanup:** Unresolved; trigger disabling prohibited by owner direction  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed  

## Purpose and authorization boundary

This document records remediation decisions required for the open Design C
findings. It is a review and decision package only. It does not implement or
authorize any remediation.

Nothing in this document authorizes:

- SQL execution, grants, RLS changes, migrations, or database initialization.
- Application-code changes, tests, expectation population, manifest approval,
  or adapter changes.
- Supabase or other connected database access.
- Fixture creation, cleanup, trigger disabling, deployment, or environment
  changes.
- Selection of a fixture-cleanup mechanism.

Decision C Option 1 remains owner-selected, not technically approved. All
reviewer sign-offs and execution gates remain pending or closed.

## Finding SEC-01 — Mutable DELETE-policy wording conflicts with Option 1

### Confirmed source evidence

1. The owner selected Option 1, which preserves no runtime DELETE and does not
   define a mutable-table runtime DELETE policy family
   ([`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:17)).
2. The standalone RLS artifact defines SELECT, INSERT, and UPDATE policy
   families for the common table contract
   ([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31)).
3. The same RLS artifact specifies immutable GST history as SELECT/INSERT only,
   with no UPDATE/DELETE policy
   ([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:130-173)).
4. The security-controls artifact separately names a deterministic
   `tenant_delete_<table> (only mutable tables)` policy pattern
   ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125)).
5. The security-controls artifact grants ordinary runtime SELECT/INSERT/UPDATE
   and explicitly revokes DELETE for `tenants` and `audit_logs`; GST-history
   tables receive SELECT/INSERT with UPDATE/DELETE revoked
   ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-81)).

### Uncertainty

- It is not established whether the mutable DELETE naming pattern is
  historical, descriptive, or intended for future executable generation.
- No executable artifact or live catalog state proves whether any DELETE
  policy exists.
- The final expectation representation for policy absence has not been
  approved.

### Available options and trade-offs

| Option | Trade-off |
|---|---|
| Remove or supersede the mutable DELETE naming pattern | Aligns the review artifacts with Option 1 and reduces accidental policy generation; requires a controlled documentation/contract correction. |
| Retain it as explicitly non-operative historical text | Avoids immediate artifact edits but leaves interpretation and generation risk unless the non-operative status is unmistakable. |
| Reopen the DELETE design and define explicit mutable DELETE policies | Could support a proven application workflow, but conflicts with the owner-selected Option 1 and requires a new owner decision plus complete security/database review. |

### Decision or evidence required

The owner has directed that Option 1 requires both:

1. No ordinary runtime DELETE privilege on mutable tables.
2. No mutable-table runtime DELETE policy family.

The owner classified the existing naming statement as requiring later
correction. Security and database reviewers must verify this direction and
define a testable expectation for policy absence; they must not select a
different DELETE-policy option without a new owner decision.

### Not authorized yet

No SQL, RLS artifact, expectation, manifest, adapter, or documentation
correction is authorized by this record. No policy-generation or catalog
verification may run.

**Finding status:** Open — reviewer decision and contract reconciliation
required.

**Owner direction recorded 2026-10-26:** classify the existing
`tenant_delete_<table>` wording as requiring later correction. This does not
authorize the correction or any policy change.

## Finding SEC-03 — GST cleanup disables user triggers before DELETE

### Confirmed source evidence

1. The cleanup function begins a transaction and disables user triggers on six
   GST-related tables
   ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-126)).
2. It then deletes GST calculations and evidence revisions, followed by
   posting operations, invoices, suppliers, roles, memberships, users, and
   tenants
   ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:127-136)).
3. It re-enables user triggers and commits
   ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:137-145)).
4. The security-controls artifact requires owner-controlled triggers to reject
   GST-history UPDATE/DELETE with SQLSTATE `42501`
   ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-172)).
5. Direct script execution is blocked by a fail-closed error before the
   execution path proceeds
   ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:145)).

### Uncertainty

- No source evidence proves that an approved cleanup executor can reach this
  function.
- No applied database evidence proves the trigger set, trigger ownership, or
  privileges required to disable triggers.
- Failure recovery, trigger restoration after an interrupted process, and
  cleanup evidence persistence are not proven.

### Available options and trade-offs

| Option | Trade-off |
|---|---|
| Prohibit trigger disabling | Strongest immutable-history protection and simpler audit model; may require target destruction or a different cleanup design. |
| Permit it only in a bootstrap-owned disposable target | May support row cleanup while keeping runtime principals restricted; requires strong target identity, privilege separation, failure recovery, trigger-state verification, and audit evidence. |
| Replace row cleanup with disposable target/schema destruction | Avoids direct row DELETE and trigger bypass; depends on provider capabilities, ownership, destruction authority, retention, and independent completion evidence. |
| Retain fixtures until the disposable target is discarded | Avoids cleanup execution; requires stale-fixture isolation, target lifetime, retention, storage, and discard controls. |

### Decision or evidence required

The owner has directed that trigger disabling is prohibited entirely. Security
and database reviewers must verify the implications of that direction and
define a cleanup approach that does not disable triggers. The owner and
reviewers must still separately select or reject the three fixture-cleanup
alternatives. No alternative is implied by Option 1.

### Not authorized yet

Trigger disabling, GST DELETE, bootstrap cleanup, target destruction, and
fixture retention are not authorized. The current fail-closed script state
must remain unchanged.

**Finding status:** Open — cleanup mechanism and trigger policy unresolved.

**Owner direction recorded 2026-10-26:** prohibit trigger disabling entirely.
The cleanup mechanism remains unresolved and no cleanup is authorized.

## Finding SEC-04 — Trigger-disabled table coverage and DELETE coverage differ

### Confirmed source evidence

The cleanup script disables triggers on:

- `purchase_gst_evidence_revisions`
- `purchase_gst_line_evidence`
- `purchase_gst_calculations`
- `purchase_gst_accounting_decisions`
- `purchase_gst_reconciliation_events`
- `purchase_gst_reconciliation_event_lines`

It visibly issues direct DELETE statements for only:

- `purchase_gst_calculations`
- `purchase_gst_evidence_revisions`

It does not visibly issue direct DELETE statements for the other four
trigger-disabled GST tables. All of this behavior is in
[`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145).

The fixture lifecycle separately defines a dependency-aware cleanup order
including the GST tables and requires an owned resource snapshot and explicit
cleanup authorization
([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:1-29);
[`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)).

### Uncertainty

- The source does not establish whether omitted GST tables are cascaded,
  intentionally retained, expected to be empty, or accidentally omitted.
- Prisma schema relations are not proof of the applied database constraints.
- No post-cleanup row-count, trigger-state, or residual-resource evidence
  exists.

### Available options and trade-offs

| Option | Trade-off |
|---|---|
| Build an explicit per-table cleanup map | Makes direct, cascaded, retained, and prohibited resources auditable; requires applied FK and trigger evidence. |
| Use disposable target/schema destruction | Avoids per-table dependency ordering and coverage gaps; requires destruction authority and target-isolation proof. |
| Use bootstrap-only row cleanup | Preserves reusable targets but increases privilege, FK, trigger, partial-failure, and audit complexity. |
| Retain fixtures until target discard | Avoids row-level coverage risk; requires strong run isolation and retention/discard controls. |

### Decision or evidence required

Database and application/financial-integrity reviewers must define, for every
GST table, whether cleanup is:

- Directly deleted.
- Removed by a verified FK cascade.
- Retained until target discard.
- Prohibited from deletion.

Before any cleanup approval, require target-bound evidence for actual FK
constraints, `ON DELETE` actions, trigger state, ownership, expected residual
rows, and post-cleanup verification.

### Not authorized yet

No table-level cleanup plan, FK assumption, trigger exception, or row-count
expectation is approved. No cleanup mechanism is selected.

**Finding status:** Open — table coverage and applied-constraint evidence
required.

**Owner direction recorded 2026-10-26:** defer every affected GST table
treatment pending technical evidence. No direct deletion, cascade removal,
retention, or prohibited-deletion treatment has been selected.

## Finding SEC-05 — Soft-delete permission checks are not demonstrated

### Confirmed source evidence

The product, customer, and supplier server actions each:

- Require configured Postgres.
- Call `requireServerTenantContext()`.
- Look up the target with an ID and current tenant ID.
- Set `is_active = false`.
- Update `updated_at`.

Sources:

- Product: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235)
- Customer: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414)
- Supplier: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:568-589)

`requireServerTenantContext()` authenticates the session, requires an active
membership, and loads role permissions into the returned context
([`tenant-context.ts`](../../src/lib/db/tenant-context.ts:38-104)).

The separate `requirePermission()` helper rejects a missing permission, but the
three inspected soft-delete actions do not visibly call it
([`tenant-context.ts`](../../src/lib/db/tenant-context.ts:20-25)).

### Uncertainty

- No inspected wrapper or route proves that another authorization layer invokes
  `requirePermission()` before these actions.
- No database-backed evidence proves that unauthorized updates are rejected by
  the runtime database role.
- Audit-event creation, dependency checks, and business restrictions are not
  visible in the inspected action bodies.

### Available options and trade-offs

| Option | Trade-off |
|---|---|
| Add explicit permission checks in each action | Clear and local authorization evidence; requires selecting permission names and regression coverage. |
| Enforce through a proven shared authorization wrapper | Centralizes policy and reduces repetition; requires proof that every call path uses the wrapper and cannot bypass it. |
| Rely only on database/RLS controls | Can enforce tenant boundaries but may not express product-level permission semantics; requires live policy and effective-privilege evidence. |
| Keep the current behavior pending review | Avoids unapproved code changes but leaves operation-level authorization unproven. |

### Decision or evidence required

Application and security reviewers must define for each action:

- Approved permission name and authorized roles.
- Enforcement location and bypass resistance.
- Whether deactivation requires an audit event.
- Behavior when invoices, stock, batches, ledgers, GST records, or other
  dependent records exist.
- Idempotency and retry behavior.

### Not authorized yet

No permission name, role mapping, action change, audit change, or dependency
rule is approved by this document. No application code or tests may be changed
under this decision record.

**Finding status:** Open — authorization design and enforcement evidence
required.

**Owner direction recorded 2026-10-26:** require source review before selecting
permission names or authorized roles. No permission mapping or enforcement
approval has been recorded.

## Findings SEC-02 and SEC-06 — Effective privileges and administrative boundaries

### Confirmed source evidence

1. The security-controls artifact specifies bootstrap role
   `pharmnos_e2e`, runtime role `pharmnos_e2e_runtime`, runtime schema `USAGE`,
   runtime schema `CREATE` revocation, and default privilege revocation from
   `PUBLIC`
   ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-26);
   [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-50)).
2. The runtime role is intended to be a non-superuser and non-BYPASSRLS role,
   but this is a source contract, not live evidence
   ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-12)).
3. No caller-invocable privileged function is established. Future
   `SECURITY DEFINER` paths require separate owner approval, safe search path,
   explicit checks, restricted EXECUTE, and `PUBLIC` EXECUTE revocation
   ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:139-155)).
4. The initialization contract requires independent target identity, role
   separation, and catalog verification, but connected initialization remains
   disabled
   ([`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:1-20)).

### Uncertainty

No connected catalog evidence verifies:

- Role attributes, membership, inheritance, superuser, or BYPASSRLS status.
- Object ownership.
- `PUBLIC` ACLs and default ACLs.
- Effective table, sequence, schema, routine, or function privileges.
- Routine security mode, search path, or EXECUTE ACL.
- Applied RLS enabled/forced state and policy definitions.

### Available options and trade-offs

| Option | Trade-off |
|---|---|
| Obtain target-bound read-only catalog evidence | Directly tests effective security posture; requires a separately authorized isolated target and approved evidence handling. |
| Keep the design source-only and fail closed | Avoids connected risk; cannot close the technical verification findings or approve runtime readiness. |
| Add a separately controlled administrative/cleanup path | Could isolate bootstrap capabilities; introduces a new trust boundary requiring owner, security, and database approval. |
| Use disposable target/schema destruction instead of row cleanup | Reduces row-level DELETE privilege requirements; depends on provider and ownership capabilities not established in source. |

### Decision or evidence required

Security and database reviewers must define the exact catalog evidence
required on an explicitly identified disposable target, including:

1. Database, schema, and connected-role identity.
2. Role attributes and full membership/inheritance graph.
3. Table, schema, sequence, routine, function, and trigger ownership/ACLs.
4. `PUBLIC` and default ACLs.
5. Effective runtime SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges.
6. RLS enabled/forced state and policy commands/predicates.
7. FK constraints, trigger state, routine security mode, search path, and
   EXECUTE privileges where relevant.
8. Sanitized provenance bound to target, run, attempt, artifact versions, and
   source hashes.

### Not authorized yet

No target may be connected, no catalog query may run, and no privilege or
administrative path may be created. The initialization adapter must remain
disabled and fail-closed.

**Finding status:** Open — target-bound evidence and administrative-boundary
decisions required.

**Owner direction recorded 2026-10-26:** confirm the minimum target-bound,
read-only evidence requirements. This does not authorize a target connection,
catalog query, or execution.

## Approval checklist

- [ ] SEC-01 wording reconciled with Option 1 by explicit security/database
      review.
- [ ] SEC-03 trigger-disabling policy decided and cleanup trust boundary
      defined.
- [ ] SEC-04 per-table cleanup coverage and applied-FK evidence established.
- [ ] SEC-05 soft-delete permission model and enforcement path approved.
- [ ] SEC-02/SEC-06 effective privilege and administrative-boundary evidence
      requirements approved.
- [ ] Security/architecture sign-off recorded.
- [ ] Database sign-off recorded.
- [ ] Application/financial-integrity sign-off recorded.
- [ ] Fixture-cleanup mechanism separately selected and approved.
- [ ] Any implementation and connected execution authorization separately
      granted.

Until every applicable item is explicitly approved, Decision C remains an
owner-selected design only and all execution gates remain closed.
