---
title: S-27 — Cheque Payment Method Scope
date: 2026-11-14
status: Accepted — owner-authorized 2026-11-14
---

# S-27 — Cheque Payment Method Scope

## Context

The financial reconciliation scenario matrix (S-27) defines an unsupported
`Cheque` payment as a validation case: the method must be rejected before
persistence, with no payment, ledger, or audit financial effect, and must never
map to `CREDIT`.

The implemented application contradicts that expectation:

- `src/app/billing/payments/new/_form.tsx` and
  `src/app/purchases/payments/new/_form.tsx` offer `Cheque` in the payment
  method selector.
- The payment action maps it to the supported `CHEQUE` value and persists it
  like any other method.
- There is no cheque-specific lifecycle (post-dated instruments, deposit,
  clearing, bounce, bank reconciliation).

The matrix row and the implementation therefore disagree. The classification
campaign recorded S-27 as `FUNCTIONALITY_MISSING` and requested an owner
decision: either reject `Cheque`, or change the rejection fixture to a genuinely
unknown method. No code change has been made, because the choice is a scope
decision rather than a proven defect.

## Options

### Option A — Declare `Cheque` a supported V1 payment method

Record the instrument with a mandatory reference number and optional date/bank
note. Treat it as an immediate account-level payment, exactly like cash/UPI.

- Consequence: the matrix's S-27 rejection expectation is retired or rewritten.
- Consequence: no clearing/bounce state is claimed; a dishonoured cheque would
  require a future correction workflow (V2).
- Risk: users may assume a cheque is only a payment once cleared.

### Option B — Reject `Cheque` in V1

Remove `Cheque` from both payment forms and reject it in validation before any
database write.

- Consequence: matrix S-27 becomes implementable exactly as written.
- Consequence: a currently visible, usable method becomes unavailable.
- Consequence: users must record a cheque as "Bank Transfer" or defer entry
  until an approved cheque workflow exists.

### Option C — Full cheque lifecycle (V2)

Implement post-dated entry, presentation, clearing, dishonour, and bank
reconciliation.

- Consequence: substantial new workflow, state model, permissions, and
  reconciliation evidence.
- Consequence: clearly outside V1 scope and not authorized by this campaign.

## Recommendation (not a decision)

The smallest V1-consistent option is **Option A with an explicit limitation
notice**, because the code already supports it and the PRD's payment-mode list
(§23.2) is not exhaustive ("Support: cash, card, UPI, credit, mixed
collection"). Option B is safer for accounting correctness but is a behavioral
regression. Option C must not be pulled into V1.

## Decision

**ACCEPTED — Option A: `Cheque` is a supported V1 payment method.** Owner-authorized
on 2026-11-14. This decision is final for the current V1 build and is not reopened
by the decision-closure campaign.

Scope of the acceptance:

- A `Cheque` payment is recorded as an immediate account-level receipt/payment,
  with an optional reference number and note, exactly like cash/UPI.
- No cheque-clearing, deposit, presentation, dishonour/bounce, bank-settlement, or
  bank-reconciliation workflow is added to V1. Those remain V2 and are not claimed
  as implemented.
- `Cheque` is not a synonym for `CREDIT`; it persists as `CHEQUE`.

Rejected alternatives remain recorded above and are not implemented: Option B
(remove `Cheque` from V1) and Option C (full cheque lifecycle, V2).

Implementation consequences (completed in this campaign):

- `Cheque` remains in `CustomerPaymentMethodSchema`/`SupplierPaymentMethodSchema`
  and in both payment forms.
- `paymentMethodToPrismaMode` continues to map `Cheque` to `CHEQUE` and throws for
  unknown methods; it never maps an unknown method to `CREDIT`.
- The S-27 scenario-matrix row is corrected from an unsupported-method rejection
  case to a supported-method case. The original expectation is retained in this
  record's history for traceability.
- Cheque payments use the same validation, receipt sequencing, idempotency, ledger,
  balance, allocation, reversal, refund, and reporting paths as other supported
  methods. No method-specific bypass exists.

Acceptance criteria:

1. A valid `Cheque` payment is accepted at the trusted validation boundary.
2. Unsupported payment methods remain rejected.
3. Cheque persistence uses the normal payment, ledger, and receipt paths.
4. Allocation, reversal, refund, and balance behavior is method-independent.
5. Tests prove both valid acceptance and invalid-method rejection.

## Consequences if the decision had remained open (historical)

- V1 payment-method scope would stay ambiguous.
- The S-27 matrix expectation would remain unimplementable/contradictory.
- Any claim that "all validation boundaries are verified" would be false.

## Evidence

- `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md` (S-27, corrected)
- `.obsidian-vault/specs/financial-reconciliation/classification-runtime-campaign-2026-11-08.md` §Owner decisions (historical)
- `tests/payment-method-currency-policy.test.mjs` (S-27 acceptance and rejection)
- `tests/financial-reconciliation-foundation-contract.test.mjs` (explicit `CHEQUE` mapping)
- `src/app/billing/payments/new/_form.tsx`, `src/app/purchases/payments/new/_form.tsx`,
  `src/app/_actions/sales.actions.ts`, `src/lib/validation/sales.schemas.ts`
