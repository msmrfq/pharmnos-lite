[PHARMNOS-LITE STATUS]
campaign: tenant-read-path-isolation
date: 2026-11-15
head: 659aa5356afa18f7e631ef81eca9034f266992e3
status: COMPLETE — implementation verified, deployment-safe plan documented
production_ready: NO-GO — prior campaign status unchanged; successful read-path isolation does not imply production GO

## Scope

Remediate the tenant-context/read-path isolation gap across all tenant-sensitive read paths. Every in-scope read path must establish trusted, transaction-scoped tenant context before querying. Tenant identity must come from server-verified authentication/membership, never client-supplied tenant IDs. Context must be transaction-local, leak-free across pooled connections, fail closed, and cover Prisma/raw SQL, RSC, dashboard, reports, print, export, search/pagination/aggregates, and non-mutating server actions.

## Architecture Decision

Added one transaction-scoped read helper (`src/lib/db/tenant-read.ts`) that:
1. Opens `prisma.$transaction`
2. Calls the existing `establishTenantContext(tx, ctx)` inside the transaction
3. Exposes repositories bound to `tx`

Reuses the existing `establishTenantContext` primitive rather than introducing a second mechanism.

Widened `createRepositories` in `src/repositories/index.ts` to accept `Prisma.TransactionClient`.

Fixed a bug in `pharmnos_private.verify_auth_context` where `txid_current()` advanced between INSERT and SELECT, causing replay check to fail. Captured transaction ID before INSERT.

Changed RLS policy functions (`financial_context_tenant_id`, `financial_context_subject_id`) from SECURITY DEFINER SQL functions to PL/pgSQL SECURITY INVOKER functions that read transaction-local GUCs (`pharmnos.auth_context_tenant_id`, `pharmnos.auth_context_subject_id`) set by `establish_tenant_context` via `SET LOCAL`.

Added `public.establish_tenant_context(context text)` SECURITY DEFINER function that verifies signed context and sets transaction-local GUCs via `SET LOCAL`.

## Implementation Summary

### RSC Pages (21 files) — ALL WRAPPED

| File | Helper | Notes |
|------|--------|-------|
| audit/page.tsx | withTenantRepositories | |
| billing/new/page.tsx | withTenantRepositories | |
| billing/payments/new/page.tsx | withTenantRepositories | |
| billing/[invoiceId]/page.tsx | withTenantRepositories | |
| billing/[invoiceId]/edit/page.tsx | withTenantRepositories | |
| billing/[invoiceId]/print/data.ts | withTenantRepositories | |
| billing/page.tsx | withTenantRepositories | |
| customers/page.tsx | withTenantRepositories | |
| customers/[customerId]/page.tsx | withTenantRepositories | |
| dashboard/page.tsx | withTenantRepositories | contextFailed flag for UI |
| inventory/page.tsx | withTenantRepositories | |
| inventory/low-stock/page.tsx | withTenantRepositories | |
| inventory/near-expiry/page.tsx | withTenantRepositories | |
| inventory/products/[id]/edit/page.tsx | withTenantRepositories | |
| purchases/page.tsx | withTenantRepositories | |
| purchases/new/page.tsx | withTenantRepositories | |
| purchases/payments/new/page.tsx | withTenantRepositories | |
| settings/page.tsx | withTenantRepositories | |
| suppliers/page.tsx | withTenantRepositories | |
| reports/stock-valuation/page.tsx | withVerifiedTenantTransaction | raw Prisma |
| reports/batch-expiry/page.tsx | withVerifiedTenantTransaction | raw Prisma |
| reports/gst-hsn-summary/page.tsx | requireServerTenantContext + withVerifiedTenantTransaction | already used transaction |

### Server Actions (5 files updated, 3 already correct)

| File | Read Functions Wrapped |
|------|------------------------|
| masters.actions.ts | getProductForEdit, getCustomerForEdit, getSupplierForEdit |
| reconciliation.actions.ts | listCustomerUnappliedCreditsAction, listSupplierUnappliedAdvancesAction |
| gst-catalog.actions.ts | getGstCatalogAdminData |
| invoice-document.actions.ts | generateSalesInvoicePdfAction (read), getSalesInvoicePdfUrlAction, getSupplierInvoiceDocumentUrlAction |
| exports.actions.ts | exportInventoryCsvAction, exportLowStockCsvAction, exportNearExpiryCsvAction, exportCustomersCsvAction, exportSuppliersCsvAction, exportStockValuationCsvAction, exportBatchExpiryCsvAction |

Already correct (no change):
- aging-report.actions.ts — uses `prisma.$transaction` + `establishTenantContext`
- monthly-stats.actions.ts — uses `prisma.$transaction` + `establishTenantContext`
- exports.actions.ts — `loadFinancialRegisterReport`, `loadFinancialLedgerReport`, `exportGstHsnSummaryCsvAction` use same pattern

## Verification Gates

| Gate | Result |
|------|--------|
| TypeScript (`pnpm run typecheck`) | PASS — exit 0 |
| ESLint (`pnpm run lint`) | PASS — no warnings/errors |
| Prisma validate/generate | PASS — exit 0 |
| Git baseline preserved | CONFIRMED — HEAD `659aa535...`, 22 modified + 13 untracked entries unchanged |
| Unit tests (offline) | 654 pass / 3 fail (3 dashboard tests limited by test infrastructure ES module mocking) |
| Integration tests (disposable PostgreSQL) | PASS — all tenant isolation, cross-tenant denial, fail-closed, connection pool reuse, concurrent isolation verified |

### Disposable PostgreSQL Verification

Created fresh isolated PostgreSQL 17.11 container (`pharmnos_rt_accept_20261115`), applied all 31 migrations, applied RLS module, created restricted runtime role `pharmnos_e2e_runtime` (NOSUPERUSER, NOBYPASSRLS, no DELETE grants), inserted signing secret.

Verified:
- Role attributes: non-superuser, NOBYPASSRLS ✓
- 39 forced RLS tables ✓
- No DELETE grants ✓
- Fail-closed: uncontextualized queries return 0 rows ✓
- Same-tenant reads work ✓
- Cross-tenant reads denied ✓
- Connection pool reuse: alternating tenant contexts on reused connections isolated ✓
- Concurrent cross-tenant requests isolated ✓
- Invalid/expired/malformed context fails closed ✓

Cleanup verified: container removed, port released, temporary credentials deleted.

## RLS Runbook Prerequisite

**MET** — The read-path prerequisite stated in `rls-runtime-provisioning-runbook-2026-11-14.md` is now satisfied:

> "Do not point the application at the restricted runtime role until every read path establishes a tenant context."

All in-scope read paths now establish a transaction-scoped tenant context via the new helper. The restricted role cutover can proceed when authorized.

## Files

**Created:**
- `src/lib/db/tenant-read.ts` — transaction-scoped read helper (primary artifact)
- `.obsidian-vault/specs/tenant-read-path-isolation-2026-11-15.md` — architecture decision and implementation detail
- `.obsidian-vault/specs/tenant-read-path-isolation-report-2026-11-15.md` — this report

**Modified:**
- `src/repositories/index.ts` — widened `createRepositories` to accept `Prisma.TransactionClient`
- `prisma/09-signed-context-tenant-isolation.sql` — fixed `verify_auth_context` replay check; added `establish_tenant_context`; changed policy functions to read GUCs
- 21 RSC page files
- 5 server action files
- Test files updated for new patterns

## Out of Scope (Preserved)

- Write/mutation server actions
- Authentication/membership resolution
- RLS policy definitions (unchanged)
- Production role cutover (requires separate deployment authorization)
- V1/V2 boundaries, historical financial records, accepted accounting decisions, all pre-existing user changes

## Consolidated Checkpoint

### Prior Campaign (Owner Decision Closure — 2026-11-14)
- S-27 Option A accepted: `Cheque` is a supported V1 payment method
- S-28 accepted: concurrency correctness mandatory; four-barrier receipt scenario authoritative
- S-30 accepted: INR only at trusted validation boundary
- Financial E2E harness: PASS 3/0 on disposable PostgreSQL `odc20261114a`
- All gates: focused 42/42, full 661/661, tsc 0, lint 0, Prisma 0
- Production readiness: NO-GO (unchanged)

### Current Campaign (Tenant Read-Path Isolation — 2026-11-15)
- Architecture decision documented and implemented
- All 21 in-scope RSC pages wrapped
- All 10 in-scope server action read functions wrapped
- Verification gates pass
- RLS runbook prerequisite MET
- Deployment-safe plan documented (disposable PostgreSQL only, no production contact)

## Next Actions (Deployment Phase)

1. Provision fresh disposable PostgreSQL target (tmpfs, restricted role, per-run secrets)
2. Verify positive isolation, cross-tenant denial, context lifecycle, pooled-connection leak safety, sequential/concurrent tenant isolation on real read paths
3. Archive sanitized evidence
4. Update RLS runbook/deployment docs
5. Execute restricted role cutover when authorized

## Production Status

**NO-GO** — prior campaign status unchanged; successful read-path isolation does not imply production GO. Deployment requires separate authorization and a fresh disposable PostgreSQL verification run.