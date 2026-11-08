import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repository = await readFile(
  new URL("../src/repositories/payment.repository.ts", import.meta.url),
  "utf8",
);
const actions = await readFile(
  new URL("../src/app/_actions/sales.actions.ts", import.meta.url),
  "utf8",
);
const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../prisma/migrations/0025_payment_receipt_sequence/migration.sql", import.meta.url),
  "utf8",
);

test("receipt allocation uses an atomic tenant-scoped counter, not payment count", () => {
  assert.match(repository, /payment_receipt_sequences/);
  assert.match(repository, /ON CONFLICT \("tenant_id", "prefix"\)/);
  assert.match(repository, /"next_value" = "payment_receipt_sequences"\."next_value" \+ 1/);
  assert.doesNotMatch(repository, /payments\.count\(\{ where: \{ tenant_id: t\.tenantId \} \}\)/);
});

test("customer and supplier payment writes persist the allocated receipt", () => {
  assert.equal((actions.match(/receipt_no:\s*await allocatePaymentReceiptNo\(tx, "PAY", ctx\.tenantId\)/g) ?? []).length, 2);
  assert.match(schema, /receipt_no\s+String\?/);
  assert.match(schema, /@@unique\(\[tenant_id, receipt_no\], map: "payments_tenant_receipt_no"\)/);
});

test("receipt sequence migration enforces tenant ownership and uniqueness", () => {
  assert.match(migration, /CREATE TABLE "payment_receipt_sequences"/);
  assert.match(migration, /PRIMARY KEY \("tenant_id", "prefix"\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "payments_tenant_receipt_no"/);
});

test("currency remains an explicit unsupported boundary", () => {
  assert.doesNotMatch(schema, /model payments \{[\s\S]*currency/i);
});
