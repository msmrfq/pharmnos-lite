# Pharmnos Lite — Production Readiness Remediation Acceptance

**Date:** 2026-11-14
**Scope:** Version 1 scope establishment, genuine V1 defect repair, financial
blocker reclassification, credential hygiene, RLS provisioning documentation,
and schema-drift correction.
**Baseline commit:** `659aa53` (unchanged — no commits, pushes, merges, rebases,
resets, cleans, or stashes)
**Predecessors:** `independent-remediation-review-2026-11-13.md` (§F weights,
§G status format) and `postgres-runtime-verification-acceptance-2026-11-14.md`.

> **Status update (2026-11-14, later campaign):** S-27 and S-30 are now
> owner-accepted in decision records 0012/0013, and S-28 has been executed
> against a fresh disposable PostgreSQL target. See
> `owner-decision-closure-financial-acceptance-2026-11-14.md` for the current
> decision status, runtime evidence, and verdict. The snapshot below is retained
> as the historical state before those decisions; the production blockers it
> records are unchanged unless that document says otherwise.

---

## 1. Executive summary

The campaign separated the true Version 1 surface from Version 2 and owner
decisions, repaired one genuine V1 stock-integrity defect, and corrected
provable schema drift. It did **not** achieve production readiness.

| Dimension | Result |
|---|---|
| V1 scope established from authoritative records | Yes |
| Eight GST Treatment options classified individually | Yes |
| 24 blocked financial scenarios classified individually | Yes |
| Genuine V1 defects found | 2 (opening-stock ledger gap; tenant read-path context gap) |
| Defects repaired | 1 (opening stock) |
| Defects left open as release blockers | 2 (read-path context; credential rotation) |
| Static/offline gates | 650/650 tests, typecheck 0, lint 0, Prisma validate 0 |
| PostgreSQL runtime for the new changes | **Not run — Docker daemon unavailable** |
| Historical PostgreSQL runtime evidence | 69/69 cases; 30 pass / 0 fail / 24 blocked financial scenarios |
| Independent acceptance | **Not achieved — self-verification only** |
| Verdict | **NO-GO** |

Two clarifications prevent both under- and over-statement:

1. Allocation, refunds, advances, reversals, supplier multi-allocation,
   credit/debit notes, and returns are **not V1 requirements**. The PRD defers
   returns to Phase 2, and the owner decision pack limits V1 payments to
   account-level partial payments with fail-closed overpayment rejection.
2. The prior runtime campaign's 69/69 and 30/0/24 results remain valid for the
   source state it exercised. They do not prove the new opening-stock,
   schema-annotation, manifest, or test changes. Runtime claims for those
   changes are explicitly withheld.

---

## 2. V1 scope decision

Authoritative sources:

- `prd-technical-architecture.md` §4.2 (non-goals), §6.1 (MVP), §6.2 (Phase 2),
  §8.7 and §22.1 (stock source of truth), §8.9 (returns deferred), §23
  (billing/ledger).
- `specs/t13-t19-t25-current-release-scope-baseline-2026-11-04T21-32-19.md`
  §Explicit Version 2 deferrals.
- `specs/stage-3-system-readiness/31-current-release-owner-decision-pack.md` §C.

Excluded from V1 and from all denominators:

- imports/exports, SEZ, deemed exports, UIN;
- Reverse Charge Mechanism;
- e-invoicing and e-way bills;
- GST return filing and ITC reconciliation;
- credit/debit notes and exceptional workflows;
- sales and purchase returns (Phase 2);
- multiple GST registrations;
- payment allocation, refunds, advances/unapplied credit, reversals, and
  supplier multi-allocation (not claimed by the owner decision pack).

Detailed classification: `specs/v1-scope-and-financial-blocker-reclassification-2026-11-14.md`.

---

## 3. GST Treatment classification

The selector exposes eight labels, but only one is enabled. UI presence is not
workflow evidence.

| Option | Classification | Status |
|---|---|---|
| Registered Business – Regular | `V1_REQUIRED` | Enabled; legal confirmation remains external |
| Registered Business – Composition | `OWNER_CLARIFICATION` | Disabled, fail-closed |
| Unregistered Business | `OWNER_CLARIFICATION` | Disabled, fail-closed |
| Consumer | `OWNER_CLARIFICATION` | Disabled, fail-closed |
| Overseas | `V2_DEFERRED` | Excluded |
| Special Economic Zone | `V2_DEFERRED` | Excluded |
| Deemed Export | `V2_DEFERRED` | Excluded |
| UIN Holders | `V2_DEFERRED` | Excluded |

No option is classified `SHARED_FOUNDATION`. A disabled label is not a shared
foundation.

---

## 4. Financial blocker reclassification

All 24 previously blocked scenarios were classified once:

| Classification | Count | IDs |
|---|---:|---|
| `V1_REQUIRED` | 3 | S-19, S-21, S-28 |
| `OWNER_CLARIFICATION` | 2 | S-27, S-30 |
| `V2_DEFERRED` | 19 | S-01, S-04, S-07, S-08, S-09, S-10, S-16, S-18, S-20, S-22, S-23, S-24, S-25, S-26, S-31, S-32, S-33, S-37, S-38 |

- **S-19 / S-21:** finalized invoice immutability is implemented and was
  runtime-verified by the disposable PostgreSQL campaign. The broader linked
  adjustment/reversal workflow is V2.
- **S-28:** receipt-number allocation is implemented and statically tested, but
  concurrent runtime serialization is unverified. This is a V1 evidence gap.
- **S-27 / S-30:** owner decisions remain open. Decision records 0012 and 0013
  present options; no code change was made.
- The remaining 19 are V2 or outside V1. Their blocked runtime status is not a
  V1 failure and is not counted as a pass.

No blocked scenario was re-labelled as passed.

---

## 5. Defects found and repairs

### 5.1 Repaired — opening stock bypassed the movement ledger

**File:** `src/app/_actions/masters.actions.ts`

Product creation wrote batch counters (`received_qty`, `available_qty`) without
a `stock_movements` row. PRD §8.7/§22.1 require available stock to be
calculable from movements, with counters materialized for performance. The
repair establishes tenant context inside the transaction, creates each batch
individually, and writes one `OPENING_STOCK` movement per positive opening
quantity in the same transaction.

**Verification:** `tests/stock-opening-reconciliation-contract.test.mjs`
(4 tests) plus the existing 11 focused tests pass. `scripts/stock-reconciliation.sql`
provides a read-only residual diagnostic
(`available_qty - SUM(quantity_delta)`).

**Runtime:** **not verified.** Docker is unavailable in this session. Static
proof only.

### 5.2 Open — read paths never establish tenant context

Server components and report loaders resolve a `TenantContext`, but the
repositories execute Prisma queries outside any transaction-scoped
`pharmnos.auth_context`. The production connection role is privileged, so RLS
does not bind. Prior runtime case `APP-03` proves that an uncontextualized
Prisma query under the restricted role returns zero rows.

Switching to the restricted role before fixing read paths would empty
dashboards, reports, print views, and exports. This needs request-scoped
transaction/data-layer redesign and a controlled role cutover. It is a V1
release blocker and was deliberately not patched narrowly.

### 5.3 Open — credential exposure and rotation

At `HEAD`, `.env.financial-e2e-verify` is tracked and contains 32-character
database passwords, a signing secret, loopback database URLs, and target
metadata. Nine script files contain earlier credential revisions in Git history.
The working tree is neutralized; history is not. No production credential was
found. Rotation is not executed because no live/shared target is authorized.
See `specs/credential-rotation-plan-2026-11-14.md`.

The prior security assessment's claim that Git history has zero remaining
secret matches is contradicted by this evidence and must be corrected.

### 5.4 Corrected — schema drift

`prisma/schema.prisma` now matches the deployed schema:

- three `inventory_valuation_decisions` amount fields annotated
  `@db.Decimal(20, 4)`;
- `purchase_invoice_items_accepted_decision_idx` declared;
- partial-index warning comments on both invoice models;
- generated provisioning SQL regenerated;
- artifact manifest re-hashed and package version advanced to `0.1.7`.

`payment_refunds` still lacks the database constraint for the Prisma
`@@unique([tenant_id, id])` declaration. `id` is the primary key, so queries
remain correct; this is cosmetic drift, not a repair claim.

---

## 6. Verification evidence

| Gate | Command | Result |
|---|---|---|
| Full offline suite | `node --test "tests/*.test.mjs"` | 650 pass / 0 fail |
| TypeScript | `pnpm exec tsc --noEmit` | exit 0 |
| Lint | `pnpm run lint` | no warnings or errors |
| Prisma schema | `pnpm exec prisma validate` | valid |
| Prisma client | `pnpm exec prisma generate` | generated v5.22.0 |
| Artifact manifest | `tests/financial-e2e-connected-initialization-adapter.test.mjs` | preparation and ordered execution pass |

Historical runtime evidence (source state exercised by the prior campaign):

- `specs/evidence/postgres-runtime-verification-2026-11-14.json` — 69/69 pass:
  `ENV-01..10`, `AC-01..15`, `APP-01..07`, `DP-01..11`, `INV-01..11`,
  `FIN-01..06`, `TMP-01..09`.
- `specs/evidence/financial-reconciliation-runtime-2026-11-14.json` — 30 pass,
  0 fail, 24 blocked.

Limits of that evidence:

- It does not cover the new opening-stock change.
- It does not cover the schema annotation/index changes or regenerated manifest.
- It does not establish concurrent receipt-number behavior (S-28).
- It does not cover production topology, hosted Supabase, or genuine Supabase
  Auth.
- It is self-verification, not independent acceptance.

---

## 7. Weighted V1 completion

Weights are campaign-defined and fixed before scoring; they are not
owner-approved product weights.

| # | Criterion | Weight | Score | Basis |
|---|---|---:|---:|---|
| 1 | Tenant isolation and read-path context | 12 | 7.2 | DB-level RLS runtime-proven; read paths not contextualized |
| 2 | Authentication, RBAC, membership | 7 | 5.95 | Runtime AC; genuine Supabase Auth not exercised |
| 3 | Product and batch master | 7 | 5.25 | Implementation/static; opening-stock change unverified |
| 4 | Customer and supplier masters | 7 | 5.6 | Implementation/static; full CRUD not re-run |
| 5 | Purchase entry and GST valuation | 10 | 8.5 | INV/FIN runtime; T19 target-bound evidence |
| 6 | Sales billing, GST, invoice numbering | 12 | 10.8 | 69-case runtime; T25 sales evidence |
| 7 | Payments and receipts (V1 account-level) | 8 | 5.6 | Account-level runtime; S-28 unverified |
| 8 | Inventory movement, FEFO, expiry, adjustments | 10 | 7.5 | INV runtime; opening-stock and reconciliation unverified |
| 9 | Dashboard, reports, exports | 7 | 2.8 | Static only; read-path context gap |
| 10 | Audit logging and financial immutability | 5 | 4.5 | DP/immutability runtime evidence |
| 11 | Schema/migration integrity | 5 | 4.0 | 31 migrations applied; new drift unverified at runtime |
| 12 | Production security operations | 10 | 2.0 | RLS deployment/signing secret manual; read-path gap; credentials unrotated |
| **Total** | | **100** | **69.7** | |

Independent acceptance remains **0/100**.

---

## 8. Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-1 | Blocker | RSC/report/dashboard/export read paths do not establish tenant DB context; privileged role means RLS does not bind in production | Open — architecture change required |
| F-2 | Blocker | Tracked credential-bearing environment file at `HEAD` and credential revisions in history; no rotation performed | Open — owner/operator action |
| F-3 | High | S-28 concurrent receipt-number serialization unverified at runtime | Open — evidence gap |
| F-4 | High | S-27 and S-30 owner decisions unresolved | Open — decision records 0012/0013 |
| F-5 | Medium | New opening-stock repair and schema drift have no runtime proof | Open — Docker unavailable |
| F-6 | Low | Prisma `payment_refunds` declares `@@unique([tenant_id, id])`; the deployed database does not create that composite constraint. `id` is the primary key, so behavior is correct | Accepted as cosmetic |
| F-7 | Low | README/security assessment history claim is inaccurate | Open — documentation correction |

---

## 9. What was not done

- No commits, pushes, merges, rebases, resets, cleans, or stashes.
- No production, shared, or hosted Supabase operations.
- No new dependencies.
- No historical migration edits.
- No new migration (schema changes are annotation/index declarations matching
  existing migrations; Docker was unavailable for a disposable proof of a new
  forward migration).
- No S-27 or S-30 code changes.
- No independent acceptance claimed.

---

## 10. Status

```text
[PHARMNOS-LITE STATUS]

Stage: Production Readiness Remediation — Version 1 Scope
Completion: 69.7/100 V1-weighted; 100/100 static-offline on executed gates;
          0/100 independently accepted
Verdict: NO-GO

Owner authorization:
- Full in-scope project access: AUTHORIZED (read-only + narrow in-scope repair)
- Code/schema/migration changes: AUTHORIZED (narrowest-layer defect repair only)
- Disposable local PostgreSQL verification: AUTHORIZED (not executable —
  Docker daemon unavailable)
- Production/shared hosted operations: NOT AUTHORIZED (none performed)
- Credential rotation/rewrite: NOT AUTHORIZED (plan only)
- Commits/pushes/merges: NOT AUTHORIZED (none performed)

V1 scope:
- Established from PRD §4.2/§6/§8/§22/§23, the current-release scope baseline,
  and the owner decision pack §C
- Excluded from V1 and from denominators: imports/exports, SEZ, deemed exports,
  UIN, RCM, e-invoicing/e-way bills, GST return filing, ITC reconciliation,
  credit/debit notes, returns, multiple GST registrations, allocation, refunds,
  advances, reversals, supplier multi-allocation
- GST treatments: 1 V1_REQUIRED, 3 OWNER_CLARIFICATION, 4 V2_DEFERRED,
  0 SHARED_FOUNDATION
- Blocked financial scenarios: 3 V1_REQUIRED (S-19, S-21, S-28),
  2 OWNER_CLARIFICATION (S-27, S-30), 19 V2_DEFERRED

Implemented:
- Opening-stock movement ledger repair in createProductAction
  (OPENING_STOCK per positive batch, same transaction, tenant context established)
- Read-only stock reconciliation diagnostic scripts/stock-reconciliation.sql
- Schema drift correction: Decimal(20,4) annotations, purchase decision index,
  partial-index warnings
- Regenerated financial-e2e provisioning SQL; artifact manifest 0.1.7
- Decision records 0012 (S-27) and 0013 (S-30); credential rotation plan;
  RLS runtime provisioning runbook; V1 reclassification report

Static-offline verified:
- node --test "tests/*.test.mjs": 650/650 pass
- pnpm exec tsc --noEmit: exit 0
- pnpm run lint: no warnings or errors
- prisma validate: valid
- prisma generate: succeeded
- New stock-opening/reconciliation contract: 4/4 pass, including read-only
  SQL assertion and same-transaction ordering
- Artifact manifest hash verification: pass

PostgreSQL runtime verified (historical, prior source state):
- scripts/postgres-runtime-verification.mjs: 69 passed / 0 failed
  ENV-01..10, AC-01..15, APP-01..07, DP-01..11, INV-01..11, FIN-01..06,
  TMP-01..09
- scripts/financial-reconciliation-runtime-harness.cjs: 30 pass / 0 fail /
  24 blocked
- APP-03 proves uncontextualized Prisma reads return zero rows under the
  restricted role
- NOT verified for this working tree: opening-stock repair, schema drift,
  regenerated manifest, S-28 concurrency

Independently accepted:
- NOT ACHIEVED. Self-verification only; no second party reviewed this evidence.

Remaining V1 blockers:
- Read paths (RSC, reports, dashboard, print, exports) do not establish
  per-request tenant context; production uses a privileged role, so RLS does
  not bind
- Tracked credential-bearing .env.financial-e2e-verify at HEAD and credential
  revisions in Git history; no rotation or index removal performed
- S-28 concurrent receipt-number runtime proof absent
- New opening-stock and schema-drift changes lack disposable PostgreSQL proof

Owner decisions pending:
- 0012 S-27 Cheque payment scope (Proposed)
- 0013 S-30 payment currency scope (Proposed)

Not release blockers (V2 or out of scope):
- Allocation, refunds, advances, reversals, supplier multi-allocation
- Credit/debit notes and returns
- Imports/exports, SEZ, deemed exports, UIN, RCM, e-invoicing, e-way bills,
  GST filing, ITC reconciliation, multiple GST registrations
- 19 of the 24 previously blocked financial scenarios

Preservation:
- HEAD 659aa53 unchanged; no commits/pushes/merges/reverts/cleans/stashes
- Pre-existing modified and untracked work preserved
- tsconfig.tsbuildinfo restored to HEAD after typecheck
```

---

## 11. GO/NO-GO

**NO-GO.**

The V1 product surface is substantially implemented and statically healthy, and
one genuine stock-integrity defect is repaired. Release is blocked by two
independent, material conditions:

1. The application cannot safely run under the restricted role that makes RLS
   effective, because its read paths never establish tenant context. Running
   under the privileged role leaves RLS non-binding.
2. Disposable verification credentials remain in tracked data and Git history,
   and no rotation has been performed.

Additionally, S-28 lacks runtime proof and S-27/S-30 are unresolved owner
decisions. Any one of the two blockers is sufficient for NO-GO.

GO requires, at minimum:

- read-path tenant-context design implemented, reviewed, and runtime-proven
  under the restricted role;
- credentials rotated, the tracked environment file removed from the index, and
  the history decision executed or formally accepted by the owner;
- S-28 concurrent receipt-number runtime evidence;
- disposable PostgreSQL runtime proof of the opening-stock repair and schema
  drift;
- resolution of decision records 0012 and 0013;
- a second party reviewing this evidence and recording independent acceptance.

None of these conditions is met by this campaign.

---

## 12. References

- `specs/v1-scope-and-financial-blocker-reclassification-2026-11-14.md`
- `decisions/0012-s27-cheque-payment-scope.md`
- `decisions/0013-s30-payment-currency-scope.md`
- `specs/credential-rotation-plan-2026-11-14.md`
- `specs/rls-runtime-provisioning-runbook-2026-11-14.md`
- `specs/postgres-runtime-verification-acceptance-2026-11-14.md`
- `specs/independent-remediation-review-2026-11-13.md`
- `specs/evidence/postgres-runtime-verification-2026-11-14.json`
- `specs/evidence/financial-reconciliation-runtime-2026-11-14.json`
- `bugs/authenticated-database-trust-boundary-security-review-2026-11-01.md`
- `decisions/0011-tenant-isolation-signed-context-rls.md`
