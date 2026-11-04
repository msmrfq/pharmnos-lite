---
title: PHARMNOS LITE — GST MODERNIZATION & FINANCIAL E2E FINAL CLOSURE REPORT
date: 2026-11-05
status: FINAL CAMPAIGN REPORT - CLOSURE NOT ACCEPTED
contentType: Spec
---

# PHARMNOS LITE — GST MODERNIZATION & FINANCIAL E2E FINAL CLOSURE REPORT

## 1. Executive decision

The owner-authorized GST Modernization and Financial E2E closure campaign is
**NOT ACCEPTED for final closure** and remains **NO-GO for production or a
controlled financial-write pilot**.

The current worktree has materially improved engineering integrity and all
current-source offline/build gates pass. The campaign does not claim:

- current-source target-bound T19 database acceptance;
- authenticated browser E2E acceptance;
- production migration, production RLS/grant, backup/restore, or recovery
  acceptance;
- professional/statutory GST confirmation; or
- production deployment authorization.

The earlier report
[`t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md`](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md)
is retained as historical evidence only. Its 25/25, T19 target-bound, and
293/293 claims are not the current closure decision.

## 2. Scope and safety boundary

This campaign covered GST calculation and treatment, purchase and sales
financial integrity, non-GST regression, authorization and tenancy controls,
artifact/provisioning safety, policy reconciliation, and independent
technical/readiness review.

No production or Live Supabase access occurred. No database or Docker mutation,
recovery deletion, cleanup, migration application, target restart, Git history
mutation, commit, push, checkout, reset, clean, stash, or branch change was
performed in this campaign.

Target-bound T19 and Sales/Purchase database execution was deliberately not
started because a fresh immutable disposable-target contract was not supplied.
The configured local environment was not treated as authorization to select a
target by port, database name, timestamp, or container convenience.

## 3. Current evidence register

| Evidence | Command or artifact | Result | Boundary |
|---|---|---:|---|
| Current JavaScript regression | `pnpm exec node --test .\tests\*.test.mjs` (274 tests) | **274/274** | Static/current-source only |
| T13 GSTIN | `pnpm test:t13:gstin` | **12/12** | Length/format scope only; no authenticity claim |
| T25 GST calculation | `pnpm test:t25:gst-calculation` | **297/297** | Offline calculator/application contracts; no statutory claim |
| Focused financial integrity contracts | Sales, purchase, immutability and related contracts | **22/22** | Static source contracts |
| Closure-hardening contracts | Artifact, transition, report/export and uniqueness contracts | **19/19** | Static source contracts |
| TypeScript | `pnpm typecheck` | **PASS** | No runtime/database proof |
| Lint | `pnpm lint` | **PASS** | No runtime/database proof |
| Production build | `pnpm build` | **PASS** | Build proof only |
| Prisma | `pnpm exec prisma validate` with local placeholders | **PASS** | No connection was attempted |
| Provisioning guard | `node scripts/financial-e2e-provisioning-static-guard.mjs` | **PASS** | No provisioning was executed |
| Artifact package | Checked-in manifest verification | **PASS** | Manifest package version `0.1.2`; review-only SQL excluded |
| Whitespace | `git diff --check` | **PASS** | Existing worktree changes preserved |
| Guarded connected runner | `pnpm financial:e2e:safe` | **BLOCKED** | Correct fail-closed behavior; no target access |
| T19 target-bound runtime | Not run | **UNVERIFIED** | Immutable target contract absent |
| Authenticated browser journeys | No committed browser harness | **UNVERIFIED** | Server-side action harnesses are not browser proof |

Generated offline evidence artifacts include:

- [`t13-gstin-verification-evidence-t13_gstin_verification_1793823713470.json`](./t13-gstin-verification-evidence-t13_gstin_verification_1793823713470.json)
- [`t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793823713453.json`](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793823713453.json)

The checked-in executable artifact manifest is
[`financial-e2e-artifact-manifest.json`](../../prisma/financial-e2e-artifact-manifest.json).
It now hashes the executable provisioning entry point and migrations `0012`
through `0016`, including the supplier-invoice uniqueness, finalized-purchase
immutability, and normalized legacy supplier-invoice uniqueness migrations.
The three `.review.sql` specifications are intentionally excluded from the
approved executable package, and package verification rejects review-only
content mislabeled as executable.

## 4. Engineering changes completed

### 4.1 Sales finalization

[`sales.actions.ts`](../../src/app/_actions/sales.actions.ts) now:

- writes canonical finalized `gst_amount` and `line_total` from the governed
  persisted tax facts;
- locks the tenant business-profile sequence row with `FOR UPDATE`;
- uses a tenant-scoped advisory-lock fallback when no profile row exists; and
- locks the customer balance row before taking the ledger running-balance
  snapshot.

The focused contracts are in
[`sales-finalization-integrity-contract.test.mjs`](../../tests/sales-finalization-integrity-contract.test.mjs).

### 4.2 Purchase finalization

[`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) now:

- locks the supplier balance row before creating the supplier-ledger snapshot;
- normalizes blank supplier invoice numbers to `NULL`;
- handles the database uniqueness race explicitly instead of relying only on
  an application precheck; and
- retains the existing GST acceptance, idempotency, tenant, rollback, and
  stock behavior.

[`0014_supplier_invoice_uniqueness`](../../prisma/migrations/0014_supplier_invoice_uniqueness/migration.sql)
adds a tenant/supplier-scoped partial unique index for nonblank supplier
invoice numbers. [`0016_supplier_invoice_trimmed_uniqueness`](../../prisma/migrations/0016_supplier_invoice_trimmed_uniqueness/migration.sql)
rebuilds the key on `btrim(supplier_invoice_no)` so legacy whitespace cannot
bypass the normalization contract. Disposable provisioning applies the
normalized index before runtime use.

The focused contracts are in
[`purchase-finalization-integrity-contract.test.mjs`](../../tests/purchase-finalization-integrity-contract.test.mjs).

### 4.3 Normal finalized-purchase immutability

[`0015_purchase_finalized_immutability`](../../prisma/migrations/0015_purchase_finalized_immutability/migration.sql)
adds the normal migration-chain trigger protection for finalized purchase
parents and items. It preserves the controlled finalization completion
transition, allows draft edits, qualifies item-parent lookups by tenant, and
rejects direct draft-to-finalized financial writes, finalized
financial/GST/accepted-snapshot mutation, and deletion. The application’s
status-only claim is allowed only when all other parent fields remain
unchanged; the completion update then requires the reviewed transition.

The disposable guard remains in
[`financial-e2e-provision-local.mjs`](../../scripts/financial-e2e-provision-local.mjs);
normal migration coverage is asserted by
[`financial-e2e-purchase-immutability-provisioning.test.mjs`](../../tests/financial-e2e-purchase-immutability-provisioning.test.mjs).
The migration has not been applied to any database in this campaign, so the
database guard remains static/unapplied evidence.

### 4.4 Post-review security and reporting hardening

The follow-up review corrections also:

- remove review-only SQL specifications from the approved executable artifact
  manifest and reject review markers during package verification;
- enforce read/export permissions for inventory, customer, supplier, purchase,
  sales, ledger, and report CSV actions;
- make the GST HSN report and export read persisted finalized line snapshots
  rather than mutable product/customer masters;
- neutralize spreadsheet formula prefixes in every CSV cell; and
- require certificate verification for every non-loopback PostgreSQL connection.

The focused regression is
[`report-export-integrity-contract.test.mjs`](../../tests/report-export-integrity-contract.test.mjs).

## 5. Requirement-to-code-to-test-to-evidence matrix

| ID | Requirement / workflow | Code and database surface | Test/evidence | Actual result | Status |
|---|---|---|---|---|---|
| T13-01 | Supplied GSTIN is exactly 15 characters on approved surfaces | `src/lib/validation/gstin.ts`, tenant/master schemas | `pnpm test:t13:gstin`, 12/12 | Current-source format behavior passes | **Accepted engineering scope** |
| T13-02 | Blank/omitted GSTIN remains optional | Tenant, onboarding, customer and supplier schemas | T13 scenarios | Optional behavior passes | **Accepted engineering scope** |
| T13-03 | Whitespace and non-string GSTIN values fail closed | Shared validator and schema boundaries | T13 scenarios | Rejection passes | **Accepted engineering scope** |
| T13-04 | Checksum, prefix status, registration status and effective dates | No current-release implementation | T13 scope decision | Explicitly deferred | **Version 2 / deferred** |
| T19-01 | Reviewed GST revision binds acceptance/correction | Purchase actions and GST revision fields | Static contracts; prior target evidence retained | Current source is guarded | **Static verified; runtime unverified** |
| T19-02 | Stale child writes roll back atomically | Purchase transaction and revision guards | Static contracts; prior evidence | No current target rerun | **Static verified; runtime unverified** |
| T19-03 | Accepted line snapshots reconcile to parent totals | Purchase finalization and accepted fields | T25 contracts and purchase contracts | Current source passes | **Static verified; runtime unverified** |
| T19-04 | Supplier ledger running balance is serialized | Supplier row `FOR UPDATE` and ledger write | Purchase integrity contract | Lock is present | **Static verified; runtime unverified** |
| T19-05 | Supplier invoice duplicates are race-safe | Migration `0014`, provisioning index, P2002 handling | Purchase integrity contract | Database constraint and conflict path present | **Static verified; runtime unverified** |
| T25-01 | Exact-decimal GST arithmetic within supported scope | GST/purchase calculators and decimal adapter | T25, 297/297 | Current-source suite passes | **Accepted engineering scope** |
| T25-02 | CGST/SGST/IGST components follow supported POS rules | GST calculator and purchase calculator | T25 scenarios | Supported scenarios pass; unsupported cases fail closed | **Accepted supported scope** |
| T25-03 | Supplier-declared/calculated/accepted facts remain distinct | Purchase GST evidence, calculation and decision models | GST contracts and T25 | Separation is represented | **Static verified; runtime unverified** |
| T25-04 | Sales finalized canonical tax facts persist | Sales action and `sales_invoice_items` | Sales integrity contract | Canonical fields are written from persisted calculation | **Static verified; runtime unverified** |
| FIN-01 | Sales sequence allocation is concurrency-safe | Business-profile row lock/advisory fallback | Sales integrity contract | Serialization is present | **Static verified; runtime unverified** |
| FIN-02 | Customer ledger snapshot uses serialized balance | Customer row lock and ledger write | Sales integrity contract | Lock precedes snapshot | **Static verified; runtime unverified** |
| FIN-03 | Finalized purchase history is immutable | Migration `0015`, disposable trigger, restricted grants | Immutability contract | Normal migration and disposable guard present | **Static verified; migration application unverified** |
| FIN-04 | Payment writes are authorized and idempotent | Payment repository, schema and migrations `0012`/`0013` | Full regression and payment contracts | Current-source contracts pass | **Static verified; runtime unverified** |
| FIN-05 | Stock adjustments preserve tenant/quantity/replay integrity | Stock action and database conditions | Stock integrity contract | Current-source contracts pass | **Static verified; runtime unverified** |
| FIN-06 | Direct draft-to-finalized purchase writes fail closed | Migration `0015`, disposable trigger | Immutability contract, 6/6 related assertions | Transition guard is present | **Static verified; migration application unverified** |
| SEC-02 | Sensitive CSV exports enforce read permissions | Export actions and permission enum | Report/export contract | Permission guards are present | **Static verified; runtime unverified** |
| SEC-03 | GST HSN reporting preserves finalized snapshot facts | HSN report/export and sales item snapshots | Report/export contract | Mutable master recalculation removed from these paths | **Static verified; runtime unverified** |
| OPS-04 | Executable artifact package excludes review-only SQL | Artifact manifest/verifier | Artifact package contract and manifest verification | Review-only markers fail closed | **Accepted safety gate** |
| SEC-01 | Tenant context and cross-tenant references fail closed | Tenant context, RLS policies, action guards | Auth/tenant contracts | Static checks pass; forged-GUC resistance remains open | **Partially accepted** |
| OPS-01 | Disposable initialization is fail-closed and artifact-bound | Initialization adapter, manifest, provisioning guard | Adapter, artifact and static-guard tests | Invalid/missing contract blocks before connection | **Accepted safety gate** |
| OPS-02 | Authenticated browser journey is exercised | No committed Playwright/Cypress harness | Repository inspection | No browser evidence exists | **Blocked** |
| OPS-03 | Production migration, backup/restore and recovery are proven | Production-shaped operational path | No authorized production run | Evidence absent | **Blocked / NO-GO** |

## 6. Findings, root causes, and dispositions

### F-01 — HIGH — Current-source T19 target-bound acceptance is unverified

- **Observed:** Current code and static contracts pass, but T19 was not rerun
  against a fresh target bound to the current source.
- **Expected:** A restricted-runtime disposable campaign must verify revision
  binding, stale-operation rollback, tenant isolation, accepted snapshots, and
  cleanup against an explicitly authorized target.
- **Root cause:** No immutable target contract was supplied for this campaign;
  selecting an existing local target by convenience would violate the
  isolation gate.
- **Impact:** T19 cannot be called current-source runtime accepted and the
  final closure decision cannot be promoted.
- **Resolution:** Supply a new target contract containing the target URL,
  database name, marker, compose project, bootstrap/runtime identities,
  lifecycle fingerprint, and run binding. Run the existing guarded suite
  without broad cleanup, then independently verify target absence or the
  authorized retention state.
- **Status:** **Open, safely blocked.**

### F-02 — HIGH — Production database controls are not demonstrated

- **Observed:** Disposable provisioning has RLS, restricted roles, grants,
  immutable-history triggers, and artifact verification, but production
  migration/grant/RLS equivalence and rollback are not proven.
- **Expected:** Production-shaped schema, privileges, migration order,
  backup/restore, rollback, and recovery evidence must be verified before a
  financial-write pilot.
- **Root cause:** The project has a guarded disposable path but no authorized
  production rehearsal or restore drill in this campaign.
- **Impact:** A passing local suite cannot establish safe production financial
  writes or recovery.
- **Resolution:** Review the executable migration chain, apply only through an
  approved staging target, capture catalog/RLS/grant evidence, perform an
  isolated backup/restore and rollback drill, and obtain an explicit rollout
  decision.
- **Status:** **Open; production NO-GO.**

### F-03 — HIGH — Forged request-claim resistance is not established for arbitrary SQL

- **Observed:** The restricted runtime role can set request-claim GUCs when
  arbitrary SQL is available.
- **Expected:** Database tenant identity should not be forgeable by an
  untrusted arbitrary-SQL caller.
- **Root cause:** The current RLS contract uses request settings as a trusted
  server-established context; PostgreSQL role permissions do not prove JWT
  authenticity.
- **Impact:** An arbitrary SQL boundary would undermine tenant isolation.
- **Resolution:** Keep the accepted Option A boundary limited to the
  server-only web path, prohibit arbitrary SQL exposure, and require a
  signed/per-request identity mechanism before broadening the threat model.
- **Status:** **Open residual security risk; not claimed fixed.**

### F-04 — HIGH — Authenticated browser E2E acceptance is absent

- **Observed:** No committed Playwright/Cypress dependency, config, or browser
  journey suite exists.
- **Expected:** GST purchase, GST sales, non-GST purchase, non-GST sales, and
  relevant rejection journeys should exercise the real authenticated UI and
  verify persisted effects.
- **Root cause:** Existing acceptance infrastructure is server-side/application
  hosted rather than browser-driven.
- **Impact:** UI wiring, session behavior, form validation, and displayed-versus-
  persisted values are not independently proven.
- **Resolution:** Select and approve an isolated browser harness, keep
  credentials/session state out of the repository, and add the six focused
  journeys without replacing server-side financial assertions.
- **Status:** **Open.**

### F-05 — MEDIUM — Decimal precision boundary remains mixed

- **Observed:** Core decimal adapter and GST tests pass, but some validation and
  action paths still convert input through JavaScript `Number`.
- **Expected:** Precision claims must be limited to paths that preserve decimal
  values until the governed rounding boundary.
- **Root cause:** Legacy form/action boundaries use numeric values for compatibility
  with existing Prisma and UI contracts.
- **Impact:** Very large or high-precision inputs outside the supported monetary
  scale could lose information before validation/calculation.
- **Resolution:** Keep current claims scoped to supported decimal columns and
  add a follow-up boundary audit replacing unsafe conversions where required.
- **Status:** **Open limitation; no universal precision claim.**

### F-06 — MEDIUM — Historical reporting/export snapshot fidelity is incomplete

- **Observed:** GST HSN report/export paths now read finalized snapshots; other
  report/export paths still need a full inventory and review.
- **Expected:** Finalized GST and identity facts should be read from immutable
  persisted values.
- **Root cause:** Reporting paths predate the complete snapshot contract.
- **Impact:** Historical displays and exports could diverge from finalized
  invoices after master-data changes.
- **Resolution:** The GST HSN paths were corrected and covered by
  `report-export-integrity-contract.test.mjs`. Complete the remaining
  report/export inventory before release.
- **Status:** **Partially resolved; broader inventory remains open.**

### F-07 — MEDIUM — Page/action permission coverage is incomplete

- **Observed:** All CSV export actions and the GST HSN report now enforce the
  relevant read permission; a complete route/read-surface inventory is still
  outstanding.
- **Expected:** Every sensitive page and action should enforce authorization
  server-side and fail closed.
- **Root cause:** Authorization was hardened incrementally around financial
  writes, while read/export surfaces retain older patterns.
- **Impact:** Unauthorized users may reach views or exports outside intended
  role scope.
- **Resolution:** Added permission guards to all CSV actions and the GST HSN
  report, with static coverage. Complete the remaining page/read-surface
  inventory and negative runtime tests before any pilot.
- **Status:** **Partially resolved; broader inventory remains open.**

### F-08 — MEDIUM — Non-loopback TLS verification is disabled

- **Observed:** The connection path previously disabled certificate
  verification for non-loopback connections; current source now requires
  `rejectUnauthorized: true`.
- **Expected:** Production connections must verify server identity.
- **Root cause:** Local Supabase/pooler troubleshooting compatibility was allowed
  to remain in a shared connection path.
- **Impact:** A production connection could be exposed to interception.
- **Resolution:** Strict verification is enabled in the shared PostgreSQL
  pool. Non-loopback CA/runtime verification remains unrun.
- **Status:** **Source fix verified; production runtime evidence open.**

### F-09 — MEDIUM — Inventory valuation and ITC remain pending

- **Observed:** Purchase stock movements record valuation as `PENDING`; ITC
  eligibility/recoverability is not inferred from GST amount.
- **Expected:** Unsupported accounting cases must remain explicit and auditable.
- **Root cause:** Owner-approved policy requires governed eligibility and
  recoverability before acquisition cost is finalized.
- **Impact:** Procurement rate cannot be represented as approved inventory cost or
  recoverable ITC.
- **Resolution:** Implement the governed valuation/ITC lifecycle only after its
  policy inputs and evidence contract are approved.
- **Status:** **Open by policy; fail-closed behavior retained.**

### F-10 — LOW — Operational observability and recovery evidence are incomplete

- **Observed:** Financial errors and recovery workflows do not yet provide a
  complete production-grade incident and reconciliation trail.
- **Expected:** Operators need durable correlation, failure visibility,
  reconciliation, and recovery evidence.
- **Root cause:** Current work prioritized transactional correctness and
  disposable safety gates.
- **Impact:** Diagnosis and controlled recovery would be slower and less
  independently verifiable.
- **Resolution:** Define structured financial operation events, monitoring,
  alerting, reconciliation, and recovery runbooks before rollout.
- **Status:** **Open.**

### F-11 — HIGH — Database finalization trigger transition bypass

- **Observed:** The first trigger version inspected only `OLD.status =
  FINALIZED`, allowing a direct draft-to-finalized update to bypass the
  controlled transition checks.
- **Expected:** A direct financial finalization write must fail closed; only the
  application’s unchanged status claim followed by controlled completion may
  pass.
- **Root cause:** The guard modeled post-finalization immutability but did not
  explicitly guard the pre-finalization status transition.
- **Impact:** An unrestricted database writer could mark a draft finalized
  while changing financial values.
- **Resolution:** Migration `0015` and disposable provisioning now require an
  unchanged status-only claim when `finalized_at` is null and reject every
  other draft-to-finalized update. The contract test covers both copies.
- **Status:** **Resolved in current source; database application/runtime
  evidence remains open.**

### F-12 — MEDIUM — Legacy supplier-invoice whitespace uniqueness

- **Observed:** New writes normalize supplier invoice numbers, but the
  original unique index compared stored whitespace literally.
- **Expected:** Legacy `" ABC "` and new `"ABC"` must collide within the same
  tenant/supplier scope.
- **Root cause:** Application normalization was not represented in the existing
  index expression.
- **Resolution:** Migration `0016` drops and rebuilds the key on
  `btrim(supplier_invoice_no)`; disposable provisioning uses the same
  expression. Existing conflicting data will fail the migration closed for
  operator review.
- **Status:** **Resolved in current source; migration/runtime evidence open.**

### F-13 — HIGH — Review-only SQL package classification

- **Observed:** Three review-only SQL specifications were previously labeled
  executable in the checked-in artifact manifest.
- **Expected:** Review specifications must never be treated as an approved
  executable package.
- **Root cause:** Manifest membership and artifact classification drifted apart.
- **Resolution:** The approved manifest is now version `0.1.2`, excludes the
  three `.review.sql` files, and the verifier rejects review-only markers on
  executable content.
- **Status:** **Resolved in current source; connected initialization remains
  blocked by the target contract.**

## 7. Accounting and GST policy boundary

Owner-approved product-policy directions remain in force, but they are not
professional or statutory certification:

- non-zero cess fails closed until governed support exists;
- inclusive-tax purchases remain restricted to the supported exclusive path;
- freight is not automatically allocated invoice-wide;
- discounts are preserved only where explicitly supplied at line level;
- rounding behavior is tested as product arithmetic, not presented as statutory
  confirmation;
- discrepancy acceptance requires immutable evidence, revision binding, and
  an explicit decision;
- ITC eligibility/recoverability and inventory acquisition cost remain
  `PENDING`; and
- imports/exports, SEZ/deemed exports, UIN, RCM, e-invoicing/e-way bills,
  GST-return filing, ITC reconciliation, credit/debit notes, exceptional
  workflows, and multiple GST registrations remain Version 2 or unsupported.

## 8. Closure gates

| Gate | Decision |
|---|---|
| Current-source engineering regression | **PASS** |
| T13 supported offline scope | **PASS** |
| T25 supported offline scope | **PASS** |
| T19 current-source target-bound runtime | **OPEN / NOT VERIFIED** |
| Authenticated browser E2E | **OPEN / NOT VERIFIED** |
| Independent technical acceptance | **NOT ACCEPTED — separate reviewer** |
| Production readiness | **NO-GO — separate reviewer** |
| Production/Live Supabase access | **NO-GO** |
| Deployment or financial-write pilot | **NO-GO** |
| GST Stage 1 complete | **NO-GO** |

## 9. Required next actions

1. Obtain and validate a fresh immutable disposable-target contract.
2. Run current-source T19 and the permitted Sales/Purchase target-bound
   campaigns under restricted runtime credentials only.
3. Have the separate technical-acceptance reviewer inspect the resulting
   source hashes and database evidence.
4. Establish the authenticated browser E2E harness and execute isolated
   purchase, sales, non-GST, authorization, and tenant-isolation journeys.
5. Complete the remaining report/export route inventory, permission negatives,
   decimal-boundary audit, and observability work; preserve the fixes already
   made for GST HSN reporting, CSV exports, TLS, and artifact classification.
6. Conduct a staging-only migration, backup/restore, rollback, and recovery
   rehearsal before any production decision.
