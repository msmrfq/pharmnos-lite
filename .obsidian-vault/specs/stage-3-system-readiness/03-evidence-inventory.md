---
title: Pharmnos Lite Stage 3 Evidence Inventory
date: 2026-11-07
time: 02-25-00
status: Initial inventory after Wave 1
---

# Source-to-evidence map

| Capability | Primary source | Existing tests/evidence | Current status | Gap |
|---|---|---|---|---|
| Auth/session | `src/adapters/auth/supabase-auth.adapter.ts`, `src/app/auth/_actions/auth.actions.ts`, `src/lib/db/tenant-context.ts` | Auth adapter contracts; prior local Auth sign-in evidence | Static protections observed | No current runtime revocation/expiry evidence; recovery callback routes need confirmation |
| Authorization/tenant isolation | `src/lib/db/tenant-context.ts`, Prisma custom SQL, RLS contracts | RLS/authorization contracts; prior restricted-role evidence | Strong application checks and documented server-only boundary | Mutable request-claim GUC residual risk; current target-bound proof not rerun |
| Purchases | `src/app/_actions/purchases.actions.ts`, purchase repositories/services | Purchase finalization and GST contracts; prior disposable evidence | Transactional finalization and idempotency implemented | No distinct goods-receipt lifecycle; free quantity and movement-rate policy gaps |
| Suppliers/documents | `src/app/_actions/invoice-document.actions.ts`, supplier models/migrations | Supplier-document lifecycle contracts and accepted runtime evidence | Private, tenant-scoped, append-only replacement path | Current-source runtime applicability must be source-hash bound |
| Purchase GST | Purchase calculator/reconciliation/actions, GST governance | GST and purchase contracts | Strong supported Regular exclusive path | Current target runtime, statutory rounding, cess/UTGST/inclusive boundaries incomplete |
| Sales | `src/app/_actions/sales.actions.ts`, FEFO/GST/document services | Sales finalization contracts and accepted browser evidence | Finalization, numbering, snapshots, ledger, FEFO implemented | Free quantity deduction and selected-vs-actual batch traceability gaps |
| Inventory/valuation | Inventory valuation service/actions, batch/stock repositories | Valuation and stock adjustment contracts | Fail-closed pending valuation and append-only decisions | No goods-receipt boundary; movement atomicity and invalid-quantity gaps |
| Ledgers/payments | `src/domain/services/ledger-impact.service.ts`, ledger/payment repositories/actions | Payment and finalization contracts | Supplier/customer postings and locks implemented | Payment tenant FKs/semantic checks incomplete; duplicate posting DB invariant absent |
| Database/migrations | `prisma/schema.prisma`, `prisma/migrations` | Prisma validation and migration evidence | Forward chain ordered | Immutability delete/field gaps, schema drift, no rollback/restore proof, dirty-data migration risk |
| Runtime target lifecycle | `scripts/financial-e2e-*`, compose/config files | Target/lifecycle/provisioning contracts | Fail-closed lifecycle implemented | Current target-bound runtime not verified; executable package/init gates block execution |
| Browser E2E | App routes/forms, prior invoice evidence | Historical browser campaign evidence | Prior scoped evidence exists | No committed current-source authenticated browser harness |
| Operations | audit logs, scripts, decisions, package commands | Static/readiness documents | Audit trail exists | No structured logger, correlation IDs, metrics, verified deployment CI, backup restore, or PITR proof |
| Non-GST | purchase/sales/payment/report routes | Source capability and selected contracts | Supported paths exist in source | Current runtime evidence is incomplete; deferred V2 features remain out of scope |

## Evidence classification rule

Static inspection, unit/contract tests, direct action harnesses, authenticated browser E2E, disposable database evidence, and independent acceptance remain separate evidence classes. No claim is promoted across classes without its required execution proof.

