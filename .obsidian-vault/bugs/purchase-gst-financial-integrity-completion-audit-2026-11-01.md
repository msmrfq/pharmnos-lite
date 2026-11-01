# Purchase GST Financial Integrity Completion Audit — 2026-11-01

## Verdict

**PARTIAL / BLOCKED BY POLICY DETAIL.** The accepted-value posting path remains
runtime-verified, and unresolved inventory valuation is now explicit rather
than silently represented by procurement rate. Full acceptance is not
justified because the approved policy does not define the governed ITC
eligibility/apportionment data model, freight allocation basis, post-supply
discount workflow, or exact statutory rounding precedence.

This report is an engineering completion audit, not a separate professional
GST review or independent acceptance. The prior restricted-role runtime
campaign remains the independent evidence source for transactional behavior.

## Baseline classification

### Implemented and verified

- Accepted supplier/calculated/explicit GST snapshots drive invoice,
  canonical line, supplier ledger, audit, and posting payload amounts.
- Fresh restricted-role runtime evidence
  `purchase-gst-application-evidence-purchase_gst_1793524087997_be4146.json`
  passed 16/16 with zero failures.
- Runtime role was `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; tenant denial,
  inactive membership denial, replay, conflict, concurrency, rollback, retry,
  and cleanup were verified.
- Non-zero cess and inclusive purchase creation are fail-closed.
- Supplier-declared and calculated evidence remain separate from accepted
  values.
- Inventory valuation now has separate nullable recoverable ITC,
  non-recoverable GST, acquisition-cost, status, and policy-version fields.

### Implemented but not runtime-verified after the additive valuation change

- Finalized purchase lines and inbound stock movements record valuation status
  `PENDING`, null approved inventory cost, and null recoverability amounts when
  no governed eligibility decision exists.
- Stock valuation UI and CSV use only `APPROVED` inventory acquisition cost;
  pending rows display `Pending` rather than valuing from `purchase_rate`.
- Additive schema migration `0010_inventory_valuation_pending_state` and
  disposable provisioning SQL include the new fields.

### Not implemented

- Governed ITC eligibility decision capture and actor authorization.
- Partial recovery/apportionment and provisional-to-final reversal lifecycle.
- Separate ITC asset/tax journal posting model.
- Governed cess catalog/rule/effective-period/credit-utilization model.
- Rule 35 inclusive extraction with mixed-rate residual reconciliation.
- Freight taxable-value and inventory-cost allocation workflow.
- Linked post-supply credit/debit note workflow.
- Versioned statutory rounding precedence and precision evidence model.

### Blocked by missing policy detail

- ITC eligibility conditions, apportionment inputs, and reversal authority.
- Freight allocation basis and pure-agent qualification evidence.
- Invoice-wide discount allocation authorization and formula.
- Exact statutory rounding level, precedence, precision, and residual policy.
- Numerical arithmetic discrepancy review threshold.

### Blocked by security/infrastructure

- HIGH forged-GUC trust-boundary finding remains open.
- Production/Live Supabase rollout and migration remain NO-GO.
- Direct Prisma validation requires `DIRECT_URL`; validation passed only with
  an authorized disposable `TEST_DATABASE_URL` fallback.
- Standalone TypeScript tests remain unavailable because `tsx` is not
  installed.

## Persisted financial evidence

The latest successful restricted-role evidence recorded:

| Output | Amount |
|---|---:|
| Accepted line total | 218.3400 |
| Canonical line total | 218.34 |
| Canonical GST amount | 27.26 |
| Invoice net amount | 218.34 |
| Supplier ledger credit | 218.34 |
| Audit net amount | 218.34 |

Posting payload hash equality passed. No purchase-specific tax journal model
exists, so no tax-journal amount is claimed.

Inventory valuation is intentionally **PENDING** for new finalized purchase
stock effects until a governed eligibility decision exists. Procurement
`purchase_rate` remains operational batch data, not approved inventory cost.

## Tests and commands

- Focused GST/policy/valuation contracts: **9 passed, 0 failed**.
- TypeScript typecheck: **passed**.
- Changed-file ESLint: **passed**.
- `git diff --check`: **passed**.
- Prisma generate: **passed**.
- Prisma validate: initially blocked by missing `DIRECT_URL`; passed with the
  authorized disposable `TEST_DATABASE_URL` assigned to both Prisma URLs.
- Fresh restricted-role runtime campaign
  `purchase_gst_1793526172673_fd9781` passed **16/16**, zero failures.
  It verified accepted persisted amounts, pending valuation lines/batches/
  movements, replay, conflict, concurrency, rollback, retry, tenant
  isolation, transaction-local claim isolation, and cleanup.
- Fresh evidence:
  `.obsidian-vault/specs/purchase-gst-application-evidence-purchase_gst_1793526172673_fd9781.json`
  SHA-256
  `79986E1265BE6251FCCBF715EC0D6FE2A6448D21DAE7B682D7541F30C9AC4C39`.
- Inventory valuation root-cause and architecture analysis is recorded in
  `.obsidian-vault/bugs/purchase-gst-inventory-valuation-root-cause-2026-11-01.md`.
  The dashboard repository no longer uses procurement rate as stock value, and
  a shared fail-closed valuation resolver plus explicit adjustment delta
  calculator now covers the safe policy-defined boundary.

## Files and safeguards

Changed implementation includes the Prisma schema/migration/provisioning SQL,
purchase finalization, stock valuation report/export, and focused valuation
contracts. Six owner-approved decision records, the implementation tracker,
canonical briefing, and generated mirrors were updated previously.

No reset, clean, stash, stage, unstage, checkout, commit, push, production
operation, Live Supabase operation, or process/container restart was performed.

## Status

Purchase GST financial integrity remains **PARTIALLY ACCEPTED**. Accepted
financial posting integrity is runtime-verified; inventory valuation is safely
blocked pending governed eligibility data; remaining policy-detail gaps prevent
full acceptance. GST Stage 1 remains **IN PROGRESS** and Production/Live
Supabase remains **NO-GO**.
