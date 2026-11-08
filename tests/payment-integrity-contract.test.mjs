import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const salesSource = await readFile(
  new URL("../src/app/_actions/sales.actions.ts", import.meta.url),
  "utf8",
);
const schemaSource = await readFile(
  new URL("../src/lib/validation/sales.schemas.ts", import.meta.url),
  "utf8",
);
const prismaSchema = await readFile(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../prisma/migrations/0012_payment_integrity/migration.sql", import.meta.url),
  "utf8",
);
const customerForm = await readFile(
  new URL("../src/app/billing/payments/new/_form.tsx", import.meta.url),
  "utf8",
);
const supplierForm = await readFile(
  new URL("../src/app/purchases/payments/new/_form.tsx", import.meta.url),
  "utf8",
);
const customerPage = await readFile(
  new URL("../src/app/billing/payments/new/page.tsx", import.meta.url),
  "utf8",
);
const supplierPage = await readFile(
  new URL("../src/app/purchases/payments/new/page.tsx", import.meta.url),
  "utf8",
);
const paymentRepositorySource = await readFile(
  new URL("../src/repositories/payment.repository.ts", import.meta.url),
  "utf8",
);

function actionBody(name) {
  const start = salesSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = salesSource.indexOf("\nexport async function ", start + 1);
  return salesSource.slice(start, end === -1 ? salesSource.length : end);
}

for (const [name, permission, transactionNeedle] of [
  ["createCustomerPaymentAction", "create_payment", "lockCustomerBalance"],
  ["createSupplierPaymentAction", "create_payment", "lockSupplierBalance"],
]) {
  test(`${name} requires its dedicated write permission before its transaction`, () => {
    const body = actionBody(name);
    const contextIndex = body.indexOf("const ctx = await requireServerTenantContext();");
    const permissionIndex = body.indexOf(`requirePermission(ctx, PermissionAction.${permission});`);
    const transactionIndex = body.indexOf("prisma.$transaction");

    assert.ok(contextIndex >= 0);
    assert.ok(permissionIndex > contextIndex);
    assert.ok(transactionIndex > permissionIndex);
    assert.ok(body.includes(transactionNeedle));
    assert.doesNotMatch(body, /requirePermission\(ctx, PermissionAction\.view_(customer|supplier)_ledger\)/);
  });
}

test("payment schemas and forms require one retry key per rendered payment", () => {
  assert.match(schemaSource, /CustomerPaymentCreateSchema[\s\S]*?idempotency_key:\s*z\.string\(\)/);
  assert.match(schemaSource, /SupplierPaymentCreateSchema[\s\S]*?idempotency_key:\s*z\.string\(\)/);
  assert.match(customerForm, /name="idempotency_key"/);
  assert.match(supplierForm, /name="idempotency_key"/);
  assert.match(customerPage, /dynamic\s*=\s*"force-dynamic"/);
  assert.match(supplierPage, /dynamic\s*=\s*"force-dynamic"/);
});

test("same-key replay and payload conflict are explicit and write-free", () => {
  assert.match(salesSource, /different payment payload/);
  assert.match(salesSource, /isPaymentIdempotencyUniqueViolation/);
  for (const name of ["createCustomerPaymentAction", "createSupplierPaymentAction"]) {
    const body = actionBody(name);
    assert.match(body, /tenant_id_idempotency_key/);
    assert.match(body, /paymentReplay\(/);
    assert.match(body, /request_payload_hash: requestHash/);
  }
});

test("payment schema and migration provide supplier ownership and tenant-scoped uniqueness", () => {
  assert.match(prismaSchema, /model payments \{[\s\S]*supplier_id\s+String\?[\s\S]*idempotency_key\s+String\?[\s\S]*request_payload_hash\s+String\?/);
  assert.match(prismaSchema, /@@unique\(\[tenant_id, idempotency_key\], map: "payments_tenant_idempotency_key"\)/);
  assert.match(migration, /ADD COLUMN "supplier_id" TEXT/);
  assert.match(migration, /ADD COLUMN "idempotency_key" TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX "payments_tenant_idempotency_key"/);
});

test("customer and supplier payment effects are balance-serialized in one transaction", () => {
  assert.match(salesSource, /SELECT "receivable_balance"[\s\S]*FOR UPDATE/);
  assert.match(salesSource, /SELECT "payable_balance"[\s\S]*FOR UPDATE/);
  for (const name of ["createCustomerPaymentAction", "createSupplierPaymentAction"]) {
    const body = actionBody(name);
    assert.match(body, /prisma\.\$transaction\(async \(tx\)/);
    assert.match(body, /payments\.create/);
    assert.match(body, /(?:customer|supplier)_ledgers\.create/);
    assert.match(body, /\.update\(\{\s*where: \{ id: data\.(customer|supplier)_id, tenant_id: ctx\.tenantId \}/s);
  }
});

test("payment repository rejects mutation without a reversal workflow", () => {
  assert.match(paymentRepositorySource, /Payments are immutable; create a reversal instead\./);
  assert.match(paymentRepositorySource, /async update\([\s\S]*?throw new Error/);
  assert.match(paymentRepositorySource, /async delete\([\s\S]*?throw new Error/);
  assert.doesNotMatch(paymentRepositorySource, /this\.prisma\.payments\.(update|delete)/);
});
