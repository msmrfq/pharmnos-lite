import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function compile(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function load(path, imports = {}) {
  const module = { exports: {} };
  new Function("require", "module", "exports", compile(path))((name) => {
    if (name in imports) return imports[name];
    if (name === "node:crypto") return { createHash };
    throw new Error(`Unexpected import in ${path}: ${name}`);
  }, module, module.exports);
  return module.exports;
}

const decimal = load("../src/lib/decimal.ts");
const businessDate = load("../src/lib/utils/business-date.ts");
const temporal = load("../src/lib/utils/financial-temporal.ts", { "@/lib/utils/business-date": businessDate });

const T = "tenant-1";
const ACTOR = "user-1";
const TABLES = [
  "payments", "payment_allocations", "allocation_reversals", "payment_reversals",
  "payment_refunds", "sales_invoices", "purchase_invoices", "customers", "suppliers",
  "customer_ledgers", "supplier_ledgers", "audit_logs",
];

const day = (value) => new Date(`${value}T00:00:00.000Z`);

// An in-memory world with transaction rollback. Tables without update/create methods
// (payments, allocations) throw if the service ever tries to rewrite them.
function createWorld(instants) {
  const state = Object.fromEntries(TABLES.map((name) => [name, []]));
  const world = { state, captured: 0, nextId: 1, queryLog: [] };
  const id = (prefix) => `${prefix}-${world.nextId++}`;
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      return Object.entries(value).every(([inner, expected]) => row[inner] === expected);
    }
    return row[key] === value;
  });
  const find = (table, where) => state[table].find((row) => matches(row, where)) ?? null;
  const withReversal = (row) => ({
    ...row,
    reversal: state.allocation_reversals
      .filter((entry) => entry.allocation_id === row.id)
      .map((entry) => ({ amount: entry.amount })),
  });

  const creator = (table, prefix) => async ({ data }) => {
    const row = { id: id(prefix), ...data };
    state[table].push(row);
    return { ...row };
  };
  const updater = (table) => async ({ where, data }) => {
    const row = find(table, where);
    assert.ok(row, `${table} row to update must exist`);
    Object.assign(row, data);
    return { ...row };
  };

  const tx = {
    $queryRaw: async (query) => {
      const sql = query.strings.join("?");
      world.queryLog.push({ sql, values: query.values });
      const [tenantId, second] = query.values;
      const hit = (table, where) => {
        const row = state[table].find((entry) => entry.tenant_id === tenantId && matches(entry, where));
        return row ? [{ ...row }] : [];
      };
      if (sql.includes('FROM "customers"')) return hit("customers", { id: second });
      if (sql.includes('FROM "suppliers"')) return hit("suppliers", { id: second });
      if (sql.includes('FROM "payments"')) return hit("payments", { id: second });
      if (sql.includes('FROM "sales_invoices"')) return hit("sales_invoices", { id: second });
      if (sql.includes('FROM "purchase_invoices"')) return hit("purchase_invoices", { id: second });
      if (sql.includes('FROM "audit_logs"')) {
        const row = state.audit_logs.find((entry) =>
          entry.tenant_id === tenantId &&
          entry.target_type === "payment_refund" &&
          entry.metadata?.refundLifecycleVersion === 1 &&
          entry.metadata?.idempotencyKey === second);
        return row ? [{ target_id: row.target_id, event_type: row.event_type, metadata: row.metadata }] : [];
      }
      throw new Error(`Unexpected raw query: ${sql}`);
    },
    payments: { findUnique: async ({ where }) => find("payments", { tenant_id: where.tenant_id_id.tenant_id, id: where.tenant_id_id.id }) },
    payment_allocations: {
      findMany: async ({ where }) => state.payment_allocations.filter((row) => matches(row, where)).map(withReversal),
      findUnique: async ({ where }) => {
        const key = where.tenant_id_id ?? where.tenant_id_idempotency_key;
        const row = state.payment_allocations.find((entry) =>
          entry.tenant_id === key.tenant_id &&
          (where.tenant_id_id ? entry.id === key.id : entry.idempotency_key === key.idempotency_key));
        return row ? withReversal(row) : null;
      },
      create: creator("payment_allocations", "alloc"),
    },
    allocation_reversals: {
      findUnique: async ({ where }) =>
        state.allocation_reversals.find((row) =>
          row.tenant_id === where.tenant_id_idempotency_key.tenant_id &&
          row.idempotency_key === where.tenant_id_idempotency_key.idempotency_key) ?? null,
      create: creator("allocation_reversals", "arev"),
    },
    payment_reversals: {
      findUnique: async ({ where }) => {
        if (where.tenant_id_payment_id) {
          return state.payment_reversals.find((row) =>
            row.tenant_id === where.tenant_id_payment_id.tenant_id &&
            row.payment_id === where.tenant_id_payment_id.payment_id) ?? null;
        }
        return state.payment_reversals.find((row) =>
          row.tenant_id === where.tenant_id_idempotency_key.tenant_id &&
          row.idempotency_key === where.tenant_id_idempotency_key.idempotency_key) ?? null;
      },
      create: creator("payment_reversals", "prev"),
    },
    payment_refunds: {
      findUnique: async ({ where }) => {
        if (where.tenant_id_id) return find("payment_refunds", { tenant_id: where.tenant_id_id.tenant_id, id: where.tenant_id_id.id });
        return find("payment_refunds", {
          tenant_id: where.tenant_id_idempotency_key.tenant_id,
          idempotency_key: where.tenant_id_idempotency_key.idempotency_key,
        });
      },
      findMany: async ({ where }) => state.payment_refunds.filter((row) => matches(row, where)),
      create: creator("payment_refunds", "refund"),
      update: async ({ where, data }) => updater("payment_refunds")({ where: where.tenant_id_id, data }),
    },
    sales_invoices: {
      findUnique: async ({ where }) => find("sales_invoices", where.tenant_id_id),
      update: async ({ where, data }) => updater("sales_invoices")({ where: where.tenant_id_id, data }),
    },
    purchase_invoices: { findUnique: async ({ where }) => find("purchase_invoices", where.tenant_id_id) },
    customers: {
      findUnique: async ({ where }) => find("customers", where.tenant_id_id),
      update: async ({ where, data }) => updater("customers")({ where: where.tenant_id_id, data }),
    },
    suppliers: {
      findUnique: async ({ where }) => find("suppliers", where.tenant_id_id),
      update: async ({ where, data }) => updater("suppliers")({ where: where.tenant_id_id, data }),
    },
    customer_ledgers: { create: creator("customer_ledgers", "cled") },
    supplier_ledgers: { create: creator("supplier_ledgers", "sled") },
    audit_logs: { create: creator("audit_logs", "audit") },
  };

  const prisma = {
    $transaction: async (work) => {
      const snapshot = structuredClone(state);
      try {
        return await work(tx);
      } catch (error) {
        for (const name of TABLES) state[name] = snapshot[name];
        throw error;
      }
    },
  };

  const service = load("../src/domain/services/financial-reconciliation.service.ts", {
    "@prisma/client": {
      Prisma: {
        sql: (strings, ...values) => ({ strings: [...strings], values }),
        PrismaClientKnownRequestError: class extends Error {},
        TransactionIsolationLevel: { Serializable: "Serializable" },
      },
    },
    "@/lib/db/prisma": { prisma },
    "@/lib/db/tenant-context": { establishTenantContext: async () => {} },
    "@/lib/decimal": decimal,
    "@/lib/utils/financial-temporal": {
      ...temporal,
      // One instant per call lets a test prove an operation captures exactly one.
      captureSystemInstant: () => {
        const next = instants[world.captured];
        world.captured += 1;
        assert.ok(next, "unexpected extra captureSystemInstant call");
        return temporal.captureSystemInstant(new Date(next));
      },
    },
  });
  world.service = service;
  return world;
}

function seedCustomer(world) {
  const { state } = world;
  state.customers.push({ id: "c1", tenant_id: T, receivable_balance: 100 });
  state.sales_invoices.push(
    { id: "inv1", tenant_id: T, customer_id: "c1", net_amount: 60, status: "FINALIZED", paid_amount: 60, balance_due: 0 },
    { id: "inv2", tenant_id: T, customer_id: "c1", net_amount: 20, status: "FINALIZED", paid_amount: 20, balance_due: 0 },
  );
  state.payments.push({
    id: "p1", tenant_id: T, customer_id: "c1", supplier_id: null, amount: 100,
    payment_date: day("2026-11-01"), effective_date: day("2026-11-01"),
    effective_date_basis: "EXPLICIT", occurred_at: null,
  });
  for (const [allocationId, invoiceId, amount] of [["a1", "inv1", 60], ["a2", "inv2", 20]]) {
    state.payment_allocations.push({
      id: allocationId, tenant_id: T, payment_id: "p1", sales_invoice_id: invoiceId,
      purchase_invoice_id: null, amount, idempotency_key: `seed-${allocationId}`,
      effective_date: day("2026-11-02"), occurred_at: new Date("2026-11-02T06:00:00.000Z"),
    });
  }
}

function seedSupplier(world) {
  const { state } = world;
  state.suppliers.push({ id: "s1", tenant_id: T, payable_balance: 100 });
  state.purchase_invoices.push({ id: "pi1", tenant_id: T, supplier_id: "s1", net_amount: 60, status: "FINALIZED" });
  state.payments.push({
    id: "ps1", tenant_id: T, customer_id: null, supplier_id: "s1", amount: 100,
    payment_date: day("2026-11-01"), effective_date: day("2026-11-01"),
    effective_date_basis: "EXPLICIT", occurred_at: null,
  });
  state.payment_allocations.push({
    id: "b1", tenant_id: T, payment_id: "ps1", sales_invoice_id: null, purchase_invoice_id: "pi1",
    amount: 60, idempotency_key: "seed-b1",
    effective_date: day("2026-11-02"), occurred_at: new Date("2026-11-02T06:00:00.000Z"),
  });
}

const base = { tenantId: T, subjectId: ACTOR, actorId: ACTOR };
// 2026-11-08T19:00Z is 2026-11-09 00:30 in Asia/Kolkata, which is still 2026-11-08 in UTC.
const NIGHT = "2026-11-08T19:00:00.000Z";
const NIGHT_IST_DATE = "2026-11-09T00:00:00.000Z";
const LATER = "2026-11-09T19:00:00.000Z";

function assertNoRecordingColumns(world) {
  for (const name of TABLES) {
    for (const row of world.state[name]) {
      for (const key of Object.keys(row)) {
        assert.equal(/recorded_at$/.test(key), false, `${name}.${key} must be assigned by the database`);
      }
    }
  }
}

function financialSnapshot(world) {
  const { state } = world;
  return {
    customers: state.customers.map(({ id, receivable_balance }) => ({ id, receivable_balance })),
    suppliers: state.suppliers.map(({ id, payable_balance }) => ({ id, payable_balance })),
    invoices: state.sales_invoices.map(({ id, paid_amount, balance_due }) => ({ id, paid_amount, balance_due })),
    allocationReversals: state.allocation_reversals.map(({ allocation_id, amount }) => ({ allocation_id, amount })),
    paymentReversals: state.payment_reversals.map(({ payment_id, amount }) => ({ payment_id, amount })),
    ledgers: [...state.customer_ledgers, ...state.supplier_ledgers]
      .map(({ entry_type, debit, credit, reference_type }) => ({ entry_type, debit, credit, reference_type })),
    refunds: state.payment_refunds.map(({ id, status, amount }) => ({ id, status, amount })),
  };
}

test("customer payment reversal: one ledger row, shared instant, original dates untouched, replay is a no-op", async () => {
  const world = createWorld([NIGHT, LATER]);
  seedCustomer(world);
  const originals = structuredClone({ p: world.state.payments, a: world.state.payment_allocations });

  const first = await world.service.reversePayment({ ...base, paymentId: "p1", idempotencyKey: "rev-1", reason: "cheque bounced" });
  assert.equal(first.replayed, false);
  assert.equal(world.captured, 1);

  const instant = new Date(NIGHT).getTime();
  const [reversal] = world.state.payment_reversals;
  assert.equal(reversal.amount, 100);
  assert.equal(reversal.effective_date.toISOString(), NIGHT_IST_DATE);
  assert.equal(reversal.occurred_at.getTime(), instant);

  assert.deepEqual(
    world.state.allocation_reversals.map((row) => [row.allocation_id, row.amount]),
    [["a1", 60], ["a2", 20]],
  );
  for (const row of world.state.allocation_reversals) {
    assert.equal(row.effective_date.toISOString(), NIGHT_IST_DATE);
    assert.equal(row.occurred_at.getTime(), instant);
  }

  assert.equal(world.state.customer_ledgers.length, 1);
  const [ledger] = world.state.customer_ledgers;
  assert.equal(ledger.reference_type, "payment_reversal");
  assert.equal(ledger.debit, 100);
  assert.equal(ledger.credit, 0);
  assert.equal(ledger.entry_date.getTime(), instant);
  assert.equal(ledger.effective_date.toISOString(), NIGHT_IST_DATE);
  assert.equal(ledger.effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  assert.equal(ledger.occurred_at.getTime(), instant);
  assert.equal(ledger.created_at.getTime(), instant);
  assert.equal(world.state.customers[0].receivable_balance, 200);
  assert.deepEqual(
    world.state.sales_invoices.map((row) => [row.id, row.paid_amount, row.balance_due]),
    [["inv1", 0, 60], ["inv2", 0, 20]],
  );

  // The original payment and allocation dates are untouched.
  assert.deepEqual(world.state.payments, originals.p);
  assert.deepEqual(
    world.state.payment_allocations.map(({ reversal: _ignored, ...row }) => row),
    originals.a,
  );
  assertNoRecordingColumns(world);

  const before = financialSnapshot(world);
  const replay = await world.service.reversePayment({ ...base, paymentId: "p1", idempotencyKey: "rev-1", reason: "cheque bounced" });
  assert.deepEqual(replay, { id: first.id, replayed: true });
  assert.equal(world.captured, 1);
  assert.deepEqual(financialSnapshot(world), before);
  assert.equal(world.state.customer_ledgers.length, 1);
});

test("supplier payment reversal: one ledger row from the shared instant, payable restored once", async () => {
  const world = createWorld([NIGHT, LATER]);
  seedSupplier(world);
  const first = await world.service.reversePayment({ ...base, paymentId: "ps1", idempotencyKey: "rev-s1" });
  const instant = new Date(NIGHT).getTime();

  assert.equal(world.captured, 1);
  assert.equal(world.state.supplier_ledgers.length, 1);
  const [ledger] = world.state.supplier_ledgers;
  assert.equal(ledger.reference_type, "payment_reversal");
  assert.equal(ledger.credit, 100);
  assert.equal(ledger.entry_date.getTime(), instant);
  assert.equal(ledger.effective_date.toISOString(), NIGHT_IST_DATE);
  assert.equal(ledger.effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  assert.equal(ledger.occurred_at.getTime(), instant);
  assert.equal(world.state.suppliers[0].payable_balance, 200);
  assert.equal(world.state.payments[0].effective_date.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(world.state.payment_allocations[0].effective_date.toISOString(), "2026-11-02T00:00:00.000Z");

  await world.service.reversePayment({ ...base, paymentId: "ps1", idempotencyKey: "rev-s1" });
  assert.equal(world.state.supplier_ledgers.length, 1);
  assert.equal(world.state.suppliers[0].payable_balance, 200);
  assert.equal(first.replayed, false);
  assertNoRecordingColumns(world);
});

test("allocation reversal restores usable funds exactly once with its own date and preserves the allocation date", async () => {
  const world = createWorld([NIGHT, LATER]);
  seedCustomer(world);
  const original = structuredClone(world.state.payment_allocations[0]);

  const first = await world.service.reverseAllocation({ ...base, allocationId: "a1", idempotencyKey: "arev-1" });
  assert.equal(world.captured, 1);
  const [row] = world.state.allocation_reversals;
  assert.equal(row.amount, 60);
  assert.equal(row.effective_date.toISOString(), NIGHT_IST_DATE);
  assert.equal(row.occurred_at.getTime(), new Date(NIGHT).getTime());
  assert.equal(world.state.customer_ledgers.length, 0);
  assert.equal(world.state.customers[0].receivable_balance, 100);
  assert.equal(world.state.sales_invoices[0].paid_amount, 0);
  assert.equal(world.state.sales_invoices[0].balance_due, 60);

  const { reversal: _ignored, ...afterAllocation } = world.state.payment_allocations[0];
  assert.deepEqual(afterAllocation, original);

  // Replay and a second distinct key must not restore the funds twice.
  const replay = await world.service.reverseAllocation({ ...base, allocationId: "a1", idempotencyKey: "arev-1" });
  assert.deepEqual(replay, { id: first.id, replayed: true });
  await assert.rejects(
    () => world.service.reverseAllocation({ ...base, allocationId: "a1", idempotencyKey: "arev-2" }),
    /already been fully reversed/,
  );
  assert.equal(world.state.allocation_reversals.length, 1);
  assert.equal(world.captured, 1);

  // Usable = payment 100 - active allocations 20 = 80: exactly the 60 restored plus the original 20.
  await assert.rejects(
    () => world.service.allocatePayment({
      ...base, paymentId: "p1", invoiceId: "inv1", invoiceKind: "sales", amount: 81, idempotencyKey: "alloc-over",
    }),
    /Allocation exceeds the invoice's eligible outstanding amount|usable/,
  );
  const allocation = await world.service.allocatePayment({
    ...base, paymentId: "p1", invoiceId: "inv1", invoiceKind: "sales", amount: 60, idempotencyKey: "alloc-new",
  });
  assert.equal(allocation.replayed, false);
  assert.equal(world.captured, 2);
  const created = world.state.payment_allocations.find((entry) => entry.idempotency_key === "alloc-new");
  assert.equal(created.effective_date.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(created.occurred_at.getTime(), new Date(LATER).getTime());
  assert.equal("effective_date_basis" in created, false);
  assertNoRecordingColumns(world);
});

test("refund request records its own date and changes no balances; completion uses the completion instant once", async () => {
  const world = createWorld([NIGHT, LATER, "2026-11-10T19:00:00.000Z"]);
  seedCustomer(world);
  const balances = financialSnapshot(world);

  const request = await world.service.requestRefund({
    ...base, paymentId: "p1", counterpartyKind: "customer", counterpartyId: "c1", amount: 50, idempotencyKey: "rf-req",
  });
  assert.equal(world.captured, 1);
  const refund = world.state.payment_refunds.find((row) => row.id === request.id);
  assert.equal(refund.status, "REQUESTED");
  assert.equal(refund.requested_business_date.toISOString(), NIGHT_IST_DATE);
  assert.equal(refund.requested_occurred_at.getTime(), new Date(NIGHT).getTime());
  assert.equal("completed_effective_date" in refund, false);
  assert.deepEqual(financialSnapshot(world).customers, balances.customers);
  assert.equal(world.state.customer_ledgers.length, 0);
  assert.equal(world.state.allocation_reversals.length, 0);

  // Approval is a lifecycle step outside this task; seed the approved state directly.
  refund.status = "APPROVED";

  const completion = await world.service.completeRefund({ ...base, refundId: refund.id, idempotencyKey: "rf-done" });
  assert.equal(completion.replayed, false);
  assert.equal(world.captured, 2);
  const completedAt = new Date(LATER).getTime();
  assert.equal(refund.status, "COMPLETED");
  assert.equal(refund.completed_at.getTime(), completedAt);
  assert.equal(refund.completed_occurred_at.getTime(), completedAt);
  assert.equal(refund.completed_effective_date.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(refund.completed_effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  // The request date is unchanged by completion.
  assert.equal(refund.requested_business_date.toISOString(), NIGHT_IST_DATE);
  assert.equal(refund.requested_occurred_at.getTime(), new Date(NIGHT).getTime());

  // 50 of allocation a1 (60) is released exactly once, with the completion date.
  assert.deepEqual(world.state.allocation_reversals.map((row) => [row.allocation_id, row.amount]), [["a1", 50]]);
  assert.equal(world.state.allocation_reversals[0].effective_date.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(world.state.allocation_reversals[0].occurred_at.getTime(), completedAt);
  assert.deepEqual(
    world.state.sales_invoices.map((row) => [row.id, row.paid_amount, row.balance_due]),
    [["inv1", 10, 50], ["inv2", 20, 0]],
  );

  assert.equal(world.state.customer_ledgers.length, 1);
  const [ledger] = world.state.customer_ledgers;
  assert.equal(ledger.reference_type, "payment_refund");
  assert.equal(ledger.reference_id, refund.id);
  assert.equal(ledger.debit, 50);
  assert.equal(ledger.entry_date.getTime(), completedAt);
  assert.equal(ledger.effective_date.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(ledger.effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  assert.equal(ledger.occurred_at.getTime(), completedAt);
  assert.equal(ledger.created_at.getTime(), completedAt);
  assert.equal(world.state.customers[0].receivable_balance, 150);
  assert.deepEqual(world.state.payments[0].effective_date, day("2026-11-01"));

  const afterCompletion = financialSnapshot(world);
  const replay = await world.service.completeRefund({ ...base, refundId: refund.id, idempotencyKey: "rf-done" });
  assert.deepEqual(replay, { id: refund.id, replayed: true });
  assert.equal(world.captured, 2);
  assert.deepEqual(financialSnapshot(world), afterCompletion);

  await assert.rejects(
    () => world.service.completeRefund({ ...base, refundId: refund.id, idempotencyKey: "rf-done-2" }),
    /Only an approved refund can be completed/,
  );
  assert.deepEqual(financialSnapshot(world), afterCompletion);
  assertNoRecordingColumns(world);
});

test("supplier refund completion writes one supplier ledger row from the completion instant", async () => {
  const world = createWorld([NIGHT, LATER]);
  seedSupplier(world);
  const request = await world.service.requestRefund({
    ...base, paymentId: "ps1", counterpartyKind: "supplier", counterpartyId: "s1", amount: 40, idempotencyKey: "rf-s-req",
  });
  const refund = world.state.payment_refunds.find((row) => row.id === request.id);
  refund.status = "APPROVED";
  await world.service.completeRefund({ ...base, refundId: refund.id, idempotencyKey: "rf-s-done" });

  assert.equal(world.captured, 2);
  const completedAt = new Date(LATER).getTime();
  assert.equal(world.state.supplier_ledgers.length, 1);
  const [ledger] = world.state.supplier_ledgers;
  assert.equal(ledger.reference_type, "payment_refund");
  assert.equal(ledger.credit, 40);
  assert.equal(ledger.entry_date.getTime(), completedAt);
  assert.equal(ledger.effective_date.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(ledger.effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  assert.equal(ledger.occurred_at.getTime(), completedAt);
  assert.equal(world.state.suppliers[0].payable_balance, 140);
  assert.deepEqual(world.state.allocation_reversals.map((row) => [row.allocation_id, row.amount]), [["b1", 40]]);
  assertNoRecordingColumns(world);
});

test("the instant only changes dates: amounts, balances and consumption are identical for any capture time", async () => {
  const instants = [
    "2026-11-08T17:00:00.000Z", // 22:30 IST, 17:00 UTC: same IST and UTC day
    NIGHT, // 00:30 IST next day, still the earlier UTC day
    "2026-12-31T20:00:00.000Z", // year boundary in IST
    "2028-02-28T19:00:00.000Z", // leap day in IST
  ];
  const outcomes = [];
  for (const instant of instants) {
    const customerWorld = createWorld([instant]);
    seedCustomer(customerWorld);
    await customerWorld.service.reversePayment({ ...base, paymentId: "p1", idempotencyKey: "rev" });
    const supplierWorld = createWorld([instant]);
    seedSupplier(supplierWorld);
    await supplierWorld.service.reversePayment({ ...base, paymentId: "ps1", idempotencyKey: "rev" });
    outcomes.push({
      customer: financialSnapshot(customerWorld),
      supplier: financialSnapshot(supplierWorld),
      dates: [
        customerWorld.state.customer_ledgers[0].effective_date.toISOString().slice(0, 10),
        supplierWorld.state.supplier_ledgers[0].effective_date.toISOString().slice(0, 10),
      ],
    });
  }
  for (const outcome of outcomes.slice(1)) {
    assert.deepEqual(outcome.customer, outcomes[0].customer);
    assert.deepEqual(outcome.supplier, outcomes[0].supplier);
  }
  assert.deepEqual(outcomes.map((outcome) => outcome.dates[0]), ["2026-11-08", "2026-11-09", "2027-01-01", "2028-02-29"]);
  assert.deepEqual(outcomes.map((outcome) => outcome.dates[1]), ["2026-11-08", "2026-11-09", "2027-01-01", "2028-02-29"]);
});

test("a failed operation rolls back without consuming funds or leaving partial rows", async () => {
  const world = createWorld([NIGHT]);
  seedCustomer(world);
  // Remove the customer row so the ledger-side balance update fails after the reversal rows were written.
  world.state.customers.length = 0;
  const before = structuredClone(world.state);
  await assert.rejects(
    () => world.service.reversePayment({ ...base, paymentId: "p1", idempotencyKey: "rev-fail" }),
    /Customer does not belong to this tenant/,
  );
  assert.deepEqual(world.state, before);
  assert.equal(world.state.payment_reversals.length, 0);
  assert.equal(world.state.allocation_reversals.length, 0);
  assert.equal(world.state.customer_ledgers.length, 0);
});
