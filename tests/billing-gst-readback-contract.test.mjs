import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detailPage = fs.readFileSync("src/app/billing/[invoiceId]/page.tsx", "utf8");
const printPage = fs.readFileSync("src/app/billing/[invoiceId]/print/page.tsx", "utf8");
const printData = fs.readFileSync("src/app/billing/[invoiceId]/print/data.ts", "utf8");
const purchaseAction = fs.readFileSync("src/app/_actions/purchases.actions.ts", "utf8");
const purchaseSchema = fs.readFileSync("src/lib/validation/purchases.schemas.ts", "utf8");

test("sales detail read-back renders persisted canonical tax facts", () => {
  for (const field of [
    "discount_pct",
    "gst_rate",
    "taxable_amount",
    "cgst_amount",
    "sgst_amount",
    "igst_amount",
    "cess_amount",
    "gst_amount",
    "line_total",
  ]) {
    assert.match(detailPage, new RegExp(`it\\.${field}`));
  }
  assert.doesNotMatch(detailPage, /trade_discount_pct|gst_rate_pct/);
  assert.doesNotMatch(detailPage, /const gross = qty \* rate|const tax = taxable \* \(taxPct \/ 100\)/);
});

test("thermal print uses tenant identity and omits unavailable GSTIN", () => {
  assert.match(printData, /repos\.tenants\.getById\(ctx\.tenantId, ctx\)/);
  assert.match(printPage, /tenant\?\.business_name/);
  assert.match(printPage, /businessProfile\?\.gstin/);
  assert.doesNotMatch(printPage, /27ABCDE1234F1Z5/);
  assert.doesNotMatch(printPage, /businessProfile\?\.tenant\?\.business_name/);
});

test("blank purchase GST evidence is treated as absent while zero remains supplied", () => {
  assert.match(purchaseSchema, /export const decimalFromStringOptionalNullable/);
  assert.match(purchaseSchema, /declared_taxable_value: decimalFromStringOptionalNullable/);
  assert.match(
    purchaseAction,
    /line\[field\] !== undefined && line\[field\] !== null && line\[field\] !== ""/,
  );
});
