-- Pharmnos Lite GST sales persistence extension.
-- Provisioning only: review and execute through the approved SQL Editor workflow.
-- Do not run automatically from application startup.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxDataStatus') THEN
    CREATE TYPE "TaxDataStatus" AS ENUM (
      'UNVERIFIED_DRAFT',
      'COMPLETE',
      'LEGACY_AGGREGATE_ONLY',
      'PARTIAL',
      'UNRESOLVED'
    );
  END IF;
END $$;

ALTER TABLE "sales_invoices"
  ADD COLUMN IF NOT EXISTS "tax_data_status" "TaxDataStatus",
  ADD COLUMN IF NOT EXISTS "place_of_supply_code" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_address_line_1_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_address_line_2_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_city_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_state_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_pincode_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "seller_gstin_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_address_line_1_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_address_line_2_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_city_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_state_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_pincode_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_gstin_snapshot" TEXT;

ALTER TABLE "sales_invoice_items"
  ADD COLUMN IF NOT EXISTS "taxable_amount" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "cgst_amount" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "sgst_amount" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "igst_amount" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "cess_amount" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "product_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "generic_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "hsn_code_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "batch_expiry_snapshot" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "sales_invoices_tenant_id_tax_data_status_idx"
  ON "sales_invoices" ("tenant_id", "tax_data_status");
