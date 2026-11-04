---
title: Freight and discount allocation policy
date: 2026-11-01
status: Approved by owner — engineering implementation pending
approved_by: Masum Rafique - Owner
approved_at: 2026-11-01T14:55:50+05:30
---

## Context
GST taxable-value determination and inventory-cost allocation are related but distinct decisions.

## Decision
Apply Section 15 and relevant rules for GST valuation, preserve freight and supplier allocations, and keep inventory-cost allocation separate. Proportional invoice-wide discount allocation and post-supply discount handling require their governed workflows.

## Engineering requirements
- Preserve freight, discount, tax, and inventory-cost components separately.
- Do not infer proportional allocation without an approved allocation workflow.
- Do not rewrite finalized invoices for post-supply discounts; a separately
  approved, future linked credit/debit note workflow would be required.
- Until that workflow is implemented and independently accepted, block
  post-supply discount cases.
- Block unsupported allocation cases.

## Approval
Owner approval recorded from `Masum Rafique - Owner` on `2026-11-01T14:55:50+05:30`. This records product authorization, not professional or legal advice.

## Consequences
Existing line discounts remain supported where explicitly supplied. Invoice-wide freight or unallocated discount cases remain blocked.
