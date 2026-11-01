---
title: HSN/SAC approval permission decision
date: 2026-10-31
status: OWNER APPROVED — OPTION A
approved_by: Company owner
approved_at: 2026-11-01
---

# HSN/SAC approval permission decision

## Current implementation

`approve_hsn_catalog` is checked independently by the classification approval
action. Maintenance actions require `manage_hsn_catalog`. The implementation
matches the confirmed owner decision below.

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

## Owner decision

**Option A — `approve_hsn_catalog` is independently sufficient.**

The company owner approved this product authorization decision on 2026-11-01.
An authorized classification approver may approve a pending HSN/SAC
classification with `approve_hsn_catalog` without also holding
`manage_hsn_catalog`. `manage_hsn_catalog` remains required for creating or
maintaining catalog entries. Classification approval and catalog maintenance
remain distinct permissions.

GST rate approval remains governed by the separate `approve_gst_rates`
permission and its existing governance process. All tenant-scoped access,
server-side authorization, audit/history, immutable-history, and revision
safeguards remain mandatory.

This is owner-approved product authorization only. It is not GST-practitioner,
legal, statutory, or accounting approval, and must not be represented as such.
