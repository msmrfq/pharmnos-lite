---
title: Pharmnos Lite Security Trust Boundary Disposition
date: 2026-11-07
status: Current-source runtime verified; production acceptance remains pending
---

# Independent disposition

The independent review initially found a medium-severity same-subject
cross-tenant read gap. That gap was corrected by binding subject-scoped
membership, role, and permission policies to the signed tenant, then
re-reviewed as closed. The server-only application-process threat boundary
remains explicit: a compromised application process can use the signing
secret, while the restricted SQL runtime cannot read it or invoke the private
verifier.

# Implemented remediation

The selected architecture is recorded in
`decisions/0010-signed-database-auth-context.md`. Direct application and
disposable-runtime connections now establish one short-lived signed
`pharmnos.auth_context` value. PostgreSQL verifies the HMAC, subject, tenant,
version, and expiry through bootstrap-owned `SECURITY DEFINER` wrappers backed
by a private key table. RLS policies no longer consume raw
`request.jwt.claim.*` values. The restricted runtime role cannot read the key,
execute the verifier directly, or alter the protected schema and functions.
The initial bearer-token replay limitation was corrected: contexts now carry a
random nonce and the private replay table binds first use to the PostgreSQL
transaction, rejecting committed reuse in another transaction.

Offline evidence passes:

- signed-context malformed-input and secret-handling tests;
- nonce uniqueness and replay-binding contract coverage;
- target-contract rejection for mismatched identity and context-secret source;
- provisioning static guard with forced RLS, restricted grants, private-key
  isolation, and verifier search-path checks;
- TypeScript typecheck and changed-file lint.
- prior exact-target restricted-role runtime probe: 13/13 checks passed;
- same-subject multi-tenant membership and role isolation: passed;
- independent security review of the tenant-binding fix: closed with no
  remaining high-confidence findings.

# Boundary evidence

- Database access is intended to be server-only; runtime credentials are not
  recorded in evidence and are not exposed to browsers.
- Server-side identity verification and active-membership checks are present.
- Runtime role evidence is `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; runtime DELETE
  privilege is absent.
- Cross-tenant and inactive-membership application-path denial passed.
- Transaction-local subject and tenant claims were isolated in exercised
  runtime checks.
- RLS consumes only the verified `financial_context_subject()` and
  `financial_context_tenant_id()` wrappers in the disposable path.

# Final gap-closure campaign

The original `.env.financial-e2e` was ignored and unversioned. Its exact
pre-campaign contents were not recovered from Git, known session artifacts, or
the inspected editor-history locations. The file was not overwritten or
redacted during this closure; campaign-only values therefore remain present
until an authorized preservation-and-retirement procedure is approved. No
active campaign process or container was found to depend on those values.

Fresh canonical provisioning was exercised through the contract-bound Compose
and provisioning lifecycle on run `sec20261107d`, loopback port `55437`, with
new in-memory credentials. Provisioning passed with 34 RLS tables, 87
policies, 19 triggers, 129 constraints, zero runtime DELETE privileges, and
an empty verified runtime target. The exact target was disposed through the
authorized lifecycle and verified absent.

The fresh restricted-role follow-up probe proved missing-context fail-closed
behavior, pool-context clearing, signing-key isolation, private-verifier
isolation, and role-escalation denial. Its owner/employee fixture assertions
were invalidated by a probe-fixture construction defect, and rollback/retry,
post-commit replay, and concurrent nonce replay were not accepted as current
evidence. No independent whole-boundary review of this fresh evidence was
completed.

# Residual risk

The earlier authorized current-source run used contract `sec20261107a`,
initialization `sec20261107a-init01`, loopback port `55437`, and the
restricted role. It passed exact-target identity, role attributes, signed
tenant access, legacy-GUC denial, wrong-subject/tenant denial, tampered and
expired context denial, cross-transaction replay rejection, key/verifier
isolation, RLS tamper denial, and immutable-delete denial.

Evidence: `financial-e2e-security-runtime-evidence-sec20261107a.json`,
`financial-e2e-cleanup-evidence-sec20261107a.json`, and
`financial-e2e-target-contract-sec20261107a.json`.

Fresh gap-closure evidence is recorded in
`financial-e2e-security-runtime-evidence-sec20261107d.json`,
`financial-e2e-infrastructure-evidence-sec20261107d.json`,
`financial-e2e-initialization-evidence-sec20261107d.json`, and
`financial-e2e-cleanup-evidence-sec20261107d.json`.

The corrected follow-up run `sec20261108g` provisioned and disposed a fresh
contract-bound target on loopback port `55437`. It proved that a signed admin
can create an authorization role, an ordinary signed employee cannot create a
role, and a committed signed-context replay returns no authenticated subject.
The fixture supplied the required user columns, and the assertions checked
returned identity values rather than row counts. Sanitized evidence is
`financial-e2e-security-runtime-evidence-sec20261108g.json`; infrastructure
and cleanup evidence are the matching `sec20261108g` lifecycle artifacts.

An independent read-only boundary review found no critical or high security
vulnerability in the admin-only authorization-table write correction. It did
identify stale raw-JWT examples in the review-only SQL specifications; those
examples were replaced with the signed verifier wrappers
`financial_context_subject()` and `financial_context_tenant_id()`. The
independent recommendation accepts the targeted correction but does not
upgrade this document to unconditional Stage 3 acceptance.

# Decision

No RLS weakening, bypass grant, or credential exposure was introduced. The
previous raw-GUC architecture is retired for the disposable/direct-SQL path.
At that earlier checkpoint, the security campaign's current-source runtime
gate was **VERIFIED**, while final closure remained pending because the
environment-file integrity review and complete adversarial rerun were not yet
complete. That interim state is superseded by the bounded verification below;
unconditional Stage 3 and production authorization remain out of scope. The
exact fresh campaign target was cleaned up and unrelated containers were
preserved.

## Finalization boundary — 2026-11-08

The requested unconditional security disposition cannot be truthfully
finalized in this session. A fresh complete campaign was started on
`sec20261108h`; its contract-bound target was provisioned, the adversarial
harness reached concurrent replay, and the harness deadlocked because both
transactions held the replay-row lock while waiting for the other transaction
to resolve. The process was stopped without touching unrelated resources, and
the exact target was subsequently disposed and verified absent in
`financial-e2e-cleanup-evidence-sec20261108h.json`.

The current `.env.financial-e2e` remains preserved exactly. Its original
contents are not recoverable, and its ownership cannot be proven to be
campaign-only from the available metadata. Deleting or rewriting it would
therefore be an irreversible, unsafe credential action. Campaign-generated
credentials used by the disposable `sec20261108g` and `sec20261108h` targets
are no longer usable because both targets were disposed; the preserved
environment file is not classified as safe to retire.

That interim disposition is superseded by the bounded verification below.

## Final bounded verification — 2026-11-08

The source correction now supports subject-only contexts only when the subject
has exactly one active membership; ambiguous subjects still fail closed. Fresh
contract-bound runtime `sec20261108m` passed 30/30 sanitized scenarios on
loopback port `55443`, including bounded concurrent replay with statement and
lock timeouts, rollback retry, committed replay rejection, tenant isolation,
all three authorization tables, employee escalation attempts, private-key and
verifier isolation, protected-object tampering, and pool-context reset.
Infrastructure, initialization, runtime, target-contract, and cleanup evidence
are recorded under the matching `sec20261108m` artifacts. Cleanup verified the
exact disposable target absent.

The independent review found no exploitable critical or high vulnerability.
Its subject-only integration gap is resolved by the verifier correction and
the fresh runtime evidence. The environment-file incident is contained:
the existing `.env.financial-e2e` was not read for values, overwritten,
rotated, deleted, or replaced; its metadata and references were inventoried.
Campaign credentials for disposable targets were generated in memory only and
their targets were disposed. The original file remains preserved because its
ownership and historical contents cannot be proven safely.

Security disposition for the trusted, disposable local E2E boundary is
**CONDITIONALLY ACCEPTED**. This does not authorize production use, shared
database use, or Stage 4/5 work. Stage 3 remains **NO-GO** until the separate
runtime purchase, browser, recovery, and financial-reconciliation criteria are
accepted.
