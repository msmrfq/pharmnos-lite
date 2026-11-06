---
title: Invoice Modernization Campaign Charter
date: 2026-11-06
time: 20-48-02
status: Active
---

# Invoice Modernization Campaign Charter

## Mission

Modernize sales invoices, internal purchases, supplier documents, GST presentation, numbering, immutable finalized records, PDF/print retrieval, inventory and ledger integration, authorization, tenant isolation, UI validation, testing, and evidence without expanding into unrelated modules.

## Approved requirements

- Sales uses one default A4-landscape template with platform-managed footer, multi-page pagination, page numbering, compact continuation identity, stable QR/barcode identifiers, data-driven GST rows, pharmacy-oriented finalized line fields, reconciled totals, controlled document classification, amount-in-words, default terms, E.&O.E., and configured signatory/support details.
- Finalized invoices are immutable snapshots containing seller/buyer, identity, classification, lines, batch/expiry, tax, totals, round-off, terms, signatory, rendering version, generation metadata, and retained private PDF artifacts. Reprints use historical data. Corrections are authorized, linked, and auditable; direct edits and credit/debit notes are deferred.
- Numbering is allocated during finalization per business GST registration and financial year, unique and concurrency-safe, never reused, rollback-safe, and traceable.
- Purchases remain distinct internal records, capture supplier invoice number/date/amount and private original PDF/image documents, preserve declared versus calculated values, review/discrepancy state, audit history, and replacement history without silent deletion.
- PDF generation is server-side, A4 landscape, historical, private, idempotent, authorized, pagination-safe, and retryable after finalization failure.
- Preserve approved GST policies, exact-decimal contracts, and separate T13/T19/T25 boundaries.

## Version 2 boundaries

Imports/exports, SEZ/UIN, RCM, e-invoicing/e-way bills, GST returns, ITC reconciliation, credit/debit notes, multiple GST registrations, and exceptional workflows remain deferred.

## Safety and change control

Preserve all Git changes; no reset, checkout, clean, stash, commit, push, production deployment, production/shared schema mutation, destructive reset, credential exposure, tenant-isolation weakening, or security downgrade. Forward-only migrations may be created but only disposable isolated databases may be mutated.

## Success

Implement and evidence the supported lifecycle. Distinguish implemented, static/test verified, runtime verified, and independently accepted. Report unavailable infrastructure as evidence gaps.
