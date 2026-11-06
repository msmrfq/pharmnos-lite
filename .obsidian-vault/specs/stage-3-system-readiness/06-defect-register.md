---
title: Pharmnos Lite Stage 3 Defect Register
date: 2026-11-07
time: 02-25-00
status: Wave 2 bounded remediation in progress
---

# Defects and disposition

| ID | Severity | Root cause | Impact | Minimum safe correction/evidence | Criterion |
|---|---|---|---|---|---|
| D-01 | High | Finalized purchase immutability trigger permitted finalized DELETE and omitted immutable metadata fields | Historical financial/supplier/tax records could be altered or removed | Added migration `0021_reject_finalized_purchase_deletes` with explicit parent/item DELETE guards; focused static regression passes. Remaining field-matrix gaps require follow-up before closure. | ST3-C/G |
| D-02 | High | Tenant-owned foreign keys are often ID-only | Cross-tenant association can bypass relational integrity | Design composite tenant keys/FKs or documented compensating controls; migration/recovery proof | ST3-B/C/G |
| D-03 | High | Prisma schema omits custom SQL protections | Future migrations can drift or remove critical controls | Establish schema ownership and drift guard; verify required objects | ST3-C/I |
| D-04 | High | No rollback/down migration and no verified restore drill | Failed migration may require unproven manual recovery | Authorized isolated backup/restore/PITR drill; document forward-fix policy | ST3-C/I |
| D-05 | High | Connected financial-E2E execution is gated and current target-bound runtime is not verified | Current-source financial/tenant acceptance cannot be claimed | Authorized immutable target and approved executable initialization package | ST3-B/E/G/H |
| D-06 | High | Mutable request claim GUCs are trusted by RLS under arbitrary SQL | Forged claims could cross tenants if arbitrary SQL is exposed | Preserve server-only boundary; independent security disposition or stronger identity binding | ST3-B |
| D-07 | High | No distinct goods-receipt lifecycle; finalization immediately receives invoice quantity | Partial/rejected deliveries cannot be represented | Explicitly document current scope or implement only if required; do not assume receipt | ST3-E/G |
| D-08 | Medium/High | Stock and ledger orchestration is duplicated between actions and unused services | Fixes/tests can target a non-production path | Select one authoritative path; add boundary tests; serialize refactor | ST3-A/G |
| D-09 | Medium | `recordMany` uses separate transactions and invalid quantities clamp to zero | Partial stock postings and meaningless movements possible | One transaction and fail-closed quantity validation with regression tests | ST3-E/G |
| D-10 | Medium | Sales and purchase free quantity/batch semantics are not explicit | Stock quantity and batch traceability can diverge | Owner-approved contract plus focused tests; no implementation before policy | ST3-E/F/G |
| D-11 | High | Payment relations lack tenant/semantic constraints and ledger posting uniqueness | Misassociated or duplicate payments can corrupt balances | Composite/semantic constraints and idempotency invariants | ST3-C/G |
| D-12 | Medium | No structured production observability or verified deployment gates | Incidents and unsafe releases may go undetected | Document minimum gates or add bounded operational tooling | ST3-H/I |
| D-13 | Medium | No committed current-source authenticated browser harness | UI regressions cannot be reproduced as a supported test | Add only if required by frozen evidence; bind to target/source | ST3-H |
| D-14 | Policy/professional | Statutory rounding, ITC, cess/UTGST/inclusive treatment unresolved or deferred | Cannot claim complete GST/statutory readiness | Preserve fail-closed boundaries and record professional dependencies | ST3-D/E |

## Current blocker classification

D-02 through D-07 and D-11 remain release/migration-readiness blockers until resolved or explicitly accepted with evidence. D-01 is partially remediated: finalized parent/item deletes now fail closed in source, but the complete immutable-field matrix and disposable database proof remain open. D-08 through D-13 require bounded triage. D-14 is not an engineering defect where behavior correctly fails closed, but remains a scope/professional dependency.
