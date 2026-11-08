import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../prisma/migrations/0022_financial_reconciliation_foundation/migration.sql", import.meta.url),
  "utf8",
);
const service = await readFile(
  new URL("../src/domain/services/financial-reconciliation.service.ts", import.meta.url),
  "utf8",
);
const actions = await readFile(
  new URL("../src/app/_actions/reconciliation.actions.ts", import.meta.url),
  "utf8",
);
const sales = await readFile(new URL("../src/app/_actions/sales.actions.ts", import.meta.url), "utf8");
const provisioning = await readFile(
  new URL("../scripts/financial-e2e-provision-local.mjs", import.meta.url),
  "utf8",
);

test("reconciliation schema has immutable allocation, refund, and reversal entities", () => {
  for (const model of ["payment_allocations", "allocation_reversals", "payment_refunds", "payment_reversals"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /@@unique\(\[tenant_id, idempotency_key\], map: "payment_allocations_tenant_idempotency_key"\)/);
  assert.match(migration, /payment_allocations_one_invoice_check/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("disposable runtime provisioning grants and isolates reconciliation tables", () => {
  for (const table of ["payment_allocations", "allocation_reversals", "payment_refunds", "payment_reversals"]) {
    assert.match(provisioning, new RegExp(`"${table}"`));
  }
  assert.match(provisioning, /ALTER TABLE public\.\$\{ident\(table\)\} ENABLE ROW LEVEL SECURITY/);
});

test("mutation service uses tenant-scoped idempotency and serializable retry", () => {
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /attempt < 3/);
  assert.match(service, /tenant_id_idempotency_key/);
  assert.match(service, /request_payload_hash/);
  assert.match(service, /FOR UPDATE/);
});

test("payment reversal discovers invoice locks only after payment and counterparty locks", () => {
  const start = service.indexOf("export async function reversePayment");
  const body = service.slice(start);
  assert.ok(body.indexOf("discoverPaymentCounterparty") < body.indexOf("lockPayment"));
  assert.ok(body.indexOf("lockPayment") < body.indexOf("payment_allocations.findMany"));
  assert.ok(body.indexOf("payment_allocations.findMany") < body.indexOf('lockInvoices(tx, input.tenantId, "sales"'));
});

test("payment methods are explicit and advances are persisted instead of rejected", () => {
  assert.match(sales, /if \(method === "Cheque"\) return "CHEQUE";/);
  assert.match(sales, /if \(method === "Bank Transfer"\) return "BANK_TRANSFER";/);
  assert.match(sales, /if \(method === "NEFT"\) return "NEFT";/);
  assert.doesNotMatch(sales, /Payment exceeds the customer's outstanding dues/);
  assert.doesNotMatch(sales, /Payment exceeds the supplier's payable balance/);
});

test("server actions route all reconciliation mutations through the authenticated tenant boundary", () => {
  for (const name of ["allocatePaymentAction", "reverseAllocationAction", "completeRefundAction", "reversePaymentAction"]) {
    assert.match(actions, new RegExp(`export async function ${name}`));
  }
  assert.match(actions, /requireServerTenantContext/);
  assert.match(actions, /PermissionAction\.create_payment/);
});
