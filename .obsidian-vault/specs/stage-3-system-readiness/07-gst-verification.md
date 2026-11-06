---
title: Pharmnos Lite Stage 3 GST Verification
date: 2026-11-07
time: 02-25-00
status: Investigated — not independently accepted
---

# GST verification

## Engineering findings

- Exact-decimal arithmetic is implemented for supported sales and purchase calculations.
- CGST/SGST and IGST paths are implemented with place-of-supply validation.
- Supplier-declared, calculated, accepted, and revision-linked purchase GST values are separated.
- Stale revision checks and accepted-value snapshots protect purchase finalization.
- Cess, UTGST, inclusive pricing, several statutory treatments, and ITC reconciliation are fail-closed, deferred, or policy/professional dependencies.

## Evidence

Relevant source: `src/domain/services/gst-calculator.service.ts`, `src/domain/services/purchase-calculator.service.ts`, `src/domain/services/purchase-gst-reconciliation.service.ts`, `src/lib/gst/place-of-supply.ts`, purchase/sales actions, and GST contract tests.

## Acceptance boundary

Engineering correctness for supported Regular exclusive workflows may be verified by focused tests and target-bound runtime. It must not be presented as complete GST compliance or professional/statutory approval. Current-source target-bound execution and independent review remain required for ST3-D.

