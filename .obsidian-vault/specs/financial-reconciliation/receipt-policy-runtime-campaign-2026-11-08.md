---
title: Receipt Provisioning and Reconciliation Policy Runtime Campaign
date: 2026-11-08
status: Partially Verified - Not Accepted
---

## Goal

Record the owner-approved 13 scenario resolutions, safely fix restricted-role receipt provisioning, and verify S-01, S-04 and S-28 on a fresh migration-replayed disposable target.

## Acceptance Criteria

- [x] Record approved policy without treating approval as implementation.
- [x] Verify customer/supplier payment actions and tenant-scoped receipt sequencing on a restricted runtime role.
- [x] Retest four synchronized serializable callers and record retry exhaustion and rollback assertions.
- [ ] Prove generated-baseline initialization equivalent by runtime evidence and complete remaining financial scenarios.

## Out of Scope

Production, hosted Supabase, deployment, recovery/PITR, GST changes, and implementation of commercial credit-note, debit-adjustment, or other missing workflows.

## Policy closure

The [decision log](./financial-reconciliation-decision-log.md), [policy matrix](./financial-reconciliation-policy-matrix.md), [accounting invariants](./financial-reconciliation-accounting-invariants.md), [engineering plan](./financial-reconciliation-engineering-plan.md), and [scenario matrix](./financial-reconciliation-scenario-matrix.md) now reflect owner approval on 2026-11-08. The 13 resolved rows are S-07/08/09/10, S-18, S-22/23/24, and S-31/32/33/37/38. S-10 explicitly uses one ₹700 payment; S-09 requires both invoice allocations to commit together. S-37 distinguishes invoice face ₹2,000 from ₹900 outstanding after the ₹1,100 allocation. S-38 has an explicitly stated invoice face ₹2,750, ₹750 already allocated, and ₹2,000 outstanding before the approved ₹100 reduction to ₹1,900; the face value is a fixture derived from those stated facts, not an additional adjustment.

S-18 is a **commercial customer credit-note** policy, not a GST credit note or tax process. It remains blocked on the missing review/approval workflow. S-38 likewise remains blocked on the commercial adjustment workflow. These and the other policy-settled cases are not runtime passes solely because their expectations were corrected.

## Receipt security model and limits

The original `42501` arose because migration 0025 creates `payment_receipt_sequences` but the restricted-role initializer omitted it. [Connected provisioning](../../../scripts/financial-e2e-provision-local.mjs) now includes the table in the existing signed-tenant policy generation, enabling and forcing RLS for its SELECT, INSERT and UPDATE policies. It excludes the table from the generic table-wide UPDATE grant, revokes public and runtime privileges, then grants restricted SELECT and INSERT plus column-level UPDATE of `next_value` only. No DELETE or tenant-id UPDATE is granted. The existing [allocator](../../../src/repositories/payment.repository.ts) retains its atomic tenant/prefix UPSERT; its sequence update participates in the surrounding transaction.

Migration 0025 defines a tenant foreign key with cascading updates/deletes, a positive `next_value` check, and default 1. The former generated artifact omitted all three: its Prisma source lacked the relation and default, and Prisma's generated SQL cannot express the migration's check constraint. The [Prisma model](../../../prisma/schema.prisma) now declares the relation and default. The [offline generator](../../../scripts/generate-financial-e2e-schema.mjs) runs `prisma migrate diff --from-empty`, incorporates the exact check from migration 0025, and appends the unchanged [governance input](../../../prisma/financial-e2e-schema-governance-controls.sql). Its `--check` mode fails if regeneration differs. The regenerated artifact differs from its pre-campaign baseline only in the receipt default, check and foreign key. Its composite primary key and allocator remain unchanged.

Both `PRISMA_MIGRATIONS_REPLAYED` and generated-baseline initialization call the same tenant control SQL. Generated-baseline initialization was **not run** in the earlier campaign because separate authorization was required. The owner subsequently authorized it, but the explicit-mode contract was rejected in preflight; see the current verification update below. Static SQL and deterministic generation establish receipt constraint intent, not PostgreSQL runtime behavior or full schema equivalence. No production migration or hosted provisioning was performed.

## Generated-Baseline Runtime Verification — 2026-11-08

The owner explicitly authorized one fresh disposable local `EMPTY_BASELINE` target. The pre-connection contract probe [emptyad48ef872215-preflight.json](./emptyad48ef872215-preflight.json) was rejected with `Migration-replay contracts require the explicit mode and migration inventory fingerprint.` The [contract validator](../../../scripts/financial-e2e-target-contract.mjs) accepts only `PRISMA_MIGRATIONS_REPLAYED` when an explicit mode is present, even though [connected initialization](../../../scripts/financial-e2e-provision-local.mjs) has an `EMPTY_BASELINE` branch. The lifecycle also binds and checks the explicit mode and migration inventory. Omitting the mode would evade that binding and violate the authorized test; it was not attempted. The requested stop-on-guard-rejection rule was followed: no target was created, no database connection or initialization was attempted, and no cleanup was needed.

**BLOCKED — NOT RUNTIME VERIFIED.** A safe follow-up requires a reviewed contract change that explicitly binds `EMPTY_BASELINE` and its inventory fingerprint, regression tests proving mismatched/omitted modes and unrelated targets still fail closed, then a fresh authorized target and guarded initialization. This campaign did not weaken or modify that guard. No generated-baseline catalog, receipt RLS, runtime, rollback or idempotency assertion was executed; earlier migration-replay evidence remains separate and cannot substitute for them.

Offline checks after authorization: JavaScript modules **361/361**, focused receipt/target/signed-context/artifact/reconciliation contracts **63/63**, generator `--check`, Prisma validation with nonconnecting placeholders, static provisioning guard, nonincremental typecheck and uncached lint all exited 0. A timestamp helper failed because Python's timezone database is absent; the timestamp was obtained through Windows time-zone APIs instead. The matrix at that time reported **18 PASS / 0 FAIL / 20 BLOCKED**; the [current-source matrix](#scenario-outcomes) is reconciled separately below. Genuine Supabase Auth and independent acceptance remain unverified.

Preservation audit: HEAD remains `fcea2f25975a64b0d0f986b93f58a352abaefc17` and the staged binary diff matches the pre-campaign capture. Of 1,417 captured tracked and non-ignored untracked files, 1,415 were byte-identical; only this report and the [canonical briefing](../../CLAUDE.md) were intentionally modified, and none were missing. The preflight JSON is the only new non-ignored file. No pre-existing user changes were discarded. The pre-existing unrelated container `3bec7b94eb31` remained running; no campaign target existed to clean up. No hosted or production database was accessed. Final `git diff --check` exited 0, with pre-existing line-ending warnings.

Using the six requested success criteria as equal units, **3/6 (50%)** are met: evidence distinguishes the unexecuted generated-baseline path from migration replay, worktree/user-data preservation was checked, and no unsupported project or production acceptance is claimed. Initialization and receipt runtime verification remain blocked, and the scenario/evidence closure criterion is not treated as complete without the requested runtime evidence and full current-campaign reconciliation. The earlier scenario matrix is retained as historical evidence, not relabeled as current generated-baseline verification.

The manifest hash for connected provisioning was refreshed. The [focused contract tests](../../../tests/financial-reconciliation-receipt-provisioning.test.mjs) cover allowlist, policy machinery, least-privilege grant shape, allocator and approved policy rows. The [runtime harness](../../../scripts/financial-reconciliation-runtime-harness.cjs) provides the targeted receipt selection and records persisted results.

Serializable contention also exposed a separate bounded-retry defect: the [financial reconciliation service](../../../src/domain/services/financial-reconciliation.service.ts) allowed only three attempts for four synchronized callers. The service now allows five attempts, still retrying only the existing recognized serialization errors and rethrowing other errors immediately. This is a bounded contention improvement, not a guarantee of success under arbitrary load.

## EMPTY_BASELINE contract support and runtime — 2026-11-08

The owner authorized an explicit two-mode contract correction and one fresh local disposable `EMPTY_BASELINE` verification. Contracts now require a mode: an empty baseline binds the generated schema and governance hashes and rejects migration inventory; replay requires the current migration inventory and rejects baseline-only fields. Loading checks the authorization binding, fingerprint, current mode-specific hashes and target identity. Binding now also covers authorization timestamps, artifact path and Compose profile; unsuffixed shared database and project identities are rejected. This tighter binding invalidates previously issued bindings; old evidence remains historical.

The former initializer executed the refund lifecycle migration file after the baseline. The canonical generator now extracts the existing migration's four relevant checks, index, function and trigger into the generated schema; Prisma supplies the modeled enums, columns and tenant foreign keys. The initializer no longer reads or executes that migration file. The governance input is unchanged. This preserves existing safeguards rather than removing them; the generated artifact contains DDL derived from migration 0027.

The exact run was [empty15ad0a1254b5](./empty15ad0a1254b5-campaign.json), loopback `127.0.0.1:64850`, database `pharmnos_financial_e2e_empty15ad0a1254b5`. [Infrastructure](./empty15ad0a1254b5-infrastructure.json) established the exact isolated Compose target; an empty public schema was checked before [initialization](./empty15ad0a1254b5-initialization.json). Initialization exited 0 in `EMPTY_BASELINE`; no migration command or migration file was executed, and the post-initialization catalog had no Prisma migration-history table. The catalog recorded the receipt primary key, positive check, default `1`, tenant FK with cascading update/delete, forced RLS and three signed-tenant policies. Restricted runtime privileges excluded DELETE and tenant-ID UPDATE and included `next_value` UPDATE.

The [restricted-role suite](./empty15ad0a1254b5-restricted-role.json) passed. The [receipt suite](./empty15ad0a1254b5-suite.json) passed S-01, S-04 and S-28: customer and supplier actions persisted payments and ledger rows, retries left sequence values unchanged, cross-tenant insertion produced `42501`, rollback preserved the sequence and balance, and four serializable callers succeeded after observed `40001` retries. These use guarded synthetic signed tenant context and a stubbed metadata update, **not genuine Supabase Auth**. Catalog definitions were verified, but a separate invalid-value `23514` assertion and an actual default-value insert were not captured in this run.

[Cleanup](./empty15ad0a1254b5-cleanup.json) verified the exact target absent. After cleanup, review found fixture-cleanup evidence bound the contract without its authorization times. The binding was strengthened and regression-tested; unsuffixed shared identities were also rejected. **Consequently the run predates the final `financial-e2e-target-contract.mjs` hash and is not final-source contract runtime proof.** All other recorded source hashes match. The owner authorized one target, already disposed; no second target was created. Current-source migration-replay initialization was not rerun and the prior replay predates these contract and artifact changes.

Final offline verification: JavaScript modules **367/367**, typecheck, lint, Prisma validation with nonconnecting placeholders, generator check, provisioning static guard, artifact manifest verification and isolated same-drive Next production build passed. The first artifact-check invocation omitted its required repository-root argument; retry passed. The first isolated build used a cross-drive dependency junction and failed webpack path resolution; the next same-drive build omitted the required scripts directory and failed typechecking. Including that existing directory made the build pass. Both isolated build directories were removed without deleting their shared dependency target. An intermediate full suite also reported two test-message mismatches after binding hardening; the assertions were corrected to match the actual rejection boundaries and the final full suite passed.

The requested eight equal-weight completion criteria are **6/8**: explicit contracts, mode-specific boundary checks, negative tests, evidence/matrix reconciliation, offline checks and worktree preservation. Current-source migration-replay runtime verification and final-source generated-baseline runtime proof remain open. No independent acceptance or production-readiness conclusion follows.

Preservation: HEAD remains `fcea2f25975a64b0d0f986b93f58a352abaefc17`, and the staged binary diff matches the pre-edit capture outside the repository. Of 1,418 captured tracked and non-ignored untracked files, 1,404 are byte-identical, 14 were intentionally modified, and none are missing. Those 14 comprise the canonical briefing, this report, artifact manifest, generated SQL, four contract/provisioning/generator scripts and six directly related tests. The six `empty15ad0a1254b5-*.json` evidence files are new; prior evidence was not overwritten. The pre-existing unrelated container `3bec7b94eb31` remained running. No hosted or production database was accessed, no user changes were discarded, and `git diff --check` passed.

## Final Contract Verification Across Both Provisioning Modes — 2026-11-09

The owner authorized exactly one fresh local target for each mode. Final-source [generated-baseline evidence](./empty16673f97e5e9-campaign.json) covers `empty16673f97e5e9` at `127.0.0.1:51261`: guarded empty-target initialization, no Prisma migration-history table, receipt FK, positive check, default, unique primary key, forced RLS, policies and narrow privileges. An actual default insert returned `1`; insertion of zero produced SQLSTATE `23514` and the fixture transaction rolled back. [Restricted-role checks](./empty16673f97e5e9-restricted-role.json) and [S-01/S-04/S-28](./empty16673f97e5e9-suite.json) passed. [Cleanup](./empty16673f97e5e9-cleanup.json) verified the target absent.

Final-source [migration-replay evidence](./replaycab6b49cae03-campaign.json) covers `replaycab6b49cae03` at `127.0.0.1:57950`. Its separate contract bound the current migration inventory; all 27 migration names and checksums were verified against finished migration history before guarded initialization. [Restricted-role checks](./replaycab6b49cae03-restricted-role.json) and [S-01/S-04/S-28](./replaycab6b49cae03-suite.json) passed. Both receipt runs recorded four serializable callers, actual `40001` retries, bounded retry exhaustion, cross-tenant `42501`, rollback and idempotent payment actions. [Cleanup](./replaycab6b49cae03-cleanup.json) verified this target absent independently.

**Remaining: supplier payable-cache regression evidence.** After the selected replay receipt suite passed, the existing full harness was started for the supplier allocation, reversal and refund-completion regressions. Its child process exceeded the 240-second timeout and wrote no supplier results; the driver exited 1 with `ETIMEDOUT`, then disposed the exact target. The last confirmed boundary is the preceding passing replay receipt and restricted-role suite. The cause of the timeout is not established by the available output; do not describe the supplier assertions as either passed or failed. A third target was not authorized or created.

All recorded current-source hashes match the final worktree. Authentication was synthetic signed tenant context, with metadata updates stubbed where stated in the suite evidence, not genuine Supabase Auth. Historical suite `replay5d1b46962e3d` and S-16 run `replay90e2ad24bdf3` recorded different Prisma schema, reconciliation service and harness hashes; their earlier passes remain historical, not current-source passes. The current-source matrix therefore counts **3 PASS / 0 FAIL / 35 BLOCKED**; the preceding historical matrix was 18/0/20. Owner-approved accounting policies, including S-18 as a commercial credit note, are unchanged.

Preflight: 68/68 focused contract, lifecycle, artifact, security and receipt tests passed; generator check, provisioning static guard and artifact verification passed. Final offline checks: 367/367 JavaScript module tests, nonincremental typecheck, uncached lint, placeholder Prisma validation and isolated same-drive Next build passed. No dependency installation was performed. No independent acceptance or production-readiness conclusion follows.

Preservation audit: HEAD and staged binary diff are unchanged from the external 1,424-file baseline; no baseline file was missing. Only the canonical briefing, scenario specification and this report were intentionally edited; twelve run-specific evidence files were added. Both exact Compose projects were absent after cleanup, and the unrelated container `3bec7b94eb31` remained running. No user changes were discarded, and no hosted or production database was accessed. `git diff --check` passed.

## Disposable runtime evidence

Run `replay62a33aab7100` used `127.0.0.1:64574`, database `pharmnos_financial_e2e_replay62a33aab7100`, Compose project `pharmnoslite-financial-e2e-replay62a33aab7100`, service `financial-e2e-postgres`, bootstrap `pharmnos_e2e`, and runtime `pharmnos_e2e_runtime`. Its fresh contract bound schema artifact `b2173962d25936214ab90f6bbf600093b39248442c75eed243d31b37da3e4662` and migration inventory; exact authorized infrastructure was checked before connection. [Campaign evidence](./replay62a33aab7100-campaign.json) records the empty database, all 27 migration names and checksums, outcomes and source hashes. [Initialization](./replay62a33aab7100-initialization.json) and [restricted-role evidence](./replay62a33aab7100-restricted-role.json) record LOGIN, NOSUPERUSER, NOBYPASSRLS and tenant tests.

In the [scenario evidence](./replay62a33aab7100-suite.json):

- **S-01:** the guarded synthetic-session customer action persisted one ₹500 payment, `PAY-00001`, one ₹500 credit ledger row and -₹500 cached net; no invoice, allocation, refund or reversal was created. Retrying returned the same payment and left sequence `next_value=2`.
- **S-04:** the supplier action persisted one ₹1,000 payment, `PAY-00002`, one ₹1,000 debit ledger row and -₹1,000 cached net; no invoice, allocation, refund or reversal was created. Retrying returned the same payment and left sequence `next_value=3`.
- **S-28:** four open, signed-context default-isolation transactions reached the barrier before allocating. Their results were `PAY-00001` through `PAY-00004`, with persisted `next_value=5`; no payments or ledger rows were created. Four additional serializable transactions on distinct PostgreSQL backends synchronized on their first attempt and contended on the same tenant and `SERIAL` prefix. Per-attempt isolation, backend, transaction ID, caller, receipt, Prisma error and SQLSTATE are recorded. Six actual `P2010` / `40001` allocation errors were retried, yielding `SERIAL-00001` through `SERIAL-00004`, `next_value=5`, and attempt counts 2, 4, 3 and 1. Catalog readback showed enabled/forced RLS, no DELETE or tenant-id UPDATE, and allowed `next_value` UPDATE. Tenant A could neither see nor update tenant B's row; cross-tenant insertion failed with RLS `42501` and B's row remained unchanged. A controlled transaction updated one customer and allocated a sequence, then rolled back both changes. A separate controlled retryable error exhausted all five attempts and left neither the customer update nor sequence insert behind; a non-retryable error executed once and was returned.

The [pre-fix serializable probe](./replayd9b6d861fc97-suite.json) recorded four first-attempt arrivals, three committed receipts, and one `P2010` / PostgreSQL `40001` after its three-attempt budget was exhausted. Its persisted `next_value=4` matched the three successful allocations. The current run demonstrates recovery for this four-caller case and explicitly verifies rollback on exhausted retries; bounded retries may still be exhausted at higher contention.

These are real PostgreSQL and application-action paths using a guarded synthetic session and stubbed Supabase metadata updates, **not genuine Supabase Auth**. The optional supplier payable-cache regression was not rerun: the available existing fixture is embedded in the full matrix runner, which would repeat prior scenarios. Its prior separate evidence is retained in [replay5d1b46962e3d-suite.json](./replay5d1b46962e3d-suite.json).

[Cleanup evidence](./replay62a33aab7100-cleanup.json) and [pre-fix probe cleanup](./replayd9b6d861fc97-cleanup.json) record verified absence. The unrelated `scenario20261108l` container was not modified.

## Scenario outcomes

`B` = [historical baseline](./replay5d1b46962e3d-suite.json), `R` = [historical S-16](./replay90e2ad24bdf3-suite.json), `C` = [historical migration replay](./replay62a33aab7100-suite.json), `G` = [generated baseline before final contract hardening](./empty15ad0a1254b5-suite.json), `E` = [final-source generated baseline](./empty16673f97e5e9-suite.json), and `M` = [final-source migration replay](./replaycab6b49cae03-suite.json). Historical B/R passes with changed schema, service and harness hashes remain visible as historical evidence but are blocked for current-source acceptance. All runtime tests use guarded synthetic authentication, not genuine Supabase Auth.

In the table: **Yes** means scenario policy is settled, not that it was implemented; **Partial** means relevant primitives exist but the complete fixture or workflow is not established; **Service** means restricted-role service integration with synthetic persisted fixtures, not a browser or genuine Auth; **No** means the exact application integration is not verified; **Historical** and **Current** identify runtime evidence dates/boundaries above. Limitations apply even to PASS cases.

| ID | Status | Policy | Implementation | Application integration | Runtime / evidence | Classification and limitation |
|---|---|---|---|---|---|---|
| S-01 | PASS | Yes | Exists | Action, synthetic auth | Current E, M | Customer advance; genuine Auth unverified |
| S-02 | BLOCKED | Yes | Exists | Service | Historical B pass | Allocation; current-source rerun absent |
| S-03 | BLOCKED | Yes | Exists | Service | Historical B pass | Partial allocation; current-source rerun absent |
| S-04 | PASS | Yes | Exists | Action, synthetic auth | Current E, M | Supplier advance; genuine Auth unverified |
| S-05 | BLOCKED | Yes | Exists | Service | Historical B pass | Supplier allocation; current-source rerun absent |
| S-06 | BLOCKED | Yes | Exists | Service | Historical B pass | Remaining advance; current-source rerun absent |
| S-07 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact fixture/runtime missing |
| S-08 | BLOCKED | Yes | Partial | No | Historical B: blocked | Corrected initial-credit fixture unverified |
| S-09 | BLOCKED | Yes | Partial | No | Historical B: blocked | Atomic multi-invoice workflow missing |
| S-10 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact one-payment fixture unverified |
| S-11 | BLOCKED | Yes | Exists | Service | Historical B pass | Unapplied refund; current-source rerun absent |
| S-12 | BLOCKED | Yes | Exists | Service | Historical B pass | Allocated refund; current-source rerun absent |
| S-13 | BLOCKED | Yes | Exists | Service | Historical B pass | Full refund; current-source rerun absent |
| S-14 | BLOCKED | Yes | Exists | Service | Historical B pass | Allocation reversal; current-source rerun absent |
| S-15 | BLOCKED | Yes | Exists | Service | Historical B pass | Payment reversal; current-source rerun absent |
| S-16 | BLOCKED | Yes | Exists | Service | Historical R pass | Controlled rollback; current-source rerun absent |
| S-17 | BLOCKED | Yes | Exists | Service | Historical B pass | Refund case; current-source rerun absent |
| S-18 | BLOCKED | Yes | Missing | No | Historical B: blocked | Commercial credit approval absent; not GST |
| S-19 | BLOCKED | Yes | Missing | No | Historical B: blocked | Linked adjustment integration missing |
| S-20 | BLOCKED | Yes | Partial | No | Historical B: blocked | Strict temporal reporting missing |
| S-21 | BLOCKED | Yes | Missing | No | Historical B: blocked | Audited terms workflow missing |
| S-22 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact race/reversal fixture unverified |
| S-23 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact race/reversal fixture unverified |
| S-24 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact race/reversal fixture unverified |
| S-25 | BLOCKED | Yes | Missing | No | Historical B: blocked | Formal cutover missing |
| S-26 | BLOCKED | Yes | Missing | No | Historical B: blocked | Audited reclassification/history missing |
| S-27 | BLOCKED | Conflict | Cheque supported | No | Historical B: blocked | Rejection fixture conflicts with supported method |
| S-28 | PASS | Yes | Exists | Restricted service/repository | Current E, M | Serializable contention and rollback; bounded retries |
| S-29 | BLOCKED | Yes | Exists | Service | Historical B pass | Cross-tenant rejection; current-source rerun absent |
| S-30 | BLOCKED | Not settled | Missing | No | Historical B: blocked | Explicit currency rejection missing |
| S-31 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact supplier fixture unverified |
| S-32 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact supplier fixture unverified |
| S-33 | BLOCKED | Yes | Partial | No | Historical B: blocked | Exact supplier fixture unverified |
| S-34 | BLOCKED | Yes | Exists | Service | Historical B pass | Supplier allocation; current-source rerun absent |
| S-35 | BLOCKED | Yes | Exists | Service | Historical B pass | Supplier allocation; current-source rerun absent |
| S-36 | BLOCKED | Yes | Exists | Service | Historical B pass | Supplier refund; current-source rerun absent |
| S-37 | BLOCKED | Yes | Partial | No | Historical B: blocked | Atomic correction/repost unverified |
| S-38 | BLOCKED | Yes | Missing | No | Historical B: blocked | Approved commercial adjustment workflow missing |

Equal-weight current-source completion: **3/38 PASS (7.89%)**, **0 FAIL**, **35 BLOCKED**. Fifteen additional cases have historical passes on changed sources, not current-source evidence.

## Offline checks and preservation

Current campaign, all exit 0: JavaScript modules 361/361; focused financial/provisioning/artifact/signed-context tests 44/44; generation parity/receipt/artifact/static tests 22/22; generator `--check`; static guard; nonincremental typecheck; no-cache lint; placeholder Prisma validation; isolated production build. The build used the existing generated Prisma client; `prisma generate` was not rerun so as not to modify shared dependencies. The isolated directory was removed without touching shared dependencies. A report-inspection command initially failed due to the Windows console's currency encoding; this did not execute a test or mutate application data.

The current campaign began at HEAD `fcea2f25975a64b0d0f986b93f58a352abaefc17`, with 295 porcelain records. The session baseline contains byte copies and hashes of 1,409 tracked/non-ignored untracked files, plus staged and unstaged patches and status. Ignored files were excluded. HEAD and staged diff remained byte-identical; 1,401 baseline files remained unchanged, eight were intentionally modified, and none were missing. The existing unrelated Compose container retained the same ID; the new disposable target was removed. Briefing mirrors were not synchronized because they contain pre-existing changes.

The eight modified baseline files are [canonical briefing](../../CLAUDE.md), [provisioning runbook](../financial-e2e-provisioning-artifacts-2026-10-25.md), this report, [Prisma schema](../../../prisma/schema.prisma), [generated SQL](../../../prisma/financial-e2e-schema-provisioning.generated.sql), [artifact manifest](../../../prisma/financial-e2e-artifact-manifest.json), [runtime harness](../../../scripts/financial-reconciliation-runtime-harness.cjs), and [focused receipt tests](../../../tests/financial-reconciliation-receipt-provisioning.test.mjs). Eight files were newly added: the generator, its unchanged governance input, and six run-specific campaign/initialization/infrastructure/restricted-role/suite/cleanup evidence files. No user changes were discarded.

The generated SQL SHA-256 is `b2173962d25936214ab90f6bbf600093b39248442c75eed243d31b37da3e4662`; Prisma schema SHA-256 is `b5df6127efb3b8ba1c35e73534511f1da65fc25900642fea94073ca8f0eb4f30`. The manifest records hashes for the generator, governance input and migration source. The campaign evidence records and binds the seven exercised source hashes; each was checked against current files.

**Verdict: PARTIALLY VERIFIED — NOT ACCEPTED.** The targeted migration-replay checks passed, but generated-baseline runtime equivalence and broader reconciliation acceptance remain open. No production-readiness or genuine-Auth claim is made.
