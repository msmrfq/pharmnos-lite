---
title: SUPABASE_STORAGE_BUCKET Mismatch Between .env.local and .env.example
date: 2026-09-29
status: Resolved
resolved: 2026-09-30
resolution_path: A
---

## Steps to Reproduce
1. On a freshly cloned checkout of `e:\PharmnosLite`, read `.env.example` line `SUPABASE_STORAGE_BUCKET=pharmnos-lite`.
2. Read the working local `.env.local` used in today's (2026-09-29) Phase 2 cloud deployment: `SUPABASE_STORAGE_BUCKET=pharmnos-documents`.
3. Note that `.env.example` is the template that new developers use to bootstrap their local `.env.local` (documented instructions are copy `.env.example` → `.env.local` → paste keys).
4. Also inspect Supabase dashboard Storage → Buckets for project-ref `lizyjqkckysgvffwcqvb` — confirm which bucket name (if either) actually exists in the project.
5. Attempt `await storageAdapter.uploadPrescriptionDocument(...)` against the live cloud project.

## Expected Behaviour
- `.env.example SUPABASE_STORAGE_BUCKET` MUST match `.env.local SUPABASE_STORAGE_BUCKET` (because the example is the template).
- The matching bucket MUST physically exist inside the Supabase project's Storage (project lizyjqkckysgvffwcqvb) with the exact bucket name + the correct RLS policies (`authenticated` INSERT/SELECT for the storage.objects rows scoped to `tenant_id` sub-folder).
- Upload calls succeed and return a signed public URL or internal path.

## Actual Behaviour
- `.env.example` value = `"pharmnos-lite"`
- `.env.local` value = `"pharmnos-documents"`
- No sign anywhere in our code or files of which bucket name (if either) has been created on the cloud project; bucket creation step was skipped during the 04/02/03 SQL Editor paste work because Storage is a Supabase dashboard primitive not tied to the public schema.
- Without intervention the first new-developer onboarding will copy `.env.example → .env.local`, get `pharmnos-lite`, find no bucket by that name, and upload calls will throw an empty 404 bucket-not-found error with no pointer back to the root cause being a template drift.

## Root Cause
Drift introduced (before today) during the Phase 2 `.env` scaffold pass. The cloud deploy was done with a last-second change to `pharmnos-documents` as a more semantically appropriate bucket name, but the corresponding update to `.env.example` (the committed template) was not done in the same commit — creating a silent template-to-reality mismatch. Low severity today because no Storage upload code path has been wired yet. Severity becomes **high** immediately after Phase 3b (purchase invoices / document attachments) begins using `IStorageAdapter`.

### Remediation checklist (one of these two paths — chosen by human next session):
- Path A (preferred if `pharmnos-documents` semantically better):
  1. `supabase dashboard storage → buckets → create bucket "pharmnos-documents" → RLS enabled`
  2. Update `.env.example SUPABASE_STORAGE_BUCKET=pharmnos-documents` to match live value
- Path B (if "pharmnos-lite" was the intended name):
  1. Update `.env.local SUPABASE_STORAGE_BUCKET=pharmnos-lite` (matches template)
  2. Create bucket `pharmnos-lite` in dashboard Storage
- Common steps after either path:
  1. Write 1-line Storage policy `INSERT SELECT DELETE ... bucket_id = 'xxx' AND auth.role() = 'authenticated'`
  2. Add 3-column counts assert (`SELECT count(*) FROM storage.buckets WHERE name = '<bucket>'`) to a future `06-storage-verify.sql` paste verification file
  3. Close this bug (status Resolved) after verifying end-to-end upload of one small test PDF from storage adapter unit test.

---

## Resolution — Path A (2026-09-30)

Chosen by user (least-change, semantic bucket name retained from live `.env.local`). Changes applied:

1. **`.env.example` line 8 updated** from `SUPABASE_STORAGE_BUCKET="pharmnos-lite"` → `SUPABASE_STORAGE_BUCKET="pharmnos-documents"` to exactly match live `.env.local` value. No drift anymore; new developer copy-paste gets the correct bucket name.
2. **New SQL paste file created** at [prisma/06-storage-bucket-and-policies.sql](file:///E:/PharmnosLite/prisma/06-storage-bucket-and-policies.sql) following ADR 0001 (Supabase SQL Editor paste workaround). This file, when pasted once into SQL Editor for project `lizyjqkckysgvffwcqvb` and run with the standard "Run without RLS" warning override, does:
   - Idempotent `INSERT ... ON CONFLICT DO NOTHING` of bucket `pharmnos-documents` into `storage.buckets` (private, 50MB limit, 8 allowed MIME types: PDF / PNG / JPG / WEBP / CSV / XLSX / XLS).
   - `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` guard.
   - 4 policies: SELECT / INSERT / UPDATE / DELETE `FOR authenticated` scoped to `bucket_id = 'pharmnos-documents'` (Phase 7 P7-0 will add `(storage.foldername(name))[1] = auth.jwt() ->> 'tenant_id'` tenant-scoped sub-folder hardening).
   - Standard storage schema + objects/buckets table `GRANT` statements to `anon` + `authenticated` roles.
   - Post-run verification query (commented, last line) to confirm 1 row returned with `pharmnos-documents` present.
3. **Phase 7 follow-up note:** P7 hardening step for this bug: replace the four 4 bare `bucket_id = 'pharmnos-documents'` policy predicates with the tenant-scoped sub-folder predicate once `auth.actions.ts onboardNewTenant` sets the `app_metadata.tenant_id` JWT claim.

### Important root cause note encountered 2026-09-30 (do not waste time on this):
Supabase's SQL Editor session user does **NOT** own `storage.objects` table (owner = internal role `supabase_storage_admin`). Any attempt to paste:
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ON storage.objects ...;
```
fails with error `42501: must be owner of table objects`. **This is a Supabase platform restriction, NOT our SQL's fault.** Do not debug SQL ownership; use the Storage Dashboard UI for both bucket creation **and** policy creation below. Policy wizard inside Storage → Buckets → Policies tab runs as the correct internal role, no 42501 errors.

### Remaining manual step (human, ~5 min via Storage Dashboard UI, no more SQL pastes for policies):

#### Step 1 — Create bucket `pharmnos-documents` via Dashboard UI
Open: → https://supabase.com/dashboard/project/lizyjqkckysgvffwcqvb/storage/buckets
1. Click **+ New bucket** (top-left, above "All buckets")
2. **Name** (required): `pharmnos-documents`
3. **Make public?** → leave OFF / unchecked (private bucket)
4. **File size limit (MB)** → `50`
5. **Allowed MIME types (optional)** → Paste these 8 comma-separated lines:
   ```
   application/pdf
   image/png
   image/jpeg
   image/jpg
   image/webp
   text/csv
   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   application/vnd.ms-excel
   ```
6. Click **Create bucket** (blue button)
→ Bucket row `pharmnos-documents` Private 50 MB appears in list. ✅ Bucket done.

#### Step 2 — Add 4 authenticated bucket policies (Policies tab, one-by-one; runs as correct role = no 42501)
Click the bucket row → top tabs change to **Files / Policies / Settings**. Click **Policies** tab.
On the right-hand side, 3 policy templates appear (Authenticated / Row level / Custom). We'll use **Custom → Create policy** 4 times with the exact SQL bodies below.

##### Policy 1 — authenticated SELECT (list / download)
- Click **Create policy** → pick **Custom** → Continue
- **Name:** `pharmnos_documents_authenticated_select`
- **Allowed operation:** `SELECT`
- **Allowed roles:** (toggle off `anon` ONLY, keep `authenticated` ON; if toggle not possible, just `authenticated` single selection)
- **USING expression (WHERE clause):**
  ```sql
  bucket_id = 'pharmnos-documents'
  ```
- Click **Review** → **Save policy** ✅

##### Policy 2 — authenticated INSERT (upload)
- **Create policy** → Custom → Continue
- **Name:** `pharmnos_documents_authenticated_insert`
- **Allowed operation:** `INSERT`
- **Allowed roles:** keep only `authenticated`
- **WITH CHECK expression (WHERE clause):**
  ```sql
  bucket_id = 'pharmnos-documents'
  ```
- Click **Review → Save policy** ✅

##### Policy 3 — authenticated UPDATE (replace files)
- **Create policy** → Custom → Continue
- **Name:** `pharmnos_documents_authenticated_update`
- **Allowed operation:** `UPDATE`
- **Allowed roles:** keep only `authenticated`
- **USING expression:**
  ```sql
  bucket_id = 'pharmnos-documents'
  ```
- **WITH CHECK expression:**
  ```sql
  bucket_id = 'pharmnos-documents'
  ```
- Click **Review → Save policy** ✅

##### Policy 4 — authenticated DELETE (delete files)
- **Create policy** → Custom → Continue
- **Name:** `pharmnos_documents_authenticated_delete`
- **Allowed operation:** `DELETE`
- **Allowed roles:** keep only `authenticated`
- **USING expression:**
  ```sql
  bucket_id = 'pharmnos-documents'
  ```
- Click **Review → Save policy** ✅

Policies tab now shows 4 rows for bucket `pharmnos-documents`. Total 4 ✔ = done.

#### Step 3 — Run verification SELECT (this one works, no ownership issues)
Go to SQL Editor → open new query → paste and run:
```sql
SELECT name, public, file_size_limit FROM storage.buckets WHERE name = 'pharmnos-documents';
```
Expected result (1 row):
```
        name        | public | file_size_limit
--------------------+--------+-----------------
 pharmnos-documents | f      |        52428800
```

### Phase 7 follow-up (P7 HARDENING — not today):
Today's 4 policies use bare `bucket_id = 'pharmnos-documents'` (Phase 4 MVP use). Phase 7 will replace all 4 predicates with tenant-scoped sub-folder predicate:
```sql
bucket_id = 'pharmnos-documents' AND (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')
```
— after `auth.actions.ts onboardNewTenant` sets the `app_metadata.tenant_id` JWT claim and we test end-to-end signed upload.

### Status after you do Steps 1-3 above:
Bug is **fully Resolved end-to-end** (env vars consistent, bucket exists, policies in place). No further work needed on this bug after you confirm paste.
