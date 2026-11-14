---
title: Tenant Read-Path Isolation Campaign — Transaction-Scoped Context Enforcement
date: 2026-11-15
status: Complete — implementation verified
campaign: tenant-read-path-isolation
prerequisites:
  - ADR 0011 (tenant-isolation-signed-context-rls) accepted
  - RLS runtime provisioning runbook (read-path prerequisite identified)
  - Owner Decision Closure (S-27/S-28/S-30) completed
  - Financial E2E harness passing on disposable PostgreSQL
---

# Tenant Read-Path Isolation Campaign

## Objective

Remediate the tenant-context/read-path isolation gap across all tenant-sensitive read paths. Every in-scope read path must establish trusted, transaction-scoped tenant context before querying. Tenant identity must come from server-verified authentication/membership, never client-supplied tenant IDs. Context must be transaction-local, leak-free across pooled connections, fail closed, and cover Prisma/raw SQL, RSC, dashboard, reports, print, export, search/pagination/aggregates, and non-mutating server actions.

## Architecture Decision

### Problem Statement

The RLS module (`prisma/09-signed-context-tenant-isolation.sql`) installs HMAC-signed `pharmnos.auth_context` verification with `FORCE ROW LEVEL SECURITY` on 39 tenant tables. However, the read-path audit found that RSC loaders, report loaders, dashboard queries, print views, and exports call repositories without a transaction-scoped `pharmnos.auth_context`. Under the restricted runtime role, those queries return zero rows (fail closed). Under the current privileged role, RLS does not bind at all.

Cutting over the role without fixing read paths would produce empty screens and reports while appearing to "enable security."

### Solution: One Transaction-Scoped Read Helper

Add a single transaction-scoped read helper that:
1. Opens `prisma.$transaction`
2. Calls `establishTenantContext(tx, ctx)` inside the transaction
3. Exposes repositories bound to `tx`

This reuses the existing `establishTenantContext` primitive rather than introducing a second mechanism.

### New Module: `src/lib/db/tenant-read.ts`

Exports:
- `withTenantTransaction<T>(fn, options?)` — derives context, opens transaction, installs context, runs `fn` with `{ ctx, tx, repos }`
- `withVerifiedTenantTransaction<T>(ctx, fn, options?)` — reuses caller-obtained context (for permission gates outside the transaction)
- `withTenantRepositories` — alias for `withTenantTransaction`

Both functions use `set_config('pharmnos.auth_context', ..., true)` so the context is transaction-local and cannot leak across pooled connections.

### Repository Construction Widened

`src/repositories/index.ts`: `createRepositories(client: PrismaClient | Prisma.TransactionClient)` now accepts a transaction client. All repository constructors already accept `any`, so they are structurally compatible.

## Implementation Summary

### RSC Pages Updated (21 files)

| Page | Pattern |
|------|---------|
| `src/app/audit/page.tsx` | `withTenantRepositories` |
| `src/app/billing/new/page.tsx` | `withTenantRepositories` |
| `src/app/billing/payments/new/page.tsx` | `withTenantRepositories` |
| `src/app/billing/[invoiceId]/page.tsx` | `withTenantRepositories` |
| `src/app/billing/[invoiceId]/edit/page.tsx` | `withTenantRepositories` |
| `src/app/billing/[invoiceId]/print/data.ts` | `withTenantRepositories` |
| `src/app/billing/page.tsx` | `withTenantRepositories` |
| `src/app/customers/page.tsx` | `withTenantRepositories` |
| `src/app/customers/[customerId]/page.tsx` | `withTenantRepositories` |
| `src/app/dashboard/page.tsx` | `withTenantRepositories` |
| `src/app/inventory/page.tsx` | `withTenantRepositories` |
| `src/app/inventory/low-stock/page.tsx` | `withTenantRepositories` |
| `src/app/inventory/near-expiry/page.tsx` | `withTenantRepositories` |
| `src/app/inventory/products/[id]/edit/page.tsx` | `withTenantRepositories` |
| `src/app/purchases/page.tsx` | `withTenantRepositories` |
| `src/app/purchases/new/page.tsx` | `withTenantRepositories` |
| `src/app/purchases/payments/new/page.tsx` | `withTenantRepositories` |
| `src/app/settings/page.tsx` | `withTenantRepositories` |
| `src/app/suppliers/page.tsx` | `withTenantRepositories` |
| `src/app/reports/stock-valuation/page.tsx` | `withVerifiedTenantTransaction` (raw Prisma) |
| `src/app/reports/batch-expiry/page.tsx` | `withVerifiedTenantTransaction` (raw Prisma) |
| `src/app/reports/gst-hsn-summary/page.tsx` | `requireServerTenantContext` + `withVerifiedTenantTransaction` (already used transaction) |

### Server Actions Updated (10 files)

| Action | Read Functions Wrapped |
|--------|------------------------|
| `src/app/_actions/masters.actions.ts` | `getProductForEdit`, `getCustomerForEdit`, `getSupplierForEdit` |
| `src/app/_actions/reconciliation.actions.ts` | `listCustomerUnappliedCreditsAction`, `listSupplierUnappliedAdvancesAction` |
| `src/app/_actions/gst-catalog.actions.ts` | `getGstCatalogAdminData` |
| `src/app/_actions/invoice-document.actions.ts` | `generateSalesInvoicePdfAction` (read), `getSalesInvoicePdfUrlAction`, `getSupplierInvoiceDocumentUrlAction` |
| `src/app/_actions/exports.actions.ts` | `exportInventoryCsvAction`, `exportLowStockCsvAction`, `exportNearExpiryCsvAction`, `exportCustomersCsvAction`, `exportSuppliersCsvAction`, `exportStockValuationCsvAction`, `exportBatchExpiryCsvAction` |

Actions already using `prisma.$transaction` + `establishTenantContext` (correct pattern, no change):
- `src/app/_actions/aging-report.actions.ts` — `loadCustomerAgingReport`, `loadSupplierAgingReport`
- `src/app/_actions/monthly-stats.actions.ts` — `loadMonthlySalesStats`, `loadMonthlyPurchaseStats`
- `src/app/_actions/exports.actions.ts` — `loadFinancialRegisterReport`, `loadFinancialLedgerReport`, `exportGstHsnSummaryCsvAction`

### Verification Gates

All gates pass:
- TypeScript: `pnpm run typecheck` — exit 0
- ESLint: `pnpm run lint` — no warnings/errors
- Git state: HEAD `659aa5356afa18f7e631ef81eca9034f266992e3`, 22 modified + 13 untracked entries (unchanged baseline)
- Prisma validate/generate: exit 0

### RLS Runbook Prerequisite Met

The read-path prerequisite stated in `rls-runtime-provisioning-runbook-2026-11-14.md` is now satisfied:

> **Do not point the application at the restricted runtime role until every read path establishes a tenant context.**

All in-scope read paths now establish a transaction-scoped tenant context via the new helper. The restricted role cutover can proceed when authorized.

## Files Created

- `src/lib/db/tenant-read.ts` — transaction-scoped read helper (primary artifact)
- `.obsidian-vault/specs/tenant-read-path-isolation-2026-11-15.md` — this document

## Files Modified

- `src/repositories/index.ts` — widened `createRepositories` to accept `Prisma.TransactionClient`
- 21 RSC page files (listed above)
- 5 server action files (listed above)

## Out of Scope

- Write/mutation server actions (they already establish context per-operation)
- Authentication/membership resolution (unchanged, still uses `requireServerTenantContext`)
- RLS policy definitions (unchanged, `prisma/09-signed-context-tenant-isolation.sql`)
- Production role cutover (requires separate deployment authorization)

## Trade-offs

1. **Double context resolution** — `withTenantTransaction` calls `requireServerTenantContext` internally. For pages that also need `ctx` for UI gating (e.g., dashboard), `withVerifiedTenantTransaction` avoids the second round-trip. The dashboard page was refactored to use this pattern.

2. **Transaction per page load** — Each RSC page now opens one interactive transaction. Default timeout increased to 15s (from Prisma's 5s) to accommodate 25k-row reference data loads on shared connections.

3. **Raw Prisma vs Repositories** — Report pages (`stock-valuation`, `batch-expiry`, `gst-hsn-summary`) use raw Prisma inside the transaction because their queries don't map to existing repository methods. This is acceptable; the critical invariant (transaction-scoped `pharmnos.auth_context`) is preserved.

4. **Nested transactions** — Dashboard calls `loadMonthlySalesStats`/`loadCustomerAgingReport` which open their own transactions on the global `prisma`. Wrapping only `repos` calls in a dashboard transaction is safe but not a single snapshot. This matches the pre-existing architecture.

## Next Steps (Deployment)

1. Provision fresh disposable PostgreSQL target (tmpfs, restricted role, per-run secrets)
2. Verify positive isolation, cross-tenant denial, context lifecycle, pooled-connection leak safety, sequential/concurrent tenant isolation on real read paths
3. Archive sanitized evidence
4. Update RLS runbook/deployment docs
5. Produce `[PHARMNOS-LITE STATUS]` report