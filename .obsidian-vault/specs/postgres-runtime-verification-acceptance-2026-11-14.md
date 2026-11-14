# Pharmnos Lite — PostgreSQL Runtime Verification & Engineering Closure

**Date:** 2026-11-14
**Scope:** Disposable runtime verification of tenant isolation, database protections, inventory, financial, and temporal contracts; in-scope defect repair; environment retirement.
**Baseline commit:** `659aa53` (unchanged — no commits, pushes, merges, rebases, cleans, or stashes)
**Predecessor:** `independent-remediation-review-2026-11-13.md` (§F completion weights, §G status format)

---

## 1. Executive Summary

All twelve mission phases were executed against a uniquely identified, loopback-only, disposable PostgreSQL 17 instance. Runtime proof now exists for every criterion that can be proven at the database layer.

| Dimension | Weight | Source | Static/Offline | PostgreSQL runtime | Independent |
|---|---:|---:|---:|---:|---:|
| Tenant isolation architecture & deployment contract | 20 | ✅ | ✅ | ✅ | ❌ |
| Tenant isolation implementation & static verification | 20 | ✅ | ✅ | ✅ | ❌ |
| Finalized sales immutability | 10 | ✅ | ✅ | ✅ | ❌ |
| Product batch schema/payload consistency | 8 | ✅ | ✅ | ✅ | ❌ |
| Draft invoice uniqueness | 7 | ✅ | ✅ | ✅ | ❌ |
| Inventory & stock-integrity corrections | 15 | ✅ | ✅ | ✅ | ❌ |
| Valuation workflow deferral documentation | 5 | ✅ | ✅ | n/a | ❌ |
| Regression & full offline verification | 10 | ✅ | ✅ | n/a | ❌ |
| Documentation & engineering record accuracy | 5 | ✅ | ✅ | n/a | ❌ |
| **Totals** | **100** | **100%** | **100%** | **85%** | **0%** |

- The 15 runtime-uncovered points are the three inherently offline criteria (documentation, valuation-deferral documentation, offline regression suite). They are verified at source/static level.
- **Independent acceptance: NOT ACHIEVED.** This campaign is self-verification by the implementing agent. No second party has reviewed the evidence.

**One genuine product defect was found and repaired (D-01), and 24 financial scenarios remain explicitly BLOCKED (not credited as passes).**

---

## 2. Environment Identity (no secrets recorded)

| Property | Value |
|---|---|
| Container | `pharmnos_runtime_verify_rv20261114055301` |
| Image | `postgres:17-alpine` |
| Engine | PostgreSQL 17.11 |
| Database | `pharmnos_runtime_verify_rv20261114055301` |
| Binding | `127.0.0.1:57565` (loopback only) |
| Data directory | tmpfs-backed (non-persistent by construction) |
| Labels | `com.pharmnos.environment=runtime-verification`, `com.pharmnos.run-id=rv20261114055301` |
| Bootstrap role | owner/login role, superuser-capable, schema owner |
| Runtime role | `pharmnos_e2e_runtime` — `NOSUPERUSER NOBYPASSRLS`; `SELECT, INSERT, UPDATE` only (no `DELETE`, no `EXECUTE` on `pharmnos_private.verify_auth_context`) |
| Signing secret | generated per-run, supplied only through process environment, never written to a file |
| Isolation | no shared, production, or Supabase target contacted; no host `psql`; all SQL via `docker exec` |

Both credentials and the HMAC secret were retired at cleanup; no value appears in this report, the evidence files, or any tracked file.

---

## 3. Phase Gates

| Phase | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Baseline integrity & code read | PASS | `git` clean at `659aa53`; 31 migrations enumerated |
| 2 | Disposable environment provisioned & isolated | PASS | `ENV-02`, port/loopback/label assertions |
| 3 | Migrations + schema + RLS catalog | PASS | `ENV-01`, `ENV-03`–`ENV-10` |
| 4 | Tenant/auth-context isolation | PASS | `AC-01`–`AC-15`, `APP-01`–`APP-07` |
| 5 | Database protections & persisted contracts | PASS | `DP-01`–`DP-11` |
| 6 | Inventory & stock integrity | PASS | `INV-01`–`INV-11` |
| 7 | Financial invariants | PASS (partial breadth) | `FIN-01`–`FIN-06`; 30/0/24 in financial harness |
| 8 | Temporal / financial-date contracts | PASS | `TMP-01`–`TMP-09` |
| 9 | Defect repair + regression proof | PASS | D-01 repaired, static + runtime proof |
| 10 | Static suite & schema gates | PASS | 646/646, tsc 0, lint clean, `validate`/`migrate status` |
| 11 | Environment retirement | PASS | container removed, port released, temp artifacts deleted |
| 12 | Acceptance report & verdict | THIS DOCUMENT | — |

No phase was silently skipped. Phase 7 is marked *partial breadth* because 24 scenarios are unimplemented or require owner decisions; they are recorded as BLOCKED, never as passes.

---

## 4. Runtime Evidence — 69/69

Evidence: `.obsidian-vault/specs/evidence/postgres-runtime-verification-2026-11-14.json` (`aborted: false`, `passed: 69`, `failed: 0`).

| Phase | Cases |
|---|---|
| 2 — Environment | `ENV-02` |
| 3 — Migrations/schema/RLS | `ENV-01`, `ENV-03`, `ENV-04`, `ENV-05`, `ENV-06`, `ENV-07`, `ENV-08`, `ENV-09`, `ENV-10` |
| 4 — Tenant/auth context | `AC-01`–`AC-15`, `APP-01`–`APP-07` |
| 5 — DB protections | `DP-01`–`DP-11` |
| 6 — Inventory | `INV-01`–`INV-11` |
| 7 — Financial | `FIN-01`–`FIN-06` |
| 8 — Temporal | `TMP-01`–`TMP-09` |

Highlights proven by real connections, roles, transactions, and committed state:

- **Catalog truth:** 40 tables; 39 with `ENABLE` + `FORCE` RLS and a `signed_ctx_select` policy; 103 policies; 31 applied migrations; only `_prisma_migrations` unprotected.
- **Fails closed:** missing, malformed, expired, wrong-signature, replayed-nonce, and cross-tenant contexts all reject; `42501` on `pharmnos_private.verify_auth_context` is expected, and the runtime uses the `public.financial_context_*` SECURITY DEFINER wrappers.
- **Write isolation:** same-tenant INSERT succeeds; cross-tenant INSERT is refused by policy.
- **Immutability:** finalized sales header and item mutation triggers installed and enforcing; purchase protections likewise.
- **Inventory:** FEFO/explicit batch selection, short-pick refusal, transaction rollback, concurrent allocation serialization, valuation approval idempotency, and stock adjustment (−3, exactly one `ADJUSTMENT_OUT`, idempotent replay).
- **Financial:** unallocated customer payment → unapplied credit in one ledger row with a receipt number; allocation/reversal/refund lifecycle incl. request → approve → complete with idempotent replay.
- **Temporal:** `recorded_at` is trigger-assigned and caller-immutable; effective-date basis provenance persists.

### 4.1 Financial breadth harness

Evidence: `.obsidian-vault/specs/evidence/financial-reconciliation-runtime-2026-11-14.json` — **30 pass / 0 fail / 24 blocked**.

Passing (30): customer/supplier application action regressions, terminal refund transitions (customer + supplier), `S-02`, `S-03`, `S-05`, `S-06`, `S-34`, `S-35`, `S-11`, `S-36`, `S-12`, `S-13`, `S-17`, `S-14`, `S-15`, two-payment allocation, allocation idempotency replay + payload conflict, allocation reversal, customer refund lifecycle, refund-request terminal transitions, partial and full customer refund, supplier allocation cache neutrality, supplier refund payable-cache, supplier payment reversal, `S-29`, allocation concurrency, allocation transaction rollback.

Blocked (24, not credited): `S-01`, `S-04`, `S-07`–`S-10`, `S-16`, `S-18`–`S-28`, `S-30`–`S-33`, `S-37`, `S-38`. These cover missing fixtures (receipt-sequence concurrency `S-28`, stale-read `S-24`, legacy cutover `S-25`/`S-26`, supplier multi-allocation `S-31`–`S-33`, supplier debit adjustment `S-38`) and owner decisions (`S-27` Cheque, `S-30` currency). Commercial credit-note and supplier debit-adjustment workflows are **unimplemented**, which is a scope gap, not a runtime failure.

---

## 5. Defect D-01 (P1) — Repaired

**Symptom.** Inventory valuation approval and stock adjustment failed on *every* invocation with PostgreSQL `42P18`: `could not determine data type of parameter $1`.

**Root cause.** Advisory-lock expressions used uncast parameters inside `concat(...)`:

```sql
concat(${tenantId}, ':inventory-valuation:', ${input.batchId})
concat(${ctx.tenantId}, ':stock-adjustment:', ${data.idempotency_key})
```

Prisma sends these as untyped parameters. PostgreSQL cannot infer their types inside `concat`, so statement preparation fails before any lock is taken. Two sibling sites were already correct (`sales.actions.ts:654`, `purchases.actions.ts:1396`), confirming the intended pattern.

**Proof of mechanism.** Reproduced over the pg extended protocol: the uncast form returns `42P18`; the cast form succeeds. `PREPARE` with declared parameter types succeeds for both, which is why static review had missed it — the defect only appears on the wire with inferred parameters.

**Fix.** Explicit `text` casts at both sites, matching existing correct usage:

- `src/app/_actions/inventory-valuation.actions.ts` — `lockValuationTarget`
- `src/app/_actions/purchases.actions.ts` — `createStockAdjustmentAction`

**Regression proof.**

- Static: `tests/purchase-gst-valuation-contract.test.mjs` and `tests/stock-adjustment-integrity-contract.test.mjs` now assert the cast form is present and the uncast form is absent.
- Runtime: `INV-10` (valuation approve + idempotent replay, batch reaches `APPROVED`) and `INV-11` (stock adjustment −3, exactly one `ADJUSTMENT_OUT`, idempotent) pass. Both were impossible before the fix.

No other genuine product defect was identified. Earlier red results were harness-fixture bugs (finalized-item insert ordering, dotted subject breaking signed-context parsing, missing `updated_at` on raw inserts, nonce replay needing `COMMIT`, fixed slugs colliding across reruns, array-typed catalog output, trigger-name mismatch, an incorrect `audit_logs` expectation for customer payments).

---

## 6. Credential Remediation

A pre-existing security finding (documented in `dsh-session-exposure-security-assessment-2026-11-13.md`) was still live: tracked scripts contained real database passwords and the HMAC signing secret.

Nine tracked files were neutralized — eight JavaScript files now read credentials from the environment and fail fast with a named error, and `scripts/setup-runtime-role.sql` is now a psql-variable template using `\gexec` so the password is never stored in the file. `.env.financial-e2e-verify` was rewritten with `__RETIRED__` placeholders and a regeneration pointer.

Verification:

- `git grep` for each retired literal → no matches.
- `git grep` for `postgres(ql)?://user:16+char-secret@` → no matches.
- `node --check` on all eight scripts → clean.

This closes the finding at the working-tree level. **Because the literals exist in Git history, the affected credentials must be treated as compromised and rotated**; no history rewrite was performed (destructive operation, out of scope).

---

## 7. Static & Schema Gates (final tree)

| Gate | Command | Result |
|---|---|---|
| Test suite | `node --test "tests/*.test.mjs"` | 646/646 pass, 0 fail |
| Typecheck | `pnpm exec tsc --noEmit` | exit 0 |
| Lint | `pnpm run lint` | no warnings or errors |
| Prisma validate | `prisma validate` | valid |
| Migration status | `prisma migrate status` | 31 migrations, "Database schema is up to date!" |
| Syntax | `node --check` (8 neutralized scripts) | clean |

### 7.1 Schema drift (pre-existing, captured not fixed)

`prisma migrate diff --from-url <db> --to-schema-datamodel prisma/schema.prisma` is non-empty. Classification:

| Drift | Direction | Impact |
|---|---|---|
| FK/index renames (e.g. `allocation_reversals_allocation_fkey` → `..._tenant_id_allocation_id_fkey`) | naming only | none at runtime |
| `inventory_valuation_decisions.recoverable_itc`, `non_recoverable_gst`, `inventory_acquisition_cost` — Prisma default vs DB `numeric(20,4)` | type annotation | none at runtime; `migrate dev` would emit `ALTER COLUMN` |
| `payment_refunds` missing `@@unique([tenant_id, id])` | schema expects, DB lacks | none for current queries |
| `purchase_invoice_items` missing `(tenant_id, purchase_id, accepted_decision_id)` index | schema expects, DB lacks | query planning only |
| `(tenant_id, invoice_no)` unique — schema expects full unique, DB has partial unique (draft-aware) | intentional DB design | **`migrate dev` / `db push` would generate wrong DDL and destroy draft-invoice support** |

**Disposition:** `migrate deploy` (the deployment path) is unaffected and reports up to date. No historical migration was edited. The drift is recorded as a deployment hazard for anyone using `migrate dev` or `db push` against existing data, and as a follow-up to reconcile schema annotations with the intentional partial indexes.

---

## 8. Remaining Gaps & Owner Decisions

| Item | State | Owner action |
|---|---|---|
| `09-signed-context-tenant-isolation.sql` deployment | manual step, not a migration | add migration wrapper or documented runbook step |
| Signing-secret provisioning | manual SQL `INSERT` | automate per environment |
| Read paths (RSC, reports, dashboard) tenant context | not established per request | design/implement |
| Stock counter vs movement reconciliation | absent | design/implement |
| `S-27` Cheque | unsupported, rejection unverified | explicit owner decision |
| `S-30` payment currency | unsupported, rejection unverified | explicit owner decision |
| Supplier debit-adjustment / commercial credit note | unimplemented | scope decision |
| CI/CD pipeline | absent | add |
| Browser E2E | absent | add |
| Credential rotation after history exposure | outstanding | rotate in every environment that used them |
| Schema drift reconciliation | recorded | schedule migration |

---

## 9. Git Integrity

- Initial HEAD: `659aa53`
- Final HEAD: `659aa53` (unchanged)
- No commits, pushes, merges, rebases, resets, cleans, or stashes.
- Modified (14): `.env.financial-e2e-verify`, 8 `scripts/*.js`, `scripts/setup-runtime-role.sql`, 2 source actions, 2 test files.
- Untracked (2): `scripts/postgres-runtime-verification.mjs`, `.obsidian-vault/specs/evidence/`.
- `tsconfig.tsbuildinfo` restored to its committed state.
- Pre-existing user work preserved; no deletion of unfamiliar files.

---

## 10. Status

```text
[PHARMNOS-LITE STATUS]

Stage: PostgreSQL Runtime Verification & Engineering Closure
Completion: 100/100 source+static; 85/100 weight PostgreSQL-runtime-verified
          (15 points are inherently offline criteria); 0/100 independently accepted
Verdict: VERIFIED WITH FINDINGS — production remains NO-GO

Owner authorization:
- Full in-scope project access: AUTHORIZED (read-only + in-scope repair)
- Code/schema/migration changes: AUTHORIZED (narrowest-layer defect repair only)
- Disposable local PostgreSQL verification: AUTHORIZED (completed)
- Production/shared hosted operations: NOT AUTHORIZED (none performed)
- Commits/pushes/merges: NOT AUTHORIZED (none performed)

Environment:
- Disposable container pharmnos_runtime_verify_rv20261114055301
- PostgreSQL 17.11 (postgres:17-alpine), loopback 127.0.0.1:57565, tmpfs data dir
- Separate bootstrap owner role + pharmnos_e2e_runtime (NOSUPERUSER NOBYPASSRLS,
  SELECT/INSERT/UPDATE only), per-run HMAC secret via environment
- No shared, production, or Supabase target contacted
- Container removed, port released, temp credentials and artifacts deleted

Implemented:
- All 31 Prisma migrations applied via prisma migrate deploy
- 09-signed-context-tenant-isolation.sql applied: 39/40 tables FORCE RLS, 103 policies
- P1 defect D-01 repaired: uncast concat() in advisory locks (42P18) at
  inventory-valuation.actions.ts and purchases.actions.ts
- 9 tracked files with hardcoded credentials converted to environment/psql variables

Static-offline verified:
- node --test "tests/*.test.mjs": 646/646 pass
- pnpm exec tsc --noEmit: exit 0
- pnpm run lint: no warnings or errors
- prisma validate: valid; prisma migrate status: up to date (31 migrations)
- node --check on all neutralized scripts: clean
- No retired credential literal or credential URL remains in tracked files

PostgreSQL runtime verified:
- scripts/postgres-runtime-verification.mjs: 69 passed / 0 failed, aborted=false
  ENV-02; ENV-01,03-10; AC-01..15; APP-01..07; DP-01..11; INV-01..11;
  FIN-01..06; TMP-01..09
- scripts/financial-reconciliation-runtime-harness.cjs: 30 pass / 0 fail / 24 blocked
- D-01 runtime proof: INV-10 valuation approve+replay, INV-11 stock adjustment -3
  with exactly one ADJUSTMENT_OUT and idempotent replay
- Evidence archived: .obsidian-vault/specs/evidence/
  postgres-runtime-verification-2026-11-14.json
  financial-reconciliation-runtime-2026-11-14.json  (both free of URLs/secrets)

Independently accepted:
- NOT ACHIEVED. Self-verification only; no second-party review of this evidence.

Remaining:
- S-27 (Cheque) and S-30 (payment currency) owner decisions pending
- 24 financial scenarios blocked (fixtures not implemented or scope absent),
  including receipt-sequence concurrency, stale-read, legacy cutover,
  supplier multi-allocation, supplier debit adjustment
- Commercial credit-note / supplier debit-adjustment workflows unimplemented
- 09-SQL deployment and signing-secret provisioning remain manual
- Read paths (RSC, reports, dashboard) do not establish per-request tenant context
- Stock counter vs movement reconciliation absent
- Schema drift recorded: numeric precision annotations, missing payment_refunds
  (tenant_id,id) unique and purchase_invoice_items index, full-unique vs partial
  unique invoice indexes (migrate dev/db push would emit wrong DDL)
- Hardcoded credentials remain recoverable from Git history: rotate all affected values
- No CI/CD pipeline; no browser E2E

Blockers to GO:
- Two owner policy decisions (S-27, S-30) unresolved
- Unimplemented financial workflows and 24 blocked scenarios
- Manual provisioning steps; no independent acceptance

Git integrity:
- Initial HEAD: 659aa53
- Final HEAD: 659aa53 (unchanged)
- 14 modified / 2 untracked entries; pre-existing user work preserved
- No commits/pushes/merges/rebase/clean/stash performed

Production status:
- NO-GO. Runtime evidence is now substantive, but blocked scope, unresolved owner
  decisions, and the absence of independent acceptance prevent a GO.
```

---

## 11. Path to GO

1. Resolve `S-27` (Cheque) and `S-30` (currency) with explicit owner decisions.
2. Implement or formally descope supplier debit-adjustment and commercial credit-note workflows; convert the 24 BLOCKED scenarios into executable fixtures or documented exclusions.
3. Automate `09-signed-context-tenant-isolation.sql` deployment and signing-secret provisioning.
4. Add per-request tenant context to read paths.
5. Rotate every credential exposed in Git history.
6. Reconcile schema drift without rewriting history.
7. Add CI/CD plus browser E2E.
8. Obtain independent review of the runtime evidence and this report.
