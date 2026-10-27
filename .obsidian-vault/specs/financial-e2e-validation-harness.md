---
title: Financial E2E Validation Harness
date: 2026-10-01
status: Draft
---

## Goal
Create a safe, disposable financial end-to-end validation harness for Pharmnos Lite to verify runtime financial behavior including purchase finalization, sale finalization, FEFO allocation, rollback behavior, invoice sequence behavior, payment behavior, and tenant isolation.

## Acceptance Criteria
- [ ] Harness implements hard safety guards (ALLOW_FINANCIAL_E2E, TEST_DATABASE_URL, TEST_DATABASE_NAME, TEST_DATABASE_MARKER)
- [ ] Harness refuses to run if safety gates not satisfied
- [ ] Purchase success test: verifies finalization, totals, stock movements, supplier ledger, audit log
- [ ] Purchase rollback test: verifies atomicity on failure
- [ ] Sale success test: verifies FEFO allocation, stock movements, customer ledger, invoice sequence
- [ ] Insufficient-stock rollback test: verifies no partial state remains
- [ ] Invoice sequence rollback test: verifies sequence behavior on failure
- [ ] Payment E2E test: verifies payment atomicity, ledger updates, balance updates
- [ ] Tenant isolation test: verifies tenant A cannot access tenant B data
- [ ] Harness refuses to run if TEST_DATABASE_URL not configured or equals DATABASE_URL
- [ ] Harness requires explicit ALLOW_FINANCIAL_E2E=true flag
- [ ] Harness requires TEST_DATABASE_MARKER=pharmnos-financial-e2e
- [ ] Harness requires application_name=pharmnos-financial-e2e in connection string
- [ ] Harness verifies connected database identity before any mutation
- [ ] Cleanup strategy: disposable test tenant with complete cleanup

## Out of Scope
- Modifying production business logic to make tests pass
- Creating a full CI/CD platform
- Adding unnecessary dependencies
- Modifying existing financial business logic
- Deploying to Vercel
- Modifying production data or demo tenant data

## Safety Requirements
- Harness must refuse to run if TEST_DATABASE_URL is missing
- Harness must refuse to run if TEST_DATABASE_URL equals DATABASE_URL
- Harness must refuse to run if TEST_DATABASE_NAME doesn't contain "test" or "e2e"
- Harness must refuse to run if TEST_DATABASE_MARKER != "pharmnos-financial-e2e"
- Harness must require ALLOW_FINANCIAL_E2E=true
- Harness must verify connected database identity before any mutation
- Harness must NOT fall back to DATABASE_URL for financial mutation tests
- Harness must NOT print database passwords or full connection strings in logs
- Cleanup must NEVER target the existing demo tenant
- Cleanup must run on success and failure

## Pure Readiness and Fixture-Lifecycle Contract

`scripts/financial-e2e-safety.mjs` validates the target URL, ordinary database
identity comparison, test database naming, and the required application marker.
`scripts/financial-e2e-readiness.mjs` adds a non-database readiness contract that
requires documented tenant/user fixture ownership and an explicitly gated cleanup
strategy.

The pure contract reports configuration readiness separately from executable
readiness. It remains blocked unless an authorized setup process independently
verifies the connected database identity and an explicit execution authorization
is present. The scenario runner remains disabled regardless of pure configuration
success.

Cleanup targets must be recorded as owned by the current test run. The contract
rejects identifiers that are not owned by that run; it does not delete records or
assume that deleting a tenant is sufficient to remove related audit, ledger,
stock, payment, or storage records.

**Current evidence:** isolation and fixture-contract unit tests pass without a
database connection. Database identity, fixture creation, cleanup execution,
RLS behavior, and financial scenarios remain unverified and blocked.

The pure fixture lifecycle contract in
`scripts/financial-e2e-fixture-lifecycle.mjs` now requires:

- A valid run-owned manifest before fixture identifiers are recorded.
- Explicit resource type, identifier, and matching run ownership for every
	returned fixture identifier.
- Rejection of duplicates, foreign-run identifiers, unsupported resource types,
	and empty fixture results.
- The legal lifecycle is `CREATED -> FIXTURE_READY`, with a separate failure
	branch to `FIXTURE_FAILED` or `FIXTURE_FAILED_CLEANUP_READY`. A ready fixture
	may enter `CLEANUP_AUTHORIZED`, then `CLEANUP_FAILED` or `CLEANUP_COMPLETE`.
	No failure, cleanup, or completion state is scenario-ready.
- `FIXTURE_READY` is the only lifecycle state eligible for a financial scenario.
	Cleanup authorization is a separate destructive-cleanup gate and never implies
	fixture readiness or scenario authorization.
- Independent database identity verification and explicit cleanup authorization
	before building a cleanup plan.
- Cleanup authorization captures the exact validated resource set in a frozen
	resource snapshot. The cleanup plan revalidates the manifest and requires the
	current resources to match that snapshot; resource substitution, array
	replacement, duplicate injection, malformed resources, and foreign-run
	resources are rejected or made immutable.
- Dependency-aware cleanup ordering based on current Prisma foreign-key
	relationships, with each supported dependent resource asserted to precede its
	referenced parent in pure tests. Application-level references that are not
	Prisma relations are not inferred.
- Failure states that prevent subsequent scenario execution.
- `FIXTURE_FAILED_CLEANUP_READY` only when all partially created resources are
	explicitly returned with matching ownership; uncertain partial failures stay
	`FIXTURE_FAILED` and cannot be cleaned.
- `CLEANUP_COMPLETE` only after a future trusted cleanup executor explicitly
	reports `{ success: true, plan }`, where the plan exactly matches the
	authorized resource set and cleanup order. Plan generation alone never creates
	this state. A cleanup failure cannot transition to completion, and completion
	cannot be repeated.
- Storage objects are prohibited in financial fixtures for the current local
	contract. Storage cleanup is unsupported and must be designed separately.
- Manifest validation requires the complete structure, status-appropriate
	failure metadata, authorization evidence, and completion evidence. Cleanup-plan
	and scenario-start validation recheck the complete manifest.
- The pure contract freezes returned manifests, resources, snapshots, and plans,
	but it is not a cryptographic security boundary. Code executing in the same
	process can fabricate a structurally valid executor result; the future executor
	must report success only after actual database cleanup and retain its own
	operational evidence.

The order is a planned cleanup contract, not executed cleanup behavior. It does
not assume tenant cascading deletes are sufficient for all audit, ledger, stock,
payment, or storage-related records. Storage remains explicitly unsupported.
Fixture recording is a single-batch contract: all identifiers returned by one
fixture operation must be recorded before the manifest becomes
`FIXTURE_READY`; later incremental recording is rejected.

## Financial Verification Matrix

This matrix is the execution contract for a future authorized isolated-database
run. It records the evidence required; none of the database-backed scenarios
below has been executed in the current disconnected environment.

| Scenario | Preconditions | Action and assertions | Fixture / cleanup requirements | Current evidence | Blocker |
|---|---|---|---|---|---|
| Sales GST persistence and finalization | Applied sales schema; approved captured-fact scenarios and versioned rules; qualified GST review; verified test database identity | Create draft, finalize, assert required facts drive POS and CGST/SGST/IGST/cess, missing/unsupported facts fail closed, and persisted snapshots, totals, rule version, and `COMPLETE` status are used | Owned tenant, user, customer, product, batch, invoice, and lines; cleanup in dependency order | Pure calculator, action inspection, and schema inspection only | Policy/legal review, database rollout, and execution authorization |
| Business-profile validation and persistence | Applied schema; authorized tenant context | Save valid name/code/blank states, reject invalid state, verify persisted canonical value and tenant boundary | Owned tenant and profile; cleanup profile before tenant | Pure schema and action-mapping tests | Database persistence and RLS verification |
| Purchase GST reconciliation and posting guard | Approved versioned tax rules, captured transaction facts, discrepancy materiality/tolerance policy, and workflow authority | Save supplier-declared evidence intact; calculate expected taxable value, CGST, SGST, IGST, cess, and totals separately; reconcile; allow draft/review-pending discrepancy; block accounting completion/posting while material discrepancy is unresolved; assert explicit resolution, approver, audit event, accepted accounting values, preserved rounding, stock, supplier ledger, payable balance, and audit row | Owned supplier, products, invoice, lines, batches, movements, reconciliation records, ledger; cleanup all owned rows | Pure aggregate purchase contract and policy documentation only; no persistence or runtime evidence | Accounting/product approval, qualified GST review, schema/action implementation, isolated DB |
| Purchase GST persistence after policy approval | Approved supplier-evidence model, versioned rules, component/POS policy, rounding policy, and legacy policy | Create/finalize an eligible purchase and assert declared, calculated, accepted, component, discrepancy, POS, round-off, stock, supplier ledger, payable balance, and audit facts remain distinct and consistent | Owned supplier, products, invoice, lines, batches, movements, reconciliation records, ledger; cleanup all owned rows | No database-backed evidence | Policy approval and schema/action implementation |
| Tenant isolation and database RLS | Applied RLS; independently verified tenant/database identity | Create tenants A/B; assert cross-tenant reads and writes fail at application and database policy boundaries | Separate owned tenants/users; cleanup each run-owned tenant only | Application tenant scoping inspected; no DB evidence | Disposable DB and RLS execution |
| Sales and purchase rollback | Applied schema; failure injection point; verified transaction behavior | Force failure after partial writes; assert no invoice, stock, ledger, balance, audit, or sequence residue remains | Owned records and resettable isolated DB; cleanup after both success/failure | Outer Prisma transactions inspected only | Runtime transaction execution |
| Invoice-number and sequence rollback | Applied business profile and sequence fields | Fail finalization after sequence read/update boundary; assert sequence and invoice numbering remain correct | Owned profile/invoice fixture; serialized run or isolated database | Transaction code inspected only | Runtime failure-injection evidence |
| Stock movement and batch consistency | Applied inventory schema; deterministic FEFO data | Finalize purchase/sale; assert batch quantities, movement rows, references, and rollback consistency | Owned products, batches, invoices, movements; dependent-first cleanup | FEFO and action logic inspected; pure tests only | Runtime inventory execution |
| Customer and supplier ledger consistency | Applied ledger schema; approved tax/totals policy | Assert finalized invoice totals equal ledger debit/credit, balance updates, and audit metadata | Owned customers/suppliers, invoices, ledgers, payments; cleanup all references | Ledger write paths inspected; no DB execution | Runtime accounting verification |
| Historical invoice immutability and print behavior | Applied snapshot fields; finalized complete and legacy invoices | Mutate current masters after finalization; assert complete print uses persisted seller/customer/product/HSN/tax/POS/rule facts; assert legacy print preserves aggregate totals and discloses unavailable details without reconstruction or treating missing values as zero | One complete and one legacy invoice with owned masters; cleanup after print assertions | Pure snapshot-selection/completeness tests only | Applied schema and historical fixture execution |
| Schema rollout and legacy compatibility | Reviewed additive SQL; backup/rollback plan; representative legacy records | Apply schema in disposable DB, verify columns/indexes, read legacy rows, verify null-safe fallback, and test rollback plan | Disposable database backup and reset; no production backfill | Prisma/SQL assets inspected; SQL not executed | Human approval, disposable DB, backup/restore drill |

### Evidence and authorization rules

- Pure helper tests establish only the supplied calculation, validation, or
	selection behavior. They do not establish persistence, RLS, tenant isolation,
	transaction rollback, invoice sequencing, ledger consistency, or historical
	immutability.
- A future executor must independently verify database identity and production
	separation before fixture creation, record all returned owned identifiers in
	one batch, and retain cleanup-success evidence tied to the authorized plan.
- Purchase scenarios cannot be scheduled until the purchase policy record in
	`gst-audit-validation-and-plan.md` is approved by the responsible
	accounting and product decision-makers and the covered legal interpretation
	has qualified GST review.
- A purchase discrepancy must be tested as a state machine: supplier evidence
	remains unchanged; calculated expected values remain separate; unresolved
	material discrepancy permits draft/review-pending save but prevents
	accounting completion/posting; resolution records decision, authority, and
	audit evidence.
- Sales scenarios must prove required transaction facts drive POS and tax
	classification, and that absent facts or unsupported scenarios fail closed.
- GST-019 and GST-020 remain blocked until the disposable database, identity
	verification, fixture/reset lifecycle, cleanup authorization, and explicit
	execution approval are all present.

### Connected identity evidence contract

Before fixture creation, scenario execution, or destructive cleanup, the
executor must query the connected PostgreSQL session and validate all of the
following: `current_database()`, `current_user`, `session_user`,
`inet_server_addr()`, `inet_server_port()`, `application_name`, an
independently provisioned `pharmnos.financial_e2e_marker` setting, and the
connected role's `rolsuper` and `rolbypassrls` attributes. The expected
database, role, application marker, and environment marker are supplied by
the approved disposable configuration; caller-supplied booleans are not
identity evidence.

The resulting evidence is versioned, bound to the sanitized target identity
and the current run identifier, frozen, and subject to a freshness limit.
Cleanup validates that evidence again and also requires explicit cleanup
authorization and run-owned resources. Missing, stale, future, mismatched,
incomplete, malformed, superuser, or `BYPASSRLS` evidence fails closed. The
readiness and scenario gates validate this same evidence contract; they do not
accept a caller-supplied identity boolean. The scenario runner remains
disabled until every independent gate succeeds.

The marker is not currently provisioned by the documented Compose definition.
It must be established and verified in the isolated database through a
separately authorized setup; an environment variable or caller assertion is
not sufficient. These JavaScript evidence objects are an in-process contract,
not a cryptographic security boundary, so the disposable database, role,
network binding, and operator authorization remain required controls. DNS,
hostname, and address comparisons are only preliminary separation checks and
cannot prove PostgreSQL server or database identity.

### Bootstrap and runtime credential separation

Compose initialization uses `FINANCIAL_E2E_DB_USER` and
`FINANCIAL_E2E_DB_PASSWORD` only for the ephemeral PostgreSQL bootstrap
account. The guarded runner must use the separately supplied local-only
`FINANCIAL_E2E_RUNTIME_DATABASE_URL` and
`FINANCIAL_E2E_RUNTIME_DB_USER` values for identity verification and future
runtime operations. The runtime role must be independently provisioned as
`LOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`; its password must remain only in
the ignored local environment configuration or an equivalent secret store.
The Compose/bootstrap credentials must not be reused as proof of restricted
runtime privileges.

PostgreSQL may return `inet_server_addr()` with a CIDR suffix such as
`172.18.0.2/32`. The verifier strictly accepts valid IPv4/IPv6 addresses
with an optional valid prefix, normalizes the address component, and rejects
malformed or missing values. This normalization does not establish database
identity by itself.

## Test Cases
1. Purchase success: create draft purchase → finalize → verify stock, ledger, audit
2. Purchase rollback: trigger failure → verify no partial state remains
3. Sale success: create batches with different expiries → finalize sale → verify FEFO allocation
4. Insufficient-stock rollback: attempt sale with insufficient stock → verify full rollback
5. Invoice sequence rollback: verify sequence behavior on failed transaction
5. Payment E2E: create sale → execute payment → verify ledger, balance, atomicity
6. Tenant isolation: create tenant A and B → verify isolation