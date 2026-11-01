---
title: GST rounding precision and precedence policy
date: 2026-11-01
status: Approved by owner — engineering implementation pending
approved_by: Masum Rafique - Owner
approved_at: 2026-11-01T14:55:50+05:30
---

## Context
Premature rounding can make line, tax, and invoice totals disagree.

## Decision
Preserve calculation precision through intermediate operations, retain line tax components, aggregate consistently, record invoice-level adjustments separately, and apply Section 170 rounding where legally applicable.

## Engineering requirements
- Avoid whole-rupee rounding during intermediate calculation.
- Preserve line-level tax components and unrounded calculation evidence.
- Apply one explicit, versioned rounding precedence.
- Record residual invoice adjustments separately and reconcile them.

## Approval
Owner approval recorded from `Masum Rafique - Owner` on `2026-11-01T14:55:50+05:30`. This records product authorization, not professional or legal advice.

## Consequences
Existing finalized snapshots remain immutable. Any new precision or precedence implementation requires focused regression and persisted reconciliation evidence.
