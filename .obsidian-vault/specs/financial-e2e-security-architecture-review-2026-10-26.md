# Financial E2E Security / Architecture Review

**Assigned reviewer:** Masum Rafique  
**Review status:** **Review completed with changes required; connected evidence remains missing**  
**Decision under review:** Decision C, Option 1 — omit mutable-table runtime DELETE policies  
**Approval status:** Pending; this report is not a sign-off  
**Live Supabase:** `NO-GO`  
**Connected initialization:** Disabled and fail-closed

## Scope and evidence reviewed

- Owner direction and execution restrictions: [`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:36)
- Manual reviewer handoff and assigned role requirements: [`financial-e2e-design-c-reviewer-handoff-2026-10-26.md`](financial-e2e-design-c-reviewer-handoff-2026-10-26.md:1)
- Privilege, default-ACL, role, immutable-history, and function-boundary specification: [`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5)
- RLS policy specification: [`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:1)
- Runtime authorization context: [`tenant-context.ts`](../../src/lib/db/tenant-context.ts:1)
- Active master-data deletion actions: [`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211)
- Local GST cleanup behavior: [`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114)

## Findings

### SEC-01 — Effective privilege and bypass evidence is unavailable

**Evidence:** The security artifact specifies `pharmnos_e2e` as bootstrap owner
and `pharmnos_e2e_runtime` as an ordinary non-superuser/non-BYPASSRLS role, with
runtime `DELETE` revoked for immutable GST history, `tenants`, and
`audit_logs` ([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:5-26),
[`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:60-81)).

**Risk:** Source SQL does not prove live ownership, role membership,
inheritance, `PUBLIC` privileges, default ACLs, superuser/BYPASSRLS status, or
privileges granted through another role. An owner, superuser, or inherited
privilege could bypass the intended no-runtime-DELETE posture and RLS.

**Recommended disposition:** Before technical approval, require read-only
catalog evidence on an explicitly identified disposable target for role
attributes, memberships, inheritance, object ownership, `PUBLIC` ACLs,
default ACLs, effective table/sequence/routine privileges, and RLS
configuration. Do not authorize connected access through this review.

### SEC-02 — DELETE-policy contract conflicts with the selected Option 1

**Evidence:** The RLS specification names
`tenant_delete_<table> (only mutable tables)` while the owner selected Option 1,
which says not to define a mutable-table runtime DELETE policy family
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:105-125);
[`financial-e2e-owner-decisions-2026-10-25.md`](financial-e2e-owner-decisions-2026-10-25.md:17)).

**Risk:** A future executable expansion could create DELETE policies despite the
owner-selected direction, or reviewers could interpret absent policy and denied
privilege inconsistently.

**Recommended disposition:** Database and security reviewers must explicitly
define Option 1 as both a privilege and policy expectation: ordinary runtime
principals have no DELETE capability, and no mutable-table runtime DELETE
policy family is generated. Keep immutable-history controls separate.

### SEC-03 — RLS does not replace database privilege restrictions

**Evidence:** The RLS artifact requires `ENABLE ROW LEVEL SECURITY` and
`FORCE ROW LEVEL SECURITY` with tenant predicates, while the security artifact
separately defines grants and revokes
([`financial-e2e-rls-policies.review.sql`](../../prisma/financial-e2e-rls-policies.review.sql:15-31);
[`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:35-81)).

**Risk:** RLS can constrain rows only after the principal has the relevant
table privilege; it does not itself establish least privilege, prevent an
owner/superuser bypass, or prove the absence of DELETE grants.

**Recommended disposition:** Keep privilege, ownership, role attributes,
default ACL, and RLS assertions distinct and require evidence for each.

### SEC-04 — Bootstrap GST cleanup disables user triggers during DELETE

**Evidence:** The local cleanup begins a transaction, disables user triggers
on six GST-history tables, issues DELETE statements, then re-enables the
triggers ([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:114-145)).
The script's `main` function is currently blocked from direct execution
([`financial-e2e-security-behavior.mjs`](../../scripts/financial-e2e-security-behavior.mjs:145)).

**Risk:** If reached with sufficient privilege, trigger disabling can bypass
immutable-history enforcement and related audit/integrity behavior. A failure
between disable and re-enable, or partial cleanup, also requires explicit
recovery evidence.

**Recommended disposition:** Security and database reviewers must decide
whether trigger disabling is prohibited, or define a narrowly authorized
bootstrap-only boundary with target identity, ownership, transaction/failure
handling, post-cleanup trigger-state verification, and sanitized audit
evidence. No mechanism is authorized by this report.

### SEC-05 — Active soft-delete actions lack visible operation-level permission checks

**Evidence:** Product, customer, and supplier actions establish an authenticated
tenant context, verify tenant ownership in the lookup, and update
`is_active = false`, but do not call `requirePermission` in the shown action
bodies ([`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:211-235),
[`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:390-414),
[`masters.actions.ts`](../../src/app/_actions/masters.actions.ts:565-589)).
The permission helper exists and rejects missing permissions
([`tenant-context.ts`](../../src/lib/db/tenant-context.ts:20-25)).

**Risk:** Authentication and tenant scoping do not demonstrate authorization
for a destructive business action. If no lower layer supplies the check, any
authenticated tenant member with access to the action could deactivate master
data.

**Recommended disposition:** Application/security review must identify the
required permission for each soft-delete action and verify enforcement at an
approved boundary. This is required even if physical runtime DELETE remains
unavailable.

### SEC-06 — Privileged function and administrative boundaries remain unverified

**Evidence:** The security artifact defines no caller-invocable privileged
function and requires any future `SECURITY DEFINER` path to have a separately
approved owner, safe search path, explicit checks, and `PUBLIC` execute revoked
([`financial-e2e-security-controls.review.sql`](../../prisma/financial-e2e-security-controls.review.sql:139-155)).

**Risk:** The review cannot establish how administrative/bootstrap cleanup is
isolated from ordinary application execution, or whether future routines,
ownership, and EXECUTE privileges could create a deletion bypass.

**Recommended disposition:** Preserve the two-role boundary unless separately
approved. Require routine ownership, definition, EXECUTE ACL, search path, and
role-inheritance evidence before any controlled path is considered.

## Security conclusion

The source review supports evaluating Option 1 and finds no evidence that
ordinary runtime DELETE is required. It does **not** justify final security
approval. SEC-01, SEC-04, SEC-05, and SEC-06 require reviewer resolution or
evidence. The assigned reviewer has not recorded an approval.

**Sign-off:** `PENDING — not recorded`  
**Conditions:** Resolve the findings above and record explicit approval or
requested changes in the authoritative decision record.  
**Review date/signature:** Not recorded.

