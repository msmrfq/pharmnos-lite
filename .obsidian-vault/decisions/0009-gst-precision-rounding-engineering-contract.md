---
title: GST precision and rounding engineering contract
date: 2026-11-01
status: PENDING OWNER APPROVAL
---

# GST Precision and Rounding Engineering Contract

## Context

The owner-approved high-level direction in
[0007-gst-rounding-precision-policy.md](./0007-gst-rounding-precision-policy.md)
requires preserved intermediate precision, retained tax components, explicit
precedence, and separate invoice adjustments. The existing calculator paths
used JavaScript binary floating-point arithmetic and rounded intermediate
values. This record defines the detailed engineering contract proposed for
implementation; the broader GST modernization authorization is not approval of
this detailed matrix.

## Proposed owner decision matrix

| ID | Proposed decision | Status |
|---|---|---|
| `T25-01` | Use exact decimal arithmetic for financial and GST calculations. | `PENDING OWNER APPROVAL` |
| `T25-02` | Maintain at least six decimal places internally, with additional precision where required. | `PENDING OWNER APPROVAL` |
| `T25-03` | Do not round intermediate calculations prematurely. | `PENDING OWNER APPROVAL` |
| `T25-04` | Use an explicitly defined `HALF_UP` convention for ordinary two-decimal representation. | `PENDING OWNER APPROVAL` |
| `T25-05` | Represent applicable e-invoice item monetary fields to two decimal places where the governing schema requires it. | `PENDING OWNER APPROVAL` |
| `T25-06` | Derive invoice tax totals by summing reported item tax amounts where the applicable e-invoice contract requires that reconciliation. | `PENDING OWNER APPROVAL` |
| `T25-07` | Keep Section 170 nearest-rupee statutory rounding separate and invoke it only at the legally applicable boundary. | `PENDING OWNER APPROVAL` |
| `T25-08` | Keep commercial invoice-total adjustment in a separate visible `Round_Off_Amount` field; never use it to alter taxable value or GST amounts. | `PENDING OWNER APPROVAL` |
| `T25-09` | Preserve supplier-declared purchase amounts independently from Pharmnos Lite calculated values. | `PENDING OWNER APPROVAL` |
| `T25-10` | Preserve exact sales calculations and issued invoice values. | `PENDING OWNER APPROVAL` |
| `T25-11` | Calculate and preserve CGST, SGST/UTGST, and IGST independently. | `PENDING OWNER APPROVAL` |
| `T25-12` | Preserve original credit/debit note references and adjustment values; never overwrite original financial evidence. | `PENDING OWNER APPROVAL` |

No owner approval, signature, approval date, or qualified professional
confirmation for this detailed matrix is asserted by this record.

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
  current application path. T25-12 remains pending detailed owner approval, so
  this absence is classified as `Not implemented / no supported workflow`, not
  as an owner-approved current-release exclusion or verified pass. Any future
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

## DGM-T19 current-release scope

Advanced stale purchase GST acceptance-revision protection is
`CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`. The current code-path
inspection found that evidence correction resets the current accounting decision
and acceptance status, increments the GST record version, and finalization
requires current evidence, calculation, accounting decision, accepted line
snapshots, and an accepted status. Those current posting safeguards remain in
place. The advanced stale-revision guard was not added and is not independently
accepted.

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
decimal boundary. Until the owner approves this detailed matrix and qualified
professional confirmation is recorded where required, DGM-T25 remains not
independently accepted and GST Stage 1 remains open.
