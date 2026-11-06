# Financial Reconciliation Evidence

Static source contracts cover invoice snapshots, numbering, GST/totals, ledger and inventory pathways, PDF fields, amount-in-words, QR, and barcode generation.

The target-bound application harness executed current-source Sales and Purchase flows against the immutable disposable target. For the finalized invoice probe, independent exact-decimal arithmetic matched the persisted values: taxable `10000` cents, GST `1800` cents, and payable total `11800` cents. The persisted PDF checksum and byte size matched the stored metadata, and the application-generated artifact decoded to QR plus Code128 values from the finalized record.

The continuous disposable browser campaign added persisted purchase and sales reconciliation. Purchase `cmw5cb5gv000nm92u03egnu1k` matched `800.00 + 72.00 + 72.00 = 944.00`, received 10 units, created a `PURCHASE_IN` movement, and posted supplier credit `944.00`. Sales `cmw5cgyja001xm92u0omxrp7t` matched `2 × 110.00 = 220.00`, GST `39.60`, total `259.60`, reduced available stock `10 → 8`, and posted customer debit `259.60`.

Purchase inventory acquisition remains `PENDING`/null for the browser transaction because no governed eligibility classification was used. The focused valuation suite separately proves the owner-approved software policy: recoverable GST is excluded, non-recoverable GST is included, partial recovery is split, unresolved evidence remains pending, and corrections are explicit deltas. These synthetic fixtures prove software behavior only and are not statutory or professional confirmation. The inventory criterion is therefore software-verified without asserting a real-world eligibility classification; independent acceptance remains open.

Focused command: `node --test --import ts-node/register tests/inventory-valuation.service.test.mjs tests/purchase-gst-valuation-contract.test.mjs` — 8/8 passed.
