import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync("src/app/_actions/gst-catalog.actions.ts", "utf8");
const masters = fs.readFileSync("src/app/_actions/masters.actions.ts", "utf8");

test("catalog maintenance and GST rate approval use separate permissions", () => {
  assert.match(source, /manage_hsn_catalog/);
  assert.match(source, /approve_hsn_catalog/);
  assert.match(source, /approve_gst_rates/);
  assert.match(source, /CREATED_PENDING/);
  assert.match(source, /is_active: false/);
});

test("catalog and rate approvals require source evidence and tenant guards", () => {
  assert.match(source, /Classification source reference is required/);
  assert.match(source, /GST rate source reference is required/);
  assert.match(source, /tenant_id: ctx\.tenantId/);
  assert.match(source, /approval_status: "PENDING"/);
});

test("classification approval activates the approved record and records membership audit history", () => {
  const approvalBody = source.slice(source.indexOf("export async function approveHsnSacClassification("), source.indexOf("export async function approveHsnSacClassificationFromForm"));
  assert.doesNotMatch(approvalBody, /manage_hsn_catalog/);
  assert.match(source, /"classification_approved_by_membership_id" = \$\{membershipId\}/);
  assert.match(source, /"classification_approved_at" = NOW\(\)/);
  assert.match(source, /classification_status: "APPROVED"/);
  assert.match(source, /is_active: true/);
  assert.match(source, /updated_by_membership_id: membershipId/);
  assert.match(source, /action: "CLASSIFICATION_APPROVED"/);
  assert.match(source, /actor_membership_id: membershipId/);
  assert.match(source, /Updated catalog record could not be reloaded/);
});

test("GST rate approval records the approver membership rather than the user id", () => {
  assert.match(source, /approved_by_membership_id: membershipId/);
  assert.match(source, /approved_at: new Date\(\)/);
  assert.doesNotMatch(source, /approved_by_membership_id: ctx\.userId/);
  assert.match(source, /rate_approval_status: "APPROVED"/);
  assert.match(source, /where: \{ id: rule\.hsn_sac_catalog_id, tenant_id: ctx\.tenantId \}/);
  assert.match(source, /gst_rate_rule_history/);
  assert.match(source, /overlapping approved rule already exists/);
});

test("approved GST rules use explicit pending revisions", () => {
  assert.match(source, /createGstRateRuleRevision/);
  assert.match(source, /Only an approved active GST rate can be revised/);
  assert.match(source, /REVISION_CREATED/);
  assert.match(source, /supersedes_rule_id: prior\.id/);
});

test("governance mutations use atomic tenant-scoped application transactions", () => {
  for (const name of ["updateHsnSacCatalogRecord", "approveGstRateRule", "createGstRateRuleRevision"]) {
    const start = source.indexOf(`export async function ${name}`);
    const end = source.indexOf("\nexport async function ", start + 1);
    const body = source.slice(start, end === -1 ? source.length : end);
    assert.notEqual(start, -1, `${name} must exist`);
    assert.match(body, /\$transaction/);
    assert.match(body, /tenant_id: ctx\.tenantId/);
  }
  const approvalBody = source.slice(source.indexOf("export async function approveGstRateRule("));
  assert.match(approvalBody, /requirePermission\(ctx, "approve_gst_rates"/);
  assert.match(approvalBody, /overlapping approved rule already exists/);
});

test("product classification changes require an approved effective catalog entry", () => {
  assert.match(masters, /requireApprovedProductClassification/);
  assert.match(masters, /classification_status: "APPROVED"/);
  assert.match(masters, /is_active: true/);
  assert.match(masters, /Product classification must reference an approved/);
});
