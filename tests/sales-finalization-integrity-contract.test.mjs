import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL("../src/app/_actions/sales.actions.ts", import.meta.url),
  "utf8",
);

function finalizationBody() {
  const start = source.indexOf("export async function finalizeSalesInvoiceAction");
  assert.notEqual(start, -1, "finalizeSalesInvoiceAction must remain exported");
  const end = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("sales finalization persists canonical calculated line totals and GST", () => {
  const body = finalizationBody();
  assert.match(
    body,
    /const persistedTax = toPersistedSalesTaxFacts\(calculated\);[\s\S]*?taxable_amount: persistedTax\.taxable_amount,[\s\S]*?gst_amount: persistedTax\.gst_amount,[\s\S]*?line_total: persistedTax\.line_total,/,
  );
});

test("sales invoice sequence allocation locks the tenant profile row", () => {
  const body = finalizationBody();
  assert.match(
    body,
    /SELECT invoice_next_seq, invoice_prefix[\s\S]*?FROM business_profiles[\s\S]*?WHERE tenant_id = \$\{ctx\.tenantId\}[\s\S]*?FOR UPDATE/,
  );
  assert.match(body, /pg_advisory_xact_lock\(hashtextextended\(\$\{ctx\.tenantId\}, 0\)\)/);
});

test("sales ledger snapshots read a locked customer balance", () => {
  const body = finalizationBody();
  const balanceLockIndex = body.indexOf(
    "const balanceBefore = decimalOrZero(await lockCustomerBalance(tx, ctx.tenantId, cust.id));",
  );
  const ledgerIndex = body.indexOf("tx.customer_ledgers.create", balanceLockIndex);

  assert.ok(balanceLockIndex >= 0, "sales finalization must lock the customer balance row");
  assert.ok(ledgerIndex > balanceLockIndex, "ledger snapshot must follow the balance lock");
  assert.doesNotMatch(body, /const balanceBefore = Number\(cust\.receivable_balance/);
});
