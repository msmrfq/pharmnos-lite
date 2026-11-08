---
title: Pharmnos Lite Consolidated Stage 3 Final Closure Report
date: 2026-11-08
status: NO-GO — mandatory current-release evidence remains incomplete
---

# Executive decision

**Stage 3: NO-GO.**

The frozen 100-point denominator and all criterion weights remain unchanged.
Only ST3-F has sufficient bounded acceptance evidence, so the verified accepted
score is **10/100 (10%)**. Partial implementation or automated tests are not
counted as accepted points.

The source is on branch `main`, base HEAD
`c0150084302fbba47230386f378d4cadf65f47ea`, with a dirty worktree preserved.
The current working-tree hash for `src/app/_actions/purchases.actions.ts` is
`e6e795de0b919ffbd86d7d0678444a6ab4ce880f`.
Current verification is JavaScript regression **325/325**, focused auth/security
contracts **37/37**, typecheck pass, lint pass, production build pass, and
`git diff --check` pass.

# Frozen matrix

| Criterion | Weight | Requirement | Current evidence/state | Reviewer decision | Accepted points | Remaining gap |
|---|---:|---|---|---|---:|---|
| ST3-A | 8 | Coherent supported architecture with no critical boundary defect | Source contracts, target lifecycle, payments and action boundaries pass; trust/payment completeness remains open | PARTIAL | 0 | Runtime trust boundary and broader financial boundary remain unresolved |
| ST3-B | 12 | Secure auth, authorization, tenant isolation and document access | Direct Prisma/runtime authorization uses signed context and rejects raw-claim forgery; the separate PostgREST authenticated-gateway policy path uses verified JWT app_metadata and was not exercised in this campaign | REJECTED | 0 | Independent acceptance of all required access paths and broader security boundary |
| ST3-C | 12 | Safe schema, migrations, drift and Stage 4 prerequisites | Migration replay, named trigger contracts and exact cleanup pass; provider recovery is unavailable | PARTIAL | 0 | Provider recovery and operational readiness evidence |
| ST3-D | 10 | Correct supported GST and fail-closed tax boundaries | Current-source purchase target passed 17/17 action-path scenarios; inclusive GST remains explicitly blocked until governed Rule 35 extraction and rounding | PARTIAL | 0 | Independent acceptance of the broader GST boundary and unresolved statutory/recoverability policy |
| ST3-E | 12 | Correct/auditable purchase, receipt, inventory and valuation | Fresh target-bound purchase runtime passed 17/17 with paid/free stock readback, payable/ledger effects, rollback/retry/concurrency, and pending valuation | CONDITIONALLY ACCEPTED — disposable local target | 0 | Broader financial reconciliation and independent acceptance; no production/shared-database claim |
| ST3-F | 10 | Correct supported sales/customer/invoice/document workflows | Current-source Sales action-path evidence and regression proof pass | ACCEPTED — bounded | 10 | Browser evidence remains separate and is not required for this bounded point disposition |
| ST3-G | 12 | Reliable ledgers, payments, reconciliation, atomicity and retry | Overpayment rejection, idempotency, rollback and balance locking are tested; complete ledger/payment readbacks are incomplete | REJECTED | 0 | Full persisted reconciliation and independent financial acceptance |
| ST3-H | 8 | Sufficient automated/browser/runtime/operational verification | Fresh integrated disposable Auth + financial target proved real two-user login, protected routes, tenant isolation, purchase draft persistence/readback, logout rejection, and exact cleanup; independent review was conditional because only sanitized assertion evidence was retained | CONDITIONALLY ACCEPTED — campaign evidence | 0 | Retain independently verifiable browser/request/database artifacts and obtain unconditional acceptance |
| ST3-I | 6 | Credible backup/recovery/deployment/configuration readiness | Exact Supabase project and Free plan verified; backup inventory, retention, PITR settings/recovery points, restore authorization and Storage recovery remain unavailable | PARTIAL | 0 | Owner/provider recovery configuration, Storage recovery evidence and authorized provider restore drill |
| ST3-J | 10 | Independent technical/security/business acceptance | Independent security review found no vulnerabilities in the reviewed changes but issued conditional acceptance because raw browser/request/database traces were not retained | REJECTED | 0 | Unconditional independent acceptance after all evidence gaps close |
| **Total** | **100** |  |  |  | **10** |  |

# Seven-workstream results

## 1. Goods receipt, purchase integrity and inventory

The owner-approved policy is implemented in `finalizePurchaseAction`:

- paid and free quantities remain separate;
- `paid + free` is posted to batch received/available quantities and stock
  movements;
- payable and purchase value remain based on paid quantity;
- paid, free and physical quantities are retained in the immutable snapshot;
- valuation remains explicit and `PENDING`/null when eligibility is unresolved.

Focused contract and valuation tests pass. Fresh contract-bound runtime
`purchasegstmw6tputn8d8b42` passed **17/17** scenarios. Persisted readback
verified paid/free quantities, total physical stock quantity `6`, batch
received/available quantity `6`, supplier ledger credit/balance `217.00`, and
the supplier payable balance `217.00` for the authorized purchase. The
explicit-discrepancy purchase independently read back batch quantity `6` and
supplier payable balance `1086.34`; rollback also verified payable stability.
Pending valuation/null acquisition cost, duplicate prevention, rollback and
retry were preserved. The inclusive Rule 35 path was rejected before
persistence as required by the current fail-closed implementation.

## 2. Payments and reconciliation

Current action paths reject customer/supplier overpayments before persistence,
serialize balances, enforce tenant-scoped idempotency keys and reject payload
conflicts. Focused payment contracts pass. No unapplied-credit, allocation,
reversal, void or approval workflow was invented.

Complete multi-document persisted reconciliation and universal database-level
posting uniqueness remain unverified; ST3-G remains rejected.

## 3. Security and tenant isolation

The independent adversarial finding is resolved for the direct Prisma/runtime
path:

| # | Severity | File | Lines | Finding | Confidence |
|---|---|---|---|---|---|
| 1 | RESOLVED | `src/lib/db/tenant-context.ts` | 44-52 | Direct runtime authorization now uses the HMAC-signed `pharmnos.auth_context` helpers; raw JWT claim GUCs are not consumed by the direct financial policies | 10/10 |

Runtime role restrictions (`LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`) and
transaction-local claims prevent connection leakage. No RLS bypass or weakened
policy was introduced. The separate PostgREST policy artifact remains a
different gateway trust boundary using `auth.jwt()` app metadata; it was not
covered by the direct-runtime forged-claim probe or the integrated browser
campaign. The exact closure and reviewer record is
`integrated-authenticated-browser-e2e-closure-integrated_auth2_mw6v3qsc9ebde907.json`.

## 4. Authenticated browser E2E

The current source now has a fail-closed server middleware gate for protected
routes and the existing server-side sign-out action is wired into the dashboard
profile menu. A Playwright MCP boundary run against a fresh disposable
database target verified:

- unauthenticated `/dashboard` navigation redirects to `/auth/sign-in`;
- unauthenticated `/purchases/new` navigation redirects to `/auth/sign-in`;
- the public sign-in page renders;
- invalid email/password input produces inline validation without navigation.

The authenticated application campaign is **conditionally accepted as a
campaign result**, not accepted as a Stage 3 point. A fresh integrated
disposable target proved real browser login for two synthetic users, protected
purchase access, tenant-scoped supplier and product visibility, a purchase
draft submission, fresh persisted invoice/line readback, logout invalidation,
protected-route rejection after logout, and exact campaign cleanup.
Sanitized evidence is
`integrated-authenticated-browser-e2e-evidence-integrated_auth2_mw6v3qsc9ebde907.json`.
Independent review found no security vulnerabilities, but recommended only
conditional acceptance because the retained artifact contains sanitized
assertions rather than independently verifiable browser traces, SQL/RLS
outputs, or cleanup queries.
Auth infrastructure evidence is
`auth-infrastructure-evidence-authinfra_7035ecb2a7.json`.
Independent Auth infrastructure/security review found no vulnerabilities in
the reviewed campaign scope and accepted the infrastructure with the
application-target limitation recorded in that evidence.

## 5. Backup, restore and recovery

Local data-only restore and normal migration replay through `0021` are retained
as bounded evidence. They do not prove provider PITR, retention, offsite
protection, RPO/RTO, restore authorization or a provider-supported restore
drill. No provider/shared database was touched.

The configured hosting arrangement is Supabase hosted PostgreSQL plus
Supabase Storage. Read-only MCP metadata verified project
`lizyjqkckysgvffwcqvb` (Pharmnos Lite), organization Pharmnos, region
`ap-south-1`, PostgreSQL `17.6.1.171`, status **INACTIVE**, and organization
plan **Free**. The repository Supabase URL host matches this project. The
configured database host is a regional pooler hostname and was not opened, so
the active database connection cannot independently be proven to target this
project from the hostname alone.

The Supabase CLI is not installed. No project backup inventory, dashboard
export, PITR configuration snapshot, latest-backup timestamp, recovery-window
record, or provider restore authorization was exposed. Because the project is
inactive, the read-only `storage.buckets` query was unavailable. Daily-backup
status, retention, PITR enablement/window, recovery points, and current bucket
visibility therefore remain **UNVERIFIED**.

The current Supabase backup documentation records provider capability only:
daily backups for Pro/Team/Enterprise, PITR as an add-on for those plans, and
a documented worst-case two-minute PITR RPO when enabled. This is not
project-specific evidence:
`https://supabase.com/docs/guides/platform/backups`.

The local restore evidence used a pre-provisioned disposable schema and
deterministic comparison of 34 public tables. It did not use a provider backup
or PITR recovery point; restore duration and data-loss window were not
measured or retained. RPO/RTO therefore remain pending owner approval rather
than being inferred from provider documentation.

ST3-I acceptance also requires explicit Supabase Storage-object backup,
retention, restore, and application-integrity evidence, or an owner-approved
decision to scope Storage out of Stage 3. The independent recovery review
flagged that the existing backup SOP’s `--disable-triggers` portability claim
does not identify the restore privileges required; that operational limitation
remains open and was not changed in this campaign.

Current recovery evidence is recorded in
`33-recovery-readiness-disposition.md`, with supporting local evidence in
`22-recovery-and-operations-evidence.md` and the historical scoped comparison
`q15-1793461099812-restore-comparison.json`. The recovery SOP remains
`decisions/0003-backup-sop.md`. Sanitized provider metadata and the evidence
matrix are in `35-provider-recovery-evidence-2026-11-08.json`.

## 6. Fresh target-bound persisted verification

The fresh immutable target contract used loopback port `55521`, database
`pharmnos_financial_e2e_purchasegstmw6tputn8d8b42`, Compose project
`pharmnoslite-financial-e2e-purchasegstmw6tputn8d8b42`, restricted runtime role
`pharmnos_e2e_runtime`, and target fingerprint
`321e45750deb5b9f699ddc09c1694d1ba59c4c25b4e608395e89d39b2f064e96`.
Sanitized infrastructure, initialization, purchase-suite, purchase-result and
cleanup evidence are retained under the matching
`purchase-gst-runtime-purchasegstmw6tputn8d8b42-*` and
`purchase-gst-application-evidence-purchasegstmw6tputn8d8b42.json` artifacts.
Cleanup verified the exact target absent; unrelated containers and the
pre-existing environment file were not modified.

## 7. Independent acceptance

- Technical review: **CONDITIONALLY ACCEPTED** for the bounded disposable
  purchase runtime. The independent review found no defects in the corrected
  batch identity, supplier payable readback, rollback stability, or 17/17
  result; broader policy readiness remains separate.
- Financial review: **PENDING fresh independent review**; the bounded purchase
  runtime is current, while broader reconciliation remains open.
- Security review: **CONDITIONALLY ACCEPTED** for the reviewed direct
  Prisma/runtime path; no vulnerabilities were found in the reviewed changes.
  The separate PostgREST authenticated-gateway path was not exercised.
- Recovery review: **BLOCKED / NOT COMPLETED** because provider evidence and
  restore authorization are unavailable. The independent bounded review
  confirmed no provider-level overclaim and kept ST3-I partial/not accepted.
  The local disposable restore is not provider-level acceptance.
- Overall Stage 3 acceptance: **REJECTED / NO-GO**.

# Financial reconciliation status

| Area | Actual evidence | Status |
|---|---|---|
| Paid/free/total quantity | Fresh target-bound 17/17 run; persisted item, batch and stock readback | RUNTIME VERIFIED |
| Supplier liability | Fresh target-bound ledger credit/balance readback `217.00`; no payment allocation invented | RUNTIME VERIFIED, BOUNDED |
| GST components/recoverability | Fresh mixed-rate reconciliation and accepted component snapshots; valuation remains `PENDING`/null | RUNTIME VERIFIED, POLICY-BOUNDED |
| Acquisition cost | Fresh final items/movements remain pending with null acquisition cost; recoverable/nonrecoverable automation not claimed | RUNTIME VERIFIED AS FAIL-CLOSED PENDING |
| Batch/stock movements | Fresh total physical quantity `6` persisted to movements and batches | RUNTIME VERIFIED |
| Payments/balances | Overpayment, idempotency, locking and rollback contracts | BOUNDED, NOT FULL ACCEPTANCE |
| Purchase/sales/ledger reconciliation | Purchase bounded target evidence; broader cross-document reconciliation remains separate | PARTIAL |

# Safety confirmation

No production or shared database, Live Supabase project, deployment, release,
production migration, credential reset, container lifecycle operation, commit,
push, reset, checkout, clean or stash was performed. Existing staged, unstaged
and untracked worktree changes were preserved.

# Remaining blockers and exact next actions

1. **Current-source purchase runtime:** obtain independent acceptance of the
   fresh bounded purchase evidence and separately complete broader
   payment/ledger reconciliation.
2. **Security:** retain independently verifiable evidence for both the direct
   Prisma/runtime path and the separate PostgREST authenticated-gateway path;
   do not treat current GUCs as cryptographically authenticated.
3. **Browser:** retain raw or equivalently reproducible sanitized browser,
   request/response, database-readback and cleanup evidence for the completed
   integrated campaign; do not rerun solely to increase test counts.
4. **Recovery:** obtain owner/provider-supplied plan, backup, retention,
   PITR-window and restore-authorization evidence; then perform an authorized
   provider-supported restore to a new disposable target and independently
   verify integrity and application recovery.
5. **Independent acceptance:** rerun technical, financial, security and
   recovery reviews only after the above evidence is current.

**Next immediate action:** retain independently verifiable sanitized execution
artifacts for the completed integrated campaign, then obtain unconditional
independent acceptance without changing the frozen criteria.

**Final decision: NO-GO.**
