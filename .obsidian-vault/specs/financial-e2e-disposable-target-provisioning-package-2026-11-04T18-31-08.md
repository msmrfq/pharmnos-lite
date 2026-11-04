---
title: Disposable Financial E2E Runtime Target Provisioning Package — 2026-11-04T18-31-08
date: 2026-11-04
status: IMPLEMENTATION READY — OPERATOR AUTHORIZATION REQUIRED
phase: POST-P7 - PRE-PRODUCTION VALIDATION
---

## Goal

Prepare an evidence-backed operator package for one new, isolated disposable
PostgreSQL target for the approved T13/T19/T25 current-release runtime
campaign. This document is a preparation package only. It is not a target
contract, authorization, provisioning record, database evidence, or cleanup
authorization.

## Acceptance Criteria

- [x] Exact target-contract fields and validation rules are identified from
      executable code and contract tests.
- [x] The Compose resource model, isolation controls, initialization sequence,
      artifact package, and cleanup boundary are identified.
- [x] The current artifact manifest and schema fingerprints are checked
      offline without connecting to a database.
- [x] A redacted target configuration and contract template are prepared.
- [x] Exact post-authorization commands are documented and marked
      `NOT EXECUTED`.
- [x] Operator decisions and authorization expiry requirements are explicit.
- [x] Concrete implementation gaps are separated from verified controls.
- [x] The shared lifecycle now binds Compose, initialization, suite execution,
      evidence recording, and cleanup to one immutable target fingerprint.
- [x] T13 GSTIN verification, T19 purchase GST revision safety, and T25 GST
      calculation/treatment remain independently executable function-owned
      suites with separate evidence; no combined runner was introduced.
- [ ] An operator assigns and approves the exact target identity, resource
      scope, runtime scope, cleanup scope, and expiry.
- [ ] The operator authorizes each lifecycle phase and the independent
      target-bound suites.

## Out of Scope

Provisioning, database connection, migrations, schema initialization, fixture
creation, runtime acceptance, cleanup, Docker lifecycle operations, production
or Live Supabase access, application-code changes, and Git history changes.

# [PHARMNOS-LITE STATUS]

**Stage:** Disposable runtime target provisioning preparation

**Completion:** 11/11 preparation and lifecycle-safeguard deliverables
verified; 0/2 runtime gates authorized (exact target and operator scope)

**Decision:** **IMPLEMENTATION READY; RUNTIME NOT AUTHORIZED**. The shared
lifecycle controls are implemented and focused-tested. No target was selected,
created, connected, initialized, mutated, or disposed.

**Blockers:** The operator has not supplied an exact target contract,
phase-specific authorization, or permitted runtime scope. Runtime verification
remains intentionally split across the existing independent suites; no
combined T13/T19/T25 runner is required or permitted by the current task.

**Next:** Authorize one exact disposable target and the required lifecycle
phases under the checklist below, then execute the independent suites
separately.

## Post-implementation lifecycle update

The preparation review identified lifecycle gaps that are now closed by
[`financial-e2e-target-lifecycle.mjs`](../../scripts/financial-e2e-target-lifecycle.mjs)
and the contract-bound Compose adapter
[`financial-e2e-compose.mjs`](../../scripts/financial-e2e-compose.mjs):

- Every non-validation phase revalidates the full contract, binding, schema
  artifact hash, endpoint, roles, Compose project/service/profile, expiry, and
  ordinary-database separation.
- Infrastructure evidence must prove one exact loopback Compose container with
  the approved image, service, profile, port, tmpfs storage, disabled restart,
  and isolation label before initialization or cleanup can proceed.
- Initialization, suite execution, and evidence recording have separate
  authorization variables. Cleanup has its own authorization and requires
  `FINANCIAL_E2E_CLEANUP_MODE=DISPOSABLE_TARGET_DISPOSAL`.
- Upstream evidence must be fresh, `PASS`, phase-correct, and bound to the
  same contract. Evidence files use exclusive creation and omit connection
  strings.
- The T19 purchase GST entry point consumes an externally authorized target and
  does not provision or dispose infrastructure. T13 GSTIN verification and
  T25 GST calculation/treatment remain target-free offline suites. Each
  function-owned suite records its own result and evidence.

These controls are static and focused-test verified only. They do not authorize
or claim target-bound runtime execution.

## 1. Verified contract schema

The authoritative executable contract is
[`financial-e2e-target-contract.mjs`](../../scripts/financial-e2e-target-contract.mjs).
Contract version `1` requires all of the following:

| Field | Required value or rule |
|---|---|
| `version` | `1` |
| `runId` | Lowercase run-scoped ID matching `[a-z0-9][a-z0-9_-]{2,63}` |
| `host` | Loopback only: `127.0.0.1`, `::1`, or `localhost` |
| `port` | Integer `1..65535`, not PostgreSQL default `5432`, and operator-assigned |
| `databaseName` | `pharmnos_financial_e2e` or a unique lowercase suffix |
| `bootstrapRole` | `pharmnos_e2e` |
| `runtimeRole` | `pharmnos_e2e_runtime`; distinct from bootstrap |
| `bootstrapCredentialSource` | `FINANCIAL_E2E_DB_PASSWORD` |
| `runtimeCredentialSource` | `FINANCIAL_E2E_RUNTIME_DB_PASSWORD` |
| `marker` | `pharmnos-financial-e2e` |
| `composeProject` | `pharmnoslite` or `pharmnoslite-financial-e2e[-suffix]` |
| `composeService` | `financial-e2e-postgres` |
| `composeProfile` | `financial-e2e` |
| `schemaArtifact` | `prisma/financial-e2e-schema-provisioning.generated.sql` |
| `schemaArtifactHash` | Current verified SHA-256 below |
| `authorizedAt` | Finite authorization timestamp, not in the future |
| `expiresAt` | Finite future timestamp |

The contract also requires `TEST_DATABASE_URL` and
`FINANCIAL_E2E_RUNTIME_DATABASE_URL` to identify the same exact loopback
endpoint and database while using the distinct approved roles. `DATABASE_URL`
must identify a different ordinary database endpoint and must not be a
Supabase or pooler endpoint. Contract validation does not accept a generic
port-only or database-name-only match.

The target binding used by initialization authorization includes the contract
version, run ID, endpoint, database, roles, credential-source names, marker,
Compose project/service, and schema artifact hash. The full contract is still
validated for profile, artifact path, authorization time, and expiry.

## 2. Proposed target configuration — template only

The following values are intentionally unresolved. Angle-bracket values must
be assigned and independently verified by the operator. This is **not an
executable contract**.

| Field | Proposed value |
|---|---|
| Run ID | `<OPERATOR_ASSIGNED_RUN_ID>` |
| Host | `127.0.0.1` |
| Port | `<OPERATOR_ASSIGNED_UNUSED_LOOPBACK_PORT>`; do not reuse `55432`, `55435`, `55460`, or removed Q17 ports |
| Database | `<UNIQUE_pharmnos_financial_e2e_SUFFIX>` |
| Bootstrap role | `pharmnos_e2e` |
| Runtime role | `pharmnos_e2e_runtime` |
| Bootstrap secret source | `FINANCIAL_E2E_DB_PASSWORD` in local ignored environment only |
| Runtime secret source | `FINANCIAL_E2E_RUNTIME_DB_PASSWORD` in local ignored environment only |
| Marker | `pharmnos-financial-e2e` |
| Compose project | `<UNIQUE_pharmnoslite-financial-e2e-SUFFIX>` |
| Compose service | `financial-e2e-postgres` |
| Compose profile | `financial-e2e` |
| Schema artifact | `prisma/financial-e2e-schema-provisioning.generated.sql` |
| Schema artifact SHA-256 | `508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5` |
| Authorization time | `<OPERATOR_APPROVED_IST_UNIX_MS>` |
| Expiry time | `<OPERATOR_APPROVED_FUTURE_IST_UNIX_MS>` |

Redacted contract template:

```json
{
  "version": 1,
  "runId": "<OPERATOR_ASSIGNED_RUN_ID>",
  "host": "127.0.0.1",
  "port": "<OPERATOR_ASSIGNED_UNUSED_LOOPBACK_PORT>",
  "databaseName": "pharmnos_financial_e2e_<UNIQUE_SUFFIX>",
  "bootstrapRole": "pharmnos_e2e",
  "runtimeRole": "pharmnos_e2e_runtime",
  "bootstrapCredentialSource": "FINANCIAL_E2E_DB_PASSWORD",
  "runtimeCredentialSource": "FINANCIAL_E2E_RUNTIME_DB_PASSWORD",
  "marker": "pharmnos-financial-e2e",
  "composeProject": "pharmnoslite-financial-e2e-<UNIQUE_SUFFIX>",
  "composeService": "financial-e2e-postgres",
  "composeProfile": "financial-e2e",
  "schemaArtifact": "prisma/financial-e2e-schema-provisioning.generated.sql",
  "schemaArtifactHash": "508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5",
  "authorizedAt": "<OPERATOR_APPROVED_IST_UNIX_MS>",
  "expiresAt": "<OPERATOR_APPROVED_FUTURE_IST_UNIX_MS>"
}
```

The contract contains no password. Secret values remain only in the local
ignored environment and password manager. Do not copy connection strings or
secret values into this document, vault notes, committed code, or a checked-in
contract artifact.

## 3. Provisioning flow and safety assessment

### 3.1 Resource creation and isolation

[`docker-compose.financial-e2e.yml`](../../docker-compose.financial-e2e.yml)
defines one `postgres:17-alpine` service named
`financial-e2e-postgres` under the `financial-e2e` profile. The service:

- publishes PostgreSQL only on `127.0.0.1`;
- uses operator-provided `FINANCIAL_E2E_DB_USER`,
  `FINANCIAL_E2E_DB_PASSWORD`, `FINANCIAL_E2E_DB_NAME`, and
  `FINANCIAL_E2E_DB_PORT`;
- uses tmpfs-only `/var/lib/postgresql/data`;
- has no automatic restart;
- carries `com.pharmnos.environment=financial-e2e-isolated`; and
- waits on a `pg_isready` health check.

The Compose file creates the container and initial database. It does not create
the immutable target contract. The provisioner does not create the container or
database; it expects an already-created empty target and connects using the
bootstrap URL. The Compose image receives `POSTGRES_USER=pharmnos_e2e` and
`POSTGRES_DB=<target database>`, which is the repository's bootstrap-owner
boundary for a newly initialized container. The connected provisioner verifies
the current bootstrap identity and requires the privileges needed to initialize
the empty database, but it does not independently read back
`pg_database.datdba`.

### 3.2 Connected initialization

[`financial-e2e-provision-local.mjs`](../../scripts/financial-e2e-provision-local.mjs)
performs the following connected sequence after all guards pass:

1. Load and validate the target contract and schema hash.
2. Require the exact initialization authorization, run ID, attempt ID, target
   binding, marker, evidence policy, and recovery policy.
3. Require fresh `INFRASTRUCTURE_CREATION` evidence from the contract-bound
   Compose adapter and reject an ordinary target overlap, non-loopback target,
   wrong database naming, wrong roles, wrong marker, non-tmpfs storage
   metadata, or wrong service/profile metadata.
4. Verify the approved checked-in artifact manifest and every listed file hash.
5. Connect with `pharmnos_e2e` and set/read back the independent database
   marker.
6. Confirm database identity, bootstrap login, and an empty public schema.
7. Probe an existing runtime role before mutation; a stale role that cannot
   authenticate stops the run.
8. Begin one transaction, apply the generated Prisma baseline, create the
   restricted runtime role if absent, create no-login admin/validation roles if
   absent, and apply grants, forced RLS, policies, immutable-history triggers,
   GST governance controls, finalized-invoice guards, and posting-transition
   guards.
9. Commit, verify the schema/control catalog, reconnect as the runtime role,
   verify runtime identity and schema access, and require zero runtime DELETE
   privileges.
10. Emit sanitized local `SCHEMA_INITIALIZATION` evidence for the target
    binding, run, attempt, schema fingerprint, restricted runtime, and result.

The provisioner is not an infrastructure creator. The supported lifecycle is
therefore deliberately split: `financial:e2e:up` creates and records the
exact container, the provisioner initializes only after that evidence and its
own authorization are present, and each application suite records evidence
under a separate authorization. `financial:e2e:down` is separately authorized
and verifies the recorded container identity before disposal.

The approved initialization values are:

```text
FINANCIAL_E2E_INITIALIZATION_SCOPE=DATABASE_INITIALIZATION_ONLY
FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD=BOOTSTRAP_CONNECTED_CATALOG_READBACK
FINANCIAL_E2E_ROLE_SETUP_METHOD=PRECREATED_LOCAL_CREDENTIAL_PROCEDURE
FINANCIAL_E2E_BASELINE_PACKAGE=VERSION_PINNED_REVIEW_ARTIFACTS
FINANCIAL_E2E_EVIDENCE_MODE=SANITIZED_APPEND_ONLY_LOCAL
FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS=30
FINANCIAL_E2E_EVIDENCE_PATH_APPROVED=true
FINANCIAL_E2E_RECOVERY_POLICY=UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET
```

### 3.3 Artifact package

[`financial-e2e-artifact-manifest.json`](../../prisma/financial-e2e-artifact-manifest.json)
is currently marked `APPROVED_EXECUTABLE_LOCAL_ONLY` and contains eight
executable artifacts. Offline SHA-256 verification matched the checked-in
manifest:

| Artifact | SHA-256 |
|---|---|
| `prisma/schema.prisma` source schema | `a4c2d9e2eadf25b58728b3dcb9b7274278d08dd948aab2da16e1999dd543368d` |
| `prisma/financial-e2e-schema-provisioning.generated.sql` | `508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5` |
| `prisma/financial-e2e-security-controls.review.sql` | `88af752140aab6bffa6a71ed613f7456adf93c493a05691674025efdadc596c0` |
| `prisma/financial-e2e-rls-policies.review.sql` | `327339cdee28392964fc336d4177ffe01475959a78f5fadba372742e967d8b8b` |
| `prisma/financial-e2e-additive-provisioning.review.sql` | `a4637c0a28670cbe0f53195942f2dabb75c3f04918e9e91e58aa763ed7cef90a` |
| `prisma/migrations/0001_baseline/migration.sql` | `d7d618cb6e5f30a1f62efbdf2fdf36dc7eb5b557de4da417ee8165f551512c1d` |
| `prisma/migrations/0008_hsn_governance_integrity/migration.sql` | `a52333f0526cf512588f488ca2c488d2322f211ca7a81505dad381bda111e047` |
| `prisma/migrations/0011_inventory_valuation_decision_history/migration.sql` | `d7148f60b6cfb2493af7c8a5216778de80acd7c8e17127350daa7231fffab768` |

The connected provisioner independently verifies the checked-in manifest
hashes before initialization. The static guard and provisioner must be run
against the same working tree; no artifact edits are authorized by this
package.

### 3.4 Cleanup boundary

Cleanup is separate from initialization. The fixture lifecycle requires an
exact run-owned manifest, target identity evidence, target-contract binding,
explicit cleanup authorization, dependency-aware planning, and
post-cleanup verification. Row-level deletion is prohibited for immutable GST
and financial history.

For a disposable target, the preferred boundary is database/container
disposal after evidence capture, not row deletion. The exact Compose project
must be unique and independently confirmed before disposal. The existing
`financial:e2e:down` package script is not safe for this package because it
does not pass the unique Compose project and uses `--remove-orphans`; use only
the explicit project-bound command in Section 5 after separate disposal
authorization.

## 4. Concrete controls and remaining decisions

The preparation review identified the following gaps. The first three are now
closed by the shared lifecycle implementation:

1. **Contract-bound Compose lifecycle — implemented.**
   [`financial-e2e-compose.mjs`](../../scripts/financial-e2e-compose.mjs) uses
   the contract project/service/profile, refuses pre-existing project
   containers, inspects the exact container, and records its identity. It does
   not use `--remove-orphans`.
2. **External target authorization — implemented.** The T19 Purchase GST
   revision-safety suite consumes the externally supplied contract and rejects
   missing, expired, mismatched, generic, or ordinary-environment-overlapping
   targets. The provisioner and Compose adapter have separate phase gates. The
   T13 and T25 suites are intentionally offline and target-free.
3. **Combined runner — intentionally not introduced.** The current task
   requires the T13 GSTIN, T19 Purchase GST revision-safety, and T25 GST
   calculation/treatment paths to remain independently executable. No
   combined T13/T19/T25 command may be inferred from their independent
   evidence.
4. **Existing-role reuse remains prohibited.** The provisioner can create the
   restricted role when absent, but a fresh newly created Compose database is
   still required. A pre-provisioned or previously used target must not be
   adopted without new evidence and authorization.
5. **Marker setup occurs before the provisioning transaction.** The
   `ALTER DATABASE ... SET pharmnos.financial_e2e_marker` operation is outside
   the later baseline/control transaction. A transaction rollback does not
   revert that database setting.
6. **Post-commit verification failure remains a stop condition.** The
   provisioner commits before schema/runtime verification. If verification
   fails, the recovery policy requires preserving evidence, inspection, and
   reauthorization rather than retrying the same target.
7. **Role setup naming and behavior remain documented separately.** The
   initialization contract records
   `PRECREATED_LOCAL_CREDENTIAL_PROCEDURE`, while the provisioner creates
   `pharmnos_e2e_runtime` inside the guarded transaction when absent. The
   fresh Compose owner boundary must remain explicit.
8. **Database-owner readback is not explicit.** The Compose environment
   establishes the bootstrap owner for a new target, but the provisioner does
   not independently read `pg_database.datdba`. Operator authorization must
   accept that boundary or require an additional reviewed readback.

## 5. Exact post-authorization command sequence — NOT EXECUTED

The commands below are a runbook template only. They must not be copied into
an active shell until the operator supplies the exact values, sets the local
ignored environment, approves the scope and expiry, and accepts or resolves
the remaining boundaries in Section 4.

### 5.1 Offline artifact and syntax gate

```powershell
pnpm exec node .\scripts\financial-e2e-provisioning-static-guard.mjs
pnpm exec node --check .\scripts\financial-e2e-target-contract.mjs
pnpm exec node --check .\scripts\financial-e2e-provision-local.mjs
```

Expected result: the static guard reports `PROVISIONING_STATIC_GUARD=PASS`,
and both syntax checks exit `0`. These commands do not connect to a database
or create Docker resources.

### 5.2 Local environment preparation

Create `.env.financial-e2e` locally from
[`.env.financial-e2e.example`](../../.env.financial-e2e.example). Do not
commit it. Replace every placeholder with operator-approved values:

```text
ALLOW_FINANCIAL_E2E=true
FINANCIAL_E2E_DB_USER=pharmnos_e2e
FINANCIAL_E2E_DB_PASSWORD=<LOCAL_BOOTSTRAP_SECRET>
FINANCIAL_E2E_DB_NAME=pharmnos_financial_e2e_<UNIQUE_SUFFIX>
FINANCIAL_E2E_DB_PORT=<OPERATOR_ASSIGNED_UNUSED_LOOPBACK_PORT>
FINANCIAL_E2E_RUNTIME_DB_USER=pharmnos_e2e_runtime
FINANCIAL_E2E_RUNTIME_DB_PASSWORD=<LOCAL_RUNTIME_SECRET>
TEST_DATABASE_NAME=pharmnos_financial_e2e_<UNIQUE_SUFFIX>
TEST_DATABASE_MARKER=pharmnos-financial-e2e
TEST_DATABASE_URL=postgresql://pharmnos_e2e:<URL_ENCODED_BOOTSTRAP_SECRET>@127.0.0.1:<PORT>/pharmnos_financial_e2e_<UNIQUE_SUFFIX>?application_name=pharmnos-financial-e2e
FINANCIAL_E2E_RUNTIME_DATABASE_URL=postgresql://pharmnos_e2e_runtime:<URL_ENCODED_RUNTIME_SECRET>@127.0.0.1:<PORT>/pharmnos_financial_e2e_<UNIQUE_SUFFIX>?application_name=pharmnos-financial-e2e
FINANCIAL_E2E_COMPOSE_PROJECT=pharmnoslite-financial-e2e-<UNIQUE_SUFFIX>
DATABASE_URL=<ORDINARY_DATABASE_URL_FROM_LOCAL_IGNORED_ENVIRONMENT>
FINANCIAL_E2E_TARGET_CONTRACT=<SERIALIZED_OPERATOR_APPROVED_CONTRACT>
FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING=<BINDING_OF_THAT_CONTRACT>
FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT=<FULL_FINGERPRINT_OF_THAT_CONTRACT>
FINANCIAL_E2E_RUN_ID=<OPERATOR_ASSIGNED_RUN_ID>
FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID=<OPERATOR_ASSIGNED_ATTEMPT_ID>
FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED=true
FINANCIAL_E2E_INITIALIZATION_AUTHORIZED=true
FINANCIAL_E2E_EXECUTION_AUTHORIZED=true
FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED=true
FINANCIAL_E2E_CLEANUP_AUTHORIZED=false
FINANCIAL_E2E_INITIALIZATION_SCOPE=DATABASE_INITIALIZATION_ONLY
FINANCIAL_E2E_TARGET_APPROVED=true
FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD=BOOTSTRAP_CONNECTED_CATALOG_READBACK
FINANCIAL_E2E_ROLE_SETUP_METHOD=PRECREATED_LOCAL_CREDENTIAL_PROCEDURE
FINANCIAL_E2E_BASELINE_PACKAGE=VERSION_PINNED_REVIEW_ARTIFACTS
FINANCIAL_E2E_EVIDENCE_MODE=SANITIZED_APPEND_ONLY_LOCAL
FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS=30
FINANCIAL_E2E_EVIDENCE_PATH_APPROVED=true
FINANCIAL_E2E_RECOVERY_POLICY=UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET
FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-infrastructure-evidence.json
FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-initialization-evidence.json
FINANCIAL_E2E_SUITE_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-<suite>-evidence.json
FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE=.obsidian-vault/specs/financial-e2e-cleanup-evidence.json
# Target-bound suite identity (T19 only); T13/T25 use their offline runners.
FINANCIAL_E2E_SUITE_NAME=purchase-gst
FINANCIAL_E2E_CLEANUP_MODE=DISPOSABLE_TARGET_DISPOSAL
```

The ordinary `DATABASE_URL` must remain a different endpoint and must never
be replaced with the disposable target URL.

### 5.3 Contract-bound Compose preflight and creation

The supported adapter consumes the exact contract project, service, profile,
port, image, tmpfs storage, restart policy, and isolation label. It refuses to
adopt pre-existing project containers and records an exclusive
`INFRASTRUCTURE_CREATION` evidence file. Creation is a mutating Docker
operation and is **NOT EXECUTED** in this preparation task:

```powershell
pnpm financial:e2e:up
```

The adapter's exact inspection is a failed-closed gate. Do not connect or
repair the target if it reports an endpoint, label, image, storage, service,
profile, or container-count mismatch.

### 5.4 Connected initialization

Only after the exact contract, `INFRASTRUCTURE_CREATION` evidence, separate
initialization authorization, and expiry are approved:

```powershell
pnpm exec node .\scripts\financial-e2e-provision-local.mjs
```

This command connects and mutates the disposable database. It is
**NOT EXECUTED**. A failure after connection must follow
`UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET`; do not rerun against the same
target merely to obtain a green result.

### 5.5 Independent function-owned suites

The three suites are independently executable and each owns its assertions,
fixtures, execution command, and evidence. T13 and T25 are offline and do not
require a target. T19 is target-bound and validates the exact contract plus
fresh initialization evidence before connecting. No combined T13/T19/T25
runner exists.

T13 — GSTIN verification (offline):

```powershell
pnpm test:t13:gstin
```

Evidence defaults to a unique append-only
`.obsidian-vault/specs/t13-gstin-verification-evidence-<run-id>.json` path or
uses `T13_EVIDENCE_FILE`.

T19 — Purchase GST revision safety (target-bound; **NOT EXECUTED**):

```powershell
pnpm test:t19:purchase-gst
```

The command requires the authorized target contract and lifecycle phase
authorizations. It writes the configured lifecycle evidence and detailed
`.obsidian-vault/specs/purchase-gst-application-evidence-<run-id>.json`
artifact without exposing credentials.

T25 — GST calculation and treatment (offline):

```powershell
pnpm test:t25:gst-calculation
```

Evidence defaults to a unique append-only
`.obsidian-vault/specs/t25-gst-calculation-treatment-evidence-<run-id>.json`
path or uses `T25_EVIDENCE_FILE`.

The pre-existing `sales:gst:acceptance` harness remains supplemental,
broader Sales GST application-path regression coverage from prior work. It is
not a fourth function-owned T13/T19/T25 suite and must not be used as T13
GSTIN evidence.

The T13 and T25 commands were executed independently as offline suite checks
for this boundary correction. T19 and all target-bound provisioning,
initialization, acceptance, and cleanup commands remain **NOT EXECUTED** in
this preparation package. No combined runtime runner is introduced or implied.
The 0419-only command
`pnpm exec node .\scripts\financial-e2e-preprovisioned-verify.mjs` must not be
used for the new target; it is hard-coded to the historical 0419 identity.

### 5.6 Exact target disposal after evidence

Only after the approved runtime evidence is captured, the target contract has
not expired during evidence capture, and separate disposal authorization is
recorded:

```powershell
pnpm financial:e2e:down
```

This command is **NOT EXECUTED**. It requires separate cleanup authorization,
`FINANCIAL_E2E_CLEANUP_MODE=DISPOSABLE_TARGET_DISPOSAL`, fresh contract
validation, the recorded infrastructure evidence, and an exact container-ID
match. The adapter does not use `--remove-orphans`; it verifies the exact
project is empty afterward. Do not use broad Docker pruning.

## 6. Operator authorization checklist

The operator must provide one explicit decision covering every item:

- [ ] Authorize creation of exactly one new disposable Compose project:
      `<APPROVED_COMPOSE_PROJECT>`.
- [ ] Assign and approve the exact loopback port and unique database suffix.
- [ ] Confirm the port is not `55432`, historical 0419 `55435`, retained
      operator-owned `55460`, removed Q17 ports `55461–55466`, or any active
      unrelated resource.
- [ ] Confirm the ordinary `DATABASE_URL` is separate and remains untouched.
- [ ] Confirm the database contains no production, staging, shared, or user
      data and will use tmpfs-only storage.
- [ ] Approve the exact bootstrap/runtime credential sources and supply the
      secret values only through local ignored configuration.
- [ ] Approve the exact contract JSON, target binding, run ID, initialization
      attempt ID, authorization timestamp, and expiry timestamp.
- [ ] Approve initialization scope limited to
      `DATABASE_INITIALIZATION_ONLY`.
- [ ] Approve the exact T13/T19/T25 runtime operations and independent suite
      execution order; no combined runner or broader GST/financial scenarios
      are implied.
- [ ] Approve sanitized append-only local evidence with 30-day retention.
- [ ] Approve the recovery rule:
      `UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET`.
- [ ] Authorize infrastructure creation, schema initialization, suite
      execution, and evidence recording as separate phase decisions.
- [ ] Approve disposal of only the exact Compose project after evidence, or
      explicitly preserve it for a separately authorized follow-up. Execution
      authorization does not imply cleanup authorization.
- [ ] Accept or separately review the remaining fresh-target boundaries in
      Section 4, including existing-role reuse, post-commit verification
      recovery, role setup naming, and database-owner readback.
- [ ] Set an expiry that is future at execution time and short enough for the
      independent suites; the runner's historical default of two hours is not
      an operator approval unless explicitly selected.

## 7. Evidence and preservation record

The implementation review inspected the existing worktree and preserved all
tracked and untracked changes. No Git operation was performed: nothing was
staged, unstaged, reset, cleaned, stashed, committed, pushed, checked out, or
rewritten by this task.

No database connection, SQL statement, migration, provisioning command, Docker
command, process lifecycle operation, cleanup, or target selection occurred.
No credentials or full connection strings were recorded.

## 8. Recommendation

**Implementation ready; runtime not authorized.** The repository now has a
contract-bound Compose adapter, guarded connected provisioner, independent
suite gates, append-only evidence recording, and separately authorized cleanup.
A human must still approve one exact target, its phase scope, and its expiry.
The operator should not use the retained 0419 target, generic `55432`,
retained `55460`, or any historical resource. Runtime verification remains
blocked until that authorization and target contract exist.
