---
title: Pharmnos Lite Stage 3 Database Migration Readiness
date: 2026-11-07
time: 02-25-00
status: NO-GO for Stage 4 authorization; bounded D-01 remediation verified statically
---

# Migration readiness

## Positive findings

- Twenty forward migrations are ordered and generally dependency-correct.
- Prisma schema validates with safe placeholder environment values.
- Target-contract provisioning and cleanup scripts enforce important disposable boundaries.

## Blocking findings

- Migration `0021_reject_finalized_purchase_deletes` now rejects finalized purchase invoice and item deletes through dedicated `BEFORE DELETE` triggers. The complete immutable-field matrix remains incomplete, and no disposable database mutation was authorized or executed.
- Tenant-scoped foreign-key integrity is incomplete.
- Prisma schema/custom SQL drift is not automatically guarded.
- Supplier uniqueness migrations lack dirty-data preflight.
- No rollback/down migration exists.
- Backup/restore, PITR, offsite-copy, RPO/RTO, and restore verification are not evidenced.
- Payment subject/tenant invariants are incomplete.

## Decision

Stage 3 may continue with source remediation and disposable verification. It must not authorize production/shared migration execution. Stage 4 planning may be considered only after the frozen criteria and recovery prerequisites are accepted; Stage 4 execution remains separately authorized. Focused source contracts pass; runtime migration/restore evidence is still absent.
