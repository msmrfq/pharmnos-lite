-- Additive purchase line GST layers. Supplier-declared evidence remains in
-- purchase_gst_line_evidence; these columns hold calculated and accepted facts.
ALTER TABLE "purchase_invoice_items"
  ADD COLUMN "hsn_code_snapshot" TEXT,
  ADD COLUMN "calculated_taxable_value" DECIMAL(20,4),
  ADD COLUMN "calculated_cgst" DECIMAL(20,4),
  ADD COLUMN "calculated_sgst" DECIMAL(20,4),
  ADD COLUMN "calculated_igst" DECIMAL(20,4),
  ADD COLUMN "calculated_cess" DECIMAL(20,4),
  ADD COLUMN "accepted_taxable_value" DECIMAL(20,4),
  ADD COLUMN "accepted_cgst" DECIMAL(20,4),
  ADD COLUMN "accepted_sgst" DECIMAL(20,4),
  ADD COLUMN "accepted_igst" DECIMAL(20,4),
  ADD COLUMN "accepted_cess" DECIMAL(20,4),
  ADD COLUMN "gst_acceptance_status" TEXT NOT NULL DEFAULT 'NOT_ACCEPTED',
  ADD COLUMN "gst_discrepancy_details" JSONB,
  ADD COLUMN "gst_calculation_reference" TEXT,
  ADD COLUMN "gst_acceptance_reference" TEXT;
