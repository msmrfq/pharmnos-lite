---
title: GST Rollout Approval and Disposable-Database Readiness
date: 2026-10-24
status: Review package only - no approval or execution
phase: POST-P7 - PRE-PRODUCTION VALIDATION
---

# GST Rollout Approval and Disposable-Database Readiness

This is a review package for the GST schema rollout design. It does not
authorize live Supabase changes, disposable-database execution, migrations,
schema synchronization, or application deployment.

## Evidence reviewed

- `.obsidian-vault/specs/gst-live-metadata-baseline-2026-10-24.md`
- `.obsidian-vault/specs/gst-schema-rollout-design-review.md`
- `.obsidian-vault/specs/gst-audit-validation-and-plan.md`
- `.obsidian-vault/specs/financial-e2e-validation-harness.md`
- `prisma/schema.prisma`
- `scripts/rls-rollout-verifier.mjs`
- `scripts/financial-e2e-safety.mjs`
- `scripts/financial-e2e-readiness.mjs`
- `docker-compose.financial-e2e.yml`
- `.env.financial-e2e.example`

The baseline is direct catalog evidence captured on 2026-10-24. Its connected
role is `postgres` with `rolsuper=false` and `rolbypassrls=true`; it is not
evidence of ordinary-role tenant isolation. The baseline reports all seven
GST/posting tables, four GST enums, six invoice GST/version fields, and
required tenant-aware composite keys as absent. No business rows were read.

## Disposable-database readiness

### Current repository evidence

| Check | Observation | Status |
|---|---|---|
| Disposable compose definition | `docker-compose.financial-e2e.yml` defines a local PostgreSQL 17 Alpine service on loopback port `55432` with tmpfs storage and a healthcheck | Available as a definition |
| Local disposable environment file | `.env.financial-e2e` is absent | Not configured |
| Test database URL | No `TEST_DATABASE_URL` configuration was found | Not configured |
| Required safety marker | `.env.financial-e2e.example` documents `pharmnos-financial-e2e`, but the local value is absent | Not configured |
| Explicit execution gate | `ALLOW_FINANCIAL_E2E` is not configured | Not authorized |
| Prisma migration history | `prisma/migrations/` is absent | No trusted migration baseline |
| Scenario runner/database execution | Existing harness requires independent identity verification and explicit authorization | Blocked |

Conclusion: no disposable database is currently available for authorized
execution. The compose file is only a provisioned-environment definition; it
is not evidence that a running database exists or that the schema has been
applied. Do not create or start it as part of this review.

### Requirements before any test execution

1. Obtain explicit approval to use a disposable local PostgreSQL instance or
   another separately identified isolated database.
2. Create the ignored local `.env.financial-e2e` from the example with a
   random local password; never commit or document the password.
3. Set a test database name containing `test` or `e2e`, the exact marker
   `pharmnos-financial-e2e`, and a URL containing
   `application_name=pharmnos-financial-e2e`.
4. Ensure `TEST_DATABASE_URL` differs from `DATABASE_URL` by independently
   verified identity, not only by text comparison.
5. Establish an owned tenant/user fixture strategy and an explicitly
   authorized cleanup strategy.
6. Decide the GST schema shape, grant model, RLS posture, and
   `calculation_id` option before applying SQL.
7. Prepare a reviewed additive migration or equivalent disposable-only schema
   setup. Existing bootstrap SQL is not a substitute for that review.

## Approval decision matrix

The project owner authorized resolution of GST-APP-01 through GST-APP-08 on
2026-10-25. The selections below are recorded as **Owner's Decision**.
Implementation, database rollout, and runtime verification remain separate
evidence gates.

| Decision ID | Question requiring a decision | Existing documented options | Security and financial-integrity implications | Evidence needed | Required approver | Status |
|---|---|---|---|---|---|---|
| GST-APP-01 | Which principals may use the schema and GST tables? | Restricted backend access; no direct browser CRUD for `anon`; runtime and bootstrap roles remain separate | Direct browser writes and shared bootstrap/runtime credentials weaken least privilege and evidence trust | Effective schema/table/function/default privilege matrix; unauthorized-operation tests | Database owner; Security/Architecture | Owner's Decision |
| GST-APP-02 | Should RLS be forced and which policy commands/roles apply? | Tenant-scoped RLS; forced RLS for application-facing roles; fail-closed predicates; ordinary-role isolation tests | `BYPASSRLS` roles cannot prove isolation; tenant predicates alone do not enforce immutability or segregation of duties | Non-superuser, non-`BYPASSRLS` same-tenant and cross-tenant tests; policy catalog evidence | Security/Architecture; database owner | Owner's Decision |
| GST-APP-03 | How should `calculation_id` be constrained? | Option B tenant/invoice-scoped composite FK with Prisma inverse relation, `ON DELETE RESTRICT`, mapped FK `purchase_gst_decision_calculation_fkey` | Adds structural integrity while requiring relation and migration compatibility validation | Decision record, `prisma validate`, generated SQL review, orphan/cross-scope tests | Product/accounting; database owner; Security/Architecture | Owner's Decision |
| GST-APP-04 | Are the three nullable invoice pointers and composite support keys acceptable? | Tenant-aware composite support keys, nullable current pointers, and guarded pointer FKs | Preserves legacy nullability while preventing cross-tenant/current-pointer mismatches | Catalog comparison, duplicate checks, null/backfill plan, pointer-integrity tests | Database owner; application/financial integrity | Owner's Decision |
| GST-APP-05 | How are evidence, calculations, decisions, and events protected after creation? | Hybrid service/database immutability controls for finalized GST and reconciliation history | Direct mutation/deletion can destroy audit evidence or alter accounting history | Immutable/append-only behavior tests, privilege review, failure evidence | Security/Architecture; application/financial integrity; accounting | Owner's Decision |
| GST-APP-06 | Which purchase posting transitions are database/application controlled? | Service-led posting transactions backed by database integrity, idempotency, guarded transitions, and concurrency controls | Partial posting, duplicate posting, or unauthorized state changes can corrupt stock, ledger, and invoice state | Atomic success/failure, idempotency, retry, concurrency, and rollback tests | Application/financial integrity; product/accounting | Owner's Decision |
| GST-APP-07 | What defaults/backfill and timestamp semantics are approved? | Preserve existing accounting precision and timestamp behavior; approved initial status/version defaults; never fabricate historical GST facts | Incorrect defaults or backfills can change legacy accounting behavior | Existing-row compatibility review, exact catalog metadata, isolated backfill rehearsal | Database owner; application/financial integrity | Owner's Decision |
| GST-APP-08 | What rollback and repeatability guarantees are required? | Additive, catalog-guarded, repeatable provisioning; stop-on-conflict; documented rollback limitations | Enum, FK, unique-key, `NOT NULL`, and evidence-history rollback may be irreversible or data-dependent | Disposable partial-failure, rerun, rollback, and post-rollback catalog evidence | Database owner; Security/Architecture | Owner's Decision |

Settled GST policy decisions D-GST-01 through D-GST-52 are not reopened by this
matrix. This package only prepares implementation and security gates.

### Owner's Decision record — 2026-10-25

These are the project owner's decisions, not AI decisions. They resolve the
eight rollout-direction questions only; they do not claim implementation,
database provisioning, RLS isolation, or financial testing has succeeded.
Each decision still requires the implementation and validation evidence listed
in the matrix.

- **GST-APP-01:** restricted backend access; no direct browser CRUD for
  `anon`; bootstrap and runtime roles remain separate.
- **GST-APP-02:** tenant-scoped RLS, forced RLS for application-facing roles,
  fail-closed tenant predicates, and ordinary-role isolation testing.
- **GST-APP-03:** Option B composite `calculation_id` relation with Prisma
  inverse relation, `ON DELETE RESTRICT`, and mapped FK
  `purchase_gst_decision_calculation_fkey`.
- **GST-APP-04:** tenant-aware composite support keys, nullable current
  pointers, and guarded pointer foreign keys.
- **GST-APP-05:** hybrid service/database immutability controls for finalized
  GST and reconciliation history.
- **GST-APP-06:** service-led posting transactions backed by database
  integrity, idempotency, guarded transitions, and concurrency controls.
- **GST-APP-07:** preserve existing accounting precision and timestamp behavior;
  use approved initial status/version defaults; never fabricate historical GST
  facts.
- **GST-APP-08:** additive, catalog-guarded, repeatable provisioning with
  stop-on-conflict and documented rollback limitations.

## Proposed disposable-database test plan

No test below has passed against a database.

| Test ID | Test | Expected result | Required evidence |
|---|---|---|---|
| GST-TEST-01 | Verify test database identity, name, marker, and separation from live `DATABASE_URL` | Exact approved disposable identity; no production/shared target | Sanitized identity record and safety-validator output |
| GST-TEST-02 | Apply reviewed additive schema in a clean disposable database | Four enums, six invoice fields, seven tables, parent keys, indexes, and mapped constraints created with exact definitions | Catalog dump/checklist; Prisma compatibility result |
| GST-TEST-03 | Run Prisma validation/client generation against the applied schema | Schema validates and generated client matches the approved relation choice | `prisma validate`/generation logs without secrets |
| GST-TEST-04 | Verify enum labels and order | Exact Prisma labels and order | `pg_type`/`pg_enum` catalog comparison |
| GST-TEST-05 | Verify invoice pointers and composite uniqueness | Nullable legacy pointers are accepted; non-null pointers cannot cross tenant/invoice; duplicate keys fail | Constraint tests and catalog definitions |
| GST-TEST-06 | Verify tenant-aware foreign keys | Evidence, calculation, decision, event, line-evidence, event-line, membership, invoice, and item references enforce tenant/invoice scope | Insert/update/delete rejection results |
| GST-TEST-07 | Verify RLS with ordinary roles | Same-tenant authorized access works; cross-tenant reads and writes are denied; missing tenant claim fails closed | Roles with `rolsuper=false`, `rolbypassrls=false`; policy and session evidence |
| GST-TEST-08 | Verify least-privilege grants | `anon` and unauthorized roles cannot perform prohibited operations; approved backend/function path performs only allowed operations | ACL/effective privilege catalog output and negative tests |
| GST-TEST-09 | Verify evidence and reconciliation relationships | Evidence revisions, correction chains, calculations, decisions, events, and event lines preserve required references and history rules | Relationship and append-only/immutability results |
| GST-TEST-10 | Verify `calculation_id` selected option | Option A transaction validation or Option B composite FK behaves exactly as approved | Decision-specific schema/application tests |
| GST-TEST-11 | Verify purchase posting integrity | Successful finalization updates approved state atomically; duplicate idempotency requests do not double-post | Transaction assertions for invoice, stock, ledger, and audit state |
| GST-TEST-12 | Verify failure and retry behavior | Injected failures leave no unauthorized partial financial state; retry behavior is deterministic | Failure injection and cleanup evidence |
| GST-TEST-13 | Verify rollback and partial application handling | Supported rollback steps are safe; unsupported reversals stop and are documented; rerun detects exact matches and mismatches | Catalog before/after, rollback log, rerun result |
| GST-TEST-14 | Verify cleanup ownership | Only run-owned fixtures are cleaned in dependency order; cleanup failure is observable and not reported as success | Immutable manifest, cleanup plan, completion evidence |
| GST-TEST-15 | Verify final schema | Columns, defaults, nullability, indexes, keys, FKs, RLS, policies, grants, functions, and ownership match approval | Final sanitized catalog artifact and hash |

## Remaining blockers and stop conditions

- No disposable database is configured or verified.
- No approved Prisma migration baseline exists.
- Grant model and forced-RLS posture remain unresolved.
- `calculation_id` Option A versus Option B remains unresolved.
- Business-row duplicate, pointer, null/backfill, and FK compatibility checks
  remain outstanding.
- No non-superuser, non-`BYPASSRLS` tenant-isolation evidence exists.
- No disposable schema execution, rollback, or application compatibility test
  has been run.
- No explicit rollout authorization exists.

**Database rollout remains NO-GO.**

## Technical recommendations for human approval

These are engineering recommendations only. They are not approvals, executed
changes, or evidence that any test has passed. The recommendation status is
separate from the approval status in the matrix above.

### GST-APP-01 - Grant model and write boundary

**Alternatives:** Use a restricted backend/application role with no direct
browser CRUD; use narrowly scoped database write functions; or approve another
model with compensating controls.

**Recommendation:** Prefer a restricted backend/application role for reads and
workflow writes, with immutable-history tables not directly writable by
`anon`/`authenticated`. Use controlled database functions only for operations
that genuinely require an atomic database boundary, and grant each function
narrowly rather than exposing broad table DML.

This best limits tenant access and least-privilege exposure while keeping
business rules testable in the application service layer. It avoids treating
RLS as a substitute for authorization and avoids making a public
`SECURITY DEFINER` function an unreviewed write API. The trade-off is more
explicit role and deployment management, plus a possible need for carefully
reviewed function code for posting-critical operations. The observed broad
`anon`/`authenticated` privileges, including `TRUNCATE`, must not be treated
as the target state.

**Required evidence:** approved effective schema/table/function/default ACL
matrix; negative tests for unauthorized DML and `TRUNCATE`; positive tests for
the approved backend/function path; ownership and `EXECUTE` review; exact
`expectedGrants` for the verifier.

**Approval authority:** database owner and Security/Architecture reviewer,
with application/financial-integrity review. **Status: recommended, pending
approval.**

### GST-APP-02 - RLS enforcement and verification roles

**Alternatives:** Force RLS on every relevant table; retain an explicitly
documented non-forced exception with compensating controls; and choose a
reviewed policy split rather than blindly using one `FOR ALL` policy.

**Recommendation:** Require RLS on every exposed GST/posting table and prefer
forced RLS for ordinary application roles. Use non-superuser,
non-`BYPASSRLS` roles for all isolation evidence. Keep tenant predicates in
both `USING` and `WITH CHECK`, and separately test command-specific behavior
where immutability or posting authority requires it.

Forced RLS reduces accidental bypass by table owners and makes the test
posture clearer. The trade-off is that trusted server workflows need an
explicitly reviewed role/function path, and existing owner/admin operations
may need adjustment. A `BYPASSRLS` role can inspect metadata but cannot prove
tenant isolation.

**Required evidence:** live catalog state for enabled/forced RLS and policies;
ordinary-role same-tenant and cross-tenant read/write tests; missing/invalid
tenant-claim fail-closed tests; owner and bypass-role separation; policy
command and grant review.

**Approval authority:** Security/Architecture reviewer and database owner.
**Status: recommended, pending approval.**

### GST-APP-03 - `calculation_id` relationship

**Alternatives:** Option A keeps an application-validated scalar without a
database FK. Option B adds a tenant- and invoice-scoped composite FK with
Prisma relations.

**Recommendation:** Prefer Option B, subject to complete-model relation-name
validation and explicit Prisma/generated-SQL review. The composite reference
should enforce `(tenant_id, purchase_invoice_id, calculation_id)` against the
calculation identity and use `ON DELETE RESTRICT`.

This provides stronger tenant and invoice integrity and prevents orphan or
cross-scope references independently of application code. The trade-off is a
Prisma relation/schema change, more migration complexity, and stricter
deletion/retention behavior. Option A is simpler and preserves the current
shape, but leaves material integrity dependent on every application path.
Neither option is selected until approved.

**Required evidence:** relation and inverse-field conflict check across the
complete Prisma models; `prisma validate` and generated-SQL review; disposable
orphan, cross-tenant, wrong-invoice, delete, and retry tests; approved naming
and rollback treatment.

**Approval authority:** product/accounting owner, database owner, and
Security/Architecture reviewer. **Status: recommended Option B, pending
approval.**

### GST-APP-04 - Invoice pointers and composite keys

**Alternatives:** Add the exact Prisma composite unique keys and mapped current
pointer FKs; or approve a compatibility adjustment only after proving it
preserves tenant and invoice scope.

**Recommendation:** Use the exact Prisma shape: nullable current pointers,
non-null GST status/version fields with their Prisma defaults, parent composite
keys, and mapped `ON DELETE RESTRICT` pointer FKs. Do not weaken the composite
scope or invent an invoice-pointer FK on the target GST tables.

This protects current-revision pointers from cross-tenant and cross-invoice
matches and preserves legacy invoices that have no current GST record. The
trade-off is additional unique constraints and possible legacy duplicate or
backfill work. Pointer values must not be guessed or fabricated.

**Required evidence:** exact live-versus-Prisma catalog comparison; duplicate
and nullability checks; approved legacy backfill/default plan; pointer
insertion, update, delete, and cross-scope rejection tests.

**Approval authority:** database owner and application/financial-integrity
reviewer. **Status: recommended, pending approval.**

### GST-APP-05 - Immutable evidence and reconciliation records

**Alternatives:** Restrict writes through the backend; enforce append-only
behavior with reviewed database functions/triggers; or use a reviewed hybrid.

**Recommendation:** Use a hybrid boundary: application services create
versioned evidence/calculation/decision/event records, while database
privileges and narrowly scoped controls prevent ordinary mutation/deletion of
finalized history. Corrections should create new evidence revisions and
append reconciliation events, preserving supplier evidence and prior
decisions.

This supports auditability and preserves the three distinct facts: supplier
declared, application calculated, and accounting accepted. The trade-off is
more state and authorization testing, and database controls can complicate
local development if not isolated behind a clear role boundary.

**Required evidence:** append-only/update/delete negative tests; correction
chain and event-order tests; privilege and function ownership review;
concurrent revision tests; evidence-preservation assertions after resolution.

**Approval authority:** Security/Architecture reviewer, application/financial-
integrity reviewer, and accounting authority. **Status: recommended hybrid,
pending approval.**

### GST-APP-06 - Purchase-posting state transitions

**Alternatives:** Preserve the guarded application transaction; add reviewed
database controls; or use a hybrid split between service orchestration and
database atomicity.

**Recommendation:** Preserve the existing guarded service transaction as the
workflow authority, with database constraints for identity, scope, and
idempotency. Add database functions or stronger controls only where the
approved evidence shows that application-only transitions cannot protect
atomic posting. Finalization must require accepted GST accounting state and
must be idempotent.

This minimizes an unnecessary accounting-behavior change while protecting
duplicate posting and partial state through constraints and transaction
boundaries. The trade-off is that every write path must use the service
boundary and that concurrency/rollback evidence is essential.

**Required evidence:** successful atomic finalization; injected failure
rollback; duplicate idempotency and concurrent claim tests; stock/ledger/
invoice consistency; unauthorized transition tests; retry determinism.

**Approval authority:** application/financial-integrity reviewer and
product/accounting owner, with database-owner review for any database control.
**Status: recommended service-led hybrid, pending approval.**

### GST-APP-07 - Defaults, backfill, and timestamp semantics

**Alternatives:** Keep Prisma/application-generated defaults; add deliberate
PostgreSQL defaults; or use an expand/backfill/contract sequence for fields
that eventually become non-null.

**Recommendation:** Preserve current Prisma-compatible defaults and nullable
pointer behavior first. Use an expand/backfill/contract sequence only after a
separate approved data review proves that every legacy row has sufficient
evidence; otherwise retain nullable fields and explicit legacy disclosure.
Do not silently change the existing purchase rounding or timestamp semantics.

This minimizes historical-data risk and preserves established behavior. The
trade-off is that nullable/legacy states remain visible until evidence exists,
and later tightening requires another controlled migration.

**Required evidence:** exact Prisma/database default comparison; legacy-row
classification; duplicate and null checks; isolated backfill rehearsal;
timestamp precision/time-zone review; regression tests for rounding and
invoice totals.

**Approval authority:** database owner and application/financial-integrity
reviewer, with accounting review for financial defaults. **Status:
recommended, pending approval.**

### GST-APP-08 - Rollback and repeatability

**Alternatives:** Catalog-guarded one-time operation; explicitly idempotent
additive operation; or staged rollback with documented irreversible steps.

**Recommendation:** Use a catalog-guarded, additive, repeatable operation for
disposable testing and a separately reviewed production rollout. Treat enum,
foreign-key, unique-key, `NOT NULL`, and historical-data changes as
object-specific rollback limits rather than promising a universal down
migration. Stop on mismatch instead of silently reconciling.

This makes reruns safer and surfaces drift before financial objects are
changed. The trade-off is more preflight logic and the need to document
irreversible or data-dependent recovery explicitly.

**Required evidence:** clean-run and rerun catalog comparisons; injected
partial-failure behavior; rollback rehearsal where supported; mismatch stop
evidence; post-operation schema and privilege hash/checklist.

**Approval authority:** database owner and Security/Architecture reviewer,
with application/financial-integrity review. **Status: recommended, pending
approval.**

## Evidence checklist before any approval

- [ ] Each decision has written approval from the named authority; no
      recommendation is treated as approval.
- [ ] Approved grant matrix includes schema, table, function, default, and
      Prisma-role privileges.
- [ ] Ordinary verification roles are non-superuser and
      non-`BYPASSRLS`.
- [ ] RLS enabled/forced state and command-specific policies are reviewed.
- [ ] `calculation_id` relation choice and exact Prisma names are approved.
- [ ] Invoice pointer, composite-key, default, nullability, and backfill plan
      is approved without fabricating historical facts.
- [ ] Immutable-history, correction, and posting-transition controls are
      approved by financial-integrity reviewers.
- [ ] Disposable identity, fixture ownership, cleanup authorization, and
      rollback boundaries are verified.
- [ ] All 15 proposed tests have an approved execution owner and evidence
      format.

## Local disposable PostgreSQL prerequisite check

This earlier check was read-only on 2026-10-24 before the Docker Desktop
recheck recorded below. The current Docker Desktop and Engine status,
including the current image inspection result, is recorded in the
**Disposable PostgreSQL pre-configuration safety review** section.

The Compose definition and `.env.financial-e2e.example` agree on PostgreSQL
17 Alpine, loopback port `55432`, required credentials, database name, and
the `pharmnos-financial-e2e` application marker. The Compose definition binds
only to `127.0.0.1`, uses tmpfs storage, has no restart policy, labels the
service `financial-e2e-isolated`, and includes a healthcheck. The safety script
consistently requires distinct test and ordinary identities, a test/e2e
database name, the exact marker, and `application_name`. The readiness script
additionally requires fixture ownership, explicitly gated cleanup,
independently verified identity, explicit execution authorization, and a
disabled scenario runner.

The example configuration contains no Supabase host, pooler host, approved
Supabase project reference, or Supabase-style database URL. The current local
test configuration file is absent, so no disposable-test endpoint is selected
at this time. Before execution, the safety guard must compare the configured
test identity with `DATABASE_URL`; a loopback configuration alone is not a
substitute for that independent check.

Missing minimum setup:

1. Obtain approval to pull or otherwise make the `postgres:17-alpine` image
   available; no image pull was attempted.
2. Create the ignored local `.env.financial-e2e` from the example with a
   random password; do not print or persist that password in documentation.
3. Define and review owned tenant/user fixtures and gated cleanup.
4. Independently verify the loopback test identity and separation from
   `DATABASE_URL`.
5. Obtain approvals for the schema shape, grants/RLS, `calculation_id`,
   defaults/backfill, and execution.

No container was started or stopped, no database was created, and no schema
operation was executed. **Environment status: daemon ready, image unavailable,
configured: no, executed: no, verified: no.**

## Historical pending GST design decision recheck (2026-10-24 snapshot)

The following table preserves the 2026-10-24 pre-authorization snapshot. It
must not be read as the current decision status.

| Decision | Current status |
|---|---|
| GST-APP-01 - grant model and write boundary | Recommended restricted backend/application boundary; pending database-owner and Security/Architecture approval |
| GST-APP-02 - RLS enforcement and non-bypass verification roles | Recommended RLS with preferably forced RLS and ordinary non-`BYPASSRLS` verification; pending approval |
| GST-APP-03 - `calculation_id` relationship | Recommended Option B composite relationship; pending product/accounting, database-owner, and Security/Architecture approval |
| GST-APP-04 - invoice pointers and composite keys | Recommended exact Prisma-compatible nullable pointers and mapped composite FKs; pending approval |
| GST-APP-05 - immutable evidence and reconciliation records | Recommended service/database-control hybrid; pending Security/Architecture, financial-integrity, and accounting approval |
| GST-APP-06 - purchase-posting state transitions | Recommended service-led transaction with database integrity controls; pending application/financial-integrity and accounting approval |
| GST-APP-07 - defaults, backfill, and timestamp semantics | Recommended preserve current compatible defaults and defer tightening; pending database-owner and financial-integrity approval |
| GST-APP-08 - rollback and repeatability | Recommended catalog-guarded additive repeatability with object-specific rollback limits; pending database-owner and Security/Architecture approval |

At that snapshot, all statuses were **Pending**. Docker readiness was not
schema readiness and was not rollout authorization.

## Current decision-status reconciliation (2026-10-25)

GST-APP-01 through GST-APP-08 are now recorded above as **Owner's Decision**.
This changes decision status only. It does not establish implementation,
database rollout, RLS isolation, financial correctness, or production
approval. The local provisioning artifact remains review-only, and live
Supabase remains **NO-GO**.

## Disposable PostgreSQL pre-configuration safety review

This review was read-only on 2026-10-24. No image pull, container operation,
environment-file edit, database connection, or schema operation was performed.

### Docker versions

| Component | Result | Gate |
|---|---|---|
| Docker Desktop | `4.96.3.244472` (`4.96.3 (244472)`) | PASS - executable present |
| Docker Engine | `29.9.2`, Docker Desktop Linux engine | PASS - daemon available |
| `postgres:17-alpine` image | Present locally; no matching container is running | PASS for image availability; execution remains blocked by the other gates |

The image was inspected only; it was not pulled.

### Implementation safety-gate audit

| Safety gate | Implementation evidence | Result |
|---|---|---|
| Loopback-only database exposure | Compose publishes `127.0.0.1:${FINANCIAL_E2E_DB_PORT}:5432` | PASS |
| Explicit isolated test identity | Example requires a named test database and marker; safety guard requires `TEST_DATABASE_URL`, `TEST_DATABASE_NAME`, and `TEST_DATABASE_MARKER` | PASS, pending local configuration |
| Exact URL equality rejection | `validateFinancialE2eTarget` rejects `TEST_DATABASE_URL === DATABASE_URL` | PASS |
| Parsed connection-identity comparison | Safety guard compares protocol, hostname, port, database path, and username, rejecting the same parsed identity even when query parameters differ | PASS |
| Live `DATABASE_URL` alias/DNS rejection | The async guard resolves both hosts, rejects resolution failure/empty results, rejects a test endpoint sharing the live protocol/address/port endpoint identity, and rejects Supabase/pooler test hosts | PASS for the implemented preflight; independent server-side identity verification remains required |
| Credential/log safety | Compose passes credentials through environment interpolation; the runner reads required variable names and reports sanitized preflight messages. No full URL or password is printed by the inspected runner | PASS for inspected paths; future executor logs still require review |
| Owned cleanup restriction | Fixture lifecycle validates run IDs, exact resource shapes, duplicates, supported types, frozen authorization snapshots, and dependency-aware cleanup plans | PASS for the pure contract |
| Destructive cleanup authorization | Cleanup requires independent identity verification and explicit authorization; no cleanup executor is implemented in the inspected lifecycle module | PASS as a fail-closed contract; execution remains unverified |
| Scenario-runner gating | `scripts/financial-e2e.mjs` requires `ALLOW_FINANCIAL_E2E=true`, validates all target fields, verifies connected database identity and marker, then deliberately blocks because the scenario runner is not enabled. Readiness and `canStartFinancialScenario` now validate target/run-bound identity evidence directly; the former caller-supplied identity boolean is rejected. | PASS for current fail-closed runner; no financial scenario executes |
| No project-secret mounts | Compose has no volumes or secret mounts and uses tmpfs for PostgreSQL data | PASS |
| No public PostgreSQL exposure | Compose uses loopback binding only; no external host binding is configured | PASS |
| Local configuration | `.env.financial-e2e`, `.env.test`, and `.env.test.local` are absent; no variable names are configured locally | FAIL for configuration readiness |
| Compose/example completeness | The example supplies all four Compose interpolation names. Safety execution additionally needs the separately exported test URL, ordinary URL comparison input, database name, marker, and explicit authorization | PASS for template completeness; not configured |

### Guard limitations requiring explicit treatment

The current implementation is strong against exact URL reuse, parsed
same-identity reuse, Supabase/pooler test endpoints, DNS failure or empty
resolution, matching resolved protocol/address/port endpoint identity,
missing markers, unsafe database names, unauthorized cleanup, foreign fixture
identifiers, and accidental scenario execution. DNS/address comparison is not
proof of database identity: shared infrastructure, NAT, proxies, or a
reassigned address can make endpoint comparison inconclusive.

Before any test execution, an approved setup process must independently verify
the connected test database identity and prove separation from
`DATABASE_URL`. The verification must record sanitized database identity,
server/role attributes, and the absence of superuser/`BYPASSRLS` authority for
the RLS test role. No current configuration exists on which to perform that
check.

### Configuration review result

**Configuration safe to proceed:** **FAIL / NOT READY**.

The local Docker daemon and required image are ready, and the Compose
isolation properties and endpoint preflight pass. The local test environment
is absent, and independent server-side identity verification has not occurred.
Configuration must not be created or executed until the remaining blockers are
handled under separate authorization. At the time of this historical review,
the eight GST decisions remained pending; the current owner-decision status is
recorded in the reconciliation section above.

## Target-identity remediation record

The endpoint-validation remediation changed:

- `scripts/financial-e2e-safety.mjs` to use an async DNS resolver, validate
  PostgreSQL URL schemes, reject Supabase/pooler test hosts, reject DNS
  failures and empty address results, compare parsed URL identity, and compare
  resolved protocol/address/port/user endpoint identity.
- `scripts/financial-e2e-readiness.mjs` and `scripts/financial-e2e.mjs` to
  await the asynchronous target validator.
- `tests/financial-e2e-safety.test.mjs` to inject offline DNS resolvers and
  cover exact matches, query-only identity reuse, Supabase/pooler hosts,
  matching resolved endpoints, DNS failure/empty results, valid loopback
  separation, readiness gates, and cleanup/scenario authorization behavior.

No test resolver connects to Supabase or any database. The runner still
requires an independent connected-database identity check before any future
mutation, and it remains deliberately blocked from executing scenarios.

Focused validation result: **24/24 offline financial E2E safety tests passed**.
Modified JavaScript files passed `node --check`. Docker Engine was rechecked as
available at `29.9.2`; `postgres:17-alpine` was present locally and no
matching container was running. `.env.financial-e2e` remains absent.

Residual risks: DNS/address comparison cannot prove PostgreSQL database
identity; the server-side identity query and ordinary non-superuser,
non-`BYPASSRLS` role checks remain mandatory. The local configuration remains
subject to separate execution authorization, while the eight owner decisions
are recorded above and implementation/verification remain incomplete.

## Proposed execution sequence and stop conditions

1. Obtain named human approvals for the decision matrix.
2. Confirm Docker daemon readiness and inspect the required image.
3. Prepare local-only test configuration and run the pure safety/readiness
   guards without enabling the scenario runner.
4. Start only the explicitly approved disposable service and independently
   verify identity.
5. Apply only the separately reviewed disposable schema setup.
6. Run GST-TEST-01 through GST-TEST-15 with an ordinary,
   non-`BYPASSRLS` verification role where applicable.
7. Capture sanitized catalog, privilege, policy, relationship, failure, and
   cleanup evidence.
8. Stop and clean up only run-owned disposable resources under the approved
   cleanup gate.
9. Review failures and approval evidence before considering any live rollout.

Stop immediately if identity is ambiguous, the target is not disposable,
Docker uses an unexpected engine, the image or schema does not match the
approved target, a role has unintended `BYPASSRLS`/superuser authority,
fixtures are not provably owned, cleanup is not authorized, a test requires
live data, or any operation would need unapproved DDL/DML.

## Review boundary

This artifact does not modify Prisma, SQL rollout assets, application code,
environment configuration, roadmap, or GST policy decisions. It does not
provision a database, run migrations, execute DDL/DML, or perform Git
operations.

## Latest offline identity-guard verification

The financial E2E guard now performs fail-closed validation of injected DNS
results: only non-empty arrays of valid IPv4/IPv6 strings are accepted,
addresses are normalized and deduplicated, and malformed resolver output is
rejected. The connected-session verifier uses safe metadata aliases and
requires database, current/session role, server address/port,
`application_name`, the independently provisioned environment marker,
`rolsuper=false`, and `rolbypassrls=false`.

Identity evidence is versioned, frozen, freshness-limited, and bound to both
the sanitized target identity and the current run. Cleanup, readiness, and
scenario eligibility now validate this evidence contract directly; none
accepts the former caller-supplied boolean identity flag. Exact boolean-false
role flags are required, and invalid or null target bindings fail closed.
Cleanup still requires explicit authorization and owned fixtures. Scenario
execution remains fail-closed. The offline suite now contains 32 tests and
must pass before any disposable database preparation is considered.
These tests use mocked clients and resolvers only; they do not establish
real server identity or database behavior.

Current verification status:

| Control | Status | Evidence or remaining prerequisite |
|---|---|---|
| JavaScript syntax checks | Verified | Modified financial E2E modules pass `node --check` |
| Offline identity and lifecycle tests | Verified | 32/32 focused tests passed; coverage includes metadata, evidence binding, malformed role flags, invalid target bindings, cleanup, readiness, and scenario gates |
| PostgreSQL server identity | Not verified | Requires an authorized disposable database and read-only metadata query |
| Independent environment marker | Not configured | `pharmnos.financial_e2e_marker` must be provisioned and verified in the disposable database |
| Non-superuser/non-`BYPASSRLS` role | Not verified | Requires disposable runtime evidence |
| Docker image | Locally present | `postgres:17-alpine` is present but no container is running |
| Local financial E2E environment | Not configured | `.env.financial-e2e` remains absent |
| GST rollout approvals | Pending | All eight GST-APP decisions remain Pending; no approval is inferred from these recommendations |

Residual limitations remain: DNS/address checks cannot prove database identity,
and the in-process JavaScript evidence contract is not cryptographic. Live
Supabase rollout remains **NO-GO**.

## Local disposable configuration created — 2026-10-25

With explicit authorization, the ignored local file `.env.financial-e2e` was
created from `.env.financial-e2e.example`. The example template was not
modified. The local configuration uses the documented disposable identity:

- PostgreSQL URL scheme: `postgresql`
- Host: loopback `127.0.0.1`
- Port: `55432`
- Database name: isolated financial E2E name containing `e2e`
- Database user: dedicated local E2E user
- Application marker: `pharmnos-financial-e2e`
- Password: locally generated random value; intentionally not recorded here

The file is covered by the existing `.gitignore` entry. Required variable
names are present, the password meets the local minimum length check, the
Compose configuration resolves successfully with the file, and an offline
target validation passed against a sanitized synthetic comparison target.
No secret values or full connection strings are recorded in this artifact.

This configuration does not prove database readiness. The server-side
`pharmnos.financial_e2e_marker` setting is not provisioned, no PostgreSQL
server identity has been verified, and no container or database was accessed.
The local file therefore remains configuration-only; database-backed execution
is still blocked until the disposable service is separately authorized,
started, and verified with a non-superuser, non-`BYPASSRLS` role. All eight
GST approvals remain **Pending**, and live Supabase rollout remains
**NO-GO**.

## Identity verifier and credential separation update — 2026-10-25

The offline identity verifier now accepts PostgreSQL `inet_server_addr()`
values with valid IPv4/IPv6 CIDR suffixes, normalizes the address component,
and rejects malformed, out-of-range, or missing addresses. Focused tests
cover bare IPv4, IPv4 `/32`, bare IPv6, IPv6 `/128`, malformed prefixes, and
missing values. This is a pure verifier change; no database connection was
used to claim runtime verification.

The guarded runner now separates Compose bootstrap credentials
(`FINANCIAL_E2E_DB_USER` and `FINANCIAL_E2E_DB_PASSWORD`) from runtime
credentials (`FINANCIAL_E2E_RUNTIME_DATABASE_URL` and
`FINANCIAL_E2E_RUNTIME_DB_USER`). The runtime password is not stored in
tracked files, printed, or regenerated by this change. The existing local
environment file does not yet contain the new runtime variables because the
previously provisioned runtime password must not be reset or guessed.

Current state remains blocked: the local container may be running from a
previously authorized provisioning step, but this change did not connect to
it, alter it, or claim identity verification. A separately authorized,
secure local wiring of the existing runtime password is required before the
guarded runner can be used. Schema, RLS, tenant isolation, and financial
behavior remain unverified. All eight GST approvals remain **Pending** and
live Supabase rollout remains **NO-GO**.
