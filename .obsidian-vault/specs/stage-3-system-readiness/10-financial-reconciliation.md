---
title: Pharmnos Lite Stage 3 Financial Reconciliation
date: 2026-11-07
time: 02-25-00
status: Source findings only — runtime reconciliation pending
---

# Reconciliation scope

The required reconciliation chain is:

`purchase/sales source document → accepted GST values → batch quantity/value → stock movement → supplier/customer ledger → payment/balance → audit/idempotency record`.

Current source has transactional purchase/sales finalization, supplier/customer balance locks, accepted GST snapshots, and idempotency records. Risks requiring remediation or evidence include no distinct goods receipt, null purchase movement rate, free-quantity semantics, non-atomic multi-movement service operations, payment semantic/tenant constraints, and no database posting uniqueness invariant for every ledger path.

No current Stage 3 runtime reconciliation is claimed from this document. Synthetic valuation tests and accepted invoice evidence remain separate evidence classes.

