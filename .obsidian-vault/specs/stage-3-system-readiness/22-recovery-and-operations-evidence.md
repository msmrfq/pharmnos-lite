---
title: Pharmnos Lite Stage 3 Recovery and Operations Evidence
date: 2026-11-07
status: Local disposable restore PASS; provider-dependent recovery NOT VERIFIABLE
---

# Completed

Both disposable targets were created from explicit contracts, verified, and
disposed through exact target-bound Compose cleanup. Cleanup confirmed the
exact containers were absent. No production, shared, or hosted database was
used.

# Not verified

A current-source local restore drill was completed on an explicitly separate
loopback target. The source data-only export was 117,763 bytes with SHA-256
`7140BF1C23BA263B007E511BB690E5D191124B846719F9F0397A1380EF9286E`; the
successful disposable-only restore artifact was 117,800 bytes with SHA-256
`D77B93CB260D264756D655DABA30C5557614FB2E7FD51D50216A0E2AFDAC18CF`.
The initial plain restore failed and rolled back on circular foreign-key
ordering; the retry succeeded with disposable-only trigger suppression.
Thirty-four public data tables matched by row count and deterministic checksum,
and catalog/RLS/runtime-role observations matched. Both exact targets were
disposed and verified absent.

The restore was a data-only export into a target that had first been
initialized with the current schema artifact. It is not a complete schema
dump and does not prove a normal Prisma migration-history replay through
`0021`; that remains a separate verification gap.

This local drill does not prove provider PITR, offsite backups, retention,
production RPO/RTO, observability/alerting, deployment migration gates, or
production recovery authorization. A documented procedure is not treated as
provider evidence.

## Independent review disposition

The independent recovery review found an older scoped Q15 disposable restore
drill whose evidence reports nine migrations. It supports disposable restore
capability for that historical source only, not the current 21-migration source
through `0021`. No current-source target-bound restore drill, provider PITR
verification, offsite-copy proof, retention proof, RPO/RTO, alerting, or
production recovery authorization exists.

Disposition: local engineering-controlled restore **PASS**; provider-level
recovery remains **OPEN** and requires owner or provider evidence.

## Latest target cleanup

The prior target `stage3_targeted_20261107a` was positively identified by its
immutable target contract and Compose labels. Contract-bound disposal
completed with `verifiedAbsent: true`. The sanitized cleanup artifact is
`28-current-source-targeted-cleanup-evidence.json`; stopped unrelated
containers were preserved.
