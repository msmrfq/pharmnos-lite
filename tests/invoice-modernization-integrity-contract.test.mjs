import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("invoice schema and migration persist immutable snapshot and PDF state", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/0017_invoice_modernization_artifacts/migration.sql");

  for (const model of ["sales_invoices", "purchase_invoices"]) {
    assert.match(schema, new RegExp(`model ${model}[\\s\\S]*?finalized_snapshot Json\\?`));
    assert.match(schema, new RegExp(`model ${model}[\\s\\S]*?finalized_snapshot_hash String\\?`));
    assert.match(schema, new RegExp(`model ${model}[\\s\\S]*?pdf_generation_status String`));
    assert.match(migration, new RegExp(`ALTER TABLE "${model}"[\\s\\S]*"finalized_snapshot" JSONB`));
    assert.match(migration, new RegExp(`ALTER TABLE "${model}"[\\s\\S]*"pdf_artifact_key" TEXT`));
  }
});

test("finalization actions persist the generated snapshot and hash", () => {
  for (const relativePath of [
    "src/app/_actions/sales.actions.ts",
    "src/app/_actions/purchases.actions.ts",
  ]) {
    const source = read(relativePath);
    assert.match(source, /finalized_snapshot:\s*finalizedSnapshot\.snapshot/);
    assert.match(source, /finalized_snapshot_hash:\s*finalizedSnapshot\.hash/);
    assert.match(source, /rendering_version:\s*INVOICE_RENDERING_VERSION/);
  }
});

test("supplier document migration creates referenced uniqueness before its foreign key", () => {
  const migration = read("prisma/migrations/0018_supplier_invoice_documents/migration.sql");
  const uniqueIndex = migration.indexOf('CREATE UNIQUE INDEX "suppliers_tenant_id_id_key"');
  const foreignKey = migration.indexOf('purchase_supplier_documents_supplier_fkey');
  assert.ok(uniqueIndex >= 0);
  assert.ok(foreignKey > uniqueIndex);
  assert.doesNotMatch(
    read("prisma/migrations/0019_invoice_document_lifecycle_metadata/migration.sql"),
    /suppliers_tenant_id_id_key/,
  );
});

test("supplier document RLS migration is portable to a plain disposable PostgreSQL target", () => {
  const migration = read("prisma/migrations/0020_supplier_document_rls_and_active_guard/migration.sql");
  assert.match(migration, /CREATE ROLE authenticated NOLOGIN/);
  assert.match(migration, /TO authenticated/);
});

test("print output uses landscape A4 geometry and stable finalized references", () => {
  assert.match(read("src/app/globals.css"), /size:\s*A4 landscape/);
  assert.match(read("src/app/billing/[invoiceId]/print/page.tsx"), /max-w-\[297mm\]/);
  assert.match(read("src/app/billing/[invoiceId]/print/page.tsx"), /stableInvoiceReferences/);
});
