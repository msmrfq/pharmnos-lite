---
title: Invoice Domain Baseline
date: 2026-11-06
time: 20-48-02
status: Investigated
---

# Invoice Domain Baseline

Sales currently centers on `sales.actions.ts`, `sales-invoice.repository.ts`, GST services, billing pages and print data. Purchases center on `purchases.actions.ts`, `purchase-invoice.repository.ts`, purchase calculation/reconciliation, purchase pages, supplier references and valuation services. Print rendering exists at the billing print route; private storage is abstracted behind storage adapters and tenant-safe paths.

Existing evidence already covers portions of immutable sales/purchase posting, GST precision, supplier invoice uniqueness, finalized purchase immutability, and target-bound financial safety. The campaign must extend rather than duplicate those contracts.

Open architecture questions: complete finalized sales snapshot persistence, retained PDF artifacts, generation retry state, document classification authority, numbering scope, supplier document history, and authenticated browser coverage.
