---
title: Pharmnos Lite Stage 3 Remediation Provenance and Change Inventory
date: 2026-11-07
time: 03-15-00
status: Reconciled before disposable runtime verification
---

# Provenance boundary

The reconciliation began from a clean worktree on branch `main` at commit
`c0150084302fbba47230386f378d4cadf65f47ea`
(`System Readiness: Check 1: 07-11-2026`). No staging, branch switching,
reset, checkout, clean, stash, push, or destructive restore operation was used.

The previous Wave 1 approval explicitly covered read-only investigation. The
subsequent commit contains the bounded D-01 source/test remediation and its
Stage 3 evidence updates. That remediation is preserved as existing work; this
reconciliation does not infer or expand authorization for production, shared
database, or release operations.

## Campaign change inventory

| Path | Change | Type | Defect/criterion | Verification | Remaining uncertainty |
|---|---|---|---|---|---|
| `.obsidian-vault/specs/stage-3-system-readiness/00-campaign-blueprint.md` | Wave 1/consolidation campaign record | Documentation | Stage 3 execution provenance | Diff review | Historical campaign record |
| `.obsidian-vault/specs/stage-3-system-readiness/01-agent-execution-plan.md` | Dispatch/recovery plan | Documentation | Stage 3 execution provenance | Diff review | Historical campaign record |
| `.obsidian-vault/specs/stage-3-system-readiness/02-system-baseline.md` through `05-acceptance-matrix.md` | Baseline, evidence inventory, findings, frozen 100-point matrix | Documentation | ST3-A through ST3-J | Diff review | Matrix remains frozen |
| `.obsidian-vault/specs/stage-3-system-readiness/06-defect-register.md` | Wave 1 defects; D-01 marked partially remediated | Documentation | D-01, ST3-C/G | Focused contracts | Runtime proof absent |
| `.obsidian-vault/specs/stage-3-system-readiness/07-gst-verification.md` through `10-financial-reconciliation.md` | GST, non-GST, execution, security, and reconciliation findings | Documentation | ST3-B/D/E/G | Diff review | Policy/professional gaps remain |
| `.obsidian-vault/specs/stage-3-system-readiness/11-database-migration-readiness.md` | Migration readiness disposition | Documentation | ST3-C/I | Safe-placeholder Prisma validation | Restore drill absent |
| `.obsidian-vault/specs/stage-3-system-readiness/12-runtime-verification.md` | Runtime boundary and evidence class | Documentation | ST3-B/E/G/H | Target-contract inspection | No current target evidence |
| `.obsidian-vault/CLAUDE.md` and generated mirrors | Current-state briefing updates | Documentation | Repository operating boundary | Existing commit review | Mirror sync remains explicit |
| `prisma/migrations/0021_reject_finalized_purchase_deletes/migration.sql` | Dedicated `BEFORE DELETE` guards for finalized parent/item rows; item update trigger separated from delete trigger so draft cascades remain valid | Migration | D-01, ST3-C/G | Static contract 7/7; clean migrations 0001–0021; disposable parent/item/draft/cascade/rollback checks | Candidate remains unapplied outside the disposable target |
| `tests/financial-e2e-purchase-immutability-provisioning.test.mjs` | Contract assertions for migration 0021 and update-only item trigger | Test | D-01, ST3-C/G | 7/7 focused tests | Static coverage does not replace runtime evidence |
| `scripts/gst-application-e2e-runner.mjs` | Corrected campaign fixture permissions, payment idempotency fields, ledger reference expectations, and subject context required by current source | Test harness | ST3-F/G/H | Current-source Sales campaign reached GST-016 and persisted evidence | Campaign still is not browser proof |
| `scripts/financial-e2e-provision-local.mjs` | Added the dedicated finalized purchase delete function/triggers and made legacy mutation triggers update-only | Provisioning | ST3-C/G | Fresh target exposed both dedicated delete triggers; artifact manifest updated | Final fresh target had no fixture rows for a second delete-mutation readback |
| `prisma/financial-e2e-artifact-manifest.json` | Updated executable provisioning hash after the bounded trigger correction | Manifest | ST3-C/H | Provisioning manifest gate passed before schema initialization | Local artifact package remains non-production |
| `.obsidian-vault/specs/purchase-gst-application-evidence-stage3_app_cea68a68d9.json` | Current-source restricted-runtime Purchase GST evidence | Evidence | ST3-E/G/H | 16/16, target-bound, restricted role verified | Policy blockers remain |
| `.obsidian-vault/specs/sales-gst-application-evidence-stage3_app_cea68a68d9.json` | Current-source Sales/Purchase/invoice/payment evidence summary | Evidence | ST3-F/G/H | GST-014/015/016 and purchase/payment checks passed | Campaign fixture disposal is database-deferred; target disposal is the cleanup boundary |

## Pre-existing and unrelated state

The prior commit also contains broader invoice-modernization campaign
artifacts, daily notes, generated browser logs, and earlier accepted evidence.
Those are retained and are not treated as current-source proof for this
reconciliation unless explicitly source- and target-bound.

## Authorization disposition

The current reconciliation was authorized to inspect, test, and use only fresh
local disposable targets. Migration 0021 was applied only to the exact
contract-bound verification target and remains an unapplied candidate in normal
or shared environments. Production, hosted Supabase, shared databases,
persistent local targets, and credential rotation remained outside scope.

## Current verification boundary

The first application target was `stage3_app_cea68a68d9` on loopback port
`55523` with the approved disposable Compose project and restricted runtime
role. A later fresh target verified the corrected provisioning schema installed
both dedicated delete triggers and was then disposed. The Purchase GST and
Sales GST application evidence predates that final trigger-order correction and
must not be treated as proof of the final provisioning artifact. No Stage 3
target remains running.

## Controlled financial-closure baseline

The closure campaign started from branch `main`, HEAD
`c0150084302fbba47230386f378d4cadf65f47ea`, with the pre-existing dirty
worktree preserved exactly. No reset, checkout, clean, stash, staging,
commit, push, branch switch, or history rewrite was performed.

The only in-scope product correction during this closure was the payment-page
description update so it no longer claims overpayments are clamped; the
implemented behavior rejects the overpayment and records no payment. No V2
ITC, credit/debit-note, RCM, e-invoicing, GST-return, import/export,
SEZ/UIN, or multiple-registration capability was added.

Closure evidence was appended to the existing Stage 3 package:
`27-current-source-targeted-runtime-evidence.json`,
`28-current-source-targeted-cleanup-evidence.json`, and the updated
financial, review, recovery, reconciliation, and final-decision documents.
