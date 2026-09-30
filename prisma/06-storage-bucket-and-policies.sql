-- Pharmnos Lite | 06-storage-bucket-and-policies.sql
-- Supabase Storage provisioning for project lizyjqkckysgvffwcqvb — bucket: pharmnos-documents
--
-- IMPORTANT (2026-09-30 FIX): Supabase SQL Editor sessions do NOT own the `storage.objects` table
-- (owner = internal role `supabase_storage_admin`). Therefore:
--   ❌ DO NOT try to run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` — fails with 42501 must be owner
--   ❌ DO NOT try to run CREATE POLICY / DROP POLICY on storage.objects here — also fails 42501
--
-- DO create the bucket via Storage Dashboard UI (no permission issues). Then add 4 bucket policies via
-- the Storage Dashboard -> Policies tab per-bucket (policy wizard runs as correct role).
--
-- See walkthrough in vault bug report: .obsidian-vault/bugs/supabase-storage-bucket-env-mismatch.md
--
-- What remains safe to paste here (idempotent, no ownership required):
--   (A) Bucket INSERT idempotent guard via DO block (works only if the SQL Editor session can write to
--       storage.buckets; if this also fails 42501, just create the bucket via Storage Dashboard instead — no issues)
--   (B) Post-create verification SELECT (always safe).

DO $$
BEGIN

  -- (A) Idempotent bucket create via storage.buckets INSERT.
  -- If you get 42501 here too, SKIP. Just go to Storage Dashboard UI and click "+ New bucket"
  -- name = pharmnos-documents, Make public = OFF, RLS enabled = ON, file size limit = 50 MB.
  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
    VALUES (
      'pharmnos-documents',
      'pharmnos-documents',
      FALSE,
      52428800,
      ARRAY['application/pdf','image/png','image/jpeg','image/jpg','image/webp','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel'],
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Storage bucket pharmnos-documents: CREATED via INSERT.';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Storage bucket pharmnos-documents: ALREADY EXISTS (idempotent).';
  WHEN insufficient_privilege OR object_not_in_prerequisite_state THEN
    RAISE NOTICE 'Storage bucket pharmnos-documents: Cannot INSERT via SQL Editor due to ownership (42501). Create it via Storage Dashboard UI instead (Storage → + New bucket → pharmnos-documents, private, 50MB, 8 MIME types listed above). This is expected and not an error.';
  END;

END $$;

-- (B) Post-create verification SELECT (safe, read-only). Paste this line alone and run after bucket is created.
-- Expected: 1 row | pharmnos-documents | f | 52428800
SELECT name, public, file_size_limit FROM storage.buckets WHERE name = 'pharmnos-documents';
