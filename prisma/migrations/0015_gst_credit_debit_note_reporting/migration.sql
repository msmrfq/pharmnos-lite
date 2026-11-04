-- 0015 reporting and IRP evidence attempts
-- CreateTable
CREATE TABLE "gst_adjustment_note_reporting_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MANUAL_EVIDENCE',
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reporting_period" TEXT NOT NULL,
    "original_reference" TEXT,
    "external_reference" TEXT,
    "filing_date" TIMESTAMP(3),
    "evidence_source" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "response" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_reporting_attempts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "gst_adjustment_note_irp_attempts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "applicability" TEXT NOT NULL,
    "rule_version" TEXT,
    "document_type" TEXT,
    "endpoint" TEXT,
    "attempt_no" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "irn" TEXT,
    "acknowledgement" JSONB,
    "cancellation_state" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_irp_attempts_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_note_id_st_idx" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "note_id", "status");
-- CreateIndex
CREATE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_reporting__idx" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "reporting_period", "category");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_id_key" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_reporting_attempts_tenant_id_note_id_pr_key" ON "gst_adjustment_note_reporting_attempts"("tenant_id", "note_id", "provider", "payload_hash");
-- CreateIndex
CREATE INDEX "gst_adjustment_note_irp_attempts_tenant_id_note_id_status_idx" ON "gst_adjustment_note_irp_attempts"("tenant_id", "note_id", "status");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_irp_attempts_tenant_id_id_key" ON "gst_adjustment_note_irp_attempts"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_irp_attempts_tenant_id_note_id_payload__key" ON "gst_adjustment_note_irp_attempts"("tenant_id", "note_id", "payload_hash");
-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_id_key" ON "products"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_id_key" ON "customers"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_id_key" ON "suppliers"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_items_tenant_id_invoice_id_id_key" ON "sales_invoice_items"("tenant_id", "invoice_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_items_tenant_id_id_key" ON "sales_invoice_items"("tenant_id", "id");
-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_note_event_id_idx" ON "audit_logs"("tenant_id", "note_event_id");
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_reporting_attempts" ADD CONSTRAINT "gst_adjustment_note_reporting_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_reporting_attempts" ADD CONSTRAINT "gst_adjustment_note_reporting_attempts_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_irp_attempts" ADD CONSTRAINT "gst_adjustment_note_irp_attempts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_irp_attempts" ADD CONSTRAINT "gst_adjustment_note_irp_attempts_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
