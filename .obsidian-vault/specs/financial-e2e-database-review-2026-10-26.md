# Financial E2E Database Review

**Assigned reviewer:** Masum Rafique  
**Review status:** **Review incomplete because live catalog evidence is missing; source review identifies changes required**  
**Decision under review:** Decision C, Option 1 — omit mutable-table runtime DELETE policies  
**Approval status:** Pending; this report is not a sign-off  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed

## Scope and evidence reviewed

- Owner direction and current status: [`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:17)
- Reviewer questions and cleanup alternatives: [`financial-e2e-design-c-reviewer-handoff-2026-10-26.md`](financial-e2e-design-c-reviewer-handoff-2026-10-26.md:76)
- Review-only privilege contract: [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35)
- Review-only RLS contract: [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15)
- Fixture ownership and cleanup lifecycle: [`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249)
- Schema relations and referential actions: [`schema.prisma`](../../prisma/schema.prisma:215)

## Source assessment

### DB-01 — Option 1 must be represented as both privilege absence and policy absence

The security artifact grants runtime `SELECT, INSERT, UPDATE` on ordinary
tables and explicitly revokes runtime `DELETE` on `tenants` and `audit_logs`;
GST-history tables receive `SELECT, INSERT` and explicit `UPDATE, DELETE`
revokes ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-81)).
The RLS contract defines SELECT/INSERT/UPDATE policies and still names a
mutable-table DELETE-policy pattern ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125)).

**Required change:** The final expectation contract must state that no ordinary
runtime principal has DELETE on mutable tables and that no mutable-table
runtime DELETE policy is created. The absence must be testable, not inferred
from an empty list.

### DB-02 — Ownership, inheritance, PUBLIC, and default ACLs are not proven

The source contract requests bootstrap ownership, runtime schema `USAGE`,
runtime schema `CREATE` revocation, and default-privilege revokes from
`PUBLIC` ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-50)).
No connected catalog result verifies object owners, role membership and
inheritance, superuser/BYPASSRLS, `PUBLIC` ACLs, default ACLs, or effective
privileges.

**Required change:** Obtain approved read-only catalog evidence on a named
disposable target before final approval. No target or access is currently
identified.

### DB-03 — Routine and sequence privilege evidence is missing

The source contract revokes default sequence and function privileges from
`PUBLIC` and discusses future controlled functions
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:42-50),
[`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:139-155)).
There is no live evidence for routine owners/EXECUTE ACLs, sequence owners/ACLs,
or whether any inherited or `PUBLIC` privilege permits an unintended path.

**Required change:** Include routine identity/owner/security attributes,
EXECUTE ACLs, sequence ownership/ACLs, and role-inheritance effects in the
catalog evidence set. Verify that no runtime role owns privileged routines.

### DB-04 — Referential actions make row cleanup dependency-sensitive

The Prisma schema includes `Cascade`, `Restrict`, and `SetNull` relations,
including memberships and purchase GST pointer/history relationships
([`schema.prisma`](../../prisma/schema.prisma:215-237),
[`schema.prisma`](../../prisma/schema.prisma:454-467),
[`schema.prisma`](../../prisma/schema.prisma:941-947)).

**Risk:** Row-level cleanup can fail, cascade beyond the intended fixture
ownership boundary, or require trigger disabling. Schema source is not proof of
the applied database constraint set.

**Required change:** For a specifically identified target, verify actual FK
constraint names, referenced columns, delete actions, deferrability, trigger
state, and ownership. Keep cleanup authorization separate from scenario
readiness.

## Required read-only catalog evidence on a named target

Before technical database approval, the reviewer should require evidence
bound to an explicitly authorized target, run, and attempt containing:

1. Database identity, server/database identity, schema identity, and connected
   role.
2. Role attributes: login, superuser, `BYPASSRLS`, `INHERIT`, replication,
   membership graph, and membership grant options.
3. Object owners and ACLs for tables, sequences, schemas, functions, and
   triggers where catalog-visible.
4. `PUBLIC` ACLs and default ACLs for tables, sequences, functions, and schema
   objects.
5. Effective runtime privileges for `SELECT`, `INSERT`, `UPDATE`, `DELETE`,
   and `TRUNCATE`, including privileges inherited through roles.
6. RLS enabled/forced state, policy command, target roles, `USING`, and
   `WITH CHECK` expressions.
7. Exact FK constraints, `ON DELETE` actions, deferrability, and applied
   trigger/function definitions relevant to immutable GST history.
8. Routine owner, security mode, search path, and EXECUTE ACL for any
   function involved in posting, cleanup, or integrity enforcement.
9. Sanitized provenance binding target, run, attempt, artifact version, and
   source hashes.

No such live evidence exists in the reviewed artifacts.

## Cleanup alternative assessment

| Alternative | Feasibility from source evidence | Risks and unknowns | Current disposition |
|---|---|---|---|
| Disposable database/schema destruction | Could avoid row-level DELETE and FK ordering if the target owner can destroy the isolated target. | Provider capability, ownership, privilege boundary, target identity, retention, storage objects, and independent destruction evidence are unknown. | Not selected; requires database/security review. |
| Separately authorized bootstrap-only cleanup | Existing lifecycle supports explicit authorization, identity evidence, owned resource snapshots, dependency ordering, and exact completion evidence ([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:249-328)). | Bootstrap DELETE and trigger disabling can bypass immutable controls; partial failure, rollback, audit, and trigger restoration require proof. | Not selected; requires security/database approval. |
| Retain fixtures until target discard | Compatible with the lifecycle's separation of cleanup from scenario readiness ([`financial-e2e-fixture-lifecycle.mjs`](../../scripts/financial-e2e-fixture-lifecycle.mjs:328-340)). | Target lifetime, stale-fixture isolation, data retention, cost, storage objects, and discard authorization are unknown. | Not selected; requires owner/database decision. |

## Database conclusion

The source review does not prove a runtime DELETE requirement and is
compatible with evaluating Option 1. The database review is **incomplete**
because no connected catalog evidence exists. DB-01 through DB-04 must be
resolved before technical approval. No SQL or database operation was executed.

**Sign-off:** `PENDING — not recorded`  
**Conditions:** Define the final Option 1 expectation and obtain the required
target-bound catalog evidence through a separately authorized process.  
**Review date/signature:** Not recorded.

