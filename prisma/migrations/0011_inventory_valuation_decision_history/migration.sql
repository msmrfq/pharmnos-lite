CREATE TYPE "InventoryValuationDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'REVERSED');
CREATE TYPE "InventoryValuationAccountingStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING_POLICY', 'POSTED', 'REVERSED');
CREATE TYPE "InventoryValuationAdjustmentKind" AS ENUM ('CORRECTION', 'REVERSAL');

ALTER TABLE "product_batches"
  ADD CONSTRAINT "product_batches_tenant_id_id_key" UNIQUE ("tenant_id", "id");

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_tenant_id_id_key" UNIQUE ("tenant_id", "id");

CREATE TABLE "inventory_valuation_decisions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "purchase_invoice_id" TEXT NOT NULL,
  "purchase_invoice_item_id" TEXT NOT NULL,
  "product_batch_id" TEXT NOT NULL,
  "stock_movement_id" TEXT,
  "status" "InventoryValuationDecisionStatus" NOT NULL DEFAULT 'PENDING',
  "accounting_status" "InventoryValuationAccountingStatus" NOT NULL DEFAULT 'PENDING_POLICY',
  "eligibility_status" TEXT NOT NULL,
  "accepted_taxable_value" DECIMAL(20,4) NOT NULL,
  "accepted_gst" DECIMAL(20,4) NOT NULL,
  "recoverable_itc" DECIMAL(20,4),
  "non_recoverable_gst" DECIMAL(20,4),
  "direct_acquisition_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "inventory_acquisition_cost" DECIMAL(20,4),
  "policy_version" TEXT NOT NULL,
  "decision_reference" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_payload_hash" TEXT NOT NULL,
  "supersedes_decision_id" TEXT,
  "decided_by_membership_id" TEXT NOT NULL,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_valuation_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_valuation_adjustments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "prior_decision_id" TEXT NOT NULL,
  "resulting_decision_id" TEXT NOT NULL,
  "adjustment_kind" "InventoryValuationAdjustmentKind" NOT NULL,
  "recoverable_itc_delta" DECIMAL(20,4) NOT NULL,
  "non_recoverable_gst_delta" DECIMAL(20,4) NOT NULL,
  "inventory_cost_delta" DECIMAL(20,4) NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_payload_hash" TEXT NOT NULL,
  "adjusted_by_membership_id" TEXT NOT NULL,
  "adjusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_valuation_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_valuation_decision_tenant_idempotency_key"
  ON "inventory_valuation_decisions"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "inventory_valuation_adjustment_tenant_idempotency_key"
  ON "inventory_valuation_adjustments"("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "inventory_valuation_decisions_tenant_id_key"
  ON "inventory_valuation_decisions"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_valuation_adjustments_tenant_id_key"
  ON "inventory_valuation_adjustments"("tenant_id", "id");
CREATE INDEX "inventory_valuation_decisions_target_idx"
  ON "inventory_valuation_decisions"("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id");
CREATE INDEX "inventory_valuation_decisions_batch_created_idx"
  ON "inventory_valuation_decisions"("tenant_id", "product_batch_id", "created_at");
CREATE INDEX "inventory_valuation_decisions_status_created_idx"
  ON "inventory_valuation_decisions"("tenant_id", "status", "created_at");
CREATE INDEX "inventory_valuation_adjustments_prior_idx"
  ON "inventory_valuation_adjustments"("tenant_id", "prior_decision_id");
CREATE INDEX "inventory_valuation_adjustments_resulting_idx"
  ON "inventory_valuation_adjustments"("tenant_id", "resulting_decision_id");

ALTER TABLE "inventory_valuation_decisions"
  ADD CONSTRAINT "inventory_valuation_decisions_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_decisions_purchase_fkey"
  FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_decisions_purchase_item_fkey"
  FOREIGN KEY ("tenant_id", "purchase_invoice_id", "purchase_invoice_item_id") REFERENCES "purchase_invoice_items"("tenant_id", "purchase_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_decisions_batch_fkey"
  FOREIGN KEY ("tenant_id", "product_batch_id") REFERENCES "product_batches"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_decisions_movement_fkey"
  FOREIGN KEY ("tenant_id", "stock_movement_id") REFERENCES "stock_movements"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_decisions_actor_fkey"
  FOREIGN KEY ("tenant_id", "decided_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_decisions_supersedes_fkey"
  FOREIGN KEY ("tenant_id", "supersedes_decision_id") REFERENCES "inventory_valuation_decisions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_valuation_adjustments"
  ADD CONSTRAINT "inventory_valuation_adjustments_tenant_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_adjustments_prior_fkey"
  FOREIGN KEY ("tenant_id", "prior_decision_id") REFERENCES "inventory_valuation_decisions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_adjustments_resulting_fkey"
  FOREIGN KEY ("tenant_id", "resulting_decision_id") REFERENCES "inventory_valuation_decisions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inventory_valuation_adjustments_actor_fkey"
  FOREIGN KEY ("tenant_id", "adjusted_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
