# Pharmnos Lite Design C Proposed Dispositions

**Date:** 2026-10-26  
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Decision C:** Option 1 — Omit mutable-table runtime DELETE policies  
**Decision C status:** Owner-selected design; not technically approved  
**Assigned reviewer:** Masum Rafique — security/architecture, database, and application/financial integrity  
**Technical sign-offs:** Pending  
**Fixture cleanup:** Unresolved; trigger disabling prohibited by owner direction  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed

## Scope and non-authorization

This is a proposed-disposition package based on the existing read-only
investigation and remediation decision record. It recommends directions for
review; it does not approve them.

No implementation or execution is authorized by this document. In particular,
it does not authorize SQL, grants, RLS changes, application or schema changes,
expectation or manifest changes, adapter changes, database access, tests,
initialization, fixture creation or cleanup, trigger disabling, deployment,
environment changes, or Git operations.

## SEC-01 — DELETE-policy conflict

### Proposed disposition

Adopt the following precise policy wording for future approved contract and
expectation work:

> For every ordinary application/runtime principal, mutable tables have no
> `DELETE` privilege and no runtime `DELETE` policy. The approved runtime
> policy family contains only the explicitly approved commands for each table.
> Immutable financial and GST-history tables additionally have no runtime
> `UPDATE` or `DELETE` privilege and no `UPDATE` or `DELETE` policy. Any
> bootstrap-only cleanup capability is outside the ordinary runtime policy
> family and requires a separate approved trust boundary.

This wording is consistent with owner-selected Option 1 because it treats both
privilege absence and policy absence as requirements. It does not decide which
bootstrap cleanup mechanism, if any, will be approved.

### Source evidence

- Option 1 preserves no runtime DELETE and does not define a mutable-table
  runtime DELETE policy family
  ([`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:17)).
- The standalone RLS contract defines SELECT/INSERT/UPDATE families
  ([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31)).
- Immutable GST history is SELECT/INSERT only
  ([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:130-173)).
- The security-controls artifact still names
  `tenant_delete_<table> (only mutable tables)`
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125)).
- Runtime grants and revokes are specified separately
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-81)).

### Uncertainties and prerequisites

- The existing mutable DELETE naming statement has not been classified as
  obsolete, descriptive, or executable.
- No live policy or privilege state is available.
- The future expectation representation for explicit policy absence is not
  approved.

### Required decision or evidence

The owner has directed that Option 1 requires both:

1. No ordinary runtime DELETE privilege on mutable tables.
2. No mutable-table runtime DELETE policy family.

The owner classified the existing naming statement as requiring later
correction. Security and database reviewers must verify this direction and
define a testable expectation for policy absence; no alternate DELETE-policy
option is authorized by the owner direction.

**Owner direction recorded 2026-10-26:** classify the
`tenant_delete_<table>` wording as requiring later correction. Technical review
and any documentation/contract correction remain pending.

**Proposed status:** Owner direction recorded; technical review pending.

## SEC-03 — Trigger disabling

### Proposed disposition

The owner has directed **prohibiting trigger disabling entirely**. This is an
owner design direction, not technical approval or authorization. The fixture
cleanup mechanism remains unresolved; any future alternative must not disable
triggers and must receive separate owner, security, and database review.

### Rationale

The prohibition protects the owner-controlled immutable GST-history trigger
boundary because the cleanup script disables user triggers before DELETE
operations. It also avoids introducing a privileged cleanup bypass while the
target, executor, and effective privileges remain unverified.

### Source evidence

- The cleanup transaction disables triggers on six GST tables, deletes records,
  re-enables triggers, and commits
  ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)).
- The security contract requires immutable GST triggers to reject UPDATE/DELETE
  with SQLSTATE `42501`
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-172)).
- Direct script execution is currently blocked by a fail-closed guard
  ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:145)).
- The fixture lifecycle requires identity evidence, explicit authorization,
  owned resources, and completion evidence
  ([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)).

### Uncertainties and prerequisites

- No approved executor, target, trigger state, or effective privilege evidence
  exists.
- Failure recovery and post-failure trigger-state verification are unproven.
- The owner and reviewers have not selected among target destruction,
  bootstrap-only cleanup without trigger disabling, or fixture retention.

### Required decision or evidence

The owner has directed that trigger disabling is prohibited entirely. Security
and database reviewers must verify the implications and define a cleanup
approach that does not disable triggers. The owner and reviewers must
separately decide the fixture-cleanup mechanism.

**Owner direction recorded 2026-10-26:** prohibit trigger disabling entirely.
This does not select or authorize a fixture-cleanup mechanism.

**Proposed status:** Owner direction recorded; technical sign-off pending.

## SEC-04 — Cleanup coverage

### Proposed disposition

Require a per-table cleanup treatment matrix before any cleanup approval. Each
affected GST table must be classified exactly as one of:

- Directly deleted by an approved cleanup operation.
- Removed by a verified foreign-key cascade.
- Retained until disposable target discard.
- Prohibited from deletion.

The matrix must identify the owning fixture resources, dependency order,
trigger behavior, expected residual rows, and post-cleanup verification for
each table. The existing script must not be treated as complete coverage
evidence.

### Source evidence

The cleanup script disables triggers on six tables:

- `purchase_gst_evidence_revisions`
- `purchase_gst_line_evidence`
- `purchase_gst_calculations`
- `purchase_gst_accounting_decisions`
- `purchase_gst_reconciliation_events`
- `purchase_gst_reconciliation_event_lines`

It visibly deletes only `purchase_gst_calculations` and
`purchase_gst_evidence_revisions` among those six.

Source: [`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)

The fixture lifecycle separately defines dependency-aware ordering and
run-owned cleanup authorization
([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:1-29);
[`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)).

### Uncertainties and prerequisites

- Omitted tables may be cascaded, retained, expected empty, or unintentionally
  omitted.
- Prisma relations do not prove the applied database constraints.
- No row-count, trigger-state, residual-resource, or cleanup-completion
  evidence exists.

### Required decision or evidence

Database and application/financial-integrity reviewers must approve the matrix
only after target-bound evidence establishes:

- Actual FK constraints, `ON DELETE` actions, and deferrability.
- Applied trigger definitions, owners, and current state.
- Direct versus cascaded deletion behavior.
- Expected residual rows and fixture-isolation consequences.
- Failure and recovery behavior.

**Owner direction recorded 2026-10-26:** defer every affected GST table
treatment pending technical evidence. No cleanup treatment is selected.

**Proposed status:** Owner deferral recorded; per-table evidence matrix and
technical review pending.

## SEC-05 — Soft-delete authorization

### Proposed disposition

Require an explicit permission mapping for the three active logical-delete
actions before considering authorization adequate:

| Action | Resource operation | Current visible enforcement | Required disposition |
|---|---|---|---|
| `deleteProductAction` | Deactivate product | Authenticated active membership and tenant-scoped lookup/update; no visible `requirePermission` call | Name an approved permission, authorized roles, enforcement boundary, audit behavior, and dependency rules |
| `deleteCustomerAction` | Deactivate customer | Authenticated active membership and tenant-scoped lookup/update; no visible `requirePermission` call | Name an approved permission, authorized roles, enforcement boundary, audit behavior, and dependency/ledger rules |
| `deleteSupplierAction` | Deactivate supplier | Authenticated active membership and tenant-scoped lookup/update; no visible `requirePermission` call | Name an approved permission, authorized roles, enforcement boundary, audit behavior, and dependency/GST/ledger rules |

The recommended direction is explicit server-side operation authorization,
either directly in each action or through a proven shared wrapper whose use is
complete and bypass-resistant. This recommendation does not authorize code
changes.

### Source evidence

- Product action: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235)
- Customer action: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414)
- Supplier action: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:568-589)
- Context loading authenticates the user, requires an active membership, and
  loads role permissions
  ([`tenant-context.ts`](../../src/lib/db/tenant-context.ts:38-104)).
- `requirePermission()` rejects a missing permission, but is not visibly called
  by these actions
  ([`tenant-context.ts`](../../src/lib/db/tenant-context.ts:20-25)).

### Uncertainties and prerequisites

- No inspected wrapper or route demonstrates another permission check.
- Database/RLS authorization for the update is not live-verified.
- Audit creation, dependency restrictions, and idempotent repeated
  deactivation are not demonstrated in the action bodies.

### Required decision or evidence

Application and security reviewers must approve, for each action:

- Permission name and authorized role mapping.
- Enforcement location and direct-invocation bypass resistance.
- Audit-event requirement.
- Behavior with invoices, batches, stock, ledgers, GST evidence, and reports.
- Idempotency, retry, and concurrency expectations.

**Owner direction recorded 2026-10-26:** require source review before selecting
permission names or authorized roles. No permission mapping or enforcement
evidence is approved.

**Proposed status:** Owner direction recorded; application/security review
pending.

## SEC-02 / SEC-06 — Database privilege and administrative evidence

### Proposed disposition

Require a minimum target-bound, read-only catalog evidence package before
technical approval. Keep connected verification disabled until the owner
separately authorizes an isolated target, evidence handling, and execution
attempt.

### Source evidence

- Bootstrap/runtime role separation, schema privileges, and default ACL
  intentions are specified in
  [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-50).
- Runtime table grants and DELETE revokes are specified in
  [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-81).
- Future privileged functions require separate ownership, safe search path,
  restricted EXECUTE, and `PUBLIC` EXECUTE revocation
  ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:139-155)).
- Initialization requires target identity, role separation, and catalog
  verification but remains disabled
  ([`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:1-20)).

### Minimum required evidence

For a specifically identified disposable target, with provenance bound to the
target, run, attempt, artifact version, and source hashes, capture:

1. Database, schema, server, and connected-role identity.
2. Role attributes: login, superuser, `BYPASSRLS`, `INHERIT`, replication, and
   full role membership/inheritance graph.
3. Table, schema, sequence, routine, function, and trigger ownership/ACLs.
4. `PUBLIC` ACLs and default ACLs.
5. Effective runtime SELECT/INSERT/UPDATE/DELETE/TRUNCATE privileges,
   including inherited privileges.
6. RLS enabled/forced state and every applicable policy command, role, `USING`,
   and `WITH CHECK` expression.
7. Applied FK constraints, `ON DELETE` actions, deferrability, and relevant
   trigger definitions/state.
8. Routine owner, security mode, search path, and EXECUTE ACL.
9. Sanitized, append-only evidence storage and retention controls.

### Uncertainties and prerequisites

- No connected target or catalog evidence exists.
- Source SQL is not proof of effective live privileges or applied RLS.
- No administrative/cleanup principal beyond the documented bootstrap/runtime
  roles is approved.

### Required decision or evidence

Security and database reviewers must approve this minimum evidence set or
specify additions. The owner must separately authorize any future isolated
connected verification; that authorization must not be inferred from this
proposal.

**Owner direction recorded 2026-10-26:** confirm the minimum target-bound,
read-only evidence requirements. This does not authorize connected access.

**Proposed status:** Evidence direction confirmed; connected review and
privilege approval pending.

## Overall blockers and preserved state

- Decision C Option 1 remains owner-selected but not technically approved.
- Masum Rafique is assigned to all three reviewer roles; all sign-offs remain
  pending.
- Fixture cleanup remains unresolved and unselected.
- Live Supabase remains `NO-GO`.
- Connected initialization remains disabled and fail-closed.
- All execution gates remain closed.
- No implementation, SQL, database access, tests, initialization, cleanup,
  deployment, environment change, or Git operation occurred.
