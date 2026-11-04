---
title: T13 + T19 + T25 current-release runtime verification campaign — 2026-11-04T18-12-40
date: 2026-11-04
status: BLOCKED — EXACT IMMUTABLE TARGET CONTRACT ABSENT
---

## Goal

Complete the authorized current-release runtime verification and independent
acceptance campaign for DGM-T13, DGM-T19, and DGM-T25 without selecting or
mutating an unproven database target.

## Acceptance Criteria

- [x] Authoritative scope and existing implementation evidence inspected.
- [x] Preserved Git state inspected before verification.
- [x] Non-mutating regression, type, lint, syntax, Prisma, and whitespace gates rerun.
- [x] Target-contract preflight exercised and failure recorded.
- [x] Per-ticket acceptance assessed without promoting static evidence to runtime acceptance.
- [x] Canonical tracker, acceptance record, evidence matrix, briefing, mirrors, and daily log synchronized.
- [ ] Target-bound T13/T19/T25 runtime scenarios executed against an authorized immutable disposable target.

## Out of Scope

Selecting a target by port, database name, container name, historical evidence,
or apparent availability; provisioning or connecting without the exact
immutable contract; application changes; production or Live Supabase access;
Q17 investigation or cleanup; Version 2 GST features; and statutory or
professional acceptance.

## [PHARMNOS-LITE STATUS]

**Stage:** T13 + T19 + T25 current-release runtime verification, independent
acceptance, and documentation synchronization
**Completion:** 88% (22/25 evidence-supported master-matrix criteria; 0/3
current-scope runtime/independent-acceptance criteria newly closed)

**Decision:** `NOT ACCEPTED` for complete T13/T19/T25 runtime and independent
acceptance. The engineering and regression baseline is verified; the
target-bound gate is not.

## 1. Target-contract prerequisite

The executable contract gate is implemented in
[`financial-e2e-target-contract.mjs`](../../scripts/financial-e2e-target-contract.mjs).
It requires a versioned contract containing the exact loopback endpoint,
disposable database identity, distinct bootstrap/runtime roles, credential
sources, marker, Compose project/service/profile, schema artifact hash,
authorization time, and future expiry.

The campaign process environment had
`FINANCIAL_E2E_TARGET_CONTRACT=<unset>`. The local
`.env.financial-e2e` file contained only the generic target configuration:
`127.0.0.1:55432/pharmnos_financial_e2e`, with no current immutable contract,
Compose project binding, schema fingerprint, authorization, or expiry. Repository
search found validator/tests and historical references, but no current
contract artifact that could authorize target-bound execution.

The existing preprovisioned preflight was run without connecting:

```text
pnpm exec node .\scripts\financial-e2e-preprovisioned-verify.mjs
```

Result: exit `1`,
`PREPROVISIONED=FAIL FINANCIAL_E2E_TARGET_CONTRACT is required.`

Because the contract was absent, the campaign did not inspect the retained
`55460` resource, did not connect to any database, and did not start or alter
any container, network, process, schema, fixture, or cleanup operation.

## 2. Verification commands

| Command | Exit | Result |
|---|---:|---|
| `pnpm test:gst:calculator` | 0 | 294 passed, 0 failed; `GST_CALCULATOR_RUNNER=PASS_TS_NODE_TOP_LEVEL_AWAIT` |
| `pnpm exec node --test .\tests\gst-*.test.mjs` | 0 | 37 passed, 0 failed |
| `pnpm exec node --test .\tests\financial-e2e-target-contract.test.mjs .\tests\purchase-gst-revision-safety-contract.test.mjs` | 0 | 8 passed, 0 failed |
| `pnpm exec node --test .\tests\*.test.mjs` | 0 | 232 passed, 0 failed, 0 skipped |
| `pnpm typecheck` | 0 | TypeScript validation passed |
| `pnpm lint` | 0 | No ESLint warnings or errors |
| `pnpm exec prisma validate` with isolated placeholder `DATABASE_URL` and `DIRECT_URL` | 0 | Prisma schema valid; no database connection or mutation |
| `pnpm exec node --check .\scripts\financial-e2e-target-contract.mjs; ...` | 0 | Relevant runtime scripts passed syntax checks |
| `git diff --check` | 0 | Passed |
| `pnpm exec node .\scripts\financial-e2e-preprovisioned-verify.mjs` | 1 | Expected fail-closed block: immutable target contract required |

The first unconfigured Prisma invocation failed only because `DIRECT_URL` was
unset. It was rerun successfully with non-secret local placeholder URLs; the
successful result is schema validation only and does not imply database
connectivity.

## 3. Independent acceptance matrix

| Ticket | Current-release scope | Static/test evidence | Runtime evidence | Independent acceptance |
|---|---|---|---|---|
| DGM-T13 | Exactly 15 supplied GSTIN characters; checksum, state-prefix, registration-status, and effective-date checks remain Version 2 | Implemented and focused-tested | `BLOCKED` before connection by missing target contract | `NOT ACCEPTED — INSUFFICIENT EVIDENCE` |
| DGM-T19 | Reviewed GST record version, evidence revision ID, calculation ID, guarded correction rollback, and existing authorization/reconciliation/reset/finalization safeguards | Implemented and focused contract-tested | `BLOCKED` before connection by missing target contract | `NOT ACCEPTED — INSUFFICIENT EVIDENCE` |
| DGM-T25 | Approved demonstrated exact-decimal arithmetic, explicit rounding, independent components, supplier-value preservation, totals, commercial round-off separation, and conversion boundaries | Implemented and verified by 294 calculator assertions plus regression suites | `BLOCKED` before connection by missing target contract | `NOT ACCEPTED — INSUFFICIENT EVIDENCE` |

No static or historical result was promoted to target-bound runtime
verification. No statutory or accounting interpretation was promoted to
professional acceptance.

## 4. Deferrals and professional boundaries

The following remain outside the current-release failure count:

- T13 checksum, state-prefix, registration-status, and effective-date checks.
- T19 stale-operation behavior outside the approved reviewed-revision token
  guard.
- T25 credit/debit-note workflow, e-invoice output, and other explicit Version
  2 boundaries.

Section 170 aggregation, e-invoice obligations, and related statutory or
accounting interpretations still require qualified professional confirmation.

## 5. Safety and Git preservation

- No database connection or SQL operation was performed.
- No migration, provisioning, fixture creation, application acceptance rerun,
  cleanup, container, network, or process lifecycle operation was performed.
- No production or Live Supabase resource was accessed.
- Baseline Git status before documentation edits: 0 status lines,
  SHA-256 `e3b0c44298fc1c149af4c8996fb92427ae41e4649b934ca495991b7852b855`.
- No checkout, reset, clean, stash, stage, unstage, commit, push, branch
  change, or history rewrite was performed.

## 6. Documentation synchronization

Updated or created:

- [`gst-implementation-tracker-2026-10-31.md`](./gst-implementation-tracker-2026-10-31.md)
- [`gst-calculation-treatment-acceptance-2026-11-01.md`](./gst-calculation-treatment-acceptance-2026-11-01.md)
- [`t13-t19-t25-runtime-verification-evidence-2026-11-04T18-12-40.json`](./t13-t19-t25-runtime-verification-evidence-2026-11-04T18-12-40.json)
- Canonical [`CLAUDE.md`](../CLAUDE.md) and its established generated mirrors
- Daily log [`2026-11-04T18-12-40.md`](../daily/2026-11-04T18-12-40.md)

## Remaining

Supply a valid, exact immutable disposable-target contract with verified
identity, ownership/isolation, permitted scope, schema fingerprint,
authorization, and future expiry. Then rerun only the approved target-bound
T13/T19/T25 scenarios. Do not select the retained `55460` target or any other
resource by port or similarity.
