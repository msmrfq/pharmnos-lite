---
title: GST Modernization Implementation Tracker
date: 2026-10-31
status: ENGINEERING CLOSED - EXTERNAL CONFIRMATION PENDING
---

# GST Modernization Implementation Tracker

This tracker records the current engineering implementation state. It does
not replace the active master specification, professional review, independent
security acceptance, migration authorization, or production approval.

## Final closure status — 2026-11-04 22-46-36 IST

The final consolidated campaign is the current status for the source tree.
The historical runtime section immediately below remains evidence for its own
source snapshot.

- DGM-T13: the shared exactly-15-character GSTIN contract is used across
  business-profile, onboarding, customer, and supplier validation. The
  current-source offline suite passed **12/12**. **Engineering Closed.**
- DGM-T19: acceptance fails closed when any current purchase line lacks
  complete GST evidence, and every current line receives an immutable
  accepted snapshot in the guarded transaction. The current-source
  target-bound suite passed **16/16** on the guarded disposable target;
  source hashes match and cleanup is verified absent. **Engineering Closed.**
- DGM-T25: invalid or negative optional monetary values surface validation
  errors, purchase/sales discount percentages are bounded to 0 through 100,
  and the current-source offline suite passed **293/293**. The T19 target
  exercised purchase application behavior, and a separate guarded disposable
  target passed current-source Sales application/persistence read-back.
  **Engineering Closed.**
- Full JavaScript regression, typecheck, lint, syntax, safe-placeholder
  Prisma validation, and `git diff --check` passed in the final gate set.

Current evidence:

- [T13 evidence](./t13-gstin-verification-evidence-t13_gstin_final_20261104_2300.json),
  artifact SHA-256 `19B6A31559E2FFABF621FCE6ED5BF69E1F9063DC11371F2458F02D4D6B203FEC`.
- [T19 evidence](./purchase-gst-application-evidence-t13_t19_t25_final_20261104_2236.json),
  artifact SHA-256 `4B59D3ACADD46103691DFA4CABE0E3DC5E37280F6635F39165C85FFC654DF2BD`.
- [T25 calculation evidence](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793814889348.json),
  artifact SHA-256 `03D81B46F296FF87A5A32744D4F828D3FA186FC3B6185D26B79D5E04FC816117`,
  293/293 offline.
- [T25 Sales runtime evidence](./t25-sales-runtime-t25_sales_1793814909158_be9f4d-suite.json),
  artifact SHA-256 `E4D1E4833EBFCCD762DE4D4B9BBA2D150A861914AA1F23EADF0701FFDDCFC094`,
  application/persistence read-back and cleanup verified.
- [Final closure report](./t13-t19-t25-final-closure-report-2026-11-04T22-46-36.md).

The equal-count matrix is **25/25 evidence-supported criteria (100%)**.
Independent technical acceptance, professional/statutory confirmation, and
production authorization remain separate and unclaimed. No additional
T13/T19/T25 implementation campaign is planned in this execution.

## Final T13 + T19 + T25 runtime campaign — 2026-11-04 21-20-00 IST

The exact immutable disposable target was authorized and validated through the
guarded lifecycle. The historical T19 run executed against
`127.0.0.1:55500/pharmnos_financial_e2e_t13t19t25_20261104d` under the
restricted runtime role and passed all 16 target-bound scenarios with zero
failures. The target was disposed through `DISPOSABLE_TARGET_DISPOSAL`, and
the exact containers, networks, and port were verified absent afterward.

- DGM-T13: independent offline suite passed 5/5; target-bound database
  execution was not run and independent technical acceptance is not claimed.
- DGM-T19: independent target-bound suite passed 16/16 with zero failures;
  evidence recording succeeded; business verdict remains `PARTIALLY_ACCEPTED`
  because owner-approved policy directions still have implementation gates,
  unresolved threshold or statutory details, and professional-confirmation
  dependencies as applicable.
- DGM-T25: independent offline suite passed 289/289; target-bound database
  execution was not run and independent technical acceptance is not claimed.
- Initialization verified 33 RLS tables, 84 policies, 16 triggers, 123
  constraints, and zero runtime DELETE privileges.
- Final gates passed: all 37 JavaScript test files 241/241, typecheck,
  full lint, changed-file syntax checks, safe-placeholder Prisma validation,
  and `git diff --check`.

The master matrix remains **22/25 evidence-supported criteria (88%)**. The
historical result remains useful for its recorded source snapshot, but the
current implementation hardening changed the T19 source after that run.
Current-source T19 runtime verification, complete business acceptance,
independent technical acceptance, and professional statutory/tax confirmation
remain open. The historical campaign report and evidence hashes are in
[`t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md`](./t13-t19-t25-runtime-verification-campaign-2026-11-04T21-20-00.md).

## T13 + T19 + T25 current-release campaign — 2026-11-04 18-12-40 IST

The consolidated campaign reran all non-mutating repository and contract
gates. The exact immutable disposable-target contract was still absent:
`FINANCIAL_E2E_TARGET_CONTRACT` was unset, `.env.financial-e2e` only contained
the generic local configuration for `127.0.0.1:55432/pharmnos_financial_e2e`,
and no current contract artifact supplied the required identity, Compose
binding, schema fingerprint, authorization, and expiry. The preprovisioned
preflight failed closed with
`FINANCIAL_E2E_TARGET_CONTRACT is required`; the retained `55460` target was
not selected or connected.

- DGM-T13: implemented and static/test verified for current-release
  15-character length-only validation; target-bound runtime blocked and
  independent acceptance remains insufficient.
- DGM-T19: implemented and static/test verified for reviewed record version,
  evidence revision ID, calculation ID, guarded correction rollback, and
  existing authorization/reconciliation/reset/finalization safeguards;
  targeted runtime and independent acceptance remain blocked.
- DGM-T25: implemented and static/test verified for the approved demonstrated
  exact-decimal paths, independent components, supplier-value preservation,
  totals, commercial round-off separation, and conversion boundaries;
  target-bound runtime and independent acceptance remain blocked. Statutory
  boundaries still require qualified professional confirmation.
- `pnpm test:gst:calculator`: 294/294 passed.
- `pnpm exec node --test .\tests\gst-*.test.mjs`: 37/37 passed.
- `pnpm exec node --test .\tests\financial-e2e-target-contract.test.mjs .\tests\purchase-gst-revision-safety-contract.test.mjs`: 8/8 passed.
- `pnpm exec node --test .\tests\*.test.mjs`: 232/232 passed.
- `pnpm typecheck`, `pnpm lint`, safe-placeholder Prisma validation,
  relevant `node --check` commands, and `git diff --check`: passed.

The master matrix remains **22/25 evidence-supported criteria (88%)**, with
the three current-scope runtime/independent-acceptance criteria still
`NOT VERIFIED`, no verified failures, and Version 2 deferrals unchanged.
Full command output and the per-ticket acceptance matrix are recorded in
[`t13-t19-t25-runtime-verification-campaign-2026-11-04T18-12-40.md`](./t13-t19-t25-runtime-verification-campaign-2026-11-04T18-12-40.md) and
[`t13-t19-t25-runtime-verification-evidence-2026-11-04T18-12-40.json`](./t13-t19-t25-runtime-verification-evidence-2026-11-04T18-12-40.json).

## Q17 obsolete GST-note target cleanup — 2026-11-04 08-08-22 IST

The six local Q17 PostgreSQL targets previously observed on ports 55461–55466
were individually correlated with the rollback-era GST credit/debit-note
campaign evidence in commit `2506510`. Read-only catalog checks found the
GST-note schema and populated test fixtures in every target; the tenant and
user IDs were campaign-scoped, there were no non-probe database sessions, and
the targets had no bind mounts or named volumes. Current scripts, tests,
source, Prisma files, and configuration contained no exact target references.

The exact six containers and their six one-container Compose networks were
removed after the user-authorized cleanup decision. The retained operator-owned
GST-note target on port 55460 was not touched. All six candidate ports and
resource IDs are now absent, and the pre-existing Git status was byte-for-byte
unchanged by the Docker cleanup. The intentional documentation changes for
this result are listed in the daily log. Full evidence and per-target
identities are recorded in
[`q17-obsolete-target-cleanup-2026-11-04.md`](./q17-obsolete-target-cleanup-2026-11-04.md).

This cleanup changes no T13, T19, or T25 scope decision and does not claim
GST credit/debit-note support in the current release.

## Consolidated current-release verification campaign — 2026-11-04 07-50-04 IST

The campaign completed its safe repository baseline and regression gates, but
target-bound runtime verification could not start. The immutable disposable
target contract was not supplied; the required preflight failed closed with
`FINANCIAL_E2E_TARGET_CONTRACT is required`. Read-only process inspection found
six disposable Q17 targets on ports 55461–55466, so no target was selected by
similarity. No database connection, migration, provisioning, fixture write,
cleanup, container lifecycle operation, or acceptance rerun was performed.

- DGM-T13, DGM-T19, and DGM-T25 runtime verification: **BLOCKED** by the
  missing exact target contract.
- DGM-T13, DGM-T19, and DGM-T25 independent acceptance: **INSUFFICIENT
  EVIDENCE**; implementation and automated tests do not substitute for
  target-bound runtime evidence or independent review.
- `pnpm test:gst:calculator`: **294/294 passed**.
- `pnpm exec node --test .\tests\gst-*.test.mjs`: **37/37 passed**.
- `pnpm exec node --test .\tests\financial-e2e-target-contract.test.mjs .\tests\purchase-gst-revision-safety-contract.test.mjs`: **8/8 passed**.
- `pnpm exec node --test .\tests\*.test.mjs`: **232/232 passed**.
- `pnpm typecheck`, safe-placeholder Prisma validation, changed-file ESLint,
  changed-file JavaScript syntax checks, and `git diff --check`: **passed**.
- No demonstrated source defect was identified in the approved current-release
  scope, so no application code was changed. The reconciled evidence remains
  **22/25 evidence-supported criteria**, with DGM-T13, DGM-T19, and DGM-T25
  not verified for target-bound runtime and independent acceptance.

## GST calculation, treatment, and T25 engineering campaign — 2026-11-02 15-45-12 IST

This section supersedes the earlier blocked application-path attempt below for
the current acceptance status.

- The reconciled matrix remains **22/25 evidence-supported criteria (88%)**:
  16 current-campaign passes, 6 historical passes, and 3 current-scope
  criteria (`DGM-T13`, `DGM-T19`, and `DGM-T25`) remain `NOT VERIFIED` for
  target-bound runtime and independent acceptance. There are 0 verified
  failures and 0 owner-approval blockers. The final decision remains
  **NOT ACCEPTED**.
- The T25 engineering contract is implemented in
  `src/lib/decimal.ts`, the sales and purchase calculators, the relevant
  server/form calculation boundaries, and focused calculator tests. The
  repository-supported `pnpm test:gst:calculator` runner passed **294/294**
  assertions; `pnpm typecheck` passed.
- DGM-T13 is `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`: current
  release validation remains exactly 15 supplied GSTIN characters, with
  checksum, state-prefix, registration-status, and effective-date checks
  deferred to Version 2. DGM-T19 was previously recorded as `CURRENT RELEASE
  SCOPE APPROVED — VERSION 2 DEFERRED`; the owner-directed resolution now
  implements the reviewed-revision guard in the current engineering path.
  Acceptance, discrepancy resolution, and correction are bound to the current
  record version, evidence revision, and calculation ID, with guarded
  correction rollback. Focused source evidence is present, while runtime
  verification and independent acceptance remain separate. Scope approval and
  source implementation are not counted as runtime or independent acceptance.
- Focused implementation evidence also covers HALF_UP midpoint behavior,
  no-premature-rounding arithmetic, mixed rates, independent GST components,
  inclusive Rule 35 extraction as an isolated helper, Section 170 helper
  isolation, commercial round-off separation, supplier-value preservation, and
  T13 length-only validation, plus the distinct JavaScript-number conversion
  boundaries. No credit/debit-note or e-invoice calculation implementation is
  claimed; those capabilities are owner-approved Version 2 deferrals and
  remain `Not implemented / no supported workflow`, not verified passes.
- The prior authorized target was
  `127.0.0.1:55435/pharmnos_financial_e2e_0419`, marker
  `pharmnos-financial-e2e`, Compose project
  `pharmnoslite-financial-e2e-0419`. Its restricted-runtime evidence and
  `OWNED_RESOURCES=87` qualification and runtime role
  `LOGIN`/`NOSUPERUSER`/`NOBYPASSRLS` remain historical; immutable history was
  retained and cleanup was deferred. No new database or runtime campaign was
  performed for the T25 documentation/engineering update.
- One interim harness attempt failed because it assumed two concurrent
  acceptance calls would necessarily produce one optimistic-version loser;
  both calls can serialize and read the current revision. The assertion was
  removed; the final run passed the deterministic finalization stale-operation
  race and no criterion was promoted from the failed attempt.
- Cleanup was deliberately deferred because immutable GST financial-history
  rows made row-level deletion unsafe. No recovery deletion or database
  disposal was performed; immutable history remains preserved.
- The supported TypeScript runner closes the prior tooling reproducibility gap
  without adding a dependency. The E2E changes are harness-only; no schema,
  migration, RLS policy, permission, rate, or deferred treatment was enabled.
- The detailed T25 matrix is owner-approved for the current engineering scope
  in `decisions/0009-gst-precision-rounding-engineering-contract.md`; e-invoice
  output and credit/debit-note workflows remain Version 2 deferrals. Section
  170 aggregation and other statutory interpretations remain subject to
  qualified professional confirmation. T13/T19/T25 runtime and independent
  acceptance remain open. GST Stage 1 remains **IN PROGRESS** and
  Production/Live Supabase remains **NO-GO**.
- The final T25 integration audit found no demonstrated defect requiring source
  changes: the inclusive Rule 35 helper remains intentionally isolated, the
  supported invoice boundary remains two-decimal, JavaScript-number conversion
  limits are documented without a universal losslessness claim, and
  credit/debit-note and e-invoice surfaces have no supported workflow in the
  current release.

## DGM-T19 revision-safety resolution — 2026-11-04

- `PurchaseGstRevisionGuardSchema` now requires the reviewed GST record version,
  evidence revision ID, and calculation ID for acceptance, discrepancy
  resolution, and correction.
- Acceptance and resolution reject stale or already-decided revisions before
  recording accounting decisions. Correction writes the new evidence tree
  inside the transaction and uses an optimistic guarded parent update, so a
  stale correction rolls back its child writes.
- The purchase action UI and the restricted-runtime harness now submit the
  reviewed revision tokens.
- Focused T19 contract coverage passed `2/2`, `pnpm typecheck` passed,
  `pnpm test:gst:calculator` passed `294/294`, changed-file ESLint passed, and
  `git diff --check` passed.
- No disposable database campaign was run for this source-level resolution.
  DGM-T19 runtime verification and independent acceptance remain `NOT
  VERIFIED`; the 25-criterion completion count remains `22/25`.

## Sales GST application-path acceptance attempt — 2026-11-01 16-53-48 IST

- Static Sales GST governance, transaction-boundary, finalized-immutability,
  and server-authoritative rule-resolution contracts passed **9/9**.
- Repository TypeScript validation and ESLint passed. ESLint reported only the
  pre-existing React hook warning in
  `src/app/inventory/products/new/page.tsx`.
- The authenticated application-path harness did not execute. It stopped
  before fixture mutation because `FINANCIAL_E2E_TARGET_CONTRACT` was absent.
- The configured `127.0.0.1:55432/pharmnos_financial_e2e` target authenticated
  as `pharmnos_e2e` with `rolsuper = true` and `rolbypassrls = true`, so it is
  not an acceptable restricted-runtime target.
- The initialized `127.0.0.1:55435/pharmnos_financial_e2e_0419` target could
  not authenticate with the configured bootstrap credential. No credential,
  container, process, schema, or database state was changed.
- Sales GST application-path acceptance remains **NOT VERIFIED / BLOCKED BY
  DISPOSABLE TARGET AUTHENTICATION AND TARGET-CONTRACT AVAILABILITY**. No
  runtime financial, RLS, concurrency, rollback, retry, or historical
  snapshot acceptance claim is made from this attempt.

## Owner-approved GST accounting policy decisions — 2026-11-01 14-55-50 IST

The owner approved six policy directions effective `2026-11-01`:

- Inventory GST valuation: recoverable GST is separate ITC; non-recoverable GST
  may enter inventory cost; unresolved eligibility blocks authoritative
  valuation. ADR: `decisions/0003-inventory-gst-valuation-policy.md`.
- Cess: separate governed component with effective rule, source, and credit
  treatment; unsupported non-zero cess blocks. ADR:
  `decisions/0004-cess-governance-policy.md`.
- Inclusive pricing: explicit inclusive/exclusive basis, governed Rule 35
  extraction, preserved supplier amount, and transparent residual rounding.
  ADR: `decisions/0005-inclusive-purchase-pricing-policy.md`.
- Freight and discounts: GST valuation remains separate from inventory-cost
  allocation; unsupported allocation blocks and finalized invoices are not
  rewritten. ADR: `decisions/0006-freight-discount-allocation-policy.md`.
- Precision and rounding: preserve intermediate precision, line components,
  explicit precedence, and separate invoice adjustments. ADR:
  `decisions/0007-gst-rounding-precision-policy.md`.
- Discrepancy tolerance: only arithmetic differences may enter reconciliation;
  classification, POS, rate, treatment, eligibility, or missing-fact
  differences block automatic acceptance. ADR:
  `decisions/0008-purchase-gst-discrepancy-tolerance-policy.md`.

Approval record: `Masum Rafique - Owner`, `2026-11-01T14:55:50+05:30`.
This is owner/product authorization and is not represented as professional or
legal advice. Engineering must implement only the explicit requirements;
unsupported or unresolved exceptional cases remain fail-closed.

## Inventory valuation persistence — 2026-11-01 15-48-42 IST

- Added `inventory_valuation_decisions` as an append-only, tenant-scoped
  record of accepted GST split, eligibility state, acquisition-cost result,
  policy version, decision reference, actor, idempotency key, and payload hash.
- Added `inventory_valuation_adjustments` as an append-only correction or
  reversal record with prior/resulting decision links and exact deltas.
- Added composite tenant-aware foreign keys to purchase invoices, purchase
  lines, product batches, stock movements, and memberships. Current valuation
  columns remain projections and do not replace historical evidence.
- Added restricted actions that use tenant context, advisory locking, the
  shared fail-closed resolver, payload-hash idempotency, atomic projection
  updates, and audit metadata. Prior decisions are never rewritten.
- Accounting status is explicitly `PENDING_POLICY`; no tax-asset or inventory
  journal entry is posted because account codes, direction, and balancing
  treatment remain unspecified.
- Prisma validation, client generation, typecheck, eight focused valuation
  tests, changed-file lint, and the provisioning static guard passed.
- Restricted-role runtime verification of the new actions remains outstanding
  and must use a fresh authorized disposable target.

## Policy implementation status — 2026-11-01 15-00-00 IST

- **Inventory valuation:** policy recorded; authoritative recoverability and
  inventory-cost fields are not yet persisted. Unresolved valuation remains
  blocked and is not inferred from `purchase_rate`.
- **Cess:** non-zero declared or accepted cess is now blocked until a governed
  cess rule and credit-utilization policy exist. Zero-cess flows remain
  supported.
- **Inclusive pricing:** inclusive purchase creation is now blocked until
  governed Rule 35 extraction and rounding are implemented. Exclusive pricing
  remains unchanged.
- **Freight and discounts:** no unsupported freight or invoice-wide allocation
  path was added. Existing explicitly line-allocated discounts remain
  supported; unsupported allocation remains outside the accepted path.
- **Precision and rounding:** existing rounding behavior is preserved pending
  a versioned statutory precedence implementation; no historical values were
  rewritten.
- **Discrepancy tolerance:** existing reconciliation continues to preserve
  declared/calculated values and requires an attributable resolution for
  discrepancies; no silent tolerance acceptance was introduced.

Focused policy contract tests were added in
`tests/gst-accounting-policy-contract.test.mjs`. TypeScript typecheck and
changed-file lint passed. The standalone TypeScript test runner remains
unavailable because `tsx` is not installed.

Evidence artifact:
`specs/gst-accounting-policy-evidence-2026-11-01.json`, SHA-256
`5C167708A0C8067A8BD21945A9F5E41E1E0DA4C412C5F1487968027C2E77BA79`.

## Purchase GST Financial Integrity completion audit — 2026-11-01 15-06-27 IST

- The six owner-approved policies were traced against current readers,
  writers, schema, migrations, reports, exports, purchase finalization, and
  runtime evidence.
- Accepted-value financial posting remains runtime-verified from
  `purchase_gst_1793524087997_be4146`: 16/16, zero failures, restricted role
  `LOGIN`/`NOSUPERUSER`/`NOBYPASSRLS`, cleanup verified, and payload hash
  equality passed. Persisted canonical line total `218.34`, canonical GST
  `27.26`, invoice net `218.34`, supplier ledger credit `218.34`, and audit
  net `218.34`.
- Added additive pending inventory valuation fields to purchase items, batches,
  and stock movements. Without a governed ITC eligibility decision, new
  inventory acquisition cost remains `NULL`, valuation status is `PENDING`,
  recoverability values remain `NULL`, and stock valuation/report export no
  longer treats procurement `purchase_rate` as approved inventory cost.
- Existing safe gates remain enforced: inclusive purchase creation and
  unsupported non-zero cess are blocked. No Rule 35 extraction, freight
  allocation, post-supply discount, or statutory rounding precedence was
  invented.
- Focused contracts passed **9/9**, typecheck, Prisma generate, changed-file
  ESLint, and `git diff --check` passed. Prisma validate passed with the
  authorized disposable URL fallback; the default environment lacks
  `DIRECT_URL`.
- Completion audit:
  `bugs/purchase-gst-financial-integrity-completion-audit-2026-11-01.md`.
- Machine evidence:
  `specs/purchase-gst-financial-integrity-completion-evidence-2026-11-01.json`.
  SHA-256:
  `BD56525132F853AE843FECF8853A344220DFD9AC3DB56810C95B064F54944530`.
- Status: **PARTIALLY ACCEPTED / BLOCKED BY POLICY DETAIL**. GST Stage 1
  remains **IN PROGRESS** and Production/Live Supabase remains **NO-GO**.

## Independent authenticated identity security audit — 2026-11-01 13-20-37 IST

- The independent audit found that `pharmnos_e2e_runtime` can execute
  `pg_catalog.set_config`, so database GUC claims cannot be treated as
  cryptographically authenticated when arbitrary SQL runs under the same
  runtime role. This remains a **HIGH architecture blocker** requiring a
  trusted authentication-to-database boundary; no RLS weakening was applied.
- The prior `SECURITY DEFINER public.authenticated_subject_user_id()` helper
  was removed from the provisioning authorization path. Subject-scoped
  policies now use schema-qualified joins through `users.external_id` under
  ordinary RLS, avoiding helper ownership, `PUBLIC` execution, search-path,
  and forced-RLS bypass risks.
- Fresh restricted-role run `purchase_gst_1793519733253_d9cf5c` passed
  **16/16** scenarios with distinct internal/external IDs, inactive-membership
  denial, cross-tenant rejection, accepted GST posting, idempotency,
  concurrency, rollback, retry, and pooled transaction-local claim isolation.
- Runtime role: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`. Bootstrap remained
  fixture/assertion-only. The run-owned database was dropped and independently
  verified absent.
- Evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793519733253_d9cf5c.json`
  SHA-256
  `D494EC8553F4D9A92DB7193BFE12EE2DE9F2DCCC373F4181A8ACB6BDAF80B8AA`.
- Static guard, focused authentication/safety tests, typecheck, and
  `git diff --check` passed. GST Stage 1 remains open.

## Trusted authentication-to-database boundary — 2026-11-01 13-27-49 IST

- Architecture tracing confirms Supabase session verification is server-side,
  membership resolution is server-side, and Prisma uses a pooled PostgreSQL
  runtime role. The runtime role can nevertheless execute
  `pg_catalog.set_config`, so transaction-local GUCs are isolated but not
  intrinsically authenticated.
- No unsafe workaround was introduced. The prior SECURITY DEFINER helper
  remains removed, and RLS/role attributes were not weakened.
- Options and threat model are documented in
  `.obsidian-vault/specs/authenticated-database-trust-boundary-2026-11-01.md`.
- Recommended minimum is a server-only database boundary with no
  client-visible runtime credentials or arbitrary SQL endpoint. If arbitrary
  SQL under the runtime role is inside the threat model, an owner-approved
  signed assertion, per-request identity boundary, or direct Supabase
  authenticated RLS path is required.
- Status: **BLOCKED — HIGH TRUST-BOUNDARY FINDING REMAINS OPEN**. GST Stage 1
  remains in progress.

## Restricted-role trust-boundary audit evidence — 2026-11-01 13-29-21 IST

- The audit harness was corrected to require
  `FINANCIAL_E2E_RUNTIME_DATABASE_URL`; the earlier bootstrap-role artifact was
  not used as security evidence.
- Fresh runtime evidence confirms the actual restricted role is
  `pharmnos_e2e_runtime` with `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, no public
  schema `CREATE`, and no `public.authenticated_subject_user_id()` helper.
- The restricted role can still execute `pg_catalog.set_config` and set
  transaction-local subject and tenant claims to forged values. This
  reproduces the HIGH trust-boundary blocker; it does not weaken RLS or prove
  an application-path impersonation.
- Evidence:
  `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json`
  SHA-256
  `FE25C097F16E1A95C4C615E4077339A4FD35075CB61ECA5512FD16724B2262C6`.
- The audit transaction rolled back without creating persistent rows. Static
  provisioning guard, typecheck, and `git diff --check` passed. GST Stage 1
  remains open pending an owner-approved trusted authentication-to-database
  boundary.

## Authenticated database trust-boundary ADR — 2026-11-01 14-03-10 IST

- The architecture decision record
  `.obsidian-vault/decisions/authenticated-database-trust-boundary-ADR-2026-11-01.md`
  adopts **Option A — Trusted server-side identity establishment** for the
  intended web threat model.
- The decision explicitly requires server-only database credentials, no
  arbitrary SQL endpoint, server-side Supabase session verification,
  server-side membership resolution, transaction-local claim setup, and
  forced fail-closed RLS. It does not claim cryptographic forged-GUC
  resistance against a principal that already has arbitrary SQL under the
  runtime role.
- Options B (signed assertions), C (stronger role/gateway separation), and the
  authenticated Supabase Data API path remain alternatives only if the owner
  expands the threat model to include arbitrary SQL under the shared runtime
  role. No new authentication mechanism or database role was implemented.
- Status: **DECISION RECORDED; SECURITY ACCEPTANCE AND GST STAGE 1 REMAIN
  OPEN**. Production and Live Supabase remain NO-GO.

## Authenticated database trust-boundary verification — 2026-11-01 14-13-13 IST

- Verified the accepted Option A request path: server-side Supabase session,
  `users.external_id` lookup, exactly one active membership, transaction-local
  claims, Prisma pooled transactions, and tenant-scoped forced RLS.
- Added a focused regression for ambiguous active memberships and corrected the
  financial E2E auth-context adapter to reject more than one active membership.
- `src/app/api/health/db/route.ts` is a fixed `SELECT 1` health probe requiring
  `DB_HEALTHCHECK_TOKEN`; no arbitrary SQL API route was found. No unsafe raw
  SQL helpers were found under `src/`.
- Focused trust-boundary/RLS tests passed **41/41**; TypeScript typecheck and
  `git diff --check` passed.
- Existing runtime evidence remains:
  `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-1793519941211.json`,
  SHA-256
  `FE25C097F16E1A95C4C615E4077339A4FD35075CB61ECA5512FD16724B2262C6`.
- Verification supports Option A only for the scoped server-only web threat
  model. The HIGH forged-GUC residual risk remains and is eligible for
  independent security review, not closure. GST Stage 1 remains in progress.

## Trust-boundary security remediation — 2026-11-01 14-18-05 IST

- The HIGH forged-GUC finding is **NOT FIXED**. The current shared Prisma
  runtime role can set the same GUCs consumed by RLS; fixing this requires a
  new signed-assertion, trusted gateway/role, or authenticated Supabase Data
  API boundary with owner-approved key/credential operations. No unsafe helper
  workaround or unapproved cryptographic design was introduced.
- Session identity handling is **PARTIALLY FIXED**: `supabase-auth.adapter.ts`
  now requires successful server-side `getUser()` verification and matching
  session/user IDs. Live expired, malformed, tampered, and revoked-session
  tests remain **NOT VERIFIED**.
- The undeclared `u` alias was **FIXED** in the review-only RLS contract. The
  disposable provisioner already had the explicit join; the artifact manifest
  now records the corrected review-contract hash.
- Focused authentication/RLS tests passed **43/43**; TypeScript typecheck and
  provisioning static guard passed. GST Stage 1 remains IN PROGRESS.

## Production-shaped authenticated identity correction — 2026-11-01 13-14-09 IST

- The independent audit's HIGH finding was corrected in the disposable RLS
  provisioner. Subject-scoped membership, role, and permission policies now
  resolve `request.jwt.claim.sub` through `users.external_id` to the internal
  `users.id`; only active memberships qualify.
- Direct policy subqueries initially caused PostgreSQL forced-RLS recursion.
  The historical helper-based attempt was superseded by ordinary-RLS,
  schema-qualified joins recorded in the later security audit.
- Fresh run `purchase_gst_1793519228586_c4e0ac` passed **16/16** scenarios,
  including distinct internal/external IDs, inactive-membership denial,
  cross-tenant rejection, accepted GST posting, idempotency, concurrency,
  rollback, retry, and transaction-local claim isolation across independent
  connections.
- Runtime role evidence: `pharmnos_e2e_runtime` was `LOGIN`,
  `NOSUPERUSER`, and `NOBYPASSRLS`. Bootstrap was fixture/assertion-only.
  The run-owned database was dropped and verified absent.
- Immutable evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793519228586_c4e0ac.json`
  SHA-256
  `719DE9EEF68ED30CE5263A1A783165674552D9721861DB2616CDC0543492B1D9`.
- This is authenticated application-path evidence for the production-shaped
  identity relationship. GST Stage 1 remains open for separately gated
  security/rollback acceptance, accounting policy decisions, professional
  approval, and production authorization.

## Authenticated tenant-context acceptance — 2026-11-01 13-04-27 IST

- The previous harness configuration defect was corrected: the acceptance
  runner now loads the ordinary `DATABASE_URL` from `.env.local` and forwards
  the repository-approved initialization contract values to the guarded
  provisioning child process.
- Static authenticated-context and provisioning checks remain PASS. No fixed
  tenant claim was reintroduced; the application continues to derive tenant
  context from the authenticated subject and active membership.
- Runtime acceptance is **BLOCKED — ENVIRONMENT UNAVAILABLE**. The approved
  loopback target `127.0.0.1:55432` refused connection and `docker ps`
  reported no running disposable container. No container was restarted or
  recreated under the session safety boundary.
- No authenticated application-path result is claimed. Previous restricted
  runtime evidence using a pre-established tenant claim remains separately
  classified and does not prove authenticated tenant binding.

## Authenticated tenant-context acceptance — runtime result 2026-11-01 13-08-20 IST

- The approved disposable target became available on `127.0.0.1:55432`.
- Fresh run `purchase_gst_1793518743403_f9d09c` completed **15/15 scenarios
  passed** under the restricted application role `pharmnos_e2e_runtime`
  (`LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`). Bootstrap was used only for
  fixtures and independent persisted-state assertions.
- Authenticated tenant binding was verified from session user ID to
  `users.external_id`, active membership, and transaction-local subject/tenant
  claims. Fixed connection tenant claims were not used; caller tenant
  overrides were rejected.
- Verified scenarios include active-membership purchase lifecycle,
  unauthorized cross-tenant acceptance rejection, explicit discrepancy
  resolution, accepted line-level GST posting, idempotency replay/conflict,
  concurrency, forced rollback, and retry. Accepted posting totals were
  taxable `191.0000`, CGST `13.6300`, SGST `13.6300`, payable `218.34`;
  persisted posting payload hash matched the accepted snapshot.
- Immutable evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793518743403_f9d09c.json`
  SHA-256
  `C86A89A9EBA9B35A2B02DC5CB63986EBF2132FD546116AE7B5468FA7766655B1`.
- Remaining blockers are policy decisions and separately gated independent
  security/rollback acceptance; GST Stage 1 remains open.

| Requirement | Implementation evidence                                                                                                                                                                                  | Tests/evidence                                                                                                                                                                                                                                            | Status                                                             | Remaining dependency                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| DGM-01      | Shared exact eight-label treatment control with search and disabled deferred options; persisted invoice fact                                                                                             | Typecheck/build pending; server validation covered by action path                                                                                                                                                                                         | IMPLEMENTED — TESTED                                               | UI runtime verification                                            |
| DGM-02      | Composition, unregistered, consumer, and exceptional categories remain fail-closed                                                                                                                       | Unsupported-treatment server guard                                                                                                                                                                                                                        | IMPLEMENTED — TESTED                                               | Statutory/accounting rules for activation                          |
| DGM-03      | Existing centralized 28-state/8-UT catalog plus searchable `GstStateSelect` for purchase POS                                                                                                             | `tests/gst-purchase-pos-contract.test.mjs`                                                                                                                                                                                                                | IMPLEMENTED — TESTED                                               | Browser/runtime verification                                       |
| DGM-04      | Existing GSTIN prefix helper remains validation-only                                                                                                                                                     | Existing GST calculator/state tests                                                                                                                                                                                                                       | IMPLEMENTED — TESTED                                               | Checksum/status policy                                             |
| DGM-05      | `src/lib/gst/place-of-supply.ts` validates normalized supplier, recipient, delivery, and scenario facts; purchase action calls it server-side                                                            | `tests/gst-purchase-pos-contract.test.mjs`; no DB runtime                                                                                                                                                                                                 | IMPLEMENTED — TESTED                                               | Runtime/database evidence                                          |
| DGM-06      | Purchase calculations resolve tenant-scoped approved HSN/SAC classifications and effective GST rules per line, then calculate approved intra/inter-state components independently; UTGST remains blocked | `purchase-gst-reconciliation.service.ts`, `purchases.actions.ts`, `tests/purchase-gst-line-model-contract.test.mjs`, restricted-runtime disposable application run `purchase_gst_1793489343533_a2551c`                                                    | IMPLEMENTED — APPLICATION PATH VERIFIED FOR TESTED MIXED-RATE FLOW | Negative scenario expansion and professional UTGST policy approval |
| DGM-07      | Purchase expected GST preserves mixed-rate line calculations, governed rule snapshots, supplier-declared evidence, calculated values, line discrepancies, and accepted values separately                 | `purchase-gst-reconciliation.service.ts`, migration `0006_purchase_gst_rule_snapshots`, migration `0009_purchase_gst_line_acceptance`, restricted-runtime application evidence `purchase-gst-application-evidence-purchase_gst_1793489343533_a2551c.json` | PARTIALLY ACCEPTED — RESTRICTED APPLICATION PATH RUNTIME VERIFIED  | Unresolved accounting policy decisions remain open                 |
| DGM-08      | Tax mode is persisted; inclusive mode remains disabled                                                                                                                                                   | Finalization guard                                                                                                                                                                                                                                        | PARTIALLY IMPLEMENTED                                              | Approved inclusive extraction/rounding policy                      |
| DGM-09      | Sales/purchase actions persist treatment and tax mode and revalidate them; sales and purchase finalization require approved effective classification/rule evidence                                       | `tests/gst-treatment-contract.test.mjs`, `tests/sales-gst-governance-contract.test.mjs`; no connected DB                                                                                                                                                  | PARTIALLY IMPLEMENTED                                              | Disposable runtime evidence and historical snapshot verification   |
| DGM-10      | Declared/calculated/accepted purchase fields remain separate; line discrepancy status and acceptance actions remain permission-gated                                                                     | `tests/purchase-gst-line-model-contract.test.mjs`, `purchase-gst-reconciliation.service.ts`, migration `0009_purchase_gst_line_acceptance`, restricted-runtime purchase application evidence                                                              | PARTIALLY ACCEPTED — EXPLICIT LINE ACCEPTANCE AND POSTING VERIFIED | Unresolved accounting policy decisions remain open                 |
| DGM-11      | Print output now displays persisted treatment, POS, and tax mode                                                                                                                                         | Source inspection                                                                                                                                                                                                                                         | IMPLEMENTED — TESTED                                               | Browser/print acceptance                                           |
| DGM-12      | Existing snapshot model preserved; new treatment/mode facts are transaction fields                                                                                                                       | Schema and print source                                                                                                                                                                                                                                   | PARTIALLY IMPLEMENTED                                              | Database immutability runtime proof                                |
| DGM-13      | Invalid/missing/unsupported treatment blocks draft/finalization; POS guards remain fail-closed                                                                                                           | Server action validation                                                                                                                                                                                                                                  | IMPLEMENTED — TESTED                                               | Complete negative matrix                                           |
| DGM-14      | Financial E2E artifact integrity remains bound to regenerated schema baseline                                                                                                                            | Artifact package tests; 15 GST-focused contracts                                                                                                                                                                                                          | IMPLEMENTED — TESTED                                               | Disposable PostgreSQL regression                                   |

## Engineering workstreams

| Workstream | Status | Evidence | Remaining |
|---|---|---|---|
| Purchase line-level accounting | PARTIALLY ACCEPTED — ACCEPTED SNAPSHOT DRIVES POSTING AMOUNTS AND TRANSACTION INTEGRITY IS SCOPED-VERIFIED | `scripts/purchase-gst-application-acceptance.cjs`; original remediation evidence `purchase-gst-application-evidence-purchase_gst_1793472204475_e61c52.json` (SHA-256 `AB057CE2224F2A533575A0D41139D7B8878185E6DAB18DDE4E138BACF19E18DC`) preserved unchanged; final corrected evidence `purchase-gst-application-evidence-purchase_gst_1793473344822_88e139.json` (SHA-256 `CA0121643F235ED8E918ACA3BDCB22EAD37DE66EBB496CF7FFD545D67637B71F`) records accepted-derived taxable/tax/payable totals, supplier ledger credit, audit amounts, posting-payload hash, and a different-purchase idempotency conflict; the harness passed 10 scenarios | Restricted runtime-role RLS; concurrent finalization/acceptance, forced rollback and retry remain unverified; unresolved cess, inclusive-tax, freight, discount, rounding, discrepancy-tolerance, and accepted-value inventory-valuation policy decisions |
| Purchase POS facts | IMPLEMENTED — TESTED | `place-of-supply.ts`, `gst-state-select.tsx`, purchase action validation | Browser and disposable runtime verification |
| HSN/SAC catalog | IMPLEMENTED — APPLICATION PATH SCOPED RUNTIME VERIFIED | `prisma/schema.prisma`, migration `0004_gst_catalog_and_rules`, migration `0008_hsn_governance_integrity`, `gst-catalog.actions.ts`, `settings/_gst-catalog-panel.tsx`; classification reset/update, unauthorized rejection, cross-tenant rejection, transaction history, and cleanup are exercised in `hsn-sac-application-runtime-evidence-hsn_app_1793470848347_4ef41c.json` | Owner decision for standalone `approve_hsn_catalog`; professional approval remains separate |
| GST rate governance | IMPLEMENTED — APPLICATION PATH SCOPED RUNTIME VERIFIED | `gst_rate_rules`, `rule-governance.ts`, separate maintenance/approval actions, sales rule binding, `tests/sales-gst-governance-contract.test.mjs`; authorized approval, pending-classification rejection, unauthorized rejection, duplicate rejection, concurrent duplicate approval, revision immutability, forced transaction rollback, same-version concurrent revision, invalid revision rejection, audit-history matching, and cleanup are exercised in `hsn-sac-application-runtime-evidence-hsn_app_1793470848347_4ef41c.json` | Professional rate approval remains separate; restricted runtime-role RLS acceptance remains unestablished |
| Purchase pointer integrity | IMPLEMENTED — TESTED | Prisma composite relations and static artifacts | Applied database verification |
| Q10 strict idempotency | IMPLEMENTED — APPLICATION PATH RUNTIME VERIFIED | Sales finalization serializes by tenant/idempotency key; purchase finalization now uses the same transaction-scoped lock; authorized disposable Q10 validation passed `COMMITTED+REPLAY`, rollback, replay, conflict, and persisted single-effect assertions | Independent acceptance |
| Q15 migration safety/recovery | IMPLEMENTED — SCOPED RUNTIME VERIFIED | `scripts/q15-validation.mjs`; disposable run `q15-1793461099812` passed fresh migration, repeat, pre-existing-object conflict stop, failed-ledger/no-application-table state, explicit rollback resolution, successful recovery retry, schema consistency, and two independent backup restores | Independent migration/recovery review; production rollout authorization |
| SEC-DEC-03 | IMPLEMENTED — SCOPED RUNTIME VERIFIED | Fresh authorized validation using run-specific login roles passed role separation, ownership, FORCE RLS, effective routine restrictions, same-tenant SELECT/INSERT/UPDATE, cross-tenant denial, missing/invalid context fail-closed behavior, DDL denial, and privileged-routine denial without mutating `pharmnos_e2e_runtime` | Independent security acceptance; application-authenticated runtime verification |

## Current blockers

- Localhost database diagnosis found valid non-empty configuration and
  reachable configured endpoints, but no authenticated workspace session was
  available. Top-level pages now distinguish authentication failure from
  missing database configuration; authenticated record loading remains
  unverified. See
  `LOCALHOST_DATABASE_ROOT_CAUSE_AND_REPAIR_REPORT.md`.
- Normal Prisma client generation is blocked by a Windows query-engine file
  lock from an existing port-3000 Node process; normal generation must be
  retried only in an authorized process-free window.
- TypeScript GST test execution still requires the repository's unavailable
  `tsx` setup; direct Node execution cannot resolve extensionless imports.
- The Q10/Q14 disposable PostgreSQL validation now observes
  `COMMITTED+REPLAY` for concurrent identical requests, plus exactly one
  operation, stock movement, ledger entry, and inventory decrement. The
  application-path probe remains blocked by a stale disposable schema missing
  `sales_invoices.gst_treatment`; it returned `RETURNED+RETURNED` and is not
  accepted as application runtime proof.
- Purchase GST application acceptance remains PARTIALLY ACCEPTED. The corrected
  flow loads persisted accounting-accepted line values and uses them for
  finalized invoice totals, supplier payable, audit amount metadata, and the
  posting payload/hash. The original remediation evidence remains unchanged:
  `purchase-gst-application-evidence-purchase_gst_1793472204475_e61c52.json`
  (SHA-256
  `AB057CE2224F2A533575A0D41139D7B8878185E6DAB18DDE4E138BACF19E18DC`).
  Corrected evidence:
  `purchase-gst-application-evidence-purchase_gst_1793473344822_88e139.json`
  (SHA-256
  `CA0121643F235ED8E918ACA3BDCB22EAD37DE66EBB496CF7FFD545D67637B71F`).
  The disposable harness passed 10 scenarios, including the focused
  same-key/different-purchase conflict assertion. Inventory valuation remains
  quantity/rate-based because no approved accepted-value valuation policy exists.
- The purchase harness used the bootstrap superuser/RLS-bypassing role.
  Restricted runtime-role RLS and tenant-isolation acceptance therefore remain
  unestablished.
- Purchase finalization concurrency, concurrent acceptance, forced failure after
  a financial effect begins, complete rollback, retry after rollback, and
  exactly-one-effect retry behavior remain unverified for this corrected
  purchase path. Sequential replay and different-purchase idempotency conflict
  are covered by the corrected harness.
- Production migration, deployment, and GST Stage 1 closure remain prohibited.

Mission update (2026-11-01): the corrected purchase application harness passed
15/15 scenarios, including same-key and different-key concurrency, concurrent
acceptance, forced rollback, retry, persisted accepted-value reconciliation,
payload/hash matching, and cleanup. Evidence:
`purchase-gst-application-evidence-purchase_gst_1793484266961_1ffd27.json`
(SHA-256
`9CF1E1357ED98F3E67930629E949FFBE1B6484224495AB76ACC4B94F5231ED3F`).
The latest HSN/SAC application evidence is
`hsn-sac-application-runtime-evidence-hsn_app_1793484172651_39e8c6.json`
(SHA-256
`B2345480EF65E88E5C80243B67B90CE7A79A488024A29ABDD9CB914AC8578A53`).
The purchase harness remains bootstrap-role evidence, not restricted-role
application RLS evidence. Fresh Q10 application execution and direct
security/rollback behavior scripts remain blocked by the invalid configured
`pharmnos_e2e_runtime` disposable credential and gated initialization
requirement. SEC-DEC-03 restricted-role validation passed independently.

Follow-up blocker investigation (2026-11-01 03:42 IST):

- The disposable PostgreSQL container is healthy on loopback `127.0.0.1:55432`.
  The bootstrap connection succeeds as `pharmnos_e2e` with `rolsuper=true` and
  `rolbypassrls=true`. The runtime role exists with `rolcanlogin=true`,
  `rolsuper=false`, and `rolbypassrls=false`.
- The runtime connection fails reproducibly with PostgreSQL `28P01` password
  authentication failure for `pharmnos_e2e_runtime`. No password or secret is
  recorded here, and no role password was changed.
- Q10 had an independent harness defect: it assigned
  `FINANCIAL_E2E_RUNTIME_DATABASE_URL` directly to Prisma and ignored the
  documented `FINANCIAL_E2E_RUNTIME_DB_PASSWORD` source. The harness now
  constructs both bootstrap and runtime URLs from their explicit credential
  variables. Re-running Q10 still fails at runtime authentication, proving
  the remaining failure is disposable-role credential drift rather than URL
  source selection.
- The earliest responsible provisioning issue is that
  `financial-e2e-provision-local.mjs` creates `pharmnos_e2e_runtime` only when
  absent. It does not reconcile a pre-existing role's password with the
  authorized disposable credential. This is a credential/configuration
  blocker, not evidence of an RLS defect.
- The direct security and rollback scripts contain unconditional early
  `BLOCKED` throws before their guarded setup. Removing those throws would
  bypass the approved initialization gate. They remain blocked until a fresh,
  run-bound initialization authorization and connected evidence package are
  supplied.

Recommended resolution: establish a new authorized disposable initialization
attempt using either a fresh ephemeral database/container or an explicitly
authorized disposable runtime-role credential rotation, then run the guarded
provisioning sequence and Q10/security/rollback checks. Acceptance requires
successful runtime login as `pharmnos_e2e_runtime`, verified
`NOSUPERUSER/NOBYPASSRLS`, tenant-context fail-closed behavior, Q10
single-effect replay/conflict/rollback assertions, and sanitized run-bound
evidence. The current mission did not rotate credentials or restart the
container.

## HSN/SAC governance invariant matrix

This matrix is the acceptance authority for the HSN/SAC governance controls.
Static evidence does not substitute for application-path or PostgreSQL runtime
evidence.

| Invariant ID | Requirement | Enforcement | Failure modes covered | Positive/negative evidence | Runtime status |
|---|---|---|---|---|---|
| HSN-01 | Approved classifications and rate rules require active state, approver membership, and approval timestamp. | Application actions plus migration/baseline checks. | Missing approver, inactive approval, invalid state. | Governance contract tests; disposable SQL evidence in `hsn-sac-governance-runtime-evidence-gov_1793468047522_fffaaa.json`. | Scoped runtime verified |
| HSN-02 | Approver references are tenant-scoped composite relations with exact referential actions. | Prisma schema, migration, generated baseline, static guard. | Wrong columns/order, missing tenant, wrong table/actions, wrong name. | 65 focused static tests; manifest hashes; fresh 0001–0008 migration evidence. | Scoped runtime verified |
| HSN-03 | Equivalent approver FKs cannot coexist under different names. | Migration definition-based duplicate guards. | Canonical-name mismatch, equivalent wrong-name FK. | Negative static contract test; wrong-name conflict and rollback evidence in `hsn-sac-migration-runtime-evidence-mig_full_1793467980382_35d6d4.json`; unrelated same-name isolation in `hsn-sac-migration-runtime-evidence-mig_scope_1793467970466_2065b8.json`. | Scoped runtime verified |
| HSN-04 | Approved rate periods do not overlap, including concurrent approval attempts. | Application overlap check plus PostgreSQL exclusion constraint. | Overlap, concurrency race, cross-tenant collision. | Disposable SQL evidence; static controls; concurrent outcomes recorded in `hsn-sac-governance-runtime-evidence-gov_1793468047522_fffaaa.json`. | Scoped runtime verified |
| HSN-05 | Approved rules and governance history are immutable; revisions create pending successors. | Application transactions plus database triggers and privileges. | Direct mutation, history update/delete, invalid revision lifecycle. | Disposable SQL evidence, including owner-level trigger checks and restricted-role privilege checks, plus real revision application evidence in `hsn-sac-governance-runtime-evidence-gov_1793468047522_fffaaa.json` and `hsn-sac-application-runtime-evidence-hsn_app_1793470848347_4ef41c.json`. | Scoped runtime verified |
| HSN-06 | Governance mutations remain tenant- and permission-scoped and atomic. | Server context/permission checks plus transaction boundaries. | Unauthorized, cross-tenant, partial failure. | Real action-path evidence in `hsn-sac-application-runtime-evidence-hsn_app_1793470848347_4ef41c.json`; unauthorized, cross-tenant, invalid-transition, duplicate, forced rollback, and concurrent outcomes are recorded. | Scoped application runtime verified; restricted-role RLS acceptance not established |

## GST Stage 1 blocker-resolution update — 2026-11-01 04-58-38 IST

- **Disposable runtime identity:** A fresh authorized loopback target was used on
  `127.0.0.1:55435` with database `pharmnos_financial_e2e_0419`; bootstrap and
  runtime authentication succeeded. The runtime role was independently verified
  as `LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`.
- **Purchase application path:** The harness now provisions each child database
  through `financial-e2e-provision-local.mjs`, applies tenant-scoped read-only
  RLS to `hsn_sac_catalog` and `gst_rate_rules`, and uses the restricted runtime
  role for application actions. The bootstrap role is fixture/assertion-only.
  The final run passed **15/15** scenarios, including cross-tenant fail-closed
  behavior, accepted-value posting, concurrency, rollback, retry, replay,
  payload conflict, inventory, supplier ledger, audit, and idempotency checks.
  Evidence: `purchase-gst-application-evidence-purchase_gst_1793489343533_a2551c.json`;
  SHA-256 `7E4F166807490331BC90F2BCC9F18D203BA70AD47E5ED6E7FB17B859C21BA383`.
- **Q10 application path:** On the same authorized target, sales finalization
  passed commit/replay, invalid-key rejection, conflicting-key rejection,
  concurrent identical requests (`COMMITTED+REPLAY`), forced rollback, retry,
  and persisted single-effect assertions. The result was `Q10_APPLICATION=PASS`.
- **Root causes corrected:** stale hard-coded disposable target guards and
  environment-file selection; Q10 fixtures missing approved governance facts;
  child-database provisioning not applying the approved runtime grants/RLS
  lifecycle; and a purchase harness assertion that treated correct
  cross-tenant fail-closed membership rejection as an authorization-message
  mismatch.
- **Remaining gates:** direct security/rollback scripts remain behind their
  connected-initialization authorization contract; HSN/SAC approval authority
  and accounting-policy decisions remain unresolved; GST Stage 1 closure and
  production/Live Supabase authorization remain `NO-GO`.

## Purchase GST authoritative posting correction — 2026-11-01 14-31-16 IST

- Corrected the finalization source-of-truth gate in
  `src/app/_actions/purchases.actions.ts`. A persisted accounting decision now
  selects the accepted posting snapshot for all approved sources:
  `SUPPLIER_DECLARED`, `APPLICATION_CALCULATED`, and `EXPLICIT_DECISION`.
  Previously, only `EXPLICIT_DECISION` selected accepted aggregate totals;
  supplier-declared and application-calculated decisions could continue with
  ordinary `serverTotals` despite accepted line snapshots being persisted.
- The accepted aggregate totals continue to drive the invoice projection,
  supplier payable/ledger credit, audit metadata, and posting payload totals.
  Inventory unit-rate treatment remains unchanged and is not presented as an
  accepted-GST valuation policy.
- Added a regression contract in
  `tests/purchase-gst-line-model-contract.test.mjs` asserting that every
  accepted source selects accepted posting totals and bypasses the ordinary
  calculated-total mismatch guard.
- Fresh restricted-runtime campaign
  `purchase_gst_1793523621669_dcaf26` passed **16/16** scenarios, including
  matched application-calculated acceptance, explicit line-level values that
  differ from calculated values, persisted invoice/payable/audit amounts,
  payload-hash reconciliation, idempotent replay, conflicting keys,
  concurrency, forced rollback, retry, cross-tenant denial, and inactive
  membership denial. The run-owned database was verified absent after cleanup.
- Evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793523621669_dcaf26.json`
  SHA-256
  `31DB225B62CAB258823F3A69C5B53A8D13AE47CD8AEF9918C450A19D01B49869`.
  Source hash for the corrected purchase action in that evidence is
  `afd38645dbdc0a9bf9e5aa648d9a40746ac889065fcc0b73bb25af87b21b6809`.
- Before the disposable run, the approved loopback PostgreSQL schema baseline
  was captured and read back from the existing container. Backup SHA-256:
  `B2147A72CD426A2DBAB139B45775C323BE2D0010AD2ABA8B4685E69A598D55CE`.
- Validation passed: focused financial/provisioning contracts **63/63**,
  TypeScript typecheck, Prisma validation with local environment, ESLint on
  changed files, and `git diff --check`. The GST calculator TypeScript test
  runner was not available because `tsx` is not installed; no dependency was
  added.
- Status: **PARTIALLY ACCEPTED** for Purchase GST financial integrity.
  Accounting-policy blockers, production schema rollout/recovery approval,
  and the separate HIGH forged-GUC trust-boundary finding remain open.

## Purchase GST line-level canonical reconciliation — 2026-11-01 14-40-00 IST

- Independent acceptance review confirmed a remaining defect in the prior
  evidence: accepted invoice and payable aggregates were correct, but
  finalized `purchase_invoice_items.line_total` and `gst_amount` retained
  ordinary calculated values.
- Finalization now synchronizes those canonical line fields from the validated
  accepted snapshot while preserving supplier evidence, calculated values, and
  accepted decision fields separately. The posting payload also uses the
  accepted line amount and accepted tax components for accepted sources.
- Fresh restricted-runtime campaign
  `purchase_gst_1793524087997_be4146` passed **16/16** scenarios with zero
  failures. Persisted explicit-decision values reconciled as accepted line
  total `218.3400`, canonical line total `218.34`, canonical GST amount
  `27.26`, invoice net `218.34`, supplier ledger credit `218.34`, and audit
  net `218.34`. Payload hash equality passed.
- Fresh evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793524087997_be4146.json`
  SHA-256
  `AABF59F913DAF9BA4F748F98CD0BF8FE46E6E6E34A19AF04E35908A94361CFA7`.
  The disposable database was verified absent after cleanup.
- A new schema baseline was captured before the campaign:
  `C:\Users\Masum Rafique\.copilot\session-state\de6b39fc-5872-46e6-8130-58843b8116f4\files\purchase-gst-audit-baseline-schema-2026-11-01T14-34-17.sql`,
  SHA-256
  `228D0A64B04663D902817DC937FDDE1864899A404D80A54E2B9C6EB11FB09C7C`.
- Validation passed: focused contracts, TypeScript typecheck, ESLint, and
  `git diff --check`. Status remains **PARTIALLY ACCEPTED** because inventory
  valuation and other accounting-policy gates, production rollout approval,
  and the separate HIGH forged-GUC trust-boundary finding remain open.

## Purchase GST valuation-aware runtime revalidation — 2026-11-01 15-13-15 IST

- Corrected the disposable provisioning artifact so valuation columns are
  present on `product_batches` rather than the unrelated `products` table.
  The artifact manifest was updated to the resulting schema and SQL hashes.
- Fresh restricted-runtime campaign
  `purchase_gst_1793526172673_fd9781` passed **16/16** scenarios with zero
  failures. Pending valuation persisted for two invoice lines, two batches,
  and two stock movements with null approved acquisition cost.
- Accepted explicit-decision values reconciled to accepted line total
  `218.3400`, canonical line total `218.34`, canonical GST `27.26`, invoice
  net `218.34`, supplier ledger credit `218.34`, and audit net `218.34`.
  Replay, conflict, concurrency, forced rollback, retry, tenant isolation,
  transaction-local claim isolation, and cleanup all passed.
- Fresh evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793526172673_fd9781.json`
  SHA-256
  `79986E1265BE6251FCCBF715EC0D6FE2A6448D21DAE7B682D7541F30C9AC4C39`.
- Status remains **PARTIALLY ACCEPTED / BLOCKED BY POLICY DETAIL**. ITC
  eligibility/apportionment, freight and discount allocation, post-supply
  notes, exact statutory rounding precedence, the HIGH forged-GUC finding,
  and production/Live Supabase rollout remain open.

## Inventory valuation root-cause remediation — 2026-11-01 15-36-03 IST

- Root cause: pending valuation columns existed, but there was no shared
  domain resolver for an explicit ITC split and the dashboard repository still
  used operational `purchase_rate` for its stock-value metric.
- Added a fail-closed inventory valuation resolver. It accepts only explicit
  eligibility status, recoverable/non-recoverable GST amounts, direct
  acquisition cost, policy version, decision reference, and actor; it never
  infers eligibility or cost.
- Added an explicit subsequent-adjustment delta calculator. Historical
  snapshots remain caller-owned and are not overwritten.
- Dashboard stock value now uses only approved acquisition cost and exposes
  pending batch count. Stock report/export approved averages use only approved
  quantity and approved acquisition cost.
- Root-cause and architecture report:
  `.obsidian-vault/bugs/purchase-gst-inventory-valuation-root-cause-2026-11-01.md`.
- Valuation service and contract checks passed. Status remains
  **PARTIALLY ACCEPTED / BLOCKED BY POLICY DETAIL** because authoritative
  decision persistence, ITC asset posting, freight/discount allocation,
  reversal lifecycle, and exact rounding precedence still require governed
  specifications.

## Historical prior GST calculation and treatment acceptance snapshot — 2026-11-01 20-03-44 IST

This superseded snapshot is retained for provenance. The current matrix and
decision are recorded in the gap-resolution section at the top of this
tracker.

- The authoritative contract was traced before implementation. The four
  first-phase domestic categories remain Registered Business – Regular,
  Registered Business – Composition, Unregistered Business, and Consumer.
  Only Regular is conditionally enabled; Composition, Unregistered, and
  Consumer remain fail-closed pending separate rules and acceptance evidence.
- The acceptance matrix records **17/24 verified engineering criteria**, zero
  verified failures, and seven `NOT VERIFIED` criteria. This is **NOT
  ACCEPTED** as a complete GST calculation/treatment campaign.
- Focused GST contracts passed **37/37**. The temporary existing-tool
  TypeScript harness executed `tests/gst-calculator.test.ts` with **253/253**
  assertions passing. The full JavaScript suite passed **231/231**.
- Same-UT handling exposed a tightly coupled fail-closed defect: the previous
  centralized resolver classified same-UT pairs as ordinary `INTRA`, allowing a
  possible CGST/SGST fallback. `indian-states.ts` now returns
  `UNKNOWN/UNSUPPORTED_UTGST`, and `place-of-supply.ts` rejects same-UT purchase
  facts with an actionable block. No UTGST calculation was added.
- TypeScript validation, Prisma validation with isolated placeholder URLs, and
  changed-file ESLint passed. No database, migration, container, process,
  production, Live Supabase, or acceptance campaign operation was performed.
- Complete evidence package:
  `.obsidian-vault/specs/gst-calculation-treatment-acceptance-2026-11-01.md`.
- Machine evidence:
  `.obsidian-vault/specs/gst-calculation-treatment-acceptance-evidence-2026-11-01.json`.
- Remaining blockers include inter-state purchase runtime evidence, complete
  POS-negative and GSTIN verification coverage, sales mixed-rate/idempotency
  evidence, UTGST, inclusive Rule 35 extraction, and approved precision and
  rounding precedence. GST Stage 1 remains open.
