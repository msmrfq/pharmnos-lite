---
title: HSN/SAC approval permission decision
date: 2026-10-31
decision_date: 2026-11-01
status: OWNER APPROVED — OPTION A
---

# HSN/SAC approval permission decision

## Owner decision

**DECIDED — OPTION A: `approve_hsn_catalog` is independently sufficient.**

The Project Owner explicitly confirmed Option A on **2026-11-01** in the
project conversation. This decision is recorded under the existing full-scope
owner authorization. It resolves the product permission-model choice; it is
not a professional GST classification approval, statutory interpretation,
security acceptance, migration approval, or production authorization.

## Approved permission contract

- `manage_hsn_catalog` authorizes catalog maintenance operations, including
  creating and maintaining pending catalog entries.
- `approve_hsn_catalog` independently authorizes approval or rejection of
  pending HSN/SAC classifications. It does not require
  `manage_hsn_catalog`.
- GST rate-rule approval remains a separate permission and governance action;
  classification approval does not approve a tax rate.
- A catalog entry's creation or maintenance does not make it approved.
- Approval remains tenant-scoped, audited, and subject to the existing
  immutable-history, effective-date, and fail-closed governance controls.
- Unauthorized, cross-tenant, invalid-transition, duplicate, and concurrent
  approval attempts must continue to be rejected or serialized according to
  the approved governance contract.

## Rationale

Separating preparation from approval supports segregation of duties. An
authorized classification approver can review and approve a pending entry
without also holding catalog-maintenance authority.

## Implementation and evidence boundary

The repository's recorded implementation already checks
`approve_hsn_catalog` independently in the classification approval action,
while maintenance actions require `manage_hsn_catalog`. The recorded scoped
application-runtime evidence covers authorized approval, unauthorized
rejection, cross-tenant rejection, concurrent approval/revision, immutable
history, and rollback.

This decision does not upgrade that scoped evidence to independent acceptance.
The current application implementation and tests must still be checked against
this exact contract in the active working tree. Any mismatch must be corrected
and verified before marking the requirement implementation-accepted.

## Approval record

- Decision maker: Project Owner
- Decision: Option A
- Permission: `approve_hsn_catalog` independently sufficient for HSN/SAC
  classification approval
- Decision date: 2026-11-01
- Authority: explicit owner confirmation under full-scope GST Modernization
  authorization
- Professional/statutory approval: not asserted
- Independent security acceptance: separate and outstanding
- Production authorization: not granted
