ALTER TABLE "product_batches"
  ADD COLUMN "inventory_acquisition_cost" DECIMAL(20,4),
  ADD COLUMN "inventory_valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "inventory_valuation_policy_version" TEXT;

ALTER TABLE "purchase_invoice_items"
  ADD COLUMN "recoverable_itc" DECIMAL(20,4),
  ADD COLUMN "non_recoverable_gst" DECIMAL(20,4),
  ADD COLUMN "inventory_acquisition_cost" DECIMAL(20,4),
  ADD COLUMN "inventory_valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "inventory_valuation_policy_version" TEXT;

ALTER TABLE "stock_movements"
  ADD COLUMN "inventory_acquisition_cost" DECIMAL(20,4),
  ADD COLUMN "inventory_valuation_status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "inventory_valuation_policy_version" TEXT;
