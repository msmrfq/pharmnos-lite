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

const {
  allocatePayment,
  approveRefund,
  cancelRefund,
  completeRefund,
  rejectRefund,
  requestRefund,
  reverseAllocation,
  reversePayment,
  runReconciliationMutation,
} =
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
  const salesTenantB = id("sales_tenant_b");
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
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at
    ) VALUES ($1, $2, 'RUNTIME-SALES-TENANT-B', $3, $4, $4, 'FINALIZED', 600, 600, 0, 600, $4, $5)
  `, [salesTenantB, tenantB, customerB, now, now]);
  await sql(client, `
    INSERT INTO purchase_invoices (
      id, tenant_id, invoice_no, supplier_id, invoice_date, due_date, status,
      gross_amount, net_amount, finalized_at, updated_at
    ) VALUES ($1, $2, 'RUNTIME-PURCHASE-A', $3, $4, $4, 'FINALIZED', 600, 600, $4, $5)
  `, [params[24], params[0], params[20], params[22], params[22]]);
  await sql(client, `
    INSERT INTO payments (
      id, tenant_id, customer_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by
    ) VALUES
      ($1, $2, $3, 'PAYMENT_RECEIVED', 1000, $4, $6, $7, $5),
      ($8, $2, $3, 'PAYMENT_RECEIVED', 600, $4, $9, $10, $5),
      ($11, $2, $3, 'PAYMENT_RECEIVED', 1000, $4, $12, $13, $5)
  `, [params[25], params[0], params[18], params[22], params[6], params[26], params[27], params[28], params[29], params[30], params[31], params[32], params[33]]);
  await sql(client, `
    INSERT INTO payments (
      id, tenant_id, supplier_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by
    ) VALUES ($1, $2, $3, 'PAYMENT_MADE', 600, $4, $6, $7, $5)
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
      ($25, $1, 'RUNTIME-PURCHASE-A', $21, $23, $23, 'FINALIZED', 2000, 2000, $23);
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
    invoices: { salesA, salesB, salesTenantB, purchaseA },
    payments: { a: paymentA, b: paymentB, c: paymentC, supplier: paymentSupplier },
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

async function requestAndApproveRefund(fixture, paymentId, amount, counterpartyKind, counterpartyId, prefix, onTransition) {
  const requestKey = id(`${prefix}-request`);
  const requestInput = {
    ...context(fixture),
    paymentId,
    counterpartyKind,
    counterpartyId,
    amount,
    idempotencyKey: requestKey,
  };
  const request = await requestRefund(requestInput);
  const requestReplay = await requestRefund(requestInput);
  if (onTransition) await onTransition("requested", request.id);
  const approvalInput = {
    ...context(fixture),
    refundId: request.id,
    idempotencyKey: id(`${prefix}-approval`),
  };
  const approval = await approveRefund(approvalInput);
  const approvalReplay = await approveRefund(approvalInput);
  if (onTransition) await onTransition("approved", request.id);
  return { request, requestReplay, requestInput, approval, approvalReplay, approvalInput };
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

async function readPaymentState(client, fixture, paymentId, invoiceId) {
  const result = await sql(client, `
    SELECT
      (SELECT amount FROM payments WHERE tenant_id = $1 AND id = $2) AS payment_amount,
      (SELECT COALESCE(sum(pa.amount - COALESCE(reversed.total, 0)), 0)
         FROM payment_allocations pa
         LEFT JOIN LATERAL (
           SELECT sum(ar.amount) AS total FROM allocation_reversals ar
           WHERE ar.tenant_id = pa.tenant_id AND ar.allocation_id = pa.id
         ) reversed ON true
         WHERE pa.tenant_id = $1 AND pa.payment_id = $2) AS active_allocations,
      (SELECT COALESCE(sum(amount), 0) FROM payment_refunds
         WHERE tenant_id = $1 AND payment_id = $2 AND status = 'COMPLETED') AS refunds,
      (SELECT COALESCE(sum(amount), 0) FROM payment_reversals
         WHERE tenant_id = $1 AND payment_id = $2) AS payment_reversals,
      (SELECT COALESCE(sum(ar.amount), 0) FROM allocation_reversals ar
         JOIN payment_allocations pa ON pa.tenant_id = ar.tenant_id AND pa.id = ar.allocation_id
         WHERE ar.tenant_id = $1 AND pa.payment_id = $2) AS allocation_reversals,
      (SELECT paid_amount FROM sales_invoices WHERE tenant_id = $1 AND id = $3) AS invoice_paid,
      (SELECT balance_due FROM sales_invoices WHERE tenant_id = $1 AND id = $3) AS invoice_due
  `, [fixture.tenants.a, paymentId, invoiceId]);
  const row = result.rows[0];
  const paymentAmount = Number(row.payment_amount);
  const activeAllocations = Number(row.active_allocations);
  const refunds = Number(row.refunds);
  const paymentReversals = Number(row.payment_reversals);
  return {
    paymentAmount,
    activeAllocations,
    refunds,
    paymentReversals,
    allocationReversals: Number(row.allocation_reversals),
    invoicePaid: Number(row.invoice_paid),
    invoiceDue: Number(row.invoice_due),
    usable: money(paymentAmount - activeAllocations - refunds - paymentReversals),
  };
}

async function readSupplierState(client, fixture, paymentId, invoiceId) {
  const result = await sql(client, `
    SELECT
      (SELECT amount FROM payments WHERE tenant_id = $1 AND id = $2) AS payment_amount,
      (SELECT COALESCE(sum(pa.amount - COALESCE(reversed.total, 0)), 0)
         FROM payment_allocations pa
         LEFT JOIN LATERAL (
           SELECT sum(ar.amount) AS total FROM allocation_reversals ar
           WHERE ar.tenant_id = pa.tenant_id AND ar.allocation_id = pa.id
         ) reversed ON true
         WHERE pa.tenant_id = $1 AND pa.payment_id = $2) AS active_allocations,
      (SELECT COALESCE(sum(amount), 0) FROM payment_refunds
       WHERE tenant_id = $1 AND payment_id = $2 AND status = 'COMPLETED') AS refunds,
      (SELECT COALESCE(sum(amount), 0) FROM payment_reversals
       WHERE tenant_id = $1 AND payment_id = $2) AS payment_reversals,
      (SELECT net_amount FROM purchase_invoices WHERE tenant_id = $1 AND id = $3) AS invoice_amount,
      (SELECT payable_balance FROM suppliers WHERE tenant_id = $1 AND id = $4) AS supplier_payable,
      (SELECT count(*) FROM payment_allocations
       WHERE tenant_id = $1 AND payment_id = $2 AND purchase_invoice_id = $3) AS allocation_count
  `, [fixture.tenants.a, paymentId, invoiceId, fixture.supplier]);
  const row = result.rows[0];
  const paymentAmount = Number(row.payment_amount);
  const activeAllocations = Number(row.active_allocations);
  const refunds = Number(row.refunds);
  const paymentReversals = Number(row.payment_reversals);
  const usable = money(paymentAmount - activeAllocations - refunds - paymentReversals);
  const invoiceDue = money(Number(row.invoice_amount) - activeAllocations);
  return {
    paymentAmount,
    activeAllocations,
    refunds,
    paymentReversals,
    usable,
    supplierAdvance: usable,
    invoiceDue,
    netAP: money(invoiceDue - usable),
    supplierPayable: Number(row.supplier_payable),
    allocationCount: Number(row.allocation_count),
  };
}

async function readAuditState(client, fixture, tenantId = fixture.tenants.a) {
  const result = await sql(client, `
    SELECT count(*)::int AS count
    FROM audit_logs
    WHERE tenant_id = $1
  `, [tenantId]);
  return { count: Number(result.rows[0].count) };
}

async function readTenantFinancialRowCounts(client, fixture) {
  return (await sql(client, `
    SELECT
      (SELECT count(*) FROM payment_allocations WHERE tenant_id IN ($1, $2)) AS allocations,
      (SELECT count(*) FROM payment_refunds WHERE tenant_id IN ($1, $2)) AS refunds,
      (SELECT count(*) FROM customer_ledgers WHERE tenant_id IN ($1, $2)) AS customer_ledgers,
      (SELECT count(*) FROM supplier_ledgers WHERE tenant_id IN ($1, $2)) AS supplier_ledgers
  `, [fixture.tenants.a, fixture.tenants.b])).rows[0];
}

async function readAllocationAuditState(client, fixture, allocationId) {
  const result = await sql(client, `
    SELECT count(*)::int AS count
    FROM audit_logs
    WHERE tenant_id = $1
      AND event_type = 'ALLOCATION_CREATED'
      AND target_type = 'payment_allocation'
      AND target_id = $2
  `, [fixture.tenants.a, allocationId]);
  return { count: Number(result.rows[0].count) };
}

async function exerciseRefundTerminalTransitions(client, fixture, kind) {
  const paymentId = kind === "customer" ? fixture.payments.b : fixture.payments.supplier;
  const counterpartyId = kind === "customer" ? fixture.customers.a : fixture.supplier;
  const financialState = () => kind === "customer"
    ? readPaymentState(client, fixture, paymentId, fixture.invoices.salesA)
    : readSupplierState(client, fixture, paymentId, fixture.invoices.purchaseA);
  const ledger = await sql(client, `
    SELECT
      (SELECT count(*)::int FROM customer_ledgers WHERE tenant_id = $1) AS customer_rows,
      (SELECT count(*)::int FROM supplier_ledgers WHERE tenant_id = $1) AS supplier_rows
  `, [fixture.tenants.a]);
  const before = await financialState();
  const transitions = [];
  for (const terminal of ["REJECTED", "CANCELLED", "APPROVED_CANCELLED"]) {
    const requestInput = {
      ...context(fixture), paymentId, counterpartyKind: kind, counterpartyId,
      amount: 25, idempotencyKey: id(`${kind}-${terminal}-request`),
    };
    const requested = await requestRefund(requestInput);
    const requestReplay = await requestRefund(requestInput);
    const premature = await completeRefund({
      ...context(fixture), refundId: requested.id, idempotencyKey: id("premature-complete"),
    }).then(() => null, (error) => error.message);
    let approvalReplay = null;
    if (terminal === "APPROVED_CANCELLED") {
      const approvalInput = {
        ...context(fixture), refundId: requested.id, idempotencyKey: id("terminal-approval"),
      };
      await approveRefund(approvalInput);
      approvalReplay = await approveRefund(approvalInput);
    }
    const transitionInput = {
      ...context(fixture), refundId: requested.id, idempotencyKey: id("terminal-transition"),
    };
    const transition = terminal === "REJECTED" ? rejectRefund : cancelRefund;
    const result = await transition(transitionInput);
    const replay = await transition(transitionInput);
    const invalid = await approveRefund({
      ...context(fixture), refundId: requested.id, idempotencyKey: id("terminal-invalid"),
    }).then(() => null, (error) => error.message);
    const crossTenant = await cancelRefund({
      ...context(fixture, "b"), refundId: requested.id, idempotencyKey: id("terminal-cross-tenant"),
    }).then(() => null, (error) => error.message);
    const persisted = await sql(client, `
      SELECT r.status,
        (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = r.tenant_id
          AND a.target_type = 'payment_refund' AND a.target_id = r.id) AS audit_rows
      FROM payment_refunds r WHERE r.tenant_id = $1 AND r.id = $2
    `, [fixture.tenants.a, requested.id]);
    transitions.push({
      terminal, requestReplay: requestReplay.replayed, approvalReplay: approvalReplay?.replayed ?? null,
      transitionReplay: replay.replayed, matchingId: result.id === requested.id && replay.id === requested.id,
      premature, invalid, crossTenant, persisted: persisted.rows[0],
    });
  }
  const after = await financialState();
  const afterLedger = await sql(client, `
    SELECT
      (SELECT count(*)::int FROM customer_ledgers WHERE tenant_id = $1) AS customer_rows,
      (SELECT count(*)::int FROM supplier_ledgers WHERE tenant_id = $1) AS supplier_rows
  `, [fixture.tenants.a]);
  const passed = JSON.stringify(before) === JSON.stringify(after) &&
    JSON.stringify(ledger.rows[0]) === JSON.stringify(afterLedger.rows[0]) &&
    transitions.every((entry) =>
      entry.requestReplay && entry.transitionReplay && entry.matchingId &&
      entry.premature && entry.invalid && entry.crossTenant &&
      entry.persisted?.status === (entry.terminal === "REJECTED" ? "REJECTED" : "CANCELLED") &&
      entry.persisted.audit_rows === (entry.terminal === "APPROVED_CANCELLED" ? 3 : 2) &&
      (entry.terminal !== "APPROVED_CANCELLED" || entry.approvalReplay));
  return { passed, before, after, ledgerBefore: ledger.rows[0], ledgerAfter: afterLedger.rows[0], transitions };
}

async function exerciseCustomerAdvanceAllocation(client, fixture, scenario, amount) {
  const prefix = scenario.toLowerCase().replace("-", "");
  const customerId = id(`${prefix}_customer`);
  const invoiceId = id(`${prefix}_invoice`);
  const paymentId = id(`${prefix}_payment`);
  const now = new Date();
  await sql(client, `
    INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at)
    VALUES ($1, $2, $4, 300, $3)
  `, [customerId, fixture.tenants.a, now, `${scenario} customer`]);
  await sql(client, `
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5, 'FINALIZED', 800, 800, 0, 800, $5, $5)
  `, [invoiceId, fixture.tenants.a, id(`${prefix}_invoice_no`), customerId, now]);
  await sql(client, `
    INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by)
    VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', 500, $4, $5, 'fixture', $6)
  `, [paymentId, fixture.tenants.a, customerId, now, id(`${prefix}_payment_key`), fixture.subjects.a]);
  const input = {
    ...context(fixture), paymentId, invoiceId, invoiceKind: "sales",
    amount, idempotencyKey: id(`${prefix}_allocation`),
  };
  const before = await readPaymentState(client, fixture, paymentId, invoiceId);
  const allocation = await allocatePayment(input);
  const replay = await allocatePayment(input);
  const after = await readPaymentState(client, fixture, paymentId, invoiceId);
  const persisted = await sql(client, `
    SELECT c.receivable_balance,
      (SELECT count(*)::int FROM payment_allocations p WHERE p.tenant_id = $1 AND p.payment_id = $2) AS allocations,
      (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = $1 AND a.target_type = 'payment_allocation'
        AND a.target_id = $3 AND a.event_type = 'ALLOCATION_CREATED') AS audit_rows
    FROM customers c WHERE c.tenant_id = $1 AND c.id = $4
  `, [fixture.tenants.a, paymentId, allocation.id, customerId]);
  const row = persisted.rows[0];
  const passed = before.paymentAmount === 500 && before.activeAllocations === 0 &&
    before.usable === 500 && before.invoiceDue === 800 &&
    after.paymentAmount === 500 && after.activeAllocations === amount && after.usable === 500 - amount &&
    after.refunds === 0 && after.paymentReversals === 0 && after.invoiceDue === 800 - amount &&
    after.invoicePaid === amount && after.invoiceDue - after.usable === 300 &&
    replay.replayed === true && replay.id === allocation.id &&
    Number(row?.receivable_balance) === 300 && row?.allocations === 1 && row?.audit_rows === 1;
  return {
    passed, before, after, persisted: row, allocationId: allocation.id, replay,
    refundable: after.paymentAmount - after.refunds - after.paymentReversals,
    initialRefundable: before.paymentAmount - before.refunds - before.paymentReversals,
    boundary: "reconciliation service with synthetic persisted fixture and restricted application role",
  };
}

async function exerciseSupplierAdvanceAllocation(client, fixture, scenario) {
  const prefix = scenario.toLowerCase().replace("-", "");
  const supplierId = id(`${prefix}_supplier`);
  const invoiceId = id(`${prefix}_invoice`);
  const paymentId = id(`${prefix}_payment`);
  const now = new Date();
  const invoiceAmount = scenario === "S-34" ? 1400 : scenario === "S-35" ? 1000 : 2000;
  const initialNet = invoiceAmount - 1000;
  await sql(client, `
    INSERT INTO suppliers (id, tenant_id, business_name, payable_balance, updated_at)
    VALUES ($1, $2, $3, $5, $4)
  `, [supplierId, fixture.tenants.a, `${scenario} supplier`, now, initialNet]);
  await sql(client, `
    INSERT INTO purchase_invoices (
      id, tenant_id, invoice_no, supplier_id, invoice_date, due_date, status,
      gross_amount, net_amount, finalized_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5, 'FINALIZED', $6, $6, $5, $5)
  `, [invoiceId, fixture.tenants.a, id(`${prefix}_invoice_no`), supplierId, now, invoiceAmount]);
  await sql(client, `
    INSERT INTO payments (id, tenant_id, supplier_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by)
    VALUES ($1, $2, $3, 'PAYMENT_MADE', 1000, $4, $5, 'fixture', $6)
  `, [paymentId, fixture.tenants.a, supplierId, now, id(`${prefix}_payment_key`), fixture.subjects.a]);
  const localFixture = { ...fixture, supplier: supplierId };
  const input = {
    ...context(fixture), paymentId, invoiceId, invoiceKind: "purchase",
    amount: scenario === "S-06" ? 400 : scenario === "S-35" ? 1000 : 600,
    idempotencyKey: id(`${prefix}_allocation`),
  };
  if (scenario === "S-06") {
    await allocatePayment({ ...input, amount: 600, idempotencyKey: id(`${prefix}_prior`) });
  }
  const before = await readSupplierState(client, localFixture, paymentId, invoiceId);
  const allocation = await allocatePayment(input);
  const replay = await allocatePayment(input);
  const overAllocation = scenario === "S-06"
    ? await allocatePayment({ ...input, amount: 1, idempotencyKey: id(`${prefix}_excess`) })
      .then(() => null, (error) => error.message)
    : null;
  const after = await readSupplierState(client, localFixture, paymentId, invoiceId);
  const audit = await readAllocationAuditState(client, fixture, allocation.id);
  const priorAllocation = scenario === "S-06" ? 600 : 0;
  const total = priorAllocation + input.amount;
  const passed = before.paymentAmount === 1000 && before.activeAllocations === priorAllocation &&
    before.invoiceDue === invoiceAmount - priorAllocation && before.usable === 1000 - priorAllocation &&
    before.netAP === initialNet && before.supplierPayable === initialNet &&
    after.activeAllocations === total && after.invoiceDue === invoiceAmount - total &&
    after.usable === 1000 - total && after.netAP === initialNet && after.supplierPayable === initialNet &&
    after.refunds === 0 && after.paymentReversals === 0 &&
    after.allocationCount === (scenario === "S-06" ? 2 : 1) &&
    replay.replayed === true && replay.id === allocation.id && audit.count === 1 &&
    (scenario !== "S-06" || Boolean(overAllocation));
  return {
    passed, before, after, allocationId: allocation.id, replay, audit, overAllocation,
    refundable: after.paymentAmount - after.refunds - after.paymentReversals,
    boundary: "reconciliation service with synthetic persisted fixture and restricted application role",
  };
}

async function exerciseUnappliedRefund(client, fixture, kind) {
  const isCustomer = kind === "customer";
  const scenario = isCustomer ? "S-11" : "S-36";
  const amount = isCustomer ? 200 : 300;
  const counterpartyId = id(`${kind}_unapplied`);
  const paymentId = id(`${kind}_unapplied_payment`);
  const now = new Date();
  if (isCustomer) {
    await sql(client, `
      INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at)
      VALUES ($1, $2, 'S-11 customer', -200, $3)
    `, [counterpartyId, fixture.tenants.a, now]);
    await sql(client, `
      INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
        idempotency_key, request_payload_hash, created_by)
      VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', $4, $5, $6, 'fixture', $7)
    `, [paymentId, fixture.tenants.a, counterpartyId, amount, now, id("s11_payment"), fixture.subjects.a]);
  } else {
    await sql(client, `
      INSERT INTO suppliers (id, tenant_id, business_name, payable_balance, updated_at)
      VALUES ($1, $2, 'S-36 supplier', -300, $3)
    `, [counterpartyId, fixture.tenants.a, now]);
    await sql(client, `
      INSERT INTO payments (id, tenant_id, supplier_id, entry_type, amount, payment_date,
        idempotency_key, request_payload_hash, created_by)
      VALUES ($1, $2, $3, 'PAYMENT_MADE', $4, $5, $6, 'fixture', $7)
    `, [paymentId, fixture.tenants.a, counterpartyId, amount, now, id("s36_payment"), fixture.subjects.a]);
  }
  const lifecycle = await requestAndApproveRefund(
    fixture, paymentId, amount, kind, counterpartyId, `${kind}-unapplied`,
  );
  const completionInput = {
    ...context(fixture), refundId: lifecycle.request.id, idempotencyKey: id(`${kind}_unapplied_complete`),
  };
  const completion = await completeRefund(completionInput);
  const replay = await completeRefund(completionInput);
  const financial = await sql(client, `
    SELECT p.amount, r.amount AS refunded, r.status, r.payment_id,
      (SELECT count(*)::int FROM payment_allocations a WHERE a.tenant_id = p.tenant_id AND a.payment_id = p.id) AS allocations,
      (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = p.tenant_id
        AND a.target_type = 'payment_refund' AND a.target_id = r.id) AS audit_rows
    FROM payments p JOIN payment_refunds r ON r.tenant_id = p.tenant_id AND r.payment_id = p.id
    WHERE p.tenant_id = $1 AND p.id = $2 AND r.id = $3
  `, [fixture.tenants.a, paymentId, completion.id]);
  const posting = isCustomer
    ? await sql(client, `
      SELECT c.receivable_balance AS balance, count(l.id)::int AS ledger_rows,
        COALESCE(sum(l.debit), 0) AS posting_amount
      FROM customers c LEFT JOIN customer_ledgers l ON l.tenant_id = c.tenant_id
        AND l.customer_id = c.id AND l.reference_type = 'payment_refund' AND l.reference_id = $3
      WHERE c.tenant_id = $1 AND c.id = $2 GROUP BY c.receivable_balance
    `, [fixture.tenants.a, counterpartyId, completion.id])
    : await sql(client, `
      SELECT s.payable_balance AS balance, count(l.id)::int AS ledger_rows,
        COALESCE(sum(l.credit), 0) AS posting_amount
      FROM suppliers s LEFT JOIN supplier_ledgers l ON l.tenant_id = s.tenant_id
        AND l.supplier_id = s.id AND l.reference_type = 'payment_refund' AND l.reference_id = $3
      WHERE s.tenant_id = $1 AND s.id = $2 GROUP BY s.payable_balance
    `, [fixture.tenants.a, counterpartyId, completion.id]);
  const row = financial.rows[0];
  const ledger = posting.rows[0];
  const passed = Number(row?.amount) === amount && Number(row?.refunded) === amount &&
    row?.status === "COMPLETED" && row?.payment_id === paymentId && row?.allocations === 0 &&
    row?.audit_rows === 3 && Number(ledger?.balance) === 0 && ledger?.ledger_rows === 1 &&
    Number(ledger?.posting_amount) === amount && replay.replayed === true && replay.id === completion.id;
  return { scenario, passed, financial: row, ledger, replay, paymentId, refundId: completion.id,
    usable: Number(row?.amount) - Number(row?.refunded),
    boundary: "reconciliation service with synthetic persisted fixture and restricted application role" };
}

async function exerciseAllocatedCustomerRefund(client, fixture, scenario) {
  const prefix = scenario.toLowerCase().replace("-", "");
  const customerId = id(`${prefix}_customer`);
  const invoiceId = id(`${prefix}_invoice`);
  const paymentId = id(`${prefix}_payment`);
  const amount = scenario === "S-13" ? 1000 : 200;
  const now = new Date();
  await sql(client, `
    INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at)
    VALUES ($1, $2, $3, 0, $4)
  `, [customerId, fixture.tenants.a, `${scenario} customer`, now]);
  await sql(client, `
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5, 'FINALIZED', 1000, 1000, 0, 1000, $5, $5)
  `, [invoiceId, fixture.tenants.a, id(`${prefix}_invoice_no`), customerId, now]);
  await sql(client, `
    INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by)
    VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', 1000, $4, $5, 'fixture', $6)
  `, [paymentId, fixture.tenants.a, customerId, now, id(`${prefix}_payment_key`), fixture.subjects.a]);
  const allocation = await allocatePayment({
    ...context(fixture), paymentId, invoiceId, invoiceKind: "sales",
    amount: 1000, idempotencyKey: id(`${prefix}_allocation`),
  });
  const before = await readPaymentState(client, fixture, paymentId, invoiceId);
  const lifecycle = await requestAndApproveRefund(fixture, paymentId, amount, "customer", customerId, prefix);
  const completionInput = {
    ...context(fixture), refundId: lifecycle.request.id, idempotencyKey: id(`${prefix}_completion`),
  };
  const completion = await completeRefund(completionInput);
  const beforeReplay = await readPaymentState(client, fixture, paymentId, invoiceId);
  const replay = await completeRefund(completionInput);
  const excess = scenario === "S-13" ? await requestRefund({
    ...context(fixture), paymentId, counterpartyKind: "customer", counterpartyId: customerId,
    amount: 1, idempotencyKey: id(`${prefix}_excess`),
  }).then(() => null, (error) => error.message) : null;
  const after = await readPaymentState(client, fixture, paymentId, invoiceId);
  const persisted = await sql(client, `
    SELECT c.receivable_balance,
      (SELECT count(*)::int FROM allocation_reversals a
        WHERE a.tenant_id = $1 AND a.allocation_id = $3) AS reversals,
      (SELECT count(*)::int FROM customer_ledgers l WHERE l.tenant_id = $1
        AND l.reference_type = 'payment_refund' AND l.reference_id = $4) AS ledger_rows,
      (SELECT COALESCE(sum(l.debit), 0) FROM customer_ledgers l WHERE l.tenant_id = $1
        AND l.reference_type = 'payment_refund' AND l.reference_id = $4) AS ledger_debit,
      (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = $1
        AND a.target_type = 'payment_refund' AND a.target_id = $4) AS refund_audits
    FROM customers c WHERE c.tenant_id = $1 AND c.id = $2
  `, [fixture.tenants.a, customerId, allocation.id, completion.id]);
  const row = persisted.rows[0];
  const passed = before.paymentAmount === 1000 && before.activeAllocations === 1000 &&
    before.invoiceDue === 0 && before.usable === 0 &&
    after.activeAllocations === 1000 - amount && after.refunds === amount &&
    after.invoiceDue === amount && after.invoicePaid === 1000 - amount && after.usable === 0 &&
    after.paymentAmount - after.refunds - after.paymentReversals === 1000 - amount &&
    JSON.stringify(beforeReplay) === JSON.stringify(after) &&
    Number(row?.receivable_balance) === amount && row?.reversals === 1 &&
    row?.ledger_rows === 1 && Number(row?.ledger_debit) === amount && row?.refund_audits === 3 &&
    replay.replayed === true && replay.id === completion.id && (scenario !== "S-13" || Boolean(excess));
  return { passed, before, beforeReplay, after, persisted: row, replay, excess,
    paymentId, allocationId: allocation.id, refundId: completion.id,
    boundary: "reconciliation service with synthetic persisted fixture and restricted application role" };
}

async function exerciseCustomerReversal(client, fixture, scenario) {
  const prefix = scenario.toLowerCase().replace("-", "");
  const customerId = id(`${prefix}_customer`);
  const invoiceId = id(`${prefix}_invoice`);
  const paymentId = id(`${prefix}_payment`);
  const amount = scenario === "S-14" ? 400 : 1000;
  const now = new Date();
  await sql(client, `
    INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at)
    VALUES ($1, $2, $3, $4, $5)
  `, [customerId, fixture.tenants.a, `${scenario} customer`, 1000 - amount, now]);
  await sql(client, `
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5, 'FINALIZED', 1000, 1000, 0, 1000, $5, $5)
  `, [invoiceId, fixture.tenants.a, id(`${prefix}_invoice_no`), customerId, now]);
  await sql(client, `
    INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
      idempotency_key, request_payload_hash, created_by)
    VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', $4, $5, $6, 'fixture', $7)
  `, [paymentId, fixture.tenants.a, customerId, amount, now, id(`${prefix}_payment_key`), fixture.subjects.a]);
  const allocation = await allocatePayment({
    ...context(fixture), paymentId, invoiceId, invoiceKind: "sales",
    amount, idempotencyKey: id(`${prefix}_allocation`),
  });
  const before = await readPaymentState(client, fixture, paymentId, invoiceId);
  const reversalInput = scenario === "S-14"
    ? { ...context(fixture), allocationId: allocation.id, idempotencyKey: id(`${prefix}_reversal`) }
    : { ...context(fixture), paymentId, idempotencyKey: id(`${prefix}_reversal`) };
  const operation = scenario === "S-14" ? reverseAllocation : reversePayment;
  const reversal = await operation(reversalInput);
  const replay = await operation(reversalInput);
  const after = await readPaymentState(client, fixture, paymentId, invoiceId);
  const persisted = await sql(client, `
    SELECT c.receivable_balance,
      (SELECT count(*)::int FROM allocation_reversals a
        WHERE a.tenant_id = $1 AND a.allocation_id = $3) AS allocation_reversals,
      (SELECT count(*)::int FROM customer_ledgers l
        WHERE l.tenant_id = $1 AND l.customer_id = $2 AND l.reference_type = 'payment_reversal') AS reversal_ledger_rows,
      (SELECT COALESCE(sum(l.debit), 0) FROM customer_ledgers l
        WHERE l.tenant_id = $1 AND l.customer_id = $2 AND l.reference_type = 'payment_reversal') AS reversal_debit,
      (SELECT count(*)::int FROM customer_ledgers l
        WHERE l.tenant_id = $1 AND l.customer_id = $2 AND l.reference_type = 'payment_refund') AS refund_ledger_rows,
      (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = $1 AND a.target_id = $4
        AND a.event_type = CASE WHEN $5 = 'S-14' THEN 'ALLOCATION_REVERSED'::"AuditEventType"
                                ELSE 'PAYMENT_REVERSED'::"AuditEventType" END) AS reversal_audits
    FROM customers c WHERE c.tenant_id = $1 AND c.id = $2
  `, [fixture.tenants.a, customerId, allocation.id, reversal.id, scenario]);
  const row = persisted.rows[0];
  const expectedUsable = scenario === "S-14" ? 400 : 0;
  const expectedCache = scenario === "S-14" ? 600 : 1000;
  const expectedLedgerRows = scenario === "S-14" ? 0 : 1;
  const passed = before.paymentAmount === amount && before.activeAllocations === amount &&
    before.invoiceDue === 1000 - amount && before.usable === 0 &&
    after.invoiceDue === 1000 && after.invoicePaid === 0 && after.activeAllocations === 0 &&
    after.usable === expectedUsable && after.refunds === 0 &&
    after.paymentReversals === (scenario === "S-14" ? 0 : amount) &&
    Number(row?.receivable_balance) === expectedCache &&
    after.invoiceDue - after.usable === expectedCache &&
    row?.allocation_reversals === 1 && row?.refund_ledger_rows === 0 &&
    row?.reversal_ledger_rows === expectedLedgerRows &&
    Number(row?.reversal_debit) === (scenario === "S-14" ? 0 : amount) &&
    row?.reversal_audits === 1 && replay.replayed === true && replay.id === reversal.id;
  return { passed, before, after, persisted: row, replay, paymentId, allocationId: allocation.id,
    reversalId: reversal.id,
    boundary: "reconciliation service with synthetic persisted fixture and restricted application role" };
}

async function exerciseTwoCustomerPayments(client, fixture) {
  const customerId = id("s08_customer");
  const invoiceId = id("s08_invoice");
  const payments = [id("s08_payment_a"), id("s08_payment_b")];
  const now = new Date();
  await sql(client, `
    INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at)
    VALUES ($1, $2, 'S-08 customer', 0, $3)
  `, [customerId, fixture.tenants.a, now]);
  await sql(client, `
    INSERT INTO sales_invoices (
      id, tenant_id, invoice_no, customer_id, invoice_date, due_date, status,
      gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $5, 'FINALIZED', 1000, 1000, 0, 1000, $5, $5)
  `, [invoiceId, fixture.tenants.a, id("s08_invoice_no"), customerId, now]);
  for (const [index, amount] of [400, 600].entries()) {
    await sql(client, `
      INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
        idempotency_key, request_payload_hash, created_by)
      VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', $4, $5, $6, 'fixture', $7)
    `, [payments[index], fixture.tenants.a, customerId, amount, now, id("s08_payment_key"), fixture.subjects.a]);
  }
  const before = await Promise.all(payments.map((paymentId) => readPaymentState(client, fixture, paymentId, invoiceId)));
  const results = [];
  for (const [index, amount] of [400, 600].entries()) {
    const input = {
      ...context(fixture), paymentId: payments[index], invoiceId, invoiceKind: "sales",
      amount, idempotencyKey: id("s08_allocation"),
    };
    const allocation = await allocatePayment(input);
    const replay = await allocatePayment(input);
    results.push({ allocation, replay });
  }
  const after = await Promise.all(payments.map((paymentId) => readPaymentState(client, fixture, paymentId, invoiceId)));
  const persisted = await sql(client, `
    SELECT c.receivable_balance,
      (SELECT count(*)::int FROM payment_allocations a WHERE a.tenant_id = $1 AND a.sales_invoice_id = $3) AS allocations,
      (SELECT count(DISTINCT a.payment_id)::int FROM payment_allocations a WHERE a.tenant_id = $1 AND a.sales_invoice_id = $3) AS payment_count,
      (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = $1 AND a.event_type = 'ALLOCATION_CREATED'
        AND a.target_type = 'payment_allocation' AND a.target_id = ANY($4::text[])) AS audit_rows
    FROM customers c WHERE c.tenant_id = $1 AND c.id = $2
  `, [fixture.tenants.a, customerId, invoiceId, results.map((item) => item.allocation.id)]);
  const row = persisted.rows[0];
  const passed = before.every((item) => item.invoiceDue === 1000 && item.activeAllocations === 0) &&
    before[0].usable === 400 && before[1].usable === 600 &&
    after[0].activeAllocations === 400 && after[1].activeAllocations === 600 &&
    after.every((item) => item.usable === 0 && item.invoiceDue === 0 && item.invoicePaid === 1000 &&
      item.refunds === 0 && item.paymentReversals === 0) &&
    results.every((item) => item.replay.replayed === true && item.replay.id === item.allocation.id) &&
    row?.allocations === 2 && row?.payment_count === 2 && row?.audit_rows === 2 &&
    Number(row?.receivable_balance) === 0;
  return { passed, before, after, persisted: row, results,
    refundableTotal: after.reduce((sum, item) => sum + item.paymentAmount - item.refunds - item.paymentReversals, 0),
    boundary: "reconciliation service with synthetic persisted fixture and restricted application role" };
}

async function exerciseApplicationActions(client) {
  const actionFixture = await createFixture(client, `actions_${crypto.randomUUID().replaceAll("-", "")}`);
  const role = await sql(client, `
    SELECT role_id FROM memberships WHERE tenant_id = $1 AND user_id = $2
  `, [actionFixture.tenants.a, actionFixture.subjects.a]);
  await sql(client, `
    INSERT INTO role_permissions (id, role_id, permission) VALUES ($1, $2, 'create_payment')
  `, [id("action_permission"), role.rows[0].role_id]);
  const auth = require("../src/adapters/auth/index.ts");
  const originalMetadataUpdate = auth.authAdapter.setAppMetadataTenantId;
  auth.authAdapter.setAppMetadataTenantId = async () => {};
  try {
    const actions = require("../src/app/_actions/reconciliation.actions.ts");
    const customerInput = {
      customerId: actionFixture.customers.a, paymentId: actionFixture.payments.a,
      invoiceId: actionFixture.invoices.salesA, amount: 100, idempotencyKey: id("customer_action"),
    };
    const supplierInput = {
      supplierId: actionFixture.supplier, paymentId: actionFixture.payments.supplier,
      invoiceId: actionFixture.invoices.purchaseA, amount: 100, idempotencyKey: id("supplier_action"),
    };
    auth.installFinancialE2eTestSession(actionFixture.subjects.b);
    const denied = await actions.applyCustomerCreditAction(customerInput).then(() => null, (error) => error.message);
    auth.installFinancialE2eTestSession(actionFixture.subjects.a);
    const invalid = await actions.applyCustomerCreditAction({ ...customerInput, amount: -1 })
      .then(() => null, (error) => error.message);
    const wrongOwner = await actions.applyCustomerCreditAction({
      ...customerInput, customerId: actionFixture.customers.b, idempotencyKey: id("wrong_customer"),
    }).then(() => null, (error) => error.message);
    const customer = await actions.applyCustomerCreditAction(customerInput);
    const customerReplay = await actions.applyCustomerCreditAction(customerInput);
    const supplier = await actions.applySupplierAdvanceAction(supplierInput);
    const supplierReplay = await actions.applySupplierAdvanceAction(supplierInput);
    const refundResults = [];
    for (const [kind, paymentId, counterpartyId] of [
      ["customer", actionFixture.payments.a, actionFixture.customers.a],
      ["supplier", actionFixture.payments.supplier, actionFixture.supplier],
    ]) {
      const requestInput = {
        paymentId, amount: 25, idempotencyKey: id(`${kind}_action_refund`),
        ...(kind === "customer" ? { customerId: counterpartyId } : { supplierId: counterpartyId }),
      };
      const request = kind === "customer"
        ? await actions.requestCustomerRefundAction(requestInput)
        : await actions.requestSupplierRefundAction(requestInput);
      const approval = await actions.approveRefundAction({
        refundId: request.id, idempotencyKey: id(`${kind}_action_approve`),
      });
      const completionInput = { refundId: request.id, idempotencyKey: id(`${kind}_action_complete`) };
      const completion = await actions.completeRefundAction(completionInput);
      const replay = await actions.completeRefundAction(completionInput);
      refundResults.push({ kind, request, approval, completion, replay });
    }
    auth.clearFinancialE2eTestSession();
    const unauthenticated = await actions.applySupplierAdvanceAction(supplierInput)
      .then(() => null, (error) => error.message);
    const customerState = await readPaymentState(client, actionFixture, actionFixture.payments.a, actionFixture.invoices.salesA);
    const supplierState = await readSupplierState(client, actionFixture, actionFixture.payments.supplier, actionFixture.invoices.purchaseA);
    const audit = await sql(client, `
      SELECT target_id, count(*)::int AS count FROM audit_logs
      WHERE tenant_id = $1 AND event_type = 'ALLOCATION_CREATED' AND target_type = 'payment_allocation'
        AND target_id = ANY($2::text[]) GROUP BY target_id
    `, [actionFixture.tenants.a, [customer.id, supplier.id]]);
    const refundRows = await sql(client, `
      SELECT id, status, amount FROM payment_refunds WHERE tenant_id = $1 AND id = ANY($2::text[])
    `, [actionFixture.tenants.a, refundResults.map((item) => item.request.id)]);
    const passed = denied === "You are not authorized to perform this action." &&
      invalid === "Amount must be positive." && Boolean(wrongOwner) &&
      unauthenticated === "Authentication is required." &&
      customerReplay.replayed === true && customerReplay.id === customer.id &&
      supplierReplay.replayed === true && supplierReplay.id === supplier.id &&
      customerState.activeAllocations === 75 && customerState.invoiceDue === 925 && customerState.refunds === 25 &&
      supplierState.activeAllocations === 75 && supplierState.invoiceDue === 525 && supplierState.refunds === 25 &&
      supplierState.allocationCount === 1 && audit.rows.length === 2 &&
      audit.rows.every((row) => row.count === 1) && refundRows.rows.length === 2 &&
      refundRows.rows.every((row) => row.status === "COMPLETED" && Number(row.amount) === 25) &&
      refundResults.every((item) => item.approval.id === item.request.id &&
        item.completion.id === item.request.id && item.replay.replayed === true && item.replay.id === item.request.id);
    return { passed, denied, invalid, wrongOwner, unauthenticated, customer, customerReplay,
      supplier, supplierReplay, customerState, supplierState, audit: audit.rows, refundResults, refundRows: refundRows.rows,
      boundary: "actual actions, real permission and database tenant lookup, guarded synthetic authentication; Supabase Auth not exercised" };
  } finally {
    auth.clearFinancialE2eTestSession();
    auth.authAdapter.setAppMetadataTenantId = originalMetadataUpdate;
  }
}

async function runClassificationCandidates(client, fixture, record) {
  const now = new Date();
  if (process.env.FINANCIAL_RECONCILIATION_SELECTION !== "classification-refund") {
  const auth = require("../src/adapters/auth/index.ts");
  const originalMetadataUpdate = auth.authAdapter.setAppMetadataTenantId;
  const actions = require("../src/app/_actions/sales.actions.ts");
  const role = await sql(client, "SELECT role_id FROM memberships WHERE tenant_id = $1 AND user_id = $2",
    [fixture.tenants.a, fixture.subjects.a]);
  await sql(client, "INSERT INTO role_permissions (id, role_id, permission) VALUES ($1, $2, 'create_payment')",
    [id("campaign_permission"), role.rows[0].role_id]);
  auth.authAdapter.setAppMetadataTenantId = async () => {};
  try {
    auth.installFinancialE2eTestSession(fixture.subjects.a);
    for (const kind of ["customer", "supplier"]) {
      const customer = kind === "customer";
      const party = id(`campaign_${kind}`);
      const table = customer ? "customers" : "suppliers";
      const balance = customer ? "receivable_balance" : "payable_balance";
      const ledgerTable = customer ? "customer_ledgers" : "supplier_ledgers";
      const partyColumn = customer ? "customer_id" : "supplier_id";
      const amount = customer ? 500 : 1000;
      await sql(client, `INSERT INTO ${table} (id, tenant_id, business_name, ${balance}, updated_at)
        VALUES ($1, $2, $3, 0, $4)`, [party, fixture.tenants.a, `campaign ${kind}`, new Date()]);
      const form = new FormData();
      form.set(partyColumn, party);
      form.set("amount", String(amount));
      form.set("payment_method", "Cash");
      form.set("entry_date", "2026-11-08");
      form.set("idempotency_key", id(`campaign_${kind}_payment`));
      const action = customer ? actions.createCustomerPaymentAction : actions.createSupplierPaymentAction;
      const first = await action({}, form);
      const afterFirst = await sql(client, `SELECT count(*)::int AS count FROM audit_logs WHERE tenant_id = $1`, [fixture.tenants.a]);
      const sequenceAfterFirst = await sql(client, `SELECT next_value FROM payment_receipt_sequences WHERE tenant_id = $1 AND prefix = 'PAY'`, [fixture.tenants.a]);
      const replay = await action({}, form);
      const sequenceAfterReplay = await sql(client, `SELECT next_value FROM payment_receipt_sequences WHERE tenant_id = $1 AND prefix = 'PAY'`, [fixture.tenants.a]);
      const persisted = await sql(client, `
        SELECT p.id, p.amount, p.receipt_no, c.${balance} AS balance,
          (SELECT count(*)::int FROM ${ledgerTable} l WHERE l.tenant_id = p.tenant_id
            AND l.reference_id = p.id AND l.${partyColumn} = $2) AS ledger_rows,
          (SELECT COALESCE(sum(${customer ? "credit" : "debit"}), 0) FROM ${ledgerTable} l
            WHERE l.tenant_id = p.tenant_id AND l.reference_id = p.id AND l.${partyColumn} = $2) AS ledger_amount,
          (SELECT count(*)::int FROM payments q WHERE q.tenant_id = p.tenant_id AND q.${partyColumn} = $2) AS payment_rows,
          (SELECT count(*)::int FROM payment_allocations a WHERE a.tenant_id = p.tenant_id AND a.payment_id = p.id) AS allocations,
          (SELECT count(*)::int FROM ${customer ? "sales_invoices" : "purchase_invoices"} i
            WHERE i.tenant_id = p.tenant_id AND i.${partyColumn} = $2) AS invoices,
          (SELECT count(*)::int FROM payment_refunds r WHERE r.tenant_id = p.tenant_id AND r.payment_id = p.id) AS refunds,
          (SELECT count(*)::int FROM payment_reversals r WHERE r.tenant_id = p.tenant_id AND r.payment_id = p.id) AS reversals,
          (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = p.tenant_id) AS audits
        FROM payments p JOIN ${table} c ON c.tenant_id = p.tenant_id AND c.id = p.${partyColumn}
        WHERE p.tenant_id = $1 AND p.id = $3
      `, [fixture.tenants.a, party, first.data?.id ?? ""]);
      const row = persisted.rows[0];
      const pass = first.ok === true && replay.ok === true && first.data.id === replay.data.id &&
        Number(row?.amount) === amount && Number(row?.balance) === -amount &&
        row?.payment_rows === 1 && row?.ledger_rows === 1 && Number(row?.ledger_amount) === amount &&
        row?.allocations === 0 && row?.invoices === 0 && row?.refunds === 0 && row?.reversals === 0 &&
        row?.audits === afterFirst.rows[0].count && Boolean(row?.receipt_no) &&
        JSON.stringify(sequenceAfterFirst.rows) === JSON.stringify(sequenceAfterReplay.rows);
      record(customer ? "S-01" : "S-04", pass ? "PASS" : "FAIL",
        `${kind} advance creation and idempotent retry`,
        { boundary: "payment action with guarded synthetic session and restricted role; metadata update stubbed",
          fixture: { party, initialBalance: 0, amount }, first, replay, persisted: row ?? null,
          sequenceAfterFirst: sequenceAfterFirst.rows, sequenceAfterReplay: sequenceAfterReplay.rows,
          derived: pass ? { gross: 0, unapplied: amount, net: -amount, usable: amount, refundable: amount } : null });
    }
  } finally {
    auth.clearFinancialE2eTestSession();
    auth.authAdapter.setAppMetadataTenantId = originalMetadataUpdate;
  }

  try {
  const receiptTenant = id("campaign_receipt_tenant");
  const receiptUser = id("campaign_receipt_user");
  const receiptRole = id("campaign_receipt_role");
  const receiptMembership = id("campaign_receipt_membership");
  await sql(client, "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, $4)",
    [receiptTenant, receiptTenant, "Receipt fixture", now]);
  await sql(client, "INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1, $1, $2, $3, $4)",
    [receiptUser, `${receiptUser}@example.invalid`, "Receipt fixture", now]);
  await sql(client, "INSERT INTO roles (id, tenant_id, name, updated_at) VALUES ($1, $2, 'receipt-test', $3)",
    [receiptRole, receiptTenant, now]);
  await sql(client, "INSERT INTO memberships (id, tenant_id, user_id, role_id, status, updated_at) VALUES ($1, $2, $3, $4, 'active', $5)",
    [receiptMembership, receiptTenant, receiptUser, receiptRole, now]);
  const { allocatePaymentReceiptNo } = require("../src/repositories/payment.repository.ts");
  const { Prisma } = require("@prisma/client");
  const { prisma } = require("../src/lib/db/prisma.ts");
  const { establishTenantContext } = require("../src/lib/db/tenant-context.ts");
  const receiptContext = { tenantId: receiptTenant, userId: receiptUser, subjectId: receiptUser,
    membershipId: receiptMembership, roles: [], permissions: [] };
  const receiptCustomer = id("campaign_receipt_customer");
  await sql(client, `INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at)
    VALUES ($1, $2, 'Receipt rollback customer', 0, $3)`, [receiptCustomer, receiptTenant, now]);
  await sql(client, `INSERT INTO payment_receipt_sequences (tenant_id, prefix, next_value) VALUES ($1, 'OTHER', 9)`,
    [fixture.tenants.b]);
  const catalog = await sql(client, `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
    has_table_privilege('pharmnos_e2e_runtime', c.oid, 'DELETE') AS can_delete,
    has_column_privilege('pharmnos_e2e_runtime', c.oid, 'tenant_id', 'UPDATE') AS can_update_tenant,
    has_column_privilege('pharmnos_e2e_runtime', c.oid, 'next_value', 'UPDATE') AS can_update_value
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'payment_receipt_sequences'`);
  const isolation = await runReconciliationMutation(receiptContext, async (tx) => {
    const visible = await tx.$queryRaw(Prisma.sql`SELECT tenant_id FROM payment_receipt_sequences WHERE tenant_id = ${fixture.tenants.b}`);
    const updated = await tx.$executeRaw(Prisma.sql`UPDATE payment_receipt_sequences SET next_value = 10 WHERE tenant_id = ${fixture.tenants.b}`);
    return { visible: visible.length, updated };
  });
  const crossInsertError = await runReconciliationMutation(receiptContext, (tx) =>
    tx.$executeRaw(Prisma.sql`INSERT INTO payment_receipt_sequences (tenant_id, prefix, next_value)
      VALUES (${fixture.tenants.b}, 'FORBIDDEN', 2)`))
    .then(() => null, (error) => error.message);
  const crossAfter = await sql(client, `SELECT prefix, next_value FROM payment_receipt_sequences
    WHERE tenant_id = $1 ORDER BY prefix`, [fixture.tenants.b]);
  let rollbackUpdated = 0;
  const rollbackError = await runReconciliationMutation(receiptContext, async (tx) => {
    await allocatePaymentReceiptNo(tx, "ROLLBACK", receiptTenant);
    rollbackUpdated = await tx.$executeRaw(Prisma.sql`UPDATE customers SET receivable_balance = 123 WHERE id = ${receiptCustomer}`);
    if (rollbackUpdated !== 1) throw new Error("Receipt rollback fixture did not update its customer.");
    throw new Error("controlled receipt rollback");
  }).then(() => null, (error) => error.message);
  const rollback = await sql(client, `SELECT receivable_balance,
    (SELECT count(*)::int FROM payment_receipt_sequences WHERE tenant_id = $1 AND prefix = 'ROLLBACK') AS sequences
    FROM customers WHERE tenant_id = $1 AND id = $2`, [receiptTenant, receiptCustomer]);
  let arrivals = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const nextReceipt = () => prisma.$transaction(async (tx) => {
    await establishTenantContext(tx, receiptContext);
    arrivals += 1;
    if (arrivals === 4) release();
    await barrier;
    return allocatePaymentReceiptNo(tx, "PAY", receiptTenant);
  });
  const attempts = await Promise.allSettled([nextReceipt(), nextReceipt(), nextReceipt(), nextReceipt()]);
  const receipts = attempts.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failures = attempts.filter((result) => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
  let serialArrivals = 0;
  let releaseSerial;
  const serialBarrier = new Promise((resolve) => { releaseSerial = resolve; });
  const serialAttemptCounts = [0, 0, 0, 0];
  const serialEvents = [[], [], [], []];
  const serialAttempts = await Promise.allSettled(serialAttemptCounts.map((_, index) =>
    runReconciliationMutation(receiptContext, async (tx) => {
      serialAttemptCounts[index] += 1;
      const identity = await tx.$queryRaw(Prisma.sql`SELECT current_setting('transaction_isolation') AS isolation,
        pg_backend_pid() AS backend_pid, txid_current()::text AS transaction_id`);
      const event = { attempt: serialAttemptCounts[index], ...identity[0], tenant: receiptTenant, prefix: "SERIAL" };
      serialEvents[index].push(event);
      if (serialAttemptCounts[index] === 1) {
        serialArrivals += 1;
        if (serialArrivals === 4) releaseSerial();
        await serialBarrier;
      }
      try {
        event.receipt = await allocatePaymentReceiptNo(tx, "SERIAL", receiptTenant);
        return event.receipt;
      } catch (error) {
        event.error = { code: error.code ?? null, sqlstate: error.meta?.code ?? null, message: error.message };
        throw error;
      }
    })));
  const serialReceipts = serialAttempts.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const serialFailures = serialAttempts.filter((result) => result.status === "rejected").map((result) => ({
    message: result.reason instanceof Error ? result.reason.message : String(result.reason),
    code: result.reason?.code ?? null,
    meta: result.reason?.meta ?? null,
  }));
  const serialState = await sql(client, `SELECT next_value FROM payment_receipt_sequences
    WHERE tenant_id = $1 AND prefix = 'SERIAL'`, [receiptTenant]);
  const serialOutcomes = serialAttempts.map((outcome, index) => ({
    caller: index + 1,
    status: outcome.status,
    attempts: serialEvents[index],
    ...(outcome.status === "fulfilled" ? { receipt: outcome.value } : {
      error: { code: outcome.reason?.code ?? null, sqlstate: outcome.reason?.meta?.code ?? null,
        message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) },
    }),
  }));
  const firstBackends = serialEvents.map((events) => events[0]?.backend_pid);
  const serialEventsValid = serialEvents.every((events) => events.length > 0 && events.length <= 5 &&
    events.every((event) => event.isolation === "serializable" && event.tenant === receiptTenant &&
      event.prefix === "SERIAL" && (!event.error ||
        (event.error.code === "P2010" && event.error.sqlstate === "40001"))));
  let exhaustedAttempts = 0;
  const exhaustedError = await runReconciliationMutation(receiptContext, async (tx) => {
    exhaustedAttempts += 1;
    await allocatePaymentReceiptNo(tx, "EXHAUST", receiptTenant);
    const updated = await tx.$executeRaw(Prisma.sql`UPDATE customers SET receivable_balance = 123 WHERE id = ${receiptCustomer}`);
    if (updated !== 1) throw new Error("Retry rollback fixture did not update its customer.");
    throw new Prisma.PrismaClientKnownRequestError("controlled serialization failure", {
      code: "P2010", clientVersion: Prisma.prismaVersion.client, meta: { code: "40001" },
    });
  }).then(() => null, (error) => ({ code: error.code, meta: error.meta }));
  let nonRetryableAttempts = 0;
  const nonRetryableError = await runReconciliationMutation(receiptContext, async () => {
    nonRetryableAttempts += 1;
    throw new Error("controlled non-retryable failure");
  }).then(() => null, (error) => error.message);
  const exhaustedState = await sql(client, `SELECT receivable_balance,
    (SELECT count(*)::int FROM payment_receipt_sequences WHERE tenant_id = $1 AND prefix = 'EXHAUST') AS sequences
    FROM customers WHERE tenant_id = $1 AND id = $2`, [receiptTenant, receiptCustomer]);
  const sequence = await sql(client, `
    SELECT next_value,
      (SELECT count(*)::int FROM payments WHERE tenant_id = $1) AS payments,
      (SELECT count(*)::int FROM customer_ledgers WHERE tenant_id = $1) AS customer_ledgers,
      (SELECT count(*)::int FROM supplier_ledgers WHERE tenant_id = $1) AS supplier_ledgers
    FROM payment_receipt_sequences WHERE tenant_id = $1 AND prefix = 'PAY'
  `, [receiptTenant]);
  const sequenceRow = sequence.rows[0];
  const pass = arrivals === 4 && failures.length === 0 && serialArrivals === 4 &&
    serialFailures.length === 0 && serialEventsValid && new Set(firstBackends).size === 4 &&
    serialEvents.some((events) => events.some((event) => event.error?.sqlstate === "40001")) &&
    JSON.stringify([...serialReceipts].sort()) ===
    JSON.stringify(["SERIAL-00001", "SERIAL-00002", "SERIAL-00003", "SERIAL-00004"]) &&
    serialState.rows[0]?.next_value === 5 &&
    exhaustedAttempts === 5 && exhaustedError?.code === "P2010" && exhaustedError?.meta?.code === "40001" &&
    Number(exhaustedState.rows[0]?.receivable_balance) === 0 && exhaustedState.rows[0]?.sequences === 0 &&
    nonRetryableAttempts === 1 && nonRetryableError === "controlled non-retryable failure" &&
    JSON.stringify([...receipts].sort()) ===
    JSON.stringify(["PAY-00001", "PAY-00002", "PAY-00003", "PAY-00004"]) &&
    sequenceRow?.next_value === 5 && sequenceRow.payments === 0 &&
    sequenceRow.customer_ledgers === 0 && sequenceRow.supplier_ledgers === 0 &&
    catalog.rows[0]?.enabled === true && catalog.rows[0]?.forced === true &&
    catalog.rows[0]?.can_delete === false && catalog.rows[0]?.can_update_tenant === false &&
    catalog.rows[0]?.can_update_value === true && isolation.visible === 0 && isolation.updated === 0 &&
    Boolean(crossInsertError?.includes("row-level security policy")) && crossAfter.rows.length === 1 && crossAfter.rows[0].prefix === "OTHER" &&
    crossAfter.rows[0].next_value === 9 && rollbackError === "controlled receipt rollback" &&
    rollbackUpdated === 1 && Number(rollback.rows[0]?.receivable_balance) === 0 && rollback.rows[0]?.sequences === 0;
  record("S-28", pass ? "PASS" : "FAIL",
    "barrier-synchronized tenant receipt allocation",
    { boundary: "receipt sequence repository using action-equivalent default-isolation restricted-role transactions and signed synthetic context",
      fixture: { receiptTenant }, barrierArrivals: arrivals, receipts, failures, persisted: sequenceRow ?? null,
      serializable: { barrierArrivals: serialArrivals, attemptCounts: serialAttemptCounts,
        receipts: serialReceipts, failures: serialFailures, outcomes: serialOutcomes, persisted: serialState.rows,
        exhaustedAttempts, exhaustedError, exhaustedState: exhaustedState.rows,
        nonRetryableAttempts, nonRetryableError },
      catalog: catalog.rows[0], isolation, crossInsertError, crossAfter: crossAfter.rows,
      rollbackError, rollbackUpdated, rollback: rollback.rows });
  } catch (error) {
    record("S-28", "FAIL", "barrier-synchronized tenant receipt allocation",
      { error: error instanceof Error ? error.message : String(error) });
  }
  }

  if (process.env.FINANCIAL_RECONCILIATION_SELECTION === "receipt") return;
  try {
  const rollbackCustomer = id("campaign_rollback_customer");
  const rollbackInvoice = id("campaign_rollback_invoice");
  const rollbackPayment = id("campaign_rollback_payment");
  await sql(client, "INSERT INTO customers (id, tenant_id, business_name, receivable_balance, updated_at) VALUES ($1, $2, 'Rollback customer', 0, $3)",
    [rollbackCustomer, fixture.tenants.a, now]);
  await sql(client, `INSERT INTO sales_invoices (id, tenant_id, invoice_no, customer_id, invoice_date, due_date,
    status, gross_amount, net_amount, paid_amount, balance_due, finalized_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $5, 'FINALIZED', 1000, 1000, 0, 1000, $5, $5)`,
  [rollbackInvoice, fixture.tenants.a, id("rollback_invoice"), rollbackCustomer, now]);
  await sql(client, `INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
    idempotency_key, request_payload_hash, created_by)
    VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', 1000, $4, $5, 'fixture', $6)`,
  [rollbackPayment, fixture.tenants.a, rollbackCustomer, now, id("rollback_payment_key"), fixture.subjects.a]);
  await sql(client, `INSERT INTO customer_ledgers (id, tenant_id, customer_id, entry_type, debit, credit,
    balance, reference_type, reference_id, entry_date) VALUES
    ($1, $3, $4, 'INVOICE', 1000, 0, 1000, 'sales_invoice', $5, $7),
    ($2, $3, $4, 'PAYMENT_RECEIVED', 0, 1000, 0, 'payment_received', $6, $7)`,
  [id("rollback_invoice_ledger"), id("rollback_payment_ledger"), fixture.tenants.a,
    rollbackCustomer, rollbackInvoice, rollbackPayment, now]);
  const rollbackFixture = { ...fixture, customers: { ...fixture.customers, a: rollbackCustomer },
    invoices: { ...fixture.invoices, salesA: rollbackInvoice }, payments: { ...fixture.payments, a: rollbackPayment } };
  const allocation = await allocatePayment({
    ...context(rollbackFixture), paymentId: rollbackPayment, invoiceId: rollbackInvoice,
    invoiceKind: "sales", amount: 1000, idempotencyKey: id("rollback_fixture_allocation"),
  });
  const lifecycle = await requestAndApproveRefund(
    rollbackFixture, rollbackPayment, 200, "customer", rollbackCustomer, "rollback_fixture",
  );
  const completionInput = { ...context(fixture), refundId: lifecycle.request.id,
    idempotencyKey: id("rollback_fixture_completion") };
  const snapshot = async () => {
    const state = await readPaymentState(client, rollbackFixture, rollbackPayment, rollbackInvoice);
    const rows = await sql(client, `
      SELECT r.status,
        (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = $1) AS audits,
        (SELECT count(*)::int FROM allocation_reversals a WHERE a.tenant_id = $1 AND a.allocation_id = $3) AS reversals,
        (SELECT count(*)::int FROM customer_ledgers l WHERE l.tenant_id = $1 AND l.reference_id = r.id) AS ledger_rows,
        (SELECT COALESCE(sum(l.debit - l.credit), 0) FROM customer_ledgers l
          WHERE l.tenant_id = $1 AND l.customer_id = $4) AS ledger_net,
        (SELECT receivable_balance FROM customers WHERE tenant_id = $1 AND id = $4) AS balance
      FROM payment_refunds r WHERE r.tenant_id = $1 AND r.id = $2
    `, [fixture.tenants.a, lifecycle.request.id, allocation.id, rollbackCustomer]);
    return { state, persisted: rows.rows[0] };
  };
  const before = await snapshot();
  const triggerName = `campaign_refund_fail_${crypto.randomBytes(6).toString("hex")}`;
  const functionName = `${triggerName}_fn`;
  await sql(client, `CREATE FUNCTION public.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.customer_id = '${rollbackCustomer}' AND NEW.reference_type = 'payment_refund'
      THEN RAISE EXCEPTION 'campaign controlled ledger failure'; END IF; RETURN NEW; END $$`);
  let failure;
  try {
    await sql(client, `CREATE TRIGGER ${triggerName} BEFORE INSERT ON public.customer_ledgers
      FOR EACH ROW EXECUTE FUNCTION public.${functionName}()`);
    failure = await completeRefund(completionInput).then(() => null, (error) => error.message);
  } finally {
    await sql(client, `DROP TRIGGER IF EXISTS ${triggerName} ON public.customer_ledgers`);
    await sql(client, `DROP FUNCTION public.${functionName}()`);
  }
  const afterFailure = await snapshot();
  const retry = await completeRefund(completionInput);
  const afterRetry = await snapshot();
  const replay = await completeRefund(completionInput);
  const afterReplay = await snapshot();
  const pass = Boolean(failure?.includes("campaign controlled ledger failure")) &&
    before.state.activeAllocations === 1000 && before.state.invoiceDue === 0 && before.state.usable === 0 &&
    before.persisted.status === "APPROVED" && Number(before.persisted.balance) === 0 &&
    Number(before.persisted.ledger_net) === 0 && JSON.stringify(before) === JSON.stringify(afterFailure) &&
    retry.id === lifecycle.request.id && afterRetry.state.activeAllocations === 800 &&
    afterRetry.state.invoiceDue === 200 && afterRetry.state.refunds === 200 &&
    afterRetry.state.usable === 0 && afterRetry.persisted.status === "COMPLETED" &&
    afterRetry.persisted.reversals === 1 && afterRetry.persisted.ledger_rows === 1 &&
    Number(afterRetry.persisted.balance) === 200 && Number(afterRetry.persisted.ledger_net) === 200 &&
    replay.replayed === true && replay.id === retry.id && JSON.stringify(afterRetry) === JSON.stringify(afterReplay);
  record("S-16", pass ? "PASS" : "FAIL", "controlled customer refund ledger insert failure and retry",
    { boundary: "reconciliation service restricted-role transaction; target-specific temporary fault trigger",
      fixture: { paymentId: rollbackPayment, allocationId: allocation.id, refundId: lifecycle.request.id },
      failure, before, afterFailure, retry, afterRetry, replay, afterReplay });
  } catch (error) {
    record("S-16", "FAIL", "controlled customer refund ledger insert failure and retry",
      { error: error instanceof Error ? error.message : String(error) });
  }
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
    if (["classification", "classification-refund", "receipt"].includes(process.env.FINANCIAL_RECONCILIATION_SELECTION)) {
      let error;
      try {
        await runClassificationCandidates(bootstrap, fixture, record);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        process.exitCode = 1;
      }
      const evidence = {
        campaign: "Financial Reconciliation - Classified Runtime Candidates",
        runId: process.env.FINANCIAL_E2E_RUN_ID,
        target: process.env.TEST_DATABASE_NAME,
        results,
        error: error ?? null,
        summary: {
          pass: results.filter((result) => result.status === "PASS").length,
          fail: results.filter((result) => result.status === "FAIL").length,
        },
      };
      const output = required("FINANCIAL_E2E_SUITE_EVIDENCE_FILE");
      fs.writeFileSync(path.resolve(repositoryRoot, output), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
      console.log(JSON.stringify(evidence.summary));
      if (evidence.summary.fail > 0) process.exitCode = 1;
      return;
    }
    const applicationActions = await exerciseApplicationActions(bootstrap);
    record("customer-supplier-application-action-regression",
      applicationActions.passed ? "PASS" : "FAIL",
      "customer and supplier allocation actions with guarded synthetic session", applicationActions);
    for (const kind of ["customer", "supplier"]) {
      const terminal = await exerciseRefundTerminalTransitions(bootstrap, fixture, kind);
      record(`${kind}-refund-terminal-transitions-regression`, terminal.passed ? "PASS" : "FAIL",
        "request to rejection or cancellation; approved to cancellation; invalid and cross-tenant transitions",
        terminal);
    }
    for (const [scenario, amount] of [["S-02", 500], ["S-03", 300]]) {
      const advance = await exerciseCustomerAdvanceAllocation(bootstrap, fixture, scenario, amount);
      record(scenario, advance.passed && advance.initialRefundable === 500 &&
        advance.refundable === 500 ? "PASS" : "FAIL",
      "independent customer advance allocation and idempotent retry", advance);
    }
    for (const scenario of ["S-05", "S-06", "S-34", "S-35"]) {
      const advance = await exerciseSupplierAdvanceAllocation(bootstrap, fixture, scenario);
      record(scenario, advance.passed && advance.refundable === 1000 ? "PASS" : "FAIL",
        "independent supplier advance allocation and idempotent retry", advance);
    }
    for (const kind of ["customer", "supplier"]) {
      const refund = await exerciseUnappliedRefund(bootstrap, fixture, kind);
      record(refund.scenario, refund.passed ? "PASS" : "FAIL",
        "complete unapplied refund and idempotent retry without allocation", refund);
    }
    for (const scenario of ["S-12", "S-13", "S-17"]) {
      const refund = await exerciseAllocatedCustomerRefund(bootstrap, fixture, scenario);
      record(scenario, refund.passed ? "PASS" : "FAIL",
        "fully allocated customer payment refund and idempotent retry", refund);
    }
    for (const scenario of ["S-14", "S-15"]) {
      const reversal = await exerciseCustomerReversal(bootstrap, fixture, scenario);
      record(scenario, reversal.passed ? "PASS" : "FAIL",
        "customer allocation or payment reversal and idempotent retry", reversal);
    }
    const twoPayments = await exerciseTwoCustomerPayments(bootstrap, fixture);
    record("two-customer-payment-allocation-regression",
      twoPayments.passed && twoPayments.refundableTotal === 1000 ? "PASS" : "FAIL",
      "two separately traceable customer allocations and retries", twoPayments);
    const firstInput = allocationInput(fixture);
    const first = await allocatePayment(firstInput);
    const replayInput = allocationInput(fixture, { amount: 400, idempotencyKey: firstInput.idempotencyKey });
    const replay = await allocatePayment(replayInput).catch(() => null);
    const stateAfterAllocation = await readState(bootstrap, fixture);
    record("allocation-idempotency-replay-regression", replay?.replayed === true ? "PASS" : "FAIL", "allocatePayment", { persisted: stateAfterAllocation, allocationId: first.id });

    const conflictBefore = {
      payment: await readPaymentState(bootstrap, fixture, fixture.payments.a, fixture.invoices.salesA),
      audits: await readAuditState(bootstrap, fixture),
      allocationAudit: await readAllocationAuditState(bootstrap, fixture, first.id),
    };
    const conflictInput = allocationInput(fixture, { amount: 401, idempotencyKey: replayInput.idempotencyKey });
    const conflictError = await allocatePayment(conflictInput).then(() => null).catch((error) => error);
    const conflictAfter = {
      payment: await readPaymentState(bootstrap, fixture, fixture.payments.a, fixture.invoices.salesA),
      allocations: await sql(bootstrap, `
        SELECT count(*)::int AS count
        FROM payment_allocations
        WHERE tenant_id = $1 AND idempotency_key = $2
      `, [fixture.tenants.a, firstInput.idempotencyKey]),
      audits: await readAuditState(bootstrap, fixture),
    };
    record(
      "allocation-idempotency-payload-conflict-regression",
      conflictError && conflictAfter.payment.activeAllocations === conflictBefore.payment.activeAllocations &&
        Number(conflictAfter.allocations.rows[0].count) === 1 &&
        conflictAfter.audits.count === conflictBefore.audits.count &&
        conflictBefore.allocationAudit.count === 1 &&
        (await readAllocationAuditState(bootstrap, fixture, first.id)).count === 1
        ? "PASS" : "FAIL",
      "conflicting idempotency payload rejected",
      {
        expected: "conflicting payload rejected with one original financial mutation",
        inputs: { original: firstInput, conflicting: conflictInput },
        error: conflictError?.message ?? null,
        before: conflictBefore,
        after: { ...conflictAfter, allocations: conflictAfter.allocations.rows[0] },
          auditRecord: {
            originalAllocation: conflictBefore.allocationAudit,
            afterConflict: await readAllocationAuditState(bootstrap, fixture, first.id),
          },
        },
    );

    const reversed = await reverseAllocation({ ...context(fixture), allocationId: first.id, idempotencyKey: id("allocation-reversal") });
    const afterReversal = await readState(bootstrap, fixture);
    const ownReversal = await sql(bootstrap, `
      SELECT count(*)::int AS count, COALESCE(sum(amount), 0) AS amount
      FROM allocation_reversals WHERE tenant_id = $1 AND allocation_id = $2
    `, [fixture.tenants.a, first.id]);
    record("customer-allocation-reversal-regression",
      ownReversal.rows[0].count === 1 && Number(ownReversal.rows[0].amount) === 400 &&
        afterReversal.sales_paid === 0 && afterReversal.sales_due === 1000 ? "PASS" : "FAIL",
      "reverseAllocation", { persisted: afterReversal, ownReversal: ownReversal.rows[0], reversalId: reversed.id });

    const refundBefore = await readPaymentState(bootstrap, fixture, fixture.payments.b, fixture.invoices.salesB);
    const refundLifecycle = await requestAndApproveRefund(
      fixture,
      fixture.payments.b,
      200,
      "customer",
      fixture.customers.a,
      "customer-refund",
    );
    const refund = refundLifecycle.request;
    const refundRequestConflict = await requestRefund({
      ...context(fixture),
      paymentId: fixture.payments.b,
      counterpartyKind: "customer",
      counterpartyId: fixture.customers.a,
      amount: 201,
      idempotencyKey: refundLifecycle.requestInput.idempotencyKey,
    }).then(() => null).catch((error) => error);
    const completionInput = {
      ...context(fixture),
      refundId: refund.id,
      idempotencyKey: id("customer-refund-completion"),
    };
    const completionResults = await Promise.all([
      completeRefund(completionInput),
      completeRefund(completionInput),
    ]);
    const completionConflict = await completeRefund({
      ...completionInput,
      reason: "different payload",
    }).then(() => null).catch((error) => error);
    const refundAfter = await readPaymentState(bootstrap, fixture, fixture.payments.b, fixture.invoices.salesB);
    const refundRow = await sql(bootstrap, `
      SELECT id, amount, status, idempotency_key, approved_at, completed_at
      FROM payment_refunds
      WHERE tenant_id = $1 AND id = $2
    `, [fixture.tenants.a, refund.id]);
    const refundAudit = await sql(bootstrap, `
      SELECT event_type, count(*)::int AS count
      FROM audit_logs
      WHERE tenant_id = $1 AND target_type = 'payment_refund' AND target_id = $2
      GROUP BY event_type ORDER BY event_type
    `, [fixture.tenants.a, refund.id]);
    const customerLedger = await sql(bootstrap, `
      SELECT count(*)::int AS count, COALESCE(sum(debit), 0) AS debit
      FROM customer_ledgers
      WHERE tenant_id = $1 AND reference_type = 'payment_refund' AND reference_id = $2
    `, [fixture.tenants.a, refund.id]);
    record(
      "customer-refund-lifecycle-regression",
      refundLifecycle.requestReplay.replayed === true &&
        refundLifecycle.approvalReplay.replayed === true &&
        completionResults.some((result) => result.replayed === true) &&
        completionResults.every((result) => result.id === refund.id) &&
        refundRequestConflict &&
        completionConflict &&
        refundAfter.refunds - refundBefore.refunds === 200 &&
        refundAfter.activeAllocations === refundBefore.activeAllocations &&
        refundRow.rows.length === 1 && Number(refundRow.rows[0].amount) === 200 &&
        refundRow.rows[0].status === "COMPLETED" &&
        refundRow.rows[0].approved_at && refundRow.rows[0].completed_at &&
        refundAudit.rows.length === 3 &&
        refundAudit.rows.every((row) => Number(row.count) === 1) &&
        Number(customerLedger.rows[0].count) === 1 &&
        Number(customerLedger.rows[0].debit) === 200
        ? "PASS" : "FAIL",
      "customer request, approval, completion, concurrency, and idempotency",
      {
        expected: "one persisted lifecycle and ledger event; request does not consume funds; duplicate completion has one winner",
        inputs: { paymentId: fixture.payments.b, amount: 200 },
        before: refundBefore,
        after: refundAfter,
        refund: refundRow.rows[0] ?? null,
        audit: refundAudit.rows,
        ledger: customerLedger.rows[0],
        requestConflict: refundRequestConflict?.message ?? null,
        completionConflict: completionConflict?.message ?? null,
        completionResults,
        refundId: refund.id,
      },
    );

    const partialAllocation = await allocatePayment({
      ...context(fixture),
      paymentId: fixture.payments.c,
      invoiceId: fixture.invoices.salesB,
      invoiceKind: "sales",
      amount: 600,
      idempotencyKey: id("partial-refund-allocation"),
    });
    const cancelRequest = await requestRefund({
      ...context(fixture),
      paymentId: fixture.payments.c,
      counterpartyKind: "customer",
      counterpartyId: fixture.customers.a,
      amount: 25,
      idempotencyKey: id("customer-refund-cancel-request"),
    });
    const cancelResult = await cancelRefund({
      ...context(fixture),
      refundId: cancelRequest.id,
      idempotencyKey: id("customer-refund-cancel"),
    });
    const rejectedRequest = await requestRefund({
      ...context(fixture),
      paymentId: fixture.payments.c,
      counterpartyKind: "customer",
      counterpartyId: fixture.customers.a,
      amount: 25,
      idempotencyKey: id("customer-refund-reject-request"),
    });
    const rejectionResult = await rejectRefund({
      ...context(fixture),
      refundId: rejectedRequest.id,
      idempotencyKey: id("customer-refund-reject"),
    });
    const partialLifecycle = await requestAndApproveRefund(
      fixture,
      fixture.payments.c,
      200,
      "customer",
      fixture.customers.a,
      "partial-refund",
    );
    const partialCompletionInput = {
      ...context(fixture),
      refundId: partialLifecycle.request.id,
      idempotencyKey: id("partial-refund-completion"),
    };
    const partialRefund = await completeRefund(partialCompletionInput);
    const partialRefundReplay = await completeRefund(partialCompletionInput);
    const partialRefundState = await readPaymentState(bootstrap, fixture, fixture.payments.c, fixture.invoices.salesB);
    const terminalRefunds = await sql(bootstrap, `
      SELECT id, status
      FROM payment_refunds
      WHERE tenant_id = $1 AND id = ANY($2::text[])
    `, [fixture.tenants.a, [cancelRequest.id, rejectedRequest.id]]);
    record(
      "refund request terminal transitions",
      terminalRefunds.rows.length === 2 &&
        terminalRefunds.rows.some((row) => row.id === cancelRequest.id && row.status === "CANCELLED") &&
        terminalRefunds.rows.some((row) => row.id === rejectedRequest.id && row.status === "REJECTED") &&
        cancelResult.id === cancelRequest.id &&
        rejectionResult.id === rejectedRequest.id
        ? "PASS" : "FAIL",
      "cancel unapproved request and reject request",
      { persisted: terminalRefunds.rows },
    );
    record(
      "customer-partial-refund-regression",
      partialRefundReplay.replayed === true &&
        partialRefundState.activeAllocations === 400 &&
        partialRefundState.allocationReversals === 200 &&
        partialRefundState.refunds === 200 &&
        partialRefundState.usable === 400 &&
        partialRefundState.invoicePaid === 400 &&
        partialRefundState.invoiceDue === 200
        ? "PASS" : "FAIL",
      "partial allocation refund and idempotent retry",
      { persisted: partialRefundState, allocationId: partialAllocation.id, refundId: partialRefund.id },
    );

    const fullLifecycle = await requestAndApproveRefund(
      fixture,
      fixture.payments.c,
      800,
      "customer",
      fixture.customers.a,
      "full-refund",
    );
    const fullCompletionInput = {
      ...context(fixture),
      refundId: fullLifecycle.request.id,
      idempotencyKey: id("full-refund-completion"),
    };
    const fullRefund = await completeRefund(fullCompletionInput);
    const fullRefundReplay = await completeRefund(fullCompletionInput);
    const fullRefundState = await readPaymentState(bootstrap, fixture, fixture.payments.c, fixture.invoices.salesB);
    record(
      "customer-full-refund-regression",
      fullRefundReplay.replayed === true &&
        fullRefundState.activeAllocations === 0 &&
        fullRefundState.refunds === 1000 &&
        fullRefundState.usable === 0 &&
        fullRefundState.invoicePaid === 0 &&
        fullRefundState.invoiceDue === 600
        ? "PASS" : "FAIL",
      "full refund after partial refund and idempotent retry",
      { persisted: fullRefundState, refundId: fullRefund.id },
    );

    const supplierBefore = await readSupplierState(bootstrap, fixture, fixture.payments.supplier, fixture.invoices.purchaseA);
    const supplier = await allocatePayment({
      ...context(fixture),
      paymentId: fixture.payments.supplier,
      invoiceId: fixture.invoices.purchaseA,
      invoiceKind: "purchase",
      amount: 400,
      idempotencyKey: id("supplier-allocation"),
    });
    const supplierAfter = await readSupplierState(bootstrap, fixture, fixture.payments.supplier, fixture.invoices.purchaseA);
    const supplierLedger = await sql(bootstrap, `
      SELECT count(*)::int AS count
      FROM supplier_ledgers
      WHERE tenant_id = $1 AND reference_type = 'payment_allocation' AND reference_id = $2
    `, [fixture.tenants.a, supplier.id]);
    record(
      "supplier-allocation-cache-neutrality-regression",
      supplier.id && supplierAfter.activeAllocations - supplierBefore.activeAllocations === 400 &&
        supplierAfter.invoiceDue === 200 && supplierAfter.usable === 200 &&
        supplierAfter.allocationCount === 1 &&
        supplierAfter.supplierPayable === supplierBefore.supplierPayable
        ? "PASS" : "FAIL",
      "supplier allocation",
      {
        expected: "₹400 allocation against ₹600 supplier invoice; ₹200 usable, ₹200 invoice due, and no net AP cache change",
        before: supplierBefore,
        after: supplierAfter,
        allocationId: supplier.id,
        auditBoundary: "No supplier-ledger allocation row is written by the reconciliation service.",
        supplierLedgerRows: supplierLedger.rows[0],
      },
    );

    const supplierRefundTransitions = {};
    const supplierRefundLifecycle = await requestAndApproveRefund(
      fixture,
      fixture.payments.supplier,
      200,
      "supplier",
      fixture.supplier,
      "supplier-refund",
      async (stage, refundId) => {
        const state = await readSupplierState(bootstrap, fixture, fixture.payments.supplier, fixture.invoices.purchaseA);
        const persisted = await sql(bootstrap, `
          SELECT status,
            (SELECT count(*)::int FROM supplier_ledgers l WHERE l.tenant_id = r.tenant_id
              AND l.reference_type = 'payment_refund' AND l.reference_id = r.id) AS ledger_rows,
            (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = r.tenant_id
              AND a.target_type = 'payment_refund' AND a.target_id = r.id) AS audit_rows
          FROM payment_refunds r WHERE r.tenant_id = $1 AND r.id = $2
        `, [fixture.tenants.a, refundId]);
        supplierRefundTransitions[stage] = { state, persisted: persisted.rows[0] };
      },
    );
    const supplierRefundCompletionInput = {
      ...context(fixture),
      refundId: supplierRefundLifecycle.request.id,
      idempotencyKey: id("supplier-refund-completion"),
    };
    const supplierRefund = await completeRefund(supplierRefundCompletionInput);
    const supplierRefundReplay = await completeRefund(supplierRefundCompletionInput);
    const supplierRefundAfter = await readSupplierState(
      bootstrap,
      fixture,
      fixture.payments.supplier,
      fixture.invoices.purchaseA,
    );
    const supplierRefundPersisted = await sql(bootstrap, `
      SELECT r.status, r.amount, s.payable_balance,
        (SELECT count(*)::int FROM supplier_ledgers l
         WHERE l.tenant_id = r.tenant_id
           AND l.reference_type = 'payment_refund'
           AND l.reference_id = r.id) AS ledger_rows,
        (SELECT COALESCE(sum(l.credit), 0) FROM supplier_ledgers l
         WHERE l.tenant_id = r.tenant_id
           AND l.reference_type = 'payment_refund'
           AND l.reference_id = r.id) AS ledger_credit,
        (SELECT count(*)::int FROM audit_logs a
         WHERE a.tenant_id = r.tenant_id
           AND a.target_type = 'payment_refund'
           AND a.target_id = r.id) AS audit_rows
      FROM payment_refunds r
      JOIN suppliers s ON s.tenant_id = r.tenant_id AND s.id = $2
      WHERE r.tenant_id = $1 AND r.id = $3
    `, [fixture.tenants.a, fixture.supplier, supplierRefund.id]);
    const supplierRefundRow = supplierRefundPersisted.rows[0];
    record(
      "supplier-refund-payable-cache-regression",
      supplierRefundReplay.replayed === true &&
        JSON.stringify(supplierRefundTransitions.requested.state) === JSON.stringify(supplierAfter) &&
        JSON.stringify(supplierRefundTransitions.approved.state) === JSON.stringify(supplierAfter) &&
        supplierRefundTransitions.requested.persisted.status === "REQUESTED" &&
        supplierRefundTransitions.approved.persisted.status === "APPROVED" &&
        supplierRefundTransitions.requested.persisted.ledger_rows === 0 &&
        supplierRefundTransitions.approved.persisted.ledger_rows === 0 &&
        supplierRefundTransitions.requested.persisted.audit_rows === 1 &&
        supplierRefundTransitions.approved.persisted.audit_rows === 2 &&
        supplierRefundAfter.activeAllocations === 200 &&
        supplierRefundAfter.refunds === 200 &&
        supplierRefundAfter.usable === 200 &&
        supplierRefundAfter.invoiceDue === 400 &&
        supplierRefundAfter.supplierAdvance === 200 &&
        supplierRefundAfter.netAP === 200 &&
        supplierRefundAfter.supplierPayable === supplierRefundAfter.netAP &&
        supplierRefundRow?.status === "COMPLETED" &&
        Number(supplierRefundRow.amount) === 200 &&
        Number(supplierRefundRow.payable_balance) === 200 &&
        Number(supplierRefundRow.ledger_rows) === 1 &&
        Number(supplierRefundRow.ledger_credit) === 200 &&
        Number(supplierRefundRow.audit_rows) === 3
        ? "PASS" : "FAIL",
      "supplier refund request, approval, completion, net AP, persisted ledger and audit",
      {
        expected: "Net AP = gross AP 400 - unapplied advance 200 = 200; payment 600, active allocation 200, completed refund 200; exactly one refund ledger posting",
        before: { initial: supplierBefore, afterAllocation: supplierAfter, ...supplierRefundTransitions },
        after: supplierRefundAfter,
        persisted: supplierRefundRow ?? null,
        refundId: supplierRefund.id,
        replay: supplierRefundReplay,
      },
    );

    const reversalKey = id("payment-reversal");
    const paymentReversal = await reversePayment({
      ...context(fixture),
      paymentId: fixture.payments.supplier,
      idempotencyKey: reversalKey,
    });
    const paymentReversalReplay = await reversePayment({
      ...context(fixture),
      paymentId: fixture.payments.supplier,
      idempotencyKey: reversalKey,
    });
    const supplierReversalState = await sql(bootstrap, `
      SELECT
        (SELECT amount FROM payment_reversals WHERE tenant_id = $1 AND payment_id = $2) AS reversal_amount,
        (SELECT count(*) FROM allocation_reversals ar
          JOIN payment_allocations pa ON pa.tenant_id = ar.tenant_id AND pa.id = ar.allocation_id
          WHERE ar.tenant_id = $1 AND pa.payment_id = $2) AS allocation_reversals,
        (SELECT COALESCE(sum(pa.amount - COALESCE(reversed.total, 0)), 0)
          FROM payment_allocations pa
          LEFT JOIN LATERAL (
            SELECT sum(ar.amount) AS total FROM allocation_reversals ar
            WHERE ar.tenant_id = pa.tenant_id AND ar.allocation_id = pa.id
          ) reversed ON true
          WHERE pa.tenant_id = $1 AND pa.payment_id = $2) AS active_allocations
    `, [fixture.tenants.a, fixture.payments.supplier]);
    const supplierReversalRow = supplierReversalState.rows[0];
    record(
      "supplier-payment-reversal-regression",
      paymentReversalReplay.replayed === true &&
        paymentReversal.id === paymentReversalReplay.id &&
        Number(supplierReversalRow.reversal_amount) === 400 &&
        Number(supplierReversalRow.allocation_reversals) === 2 &&
        Number(supplierReversalRow.active_allocations) === 0
        ? "PASS" : "FAIL",
      "payment reversal and idempotent retry",
      { persisted: supplierReversalRow, reversalId: paymentReversal.id },
    );

    const tenantBefore = {
      payment: await readPaymentState(bootstrap, fixture, fixture.payments.a, fixture.invoices.salesA),
      invoice: await sql(bootstrap, "SELECT balance_due FROM sales_invoices WHERE tenant_id = $1 AND id = $2", [fixture.tenants.b, fixture.invoices.salesTenantB]),
      tenantBAllocations: await sql(bootstrap, "SELECT count(*)::int AS allocations FROM payment_allocations WHERE tenant_id = $1", [fixture.tenants.b]),
      auditA: await readAuditState(bootstrap, fixture, fixture.tenants.a),
      auditB: await readAuditState(bootstrap, fixture, fixture.tenants.b),
      financialRows: await readTenantFinancialRowCounts(bootstrap, fixture),
    };
    const crossTenantPaymentInput = allocationInput(fixture, {
      tenantId: fixture.tenants.b,
      subjectId: fixture.subjects.b,
      paymentId: fixture.payments.a,
      invoiceId: fixture.invoices.salesTenantB,
      idempotencyKey: id("cross-tenant-payment"),
    });
    const crossTenantPaymentError = await allocatePayment(crossTenantPaymentInput).then(() => null).catch((error) => error);
    const crossTenantInvoiceInput = allocationInput(fixture, {
      tenantId: fixture.tenants.a,
      subjectId: fixture.subjects.a,
      paymentId: fixture.payments.a,
      invoiceId: fixture.invoices.salesTenantB,
      idempotencyKey: id("cross-tenant-invoice"),
    });
    const crossTenantInvoiceError = await allocatePayment(crossTenantInvoiceInput).then(() => null).catch((error) => error);
    const tenantAfter = {
      payment: await readPaymentState(bootstrap, fixture, fixture.payments.a, fixture.invoices.salesA),
      invoice: await sql(bootstrap, "SELECT balance_due FROM sales_invoices WHERE tenant_id = $1 AND id = $2", [fixture.tenants.b, fixture.invoices.salesTenantB]),
      tenantBAllocations: await sql(bootstrap, "SELECT count(*)::int AS allocations FROM payment_allocations WHERE tenant_id = $1", [fixture.tenants.b]),
      auditA: await readAuditState(bootstrap, fixture, fixture.tenants.a),
      auditB: await readAuditState(bootstrap, fixture, fixture.tenants.b),
      financialRows: await readTenantFinancialRowCounts(bootstrap, fixture),
    };
    const validRetryInput = { ...crossTenantInvoiceInput, invoiceId: fixture.invoices.salesA };
    const validRetry = await allocatePayment(validRetryInput);
    const validRetryPersisted = await sql(bootstrap, `
      SELECT id, amount FROM payment_allocations
      WHERE tenant_id = $1 AND payment_id = $2 AND sales_invoice_id = $3 AND idempotency_key = $4
    `, [fixture.tenants.a, fixture.payments.a, fixture.invoices.salesA, validRetryInput.idempotencyKey]);
    record(
      "S-29",
      crossTenantPaymentError && crossTenantInvoiceError &&
        JSON.stringify(tenantAfter.payment) === JSON.stringify(tenantBefore.payment) &&
        Number(tenantAfter.invoice.rows[0].balance_due) === Number(tenantBefore.invoice.rows[0].balance_due) &&
        Number(tenantAfter.tenantBAllocations.rows[0].allocations) === Number(tenantBefore.tenantBAllocations.rows[0].allocations) &&
        tenantAfter.auditA.count === tenantBefore.auditA.count &&
        tenantAfter.auditB.count === tenantBefore.auditB.count &&
        JSON.stringify(tenantAfter.financialRows) === JSON.stringify(tenantBefore.financialRows) &&
        validRetryPersisted.rows.length === 1 &&
        validRetryPersisted.rows[0].id === validRetry.id &&
        Number(validRetryPersisted.rows[0].amount) === 400
        ? "PASS" : "FAIL",
      "cross-tenant payment and invoice ownership rejected",
      {
        tenants: { tenantA: fixture.tenants.a, tenantB: fixture.tenants.b },
        inputs: [crossTenantPaymentInput, crossTenantInvoiceInput],
        errors: {
          paymentOwnership: crossTenantPaymentError?.message ?? null,
          invoiceOwnership: crossTenantInvoiceError?.message ?? null,
        },
        before: {
          payment: tenantBefore.payment,
          tenantBInvoice: tenantBefore.invoice.rows[0],
          tenantBAllocations: tenantBefore.tenantBAllocations.rows[0],
          auditCounts: { tenantA: tenantBefore.auditA.count, tenantB: tenantBefore.auditB.count },
          financialRows: tenantBefore.financialRows,
        },
        after: {
          payment: tenantAfter.payment,
          tenantBInvoice: tenantAfter.invoice.rows[0],
          tenantBAllocations: tenantAfter.tenantBAllocations.rows[0],
          auditCounts: { tenantA: tenantAfter.auditA.count, tenantB: tenantAfter.auditB.count },
          financialRows: tenantAfter.financialRows,
        },
        validRetry: { input: validRetryInput, result: validRetry, persisted: validRetryPersisted.rows },
        auditBoundary: "No audit/security event row is written by the reconciliation service.",
      },
    );

    const racePayment = fixture.payments.a;
    const raceInputA = allocationInput(fixture, { paymentId: racePayment, amount: 400, idempotencyKey: id("race-a"), invoiceId: fixture.invoices.salesB });
    const raceInputB = allocationInput(fixture, { paymentId: racePayment, amount: 400, idempotencyKey: id("race-b"), invoiceId: fixture.invoices.salesB });
    let raceArrivals = 0;
    let releaseRace;
    const raceBarrier = new Promise((resolve) => { releaseRace = resolve; });
    const allocateAtRaceBarrier = async (input) => {
      raceArrivals += 1;
      if (raceArrivals === 2) releaseRace();
      await raceBarrier;
      return allocatePayment(input);
    };
    const race = await Promise.allSettled([
      allocateAtRaceBarrier(raceInputA),
      allocateAtRaceBarrier(raceInputB),
    ]);
    const raceWrites = race.filter((entry) => entry.status === "fulfilled").length;
    const raceRejected = race.filter((entry) => entry.status === "rejected");
    const raceWinnerIndex = race.findIndex((entry) => entry.status === "fulfilled");
    const raceWinner = raceWinnerIndex === 0 ? raceInputA : raceInputB;
    const raceWinnerResult = raceWinnerIndex >= 0 ? race[raceWinnerIndex].value : null;
    const raceRetry = raceWinnerIndex >= 0 ? await allocatePayment(raceWinner) : null;
    const racePersisted = await sql(bootstrap, `
      SELECT
        count(*)::int AS allocation_count,
        COALESCE(sum(amount), 0) AS allocation_total,
        (SELECT balance_due FROM sales_invoices WHERE tenant_id = $1 AND id = $2) AS invoice_due
      FROM payment_allocations
      WHERE tenant_id = $1 AND payment_id = $3 AND sales_invoice_id = $2
    `, [fixture.tenants.a, fixture.invoices.salesB, racePayment]);
    const racePersistedRow = racePersisted.rows[0];
    record(
      "allocation-concurrency-regression",
      raceWrites === 1 &&
        raceRejected.length === 1 &&
        raceRetry?.replayed === true &&
        raceRetry.id === raceWinnerResult?.id &&
        Number(racePersistedRow.allocation_count) === 1 &&
        Number(racePersistedRow.allocation_total) === 400 &&
        Number(racePersistedRow.invoice_due) === 200
        ? "PASS" : "FAIL",
      "concurrent competing allocations",
      {
        expected: "two barrier-synchronized ₹400 requests; exactly one succeeds; winner retry replays; invoice due is ₹200",
        inputs: [raceInputA, raceInputB],
        outcomes: race.map((entry) => entry.status === "fulfilled"
          ? { status: entry.status, value: entry.value }
          : { status: entry.status, error: entry.reason?.message ?? "unknown" }),
        fulfilled: raceWrites,
        rejected: raceRejected.length,
        winningIdempotencyKey: raceWinner.idempotencyKey,
        winnerReplay: raceRetry,
        rejectionReasons: raceRejected.map((entry) => entry.reason?.message ?? "unknown"),
        persisted: {
          targetInvoice: racePersistedRow,
          payment: await readPaymentState(bootstrap, fixture, racePayment, fixture.invoices.salesB),
        },
      },
    );

    const beforeRollback = {
      allocations: await sql(bootstrap, "SELECT count(*)::int AS count FROM payment_allocations WHERE tenant_id = $1", [fixture.tenants.a]),
      audits: await readAuditState(bootstrap, fixture),
      payment: await readPaymentState(bootstrap, fixture, fixture.payments.a, fixture.invoices.salesB),
    };
    const rollbackError = await runReconciliationMutation({ ...context(fixture), userId: fixture.subjects.a, membershipId: fixture.subjects.a, roles: [], permissions: [] }, async (tx) => {
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
    }).then(() => null).catch((error) => error);
    const afterRollback = {
      allocations: await sql(bootstrap, "SELECT count(*)::int AS count FROM payment_allocations WHERE tenant_id = $1", [fixture.tenants.a]),
      audits: await readAuditState(bootstrap, fixture),
      payment: await readPaymentState(bootstrap, fixture, fixture.payments.a, fixture.invoices.salesB),
    };
    record(
      "allocation-transaction-rollback-regression",
      rollbackError && Number(beforeRollback.allocations.rows[0].count) === Number(afterRollback.allocations.rows[0].count) &&
        beforeRollback.audits.count === afterRollback.audits.count &&
        JSON.stringify(beforeRollback.payment) === JSON.stringify(afterRollback.payment)
        ? "PASS" : "FAIL",
      "controlled transaction rollback",
      {
        failurePoint: "after payment_allocations INSERT, before transaction commit",
        error: rollbackError?.message ?? null,
        before: { allocations: beforeRollback.allocations.rows[0], audits: beforeRollback.audits, payment: beforeRollback.payment },
        after: { allocations: afterRollback.allocations.rows[0], audits: afterRollback.audits, payment: afterRollback.payment },
        auditBoundary: "No audit row is written by the reconciliation service.",
      },
    );

    const blockedScenarios = {
      "S-01": "Exact customer advance and customer-credit ledger fixture is not implemented.",
      "S-04": "Exact supplier advance and supplier-advance ledger fixture is not implemented.",
      "S-07": "Exact customer partial-settlement fixture is not implemented.",
      "S-08": "Matrix initial state claims zero customer credit despite two unallocated payments with ₹1,000 usable, conflicting with net AR = gross AR - unapplied credit. A related allocation regression passed but does not establish those preconditions.",
      "S-09": "One customer payment allocated across two invoices is not implemented.",
      "S-10": "Multiple customer payments against one invoice and third-allocation rejection are not implemented.",
      "S-16": "Refund-ledger failure rollback after allocation reversal is not implemented; the available rollback regression inserts an allocation.",
      "S-18": "Credit-note rejection/approval and audit boundary is not implemented.",
      "S-19": "Finalized customer invoice mutation rejection is not asserted by this harness.",
      "S-20": "Effective-time versus recorded-time as-of reporting is not implemented.",
      "S-21": "Finalized customer invoice due-date immutability is not asserted by this harness.",
      "S-22": "Exact same-payment/same-invoice ₹400 concurrency fixture with ₹500 payment is not implemented.",
      "S-23": "Exact two-payment/same-invoice concurrency fixture is not implemented.",
      "S-24": "Exact stale-read concurrency fixture with controlled pre-lock reads is not implemented.",
      "S-25": "Legacy payment cutover and opening-ledger boundary is not implemented.",
      "S-26": "Audited legacy-payment reclassification is not implemented.",
      "S-27": "Unsupported Cheque rejection before persistence is not asserted by this harness.",
      "S-28": "Concurrent tenant receipt-number serialization is not implemented.",
      "S-30": "Unsupported payment-currency rejection is not implemented.",
      "S-31": "Two supplier payments allocated to one invoice are not implemented.",
      "S-32": "One supplier payment allocated across two invoices is not implemented.",
      "S-33": "Exact supplier partial-settlement fixture with a ₹2,000 invoice and ₹750 payment is not implemented.",
      "S-37": "Supplier payment reversal followed by corrected payment repost is not implemented.",
      "S-38": "Supplier debit-adjustment workflow and audit boundary is not implemented.",
    };
    for (const [scenarioId, reason] of Object.entries(blockedScenarios)) {
      record(scenarioId, "BLOCKED", reason);
    }

    const evidence = {
      campaign: "Financial Reconciliation - Runtime Scenario Harness",
      target: "run-scoped disposable PostgreSQL only",
      fixture: { tenants: fixture.tenants },
      runId: process.env.FINANCIAL_E2E_RUN_ID ?? "runtime",
      recordedAt: new Date().toISOString(),
      expectationReference: ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md",
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
    if (evidence.summary.fail > 0) process.exitCode = 1;
  } finally {
    await runtime.end();
    await bootstrap.end();
  }
}

run().catch((error) => {
  console.error(`FINANCIAL_RECONCILIATION_HARNESS=FAIL: ${error.message}`);
  process.exitCode = 1;
});
