# Financial E2E Application / Financial-Integrity Review

**Assigned reviewer:** Masum Rafique  
**Review status:** **Review completed with changes required; runtime and database evidence remain missing**  
**Decision under review:** Decision C, Option 1 — omit mutable-table runtime DELETE policies  
**Approval status:** Pending; this report is not a sign-off  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed

## Scope and evidence reviewed

- Owner decision and technical-review boundary: [`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:36)
- Review request and assigned role: [`financial-e2e-design-c-reviewer-handoff-2026-10-26.md`](financial-e2e-design-c-reviewer-handoff-2026-10-26.md:117)
- Tenant authorization helper: [`tenant-context.ts`](../../src/lib/db/tenant-context.ts:20)
- Master-data actions: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211)
- Invoice cancellation: [`sales.actions.ts`](../../src/app/_actions/sales.actions.ts:248), [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts:751)
- Finalized invoice correction guidance: [`page.tsx`](../../src/app/billing/[invoiceId]/edit/page.tsx:46)
- Immutable repositories: [`ledger.repository.ts`](../../src/repositories/ledger.repository.ts:35), [`stock-movement.repository.ts`](../../src/repositories/stock-movement.repository.ts:38), [`audit-log.repository.ts`](../../src/repositories/audit-log.repository.ts:49)
- Fixture lifecycle: [`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:1)

## Findings

### APP-01 — No supported product workflow demonstrably requires physical DELETE

**Evidence:** Product, customer, and supplier actions named `delete...Action`
set `is_active = false` after tenant-scoped lookup/update
([`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235),
[`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414),
[`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:565-589)).
Sales and purchase cancellation update draft status to `CANCELLED` and record
cancellation metadata ([`sales.actions.ts`](../../src/app/_actions/sales.actions.ts:248-273);
[`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts:751-780)).
Finalized invoice editing directs users to cancel and recreate
([`page.tsx`](../../src/app/billing/[invoiceId]/edit/page.tsx:46-49)).

**Assessment:** The reviewed source supports Option 1 as the current design
direction. It does not prove that unreferenced repository delete methods are
safe, supported, or intentionally exposed.

### APP-02 — Physical-delete repository capabilities are unreferenced and inconsistently scoped

**Evidence:** Physical delete methods exist for products, batches, customers,
suppliers, business profiles, purchase/sales invoices, payments, memberships,
roles, role permissions, users, and tenants; no textual active callers were
identified in the reviewed application source. Examples include tenantless
user and tenant deletes ([`user.repository.ts`](../../src/repositories/user.repository.ts:37-39);
[`tenant.repository.ts`](../../src/repositories/tenant.repository.ts:32-34)),
tenant-scoped product/payment/invoice deletes
([`product.repository.ts`](../../src/repositories/product.repository.ts:44-47);
[`payment.repository.ts`](../../src/repositories/payment.repository.ts:44-47);
[`purchase-invoice.repository.ts`](../../src/repositories/purchase-invoice.repository.ts:63-66)),
and role-permission deletion without tenant scoping
([`role.repository.ts`](../../src/repositories/role.repository.ts:92-102)).

**Risk:** An unreferenced method remains a capability if reachable through
future code, a generic repository surface, or an administrative caller.
Several methods accept a tenant context but do not enforce operation-level
permissions; users, tenants, and role permissions also lack equivalent
tenant predicates in the shown methods.

**Recommended disposition:** Classify every physical-delete method as
supported, legacy, unsupported, or indeterminate. Until classified and
guarded, do not treat repository presence as proof of a product requirement
or as compatible with runtime no-DELETE.

### APP-03 — Active master-data soft deletion lacks visible permission checks

**Evidence:** The three active soft-delete actions call
`requireServerTenantContext` and use tenant-scoped predicates, but do not call
`requirePermission`; the helper would reject absent permission
([`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235);
[`tenant-context.ts`](../../src/lib/db/tenant-context.ts:20-25)).

**Risk:** A user may be authenticated and tenant-scoped without being
authorized to deactivate master data. This is an application authorization
gap independent of physical DELETE.

**Recommended disposition:** Define and enforce explicit permissions for
product, customer, and supplier deactivation, then verify that dependent
records remain readable and historical reports remain stable.

### APP-04 — Financial correction paths prefer reversal/cancellation, but full invariants are not proven

**Evidence:** Ledger update/delete operations reject mutation and require
reversing entries ([`ledger.repository.ts`](../../src/repositories/ledger.repository.ts:35-49),
[`ledger.repository.ts`](../../src/repositories/ledger.repository.ts:195-210)).
Stock movement update/delete operations reject mutation and require reversing
movements ([`stock-movement.repository.ts`](../../src/repositories/stock-movement.repository.ts:38-53)).
Audit log mutation is rejected ([`audit-log.repository.ts`](../../src/repositories/audit-log.repository.ts:43-50)).
Purchase actions use transactions, idempotency keys, conditional updates, and
an advisory transaction lock in relevant finalization paths
([`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts:794-926);
[`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts:1069-1092)).

**Risk:** Source inspection cannot establish complete cross-entity atomicity,
retry safety, rollback behavior, concurrency behavior, or consistency across
invoice, payment, GST, stock, ledger, and audit records in all workflows.
Those require authorized isolated runtime verification.

**Recommended disposition:** Preserve append-only/reversal behavior, then
define and verify invariants for each correction and posting workflow before
technical approval.

### APP-05 — GST cleanup is test-only by intent but not yet an approved boundary

**Evidence:** The fixture lifecycle requires explicit cleanup authorization,
identity evidence, an owned resource snapshot, dependency-aware ordering, and
an exact successful completion result ([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)).
The local security behavior cleanup issues GST-history DELETE statements after
disabling user triggers
([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)).

**Risk:** The lifecycle contract is not itself an executor or authorization
grant. Trigger disabling and row deletion could violate immutable-history and
audit invariants if used outside a disposable target.

**Recommended disposition:** Keep cleanup outside application runtime
privileges. Separately approve target destruction, bootstrap-only cleanup, or
fixture retention; define tenant isolation, audit, failure recovery, and
post-cleanup verification.

## Application/financial-integrity conclusion

The source evidence does not identify a genuine supported workflow requiring
physical DELETE, so Option 1 remains technically plausible. Changes are
required for soft-delete authorization and classification of repository
delete capabilities. Full financial integrity approval is blocked by missing
isolated runtime/database evidence for atomicity, idempotency, concurrency,
rollback, and cleanup invariants.

**Sign-off:** `PENDING — not recorded`  
**Conditions:** Resolve APP-02 through APP-05 and record explicit approval or
requested changes in the authoritative decision record.  
**Review date/signature:** Not recorded.
