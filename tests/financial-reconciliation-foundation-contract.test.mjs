import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../prisma/migrations/0022_financial_reconciliation_foundation/migration.sql", import.meta.url),
  "utf8",
);
const refundLifecycleMigration = await readFile(
  new URL("../prisma/migrations/0027_refund_lifecycle/migration.sql", import.meta.url),
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
const runtimeHarness = await readFile(
  new URL("../scripts/financial-reconciliation-runtime-harness.cjs", import.meta.url),
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

test("runtime scenario IDs match the accepted matrix and keep concurrency separate", () => {
  const blockedScenarios = runtimeHarness.match(/const blockedScenarios = \{([\s\S]*?)\n    \};/);
  assert.ok(blockedScenarios, "runtime harness must declare the unexecuted matrix scenarios");
  const blockedIds = [...blockedScenarios[1].matchAll(/"(S-\d{2})":/g)].map((match) => match[1]);
  assert.deepEqual(
    blockedIds,
    Array.from({ length: 38 }, (_, index) => `S-${String(index + 1).padStart(2, "0")}`).filter((id) => !["S-02", "S-03", "S-05", "S-06", "S-11", "S-12", "S-13", "S-14", "S-15", "S-17", "S-29", "S-34", "S-35", "S-36"].includes(id)),
  );
  assert.match(runtimeHarness, /\[\["S-02", 500\], \["S-03", 300\]\]/);
  assert.match(runtimeHarness, /for \(const scenario of \["S-05", "S-06", "S-34", "S-35"\]\)/);
  assert.match(runtimeHarness, /const scenario = isCustomer \? "S-11" : "S-36"/);
  assert.match(runtimeHarness, /for \(const scenario of \["S-12", "S-13", "S-17"\]\)/);
  assert.match(runtimeHarness, /for \(const scenario of \["S-14", "S-15"\]\)/);
  assert.match(runtimeHarness, /"two-customer-payment-allocation-regression"/);
  assert.equal((runtimeHarness.match(/record\(\s*"S-29"/g) ?? []).length, 1);
  assert.match(runtimeHarness, /"S-29"[\s\S]{0,1000}"cross-tenant payment and invoice ownership rejected"/);
  assert.match(runtimeHarness, /tenantAfter\.auditA\.count === tenantBefore\.auditA\.count/);
  assert.match(runtimeHarness, /tenantAfter\.auditB\.count === tenantBefore\.auditB\.count/);
  assert.match(runtimeHarness, /"allocation-concurrency-regression"/);
  assert.match(runtimeHarness, /const raceBarrier = new Promise/);
  assert.match(runtimeHarness, /raceRetry\?\.replayed === true/);
  assert.match(runtimeHarness, /winningIdempotencyKey: raceWinner\.idempotencyKey/);
  assert.match(runtimeHarness, /netAP: money\(invoiceDue - usable\)/);
  assert.match(runtimeHarness, /supplierRefundAfter\.supplierPayable === supplierRefundAfter\.netAP/);
});

test("runtime refund terminal coverage checks both counterparties and fails on failed assertions", () => {
  assert.match(runtimeHarness, /for \(const kind of \["customer", "supplier"\]\)/);
  assert.match(runtimeHarness, /\["REJECTED", "CANCELLED", "APPROVED_CANCELLED"\]/);
  assert.match(runtimeHarness, /entry\.premature && entry\.invalid && entry\.crossTenant/);
  assert.match(runtimeHarness, /entry\.persisted\.audit_rows ===/);
  assert.match(runtimeHarness, /JSON\.stringify\(ledger\.rows\[0\]\) === JSON\.stringify\(afterLedger\.rows\[0\]\)/);
  assert.match(runtimeHarness, /if \(evidence\.summary\.fail > 0\) process\.exitCode = 1/);
});

test("mutation service uses tenant-scoped idempotency and serializable retry", () => {
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /const maxAttempts = 5/);
  assert.match(service, /attempt < maxAttempts/);
  assert.match(service, /!isRetryable\(error\) \|\| attempt === maxAttempts - 1/);
  assert.match(service, /tenant_id_idempotency_key/);
  assert.match(service, /request_payload_hash/);
  assert.match(service, /FOR UPDATE/);
});

test("successful allocations write one tenant-scoped reconciliation audit event", () => {
  assert.match(service, /event_type: "ALLOCATION_CREATED"/);
  assert.match(service, /target_type: "payment_allocation"/);
  assert.match(service, /target_id: row\.id/);
  assert.match(service, /idempotencyKey: input\.idempotencyKey/);
});

test("credit applications bind payment and invoice ownership inside the allocation transaction", () => {
  assert.match(service, /expectedCounterpartyId\?: string/);
  assert.match(service, /payment\.counterpartyId !== invoiceCounterpartyId/);
  assert.match(service, /payment\.counterpartyId !== input\.expectedCounterpartyId/);
  assert.match(service, /invoiceCounterpartyId !== input\.expectedCounterpartyId/);
  assert.match(actions, /expectedCounterpartyId: customerId/);
  assert.match(actions, /expectedCounterpartyId: supplierId/);
});

test("refunds and reversals write immutable reconciliation audit events", () => {
  for (const eventType of [
    "ALLOCATION_REVERSED",
    "REFUND_REQUESTED",
    "REFUND_APPROVED",
    "REFUND_REJECTED",
    "REFUND_CANCELLED",
    "REFUND_COMPLETED",
    "PAYMENT_REVERSED",
  ]) {
    assert.match(schema, new RegExp(`\\b${eventType}\\b`));
    assert.match(service, new RegExp(`"${eventType}"`));
  }
});

test("partial refunds reverse only the consumed allocation amount", () => {
  assert.doesNotMatch(service, /Refunds cannot partially reverse an allocation/);
  assert.match(service, /const reversedAmount = remaining\.compare\(allocation\.remainingAmount\) < 0/);
  assert.match(service, /sumReversals\(row\.reversal\)/);
});

test("refund lifecycle is tenant-bound, audited, idempotent, and guarded by database transitions", () => {
  for (const action of ["requestRefund", "approveRefund", "rejectRefund", "cancelRefund", "completeRefund"]) {
    assert.match(service, new RegExp(`export (?:async )?function ${action}`));
  }
  for (const action of [
    "requestCustomerRefundAction",
    "requestSupplierRefundAction",
    "approveRefundAction",
    "rejectRefundAction",
    "cancelRefundAction",
    "completeRefundAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}`));
  }
  assert.match(service, /Refund idempotency key was reused with a different action or payload/);
  assert.match(service, /lockRefundPayment/);
  assert.match(refundLifecycleMigration, /payment_refunds_lifecycle_guard/);
  assert.match(refundLifecycleMigration, /Refunds must be created as REQUESTED/);
  assert.match(refundLifecycleMigration, /Refund request facts are immutable/);
  assert.match(refundLifecycleMigration, /audit_logs_refund_lifecycle_idempotency_key/);
});

test("supplier allocation and allocation reversal do not mutate the net AP cache", () => {
  const allocation = service.slice(
    service.indexOf("export async function allocatePayment"),
    service.indexOf("export async function reverseAllocation"),
  );
  const allocationReversal = service.slice(
    service.indexOf("export async function reverseAllocation"),
    service.indexOf("type RefundAction"),
  );
  assert.doesNotMatch(allocation, /updateSupplierPayable/);
  assert.doesNotMatch(allocationReversal, /updateSupplierPayable/);
  assert.match(service, /Net supplier position|payable_balance/);
});

test("allocation reversals support multiple immutable consumption events", () => {
  assert.doesNotMatch(schema, /@@unique\(\[tenant_id, allocation_id\], map: "allocation_reversal_once"\)/);
  assert.match(schema, /@@index\(\[tenant_id, allocation_id, reversed_at\]\)/);
  assert.match(migration, /allocation_reversals/);
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
  for (const name of [
    "allocatePaymentAction",
    "reverseAllocationAction",
    "requestCustomerRefundAction",
    "requestSupplierRefundAction",
    "approveRefundAction",
    "rejectRefundAction",
    "cancelRefundAction",
    "completeRefundAction",
    "reversePaymentAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${name}`));
  }
  assert.match(actions, /requireServerTenantContext/);
  assert.match(actions, /PermissionAction\.create_payment/);
});
