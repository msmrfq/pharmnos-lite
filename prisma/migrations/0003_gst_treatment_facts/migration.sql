-- Additive transaction-time GST classification facts.
ALTER TABLE "purchase_invoices"
  ADD COLUMN "gst_treatment" TEXT,
  ADD COLUMN "tax_mode" TEXT DEFAULT 'EXCLUSIVE';

ALTER TABLE "sales_invoices"
  ADD COLUMN "gst_treatment" TEXT,
  ADD COLUMN "tax_mode" TEXT DEFAULT 'EXCLUSIVE';
