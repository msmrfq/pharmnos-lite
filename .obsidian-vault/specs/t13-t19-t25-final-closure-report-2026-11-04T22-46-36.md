---
title: T13 T19 T25 final closure report 2026-11-04T22-46-36
date: 2026-11-04
status: HISTORICAL - SUPERSEDED BY 2026-11-05 CAMPAIGN REPORT
contentType: Spec
---

## Goal

Record the final owner-authorized T13, T19, and T25 closure campaign against
the current worktree, preserving the distinction between implementation,
offline evidence, target-bound runtime evidence, independent acceptance,
professional confirmation, and production authorization.

## Acceptance Criteria

- [x] T13 current-release GSTIN behavior is implemented and current-source
      verified across the approved validation surfaces.
- [x] T19 current-release revision and acceptance safeguards pass the
      current-source target-bound suite on a guarded disposable target.
- [x] T25 current-source application/persistence runtime evidence covers the
      approved sales and purchase paths.
- [x] The dedicated T13, T19, and T25 suites and repository safety gates pass.
- [x] Current evidence and source identity are recorded without exposing
      secrets or mutating production.
- [x] Independent, professional/statutory, and production authorization
      boundaries are stated separately.

## Out of Scope

Checksum or government-status GSTIN verification, Version 2 GST workflows,
new accounting or statutory interpretations, production or Live Supabase
access, destructive database or Docker operations outside the disposable
target lifecycle, Git state mutation, and independent or professional
acceptance claims not supported by separate evidence.

# Final T13, T19, and T25 closure report

> **Historical status:** This report preserves the 2026-11-04 source snapshot
> and runtime evidence. It is superseded for current acceptance by
> [`pharmnos-lite-gst-modernization-financial-e2e-final-closure-report-2026-11-05T01-31-42.md`](./pharmnos-lite-gst-modernization-financial-e2e-final-closure-report-2026-11-05T01-31-42.md).
> Do not use its 25/25, T19 target-bound, or 293/293 figures as current-source
> closure evidence.

## A. Executive closure decision

| Suite | Decision | Basis |
|---|---|---|
| T13 - GSTIN verification | **Engineering Closed** | The approved scope is exactly 15-character format validation. The current-source offline suite passed 12/12, including valid, short, long, empty, omitted, whitespace, non-string, onboarding, customer, and supplier cases. T13 is not a GSTIN authenticity or government-status claim. |
| T19 - Purchase GST revision and acceptance safety | **Engineering Closed** | The current-source target-bound suite passed 16/16 on a guarded disposable target. Evidence source hashes match the current worktree, restricted runtime attributes were verified, and ownership-bound disposal was verified absent. Independent acceptance and policy/professional boundaries remain separate. |
| T25 - GST calculation and treatment | **Engineering Closed** | The current-source exact-decimal suite passed 293/293, and a separate guarded disposable target passed the current-source Sales application/persistence proof with database read-back. No unsupported runtime, precision, or statutory claim is made. |

The final documented matrix uses one point per listed criterion because no
unequal weights are defined in the controlling records. It therefore records
**25/25 (100%) evidence-supported criteria**. Independent technical acceptance,
qualified professional/statutory confirmation, and production authorization
are separate gates and are not converted into criteria passes.

## B. Evidence matrix

### T13 - GSTIN verification

| Criterion | Implementation | Test/evidence | Source snapshot | Runtime level | Result | Remaining qualification |
|---|---|---|---|---|---|---|
| Exact 15-character supplied GSTIN | `src/lib/validation/gstin.ts`, tenant and master schemas | `pnpm test:t13:gstin`; 12/12 | `t13-gstin-verification-evidence-t13_gstin_final_20261104_2300.json`; sourceIdentity SHA-256 files; artifact SHA-256 `19B6A31559E2FFABF621FCE6ED5BF69E1F9063DC11371F2458F02D4D6B203FEC` | Current-source offline | VERIFIED | Length-only contract; no checksum or authenticity claim |
| Optional blank and omitted GSTIN behavior | `tenant.schemas.ts`, `masters.schemas.ts` | T13 scenarios for blank and omission across business, onboarding, customer, and supplier surfaces | Same current-source T13 evidence | Current-source offline | VERIFIED | Optional behavior is not a database constraint claim |
| Whitespace and non-string rejection | Shared validator and schema boundaries | T13 scenarios for surrounding whitespace and non-string values across approved surfaces | Same current-source T13 evidence | Current-source offline | VERIFIED | Values are rejected; no trimming or coercion is introduced |
| Prefix, checksum, state status, and effective-date behavior | No implementation added | T13 suite preserves prefix as a length-only input; Version 2 cases are excluded | Current-release scope and decision 0009 | Not applicable | DEFERRED | These are explicit Version 2 exclusions |

### T19 - Purchase GST revision and acceptance safety

| Criterion | Implementation | Test/evidence | Source snapshot | Runtime level | Result | Remaining qualification |
|---|---|---|---|---|---|---|
| Reviewed record version binding | `src/app/_actions/purchases.actions.ts` | `pnpm test:t19:purchase-gst`; 16/16 | T19 evidence sourceHashes match the current worktree; artifact SHA-256 `4B59D3ACADD46103691DFA4CABE0E3DC5E37280F6635F39165C85FFC654DF2BD` | Current-source target-bound | VERIFIED | Evidence is for the exercised purchase scenarios only |
| Evidence revision and calculation ID binding | Purchase actions and schemas | T19 acceptance, correction, reconciliation, and stale-operation scenarios | Same current-source T19 evidence | Current-source target-bound | VERIFIED | No broader purchase-accounting claim |
| Guarded correction and stale revision rejection | Purchase actions and revision-safety contracts | T19 stale revision and correction scenarios; focused contract tests pass | Same current-source T19 evidence | Current-source target-bound plus contract | VERIFIED | Independent technical acceptance remains separate |
| Atomic rollback of stale or failed child writes | Transactional guarded updates | T19 rollback scenarios; expected negative-path errors were asserted as passes | Same current-source T19 evidence | Current-source target-bound | VERIFIED | Does not close separate recovery/backup operations |
| Authorization and tenant isolation | Request-scoped context and purchase actions | T19 inactive-membership and cross-tenant scenarios | Same current-source T19 evidence | Current-source target-bound | VERIFIED | Runtime role was restricted; arbitrary SQL claim forgery is a separate residual risk |
| Acceptance reset, reconciliation, and finalization safeguards | Purchase action lifecycle | T19 complete suite and focused boundary tests | Same current-source T19 evidence | Current-source target-bound plus contract | VERIFIED | Policy gates for valuation and accounting remain outside T19 |
| T19 scope boundary | No exceptional workflows added | Suite and documentation reconciliation | Current worktree and scope baseline | Contract/documentation | VERIFIED | Credit/debit notes, ITC reconciliation, and other Version 2 workflows remain excluded |

### T25 - GST calculation and treatment

| Criterion | Implementation | Test/evidence | Source snapshot | Runtime level | Result | Remaining qualification |
|---|---|---|---|---|---|---|
| Exact-decimal arithmetic and intermediate precision | `src/lib/decimal.ts`, GST and purchase calculators | `pnpm test:t25:gst-calculation`; 293/293 | `t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793814889348.json`; source identity and Prisma-Decimal adapter regression; artifact SHA-256 `03D81B46F296FF87A5A32744D4F828D3FA186FC3B6185D26B79D5E04FC816117` | Current-source offline | VERIFIED | No universal JavaScript-number losslessness claim |
| Independent CGST, SGST/UTGST, and IGST components | GST and purchase calculators | T25 calculator and POS scenarios | Same current-source T25 evidence | Current-source offline | VERIFIED | UTGST remains fail-closed and unsupported |
| Supplier-declared, calculated, and accepted values remain distinct | Purchase calculator and reconciliation service | T25 offline evidence plus T19 accepted purchase runtime snapshots | T25 source identity and T19 current-source sourceHashes | Offline plus purchase target-bound | VERIFIED | Sales persistence evidence is separate and does not broaden purchase policy scope |
| Purchase and sales totals with separate commercial round-off | GST and purchase calculators | T25 totals and round-off scenarios; current-source Sales persistence read-back | T25 offline evidence plus T25 Sales suite source hashes | Offline plus application/persistence target-bound | VERIFIED | Sales proof is limited to the approved exclusive intra-state scenario |
| Exclusive and approved engineering treatment paths | Calculator and fail-closed purchase guards | T25 exclusive/inclusive helper and guard scenarios | Same current-source T25 evidence | Current-source offline | VERIFIED WITH POLICY BOUNDARY | Inclusive operational workflow remains gated where Rule 35 and residual policy are incomplete |
| Invalid optional decimals and discount bounds | Tenant, master, and purchase schemas | T25 validation scenarios and full regression | Current worktree source identity | Current-source offline/contract | VERIFIED | Invalid supplied values are rejected, not coerced to zero |
| Calculated-versus-declared discrepancy preservation | Purchase reconciliation service | Reconciliation tests and T19 accepted purchase scenarios | Current-source T19 evidence | Contract plus purchase target-bound | VERIFIED | Exact tolerance and authority remain policy/professional boundaries |
| Serialization, JavaScript number, and PostgreSQL NUMERIC boundaries | Decimal tests and schema review | T25 explicit boundary scenarios | Current-source T25 evidence | Current-source offline/schema review | VERIFIED | No unsupported precision guarantee |
| Required application/persistence runtime acceptance | Sales and purchase action paths | `GST_E2E_SALES_ONLY=true pnpm exec node scripts/gst-application-e2e-runner.mjs`; Sales read-back passed; T19 covers purchase application | T25 Sales suite source hashes and target fingerprint `a01fd60e476e3881a05389a974c603cb2e2edc62a8b49650c579d60c13a72437` | Current-source application/persistence target-bound plus purchase target-bound | VERIFIED | Separate independent acceptance and production authorization remain open |

Version 2 exclusions remain explicit: GSTIN checksum and registry checks,
e-invoicing/e-way bills, returns, ITC reconciliation, credit/debit notes,
multiple registrations, imports/exports, SEZ/deemed exports, UIN, and RCM.

## C. Actual changes

### Source and test changes

- [`scripts/offline-suite-runner.cjs`](../../scripts/offline-suite-runner.cjs):
  added SHA-256 source identity to offline suite evidence and failed closed
  when a declared source file is missing.
- [`scripts/gstin-verification-test.cjs`](../../scripts/gstin-verification-test.cjs):
  declared the T13 test and directly exercised validation source files for
  evidence hashing.
- [`scripts/gst-calculator-test.cjs`](../../scripts/gst-calculator-test.cjs):
  declared the T25 test and directly exercised calculation/validation source
  files for evidence hashing.
- [`tests/t13-t19-t25-suite-boundary.test.mjs`](../../tests/t13-t19-t25-suite-boundary.test.mjs):
  added regression assertions that T13 and T25 publish source-file identity.
- [`tests/gstin-verification.test.ts`](../../tests/gstin-verification.test.ts):
  added whitespace, non-string, and omitted-field cases across approved
  GSTIN surfaces.
- [`src/lib/decimal.ts`](../../src/lib/decimal.ts): accepted Prisma
  Decimal-like values at the decimal conversion boundary instead of
  silently treating persisted monetary values as zero.
- [`tests/gst-calculator.test.ts`](../../tests/gst-calculator.test.ts): added
  a regression assertion for Prisma Decimal-like values.
- [`scripts/gst-application-e2e-runner.mjs`](../../scripts/gst-application-e2e-runner.mjs):
  added sales-only execution, persisted Sales read-back assertions, source
  hashes, and actionable action-failure diagnostics.

### Documentation and evidence changes

- [`t13-gstin-verification-evidence-t13_gstin_final_20261104_2300.json`](./t13-gstin-verification-evidence-t13_gstin_final_20261104_2300.json):
  current-source T13 evidence, 12/12.
- [`t25-gst-calculation-treatment-evidence-t25_gst_final_20261104_2234.json`](./t25-gst-calculation-treatment-evidence-t25_gst_final_20261104_2234.json):
  superseded T25 calculation evidence, 292/292, retained for provenance.
- [`t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793814889348.json`](./t25-gst-calculation-treatment-evidence-t25_gst_calculation_treatment_1793814889348.json):
  current-source T25 calculation evidence, 293/293, with the decimal
  conversion regression assertion.
- [`t25-sales-runtime-t25_sales_1793814909158_be9f4d-suite.json`](./t25-sales-runtime-t25_sales_1793814909158_be9f4d-suite.json):
  current-source Sales application/persistence evidence with source hashes,
  persisted values, and target fingerprint.
- [`t25-sales-runtime-t25_sales_1793814909158_be9f4d-initialization.json`](./t25-sales-runtime-t25_sales_1793814909158_be9f4d-initialization.json),
  [`t25-sales-runtime-t25_sales_1793814909158_be9f4d-infrastructure.json`](./t25-sales-runtime-t25_sales_1793814909158_be9f4d-infrastructure.json),
  and [`t25-sales-runtime-t25_sales_1793814909158_be9f4d-cleanup.json`](./t25-sales-runtime-t25_sales_1793814909158_be9f4d-cleanup.json):
  target lifecycle evidence for the final Sales proof.
- This final closure report.
- The current-release baseline, reconciliation matrix, chronological GST
  acceptance record, implementation tracker, phase tracker, and canonical
  briefing were updated with the final status and evidence boundaries.
- Generated briefing mirrors were synchronized from the canonical briefing.

No product migration, database mutation, production access, Docker lifecycle
operation outside the already completed owned disposable lifecycle, or Git
state mutation was performed.

## D. Test results

| Command | Result |
|---|---|
| `pnpm test:t13:gstin` | 12 passed, 0 failed |
| `pnpm test:t19:purchase-gst` | 16 passed, 0 failed on the current-source disposable target |
| `pnpm test:t25:gst-calculation` | 293 passed, 0 failed |
| `GST_E2E_SALES_ONLY=true pnpm exec node scripts/gst-application-e2e-runner.mjs` | PASS: Sales application/persistence read-back; `SALES-SUCCESS` and `T25-SALES-PERSISTENCE` passed |
| `pnpm typecheck` | Passed after the decimal conversion fix |
| `pnpm exec eslint .\src\lib\decimal.ts .\tests\gst-calculator.test.ts` | Passed |
| `pnpm exec node --check .\scripts\gst-application-e2e-runner.mjs` | Passed |
| `pnpm exec node --test .\tests\t13-t19-t25-suite-boundary.test.mjs .\tests\purchase-gst-revision-safety-contract.test.mjs` | 4 passed, 0 failed |
| `pnpm exec node --test .\tests\*.test.mjs` | 241 passed, 0 failed, 0 skipped |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed with no warnings or errors |
| `node --check` for changed CommonJS runners | Passed |
| `pnpm exec prisma validate` with non-secret placeholders | Passed |
| `git diff --check` | Passed |

The 241/241 full-regression result is retained from the pre-existing final
campaign gate. It was not rerun because this narrowly authorized closure step
was limited to the affected T25 calculation and Sales persistence paths; the
post-fix focused suite, Sales target run, typecheck, lint, and syntax checks
above cover the changed surface.

The T19 suite intentionally logs expected database errors for negative-path
assertions; those scenarios passed and did not produce suite failures.

## E. Target lifecycle

A single fresh guarded disposable target was used for current-source T19
application verification:

- Host/port: `127.0.0.1:55511`
- Database: `pharmnos_financial_e2e_t13t19t25_final_20261104b`
- Compose project/service/profile:
  `pharmnoslite-financial-e2e-t13t19t25-final-20261104b` /
  `financial-e2e-postgres` / `financial-e2e`
- Roles: `pharmnos_e2e` bootstrap and `pharmnos_e2e_runtime` runtime
- Marker: `pharmnos-financial-e2e`
- Schema artifact SHA-256:
  `508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5`
- Current-source hashes recorded by the suite:
  `src/app/_actions/sales.actions.ts`
  `78d8091d0bcc1fc28e09309e20a413a74f25ae26460f8dd3e1378ecefc1ed56f`;
  `src/domain/services/gst-calculator.service.ts`
  `7321202fc07a16f9fd6603b60c412faa1421dbaf2057a68571c0f6d06604509b`;
  `src/lib/decimal.ts`
  `d73b7821d7c194d721bcc140362d70d3acfc819c2c81bead1903c9f2ef3fad3c`;
  `prisma/schema.prisma`
  `a4c2d9e2eadf25b58728b3dcb9b7274278d08dd948aab2da16e1999dd543368d`;
  `prisma/financial-e2e-schema-provisioning.generated.sql`
  `508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5`;
  `scripts/gst-application-e2e-runner.mjs`
  `7fb6b68af2d970aeff22a179f7a5c1786a56ac5d300c13249ab5972efa0d080e`.
- Initialization: 33 RLS tables, 84 policies, 16 triggers, 123 constraints,
  runtime `DELETE` privileges 0, and restricted runtime attributes verified.
- Application execution used the restricted runtime role; bootstrap was
  fixture/assertion-only.
- Cleanup used the ownership-bound disposable lifecycle and recorded
  `verifiedAbsent: true`.

The final T13 suite remained offline by design. The T25 calculation suite
remained offline by design, while its required Sales application/persistence
criterion used the separate target below. No production or Live Supabase
connection was used.

Lifecycle evidence:

- Infrastructure:
  [`financial-e2e-t13_t19_t25_final_20261104_2236-infrastructure.json`](./financial-e2e-t13_t19_t25_final_20261104_2236-infrastructure.json)
- Initialization:
  [`financial-e2e-t13_t19_t25_final_20261104_2236-initialization.json`](./financial-e2e-t13_t19_t25_final_20261104_2236-initialization.json)
- T19 suite:
  [`financial-e2e-t13_t19_t25_final_20261104_2236-suite.json`](./financial-e2e-t13_t19_t25_final_20261104_2236-suite.json)
- Cleanup:
  [`financial-e2e-t13_t19_t25_final_20261104_2236-cleanup.json`](./financial-e2e-t13_t19_t25_final_20261104_2236-cleanup.json)

T25 Sales application/persistence lifecycle evidence:

- Host/port: `127.0.0.1:55488`
- Database: `pharmnos_financial_e2e_t25_sales_1793814909158_be9f4d`
- Compose project/service/profile:
  `pharmnoslite-financial-e2e-t25-sales-1793814909158_be9f4d` /
  `financial-e2e-postgres` / `financial-e2e`
- Roles: `pharmnos_e2e` bootstrap and `pharmnos_e2e_runtime` runtime
- Marker: `pharmnos-financial-e2e`
- Schema artifact SHA-256:
  `508e0122b95496466544b4b508a50b18a326b7f4a43b6f6a5849232291a8bea5`
- Initialization: 33 RLS tables, 84 policies, 16 triggers, 123 constraints,
  runtime `DELETE` privileges 0, and restricted runtime attributes verified.
- Application execution used the restricted runtime role. The persisted Sales
  result was read back before disposal: taxable 100, CGST 9, SGST 9, IGST 0,
  cess 0, total tax 18, round-off 0, net and balance 118, customer receivable
  250 to 368, supplier payable 125 to 125, and one stock movement, customer
  ledger, and finalization audit record.
- Cleanup used the ownership-bound disposable lifecycle and recorded
  `verifiedAbsent: true`; independent inspection confirmed the exact Compose
  container, network, and port were absent.
- Suite artifact SHA-256:
  `E4D1E4833EBFCCD762DE4D4B9BBA2D150A861914AA1F23EADF0701FFDDCFC094`.

## F. Outstanding matters

### T25 current-source sales application/persistence evidence - resolved

- **Observed failure:** The first current-source Sales attempt returned
  `Totals mismatch vs calculated`.
- **Root cause:** Prisma Decimal values were passed directly to the custom
  decimal parser. The parser rejected the object shape and `decimalOrZero`
  silently returned zero, so a persisted quantity/rate pair became a zero
  taxable value during action calculation.
- **Surgical resolution:** `src/lib/decimal.ts` now accepts Decimal-like
  values through their string representation, with a focused regression
  assertion. No GST rule, rounding policy, or Sales workflow was redesigned.
- **Verification:** T25 calculation suite passed 293/293; the final
  current-source Sales target run passed `SALES-SUCCESS` and
  `T25-SALES-PERSISTENCE`, including database read-back and source hashes.
- **Dependency type:** Engineering evidence, resolved.
- **Prevents Engineering Closed:** No.

### Independent technical acceptance

- **Root cause:** Execution and implementation by the same campaign do not
  constitute independent acceptance.
- **Dependency type:** Independent acceptance.
- **Evidence:** T13, T19, and T25 artifacts explicitly record test results and
  do not claim independent acceptance.
- **Prevents Engineering Closed:** No for T13 or T19; it prevents broader
  independent acceptance of the consolidated GST scope.

### Professional and statutory confirmation

- **Root cause:** Section 170 aggregation, non-zero cess, inclusive Rule 35
  residual treatment, statutory tax-head treatment, discrepancy authority,
  and inventory valuation require qualified confirmation or still-open
  policy detail.
- **Dependency type:** Owner-policy/professional/statutory.
- **Evidence:** Decisions 0003-0008, the accounting question pack, and the
  current-release baseline.
- **Prevents Engineering Closed:** No for T13/T19; it prevents complete GST
  acceptance and production authorization.

### Production authorization

- **Root cause:** Local disposable evidence is not production approval.
- **Dependency type:** Production authorization.
- **Evidence:** Phase tracker and schema rollout boundaries.
- **Prevents Engineering Closed:** No; production remains a separate NO-GO.

## G. Final status block

[PHARMNOS-LITE STATUS]
Stage: Final T13/T19/T25 closure
Completion: 25/25 documented criteria (100%; equal criterion count because no unequal weights are defined)
Done: T13 engineering contract and current-source offline verification 12/12; T19 current-source target-bound verification 16/16; T25 current-source calculation verification 293/293; T25 current-source Sales application/persistence read-back; targeted typecheck, lint, syntax, and cleanup gates
Remaining: Independent technical acceptance; qualified professional/statutory confirmation; production authorization
Blockers: None for the approved T13/T19/T25 engineering criteria. External acceptance, professional/statutory, policy, and production gates remain separate.
Next: No further T13/T19/T25 engineering campaign is necessary; obtain only the separate independent/professional/production decisions

## H. Final declaration

- **T13:** Engineering Closed. Its approved current-release scope is
  length-only GSTIN validation; Version 2 authenticity checks remain
  deferred. Independent acceptance and production authorization are separate.
- **T19:** Engineering Closed. Its current-source target-bound suite passed
  16/16 on the guarded disposable target, with source hashes and cleanup
  evidence recorded. Independent acceptance and broader accounting approval
  are separate.
- **T25:** Engineering Closed. Its current-source calculation suite passed
  293/293, and its approved Sales application/persistence criterion passed on
  the guarded disposable target with persisted database read-back. This does
  not claim universal precision, statutory approval, or production readiness.
- **Master matrix:** Genuinely **25/25 (100%)** for the documented equal-count
  engineering criteria.
- **Further engineering campaign:** No further T13/T19/T25 engineering
  campaign is necessary for the approved current-release scope.
- **External confirmations:** Independent technical acceptance and qualified
  professional/statutory confirmation remain open.
- **Production:** Production authorization remains separate and NO-GO.
