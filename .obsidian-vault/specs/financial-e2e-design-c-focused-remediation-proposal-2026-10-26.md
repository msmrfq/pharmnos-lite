# Pharmnos Lite Design C Focused Remediation Proposal

**Date:** 2026-10-26  
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Decision C:** Option 1 — omit mutable-table runtime DELETE policies  
**Decision C status:** Owner-selected design; not technically approved  
**Assigned reviewer:** Masum Rafique — security/architecture, database, and application/financial integrity  
**Technical sign-offs:** Pending  
**Fixture cleanup:** Unresolved; trigger disabling prohibited by owner direction  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed

## Scope and non-authorization

This proposal consolidates source-grounded remediation directions for
soft-delete authorization, executable RLS policy review, and GST fixture
cleanup. It is documentation-only and does not approve any proposal.

Nothing here authorizes application, SQL, RLS, grant, schema, expectation,
manifest, adapter, or tracker changes; database or Supabase access; SQL
execution; tests; initialization; fixture creation or cleanup; trigger
disabling; deployment; environment changes; or Git operations.

## 1. Soft-delete authorization

### Confirmed source evidence

The active actions are:

| Action | Source | Visible operation |
|---|---|---|
| `deleteProductAction` | [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235) | Tenant-scoped lookup, then `products.is_active = false`. |
| `deleteCustomerAction` | [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414) | Tenant-scoped lookup, then `customers.is_active = false`. |
| `deleteSupplierAction` | [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:565-589) | Tenant-scoped lookup, then `suppliers.is_active = false`. |

Each action calls `requireServerTenantContext()` but does not call
`requirePermission()`. The context helper authenticates the user, requires an
active membership, and loads role permissions
([`tenant-context.ts`](../../src/lib/db/tenant-context.ts:38-104)); it does not
enforce a specific operation permission. The operation-level helper exists at
[`tenant-context.ts`](../../src/lib/db/tenant-context.ts:22-25).

The existing permission enum contains `edit_product`, `edit_customer`, and
`edit_supplier`, but contains no dedicated delete/deactivate permissions
([`schema.prisma`](../../prisma/schema.prisma:30-58)). Existing role mappings
grant:

- `ADMIN`: all permission values.
- `INVENTORY`: `create_product` and `edit_product`.
- `BILLING` and `MANAGER`: view-oriented master permissions, not master-data
  edit permissions.

The mappings appear in both [`constants.ts`](../../src/lib/permissions/constants.ts:3-30)
and [`auth.actions.ts`](../../src/app/auth/_actions/auth.actions.ts:25-54).

The UI confirmation explicitly says the operation marks the record inactive
and preserves invoice and ledger history
([`master-actions-cell.tsx`](../../src/components/ui/master-actions-cell.tsx:20-35)).
This is user-interface messaging, not authorization.

No audit write is visible in the three actions. Existing audit writes occur
in purchase and sales workflows
([`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts:1130-1213);
[`sales.actions.ts`](../../src/app/_actions/sales.actions.ts:493)).
Audit records are immutable in
[`audit-log.repository.ts`](../../src/repositories/audit-log.repository.ts:36-50).

No dependency checks are visible before deactivation. The actions do not
inspect linked invoices, batches, ledgers, balances, or posting state.

Physical-delete repository methods remain in
[`product.repository.ts`](../../src/repositories/product.repository.ts:44-46),
[`customer.repository.ts`](../../src/repositories/customer.repository.ts:44-46),
and [`supplier.repository.ts`](../../src/repositories/supplier.repository.ts:44-46),
but the inspected source shows the active UI path calling the soft-delete
actions instead. This does not prove that no external or future caller exists.

### Proposed disposition

Use the existing `edit_product`, `edit_customer`, and `edit_supplier`
permissions as candidates for the corresponding deactivation operations,
because they are the only existing entity-specific mutation permissions.
Require explicit source review and owner/security/application approval before
treating that mapping as final. Do not invent new permission names in this
proposal.

Before implementation, define for each entity:

1. Whether the existing `edit_*` permission authorizes deactivation.
2. Which existing roles may hold that permission.
3. Whether deactivation requires an immutable audit event.
4. Which operational dependencies block deactivation.
5. Whether the authorization, dependency check, state update, and audit write
   must be atomic and retry-safe.

### Uncertainties and required evidence

Source inspection does not establish hidden middleware, deployment-level
authorization, database enforcement, or intended business policy. The
technical review must confirm the role matrix, action-level enforcement,
audit event shape, dependency rules, and transaction behavior.

No permission mapping is approved and no technical sign-off is complete.

## 2. Executable RLS policy review

### Confirmed source evidence

[`05-rls-tenant-policies.sql`](../../prisma/05-rls-tenant-policies.sql:1-18)
creates `PERMISSIVE FOR ALL` policies for the 19 core tables, including:

`tenants`, `users`, `roles`, `role_permissions`, `memberships`,
`business_profiles`, `customers`, `suppliers`, `products`,
`product_batches`, `sales_invoices`, `sales_invoice_items`,
`purchase_invoices`, `purchase_invoice_items`, `stock_movements`, `payments`,
`customer_ledgers`, `supplier_ledgers`, and `audit_logs`.

Representative policy statements are:

- `tenants`: lines 71-73.
- `customers`: lines 137-139.
- `suppliers`: lines 144-146.
- `products`: lines 151-153.
- `audit_logs`: lines 221-223.

The guarded additive block applies the same `FOR ALL` policy shape to:

- `purchase_posting_operations`
- `purchase_gst_evidence_revisions`
- `purchase_gst_line_evidence`
- `purchase_gst_calculations`
- `purchase_gst_accounting_decisions`
- `purchase_gst_reconciliation_events`
- `purchase_gst_reconciliation_event_lines`

It also explicitly grants `SELECT, INSERT, UPDATE, DELETE` to
`authenticated` for each additive table
([`05-rls-tenant-policies.sql`](../../prisma/05-rls-tenant-policies.sql:225-272)).

### Comparison with Decision C Option 1

At the RLS command level, `FOR ALL` includes DELETE. This conflicts with the
owner-selected direction that mutable tables have no mutable-table runtime
DELETE policy family. The additive GST block is especially inconsistent with
immutable GST-history intent because it creates `FOR ALL` policies and grants
DELETE for all seven additive tables.

RLS policy commands and database privileges are separate controls:

- A DELETE policy permits row visibility/qualification for DELETE only when
  the role also has effective DELETE privilege.
- A missing DELETE policy does not itself revoke table DELETE privilege.
- Ownership, inherited roles, `PUBLIC`, superuser or `BYPASSRLS`, and default
  privileges can change effective behavior.

Therefore, this source review identifies an artifact-level conflict but does
not prove deployed runtime DELETE capability or absence.

### Proposed minimum policy-level correction

For the executable policy artifact, replace the broad `FOR ALL` policy model
with explicit policy commands:

- `FOR SELECT` preserving the tenant `USING` predicate.
- `FOR INSERT` preserving the tenant `WITH CHECK` predicate.
- `FOR UPDATE` preserving both tenant `USING` and `WITH CHECK` predicates.
- No `FOR DELETE` policy on mutable tables under Option 1.
- No DELETE policy on immutable GST-history tables.

The additive GST block must not grant runtime DELETE as part of this policy
correction. This proposal does **not** authorize editing the SQL or changing
grants; effective privilege changes require a separate reviewed decision and
target-bound verification.

### Required evidence and prerequisites

Before implementation, reviewers need a table-by-table matrix covering policy
commands, roles, predicates, runtime grants/revokes, ownership, inherited
privileges, `PUBLIC`, default ACLs, `BYPASSRLS`, and effective DELETE
privilege. Connected catalog evidence is required before claiming that the
deployed behavior matches Option 1.

## 3. GST cleanup without trigger disabling

### Confirmed source evidence

[`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)
currently disables user triggers on six GST tables, deletes only two of those
tables directly, deletes broader fixture data, re-enables triggers, and
commits. Its main execution path is fail-closed
([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:148)).

The fixture lifecycle defines a dependency-aware resource order including all
six GST tables and requires target identity, owned-resource snapshots,
explicit cleanup authorization, and matching completion evidence
([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:1-29);
[`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)).

### Alternatives

| Alternative | Potential benefit | Feasibility evidence still required |
|---|---|---|
| Disposable database/schema destruction | Avoids row-level DELETE and trigger bypass. | Verified disposable target, destruction authority, containment from live data, completion evidence, recovery/retention controls. |
| Retain fixtures until target discard | Avoids cleanup execution and residual-row ambiguity. | Isolation/run-ID guarantees, retention boundary, storage and discard authority, evidence retention, no production confusion. |
| Separately reviewed trigger-preserving cleanup | Could remove owned rows while keeping trigger enforcement. | Applied FK actions, trigger definitions/state, table/trigger ownership, effective bootstrap privileges, exact per-table treatment, rollback, and residual-row proof. |

The existing bootstrap cleanup in
[`financial-e2e-rollback-recovery.mjs`](../../scripts/financial-e2e-rollback-recovery.mjs:103-117)
does not disable triggers but does not cover the six GST tables and does not
establish a complete GST cleanup mechanism.

### Proposed disposition

Do not select an alternative in this proposal. Preserve the owner’s absolute
prohibition on trigger disabling. Keep target destruction, fixture retention,
and trigger-preserving row cleanup as separate options pending security and
database review.

Required target-bound evidence includes database identity, role attributes and
inheritance, table and trigger ownership, FK constraints and `ON DELETE`
actions, deferrability, trigger definitions and enabled state, effective
DELETE/TRUNCATE/ALTER privileges, RLS state, exact owned residual-row counts,
proof that non-fixture rows were untouched, and failure/rollback evidence.

## Closing status

- Decision C Option 1 remains owner-selected but not technically approved.
- Security/architecture, database, and application/financial-integrity
  sign-offs remain pending.
- Fixture cleanup remains unresolved; no mechanism is selected or authorized.
- Live Supabase remains `NO-GO`.
- Connected initialization remains disabled and fail-closed.
- All execution gates remain closed.
- No implementation, database access, SQL execution, tests, initialization,
  fixture creation or cleanup, trigger disabling, deployment, environment
  change, or Git operation occurred.
