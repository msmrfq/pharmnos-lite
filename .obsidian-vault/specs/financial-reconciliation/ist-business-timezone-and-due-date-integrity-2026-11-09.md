---
title: IST business timezone and due-date integrity
date: 2026-11-09
status: Partially verified
---

## Goal

Establish Asia/Kolkata as the business-timezone policy and correct the audited invoice and aging paths without accessing or changing historical data.

## Acceptance Criteria

- [x] Define IST calendar dates and distinguish date-only values from actual instants.
- [x] Correct customer and supplier aging and their oldest-overdue cutoffs to use the current IST calendar date.
- [x] Verify due-date calendar addition, finalized-invoice guard, cancellation behavior, and relevant date presentation offline across process timezones.
- [x] Document historical risks, independent review, and worktree preservation.
- [ ] Establish and verify the policy throughout all financial paths: mixed ledger date representations remain unresolved.

## Out of Scope

Database access, historical updates, backfills, migrations, provider operations, GST calculations, payment policy, authentication redesign, inventory, and recovery.

## Policy and implementation

Asia/Kolkata is the canonical timezone for obtaining a business date from an instant and for displaying an actual timestamp. A financial date-only value is a calendar date, not an instant. Current invoice date-only values use a UTC-midnight `DateTime` marker whose UTC date components encode that calendar date; UTC here is a storage encoding, not the business timezone. Calendar addition uses calendar fields, not elapsed 24-hour durations across timezone transitions. VPN exit location does not determine the operating system, browser, Node, or database timezone.

`src/lib/utils/business-date.ts` defines explicit IST today and instant formatting and UTC-marker business-date formatting. `src/repositories/ledger.repository.ts` uses the IST calendar day for aging and its overdue-query cutoff. Existing sales due-date derivation retains UTC-calendar addition on date markers, and the previous tenant-scoped finalized-date guard and draft-cancellation race protection remain unchanged. Invoice and payment-form date defaults, selected invoice and register date displays, relevant CSV dates and filenames, and dashboard instants now use the explicit helpers.

## Historical integrity investigation

**Confirmed code defects:** Before this mission aging derived today's calendar date from the server timezone while interpreting due dates from UTC components. Date defaults used UTC rather than IST, and multiple invoice displays used the host timezone. These are reproducible offline and can lead to different displayed dates or aging around timezone boundaries.

**Plausible but unverified historical impact:** Prior sales due-date derivation used local `setDate` on UTC-midnight date-only inputs; in a DST-observing runtime it could cross a UTC day boundary. Purchases copied their invoice date, but date parsing and host-local display could also produce discrepancies for some inputs or environments. Both invoice fields are Prisma `DateTime` backed by PostgreSQL `TIMESTAMP(3)` in the generated schema. Existing timestamps alone do not prove the intended business date or creation timezone. No individual incorrect row has been established.

**VPN hypothesis:** VLESS, V2Ray, and sing-box alter routing; a VPN exit location alone is not evidence that the OS, browser, runtime, or database timezone changed.

**Future investigation:** If explicitly authorized, inspect a read-only, isolated copy using invoice and due dates, creation/update timestamps, available source documents and audit events, payment terms, and historical server/browser timezone configuration. Compare against original business documents; do not infer a correction from VPN routing or bulk-shift timestamps. Some rows may remain ambiguous without provenance.

## Independent review and unresolved limitation

The independent reviewer accepted the bounded aging and invoice changes without an introduced high-confidence finding, while identifying a material pre-existing daybook limitation for app-wide acceptance. The same ledger `entry_date` stores both UTC-midnight invoice/date-only markers and actual instants: sales and purchase posting copy invoice dates, opening balances and reversals use `new Date()`, and payments can use either a supplied date or an instant fallback. Daybook and its CSV use UTC-day query bounds and host-local display/defaults. Switching all rows to IST instant bounds would misclassify date markers, while retaining marker bounds misclassifies actual instants near midnight. A row's stored data does not reliably identify its date kind, especially for payments.

No schema or historical migration is authorized in this mission, so this issue is not safely resolved and the **throughout Pharmnos Lite** criterion is not met. A separate owner-approved date-kind/effective-date design and historical-evidence policy is needed before claiming app-wide IST correctness. Existing arbitrary direct database writes remain outside the application-level finalized-date guard.

## Changed files

- `src/lib/utils/business-date.ts` and `src/repositories/ledger.repository.ts`: explicit IST and aging boundaries.
- `src/app/billing/new/_form.tsx`, `src/app/purchases/new/_form.tsx`, `src/app/billing/payments/new/_form.tsx`, and `src/app/purchases/payments/new/_form.tsx`: IST date defaults.
- `src/app/billing/page.tsx`, `src/app/billing/[invoiceId]/page.tsx`, `src/app/billing/[invoiceId]/print/page.tsx`, `src/app/purchases/page.tsx`, `src/app/reports/sales-register/page.tsx`, `src/app/reports/purchase-register/page.tsx`, `src/app/reports/page.tsx`, `src/app/customers/[customerId]/page.tsx`, `src/app/dashboard/page.tsx`, and `src/app/_actions/exports.actions.ts`: selected financial date and instant presentations.
- `tests/financial-ist-timezone.test.mjs` and `tests/ledger-aging.test.mjs`: timezone, date-marker, summary, cutoff, boundary, and date-derivation coverage.
- `.obsidian-vault/CLAUDE.md`: current-session status.

## Verification

Offline, with `TZ` separately set to `Asia/Kolkata`, `UTC`, and `America/New_York`:

```powershell
node --test --test-reporter=dot tests\financial-ist-timezone.test.mjs tests\ledger-aging.test.mjs tests\sales-invoice-due-date-immutability.contract.test.mjs tests\cancel-sales-draft-action.test.mjs
```

Each run passed **38/38**, with no database access. The tests execute actual repository code with mocked Prisma and inspect the query cutoff; they do not prove PostgreSQL behavior or real concurrent transactions. The invoice date tests cover IST midnight, every requested bucket boundary for both counterparties, calendar addition over month/year/leap transitions, and unchanged/draft/finalized protections.

Four neighboring offline contract files passed **27/27**:

```powershell
node --test tests\financial-e2e-sales-immutability-provisioning.test.mjs tests\sales-finalization-integrity-contract.test.mjs tests\financial-reconciliation-foundation-contract.test.mjs tests\financial-reconciliation-receipt-provisioning.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm lint
git --no-pager diff --check
```

Typecheck, lint, and diff check passed. No database, Auth, RLS, browser runtime, persistence, or concurrency verification was performed.

## Worktree preservation

The mission began at HEAD `4c73beed70166f765c3cbf0b7edef16f9ce9fcd5` with existing staged/unstaged/untracked work recorded separately. A SHA-256 baseline covers 1,442 existing tracked and non-ignored untracked files. Final preservation checks compare those hashes with the expected mission-owned changes and compare staged content and HEAD against the baseline. No commit or deployment was performed.
