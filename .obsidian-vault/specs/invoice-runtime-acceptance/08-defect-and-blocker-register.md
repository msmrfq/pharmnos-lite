# Defect and Blocker Register

## Resolved source defects

- Finalized invoice immutability previously blocked PDF lifecycle metadata updates; the trigger was narrowed to protect financial/snapshot fields.
- Amount-in-words was absent from finalized snapshots; persistence was added.
- READY PDF reuse now validates checksum and byte size.
- Existing storage bucket privacy drift now fails closed.
- Supplier-document authorization, content signatures, RLS, and active-document uniqueness were hardened.
- Migration `0018` now creates supplier composite uniqueness before its composite foreign key.
- Migration `0020` now creates a no-login `authenticated` role only when absent, preserving the RLS policy while supporting plain disposable PostgreSQL.

## Remaining blockers

1. **Infrastructure/authentication:** resolved for disposable runtime. Supabase CLI v3.0.0 was run ephemerally, local Auth was started, and two disposable identities/memberships were provisioned.
2. **Private storage:** resolved for disposable runtime baseline. Local private buckets were created and upload/read-back/signed URL behavior passed. Application-level tenant-denial evidence remains tied to completing the authenticated invoice workflow.
3. **Browser E2E:** local authenticated sign-in and dashboard navigation passed; authenticated invoice mutation and document lifecycle execution remain unverified.
4. **Migration:** resolved. The fresh disposable target applied and recorded 20/20 Prisma migrations with ledger read-back; no migration blocker remains for this campaign.
5. **Runtime evidence:** no current-source authenticated invoice mutation, persisted PDF artifact, recovery, or reconciliation evidence exists. A standalone current-source renderer probe and decoder toolchain check passed, but does not establish application persistence or authorization.
6. **Independent acceptance:** technical and financial acceptance remain rejected; security acceptance is limited to source review and residual operational risks.

The migration blockers and disposable Auth/Storage capability blockers are resolved for the local campaign. Remaining gaps are application-path evidence gaps, not missing infrastructure. The local stack is disposable and does not establish production Supabase acceptance.
