-- Persist governed classification and GST-rule facts on finalized sales lines.
ALTER TABLE "sales_invoice_items"
  ADD COLUMN "hsn_sac_catalog_id_snapshot" TEXT,
  ADD COLUMN "gst_rule_version_snapshot" TEXT,
  ADD COLUMN "gst_rule_source_reference_snapshot" TEXT;
