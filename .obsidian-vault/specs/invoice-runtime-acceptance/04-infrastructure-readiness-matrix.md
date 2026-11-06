# Infrastructure Readiness Matrix

| Dependency | Required probe | Status |
|---|---|---|
| PostgreSQL | Live isolated target and identity read-back | Passed on disposable target; cleaned up |
| Sequential migrations | Migrations 0017–0020 and ledger | Passed: 20/20 migrations and ledger read-back |
| Authentication | Disposable authenticated sessions | Passed on local Supabase stack; two disposable users created and direct password sign-in verified |
| Tenant isolation | Authenticated cross-tenant denial | Passed through target-bound application actions for invoice and supplier documents |
| Private storage | Upload/read-back/replacement/denial | Passed for private bucket creation, upload, read-back, and signed URL on local Supabase |
| Browser E2E | Authenticated purchase and sales workflow | Partial: target-bound action harness passed; browser mutation workflow remains unverified |
| PDF | Persisted artifact read-back | Passed for actual application artifact: private read-back, checksum/size, A4 landscape, and text presence |
| QR/barcode | Decode actual persisted PDF | Passed on the actual stored application artifact: QRCode and Code128 decoded |
| Fault injection | Recovery and idempotency | Passed for controlled storage upload failure, retry, and repeated generation |
| Evidence collection | Current campaign records | Passed for infrastructure/migration checkpoint |

The infrastructure baseline is complete. Invoice modernization remains not accepted until browser mutation, full inventory/ledger reconciliation, and complete independent acceptance are evidenced.

Capability probe evidence:

- Supabase CLI v3.0.0 was run ephemerally with `npx`; no package or manifest change was made.
- A disposable local Supabase stack was started in `C:\Users\Public\pharmnos-supabase-disposable`; Auth, Storage, and Postgres health checks passed.
- Prisma migrations **20/20** were applied to the local Supabase Postgres instance.
- Two disposable Auth users, two tenants, memberships, private buckets, upload/read-back, and signed URL creation were verified.
- Existing authentication contract coverage remains **2/2**; this is additional local runtime evidence, not production acceptance.
- Standalone PDF toolchain probe: `pypdf` read one A4-landscape page and `zxing-cpp` decoded the rendered QRCode and Code128 values. No temporary PDF or rendered image was retained.
- The target-bound application artifact was separately read back and decoded: A4 landscape `841.89 x 595.28` points, QRCode and Code128 present, with persisted checksum and byte-size equality.
