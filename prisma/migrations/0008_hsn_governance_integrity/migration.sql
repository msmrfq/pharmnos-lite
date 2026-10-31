-- Database-backed HSN/SAC governance integrity.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "hsn_sac_catalog"
  ADD CONSTRAINT "hsn_sac_catalog_effective_range_check"
  CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_to" > "effective_from");

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_tax_rate_check"
  CHECK ("tax_rate" IS NULL OR ("tax_rate" = "tax_rate" AND "tax_rate" >= 0));

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_effective_range_check"
  CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");

ALTER TABLE "hsn_sac_catalog"
  ADD CONSTRAINT "hsn_sac_catalog_approval_state_check"
  CHECK (
    "classification_status" <> 'APPROVED'::"GstApprovalStatus"
    OR (
      "is_active" = true
      AND "classification_approved_by_membership_id" IS NOT NULL
      AND "classification_approved_at" IS NOT NULL
    )
  );

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_approval_state_check"
  CHECK (
    "approval_status" <> 'APPROVED'::"GstApprovalStatus"
    OR (
      "is_active" = true
      AND "approved_by_membership_id" IS NOT NULL
      AND "approved_at" IS NOT NULL
    )
  );

DO $constraints$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname <> 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'
      AND conrelid = 'hsn_sac_catalog'::regclass
      AND confrelid = 'memberships'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'hsn_sac_catalog'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'hsn_sac_catalog'::regclass AND attname = 'classification_approved_by_membership_id')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'id')
      ]::smallint[]
      AND confdeltype = 'r'
      AND confupdtype = 'c'
  ) THEN
    RAISE EXCEPTION 'Equivalent classification approver foreign key exists under a different name';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'
      AND conrelid = 'hsn_sac_catalog'::regclass
      AND confrelid = 'memberships'::regclass
      AND NOT (
        conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'hsn_sac_catalog'::regclass AND attname = 'tenant_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'hsn_sac_catalog'::regclass AND attname = 'classification_approved_by_membership_id')
        ]::smallint[]
        AND confkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'tenant_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'id')
        ]::smallint[]
        AND confdeltype = 'r'
        AND confupdtype = 'c'
      )
  ) THEN
    RAISE EXCEPTION 'Existing classification approver foreign key has an incorrect definition';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'
      AND conrelid = 'hsn_sac_catalog'::regclass
      AND confrelid = 'memberships'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'hsn_sac_catalog'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'hsn_sac_catalog'::regclass AND attname = 'classification_approved_by_membership_id')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'id')
      ]::smallint[]
      AND confdeltype = 'r'
      AND confupdtype = 'c'
  ) THEN
    ALTER TABLE "hsn_sac_catalog"
      ADD CONSTRAINT "hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey"
      FOREIGN KEY ("tenant_id", "classification_approved_by_membership_id")
      REFERENCES "memberships"("tenant_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname <> 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'
      AND conrelid = 'gst_rate_rules'::regclass
      AND confrelid = 'memberships'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'gst_rate_rules'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'gst_rate_rules'::regclass AND attname = 'approved_by_membership_id')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'id')
      ]::smallint[]
      AND confdeltype = 'r'
      AND confupdtype = 'c'
  ) THEN
    RAISE EXCEPTION 'Equivalent GST rate approver foreign key exists under a different name';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'
      AND conrelid = 'gst_rate_rules'::regclass
      AND confrelid = 'memberships'::regclass
      AND NOT (
        conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'gst_rate_rules'::regclass AND attname = 'tenant_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'gst_rate_rules'::regclass AND attname = 'approved_by_membership_id')
        ]::smallint[]
        AND confkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'tenant_id'),
          (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'id')
        ]::smallint[]
        AND confdeltype = 'r'
        AND confupdtype = 'c'
      )
  ) THEN
    RAISE EXCEPTION 'Existing GST rate approver foreign key has an incorrect definition';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'
      AND conrelid = 'gst_rate_rules'::regclass
      AND confrelid = 'memberships'::regclass
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'gst_rate_rules'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'gst_rate_rules'::regclass AND attname = 'approved_by_membership_id')
      ]::smallint[]
      AND confkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'tenant_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'memberships'::regclass AND attname = 'id')
      ]::smallint[]
      AND confdeltype = 'r'
      AND confupdtype = 'c'
  ) THEN
    ALTER TABLE "gst_rate_rules"
      ADD CONSTRAINT "gst_rate_rules_tenant_id_approved_by_membership_id_fkey"
      FOREIGN KEY ("tenant_id", "approved_by_membership_id")
      REFERENCES "memberships"("tenant_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$constraints$;

CREATE OR REPLACE FUNCTION "prevent_hsn_governance_history_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'HSN/SAC governance history is immutable: %', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER "prevent_hsn_sac_catalog_history_mutation"
  BEFORE UPDATE OR DELETE ON "hsn_sac_catalog_history"
  FOR EACH ROW EXECUTE FUNCTION "prevent_hsn_governance_history_mutation"();

CREATE TRIGGER "prevent_gst_rate_rule_history_mutation"
  BEFORE UPDATE OR DELETE ON "gst_rate_rule_history"
  FOR EACH ROW EXECUTE FUNCTION "prevent_hsn_governance_history_mutation"();

CREATE OR REPLACE FUNCTION "prevent_approved_gst_rule_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF OLD."approval_status" = 'APPROVED'::"GstApprovalStatus" THEN
    RAISE EXCEPTION 'Approved GST rate rules are immutable; create a pending revision'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "prevent_approved_gst_rule_mutation"
  BEFORE UPDATE ON "gst_rate_rules"
  FOR EACH ROW EXECUTE FUNCTION "prevent_approved_gst_rule_mutation"();

ALTER TABLE "gst_rate_rules"
  ADD CONSTRAINT "gst_rate_rules_approved_period_excl"
  EXCLUDE USING gist (
    "tenant_id" WITH =,
    (COALESCE("hsn_sac_catalog_id", '')) WITH =,
    "component_policy" WITH =,
    tsrange("effective_from", COALESCE("effective_to", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("approval_status" = 'APPROVED'::"GstApprovalStatus" AND "is_active" = true);

REVOKE UPDATE, DELETE ON TABLE "hsn_sac_catalog_history", "gst_rate_rule_history" FROM PUBLIC;

DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pharmnos_e2e_runtime') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE "hsn_sac_catalog_history", "gst_rate_rule_history" TO "pharmnos_e2e_runtime"';
    EXECUTE 'REVOKE UPDATE, DELETE ON TABLE "hsn_sac_catalog_history", "gst_rate_rule_history" FROM "pharmnos_e2e_runtime"';
  END IF;
END;
$grant$;
