---
title: GST-inclusive purchase pricing policy
date: 2026-11-01
status: Approved by owner — engineering implementation pending
approved_by: Masum Rafique - Owner
approved_at: 2026-11-01T14:55:50+05:30
---

## Context
Purchase lines currently require an explicit tax basis, but inclusive extraction must not be approximated by exclusive arithmetic.

## Decision
Support explicit inclusive and exclusive pricing. Inclusive values use the applicable Rule 35 extraction method, preserve the original supplier amount, store extracted taxable value and tax separately, support mixed rates, and record residual rounding adjustments.

## Engineering requirements
- Require and persist pricing basis at invoice and line scope.
- Use governed inclusive extraction; do not reuse exclusive formulas.
- Preserve original supplier inclusive amounts.
- Reconcile mixed-rate lines to supplier totals and block unresolved residuals.
- Preserve invoice-level rounding adjustments separately.

## Approval
Owner approval recorded from `Masum Rafique - Owner` on `2026-11-01T14:55:50+05:30`. This records product authorization, not professional or legal advice.

## Consequences
Inclusive pricing must remain blocked until the governed extraction and rounding implementation is available.
