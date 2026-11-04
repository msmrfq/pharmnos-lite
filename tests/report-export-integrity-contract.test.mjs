import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exportsSource = await readFile(
  new URL("../src/app/_actions/exports.actions.ts", import.meta.url),
  "utf8",
);
const gstReportSource = await readFile(
  new URL("../src/app/reports/gst-hsn-summary/page.tsx", import.meta.url),
  "utf8",
);

function actionBody(name) {
  const start = exportsSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must remain exported`);
  const end = exportsSource.indexOf("\nexport async function ", start + 1);
  return exportsSource.slice(start, end === -1 ? exportsSource.length : end);
}

test("CSV exports enforce the permission for their financial surface", () => {
  const expectedPermissions = {
    exportInventoryCsvAction: "view_inventory",
    exportLowStockCsvAction: "view_inventory",
    exportNearExpiryCsvAction: "view_inventory",
    exportCustomersCsvAction: "view_customer",
    exportSuppliersCsvAction: "view_supplier",
    exportPurchaseRegisterCsvAction: "view_purchase",
    exportSalesRegisterCsvAction: "view_invoice",
    exportCustomerDuesCsvAction: "view_customer_ledger",
    exportSupplierPayablesCsvAction: "view_supplier_ledger",
    exportStockValuationCsvAction: "view_inventory",
    exportBatchExpiryCsvAction: "view_inventory",
    exportGstHsnSummaryCsvAction: "view_reports",
    exportDaybookCsvAction: "view_reports",
  };

  for (const [action, permission] of Object.entries(expectedPermissions)) {
    assert.match(
      actionBody(action),
      new RegExp(`requirePermission\\(ctx, PermissionAction\\.${permission}\\)`),
      `${action} must enforce ${permission}`,
    );
  }
});

test("CSV escaping neutralizes spreadsheet formulas", () => {
  assert.match(exportsSource, /const safe = \/\^\[=\+\\\-@\]\//);
  assert.match(exportsSource, /return safe;/);
});

test("GST HSN reporting reads finalized snapshot facts instead of mutable masters", () => {
  const exportBody = actionBody("exportGstHsnSummaryCsvAction");
  assert.match(exportBody, /it\.hsn_code_snapshot/);
  assert.match(exportBody, /it\.product_name_snapshot/);
  assert.match(exportBody, /it\.taxable_amount/);
  assert.match(exportBody, /it\.cgst_amount/);
  assert.match(exportBody, /it\.sgst_amount/);
  assert.match(exportBody, /it\.igst_amount/);
  assert.doesNotMatch(exportBody, /it\.product\?\./);
  assert.match(gstReportSource, /requirePermission\(ctx, PermissionAction\.view_reports\)/);
  assert.match(gstReportSource, /it\.hsn_code_snapshot/);
  assert.match(gstReportSource, /it\.product_name_snapshot/);
  assert.doesNotMatch(gstReportSource, /it\.product\?\./);
});
