---
title: Invoice Runtime and Document Lifecycle Campaign
date: 2026-11-06
time: 21-16-49
status: Partially complete / runtime blocked
---

# Campaign Record

## Scope

Close only the remaining invoice acceptance gaps: finalized sales PDF generation/storage/retrieval/retry, supplier-original document lifecycle, actual QR/barcode rendering, immutable snapshot-only historical rendering, and authenticated disposable runtime verification.

## Recovered state

- Previous campaign remains `PARTIALLY COMPLETE / NOT RELEASE-READY`.
- Current source contains migration `0017_invoice_modernization_artifacts`, snapshot/hash persistence, A4 landscape print CSS, stable reference helpers, and Indian amount-in-words conversion.
- No PDF artifact service, supplier-document model, actual QR/barcode renderer, snapshot-only print projection, browser E2E harness, or active disposable runtime target is currently present.
- Current worktree contains prior uncommitted campaign changes; they are preserved and will not be reverted.

## Plan and gates

1. Define the smallest provider-independent document lifecycle contracts and persistence additions.
2. Implement offline-testable PDF/supplier-document/QR-barcode/snapshot rendering seams without claiming runtime success.
3. Add focused regression contracts for authorization, idempotency, replacement history, stable references, and snapshot-only rendering.
4. Run typecheck, lint, build, focused tests, full regression, and diff checks.
5. Attempt only read-only runtime discovery; do not select or mutate shared/production infrastructure.

## Explicit non-goals

- No production/shared migration, storage, deployment, or Live Supabase operation.
- No reopening of GST/T13/T19/T25 policy or Version 2 scope.
- No acceptance claim without actual disposable database/storage/browser read-back.

## Implementation evidence — 2026-11-06T21-27-35 IST

- Added `purchase_supplier_documents` persistence and forward-only migrations `0018_supplier_invoice_documents` and `0019_invoice_document_lifecycle_metadata`.
- Added tenant-scoped supplier document validation, private storage keys, checksum metadata, authorized retrieval, and append-only replacement history.
- Added optional supplier PDF/image upload to the purchase form; upload failure does not roll back an already-created purchase.
- Added deterministic finalized-sales PDF generation from `finalized_snapshot`, private storage upload, persisted `PENDING`/`GENERATING`/`READY`/`FAILED` lifecycle metadata, missing-object recovery, retry safety, and signed retrieval.
- Added actual QR and Code 128 barcode image rendering to finalized print output and PDF output. The QR is explicitly an internal Pharmnos Lite verification reference, not a statutory QR.
- Finalized historical print projection now uses persisted snapshot seller, buyer, lines, totals, dates, tax and references rather than mutable master records. Legacy/non-finalized invoices retain the existing compatibility path and are not claimed as snapshot-only.
- Refreshed the governed disposable baseline, security/RLS artifact coverage, and artifact manifest hashes for the new supplier-document model.

## Verification evidence

- Prisma schema validation and client generation: passed.
- TypeScript typecheck: passed.
- Changed-file ESLint: passed with no errors.
- Focused invoice/finalization contracts: 13/13 passed.
- Invoice document lifecycle contracts: 5/5 passed.
- Provisioning/governance contracts: 27/27 passed; static guard reports `PASS`, 34 RLS tables.
- Production build: passed.
- `git diff --check`: passed.
- Full JavaScript regression after artifact refresh: 286/286 passed.

## Runtime and acceptance boundary

- Docker reported no active disposable target during recovery. No database migration, storage upload/read-back, browser E2E, QR decode, PDF read-back, or production/shared operation was performed.
- Independent financial/security acceptance remains open; the unsupported reviewer from the prior campaign was not fabricated as having run.
- Final campaign decision: `PARTIALLY COMPLETE / BLOCKED FOR RUNTIME ACCEPTANCE`.
