import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync(
  "prisma/migrations/0010_inventory_valuation_pending_state/migration.sql",
  "utf8",
);
const historyMigration = fs.readFileSync(
  "prisma/migrations/0011_inventory_valuation_decision_history/migration.sql",
  "utf8",
);
const valuationAction = fs.readFileSync(
  "src/app/_actions/inventory-valuation.actions.ts",
  "utf8",
);
const action = fs.readFileSync("src/app/_actions/purchases.actions.ts", "utf8");
const report = fs.readFileSync("src/app/reports/stock-valuation/page.tsx", "utf8");
const exportAction = fs.readFileSync("src/app/_actions/exports.actions.ts", "utf8");
const repository = fs.readFileSync("src/repositories/product-batch.repository.ts", "utf8");
const valuationService = fs.readFileSync(
  "src/domain/services/inventory-valuation.service.ts",
  "utf8",
);

test("purchase inventory valuation remains explicit and pending without eligibility", () => {
  for (const field of [
    "recoverable_itc",
    "non_recoverable_gst",
    "inventory_acquisition_cost",
    "inventory_valuation_status",
    "inventory_valuation_policy_version",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
    assert.match(migration, new RegExp(`"${field}"`));
  }
  assert.match(action, /inventory_valuation_status: "PENDING"/);
  assert.match(action, /inventory_acquisition_cost: null/);
  assert.match(action, /"recoverable_itc" = NULL/);
  assert.match(action, /"non_recoverable_gst" = NULL/);
  assert.match(action, /"inventory_valuation_status" = 'PENDING'/);
});

test("stock valuation never treats procurement rate as approved inventory cost", () => {
  assert.match(report, /b\.inventory_valuation_status !== "APPROVED"/);
  assert.match(report, /b\.inventory_acquisition_cost/);
  assert.match(report, /r\.valuationPending \? "Pending"/);
  assert.match(exportAction, /b\.inventory_valuation_status !== "APPROVED"/);
  assert.match(exportAction, /b\.inventory_acquisition_cost/);
  assert.match(repository, /inventory_valuation_status: true/);
  assert.match(repository, /inventory_acquisition_cost: true/);
  assert.match(repository, /b\.inventory_valuation_status === "APPROVED"/);
  assert.doesNotMatch(repository, /const rate = Number\(b\.purchase_rate/);
  assert.match(valuationService, /eligibilityStatus: InventoryEligibilityStatus/);
  assert.match(valuationService, /Recoverable and non-recoverable GST must reconcile/);
  assert.match(valuationService, /calculateInventoryValuationAdjustment/);
});

test("valuation decisions and adjustments are append-only and idempotent", () => {
  for (const table of ["inventory_valuation_decisions", "inventory_valuation_adjustments"]) {
    assert.match(schema, new RegExp(`model ${table}`));
    assert.match(historyMigration, new RegExp(`CREATE TABLE "${table}"`));
    assert.match(historyMigration, new RegExp(`${table}.*fkey`, "s"));
  }
  assert.match(schema, /@@unique\(\[tenant_id, idempotency_key\]/);
  assert.match(historyMigration, /request_payload_hash/);
  assert.match(valuationAction, /establishTenantContext/);
  assert.match(valuationAction, /pg_advisory_xact_lock/);
  assert.match(valuationAction, /different valuation payload/);
  assert.match(valuationAction, /supersedes_decision_id/);
  assert.match(valuationAction, /An approved valuation already exists/);
  assert.match(valuationAction, /Adjustment target does not match/);
  assert.match(valuationAction, /calculateInventoryValuationAdjustment/);
  assert.match(valuationAction, /PENDING_POLICY/);
  assert.doesNotMatch(valuationAction, /inventory_valuation_decisions\.update/);
});
