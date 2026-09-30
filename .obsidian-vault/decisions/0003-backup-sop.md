---
title: Backup Standard Operating Procedure
date: 2026-09-30
status: Accepted
---

## Context
PharmnosLite stores business-critical data in a PostgreSQL database. Without a documented, reproducible backup and recovery process, data loss from human error, infrastructure failure, or security incidents would be catastrophic. Existing ad-hoc backups are untested, incomplete, and lack proven recovery steps. This ADR defines a mandatory Standard Operating Procedure (SOP) for database backup, retention, and restore drills covering Supabase Point-in-Time Recovery (PITR) as well as portable pg_dump exports.

## Decision
Adopt the 3-2-1 backup rule as the minimum standard, combined with Supabase managed PITR and documented pg_dump export commands with quarterly restore drills. All backups are classified into three tiers: (1) Supabase continuous WAL/PITR for operational recovery, (2) schema-only pg_dump exports for change management and diffing, and (3) data-only pg_dump exports for cross-environment portability and offline disaster recovery. Every export uses the naming convention `pharmnos-[schema|data]-[ENV]-[YYYYMMDD].sql.gz` and passes placeholders for host, user, and database name—never hard-coded connection strings, DSNs, URLs, or credentials.

## Consequences
- All team members must follow the SOP exactly; deviations require a follow-up ADR.
- Restore drills become a recurring quarterly task; failure to complete a drill blocks production releases.
- Schema-only exports enable safe structural diffing between environments without exposing live production data.
- Data-only exports with `--disable-triggers` allow table-order-agnostic restore into empty staging databases.
- Offsite copy requirement means at least one copy of each export must be stored outside the primary cloud provider's region.
- Supabase PITR 7-day window must be verified monthly; if the window changes this ADR is updated within one business day.

## Standard Operating Procedure (SOP)

### 3-2-1 Backup Rule
- **3 copies of data**: Production live copy + pg_dump export + offsite encrypted copy
- **2 storage formats**: Supabase managed WAL/PITR stream + compressed pg_dump .sql.gz flat files
- **1 offsite copy**: At least one export copy stored on a physically separate provider/region from the primary database

### Supabase Point-in-Time Recovery (PITR)
- Minimum 7-day continuous PITR retention window enabled on all production projects
- Verify PITR window in the project database settings dashboard on the first day of each month
- PITR is the primary recovery method for operational incidents (dropped table, bad migration, accidental delete) within the 7-day window
- For recovery older than 7 days, use the most recent offsite pg_dump export

### pg_dump Export Commands

**Schema-only export (structure, no rows):**
```bash
pg_dump --schema-only --no-owner -h [HOST] -U [USER] [DBNAME] | gzip > pharmnos-schema-[ENV]-YYYYMMDD.sql.gz
```

**Data-only export (rows only, skip schema, disable triggers for clean restore):**
```bash
pg_dump --data-only --no-owner --disable-triggers -h [HOST] -U [USER] [DBNAME] | gzip > pharmnos-data-[ENV]-YYYYMMDD.sql.gz
```

Placeholders:
- `[HOST]` — PostgreSQL host DNS name (do not paste real hostnames or IPs into this SOP)
- `[USER]` — database role name used for backups
- `[DBNAME]` — target database name
- `[ENV]` — one of: `dev`, `staging`, `prod`
- `YYYYMMDD` — export date in UTC

### Restore Drill Steps (Quarterly Mandatory)
1. Provision a clean disposable staging database with no existing PharmnosLite tables
2. Decompress the most recent schema export: `gunzip -k pharmnos-schema-[ENV]-YYYYMMDD.sql.gz`
3. Decompress the matching data export: `gunzip -k pharmnos-data-[ENV]-YYYYMMDD.sql.gz`
4. Apply schema first: `psql -h [HOST] -U [USER] -d [STAGING_DBNAME] -f pharmnos-schema-[ENV]-YYYYMMDD.sql`
5. Apply data second: `psql -h [HOST] -U [USER] -d [STAGING_DBNAME] -f pharmnos-data-[ENV]-YYYYMMDD.sql`
6. Run the post-seed verification script and confirm every row-count assertion matches the source database snapshot
7. Confirm RLS policies are present, enabled, and the cross-tenant isolation probe returns zero rows
8. Log drill results (pass/fail, duration, any issues) in a new daily note and flag for Triage migration
9. Destroy the disposable staging database within 24 hours of drill completion
