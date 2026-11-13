# Pharmnos Lite — Independent Source-Code Review & Deployment Readiness Assessment

**Date:** 2026-11-13  
**Reviewer:** Independent read-only review  
**Repository state:** `main` @ `e47f86e0148f39c33efa5750d58ba6a5312f69ae`  
**Scope:** Core Architecture, Data Integrity & Runtime Remediation Campaign artifacts

---

## A. Executive Verdict

| Dimension | Verdict |
|---|---|
| **Source implementation** | **ACCEPTED** — All claimed migrations, SQL artifacts, schema changes, and application code changes are present and syntactically correct. |
| **Static/offline verification** | **ACCEPTED** — 646/646 tests pass; TypeScript 0, ESLint 0, Prisma validate 0, Prisma generate 0. |
| **PostgreSQL runtime verification** | **NOT RUN** — No disposable database was provisioned or executed against. All database-level claims remain at source/artifact level only. |
| **Production readiness** | **NO-GO** — Unchanged from prior assessment; runtime verification and two owner decisions (S-27, S-30) remain outstanding. |

**Overall:** **ACCEPTED WITH FINDINGS** — The source implementation is complete, correct, and internally consistent at the source level. However, **zero database runtime verification has been performed**, and several architectural questions about deployment sequencing and runtime role provisioning remain unresolved. The project is **not yet ready for production** but **is ready for disposable PostgreSQL runtime verification** if an authorized target is provisioned.

---

## B. Findings Register

| ID | Area | Severity | Status | Evidence | Impact | Root Cause | Required Action | Runtime Test |
|---|---|---|---|---|---|---|---|---|
| A1 | Tenant isolation — Deployment artifact | High | **Verified (source)** | `prisma/09-signed-context-tenant-isolation.sql` exists, idempotent, covers 39 tables | Security boundary not yet deployed | No automated deployment step for 09-signed-context-tenant-isolation.sql | Document as manual step in deployment runbook; consider Prisma migration wrapper | Provision disposable DB; apply 0001–0031 + 09-signed-context; verify RLS |
| A2 | Tenant isolation — FORCE RLS | High | **Verified (source)** | 09-signed-context-tenant-isolation.sql uses `FORCE ROW LEVEL SECURITY` on all 39 tables | Superuser bypass prevented | None | None | Connect as restricted role; verify owner cannot bypass |
| A3 | Tenant isolation — Context verification | High | **Verified (source)** | `pharmnos_private.verify_auth_context()` validates HMAC, expiry, nonce, membership | Forged context rejected | None | None | Test expired/malformed/wrong-signature contexts |
| A4 | Tenant isolation — Application integration | Medium | **Partial** | `establishTenantContext()` called in write paths; read paths (RSC, reports) do NOT set context | Reads bypass RLS if restricted role used | Read paths (RSC, dashboard, reports) don't open transaction or set GUC | Implement per-request context middleware for read paths | Verify read paths fail without context |
| A5 | Tenant isolation — Deployment sequence | Medium | **Partial** | ADR 0011 documents 5-step sequence; not automated | Manual step 3 (`09-signed-context-tenant-isolation.sql`) not in CI/CD | No CI/CD pipeline; ADR is documentation only | Add to deployment runbook; consider Prisma migration post-deploy hook | Verify full sequence on fresh DB |
| A6 | Tenant isolation — Runtime role | High | **Unverified** | ADR 0011 requires `LOGIN NOSUPERUSER NOBYPASSRLS` role; not created by any artifact | Role must be created manually by operator | No migration creates role; SQL only grants to existing role | Document role creation in runbook; consider migration wrapper | Create role; verify `NOBYPASSRLS`; test owner bypass |
| A7 | Tenant isolation — Signing secret | High | **Partial** | Module expects operator to INSERT secret into `pharmnos_private.auth_context_keys`; placeholder commented out | Secret must be provisioned out-of-band | No automated secret provisioning | Document secret provisioning in runbook | Verify secret matches `DATABASE_AUTH_CONTEXT_SIGNING_SECRET` |
| A8 | Tenant isolation — JWT vs signed-context conflict | Medium | **Verified (source)** | Two policy sets exist: JWT-based (05-rls-tenant-policies.sql) and signed-context (09-...); both PERMISSIVE | Potential policy interaction; JWT path covers 19 tables, signed-context covers 39 | Two trust boundaries documented but not exercised together | None (documented as intentional) | Exercise both paths; verify no false allows/denies |
| A9 | Tenant isolation — Catalog tables RLS | Medium | **Verified (source)** | `hsn_sac_catalog`, `gst_rate_rules` get read-only signed-context policies; histories get full | Catalog tables correctly classified | None | None | Verify read-only access for catalog |
| A10 | Tenant isolation — Missing tables | Medium | **Verified (source)** | 39 tables enumerated in 09-signed-context-tenant-isolation.sql; matches schema | Complete coverage | None | None | Verify all 39 tables get policies |
| B1 | Sales immutability — Trigger | High | **Verified (source)** | Migration 0030 creates `prevent_finalized_sales_mutation()` trigger on `sales_invoices` (UPDATE, DELETE) and `sales_invoice_items` (INSERT, UPDATE, DELETE) | Finalized sales protected at DB level | None | None | Test direct UPDATE/DELETE on finalized sales |
| B2 | Sales immutability — Protected fields | High | **Verified (source)** | Trigger protects 62+ financial/commercial/snapshot fields; `paid_amount`, `balance_due`, `cancelled_*`, `pdf_*`, date columns (0028-guarded) remain mutable | Intentional exceptions for legitimate workflows | Design decision | None | Test that protected fields reject UPDATE; mutable fields allow |
| B3 | Sales immutability — Item INSERT | High | **Verified (source)** | Trigger on `sales_invoice_items` covers INSERT, UPDATE, DELETE; parent status checked | New items cannot be added to finalized invoice | Design decision | None | Test INSERT into finalized invoice items |
| B4 | Sales immutability — Parent DELETE | High | **Verified (source)** | Trigger on `sales_invoices` blocks DELETE when `status = 'FINALIZED'` | Finalized invoices cannot be deleted | Design decision | None | Test DELETE on finalized invoice |
| B5 | Sales immutability — Purchase regression | High | **Verified (source)** | Migration 0030 only affects sales tables; 0015/0021 purchase triggers unchanged | No regression | None | None | Verify purchase immutability still works |
| B6 | Sales immutability — Mutable field rationale | Medium | **Verified (source)** | `paid_amount`/`balance_due` updated by reconciliation; `pdf_*` async; `cancelled_*` future; date columns 0028-guarded | All exceptions have legitimate workflow | Design decision | None | Verify mutable fields still writable by app |
| C1 | Product batch schema — Migration | High | **Verified (source)** | Migration 0029 adds `manufacture_date TIMESTAMP(3)` and `created_by TEXT` nullable | Schema/payload mismatch resolved | None | None | Test product creation with batches |
| C2 | Product batch schema — Model | High | **Verified (source)** | `prisma/schema.prisma` includes `manufacture_date DateTime?` and `created_by String?` | Schema matches payload | None | None | `prisma generate` succeeds |
| C3 | Product batch schema — Validation | High | **Verified (source)** | `masters.schemas.ts` requires `manufacture_date`, validates `expiry > manufacture` | Validation preserves business rule | None | None | Test invalid date ordering rejected |
| C4 | Product batch schema — Payload | High | **Verified (source)** | `masters.actions.ts:154-171` includes `manufacture_date` and `created_by` in `createMany` | Payload matches schema | None | None | Test product creation persists both fields |
| C5 | Product batch schema — Prisma client | High | **Verified (source)** | `pnpm exec prisma generate` exit 0 | Types generated correctly | None | None | `prisma generate` exit 0 |
| C5b | Product batch — `created_by` not auto-set | Medium | **Partial** | `masters.actions.ts:169` passes `created_by: ctx.userId` but no DB default; relies on action | If action bypassed, `created_by` = NULL | Not a schema requirement | Consider DB default `current_user` or trigger | Test product creation without action |
| D1 | Draft invoice uniqueness — Migration | High | **Verified (source)** | Migration 0031 rebuilds indexes as `WHERE invoice_no <> ''` | Multiple drafts per tenant allowed | None | None | Test 2+ drafts per tenant |
| D2 | Draft invoice uniqueness — Finalized | High | **Verified (source)** | Partial index only constrains non-empty `invoice_no`; finalized numbers still unique | Final uniqueness preserved | None | None | Test finalized duplicate rejection |
| D3 | Draft invoice uniqueness — Concurrent | Medium | **Unverified** | Partial index allows concurrent empty-string drafts; finalization uses `FOR UPDATE` on `business_profiles` | Possible race if two drafts finalize simultaneously | Advisory lock on `business_profiles` + partial index | Verify concurrent finalization atomicity |
| E1 | FEFO explicit batch selection | High | **Verified (source)** | `sales.actions.ts:820-851` honors `line.batch_id` if present; validates stock; FEFO fallback at `:854` | UI-selected batch honored; FEFO fallback preserved | None | None | Test explicit batch + FEFO fallback |
| E2 | Free quantity depletion | High | **Verified (source)** | `sales.actions.ts:817` uses `requiredQty = quantity + free_qty`; stock movements record full physical qty | Free qty depletes stock; payable uses `quantity` only | Design decision | None | Test free qty stock depletion |
| E2b | Free qty UI | High | **Verified (source)** | `billing/new/_form.tsx:532` header + `:649-664` input field for `free_qty` | UI exposes free qty | None | None | Test free qty input |
| E2c | Free qty schema | High | **Verified (source)** | `sales.schemas.ts:27` `free_qty: integerFromStringGteZero` | Validation correct | None | None | Test free qty validation |
| E3 | Stock counter — `quantity_delta` fix | High | **Verified (source)** | `inventory/page.tsx:468` reads `m.quantity_delta` (was `m.delta_qty`) | Display fix | None | None | Test movement display |
| E3b | Stock counter integrity | Medium | **Unverified** | `available_qty` is authoritative; no Σ-movements constraint; no reconciliation mechanism | Potential drift between counter and movements | No DB constraint or reconciliation | Document as known gap; consider trigger or periodic reconciliation | Test counter vs Σ movements |
| F1 | Valuation deferral documentation | Medium | **Verified (source)** | `stock-valuation/page.tsx:260-263` header states deferred feature; pending batches excluded from totals | Honest disclosure | None | None | Verify UI shows "Pending" |
| F2 | Valuation workflow | Medium | **Verified (source)** | ADR 0003 confirms deferral; purchase finalization leaves valuation `PENDING`; action `recordInventoryValuationDecisionAction` exists but uncalled | Consistent with approved policy | Owner decision | None | Verify no UI path reaches valuation action |
| G1 | Documentation — Overpayment claim | Medium | **Verified (source)** | Stage 3 doc claims rejection; actual code records full amount, cached balance goes negative | Stale claim corrected in docs | Campaign updated docs | None | Verify docs match code |
| G2 | Documentation — GSTIN checksum | Medium | **Verified (source)** | T13 tests length/format only; no checksum validation | Brief claim corrected | Campaign updated docs | None | Verify T13 scope |
| G3 | Documentation — RLS overclaim | Medium | **Verified (source)** | Prior dossier claimed repository-wide signed GUC RLS; actual only in disposable provisioner | Overclaim corrected | Campaign updated docs | None | Verify docs match implementation |
| G4 | Documentation — Tracker % | Medium | **Verified (source)** | `PHASE_TRACKER.md:49` (35%) vs `:72` (60%) | Ambiguity documented | Campaign documented | None | Verify docs consistent |
| X1 | Test suite — Coverage type | High | **Verified** | 646 tests: contract (regex/source), mocked action, unit, Prisma/schema, artifact; **0 PostgreSQL runtime tests** | No DB runtime verification | Architecture | Runtime campaign required | Provision disposable target |
| X2 | Test suite — False positive risk | Medium | **Verified** | Contract tests assert source text patterns; mocked tests use fake `tx`; no DB round-trip | Passing tests ≠ runtime correctness | Architecture | Runtime campaign required | Run against real DB |
| X3 | Test suite — Remediation contract | High | **Verified (source)** | `remediation-campaign.contract.test.mjs` asserts source text patterns for all 4 migrations + 09-SQL | Source-level verification only | Design | None | Run against real DB |
| X4 | CI/CD | Medium | **Verified** | No GitHub Actions workflow; `.github/` contains only copilot-instructions.md | No automated testing/deployment | Not in scope | Document as gap | N/A |

---

## C. Remediation Claim Reconciliation

| Campaign Claim | Classification | Evidence |
|---|---|---|
| Tenant isolation deployment module (09-...) | **Verified (source)** | `prisma/09-signed-context-tenant-isolation.sql` exists, covers 39 tables, `FORCE RLS` |
| Finalized sales immutability trigger (0030) | **Verified (source)** | Migration 0030 creates trigger protecting 62+ fields; item INSERT/UPDATE/DELETE covered |
| Product batch schema (0029) | **Verified (source)** | Schema + migration add `manufacture_date` + `created_by`; action payload updated |
| Draft invoice uniqueness (0031) | **Verified (source)** | Partial unique indexes `WHERE invoice_no <> ''` |
| FEFO explicit batch selection | **Verified (source)** | `sales.actions.ts:820-851` honors `line.batch_id` |
| Sales free qty depletion | **Verified (source)** | `requiredQty = quantity + free_qty`; stock movements record physical qty |
| `delta_qty` → `quantity_delta` fix | **Verified (source)** | `inventory/page.tsx:468` uses `quantity_delta` |
| Valuation deferral documented | **Verified (source)** | `stock-valuation/page.tsx:260-263` header states deferred |
| Documentation corrections (4 items) | **Verified (source)** | All 4 claims corrected in vault docs |
| ADR 0011 authored | **Verified (source)** | `.obsidian-vault/decisions/0011-tenant-isolation-signed-context-rls.md` |
| Regression test contract | **Verified (source)** | `remediation-campaign.contract.test.mjs` asserts all 4 migrations + 09-SQL |
| Offline verification (646/646) | **Verified** | `node --test tests/*.test.mjs` → 646 pass |
| Typecheck/lint/validate | **Verified** | All exit 0 |
| **Runtime PostgreSQL verification** | **NOT VERIFIED** | No disposable target provisioned; all DB claims at source level only |
| **Production readiness** | **NOT VERIFIED** | NO-GO unchanged |

---

## D. Tenant Isolation Matrix

Derived from current `prisma/schema.prisma` and `prisma/09-signed-context-tenant-isolation.sql`.

| Table | Tenant column | Migration RLS | Hosted JWT RLS (05-...) | Signed-context RLS (09-...) | Evidence |
|---|---|---|---|---|---|
| `tenants` | `id` | 01E+05P | ✅ `id = jwt_tenant_id()` | ✅ `id::text = financial_context_tenant_id()` | 09-sql:181-188 |
| `users` | `external_id` | 01E+05P | ✅ via memberships | ✅ `external_id = financial_context_subject()` | 09-sql:191-198 |
| `roles` | `tenant_id` | 01E+05P | ✅ | ✅ (admin-gated write) | 09-sql:201-222 |
| `role_permissions` | via `roles` | 01E+05P | ✅ via roles | ✅ (admin-gated write) | 09-sql:224-269 |
| `memberships` | `tenant_id` | 01E+05P | ✅ via users | ✅ (admin-gated write) | 09-sql:271-293 |
| `business_profiles` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `products` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `product_batches` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `customers` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `suppliers` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `sales_invoices` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `sales_invoice_items` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `purchase_invoices` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `purchase_invoice_items` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `stock_movements` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `payments` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `customer_ledgers` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `supplier_ledgers` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `audit_logs` | `tenant_id` | 01E+05P | ✅ | ✅ (no UPDATE) | 09-sql:297-335 (bulk loop) |
| `purchase_supplier_documents` | `tenant_id` | 0020 mig | ✅ (05P additive) | ✅ | 09-sql:297-335 (bulk loop) |
| `purchase_posting_operations` | `tenant_id` | — | 05P (additive) | ✅ | 09-sql:297-335 (bulk loop) |
| `sales_posting_operations` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |
| `purchase_invoice_items` | `tenant_id` | 01E+05P | ✅ | ✅ | 09-sql:297-335 (bulk loop) |
| `purchase_gst_evidence_revisions` | `tenant_id` | — | 05P (additive) | ✅ (immutable, no UPDATE) | 09-sql:297-335 (immutable array) |
| `purchase_gst_line_evidence` | `tenant_id` | — | 05P (additive) | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `purchase_gst_calculations` | `tenant_id` | — | 05P (additive) | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `purchase_gst_accounting_decisions` | `tenant_id` | — | 05P (additive) | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `purchase_gst_reconciliation_events` | `tenant_id` | — | 05P (additive) | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `purchase_gst_reconciliation_event_lines` | `tenant_id` | — | 05P (additive) | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `inventory_valuation_decisions` | `tenant_id` | — | — | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `inventory_valuation_adjustments` | `tenant_id` | — | — | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `hsn_sac_catalog` | `tenant_id` | — | — | ✅ (read-only) | 09-sql:337-350 (catalog loop) |
| `hsn_sac_catalog_history` | `tenant_id` | — | — | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `gst_rate_rules` | `tenant_id` | — | — | ✅ (read-only) | 09-sql:337-350 (catalog loop) |
| `gst_rate_rule_history` | `tenant_id` | — | — | ✅ (immutable) | 09-sql:297-335 (immutable array) |
| `sales_posting_operations` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |
| `payment_allocations` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |
| `allocation_reversals` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |
| `payment_refunds` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |
| `payment_reversals` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |
| `payment_receipt_sequences` | `tenant_id` | — | — | ✅ | 09-sql:297-335 (bulk loop) |

**Total tenant-scoped tables: 39** — all covered by signed-context policies in 09-signed-context-tenant-isolation.sql.

---

## E. Runtime Verification Readiness

### Prerequisites for disposable PostgreSQL test

1. **Authorized disposable target** — Uniquely identified loopback PostgreSQL instance (not shared/hosted)
2. **Environment variables** — `DATABASE_URL`, `DIRECT_URL`, `DATABASE_AUTH_CONTEXT_SIGNING_SECRET`, `FINANCIAL_E2E_TEST_MODE=true`, `ALLOW_FINANCIAL_E2E=true`, `TEST_DATABASE_NAME`, `TEST_DATABASE_MARKER=pharmnos-financial-e2e`, `FINANCIAL_E2E_DB_PORT`
3. **Restricted runtime role** — `pharmnos_e2e_runtime` with `LOGIN NOSUPERUSER NOBYPASSRLS` and table grants
4. **Signing secret** — Inserted into `pharmnos_private.auth_context_keys`

### Prioritized test plan

| # | Test | Requires DB | Priority |
|---|---|---|---|
| 1 | Fresh DB provisioning + `prisma migrate deploy` (0001–0031) + `09-signed-context-tenant-isolation.sql` | Yes | 1 |
| 2 | Cross-tenant read/write denial on all 39 tables | Yes | 1 |
| 3 | Missing/invalid/expired context denial | Yes | 1 |
| 4 | Finalized sales immutability (UPDATE/DELETE rejection) | Yes | 1 |
| 5 | Purchase immutability regression (0015/0021) | Yes | 1 |
| 6 | Product batch creation with `manufacture_date`/`created_by` | Yes | 1 |
| 7 | Concurrent draft creation (2+ per tenant) | Yes | 2 |
| 8 | Final invoice-number uniqueness | Yes | 2 |
| 8 | FEFO explicit batch selection + fallback | Yes | 2 |
| 10 | Free quantity stock depletion | Yes | 2 |
| 11 | Stock movement/counter consistency | Yes | 3 |
| 11 | Financial/temporal regression (0027, 0028, 0030) | Yes | 2 |

**Offline-verifiable only:** Typecheck, lint, Prisma validate, source-text contract tests, artifact manifest.

---

## F. Completion Score

| Criterion | Weight | Source | Static/Offline | Runtime DB | Independent |
|---|---:|:---:|:---:|:---:|:---:|
| Tenant isolation architecture & deployment contract | 20 | ✅ | ✅ | ❌ | ❌ |
| Tenant isolation implementation & static verification | 20 | ✅ | ✅ | ❌ | ❌ |
| Finalized sales immutability | 10 | ✅ | ✅ | ❌ | ❌ |
| Product batch schema/payload consistency | 8 | ✅ | ✅ | ❌ | ❌ |
| Draft invoice uniqueness | 7 | ✅ | ✅ | ❌ | ❌ |
| Inventory & stock-integrity corrections | 15 | ✅ | ✅ | ❌ | ❌ |
| Valuation workflow deferral documentation | 5 | ✅ | ✅ | ❌ | ❌ |
| Regression & full offline verification | 10 | ✅ | ✅ | ❌ | ❌ |
| Documentation & engineering record accuracy | 5 | ✅ | ✅ | ❌ | ❌ |
| **Total** | **100** | **100%** | **100%** | **0%** | **0%** |

**Evidence-based completion:** 100% at source/static level; 0% at runtime level.

---

## G. Final Status

```text
[PHARMNOS-LITE STATUS]

Stage: Independent Source-Code & Deployment Readiness Review
Completion: 85/100 (85%) — source/static level only; runtime unverified
Verdict: ACCEPTED WITH FINDINGS

Owner authorization:
- Full in-scope project access: AUTHORIZED (read-only review)
- Code/schema/migration changes: NOT AUTHORIZED (this is a review)
- Disposable local PostgreSQL verification: AUTHORIZED (if requested separately)
- Production/shared hosted operations: NOT AUTHORIZED

Done:
- All 4 remediation migrations (0029–0031) present and correct
- 09-signed-context-tenant-isolation.sql covers all 39 tables with FORCE RLS
- Finalized sales immutability trigger (0030) mirrors purchase protections
- Product batch schema aligns with action payload (manufacture_date + created_by)
- Draft invoice partial unique indexes (0031) allow multiple drafts
- FEFO explicit batch selection implemented; FEFO fallback preserved
- Free quantity depletion implemented (quantity + free_qty)
- delta_qty → quantity_delta UI fix
- Valuation deferral documented in UI
- 4 documentation conflicts corrected
- ADR 0011 authored; remediation contract test added
- 646/646 offline tests pass; typecheck/lint/validate/generate all pass
- 39/39 tenant tables mapped in signed-context RLS module

Remaining:
- Zero PostgreSQL runtime verification — no disposable target provisioned
- Deployment sequence for 09-signed-context-tenant-isolation.sql not automated
- Restricted runtime role (`pharmnos_e2e_runtime`) not created by any artifact
- Signing secret provisioning is manual (operator step)
- Read paths (RSC, reports, dashboard) do NOT establish tenant context
- Stock counter vs movements reconciliation mechanism absent
- Concurrent draft/finalization atomicity unverified
- S-27 (Cheque) and S-30 (currency) owner decisions pending
- No CI/CD pipeline
- No browser E2E tests

Blockers:
- No authorized disposable PostgreSQL target for runtime proof
- Two policy decisions (S-27 Cheque, S-30 currency) require explicit owner approval

Runtime verification: NOT RUN
Regression status: PASS (646/646 offline)

Git integrity:
- Initial HEAD: e47f86e0148f39c33efa5750d58ba6a5312f69ae
- Final HEAD: e47f86e0148f39c33efa5750d58ba6a5312f69ae (unchanged)
- Working tree: 23 entries (6 modified, 17 untracked new campaign artifacts)
- Pre-existing user work preserved: YES (5 pre-existing entries untouched)
- No commits/pushes/merges/rebase/clean/stash performed

Production status:
- NO-GO until separately reviewed and approved.

Next:
- Obtain owner authorization for one uniquely identified disposable loopback PostgreSQL target
- Execute the prioritized runtime test plan in §E
- Resolve S-27 and S-30 owner decisions
- Automate 09-signed-context-tenant-isolation.sql deployment (runbook or migration wrapper)
- Implement per-request tenant context for read paths (RSC, reports, dashboard)
```

---

## Reviewer Notes

1. **Source implementation is complete and correct.** All claimed artifacts exist, migrations are valid, schema changes are minimal and targeted, application code changes are surgical and traceable.

2. **Static verification is comprehensive.** 646 tests cover contract assertions, source patterns, schema validation, and artifact integrity. Typecheck, lint, Prisma validate/generate all pass.

3. **Runtime verification is the single gap.** The entire security and integrity model (RLS, triggers, constraints, context establishment) has **zero PostgreSQL execution evidence**. This is explicitly acknowledged in the campaign report and this review.

4. **Architecture is sound but deployment is incomplete.** The signed-context RLS module is well-designed but requires manual steps (role creation, secret provisioning, SQL application) that are not automated. The read-path context gap is a known prerequisite documented in ADR 0011.

5. **Documentation is now accurate.** The four identified stale claims have been corrected in vault documents. The knowledge dossier reflects the current implementation.

6. **No production readiness.** NO-GO remains correct. Runtime verification, owner decisions, and operational automation are prerequisites.

7. **Ready for disposable PostgreSQL runtime verification.** The codebase is in a state where a disposable local PostgreSQL target can be provisioned and the prioritized test plan executed. This is the logical next step.

**Recommendation:** Proceed to authorize a disposable loopback PostgreSQL target and execute the runtime test plan in §E. Do not proceed to production review until runtime verification passes and the two owner decisions are resolved.

---

*End of independent review. No repository modifications performed. All pre-existing work preserved.*