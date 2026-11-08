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

test("customer unapplied credit is derived from immutable payment consumption", () => {
  assert.match(repository, /listCustomerUnappliedCredits/);
  assert.match(repository, /customer_id: customerId/);
  assert.match(repository, /status: "COMPLETED"/);
  assert.match(repository, /subtract\(allocated\)/);
  assert.match(repository, /subtract\(refunded\)/);
  assert.match(repository, /subtract\(reversed\)/);
  assert.match(repository, /round\(2, "HALF_UP"\)/);
});

test("customer credit application is explicit, tenant-scoped, and sales-only", () => {
  assert.match(actions, /export async function listCustomerUnappliedCreditsAction/);
  assert.match(actions, /PermissionAction\.view_customer_ledger/);
  assert.match(actions, /export async function applyCustomerCreditAction/);
  assert.match(actions, /expectedCounterpartyId: customerId/);
  assert.match(actions, /invoiceKind: "sales"/);
  assert.match(actions, /allocatePayment\(/);
});
