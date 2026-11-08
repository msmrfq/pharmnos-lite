---
title: Pharmnos Lite Recovery Readiness Disposition
date: 2026-11-08
status: Provider identity verified; backup/PITR and Storage recovery remain unverified
---

# Verified

- Current-source local data-only restore passed on an explicitly disposable
  target after a plain restore rolled back on circular foreign-key ordering.
- Thirty-four public tables matched by deterministic row/count checksums.
- Separate normal Prisma migration replay through `0021` and idempotent deploy
  evidence is preserved; it is not being rerun in this campaign.
- Exact disposable targets were created from contracts and cleaned through
  exact target-bound Compose disposal.
- Latest cleanup artifact: `28-current-source-targeted-cleanup-evidence.json`.

## Provider discovery and bounded recovery campaign

The configured hosting arrangement is Supabase hosted PostgreSQL plus
Supabase Storage, identified by the application’s Supabase adapter
configuration and the server-side `DATABASE_URL`/`DIRECT_URL` boundary. No
production or hosted database was contacted during this campaign.

Read-only Supabase MCP metadata identified the exact project as
`lizyjqkckysgvffwcqvb` (Pharmnos Lite), organization Pharmnos, region
`ap-south-1`, PostgreSQL `17.6.1.171`, and current status **INACTIVE**. The
organization plan is **Free**. The repository Supabase URL host matches this
project. The configured database host is a regional pooler hostname and was
not opened, so the active database connection cannot independently be proven
to target this project from the hostname alone.

The Supabase CLI is not installed. No project backup inventory, dashboard
export, PITR configuration snapshot, latest-backup timestamp, recovery-window
record, or provider restore authorization was exposed by the available MCP
actions. Because the project is inactive, the read-only `storage.buckets`
query was unavailable. Therefore daily-backup status, retention, PITR
enablement/window, recovery points, and current bucket visibility remain
**UNVERIFIED**.

Supabase’s current backup documentation states that daily backups are
available for Pro, Team, and Enterprise projects, PITR is an add-on for those
plans, and PITR’s documented worst-case RPO is two minutes when enabled. These
are provider capabilities, not evidence that this project has the feature
enabled. Source:
`https://supabase.com/docs/guides/platform/backups`.

The existing local restore is the only executed restore exercise: a data-only
export into a pre-provisioned isolated disposable schema, with 34-public-table
deterministic checksum/read-count comparison and exact cleanup. It did not use
a provider backup or PITR recovery point. Recovery duration and data-loss
window were not measured or retained, so no RPO/RTO claim is made.

Recovery requirements remain owner decisions:

| Requirement | Current disposition |
|---|---|
| RPO | Pending owner approval; provider capability not verified |
| RTO | Pending owner approval; provider restore duration not measured |
| Retention | Pending provider/project evidence |
| Recovery scope | PostgreSQL schema/data/security objects; Storage API objects require separate verification |
| Integrity gate | Schema/migration state, relationships, financial readback, RLS, functions, triggers, indexes, roles, and application/auth checks |
| Ownership | Provider recovery operation plus Pharmnos application restore validation; exact operational owner not recorded |

Evidence paths: this disposition; `22-recovery-and-operations-evidence.md`;
`q15-1793461099812-restore-comparison.json`;
`q15-1793461099812-backup.sql`; `decisions/0003-backup-sop.md`; and the
sanitized provider evidence
`35-provider-recovery-evidence-2026-11-08.json`.

Independent review disposition: **ST3-I PARTIAL / NOT ACCEPTED**, with no
provider-level acceptance claim. The reviewer confirmed that provider
capability documentation is not project evidence and that the local restore is
appropriately bounded. The acceptance gate must also include explicit
Supabase Storage-object backup, retention, restore, and application-integrity
evidence, or an owner-approved decision to scope Storage out of Stage 3.
The reviewer also flagged that the existing SOP’s `--disable-triggers`
restore-portability statement does not specify the privileges required by the
restore role; this remains an owner-reviewed operational limitation and was
not silently changed during this campaign.

# Not verified

No authoritative evidence is available for provider PITR configuration,
retention, offsite copies, RPO, RTO, restore authorization, provider-supported
restore drills, monitoring, alerting, or production recovery ownership.

The local data-only restore was into a pre-provisioned schema and is not a
complete schema-and-data backup proof. It must not be presented as provider
disaster-recovery acceptance.

# Disposition

ST3-I remains **PARTIAL / NOT ACCEPTED**. The exact project identity and Free
plan are now provider-verified, but no provider backup/PITR or Storage-object
recovery evidence is available. No provider or production operation was
authorized or executed. The local restore is runtime-verified disposable
engineering evidence only. Required next evidence is an owner-authorized
Dashboard/API inspection of backup inventory, retention, PITR eligibility and
recovery points, plus a separately documented Storage-object recovery
mechanism, before any provider-supported restore is considered.
