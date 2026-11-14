import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mastersSource = await readFile(
  new URL("../src/app/_actions/masters.actions.ts", import.meta.url),
  "utf8",
);
const schemaSource = await readFile(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const reconciliationSql = await readFile(
  new URL("../scripts/stock-reconciliation.sql", import.meta.url),
  "utf8",
);

function actionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("product creation records opening stock in the movement ledger", () => {
  const body = actionBody(mastersSource, "createProductAction");

  assert.match(body, /await establishTenantContext\(tx, ctx\);/);
  assert.match(body, /tx\.product_batches\.create\(\{ data: batch \}\)/);
  assert.doesNotMatch(body, /tx\.product_batches\.createMany/);
  assert.match(body, /movement_type: "OPENING_STOCK"/);
  assert.match(body, /batch_id: createdBatch\.id/);
  assert.match(body, /quantity_delta: batch\.received_qty/);
  assert.match(body, /if \(batch\.received_qty > 0\)/);
});

test("opening stock is written in the same transaction as the batch counter", () => {
  const body = actionBody(mastersSource, "createProductAction");
  const transactionIndex = body.indexOf("prisma.$transaction");
  const batchIndex = body.indexOf("tx.product_batches.create");
  const movementIndex = body.indexOf("tx.stock_movements.create");
  const returnIndex = body.indexOf("return created;");

  assert.ok(transactionIndex >= 0);
  assert.ok(batchIndex > transactionIndex);
  assert.ok(movementIndex > batchIndex);
  assert.ok(returnIndex > movementIndex);
});

test("the reconciliation diagnostic is read-only and states the accounting equation", () => {
  assert.match(reconciliationSql, /available_qty = SUM\(stock_movements\.quantity_delta\)/);
  assert.match(reconciliationSql, /LEFT JOIN movement_totals/);
  assert.match(reconciliationSql, /unexplained_residual/);
  assert.match(reconciliationSql, /UNTAGGED_OPENING_BALANCE_SUSPECTED/);
  assert.match(reconciliationSql, /COUNTER_MOVEMENT_MISMATCH/);

  const uncommented = reconciliationSql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--"));
  assert.equal(
    uncommented.some((line) => /^(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE)\b/i.test(line)),
    false,
    "diagnostic must not mutate data",
  );
});

test("schema drift annotations match the deployed numeric and index contracts", () => {
  const valuation = schemaSource
    .split("model inventory_valuation_decisions {")[1]
    .split("}")[0];
  assert.match(valuation, /recoverable_itc\s+Decimal\?\s+@db\.Decimal\(20, 4\)/);
  assert.match(valuation, /non_recoverable_gst\s+Decimal\?\s+@db\.Decimal\(20, 4\)/);
  assert.match(valuation, /inventory_acquisition_cost\s+Decimal\?\s+@db\.Decimal\(20, 4\)/);

  const purchaseItems = schemaSource
    .split("model purchase_invoice_items {")[1]
    .split("}")[0];
  assert.match(
    purchaseItems,
    /@@index\(\[tenant_id, purchase_id, accepted_decision_id\], map: "purchase_invoice_items_accepted_decision_idx"\)/,
  );
});
