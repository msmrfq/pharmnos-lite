---
title: Pharmnos Lite Stage 3 System Baseline
date: 2026-11-07
time: 02-25-00
status: Baseline recorded — read-only
---

# System baseline

## Repository and worktree

- Repository: `msmrfq/pharmnos-lite`
- Working directory: `E:\PharmnosLite`
- Branch/revision and dirty-state inspection were performed before dispatch.
- The worktree contains substantial pre-existing staged/unstaged changes and generated mirrors. No reset, checkout, clean, stash, restore, branch switch, staging, commit, push, or history rewrite was performed.
- Stage 3 documents are new files under this directory only.

## Stack and boundaries

- Next.js 14 App Router, TypeScript, React, pnpm.
- Prisma PostgreSQL schema with Supabase Auth and Storage adapters.
- Provider-independent domain/service/repository/adaptor structure is documented, but core writes currently occur directly in server actions.
- Multi-tenant application with tenant context, permissions, database RLS/custom SQL, private document storage, and audit logs.

## Scripts and tests

Package scripts include `pnpm typecheck`, `pnpm lint`, `pnpm build`, Prisma validation/migration commands, T13/T19/T25 GST commands, financial-E2E safe/up/down commands, and Sales GST acceptance.

The repository contains 52 test files, including GST, purchase/sales integrity, inventory valuation, payments, authorization, RLS, invoice documents, target contracts, lifecycle, provisioning, and runtime-boundary contracts.

## Database

- Prisma schema plus 20 forward migrations (`0001`–`0020`).
- Migration chain is lexically ordered and dependencies generally precede consumers.
- Custom SQL creates triggers, RLS policies, expression/partial indexes, and governance constraints not fully represented in `schema.prisma`.
- No down-migration set exists.
- No production migration, backup restore, or shared/hosted database operation is authorized by this campaign.

## Existing accepted baseline

The latest invoice-modernization final report records Stage 1/2 invoice scope accepted at 100/100, including purchase/sales browser evidence, PDFs/private storage, snapshots, numbering, tenant denial, and reconciliation. This baseline is reused only for the documented scenarios and must not be generalized to overall system readiness.

## Current runtime evidence position

The target-contract and disposable lifecycle scripts provide strong fail-closed safety boundaries. However, the current-source target-bound runtime package, browser harness reproducibility, backup/restore, deployment, and production-shaped recovery evidence remain incomplete for Stage 3. Historical evidence is retained by reference and must be source-hash/target-bound before being used as new Stage 3 proof.

## Baseline verification

No runtime or database mutation was performed during Wave 1. Specialist reports were read-only. Capability failures and recovery assignments are recorded in `09-agent-execution-log.md`.

