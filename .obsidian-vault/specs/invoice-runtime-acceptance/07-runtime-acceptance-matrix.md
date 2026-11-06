# Runtime Acceptance Matrix

| Area | Result |
|---|---|
| Authenticated purchase workflow | Runtime verified through target-bound application harness and continuous disposable browser finalization (`cmw5cb5gv000nm92u03egnu1k`) |
| Supplier upload/read-back/replacement | Runtime verified; private read-back and `supersedes_id`/`replaced_at` linkage passed |
| Cross-tenant document denial | Runtime verified for invoice PDF and supplier document actions |
| Authenticated sales finalization | Runtime verified through target-bound application harness and continuous disposable browser finalization (`cmw5cgyja001xm92u0omxrp7t`, `INV-00001`) |
| PDF storage/retrieval/reprint | Runtime verified; checksum/size, private retrieval, and byte-stable reprint passed |
| QR/barcode decoding | Runtime verified on the persisted application artifact: QR and Code128 decoded |
| Historical reproducibility | Runtime verified after product master-data mutation |
| Failure injection/recovery | Runtime verified for controlled storage upload failure, retry, and repeated generation |
| Financial reconciliation | Verified through browser purchase and sales stock/ledger arithmetic plus focused synthetic valuation regressions; unresolved real-world eligibility remains `PENDING` by policy |
| Browser E2E | Purchase and sales browser mutations verified on the continuous disposable target; duplicate/retry evidence remains outside this closure package |

Static and contract evidence must not be promoted to runtime status. The runtime results above refer to the immutable disposable target `127.0.0.1:55499` / `pharmnos_financial_e2e_invoiceclose`; no production or shared database was used.

The continuous browser session used the disposable local Supabase target only. Purchase reconciliation was: taxable `800.00` + CGST `72.00` + SGST `72.00` = supplier total `944.00`, quantity `10`, supplier ledger credit `944.00`, unresolved valuation `PENDING`. Sales reconciliation was: quantity `2` × sale rate `110.00` = taxable `220.00`, GST `39.60`, total `259.60`, batch available quantity `10 → 8`, customer ledger debit `259.60`. Focused valuation tests separately verified recoverable GST excluded from cost, non-recoverable GST included, partial recovery split, unresolved evidence pending, and append-only correction deltas.
