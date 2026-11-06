---
title: Pharmnos Lite Stage 3 Consolidated Workstream Findings
date: 2026-11-07
time: 02-25-00
status: Consolidated after Wave 1 — remediation not yet authorized
---

# Consolidated findings

## S1 — Architecture

Server actions directly orchestrate core Prisma writes for purchases, sales, masters, valuation, GST governance, and documents. Existing stock/ledger domain services are not consistently used by production actions. `StockMovementService.recordMany` opens separate transactions per movement, so atomicity is caller-dependent. Repositories are weakly typed and invoice search pagination is inconsistent. These are maintainability and financial-integrity risks; remediation must be serialized and preserve accepted action behavior.

## S2/S3 — Authentication, authorization, tenant isolation

Server requests verify Supabase user state and active membership before protected actions. Permission checks and tenant predicates are broadly present. The documented residual risk remains mutable request-claim GUCs under arbitrary SQL; the intended server-only boundary limits but does not cryptographically solve that risk. Context lookup also performs a best-effort metadata mutation, coupling read/context resolution to a remote side effect. No new exploitable bypass was demonstrated in the read-only review.

## S4 — Database integrity and migration compatibility

The highest-impact findings are:

1. Migration `0015` installs finalized purchase update/delete protection but allows finalized deletes to fall through and omits important immutable fields such as supplier/date/GST identity fields.
2. Many tenant-owned foreign keys are ID-only rather than composite tenant-scoped relations.
3. Migration-created triggers, RLS, expression/partial indexes, and governance constraints are not fully represented in Prisma schema, creating drift risk.
4. Supplier invoice uniqueness migrations lack duplicate preflight and normalization reporting.
5. No rollback/down migrations or verified backup/restore procedure exists.
6. Payment relations lack complete tenant and semantic invariants.

These are production migration blockers until corrected or explicitly risk-accepted with recovery evidence.

## S5 — GST

Supported Regular, tax-exclusive domestic GST has strong exact-decimal calculation, component persistence, purchase evidence/revision safeguards, and finalization reconciliation. CGST/SGST and IGST are implemented; cess, UTGST, inclusive pricing, and several statutory/commercial scenarios fail closed or remain deferred. Statutory rounding precedence, discrepancy tolerance, ITC classification, and professional confirmation remain outside engineering proof.

## S6 — Purchase, inventory, supplier ledger

Purchase finalization is one transaction with GST acceptance prerequisites, advisory/idempotency controls, batch receipt, `PURCHASE_IN`, supplier ledger, and payable summary. There is no separate goods-receipt lifecycle; finalization receives ordered quantity immediately. Free quantity is stored but not received, movement `unit_rate` is null, stock movement batch operations are not atomic, invalid quantities can be clamped to zero, and concurrent batch creation relies on unique-conflict failure rather than explicit retry. Supplier ledger lacks a database-level posting uniqueness invariant.

## S7 — Sales and documents

Accepted sales/document behavior remains supported for the exercised scenarios: finalization, canonical GST snapshots, numbering, FEFO, customer ledger, private PDF/document lifecycle, retry, and historical rendering. New current-source coverage gaps are non-zero `free_qty` deduction and selected batch versus actual FEFO allocation traceability. These require policy clarification before implementation and must not reopen accepted paths speculatively.

## S8 — Runtime and operations

The financial-E2E lifecycle is contract-bound and fail-closed, but connected execution and rollback/recovery remain gated by the reviewed initialization/package boundary. There is no committed authenticated browser harness. Backup/restore, PITR/offsite evidence, deployment gates, centralized observability, and production migration readiness are incomplete. Historical invoice evidence must not be promoted to current-source Stage 3 proof without immutable source/target binding.

## Cross-workstream conflicts resolved

- “Invoice modernization accepted” is retained for its frozen Stage 1/2 scope only; it is not overall Stage 3 acceptance.
- S8’s claim that a separate GST modernization report makes all current-source runtime evidence unverified is treated as an evidence-reconciliation item, not an automatic invalidation of the latest invoice report. The final Stage 3 package must bind each reused artifact to source revision and target contract.
- Synthetic GST/valuation tests prove software behavior, not statutory or professional eligibility.

