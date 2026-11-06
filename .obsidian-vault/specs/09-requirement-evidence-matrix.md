---
title: Invoice Modernization Requirement Evidence Matrix
date: 2026-11-06
time: 20-48-02
status: Accepted / independent acceptance complete
---

# Weighted Matrix

| Criterion | Weight | Status |
|---|---:|---|
| Sales lifecycle and presentation | 15 | Runtime verified through the target-bound application harness and authenticated browser finalization |
| Purchase and supplier document lifecycle | 15 | Runtime verified through application actions, private object read-back, replacement linkage, cross-tenant denial, and authenticated browser finalization |
| GST calculation and presentation | 15 | Runtime verified for accepted GST posting and persisted taxable/GST/total reconciliation |
| Numbering, finalization, immutable snapshots | 15 | Runtime verified for finalization, duplicate protection, persisted snapshot, and historical master-data stability |
| PDF, printing, reproducibility | 15 | Runtime verified for persisted private artifact, checksum/size, A4 landscape, application-artifact QR/Code128 decoding, and byte-stable reprint |
| Inventory, ledger, reconciliation | 10 | Verified through browser purchase-to-stock/supplier-ledger reconciliation plus focused synthetic valuation evidence for recoverable, non-recoverable, partial, unresolved, and correction paths; unresolved real-world eligibility remains explicitly `PENDING` |
| Security, authorization, tenant isolation | 5 | Runtime verified for restricted role and application-level cross-tenant invoice/document denial; session revocation is not a separate frozen criterion |
| Automated, integration, browser E2E | 5 | Authenticated browser purchase and sales draft/finalization passed on the continuous disposable target |
| Independent review and documentation | 5 | Independent security/evidence review completed; complete runtime-package acceptance remains open |
| **Total** | **100** | **100/100 verified; accepted** |

The denominator will not be reduced. The lead updates statuses only from evidence.

## Final campaign update

The continuous disposable campaign added authenticated browser purchase and sales mutations. Purchase `cmw5cb5gv000nm92u03egnu1k` finalized with 10 units received, `PURCHASE_IN`, supplier credit `944.00`, and pending valuation; sales `cmw5cgyja001xm92u0omxrp7t` finalized as `INV-00001` for `259.60`, GST `39.60`, reducing the batch from 10 to 8 and posting customer debit `259.60`. Focused valuation regressions verify the approved recoverable, non-recoverable, partial, unresolved, and correction behavior without claiming statutory eligibility. The follow-up independent review accepted all nine frozen criteria.
