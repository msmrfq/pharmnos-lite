---
title: Pharmnos Lite Stage 3 Agent Execution Plan
date: 2026-11-07
time: 01-45-00
status: Approved — Wave 1 and consolidation complete; remediation gate active
---

# Ordered dispatch schedule

## Gate 0 — capability and baseline complete

Completed by lead, read-only:

- Confirmed direct terminal, repository search/view/edit, parallel tools, background agents, browser-capable tooling, and structured task results are available.
- Confirmed no Fleet-mode scheduler or repository custom agent profile was observed.
- Confirmed shared worktree and dirty pre-existing state; no reset/checkout/clean/stash/restore performed.
- Confirmed canonical instructions and existing Stage 1/2 invoice evidence.

No broad specialist was dispatched in this planning phase.

## Gate 1 — owner approval received

The owner approved:

- `.obsidian-vault/specs/stage-3-system-readiness/00-campaign-blueprint.md`
- `.obsidian-vault/specs/stage-3-system-readiness/01-agent-execution-plan.md`
- Eight-agent initial read-only wave.
- Later serialized remediation and two independent reviewer gates.

The approval was received on 2026-11-07 and Wave 1 proceeded. No source or infrastructure mutation occurred during the read-only wave.

## Wave 1 — parallel read-only investigation

| Order | Agent | Task | Deliverable | Verification |
|---:|---|---|---|---|
| 1 | S1 | Inspect architecture and service/repository/adaptor boundaries | Structured architecture report with file/line evidence | Lead checks scope and no unsupported runtime claims |
| 2 | S2 | Inspect auth/session lifecycle and protected action behavior | Auth/session report with concrete flows and gaps | Lead checks token/cookie claims against source/tests |
| 3 | S3 | Inspect authorization, RLS, tenant and storage/document isolation | Isolation report with policy/test coverage | Lead checks tenant claims against contracts/runtime evidence |
| 4 | S4 | Inspect schema integrity, migration sequence, compatibility and recovery prerequisites | Migration/integrity report | Lead checks all 20 migrations and no shared execution |
| 5 | S5 | Inspect GST and tax treatment across purchase/sales/non-GST boundaries | GST report separating engineering from professional confirmation | Lead checks calculations against focused tests and decisions |
| 6 | S6 | Inspect purchase, inventory, valuation and supplier ledger lifecycle | Purchase/inventory/ledger report with reconciliation gaps | Lead checks atomicity/idempotency/reversal evidence |
| 7 | S7 | Inspect sales/customer/document lifecycle against accepted invoice baseline | Sales/document regression report | Lead rejects reopening accepted behavior without source/evidence delta |
| 8 | S8 | Inspect automated tests, runtime harnesses, configuration, observability and operations | Verification/operations gap report | Lead checks commands are repository-supported and target-bound |

Each task must be bounded to one report and must not edit source, schema, migrations, tests, or formal documents.

## Gate 2 — consolidation and frozen matrix

Lead actions:

1. Merge reports into `04-workstream-findings.md`.
2. Classify and deduplicate defects in `06-defect-register.md`.
3. Create `05-acceptance-matrix.md` with frozen 100-point denominator.
4. Create bounded remediation list only for demonstrated current-release defects.
5. Record deferred/policy/professional/Stage 4 dependencies separately.

No remediation starts until the matrix and defect register are internally consistent.

## Wave 2 — serialized remediation

Assign one implementation owner at a time, selected from findings:

- M1: security/tenant fix owner, only if S2/S3 identifies a reproducible current-release defect.
- M2: database/migration fix owner, only if S4 identifies a safe local/source correction.
- M3: financial workflow fix owner, only if S5/S6 identifies a reproducible purchase/inventory/ledger defect.
- M4: sales/document fix owner, only if S7 identifies a regression not covered by accepted evidence.
- M5: test/runtime/configuration fix owner, only if S8 identifies a concrete evidence or harness defect.

Each owner receives explicit files, acceptance tests, and a stop condition. No owner may implement deferred V2 functionality or statutory policy.

## Gate 3 — verification

Run only checks justified by changed files and frozen criteria, escalating as needed:

- `pnpm typecheck`
- `pnpm lint`
- focused changed-domain tests
- GST/purchase/sales/inventory/authorization/tenant contracts
- Prisma schema/migration validation
- production build where application code changes
- `git diff --check`
- one target-bound disposable runtime only if a frozen criterion requires fresh runtime evidence

Record exact commands/results in `02-system-baseline.md` updates or the relevant evidence document. Runtime target, credentials, and cleanup must use the existing immutable target contract.

## Gate 4 — runtime and reconciliation

If required by the frozen matrix, use one disposable local target and verify supported workflows only: purchase, goods receipt, stock movement, GST review/posting, sales, batch deduction, ledgers, supported non-GST paths, corrections/retries, authorization denial, cross-tenant denial, and document access. Reconcile source documents, GST, inventory, stock movements, ledgers, and totals using exact decimals. Do not rerun accepted invoice scenarios without a source change or evidence gap.

Clean up only exact campaign-created resources after evidence capture and before review.

## Wave 3 — independent reviews

Run R1 and R2 outside the implementation workforce after the final evidence package is assembled. They receive the frozen matrix, defect register, implementation diff, tests, runtime evidence, and cleanup proof.

- R1 decides technical/security: ACCEPT, ACCEPT WITH EXPLICIT NON-BLOCKING LIMITATIONS, or REJECT.
- R2 decides business/financial: ACCEPT, ACCEPT WITH EXPLICIT NON-BLOCKING LIMITATIONS, or REJECT.
- Any rejected mandatory criterion blocks GO until corrected and reviewed again.

## Gate 5 — final readiness decision

Lead writes `15-final-readiness-decision.md` only after both reviewers return decisions. GO means eligible for separately authorized Stage 4 planning only. NO-GO records exact blockers and required evidence; it never reduces weights or removes scope.

## Failure/reassignment protocol

- Agent unavailable: record status as failed and run the same contract sequentially.
- Agent returns unsupported claim: mark unresolved and request source/evidence correction, not a second broad review.
- Conflicting findings: lead resolves with source/tests; reviewers receive the consolidated disagreement.
- Shared-file conflict: stop parallel writes and serialize ownership.
- Runtime target mismatch or missing authorization: fail closed before mutation; do not select a target by convenience.

## Execution log requirements

For each agent, record ID, task, start/end status, observed capability/model if available, findings, evidence locations, failures, and reassignment. The first execution log entry must state that this plan was awaiting approval and no broad workforce had started.
