---
title: Purchase GST discrepancy tolerance policy
date: 2026-11-01
status: Approved by owner — engineering implementation pending
approved_by: Masum Rafique - Owner
approved_at: 2026-11-01T14:55:50+05:30
---

## Context
A monetary tolerance must not silently approve classification, rate, place-of-supply, or ITC eligibility differences.

## Decision
Rate, HSN/SAC, POS, treatment, eligibility, or missing-classification differences block automatic acceptance. Small arithmetic differences use an approved reconciliation workflow with attributable accounting acceptance.

## Engineering requirements
- Classify arithmetic differences separately from policy or classification differences.
- Block automatic acceptance for rate, HSN/SAC, POS, treatment, eligibility, or missing facts.
- Preserve supplier-declared and application-calculated values.
- Require attributable authorized acceptance for resolved discrepancies.
- Never infer ITC eligibility from a monetary tolerance.

## Approval
Owner approval recorded from `Masum Rafique - Owner` on `2026-11-01T14:55:50+05:30`. This records product authorization, not professional or legal advice.

## Consequences
Existing explicit decision workflow remains the only permitted resolution path for material discrepancies.
