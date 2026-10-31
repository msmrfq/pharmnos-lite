---
title: HSN/SAC approval permission decision
date: 2026-10-31
status: PENDING OWNER CONFIRMATION
---

# HSN/SAC approval permission decision

## Current implementation

`approve_hsn_catalog` is checked independently by the classification approval
action. Maintenance actions require `manage_hsn_catalog`. The implementation
has not been changed pending explicit owner confirmation.

## Decision options

### Option A — Independent approval authority

An approver may approve a pending classification with
`approve_hsn_catalog` without `manage_hsn_catalog`.

- Separates preparation from approval.
- Supports segregation of duties.
- Requires explicit assignment and review of the approval role.

### Option B — Combined maintenance and approval authority

Classification approval requires both `approve_hsn_catalog` and
`manage_hsn_catalog`.

- Restricts approval to catalog maintainers.
- Reduces the number of eligible approvers.
- Weakens separation of preparation and approval responsibilities.

## Owner decision required

Confirm exactly one option:

1. `Option A — approve_hsn_catalog is independently sufficient`
2. `Option B — approval also requires manage_hsn_catalog`

Until confirmed, the current implementation remains unchanged and this
permission behavior is not treated as owner-approved policy.
