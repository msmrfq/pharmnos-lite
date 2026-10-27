---
title: Local Financial E2E Provisioning Artifacts
date: 2026-10-25
status: Review artifact - not approved for execution
phase: POST-P7 - PRE-PRODUCTION VALIDATION
---

# Local Financial E2E Provisioning Artifacts

This review artifact records the owner-selected GST rollout directions and
the offline-generated schema baseline for the isolated financial E2E database.
It is not authorization to connect to a database or execute SQL.

## Owner decisions

The project owner selected the following directions on 2026-10-25:

1. **GST-APP-01:** restricted backend access; no direct browser CRUD for
   `anon`; bootstrap and runtime roles remain separate.
2. **GST-APP-02:** tenant-scoped RLS, forced RLS for application-facing roles,
   fail-closed tenant predicates, and ordinary-role isolation testing.
3. **GST-APP-03:** Option B composite `calculation_id` relation with Prisma
   inverse relation, `ON DELETE RESTRICT`, and
   `purchase_gst_decision_calculation_fkey`.
4. **GST-APP-04:** tenant-aware composite support keys, nullable current
   pointers, and guarded pointer foreign keys.
5. **GST-APP-05:** hybrid service/database immutability controls for finalized
   GST and reconciliation history.
6. **GST-APP-06:** service-led posting transactions backed by database
   integrity, idempotency, guarded transitions, and concurrency controls.
7. **GST-APP-07:** preserve existing accounting precision and timestamp
   behavior, use approved initial status/version defaults, and never fabricate
   historical GST facts.
8. **GST-APP-08:** additive, catalog-guarded, repeatable provisioning with
   stop-on-conflict and documented rollback limitations.

These are owner decisions, not AI decisions. They do not prove that any
implementation, database rollout, RLS isolation, or financial test has
succeeded. Settled D-GST-01 through D-GST-52 remain unchanged.

## Source reconciliation

The generated baseline is
`prisma/financial-e2e-schema-provisioning.generated.sql`. It was produced
offline from the current Prisma schema with `prisma migrate diff --from-empty`.
It contains the complete current Prisma baseline, including:

- all baseline application enums and tables;
- all four GST enums;
- all seven GST/posting tables;
- the six `purchase_invoices` GST/version fields;
- tenant-aware composite keys;
- Prisma-mapped foreign keys and indexes;
- the selected Option B composite calculation relation.

It is a complete baseline, not a safe additive migration for a populated
database. A future additive wrapper must perform catalog and data guards before
creating or altering any object.

`prisma/financial-e2e-additive-provisioning.review.sql` is the corresponding
review wrapper. It stops on a non-empty public schema, includes the generated
baseline for static review, and deliberately rolls back. It is not executable
provisioning because the approved grant, forced-RLS, immutable-history, and
posting-control artifacts still need concrete role/function names and review.

`prisma/financial-e2e-security-controls.review.sql` contains the concrete
offline security contract. It uses only the repository-supported principals:
`pharmnos_e2e` for bootstrap ownership and `pharmnos_e2e_runtime` for ordinary
non-superuser/non-`BYPASSRLS` verification. It does not reference `anon`,
`authenticated`, or an invented backend role. It remains review-only because
the final executable policy expansion and controlled-function deployment need
separate artifact review.

`prisma/financial-e2e-rls-policies.review.sql` expands the RLS contract into
explicit review-only policy names and predicates for every tenant-scoped
table. It is a companion to the security-controls artifact, not a second
source of truth. `tenants` uses its `id`; `role_permissions` uses an `EXISTS`
lookup through `roles`; all other listed tables use `tenant_id`. The generated
baseline is [financial-e2e-schema-provisioning.generated.sql](../../prisma/financial-e2e-schema-provisioning.generated.sql),
and the wrapper is
[financial-e2e-additive-provisioning.review.sql](../../prisma/financial-e2e-additive-provisioning.review.sql).

The current Prisma schema now contains:

```prisma
calculation purchase_gst_calculations
  @relation(
    "purchase_gst_decision_calculation",
    fields: [tenant_id, purchase_invoice_id, calculation_id],
    references: [tenant_id, purchase_invoice_id, id],
    onDelete: Restrict,
    map: "purchase_gst_decision_calculation_fkey"
  )
```

## Local execution artifact and reconciliation note

Owner's Decision — for the authorized isolated local run, execute the current
baseline exactly once inside a catalog-guarded transaction, then apply the
approved grants, forced-RLS policies, bootstrap-owned trigger controls, and
runtime verification contract from one explicit local-only runner:
`scripts/financial-e2e-provision-local.mjs`.

Rationale: the existing SQL files remain review-only specifications, while a
single ordered runner prevents duplicate baseline execution and stops on the
first error. Consequence: this runner is only valid for the verified empty
disposable target and must never be used against a populated, shared, or live
database.

The first post-provision catalog review found that `role_permissions` was
present in Prisma and the generated baseline but missing from the executable
RLS table list. The runner and static guard were corrected, and the missing
runtime grant, forced-RLS setting, and three policies were applied in a
separate guarded repair transaction. This is artifact reconciliation evidence,
not tenant-isolation proof.

## Controlled local behavior evidence

Owner's Decision — the local behavior harness uses two synthetic tenants,
memberships, roles, suppliers, purchases, GST evidence, and posting operations
with run-owned identifiers. Setup and teardown use only the bootstrap role;
application-facing assertions use independent `pharmnos_e2e_runtime`
connections and transaction-local tenant claims.

Rationale: this separates fixture administration from ordinary-role security
evidence and prevents a superuser or `BYPASSRLS` role from proving isolation.
Consequence: this evidence is limited to the disposable database and does not
authorize financial scenarios or live rollout.

Evidence from run `security-1792925256176`:

- 19 assertions: `PASS 19`, `FAIL 0`, `BLOCKED 0`, `NOT RUN 0`.
- Same-tenant and cross-tenant reads/writes, role-permission scoping, and
  empty/malformed/mismatched claims passed.
- Immutable GST insert passed; update/delete were denied by runtime privileges.
- Finalized GST-field mutation was rejected by the trigger; a non-protected
  note update remained allowed.
- `PROCESSING -> COMPLETED` passed; invalid reverse transition was rejected.
- Duplicate and competing idempotency claims were rejected deterministically.
- Cleanup passed; exact rows in all fixture tables after cleanup: `0`.
- Harness: `scripts/financial-e2e-security-behavior.mjs`.

Final restricted-runtime catalog snapshot after cleanup:

- Database `pharmnos_financial_e2e`; role `pharmnos_e2e_runtime`.
- `rolsuper=false`, `rolbypassrls=false`, and public-schema `CREATE=false`.
- Marker `pharmnos-financial-e2e` present.
- 26 public tables; all 26 have RLS enabled and forced.
- 71 public RLS policies and 8 non-internal public triggers.
- No synthetic fixture rows remained.

This evidence proves the tested local controls only. It does not prove
production readiness, live Supabase security, or the full financial E2E suite.

## Controlled local rollback and recovery evidence

Owner's Decision — rollback validation uses deliberate, expected PostgreSQL
constraint failures inside disposable transactions rather than modifying
persistent triggers, grants, or RLS controls.

Rationale: unique-key and foreign-key failures exercise the actual atomicity
boundaries while preserving the production control surface. Consequence:
version-based recovery is not asserted because the current schema exposes no
version-check contract, and cleanup-failure recovery is not injected because no
safe deterministic cleanup seam exists.

Evidence from run `rollback-1792926009121`:

- Executed cases: 3 PASS, 0 FAIL.
- `rollback-posting-after-expected-unique-failure`: an inserted posting and
  its deliberate duplicate were rolled back; zero posting rows remained.
- `rollback-related-gst-records-after-fk-failure`: evidence and calculation
  writes were rolled back after an invalid finalized-calculation foreign-key
  update; zero related rows remained.
- `failed-posting-retry-and-replay`: the failed transaction left no poisoned
  idempotency record; retry succeeded and replay was rejected by the existing
  idempotency constraint.
- `stale-version-recovery`: `NOT RUN`; no version-check implementation exists.
- `controlled-cleanup-failure-recovery`: `NOT RUN`; no safe failure-injection
  seam exists under the cleanup safety rules.
- Cleanup passed; exact run-owned rows after cleanup: `0`.
- Post-test catalog retained 71 policies and 8 non-internal triggers.
- Harness: `scripts/financial-e2e-rollback-recovery.mjs`.

These results establish local transaction rollback and retry evidence only.
They do not establish production readiness, live Supabase recovery, or the
broader financial E2E lifecycle.

## GST Disposable Test Suite exit-criteria audit

Audit date: 2026-10-25. Recommendation: **KEEP IN PROGRESS**.

The audit reconciled the documented rollout design, readiness package,
financial verification matrix, local harness definitions, and recorded local
outputs. Stage 1 is not closed because local security/rollback evidence covers
only part of the mandatory financial lifecycle matrix, and no live or
production evidence is authorized.

| Criterion | Status | Evidence and qualification |
|---|---|---|
| GST schema, enums, and composite tenant-aware constraints | `PASS` | Static Prisma/generated-baseline inspection and provisioning guard cover the expected 4 enums, 7 GST/posting tables, mapped composite keys, and Option B relation. This is not live-schema proof. |
| Guarded additive/repeatable provisioning and stop-on-conflict | `PASS` | Static guard passed; local runner is empty-target guarded, transactional, and stop-on-error. No new mutating run was performed during this audit. |
| Least privilege and no browser-facing CRUD | `PASS` | Local runtime catalog evidence shows non-superuser/non-BYPASSRLS and no public-schema CREATE; artifact checks reject anonymous grants. Production/browser role evidence remains absent. |
| RLS, forced RLS, policy coverage, fail-closed claims | `PASS` | Recorded local catalog has 26/26 forced-RLS tables and 71 policies; security harness covered missing, empty, malformed, and mismatched claims. Live Supabase remains unverified. |
| Same-tenant access and cross-tenant denial | `PASS` | Recorded ordinary-runtime security run has 19/19 PASS, including role-permission scoping and cross-tenant write rejection. Local-only evidence. |
| GST history and finalized-invoice protection | `PASS` with unresolved trigger-path qualification | Runtime update/delete were privilege-denied; finalized GST mutation was trigger-rejected. Trigger execution for immutable update/delete was not independently exercised under runtime. |
| Posting transitions, idempotency, and concurrency | `PASS` with scope qualification | Recorded run passed valid/invalid transitions, duplicate idempotency, and competing claims. Full business posting transaction and payload-hash conflict semantics remain outside this run. |
| Rollback and multi-record atomicity | `BLOCKED` | Three rollback/recovery cases passed; stale-version and cleanup-failure recovery were NOT RUN. The financial matrix still requires full purchase/sales atomicity and sequence/ledger/stock assertions. |
| Fixture cleanup and control preservation | `PASS` | Exact run-owned residual count was `0`; catalog retained 71 policies and 8 triggers. Cleanup-failure recovery remains NOT RUN because no safe deterministic seam exists. |
| Required approvals and broader financial acceptance | `BLOCKED` | Owner decisions and artifacts are recorded, but broader financial E2E acceptance, live connectivity, backup/restore, and operational approvals are absent. |

### Audit conclusion

The local disposable suite has adequate evidence for its tested schema,
least-privilege, RLS, tenant-isolation, posting-guard, cleanup, and selected
rollback controls. It does not satisfy the complete documented Stage 1 exit
criteria. The minimum next action is a separately authorized broader financial
E2E run covering purchase finalization atomicity, sales/FEFO, invoice sequence,
payments, and all required ledger/stock/audit assertions. No live Supabase or
production Prisma connection is implied.

## Authorized Financial E2E acceptance run — 2026-10-25 17:15 IST

**Owner's Decision — broader isolated acceptance authorization:** Masum
Rafique, the sole authoritative project owner, authorized the outstanding
broader Financial E2E acceptance testing against the existing isolated local
disposable database. The authorization is limited to the documented purchase,
sales/FEFO, invoice-sequence, payment, cross-module consistency, cleanup, and
post-test catalog checks. It does not authorize Supabase, preview, production,
deployment, container recreation, or environment changes.

**Rationale:** Stage 1 cannot be evaluated for closure until the outstanding
financial lifecycle requirements are either tested or explicitly classified
against their authoritative acceptance criteria.

### Preflight and execution result

The safe preflight was run after loading the existing repository environment
files without printing their values:

```text
node scripts/financial-e2e.mjs
FINANCIAL_E2E=BLOCKED: scenario runner is not enabled; no financial mutations were executed
exit status: 2
```

This output is the expected safety stop after successful target and connected
identity checks. The runner verified the configured local disposable target
before refusing to execute scenarios. No fixture was created, no business row
was mutated, and no cleanup was required.

The broader acceptance scenarios were therefore **not executed**:

| Scenario | Status | Reason |
|---|---|---|
| Purchase finalization, stock, supplier ledger, audit, failure atomicity, retry | `BLOCKED` | No existing end-to-end harness invokes `finalizePurchaseAction` with an authenticated tenant context and owned lifecycle fixtures; the safety runner is intentionally disabled |
| Sales completion and FEFO stock/ledger consistency | `BLOCKED` | No existing end-to-end harness invokes `finalizeSalesInvoiceAction` with authenticated tenant fixtures |
| Invoice-sequence rollback and retry | `NOT RUN` | Sequence allocation is embedded in sales finalization through `business_profiles.invoice_next_seq`; no standalone acceptance harness or documented gap/rollback contract was available |
| Customer and supplier payment transitions, idempotency, atomicity | `BLOCKED` | No existing end-to-end harness invokes the payment actions with authenticated tenant fixtures |
| Cross-module consistency | `NOT RUN` | Depends on the unexecuted purchase, sales, and payment scenarios |
| Fixture cleanup and post-test catalog verification for this run | `NOT RUN` | No fixtures were created; prior run-owned cleanup evidence remains valid |

These are not reported as passing results. Existing local behavior evidence
remains limited to the previously recorded security harness (`19 PASS`) and
rollback harness (`3 PASS`, `2 NOT RUN`). The repository has no broader
Financial E2E acceptance harness to execute safely within this authorization.

### Post-run safety and regression evidence

- Database mutation count for this authorized attempt: `0`.
- Fixture residual count from this attempt: `0` because no fixtures were created.
- No RLS, grant, trigger, constraint, or environment change was made.
- Existing recorded catalog evidence remains: 26 forced-RLS tables, 71
  policies, and 8 non-internal triggers.
- Existing offline regression evidence remains `49 PASS`.
- No live Supabase or production/preview database connection was attempted.

**Closure result:** `KEEP IN PROGRESS`. Owner authorization removes the
authorization blocker, but it does not substitute for execution evidence.
Stage 1 remains open until a reviewed, authenticated, run-owned broader
acceptance harness exists and executes the documented scenarios against the
isolated database, or each unsupported criterion is formally resolved against
the authoritative acceptance contract.

**Exact next action:** implement or authorize a focused local-only Financial
E2E harness that can establish an authenticated tenant context and run the
purchase, sales/FEFO, sequence, payment, and cross-module assertions using
run-owned fixtures and the existing cleanup contract. Do not enable the
disabled scenario runner by bypassing its safety gates.

## Financial E2E implementation-to-contract and safety-gap audit

Audit date: 2026-10-25 17:25 IST. This was a read-only implementation audit.
No financial scenario, fixture creation, database mutation, remote connection,
environment change, or container operation was performed.

### Disabled-runner root cause

The exact path in `scripts/financial-e2e.mjs` is:

1. Require `ALLOW_FINANCIAL_E2E=true` and the target/runtime configuration.
2. Call `validateFinancialE2eTarget` for the test and runtime URLs.
3. Call `verifyConnectedIdentity`, which queries the connected PostgreSQL
   session and validates database, role, marker, application name,
   non-superuser, and non-`BYPASSRLS` evidence.
4. Unconditionally call `fail("scenario runner is not enabled; no financial
   mutations were executed")`.

There is no scenario orchestration branch, fixture creation call, manifest
recording call, authenticated application invocation, or cleanup executor in
that file. The disabled runner is therefore an intentional hard stop, not a
failed business scenario.

### Implementation-to-contract matrix

| Requirement area | Classification | Exact implementation/evidence | Gap or limitation |
|---|---|---|---|
| Configuration and hard safety guards | `IMPLEMENTED AND TESTED` | `scripts/financial-e2e-safety.mjs`: `validateFinancialE2eTarget`; `tests/financial-e2e-safety.test.mjs`; 41 pure safety/readiness/fixture tests pass | No database behavior is proven by these tests |
| Database identity and marker verification | `IMPLEMENTED, NOT BEHAVIORALLY VERIFIED` for this audit | `verifyDatabaseIdentity` in `financial-e2e-safety.mjs` queries `current_database`, roles, server identity, `application_name`, and `pharmnos.financial_e2e_marker`; prior local artifact records a matching marker | Compose has no marker initialization; provision-local only verifies the marker before baseline application. This audit did not reconnect |
| Runtime/bootstrap separation | `PARTIALLY IMPLEMENTED` | Role names and grants are encoded in `financial-e2e-provision-local.mjs` and review SQL; prior artifact records the runtime role as non-superuser/non-BYPASSRLS | Compose does not create either role. Role provisioning is an external/local setup prerequisite, not implemented by the documented Compose definition |
| Readiness and execution authorization | `IMPLEMENTED AND TESTED` | `validateFinancialE2eReadiness` and `canStartFinancialScenario` in readiness/fixture lifecycle modules; tests reject missing authorization and enabled runner | The executable runner does not yet compose these contracts into an orchestration flow |
| Authenticated application and tenant context | `NOT IMPLEMENTED` for E2E harness | Production path is `requireServerTenantContext` in `src/lib/db/tenant-context.ts`, using `authAdapter.getCurrentSession`, database membership lookup, and permission extraction | No local harness adapter/session bridge exists; direct PostgreSQL `request.jwt.claim.tenant_id` is not equivalent to authenticated application execution |
| Fixture creation, ownership manifest, lifecycle | `PARTIALLY IMPLEMENTED` | `financial-e2e-fixture-lifecycle.mjs` validates run-owned resources, legal states, frozen cleanup snapshots, and dependency order | No executable fixture creator records a manifest for purchase/sales/payment resources |
| Cleanup authorization and ordering | `IMPLEMENTED AND TESTED` as a pure contract | `authorizeFixtureCleanup`, `buildOwnedCleanupPlan`, and lifecycle tests; dependency order is asserted | Trusted cleanup executor is `NOT IMPLEMENTED`; `recordCleanupSuccess` accepts future executor evidence but does not delete rows |
| Purchase success/GST reconciliation/rollback | `PARTIALLY IMPLEMENTED` | `finalizePurchaseAction` in `src/app/_actions/purchases.actions.ts` uses a Prisma transaction, GST evidence/calculation/acceptance gates, posting operation, stock, supplier ledger, and audit writes; prior rollback harness covers generic unique/FK atomicity | No authenticated purchase lifecycle harness; full purchase success and business-record rollback are not behaviorally verified |
| Sales finalization/GST/FEFO | `PARTIALLY IMPLEMENTED` | `finalizeSalesInvoiceAction` in `src/app/_actions/sales.actions.ts` uses a transaction, GST snapshots, FEFO picker, batch decrement, stock movement, invoice sequence, ledger, and audit | No authenticated local E2E orchestration; no database-backed sales/FEFO evidence |
| Invoice sequence and rollback | `PARTIALLY IMPLEMENTED` | Sales finalization increments `business_profiles.invoice_next_seq` inside its transaction | No separate sequence model or documented gap policy; no failure/retry acceptance harness |
| Payment atomicity and balance consistency | `PARTIALLY IMPLEMENTED` | `createCustomerPaymentAction` and `createSupplierPaymentAction` use Prisma transactions to create payment, ledger row, and update balance | No idempotency contract is implemented in these actions and no database-backed payment test exists |
| Tenant isolation and RLS | `IMPLEMENTED AND TESTED` for prior local control run | `financial-e2e-provision-local.mjs` applies forced RLS/policies; prior security artifact records 19/19 ordinary-role assertions; static RLS tests pass 8/8 | This audit did not reconnect; no live Supabase proof |
| Historical invoice immutability and printing | `PARTIALLY IMPLEMENTED` | Sales finalization persists tax/master-data snapshots; print routes exist; finalized GST protections are in local controls | No authenticated print/reprint E2E test and no independent runtime trigger-path test for immutable history |
| Schema rollout and legacy compatibility | `IMPLEMENTED, NOT BEHAVIORALLY VERIFIED` | Prisma schema, generated baseline, static guard, and legacy tax-status/snapshot logic exist; provisioning static guard passes | Compose does not apply the schema, marker, or roles; no live/production rollout evidence |

### Marker, runtime role, and execution path findings

- **Marker implementation:** verification is implemented in
  `financial-e2e-safety.mjs`; marker consumption is implemented in the
  identity query and application-name validation. Marker provisioning is absent
  from `docker-compose.financial-e2e.yml` and absent from the executable
  provisioning runner. Prior local evidence records a marker already present,
  but this audit did not independently verify it.
- **Runtime role:** least-privilege grants, forced RLS, and role checks are
  implemented in the review/provisioning scripts. Compose does not create the
  bootstrap or runtime roles. Prior local evidence records the runtime role as
  non-superuser/non-`BYPASSRLS`; this audit did not reconnect.
- **Authenticated tenant context:** production server actions require a
  Supabase session, map the external user ID to `users.external_id`, select an
  active membership and role permissions, and produce `TenantContext`. The
  local E2E scripts only set a PostgreSQL transaction-local tenant claim for
  direct SQL behavior tests; they cannot invoke the server actions as an
  authenticated application session.
- **Fixture lifecycle:** pure ownership and cleanup-plan contracts exist.
  There is no trusted executor that performs the generated plan and then
  records independently captured completion evidence.

### Minimum safe remediation sequence

1. Add a reviewable, non-mutating orchestration contract/test seam that
   accepts an injected authenticated `TenantContext` or provider-independent
   auth adapter for local E2E only. Do not change production authorization
   semantics. Validate with pure unit tests; owner authorization is required
   before any database scenario.
2. Define the local-only marker/role provisioning ownership explicitly.
   Prefer a separately reviewed initialization/provisioning step that creates
   the marker and restricted roles before the existing baseline runner, while
   preserving stop-on-conflict and target identity checks. Validate with static
   artifact tests; database execution needs separate owner authorization.
3. Implement a trusted cleanup executor around the existing frozen plan. It
   must use the bootstrap role only after fresh identity evidence and explicit
   cleanup authorization, delete only manifest resources in dependency order,
   verify exact zero residuals and catalog controls, and record executor
   evidence. Validate first with a mocked executor contract; database cleanup
   requires the existing authorization.
4. Add focused scenario orchestration for purchase, sales/FEFO, sequence,
   payments, and cross-module assertions using only run-owned synthetic
   resources. Validate orchestration with mocks/static checks first; each
   database run requires the owner-authorized isolated scope.
5. Only after those gates pass, execute the broader local acceptance run and
   reconcile Stage 1. No step authorizes Supabase, preview, production, or
   deployment activity.

The primary risks are accidentally bypassing the real Supabase-backed
authentication boundary, using bootstrap privileges as application evidence,
creating fixtures without a frozen ownership manifest, or treating direct SQL
claim tests as proof of server-action behavior. These risks are why the
scenario runner must remain disabled until the seams and executor are
reviewed and pure-tested.

## Phase A — authenticated Financial E2E orchestration seam

Implemented 2026-10-25 17:29 IST in
`scripts/financial-e2e-orchestration.mjs`, with offline coverage in
`tests/financial-e2e-orchestration.test.mjs`.

The seam is a test-only dispatcher with explicit dependencies:

- `getAuthenticatedContext()` must provide the application-resolved
  `TenantContext`; the dispatcher does not accept a tenant ID as an
  authorization input.
- `requirePermission(context, permission)` delegates permission enforcement to
  the existing application boundary rather than reimplementing authorization.
- `canStartScenario(gate)` delegates to the existing readiness/fixture
  lifecycle gate.
- `scenarioOperations` is an explicit registry; unregistered scenarios cannot
  dispatch.

The dispatcher returns classified `DISPATCHED`, `BLOCKED`, or `REJECTED`
results and never reports a failed operation as a successful financial
assertion. It does not create fixtures, connect to PostgreSQL, invoke a real
financial action, enable `scripts/financial-e2e.mjs`, or provide an
authentication bypass. Production `requireServerTenantContext()` remains the
supported source for a real application context; wiring a database-capable
operation registry remains a later, separately reviewed step.

Offline results:

- orchestration seam tests: `8 PASS`, `0 FAIL`;
- missing authentication and invalid context rejected;
- permission denial rejected before operation dispatch;
- false safety gate blocked dispatch;
- explicit execution authorization was required through the injected gate;
- caller-supplied tenant ID was not trusted over authenticated context;
- operation failure classified as blocked, not success;
- unregistered scenario rejected;
- no database mutation or financial scenario executed.

This advances the pure orchestration seam only. Marker/runtime-role
provisioning, authenticated application wiring, fixture creation, trusted
cleanup execution, and real financial scenario execution remain prerequisites.

## Phase B — local authenticated application-context adapter

Implemented 2026-10-25 17:35 IST in
`scripts/financial-e2e-auth-context.mjs`, with offline coverage in
`tests/financial-e2e-auth-context.test.mjs`.

The adapter preserves the application context sequence without connecting to
Supabase or PostgreSQL:

1. Call the injected `getCurrentSession()` boundary.
2. Require an authenticated session user ID.
3. Resolve the application user by authenticated external ID through the
   injected `findUserByExternalId()` repository boundary.
4. Require an active tenant membership.
5. Derive roles and permissions from that membership.
6. Return the resulting `TenantContext` to the Phase A dispatcher.

Caller-supplied tenant IDs are explicitly rejected and cannot establish
authority. Session, lookup, and context errors are sanitized and do not expose
tokens, credentials, or session details. The adapter does not fabricate a
session, cookie, user, membership, role, or permission set. It does not alter
`requireServerTenantContext()`, `requirePermission()`, the Supabase adapter, or
production authentication behavior.

The injected functions are test seams representing the existing application
boundaries; they are not live authentication evidence. The adapter therefore
proves only control-flow and authorization propagation. A database-capable
integration still requires an application-hosted session boundary with the
real Supabase cookie/session path, plus the separately blocked marker,
runtime-role, fixture, and cleanup prerequisites.

Offline results:

- adapter and dispatcher tests: `16 PASS`, `0 FAIL`;
- missing session rejected;
- missing application-user mapping rejected;
- missing/inactive membership rejected;
- membership-derived tenant, user, role, and permissions propagated;
- caller tenant override rejected;
- credential/session details sanitized from errors;
- readiness gate blocked dispatch;
- no business operation invoked by blocked tests.

No financial scenario, database connection, database mutation, marker/role
provisioning, or cleanup execution occurred.

## Phase C — application-hosted authentication boundary design

Phase C was validated offline on 2026-10-25 17:40 IST. The implementation
does not add an HTTP route, server action, authentication bypass, or financial
scenario. It adds the non-public delegation seam in
`scripts/financial-e2e-app-hosted-boundary.mjs`.

### Actual request/session lifecycle

The production request path is request-scoped:

1. A Next.js server component, server action, or future reviewed internal
   entry point runs while a request is active.
2. `authAdapter.getCurrentSession()` calls `cookies()` from
   `next/headers` through the existing Supabase SSR client.
3. `getServerTenantContext()` maps the authenticated Supabase user ID to
   `users.external_id` using Prisma.
4. It selects an active membership and derives the membership role permissions.
5. `requireServerTenantContext()` returns the authoritative `TenantContext`;
   the business action then applies `requirePermission()`.

A standalone `scripts/*.mjs` process has no Next.js request/cookie context and
cannot safely reuse this lifecycle. It must not synthesize cookies, sessions,
Supabase users, tenant IDs, roles, or permissions.

### Boundary design and implementation

`createApplicationHostedFinancialE2eBoundary()` accepts only a
request-scoped `resolveTenantContext` function supplied by an application-hosted
caller. In production wiring, that function must be the existing
`requireServerTenantContext()` (or a narrowly reviewed equivalent that calls
the same production path). The boundary:

- rejects caller-supplied tenant IDs;
- delegates authentication, user mapping, active membership, and permission
  derivation to the supplied application resolver;
- rejects missing or incomplete resolved context;
- sanitizes resolver failures;
- delegates permission enforcement and the mandatory safety gate to the Phase A
  dispatcher;
- never invokes a financial operation while authentication, authorization, or
  safety validation fails.

No public route or reusable production flag was added. The boundary itself is
not a cryptographic security boundary; accidental exposure must be prevented
by keeping its construction in a reviewed, application-hosted test entry
point that is not part of normal user routing. Its injected tests prove only
control flow.

Offline results:

- `tests/financial-e2e-app-hosted-boundary.test.mjs`: `9 PASS`, `0 FAIL`;
- adapter/dispatcher and existing regression suites: `65 PASS`, `0 FAIL`;
- resolver dependency, request-scoped delegation, unauthenticated/incomplete
  context, inactive authorization path, tenant override, permission failure,
  mandatory safety gate, error sanitization, and no-operation-on-block tests
  passed.

This phase does not prove real Supabase authentication, cookie validity,
database identity, RLS, tenant isolation, financial correctness, fixture
ownership, cleanup, or production readiness. No database or external service
was accessed and no financial action ran.

### Exact remaining integration blocker and next seam

The missing piece is a reviewed Next.js application-hosted entry point that
binds `requireServerTenantContext()` inside a real request and supplies that
resolver to the boundary. It must remain separately gated by the existing
Financial E2E readiness contract and must not execute a scenario in this
phase. The next implementation may add only that non-mutating entry-point
binding and its offline tests; marker/runtime-role provisioning, fixture
creation, trusted cleanup, and scenario execution remain separate prerequisites.

## Phase D — reviewed Next.js request-scoped binding

Phase D added the smallest application-hosted binding on 2026-10-25 17:43
IST in `src/lib/financial-e2e/app-hosted-binding.ts`.

This is deliberately a server-library binding, not an API route or server
action. It is not publicly addressable and it does not expose a test facility
to production users. The binding:

- fixes `resolveTenantContext` to the existing
  `requireServerTenantContext()` function;
- fixes `requirePermission` to the existing production permission guard;
- accepts only the Phase C safety gate and scenario-operation dependencies;
- rejects construction when `NODE_ENV` is `production`;
- accepts no caller-supplied session, cookie, access token, refresh token, or
  tenant ID;
- does not invoke any financial operation while creating the boundary.

When called from a reviewed Next.js server component or future internal test
entry point, `requireServerTenantContext()` executes in the active request
context. The existing Supabase SSR adapter reads request cookies, then the
existing Prisma-backed resolver maps the authenticated external ID to the
application user, active membership, role, and permissions. Phase D did not
call that resolver because doing so would require database-backed execution,
which remains prohibited.

The binding's offline tests are source/contract tests and prove that the
production resolver and permission guard are fixed dependencies, production
construction is denied, no public HTTP handler is introduced, and no caller
authentication or tenant authority is accepted. They do not prove request
cookies, Supabase authentication, database identity, RLS, tenant isolation,
financial correctness, or readiness.

The Financial E2E safety gate remains mandatory in the Phase C dispatcher.
No purchase, sales, payment, invoice, inventory, fixture, cleanup, or other
financial operation was registered or invoked by Phase D.

The remaining next step is a separately reviewed internal Next.js invocation
that supplies only the already-approved readiness gate and does not enable
the standalone runner. Marker/runtime-role provisioning, fixture orchestration,
trusted cleanup, and execution authorization remain independent prerequisites.

## Phase E — internal Next.js invocation review

Phase E review found that no application module previously invoked the Phase D
binding. The binding was only a factory; no `src/` entry point constructed it
or dispatched a request.

The new `invokeRequestScopedFinancialE2e()` helper in
`src/lib/financial-e2e/app-hosted-binding.ts` is the smallest safe internal
invocation seam. It:

- uses the Phase D binding, so authentication comes only from
  `requireServerTenantContext()` and permissions only from the production
  `requirePermission()` guard;
- accepts a prepared readiness gate dependency but cannot replace or skip the
  Phase C dispatcher gate;
- rejects caller tenant authority through the existing boundary;
- registers an empty scenario-operation map, so this phase cannot invoke a
  purchase, sales, payment, invoice, inventory, or other financial operation;
- is not a route or server action and is denied when constructed in production.

The helper is therefore an internal review seam, not an executable financial
scenario entry point. With an unready gate, the dispatcher stops before
operation lookup. With a ready gate, the empty operation map returns
`SCENARIO_NOT_REGISTERED`; it still cannot execute financial work.

Offline source/contract tests in
`tests/financial-e2e-internal-invocation.test.mjs` verify the fixed production
resolver and permission guard, absence of a public handler, mandatory gate
dependency, empty operation registry, tenant-authority rejection path, and
production denial. Existing Phase A-D tests continue to provide the behavioral
mock evidence for gate blocking, authorization failures, sanitization, and
zero operation invocation.

No real Next.js request was exercised. These tests do not prove Supabase
authentication, request-cookie validity, database identity, RLS, tenant
isolation, financial correctness, fixture ownership, cleanup, or production
readiness.

## Phase F — provisioning and fixture-lifecycle gap audit

Audit date: 2026-10-25 18:06 IST. This was a read-only implementation and
offline-validation audit. No database connection, provisioning, fixture
creation, cleanup, financial scenario, environment change, or container
operation was performed.

### Implementation-to-contract matrix

| Requirement area | Classification | Source and offline evidence | Database-backed status / gap |
|---|---|---|---|
| Disposable target configuration and fail-closed guards | `IMPLEMENTED AND OFFLINE-TESTED` | `scripts/financial-e2e-safety.mjs`: `validateFinancialE2eTarget`; `tests/financial-e2e-safety.test.mjs`; target identity, name, marker, endpoint separation, and blocked-host tests | No live target behavior was exercised |
| Connected database identity verification | `IMPLEMENTED BUT NOT BEHAVIORALLY VERIFIED` | `verifyDatabaseIdentity` and `validateDatabaseIdentityEvidence` in `financial-e2e-safety.mjs`; mocked identity/evidence tests | Requires an actual connected session to prove database, role, marker, application name, server address, and `NOBYPASSRLS` |
| Independent database marker provisioning | `NOT IMPLEMENTED` | `docker-compose.financial-e2e.yml` defines only PostgreSQL, credentials, database, port, tmpfs, and healthcheck; `financial-e2e-provision-local.mjs` verifies `current_setting('pharmnos.financial_e2e_marker')` but does not create it | Separate reviewed local initialization/provisioning is required |
| Bootstrap/runtime role separation and grants | `PARTIALLY IMPLEMENTED` | Role names, grants, RLS, and role checks are encoded in `financial-e2e-provision-local.mjs`; static guard tests pass | Compose creates no roles; role/grant setup and catalog evidence require authorized database work |
| Readiness and explicit execution authorization | `IMPLEMENTED AND OFFLINE-TESTED` | `validateFinancialE2eReadiness` and `canStartFinancialScenario`; safety tests reject missing authorization, invalid identity evidence, and enabled runner | Authorization is a pure gate, not approval to mutate a database |
| Fixture manifest ownership and immutable snapshots | `IMPLEMENTED AND OFFLINE-TESTED` | `financial-e2e-fixture-lifecycle.mjs`: `createFixtureManifest`, `recordFixtureIdentifiers`, `authorizeFixtureCleanup`, frozen snapshots; lifecycle tests cover foreign, duplicate, malformed, and mutated resources | In-process freezing is not a database or cryptographic security boundary |
| Fixture creation orchestration | `NOT IMPLEMENTED` | No executable creator calls application actions, records returned database IDs, or transitions a live run to `FIXTURE_READY`; only pure recording helpers exist | Requires separately reviewed, run-owned fixture creation against the isolated target |
| Cleanup authorization and dependency ordering | `IMPLEMENTED AND OFFLINE-TESTED` | `authorizeFixtureCleanup` and `buildOwnedCleanupPlan`; lifecycle tests verify identity binding, explicit authorization, exact snapshots, and dependency ordering | Plan generation has not deleted or inspected database rows |
| Cleanup execution and verified residual checks | `NOT IMPLEMENTED` | `recordCleanupSuccess` validates a future executor result but no trusted executor exists; no residual-row query is wired | Requires a separately authorized executor, row-count verification, and failure recovery evidence |
| Tenant isolation and RLS evidence | `IMPLEMENTED BUT NOT BEHAVIORALLY VERIFIED` for this audit | Prior local security artifact records 19/19 assertions; static RLS/provisioning tests pass; policy generation is in `financial-e2e-provision-local.mjs` | This audit made no connection and produced no fresh RLS evidence |
| Purchase/sales/payment/sequence prerequisites | `PARTIALLY IMPLEMENTED` | Production actions and pure GST/rollback contracts exist; financial matrix lists required scenarios; no scenario operations are registered by Phase E | Fixtures, authenticated live action invocation, rollback assertions, and cleanup remain blocked |
| Evidence freshness and run/database binding | `IMPLEMENTED AND OFFLINE-TESTED` | Identity evidence includes version, `runId`, target binding, timestamp, database, role, marker, application name, server identity, and role flags; stale/mismatched evidence tests pass | Freshness can only be established by an authorized connected verifier |

### Offline evidence versus database evidence

The 82 passing tests establish fail-closed control flow, structural
validation, source-contract wiring, and mocked identity/lifecycle behavior.
They do not establish that a PostgreSQL server contains the required marker or
roles, that RLS policies are installed and enforced, that application cookies
resolve to a real tenant, that fixtures can be created, or that cleanup leaves
zero rows. The prior 19/19 RLS/security result remains separately recorded
local evidence and was not refreshed during this audit.

### Single next component

The smallest missing component with the clearest dependency boundary is a
**pure fixture-creation orchestration contract**: an offline-testable adapter
that accepts an explicitly injected, authenticated application-operation
provider, creates one run-owned manifest batch, records every returned
resource identifier exactly once, and transitions only to `FIXTURE_READY` or
an ownership-qualified failure state. It must not connect to a database,
perform cleanup, or register financial scenarios in its first implementation.

Implementing that contract still does not authorize database mutation. Before
any real provider is wired, Masum Rafique must separately authorize isolated
marker/role provisioning, verify connected identity, approve fixture scope,
and approve the trusted cleanup executor and residual-check procedure.

### Phase F validation

Commands and outcomes:

- `node --test .\tests\financial-e2e*.test.mjs .\tests\rls-policy-coverage.test.mjs`
  — `82 PASS`, `0 FAIL`;
- Node syntax checks for readiness, safety, fixture lifecycle, provisioning, and
  static-guard scripts — pass;
- `node .\scripts\financial-e2e-provisioning-static-guard.mjs` — `PASS`;
- `node .\scripts\financial-e2e.mjs` with no authorization — exits `2` with
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

The runner therefore remains disabled at its first authorization guard; no
database connection was attempted by this validation.

## Phase G — run-owned fixture-creation orchestration contract

Phase G added the pure orchestration contract in
`scripts/financial-e2e-fixture-orchestration.mjs` on 2026-10-25 18:09 IST.
It composes the existing lifecycle helpers and does not introduce a second
manifest format, lifecycle state, cleanup path, database provider, or
financial scenario registry.

`orchestrateRunOwnedFixtures()`:

- requires a valid run ID and a non-empty approved required-resource
  specification;
- requires an explicitly injected provider;
- passes only the run ID and frozen normalized specification to that provider;
- requires one returned identifier list;
- checks required resource counts before allowing `FIXTURE_READY`;
- delegates ownership, duplicate, malformed, unsupported-resource, and
  identifier validation to `recordFixtureIdentifiers()`;
- routes provider, completeness, and manifest-recording failures through
  `recordFixtureCreationFailure()`;
- records confirmed, valid partial identifiers as
  `FIXTURE_FAILED_CLEANUP_READY`;
- records uncertain or invalid partial ownership as `FIXTURE_FAILED`;
- never invokes cleanup and never registers financial operations.

Offline tests cover successful provider orchestration, invalid run/specification,
missing provider, pre-creation failure, confirmed partial failure, missing
required resources, duplicate IDs, foreign ownership, malformed/unapproved
resources, no cleanup/database access, and no success-shaped result after
manifest-recording failure.

Phase G does not prove real fixture creation, database ownership, cleanup,
residual-row absence, RLS, tenant isolation, or financial correctness. A real
provider remains blocked until marker/role provisioning, connected identity
evidence, fixture-scope approval, trusted cleanup, and explicit execution
authorization are separately completed.

## Phase H — disposable provisioning and trusted cleanup design review

Review date: 2026-10-25 18:12 IST. This phase is a design and offline
validation review only. No database connection, provisioning, fixture
creation, cleanup execution, financial scenario, environment change, or
container operation was performed.

### Provisioning sequence and fail-closed contract

The future disposable-target operation must be a separately authorized local
operation. It must not be reachable through the application-hosted binding,
the browser, a public route, or the standalone financial scenario runner.
The operator must select a target whose configuration is distinct from
`DATABASE_URL`, whose parsed database identity is different from the ordinary
target, whose database name identifies `test` or `e2e`, and whose endpoint is
not Supabase or a pooler endpoint. DNS or endpoint identity uncertainty is a
stop condition, not a reason to continue.

The required order is:

1. Record the run ID, approved disposable target, authorization, timeout, and
   lock policy without logging credentials or complete connection strings.
2. Validate the target with `validateFinancialE2eTarget()` before opening a
   client.
3. Connect only with the approved bootstrap connection and an explicit
   `application_name=pharmnos-financial-e2e` value. Verify
   `current_database()`, `current_user`, `session_user`, server address and
   port, application name, and the independent environment marker.
4. Independently establish the marker on the disposable target through an
   approved local initialization step. A connection-string parameter or
   caller-supplied environment variable is not proof that the database
   contains the marker.
5. Verify the bootstrap role is the approved provisioning principal and is
   permitted to create only the approved disposable baseline. Verify the
   runtime role exists separately, has `LOGIN`, `NOSUPERUSER`, and
   `NOBYPASSRLS`, and has no `CREATE` privilege on the application schema.
6. Stop on any non-empty public schema, incompatible object, missing parent
   type/table/constraint, conflicting composite key, unexpected data, or
   missing role/grant. The generated baseline is from-empty and must never be
   treated as an additive migration for a populated target.
7. Apply the reviewed baseline, grants, forced-RLS policies, and
   bootstrap-owned trigger controls in one bounded transaction with
   `ON_ERROR_STOP`, approved lock/statement timeouts, and rollback on error.
8. Reconnect as the runtime role and collect sanitized catalog evidence for
   database identity, role flags, schema/table/sequence/function privileges,
   RLS and forced-RLS state, policies, constraints, triggers, and controlled
   function ownership. Inaccessible metadata is `UNVERIFIED`, never inferred
   absent.
9. Bind the resulting identity evidence to the approved target and run ID.
   `validateDatabaseIdentityEvidence()` must pass immediately before any
   fixture operation. Stale, future, mismatched-target, mismatched-run,
   mismatched-database, mismatched-role, marker, application-name, server,
   `rolsuper`, or `rolbypassrls` evidence stops the run.
10. Only after all post-provision evidence passes may a separately approved
    fixture provider be considered. Provisioning success alone does not
    authorize financial scenarios.

Compose currently configures a PostgreSQL 17 Alpine container, required
credentials/database variables, loopback port, tmpfs data, no restart, an
isolation label, and a healthcheck in
`docker-compose.financial-e2e.yml`. It does **not** create the custom marker,
bootstrap role, runtime role, grants, schema, RLS policies, triggers, or
catalog evidence. `financial-e2e-provision-local.mjs` currently verifies an
already-established marker and bootstrap identity, checks an empty public
schema, and applies the baseline/security controls; it does not establish
the marker or create either role. Its role checks also must not be described
as proof that the required privileges were provisioned until an authorized
connected catalog review confirms them.

The current pure identity contract is useful but bounded: mocked
`verifyDatabaseIdentity()` tests prove query-shape and fail-closed evidence
validation only. The evidence model verifies database, session/current role,
marker, application name, server address/port, `rolsuper`, and
`rolbypassrls`; it does not itself prove `rolcanlogin`, schema `CREATE`
revocation, complete table/sequence/function grants, or independent marker
provenance. Those checks belong to the connected provisioning/catalog phase.

### Cleanup trust boundary and failure model

Cleanup must be a separate destructive operation, never an implicit
provisioning or fixture-success side effect. The future executor must require
all of the following immediately before deletion:

- explicit cleanup authorization for the exact run and target;
- a frozen manifest produced by the existing lifecycle contract;
- `FIXTURE_READY` or `FIXTURE_FAILED_CLEANUP_READY`, never an uncertain
  `FIXTURE_FAILED` manifest;
- fresh connected identity evidence bound to the same run and approved target;
- the expected disposable database, bootstrap cleanup principal, and marker;
- exact ownership validation for every resource, including resource type,
  identifier, tenant/run ownership, and rejection of demo-tenant or
  foreign-run resources;
- an immutable cleanup plan whose resources and dependency order match the
  authorized snapshot exactly.

The executor must delete dependents before parents using the existing
`RESOURCE_CLEANUP_ORDER`; it must not infer application-level dependencies or
assume tenant cascading deletes remove audit, ledger, stock, payment, GST
history, or other records. Storage objects remain unsupported by the current
financial fixture contract and must cause a stop rather than an attempted
best-effort deletion.

Deletion must run in bounded transactions or explicitly documented
resource-group transactions. A failure must roll back the active transaction
where possible, record sanitized failure evidence, and leave the manifest in
`CLEANUP_FAILED`; it must never report `CLEANUP_COMPLETE` after a partial or
uncertain deletion. If ownership, connected identity, row counts, dependency
state, or transaction outcome cannot be verified, the executor must stop and
retain the failure state for human recovery. It must not broaden the target,
retry against another database, substitute identifiers, or fall back to a
superuser as an application-isolation shortcut.

After deletion, the executor must query every supported fixture table for
run-owned residual rows, verify zero residual rows, and verify that required
security controls remain present. Only a successful result containing the
exact authorized plan and cleanup order may be passed to
`recordCleanupSuccess()`. Durable sanitized evidence should contain the run
ID, target binding or non-secret database identity, verified role, start/end
times, plan hash or equivalent stable plan reference, deleted-resource
counts, residual counts, transaction outcome, and control-preservation
result; it must not contain passwords, full URLs, row contents, or tokens.

The existing `authorizeFixtureCleanup()` and `buildOwnedCleanupPlan()` are
authorization and planning contracts, not cleanup execution. In-process
freezing prevents accidental mutation by the contract but is not a
cryptographic trust boundary. A future executor must own the connected
verification, deletion, residual checks, and evidence production.

### Phase H implementation-to-contract disposition

| Area | Classification | Current evidence | Remaining requirement |
|---|---|---|---|
| Explicit authorization and disposable target selection | `IMPLEMENTED AND OFFLINE-TESTED` | `financial-e2e-safety.mjs`, `financial-e2e-readiness.mjs`, safety tests | Connected operator authorization and target evidence |
| Connected database identity and run binding | `IMPLEMENTED BUT NOT BEHAVIORALLY VERIFIED` | `verifyDatabaseIdentity()`, evidence validation, mocked identity tests | Fresh connected evidence from the approved disposable target |
| Independent marker establishment | `NOT IMPLEMENTED` | Compose and provisioner only verify marker presence | Separately reviewed local initialization/provisioning step |
| Bootstrap/runtime role separation | `PARTIALLY IMPLEMENTED` | Role names and intended grants in provisioner/review SQL | Authorized role creation/verification and catalog evidence |
| Runtime `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, and schema restrictions | `PARTIALLY IMPLEMENTED` | Runtime flags are checked by pure evidence validation and prior local artifact | Connected role/catalog verification for all properties |
| Least-privilege grants and default privileges | `PARTIALLY IMPLEMENTED` | Review SQL and provisioner statements; static guard passes | Connected effective-grant and function-execution evidence |
| Fixture manifest, ownership, and immutable cleanup snapshot | `IMPLEMENTED AND OFFLINE-TESTED` | Lifecycle tests and Phase G orchestration tests | Real provider must return verifiable run-owned resources |
| Cleanup authorization and dependency plan | `IMPLEMENTED AND OFFLINE-TESTED` | Lifecycle identity, authorization, mutation, and ordering tests | No executor exists; no rows were deleted in Phase H |
| Cleanup execution and residual verification | `NOT IMPLEMENTED` | `recordCleanupSuccess()` validates a future executor result only | Trusted executor, transaction recovery, residual queries, durable evidence |
| Tenant/RLS and financial behavior | `BLOCKED BY AUTHORIZATION OR ENVIRONMENT` | Prior local evidence remains separately recorded; no Phase H connection | Authorized disposable run and scenario-specific evidence |

### Phase H validation

Commands and outcomes:

- `node --test .\tests\financial-e2e-fixture-orchestration.test.mjs .\tests\financial-e2e*.test.mjs .\tests\rls-policy-coverage.test.mjs`
  — `93 PASS`, `0 FAIL`;
- Node syntax checks for safety, readiness, provisioning, lifecycle,
  orchestration, and static-guard scripts — pass;
- `pnpm exec tsc --noEmit` — pass;
- `node .\scripts\financial-e2e-provisioning-static-guard.mjs` — `PASS`;
  expected GST enums `4`, GST tables `7`, RLS tables `26`, destructive
  statements `none`, forbidden privileges `absent`;
- `node .\scripts\financial-e2e.mjs` without authorization — exits `2` with
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

These validations used source files, pure helpers, static artifacts, and
mocked control flow only. No database or external service was accessed.

and the inverse:

```prisma
accounting_decisions purchase_gst_accounting_decisions[]
  @relation("purchase_gst_decision_calculation")
```

The target key already exists on `purchase_gst_calculations` as
`@@unique([tenant_id, purchase_invoice_id, id])`.

## Supporting provisioning design

### Preflight/catalog guard

A future execution wrapper must stop unless all of the following are true:

- target identity is the approved disposable database;
- operator is the separate bootstrap role;
- runtime role remains `NOSUPERUSER` and `NOBYPASSRLS`;
- no same-name incompatible object exists;
- required parent tables and scalar types match Prisma;
- duplicate composite-key checks return no conflicts;
- unexpected existing rows have an approved compatibility plan;
- required pointer values are null or valid;
- no destructive statement is present;
- lock, timeout, transaction, and abort settings are approved.

The offline static guard is
`scripts/financial-e2e-provisioning-static-guard.mjs`. It does not connect to
PostgreSQL and checks the generated artifact for required models, enums,
mapped constraints, Option B evidence, and destructive statements.

### Role and grant matrix

The repository supports only two concrete local principals. The matrix below
therefore distinguishes what can be granted now from controls that require a
future separately provisioned role:

| Principal | Schema `USAGE` | Direct table access | History mutation | `TRUNCATE` |
|---|---|---|---|---|
| `pharmnos_e2e` | provisioning only | owns/creates approved objects | not an application path | not routine operation |
| `pharmnos_e2e_runtime` | `USAGE`, no `CREATE` | explicit table-level grants only | no direct GST-history update/delete | none |
| Browser/`anon` principal | not present in repository | no grant can be created from current evidence | none | none |
| Restricted backend/function owner | not present in repository | provisioning must stop until separately created and reviewed | controlled functions only | none |

The final grant artifact must explicitly define table, sequence, schema,
function `EXECUTE`, ownership, and default privileges. It must not preserve
the broad `anon`/`authenticated` grants from the legacy RLS SQL without an
explicit review.

### RLS policy design

Every tenant-owned baseline and GST/posting table must have RLS enabled.
Application-facing roles must use forced RLS. Tenant predicates must fail
closed when the tenant claim is absent. The selected design requires ordinary
role tests with `rolsuper=false` and `rolbypassrls=false`.

The existing `FOR ALL TO authenticated` policy is not sufficient as the final
immutability policy. The final artifact must use explicit read/write policy
commands where history protection requires it:

- evidence, calculations, decisions, events, and event lines: controlled
  insert path; no unrestricted update/delete;
- finalized GST facts: immutable after finalization;
- posting operations: controlled insert and guarded status updates;
- cross-tenant reads/writes: denied;
- missing tenant claim: denied.

The security artifact requires a future controlled function owner to be the
bootstrap owner only unless a separately provisioned owner is approved. This
is a security-sensitive unresolved choice, not evidence that a function-owner
role exists. Such functions must use `SECURITY DEFINER`, `SET search_path =
pg_catalog, public`, explicit argument types, no caller-controlled dynamic
SQL, and `EXECUTE` only for `pharmnos_e2e_runtime`; `PUBLIC` execution must be
revoked. The runtime role must never own those functions. If ownership,
function names, or execution roles are not explicitly supplied, provisioning
must stop.

#### Owner's Decision - controlled-function ownership (2026-10-25)

For this local provisioning package, the owner selected **bootstrap-owned
database trigger functions only**. The existing `pharmnos_e2e` role owns
immutable-history and posting-transition trigger functions; they are not
caller-invocable APIs, and no new function-owner role is created or assumed.
No `SECURITY DEFINER` application function is included in this package.

Rationale: preserve the existing two-role boundary and avoid silently
granting elevated privileges. Consequence: posting and reconciliation remain
service-led; any future privileged caller-invocable function requires a new
owner decision, explicit role provisioning, fixed search-path review, and
separate authorization. The runtime role must never own trigger or privileged
functions.

#### Explicit RLS review contract

The companion RLS artifact requires deterministic policy names for all 26
tenant-scoped tables:

- `tenant_select_<table>` and `tenant_insert_<table>` for every table;
- `tenant_update_<table>` for mutable tables;
- no direct update/delete policies for the six immutable GST-history tables;
- no update/delete policy for `audit_logs`;
- no runtime delete privilege for immutable history.

The direct tenant predicate is:

```sql
tenant_id::text = NULLIF(
  current_setting('request.jwt.claim.tenant_id', true),
  ''
)
```

It must be used in both `USING` and `WITH CHECK` for read/write policies.
The root `tenants` table uses `id::text`; `role_permissions` uses an
`EXISTS` subquery through `roles.tenant_id`. A missing or empty claim must
match no row and must reject writes. The final artifact must explicitly
enable and force RLS on every listed table for application-facing access.

#### Catalog checks after authorized provisioning

Using only `pharmnos_e2e_runtime` for ordinary-role evidence, collect
sanitized catalog results for:

1. `pg_class.relrowsecurity` and `relforcerowsecurity` for all 26 tables.
2. `pg_policies` policy name, command, roles, `qual`, and `with_check`.
3. `information_schema.role_table_grants` for runtime table privileges.
4. `information_schema.role_routine_grants` for controlled-function
   `EXECUTE`; no unexpected function execution grants.
5. `pg_proc.prosecdef`, `proconfig`, and owner for every controlled function.
6. `pg_authid.rolsuper` and `rolbypassrls` for the runtime role, only if the
   authorized verifier can inspect them without bypassing policy.
7. `pg_constraint` and `pg_trigger` for immutable-history and posting guards.

Expected evidence is PASS only when all required rows are present and
consistent. Inaccessible metadata is `UNVERIFIED`, never inferred absent.

#### Ordinary runtime behavior tests

After catalog evidence passes, the separately authorized test run must use
`pharmnos_e2e_runtime` and verify:

- same-tenant SELECT/INSERT/UPDATE behavior succeeds where policy allows;
- another tenant's rows are invisible and writes are rejected;
- absent, empty, malformed, and mismatched tenant claims fail closed;
- runtime role is neither superuser nor `BYPASSRLS`;
- immutable GST UPDATE/DELETE attempts fail;
- finalized-invoice GST field/pointer mutation attempts fail;
- posting transitions permit only `PROCESSING` to `COMPLETED` or `FAILED`;
- duplicate idempotency keys are deterministic;
- conflicting payload hashes are rejected;
- concurrent claims cannot create two posting operations;
- controlled functions cannot be invoked by unauthorized principals.

These are runtime checks and are not represented as passed by this offline
artifact review.

### Immutable-history controls

The hybrid control requires:

- service methods for corrections and accounting decisions;
- append-only evidence revisions and reconciliation events;
- `RESTRICT` foreign keys for historical references;
- no direct delete privilege for history;
- no generic update privilege for finalized records;
- database trigger or controlled-function enforcement for mutation rejection;
- preserved declared, calculated, and accounting-accepted values;
- actor, rationale, decision reference, rule version, and correction-chain
  evidence.

### Posting and idempotency safeguards

The posting workflow must preserve:

- unique `(tenant_id, idempotency_key)`;
- unique `(tenant_id, purchase_invoice_id)`;
- request-payload hash conflict detection;
- explicit guarded status transitions;
- atomic invoice, stock, ledger, and audit updates;
- deterministic retry behavior;
- concurrency-safe claiming;
- no posting with unresolved material GST discrepancies.

The database schema supplies structural keys, but the service transaction and
any approved trigger/function controls remain required for legal transitions.

### Rollback and partial-failure runbook

1. Capture sanitized preflight catalog evidence.
2. Apply only after target, role, conflict, and approval guards pass.
3. Execute dependency stages with bounded locks and timeouts.
4. Stop on the first mismatch, validation failure, or unexpected row state.
5. Preserve failure evidence; do not continue blindly.
6. Do not delete GST history as rollback.
7. For a disposable target, use a separately authorized fresh database for
   recovery when partial rollback is unsafe.
8. Re-run the catalog guard before retrying.
9. Require exact post-provision catalog evidence before fixture creation.

Enums, backfills, non-null changes, foreign keys, and history controls can
have irreversible or data-dependent rollback limits. A fresh disposable
database is the preferred recovery path, not `DROP ... CASCADE`.

### Exact preflight and stop sequence

Before any separately authorized local provisioning execution:

1. Verify the compose target is the existing loopback-only disposable service,
   with the approved database name, image, and port. Do not use the runtime
   role for provisioning.
2. Run the established target and identity guards without printing the URL or
   password. Require the expected database, bootstrap operator, runtime role,
   application marker, server address, and separation from ordinary
   `DATABASE_URL`.
3. With the bootstrap role, inspect only catalogs for existing schemas,
   tables, types, constraints, policies, functions, and privileges. Stop on
   an incompatible object, unexpected non-empty data, missing parent type, or
   a role mismatch.
4. Verify the runtime role is exactly `rolsuper = false` and
   `rolbypassrls = false`. Stop if either value is not exact false or cannot be
   evidenced through the approved verifier.
5. Verify every required parent table, composite key, enum, and mapped
   constraint before creating dependent objects. Stop on duplicate or
   conflicting names.
6. Verify the review artifacts are the current checked-in names:
   generated baseline, additive wrapper, security controls, and RLS policy
   specification. Stop if any cross-reference or static guard fails.
7. Apply no artifact if any stop condition occurs. Preserve sanitized evidence
   and require a new authorization for remediation.

The expected preflight evidence is a sanitized identity record, object
inventory, conflict result, role-attribute result, and static-guard result.
No business-row contents or secrets belong in the evidence.

## Post-provision verification checklist

After separate authorization, collect sanitized evidence for:

- target identity and operator role;
- exact enum labels and order;
- all baseline and GST/posting tables;
- columns, types, precision, nullability, and defaults;
- primary, unique, and composite keys;
- foreign-key mappings, mapped names, and delete actions;
- indexes and validation status;
- RLS enabled and forced state;
- policy roles, commands, predicates, and checks;
- effective schema/table/sequence/function privileges;
- immutable-history negative mutation/deletion tests;
- Option B cross-tenant and orphan-reference rejection;
- posting idempotency and guarded transition tests;
- before/after metadata hash.

No business-row contents should be included in the artifact.

## Remaining blockers

- The generated baseline is not an additive migration.
- Exact restricted backend and controlled-function role names are not defined
  in the repository.
- The final grant matrix and default privileges are not yet an executable
  artifact.
- The final RLS policy role/command split and trigger/function implementation
  still require concrete implementation work.
- Existing target compatibility checks, locks, and timeout behavior have not
  been run.
- No database provisioning, RLS testing, fixture operation, or financial E2E
  scenario has been executed.

## Separate local execution procedure

Only after the final additive wrapper, grant artifact, policy artifact,
immutability controls, and rollback runbook are reviewed:

1. Load the approved local disposable configuration without printing secrets.
2. Verify the target guard and runtime identity guard.
3. Confirm the operator is `pharmnos_e2e`; do not use
   `pharmnos_e2e_runtime` to create schema, grant privileges, or own
   controlled functions.
4. Apply only a finalized additive artifact after catalog and object-conflict
   guards pass.
5. Re-read catalogs using `pharmnos_e2e_runtime`, including tables, enums,
   keys, policies, RLS forced state, effective grants, and function execution
   privileges.
6. Run ordinary-role same-tenant, cross-tenant, missing-claim, immutable
   update/delete, and posting-transition rejection tests.
7. Stop before fixtures unless all post-provision evidence passes.
8. Use the bootstrap role only for separately authorized disposable cleanup;
   do not treat cleanup access as application isolation evidence.

This procedure is proposed only. It was not executed.

## Offline validation

The following commands do not connect to PostgreSQL:

```powershell
node --check .\scripts\financial-e2e-provisioning-static-guard.mjs
node --test .\tests\financial-e2e-provisioning-static-guard.test.mjs
node .\scripts\financial-e2e-provisioning-static-guard.mjs
$env:DATABASE_URL='postgresql://offline@127.0.0.1:55432/pharmnos_financial_e2e'
$env:DIRECT_URL='postgresql://offline@127.0.0.1:55432/pharmnos_financial_e2e'
pnpm exec prisma validate --schema .\prisma\schema.prisma
```

No command above applies SQL or contacts the configured database.

The full generated SQL remains a baseline reference only. Neither it nor the
additive wrapper nor either security review artifact is an approved execution
command. The additive wrapper is intentionally rollback-bounded and must not
be treated as a migration for a populated database.

## Phase I — disposable-target initialization contract

Implementation date: 2026-10-25 18:17 IST. Phase I adds a pure
initialization evaluator in
`scripts/financial-e2e-initialization-contract.mjs`. It models the required
authorization, target, marker, role, catalog, and post-initialization identity
decisions without creating a database client or opening a connection.

### Contract inputs and outputs

`evaluateDisposableInitialization()` accepts:

- explicit authorization bound to the run, initialization attempt, and target;
- the existing target configuration consumed by
  `validateFinancialE2eTarget()`;
- a run ID and unique initialization-attempt ID;
- distinct approved bootstrap and runtime role names;
- synthetic bootstrap identity, independent marker, role, catalog, and
  post-initialization identity evidence;
- an evaluation clock and evidence-age limit for deterministic tests.

Every evidence object must carry the same run ID, initialization-attempt ID,
approved target binding, and fresh verification timestamp. Marker evidence must
identify `connected_catalog` as its source and
`independentlyEstablished: true`; environment, connection-string, caller, or
self-asserted marker values are rejected.

The evaluator requires separate bootstrap/runtime identities, runtime
`LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`, bootstrap login evidence, verified
schema restrictions, least-privilege grants, default privileges, RLS, and
trigger ownership. It also delegates final runtime database identity checks to
`validateDatabaseIdentityEvidence()`.

Success returns a deliberately labelled synthetic result:
`evidenceClass: SYNTHETIC_OFFLINE`, `ready: true`,
`connectedVerificationModeled: true`, and `databaseAccessed: false`.
This means the supplied evidence objects satisfy the pure contract shape; it
does not claim that PostgreSQL supplied those facts. Failures return
`ok: false`, `ready: false`, deduplicated sanitized errors, and no supplied
credentials, full URLs, tokens, or arbitrary evidence payloads.

### Fail-closed states

Initialization is blocked for missing or false authorization, invalid target
or run/attempt binding, missing or configuration-only marker evidence,
bootstrap/runtime identity collision, runtime superuser or `BYPASSRLS`,
missing schema/grant/default-privilege/RLS/trigger evidence, stale/future or
cross-run evidence, contradictory catalog results, populated-schema evidence,
post-initialization identity mismatch, or any target-validation failure.
The evaluator does not fall back to `DATABASE_URL`, activate the scenario
runner, create fixtures, invoke cleanup, or interpret Compose/review SQL as
executed provisioning.

### Synthetic evidence versus connected database evidence

The Phase I tests use controlled in-memory objects to exercise the decision
logic. They prove only composition, binding, freshness, rejection, and
sanitized-output behavior. They do not prove that a database exists, that a
marker was independently established, that roles or grants are present, that
RLS or triggers are enforced, or that financial behavior is correct.

Connected evidence still requires a separately authorized local operation that
establishes the marker and roles, applies the reviewed baseline and controls,
reconnects as the runtime role, verifies the complete catalog, and captures
fresh run-bound evidence. The existing
`scripts/financial-e2e-provision-local.mjs` remains outside this pure
contract and remains a database-capable operation that was not invoked here.

### Phase I validation

- `node --test .\tests\financial-e2e-initialization-contract.test.mjs`
  — `12 PASS`, `0 FAIL`;
- `node --test .\tests\financial-e2e-fixture-orchestration.test.mjs .\tests\financial-e2e*.test.mjs .\tests\rls-policy-coverage.test.mjs`
  — `105 PASS`, `0 FAIL`;
- Node syntax checks for the Phase I module/test and existing safety,
  readiness, provisioning, lifecycle, orchestration, and static-guard scripts
  — pass;
- `pnpm exec tsc --noEmit` — pass;
- `node .\scripts\financial-e2e-provisioning-static-guard.mjs` — `PASS`;
- `node .\scripts\financial-e2e.mjs` without authorization — exits `2` at the
  explicit `ALLOW_FINANCIAL_E2E` guard.

No database, Supabase project, remote service, container, fixture, cleanup
executor, or financial scenario was accessed or executed. The next safe step
is a separately approved implementation of marker/role establishment and
connected catalog verification; do not wire a real provider or enable the
runner from this pure contract alone.

## Phase J — local provisioning procedure review

Review date: 2026-10-25 18:23 IST. This is a design review of the proposed
local disposable-database initialization procedure and existing SQL artifacts.
No SQL was executed, no database was provisioned, and no database connection
was opened.

### Artifact classification and review findings

| Artifact | Classification | Finding |
|---|---|---|
| `docker-compose.financial-e2e.yml` | Configuration | Starts an isolated-looking PostgreSQL container with loopback binding, tmpfs, no restart, label, and healthcheck; it does not create roles, grants, marker, schema, RLS, triggers, or catalog evidence. |
| `scripts/financial-e2e-initialization-contract.mjs` | Pure evaluator | Models authorization, target binding, independent marker evidence, role properties, catalog evidence, freshness, and post-initialization identity without a client or connection. |
| `scripts/financial-e2e-provision-local.mjs` | Database-capable executable | Requires pre-existing target configuration and roles, verifies an existing marker and bootstrap identity, rejects a populated public schema, and applies the generated baseline/control SQL transactionally. It does not establish the marker or create either role, and it has no explicit run/attempt authorization input. |
| `prisma/financial-e2e-security-controls.review.sql` | Review-only SQL | Describes runtime grants, default privileges, RLS assumptions, and bootstrap-owned trigger functions. Its comments incorrectly describe the roles as established by Compose; Compose does not establish them. |
| `prisma/financial-e2e-additive-provisioning.review.sql` | Review-only SQL | Contains an empty-schema guard, includes the complete from-empty baseline, and rolls back. It explicitly stops short of grants, policies, controls, and verification. |
| `scripts/financial-e2e-provisioning-static-guard.mjs` | Offline static guard | Checks source/artifact completeness, required RLS markers, role names, review-only labels, and destructive/privilege patterns; it does not prove executable SQL behavior. |

The review-only SQL must not be described as executed provisioning. The
existing executable provisioner must not be treated as a complete initializer
until marker establishment, role establishment/verification, authorization
binding, and post-provision catalog evidence are supplied.

### Independent marker establishment

The only acceptable future method is an explicitly authorized local bootstrap
operation against a target already accepted by
`validateFinancialE2eTarget()`. The bootstrap operation must:

1. Bind the operation to a unique run ID and initialization-attempt ID.
2. Verify the connected database name, server identity, bootstrap current and
   session role, and approved target binding before mutation.
3. Establish `pharmnos.financial_e2e_marker` through an approved database-local
   mechanism owned by the bootstrap principal, with the exact value
   `pharmnos-financial-e2e`.
4. Verify the value through a subsequent connected database/catalog query.
5. Record sanitized marker evidence with source
   `connected_catalog`, `independentlyEstablished: true`, database identity,
   target binding, run ID, attempt ID, and fresh timestamp.

An environment variable, `TEST_DATABASE_MARKER`, connection-string parameter,
`application_name`, or caller assertion may select or describe the expected
marker, but none independently proves that the database contains it. If the
marker cannot be established and re-read through the approved bootstrap
connection, initialization stops. Ordinary application databases, Supabase,
pooler endpoints, shared targets, ambiguous DNS, mismatched database names,
and mismatched server identities are rejected before marker mutation.

### Proposed role-and-privilege matrix

| Principal/control | Required purpose | Necessary evidence or privilege | Classification |
|---|---|---|---|
| `pharmnos_e2e` | Local bootstrap, approved baseline/security installation, and owner of bootstrap-created objects | Connected current/session identity; `LOGIN`; approved ability to create the disposable baseline and security objects | **Necessary but not established by Compose** |
| `pharmnos_e2e_runtime` | Ordinary application-facing fixture/scenario verification under RLS | `LOGIN`, `rolsuper=false`, `rolbypassrls=false`; schema `USAGE`; no schema `CREATE`; explicit table/type privileges; no routine ownership | **Necessary; partly described, not connected-verified** |
| Runtime table privileges | Read and create/update only where the application contract requires it | Explicit `SELECT`, `INSERT`, `UPDATE` on listed ordinary tables; immutable GST history only `SELECT`/`INSERT`; no broad role-wide DML | **Partly implemented in review/provisioner SQL** |
| Runtime sequence privileges | Required only if runtime writes use sequence-backed defaults | Explicit per-sequence `USAGE`/`SELECT` or equivalent verified privilege, if Prisma schema/runtime behavior requires it | **Uncertain; absent from reviewed grant matrix and must not be inferred** |
| Runtime function privileges | No caller-invocable privileged function exists in the selected local package | No unexpected `EXECUTE`; trigger functions are database-trigger paths, not runtime APIs | **Supported only for current trigger model** |
| Schema ownership | Bootstrap owns approved baseline/control objects; runtime must not own them | Catalog owner evidence; runtime cannot create or alter schema objects | **Necessary; connected verification pending** |
| Default privileges | Prevent future bootstrap-created objects from becoming public or broadly executable | Bootstrap default privileges revoke public table/sequence/function access; exact future-object behavior must be catalog-reviewed | **Partly implemented in review/provisioner SQL** |
| RLS | Tenant isolation and fail-closed missing/malformed claims | RLS enabled and forced for all listed tables; explicit policies with `USING`/`WITH CHECK`; runtime must exercise policies as non-bypass role | **Specified/static-tested; runtime behavior pending** |
| Trigger ownership | Immutable history and guarded posting transitions | Bootstrap-owned trigger functions/triggers; runtime never owns or replaces them | **Specified and generated by provisioner; not connected-verified** |
| Constraints/FKs | Structural tenant/GST/posting integrity | Baseline constraints and mapped FKs match Prisma; no destructive replacement | **Static baseline evidence only** |
| Browser/`anon`/`authenticated` | Not part of the selected local two-role package | No grants or role assumptions may be introduced from legacy SQL without an owner decision | **Unsupported by current artifacts** |

Privilege conclusions are deliberately conservative. `GRANT USAGE` on the
schema and explicit table/type access are supported by the reviewed artifacts.
Sequence access, routine execution, role-creation authority, ownership transfer,
and any privileged application function are not fully established by the
repository and remain stop conditions until explicitly specified and verified.
The existing legacy `anon`/`authenticated` grants are not evidence for this
local package.

### Proposed fail-closed initialization sequence

| Step | Required action | Current disposition |
|---|---|---|
| 1 | Require explicit authorization for the exact target, run, and attempt; do not log credentials or full URLs | **Partially implemented** by the pure Phase I evaluator; executable provisioner has no authorization/run-attempt input |
| 2 | Validate target separation, database name, marker configuration, endpoint, and DNS identity with existing safety controls | **Implemented and offline-tested**; no connected target was used |
| 3 | Connect as the approved bootstrap role and verify database, current/session role, server address/port, application name, and target binding | **Implemented but not behaviorally verified**; provisioner verifies only part of this set |
| 4 | Establish and re-read the independent database marker | **Not implemented**; provisioner only reads an existing marker |
| 5 | Establish or verify distinct bootstrap/runtime roles and runtime `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS` | **Partially implemented**; role names and some checks exist, role creation and full catalog proof do not |
| 6 | Reject populated or ambiguous targets, then apply only the approved baseline and controls in a bounded transaction | **Partially implemented**; empty-schema guard and transaction exist, but final executable artifact remains incomplete |
| 7 | Reconnect as runtime and verify identity, schema, grants, sequences, functions, RLS, policies, triggers, constraints, and ownership | **Not implemented as one post-provision verification stage** |
| 8 | Bind sanitized evidence to run, attempt, target, and fresh timestamps | **Implemented in pure Phase I model; not emitted by executable provisioner** |
| 9 | Permit readiness only after all checks pass; otherwise stop without fallback or automatic reset | **Implemented and offline-tested as a pure decision; connected readiness remains blocked pending authorization** |

Stop conditions include target mismatch, unexpected objects or rows,
marker mismatch, role collision, runtime privilege drift, missing sequence or
function evidence where required, failed RLS/trigger/constraint checks,
transaction error, lock/timeout failure, partial provisioning, stale or
inconclusive evidence, and any inability to distinguish the disposable target
from the ordinary application database.

### Failure recovery and interrupted initialization

The reviewed procedure may use one bounded transaction for baseline and
security-control installation after all preflight checks pass. `ON_ERROR_STOP`,
approved lock/statement timeouts, and rollback on error are required. The
current provisioner has a transaction and attempts `ROLLBACK` on error, but
this behavior has not been executed or behaviorally verified in Phase J.

There is no approved automatic reset, broad cleanup, destructive recovery, or
retry mechanism. After a partial commit, connection loss, uncertain rollback,
lock timeout, or inconclusive catalog result, the target must be marked
untrusted and initialization must stop. A human-authorized inspection must
determine whether the target is empty, compatible, or disposable for a
separate controlled recovery. The procedure must not retry against another
target, fall back to `DATABASE_URL`, use a superuser to bypass checks, or
silently continue after a partial result.

Readiness cannot be declared from a transaction commit alone. The runtime
reconnection and complete catalog verification must succeed after the
transaction. Any missing or inaccessible catalog result is `UNVERIFIED`, not
`PASS`. The existing fixture provider, cleanup planner, and scenario runner
remain unavailable until that evidence is complete.

### Phase J validation and disposition

- `node --test .\tests\financial-e2e-fixture-orchestration.test.mjs .\tests\financial-e2e*.test.mjs .\tests\rls-policy-coverage.test.mjs`
  — `105 PASS`, `0 FAIL`;
- Node syntax checks for initialization, safety, readiness, provisioning,
  lifecycle, orchestration, and static-guard scripts — pass;
- `pnpm exec tsc --noEmit` — pass;
- `node .\scripts\financial-e2e-provisioning-static-guard.mjs` — `PASS`;
  expected GST enums `4`, GST tables `7`, RLS tables `26`, destructive
  statements `none`, forbidden privileges `absent`;
- `node .\scripts\financial-e2e.mjs` without authorization — exit code `2`,
  message:
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

Phase J produces reviewed design, not executed provisioning or behavioral
database evidence. No SQL, database, Supabase project, remote service,
container, fixture, cleanup executor, or financial scenario was accessed.
The next safe step is a separately authorized decision on marker/role
establishment and the missing sequence/grant/catalog verification contract;
only after that decision should an executable initializer be considered.

## Phase K — authenticated local E2E harness preparation

Review date: 2026-10-25 IST. This phase traced the existing authenticated
application boundary and financial server actions. No database, Supabase
project, remote service, container, fixture, cleanup executor, financial
scenario, or runner activation was used.

### Application authentication and tenant-context path

The authoritative production path is:

1. `requireServerTenantContext()` in `src/lib/db/tenant-context.ts` calls
   `authAdapter.getCurrentSession()`, which obtains the request-scoped session
   through the Supabase SSR adapter and Next.js cookies.
2. The authenticated external user ID is looked up in `users.external_id`.
   The query includes active memberships, the membership role, and role
   permissions.
3. The first active membership supplies the application `tenantId`. The
   resulting context contains the application `userId`, role names, and
   resolved permission values. A caller-supplied tenant ID is not consulted.
4. `requirePermission()` checks the resolved permission list. It does not
   grant authority from request input.
5. `src/lib/financial-e2e/app-hosted-binding.ts` fixes the boundary to
   `requireServerTenantContext` and the production `requirePermission`
   implementation. It rejects construction when `NODE_ENV` is `production`,
   does not accept cookies, tokens, sessions, or tenant identity from the
   caller, and exposes no route.
6. The binding deliberately passes `scenarioOperations: {}`. Therefore
   `invokeRequestScopedFinancialE2e()` can exercise the authentication,
   permission, and safety-gate control flow, but cannot invoke a financial
   operation. This is an intentional safety property, not a missing test
   fixture.

The production tenant resolver performs a best-effort
`setAppMetadataTenantId()` backfill after membership lookup. That behavior is
part of the existing request path and is another reason a standalone Node
process must not impersonate it or treat a synthetic context as a real
authenticated request.

### Financial application integration map

| Operation | Actual entry point | Auth/tenant boundary | Transaction and side effects | Current evidence and missing proof |
|---|---|---|---|---|
| Purchase draft | `createPurchaseDraftAction` in `src/app/_actions/purchases.actions.ts` | `create_purchase`; tenant comes from `requireServerTenantContext()`; supplier, products, and GST rows are tenant-scoped | One Prisma transaction creates the purchase, line items, and optional supplier-declared GST evidence/calculation/reconciliation; redirects and path revalidation follow success | Pure GST and action-level tests exist; no authenticated database-backed request, RLS, or fixture ownership proof |
| Purchase GST acceptance | `acceptPurchaseGstAction` | `accept_purchase_gst`; membership is re-read for the resolved tenant/user | Transaction reads current evidence/calculation and creates the accounting decision; only matched reconciliation is accepted | Pure reconciliation coverage exists; no persisted permission, audit, or RLS evidence |
| Purchase discrepancy resolution/correction | `resolvePurchaseGstDiscrepancyAction` and `correctPurchaseGstEvidenceAction` | Production context and explicit GST permissions | Transactional revision/decision persistence preserves source revisions; final accounting authority remains database-backed | Pure policy coverage exists; no authenticated end-to-end resolution or immutable-history proof |
| Purchase finalization | `finalizePurchaseAction` | `finalize_purchase`; tenant-scoped purchase and supplier lookup | One Prisma transaction performs idempotency/version checks, requires evidence/calculation/decision, claims finalization, posts purchase stock/batch and supplier-ledger effects, and records posting state | Fail-closed GST and idempotency logic is source-visible; no real stock/ledger atomicity, sequence, RLS, or rollback evidence |
| Stock adjustment | `createStockAdjustmentAction` | `adjust_stock`; batch lookup requires the resolved tenant | One transaction updates batch quantity, creates stock movement, and writes an audit log | Source transaction is inspected; no authenticated tenant-isolation or rollback execution |
| Sales draft | `createSalesDraftAction` in `src/app/_actions/sales.actions.ts` | `create_invoice`; customer/profile and created rows are tenant-scoped | One Prisma transaction creates the draft and line tax facts; GST place-of-supply resolution is fail-closed for unknown state data | GST calculator tests exist; current action still derives place of supply from business state and customer billing state, so captured transaction supply facts remain a product-policy blocker |
| Sales finalization and FEFO | `finalizeSalesInvoiceAction` | `finalize_invoice`; existing invoice, customer, profile, tenant, products, and batches are resolved under the authenticated tenant | One Prisma transaction verifies snapshot readiness and totals, persists tax/snapshot facts, allocates FEFO batches, decrements stock, creates stock movements, increments `business_profiles.invoice_next_seq`, finalizes the invoice, and posts ledger effects | FEFO and pure GST tests exist; no real request, database RLS, concurrent sequence, stock/ledger rollback, or historical immutability evidence |
| Customer payment | `createCustomerPaymentAction` | `view_customer_ledger`; customer is loaded by ID and tenant | One transaction clamps payment to the tenant customer balance, creates payment and customer-ledger rows, and updates the receivable balance | Source behavior is inspected; no authenticated balance, ledger, authorization, or rollback proof |
| Supplier payment | `createSupplierPaymentAction` | `view_supplier_ledger`; supplier is loaded by ID and tenant | One transaction clamps payment to the tenant supplier balance, creates payment and supplier-ledger rows, and updates the payable balance | Source behavior is inspected; no authenticated balance, ledger, authorization, or rollback proof |
| FEFO calculation | `fefoBatchPicker`/`allocateBatchesFefo` in `src/domain/services/fefo-batch.service.ts` | Pure function; no authorization of its own | No persistence; finalization performs the actual batch updates in its enclosing transaction | Pure allocation coverage exists; database locking and concurrent stock behavior remain unverified |
| Stock movement service | `stockMovementService` in `src/domain/services/stock-movement.service.ts` | Accepts a `TenantContext` but is not itself a server-authentication boundary | Inbound/outbound operations each open their own Prisma transaction; `recordMany` calls them separately rather than sharing one transaction | Unit/source evidence only; callers must prove permission and broader atomicity before harness use |
| Ledger impact service | `ledgerImpactService` in `src/domain/services/ledger-impact.service.ts` | Accepts a `TenantContext` but does not resolve authentication or permissions | Customer/supplier impacts each open their own Prisma transaction and update running balances | Unit/source evidence only; no request-scoped authorization or cross-operation atomicity proof |

Repositories such as
`src/repositories/purchase-invoice.repository.ts`,
`src/repositories/sales-invoice.repository.ts`,
`src/repositories/payment.repository.ts`, and
`src/repositories/ledger.repository.ts` add tenant predicates for CRUD
operations, but they are not the authenticated entry points. They accept a
`TenantContext` supplied by their caller and therefore must not be used by a
harness to bypass `requireServerTenantContext()` or `requirePermission()`.

### Smallest safe integration

The existing `invokeRequestScopedFinancialE2e()` seam is the narrowest safe
control-flow integration currently available. It should remain limited to:

- a real Next.js server-side request context;
- the existing `requireServerTenantContext()` resolver;
- the existing permission guard;
- the existing readiness/identity/fixture gates; and
- an explicitly registered operation only after the disposable target and
  fixture/cleanup prerequisites are genuinely verified.

No financial operation was registered in Phase K. Adding an operation now
would either require a fabricated session, a caller-provided tenant, a
standalone process that cannot supply Next.js request cookies, or a new
production-accessible route/test hook. Each would weaken the established
authorization boundary. The current server actions also accept `FormData`,
call `redirect()`/`revalidatePath()`, and combine orchestration with Prisma
transactions, so they are not presently a clean injectable scenario API.

The correct future integration must therefore be an internal, non-production
Next.js test harness that runs with a real authorized local session and calls
the existing server action or a carefully extracted provider-independent
application service without changing authorization semantics. That work is
blocked until a connected disposable database, independently verified target
identity/marker/roles/catalog, owned fixture lifecycle, cleanup executor, and
explicit execution authorization exist. It must not be implemented as a
public HTTP endpoint or as a synthetic session adapter.

### Phase K disposition and validation

- **Code changes:** none. The existing binding is intentionally safe and
  non-executing; no integration defect could be fixed without either adding a
  new execution path or changing production behavior.
- **Source behavior established:** production authentication derives identity
  from request cookies and application membership; permissions are resolved
  before dispatch; actions use tenant-scoped Prisma transactions and the
  listed side effects.
- **Not established:** no real Next.js request was executed; no database
  identity, RLS enforcement, permission enforcement against persisted data,
  fixture ownership, cleanup, financial lifecycle, or rollback behavior was
  verified.
- **Runner disposition:** remains disabled. The runner must continue to stop
  before scenarios and must not be activated during this phase.
- **Next safe step:** obtain explicit authorization and complete connected
  disposable-target initialization and catalog evidence. Only then design the
  internal request-scoped fixture provider and register one narrowly scoped
  scenario operation.

### Phase K exact offline validation

- `node --test .\tests\financial-e2e-fixture-orchestration.test.mjs .\tests\financial-e2e*.test.mjs .\tests\rls-policy-coverage.test.mjs`
  — `105 PASS`, `0 FAIL`.
- Node syntax checks for orchestration, authentication context, application
  boundary, initialization, fixture lifecycle/orchestration, readiness, the
  runner, and the provisioning static guard — pass.
- `node .\scripts\financial-e2e-provisioning-static-guard.mjs` — `PASS`;
  expected GST enums `4`, GST tables `7`, RLS tables `26`, destructive
  statements `none`, forbidden privileges `absent`, and the Option B
  calculation relation `present`.
- `pnpm exec tsc --noEmit` — pass.
- `node .\scripts\financial-e2e.mjs` — exit code `2`,
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.
- These are offline/source-contract results only. They do not prove a real
  request session, database identity, RLS enforcement, permission enforcement,
  financial correctness, or cleanup behavior.

## Phase L — disposable database initialization readiness plan

Review date: 2026-10-25 18:38 IST. This is an implementation plan and
readiness review only. No provisioner, Compose profile, SQL statement, database
client, database connection, fixture provider, cleanup executor, or financial
scenario was executed.

### Readiness decision

The repository is **not ready for connected initialization**. The pure
initialization evaluator can model the required evidence, but the executable
provisioner still assumes pre-existing roles and marker state, does not accept
run/attempt authorization, and does not emit the complete catalog evidence
required by the evaluator. The review-only SQL remains non-executable design
material. The next implementation must extend the existing provisioner only
after the owner approves the exact local target and the missing role/marker
mechanisms; it must not create a parallel initializer.

### Proposed implementation sequence

| Step | Required implementation and evidence | Existing implementation | Gap / failure state | Required approval |
|---|---|---|---|---|
| 1. Authorize | Create an authorization record for the exact `testUrl` target binding, `testDatabaseName`, `runId`, `initializationAttemptId`, purpose, owner, and expiry. Keep provisioning authorization separate from scenario and cleanup authorization. | `evaluateDisposableInitialization()` validates a pure authorization object bound to run, attempt, target, and freshness. | `financial-e2e-provision-local.mjs` has no authorization or attempt input. Missing, stale, false, or mismatched authorization must stop before connection or mutation. | Masum Rafique explicitly authorizes initialization of the named disposable local target. |
| 2. Identify target | Validate `TEST_DATABASE_URL` against `DATABASE_URL`, database naming, marker configuration, application name, Supabase/pooler rejection, DNS resolution, and resolved endpoint separation. | `validateFinancialE2eTarget()` performs these offline/configuration checks. | Configuration checks do not prove the connected database identity. Any ordinary, shared, preview, production, ambiguous, or DNS-uncertain target remains untrusted. | Owner approval of the exact disposable target after positive identity evidence is available. |
| 3. Verify bootstrap connection | Connect only with the approved bootstrap principal and record sanitized database name, current/session role, server address/port, application name, target binding, run, attempt, and timestamp. | `verifyDatabaseIdentity()` verifies runtime identity fields; the provisioner checks a pre-existing bootstrap role. | No complete bootstrap-specific evidence contract or authorization binding exists in the executable provisioner. Mismatch, unexpected role, or connection uncertainty stops initialization. | Initialization authorization; no production/shared approval is implied. |
| 4. Establish marker | Through an owner-approved database-local bootstrap operation, establish the exact `pharmnos.financial_e2e_marker = pharmnos-financial-e2e` on the verified target, then read it back through a subsequent connected catalog query. | Safety and initialization contracts require connected-catalog, independently established evidence; Compose only supplies environment/configuration. | The repository has no approved executable marker-establishment mechanism. Environment variables, connection-string parameters, `application_name`, and caller assertions are not provenance. Marker mismatch or unverified provenance stops initialization. | Separate design approval for the marker mechanism, followed by target-specific initialization authorization. |
| 5. Establish roles | Ensure bootstrap and runtime principals are distinct, with the bootstrap principal owning approved baseline/control objects and the runtime principal used for application behavior. | Names are documented as `pharmnos_e2e` and `pharmnos_e2e_runtime`; Compose only creates the `POSTGRES_USER` role and database during PostgreSQL image initialization. | Compose does not create both roles, and the provisioner does not create either role. Role collision, unexpected ownership, or inability to prove separation stops initialization. | Explicit owner approval of role creation/ownership and secret handling outside committed artifacts. |
| 6. Verify runtime role | Verify runtime `rolcanlogin = true`, `rolsuper = false`, `rolbypassrls = false`, and distinct bootstrap identity. | `evaluateDisposableInitialization()` models the flags; identity validation rejects superuser and `BYPASSRLS`. | No connected role/catalog query is implemented in the provisioner. Any unexpected privilege or missing flag evidence stops readiness. | Initialization authorization plus review of the least-privilege matrix. |
| 7. Install baseline | On a positively identified empty target, apply only the approved from-empty Prisma baseline and security controls under a controlled transaction. Keep baseline, grants, RLS, triggers, and assertions in one reviewed procedure with `ON_ERROR_STOP`. | Additive review SQL guards against a populated public schema and rolls back; the provisioner reads the generated baseline and applies control SQL transactionally. | The wrapper is explicitly incomplete; review SQL is not executable approval. The final procedure must define whether role/marker setup is outside or before the schema transaction and must stop on any unexpected object/data. | Separate approval of executable SQL artifacts and target initialization. |
| 8. Apply least privilege | Revoke public schema/object access; grant runtime schema `USAGE`, explicit table/type privileges, and only documented future-object defaults. Runtime receives no schema `CREATE`, ownership, broad role-wide DML, or caller-invocable privileged function. | Review SQL and generated control statements specify most table/RLS/default-privilege intent. | Exact connected grants, ownership, routine privileges, and future-object defaults are not verified. Unexpected grants, public access, or runtime ownership stops readiness. | Security/control review approval; unresolved privilege cannot be waived by test authorization. |
| 9. Verify RLS/triggers | Verify all expected tenant tables have RLS enabled and forced, required policies exist with correct predicates, immutable tables have no runtime update/delete path, and bootstrap-owned triggers/functions are attached to the expected tables. | Static guard and review SQL cover table/policy names and trigger design. | Static evidence is not catalog evidence. Missing policy, wrong predicate, disabled/unenforced RLS, trigger ownership drift, or contradictory catalog results stops readiness. | Security/RLS approval based on connected catalog evidence. |
| 10. Reconnect runtime | Close the bootstrap connection and reconnect as `pharmnos_e2e_runtime` with the approved application marker. Verify connected identity again before any fixture mutation. | `validateDatabaseIdentityEvidence()` models runtime identity and freshness. | No executable runtime reconnect/catalog verification currently exists. Runtime connection failure or identity mismatch leaves the target unready. | Initialization approval; scenario authorization remains separate. |
| 11. Emit evidence | Persist or export sanitized evidence containing target binding, database identity, run, initialization attempt, evidence version, role flags, marker provenance, grants/schema/RLS/trigger results, and fresh timestamps. Never include passwords, tokens, or full URLs. | Pure contracts bind evidence to run, attempt, target, and freshness; failure output is sanitized. | No durable complete connected evidence schema is implemented. Missing, stale, cross-run, contradictory, or future-dated evidence stops readiness. | Owner acceptance of the sanitized evidence format. |
| 12. Declare readiness | Call the existing pure evaluator with all connected evidence. Permit `ready` only when every mandatory check passes; keep scenario runner disabled until a separate execution authorization is supplied. | `evaluateDisposableInitialization()` returns synthetic offline readiness only and explicitly reports `databaseAccessed: false`; runner remains disabled. | No connected caller currently feeds real evidence or creates a ready execution state. Initialization readiness must never be treated as scenario authorization. | Owner separately authorizes financial scenario execution after initialization and fixture/cleanup gates pass. |

The responsible approval for every stop condition is the sole project owner,
Masum Rafique, unless a separate qualified security/GST/database reviewer is
formally designated. No approval is inferred from this Phase L request.

### Sequence and privilege findings

Source inspection does not find PostgreSQL sequence-backed identifiers in the
current Prisma schema or generated financial baseline:

- Model IDs use Prisma `cuid()` defaults, not `SERIAL`, identity columns, or
  `nextval()` sequences.
- `business_profiles.invoice_next_seq` and `purchase_next_seq` are ordinary
  `Int` columns with a default of `1`.
- Sales finalization reads and increments `invoice_next_seq` inside its Prisma
  transaction and formats the invoice number in application code.
- Purchase invoice numbering is supplied by the application form or existing
  record; the purchase repository's `getNextSequence()` counts rows and does
  not access a PostgreSQL sequence.

Therefore the **minimum runtime sequence privilege for the current schema is
none**: no runtime `USAGE`, `SELECT`, or `UPDATE` grant on PostgreSQL sequence
objects is required by the inspected application/schema path. This does not
prove the correctness of concurrent invoice numbering; that remains a
database-backed financial scenario requirement because the current sales code
updates a shared counter and the purchase repository uses a count-based
calculation.

The implementation must still query the catalog for unexpected sequence
objects and fail closed if an executable baseline introduces a sequence-backed
default not covered by this conclusion. If a future schema or migration adds
`SERIAL`, identity, `nextval()`, or another sequence-backed default, the
initializer must stop until the exact runtime operation is identified and
explicit per-sequence privileges plus catalog evidence are approved.

Function and trigger conclusions are similarly bounded:

- No caller-invocable privileged function is approved by the current
  repository contract.
- Trigger functions are intended to be bootstrap-owned controls, not runtime
  APIs. Their ownership, definitions, search path, trigger attachment, and
  effective runtime behavior require connected catalog evidence.
- The current review artifacts revoke default public function execution, but
  the executable procedure must verify actual routine privileges and must not
  infer trigger safety from ownership comments alone.
- RLS requires both enabled and forced state, explicit tenant predicates, and a
  non-bypass runtime role. Static policy coverage cannot substitute for
  connected catalog and behavior evidence.

The existing security artifact's default privileges are scoped to objects
created by `pharmnos_e2e`. The final procedure must prove that the baseline
and controls are actually created by that owner; a `postgres`-owned baseline
or a Compose-created `POSTGRES_USER` with a different name would make those
default-privilege statements inapplicable and must stop initialization.

### Failure and recovery rules

| Condition | Required behavior |
|---|---|
| Marker mismatch, configuration-only marker, or unknown provenance | Do not proceed; do not reinterpret the marker; leave the target unready and require explicit inspection/authorization. |
| Bootstrap/runtime collision or unexpected role flags | Abort before schema/security mutation where possible; never downgrade the runtime role or accept a superuser/BYPASSRLS substitute. |
| Existing public objects/data | Stop before baseline installation. Do not reset, drop, truncate, or substitute another target automatically. |
| Missing, excessive, or contradictory privilege/catalog evidence | Do not declare readiness. Treat uncertainty as failure and require a reviewed correction. |
| Baseline/control transaction error | Roll back the transaction if the server confirms rollback. Record sanitized failure evidence. Do not continue with runtime reconnect or fixtures. |
| Timeout or connection loss before commit outcome is known | Treat the target as untrusted. Do not retry automatically or assume rollback/commit; require an independent inspection of database identity and object state before any further authorization. |
| Partial provisioning or uncertain commit outcome | Keep readiness false, do not run cleanup/reset automatically, and require owner-authorized inspection or replacement of the explicitly named disposable target. |
| Stale, future, cross-run, cross-attempt, or contradictory evidence | Reject the evidence and require a new connected verification for the same approved target and attempt. |

No automatic reset, broad cleanup, target substitution, or retry is part of
this plan. A future manual recovery procedure must be separately reviewed and
must preserve the evidence that the outcome was uncertain.

### Authorization boundaries

These are independent gates:

1. **Provisioning design approval:** approval that the procedure, SQL
   artifacts, privilege matrix, marker method, and evidence format are
   acceptable. This does not authorize a connection or mutation.
2. **Named-target initialization authorization:** permission to initialize one
   exact disposable local target for one run and initialization attempt. It
   does not authorize financial scenarios or cleanup.
3. **Financial scenario execution authorization:** permission to run registered
   application scenarios after connected initialization, fixture ownership,
   authenticated request binding, and readiness evidence pass. It does not
   authorize cleanup.
4. **Cleanup authorization:** permission to execute a frozen, run-owned cleanup
   plan after success or confirmed partial failure. It does not authorize
   provisioning or financial scenarios.

The Phase L instruction is treated only as a request for readiness analysis.
It is not named-target initialization authorization and did not permit any
database mutation.

### Phase L disposition and remaining blockers

- No executable provisioning change was made.
- No scenario operation, fixture provider, public endpoint, or runner path was
  added or enabled.
- The existing provisioner must be extended, rather than duplicated, only
  after the marker mechanism, role ownership/creation method, authorization
  input, connected catalog evidence schema, and recovery procedure are
  separately approved.
- The current most significant blocker is the lack of an approved, executable
  method for independently establishing the marker and both separated roles
  while binding the operation to the exact target/run/attempt.
- Sequence privileges are resolved as not required for the current schema, but
  concurrent application-managed invoice numbering remains unverified.
- Real authenticated E2E execution remains blocked by connected target
  initialization, fixture/cleanup authorization, and the Phase K request-scoped
  application integration prerequisites.

### Phase L validation

The existing offline validation was rerun after the Phase L documentation
update:

- Financial E2E offline suite: `105 PASS`, `0 FAIL`.
- Provisioning static guard: `PASS` — GST enums `4`, GST tables `7`, RLS
  tables `26`, destructive statements `none`, forbidden privileges `absent`,
  Option B relation `present`.
- Applicable Node syntax checks: pass.
- `pnpm exec tsc --noEmit`: pass.
- `node .\scripts\financial-e2e.mjs`: exit code `2`,
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

These results are offline/source-contract evidence only. No database,
Supabase, remote, preview, shared, production, container, SQL, fixture,
cleanup, or financial scenario operation was accessed or executed.

## Phase M — existing provisioner review and minimal remediation

Review date: 2026-10-25 18:41 IST. This phase reviewed the existing
database-capable provisioner against the Phase L readiness plan and made only
offline-testable fail-closed changes. The provisioner was not invoked; no
database client connected; no SQL, Compose profile, marker, role, grant,
schema, trigger, fixture, cleanup, or financial scenario was executed.

### Provisioner gap matrix

| Control | Existing behavior | Phase M disposition |
|---|---|---|
| Explicit owner authorization | No authorization input; environment configuration could reach `client.connect()`. | **Remediated offline gate:** the provisioner now requires explicit initialization authorization, exact target binding, run ID, and initialization-attempt ID before target validation or connection. This is an operator gate, not proof of owner identity. |
| Target/run/attempt binding | Target validation existed; run and attempt were absent. | **Partially remediated:** pure authorization validation binds run, attempt, and `targetBinding(TEST_DATABASE_URL)`. Connected evidence still requires the Phase I contract and is not emitted by this script. |
| Target separation | `validateFinancialE2eTarget()` checks ordinary/test URL identity, naming, marker, application name, blocked hosts, and DNS resolution. | **Implemented as a preflight contract; not connected proof.** Ordinary/shared/preview/production ambiguity remains a stop condition. |
| Bootstrap identity | Connects with the test URL and checks database name, current role, marker, and bootstrap login flag. | **Implemented but incomplete:** current user/marker checks are connected, but full sanitized run/attempt-bound identity evidence is not generated. Bootstrap `rolsuper`/`rolbypassrls` evidence is not yet required by the executable script. |
| Independent marker establishment | Reads an existing `current_setting()` value. Does not create or establish the marker. | **Missing and intentionally deferred.** Environment/connection-string marker configuration is not independent provenance. |
| Bootstrap/runtime separation | Constants name both roles, but the provisioner connects only with the bootstrap/test URL and does not create or verify the runtime role. | **Missing connected verification.** Collision, ownership, runtime login, and runtime role attributes remain stop conditions. |
| Runtime role attributes | Pure initialization evaluator models `LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`; provisioner does not verify runtime catalog state. | **Missing in executable provisioner; deferred pending approved connected catalog procedure.** |
| Schema ownership and `CREATE` | Control SQL revokes runtime `CREATE` and assumes bootstrap-owned objects. | **Review-only/static intent.** Actual owner and runtime schema privileges are not catalog-verified. |
| Least-privilege table/type/function grants | Generated control SQL contains explicit table/type grants and immutable-table revokes. | **Review-only/static intent.** No connected grant snapshot or routine privilege verification exists. |
| Default privileges | Generated control SQL applies defaults for objects created by `pharmnos_e2e`. | **Review-only/static intent.** Applicability depends on actual object owner and remains unverified. |
| RLS and forced RLS | Generated control SQL creates the policy family and enables/forces RLS. | **Review-only/static intent.** Policy predicates, table coverage, and runtime behavior require connected catalog/behavior evidence. |
| Trigger/function ownership | Generated control SQL creates bootstrap-intended trigger functions and triggers. | **Review-only/static intent.** Ownership, attachment, definitions, and effective enforcement are not verified by this script. |
| Baseline installation | Reads the generated from-empty baseline, checks it is self-contained, applies baseline and control SQL in one transaction, and commits. | **Implemented but not authorized for execution.** Review artifacts remain incomplete and no final executable SQL package is approved. |
| Empty-target guard | Counts public relations/objects and stops if any exist. | **Implemented connected guard; no reset or destructive recovery.** |
| Runtime reconnection | Runtime URL and role are required by environment but are not used for a reconnect or verification. | **Missing connected phase.** |
| Sanitized evidence/readiness | Prints a pass summary or a generic failure prefix; no run/attempt-bound evidence artifact or evaluator call. | **Missing.** Synthetic evidence must not be promoted to connected readiness. |
| Timeout/uncertain outcome | Transaction rollback is attempted after errors; connection loss/commit uncertainty is not distinguished. | **Incomplete and deferred.** An uncertain target must remain untrusted; no automatic retry/reset is allowed. |

### Minimal code changes

#### [financial-e2e-provision-local.mjs](../../scripts/financial-e2e-provision-local.mjs)

Added the pure `validateInitializationAuthorization()` gate. It requires:

- `approved === true`;
- a valid run ID;
- a valid initialization-attempt ID;
- an authorization target binding equal to the exact parsed
  `TEST_DATABASE_URL` binding.

The executable `main()` now requires corresponding explicit environment
inputs:

- `FINANCIAL_E2E_INITIALIZATION_AUTHORIZED=true`;
- `FINANCIAL_E2E_RUN_ID`;
- `FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID`;
- `FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING`.

The gate executes before target validation and before `Client.connect()`. It
does not create roles, markers, grants, schemas, triggers, or any other
database object. The authorization environment is only an explicit operator
assertion; it is not independent proof of owner identity and must later be
replaced or supplemented by the approved authorization/evidence workflow.

The module's top-level `main()` invocation is now guarded so importing the
pure validator cannot start the database-capable provisioner. This is required
for safe offline tests and does not alter direct-script execution behavior
after authorization is supplied.

#### [financial-e2e-provision-local.test.mjs](../../tests/financial-e2e-provision-local.test.mjs)

Added four focused offline tests covering:

- missing/false authorization;
- missing or malformed run/attempt IDs;
- mismatched target binding;
- successful exact target-bound authorization.

No test imports a database client for execution, creates a fixture, or calls
the provisioner's `main()`.

### Deferred connected requirements

The following were deliberately not implemented because they require an
approved connected procedure and database mutation:

1. Independent establishment and read-back of
   `pharmnos.financial_e2e_marker`.
2. Creation/ownership and credential handling for
   `pharmnos_e2e` and `pharmnos_e2e_runtime`.
3. Runtime reconnect and verification of `LOGIN`, `NOSUPERUSER`, and
   `NOBYPASSRLS`.
4. Connected catalog snapshots for schema ownership, `CREATE`, table/type/
   routine grants, default privileges, RLS/forced RLS, and trigger ownership.
5. Complete run/attempt-bound sanitized evidence and readiness evaluation.
6. Timeout and uncertain-commit inspection/recovery procedure.
7. Any runtime PostgreSQL sequence grants; source inspection still finds no
   sequence-backed identifiers in the current Prisma schema/generated
   baseline, while application-managed invoice numbering remains a separate
   concurrency verification requirement.

### Phase M validation

- Focused provisioner and safety tests:
  `38 PASS`, `0 FAIL`.
- Complete Financial E2E offline suite:
  `109 PASS`, `0 FAIL`.
- Provisioning static guard: `PASS`;
  GST enums `4`, GST tables `7`, RLS tables `26`, destructive statements
  `none`, forbidden privileges `absent`, Option B relation `present`.
- Applicable Node syntax checks: pass.
- `pnpm exec tsc --noEmit`: pass.
- Standalone runner: exit code `2`,
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

These results prove only the offline authorization gate and existing
source/static contracts. They do not prove database identity, marker
provenance, role separation, privileges, RLS enforcement, trigger behavior,
financial correctness, or cleanup.

### Phase M owner prerequisites and next action

The next action requiring explicit owner authorization is approval of the
connected local initialization procedure covering marker establishment,
bootstrap/runtime role creation and ownership, complete catalog evidence, and
uncertain-outcome handling for one named disposable target. That approval is
separate from financial scenario execution and cleanup authorization.

## Phase N — local disposable database initialization approval package

Review date: 2026-10-25 18:45 IST. This is an offline, documentation-only
approval package. No target was initialized, no database connection was
opened, and no SQL, marker, role, grant, schema, trigger, fixture, cleanup, or
financial scenario operation was executed.

### Decision

**READY FOR OWNER REVIEW — NOT APPROVED and BLOCKED for execution.**

This package is ready for Masum Rafique's review because the proposed target
record, authorization templates, prerequisites, stop conditions, and evidence
requirements are explicit. It is not an initialization approval. No real
target, credentials, connected identity, marker provenance, role state,
catalog snapshot, or owner authorization has been supplied.

### Proposed target record

The following is a template only. Bracketed values are unconfirmed
placeholders and must be replaced by the owner before any connected action.

| Field | Proposed value | Evidence/status |
|---|---|---|
| Local disposable database name | `[OWNER-SELECTED LOCAL DATABASE NAME CONTAINING test OR e2e]` | Unconfirmed; must not be the production, preview, shared, demo, or ordinary database |
| Approved local connection endpoint | `[127.0.0.1 OR ::1 — OWNER TO CONFIRM]` | Unconfirmed; loopback-only endpoint required |
| Approved local port | `[OWNER-SELECTED LOOPBACK PORT, e.g. 55432]` | Unconfirmed; must bind only to localhost |
| Database name / target binding | `[DATABASE NAME]` / `[DERIVED targetBinding(TEST_DATABASE_URL)]` | Binding must be derived from the exact PostgreSQL URL, never typed from memory |
| Intended bootstrap role | `pharmnos_e2e` | Contracted name; connected existence, ownership, and attributes unverified |
| Intended restricted runtime role | `pharmnos_e2e_runtime` | Contracted name; connected existence, separation, and attributes unverified |
| Initialization run ID | `[OWNER-APPROVED RUN ID]` | Must match the safe run-ID format and authorization record |
| Initialization attempt ID | `[OWNER-APPROVED INITIALIZATION ATTEMPT ID]` | Must match the safe attempt-ID format and authorization record |
| Independent marker name | `pharmnos-financial-e2e` | Required value; connected existence and provenance unverified |
| Marker verification source | `connected_catalog` after authorized bootstrap establishment | Required source; environment, URL parameter, `application_name`, and caller assertion are insufficient |
| Isolation evidence | `[COMPOSE LABEL + LOOPBACK BINDING + POSITIVE CONNECTED IDENTITY EVIDENCE]` | Compose provides configuration only; connected evidence is missing |
| Non-production evidence | `[OWNER CONFIRMATION OF LOCAL DISPOSABLE TARGET AND POSITIVE DATABASE/ENDPOINT IDENTITY]` | No production/shared/preview target may be used |
| Evidence timestamp | `[CONNECTED VERIFICATION TIMESTAMP IN IST/UTC EVIDENCE FORMAT]` | Must be fresh and bound to target, run, and attempt |
| Evidence retention location | `[OWNER-APPROVED SANITIZED LOCAL EVIDENCE PATH]` | Must exclude passwords, tokens, full URLs, and secret environment values |

Target selection must reject shared, production, preview, remote, Supabase,
pooler, DNS-ambiguous, ordinary, same-endpoint, same-database, or otherwise
unverifiable targets. The proposed record does not assert that any placeholder
has been verified.

### Initialization authorization template

This record is a template and is not authorization:

```text
Approval type: INITIALIZATION
Owner: Masum Rafique
Decision: [PENDING OWNER DECISION]
Target database name: [OWNER TO COMPLETE]
Target binding: [DERIVED FROM EXACT TEST_DATABASE_URL]
Loopback endpoint/port: [OWNER TO COMPLETE]
Run ID: [OWNER TO COMPLETE]
Initialization attempt ID: [OWNER TO COMPLETE]
Purpose: Initialize one isolated local disposable Financial E2E database
Approved bootstrap role: pharmnos_e2e
Approved runtime role: pharmnos_e2e_runtime
Required marker: pharmnos-financial-e2e
Authorization time: [OWNER TO COMPLETE]
Expiry: [OWNER TO COMPLETE]
Owner acknowledgement: [OWNER TO COMPLETE]
```

The executable preflight additionally requires
`FINANCIAL_E2E_INITIALIZATION_AUTHORIZED=true`,
`FINANCIAL_E2E_RUN_ID`,
`FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID`, and
`FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING`. These values do not replace
independent connected identity or marker evidence.

### Initialization prerequisites and evidence checklist

Initialization remains blocked until every item below is satisfied:

1. **Exact-target authorization:** owner authorization names the exact target,
   run, attempt, purpose, and expiry.
2. **Positive target separation:** safety checks pass for URL identity,
   database naming, application marker, loopback endpoint, and ordinary-target
   separation.
3. **Bootstrap identity:** connected database, server address/port, current
   user, session user, application name, and target binding match the approved
   record.
4. **Independent marker:** the authorized bootstrap operation establishes the
   marker, and a subsequent connected catalog query reads the exact required
   value.
5. **Role separation:** bootstrap and runtime roles are distinct, documented,
   and ownership is recorded without exposing credentials.
6. **Runtime restrictions:** runtime has `LOGIN`, `rolsuper = false`, and
   `rolbypassrls = false`; runtime cannot create schema objects or own
   security-sensitive functions.
7. **Least privilege:** schema, table, type, routine, sequence, and default
   privileges match the approved matrix. The current schema has no identified
   PostgreSQL sequence dependency, so no runtime sequence grant is proposed.
8. **Baseline and controls:** the approved from-empty baseline and security
   controls are applied only after empty-target verification and within
   defined transaction boundaries.
9. **RLS and immutability:** all expected RLS tables are enabled and forced;
   policies, immutable-history triggers, posting-transition triggers, function
   definitions, ownership, and attachments match the approved artifacts.
10. **Runtime reconnection:** bootstrap connection is closed; runtime
    reconnects and independently passes identity/catalog verification before
    fixture mutation.
11. **Sanitized evidence:** evidence is immutable or append-only in the
    approved local retention path and binds every result to target, run,
    attempt, evidence version, and fresh timestamp.
12. **Fail-closed readiness:** any missing, stale, contradictory, excessive,
    cross-run, or unverified result produces `ready = false`.

Static source inspection and synthetic offline tests support the shape of
these requirements only. They do not prove connected catalog state, marker
provenance, RLS enforcement, permission enforcement, or financial behavior.

### Separate approval records

#### Initialization approval

```text
Approval type: INITIALIZATION OF NAMED LOCAL DISPOSABLE TARGET
Status: PENDING — NOT GRANTED BY PHASE N
Owner: Masum Rafique
Target: [EXACT TARGET RECORD REQUIRED]
Scope: Establish marker/roles, install approved baseline and controls, verify catalog, emit sanitized evidence
Exclusions: No financial scenarios, fixtures, cleanup, production, preview, shared, remote, or Supabase access
```

#### Scenario-execution approval

```text
Approval type: FINANCIAL SCENARIO EXECUTION
Status: PENDING — NOT IMPLIED BY INITIALIZATION APPROVAL
Owner: Masum Rafique
Target/run: [CONNECTED READY EVIDENCE REQUIRED]
Scenario set: [EXPLICIT PURCHASE/SALES/FEFO/PAYMENT SCENARIOS TO BE NAMED]
Prerequisites: Connected initialization readiness, owned fixtures, authenticated request binding, cleanup plan
Exclusions: Any unlisted scenario or target
```

#### Cleanup approval

```text
Approval type: RUN-OWNED FIXTURE CLEANUP
Status: PENDING — NOT IMPLIED BY INITIALIZATION OR SCENARIO APPROVAL
Owner: Masum Rafique
Target/run: [EXACT VERIFIED TARGET AND RUN REQUIRED]
Resource manifest: [FROZEN RUN-OWNED MANIFEST REQUIRED]
Scope: Only explicitly owned resources in dependency-aware order
Exclusions: Demo tenant, foreign-run resources, uncertain ownership, shared or production data
```

No approval record above is complete. Phase N records decisions requiring
explicit owner action; it does not grant any permission.

### Recovery and stop conditions

Stop immediately and keep the target untrusted when:

- the marker is missing, mismatched, configuration-only, or of uncertain
  provenance;
- bootstrap/runtime roles collide, are unexpected, or have unsafe attributes;
- public schema objects/data already exist unexpectedly;
- any privilege, ownership, RLS, policy, function, or trigger result is
  missing, excessive, contradictory, or not independently verified;
- baseline or control transaction failure occurs;
- timeout or connection loss leaves commit outcome uncertain;
- evidence is stale, future-dated, cross-run, cross-attempt, or bound to a
  different target;
- runtime reconnection does not independently verify the approved identity.

Do not reset, drop, truncate, substitute, retry automatically, or infer
rollback from a lost connection. Recovery requires separate owner-authorized
inspection of the named target or explicit replacement of that disposable
target, with uncertainty preserved in sanitized evidence.

### Financial safety and sequence conclusion

The existing source conclusion remains unchanged: Prisma IDs use CUIDs and the
inspected schema/generated baseline does not show PostgreSQL sequence-backed
identifiers. No runtime sequence grants are added. Application-managed invoice
numbering through `business_profiles.invoice_next_seq`, and the purchase
count-based numbering path, still require database-backed concurrency and
rollback testing before correctness can be claimed.

No RLS, tenant-isolation, immutable-history, GST evidence, posting, or
financial control is weakened for initialization convenience.

### Phase N evidence classification and outstanding gaps

| Area | Classification |
|---|---|
| Authorization preflight and target-binding validator | Implemented and offline-tested; operator assertion only |
| Target safety checks | Implemented and offline-tested; connected identity unverified |
| Initialization evaluator | Implemented and synthetically tested; explicitly reports no database access |
| Compose isolation configuration | Source-reviewed configuration; not proof of roles, marker, grants, or schema |
| Review SQL artifacts | Design-only and static-guarded; not executed provisioning |
| Marker establishment | Missing connected implementation and provenance evidence |
| Bootstrap/runtime role creation and verification | Missing connected implementation/evidence |
| Catalog grants/default privileges/RLS/triggers | Static/review intent only; connected verification missing |
| Runtime reconnection | Missing |
| Durable sanitized initialization evidence | Missing |
| Recovery for uncertain commit outcomes | Documented stop rule; executable recovery procedure missing |
| Authenticated application E2E | Blocked on all prerequisites above and separate approvals |

### Phase N validation and disposition

No code changes were necessary in this documentation-only phase, so no code
validation was run. Existing Phase M evidence remains:

- Focused provisioner and safety tests: `38 PASS`, `0 FAIL`.
- Complete Financial E2E offline suite: `109 PASS`, `0 FAIL`.
- Provisioning static guard: `PASS`.
- Applicable syntax checks: pass.
- `pnpm exec tsc --noEmit`: pass.
- Standalone runner: exit code `2`,
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

These results are not connected database evidence. The final Phase N decision
is **READY FOR OWNER REVIEW**, while operational status remains
**NOT APPROVED / BLOCKED**.

## Phase O — owner authorization readiness and pre-provisioning gate review

Review time: 2026-10-25 18:51 IST. This review reconciles the current source
contracts and Phase N package. It is review-only and grants no authorization.
No database, SQL, container, external service, runner, fixture, or financial
operation was accessed or executed.

### Gate disposition

**Initialization eligibility: BLOCKED.**

The target is not eligible for initialization because no exact target,
independent marker-establishment method, connected role evidence, connected
catalog evidence, recovery procedure approval, or owner authorization is
present. The Phase M authorization preflight is a necessary guard, but it is
not proof that the database is safe to initialize.

### Reconciled prerequisite register

| Prerequisite | Status | Evidence source | Exact remaining action | Blocks |
|---|---|---|---|---|
| Exact target/run/attempt authorization | `VERIFIED OFFLINE` and `REQUIRES OWNER DECISION` | `validateInitializationAuthorization()` in `scripts/financial-e2e-provision-local.mjs`; Phase M tests | Owner must bind one real loopback target, run ID, attempt ID, expiry, and derived `targetBinding` | Initialization |
| Target separation and positive identity | `VERIFIED OFFLINE` | `financial-e2e-safety.mjs` target checks and offline tests | Perform authorized connected identity verification; reject any ambiguity | Initialization |
| Independent marker establishment | `NOT IMPLEMENTED` | Provisioner only reads `current_setting`; Compose does not create the marker | Approve and implement one reviewed bootstrap establishment/read-back path, with a connected test | Initialization |
| Bootstrap/runtime role creation and separation | `DOCUMENTED ONLY` | Role names and intended boundary in provisioner/security review SQL | Establish roles through an approved local mechanism and capture connected ownership/identity evidence | Initialization |
| Runtime `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS` | `VERIFIED OFFLINE` as a contract only | Initialization contract and synthetic tests | Query and retain connected catalog evidence as runtime role | Initialization and scenarios |
| Schema ownership and `CREATE` restriction | `DOCUMENTED ONLY` | Review SQL and provisioner control statements | Apply approved controls and verify owner, schema privileges, and effective runtime behavior | Initialization and scenarios |
| Table/type/routine/default privileges | `DOCUMENTED ONLY` | Review SQL and static guard | Install current approved grants, then verify effective privileges and absence of excess | Initialization and scenarios |
| RLS, forced RLS, policies, and tenant fail-closed behavior | `DOCUMENTED ONLY` | Review SQL, RLS artifact, static guard | Install and run connected same-tenant, cross-tenant, and missing-claim behavior tests | Initialization and scenarios |
| Trigger/function ownership and attachment | `DOCUMENTED ONLY` | Security review artifact and initialization contract | Install bootstrap-owned triggers, verify `pg_proc`/`pg_trigger` ownership and attachments | Initialization and scenarios |
| Runtime-role reconnection | `NOT IMPLEMENTED` | Provisioner currently remains on bootstrap connection | Add a bounded reconnect-and-verify stage after controls commit, with offline failure tests and connected evidence | Initialization |
| Complete sanitized attempt evidence | `NOT IMPLEMENTED` | Pure evaluator models evidence but provisioner does not emit it | Add attempt-bound sanitized evidence output and tests for stale, cross-run, contradictory, and secret-bearing results | Initialization, scenarios, cleanup |
| Transaction and uncertain-outcome handling | `DOCUMENTED ONLY` | Phase N/O stop rules and additive review wrapper | Define inspect-before-retry procedure; never infer rollback after timeout or connection loss | Initialization |
| Authenticated request context | `VERIFIED OFFLINE` as an internal seam only | `financial-e2e-auth-context.mjs` and app-hosted binding tests | Exercise only after database readiness and separate scenario approval; do not fabricate sessions | Scenarios |
| Run-owned fixtures and cleanup | `VERIFIED OFFLINE` as pure contracts only | Fixture lifecycle/orchestration tests | Obtain separate cleanup approval and connect a real provider only after scenario authorization | Cleanup |

`VERIFIED OFFLINE` means only that source or pure contract behavior is
tested. It never means connected database behavior is verified.

### Compact owner decision register

No item below is approved or populated:

| Decision | Owner input required | Current value |
|---|---|---|
| Exact disposable target | Database name, loopback endpoint/port, exact URL-derived binding, isolation proof | `[PENDING OWNER INPUT]` |
| Marker establishment | Authorized local mechanism, actor, read-back query, provenance evidence | `[PENDING OWNER INPUT]` |
| Roles and credentials | Bootstrap/runtime names, creation authority, ownership, secret handling outside repository | `[PENDING OWNER INPUT]` |
| Schema and grants | Approved baseline/control order, least-privilege matrix, no-sequence-grant confirmation | `[PENDING OWNER INPUT]` |
| Connected evidence | Required catalog/runtime assertions, evidence version, sanitized retention path, retention period | `[PENDING OWNER INPUT]` |
| Recovery | Timeout, partial commit, connection loss, inspection, reauthorization, and fresh-target rules | `[PENDING OWNER INPUT]` |
| Scenario execution | Explicit run, target, scenario list, authenticated user/tenant scope, evidence threshold | `[PENDING OWNER INPUT]` |
| Cleanup | Explicit run-owned manifest, dependency order, residual checks, and cleanup authorization | `[PENDING OWNER INPUT]` |

Environment variables, including `ALLOW_FINANCIAL_E2E=true`, are implementation
guards only. They cannot substitute for these owner decisions, connected
identity, or readiness evidence.

### Minimum implementation package before initialization

The smallest safe implementation is not a new initializer. It is a reviewed
completion of the existing provisioner plus focused offline tests:

1. Add an authorized marker-establishment step and a subsequent connected
   catalog read-back. Do not accept environment, URL, or caller-supplied
   marker values as evidence.
2. Add explicit preflight verification or an approved prerequisite mechanism
   for distinct bootstrap/runtime roles, ownership, and runtime role flags.
3. Keep schema baseline and security controls bounded to the verified
   from-empty target; verify effective grants, default privileges, RLS,
   policies, functions, triggers, and ownership after installation.
4. Close the bootstrap connection and reconnect as the runtime role; run the
   existing identity validator against fresh evidence.
5. Emit sanitized evidence bound to target binding, run ID, attempt ID,
   evidence version, and timestamp. Secrets and full connection URLs must
   never be emitted.
6. Represent timeout/connection-loss outcomes as `UNTRUSTED` unless an
   authorized inspection proves the commit state. Do not retry or reset
   automatically.
7. Add offline tests for every fail-closed branch, while labeling all such
   results as synthetic. Add connected tests only under a later, separately
   authorized local run.

The current provisioner already has the target-bound authorization gate,
target validation, bootstrap connection, empty-public-schema check, and
transactional baseline/control attempt. It does not safely complete the
remaining connected stages above and must not be treated as a from-empty
initializer yet.

### Approval boundary and stop rule

- Readiness review does not authorize initialization.
- Initialization authorization does not authorize financial scenarios.
- Scenario authorization does not authorize cleanup.
- A runner environment variable does not establish approval or target trust.
- Any mismatch, stale evidence, excessive privilege, failed verification, or
  uncertain outcome leaves the target blocked and untrusted.

### Phase O checks and file impact

This Phase O section is the only documentation correction made. It adds
actionable status, owner decisions, and minimum implementation gates beyond
Phase N; no tracker change was justified.

Inspected source and artifacts included the local provisioner, safety,
readiness and initialization contracts, authenticated context adapter,
provisioning static guard, Compose configuration, additive/security review SQL,
the Financial E2E specification, and the canonical Phase N evidence record.
No executable validation was run because no code changed. Existing offline
evidence remains the Phase M result: `38 PASS` focused provisioner/safety
tests, `109 PASS` full Financial E2E offline tests, provisioning static guard
`PASS`, syntax checks pass, TypeScript check pass, and the standalone runner
blocked with exit code `2`.

The tracker remains unchanged. Operational status remains **NOT APPROVED /
BLOCKED**, and the next action requiring owner authorization is completion of
the decision register followed by a separately reviewed implementation of the
connected initialization stages.

## Phase P — minimal provisioner remediation

Implementation date: 2026-10-25 18:54 IST. This phase made only
offline-testable changes in the existing provisioner. No database connection,
SQL execution, container operation, external service, fixture, cleanup,
financial scenario, or runner activation occurred.

### Gaps found and fixed

The target-bound authorization gate and direct-execution guard from Phase M
already existed and were retained; no duplicate helpers were added. The
remaining concrete offline gap was the provisioner's failure boundary:
transaction failures previously attempted a best-effort rollback and
re-threw the original error without distinguishing a confirmed rollback from
an uncertain commit outcome or guaranteeing sanitized diagnostics.

The following safeguards were added to
`scripts/financial-e2e-provision-local.mjs`:

- `classifyProvisioningFailure()` returns `KNOWN_ROLLBACK` only when no
  transaction was active or rollback was confirmed; a started transaction
  with a failed or unconfirmed rollback returns
  `UNTRUSTED_UNKNOWN_OUTCOME`.
- `sanitizeProvisioningDiagnostic()` redacts PostgreSQL URLs and
  password/secret/token-like key-value diagnostics before an error is
  surfaced, with a bounded message length.
- `createSanitizedProvisioningEvidence()` produces only target-bound,
  run-bound, attempt-bound, versioned outcome metadata; it does not serialize
  connection URLs, usernames, passwords, or credentials.
- The existing catch path now classifies rollback outcome and reports the
  sanitized classification. It does not retry, reset, substitute a target, or
  claim readiness.

The evidence factory is metadata-only and is not a synthetic connected-success
path. Connected identity, marker, catalog, and runtime-role verification still
come from the later authorized stages.

### Regression coverage

`tests/financial-e2e-provision-local.test.mjs` now covers:

- failed rollback => `UNTRUSTED_UNKNOWN_OUTCOME`;
- confirmed rollback => `KNOWN_ROLLBACK`;
- URL and secret-like diagnostic redaction;
- bound non-secret evidence output.

### Connected capabilities deliberately deferred

The provisioner still does not implement or invoke any of the following:

- independent marker establishment and connected read-back;
- bootstrap/runtime role creation or connected role-attribute verification;
- effective schema, table, type, routine, sequence, default-privilege, RLS,
  policy, trigger, or function catalog verification;
- runtime-role reconnection and independent post-initialization identity
  verification;
- complete durable connected evidence retention;
- authorized recovery inspection for an uncertain commit outcome.

The later connected interface must accept the already approved exact target,
run ID, initialization-attempt ID, and owner authorization; establish and
read the marker through a connected catalog path; collect fresh catalog and
runtime evidence; close bootstrap; reconnect as the runtime role; validate
the evidence through the existing safety/initialization contracts; and leave
the target `UNTRUSTED` if commit state cannot be established. No owner
approval for that interface exists in Phase P.

### Phase P validation

- Focused provisioner, safety, readiness, and initialization-contract tests:
  `54 PASS`, `0 FAIL`.
- Complete Financial E2E offline suite:
  `105 PASS`, `0 FAIL`.
- Provisioning static guard: `PASS`.
- Node syntax checks for the changed provisioner and test:
  `PASS`.
- `pnpm exec tsc --noEmit`: `PASS`.
- Standalone runner: exit code `2`, blocked at the existing guard:
  `FINANCIAL_E2E=BLOCKED: set ALLOW_FINANCIAL_E2E=true explicitly before any
  financial test run`.

The first full-suite command had a PowerShell argument-passing error and did
not execute the suite; it was rerun with proper argument expansion and
completed with `105 PASS`, `0 FAIL`. This is an invocation correction, not a
repository failure.

### Phase P disposition

Initialization remains **BLOCKED**. The new safeguards improve failure
classification and secret handling only; they do not establish connected
identity, marker provenance, privileges, RLS behavior, role separation, or
financial correctness. Owner decisions and separate initialization,
scenario-execution, and cleanup approvals remain required. The phase tracker
was not modified.
