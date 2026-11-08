import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("scripts/purchase-gst-application-acceptance.cjs", "utf8");

test("Purchase GST uses the shared suite target gate", () => {
  assert.match(source, /loadAuthorizedTargetLifecycle/);
  assert.match(source, /phase:\s*"SUITE_EXECUTION"/);
  assert.match(source, /phase:\s*"EVIDENCE_RECORDING"/);
  assert.match(source, /suiteName:\s*"purchase-gst"/);
  assert.match(source, /FINANCIAL_E2E_SUITE_EVIDENCE_FILE/);
});

test("Purchase GST does not provision or dispose database infrastructure", () => {
  assert.doesNotMatch(source, /\bCREATE\s+DATABASE\b/i);
  assert.doesNotMatch(source, /\bDROP\s+DATABASE\b/i);
  assert.doesNotMatch(source, /execFileSync[\s\S]{0,200}financial-e2e-provision-local\.mjs/);
  assert.match(source, /targetDisposalRequired:\s*true/);
});

test("Purchase GST keeps application execution on the restricted runtime URL", () => {
  assert.match(source, /FINANCIAL_E2E_RUNTIME_DATABASE_URL/);
  assert.match(source, /applicationDatabaseRoleAssessment/);
  assert.match(source, /is_superuser !== false/);
  assert.match(source, /bypasses_rls !== false/);
});

test("Purchase GST restores the ordinary endpoint for final lifecycle validation", () => {
  assert.match(source, /const ordinaryDatabaseUrl = process\.env\.DATABASE_URL/);
  assert.match(source, /env:\s*\{\s*\.\.\.process\.env,\s*DATABASE_URL:\s*ordinaryDatabaseUrl\s*\}/);
});

test("Purchase GST runtime campaign verifies paid and free physical quantity persistence", () => {
  assert.match(source, /quantity: "1", free_qty: "1"/);
  assert.match(source, /quantity: "2", free_qty: "2"/);
  assert.match(source, /stock_quantity_delta/);
  assert.match(source, /batch_received_quantity/);
  assert.match(source, /batch_available_quantity/);
});
