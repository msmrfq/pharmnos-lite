# Defect and Root-Cause Register

1. Persisted PDFs previously stopped after the first page. Root cause: a single-page renderer used `break` at the printable boundary. Corrected with page creation, repeated footer/page numbering, and continuation rendering.
2. Persisted PDFs omitted reconciliation and declaration fields. Root cause: renderer drew only basic identity, lines, payable, QR, and barcode. Corrected with totals, round-off, tax, terms, E.&O.E., and signatory output.
3. Supplier upload helper trusted caller-supplied context. Root cause: exported server action helper did not re-resolve the server context. Corrected by revalidating tenant context and permission inside the helper.
4. Supplier documents lacked database RLS and one-active-document enforcement. Corrected with forward-only migration `0020_supplier_document_rls_and_active_guard` and provisioning coverage.
5. Uploaded document MIME metadata was trusted without content signature validation. Corrected with PDF/JPEG/PNG/WebP signature checks before storage.
6. Existing storage buckets were not checked for privacy. Root cause: `ensureBucket` only applied privacy on creation. Corrected by failing closed when an existing bucket's public setting differs from the requested setting.
7. READY PDF artifacts were reused without checksum/size validation. Corrected by validating downloaded bytes against persisted metadata before reuse.
8. Finalized invoice metadata updates were blocked by an over-broad immutability trigger. Corrected so financial/snapshot fields remain immutable while PDF artifact metadata can transition after finalization.
9. Persisted snapshots omitted amount-in-words. Corrected by storing the value during sales finalization.
