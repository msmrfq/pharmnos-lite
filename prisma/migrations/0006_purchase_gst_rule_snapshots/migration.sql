-- Preserve the governed HSN/SAC classification and GST rule used for purchase calculations.
ALTER TABLE "purchase_invoice_items"
  ADD COLUMN "hsn_sac_catalog_id_snapshot" TEXT,
  ADD COLUMN "gst_rule_version_snapshot" TEXT,
  ADD COLUMN "gst_rule_source_reference_snapshot" TEXT;
