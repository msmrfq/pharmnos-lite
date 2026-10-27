# Pharmnos Lite Design C Owner-Decision Worksheet

**Date:** 2026-10-26  
**Working stage:** POST-P7 — PRE-PRODUCTION VALIDATION  
**Decision C:** Option 1 — Omit mutable-table runtime DELETE policies  
**Decision C status:** Owner-selected design; not technically approved  
**Owner:** Masum Rafique  
**Assigned technical reviewer:** Masum Rafique — security/architecture, database, and application/financial integrity  
**Technical sign-offs:** Pending  
**Fixture cleanup:** Unresolved  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed

## Purpose and authorization boundary

This worksheet requests explicit owner decisions on unresolved Design C
questions. It does not record answers until the owner provides them and does
not replace the three technical sign-offs.

Completing this worksheet would not authorize:

- SQL, grants, RLS changes, migrations, or database initialization.
- Application, schema, expectation, manifest, adapter, or tracker changes.
- Supabase or other connected database access.
- Tests, fixture creation, cleanup, trigger disabling, or deployment.
- Environment changes, Git operations, or production activity.

Owner decisions and technical sign-offs are separate. Masum Rafique's
assignment to all three reviewer roles is not a completed review or approval.

## 1. SEC-01 — DELETE-policy wording

### Proposed interpretation for owner confirmation

Under owner-selected Option 1:

1. Ordinary application/runtime principals have no `DELETE` privilege on
   mutable tables.
2. No mutable-table runtime `DELETE` policies are defined.
3. Immutable financial and GST-history tables additionally have no runtime
   `UPDATE` or `DELETE` privilege and no `UPDATE` or `DELETE` policy.
4. Any bootstrap-only cleanup capability, if later approved, is outside the
   ordinary runtime policy family and requires a separate trust boundary.

Source basis:

- [`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:17)
- [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31)
- [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:130-173)
- [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-81)

The security-controls review artifact still contains:

```text
tenant_delete_<table> (only mutable tables)
```

Source: [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125)

### Owner decision request

**Confirm or revise the proposed Option 1 interpretation:**  
`____________________________________________________________`

**Classify the `tenant_delete_<table>` wording as exactly one:**

- [ ] Obsolete.
- [ ] Non-operative historical text.
- [x] Requires later correction.
- [ ] Other owner direction: `________________________________________`

**Owner rationale or conditions:**  
`____________________________________________________________`  
`____________________________________________________________`

**Owner decision status:** `Recorded — owner decision provided 2026-10-26`

No technical sign-off is implied by this request. No SQL, RLS, expectation, or
policy artifact change is authorized.

## 2. SEC-03 — Trigger disabling

### Source evidence

The GST security-behavior script disables user triggers on six GST tables,
performs cleanup DELETE operations, re-enables the triggers, and commits:

[`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)

The security contract relies on owner-controlled triggers to reject GST-history
UPDATE/DELETE with SQLSTATE `42501`:

[`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:155-172)

Direct script execution is currently blocked by a fail-closed guard:

[`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:145)

### Alternatives and trade-offs

| Alternative | Trade-off |
|---|---|
| Prohibit trigger disabling entirely | Strongest protection for immutable GST history and simplest audit boundary; may require disposable target destruction or fixture retention instead of row cleanup. |
| Consider trigger disabling only within a separately authorized bootstrap-only process on a verified disposable target | May support row cleanup when target destruction is unavailable; requires strict target identity, bootstrap/runtime separation, owned-resource proof, explicit authorization, failure recovery, trigger restoration, post-cleanup verification, and sanitized evidence. |

### Owner decision request

Select exactly one direction for further technical review:

- [x] Prohibit trigger disabling entirely.
- [ ] Consider trigger disabling only within a separately authorized,
      bootstrap-only process on a verified disposable target, subject to the
      controls listed above.
- [ ] Other owner direction: `________________________________________`

**Owner rationale, prerequisites, or conditions:**  
`____________________________________________________________`  
`____________________________________________________________`

This decision would not authorize cleanup, trigger disabling, target access, or
database execution.

**Owner decision status:** `Recorded — owner decision provided 2026-10-26`

## 3. SEC-04 — GST cleanup treatment

The following six tables are trigger-disabled in the reviewed cleanup script.
Actual FK behavior, trigger behavior, cascade behavior, and applied database
state are unverified.

| GST table | Proposed treatment — owner must decide/refer | Applied FK/trigger evidence |
|---|---|---|
| `purchase_gst_evidence_revisions` | Pending technical evidence; no treatment selected | Unverified |
| `purchase_gst_line_evidence` | Pending technical evidence; no treatment selected | Unverified |
| `purchase_gst_calculations` | Pending technical evidence; no treatment selected | Unverified |
| `purchase_gst_accounting_decisions` | Pending technical evidence; no treatment selected | Unverified |
| `purchase_gst_reconciliation_events` | Pending technical evidence; no treatment selected | Unverified |
| `purchase_gst_reconciliation_event_lines` | Pending technical evidence; no treatment selected | Unverified |

Source: [`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)

The source visibly deletes only `purchase_gst_calculations` and
`purchase_gst_evidence_revisions` among these six tables. The other four
tables' treatment is not established by the script.

### Owner decision request

For each row, record one treatment or direct the technical reviewers to
determine it after target-bound evidence:

**Additional owner conditions or exclusions:**  
`____________________________________________________________`  
`____________________________________________________________`

The owner is not being asked to infer FK or trigger behavior from the Prisma
schema. Applied FK constraints, `ON DELETE` actions, deferrability, trigger
definitions, trigger ownership/state, and expected residual rows require
separate database evidence.

**Owner cleanup-treatment status:** `Recorded — pending technical evidence; owner decision provided 2026-10-26`  
**Fixture-cleanup mechanism:** `Unresolved — no mechanism selected`

## 4. SEC-05 — Soft-delete permissions

The three active actions visibly require authenticated tenant context and use
tenant-scoped lookup/update predicates. They do not visibly call
`requirePermission()`. The existing helper loads permissions and can reject a
missing permission, but enforcement for these actions is not verified.

Sources:

- [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235)
- [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414)
- [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:568-589)
- [`tenant-context.ts`](../../src/lib/db/tenant-context.ts:20-25)
- [`tenant-context.ts`](../../src/lib/db/tenant-context.ts:38-104)

### Product deactivation

**Action:** `deleteProductAction`  
**Operation:** Set product `is_active = false`.

- **Owner-approved permission name:** `Not selected — source review required first`
- **Authorized role(s):** `Not selected — source review required first`
- **Required audit event:** `Yes / No / Undecided`
- **Dependency restrictions:** `______________________________`
- **Required enforcement location:** `______________________________`
- **Owner conditions:** `Require source review before selecting names or roles`

### Customer deactivation

**Action:** `deleteCustomerAction`  
**Operation:** Set customer `is_active = false`.

- **Owner-approved permission name:** `Not selected — source review required first`
- **Authorized role(s):** `Not selected — source review required first`
- **Required audit event:** `Yes / No / Undecided`
- **Dependency restrictions:** `______________________________`
- **Required enforcement location:** `______________________________`
- **Owner conditions:** `Require source review before selecting names or roles`

### Supplier deactivation

**Action:** `deleteSupplierAction`  
**Operation:** Set supplier `is_active = false`.

- **Owner-approved permission name:** `Not selected — source review required first`
- **Authorized role(s):** `Not selected — source review required first`
- **Required audit event:** `Yes / No / Undecided`
- **Dependency restrictions:** `______________________________`
- **Required enforcement location:** `______________________________`
- **Owner conditions:** `Require source review before selecting names or roles`

No permission name, role mapping, audit requirement, dependency rule, or
enforcement path is being invented. No enforcement is considered verified by
this worksheet.

**Owner permission-direction status:** `Recorded — source review required before names/roles; owner decision provided 2026-10-26`  
**Application/security technical sign-off:** `Pending`

## 5. SEC-02 / SEC-06 — Database evidence requirements

The owner is asked to confirm the evidence requirements below, not to authorize
database access or catalog execution.

### Minimum target-bound, read-only evidence

For an explicitly identified disposable target, evidence should be bound to the
target, run, attempt, artifact version, and source hashes and should include:

1. Database, server, schema, and connected-role identity.
2. Role attributes: login, superuser, `BYPASSRLS`, `INHERIT`, replication, and
   full membership/inheritance graph.
3. Table, schema, sequence, routine, function, and trigger ownership.
4. Object ACLs, including table, schema, sequence, routine, and function ACLs.
5. `PUBLIC` ACLs and default ACLs.
6. Effective runtime `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`
   privileges, including inherited privileges.
7. RLS enabled/forced state and each applicable policy's command, target role,
   `USING`, and `WITH CHECK` expressions.
8. Applied FK constraints, `ON DELETE` actions, deferrability, and relevant
   trigger definitions/state.
9. Routine owner, security mode, search path, and EXECUTE privileges.
10. Sanitized append-only evidence storage and retention controls.

Source basis:

- [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-50)
- [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:139-172)
- [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31)
- [`financial-e2e-initialization-contract.mjs`](../../scripts/financial-e2e-initialization-contract.mjs:1-20)

### Owner confirmation request

**Confirm these minimum evidence requirements for future technical review:**  
`____________________________________________________________`

**Required additions or exclusions:**  
`____________________________________________________________`  
`____________________________________________________________`

This confirmation would define review evidence expectations only. It would not
authorize a target, connection, catalog query, SQL, initialization, or cleanup.

**Owner evidence-direction status:** `Recorded — minimum evidence requirements confirmed 2026-10-26`  
**Database/security technical sign-off:** `Pending`

## State and approval checklist

- [ ] Owner confirmed Option 1 wording.
- [x] Owner classified `tenant_delete_<table>` wording as requiring later correction.
- [x] Owner decided to prohibit trigger disabling entirely.
- [x] Owner deferred each GST cleanup table treatment pending technical evidence.
- [x] Owner directed source review before selecting soft-delete permission names or roles.
- [x] Owner confirmed minimum catalog evidence requirements.
- [ ] Security/architecture technical sign-off recorded.
- [ ] Database technical sign-off recorded.
- [ ] Application/financial-integrity technical sign-off recorded.
- [ ] Fixture-cleanup mechanism separately selected and approved.
- [ ] Any implementation or connected execution authorization separately
      granted.

Until these items are explicitly resolved, Decision C remains owner-selected
but not technically approved and all execution gates remain closed.
