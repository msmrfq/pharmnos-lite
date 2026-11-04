import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const purchasesSource = await readFile(
  new URL("../src/app/_actions/purchases.actions.ts", import.meta.url),
  "utf8",
);
const salesSource = await readFile(
  new URL("../src/app/_actions/sales.actions.ts", import.meta.url),
  "utf8",
);
const purchaseSchema = await readFile(
  new URL("../src/lib/validation/purchases.schemas.ts", import.meta.url),
  "utf8",
);
const tenantContextSource = await readFile(
  new URL("../src/lib/db/tenant-context.ts", import.meta.url),
  "utf8",
);

function actionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must remain exported`);
  const end = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("purchase draft validates tenant-owned supplier, products, and optional batch references before creation", () => {
  const body = actionBody(purchasesSource, "createPurchaseDraftAction");
  const transactionIndex = body.indexOf("prisma.$transaction(async (tx)");
  const establishIndex = body.indexOf("establishTenantContext(tx, ctx)", transactionIndex);
  const createIndex = body.indexOf("tx.purchase_invoices.create", establishIndex);

  assert.ok(establishIndex > transactionIndex);
  assert.ok(createIndex > establishIndex);
  assert.match(body, /tx\.suppliers\.findUnique\(\{[\s\S]*where: \{ id: data\.supplier_id, tenant_id: ctx\.tenantId \}/);
  assert.match(body, /Supplier not found or belongs to another tenant/);
  assert.match(body, /tx\.products\.findMany\(\{[\s\S]*where: \{ tenant_id: ctx\.tenantId, id: \{ in: productIds \} \}/);
  assert.match(body, /Purchase line product is missing or belongs to another tenant/);
  assert.match(body, /tx\.product_batches\.findMany\(\{[\s\S]*where: \{ tenant_id: ctx\.tenantId, id: \{ in: referencedBatchIds \} \}/);
  assert.match(body, /Purchase line batch is missing or belongs to another tenant/);
  assert.match(body, /batch\.batch_no !== String\(line\.batch_no\)/);
  assert.match(purchaseSchema, /batch_id: z\.string\(\)\.min\(1, "Batch is required"\)\.optional\(\)/);
});

test("sales draft rejects cross-tenant customers and batches inside the write transaction", () => {
  const body = actionBody(salesSource, "createSalesDraftAction");
  const transactionIndex = body.indexOf("const invoice = await prisma.$transaction(async (tx)");
  const establishIndex = body.indexOf("establishTenantContext(tx, ctx)", transactionIndex);
  const customerIndex = body.indexOf("tx.customers.findUnique", establishIndex);
  const batchIndex = body.indexOf("tx.product_batches.findMany", customerIndex);
  const createIndex = body.indexOf("tx.sales_invoices.create", batchIndex);

  assert.ok(establishIndex > transactionIndex);
  assert.ok(customerIndex > establishIndex);
  assert.ok(batchIndex > customerIndex);
  assert.ok(createIndex > batchIndex);
  assert.match(body, /where: \{ id: data\.customer_id, tenant_id: ctx\.tenantId \}/);
  assert.match(body, /Customer not found or belongs to another tenant/);
  assert.match(body, /where: \{ tenant_id: ctx\.tenantId, id: \{ in: batchIds \} \}/);
  assert.match(body, /Sales line batch is missing or belongs to another tenant/);
  assert.match(body, /batch\.product_id !== String\(line\.product_id\)/);
  assert.match(body, /batch\.batch_no !== String\(line\.batch_no\)/);
});

test("sales finalization and payment transactions establish both reviewed RLS claims", () => {
  const finalizeBody = actionBody(salesSource, "finalizeSalesInvoiceAction");
  const finalizeTransactionIndex = finalizeBody.indexOf("prisma.$transaction(async (tx)");
  const finalizeEstablishIndex = finalizeBody.indexOf("establishTenantContext(tx, ctx)", finalizeTransactionIndex);
  const advisoryLockIndex = finalizeBody.indexOf("pg_advisory_xact_lock", finalizeEstablishIndex);
  assert.ok(finalizeEstablishIndex > finalizeTransactionIndex);
  assert.ok(advisoryLockIndex > finalizeEstablishIndex);

  for (const actionName of ["createCustomerPaymentAction", "createSupplierPaymentAction"]) {
    const body = actionBody(salesSource, actionName);
    const transactionIndex = body.indexOf("prisma.$transaction(async (tx)");
    const establishIndex = body.indexOf("establishTenantContext(tx, ctx)", transactionIndex);
    const paymentLookupIndex = body.indexOf("tx.payments.findUnique", establishIndex);
    assert.ok(establishIndex > transactionIndex, `${actionName} must establish claims in its transaction`);
    assert.ok(paymentLookupIndex > establishIndex, `${actionName} must establish claims before payment reads`);
  }

  assert.match(salesSource, /async function findPaymentIdempotencyReplay\([\s\S]*await establishTenantContext\(tx, ctx\)/);
  assert.match(tenantContextSource, /set_config\('request\.jwt\.claim\.sub', \$\{ctx\.subjectId\}, true\)/);
  assert.match(tenantContextSource, /set_config\('request\.jwt\.claim\.tenant_id', \$\{ctx\.tenantId\}, true\)/);
  assert.match(tenantContextSource, /userId: user\.id,[\s\S]*subjectId: externalId/);
});
