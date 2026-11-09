import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { createTsLoader } from "./helpers/load-ts.mjs";

const ISO_NOW = "2026-11-09T06:30:00.000Z"; // 2026-11-09 12:00 IST
const marker = (value) => new Date(`${value}T00:00:00.000Z`);
const daysAgo = (days) => new Date(Date.parse("2026-11-09T00:00:00.000Z") - days * 86_400_000);
const padId = (index) => `inv-${String(index).padStart(7, "0")}`;

function matches(row, where = {}) {
  for (const [key, condition] of Object.entries(where)) {
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("gt" in condition) {
        if (key === "id" ? !(row.id > condition.gt) : !(Number(row[key]) > Number(condition.gt))) return false;
      }
      if ("in" in condition && !condition.in.includes(row[key])) return false;
    } else if (row[key] !== condition) return false;
  }
  return true;
}

function setup({
  permissions = ["view_customer_ledger", "view_supplier_ledger", "view_invoice", "view_purchase"],
  configured = true,
  sales = [], purchases = [], customers = [], suppliers = [],
  rowSource = null, transactionError = null,
  aggregate = null,
} = {}) {
  const calls = { transactions: [], queries: [], contexts: 0, logs: [] };
  const ctx = { tenantId: "tenant-a", subjectId: "subject", permissions };
  const tx = {
    sales_invoices: { findMany: async (args) => query("sales_invoices", sales, args), aggregate: async (args) => run("sales_invoices", args) },
    purchase_invoices: { findMany: async (args) => query("purchase_invoices", purchases, args), aggregate: async (args) => run("purchase_invoices", args) },
    customers: { findMany: async (args) => query("customers", customers, args) },
    suppliers: { findMany: async (args) => query("suppliers", suppliers, args) },
  };
  function run(model, args) {
    calls.queries.push({ model, args });
    return aggregate(model, args);
  }
  function query(model, rows, args) {
    calls.queries.push({ model, args });
    if (rowSource && model !== "customers" && model !== "suppliers") return rowSource(model, args);
    return rows.filter((row) => matches(row, args.where))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, args.take ?? Infinity);
  }
  const mocks = {
    "@/lib/db/prisma": {
      assertPostgresConfigured: () => { if (!configured) throw new Error("not configured"); },
      prisma: {
        $transaction: async (callback, options) => {
          calls.transactions.push(options);
          if (transactionError) throw transactionError;
          return callback(tx);
        },
      },
    },
    "@/lib/db/tenant-context": {
      establishTenantContext: async (client) => { assert.equal(client, tx); calls.contexts += 1; },
      requirePermission: (value, permission) => { if (!value.permissions.includes(permission)) throw new Error("forbidden"); },
      requireServerTenantContext: async () => ctx,
    },
    "@prisma/client": {
      PermissionAction: {
        view_customer_ledger: "view_customer_ledger", view_supplier_ledger: "view_supplier_ledger",
        view_invoice: "view_invoice", view_purchase: "view_purchase",
      },
      Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
    },
    "@/lib/db/base-repository": {
      BaseRepository: class { constructor(prisma) { this.prisma = prisma; } withTenant(value) { return { tenantId: value.tenantId }; } },
    },
  };
  const loader = createTsLoader(mocks);
  const originalError = console.error;
  const install = () => { console.error = (...args) => { calls.logs.push(args); }; };
  return {
    calls, ctx, loader,
    restore: () => { console.error = originalError; },
    aging: () => { install(); return loader.load("src/app/_actions/aging-report.actions.ts"); },
    service: () => loader.load("src/domain/services/aging-report.service.ts"),
    monthly: () => { install(); return loader.load("src/app/_actions/monthly-stats.actions.ts"); },
  };
}

const salesRow = (id, customerId, balance, due) => ({
  id, tenant_id: "tenant-a", status: "FINALIZED", customer_id: customerId, balance_due: balance, due_date_business: due,
});
const purchaseRow = (id, supplierId, net, due, allocations = []) => ({
  id, tenant_id: "tenant-a", status: "FINALIZED", supplier_id: supplierId, net_amount: net, due_date_business: due, payment_allocations: allocations,
});
const party = (id, name) => ({ id, tenant_id: "tenant-a", business_name: name, code: id.toUpperCase(), billing_state: "MH", state: "MH", receivable_balance: "1.00", payable_balance: "1.00" });

test("customer aging reads one repeatable-read snapshot with a tenant filter on every query", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(ISO_NOW) });
  const sales = [
    salesRow("s1", "c1", "100.10", daysAgo(0)),
    salesRow("s2", "c1", "200.20", daysAgo(45)),
    salesRow("s3", "c2", "50.00", null),
    { ...salesRow("s4", "c2", "0.00", daysAgo(5)) },
    { ...salesRow("other", "c1", "999.00", daysAgo(5)), tenant_id: "tenant-b" },
    { ...salesRow("draft", "c1", "999.00", daysAgo(5)), status: "DRAFT" },
  ];
  const env = setup({ sales, customers: [party("c1", "Beta"), party("c2", "Alpha")] });
  try {
    const result = await env.aging().loadCustomerAgingReport();
    assert.equal(result.ok, true);
    const { report } = result;
    assert.equal(report.asOf, ISO_NOW);
    assert.equal(report.businessDate, "2026-11-09");
    assert.equal(report.totals.current, "100.10");
    assert.equal(report.totals.d60, "200.20");
    assert.equal(report.totals.unclassified, "50.00");
    assert.equal(report.totals.total, "350.30");
    assert.equal(report.completeness, "QUALIFIED");
    assert.deepEqual(report.rows.map((row) => row.party.name), ["Alpha", "Beta"]);
    assert.equal(env.calls.transactions.length, 1);
    assert.deepEqual(env.calls.transactions[0], { isolationLevel: "RepeatableRead" });
    assert.equal(env.calls.contexts, 1);
    assert.equal(env.calls.queries.length, 2, "one invoice read and one party read, independent of party count");
    for (const { args } of env.calls.queries) assert.equal(args.where.tenant_id, "tenant-a");
    assert.deepEqual(env.calls.queries[0].args.where.balance_due, { gt: 0 });
    assert.equal(env.calls.queries[0].args.where.status, "FINALIZED");
  } finally { env.restore(); }
});

test("the number of queries does not grow with the number of parties", async () => {
  const count = async (partyCount) => {
    const sales = Array.from({ length: partyCount }, (_, index) => salesRow(padId(index), `c${index}`, "10.00", daysAgo(index % 100)));
    const customers = Array.from({ length: partyCount }, (_, index) => party(`c${index}`, `Name ${index}`));
    const env = setup({ sales, customers });
    try {
      const result = await env.aging().loadCustomerAgingReport();
      assert.equal(result.ok, true);
      assert.equal(result.report.rows.length, partyCount);
      return env.calls.queries.length;
    } finally { env.restore(); }
  };
  assert.equal(await count(1), 2);
  assert.equal(await count(60), 2);
});

test("supplier aging uses net amount less allocations net of reversals and omits settled invoices", async () => {
  const purchases = [
    purchaseRow("p1", "s1", "1000.10", daysAgo(31), [{ amount: "400.05", reversal: [{ amount: "100.02" }] }]),
    purchaseRow("p2", "s1", "500.00", daysAgo(10), [{ amount: "500.00", reversal: [] }]),
    purchaseRow("p3", "s2", "75.25", null, []),
    { ...purchaseRow("p4", "s1", "10.00", daysAgo(10)), status: "DRAFT" },
  ];
  const env = setup({ purchases, suppliers: [party("s1", "Supplier One"), party("s2", "Supplier Two")] });
  try {
    const result = await env.aging().loadSupplierAgingReport();
    assert.equal(result.ok, true);
    assert.equal(result.report.totals.d60, "700.07");
    assert.equal(result.report.totals.unclassified, "75.25");
    assert.equal(result.report.openInvoiceCount, 2);
    assert.equal(result.report.rows.find((row) => row.party.id === "s1").total, "700.07");
    assert.equal(env.calls.transactions.length, 1);
    assert.equal(env.calls.queries.length, 2);
    assert.equal("balance_due" in env.calls.queries[0].args.where, false);
    for (const { args } of env.calls.queries) assert.equal(args.where.tenant_id, "tenant-a");
  } finally { env.restore(); }
});

test("an unclassified due date never fails or silently shrinks the report", async () => {
  const sales = [salesRow("s1", "c1", "10.00", null), salesRow("s2", "c1", "20.00", null)];
  const env = setup({ sales, customers: [party("c1", "Only")] });
  try {
    const result = await env.aging().loadCustomerAgingReport();
    assert.equal(result.ok, true);
    assert.equal(result.report.totals.classified_total, "0.00");
    assert.equal(result.report.totals.total, "30.00");
    assert.equal(result.report.unclassifiedCount, 2);
    assert.match(result.report.banner, /INCOMPLETE — 2 invoices ₹30\.00 have no classified due date/);
  } finally { env.restore(); }
});

test("large populations are read in keyset batches within the same snapshot", async () => {
  const total = 12000;
  const sales = Array.from({ length: total }, (_, index) => salesRow(padId(index), `c${index % 7}`, "1.00", daysAgo(index % 120)));
  const customers = Array.from({ length: 7 }, (_, index) => party(`c${index}`, `Customer ${index}`));
  const env = setup({ sales, customers });
  try {
    const result = await env.aging().loadCustomerAgingReport();
    assert.equal(result.ok, true);
    assert.equal(result.report.totals.total, "12000.00");
    assert.equal(result.report.openInvoiceCount, total);
    assert.equal(env.calls.transactions.length, 1);
    assert.equal(env.calls.queries.length, 4, "three invoice batches plus one party read");
  } finally { env.restore(); }
});

test("an open-invoice population above the cap fails closed with a clear reason", async () => {
  const rowSource = (_model, args) => {
    const start = args.where.id ? Number(args.where.id.gt.slice(4)) + 1 : 0;
    return Array.from({ length: Math.min(args.take, 26000 - start) }, (_, offset) =>
      salesRow(padId(start + offset), "c1", "1.00", daysAgo(1)));
  };
  const env = setup({ rowSource, customers: [party("c1", "C")] });
  try {
    const result = await env.aging().loadCustomerAgingReport();
    assert.equal(result.ok, false);
    assert.match(result.reason, /more open invoices than the safe report limit/);
    assert.equal(env.calls.logs.length, 1);
    assert.equal(env.calls.queries.some(({ model }) => model === "customers"), false);
    assert.deepEqual(await env.aging().exportCustomerDuesCsvAction(), { ok: false, reason: result.reason });
  } finally { env.restore(); }
});

test("a finalized-invoice scan above the hard cap fails closed", async () => {
  const rowSource = (_model, args) => {
    const start = args.where.id ? Number(args.where.id.gt.slice(4)) + 1 : 0;
    return Array.from({ length: Math.min(args.take, 400000 - start) }, (_, offset) =>
      purchaseRow(padId(start + offset), "s1", "5.00", daysAgo(1), [{ amount: "5.00", reversal: [] }]));
  };
  const env = setup({ rowSource, suppliers: [party("s1", "S")] });
  try {
    const result = await env.aging().loadSupplierAgingReport();
    assert.equal(result.ok, false);
    assert.match(result.reason, /too many finalized invoices/);
  } finally { env.restore(); }
});

test("permission and configuration failures reject, and database errors are logged and fail closed", async () => {
  const unconfigured = setup({ configured: false });
  const denied = setup({ permissions: [] });
  const failing = setup({ transactionError: new Error("connection reset") });
  const missing = setup({ sales: [salesRow("s1", "ghost", "1.00", daysAgo(1))], customers: [] });
  try {
    await assert.rejects(unconfigured.aging().loadCustomerAgingReport(), /not configured/);
    await assert.rejects(denied.aging().loadCustomerAgingReport(), /forbidden/);
    await assert.rejects(denied.aging().loadSupplierAgingReport(), /forbidden/);
    await assert.rejects(denied.aging().exportSupplierPayablesCsvAction(), /forbidden/);
    const result = await failing.aging().loadSupplierAgingReport();
    assert.equal(result.ok, false);
    assert.match(result.reason, /could not be read consistently/);
    assert.equal(failing.calls.logs[0][1].message, "connection reset");
    const orphan = await missing.aging().loadCustomerAgingReport();
    assert.equal(orphan.ok, false);
    assert.match(missing.calls.logs[0][1].message, /counterparty is missing/);
  } finally {
    for (const env of [unconfigured, denied, failing, missing]) env.restore();
  }
});

test("CSV export is the same data as the report, with banner rows when qualified", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(ISO_NOW) });
  const sales = [salesRow("s1", "c1", "10.00", daysAgo(3)), salesRow("s2", "c1", "4.40", null)];
  const env = setup({ sales, customers: [party("c1", "Customer, One")] });
  try {
    const exported = await env.aging().exportCustomerDuesCsvAction();
    assert.equal(exported.ok, true);
    assert.equal(exported.filename, "customer-dues-2026-11-09.csv");
    const { report } = await env.aging().loadCustomerAgingReport();
    assert.equal(exported.csv, env.service().agingReportCsv(report));
    assert.ok(exported.csv.includes(report.banner));
    assert.ok(exported.csv.includes('"Customer, One"'));
    assert.ok(exported.csv.includes("TOTAL"));
    const complete = setup({ sales: [salesRow("s1", "c1", "10.00", daysAgo(3))], customers: [party("c1", "One")] });
    try {
      const clean = await complete.aging().exportCustomerDuesCsvAction();
      assert.match(clean.csv, /Completeness,COMPLETE/);
      assert.doesNotMatch(clean.csv, /INCOMPLETE/);
    } finally { complete.restore(); }
  } finally { env.restore(); }
});

test("monthly sales and purchase stats read effective_date inside the IST month and count unclassified separately", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-30T18:30:00.000Z") });
  const aggregate = (model, args) => {
    if (args.where.effective_date === null) return { _sum: { net_amount: "250.75" }, _count: { id: 2 } };
    return { _sum: { gross_amount: "900.00", total_discount: "10.00", total_tax: "100.00", net_amount: model === "sales_invoices" ? "990.00" : "980.00" }, _count: { id: 4 } };
  };
  const env = setup({ aggregate });
  try {
    const sales = await env.monthly().loadMonthlySalesStats();
    const purchase = await env.monthly().loadMonthlyPurchaseStats();
    assert.equal(sales.ok, true);
    assert.equal(sales.stats.month, "2026-12", "2026-11-30T18:30:00Z is already December in IST");
    assert.equal(sales.stats.netAmount, "990.00");
    assert.equal(purchase.stats.netAmount, "980.00");
    assert.equal(sales.stats.exclusionNote, "2 invoices ₹250.75 excluded — date not classified");
    assert.equal(sales.stats.completeness, "QUALIFIED");
    assert.equal(env.calls.transactions.length, 2);
    const [included, unclassified, purchaseIncluded] = env.calls.queries;
    assert.equal(included.model, "sales_invoices");
    assert.deepEqual(included.args.where, {
      tenant_id: "tenant-a", status: "FINALIZED",
      effective_date: { gte: marker("2026-12-01"), lt: marker("2027-01-01") },
    });
    assert.deepEqual(unclassified.args.where, { tenant_id: "tenant-a", status: "FINALIZED", effective_date: null });
    assert.equal(purchaseIncluded.model, "purchase_invoices");
    assert.equal(purchaseIncluded.args.where.status, "FINALIZED");
  } finally { env.restore(); }
});

test("monthly stats require the matching view permission and fail closed on database errors", async () => {
  const denied = setup({ permissions: ["view_invoice"] });
  const failing = setup({ transactionError: new Error("stats down") });
  try {
    await assert.rejects(denied.monthly().loadMonthlyPurchaseStats(), /forbidden/);
    const result = await failing.monthly().loadMonthlySalesStats();
    assert.equal(result.ok, false);
    assert.equal(failing.calls.logs[0][1].message, "stats down");
  } finally { denied.restore(); failing.restore(); }
});
