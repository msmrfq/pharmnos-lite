import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
    throw new Error(`Unexpected import in ${path}: ${name}`);
  }, module, module.exports);
  return module.exports;
}

const decimal = load("../src/lib/decimal.ts");
const businessDate = load("../src/lib/utils/business-date.ts");
const temporal = load("../src/lib/utils/financial-temporal.ts", {
  "@/lib/utils/business-date": businessDate,
});

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const ctx = { tenantId: TENANT, userId: "user-1", subjectId: "user-1" };

// A fake Prisma that enforces tenant filtering and records every call in order.
function createWorld(initial = {}) {
  const log = [];
  const world = {
    log,
    customerRows: [...(initial.customerRows ?? [])],
    supplierRows: [...(initial.supplierRows ?? [])],
    customers: new Set(initial.customers ?? [`${TENANT}:c1`]),
    suppliers: new Set(initial.suppliers ?? [`${TENANT}:s1`]),
    cacheUpdates: [],
    transactions: 0,
    contexts: [],
    nextId: 1,
  };

  const ledgerTable = (key, partyField, kind) => ({
    findMany: async (args) => {
      log.push({ op: `${kind}.findMany`, args });
      return world[key]
        .filter((row) => row.tenant_id === args.where.tenant_id && row[partyField] === args.where[partyField])
        .sort((a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        .map((row) => ({ debit: row.debit, credit: row.credit }));
    },
    create: async (args) => {
      log.push({ op: `${kind}.create`, args });
      const row = {
        id: `${kind}-${world.nextId++}`,
        created_at: `2026-11-09T00:00:${String(world.nextId).padStart(2, "0")}.000Z`,
        ...args.data,
      };
      world[key].push(row);
      return { ...row };
    },
  });

  const tx = {
    $executeRaw: async () => { log.push({ op: "executeRaw" }); },
    $queryRaw: async (query) => {
      const sql = query.strings.join("?");
      log.push({ op: "lock", sql, values: query.values });
      const table = sql.includes('"customers"') ? world.customers : world.suppliers;
      const [tenantId, id] = query.values;
      return table.has(`${tenantId}:${id}`) ? [{ id }] : [];
    },
    customer_ledgers: ledgerTable("customerRows", "customer_id", "customer"),
    supplier_ledgers: ledgerTable("supplierRows", "supplier_id", "supplier"),
    customers: {
      update: async (args) => {
        log.push({ op: "customers.update", args });
        world.cacheUpdates.push({ kind: "customer", ...args });
      },
    },
    suppliers: {
      update: async (args) => {
        log.push({ op: "suppliers.update", args });
        world.cacheUpdates.push({ kind: "supplier", ...args });
      },
    },
  };

  const prisma = {
    $transaction: async (work) => {
      world.transactions += 1;
      log.push({ op: "transaction" });
      return work(tx);
    },
  };

  const { LedgerImpactService } = load("../src/domain/services/ledger-impact.service.ts", {
    "@prisma/client": { Prisma: { sql: (strings, ...values) => ({ strings: [...strings], values }) } },
    "@/lib/db/prisma": { prisma },
    "@/lib/db/tenant-context": {
      establishTenantContext: async (client, context) => {
        assert.equal(client, tx);
        world.contexts.push(context);
        log.push({ op: "context" });
      },
    },
    "@/lib/decimal": decimal,
    "@/lib/utils/business-date": businessDate,
    "@/lib/utils/financial-temporal": temporal,
  });
  world.service = new LedgerImpactService(prisma);
  return world;
}

function legacyRow(overrides) {
  return {
    id: "legacy",
    tenant_id: TENANT,
    customer_id: "c1",
    supplier_id: "s1",
    created_at: "2026-01-01T00:00:00.000Z",
    // Legacy rows mix date markers, instants and even far-future values.
    entry_date: new Date("2999-12-31T00:00:00.000Z"),
    debit: "100.00",
    credit: "0",
    ...overrides,
  };
}

function mixedLegacyRows() {
  return [
    legacyRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z", debit: "100.00", credit: "0",
      entry_date: new Date("2026-11-07T00:00:00.000Z") }),
    legacyRow({ id: "b", created_at: "2026-01-02T00:00:00.000Z", debit: "0", credit: "30.50",
      entry_date: new Date("2026-11-07T18:30:00.000Z") }),
    legacyRow({ id: "c", created_at: "2026-01-03T00:00:00.000Z", debit: "40.25", credit: "0",
      entry_date: new Date("2999-12-31T00:00:00.000Z") }),
    legacyRow({ id: "d", created_at: "2026-01-04T00:00:00.000Z", debit: "0", credit: "5.00",
      entry_date: new Date("1999-01-01T00:00:00.000Z") }),
  ];
}

const date = (value) => businessDate.parseBusinessDate(value);
const customerInput = (extra = {}) => ({
  customer_id: "c1",
  entry_type: "INVOICE",
  debit: 10,
  temporal: { businessDate: date("2026-11-07") },
  ...extra,
});
const supplierInput = (extra = {}) => ({
  supplier_id: "s1",
  entry_type: "PURCHASE",
  credit: 10,
  temporal: { businessDate: date("2026-11-07") },
  ...extra,
});

const TZ_CASES = ["Asia/Kolkata", "UTC", "America/Los_Angeles"];

async function persistedFingerprint() {
  const world = createWorld();
  await world.service.impactCustomer(customerInput({ temporal: { businessDate: date("2026-11-07") } }), ctx);
  await world.service.impactSupplier(supplierInput({ temporal: { businessDate: date("2026-03-01") } }), ctx);
  const instant = temporal.captureSystemInstant(new Date("2026-11-08T19:00:00.000Z"));
  await world.service.impactCustomer(
    customerInput({ entry_type: "PAYMENT_RECEIVED", debit: 0, credit: 5, temporal: { occurredAt: instant } }),
    ctx,
  );
  return world.log
    .filter((entry) => entry.op.endsWith(".create"))
    .map((entry) => ({
      entry_date: entry.args.data.entry_date.toISOString(),
      effective_date: entry.args.data.effective_date.toISOString(),
      basis: entry.args.data.effective_date_basis,
      occurred_at: entry.args.data.occurred_at ? entry.args.data.occurred_at.toISOString() : null,
    }));
}

if (process.env.LEDGER_IMPACT_TZ_CHILD === "1") {
  process.stdout.write(`FINGERPRINT:${JSON.stringify(await persistedFingerprint())}\n`);
  process.exit(0);
}

test("rejects a bare Date, entry_date and malformed or ambiguous temporal inputs before any transaction", async () => {
  const bad = [
    customerInput({ temporal: new Date("2026-11-07T00:00:00.000Z") }),
    customerInput({ temporal: undefined }),
    customerInput({ temporal: null }),
    customerInput({ temporal: "2026-11-07" }),
    customerInput({ temporal: {} }),
    customerInput({ temporal: { businessDate: date("2026-11-07"), occurredAt: new Date() } }),
    customerInput({ temporal: { businessDate: "2026-02-30" } }),
    customerInput({ temporal: { businessDate: new Date("2026-11-07T00:00:00.000Z") } }),
    customerInput({ temporal: { occurredAt: "2026-11-07T00:00:00.000Z" } }),
    customerInput({ temporal: { businessDate: date("2026-11-07"), extra: true } }),
    customerInput({ entry_date: new Date() }),
  ];
  for (const input of bad) {
    const world = createWorld();
    await assert.rejects(() => world.service.impactCustomer(input, ctx), Error);
    const supplierBad = { ...supplierInput(), temporal: input.temporal };
    if (input.entry_date !== undefined) supplierBad.entry_date = input.entry_date;
    await assert.rejects(() => world.service.impactSupplier(supplierBad, ctx), Error);
    assert.equal(world.transactions, 0);
    assert.equal(world.customerRows.length + world.supplierRows.length, 0);
  }
});

test("wrappers reject bare Dates and invoice wrappers reject instants", async () => {
  const world = createWorld();
  const bare = new Date("2026-11-07T00:00:00.000Z");
  await assert.rejects(() => world.service.finalizeCustomerInvoice("c1", "inv", bare, 10, "n", ctx), TypeError);
  await assert.rejects(() => world.service.finalizePurchaseInvoice("s1", "pur", bare, 10, "n", ctx), TypeError);
  await assert.rejects(() => world.service.customerPaymentReceived("c1", null, "pay", bare, 10, "n", ctx), TypeError);
  await assert.rejects(() => world.service.supplierPaymentMade("s1", null, "pay", bare, 10, "n", ctx), TypeError);
  const instant = temporal.captureSystemInstant(new Date("2026-11-08T19:00:00.000Z"));
  await assert.rejects(
    () => world.service.finalizeCustomerInvoice("c1", "inv", { occurredAt: instant }, 10, "n", ctx),
    TypeError,
  );
  await assert.rejects(
    () => world.service.finalizePurchaseInvoice("s1", "pur", { occurredAt: instant }, 10, "n", ctx),
    TypeError,
  );
  assert.equal(world.transactions, 0);
});

test("persists the exact temporal fields for an explicit business date and a captured instant", async () => {
  const world = createWorld();
  const explicit = await world.service.finalizeCustomerInvoice(
    "c1", "inv-1", { businessDate: date("2026-11-07") }, 118, "Invoice 1", ctx,
  );
  const instant = temporal.captureSystemInstant(new Date("2026-11-08T19:00:00.000Z"));
  const derived = await world.service.customerPaymentReceived(
    "c1", "inv-1", "pay-1", { occurredAt: instant }, 18, "Payment", ctx,
  );
  const [first, second] = world.customerRows;

  assert.equal(first.entry_date.toISOString(), "2026-11-07T00:00:00.000Z");
  assert.equal(first.effective_date.toISOString(), "2026-11-07T00:00:00.000Z");
  assert.equal(first.effective_date_basis, "EXPLICIT");
  assert.equal(first.occurred_at, null);
  assert.equal(first.reference_type, "sales_invoice");
  assert.equal(first.invoice_id, "inv-1");
  assert.equal(explicit.effective_date_basis, "EXPLICIT");

  // 2026-11-08T19:00Z is 2026-11-09 00:30 in Asia/Kolkata.
  assert.equal(second.entry_date.getTime(), instant.getTime());
  assert.equal(second.effective_date.toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(second.effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  assert.equal(second.occurred_at.getTime(), instant.getTime());
  assert.equal(derived.occurred_at.getTime(), instant.getTime());

  for (const row of world.customerRows) {
    assert.equal("recorded_at" in row, false);
  }

  const supplierWorld = createWorld();
  await supplierWorld.service.finalizePurchaseInvoice(
    "s1", "pur-1", { businessDate: date("2026-11-07") }, 50, "Purchase 1", ctx,
  );
  await supplierWorld.service.supplierPaymentMade(
    "s1", null, "pay-2", { occurredAt: instant }, 20, "Payment", ctx,
  );
  const [purchase, payment] = supplierWorld.supplierRows;
  assert.equal(purchase.effective_date_basis, "EXPLICIT");
  assert.equal(purchase.occurred_at, null);
  assert.equal(payment.effective_date.toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(payment.effective_date_basis, "DERIVED_FROM_OCCURRED_AT");
  assert.equal(payment.occurred_at.getTime(), instant.getTime());
});

test("date-only values are identical under every host timezone", () => {
  const fingerprints = TZ_CASES.map((zone) => {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      env: { ...process.env, TZ: zone, LEDGER_IMPACT_TZ_CHILD: "1" },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const line = child.stdout.split("\n").find((entry) => entry.startsWith("FINGERPRINT:"));
    assert.ok(line, `no fingerprint for ${zone}`);
    return JSON.parse(line.slice("FINGERPRINT:".length));
  });
  assert.deepEqual(fingerprints[1], fingerprints[0]);
  assert.deepEqual(fingerprints[2], fingerprints[0]);
  assert.deepEqual(fingerprints[0], [
    { entry_date: "2026-11-07T00:00:00.000Z", effective_date: "2026-11-07T00:00:00.000Z", basis: "EXPLICIT", occurred_at: null },
    { entry_date: "2026-03-01T00:00:00.000Z", effective_date: "2026-03-01T00:00:00.000Z", basis: "EXPLICIT", occurred_at: null },
    {
      entry_date: "2026-11-08T19:00:00.000Z",
      effective_date: "2026-11-09T00:00:00.000Z",
      basis: "DERIVED_FROM_OCCURRED_AT",
      occurred_at: "2026-11-08T19:00:00.000Z",
    },
  ]);
});

test("the stored balance ignores entry_date: mixed legacy rows and a backdated date give one result", async () => {
  // 100 - 30.50 + 40.25 - 5.00 = 104.75 regardless of any row's entry_date.
  const dates = ["2026-11-07", "2020-01-01", "2099-12-31"];
  const results = [];
  for (const value of dates) {
    const world = createWorld({ customerRows: mixedLegacyRows(), supplierRows: mixedLegacyRows() });
    const customer = await world.service.impactCustomer(
      customerInput({ debit: 10, temporal: { businessDate: date(value) } }), ctx,
    );
    const supplier = await world.service.impactSupplier(
      supplierInput({ credit: 10, temporal: { businessDate: date(value) } }), ctx,
    );
    results.push([customer.balance, supplier.balance]);
    for (const find of world.log.filter((entry) => entry.op.endsWith(".findMany"))) {
      assert.deepEqual(Object.keys(find.args.where).sort(),
        find.op.startsWith("customer") ? ["customer_id", "tenant_id"] : ["supplier_id", "tenant_id"]);
      assert.deepEqual(find.args.orderBy, [{ created_at: "asc" }, { id: "asc" }]);
      assert.deepEqual(Object.keys(find.args.select).sort(), ["credit", "debit"]);
    }
  }
  // Customer: debit - credit = 104.75 + 10; supplier: credit - debit = (30.50 + 5) - (100 + 40.25) + 10.
  for (const [customer, supplier] of results) {
    assert.equal(customer, 114.75);
    assert.equal(supplier, -94.75);
  }

  const backdated = createWorld({ customerRows: mixedLegacyRows() });
  const today = createWorld({ customerRows: mixedLegacyRows() });
  const instant = temporal.captureSystemInstant(new Date("2026-11-09T05:00:00.000Z"));
  const a = await backdated.service.impactCustomer(customerInput({ temporal: { businessDate: date("2019-04-01") } }), ctx);
  const b = await today.service.impactCustomer(customerInput({ temporal: { occurredAt: instant } }), ctx);
  assert.equal(a.balance, b.balance);
});

test("a later call never alters earlier rows and builds on all of them", async () => {
  const world = createWorld({ customerRows: mixedLegacyRows() });
  const before = structuredClone(world.customerRows);
  const first = await world.service.impactCustomer(customerInput({ debit: 10 }), ctx);
  const snapshot = structuredClone(world.customerRows);
  const second = await world.service.impactCustomer(
    customerInput({ debit: 0, credit: 4, entry_type: "PAYMENT_RECEIVED", temporal: { businessDate: date("2020-01-01") } }),
    ctx,
  );
  assert.deepEqual(snapshot.slice(0, before.length), before);
  assert.deepEqual(world.customerRows.slice(0, snapshot.length), snapshot);
  assert.equal(first.balance, 114.75);
  assert.equal(second.balance, 110.75);
  assert.equal(world.customerRows.length, before.length + 2);
});

test("rounding is preserved and the receivable/payable cache clamps at zero", async () => {
  const world = createWorld();
  const row = await world.service.impactCustomer(customerInput({ debit: 10.005 }), ctx);
  assert.equal(row.debit, 10.01);
  assert.equal(world.customerRows.at(-1).balance, 10.01);
  assert.equal(world.cacheUpdates.at(-1).data.receivable_balance, 10.01);

  const advance = await world.service.impactCustomer(
    customerInput({ entry_type: "PAYMENT_RECEIVED", debit: 0, credit: 50 }), ctx,
  );
  assert.equal(advance.balance, -39.99);
  assert.equal(world.cacheUpdates.at(-1).data.receivable_balance, 0);
  assert.deepEqual(world.cacheUpdates.at(-1).where, { id: "c1", tenant_id: TENANT });

  const supplier = await world.service.impactSupplier(
    supplierInput({ entry_type: "PAYMENT_MADE", credit: 0, debit: 25 }), ctx,
  );
  assert.equal(supplier.balance, -25);
  assert.equal(world.cacheUpdates.at(-1).data.payable_balance, 0);
  await world.service.impactSupplier(supplierInput({ credit: 100 }), ctx);
  assert.equal(world.cacheUpdates.at(-1).data.payable_balance, 75);
  assert.deepEqual(world.cacheUpdates.at(-1).where, { id: "s1", tenant_id: TENANT });
});

test("tenant filter, tenant context and the counterparty row lock precede every read and write", async () => {
  const world = createWorld({ customerRows: [legacyRow({ id: "x", tenant_id: OTHER_TENANT, debit: "999" })] });
  await world.service.impactCustomer(customerInput({ debit: 10 }), ctx);
  await world.service.impactSupplier(supplierInput({ credit: 10 }), ctx);

  const ops = world.log.map((entry) => entry.op);
  assert.deepEqual(ops.slice(0, 5), ["transaction", "context", "lock", "customer.findMany", "customer.create"]);
  const supplierStart = ops.indexOf("transaction", 1);
  assert.deepEqual(ops.slice(supplierStart, supplierStart + 5), [
    "transaction", "context", "lock", "supplier.findMany", "supplier.create",
  ]);
  assert.equal(world.contexts.length, 2);
  assert.ok(world.contexts.every((context) => context === ctx));

  const locks = world.log.filter((entry) => entry.op === "lock");
  assert.match(locks[0].sql, /FROM "customers" WHERE "tenant_id" = \? AND "id" = \? FOR UPDATE/);
  assert.deepEqual(locks[0].values, [TENANT, "c1"]);
  assert.match(locks[1].sql, /FROM "suppliers" WHERE "tenant_id" = \? AND "id" = \? FOR UPDATE/);
  assert.deepEqual(locks[1].values, [TENANT, "s1"]);

  for (const find of world.log.filter((entry) => entry.op.endsWith(".findMany"))) {
    assert.equal(find.args.where.tenant_id, TENANT);
  }
  // The other tenant's 999 debit is never counted.
  assert.equal(world.customerRows.find((row) => row.entry_type === "INVOICE").balance, 10);
  for (const create of world.log.filter((entry) => entry.op.endsWith(".create"))) {
    assert.equal(create.args.data.tenant_id, TENANT);
  }
});

test("a counterparty outside the tenant fails closed without writing", async () => {
  const world = createWorld({ customers: [`${OTHER_TENANT}:c1`], suppliers: [`${OTHER_TENANT}:s1`] });
  await assert.rejects(() => world.service.impactCustomer(customerInput(), ctx), /Customer not found/);
  await assert.rejects(() => world.service.impactSupplier(supplierInput(), ctx), /Supplier not found/);
  assert.equal(world.customerRows.length + world.supplierRows.length, 0);
  assert.equal(world.cacheUpdates.length, 0);
  assert.equal(world.log.some((entry) => entry.op.endsWith(".create") || entry.op.endsWith(".findMany")), false);
  await assert.rejects(
    () => world.service.impactCustomer(customerInput(), { userId: "user-1" }),
    /Tenant required/,
  );
});
