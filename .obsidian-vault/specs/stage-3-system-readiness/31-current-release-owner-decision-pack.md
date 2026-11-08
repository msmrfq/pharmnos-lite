---
title: Pharmnos Lite Current-Release Owner Decision Pack
date: 2026-11-07
status: Owner decisions confirmed; bounded implementation completed
---

# Purpose

This pack isolates decisions that materially affect current-release financial
behavior. Engineering evidence is recorded separately from owner approval and
qualified professional/statutory confirmation.

## A. Goods receipt and free quantity

### Observed behavior and owner decision

Purchase input captures paid `quantity` and `free_qty`. The owner confirmed
that both values are part of the current-release receipt contract.

### Confirmed current-release policy

Paid quantity and free quantity remain separate
inputs, record both in the immutable purchase snapshot, and post total physical
quantity (`paid + free`) to stock and batch availability. Supplier payable and
purchase value remain based on paid quantity and approved purchase rates.
Any valuation/reporting adjustment must remain explicit and auditable.
This policy is implemented in purchase finalization and covered by the focused
contract test; target-bound persisted readback remains part of the next
disposable runtime evidence package.

## B. Inventory acquisition-cost classification

The current service supports explicit classification inputs:

- Recoverable: GST excluded from acquisition cost.
- Nonrecoverable: GST included.
- Partial: explicit split must reconcile to accepted GST.
- Pending/unresolved: status `PENDING`, null valuation, no assumption.

This is tested in `inventory-valuation.service.test.mjs` and guarded by
`purchase-gst-valuation-contract.test.mjs`. It does not determine statutory
eligibility or replace professional confirmation. No ITC engine or
reconciliation workflow is proposed.

The owner confirmed this explicit-input/pending model for the current release.
If eligibility evidence is unavailable, the operational result remains pending.

## C. Payment and ledger behavior

Current supported behavior:

- Partial account-level payments are recorded against outstanding balance.
- Overpayments are rejected before payment/ledger persistence.
- Retry/idempotency and tenant authorization are exercised in the current
  action-path campaign.
- No unapplied-credit, purchase allocation, reversal, void, or approval
  workflow is claimed.
- Payment records and ledger effects are bounded to the implemented
  account-level contract; new allocation semantics require owner approval.

The owner confirmed the existing account-level partial-payment and fail-closed
overpayment contract for the current release. No allocation feature is
implemented or claimed.

## D. GST and accounting policy register

| Issue | Current safe behavior | Decision/confirmation needed |
|---|---|---|
| Cess | Unsupported/non-zero cases fail closed | Owner-approved current-release boundary. |
| Inclusive-tax purchase extraction | Not accepted as a supported workflow | Preserved outside current release. |
| Rounding/aggregation | Supported bounded arithmetic | Owner-approved current-release policy. |
| Discrepancy tolerance | Guarded current behavior exists | Owner-approved current-release policy. |
| Discounts | Explicit line-level behavior only | Invoice-wide allocation remains outside current release. |
| Freight/allocation | Not implemented | Preserved outside current release/V2. |
| ITC/acquisition cost | Explicit classification or `PENDING` | No automated eligibility determination. |

The owner confirmed the researched and approved product/accounting policies and
waived external professional confirmation as an internal acceptance gate.
This is not a government certification or independent professional
endorsement.
