-- Persist explicit accounting acceptance at purchase-line granularity.
ALTER TABLE "purchase_invoice_items"
  ADD COLUMN "accepted_line_total" DECIMAL(20,4),
  ADD COLUMN "accepted_value_source" TEXT,
  ADD COLUMN "accepted_reason" TEXT,
  ADD COLUMN "accepted_at" TIMESTAMP(3),
  ADD COLUMN "accepted_by_membership_id" TEXT,
  ADD COLUMN "accepted_decision_id" TEXT;

CREATE INDEX "purchase_invoice_items_accepted_decision_idx"
  ON "purchase_invoice_items"("tenant_id", "purchase_id", "accepted_decision_id");

ALTER TABLE "purchase_invoice_items"
  ADD CONSTRAINT "purchase_line_acceptance_actor_fkey"
  FOREIGN KEY ("tenant_id", "accepted_by_membership_id")
  REFERENCES "memberships"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_invoice_items"
  ADD CONSTRAINT "purchase_line_acceptance_decision_fkey"
  FOREIGN KEY ("tenant_id", "purchase_id", "accepted_decision_id")
  REFERENCES "purchase_gst_accounting_decisions"("tenant_id", "purchase_invoice_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
