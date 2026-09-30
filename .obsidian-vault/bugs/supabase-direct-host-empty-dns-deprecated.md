---
title: Supabase Direct Host db.<project-ref>.supabase.co:5432 Deprecated Empty DNS on Modern Supavisor Projects
date: 2026-09-30
status: Open
---

## Steps to Reproduce
1. Provision a NEW free-tier Supabase project any time after early-2025 (fleet migrated to Supavisor pooled deployment, project uses aws-0-<region>-1.pooler.supabase.com hostname for all connections).
2. Read older (pre-migration) Supabase blog posts / third-party integration guides / Prisma write-ups and follow the "Transaction mode → pooler host:6543, Session mode → direct legacy host db.<project-ref>.supabase.co:5432" split-host pattern.
3. Set `.env.local DIRECT_URL` to `postgresql://postgres:password@db.<project-ref>.supabase.co:5432/postgres?sslmode=require`.
4. Attempt `Resolve-DnsName db.<project-ref>.supabase.co A` or `nslookup db.<project-ref>.supabase.co`.

## Expected Behaviour
Direct host resolves to at least one A record (Supabase primary Postgres instance). Prisma commands using DIRECT_URL (transaction-free session-mode DDL operations like migrate diff, introspect) connect and succeed.

## Actual Behaviour
- DNS A query returns exactly zero A records. NXDOMAIN or empty Answer section depending on resolver.
- Any connection attempt to the direct host on any port fails immediately with DNS resolution errors (not timeout, not TLS error, not auth error).
- Supabase dashboard Connection Strings → URI → Session mode (5432) dropdown on the same project actually shows the SAME pooler.supabase.com hostname — NOT the legacy db.* host. Docs were updated late 2025.

## Root Cause
Supabase completed the fleet migration to the Supavisor pooled architecture for all newly-provisioned projects in the 2024-2025 window. The legacy per-project dedicated Postgres DNS hostname `db.<project-ref>.supabase.co` is no longer created for new projects; the modern pattern is a single shared regional pooler hostname `aws-0-<region>-1.pooler.supabase.com` for BOTH Transaction (6543) and Session (5432) modes. Hostnames differ only by port, not by FQDN; the `<db-user>.<project-ref>` prefix in the username segment tells Supavisor which tenant Postgres cluster to route the session to. Older projects provisioned before the migration still have the legacy FQDN — which is why the older guides still reference it. New projects never get it.

## Severity
Low. Cost today: ~10 minutes diagnostic + URI re-alignment. Fixed once per project during setup. No recurrence expected once the correct pattern is committed to project onboarding docs.

## Remediation Checklist
- [x] Phase 2 `.env.local` URIs re-written to CORRECT modern pattern for BOTH URLs: host = `aws-0-ap-south-1.pooler.supabase.com`, port = 6543 for BOTH DATABASE_URL and DIRECT_URL on this project. Username format = `prisma.<project-ref>` prefix. pgbouncer=true, connection_limit=1, sslmode=require preserved.
- [x] New project onboarding notes (daily note 2026-09-29 "Commands to remember" section + decision record 0001 workaround) now document the shared-pooler-host-for-both-ports pattern explicitly, with a warning that legacy db.* hostnames do NOT resolve on post-Supavisor projects.
- [ ] Optional: add .env.example comment lines next to DATABASE_URL and DIRECT_URL with the pattern copy-paste line plus explicit anti-pattern warning "DO NOT use db.<project-ref>.supabase.co — deprecated, empty DNS on new projects."
