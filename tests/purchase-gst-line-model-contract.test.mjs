import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync(
  "prisma/migrations/0002_purchase_line_gst_model/migration.sql",
  "utf8",
);
const snapshotMigration = fs.readFileSync(
  "prisma/migrations/0006_purchase_gst_rule_snapshots/migration.sql",
  "utf8",
);
const action = fs.readFileSync("src/app/_actions/purchases.actions.ts", "utf8");
const calculation = fs.readFileSync(
  "src/domain/services/purchase-gst-reconciliation.service.ts",
  "utf8",
);
const lineCalculation = fs.readFileSync(
  "src/domain/services/purchase-calculator.service.ts",
  "utf8",
);

test("purchase line GST keeps calculated and accepted layers separate", () => {
  for (const field of [
    "calculated_taxable_value",
    "calculated_cgst",
    "calculated_sgst",
    "calculated_igst",
    "accepted_taxable_value",
    "accepted_cgst",
    "accepted_sgst",
    "accepted_igst",
    "gst_acceptance_status",
    "gst_discrepancy_details",
    "hsn_sac_catalog_id_snapshot",
    "gst_rule_version_snapshot",
    "gst_rule_source_reference_snapshot",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
    assert.match(
      `${migration}\n${snapshotMigration}`,
      new RegExp(`"${field}"`),
    );
  }
  assert.match(action, /UPDATE "purchase_invoice_items" AS item/);
  assert.match(action, /declared_taxable_value/);
  assert.match(action, /item\."calculated_taxable_value"/);
  assert.match(action, /calculatePurchaseLineGst/);
  assert.match(calculation, /lines: PurchaseCalculationLine\[\]/);
  assert.match(calculation, /governed purchase lines are required/);
  assert.match(calculation, /lineCalculations\.reduce/);
  assert.match(calculation, /line_calculations/);
  assert.match(calculation, /rule_source_reference/);
  assert.match(calculation, /export function reconcilePurchaseGstLineEvidence/);
  assert.match(lineCalculation, /export function calculatePurchaseLineGst/);
  assert.match(lineCalculation, /scenario: "INTRA_STATE" \| "INTER_STATE"/);
  assert.match(action, /resolvePurchaseLineRules/);
  assert.match(action, /isApprovedGstClassification/);
  assert.match(action, /gst_rule_version_snapshot/);
});
