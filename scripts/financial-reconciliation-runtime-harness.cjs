#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const { Client } = require("pg");

const repositoryRoot = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveFinancialAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(repositoryRoot, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "commonjs", moduleResolution: "node" });
require("ts-node/register/transpile-only");

const { allocatePayment, completeRefund, reverseAllocation, reversePayment, runReconciliationMutation } =
  require("../src/domain/services/financial-reconciliation.service.ts");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function money(value) {
  return Number(Number(value).toFixed(2));
}

async function sql(client, text, values = []) {
  return client.query(text, values);
}

async function createFixture(client, suffix) {
  const tenantA = id(`tenant_a_${suffix}`);
  const tenantB = id(`tenant_b_${suffix}`);
  const subjectA = id(`subject_a_${suffix}`);
  const subjectB = id(`subject_b_${suffix}`);
  const roleA = id("role_a");
  const roleB = id("role_b");
  const customerA = id("customer_a");
  const customerB = id("customer_b");
  const supplierA = id("supplier_a");
  const salesA = id("sales_a");
  const salesB = id("sales_b");
  const purchaseA = id("purchase_a");
  const paymentA = id("payment_a");
  const paymentB = id("payment_b");
  const paymentC = id("payment_c");
  const paymentSupplier = id("payment_supplier");
  const now = new Date();

  const params = [
    tenantA, `runtime-a-${suffix}`, "Runtime Tenant A",
    tenantB, `runtime-b-${suffix}`, "Runtime Tenant B",
    subjectA, subjectA, `runtime-a-${suffix}@example.invalid`, "Runtime A",
    subjectB, subjectB, `runtime-b-${suffix}@example.invalid`, "Runtime B",
    roleA, roleB, id("membership_a"), id("membership_b"),
    customerA, customerB, supplierA, salesA, now, salesB, purchaseA,
    paymentA, id("payment_a_key"), "fixture", paymentB, id("payment_b_key"),
    "fixture", paymentC, id("payment_c_key"), "fixture",
    paymentSupplier, id("payment_supplier_key"), "fixture",
  ];
  await sql(client, `INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, $7), ($4, $5, $6, $7)`, [...params.slice(0, 6), params[22]]);
  await sql(client, `INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1, $2, $3, $4, $9), ($5, $6, $7, $8, $9)`, [...params.slice(6, 14), params[22]]);
  await sql(client, `INSERT INTO roles (id, tenant_id, name, updated_at) VALUES ($1, $2, 'runtime-harness-a', $5), ($3, $4, 'runtime-harness-b', $5)`, [params[14], params[0], params[15], params[3], params[22]]);
  await sql(client, `INSERT INTO memberships (id, tenant_id, user_id, role_id, status, updated_at) VALUES ($1, $2, $3, $4, 'active', $9), ($5, $6, $7, $8, 'active', $9)`, [params[16], params[0], params[6], params[14], params[17], params[3], params[10], params[15], params[22]]);
  await sql(client, `INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at) VALUES ($1, $2, 'Runtime Customer A', 0, $5), ($3, $4, 'Runtime Customer B', 0, $5)`, [params[18], params[0], params[19], params[3], params[22]]);
  await sql(client, `INSERT INTO suppliers (id, tenant_id, business_name, payable_balance, updated_at) VALUES ($1, $2, 'Runtime Supplier A', 0, $3)`, [params[20], params[0], params[22]]);
  await sql(client, `
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at
    ) VALUES
      ($1, $2, 'RUNTIME-SALES-A', $3, $4, $4, 'FINALIZED', 1000, 1000, 0, 1000, $4, $5),
      ($6, $2, 'RUNTIME-SALES-B', $3, $4, $4, 'FINALIZED', 600, 600, 0, 600, $4, $5)
  `, [params[21], params[0], params[18], params[22], params[22], params[23]]);
  await sql(client, `
    INSERT INTO purchase_invoices (
      id, tenant_id, invoice_no, supplier_id, invoice_date, due_date, status,
      gross_amount, net_amount, finalized_at, updated_at
    ) VALUES ($1, $2, 'RUNTIME-PURCHASE-A', $3, $4, $4, 'FINALIZED', 1200, 1200, $4, $5)
  `, [params[24], params[0], params[20], params[22], params[22]]);
  await sql(client, `
    INSERT INTO payments (
      id, tenant_id, customer_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by
    ) VALUES
      ($1, $2, $3, 'PAYMENT_RECEIVED', 1000, $4, $6, $7, $5),
      ($8, $2, $3, 'PAYMENT_RECEIVED', 600, $4, $9, $10, $5),
      ($11, $2, $3, 'PAYMENT_RECEIVED', 200, $4, $12, $13, $5)
  `, [params[25], params[0], params[18], params[22], params[6], params[26], params[27], params[28], params[29], params[30], params[31], params[32], params[33]]);
  await sql(client, `
    INSERT INTO payments (
      id, tenant_id, supplier_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by
    ) VALUES ($1, $2, $3, 'PAYMENT_MADE', 1200, $4, $6, $7, $5)
  `, [params[34], params[0], params[20], params[22], params[6], params[35], params[36]]);
  /*
  await sql(client, `
    INSERT INTO tenants (id, slug, business_name) VALUES
      ($1, $2, $3), ($4, $5, $6);
    INSERT INTO users (id, external_id, email, full_name) VALUES
      ($7, $8, $9, $10), ($11, $12, $13, $14);
    INSERT INTO roles (id, tenant_id, name) VALUES
      ($15, $1, 'runtime-harness-a'), ($16, $4, 'runtime-harness-b');
    INSERT INTO memberships (id, tenant_id, user_id, role_id, status) VALUES
      ($17, $1, $7, $15, 'active'), ($18, $4, $11, $16, 'active');
    INSERT INTO customers (id, tenant_id, name, receivable_balance) VALUES
      ($19, $1, 'Runtime Customer A', 0), ($20, $4, 'Runtime Customer B', 0);
    INSERT INTO suppliers (id, tenant_id, name, payable_balance) VALUES
      ($21, $1, 'Runtime Supplier A', 0);
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at
    ) VALUES
      ($22, $1, 'RUNTIME-SALES-A', $19, $23, $23, 'FINALIZED', 1000, 1000, 0, 1000, $23),
      ($24, $1, 'RUNTIME-SALES-B', $19, $23, $23, 'FINALIZED', 600, 600, 0, 600, $23);
    INSERT INTO purchase_invoices (
      id, tenant_id, invoice_no, supplier_id, invoice_date, due_date, status,
      gross_amount, net_amount, finalized_at
    ) VALUES
      ($25, $1, 'RUNTIME-PURCHASE-A', $21, $23, $23, 'FINALIZED', 1200, 1200, $23);
    INSERT INTO payments (
      id, tenant_id, customer_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by
    ) VALUES
      ($26, $1, $19, 'PAYMENT_RECEIVED', 1000, $23, $27, $28, $7),
      ($29, $1, $19, 'PAYMENT_RECEIVED', 600, $23, $30, $31, $7),
      ($32, $1, $19, 'PAYMENT_RECEIVED', 200, $23, $33, $34, $7);
    INSERT INTO payments (
      id, tenant_id, supplier_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by
    ) VALUES
      ($35, $1, $21, 'PAYMENT_MADE', 1200, $23, $36, $37, $7);
  `, [
    tenantA, `runtime-a-${suffix}`, "Runtime Tenant A",
    tenantB, `runtime-b-${suffix}`, "Runtime Tenant B",
    subjectA, subjectA, `runtime-a-${suffix}@example.invalid`, "Runtime A",
    subjectB, subjectB, `runtime-b-${suffix}@example.invalid`, "Runtime B",
    roleA, roleB, id("membership_a"), id("membership_b"),
    customerA, customerB, supplierA, salesA, now, salesB, purchaseA,
    paymentA, id("payment_a_key"), "fixture", paymentB, id("payment_b_key"),
    "fixture", paymentSupplier, id("payment_supplier_key"), "fixture",
    id("payment_supplier_key"), "fixture",
  ]); */
  return {
    tenants: { a: tenantA, b: tenantB },
    subjects: { a: subjectA, b: subjectB },
    customers: { a: customerA, b: customerB },
    supplier: supplierA,
    invoices: { salesA, salesB, purchaseA },
    payments: { a: paymentA, b: paymentB, supplier: paymentSupplier },
  };
}

function context(fixture, tenant = "a") {
  return {
    tenantId: fixture.tenants[tenant],
    subjectId: fixture.subjects[tenant],
    actorId: fixture.subjects[tenant],
  };
}

function allocationInput(fixture, overrides = {}) {
  return {
    ...context(fixture),
    paymentId: fixture.payments.a,
    invoiceId: fixture.invoices.salesA,
    invoiceKind: "sales",
    amount: 400,
    idempotencyKey: id("allocation"),
    ...overrides,
  };
}

async function readState(client, fixture) {
  const result = await sql(client, `
    SELECT
      (SELECT COALESCE(sum(amount), 0) FROM payments WHERE tenant_id = $1) AS payments,
      (SELECT COALESCE(sum(amount), 0) FROM payment_allocations WHERE tenant_id = $1) AS allocations,
      (SELECT COALESCE(sum(amount), 0) FROM payment_refunds WHERE tenant_id = $1 AND status = 'COMPLETED') AS refunds,
      (SELECT COALESCE(sum(amount), 0) FROM payment_reversals WHERE tenant_id = $1) AS reversals,
      (SELECT count(*) FROM allocation_reversals WHERE tenant_id = $1) AS allocation_reversals,
      (SELECT paid_amount FROM sales_invoices WHERE tenant_id = $1 AND id = $2) AS sales_paid,
      (SELECT balance_due FROM sales_invoices WHERE tenant_id = $1 AND id = $2) AS sales_due
  `, [fixture.tenants.a, fixture.invoices.salesA]);
  const row = result.rows[0];
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

async function run() {
  const bootstrap = new Client({ connectionString: required("TEST_DATABASE_URL"), application_name: "pharmnos-financial-reconciliation-harness-bootstrap" });
  const runtime = new Client({ connectionString: required("FINANCIAL_E2E_RUNTIME_DATABASE_URL"), application_name: "pharmnos-financial-reconciliation-harness-runtime" });
  await bootstrap.connect();
  await runtime.connect();
  const fixture = await createFixture(bootstrap, process.env.FINANCIAL_E2E_RUN_ID ?? "runtime");
  const results = [];
  const record = (id, status, operation, details = {}) => results.push({ id, status, operation, ...details });
  try {
    const firstInput = allocationInput(fixture);
    const first = await allocatePayment(firstInput);
    const replayInput = allocationInput(fixture, { amount: 400, idempotencyKey: firstInput.idempotencyKey });
    const replay = await allocatePayment(replayInput).catch(() => null);
    const stateAfterAllocation = await readState(bootstrap, fixture);
    record("S-02", replay?.replayed === true ? "PASS" : "FAIL", "allocatePayment", { persisted: stateAfterAllocation, allocationId: first.id });

    const conflict = await allocatePayment(allocationInput(fixture, { amount: 401, idempotencyKey: replayInput.idempotencyKey })).then(() => false).catch(() => true);
    record("S-03", conflict ? "PASS" : "FAIL", "conflicting idempotency payload rejected");

    const reversed = await reverseAllocation({ ...context(fixture), allocationId: first.id, idempotencyKey: id("allocation-reversal") });
    const afterReversal = await readState(bootstrap, fixture);
    record("S-14", afterReversal.allocation_reversals === 1 && afterReversal.sales_paid === 0 ? "PASS" : "FAIL", "reverseAllocation", { persisted: afterReversal, reversalId: reversed.id });

    const refund = await completeRefund({ ...context(fixture), paymentId: fixture.payments.b, amount: 200, idempotencyKey: id("refund") });
    const refundState = await readState(bootstrap, fixture);
    record("S-11", refundState.refunds === 200 ? "PASS" : "FAIL", "completeRefund", { persisted: refundState, refundId: refund.id });

    const supplier = await allocatePayment({
      ...context(fixture),
      paymentId: fixture.payments.supplier,
      invoiceId: fixture.invoices.purchaseA,
      invoiceKind: "purchase",
      amount: 600,
      idempotencyKey: id("supplier-allocation"),
    });
    record("S-05", supplier.id ? "PASS" : "FAIL", "supplier allocation");

    const crossTenant = await allocatePayment(allocationInput(fixture, {
      tenantId: fixture.tenants.b,
      subjectId: fixture.subjects.b,
      paymentId: fixture.payments.a,
    })).then(() => false).catch(() => true);
    record("S-27", crossTenant ? "PASS" : "FAIL", "cross-tenant allocation rejected");

    const racePayment = fixture.payments.a;
    const race = await Promise.allSettled([
      allocatePayment(allocationInput(fixture, { paymentId: racePayment, amount: 700, idempotencyKey: id("race-a"), invoiceId: fixture.invoices.salesB })),
      allocatePayment(allocationInput(fixture, { paymentId: racePayment, amount: 700, idempotencyKey: id("race-b"), invoiceId: fixture.invoices.salesB })),
    ]);
    const raceState = await readState(bootstrap, fixture);
    const raceWrites = race.filter((entry) => entry.status === "fulfilled").length;
    record("S-29", raceWrites <= 1 ? "PASS" : "FAIL", "concurrent competing allocations", { fulfilled: raceWrites, persisted: raceState });

    const beforeRollback = await sql(bootstrap, "SELECT count(*)::int AS count FROM payment_allocations WHERE tenant_id = $1", [fixture.tenants.a]);
    await runReconciliationMutation({ ...context(fixture), userId: fixture.subjects.a, membershipId: fixture.subjects.a, roles: [], permissions: [] }, async (tx) => {
      await tx.payment_allocations.create({
        data: {
          tenant_id: fixture.tenants.a,
          payment_id: fixture.payments.a,
          sales_invoice_id: fixture.invoices.salesB,
          amount: 1,
          idempotency_key: id("rollback"),
          request_payload_hash: "rollback",
        },
      });
      throw new Error("controlled rollback");
    }).then(() => null).catch(() => null);
    const afterRollback = await sql(bootstrap, "SELECT count(*)::int AS count FROM payment_allocations WHERE tenant_id = $1", [fixture.tenants.a]);
    record("S-16", Number(beforeRollback.rows[0].count) === Number(afterRollback.rows[0].count) ? "PASS" : "FAIL", "controlled transaction rollback");

    const unsupported = [
      "S-01", "S-04", "S-06", "S-07", "S-08", "S-09", "S-10", "S-12", "S-13",
      "S-15", "S-17", "S-18", "S-19", "S-20", "S-21", "S-22", "S-23", "S-24",
      "S-25", "S-26", "S-28", "S-30", "S-31", "S-32", "S-33", "S-34", "S-35",
      "S-36", "S-37", "S-38",
    ];
    for (const scenarioId of unsupported) {
      record(scenarioId, "BLOCKED", "No application boundary for the matrix operation or independent as-of/audit assertion");
    }

    const evidence = {
      campaign: "Financial Reconciliation - Runtime Scenario Harness",
      target: "run-scoped disposable PostgreSQL only",
      fixture: { tenants: fixture.tenants },
      results,
      summary: {
        pass: results.filter((result) => result.status === "PASS").length,
        fail: results.filter((result) => result.status === "FAIL").length,
        blocked: results.filter((result) => result.status === "BLOCKED").length,
      },
      note: "Blocked scenarios are not credited as verified. Credentials and full connection strings are intentionally excluded.",
    };
    const output = process.env.FINANCIAL_E2E_SUITE_EVIDENCE_FILE;
    if (output) fs.writeFileSync(path.resolve(repositoryRoot, output), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify(evidence.summary));
  } finally {
    await runtime.end();
    await bootstrap.end();
  }
}

run().catch((error) => {
  console.error(`FINANCIAL_RECONCILIATION_HARNESS=FAIL: ${error.message}`);
  process.exitCode = 1;
});
