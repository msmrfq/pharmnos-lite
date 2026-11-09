---
title: Aging and finalized invoice integrity correction
date: 2026-11-09
status: Offline verified
---

## Goal

Correct customer and supplier invoice aging and protect finalized sales-invoice due dates at the existing application mutation boundaries. This is not financial-reconciliation or production-readiness acceptance.

## Acceptance Criteria

- [x] Apply due-date calendar aging using exclusive current, 1-30, 31-60, 61-90, and over-90-day buckets for both counterparties.
- [x] Preserve outstanding totals and include both 91-120 and older amounts in the over-90 summary.
- [x] Reject a finalized sales invoice's changed due date at the tenant-scoped repository boundary, while allowing draft edits and unchanged values.
- [x] Prevent the identified status-demotion and draft-cancellation paths from bypassing the application guard.
- [x] Exercise boundaries, original regression, neighboring behavior, and simulated races offline; obtain independent review.
- [x] Pass the focused and neighboring offline suite, typecheck, lint, and worktree preservation checks.

## Out of Scope

Payment and allocation policy, refunds, GST, ledger redesign, historical restatement, database access and migrations, recovery, deployment, and production acceptance. No owner decision was changed.

## Root causes and correction

Both aging paths treated the first 30 overdue days as current and put 91-120 days in `d90`, but omitted `d90` from `bucket_over_90`. Their timestamp comparisons also depended on time of day. The repository now compares calendar dates, interprets form-derived persisted date-only values by their UTC date, and maps the five existing exclusive ranges correctly. Existing `current_30` remains the combined not-overdue and 1-30 summary; report tables, statements, badges, and CSVs display current separately from 1-30. Sales due dates now use UTC calendar-day addition so date-only inputs do not shift when payment terms cross a daylight-saving transition.

The generic sales repository omitted due-date protection. Its tenant-qualified atomic update now permits a finalized due date only when unchanged, and rejects status demotion from finalized. Draft cancellation also requires `DRAFT` in its atomic update predicate, closing a cancellation/finalization race. Normal rollups, unchanged dates, draft changes, tenant scoping, and nested update inputs are retained. The guard covers the repository and the traced application paths, not arbitrary direct Prisma or SQL writes.

## Files changed

- `src/repositories/ledger.repository.ts`: aging, oldest-overdue calendar arithmetic, and summary mapping.
- `src/repositories/sales-invoice.repository.ts`: atomic due-date and finalized-status protection.
- `src/app/_actions/sales.actions.ts`: date-only due-date derivation and conditional draft cancellation.
- `src/app/_actions/exports.actions.ts`, `src/app/customers/[customerId]/statement/print/page.tsx`, `src/app/customers/page.tsx`, `src/app/reports/customer-dues/page.tsx`, `src/app/reports/supplier-payables/page.tsx`, `src/app/reports/page.tsx`, and `src/app/page.tsx`: matching existing aging consumers and descriptions.
- `tests/ledger-aging.test.mjs`, `tests/sales-invoice-due-date-immutability.contract.test.mjs`, and `tests/cancel-sales-draft-action.test.mjs`: offline regression tests.
- `.obsidian-vault/CLAUDE.md`: current-session status; mirrors were not edited.

## Verification

On 2026-11-09, offline:

```powershell
node --test tests\ledger-aging.test.mjs tests\sales-invoice-due-date-immutability.contract.test.mjs tests\cancel-sales-draft-action.test.mjs tests\financial-e2e-sales-immutability-provisioning.test.mjs tests\sales-finalization-integrity-contract.test.mjs tests\financial-reconciliation-foundation-contract.test.mjs tests\financial-reconciliation-receipt-provisioning.test.mjs
pnpm typecheck
pnpm lint
git --no-pager diff --check
```

The seven-file test command passed **56/56** with zero skipped; typecheck, lint, and diff check passed. The focused tests independently exercise both parties at individual boundary-adjacent ages, the original 10-day/100-day reproduction, UTC date-only and DST cases, mocked repository updates, and the actual cancellation action with a simulated finalization race. These mocks do not prove PostgreSQL execution, locking, transactions, RLS, or Auth.

The independent read-only reviewer initially found three material issues: date-only timezone interpretation, repository status rollback, and a cancellation/finalization race. The revised implementation addressed these and the reviewer accepted the integrated correction, with a minor historical-date caveat. The reviewer independently ran the three new suites (29/29); no database was accessed.

## Limitations and remaining risks

- Historical due-date timestamps created using the old local-time calculation may be shifted across DST boundaries; their originating timezone and impact are unknown. No historical data was inspected or rewritten.
- Direct Prisma or SQL writes outside the traced application paths are not protected by a production database trigger; no database-level immutability claim is made.
- No PostgreSQL, Supabase, Auth, persistence, transaction, concurrent runtime, RLS, or browser verification was performed. Any future database verification requires separate explicit authorization and a fresh isolated immutable target contract.
- Strict historical as-of/restatement semantics and full financial-reconciliation acceptance remain outside this correction.

## Worktree preservation

Baseline HEAD was `4c73beed70166f765c3cbf0b7edef16f9ce9fcd5`; staged and unstaged diffs were initially empty. A pre-change hash manifest covered 1,438 tracked and non-ignored untracked files. Final comparison permits only the explicitly listed campaign files; generated TypeScript build-cache changes were restored to the verified pre-change hash. HEAD and staged contents remain unchanged. No commit, deployment, or database operation was performed.
