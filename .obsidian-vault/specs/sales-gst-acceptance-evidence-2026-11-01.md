# Sales GST Acceptance Closure Evidence — 2026-11-01

**Result: PASS** · `RECOVERY PLAN` superseded by a fresh disposable-target acceptance campaign.

## Target

| Field | Value |
|---|---|
| Host/port | `127.0.0.1:55450` |
| Database | `pharmnos_financial_e2e_salesgst_mvxvql2g9dacd0c0` |
| Compose project | `pharmnoslite-financial-e2e-salesgst-mvxvql2g9dacd0c0` |
| Marker | `pharmnos-financial-e2e` |
| Bootstrap role | `pharmnos_e2e` |
| Restricted runtime role | `pharmnos_e2e_runtime` |
| Campaign run ID | `sales_gst_campaign_1793540554806_5441f9` |
| Internal contract run ID | Not captured by the orchestrator; the wrapper generates it at runtime and never persists it. |

## Scenarios executed (all application-path, database E2E)

| Scenario | Result |
|---|---|
| GST-014 sales insufficient-FEFO rollback | PASS |
| GST-015 purchase fail-closed rollback (status/sequence/posting/stock/ledger unchanged; exact reason not asserted) | PASS |
| SALES-SUCCESS intra-state finalization + CGST/SGST | PASS |
| PURCHASE-SUCCESS accepted purchase finalization | PASS |
| PURCHASE-GST-REVIEW-GUARD unreconciled block | PASS |
| PAYMENT customer/supplier payment | PASS |
| GST-016 finalized snapshot immutability | PASS |

## Database verification

- Provisioning PASS; RLS tables 33; policies 84; triggers 16; constraints 123.
- Runtime `DELETE` privileges 0; tenant RLS privileges PASS.
- Fixture ownership manifest recorded 45 run-owned resources.
- Immutable history preserved (never deleted); disposal performed at database level.

## Disposal

The mission-created disposable target was disposed at the database level after
capturing evidence. The evidence-bearing 0419 target and all pre-existing
containers were left untouched. No production or Live Supabase access occurred.

## Corrections made

1. Fixture ownership collector resolves users via memberships (fail-closed).
2. Acceptance runner uses one ts-node CJS module instance for the auth adapter.
3. Sales/purchase fixtures carry `gst_treatment`, approved HSN/SAC catalog + GST
   rate rules, and per-line accepted accounting snapshots.
4. `DISPOSABLE_TARGET_DISPOSAL` mode defers immutable-history cleanup to
   database-level disposal; row-level deletion of immutable history is rejected.
5. New `scripts/sales-gst-acceptance-campaign.mjs` orchestrates unique-target
   create → accept → dispose.

## Verification totals

- Focused regression tests: 31/31 pass.
- Full JavaScript test suite: 231/231 pass.
- TypeScript typecheck: PASS.
- Prisma validate: PASS.
- `git diff --check` and changed-file ESLint: PASS.
- Known pre-existing tooling gap: `tests/gst-calculator.test.ts` remains
  unrunnable via `node --test` (missing `tsx` runner); not claimed as passing.

**Production readiness: NOT IMPLIED.**
