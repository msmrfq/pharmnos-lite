-- 0014 physical returns and return links
-- CreateTable
CREATE TABLE "physical_returns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT,
    "source_class" TEXT NOT NULL,
    "source_document_id" TEXT,
    "source_line_id" TEXT,
    "product_id" TEXT,
    "batch_id" TEXT,
    "requested_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "accepted_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "inspection_outcome" TEXT,
    "valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidence" JSONB,
    "created_by_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_returns_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "physical_return_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "physical_return_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "accepted_quantity" DECIMAL(20,4),
    "evidence" JSONB,
    "actor_membership_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_return_events_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "gst_adjustment_note_return_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "physical_return_id" TEXT NOT NULL,
    "stock_movement_id" TEXT,
    "accepted_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "valuation_policy_version" TEXT,
    "posting_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_return_links_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "physical_returns_tenant_id_note_id_status_idx" ON "physical_returns"("tenant_id", "note_id", "status");
-- CreateIndex
CREATE INDEX "physical_returns_tenant_id_source_document_id_source_line_i_idx" ON "physical_returns"("tenant_id", "source_document_id", "source_line_id");
-- CreateIndex
CREATE UNIQUE INDEX "physical_returns_tenant_id_id_key" ON "physical_returns"("tenant_id", "id");
-- CreateIndex
CREATE INDEX "physical_return_events_tenant_id_physical_return_id_created_idx" ON "physical_return_events"("tenant_id", "physical_return_id", "created_at");
-- CreateIndex
CREATE UNIQUE INDEX "physical_return_events_tenant_id_id_key" ON "physical_return_events"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "physical_return_events_tenant_id_physical_return_id_sequenc_key" ON "physical_return_events"("tenant_id", "physical_return_id", "sequence_no");
-- CreateIndex
CREATE INDEX "gst_adjustment_note_return_links_tenant_id_physical_return__idx" ON "gst_adjustment_note_return_links"("tenant_id", "physical_return_id", "posting_status");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_return_links_tenant_id_id_key" ON "gst_adjustment_note_return_links"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_return_links_tenant_id_note_id_physical_key" ON "gst_adjustment_note_return_links"("tenant_id", "note_id", "physical_return_id");
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
ALTER TABLE "physical_returns" ADD CONSTRAINT "physical_returns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "physical_returns" ADD CONSTRAINT "physical_returns_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "physical_return_events" ADD CONSTRAINT "physical_return_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "physical_return_events" ADD CONSTRAINT "physical_return_events_tenant_id_physical_return_id_fkey" FOREIGN KEY ("tenant_id", "physical_return_id") REFERENCES "physical_returns"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "physical_return_events" ADD CONSTRAINT "physical_return_events_tenant_id_actor_membership_id_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_physical_return_fkey" FOREIGN KEY ("tenant_id", "physical_return_id") REFERENCES "physical_returns"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_return_links" ADD CONSTRAINT "gst_adjustment_note_return_links_tenant_id_stock_movement__fkey" FOREIGN KEY ("tenant_id", "stock_movement_id") REFERENCES "stock_movements"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "physical_returns"
  ADD CONSTRAINT "physical_returns_quantities_nonnegative_check"
    CHECK ("requested_quantity" >= 0 AND "accepted_quantity" >= 0 AND
      "accepted_quantity" <= "requested_quantity");
