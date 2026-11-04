-- 0013 reviews and recipient ITC
-- CreateTable
CREATE TABLE "gst_adjustment_note_output_tax_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "legal_basis" TEXT,
    "deadline" TIMESTAMP(3),
    "incidence_passed" BOOLEAN,
    "itc_availed_status" TEXT,
    "declaration_status" TEXT,
    "evidence" JSONB,
    "decision_reason" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_output_tax_reviews_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "gst_adjustment_note_itc_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "revision_state" TEXT NOT NULL DEFAULT 'CURRENT',
    "progress_state" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "eligibility_state" TEXT NOT NULL DEFAULT 'NOT_ASSESSED',
    "outcome_state" TEXT NOT NULL DEFAULT 'PENDING',
    "legal_state" TEXT NOT NULL DEFAULT 'LEGAL_CONFIRMATION_PENDING',
    "supersedes_review_id" TEXT,
    "evidence" JSONB,
    "decision_reason" TEXT,
    "reviewed_by_membership_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_itc_reviews_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "gst_adjustment_note_itc_allocations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "itc_review_id" TEXT NOT NULL,
    "source_document_id" TEXT NOT NULL,
    "purchase_invoice_id" TEXT NOT NULL,
    "purchase_invoice_item_id" TEXT NOT NULL,
    "tax_head" TEXT NOT NULL,
    "amount_availed" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "amount_reversed" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "amount_claimed" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "outcome_state" TEXT NOT NULL,
    "evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_adjustment_note_itc_allocations_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "gst_adjustment_note_output_tax_reviews_tenant_id_note_id_st_idx" ON "gst_adjustment_note_output_tax_reviews"("tenant_id", "note_id", "status");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_output_tax_reviews_tenant_id_id_key" ON "gst_adjustment_note_output_tax_reviews"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_output_tax_reviews_tenant_id_note_id_re_key" ON "gst_adjustment_note_output_tax_reviews"("tenant_id", "note_id", "revision_no");
-- CreateIndex
CREATE INDEX "gst_adjustment_note_itc_reviews_tenant_id_note_id_revision__idx" ON "gst_adjustment_note_itc_reviews"("tenant_id", "note_id", "revision_state");
-- CreateIndex
CREATE INDEX "gst_adjustment_note_itc_reviews_tenant_id_outcome_state_idx" ON "gst_adjustment_note_itc_reviews"("tenant_id", "outcome_state");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_reviews_tenant_id_id_key" ON "gst_adjustment_note_itc_reviews"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_reviews_tenant_id_note_id_revision__key" ON "gst_adjustment_note_itc_reviews"("tenant_id", "note_id", "revision_no");
-- CreateIndex
CREATE INDEX "gst_adjustment_note_itc_allocations_tenant_id_source_docume_idx" ON "gst_adjustment_note_itc_allocations"("tenant_id", "source_document_id", "purchase_invoice_item_id", "tax_head");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_allocations_tenant_id_id_key" ON "gst_adjustment_note_itc_allocations"("tenant_id", "id");
-- CreateIndex
CREATE UNIQUE INDEX "gst_adjustment_note_itc_allocations_tenant_id_itc_review_id_key" ON "gst_adjustment_note_itc_allocations"("tenant_id", "itc_review_id", "source_document_id", "purchase_invoice_item_id", "tax_head");
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
ALTER TABLE "gst_adjustment_note_output_tax_reviews" ADD CONSTRAINT "gst_adjustment_note_output_tax_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_output_tax_reviews" ADD CONSTRAINT "gst_adjustment_note_output_tax_reviews_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_output_tax_reviews" ADD CONSTRAINT "gst_adjustment_note_output_tax_reviews_tenant_id_reviewed__fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_note_id_fkey" FOREIGN KEY ("tenant_id", "note_id") REFERENCES "gst_adjustment_notes"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_reviewed_by_memb_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_reviews" ADD CONSTRAINT "gst_adjustment_note_itc_reviews_tenant_id_supersedes_revie_fkey" FOREIGN KEY ("tenant_id", "supersedes_review_id") REFERENCES "gst_adjustment_note_itc_reviews"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_itc_review_i_fkey" FOREIGN KEY ("tenant_id", "itc_review_id") REFERENCES "gst_adjustment_note_itc_reviews"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_source_docum_fkey" FOREIGN KEY ("tenant_id", "source_document_id") REFERENCES "gst_adjustment_note_source_documents"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "gst_adjustment_note_itc_allocations" ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tenant_id_purchase_inv_fkey" FOREIGN KEY ("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id") REFERENCES "purchase_invoice_items"("tenant_id", "purchase_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gst_adjustment_note_itc_allocations"
  ADD CONSTRAINT "gst_adjustment_note_itc_allocations_amounts_nonnegative_check"
    CHECK ("amount_availed" >= 0 AND "amount_reversed" >= 0 AND "amount_claimed" >= 0),
  ADD CONSTRAINT "gst_adjustment_note_itc_allocations_tax_head_check"
    CHECK ("tax_head" IN ('CGST', 'SGST', 'UTGST', 'IGST', 'CESS'));
CREATE OR REPLACE FUNCTION "allow_gst_note_itc_review_supersession"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.revision_state = 'CURRENT'
     AND NEW.revision_state = 'SUPERSEDED'
     AND NEW.tenant_id = OLD.tenant_id
     AND NEW.id = OLD.id
     AND NEW.note_id = OLD.note_id
     AND NEW.revision_no = OLD.revision_no
     AND NEW.progress_state = OLD.progress_state
     AND NEW.eligibility_state = OLD.eligibility_state
     AND NEW.outcome_state = OLD.outcome_state
     AND NEW.legal_state = OLD.legal_state
     AND NEW.supersedes_review_id IS NOT DISTINCT FROM OLD.supersedes_review_id
     AND NEW.evidence IS NOT DISTINCT FROM OLD.evidence
     AND NEW.decision_reason IS NOT DISTINCT FROM OLD.decision_reason
     AND NEW.reviewed_by_membership_id IS NOT DISTINCT FROM OLD.reviewed_by_membership_id
     AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at
     AND NEW.created_at = OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'GST note ITC review history is append-only: % is not allowed', TG_OP;
END;
$$;
CREATE OR REPLACE FUNCTION "allow_gst_note_itc_review_supersession"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.revision_state = 'CURRENT'
     AND NEW.revision_state = 'SUPERSEDED'
     AND NEW.tenant_id = OLD.tenant_id
     AND NEW.id = OLD.id
     AND NEW.note_id = OLD.note_id
     AND NEW.revision_no = OLD.revision_no
     AND NEW.progress_state = OLD.progress_state
     AND NEW.eligibility_state = OLD.eligibility_state
     AND NEW.outcome_state = OLD.outcome_state
     AND NEW.legal_state = OLD.legal_state
     AND NEW.supersedes_review_id IS NOT DISTINCT FROM OLD.supersedes_review_id
     AND NEW.evidence IS NOT DISTINCT FROM OLD.evidence
     AND NEW.decision_reason IS NOT DISTINCT FROM OLD.decision_reason
     AND NEW.reviewed_by_membership_id IS NOT DISTINCT FROM OLD.reviewed_by_membership_id
     AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at
     AND NEW.created_at = OLD.created_at
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'GST note ITC review history is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER "gst_adjustment_note_itc_reviews_supersession"
  BEFORE UPDATE OR DELETE ON "gst_adjustment_note_itc_reviews"
  FOR EACH ROW EXECUTE FUNCTION "allow_gst_note_itc_review_supersession"();
CREATE TRIGGER "gst_adjustment_note_itc_allocations_immutable"
  BEFORE UPDATE OR DELETE ON "gst_adjustment_note_itc_allocations"
  FOR EACH ROW EXECUTE FUNCTION "reject_gst_note_history_mutation"();
