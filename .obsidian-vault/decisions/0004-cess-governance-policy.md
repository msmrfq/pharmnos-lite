---
title: Cess governance policy
date: 2026-11-01
status: Approved by owner — engineering implementation pending
approved_by: Masum Rafique - Owner
approved_at: 2026-11-01T14:55:50+05:30
---

## Context
Cess is a distinct tax component and cannot be hidden inside ordinary GST rates.

## Decision
Cess is governed separately with classification, rate, effective period, source, and credit-utilization treatment. Unsupported cess calculations are blocked.

## Engineering requirements
- Persist cess separately from CGST, SGST, and IGST.
- Require an approved effective cess rule and source reference.
- Preserve cess input credit separately.
- Block non-zero cess when governance or utilization treatment is unavailable.

## Approval
Owner approval recorded from `Masum Rafique - Owner` on `2026-11-01T14:55:50+05:30`. This records product authorization, not professional or legal advice.

## Consequences
Existing zero-cess flows remain valid; unsupported non-zero cess must fail closed.
