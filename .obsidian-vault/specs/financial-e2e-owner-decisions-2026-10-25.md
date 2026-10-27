# Pharmnos Lite Financial E2E Owner Decisions

**Date:** 2026-10-25  
**Time:** 22-14-38 (IST)  
**Status:** `OWNER DESIGN SELECTION RECORDED — DECISION C REVIEW SIGN-OFFS PENDING`

## Purpose and scope

This document records six proposed owner directions for the future Financial
E2E expectation contract and its isolated GST verification preparation. It is a
decision package for technical review, not an approval to modify the
expectation package, apply SQL, initialize a database, execute GST or broader
Financial E2E tests, or perform cleanup.

The canonical working stage remains POST-P7 — PRE-PRODUCTION VALIDATION. The
phase tracker confirms that P1-P7 are complete and that pre-production
validation is still in progress
([`PHASE_TRACKER.md`](../PHASE_TRACKER.md:1)).

## Proposed decision table

| Decision | Proposed selection | Intended direction | Status |
|---|---|---|---|
| DELETE policy | **Option 1 — Omit mutable-table runtime DELETE policies** | Preserve the no-runtime-DELETE posture. Do not define a mutable-table runtime DELETE policy family. Address disposable fixture cleanup through a separately reviewed and explicitly approved mechanism. | **Owner-selected design; security, database, and application/financial-integrity review pending** |
| Expectation contract | **B — Structured, versioned contract** | Replace name-only coverage with an explicitly designed contract capable of representing approved schema, columns, enums, keys, FK actions, privileges, ownership, RLS properties, and trigger/function requirements. | **Owner-approved interim transition: flat package remains adapter-only; structured contract remains review-only** |
| Privileges and ownership | **A — Least-privilege baseline** | Keep bootstrap/object ownership separate from the ordinary runtime role; limit runtime schema and table access; revoke inappropriate public/default privileges; do not grant runtime ownership of privileged functions. | Proposed; exact ACL and ownership matrix pending |
| RLS | **A — Strict tenant isolation** | Enable and force RLS for the approved table set, use fail-closed tenant predicates and documented relation-scoped exceptions, and verify isolation with the restricted runtime role. | Proposed; executable policy specification pending |
| GST history and posting | **A — Hybrid enforcement** | Keep database integrity controls for immutable history, finalized pointers/status protections, and guarded posting transitions, while keeping workflow, hashing, idempotency, concurrency, retry, and atomic financial behavior in approved service-level controls. | Proposed; object-level specification pending |
| Evidence | **A — Bound, sanitized, append-only evidence** | Require approved connected provenance, target/run/attempt and manifest binding, sanitized output, append-only storage, access controls, and an approved retention policy. | Proposed; evidence architecture and authorization pending |

The remaining selections are proposed directions only. The recorded A/B
interim approvals do not approve an executable expectation package, SQL
artifact, migration, database initialization, GST execution, broader
Financial E2E execution, or cleanup.

## Recorded owner approvals and unresolved Decision C

On `2026-10-25` (IST), the project owner explicitly approved the following
interim directions in the project-owner conversation:

1. **Decision A — contract transition:** keep
   `scripts/financial-e2e-reviewed-expectations.json` as the only format
   consumed by the current adapter; keep the structured contract review-only;
   and do not implement migration, translation, or version dispatch.
2. **Decision B — interim DELETE posture:** maintain no runtime DELETE by
   default and make no interim SQL, grant, RLS-policy, or table-classification
   changes.

This records the conversation as the decision source. It does not invent a
signature, identity beyond the project-owner approval stated in the
conversation, or reviewer approval. The approval does not authorize
expectation population, manifest approval, database initialization, SQL
execution, GST or broader Financial E2E execution, cleanup, or production
activity.

**Decision C — Option 1 selected by the project owner (design only).** On
`2026-10-25`, the project owner explicitly selected **Option 1 — Omit
mutable-table runtime DELETE policies** in the project-owner conversation.
This selection preserves the no-runtime-DELETE posture and does not define a
mutable-table runtime DELETE policy family.

The selection is recorded with the available provenance: the project-owner
conversation and its date. No reviewer identity, signature, timestamp, or
reviewer approval is invented. Security, database, and
application/financial-integrity reviewers must still record their decisions on
the selected design, including table classification, effective privileges,
roles, RLS behavior, ownership, audit requirements, and catalog expectations.

Disposable fixture cleanup remains a separate unresolved item. It must use a
separately reviewed and explicitly approved mechanism; no cleanup mechanism is
assumed or authorized by this design selection.

This design selection does not authorize implementation, SQL execution, grant
or RLS changes, database initialization, tests, cleanup, connected database
access, expectation population, manifest approval, deployment, or production
activity. Live Supabase remains NO-GO and connected initialization remains
disabled and fail-closed.

### Owner-finalized Design C remediation directions

On `2026-10-26`, the project owner provided the following decisions for the
open Design C remediation questions:

1. **SEC-01 — DELETE-policy wording:** classify the
   `tenant_delete_<table>` wording as **requiring later correction**. The
   intended Option 1 meaning is explicit: ordinary runtime principals have no
   DELETE privilege on mutable tables and no mutable-table runtime DELETE
   policies. Immutable financial and GST-history protections remain explicit,
   and any cleanup capability remains separate with its own approved mechanism.
2. **SEC-03 — trigger disabling:** **prohibit trigger disabling entirely**.
   This is a design decision only and does not authorize cleanup or database
   execution.
3. **SEC-04 — GST cleanup treatment:** leave all six trigger-disabled GST table
   treatments **pending technical evidence**. No table is approved for direct
   deletion, cascade removal, retention, or prohibited deletion until the
   required applied FK and trigger evidence exists.
4. **SEC-05 — soft-delete authorization:** require source review before
   selecting permission names or authorized roles for product, customer, and
   supplier deactivation. No permission name, role mapping, or enforcement
   evidence is approved by this direction.
5. **SEC-02/SEC-06 — database evidence:** confirm the minimum target-bound,
   read-only evidence requirements listed in the owner worksheet for identity,
   role attributes and inheritance, ownership, ACLs, PUBLIC/default ACLs,
   effective privileges, RLS state, FK/trigger state, and routine security and
   EXECUTE privileges. This confirmation does not authorize database access or
   catalog execution.

These are owner design decisions, not technical sign-offs. Security/architecture,
database, and application/financial-integrity reviews remain pending. Fixture
cleanup remains unresolved, and no cleanup mechanism is selected.

## Source basis and proposed resolutions

### 1. DELETE policy

The RLS review artifact defines SELECT, INSERT, and UPDATE policy families and
documents immutable GST history as SELECT/INSERT only
([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31)
and its immutable-history sections).

The security review artifact separately names
`tenant_delete_<table> (only mutable tables)` in a policy-name contract, while
also revoking runtime DELETE for immutable GST history, `tenants`, and
`audit_logs`
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:55-73)
and lines 105-125).

The finalized owner direction is no runtime DELETE on mutable tables and no
mutable-table runtime DELETE policy family. The existing
`tenant_delete_<table>` wording requires later correction. Security and
database reviewers must verify that future approved artifacts implement this
direction; they must not treat it as authorization to create a DELETE policy.

### 2. Expectation contract

The current expectation package is intentionally unapproved and contains flat
string lists, empty object/constraint/index/trigger/function/grant/table and
policy lists, and only the `public` schema and runtime role
([`financial-e2e-reviewed-expectations.json`](../../scripts/financial-e2e-reviewed-expectations.json:1-18)).

The reviewed mapping identifies source-grounded requirements that need more
than names, including column metadata, enum ordering, composite keys, foreign
key actions, RLS predicates, privileges, ownership, and trigger/function
properties
([`gst-disposable-assertion-mapping-2026-10-25.md`](./gst-disposable-assertion-mapping-2026-10-25.md:1-30)).

The proposed resolution is a structured, versioned contract. Its schema,
versioning rules, validation behavior, and fail-closed handling remain
unapproved and must be designed before any expectation entries are populated.

### 3. Privileges and ownership

The reviewed security model distinguishes `pharmnos_e2e` as the bootstrap
object-owner role and `pharmnos_e2e_runtime` as the ordinary runtime role. It
specifies runtime schema usage without schema creation, reviewed table grants,
revoked public defaults, and restrictions on privileged function ownership
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-39)
and lines 43-111).

The proposed resolution is a least-privilege baseline. It does not establish
actual ACLs, ownership, inherited privileges, default ACLs, sequence
privileges, routine privileges, or effective catalog state. Those exact
matrices require review and later connected read-back.

### 4. RLS

The reviewed RLS specification requires enabled and forced RLS, runtime policy
families, fail-closed tenant predicates, and documented exceptions for
`tenants`, `users`, and `role_permissions`
([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-80)).

The proposed resolution is strict tenant isolation on an approved table set.
The exact final table set, policy commands, roles, predicates, exceptions,
DELETE behavior, and catalog checks remain subject to security and database
review.

### 5. GST history and posting

The security review requires future owner-controlled controls for immutable GST
history, finalized invoice pointers/status/version protection, and guarded
posting transitions. It specifies SQLSTATE `42501` for immutable-history
mutation rejection and SQLSTATE `23514` for invalid posting transitions
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-198)).

The rollout record records hybrid service/database immutability and service-led
posting as owner direction, while keeping implementation and validation as
separate gates
([`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:72-115)).

The proposed resolution is hybrid enforcement. Exact trigger/function names,
owners, timing, events, bodies, privileges, and the database/service
boundary must not be invented and remain pending technical review.

### 6. Evidence

The initialization contract requires a fixed fail-closed sequence covering
authorization, target/role validation, marker establishment, identity
read-back, catalog/artifact verification, runtime RLS verification, and
sanitized evidence
([`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:1-18)).

The safety and connected-initialization adapters require independent target
identity, role separation, target/run/attempt binding, freshness, and
manifest-aware preparation
([`financial-e2e-safety.mjs`](../../scripts/financial-e2e-safety.mjs:34-174);
[`financial-e2e-connected-initialization-adapter.mjs`](../../scripts/financial-e2e-connected-initialization-adapter.mjs:34-115)).

The artifact manifest requires future connected identity, catalog, RLS,
runtime, and sanitized-evidence checks, but remains review-only and unapproved
([`financial-e2e-artifact-manifest.json`](../../prisma/financial-e2e-artifact-manifest.json:1-46)).

The proposed resolution is bound, sanitized, append-only evidence with
approved provenance, storage, access controls, and retention. The repository
does not currently define the authoritative storage location, retention
period, access-control matrix, or complete connected catalog evidence shape.

## Unresolved security and database review items

The following items must be resolved before expectation drafting can become an
executable contract:

1. Reconcile the DELETE-policy conflict between the RLS and security review SQL
   artifacts.
2. Define exact schema, table, sequence, routine, and default-ACL privileges;
   role inheritance behavior; prohibited privileges; and object ownership.
3. Specify the structured expectation contract, including versioning,
   validation, supported assertion shapes, unknown-field handling, and
   fail-closed behavior.
4. Approve the exact RLS table set, enable/force checks, policy commands,
   roles, predicates, relation-scoped exceptions, and DELETE behavior.
5. Define trigger/function objects, ownership, timing, events, SQLSTATE
   behavior, privileges, and the database/service enforcement boundary.
6. Specify authoritative catalog read-back fields for schema, roles, ACLs,
   ownership, keys, indexes, RLS, policies, triggers, and functions.
7. Specify evidence provenance, target/run/attempt and manifest binding,
   sanitization, append-only storage, access controls, retention, and failure
   handling.

## Decisions requiring explicit approval

### Project owner

- Confirm the six proposed selections or provide an alternative direction.
- Confirm whether the structured contract is justified by the intended
  verification scope.
- Confirm that no-runtime-DELETE is the intended product/security direction,
  subject to the technical reconciliation below.
- Confirm the desired evidence retention and access policy once a concrete
  proposal is presented.

### Security/architecture reviewer

- Reconcile DELETE policy behavior.
- Approve strict RLS semantics, relation-scoped exceptions, role restrictions,
  immutable-history controls, and the database/service boundary.
- Review the least-privilege and controlled-function model.

### Database reviewer

- Approve exact effective ACL, ownership, inheritance, default privilege,
  sequence, routine, and RLS catalog expectations.
- Define the connected catalog read-back fields and verify that the future
  contract can represent them.
- Review trigger/function installation requirements without treating review SQL
  as evidence of applied database state.

### Application/financial-integrity reviewer

- Approve service-level posting, idempotency, hashing, concurrency, retry,
  rollback, and atomic invoice/stock/ledger/audit behavior requirements.

These approvals are not present merely because GST-APP-01 through GST-APP-08
are recorded as owner direction. The rollout record explicitly keeps
implementation, database rollout, and runtime verification as separate gates
([`gst-rollout-approval-and-disposable-readiness-2026-10-24.md`](./gst-rollout-approval-and-disposable-readiness-2026-10-24.md:72-115)).
PGST-01 likewise retains pending implementation, database/migration, testing,
pilot, and production authorization
([`pgst-01-purchase-gst-workflow-policy.md`](./pgst-01-purchase-gst-workflow-policy.md:1-15)).

## Proposed direction versus actual database state

The selections in this document are design direction only:

- Prisma schema and generated SQL are source/baseline material, not proof that
  a database contains the objects.
- Review-only security and RLS SQL describe intended controls, not executable
  authorization or live ACL/policy/function state.
- The expectation package and artifact manifest remain unapproved.
- Offline initialization and safety validation can validate supplied evidence
  shape, binding, freshness, and fail-closed behavior; they cannot prove that
  connected observations are truthful or that catalog contents match.
- No database identity, ownership, effective privilege, RLS behavior,
  trigger/function installation, tenant isolation, or evidence persistence is
  verified by this record.

No proposed decision authorizes database initialization, GST execution, broader
Financial E2E execution, or cleanup.

## Next-step sequence

1. Obtain project-owner confirmation of the six proposed directions.
2. Conduct security and database technical review, including reconciliation of
   the DELETE-policy conflict and definition of exact catalog controls.
3. Design and approve the structured expectation contract, validation rules,
   versioning, and fail-closed behavior.
4. Draft only source-grounded expectation entries under the approved contract;
   leave unresolved properties out rather than guessing.
5. Separately obtain explicit authorization for isolated database
   initialization.
6. After initialization evidence is accepted, obtain separate authorization for
   GST execution.
7. Obtain separate authorization for broader Financial E2E execution.
8. Obtain separate cleanup authorization and prove fixture ownership and
   cleanup evidence.

This document does not perform or authorize any step after technical review.
