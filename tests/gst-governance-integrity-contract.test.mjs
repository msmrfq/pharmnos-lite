import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { validateGovernanceMigration } from "../scripts/financial-e2e-provisioning-static-guard.mjs";

const migration = fs.readFileSync("prisma/migrations/0008_hsn_governance_integrity/migration.sql", "utf8");
const provisioning = fs.readFileSync("scripts/financial-e2e-provision-local.mjs", "utf8");
const generatedBaseline = fs.readFileSync("prisma/financial-e2e-schema-provisioning.generated.sql", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

test("database migration enforces governance integrity", () => {
  assert.match(migration, /prevent_hsn_sac_catalog_history_mutation/);
  assert.match(migration, /prevent_gst_rate_rule_history_mutation/);
  assert.match(migration, /prevent_approved_gst_rule_mutation/);
  assert.match(migration, /EXCLUDE USING gist/);
  assert.match(migration, /gst_rate_rules_tax_rate_check/);
  assert.match(migration, /gst_rate_rules_effective_range_check/);
  assert.match(migration, /hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey/);
  assert.match(migration, /gst_rate_rules_tenant_id_approved_by_membership_id_fkey/);
  assert.match(migration, /hsn_sac_catalog_approval_state_check/);
  assert.match(migration, /gst_rate_rules_approval_state_check/);
});

test("migration guard verifies exact tenant-aware approval foreign keys", () => {
  assert.deepEqual(validateGovernanceMigration(migration), []);
});

test("migration guard rejects a foreign key without tenant scoping", () => {
  const invalid = migration.replace(
    'FOREIGN KEY ("tenant_id", "classification_approved_by_membership_id")',
    'FOREIGN KEY ("classification_approved_by_membership_id")',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("classification_approved_by_membe_fkey")));
});

test("migration guard rejects a wrong referenced column", () => {
  const invalid = migration.replace(
    'REFERENCES "memberships"("tenant_id", "id")',
    'REFERENCES "memberships"("tenant_id", "user_id")',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("classification_approved_by_membe_fkey")));
});

test("migration guard rejects a referenced key without tenant scoping", () => {
  const invalid = migration.replace(
    'REFERENCES "memberships"("tenant_id", "id")',
    'REFERENCES "memberships"("id")',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("classification_approved_by_membe_fkey")));
});

test("migration guard rejects wrong ordered foreign-key columns", () => {
  const invalid = migration.replace(
    'FOREIGN KEY ("tenant_id", "classification_approved_by_membership_id")',
    'FOREIGN KEY ("classification_approved_by_membership_id", "tenant_id")',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("classification_approved_by_membe_fkey")));
});

test("migration guard rejects a missing actor-membership relation", () => {
  const invalid = migration.replace(
    'ADD CONSTRAINT "gst_rate_rules_tenant_id_approved_by_membership_id_fkey"',
    'ADD CONSTRAINT "gst_rate_rules_missing_relation"',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("approved_by_membership_id_fkey")));
});

test("migration guard rejects a wrong constraint name even with correct columns", () => {
  const invalid = migration.replace(
    'ADD CONSTRAINT "gst_rate_rules_tenant_id_approved_by_membership_id_fkey"',
    'ADD CONSTRAINT "gst_rate_rules_other_fkey"',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("approved_by_membership_id_fkey")));
});

test("migration guard rejects equivalent approver foreign keys under another name", () => {
  const invalid = migration
    .replace(
      "conname <> 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'",
      "conname = 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'",
    )
    .replace(
      "conname <> 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'",
      "conname = 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'",
    );
  const errors = validateGovernanceMigration(invalid);
  assert.ok(errors.some((error) => error.includes("duplicate-definition guard")));
});

test("migration guard rejects an incorrect delete action", () => {
  const invalid = migration.replace(
    'ON DELETE RESTRICT ON UPDATE CASCADE',
    'ON DELETE CASCADE ON UPDATE CASCADE',
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("classification_approved_by_membe_fkey")));
});

test("migration guard rejects an incorrect update action", () => {
  const invalid = migration.replace(
    "ON DELETE RESTRICT ON UPDATE CASCADE",
    "ON DELETE RESTRICT ON UPDATE SET NULL",
  );
  assert.ok(validateGovernanceMigration(invalid).some((error) => error.includes("classification_approved_by_membe_fkey")));
});

test("migration guard requires exact existing-constraint validation", () => {
  assert.match(migration, /conkey = ARRAY/);
  assert.match(migration, /confkey = ARRAY/);
  assert.match(migration, /confdeltype = 'r'/);
  assert.match(migration, /confupdtype = 'c'/);
  assert.match(migration, /Existing classification approver foreign key has an incorrect definition/);
  assert.match(migration, /Existing GST rate approver foreign key has an incorrect definition/);
  assert.match(migration, /Equivalent classification approver foreign key exists under a different name/);
  assert.match(migration, /Equivalent GST rate approver foreign key exists under a different name/);
  assert.match(migration, /conname <> 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'/);
  assert.match(migration, /conname <> 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'/);
  assert.match(migration, /IF EXISTS \([\s\S]*conname = 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'/);
  assert.match(migration, /IF EXISTS \([\s\S]*conname = 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'/);
});

test("generated baseline uses the canonical approver foreign-key names", () => {
  assert.match(generatedBaseline, /hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey/);
  assert.match(generatedBaseline, /gst_rate_rules_tenant_id_approved_by_membership_id_fkey/);
  assert.match(provisioning, /financial-e2e-schema-provisioning\.generated\.sql/);
  assert.doesNotMatch(migration, /classification_approver_fkey/);
  assert.doesNotMatch(migration, /gst_rate_rules_approver_fkey/);
});

test("migration and generated baseline share each canonical FK exactly once", () => {
  for (const name of [
    "hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey",
    "gst_rate_rules_tenant_id_approved_by_membership_id_fkey",
  ]) {
    assert.equal((migration.match(new RegExp(name, "g")) ?? []).length, 4);
    assert.equal((generatedBaseline.match(new RegExp(name, "g")) ?? []).length, 1);
  }
});

test("disposable provisioning preserves append-only governance controls", () => {
  assert.match(provisioning, /hsn_sac_catalog_history/);
  assert.match(provisioning, /gst_rate_rule_history/);
  assert.match(provisioning, /prevent_approved_gst_rule_mutation/);
  assert.match(provisioning, /EXCLUDE USING gist/);
});

test("approval actors are tenant-aware Prisma relations", () => {
  assert.match(schema, /classification_approver memberships\?/);
  assert.match(schema, /approver memberships\?/);
  assert.match(schema, /fields: \[tenant_id, classification_approved_by_membership_id\]/);
  assert.match(schema, /fields: \[tenant_id, approved_by_membership_id\]/);
});
