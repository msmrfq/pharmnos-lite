CREATE TABLE "purchase_supplier_documents" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "purchase_invoice_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "uploaded_by" TEXT NOT NULL,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersedes_id" TEXT,
  "replaced_at" TIMESTAMP(3),
  CONSTRAINT "purchase_supplier_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_supplier_documents_tenant_id_id_key"
  ON "purchase_supplier_documents"("tenant_id", "id");
CREATE INDEX "purchase_supplier_documents_tenant_purchase_uploaded_idx"
  ON "purchase_supplier_documents"("tenant_id", "purchase_invoice_id", "uploaded_at");
CREATE INDEX "purchase_supplier_documents_tenant_supplier_uploaded_idx"
  ON "purchase_supplier_documents"("tenant_id", "supplier_id", "uploaded_at");
CREATE INDEX "purchase_supplier_documents_tenant_supersedes_idx"
  ON "purchase_supplier_documents"("tenant_id", "supersedes_id");

CREATE UNIQUE INDEX "suppliers_tenant_id_id_key"
  ON "suppliers"("tenant_id", "id");

ALTER TABLE "purchase_supplier_documents"
  ADD CONSTRAINT "purchase_supplier_documents_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_supplier_documents_purchase_fkey"
  FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_supplier_documents_supplier_fkey"
  FOREIGN KEY ("tenant_id", "supplier_id") REFERENCES "suppliers"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "purchase_supplier_documents_supersedes_fkey"
  FOREIGN KEY ("tenant_id", "supersedes_id") REFERENCES "purchase_supplier_documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
