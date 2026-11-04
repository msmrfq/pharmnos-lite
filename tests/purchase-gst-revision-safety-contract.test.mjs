import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const schema = fs.readFileSync("src/lib/validation/purchases.schemas.ts", "utf8");
const action = fs.readFileSync("src/app/_actions/purchases.actions.ts", "utf8");
const actionsCell = fs.readFileSync("src/app/purchases/_actions-cell.tsx", "utf8");
const applicationAcceptance = fs.readFileSync(
  "scripts/purchase-gst-application-acceptance.cjs",
  "utf8",
);
const applicationE2e = fs.readFileSync("scripts/gst-application-e2e-runner.mjs", "utf8");

test("purchase GST acceptance and correction paths bind decisions to the reviewed revision", () => {
  assert.match(schema, /const PurchaseGstRevisionGuardSchema = z\.object/);
  for (const field of [
    "expected_gst_record_version",
    "expected_gst_evidence_revision_id",
    "expected_gst_calculation_id",
  ]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  assert.match(schema, /PurchaseGstAcceptanceSchema = PurchaseGstRevisionGuardSchema\.extend/);
  assert.match(schema, /PurchaseGstResolutionSchema = PurchaseGstRevisionGuardSchema\.extend/);
  assert.match(schema, /PurchaseGstCorrectionSchema = PurchaseGstRevisionGuardSchema\.extend/);

  assert.match(action, /function assertPurchaseGstRevisionCurrent/);
  assert.match(action, /Purchase GST revision is stale; refresh before retrying/);
  assert.match(action, /assertPurchaseGstRevisionCurrent\(purchase, parsed\.data\)/);
  assert.match(action, /assertPurchaseGstRevisionCurrent\(purchase, data\)/);
  assert.match(action, /current_gst_accounting_decision_id: null/);
  assert.match(action, /expectedCurrentEvidenceRevisionId/);
  assert.match(action, /expectedCurrentCalculationId/);
  assert.match(action, /Purchase GST revision changed while the correction was being recorded; retry/);
  assert.match(action, /fromStatus: purchase\.gst_reconciliation_status/);

  assert.match(actionsCell, /appendCurrentGstRevision/);
  assert.match(actionsCell, /expected_gst_record_version/);
  assert.match(actionsCell, /expected_gst_evidence_revision_id/);
  assert.match(actionsCell, /expected_gst_calculation_id/);
  assert.match(applicationAcceptance, /gstRevisionFields/);
  assert.match(applicationAcceptance, /expected_gst_record_version/);
  assert.match(applicationE2e, /expected_gst_record_version: interPurchase\.gst_record_version/);
  assert.match(applicationE2e, /expected_gst_record_version: revisionPurchase\.gst_record_version/);
});
