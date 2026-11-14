---
title: Owner Decision Closure & Financial Acceptance
date: 2026-11-14
status: Decision closure complete — self-verified; production verdict unchanged (NO-GO)
baseline commit: 659aa5356afa18f7e631ef81eca9034f266992e3
---

# Owner Decision Closure & Financial Acceptance — 2026-11-14

## 1. Mandate

Record and implement the owner's final decisions for S-27, S-28, and S-30,
preserve the approved V1/V2 boundary, verify the consequences, and keep the
production readiness verdict separate. No decision was reopened.

| Decision | Owner-authorized outcome | Authoritative record |
|---|---|---|
| S-27 | **Cheque is supported in V1** (Option A) | `decisions/0012-s27-cheque-payment-scope.md` |
| S-28 | **Concurrency correctness is mandatory**, using the existing exact scenario | `specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md` (S-28 row + confirmation note) |
| S-30 | **INR only** at the trusted validation boundary; no conversion | `decisions/0013-s30-payment-currency-scope.md` |

## 2. S-27 — Cheque supported

- **Decision record:** `.obsidian-vault/decisions/0012-s27-cheque-payment-scope.md`,
  status `Accepted — owner-authorized 2026-11-14`.
- **Authoritative expectation:** the S-27 matrix row was corrected from an
  unsupported-`Cheque` rejection case to a supported-method case. The original
  expectation remains recorded in decision 0012 for traceability.
- **Application paths verified:** `CustomerPaymentMethodSchema` and
  `SupplierPaymentMethodSchema` already include `Cheque`; both payment forms offer
  it; `paymentMethodToPrismaMode` maps `Cheque` to `CHEQUE` and throws for unknown
  methods. No method-specific financial path exists — Cheque uses the same receipt
  sequencing, idempotency, ledger, balance, allocation, reversal, refund, and
  reporting code as Cash/UPI.
- **No new cheque workflow** (clearing, deposit, dishonour, bank settlement) was
  added. Those remain V2 and are not claimed.
- **Tests added:** `tests/payment-method-currency-policy.test.mjs` proves Cheque
  acceptance for both customer and supplier payments, acceptance of every supported
  method, rejection of unknown methods, explicit `CHEQUE` mapping, and the absence
  of a `CREDIT` fallback.
- **PostgreSQL evidence:** the disposable runtime harness records a customer and a
  supplier payment through the real actions with `payment_method = "Cheque"`. Both
  persisted with `payment_mode = CHEQUE`, one ledger row each, and unique receipt
  numbers (`PAY-00001`, `PAY-00002`); the idempotent replay was write-free.
- **Result:** **VERIFIED**, including real PostgreSQL persistence, ledger effect,
  receipt allocation, and idempotent replay. Cheque allocation, reversal, and
  balance behavior use the method-independent financial paths covered by the full
  suite.

## 3. S-28 — Concurrency correctness

### 3.1 Authoritative scenario (preserved)

The exact matrix row remains:

> Control case: no invoice/payment financial state; four barrier-synchronized
> receipt requests for one tenant. All financial fields do not apply; four unique
> serialized receipt numbers are returned and persisted sequence state reflects
> them. Tenant sequence/unique constraint, rollback and cross-tenant denial;
> count-based generation is rejected as unsafe.

A confirmation note was added above the table: concurrency correctness is a
mandatory V1 acceptance criterion, and the row is not replaced or simplified.

### 3.2 Root cause

No defect was found in the current worktree. The accepted implementation already
uses a tenant-scoped atomic upsert:

```sql
INSERT INTO "payment_receipt_sequences" ("tenant_id", "prefix", "next_value")
VALUES (..., 2)
ON CONFLICT ("tenant_id", "prefix")
DO UPDATE SET "next_value" = "payment_receipt_sequences"."next_value" + 1
RETURNING "next_value" - 1
```

with `payments_tenant_receipt_no` as the unique backstop, forced RLS on the
sequence table, and no count-based generation. Historical campaigns corrected the
earlier count-based allocator and the missing restricted-role grant; those
corrections are prerequisites, not new changes in this campaign.

### 3.3 Runtime evidence

- **Target:** fresh loopback-only disposable PostgreSQL 17.11 container
  (`pharmnoslite-financial-e2e-odc20261114a`), tmpfs storage, no restart, image
  `postgres:17-alpine`, single container, label `financial-e2e-isolated`.
- **Provisioning:** `EMPTY_BASELINE` from the current generated schema artifact;
  39 forced-RLS tables, 102 policies, 35 triggers, 160 constraints, runtime role
  `pharmnos_e2e_runtime` (`NOSUPERUSER`, `NOBYPASSRLS`) with **0** DELETE
  privileges. Signing secret and per-run credentials were generated in memory and
  retired with the target.
- **Harness:** `scripts/financial-reconciliation-runtime-harness.cjs` with
  `FINANCIAL_RECONCILIATION_SELECTION=receipt`; the Prisma singleton was bound to
  the restricted runtime role. Harness summary: **pass 3, fail 0**. The three
  records are the customer/supplier Cheque payment-action regression (S-01, S-04)
  and **S-28 PASS**.

S-28 observed assertions (sanitized evidence
`specs/evidence/financial-reconciliation-s28-runtime-odc20261114a.json`):

| Assertion | Observed |
|---|---|
| Barrier arrivals, default isolation | 4 |
| Four serialized receipt numbers | `PAY-00001` … `PAY-00004`, all unique |
| Persisted `PAY` sequence | `next_value = 5` |
| Serializable callers / barrier arrivals | 4 / 4 |
| Serializable receipts | `SERIAL-00001` … `SERIAL-00004`, all unique |
| Retry attempts per caller | 4, 2, 3, 1 (bounded, ≤ 5) |
| Serialization failures observed | `40001` and `P2010` retry path exercised |
| Persisted `SERIAL` sequence | `next_value = 5` |
| Exhausted retry | 5 attempts, `P2010/40001`, rolled back; balance `0.00`, sequence rows `0` |
| Non-retryable failure | 1 attempt, no retry |
| Cross-tenant read/update | 0 visible, 0 updated |
| Cross-tenant insert | rejected by RLS (`42501`) |
| Cross-tenant sequence untouched | `OTHER` remains `next_value = 9` |
| Controlled rollback | `controlled receipt rollback`; balance `0.00`, sequence rows `0` |
| Financial side effects | payments `0`, customer ledgers `0`, supplier ledgers `0` |
| Sequence table controls | RLS enabled + forced; no DELETE; `tenant_id` not updatable; `next_value` updatable |

- **Cleanup:** lifecycle disposal PASS, `verifiedAbsent: true`; no container and
  no listener remained on the target port.
- **Result:** **VERIFIED on real disposable PostgreSQL.** The exact scenario
  passes; the evidence is current-worktree evidence, not a historical replay.

### 3.4 Limits of the S-28 evidence

- The scenario proves the receipt-allocation boundary and its tenant/rollback
  behavior. It does not re-prove every payment endpoint under concurrent load.
- The target is a disposable EMPTY_BASELINE target, not a production topology.
- This is self-verification, not independent acceptance.

## 4. S-30 — INR only

- **Decision record:** `.obsidian-vault/decisions/0013-s30-payment-currency-scope.md`,
  status `Accepted — owner-authorized 2026-11-14`.
- **Implementation:** `PaymentCurrencySchema` in
  `src/lib/validation/sales.schemas.ts` is now part of both
  `CustomerPaymentCreateSchema` and `SupplierPaymentCreateSchema`.
  - Absent, `null`, or empty currency follows the existing owner-approved
    single-currency contract (amounts are INR); no new default was invented.
  - Any supplied currency must resolve to `INR`; all other values fail closed with
    "Only INR payments are supported. Currency conversion is not available."
  - No conversion, no normalization of another currency, and no currency column or
    persistence change was introduced.
- **Entry points verified:** the only `payments.create` paths are
  `createCustomerPaymentAction` and `createSupplierPaymentAction`, and both parse
  the schemas before `prisma.$transaction`. The repository refuses direct payment
  creation/update/delete, and there are no payment import routes or API endpoints.
- **No partial mutation:** rejection occurs before the transaction opens, so no
  payment, ledger, audit, sequence, or balance row is written.
- **Tests added:** `tests/payment-method-currency-policy.test.mjs` covers INR,
  lowercase/whitespace INR, non-INR (`USD`, `EUR`, `GBP`, `AED`, text, malformed),
  missing/null/empty currency, non-string values, action-before-transaction
  ordering, and the absence of a persisted/converted currency.
- **Result:** **VERIFIED** at the trusted server-side boundary.

## 5. Verification

| Gate | Command | Result |
|---|---|---|
| Focused contracts | `pnpm exec node --test tests/payment-method-currency-policy.test.mjs tests/payment-receipt-sequencing-contract.test.mjs tests/financial-reconciliation-foundation-contract.test.mjs tests/financial-date-input-regression.test.mjs tests/financial-reconciliation-receipt-provisioning.test.mjs` | **42/42 pass**, exit 0 |
| Full offline suite | `pnpm exec node --test .\tests\*.test.mjs` | **661/661 pass**, exit 0 |
| TypeScript | `pnpm run typecheck` | exit 0 |
| Lint | `pnpm run lint` | no warnings/errors, exit 0 |
| Prisma validate | `pnpm exec prisma validate` (dummy validation-only env) | valid, exit 0 |
| Prisma generate | `pnpm exec prisma generate` | generated, exit 0 |
| S-28 PostgreSQL runtime | lifecycle + provisioning + receipt harness | S-27 Cheque persistence **PASS**; S-28 **PASS**; provisioning PASS; cleanup PASS |

`git diff --check` reports pre-existing trailing whitespace in
`scripts/test-context-isolation-simple.js` and `scripts/test-cross-tenant-isolation.js`
(present before this campaign); no new whitespace defect was introduced by the
S-27/S-30 changes.

## 6. V1 scope protection

- Deferred V2 scope is unchanged: imports/exports, SEZ, deemed exports, UIN
  holders, reverse charge, e-invoice/e-way bill, GSTR filing, ITC reconciliation,
  credit/debit notes and returns, multiple GST registrations.
- No V2 workflow was implemented or counted.
- Cheque clearing/bank settlement and multi-currency/FX remain explicitly outside
  this campaign.

## 7. Remaining production blockers (unchanged)

1. **Tenant-context/read-path security:** RSC loaders, reports, dashboard, print
   views, and exports still do not establish per-request tenant DB context; the
   production role remains privileged, so RLS does not bind on those paths.
2. **Credential exposure/rotation:** the tracked credential-bearing environment
   file and credential revisions in Git history remain; no rotation was performed.
   No shared/production credential was read, switched, or rotated.
3. **Opening-stock/schema runtime proof:** the opening-stock repair and schema
   drift corrections still need disposable PostgreSQL proof on their own paths
   (this campaign's target applied the baseline and exercised payments, not the
   opening-stock workflow).
4. **Independent acceptance:** not achieved. This campaign is self-verification by
   the implementing agent.

Successful S-27/S-28/S-30 closure does **not** produce a production GO.

## 8. Repository integrity

- Initial and final HEAD: `659aa5356afa18f7e631ef81eca9034f266992e3`.
- No commit, push, merge, rebase, reset, clean, stash, or history rewrite.
- Pre-existing modified and untracked files were preserved.
- New changes in this campaign:
  - `src/lib/validation/sales.schemas.ts` (INR-only payment currency)
  - `scripts/financial-reconciliation-runtime-harness.cjs` (Cheque runtime fixture
    and `payment_mode` assertion; the S-28 scenario definition is unchanged)
  - `tests/payment-method-currency-policy.test.mjs` (S-27/S-30 regressions)
  - `.obsidian-vault/decisions/0012-s27-cheque-payment-scope.md`
  - `.obsidian-vault/decisions/0013-s30-payment-currency-scope.md`
  - `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md`
  - `.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-policy-matrix.md`
  - `.obsidian-vault/specs/production-readiness-remediation-acceptance-2026-11-14.md`
    (status-update note only)
  - `.obsidian-vault/specs/evidence/financial-e2e-{infrastructure,initialization,cleanup}-evidence-odc20261114a.json`
  - `.obsidian-vault/specs/evidence/financial-reconciliation-s28-runtime-odc20261114a.json`
  - this report
- `tsconfig.tsbuildinfo` was generated by the TypeScript gate and restored to its
  `HEAD` content; it is not a campaign change.

## 9. Verdict

- **Decision closure:** COMPLETE (S-27 and S-30 accepted; S-28 scenario preserved
  and runtime-verified).
- **S-27:** VERIFIED.
- **S-28:** VERIFIED on disposable PostgreSQL with archived sanitized evidence.
- **S-30:** VERIFIED at the trusted validation boundary.
- **Production readiness:** **NO-GO** — the four production blockers above remain,
  and independent acceptance has not occurred.
