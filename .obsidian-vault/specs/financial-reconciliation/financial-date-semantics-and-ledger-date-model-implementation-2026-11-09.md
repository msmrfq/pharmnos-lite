---
title: Financial date semantics and ledger date model implementation
date: 2026-11-09
status: Partially implemented - blocked
---

## Goal

Implement the owner-authorized IST business-date, event-instant, and recording-time model without guessing historical facts or changing accepted accounting invariants. This report distinguishes the retained implementation, offline checks, and unverified database and application behavior.

## Acceptance Criteria

- [ ] Schema/domain: additive model and typed temporal contracts implemented and statically validated **and migration runtime verified**.
- [ ] Write producers: all discovered financial writes use the approved event-specific rules.
- [ ] Read consumers: all in-scope reports, lists, and exports use consistent temporal semantics.
- [ ] Historical safety: ambiguous records are preserved and visibly qualified across all relevant paths.
- [ ] Regression verification: all required new and neighboring scenarios pass.
- [ ] Independent acceptance: reviewer accepts the implementation with no unresolved critical, major, or reproducible correctness issues.

## Out of Scope

Recovery, production or hosted databases, historical data rewrites, deployment, and unrelated accounting expansion.

## Status

[PHARMNOS-LITE STATUS]

Stage: Financial Date Semantics and Ledger Date Model — Implementation
Completion: 0/6 (0%)
Verdict: BLOCKED

Done:

- Authored an additive migration and partial producer, consumer, date-validation, and offline historical-classification changes.
- Added fail-closed behavior for unclassified dates and deliberately disabled customer-dues and supplier-payables pages and CSVs, as well as monthly financial summary cards, pending verified safe reads.
- Ran focused offline regression and static checks; no migration or database runtime claims are made.

Remaining:

- Resolve the generic ledger producer's ambiguous date contract and mixed-date balance calculations without guessing.
- Complete all producer and consumer coverage, report consistency, and requested regression scenarios.
- Obtain independent implementation acceptance and separately authorized runtime evidence.

Blockers:

- The generic [ledger-impact service](../../../src/domain/services/ledger-impact.service.ts) accepts a `Date` without reliably distinguishing a date-only value from an instant and computes balances using mixed legacy `entry_date` values. This matches the owner's explicit producer ambiguity stop condition. Its attempted changes were removed, restoring the frozen baseline.
- Customer-dues and supplier-payables lack a proven complete transaction-consistent population and snapshot. They are unavailable instead of displaying potentially misleading totals.
- No separately authorized new disposable database target exists. Commit-visible knowledge time is not proven.

Next:

- Resolve the producer contract and consistent-snapshot design without classifying ambiguous legacy values, then implement and independently review the remaining changes.
- Separately authorize a new uniquely identified disposable target before executing any database migration or runtime verification.

## Baseline and preservation

HEAD was `4c73beed70166f765c3cbf0b7edef16f9ce9fcd5`. The baseline captured binary staged and unstaged diffs, status, and SHA-256 hashes for 1,446 tracked and non-ignored untracked files in the session workspace. HEAD and the staged diff remain unchanged. The inventory below identifies the pre-existing files intentionally modified for this task, including three originally untracked files; unrelated pre-existing changes remain intact. The generated TypeScript build cache is restored to the verified baseline after checks. No Git commit, push, reset, clean, stash, or destructive checkout was performed.

## Implemented temporal contracts and migration

[Migration 0028](../../../prisma/migrations/0028_financial_event_dates/migration.sql) adds nullable `DATE` effective and due dates and nullable `TIMESTAMPTZ(3)` event and recording fields to the applicable invoices, payments, ledgers, allocations, reversals, and refund lifecycle. Legacy fields remain intact; no historical rows are backfilled. Database triggers assign and protect recording timestamps on inserts or relevant transitions. Constraints reject inconsistent derived dates and currently reject `EVIDENCE_CLASSIFIED` without a future authorized provenance mechanism. The generated empty-schema baseline and its offline review artifacts were updated; they are not a substitute for migration runtime testing.

[The date adapter](../../../src/lib/utils/business-date.ts) uses strict `YYYY-MM-DD` dates and UTC date-only markers for Prisma `@db.Date`, without host-local getters. Real system instants derive IST dates explicitly. The pure [temporal classifier](../../../src/domain/services/financial-temporal-classification.ts) independently models business date, occurrence, and recording evidence and exact exception amounts; it consumes externally verified attestations and does not validate real history or establish commit visibility.

## Producer and consumer coverage

| Surface | Retained implementation | Limitations |
|---|---|---|
| Sales/purchase invoices | New drafts carry explicit effective and due business dates; unclassified legacy drafts fail closed before finalization. | Generic writers and historical invoice provenance are not comprehensively resolved. |
| Payments and opening balances | Payment input is strictly date-only; undated payment and opening dates derive from the operation instant. Legacy payment retries lacking source provenance fail closed. | Runtime atomicity, midnight concurrency and existing legacy data remain unverified. |
| Allocations, reversals, refunds | The reconciliation service records event-specific dates and actual operation instants; refund request and completion remain distinct. | No database-backed or commit-visibility proof. |
| Generic ledger impact | Restored to frozen baseline. | Its `Date` input and legacy `entry_date` balance ordering remain ambiguous; do not treat it as migrated. |
| Daybook, customer statement, invoice registers and CSV | Canonical effective-date reads, strict unknown-date handling, stable order, shared filters and snapshot-oriented offline mocks; oversized populations fail closed. | No actual database snapshot, browser, or application-boundary verification. |
| Customer dues, supplier payables and their CSVs | Intentionally unavailable, rather than producing unverified complete totals. Summary surfaces show aging and monthly sales/purchase totals unavailable. | A complete transaction-consistent aging snapshot is not implemented or runtime verified; monthly summaries cannot yet safely classify legacy invoice dates. |
| Aging repository, payment credits/advances | Aging reads business due dates and rejects material unknowns; payment credit/advance date is nullable when unknown. | Current-state values are not strict historical as-of reconstruction; wider list/display coverage remains incomplete. |

No temporal fact is inferred from midnight appearance, `created_at`, VPN, or payment reference type. Exact real-world legacy exception counts and amounts are unknown because no database was accessed.

## Recording time, compatibility, and rollback

Database-assigned `recorded_at` and lifecycle-specific recording fields represent database insertion or transition acceptance before commit. They do **not** prove transaction commit visibility, commit ordering, or historical knowledge at that instant. Strict commit-visible as-of reporting remains unsupported. Old fields and new evidence are retained; any future rollback must switch reads safely while preserving and reconciling new writes, not drop data or reverse-transform history. Runtime migration, rollback, and mixed-version behavior require separate target authorization.

## Verification

- Offline integrated financial tests: **190 passed, 0 failed** across 25 selected files after the dashboard/summary monthly-date correction. The command was `pnpm exec node --test` with the following files:
  `tests/aging-report-fail-closed.test.mjs`, `tests/customer-advances-contract.test.mjs`, `tests/financial-business-date-adapter.test.mjs`, `tests/financial-customer-aging-unavailable.test.mjs`, `tests/financial-date-input-regression.test.mjs`, `tests/financial-effective-ledger-reports.test.mjs`, `tests/financial-ist-timezone.test.mjs`, `tests/financial-payment-date-consumers.test.mjs`, `tests/financial-reconciliation-foundation-contract.test.mjs`, `tests/financial-reconciliation-receipt-provisioning.test.mjs`, `tests/financial-temporal-classification.test.mjs`, `tests/financial-temporal-migration.contract.test.mjs`, `tests/invoice-business-date-finalization.test.mjs`, `tests/invoice-document-lifecycle.contract.test.mjs`, `tests/invoice-modernization-integrity-contract.test.mjs`, `tests/invoice-modernization.service.test.mjs`, `tests/ledger-aging-classification.test.mjs`, `tests/ledger-aging.test.mjs`, `tests/payment-integrity-contract.test.mjs`, `tests/payment-legacy-replay.test.mjs`, `tests/payment-receipt-sequencing-contract.test.mjs`, `tests/purchase-finalization-integrity-contract.test.mjs`, `tests/report-export-integrity-contract.test.mjs`, `tests/sales-invoice-due-date-immutability.contract.test.mjs`, and `tests/supplier-advances-contract.test.mjs`.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- `pnpm lint`: passed.
- `pnpm exec prisma validate --schema prisma/schema.prisma` with local placeholder URLs: valid; no connection made.
- `pnpm exec node scripts/generate-financial-e2e-schema.mjs --check`, `pnpm exec node scripts/financial-e2e-provisioning-static-guard.mjs`, `verifyCheckedInArtifactManifest(process.cwd())` from `scripts/financial-e2e-artifact-package.mjs`, and `git diff --check`: passed.
- Date-only adapter and parser tests exercise `Asia/Kolkata`, `UTC`, and `America/Los_Angeles`, including IST midnight and impossible dates. These are offline tests, not PostgreSQL date round-trip proof.
- The reviewer independently ran 125 focused tests during review. Actual authorized runtime scenarios, browser/application-boundary tests, concurrency tests, and all requested historical as-of scenarios were not completed.

## Independent review

The reviewer found and rechecked Major issues involving unclassified aging and registers, provenance acceptance, ambiguous generic ledger dates, and dashboard/summary masking of unavailable aging. Aging and register guards and evidence-basis rejection were implemented; ambiguous generic ledger work was restored to baseline and remains an explicit blocker. The reviewer confirmed the dashboard aging correction and found monthly sales/purchase summaries still used legacy invoice dates; the final review found no Critical or Major defects in the targeted summary-gating fix. Legacy payment replay now rejects records lacking trustworthy date-source provenance. The reviewer ran 14 report-gating and 125 temporal tests, but did not accept the overall implementation because the stop condition remains unresolved.

## Exact retained file inventory

- Schema and provisioning: `prisma/schema.prisma`, `prisma/migrations/0028_financial_event_dates/migration.sql`, `prisma/financial-e2e-artifact-manifest.json`, `prisma/financial-e2e-rls-policies.review.sql`, `prisma/financial-e2e-schema-provisioning.generated.sql`, `prisma/financial-e2e-security-controls.review.sql`, `scripts/financial-e2e-provision-local.mjs`, `scripts/financial-e2e-provisioning-static-guard.mjs`, `scripts/generate-financial-e2e-schema.mjs`.
- Producers and domain: `src/app/_actions/masters.actions.ts`, `src/app/_actions/purchases.actions.ts`, `src/app/_actions/sales.actions.ts`, `src/domain/services/financial-reconciliation.service.ts`, `src/domain/services/financial-temporal-classification.ts`, `src/lib/utils/business-date.ts`, `src/lib/validation/purchases.schemas.ts`, `src/lib/validation/sales.schemas.ts`.
- Readers and UI: `src/app/_actions/exports.actions.ts`, `src/app/customers/[customerId]/statement/print/page.tsx`, `src/app/customers/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/reports/customer-dues/page.tsx`, `src/app/reports/daybook/page.tsx`, `src/app/reports/page.tsx`, `src/app/reports/purchase-register/page.tsx`, `src/app/reports/sales-register/page.tsx`, `src/app/reports/supplier-payables/page.tsx`, `src/components/ui/export-csv-button.tsx`, `src/repositories/ledger.repository.ts`, `src/repositories/payment.repository.ts`.
- Tests: `tests/aging-report-fail-closed.test.mjs`, `tests/financial-business-date-adapter.test.mjs`, `tests/financial-customer-aging-unavailable.test.mjs`, `tests/financial-date-input-regression.test.mjs`, `tests/financial-effective-ledger-reports.test.mjs`, `tests/financial-ist-timezone.test.mjs`, `tests/financial-payment-date-consumers.test.mjs`, `tests/financial-temporal-classification.test.mjs`, `tests/financial-temporal-migration.contract.test.mjs`, `tests/invoice-business-date-finalization.test.mjs`, `tests/ledger-aging-classification.test.mjs`, `tests/ledger-aging.test.mjs`, `tests/payment-legacy-replay.test.mjs`.
- Documentation: this report and [the canonical briefing](../../CLAUDE.md). Generated briefing mirrors were not synchronized.

No historical rows were rewritten, no database was accessed, and no deployment was performed. Prisma Client generation ran offline during verification; it is not database or application-boundary evidence.

| Evidence class | Status |
|---|---|
| Implemented | Partial; generic ledger contract and snapshot remain blocked |
| Offline verified | Focused tests and static checks only |
| Runtime database verified | Not performed |
| Application-boundary verified | Not performed |
| Independently accepted | Targeted summary-gating fix reviewed; overall implementation not accepted |
