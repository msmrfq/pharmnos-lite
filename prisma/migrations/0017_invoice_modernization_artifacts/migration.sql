ALTER TABLE "sales_invoices"
  ADD COLUMN "finalized_snapshot" JSONB,
  ADD COLUMN "finalized_snapshot_hash" TEXT,
  ADD COLUMN "rendering_version" TEXT,
  ADD COLUMN "pdf_artifact_key" TEXT,
  ADD COLUMN "pdf_generation_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "pdf_generated_at" TIMESTAMP(3);

ALTER TABLE "purchase_invoices"
  ADD COLUMN "finalized_snapshot" JSONB,
  ADD COLUMN "finalized_snapshot_hash" TEXT,
  ADD COLUMN "rendering_version" TEXT,
  ADD COLUMN "pdf_artifact_key" TEXT,
  ADD COLUMN "pdf_generation_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "pdf_generated_at" TIMESTAMP(3);
