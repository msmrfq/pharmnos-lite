---
title: CREATE TABLE-Only Schema Export Blind Spots (Enums Indexes RLS Grants Rowcounts Omitted)
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. After running a large DDL paste (19 tables, 37 FKs) into Supabase SQL Editor, use the Supabase Table Editor → Schema Visualizer → export context "CREATE TABLE" option, or the `pg_dump` --schema-only flag with `--section=pre-data --no-owner` (Supabase export shortcuts), to export what you think is the "entire live schema" of the public schema to a 364-line plain SQL file.
2. Give the exported file to another developer or a diff tool and ask them to compare it against the intended state of prisma/schema.prisma + RLS + GRANTs.
3. Ask: does the live DB have all 8 enum types defined with all PermissionAction 28 labels? All 14 unique indexes from schema.prisma unique blocks? RLS ENABLE ROW LEVEL SECURITY flag set on every business table? GRANT INSERT/SELECT/UPDATE/DELETE TO authenticated on each table? Enum USAGE grants to authenticated/prisma so casts work? How many rows are currently in tenants / roles / role_permissions tables?

## Expected Behaviour
The export file contains the complete live state of the schema. Enumerated types with all value labels, CREATE UNIQUE INDEX statements, ALTER TABLE ENABLE ROW LEVEL SECURITY statements, GRANT statements, and either row counts or at least a quick SELECT-count query appended so the consumer can tell if a previous seed run partially succeeded.

## Actual Behaviour
The export contains ONLY CREATE TABLE statements with column types, TEXT PRIMARY KEYs, and ALTER TABLE ADD CONSTRAINT FOREIGN KEY lines. 5 entire classes of information are silently missing:
1. **Enum types and their labels.** Postgres CREATE TYPE AS ENUM (...) statements are not emitted. You cannot tell from the export alone whether `PermissionAction` has 28 labels or 19 — both produce a column of type `permissionaction`.
2. **Unique indexes.** `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` lines are omitted. The seed file's idempotency pattern (WHERE NOT EXISTS against unique checks like roles.(tenant_id+name)) fails silently or creates duplicate rows if the indexes were never actually created — you would never notice from only a CREATE TABLE export.
3. **RLS enabled flags.** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` never appears. CREATE TABLE-only says nothing about RLS state.
4. **GRANT and role privilege state.** GRANT statements on tables, sequences, enum types, and default privileges for the postgres role are all gone.
5. **Row counts.** Not a metadata concern, but critical during debugging — no way to tell whether a prior failed seed run inserted partial rows that will collide with a later seed retry.

This blind spot was exposed directly by user's action after the 42601 seed failure: they correctly ordered "full verify before retry" and pasted the CREATE TABLE export; the differential showed only tables/FKs correct, forcing us to write the drift+fix probe SQL to reveal the other 5 dimensions. ~2 rounds of work could have been saved if we'd known the export omits all 5.

## Root Cause
Standard Postgres pg_dump sections split pre-data (types, tables, constraints) and post-data (indexes, triggers, RLS policy). Schema visualizer "CREATE TABLE" context export dumps only the table-creation section as a convenience. GRANTs and privileges are a separate dump `--section=acls` switch. Enum labels live inside pg_enum catalog rows not a textual DDL pass unless `--schema-only --format=plain -Fp` with default sections is called with `--create` on the types. Supabase dashboard shortcuts were written for the common "let a human eyeball the 36 FK lines" case — not the "certify end-to-end drift after paste and partial seed" case.

## Severity
Low. Known workaround = always follow CREATE TABLE export with a drift probe SQL (04 pattern). Filed to prevent future false sense of security.

## Remediation Checklist
- [x] `prisma/04-drift-probe-and-fix.sql` becomes the standard pre-seed pre-retry verification step. Two parts. Part 1 silently re-applies all missing dimensions (CREATE IF NOT EXISTS indexes, repeated ENABLE RLS, repeated GRANTs, enum USAGE grants DO block) idempotently. Part 2 returns single 8-row grid comparing actual vs expected for tables_count / unique_indexes_count / rls_enabled_count / enum_types_count / permissionaction_enum_labels_count + 3 row counts.
- [ ] Add project rule: never trust CREATE TABLE-only exports for verification purposes. If you want to certify a schema, always pair the CREATE TABLE dump with the catalog probe SQL. Do not declare "drift verified" unless the 8-row grid actually returns matching numbers.
