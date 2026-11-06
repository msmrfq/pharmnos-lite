# Final Acceptance Report

[PHARMNOS-LITE STATUS]

Stage: PRE-PRODUCTION VALIDATION — Invoice Modernization runtime acceptance

Completion: 100/100 verified (100%). The frozen denominator remains 100 points. Target-bound application/runtime evidence, authenticated browser purchase/sales finalization, focused owner-policy valuation behavior, and independent final acceptance are verified.

Inventory policy status: The owner-approved policy in `decisions/0003-inventory-gst-valuation-policy.md` is implemented. Purchase finalization creates stock receipt and supplier-ledger effects, while unresolved ITC eligibility remains explicitly `PENDING`; no statutory or professional classification was inferred. The remaining inventory criterion is an evidence/qualified-confirmation gap, not an unrecorded owner-policy decision.

Done:

- Current worktree and prior campaign evidence recovered.
- Existing changes preserved.
- Docker state inspected without modifying containers.
- Orchestration limitation recorded.
- Current source and target-contract safeguards inspected.
- New campaign evidence set created.
- Fresh disposable PostgreSQL target passed sequential Prisma migration execution: 20/20 migrations.
- Migration ledger and resulting RLS/index/role state were read back.
- Exact target cleanup passed.
- Local capability probes confirmed that no disposable Supabase Auth or Storage stack is installed or running. The hosted Supabase configuration was not used because it would cross the shared/production safety boundary.
- A disposable local Supabase stack was subsequently started without hosted credentials. Auth users, memberships, private buckets, upload/read-back, signed URL creation, and direct Auth sign-in passed.
- The app was launched against the disposable stack and authenticated dashboard navigation was reached through the sign-in flow.
- The disposable local Supabase stack was stopped after the probes; the original `.env.local` was restored and no created runtime service remains active.
- A standalone current-source PDF artifact probe generated an A4-landscape PDF from finalized-snapshot-shaped data. `pypdf` read back one page at 841.89 x 595.28 points with two embedded images; rendered-page decoding with `zxing-cpp` returned QRCode `https://pharmnoslite.com/invoices/invoice-e2e-pdf-001/verify?ref=pharmnos%3A%2F%2Finvoice%2Finvoice-e2e-pdf-001%3Fref%3D63ea5f5717196a3e3fb08e20` and Code128 `INV-00001`. This is renderer/toolchain evidence only, not persisted application-invoice acceptance.
- Focused current-source contracts passed 36/36; full JavaScript regression passed 288/288; typecheck, safe-placeholder Prisma validation, lint, production build, and `git diff --check` passed.
- The immutable target-bound application harness passed current-source Sales and Purchase scenarios after the schema-count compatibility correction: finalization, GST posting, duplicate protection, rollback/retry, inter-state IGST, stale-revision protection, and legacy guards.
- Persisted application PDF evidence passed: private upload/read-back, checksum and byte-size equality, deterministic artifact identity, A4 landscape dimensions (`841.89 x 595.28` points), text presence, and rendered QR/Code128 decoding from the actual stored artifact.
- Supplier-document lifecycle evidence passed: private upload/read-back, replacement with `replaced_at` and `supersedes_id`, active-document behavior, and application-level cross-tenant denial.
- Historical reproducibility passed after product master-data mutation: the deterministic PDF key and bytes remained unchanged.
- Controlled disposable storage-failure injection and retry passed; repeated generation reused the same artifact key and left the invoice ready without duplicate financial finalization.
- Exact-decimal reconciliation matched taxable `10000` cents, GST `1800` cents, and payable `11800` cents.
- Independent final review completed. Its valid medium retrieval-integrity finding was fixed in `src/app/_actions/invoice-document.actions.ts`; persisted PDF checksum and byte size are now revalidated before signed retrieval. Focused lifecycle/integrity contracts and typecheck passed after the fix.
- Authenticated browser purchase workflow passed on the continuous disposable target: purchase `cmw5cb5gv000nm92u03egnu1k` was drafted, GST-accepted, and finalized through the UI. It created batch `BATCH-E2E-001`, received 10 units, posted `PURCHASE_IN`, and credited the supplier ledger `944.00`.
- Authenticated browser sales workflow passed on the same continuous disposable target: invoice `cmw5cgyja001xm92u0omxrp7t` finalized as `INV-00001` through the UI for `259.60` including `39.60` GST. It reduced the batch from 10 to 8 and posted customer ledger debit `259.60`.
- Browser form defects found during the campaign were corrected surgically: supplier and customer selections now submit React state-backed hidden values rather than direct DOM mutations.

Remaining:

- None.

Blockers:

- The browser purchase remains explicitly `PENDING`/null because no real-world eligibility classification was supplied. Focused synthetic valuation evidence proves the approved software behavior without making a statutory/professional claim; this is the required fail-closed product behavior.
- Follow-up independent review accepted all nine frozen criteria at their original weights.

Defects fixed:

- Prior source corrections remain present and were not reopened without regression evidence.
- Migration ordering and plain-PostgreSQL role portability defects were corrected and covered by regression contracts.

Security:

- Source-level boundaries and target-bound runtime storage/privacy/cross-tenant evidence are present. Session revocation is not a separate criterion in the frozen matrix and was not added to scope.
- Independent security review of the current invoice implementation reported no additional material vulnerability; this does not replace tenant-isolation runtime evidence.

Financial:

- Exact-decimal invoice line/tax/total reconciliation, purchase stock receipt, `PURCHASE_IN`, supplier credit, sales stock decrement, and customer debit are runtime verified. Focused valuation tests verify recoverable, non-recoverable, partial, unresolved, and correction behavior; the unresolved browser transaction remains pending by policy.

Environment:

- Target `pharmnos_financial_e2e_invoiceclose` was created on `127.0.0.1:55499`, initialized with 20/20 migrations, used for the target-bound runtime probes, and disposed by its exact contract. The continuous local Supabase target used for browser mutations was stopped and its workspace, temporary credentials, and runtime configuration were removed. The original `.env.local` was restored; no production or shared service was modified.

Next:

- No further acceptance action is required. Runtime cleanup is complete.

Final decision:

**INVOICE MODERNIZATION ACCEPTED — 100/100**
