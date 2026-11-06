---
title: Inventory GST valuation policy
date: 2026-11-01
status: Approved by owner — engineering policy implemented; professional/statutory confirmation pending
approved_by: Masum Rafique - Owner
approved_at: 2026-11-01T14:55:50+05:30
---

## Context
Purchase GST must not be silently treated as inventory cost without an approved ITC eligibility policy.

## Decision
Recoverable GST is recorded separately as an ITC asset and excluded from inventory acquisition cost. Non-recoverable GST is included in inventory cost where attributable. Partially recoverable GST is split. Unresolved eligibility keeps valuation pending and blocks authoritative valuation.

## Engineering requirements
- Preserve supplier-declared, application-calculated, accounting-accepted, recoverable-tax, non-recoverable-tax, and inventory-cost values separately.
- Require an explicit governed ITC eligibility decision before authoritative inventory valuation.
- Block unsupported or unresolved eligibility; never assume recovery or capitalization.
- Keep finalized historical snapshots immutable and version policy changes.

## Approval
Owner approval recorded from `Masum Rafique - Owner` on `2026-11-01T14:55:50+05:30`. This records product authorization, not professional or legal advice.

## Consequences
Purchase posting may complete where accepted GST is financially reconciled, but inventory valuation remains pending until eligibility is explicitly approved and recorded.

## Current implementation status

The purchase finalization path preserves supplier-declared and accepted GST values, creates the product batch and `PURCHASE_IN` movement, and records the supplier-ledger effect transactionally. It deliberately leaves `inventory_acquisition_cost`, recoverable/non-recoverable GST, and valuation status as `NULL`/`PENDING` when no governed eligibility decision exists. This is an implemented fail-closed behavior, not an unresolved product-policy choice.

The remaining requirement is evidence and professional/statutory confirmation for the eligibility classification on a real governed transaction. Owner authorization does not constitute that professional confirmation.
