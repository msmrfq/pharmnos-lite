import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repository = await readFile(
  new URL("../src/repositories/payment.repository.ts", import.meta.url),
  "utf8",
);
const actions = await readFile(
  new URL("../src/app/_actions/reconciliation.actions.ts", import.meta.url),
  "utf8",
);

test("supplier unapplied advance is derived from immutable supplier payment consumption", () => {
  assert.match(repository, /listSupplierUnappliedAdvances/);
  assert.match(repository, /supplier_id: supplierId/);
  assert.match(repository, /getSupplierUnappliedAdvance/);
  assert.match(repository, /subtract\(allocated\)/);
  assert.match(repository, /subtract\(refunded\)/);
  assert.match(repository, /subtract\(reversed\)/);
  assert.match(repository, /round\(2, "HALF_UP"\)/);
});

test("supplier advance application is explicit, tenant-scoped, and purchase-only", () => {
  assert.match(actions, /export async function listSupplierUnappliedAdvancesAction/);
  assert.match(actions, /PermissionAction\.view_supplier_ledger/);
  assert.match(actions, /export async function applySupplierAdvanceAction/);
  assert.match(actions, /expectedCounterpartyId: supplierId/);
  assert.match(actions, /invoiceKind: "purchase"/);
  assert.match(actions, /allocatePayment\(/);
});
