---
title: Pharmnos Lite Stage 3 Blocker Reconciliation and Remediation Plan
date: 2026-11-07
time: 03-15-00
status: Reconciled; runtime gate remains active
---

# Reconciliation

The frozen Stage 3 denominator remains 100 points. No documentation update
receives acceptance credit by itself.

## Stable defect and gap register

| ID | Finding | Disposition |
|---|---|---|
| D-01 | Finalized purchase parent/item delete and mutation guards | Remediated and target-bound verified; production/shared rollout remains unauthorized. |
| D-02 | Supplier document replacement race and post-finalization replacement | Remediated with row locking, status recheck, checksum/signature validation, and explicit failure; current-source action-path evidence is recorded. |
| D-03 | Purchase read authorization | Remediated with explicit `edit_purchase` permission and tenant context; focused contract passes. |
| D-04 | Draft cancellation race and missing audit linkage | Remediated with conditional transactional update and `INVOICE_CANCELLED` audit; focused contract passes. |
| D-05 | Customer/supplier payment overage clamping | Remediated by fail-closed rejection; unapplied-credit/allocation semantics remain policy-blocked and were not invented. |
| D-06 | Free-quantity receipt and acquisition-cost valuation | Confirmed acceptance gap; pending owner/professional accounting policy and implementation. |
| D-07 | GST cess, inclusive tax, freight/discount allocation, rounding, and discrepancy rules | Policy/professional confirmation required or explicitly deferred; no statutory-compliance claim. |
| D-08 | Mutable request-claim GUC trust boundary | Confirmed HIGH residual risk outside the scoped server-only threat model; not fixed by application-path tests. |
| D-09 | Authenticated browser E2E | Confirmed acceptance gap; no suitable authenticated browser harness exists in the repository. |
| D-10 | Provider PITR, retention, offsite recovery, RPO/RTO, and recovery authorization | Confirmed acceptance gap; local disposable restore is not provider recovery evidence. |
| D-11 | Independent final acceptance | Blocked: technical review remains conditional, financial review rejects, and security review is scoped/unresolved. |

| Area | Root cause/impact | Current status | Missing evidence or disposition | Criterion |
|---|---|---|---|---|
| Finalized purchase immutability | Migration 0015 returned `OLD` on finalized DELETE and its item trigger misread `ON DELETE CASCADE` as an orphan | D-01 remediated in candidate migration 0021; clean disposable runtime passed parent/item rejection, draft cascade, rollback, and restricted-role checks | Keep unapplied outside disposable target; production/shared rollout remains separately gated | ST3-C/G |
| Migration/schema drift | Prisma does not fully model custom SQL triggers, RLS, grants, and expression/partial indexes | Open | Clean migration reproducibility, custom-object inventory, drift and recovery evidence | ST3-C/I |
| Tenant referential integrity | Many tenant-owned foreign keys are ID-only | Open source/design risk | Composite FK design or documented compensating controls and runtime denial evidence | ST3-B/C/G |
| Connected runtime | Existing scripts fail closed without an immutable contract and phase authorization | Correct safety behavior; not a defect | Fresh target contract, initialization evidence, current-source workflow evidence, exact cleanup | ST3-B/E/G/H |
| Runtime GUC trust | RLS uses mutable request claim GUCs; arbitrary SQL can forge them | High residual risk retained | Prove server-only boundary or adopt stronger signed/per-request identity binding; no downgrade from static evidence | ST3-B |
| Purchase/inventory | Finalization receives stock immediately; free quantity, movement rate, goods receipt, and valuation policy have open semantics | Partially implemented/partially policy-blocked | Target-bound reconciliation plus owner/professional policy decisions | ST3-E/G |
| Sales/financial integrity | Current source has transactional finalization and snapshots; prior campaign fixtures had drift from current payment contracts | Current-source application campaign reached GST-016 and recorded target-bound evidence; browser proof remains absent | Authenticated browser harness, independent acceptance, and production migration/recovery evidence | ST3-F/G/H |
| Payment/ledger integrity | Tenant/semantic constraints and universal posting uniqueness are incomplete | Open | Bounded source correction or explicit compensating controls and runtime evidence | ST3-C/G |
| Recovery/operations | No verified restore/PITR/RPO/RTO drill or complete deployment/observability gate | Open blocker | Safe disposable backup/restore drill or explicit unverified requirement | ST3-I |
| GST boundaries | Supported Regular tax-exclusive arithmetic is strong; cess, UTGST, inclusive, ITC, and statutory rounding remain deferred or policy-dependent | Fail-closed boundaries retained | Professional/statutory confirmation; no synthetic test overclaim | ST3-D/E |

## Bounded remediation plan

1. Verify migration 0021 syntax and clean migration application on one newly
   created loopback Compose target only.
2. Verify finalized/draft deletion behavior and transaction rollback through
   direct database assertions before any application mutation.
3. Run only current-source supported purchase/sales runtime checks if the
   target-contract and initialization gates are satisfied.
4. Preserve all remaining high-risk findings as blocked where the correction
   requires architecture, policy, professional confirmation, or recovery
   operations.
5. Obtain separate technical/security and business/financial reviews from the
   resulting evidence; do not self-accept ST3-J.
6. Treat the current-source disposable results as partial acceptance only:
   target-bound purchase/sales/ledger behavior passed, while browser, recovery,
   professional/statutory, and forged-GUC boundary evidence remain open.
