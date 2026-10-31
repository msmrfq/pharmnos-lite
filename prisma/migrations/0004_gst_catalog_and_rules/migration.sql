-- Additive, inactive-by-default GST catalog and rule-governance infrastructure.
CREATE TYPE "GstApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TYPE "PermissionAction" ADD VALUE IF NOT EXISTS 'manage_hsn_catalog';
ALTER TYPE "PermissionAction" ADD VALUE IF NOT EXISTS 'approve_gst_rates';

CREATE TABLE "hsn_sac_catalog" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "classification_status" "GstApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "rate_approval_status" "GstApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "source_reference" TEXT,
  "effective_from" TIMESTAMP(3),
  "effective_to" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_by_membership_id" TEXT,
  "updated_by_membership_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hsn_sac_catalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hsn_sac_catalog_history" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "catalog_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "actor_membership_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hsn_sac_catalog_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gst_rate_rules" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "hsn_sac_catalog_id" TEXT,
  "rule_version" TEXT NOT NULL,
  "tax_rate" DECIMAL(7,4),
  "component_policy" TEXT NOT NULL,
  "approval_status" "GstApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "source_reference" TEXT,
  "effective_from" TIMESTAMP(3) NOT NULL,
  "effective_to" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_by_membership_id" TEXT,
  "approved_by_membership_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gst_rate_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hsn_sac_catalog_tenant_id_code_key" ON "hsn_sac_catalog"("tenant_id", "code");
CREATE UNIQUE INDEX "hsn_sac_catalog_tenant_id_id_key" ON "hsn_sac_catalog"("tenant_id", "id");
CREATE UNIQUE INDEX "gst_rate_rules_tenant_id_rule_version_key" ON "gst_rate_rules"("tenant_id", "rule_version");
CREATE INDEX "hsn_sac_catalog_tenant_id_is_active_idx" ON "hsn_sac_catalog"("tenant_id", "is_active");
CREATE INDEX "hsn_sac_catalog_tenant_id_classification_status_rate_approval_status_idx" ON "hsn_sac_catalog"("tenant_id", "classification_status", "rate_approval_status");
CREATE INDEX "hsn_sac_catalog_history_tenant_id_catalog_id_created_at_idx" ON "hsn_sac_catalog_history"("tenant_id", "catalog_id", "created_at");
CREATE INDEX "gst_rate_rules_tenant_id_hsn_sac_catalog_id_effective_from_effective_to_idx" ON "gst_rate_rules"("tenant_id", "hsn_sac_catalog_id", "effective_from", "effective_to");
CREATE INDEX "gst_rate_rules_tenant_id_approval_status_is_active_idx" ON "gst_rate_rules"("tenant_id", "approval_status", "is_active");

ALTER TABLE "hsn_sac_catalog"
  ADD CONSTRAINT "hsn_sac_catalog_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hsn_sac_catalog_history"
  ADD CONSTRAINT "hsn_sac_catalog_history_tenant_id_catalog_id_fkey"
  FOREIGN KEY ("tenant_id", "catalog_id") REFERENCES "hsn_sac_catalog"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_tenant_id_hsn_sac_catalog_id_fkey"
  FOREIGN KEY ("tenant_id", "hsn_sac_catalog_id") REFERENCES "hsn_sac_catalog"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
