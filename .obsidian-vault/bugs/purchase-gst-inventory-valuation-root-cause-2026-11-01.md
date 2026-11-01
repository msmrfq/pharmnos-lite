---
title: Purchase GST inventory valuation root cause and architecture
date: 2026-11-01
status: Open
---

## Steps to Reproduce

1. Finalize an accepted purchase with the restricted runtime campaign.
2. Read its purchase lines, batches, stock movements, dashboard stock metric,
   and stock valuation report.
3. Compare the source fields used for approved valuation.

## Expected Behaviour

Only an explicit, attributable valuation decision may produce an approved
inventory acquisition cost. Recoverable GST must remain separate from
inventory cost, non-recoverable GST may be included, and unresolved cases must
remain pending. Historical changes must be represented as adjustments rather
than overwriting prior evidence.

## Actual Behaviour

Purchase finalization correctly persists pending valuation with null approved
cost. The stock report and export already exclude pending batches, but the
dashboard repository previously used `purchase_rate` for its stock-value
metric. No shared valuation resolver or append-only valuation-decision/
adjustment persistence exists.

## Root Cause

The existing schema added nullable valuation columns to lines, batches, and
movements, but the domain boundary that calculates an approved result was not
implemented. The six approved decisions define the required separation and
fail-closed behavior, but they do not define the authoritative eligibility
inputs, apportionment source, reversal lifecycle, tax-asset journal model,
freight allocation formula, or exact statutory rounding precedence. Those are
policy/data-model omissions, not evidence that procurement rate is an
acceptable fallback.

## Safe implementation

- Added a shared valuation resolver that requires explicit eligibility status,
  recoverable GST, non-recoverable GST, direct acquisition cost, policy
  version, decision reference, and actor.
- The resolver returns `PENDING` for missing, rejected, inconsistent, or
  unsupported inputs and never derives cost from procurement rate.
- Added an explicit delta calculator for subsequent corrections without
  mutating historical snapshots.
- Changed dashboard stock valuation to include only approved acquisition cost
  and expose pending batch count.
- Kept stock valuation report/export on approved acquisition cost and corrected
  the approved-average denominator.

## Architecture recommendation

Use three append-only boundaries:

1. Purchase GST evidence and accepted GST snapshot (already present).
2. A separate inventory valuation decision record per purchase line/batch,
   containing eligibility status, exact recoverable/non-recoverable amounts,
   policy version, actor, rationale, and superseded decision reference.
3. An immutable valuation adjustment record that links old/new decisions and
   records deltas for inventory cost and tax-asset balances.

Batch and movement current-state columns may be projections of the latest
approved decision, but historical decision and adjustment rows must remain
the source evidence. All projection and accounting posting must occur in one
tenant-scoped transaction with idempotency and guarded state transitions.

## Viable approaches

- **A — Extend GST accounting decisions:** minimal migration, but mixes tax
  reconciliation decisions with inventory eligibility and makes later
  corrections ambiguous.
- **B — Separate valuation decisions and adjustments:** more schema work, but
  preserves domain ownership, immutable history, and later accounting
  reconciliation. **Recommended.**
- **C — Store only current values on batches:** smallest change, but loses
  historical valuation evidence and cannot safely support reversals. Rejected.

## Blocker register

- **ITC eligibility/apportionment:** the policy requires explicit results but
  does not specify eligibility inputs, apportionment source, or provisional
  reversal lifecycle. Owner decision required before authoritative postings.
- **Tax-asset accounting:** no approved ITC asset/journal account model exists.
  Keep tax-asset posting pending; do not fabricate ledger entries.
- **Freight and discounts:** allocation basis and pure-agent evidence are not
  specified. Preserve source facts and block unsupported allocation.
- **Rounding precedence:** precision is required, but exact statutory level and
  precedence are not specified. Keep affected cases on existing governed
  paths and do not invent a new convention.

## Verification

- Valuation service tests: **5 passed**.
- Combined valuation contracts: **7 passed**.
- TypeScript typecheck: passed.
- Changed-file ESLint: passed.
- The latest restricted-role purchase campaign remains **16/16 passed** with
  pending valuation persisted for two lines, batches, and movements.

Purchase GST Financial Integrity remains **PARTIALLY ACCEPTED / BLOCKED BY
POLICY DETAIL**. GST Stage 1 remains **IN PROGRESS** and Production/Live
Supabase remains **NO-GO**.
