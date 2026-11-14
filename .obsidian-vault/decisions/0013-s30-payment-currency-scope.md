---
title: S-30 — Payment Currency Scope
date: 2026-11-14
status: Accepted — owner-authorized 2026-11-14
---

# S-30 — Payment Currency Scope

## Context

The financial reconciliation scenario matrix (S-30) requires an explicit
rejection when a payment is submitted in an unsupported currency, with no record
created and no implicit conversion.

The implemented payment input has no currency field. Amounts are parsed as plain
decimal values and persisted as `Decimal(12, 2)`. The system therefore behaves
as implicitly single-currency, but that policy is not stated, validated, or
tested. A caller cannot submit an unsupported currency through the current form,
and an API caller that adds a currency field would have it ignored rather than
rejected.

The classification campaign recorded S-30 as `FUNCTIONALITY_MISSING`. No code
change has been made, because choosing a currency policy is an owner decision,
not a proven arithmetic defect.

## Options

### Option A — Declare INR-only and reject any supplied non-INR currency

Document the V1 single-currency boundary in the payment contract. If a payload
contains a currency field, require `INR` and reject anything else before
persistence. No implicit conversion.

- Consequence: matrix S-30 becomes implementable with a small validation change.
- Consequence: no schema change is needed.
- Consequence: future multi-currency remains a deliberate V2 boundary.

### Option B — Add an explicit `currency` column defaulted to `INR`

Persist the currency code with every payment and reject non-INR at validation.

- Consequence: requires a forward-only migration and schema/client changes.
- Consequence: stronger audit evidence, but more scope than V1 currently needs.
- Consequence: must not be introduced without runtime verification.

### Option C — Multi-currency support

Store currency, exchange rate, and base-currency amounts; convert at a governed
rate.

- Consequence: accounting, reporting, and statutory implications far beyond V1.
- Consequence: explicit V2/later scope; not authorized.

## Recommendation (not a decision)

**Option A** is the narrowest V1-consistent choice: state the single-currency
policy and fail closed on any non-INR input. It requires no migration and can be
proven with a focused validation test. It should be paired with a documented
statement that all amounts are INR.

## Decision

**ACCEPTED — INR only.** Owner-authorized on 2026-11-14. This decision is final for
the current V1 build and is not reopened by the decision-closure campaign.

The accepted implementation is the validation-boundary policy described as
**Option A** above: every supplied payment currency must be `INR`; every other value
is rejected before persistence, with no conversion and no normalization. This
matches the approved V1 contract: "Current scope is single-currency; unsupported
currency mismatches are rejected, with no implicit conversion."

- **No currency column is added.** The campaign authorization requires the INR-only
  boundary at the trusted validation layer and explicitly forbids speculative
  multi-currency abstractions. Option B (persist a `currency` column) and Option C
  (multi-currency/FX) are not adopted.
- **Missing currency follows the existing approved contract.** The payment contract
  has never carried a currency field, and the owner-approved matrix states that
  amounts are INR. An absent, `null`, or empty currency therefore remains the
  existing single-currency contract; it is not a new default invented by this
  change.
- **No implicit conversion or normalization of another currency.** `USD`, `EUR`,
  `GBP`, and any other non-INR value fail closed. Case/whitespace normalization is
  applied only to the `INR` token itself (for example `inr` → `INR`); no other code
  is transformed.
- **Historical records are preserved.** Nothing is rewritten, backfilled, or
  deleted. Existing payment, allocation, reversal, and refund behavior is unchanged.

Rejected alternatives remain recorded above and are not implemented.

Implementation consequences (completed in this campaign):

- `PaymentCurrencySchema` is part of both `CustomerPaymentCreateSchema` and
  `SupplierPaymentCreateSchema`, so customer and supplier payment entry points share
  one server-side rule.
- The two payment actions parse the rule before `prisma.$transaction`; rejected input
  produces no payment, ledger, audit, sequence, or balance mutation.
- There are no payment import routes or alternate `payments.create` paths in the
  application. The repository refuses direct payment creation/update/delete, so
  direct server-action calls cannot bypass validation.
- No currency value reaches persistence because the model has no currency field.

Acceptance criteria:

1. `INR` payment input is accepted.
2. Non-INR input is rejected at the trusted server-side boundary.
3. Missing currency follows the existing approved single-currency contract.
4. Direct server-action calls cannot bypass the rule.
5. No import or alternate entry point can introduce an unsupported currency.
6. Rejected input produces no partial database mutation.
7. Existing valid INR payment, allocation, reversal, and refund behavior is intact.

## Consequences if the decision had remained open (historical)

- The payment contract would not state its currency boundary.
- S-30 would remain unimplementable as written.
- Any claim that "unsupported payment inputs fail closed" would be incomplete.

## Evidence

- `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md` (S-30)
- `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-accounting-decision-pack.md` §Additional pending boundaries (approved single-currency contract)
- `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-policy-matrix.md` (Currency)
- `tests/payment-method-currency-policy.test.mjs` (INR, non-INR, missing, non-string, action ordering)
- `src/lib/validation/sales.schemas.ts`, `src/app/_actions/sales.actions.ts`,
  `src/repositories/payment.repository.ts`
