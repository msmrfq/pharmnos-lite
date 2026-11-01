# Purchase GST Financial Integrity Acceptance Audit — 2026-11-01

## Verdict

**PARTIALLY ACCEPTED.** The stale canonical purchase-line amount defect is corrected and independently verified on a fresh disposable PostgreSQL target under the restricted runtime role. Purchase GST financial integrity is not fully closed because approved inventory valuation policy and other documented GST/accounting policy gates remain unresolved; the separate HIGH forged-GUC trust-boundary finding also remains open.

## Evidence

- Latest accepted-source evidence, preserved unchanged: `specs/purchase-gst-application-evidence-purchase_gst_1793523621669_dcaf26.json`
- Verified SHA-256: `31DB225B62CAB258823F3A69C5B53A8D13AE47CD8AEF9918C450A19D01B49869`
- Fresh post-correction evidence: `specs/purchase-gst-application-evidence-purchase_gst_1793524087997_be4146.json`
- Fresh evidence SHA-256: `AABF59F913DAF9BA4F748F98CD0BF8FE46E6E6E34A19AF04E35908A94361CFA7`
- Fresh target: local disposable PostgreSQL only; no production or Live Supabase operation.
- Fresh schema baseline: `C:\Users\Masum Rafique\.copilot\session-state\de6b39fc-5872-46e6-8130-58843b8116f4\files\purchase-gst-audit-baseline-schema-2026-11-01T14-34-17.sql`
- Baseline SHA-256: `228D0A64B04663D902817DC937FDDE1864899A404D80A54E2B9C6EB11FB09C7C`

## Source-to-output trace

`finalizePurchaseAction` validates the persisted accepted snapshot, selects accepted aggregate totals for `SUPPLIER_DECLARED`, `APPLICATION_CALCULATED`, and `EXPLICIT_DECISION`, builds the posting payload from accepted values, and posts within one Prisma transaction. During that same transaction, finalized canonical line fields are synchronized from the accepted snapshot:

- `purchase_invoice_items.line_total` ← `accepted_line_total`
- `purchase_invoice_items.gst_amount` ← accepted CGST + SGST + IGST + cess
- invoice header net/tax totals ← accepted aggregate totals
- supplier ledger credit and balance increment ← accepted invoice total
- audit metadata net amount ← accepted invoice total
- posting payload line amounts ← accepted values; persisted hash matches the reconstructed payload

Supplier-declared evidence, calculated values, accepted values, decision metadata, and historical reconciliation records remain separate.

## Persisted monetary reconciliation

Fresh explicit-decision scenario values:

| Output | Persisted amount |
|---|---:|
| Accepted taxable total | 191.0000 |
| Accepted CGST | 13.6300 |
| Accepted SGST | 13.6300 |
| Accepted line total | 218.3400 |
| Canonical persisted line total sum | 218.34 |
| Canonical persisted GST amount sum | 27.26 |
| Invoice total tax | 27.26 |
| Invoice net amount | 218.34 |
| Supplier ledger credit | 218.34 |
| Audit metadata net amount | 218.34 |

No purchase-specific tax journal/accounting model was found; no such output is claimed.

## Posting payload and hash

The fresh evidence records posting status `COMPLETED`, payload hash `6f2ff789dabde4e271bb910d017a2d7545cb4e426ce4cdf56e3b5c0b3ba0bb1d`, and successful reconstruction equality against the persisted hash. The payload uses the accepted canonical line amounts rather than stale ordinary draft totals.

## Transactional and security results

The fresh restricted-role campaign passed **16/16** scenarios, including accepted posting, same-key replay, different-payload conflict, concurrent finalization, concurrent acceptance/finalization protection, forced posting rollback, retry after rollback, uncertain-commit recovery, inactive membership denial, cross-tenant denial, and transaction-local claim isolation. Runtime role assessment remained `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; cleanup verified the disposable database was absent.

The HIGH forged-GUC trust-boundary finding remains separate and unresolved; this audit does not claim it fixed.

## Inventory valuation and remaining blockers

No approved policy was found that determines whether accepted GST, cess, freight, discounts, or tax credits belong in inventory cost. The implementation continues to use `purchase_rate` for stock batch and movement unit rate; this is not treated as proof of GST-inclusive or GST-exclusive valuation policy. Inventory valuation acceptance remains blocked pending owner/accounting policy.

Other open gates include inclusive GST, freight allocation, discount allocation, rounding precedence, discrepancy tolerance, production rollout/recovery approval, and missing standalone `tsx` execution for the GST calculator test.

## Correction and validation

The confirmed defect was stale finalized `line_total`/`gst_amount` values when accepted line values differed. The surgical correction synchronizes those canonical fields during finalization and makes the payload use the accepted values. Regression coverage was added to `tests/purchase-gst-line-model-contract.test.mjs` and the acceptance harness now asserts canonical line reconciliation.

Validation:

- Focused Node contracts: passed.
- TypeScript typecheck: passed.
- ESLint and `git diff --check`: passed.
- Restricted-role Purchase GST acceptance: 16/16, zero failures.

No Git reset, checkout, stash, clean, revert, commit, push, staging, or unrelated-change removal was performed.
