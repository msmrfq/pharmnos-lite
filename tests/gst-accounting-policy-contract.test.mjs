import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const action = fs.readFileSync("src/app/_actions/purchases.actions.ts", "utf8");
const reconciliation = fs.readFileSync(
  "src/domain/services/purchase-gst-reconciliation.service.ts",
  "utf8",
);
const calculator = fs.readFileSync(
  "src/domain/services/purchase-calculator.service.ts",
  "utf8",
);

test("unsupported GST policy cases fail closed", () => {
  assert.match(
    action,
    /Inclusive GST purchases are blocked until governed Rule 35 extraction and rounding are enabled/,
  );
  assert.match(
    action,
    /Non-zero cess is blocked until a governed cess rule and credit-utilization policy are configured/,
  );
  assert.match(
    reconciliation,
    /Number\(accepted\.amounts\.cess \?\? 0\) === 0/,
  );
});

test("purchase rounding and accepted-source seams remain explicit", () => {
  assert.match(calculator, /export function calculatePurchaseInvoiceTotals/);
  assert.match(action, /const hasAcceptedSnapshot =[\s\S]*SUPPLIER_DECLARED[\s\S]*APPLICATION_CALCULATED[\s\S]*EXPLICIT_DECISION/);
  assert.match(action, /"line_total" = "accepted_line_total"/);
  assert.match(action, /"gst_amount" = "accepted_cgst" \+ "accepted_sgst" \+ "accepted_igst" \+ "accepted_cess"/);
});
