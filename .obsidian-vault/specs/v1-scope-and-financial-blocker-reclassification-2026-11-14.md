---
title: Version 1 Scope and Financial Blocker Reclassification
date: 2026-11-14
status: V1 scope classified; repair implemented for one defect; two owner decisions open
---

# Version 1 Scope and Financial Blocker Reclassification

## Goal

Establish the true Version 1 boundary for Pharmnos Lite, reclassify every
previously blocked financial scenario against that boundary, and separate
genuine V1 release blockers from Version 2 deferrals and owner decisions.

This document does not change the scope by assertion. Each classification cites
the PRD, an owner-approved scope record, or an explicit deferral list already in
the repository.

## Acceptance criteria

- [x] V1 scope read from `prd-technical-architecture.md` §4.2, §6, §8, §22, §23.
- [x] V2 deferrals taken from
      `specs/t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md`
      and `specs/stage-3-system-readiness/31-current-release-owner-decision-pack.md` §C.
- [x] All eight GST Treatment UI options classified individually.
- [x] All 24 blocked financial scenarios classified individually.
- [x] Genuine V1 defects repaired at the narrowest responsible layer.
- [ ] Runtime proof of the newly changed code (blocked: no Docker daemon).
- [ ] Independent acceptance.

## Out of scope

Overseas/import/export, SEZ, deemed exports, UIN, Reverse Charge Mechanism,
e-invoicing, e-way bills, GSTR filing, ITC reconciliation, credit/debit notes
and exceptional workflows, returns, and multiple GST registrations. These are
explicit V2 exclusions in the current-release scope baseline.

## Authoritative V1 boundary

The PRD MVP list (`prd-technical-architecture.md` §6.1) is the primary scope
authority: multi-tenant onboarding, authentication, RBAC, product/customer/
supplier masters, purchase entry, batch creation and inward stock, sales
billing, GST calculation, inventory movement and available-stock tracking,
customer/supplier dues, low-stock/near-expiry alerts, dashboard summary, and
audit logging for critical events.

Two qualifications control the financial surface:

1. Owner Decision Pack §C confirms only **account-level partial payments** and
   **fail-closed overpayment rejection**. It states explicitly: "No
   unapplied-credit, purchase allocation, reversal, void, or approval workflow
   is claimed," and "No allocation feature is implemented or claimed."
2. PRD §8.9 says returns are "deferred from strict MVP", and §6.2 lists both
   sales return and purchase return as Phase 2.

Therefore allocation, refunds, advances/unapplied credit, reversals,
supplier multi-allocation, credit/debit notes, and returns are not V1
requirements. Their absence is not a V1 defect and they are excluded from V1
denominators.

## GST Treatment classification

The UI exposes eight options (`src/lib/gst/treatment.ts`,
`src/components/gst/gst-treatment-select.tsx`), but only "Registered Business –
Regular" is in `SUPPORTED_TREATMENTS`. The remaining seven are disabled in the
selector and rejected by `validateGstTreatment` before persistence.

| UI option | Classification | Basis | Release effect |
|---|---|---|---|
| Registered Business – Regular | `V1_REQUIRED` | PRD §8.6/§8.8 GST calculation; GST spec §4 marks it `PROPOSED` with legal confirmation required | Supported and enabled. Legal confirmation remains an external prerequisite, not an implementation gap. |
| Registered Business – Composition | `OWNER_CLARIFICATION` | GST spec §4: `UNRESOLVED`; "do not infer from label" | Disabled and fail-closed. Not a V1 blocker while disabled. |
| Unregistered Business | `OWNER_CLARIFICATION` | GST spec §4: `PROPOSED` but no approved evidence/classification workflow | Disabled and fail-closed. Not a V1 blocker while disabled. |
| Consumer | `OWNER_CLARIFICATION` | GST spec §4: `PROPOSED`; current `is_cash_sale` is not a full classification | Disabled and fail-closed. Not a V1 blocker while disabled. |
| Overseas | `V2_DEFERRED` | Scope baseline explicit deferral 1 (imports/exports); GST spec `UNRESOLVED` | Excluded. |
| Special Economic Zone | `V2_DEFERRED` | Scope baseline explicit deferral 2; GST spec `UNRESOLVED` | Excluded. |
| Deemed Export | `V2_DEFERRED` | Scope baseline explicit deferral 2; GST spec `UNRESOLVED` | Excluded. |
| UIN Holders | `V2_DEFERRED` | Scope baseline explicit deferral 3; GST spec `UNRESOLVED` | Excluded. |

`SHARED_FOUNDATION` was considered for the four domestic non-V2 options. It is
not used: the options are disabled labels, not a shared workflow foundation.
Calling a disabled label a foundation would inflate completion.

The eight-option selector is therefore **not** evidence of eight supported
workflows. One option is usable; four await owner clarification; three are V2.

## Disposition of the 24 blocked financial scenarios

Source statuses: `.obsidian-vault/specs/evidence/financial-reconciliation-runtime-2026-11-14.json`
(30 pass / 0 fail / 24 blocked) and
`specs/financial-reconciliation/classification-runtime-campaign-2026-11-08.md`.

| ID | Scenario theme | V1 classification | Rationale and current evidence |
|---|---|---|---|
| S-01 | Customer advance / unapplied credit | `V2_DEFERRED` | Owner Decision Pack §C claims no unapplied-credit workflow. |
| S-04 | Supplier advance | `V2_DEFERRED` | Same as S-01, supplier side. |
| S-07 | Customer partial allocation, one payment/one invoice | `V2_DEFERRED` | Allocation is not claimed in V1; matrix initial state also conflicts with the approved credit equation. |
| S-08 | Two payments/one invoice | `V2_DEFERRED` | Allocation workflow; matrix policy conflict remains recorded. |
| S-09 | One payment/two invoices | `V2_DEFERRED` | Allocation workflow. |
| S-10 | Many payments/one invoice | `V2_DEFERRED` | Allocation workflow; fixture ambiguity remains. |
| S-16 | Refund-ledger failure rollback | `V2_DEFERRED` | Refund workflow is outside V1. |
| S-18 | Excess credit note | `V2_DEFERRED` | Credit/debit notes are explicit V2 deferral 8. |
| S-19 | Finalized invoice direct-edit rejection | `V1_REQUIRED` | PRD §23.1 finalized state and immutability of posted financial records. Direct edit is rejected; migration 0030 trigger is present and runtime-verified by DP-09..DP-11. The matrix's broader "linked audited adjustment/reversal workflow" is V2. |
| S-20 | Effective vs recorded as-of restatement | `V2_DEFERRED` | Not in MVP scope; current knowledge-as-of aging contract is separately accepted. |
| S-21 | Due-date change after finalization | `V1_REQUIRED` | Finalized due date is a snapshot; attempts must not mutate it. Implemented by finalized-sales immutability and runtime-verified. Audited terms-change approval workflow is V2. |
| S-22 | Same-payment/same-invoice concurrency | `V2_DEFERRED` | Allocation concurrency is dependent on the deferred allocation feature. |
| S-23 | Two-payment/same-invoice concurrency | `V2_DEFERRED` | Allocation feature. |
| S-24 | Stale-read concurrency | `V2_DEFERRED` | Allocation feature. |
| S-25 | Legacy payment cutover | `V2_DEFERRED` | Migration/opening-ledger campaign, not MVP scope. |
| S-26 | Legacy reclassification | `V2_DEFERRED` | Same as S-25. |
| S-27 | Cheque method rejection | `OWNER_CLARIFICATION` | UI accepts `Cheque` and maps it to `CHEQUE`; the matrix expects rejection. See decision record 0012. No code change authorized. |
| S-28 | Concurrent receipt-number allocation | `V1_REQUIRED` | Every V1 payment needs a tenant-unique receipt number. The transactional upsert allocator and unique constraint are implemented and statically tested, but concurrent runtime proof is absent. |
| S-30 | Unsupported payment currency | `OWNER_CLARIFICATION` | Amount input carries no currency; implicit INR is undocumented. See decision record 0013. No code change authorized. |
| S-31 | Two supplier payments/one invoice | `V2_DEFERRED` | Supplier allocation workflow. |
| S-32 | One supplier payment/two invoices | `V2_DEFERRED` | Supplier allocation workflow. |
| S-33 | Supplier partial settlement | `V2_DEFERRED` | Supplier allocation workflow. |
| S-37 | Supplier reversal and corrected repost | `V2_DEFERRED` | Reversal workflow. |
| S-38 | Supplier debit adjustment | `V2_DEFERRED` | Credit/debit adjustment workflow, explicit V2 deferral 8. |

Totals: `V1_REQUIRED` 3 (S-19, S-21, S-28); `OWNER_CLARIFICATION` 2
(S-27, S-30); `V2_DEFERRED` 19. No scenario is silently re-labelled as passed.
The prior campaign's 30 passes remain valid historical runtime evidence.

### V1-required status detail

- **S-19 / S-21:** implemented at the database immutability layer and
  runtime-verified by the disposable PostgreSQL campaign (finalized sales
  immutability trigger, `DP-09`..`DP-11`). The broader linked-adjustment
  workflow is V2.
- **S-28:** implementation present
  (`src/repositories/payment.repository.ts` tenant-scoped transactional upsert,
  migration `0025_payment_receipt_sequence`). Static contracts pass. Runtime
  concurrency remains unverified; it is a V1 evidence gap, not a known code
  defect.

## Genuine V1 defect found and repaired

### Opening stock was not represented in the movement ledger

PRD §8.7 and §22.1 require available stock to be calculable from stock movement
records, with batch counters only materialized. `createProductAction` previously
inserted `product_batches` rows with `received_qty`/`available_qty` via
`createMany` and wrote no movement. An opening balance therefore existed only
as a counter, contradicting the stock source-of-truth contract.

Repair (`src/app/_actions/masters.actions.ts`):

- establish tenant DB context inside the product-creation transaction;
- create each batch individually so its id is available;
- write one `OPENING_STOCK` movement per batch with `received_qty > 0`, in the
  same transaction, with product/batch references and the acting user.

Regression contract: `tests/stock-opening-reconciliation-contract.test.mjs`
(4 tests). Read-only diagnostic: `scripts/stock-reconciliation.sql`, which
reports `available_qty - SUM(quantity_delta)` and classifies
`UNTAGGED_OPENING_BALANCE_SUSPECTED` versus `COUNTER_MOVEMENT_MISMATCH`.

Runtime status: **not verified**. The Docker daemon is unavailable in this
session (`npipe:////./pipe/dockerDesktopLinuxEngine` not found), so no new
disposable PostgreSQL target could be provisioned. Static verification only.

## Genuine V1 blocker left open

### Tenant read paths do not establish database context

All server components and report loaders receive a `TenantContext` and pass it
to repositories, but the repositories execute Prisma queries without a
transaction-scoped `pharmnos.auth_context`. RLS therefore binds only when the
connection role is the restricted runtime role **and** a context is
established.

Evidence: `src/lib/db/tenant-context.ts` exposes `establishTenantContext` only
for transaction clients; the RSC/report read paths use `repos.*` directly. Prior
runtime case `APP-03` proves that a Prisma query without
`establishTenantContext` returns zero rows under the restricted role.

The production `DATABASE_URL` currently uses a privileged/superuser-capable
role, so RLS does not bind at all. Switching to the restricted role without
fixing read paths would make dashboards, reports, print views, and exports
return empty results. This requires request-scoped transaction/data-layer
redesign and a controlled role cutover. It is classified as a V1 release
blocker and was not silently patched.

## Schema drift corrections

`prisma/schema.prisma` now matches the deployed schema where drift was proven:

- `inventory_valuation_decisions.recoverable_itc`,
  `non_recoverable_gst`, and `inventory_acquisition_cost` are annotated
  `@db.Decimal(20, 4)`, matching migration 0011.
- `purchase_invoice_items` declares the existing
  `purchase_invoice_items_accepted_decision_idx` index from migration 0009.
- Both invoice models carry a comment stating that the database
  `(tenant_id, invoice_no)` index is partial and that `migrate dev` / `db push`
  must not be used.

`payment_refunds` declares `@@unique([tenant_id, id])` in Prisma, but the
database has no such composite constraint. Because `id` is the primary key,
lookups using `tenant_id_id` remain correct. This is cosmetic drift, not a
defect, and is not counted as repaired.

Generated provisioning SQL was regenerated and the checked-in artifact manifest
was re-hashed (package `0.1.7`). `migrate deploy` remains the only supported
deployment path.

## Weighted V1 completion

Weights are campaign-defined and were fixed before scoring. They are not
owner-approved product weights. Each criterion is scored once against the
strongest evidence available, with runtime evidence outranking static evidence.

| # | V1 criterion | Weight | Source | Static | PostgreSQL runtime | Score |
|---|---|---:|---|---|---|---:|
| 1 | Tenant isolation and read-path context | 12 | Yes | Yes | Partial (DB-level only; read paths uncontextualized) | 7.2 |
| 2 | Authentication, RBAC, membership | 7 | Yes | Yes | Yes (AC; genuine Supabase Auth not exercised) | 5.95 |
| 3 | Product and batch master | 7 | Yes | Yes | Partial (opening-stock change unverified) | 5.25 |
| 4 | Customer and supplier masters | 7 | Yes | Yes | Partial (used by harness, full CRUD not re-run) | 5.6 |
| 5 | Purchase entry and GST valuation | 10 | Yes | Yes | Yes (INV/FIN, T19 target-bound evidence) | 8.5 |
| 6 | Sales billing, GST, invoice numbering | 12 | Yes | Yes | Yes (69-case campaign, T25 sales run) | 10.8 |
| 7 | Payments and receipts (V1 account-level) | 8 | Yes | Yes | Partial (S-28 concurrency unverified) | 5.6 |
| 8 | Inventory movement, FEFO, expiry, adjustments | 10 | Yes | Yes | Partial (opening-stock and reconciliation unverified) | 7.5 |
| 9 | Dashboard, reports, exports | 7 | Yes | Yes | No (read-path context gap) | 2.8 |
| 10 | Audit logging and financial immutability | 5 | Yes | Yes | Yes | 4.5 |
| 11 | Schema/migration integrity | 5 | Yes | Yes | Partial (drift annotations unverified at runtime) | 4.0 |
| 12 | Production security operations (RLS deployment, signing secret, credentials) | 10 | Partial | Partial | No | 2.0 |
| **Total** | | **100** | | | | **69.7** |

**Evidence-based V1 completion: 69.7/100. Independent acceptance: 0/100.**

The score is deliberately not rounded up. Criteria 1, 7, 8, 9, 11, and 12
contain unverified or failing V1 elements, so the release verdict cannot be GO.

## Preservation and verification

- No commits, pushes, merges, rebases, resets, cleans, or stashes.
- Pre-existing modified and untracked user work preserved.
- `node --test "tests/*.test.mjs"`: 650/650 pass.
- `pnpm exec tsc --noEmit`: exit 0.
- `pnpm run lint`: no warnings or errors.
- `prisma validate`: valid.
- `prisma generate`: succeeded.

## References

- `prd-technical-architecture.md` §4.2, §6.1, §6.2, §8.7, §8.9, §22.1, §23.
- `specs/t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md` §Explicit Version 2 deferrals.
- `specs/stage-3-system-readiness/31-current-release-owner-decision-pack.md` §C.
- `specs/financial-reconciliation/classification-runtime-campaign-2026-11-08.md`.
- `specs/evidence/financial-reconciliation-runtime-2026-11-14.json`.
- `specs/evidence/postgres-runtime-verification-2026-11-14.json`.
- `decisions/0011-tenant-isolation-signed-context-rls.md`.
- `decisions/0012-s27-cheque-payment-scope.md`, `decisions/0013-s30-payment-currency-scope.md`.
