import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const action = await readFile(
  new URL("../src/app/_actions/purchases.actions.ts", import.meta.url),
  "utf8",
);
const schema = await readFile(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL("../prisma/migrations/0014_supplier_invoice_uniqueness/migration.sql", import.meta.url),
  "utf8",
);
const trimmedMigration = await readFile(
  new URL("../prisma/migrations/0016_supplier_invoice_trimmed_uniqueness/migration.sql", import.meta.url),
  "utf8",
);
const provisioning = await readFile(
  new URL("../scripts/financial-e2e-provision-local.mjs", import.meta.url),
  "utf8",
);

function finalizationBody() {
  const start = action.indexOf("export async function finalizePurchaseAction");
  assert.notEqual(start, -1, "finalizePurchaseAction must remain exported");
  const end = action.indexOf("\nexport async function ", start + 1);
  return action.slice(start, end === -1 ? action.length : end);
}

test("purchase finalization locks the supplier row before taking a ledger balance snapshot", () => {
  const body = finalizationBody();
  assert.match(
    action,
    /async function lockSupplierBalance[\s\S]*SELECT "payable_balance"[\s\S]*FROM "suppliers"[\s\S]*FOR UPDATE/,
  );
  const lockIndex = body.indexOf("lockSupplierBalance(tx, ctx.tenantId, existing.supplier_id)");
  const ledgerIndex = body.indexOf("tx.supplier_ledgers.create");
  assert.ok(lockIndex >= 0, "finalization must lock the supplier balance");
  assert.ok(ledgerIndex > lockIndex, "supplier balance must be locked before the ledger snapshot is written");
  assert.doesNotMatch(body, /const supplierRow = await tx\.suppliers\.findUnique/);
});

test("non-empty supplier invoice numbers have tenant-and-supplier scoped database uniqueness", () => {
  assert.match(schema, /supplier_invoice_no\s+String\?/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key"[\s\S]*ON "purchase_invoices"\("tenant_id", "supplier_id", "supplier_invoice_no"\)/,
  );
  assert.match(
    migration,
    /WHERE "supplier_invoice_no" IS NOT NULL[\s\S]*btrim\("supplier_invoice_no"\) <> ''/,
  );
  assert.match(trimmedMigration, /DROP INDEX IF EXISTS "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key"/);
  assert.match(
    trimmedMigration,
    /CREATE UNIQUE INDEX "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key"[\s\S]*ON "purchase_invoices"\("tenant_id", "supplier_id", btrim\("supplier_invoice_no"\)\)/,
  );
  assert.match(
    provisioning,
    /CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key"[\s\S]*ON public\."purchase_invoices"[\s\S]*btrim\("supplier_invoice_no"\)[\s\S]*WHERE "supplier_invoice_no" IS NOT NULL[\s\S]*btrim\("supplier_invoice_no"\) <> ''/,
  );
});

test("supplier invoice uniqueness conflicts are handled explicitly without changing blank semantics", () => {
  const body = finalizationBody();
  assert.match(action, /function isSupplierInvoiceUniqueViolation[\s\S]*error\.code !== "P2002"/);
  assert.match(body, /if \(isSupplierInvoiceUniqueViolation\(e\)\)/);
  assert.match(body, /Supplier invoice number already exists for this supplier/);
  assert.match(body, /supplier_invoice_no\?\.trim\(\)/);
  assert.match(body, /supplier_invoice_no: existing\.supplier_invoice_no/);
  assert.match(action, /function normalizeSupplierInvoiceNo[\s\S]*return normalized \|\| null/);
  assert.match(action, /supplier_invoice_no: normalizeSupplierInvoiceNo\(data\.supplier_invoice_no\)/);
});
