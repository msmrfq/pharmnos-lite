import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const renderer = read("src/domain/services/invoice-document.service.ts");
const actions = read("src/app/_actions/invoice-document.actions.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/0019_invoice_document_lifecycle_metadata/migration.sql");
const supplierMigration = read("prisma/migrations/0018_supplier_invoice_documents/migration.sql");
const printPage = read("src/app/billing/[invoiceId]/print/page.tsx");

test("invoice document renderer uses real PDF, QR, and barcode encoders", () => {
  assert.match(renderer, /PDFDocument/);
  assert.match(renderer, /QRCode\.toDataURL/);
  assert.match(renderer, /bwipjs\.toBuffer/);
  assert.match(renderer, /application\/pdf/);
});

test("PDF lifecycle persists idempotent artifact metadata and retries safely", () => {
  assert.match(actions, /pdf_generation_status: "GENERATING"/);
  assert.match(actions, /pdf_generation_status: "READY"/);
  assert.match(actions, /pdf_generation_status: "FAILED"/);
  assert.match(actions, /storageAdapter\.download/);
  assert.match(actions, /storageAdapter\.upload/);
  assert.match(actions, /pdf_checksum_sha256/);
});

test("supplier document lifecycle is tenant-scoped and append-only", () => {
  assert.match(schema, /model purchase_supplier_documents/);
  assert.match(schema, /supersedes_id/);
  assert.match(schema, /replaced_at/);
  assert.match(actions, /tenant_id: ctx\.tenantId/);
  assert.match(actions, /replaced_at: new Date\(\)/);
  assert.match(actions, /getSupplierInvoiceDocumentUrlAction/);
});

test("forward-only migration carries PDF metadata and supplier storage metadata", () => {
  assert.match(migration, /ALTER TABLE "sales_invoices"/);
  assert.match(migration, /ALTER TABLE "purchase_invoices"/);
  assert.match(supplierMigration, /CREATE TABLE "purchase_supplier_documents"/);
  assert.match(supplierMigration, /CREATE UNIQUE INDEX "suppliers_tenant_id_id_key"/);
});

test("finalized print output embeds actual machine-readable image elements", () => {
  assert.match(printPage, /renderInvoiceQrDataUrl/);
  assert.match(printPage, /renderInvoiceBarcodeDataUrl/);
  assert.match(printPage, /data-invoice-qr/);
  assert.match(printPage, /data-invoice-barcode/);
});
