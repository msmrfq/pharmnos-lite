import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const purchases = await readFile(new URL("../src/app/_actions/purchases.actions.ts", import.meta.url), "utf8");
const documents = await readFile(new URL("../src/app/_actions/invoice-document.actions.ts", import.meta.url), "utf8");
const sales = await readFile(new URL("../src/app/_actions/sales.actions.ts", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../prisma/migrations/0015_purchase_finalized_immutability/migration.sql", import.meta.url),
  "utf8",
);
const provisioning = await readFile(new URL("../scripts/financial-e2e-provision-local.mjs", import.meta.url), "utf8");

test("purchase reads require explicit edit permission and cancellation is atomic and audited", () => {
  assert.match(purchases, /export async function getPurchaseForEdit[\s\S]*requirePermission\(ctx, "edit_purchase"/);
  const start = purchases.indexOf("export async function cancelPurchaseDraftAction");
  const end = purchases.indexOf("\nexport async function ", start + 1);
  const body = purchases.slice(start, end === -1 ? purchases.length : end);
  assert.match(body, /prisma\.\$transaction\(async \(tx\) =>/);
  assert.match(body, /status: __PurchaseStatusDRAFT/);
  assert.match(body, /tx\.audit_logs\.create/);
  assert.match(body, /event_type: "INVOICE_CANCELLED"/);
});

test("supplier document replacement fails closed after finalization", () => {
  assert.match(documents, /status: true/);
  assert.match(
    documents,
    /purchase\.status !== "DRAFT"[\s\S]*Supplier invoice documents cannot be replaced after purchase finalization/,
  );
  assert.match(documents, /SELECT id, supplier_id, status[\s\S]*FOR UPDATE/);
  assert.match(documents, /checksum_sha256: supplierDocumentChecksum\(bytes\)/);
  assert.match(documents, /validateSupplierDocumentBytes/);
});

test("customer and supplier overpayments remain recorded as unapplied balances", () => {
  assert.doesNotMatch(sales, /Payment exceeds the customer's outstanding dues; no payment was recorded/);
  assert.doesNotMatch(sales, /Payment exceeds the supplier's payable balance; no payment was recorded/);
  assert.match(sales, /const appliedDecimal = credit;/);
  assert.match(sales, /const appliedDecimal = debit;/);
});

test("finalized purchase identity, treatment, notes, and snapshot fields are immutable", () => {
  for (const field of [
    "supplier_id",
    "supplier_invoice_no",
    "invoice_date",
    "gst_treatment",
    "tax_mode",
    "notes",
    "finalized_snapshot",
    "finalized_snapshot_hash",
    "rendering_version",
  ]) {
    assert.match(migration, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`));
    assert.match(provisioning, new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`));
  }
});

test("purchase finalization posts total physical quantity while preserving paid/free quantities", () => {
  const finalizeStart = purchases.indexOf("export async function finalizePurchaseAction");
  assert.notEqual(finalizeStart, -1);
  const finalizeEnd = purchases.indexOf("\nexport async function ", finalizeStart + 1);
  const body = purchases.slice(finalizeStart, finalizeEnd === -1 ? purchases.length : finalizeEnd);
  assert.match(body, /const physicalQty = paidQty \+ freeQty/);
  assert.match(body, /received_qty: physicalQty/);
  assert.match(body, /available_qty: physicalQty/);
  assert.match(body, /quantity_delta: physicalQty/);
  assert.match(body, /freeQuantity: line\.free_qty/);
  assert.match(body, /physicalQuantity: Number\(line\.quantity \?\? 0\) \+ Number\(line\.free_qty \?\? 0\)/);
});
