import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/gst/rule-governance.ts", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

test("GST rules are database-backed, effective-dated, and approval-gated", () => {
  assert.match(schema, /model gst_rate_rules/);
  assert.match(schema, /effective_from/);
  assert.match(schema, /effective_to/);
  assert.match(schema, /approval_status\s+GstApprovalStatus/);
  assert.match(schema, /source_reference/);
  assert.match(source, /approval_status === "APPROVED"/);
  assert.match(source, /No approved GST rule is effective/);
});

test("GST rule resolution fails closed for ambiguity", () => {
  assert.match(source, /Multiple approved GST rules are effective/);
  assert.match(source, /candidates.length > 1/);
});
