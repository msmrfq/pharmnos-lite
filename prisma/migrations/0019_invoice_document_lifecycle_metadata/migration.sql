ALTER TABLE "purchase_invoices"
  ADD COLUMN "pdf_rendering_version" TEXT,
  ADD COLUMN "pdf_byte_size" INTEGER,
  ADD COLUMN "pdf_checksum_sha256" TEXT,
  ADD COLUMN "pdf_error" TEXT;

ALTER TABLE "sales_invoices"
  ADD COLUMN "pdf_rendering_version" TEXT,
  ADD COLUMN "pdf_byte_size" INTEGER,
  ADD COLUMN "pdf_checksum_sha256" TEXT,
  ADD COLUMN "pdf_error" TEXT;
