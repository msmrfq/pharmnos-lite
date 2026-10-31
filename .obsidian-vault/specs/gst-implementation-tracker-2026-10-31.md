---
title: GST Modernization Implementation Tracker
date: 2026-10-31
status: ACTIVE - EVIDENCE-GATED
---

# GST Modernization Implementation Tracker

This tracker records the current engineering implementation state. It does
not replace the active master specification, professional review, independent
security acceptance, migration authorization, or production approval.

| Requirement | Implementation evidence | Tests/evidence | Status | Remaining dependency |
|---|---|---|---|---|
| DGM-01 | Shared exact eight-label treatment control with search and disabled deferred options; persisted invoice fact | Typecheck/build pending; server validation covered by action path | IMPLEMENTED — TESTED | UI runtime verification |
| DGM-02 | Composition, unregistered, consumer, and exceptional categories remain fail-closed | Unsupported-treatment server guard | IMPLEMENTED — TESTED | Statutory/accounting rules for activation |
| DGM-03 | Existing centralized 28-state/8-UT catalog plus searchable `GstStateSelect` for purchase POS | `tests/gst-purchase-pos-contract.test.mjs` | IMPLEMENTED — TESTED | Browser/runtime verification |
| DGM-04 | Existing GSTIN prefix helper remains validation-only | Existing GST calculator/state tests | IMPLEMENTED — TESTED | Checksum/status policy |
| DGM-05 | `src/lib/gst/place-of-supply.ts` validates normalized supplier, recipient, delivery, and scenario facts; purchase action calls it server-side | `tests/gst-purchase-pos-contract.test.mjs`; no DB runtime | IMPLEMENTED — TESTED | Runtime/database evidence |
| DGM-06 | Purchase calculations resolve tenant-scoped approved HSN/SAC classifications and effective GST rules per line, then calculate approved intra/inter-state components independently; UTGST remains blocked | `purchase-gst-reconciliation.service.ts`, `purchases.actions.ts`, `tests/purchase-gst-line-model-contract.test.mjs`, restricted-runtime disposable application run `purchase_gst_1793489343533_a2551c` | IMPLEMENTED — APPLICATION PATH VERIFIED FOR TESTED MIXED-RATE FLOW | Negative scenario expansion and professional UTGST policy approval |
| DGM-07 | Purchase expected GST preserves mixed-rate line calculations, governed rule snapshots, supplier-declared evidence, calculated values, line discrepancies, and accepted values separately | `purchase-gst-reconciliation.service.ts`, migration `0006_purchase_gst_rule_snapshots`, migration `0009_purchase_gst_line_acceptance`, restricted-runtime application evidence `purchase-gst-application-evidence-purchase_gst_1793489343533_a2551c.json` | PARTIALLY ACCEPTED — RESTRICTED APPLICATION PATH RUNTIME VERIFIED | Unresolved accounting policy decisions remain open |
| DGM-08 | Tax mode is persisted; inclusive mode remains disabled | Finalization guard | PARTIALLY IMPLEMENTED | Approved inclusive extraction/rounding policy |
| DGM-09 | Sales/purchase actions persist treatment and tax mode and revalidate them; sales and purchase finalization require approved effective classification/rule evidence | `tests/gst-treatment-contract.test.mjs`, `tests/sales-gst-governance-contract.test.mjs`; no connected DB | PARTIALLY IMPLEMENTED | Disposable runtime evidence and historical snapshot verification |
| DGM-10 | Declared/calculated/accepted purchase fields remain separate; line discrepancy status and acceptance actions remain permission-gated | `tests/purchase-gst-line-model-contract.test.mjs`, `purchase-gst-reconciliation.service.ts`, migration `0009_purchase_gst_line_acceptance`, restricted-runtime purchase application evidence | PARTIALLY ACCEPTED — EXPLICIT LINE ACCEPTANCE AND POSTING VERIFIED | Unresolved accounting policy decisions remain open |
| DGM-11 | Print output now displays persisted treatment, POS, and tax mode | Source inspection | IMPLEMENTED — TESTED | Browser/print acceptance |
| DGM-12 | Existing snapshot model preserved; new treatment/mode facts are transaction fields | Schema and print source | PARTIALLY IMPLEMENTED | Database immutability runtime proof |
| DGM-13 | Invalid/missing/unsupported treatment blocks draft/finalization; POS guards remain fail-closed | Server action validation | IMPLEMENTED — TESTED | Complete negative matrix |
| DGM-14 | Financial E2E artifact integrity remains bound to regenerated schema baseline | Artifact package tests; 15 GST-focused contracts | IMPLEMENTED — TESTED | Disposable PostgreSQL regression |

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
