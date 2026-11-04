---
title: GST Calculation and Treatment Acceptance — 2026-11-01
date: 2026-11-01
status: NOT ACCEPTED
---

# GST Calculation and Treatment Acceptance — 2026-11-01

This is an engineering acceptance review against the authoritative domestic GST
contract. It is not statutory certification, professional GST advice, or
production approval.

## [PHARMNOS-LITE STATUS]

**Stage:** GST calculation and treatment acceptance  
**Completion:** 22 / 25 evidence-supported criteria (88%); 16 `VERIFIED PASS —
CURRENT CAMPAIGN`; 6 `VERIFIED PASS — HISTORICAL`; 3 current-scope criteria
(`DGM-T13`, `DGM-T19`, and `DGM-T25`) remain `NOT VERIFIED` for runtime and
independent acceptance; 0 `BLOCKED — OWNER APPROVAL`; 0 `VERIFIED FAIL`
**Done:** The current campaign verified inter-state purchase IGST acceptance,
the demonstrated POS cases, Sales retry/conflict/rollback behavior,
restricted-role tenant isolation, and incomplete legacy-draft holds. The
owner-directed T19 resolution now binds acceptance, discrepancy resolution,
and correction to the reviewed GST record version, evidence revision, and
calculation ID, with focused source-contract coverage. The 0419 evidence also
records a finalization stale-operation race and single-effect posting, but no
database/runtime T19 acceptance-revision result is claimed. The exact-decimal
implementation campaign passed 294/294 focused calculator assertions and
preserved fail-closed unsupported treatments. The latest owner instruction
approves the current T25 engineering scope and authorizes current-scope
runtime/database verification and independent acceptance for T13, T19, and
T25.
**Remaining:** DGM-T13, DGM-T19, and DGM-T25 remain `NOT VERIFIED` for
target-bound runtime and independent acceptance. Composition,
Unregistered, Consumer, UTGST, inclusive purchase workflow, and other
unsupported treatments remain fail-closed.  
**Blockers:** Exact target-bound authorization/contract evidence is required
before the disposable runtime campaign. Section 170 aggregation, e-invoice
obligations, and related statutory/accounting interpretations require qualified
professional confirmation.
**Next:** Obtain the exact authorized disposable target contract, run only the
approved current-scope T13/T19/T25 scenarios, retain the Version 2 deferrals,
and do not enable unsupported workflows.
**Decision:** **NOT ACCEPTED**

## 1. Authoritative contract

The controlling specification is
[`domestic-gst-modernization.md`](./domestic-gst-modernization.md). The
approved supporting policies are:

- [`0003-inventory-gst-valuation-policy.md`](../decisions/0003-inventory-gst-valuation-policy.md)
- [`0004-cess-governance-policy.md`](../decisions/0004-cess-governance-policy.md)
- [`0005-inclusive-purchase-pricing-policy.md`](../decisions/0005-inclusive-purchase-pricing-policy.md)
- [`0006-freight-discount-allocation-policy.md`](../decisions/0006-freight-discount-allocation-policy.md)
- [`0007-gst-rounding-precision-policy.md`](../decisions/0007-gst-rounding-precision-policy.md)
- [`0008-purchase-gst-discrepancy-tolerance-policy.md`](../decisions/0008-purchase-gst-discrepancy-tolerance-policy.md)

The contract defines four first-phase domestic categories, but it does not
enable four ordinary calculation paths:

| Category | Required facts | Purchase applicability | Sales applicability | Expected components | Contract status |
|---|---|---|---|---|---|
| Registered Business – Regular | Valid counterparty facts, seller/supplier, recipient, dispatch/delivery, transaction POS, approved HSN/SAC, effective approved rule, date, tax mode, quantity, price, and discount | Conditional after supplier evidence, governed calculation, reconciliation, and accounting acceptance | Conditional after server POS, HSN/SAC/rate resolution, recalculation, snapshots, and finalization guards | Same-state `CGST + SGST`; different-state `IGST` | Only potentially enabled; engineering evidence is partial |
| Registered Business – Composition | Composition direction, status, effective period, document, tax, and ITC/accounting rules | Supplier and recipient cases remain distinct and blocked | Recipient case remains blocked | No ordinary GST may be assumed | `BLOCKED` pending qualified approval |
| Unregistered Business | Explicit unregistered status, identity/POS evidence, document and accounting rules | Blocked pending purchase policy | Blocked pending recipient policy | No registration or ordinary GST may be inferred | `BLOCKED` pending approved rules |
| Consumer | Consumer context, identity/POS evidence, document and accounting rules | Not a normal supplier role; unsupported combinations reject | Blocked pending recipient policy | Consumer label cannot choose POS or components | `BLOCKED` pending approved rules |

The visible labels are not evidence that a category is operational. The source
guard in [`treatment.ts`](../../src/lib/gst/treatment.ts) enables only Regular.

## 2. Implementation trace

| Concern | Source evidence | Observed behavior |
|---|---|---|
| Treatment resolution | [`treatment.ts`](../../src/lib/gst/treatment.ts) | Exactly eight labels are retained; only Regular passes `validateGstTreatment`; unsupported labels fail closed. |
| State/UT normalization | [`indian-states.ts`](../../src/lib/constants/indian-states.ts) | The maintained 28-state/8-UT catalog normalizes names and codes. |
| POS determination | [`indian-states.ts`](../../src/lib/constants/indian-states.ts) | Same supported states resolve `INTRA`; different supported regions resolve `INTER`; missing/invalid inputs resolve `UNKNOWN`. Same-UT now resolves `UNKNOWN` with `UNSUPPORTED_UTGST`. |
| Purchase supply facts | [`place-of-supply.ts`](../../src/lib/gst/place-of-supply.ts) | Supplier, recipient, delivery, and scenario are required; delivery must equal recipient; same-UT is explicitly blocked. |
| HSN/SAC and effective rules | [`rule-governance.ts`](../../src/lib/gst/rule-governance.ts) | Classification and rate rules require active, approved, source-referenced, effective records; zero or multiple applicable rules fail closed. |
| Sales calculation | [`gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts) and [`sales.actions.ts`](../../src/app/_actions/sales.actions.ts) | Exclusive line calculation and server recalculation produce CGST/SGST or IGST; sales finalization re-resolves governed lines and persists snapshots. |
| Purchase calculation | [`purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts), [`purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts), and [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) | Purchase declared, calculated, and accepted values remain separate; finalization requires governed evidence, reconciliation, and acceptance. |
| Inclusive mode | [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts) | Inclusive purchase creation/finalization is blocked until governed Rule 35 extraction and rounding exist. |
| Historical evidence and runtime proof | [`sales.actions.ts`](../../src/app/_actions/sales.actions.ts), [`purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts), and [`gst-application-e2e-runner.mjs`](../../scripts/gst-application-e2e-runner.mjs) | Snapshot fields and accepted purchase values are persisted in the source path; current 0419 runtime proof covers the scoped Sales/Purchase scenarios listed below, not the complete GST modernization. |

## 2.1 Final scope decision reconciliation

Scope approval is recorded separately from implementation, focused test
evidence, runtime verification, and independent acceptance. The 25-criterion
completion count is unchanged; scope approval is not counted as a verified
runtime or independent acceptance pass.

| Criterion | Current-release scope decision | Implementation | Test evidence | Runtime / independent acceptance |
|---|---|---|---|---|
| DGM-T13 | `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED` | Exactly 15-character supplied GSTIN validation is implemented | Focused length-only tests passed; checksum, state-prefix, registration-status, and effective-date checks are not performed | Runtime and independent acceptance are not claimed |
| DGM-T19 | `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED` | Acceptance, discrepancy resolution, and correction require the reviewed record version, evidence revision, and calculation ID; correction uses an optimistic guarded parent update; existing authorization and finalization safeguards remain | Focused source-contract test passed; correction child writes roll back when the guarded parent revision is stale; no runtime campaign was run | Targeted stale acceptance-revision runtime proof and independent acceptance are not claimed |
| DGM-T25 | `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED` | Exact-decimal arithmetic, explicit representation boundaries, component preservation, commercial round-off separation, and supplier/issued-value preservation are implemented for the demonstrated current-release paths; e-invoice output and credit/debit-note workflows remain Version 2 | Focused calculator evidence passed 294/294 assertions; no T25 database/runtime campaign was run | Runtime and independent acceptance are not claimed; qualified professional confirmation remains required for statutory boundaries |

## 3. Requirement-to-code-to-test matrix

`VERIFIED PASS — CURRENT CAMPAIGN` means the exact engineering behavior named
in the row has current-campaign test or runtime evidence. `VERIFIED PASS —
HISTORICAL` means the exact behavior is supported by a prior retained artifact
and was not freshly executed here. `NOT VERIFIED` means the evidence is
insufficient. `BLOCKED — POLICY` and `BLOCKED — OWNER APPROVAL` mean
implementation or acceptance must stop until the named contract or decision
exists. `BLOCKED — PROFESSIONAL CONFIRMATION` is reserved for unresolved
qualified GST/accounting interpretation. None of these labels promotes a
blocked policy to an approved operational workflow.

| ID | Requirement / scenario | Code and evidence | Result | Limitation |
|---|---|---|---|---|
| DGM-T01 | One treatment control retains exactly eight labels | `src/lib/gst/treatment.ts`; `tests/gst-treatment-contract.test.mjs` | `VERIFIED PASS — CURRENT CAMPAIGN` | UI runtime was not exercised in this campaign |
| DGM-T02 | Sales Regular same-state exclusive calculation | `src/domain/services/gst-calculator.service.ts`; 294-assertion TypeScript calculator run | `VERIFIED PASS — CURRENT CAMPAIGN` | Pure calculator behavior only; policy and database finalization gates remain |
| DGM-T03 | Sales Regular inter-state exclusive calculation | `src/domain/services/gst-calculator.service.ts`; 294-assertion TypeScript calculator run | `VERIFIED PASS — CURRENT CAMPAIGN` | Pure calculator behavior only; complete POS/legal scenario evidence remains |
| DGM-T04 | Consumer cannot silently calculate as Regular | `src/lib/gst/treatment.ts`; treatment contract test | `VERIFIED PASS — CURRENT CAMPAIGN` | This verifies the block, not a Consumer calculation |
| DGM-T05 | Composition cannot silently calculate ordinary GST | `src/lib/gst/treatment.ts`; treatment contract test | `VERIFIED PASS — CURRENT CAMPAIGN` | Supplier and recipient statutory behavior remains unapproved |
| DGM-T06 | Purchase Regular same-state line/evidence path | Historical restricted-runtime purchase evidence `purchase_gst_1793531037977_0975f5`; purchase line-model contracts | `VERIFIED PASS — HISTORICAL` | Historical evidence is separate from this campaign and does not prove all current policy requirements |
| DGM-T07 | Purchase Regular inter-state acceptance | `scripts/gst-application-e2e-runner.mjs`; authorized 0419 restricted-runtime result | `VERIFIED PASS — CURRENT CAMPAIGN` | `GJ → MH` accepted IGST `18`; the seeded rate is test evidence, not statutory approval |
| DGM-T08 | Same-UT does not fall back to SGST | `indian-states.ts`, `place-of-supply.ts`, calculator/POS regression assertions | `VERIFIED PASS — CURRENT CAMPAIGN` | UTGST calculation remains intentionally unavailable |
| DGM-T09 | Mixed-rate line independence and aggregation | Historical purchase mixed-rate evidence; purchase line-model contract | `VERIFIED PASS — HISTORICAL` | Sales mixed-rate runtime evidence was not executed |
| DGM-T10 | Exclusive taxable-value and component calculation | `decimal.ts`, `gst-calculator.service.ts`; 294-assertion TypeScript calculator run | `VERIFIED PASS — CURRENT CAMPAIGN` | Engineering arithmetic is exact-decimal and explicitly rounded; owner/professional policy acceptance remains separate |
| DGM-T11 | Inclusive pricing cannot bypass the guard | `purchases.actions.ts`; `purchase-calculator.service.ts`; calculator tests | `VERIFIED PASS — CURRENT CAMPAIGN` | The workflow remains blocked; the isolated Rule 35 helper is tested but is not operational acceptance |
| DGM-T12 | Demonstrated missing, invalid, contradictory, same-UT, and valid inter-state POS facts | `indian-states.ts`, `place-of-supply.ts`, `tests/gst-calculator.test.ts`, POS contracts | `VERIFIED PASS — CURRENT CAMPAIGN` | Demonstrated cases are missing/invalid states, contradictory facts, recipient/delivery mismatch, same-UT rejection, and valid inter-state facts. Values `96/97/99` were tested only as unsupported GSTIN prefixes, not as POS inputs; this is not legal classification approval |
| DGM-T13 | Current-release GSTIN length-only validation | `tenant.schemas.ts`; `tests/gst-calculator.test.ts`; `0009-gst-precision-rounding-engineering-contract.md` | `NOT VERIFIED` | Scope is `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`; exactly 15 supplied characters and optional blank are implemented/tested; checksum, state-prefix, registration-status, and effective-date checks remain Version 2; runtime and independent acceptance are separate |
| DGM-T14 | Approved HSN/SAC and effective rate selection | `rule-governance.ts`, sales/purchase rule resolution; governance contract tests | `VERIFIED PASS — CURRENT CAMPAIGN` | No fresh database catalog fixture campaign was required for this source-contract criterion |
| DGM-T15 | Sales finalization retry/idempotency | `sales.actions.ts`; `scripts/gst-application-e2e-runner.mjs` | `VERIFIED PASS — CURRENT CAMPAIGN` | Current run covered duplicate retry, changed-payload conflict, rollback, and single-effect assertions; not a rerun of the separate Sales acceptance campaign |
| DGM-T16 | Purchase finalization retry and changed-payload conflict | Historical restricted-runtime purchase evidence `purchase_gst_1793531037977_0975f5` | `VERIFIED PASS — HISTORICAL` | Historical application evidence, not a new calculation campaign run |
| DGM-T17 | Purchase reconciliation preserves declared/calculated/accepted values | Purchase reconciliation contracts and historical evidence | `VERIFIED PASS — HISTORICAL` | Fresh runtime verification was not repeated for this historical criterion |
| DGM-T18 | Unauthorized purchase acceptance cannot mutate state | Historical restricted-runtime evidence and purchase action permission guard | `VERIFIED PASS — HISTORICAL` | Database proof is historical and target-bound |
| DGM-T19 | Stale purchase GST acceptance revision rejection | `purchases.actions.ts`; `purchases.schemas.ts`; purchase action UI; `purchase-gst-revision-safety-contract.test.mjs` | `NOT VERIFIED` | Current engineering implements and focused-tests the reviewed-revision guard; no runtime campaign was run, and the initial concurrent-acceptance assertion remains rejected because both calls could serialize and succeed |
| DGM-T20 | Atomic sales/purchase rollback | Existing Sales/Purchase campaign artifacts; current Sales rollback result | `VERIFIED PASS — HISTORICAL` | Current campaign reran Sales rollback; the combined purchase rollback claim remains historical |
| DGM-T21 | Tenant isolation under an ordinary restricted role | `scripts/gst-application-e2e-runner.mjs`; 0419 runtime identity evidence | `VERIFIED PASS — CURRENT CAMPAIGN` | Cross-tenant reads/writes were denied or empty under `LOGIN`, non-superuser, `NOBYPASSRLS` runtime role |
| DGM-T22 | Snapshot-first historical reprint behavior | `scripts/gst-application-e2e-runner.mjs`; `gst-calculator.test.ts`; prior GST-016 evidence | `VERIFIED PASS — CURRENT CAMPAIGN` | Current run verified persisted snapshots and immutable finalized invoice mutation rejection |
| DGM-T23 | Overseas/SEZ/Deemed Export/UIN categories fail closed | `treatment.ts` and treatment contract | `VERIFIED PASS — CURRENT CAMPAIGN` | These future categories remain deferred; no calculation is claimed |
| DGM-T24 | Incomplete legacy purchase draft remains held, not silently posted | `purchases.actions.ts`; `scripts/gst-application-e2e-runner.mjs` | `VERIFIED PASS — CURRENT CAMPAIGN` | Current run rejected finalization and verified no status, revision, sequence, posting, stock, or ledger mutation |
| DGM-T25 | Precision and rounding policy acceptance | `0007-gst-rounding-precision-policy.md`; `0009-gst-precision-rounding-engineering-contract.md`; `src/lib/decimal.ts`; calculator tests | `NOT VERIFIED` | Current-scope owner authorization is recorded and exact-decimal implementation/focused tests are complete for the demonstrated paths; runtime and independent acceptance are not claimed, and Section 170/e-invoice/statutory boundaries require qualified professional confirmation |

## 4. Purchase acceptance results

The purchase results are kept separate from Sales GST results.

- The historical restricted-runtime purchase evidence
  `purchase_gst_1793531037977_0975f5` records mixed-rate draft creation,
  governed line snapshots, explicit accounting acceptance, reconciliation,
  idempotency conflict, concurrency, rollback, retry, and accepted-value
  posting.
- That artifact is useful integration/regression evidence for the exact
  purchase behaviors it records. It is not acceptance of the full Purchase GST
  modernization.
- The current authorized 0419 restricted-runtime campaign additionally passed
  inter-state `GJ → MH` IGST acceptance and persistence, and recorded a
  finalization stale-operation race with one posting effect. That evidence does
  not prove stale purchase GST acceptance-revision rejection for DGM-T19. The
  campaign also covered restricted-role tenant isolation and incomplete
  legacy-draft hold behavior. The target was classified as an authorized
  disposable loopback database; 87 owned resources were reported, fixture/
  application rows were retained because immutable financial history made row
  deletion unsafe, and cleanup/disposal was deferred.
- The broader purchase blockers remain: ITC eligibility/apportionment,
  inventory valuation policy, freight/discount allocation, inclusive
  extraction, statutory rounding precedence, and complete GSTIN verification.

## 5. Sales acceptance results

- The prior Sales GST application campaign remains a separate accepted
  application-path artifact under its corrected audit decision.
- This gap-resolution campaign also exercised the Sales application path on
  the authorized 0419 runtime for duplicate retry, changed-payload conflict,
  pre-commit rollback, and finalized-invoice snapshot immutability. It was not
  a rerun of the separate Sales GST acceptance campaign.
- Sales mixed-rate runtime remains outside this campaign. The current Sales
  retry and snapshot evidence closes the corresponding DGM-T15 and DGM-T22
  engineering criteria without claiming complete Sales GST acceptance.

## 6. UTGST

UTGST is not approved for operational use. The prior implementation treated a
same-UT pair as ordinary `INTRA`, which could have allowed CGST/SGST behavior.
The smallest correction was made in the centralized resolver:

1. Same-UT normalized codes now return `UNKNOWN` with reason
   `UNSUPPORTED_UTGST`.
2. Purchase supply facts return an actionable block instead of accepting
   `INTRA_STATE`.
3. Sales draft preview and finalization consume the same centralized result and
   therefore fail closed.
4. No UTGST rate, component split, persistence, or invoice presentation was
   invented.

The new regression assertions passed. This closes the fallback defect; it does
not accept UTGST calculation.

## 7. HSN/SAC, effective dates, and mixed rates

- HSN/SAC classification must be active, approved, source-referenced, and
  effective at the transaction date.
- Exactly one approved effective GST rule is required; no applicable rule or
  overlapping approved rules fails closed.
- Sales and purchase paths resolve rules per product/line and persist rule
  snapshots in their source paths.
- Purchase mixed-rate application evidence exists and passed for the exact
  recorded scenario. Sales mixed-rate runtime evidence is not present in this
  campaign.
- No classification, rate, or statutory source was invented for this review.

## 8. Inclusive/exclusive pricing

- Exclusive arithmetic is exercised by the calculator suite.
- Purchase inclusive mode is explicitly blocked by the application guard.
- The approved inclusive policy requires governed Rule 35 extraction,
  original supplier amount preservation, mixed-rate line extraction, and
  explicit residual adjustment.
- No inclusive calculation acceptance is claimed.

## 9. Precision and rounding

DGM-T25 engineering implementation is complete for the demonstrated calculator
boundaries, but the criterion remains `NOT VERIFIED` pending target-bound
runtime and independent acceptance:

- **Owner decision:** The detailed 12-point matrix is recorded as
  `OWNER APPROVED — CURRENT RELEASE SCOPE WITH VERSION 2 DEFERRALS` in
  [`0009-gst-precision-rounding-engineering-contract.md`](../decisions/0009-gst-precision-rounding-engineering-contract.md).
- **Exact arithmetic:** `src/lib/decimal.ts` uses coefficient/scale decimal
  arithmetic; sales and purchase calculators use it without binary
  floating-point intermediate operations.
- **Rounding:** `HALF_UP`, `DOWN`, `NONE`, commercial round-off, and isolated
  Section 170 nearest-rupee helpers are explicit. Section 170 is not invoked
  automatically by invoice calculations.
- **Focused evidence:** `pnpm test:gst:calculator` passed 294/294 assertions,
  including midpoint boundaries, no-premature-rounding vectors, mixed rates,
  independent components, three ₹0.99 lines at 18%, inclusive extraction,
  commercial round-off separation, supplier-value preservation, T13
  length-only validation, and the explicit JavaScript-number conversion
  boundaries documented in section 9.1.
- **Runtime/legal boundary:** No financial runtime test was executed for this
  T25 campaign. Arithmetic tests do not establish the legally applicable
  Section 170 aggregation boundary, e-invoice obligations, or professional
  GST/accounting acceptance. E-invoice output and credit/debit-note workflows
  remain Version 2 and are not current-release implementation claims.

### 9.1 Final T25 integration-boundary audit

| Audit boundary | Classification | Evidence and limitation |
|---|---|---|
| Exact decimal values converted to JavaScript `number` | `Implemented but not integrated` | `Decimal.toNumber()` in `src/lib/decimal.ts`, `decimalFromString` in `src/lib/validation/purchases.schemas.ts`, and the sales/purchase action persistence boundaries are the relevant paths. Three boundaries are separate: an already-rounded two-decimal value such as `10.12` can serialize to the expected number for that tested value, arithmetic after conversion retains JavaScript binary floating-point behavior (`0.1 + 0.2`), and a high-precision `NUMERIC(20,4)`-scale value (`99999999999999.9999`) becomes `100000000000000`. No universal two-decimal losslessness claim is made |
| Two-decimal internal invoice representation (e-invoice deferred) | `Implemented and tested` | Sales and purchase invoice persistence uses two-decimal monetary columns and the print boundary formats monetary output to two decimals. This is not an e-invoice output surface; e-invoicing remains explicitly deferred |
| Invoice tax totals from reported item tax amounts | `Implemented and tested` | Sales totals aggregate persisted line components; purchase finalization reconciles accepted line components to accepted invoice totals before posting. No e-invoice reconciliation output is implemented |
| Rule 35 inclusive extraction in production flow | `Implemented but not integrated` | `extractInclusivePurchaseLineGst` is exact and focused-tested, but inclusive purchase creation/finalization remains fail-closed pending governed policy and workflow integration |
| Commercial `Round_Off_Amount` separation | `Implemented and tested` | Purchase and sales paths persist `round_off` separately; taxable values and GST components are calculated independently and are not changed by the commercial adjustment |
| Independent CGST, SGST/UTGST, and IGST | `Implemented and tested` | CGST, SGST, and IGST are calculated and persisted independently in the supported sales/purchase paths. UTGST remains explicitly unsupported and is not a current-release implementation claim |
| Supplier-declared purchase values and issued sales values | `Implemented and tested` | Purchase declared/calculated/accepted facts and raw source values remain separate; finalized sales values and tax/supply snapshots are persisted. This does not replace a fresh database campaign for T25 |
| Original credit/debit-note references and adjustments | `Not implemented / no supported workflow` | No credit-note or debit-note calculation/workflow/model exists in the current release. T25-12 is explicitly approved as a Version 2 deferral; this remains not implemented and is not a verified pass |

The number-conversion findings are evidence about separate boundaries, not a
claim that every two-decimal value is universally lossless. The existing
focused tests demonstrate expected serialization for an already-rounded
two-decimal value, binary behavior after conversion to JavaScript `number`, and
precision loss for a high-precision `NUMERIC(20,4)`-scale value. The production
input schemas and service APIs still expose number-shaped compatibility
boundaries, so a future arbitrary-precision financial API would need a
separately approved contract. No source defect was promoted in this
documentation correction pass.

## 10. Unsupported and deferred treatment

The following remain fail-closed and are not claimed as operational:

- Composition, Unregistered Business, and Consumer.
- Overseas, Special Economic Zone, Deemed Export, and UIN Holders.
- Same-UT/UTGST.
- Inclusive purchase extraction.
- Non-zero cess without governed cess and credit-utilization rules.
- Unsupported freight or invoice-wide discount allocation.
- Missing, ambiguous, inactive, or unapproved HSN/SAC/rate evidence.

## 11. Verification commands and results

| Command/evidence | Exit | Result |
|---|---:|---|
| `pnpm exec node --test .\tests\gst-*.test.mjs` | 0 | 37 passed, 0 failed |
| `pnpm test:gst:calculator` | 0 | 294 assertions passed, 0 failed; `GST_CALCULATOR_RUNNER=PASS_TS_NODE_TOP_LEVEL_AWAIT` |
| `node --test` over every `tests\*.test.mjs` file | 0 | 231 passed, 0 failed |
| `pnpm typecheck` | 0 | TypeScript validation passed |
| `pnpm exec prisma validate` with isolated placeholder `DATABASE_URL` and `DIRECT_URL` | 0 | Prisma schema valid; no database connection or mutation |
| `pnpm exec eslint src\lib\decimal.ts src\domain\services\gst-calculator.service.ts src\domain\services\purchase-calculator.service.ts src\domain\services\purchase-gst-reconciliation.service.ts src\domain\services\ledger-impact.service.ts src\app\_actions\sales.actions.ts src\app\_actions\purchases.actions.ts src\app\billing\new\_form.tsx src\app\purchases\new\_form.tsx src\lib\validation\tenant.schemas.ts tests\gst-calculator.test.ts` | 0 | T25 changed source/test files passed |
| `pnpm exec eslint scripts\gst-application-e2e-runner.mjs scripts\gst-calculator-test.cjs src\lib\constants\indian-states.ts src\lib\gst\place-of-supply.ts tests\gst-purchase-pos-contract.test.mjs` | 0 | Earlier gap-resolution source/test files passed |
| `pnpm exec node --test tests\purchase-gst-revision-safety-contract.test.mjs tests\purchase-gst-line-model-contract.test.mjs` | 0 | 2 focused purchase GST contract tests passed |
| `pnpm exec eslint src\lib\validation\purchases.schemas.ts src\app\_actions\purchases.actions.ts src\app\purchases\_actions-cell.tsx src\app\purchases\page.tsx scripts\purchase-gst-application-acceptance.cjs scripts\gst-application-e2e-runner.mjs tests\purchase-gst-revision-safety-contract.test.mjs` | 0 | T19 changed source, harness, UI, and test files passed |
| `node --check scripts\gst-application-e2e-runner.mjs; node --check scripts\gst-calculator-test.cjs` | 0 | JavaScript syntax checks passed |
| Initial authorized 0419 runner attempt after adding a concurrent acceptance assertion | 1 | Failed at the harness assertion because both application calls could serialize and succeed; no acceptance result was claimed from this attempt |
| Authorized 0419 restricted-runtime application runner with `FINANCIAL_E2E_CLEANUP_MODE=DISPOSABLE_TARGET_DISPOSAL` | 0 | Tenant RLS, Sales retry/conflict/rollback, inter-state purchase IGST, finalization stale-operation race/single-effect posting (not DGM-T19 acceptance-revision evidence), legacy hold, payments, and snapshot immutability passed |
| `git diff --check` | 0 | Passed after evidence files were written |

The checked-in TypeScript test header documents `npx tsx`, but `tsx` is not
installed and is not in `devDependencies`. No dependency was added. The
repository now provides `pnpm test:gst:calculator`, which uses the already
installed TypeScript and `ts-node` packages through
[`gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs); this closes
the reproducibility gap without adding a dependency.

The final authorized application run used target `127.0.0.1:55435`,
database `pharmnos_financial_e2e_0419`, marker `pharmnos-financial-e2e`, and
Compose project `pharmnoslite-financial-e2e-0419`. The runtime role was
`LOGIN`, non-superuser, and `NOBYPASSRLS`. The runner reported
`OWNED_RESOURCES=87`. Row-level cleanup was deliberately deferred because
immutable GST financial-history rows were present; no deletion or target
disposal was performed. The initial failed attempt was a test-harness
assumption failure, not a product assertion failure: concurrent acceptance
calls are allowed to serialize and each reads the current revision, while the
final run retained a finalization stale-operation race and single-effect
posting assertion. That evidence is not treated as proof of DGM-T19 stale
purchase GST acceptance-revision rejection. The harness was corrected before
the final passing invocation.

## 12. Engineering correction

Functional source/test changes:

- [`src/lib/decimal.ts`](../../src/lib/decimal.ts)
- [`src/domain/services/gst-calculator.service.ts`](../../src/domain/services/gst-calculator.service.ts)
- [`src/domain/services/purchase-calculator.service.ts`](../../src/domain/services/purchase-calculator.service.ts)
- [`src/domain/services/purchase-gst-reconciliation.service.ts`](../../src/domain/services/purchase-gst-reconciliation.service.ts)
- [`src/domain/services/ledger-impact.service.ts`](../../src/domain/services/ledger-impact.service.ts)
- [`src/app/_actions/sales.actions.ts`](../../src/app/_actions/sales.actions.ts)
- [`src/app/_actions/purchases.actions.ts`](../../src/app/_actions/purchases.actions.ts)
- [`src/app/billing/new/_form.tsx`](../../src/app/billing/new/_form.tsx)
- [`src/app/purchases/new/_form.tsx`](../../src/app/purchases/new/_form.tsx)
- [`src/lib/validation/tenant.schemas.ts`](../../src/lib/validation/tenant.schemas.ts)
- [`tests/gst-calculator.test.ts`](../../tests/gst-calculator.test.ts)

The earlier gap-resolution runner/tooling changes remain part of the retained
evidence package:

- [`package.json`](../../package.json)
- [`scripts/gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs)
- [`scripts/gst-application-e2e-runner.mjs`](../../scripts/gst-application-e2e-runner.mjs)
- [`src/lib/constants/indian-states.ts`](../../src/lib/constants/indian-states.ts)
- [`src/lib/gst/place-of-supply.ts`](../../src/lib/gst/place-of-supply.ts)
- [`tests/gst-purchase-pos-contract.test.mjs`](../../tests/gst-purchase-pos-contract.test.mjs)

Root causes addressed:

- The missing TypeScript runner was a tooling reproducibility gap; the
  repository-supported `pnpm test:gst:calculator` command now uses installed
  `ts-node`/TypeScript without adding a dependency.
- The calculator paths previously relied on binary floating-point operations
  and premature rounding. The shared coefficient/scale decimal utility now
  provides explicit precision and rounding boundaries, including isolated
  Section 170 and commercial round-off helpers.
- Sales and purchase calculator/form paths now aggregate independently
  calculated components without splitting a rounded lump-sum tax amount.
- Purchase GST reconciliation, accepted-value posting totals, and customer/
  supplier ledger balances now aggregate and compare monetary values through
  the shared decimal boundary rather than binary arithmetic.
- Current-release GSTIN validation is length-only when supplied; checksum,
  state-prefix, registration-status, and effective-date checks remain Version 2
  scope and are not inferred from unsupported prefixes.
- Purchase evidence correction resets current acceptance and increments the GST
  record version; the advanced stale acceptance-revision guard remains a
  Version 2 scope proposal rather than an implementation claim.
- The acceptance matrix needed to distinguish POS facts from GSTIN-prefix
  handling; focused assertions preserve `UNKNOWN` and fail-closed behavior for
  the demonstrated POS cases, while `96/97/99` were tested only as unsupported
  GSTIN prefixes.
- The application harness previously lacked current assertions for inter-state
  purchase acceptance, Sales retry/conflict/rollback, finalization
  stale-operation/single-effect behavior, restricted-role tenant isolation, and
  incomplete legacy-draft hold behavior; those scenarios are now exercised
  against the authorized disposable target. The finalization evidence does not
  close the separate DGM-T19 stale purchase GST acceptance-revision criterion.

No UTGST support, new rate, schema, RLS policy, permission, credit/debit-note
path, or e-invoice calculation path was added. The acceptance and tracker
documents are evidence updates, not policy substitutions. The detailed T25
contract is implemented for the tested calculator paths but remains pending
owner approval and professional confirmation.

## 13. Remaining blockers and non-claims

- This result does not close GST Stage 1.
- This result is not statutory, legal, accounting, or professional
  certification.
- No production or Live Supabase system was accessed.
- Only the authorized disposable loopback target
  `pharmnos_financial_e2e_0419` was accessed and mutated by fixture/application
  actions; no migration, schema, provisioning, or RLS change was executed.
- No existing container was started, stopped, restarted, removed, or recreated.
- The current gap-resolution application runner had one failed harness
  assertion attempt followed by one final passing invocation; the separate
  Sales GST acceptance campaign was not rerun.
- Sales and Purchase evidence remain separately identifiable and are not merged
  into a claim that the full Purchase GST workstream or Sales GST scope passed.
- Cleanup was deferred because immutable financial-history rows must not be
  deleted under the current safety policy. No recovery deletion or database
  disposal was performed.
- The Git index and commit history were not changed. The working tree contains
  pre-existing staged work plus the functional source/test changes and this
  evidence package from this campaign; no unrelated work was overwritten.

## 14. Final audit status — 2026-11-04

- **DGM-T13:** `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`;
  implementation and focused test evidence passed; checksum, state-prefix,
  registration-status, and effective-date checks remain deferred; runtime and
  independent acceptance are not claimed.
- **DGM-T19:** `CURRENT RELEASE SCOPE APPROVED — VERSION 2 DEFERRED`; the
  reviewed-revision guard is implemented by the owner-directed
  current-engineering patch. The guard is focused-tested across acceptance,
  discrepancy resolution, and correction;
  authorization, acceptance-reset, reconciliation, and finalization safeguards
  remain present. Targeted runtime verification and independent acceptance are
  not claimed.
- **DGM-T25:** exact-decimal engineering is implemented for the demonstrated
  paths; the eight integration boundaries are classified in §9.1. Current
  scope approval is recorded with e-invoice and credit/debit-note capabilities
  deferred to Version 2. Runtime and independent acceptance remain open, and
  Section 170/e-invoice/statutory obligations remain subject to qualified
  professional confirmation.
- **Runtime verification:** no new runtime/database campaign was run for this
  source-level T19 resolution or T25 audit; the later consolidated campaign
  completed only safe preflight and was blocked before database connection
  because the exact immutable target contract was not supplied. Prior
  restricted-runtime evidence remains target-bound and does not close T13, T19,
  or T25.
- **Independent acceptance:** `NOT ACCEPTED`; the campaign remains 22/25
  evidence-supported criteria with no verified failures. T13, T19, and T25
  remain separate `NOT VERIFIED` runtime/independent-acceptance statuses.

## 15. Consolidated current-release campaign — 2026-11-04

The consolidated T13/T19/T25 campaign completed the authoritative scope
inspection, implementation baseline, regression verification, and
documentation reconciliation. The required immutable disposable-target
contract was absent, so the target preflight failed closed with
`FINANCIAL_E2E_TARGET_CONTRACT is required`. Six disposable Q17 containers
were visible on ports 55461–55466; none was selected by similarity.

- **T13 runtime verification:** `BLOCKED` before database execution; exact
  15-character validation remains implemented and tested, while target-bound
  runtime evidence was not produced.
- **T19 runtime verification:** `BLOCKED` before database execution; reviewed
  revision, evidence revision, calculation ID, stale-revision, guarded
  correction, rollback, authorization, reconciliation, reset, and
  finalization protections remain source-tested but target-bound runtime
  evidence was not produced.
- **T25 runtime verification:** `BLOCKED` before database execution; exact
  decimal arithmetic, component separation, supplier-value preservation,
  totals, round-off separation, and conversion boundaries remain implemented
  and regression-tested, but target-bound runtime evidence was not produced.
- **Independent acceptance:** T13, T19, and T25 are
  `INSUFFICIENT EVIDENCE` for this campaign. The final acceptance remains
  `NOT ACCEPTED`, with 22/25 evidence-supported criteria, three
  `NOT VERIFIED` current-scope criteria, and no verified failures.
- **Regression evidence:** `pnpm test:gst:calculator` passed 294/294;
  focused GST contracts passed 37/37; target/T19 contract tests passed 8/8;
  the full JavaScript suite passed 232/232; typecheck, safe-placeholder
  Prisma validation, changed-file ESLint, syntax checks, and
  `git diff --check` passed.
- **Safety:** no database connection, mutation, migration, provisioning,
  fixture write, cleanup, container lifecycle operation, production access, or
  acceptance rerun occurred during this campaign.
- **Remaining blocker:** supply and validate the exact immutable target
  contract, including target identity, authorized roles, schema evidence,
  run/tenant scope, authorization, and expiry, before any runtime scenario.
