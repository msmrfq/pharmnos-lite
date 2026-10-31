import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync("src/app/_actions/sales.actions.ts", "utf8");
const governance = fs.readFileSync("src/lib/gst/rule-governance.ts", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync(
  "prisma/migrations/0005_sales_gst_rule_snapshots/migration.sql",
  "utf8",
);

test("sales drafts and finalization resolve tenant-scoped approved rules server-side", () => {
  assert.equal((source.match(/resolveSalesLineRules\(tx/g) ?? []).length, 2);
  assert.match(source, /where: \{ tenant_id: tenantId, id: \{ in: productIds \} \}/);
  assert.match(source, /where: \{ tenant_id: tenantId, code: \{ in: codes \} \}/);
  assert.match(source, /where: \{ tenant_id: tenantId, effective_from: \{ lte: effectiveAt \} \}/);
  assert.match(source, /isApprovedGstClassification\(classification, effectiveAt\)/);
  assert.match(source, /resolveApprovedGstRule\(/);
});

test("sales finalization fails closed for missing classifications and governed rules", () => {
  assert.match(source, /has no HSN\/SAC classification/);
  assert.match(source, /is not approved and effective/);
  assert.match(source, /exactly one approved GST rule is required/);
  assert.match(source, /gst_rate: Number\(resolution\.rule\.tax_rate\)/);
  assert.match(governance, /candidates.length > 1/);
  assert.match(governance, /rule\.source_reference\?\.trim\(\)/);
});

test("finalized sales lines retain governed classification and rule evidence", () => {
  for (const column of [
    "hsn_sac_catalog_id_snapshot",
    "gst_rule_version_snapshot",
    "gst_rule_source_reference_snapshot",
  ]) {
    assert.match(schema, new RegExp(column));
    assert.match(migration, new RegExp(`ADD COLUMN "${column}" TEXT`));
    assert.match(source, new RegExp(`"${column}"`));
  }
  assert.match(source, /UPDATE "sales_invoice_items"/);
  assert.match(source, /WHERE "id" = \$\{line\.id\} AND "tenant_id" = \$\{ctx\.tenantId\}/);
});

test("sales rule resolution does not preserve submitted GST rates as authoritative", () => {
  assert.match(source, /const governedLines = await resolveSalesLineRules/);
  assert.match(source, /const gstTotals = computeServerGstTotals\(governedLines, placeOfSupply\)/);
  assert.match(source, /const serverGst = computeServerGstTotals\(governedLines, placeOfSupply\)/);
  assert.doesNotMatch(
    source,
    /resolveSalesLineRules[\s\S]{0,400}gst_rate: line\.gst_rate/,
  );
});
