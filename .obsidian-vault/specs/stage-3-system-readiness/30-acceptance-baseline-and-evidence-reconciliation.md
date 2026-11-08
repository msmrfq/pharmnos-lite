---
title: Pharmnos Lite Current-Release Acceptance Baseline and Evidence Reconciliation
date: 2026-11-07
status: Complete; owner policy confirmed; technical acceptance remains open
---

# Baseline

- Branch: `main`
- HEAD: `c0150084302fbba47230386f378d4cadf65f47ea`
- Worktree: pre-existing staged, unstaged, and untracked changes preserved.
- Git destructive operations, staging, commits, pushes, branch changes, and
  history rewrites: not performed.
- Frozen matrix: unchanged, 10 criteria, 100 points.
- Production, shared databases, Live Supabase, deployment, and release:
  not touched.

# Evidence classes

| Class | Current evidence |
|---|---|
| Implemented | Purchase authorization/cancellation/document locking, finalized-purchase immutability, fail-closed payment overage handling, explicit inventory valuation service, immutable target lifecycle. |
| Static/test verified | Valuation and remediation contracts pass; typecheck, lint, production build, syntax validation, Prisma safe-placeholder validation, and `git diff --check` pass. |
| Disposable-runtime verified | Target-bound Purchase GST and Sales action-path scenarios passed with restricted role attributes and source hashes in `27-current-source-targeted-runtime-evidence.json`. |
| Cleanup verified | Exact target `stage3_targeted_20261107a` was disposed and verified absent in `28-current-source-targeted-cleanup-evidence.json`; unrelated stopped containers were preserved. |
| Authenticated-browser verified | None. No suitable authenticated browser harness exists. |
| Independently accepted | ST3-F bounded Sales action-path scope only. Technical review rejects unconditional acceptance; financial review rejects final acceptance; security review rejects unconditional acceptance outside the scoped server-only threat model. |
| Owner-approved policy | Paid/free quantities are separate; total physical receipt posts to stock; payable/value remain paid-quantity based; recoverable GST is excluded from acquisition cost; nonrecoverable GST is included; partial recovery is split; unresolved classification remains `PENDING`; supported Regular exclusive arithmetic and fail-closed unsupported boundaries. |
| Qualified professional/statutory confirmation | Not required as an internal acceptance gate by explicit owner decision; no government certification or professional endorsement is claimed. |

# Reconciled findings

| ID | Finding | Current disposition |
|---|---|---|
| D-01 | Finalized purchase mutation/delete protection | Remediated and disposable-runtime verified. |
| D-02 | Supplier document replacement race | Remediated with row locking and finalization recheck; current-source evidence recorded. |
| D-03 | Purchase read authorization | Remediated with explicit permission and tenant context. |
| D-04 | Draft cancellation race/audit | Remediated with conditional transaction and audit event. |
| D-05 | Payment overage clamping | Remediated by rejection; no unapplied-credit feature is claimed. |
| D-06 | Free-quantity and goods-receipt semantics | Owner decision confirmed and bounded implementation added; prior purchase runtime evidence is stale for the current source hash, so fresh target-bound persisted readback remains required. |
| D-07 | GST/accounting policy boundaries | Owner-approved current-release policy is recorded; unsupported V2 boundaries remain fail-closed. |
| D-08 | Caller-settable request-claim GUCs | HIGH residual trust-boundary risk outside the scoped server-only threat model. |
| D-09 | Browser E2E | Evidence gap; not implemented. |
| D-10 | Provider recovery | Evidence gap; local restore is not provider PITR/RPO/RTO proof. |
| D-11 | Independent final acceptance | Not established; fresh reviews preserve NO-GO. |

# Scope boundary

Credit/debit notes, ITC automation/reconciliation, RCM, e-invoicing/e-way
bills, GST returns, imports/exports, SEZ/deemed exports, UIN, multiple
registrations, and other approved exceptional GST workflows remain deferred to
V2. No related code, schema, API, permission, migration, or background job was
introduced.
