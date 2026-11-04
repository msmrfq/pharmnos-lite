---
title: GST precision and rounding engineering contract
date: 2026-11-01
status: OWNER APPROVED — CURRENT RELEASE SCOPE WITH VERSION 2 DEFERRALS
---

# GST Precision and Rounding Engineering Contract

## Context

The owner-approved high-level direction in
[0007-gst-rounding-precision-policy.md](./0007-gst-rounding-precision-policy.md)
requires preserved intermediate precision, retained tax components, explicit
precedence, and separate invoice adjustments. The existing calculator paths
used JavaScript binary floating-point arithmetic and rounded intermediate
values. The latest owner instruction approves the demonstrated T25 engineering
scope for current-release verification and independent acceptance, while
keeping unsupported or deferred capabilities in Version 2. This record does
not assert qualified professional confirmation, production approval, or
acceptance evidence.

## Owner decision matrix

| ID | Proposed decision | Status |
|---|---|---|
| `T25-01` | Use exact decimal arithmetic for financial and GST calculations. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-02` | Maintain at least six decimal places internally, with additional precision where required. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-03` | Do not round intermediate calculations prematurely. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-04` | Use an explicitly defined `HALF_UP` convention for ordinary two-decimal representation. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-05` | Represent applicable e-invoice item monetary fields to two decimal places where the governing schema requires it. | `OWNER APPROVED — VERSION 2 DEFERRED` |
| `T25-06` | Derive invoice tax totals by summing reported item tax amounts where the applicable e-invoice contract requires that reconciliation. | `OWNER APPROVED — VERSION 2 DEFERRED` |
| `T25-07` | Keep Section 170 nearest-rupee statutory rounding separate and invoke it only at the legally applicable boundary. | `OWNER APPROVED — CURRENT ENGINEERING BOUNDARY; PROFESSIONAL CONFIRMATION REQUIRED` |
| `T25-08` | Keep commercial invoice-total adjustment in a separate visible `Round_Off_Amount` field; never use it to alter taxable value or GST amounts. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-09` | Preserve supplier-declared purchase amounts independently from Pharmnos Lite calculated values. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-10` | Preserve exact sales calculations and issued invoice values. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-11` | Calculate and preserve CGST, SGST/UTGST, and IGST independently. | `OWNER APPROVED — CURRENT RELEASE` |
| `T25-12` | Preserve original credit/debit note references and adjustment values; never overwrite original financial evidence. | `OWNER APPROVED — VERSION 2 DEFERRED` |

Owner approval is recorded from the latest owner instruction in the current
session. This is scope and engineering authorization only; it is not qualified
professional confirmation, runtime verification, independent acceptance, or
production approval.

## Engineering contract

- The shared calculation boundary uses coefficient/scale decimal arithmetic
  implemented in [`src/lib/decimal.ts`](../../src/lib/decimal.ts). It does not
  use JavaScript `+`, `*`, `/`, or `Math.round` for financial calculations.
- Internal division uses an explicit 18-decimal calculation scale, exceeding
  the six-decimal minimum. The existing form schemas currently coerce decimal
  text through `Number()` before the shared Decimal path, so precision already
  lost at that input boundary cannot be recovered. Service APIs also return
  `number` values at their compatibility/representation boundaries; this does
  not establish universal losslessness for subsequent number arithmetic or
  high-precision `NUMERIC(20,4)` values.
- Ordinary two-decimal representation uses explicit `HALF_UP`. `DOWN` and
  `NONE` remain explicit calculator modes; no language or database default is
  relied on.
- Taxable value, discount, tax components, and inclusive extraction retain
  internal precision until the applicable item or invoice representation
  boundary. Reported item tax amounts are summed as the invoice tax total when
  the applicable contract requires item reconciliation.
- CGST, SGST/UTGST, and IGST are calculated from the taxable base independently.
  A rounded aggregate tax amount is never split into components.
- Commercial purchase invoice round-off remains visible in `round_off` and is
  calculated separately from taxable value and tax components.
- `roundSection170NearestRupee` is an isolated arithmetic helper. No current
  sales or purchase calculation path invokes it automatically. The legal
  aggregation boundary and tax-head treatment require qualified GST
  confirmation and remain unresolved.
- Existing Prisma financial columns already use PostgreSQL `NUMERIC` through
  `@db.Decimal`; no schema migration is required by this implementation.
- Supplier-declared purchase raw values, calculated values, accepted values,
  finalized sales snapshots, and immutable audit records remain separate.
- No credit-note, debit-note, or e-invoice calculation surface exists in the
  current application path. T25-05, T25-06, and T25-12 are approved Version 2
  deferrals; their current-release absence remains
  `Not implemented / no supported workflow`, not a verified pass. Any future
  implementation must preserve original references and adjustment values.

## DGM-T13 current-release scope

Current-release GSTIN validation is
`CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED` and enforces exactly 15
characters when a GSTIN is supplied. Checksum verification, state-prefix
verification, registration-status verification, and effective-date verification
are deferred to Version 2. Unsupported prefixes such as `96`, `97`, and `99`
are not mapped to POS or state codes by this decision. The implementation and
focused tests exist; runtime verification and independent acceptance remain
separate statuses.

## DGM-T19 current-release scope and resolution

The approved T19 scope remains `CURRENT RELEASE SCOPE APPROVED — VERSION 2
DEFERRED`. The owner-directed resolution implements the reviewed-revision guard
in the current engineering path while retaining broader stale-operation
behavior as a Version 2 boundary:

- acceptance and discrepancy resolution require the submitted record version,
  evidence revision ID, and calculation ID to match the current purchase;
- correction requires the same revision tokens and uses an optimistic guarded
  parent update, so child evidence, calculation, line, and event writes roll
  back when the reviewed revision becomes stale;
- acceptance, resolution, and correction preserve authorization checks and
  reject already-recorded decisions; and
- finalization continues to require the current accepted evidence, calculation,
  accounting decision, accepted line snapshots, and optimistic record version.

The focused T19 contract test and typecheck cover the source wiring. No
database/runtime campaign or independent acceptance is claimed here. Any
broader stale-operation behavior outside these reviewed revision tokens remains
outside the resolved current-release boundary and requires a separate scope
decision.

## Professional confirmation reservation

The exact Section 170 aggregation boundary, applicable tax-head treatment,
e-invoice reconciliation obligations, and any credit/debit-note statutory
representation require qualified GST/accounting confirmation. Engineering
tests prove arithmetic and preservation behavior only; they do not prove legal
acceptance or production readiness.

## Consequences

The calculator and form paths can use one exact-decimal implementation without
changing the PostgreSQL schema or enabling unsupported treatments. Purchase GST
reconciliation, accepted-value posting totals, and ledger balances use the same
decimal boundary. Until target-bound runtime evidence, independent acceptance,
and qualified professional confirmation are recorded where required, DGM-T25
remains not independently accepted and GST Stage 1 remains open.
