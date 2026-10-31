-- Additive governance controls for classification and rate approval history.
ALTER TYPE "PermissionAction" ADD VALUE IF NOT EXISTS 'approve_hsn_catalog';

ALTER TABLE "hsn_sac_catalog"
  ADD COLUMN "classification_type" TEXT,
  ADD COLUMN "classification_metadata" JSONB,
  ADD COLUMN "classification_approved_by_membership_id" TEXT,
  ADD COLUMN "classification_approved_at" TIMESTAMP(3);

ALTER TABLE "gst_rate_rules"
  ADD COLUMN "approved_at" TIMESTAMP(3);

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_tenant_id_id_key" UNIQUE ("tenant_id", "id");

CREATE TABLE "gst_rate_rule_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "rule_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "actor_membership_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gst_rate_rule_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gst_rate_rule_history_tenant_id_rule_id_created_at_idx"
  ON "gst_rate_rule_history"("tenant_id", "rule_id", "created_at");

ALTER TABLE "gst_rate_rule_history"
  ADD CONSTRAINT "gst_rate_rule_history_tenant_id_rule_id_fkey"
  FOREIGN KEY ("tenant_id", "rule_id")
  REFERENCES "gst_rate_rules"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
