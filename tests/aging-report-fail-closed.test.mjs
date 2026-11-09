import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createTsLoader } from "./helpers/load-ts.mjs";

const pages = {
  customer: "src/app/reports/customer-dues/page.tsx",
  supplier: "src/app/reports/supplier-payables/page.tsx",
  summary: "src/app/reports/page.tsx",
  dashboard: "src/app/dashboard/page.tsx",
  customers: "src/app/customers/page.tsx",
};
const NOW = new Date("2026-11-09T06:30:00.000Z");
const marker = (value) => new Date(`${value}T00:00:00.000Z`);
const daysAgo = (days) => new Date(Date.parse("2026-11-09T00:00:00.000Z") - days * 86_400_000);
const info = (id, name, extra = {}) => ({ id, name, code: id.toUpperCase(), contact: null, phone: null, city: "Pune", state: "Maharashtra", cachedBalance: "5.00", ...extra });

const realOnly = (specifier) =>
  specifier === "react/jsx-runtime" || specifier.startsWith("@/domain/services/") || specifier === "./aging-report.service" ||
  specifier === "@/lib/decimal" || specifier === "@/lib/utils/business-date";

function harness({
  configured = true,
  customerRows = [{ id: "i1", partyId: "c1", balance: "100.00", dueDateBusiness: daysAgo(40) }],
  supplierRows = [{ id: "i2", partyId: "s1", balance: "250.00", dueDateBusiness: daysAgo(0) }],
  customerParties = [info("c1", "Alpha Pharma")],
  supplierParties = [info("s1", "Supply Co")],
  customerFailure = null, supplierFailure = null, // { reason } => ok:false, Error => rejects
  salesStats = undefined, purchaseStats = undefined, stockError = null, invoiceError = null, auditError = null,
  customersList = [{ id: "c1", business_name: "Alpha Pharma", receivable_balance: "100.00", is_active: true }],
} = {}) {
  const logs = [];
  const calls = { customerAging: 0, supplierAging: 0 };
  const loader = createTsLoader({}, { realOnly });
  const service = loader.load("src/domain/services/aging-report.service.ts");
  const monthly = loader.load("src/domain/services/monthly-stats.service.ts");
  const outcome = (failure, build) => {
    if (failure instanceof Error) throw failure;
    return failure ? { ok: false, reason: failure.reason } : { ok: true, report: build() };
  };
  const statsOutcome = (kind, override) => {
    if (override instanceof Error) throw override;
    if (override === null) return { ok: false, reason: "Monthly totals could not be read from the database." };
    return { ok: true, stats: override ?? monthly.summarizeMonthlyStats(kind, "2026-11",
      { _sum: { gross_amount: "1000.00", total_discount: "0.00", total_tax: "120.00", net_amount: "1234.50" }, _count: { id: 3 } },
      { _sum: { net_amount: "0.00" }, _count: { id: 0 } }) };
  };
  const mocks = {
    "@/lib/db/prisma": { isPostgresConfigured: () => configured },
    "@/lib/db/tenant-context": { requireServerTenantContext: async () => ({ tenantId: "tenant-a", permissions: [] }) },
    "@/lib/utils": { cn: (...args) => args.filter(Boolean).join(" ") },
    "@/repositories": { repos: {
      productBatches: { stockValuation: async () => {
        if (stockError) throw stockError;
        return { total_value_inr: 789, pending_batches_count: 0, sku_count: 1, batches_count: 2, near_expiry_60d_value: 0 };
      } },
      salesInvoices: { list: async () => { if (invoiceError) throw invoiceError; return { items: [] }; } },
      auditLogs: { list: async () => { if (auditError) throw auditError; return { items: [] }; } },
      customers: { list: async () => ({ items: customersList, total: customersList.length }) },
    } },
    "@/app/_actions/aging-report.actions": {
      loadCustomerAgingReport: async () => { calls.customerAging += 1; return outcome(customerFailure, () => service.buildAgingReport("customer", customerRows, customerParties, NOW)); },
      loadSupplierAgingReport: async () => { calls.supplierAging += 1; return outcome(supplierFailure, () => service.buildAgingReport("supplier", supplierRows, supplierParties, NOW)); },
      exportCustomerDuesCsvAction: () => {},
      exportSupplierPayablesCsvAction: () => {},
    },
    "@/app/_actions/monthly-stats.actions": {
      loadMonthlySalesStats: async () => statsOutcome("sales", salesStats),
      loadMonthlyPurchaseStats: async () => statsOutcome("purchase", purchaseStats),
    },
  };
  const realLoader = createTsLoader(mocks, { realOnly });
  const originalError = console.error;
  const page = (name) => {
    console.error = (...args) => { logs.push(args); };
    return realLoader.load(pages[name]);
  };
  return { page, logs, calls, service, restore: () => { console.error = originalError; } };
}

function text(value) {
  if (value === null || value === undefined || typeof value === "boolean") return "";
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value !== "object") return String(value);
  return text(value.props?.children);
}

function elements(value) {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object") return [];
  return [value, ...elements(value.props?.children)];
}

const exportButton = (tree) => elements(tree).find((element) => typeof element.props?.action === "function");

for (const [kind, label] of [["customer", "Customer dues"], ["supplier", "Supplier payables"]]) {
  const rows = kind === "customer"
    ? { customerRows: [
      { id: "a", partyId: "c1", balance: "100.00", dueDateBusiness: daysAgo(40) },
      { id: "b", partyId: "c1", balance: "7.25", dueDateBusiness: null },
      { id: "c", partyId: "c2", balance: "30.00", dueDateBusiness: daysAgo(0) },
    ], customerParties: [info("c1", "Alpha Pharma"), info("c2", "Beta Traders", { state: "Gujarat" })] }
    : { supplierRows: [
      { id: "a", partyId: "s1", balance: "100.00", dueDateBusiness: daysAgo(40) },
      { id: "b", partyId: "s1", balance: "7.25", dueDateBusiness: null },
      { id: "c", partyId: "s2", balance: "30.00", dueDateBusiness: daysAgo(0) },
    ], supplierParties: [info("s1", "Alpha Pharma"), info("s2", "Beta Traders", { state: "Gujarat" })] };
  const firstName = "Alpha Pharma";

  test(`${kind} page shows the qualified report with an exact unclassified bucket and banner`, async () => {
    const env = harness(rows);
    try {
      const tree = await env.page(kind).default({ searchParams: {} });
      const output = text(tree);
      assert.match(output, /INCOMPLETE — 1 invoices ₹7\.25 have no classified due date and are not in the aging buckets/);
      assert.match(output, new RegExp(firstName));
      assert.match(output, /Beta Traders/);
      assert.match(output, /Due date unclassified/);
      assert.match(output, /₹ 7\.25/);
      assert.match(output, /Total classified\s+₹ 130\.00/);
      assert.match(output, /Qualified/);
      assert.doesNotMatch(output, /unavailable; no financial results/);
      assert.equal(exportButton(tree).props.disabled, false);
      assert.equal(env.logs.length, 0);
    } finally { env.restore(); }
  });

  test(`${kind} page is Complete without a banner when every due date is classified`, async () => {
    const env = harness();
    try {
      const output = text(await env.page(kind).default({ searchParams: {} }));
      assert.match(output, /Complete/);
      assert.doesNotMatch(output, /INCOMPLETE|Qualified/);
    } finally { env.restore(); }
  });

  test(`${kind} page filters in memory and paginates the same population`, async () => {
    const env = harness(rows);
    try {
      const state = kind === "customer" ? "Gujarat" : "gujarat";
      const filtered = text(await env.page(kind).default({ searchParams: { state } }));
      assert.match(filtered, /Beta Traders/);
      assert.doesNotMatch(filtered, /Alpha Pharma/);
      const minimum = text(await env.page(kind).default({ searchParams: kind === "customer" ? { min_due: "100" } : { min_payable: "100" } }));
      assert.match(minimum, /Alpha Pharma/);
      assert.doesNotMatch(minimum, /Beta Traders/);
    } finally { env.restore(); }
  });

  for (const [scenario, failure, logged] of [
    ["cap or database failure", { reason: "Aging unavailable: more open invoices than the safe report limit." }, false],
    ["access failure", new Error("forbidden"), true],
  ]) {
    test(`${kind} page fails closed on ${scenario} without totals or an enabled export`, async () => {
      const env = harness(kind === "customer" ? { customerFailure: failure } : { supplierFailure: failure });
      try {
        const tree = await env.page(kind).default({ searchParams: {} });
        const output = text(tree);
        assert.match(output, /No totals are shown/);
        assert.match(output, new RegExp(`${label} unavailable; no financial results are shown`));
        assert.doesNotMatch(output, /Showing .* of .* (customers|suppliers)|No dues|Complete|Qualified/);
        assert.equal(exportButton(tree).props.disabled, true);
        assert.equal(env.logs.length > 0, logged);
        if (logged) assert.ok(env.logs.some((entry) => entry.includes(failure)));
      } finally { env.restore(); }
    });
  }
}

test("customer and supplier pages are not configured without a database", async () => {
  for (const kind of ["customer", "supplier", "summary"]) {
    const env = harness({ configured: false });
    try {
      assert.match(text(await env.page(kind).default({ searchParams: {} })), /database is not configured/i);
      assert.equal(env.calls.customerAging + env.calls.supplierAging, 0);
    } finally { env.restore(); }
  }
});

test("reports summary shows qualified aging and monthly totals with explicit exclusions", async () => {
  const env = harness({
    customerRows: [{ id: "a", partyId: "c1", balance: "100.00", dueDateBusiness: daysAgo(3) }, { id: "b", partyId: "c1", balance: "1234.50", dueDateBusiness: null }],
    purchaseStats: env_stats("purchase", { net: "980.00", count: 2, excluded: { count: 4, net: "5000.00" } }),
  });
  try {
    const output = text(await env.page("summary").default());
    assert.match(output, /Sales this month.*₹ 1,234\.50.*3 invoices/);
    assert.match(output, /Purchases this month.*₹ 980\.00.*4 invoices ₹5,000\.00 excluded — date not classified/);
    assert.match(output, /Customer dues.*₹ 100\.00.*₹1,234\.50 \(1 invoices\) due date unclassified/);
    assert.match(output, /Customer dues: INCOMPLETE — 1 invoices ₹1,234\.50 have no classified due date/);
    assert.match(output, /Supplier payables.*₹ 250\.00.*1 open invoices · complete/);
    assert.doesNotMatch(output, /aging are unavailable|Report unavailable/);
    assert.equal(env.logs.length, 0);
  } finally { env.restore(); }
});

function env_stats(kind, { net, count, excluded }) {
  const loader = createTsLoader({}, { realOnly });
  return loader.load("src/domain/services/monthly-stats.service.ts").summarizeMonthlyStats(kind, "2026-11",
    { _sum: { net_amount: net }, _count: { id: count } }, { _sum: { net_amount: excluded.net }, _count: { id: excluded.count } });
}

test("reports summary keeps independent totals when one query fails, never substituting zero", async () => {
  const salesFailure = new Error("sales query failed");
  const env = harness({ salesStats: salesFailure, customerFailure: { reason: "Aging unavailable: x" }, supplierFailure: new Error("payables denied") });
  try {
    const output = text(await env.page("summary").default());
    assert.match(output, /Sales this month.*Unavailable.*Monthly total unavailable/);
    assert.match(output, /Customer dues.*Unavailable.*Aging unavailable/);
    assert.match(output, /Supplier payables.*Unavailable.*Aging unavailable/);
    assert.match(output, /Purchases this month.*₹ 1,234\.50/);
    assert.doesNotMatch(output, /₹ 0\.00/);
    assert.ok(env.logs.some((entry) => entry.includes(salesFailure)));
    assert.match(output, /could not be read and are shown as unavailable/);
  } finally { env.restore(); }
});

test("dashboard cards use the qualified service totals and show the unclassified amount", async () => {
  const env = harness({
    customerRows: [
      { id: "a", partyId: "c1", balance: "100.00", dueDateBusiness: daysAgo(40) },
      { id: "b", partyId: "c2", balance: "50.00", dueDateBusiness: daysAgo(0) },
      { id: "c", partyId: "c2", balance: "9.99", dueDateBusiness: null },
    ],
    customerParties: [info("c1", "One"), info("c2", "Two")],
    supplierRows: [{ id: "s", partyId: "s1", balance: "75.00", dueDateBusiness: null }],
    salesStats: env_stats("sales", { net: "1234.50", count: 3, excluded: { count: 2, net: "88.00" } }),
  });
  try {
    const output = text(await env.page("dashboard").default());
    assert.match(output, /Sales this month.*₹ 1,234\.50.*3 invoices · 2 invoices ₹88\.00 excluded — date not classified/);
    assert.match(output, /Receivables.*₹ 150\.00.*1 overdue · ₹ 100\.00 pending 31\+ days · ₹9\.99 \(1 invoices\) due date unclassified/);
    assert.match(output, /Payables ₹ 0\.00 · ₹75\.00 \(1 invoices\) due date unclassified/);
    assert.doesNotMatch(output, /All accounts current|No classified overdue accounts · ₹/);
    assert.match(output, /789\.00/);
    assert.equal(env.calls.customerAging, 1);
    assert.equal(env.calls.supplierAging, 1);
  } finally { env.restore(); }
});

test("dashboard metrics stay independent and every real error is logged, with no zero substitution", async () => {
  const errors = {
    sales: new Error("sales stats failed"), customer: new Error("receivables failed"), supplier: new Error("payables failed"),
    stock: new Error("stock failed"), invoice: new Error("invoice failed"), audit: new Error("audit failed"),
  };
  const env = harness({
    salesStats: errors.sales, customerFailure: errors.customer, supplierFailure: errors.supplier,
    stockError: errors.stock, invoiceError: errors.invoice, auditError: errors.audit,
  });
  try {
    const output = text(await env.page("dashboard").default());
    assert.match(output, /Sales this month.*Unavailable.*Monthly sales unavailable/);
    assert.match(output, /Receivables.*Unavailable.*Aging unavailable/);
    assert.match(output, /Payables unavailable/);
    assert.match(output, /Stock unavailable/);
    assert.match(output, /Recent invoices unavailable/);
    assert.match(output, /Activity timeline unavailable/);
    assert.doesNotMatch(output, /₹ 0\.00|₹ 0\b|No invoices yet|No activity yet/);
    for (const error of Object.values(errors)) assert.ok(env.logs.some((entry) => entry.includes(error)), error.message);
  } finally { env.restore(); }

  const partial = harness({ customerFailure: { reason: "Aging unavailable: cap" }, stockError: errors.stock });
  try {
    const output = text(await partial.page("dashboard").default());
    assert.match(output, /Receivables.*Unavailable/);
    assert.match(output, /Sales this month.*₹ 1,234\.50/);
    assert.match(output, /Payables ₹ 250\.00/);
    assert.match(output, /Stock unavailable/);
  } finally { partial.restore(); }
});

test("dashboard without a database reports a distinct configuration error", async () => {
  const env = harness({ configured: false });
  try {
    const output = text(await env.page("dashboard").default());
    assert.match(output, /Dashboard data unavailable/);
    assert.doesNotMatch(output, /₹ 0|0 batches/);
  } finally { env.restore(); }
});

test("customers list badge uses one service-based aging read and distinguishes unclassified and unavailable", async () => {
  const customers = [
    { id: "c1", business_name: "Overdue", receivable_balance: "100.00", is_active: true },
    { id: "c2", business_name: "Unclassified only", receivable_balance: "10.00", is_active: true },
    { id: "c3", business_name: "Settled", receivable_balance: "0.00", is_active: true },
  ];
  const env = harness({
    customersList: customers,
    customerRows: [
      { id: "a", partyId: "c1", balance: "100.00", dueDateBusiness: daysAgo(45) },
      { id: "b", partyId: "c2", balance: "10.00", dueDateBusiness: null },
    ],
    customerParties: [info("c1", "Overdue"), info("c2", "Unclassified only")],
  });
  try {
    const tree = await env.page("customers").default({ searchParams: {} });
    const badges = elements(tree).filter((element) => element.props?.variant && typeof element.props.children === "string")
      .map((element) => element.props.children);
    assert.ok(badges.includes("31-60 days"));
    assert.equal(badges.filter((label) => label === "Due date unclassified").length, 1);
    assert.ok(badges.includes("No dues"));
    assert.equal(badges.includes("Current"), false, "an unclassified-only customer is never labelled Current");
    assert.equal(env.calls.customerAging, 1, "no per-customer aging query");
  } finally { env.restore(); }

  const failing = harness({ customersList: customers, customerFailure: { reason: "Aging unavailable: cap" } });
  try {
    const output = text(await failing.page("customers").default({ searchParams: {} }));
    assert.match(output, /Aging unavailable/);
    assert.equal(failing.calls.customerAging, 1);
    assert.ok(failing.logs.length > 0);
  } finally { failing.restore(); }
});

test("consumers are wired to the service-based actions and no legacy throwing aging path remains", async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const [customer, supplier, summary, dashboard, customers, exportsSource, actions, buttonSource] = await Promise.all([
    read(pages.customer), read(pages.supplier), read(pages.summary), read(pages.dashboard), read(pages.customers),
    read("src/app/_actions/exports.actions.ts"), read("src/app/_actions/aging-report.actions.ts"), read("src/components/ui/export-csv-button.tsx"),
  ]);
  for (const source of [customer, supplier, summary, dashboard, customers]) {
    assert.doesNotMatch(source, /getAgingBuckets|agedReceivablesTotals|agedPayablesTotals|getOldestOverdueDays|\.monthlyStats\(/);
    assert.match(source, /aging-report\.actions/);
  }
  assert.match(customer, /exportCustomerDuesCsvAction[\s\S]*from "@\/app\/_actions\/aging-report\.actions"/);
  assert.match(supplier, /exportSupplierPayablesCsvAction[\s\S]*from "@\/app\/_actions\/aging-report\.actions"/);
  for (const source of [summary, dashboard]) assert.match(source, /monthly-stats\.actions/);
  assert.doesNotMatch(exportsSource, /exportCustomerDuesCsvAction|exportSupplierPayablesCsvAction/);
  assert.match(actions, /^"use server";/);
  assert.match(actions, /export async function loadCustomerAgingReport/);
  assert.match(actions, /export async function loadSupplierAgingReport/);
  assert.match(actions, /export async function exportCustomerDuesCsvAction/);
  assert.match(actions, /export async function exportSupplierPayablesCsvAction/);
  assert.match(actions, /RepeatableRead/);
  assert.equal((actions.match(/\$transaction\(/g) ?? []).length, 1);
  assert.match(buttonSource, /resolveCsvExport/);
});
