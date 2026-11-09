import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/app/_actions/exports.actions.ts", import.meta.url), "utf8");
const decimalSource = await readFile(new URL("../src/lib/decimal.ts", import.meta.url), "utf8");
const datesSource = await readFile(new URL("../src/lib/utils/business-date.ts", import.meta.url), "utf8");
const completenessSource = await readFile(new URL("../src/domain/services/financial-report-completeness.ts", import.meta.url), "utf8");
const daybookSource = await readFile(new URL("../src/app/reports/daybook/page.tsx", import.meta.url), "utf8");
const statementSource = await readFile(new URL("../src/app/customers/[customerId]/statement/print/page.tsx", import.meta.url), "utf8");
const salesRegisterSource = await readFile(new URL("../src/app/reports/sales-register/page.tsx", import.meta.url), "utf8");
const purchaseRegisterSource = await readFile(new URL("../src/app/reports/purchase-register/page.tsx", import.meta.url), "utf8");

function compile(sourceText, require = () => ({})) {
  const module = { exports: {} };
  const js = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require, Date, Intl, Set, Map, Response, URL });
  return module.exports;
}

const decimal = compile(decimalSource);
const dates = compile(datesSource);
const completeness = compile(completenessSource, (name) => {
  if (name === "@/lib/utils/business-date") return dates;
  if (name === "@/lib/decimal") return decimal;
  throw new Error(`Unexpected import: ${name}`);
});
const day = (value) => new Date(`${value}T00:00:00.000Z`);
function ledger(id, date, overrides = {}) {
  return {
    id, tenant_id: "tenant-a", customer_id: "customer-a", entry_type: "INVOICE",
    effective_date: day(date), effective_date_basis: "EXPLICIT",
    occurred_at: null, debit: "1.00", credit: "0.00", reference_type: null,
    reference_id: null, invoice_id: null, narration: null, ...overrides,
  };
}
function harness(customerRows = [], supplierRows = [], permissions = ["view_reports", "view_customer_ledger"], agingRows = [], invoices = {}) {
  const calls = [];
  const customers = [{ id: "customer-a", tenant_id: "tenant-a", business_name: "Acme" },
    { id: "customer-b", tenant_id: "tenant-b", business_name: "Foreign" }];
  const suppliers = [{ id: "supplier-a", tenant_id: "tenant-a", business_name: "Supplier" }];
  const tx = {
    customer_ledgers: { findMany: async (args) => {
      calls.push(["customer_ledgers", args]);
      return customerRows.filter((r) => r.tenant_id === args.where.tenant_id &&
        (!args.where.customer_id || r.customer_id === args.where.customer_id)).slice(0, args.take);
    } },
    supplier_ledgers: { findMany: async (args) => {
      calls.push(["supplier_ledgers", args]);
      return supplierRows.filter((r) => r.tenant_id === args.where.tenant_id).slice(0, args.take);
    } },
    customers: {
      findFirst: async ({ where }) => customers.find((r) => r.id === where.id && r.tenant_id === where.tenant_id) ?? null,
      findMany: async ({ where }) => customers.filter((r) => r.tenant_id === where.tenant_id && where.id.in.includes(r.id)),
    },
    sales_invoices: { findMany: async ({ where, select, take }) => {
      assert.equal(where.tenant_id, "tenant-a");
      if (where.id) return (invoices.sales ?? []).filter((row) => row.tenant_id === where.tenant_id && where.id.in.includes(row.id));
      if (!select) return (invoices.sales ?? []).filter((row) => row.tenant_id === where.tenant_id).slice(0, take);
      return agingRows;
    } },
    purchase_invoices: { findMany: async ({ where, take }) => {
      assert.equal(where.tenant_id, "tenant-a");
      return (invoices.purchases ?? []).filter((row) => row.tenant_id === where.tenant_id && (!where.id || where.id.in.includes(row.id))).slice(0, take);
    } },
    suppliers: { findMany: async ({ where }) => suppliers.filter((r) => r.tenant_id === where.tenant_id && where.id.in.includes(r.id)) },
  };
  const ctx = { tenantId: "tenant-a", permissions };
  let contextEstablished = false;
  const prisma = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, "RepeatableRead");
    const result = await fn(tx);
    assert.equal(contextEstablished, true);
    return result;
  } };
  const action = compile(source, (name) => {
    if (name === "@/lib/db/prisma") return { prisma, assertPostgresConfigured() {} };
    if (name === "@/repositories") return { repos: {} };
    if (name === "@/lib/db/tenant-context") return {
      requireServerTenantContext: async () => ctx,
      establishTenantContext: async (given, active) => { assert.equal(given, tx); assert.equal(active, ctx); contextEstablished = true; },
      requirePermission: (active, permission) => { if (!active.permissions.includes(permission)) throw new Error("forbidden"); },
    };
    if (name === "@prisma/client") return {
      Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
      PermissionAction: { view_reports: "view_reports", view_customer_ledger: "view_customer_ledger",
        view_invoice: "view_invoice", view_purchase: "view_purchase" },
    };
    if (name === "@/lib/decimal") return decimal;
    if (name === "@/lib/utils/business-date") return dates;
    if (name === "@/domain/services/financial-report-completeness") return completeness;
    throw new Error(`Unexpected import: ${name}`);
  });
  return { action, calls };
}
const range = { from: "2026-11-09", to: "2026-11-10" };

test("page report and serializable CSV use the same effective dates, filters, exact balances and deterministic order", async () => {
  const { action } = harness([
    ledger("a", "2026-11-08", { debit: "90071992547409.99" }),
    ledger("b", "2026-11-09", { entry_type: "PAYMENT_RECEIVED", debit: "0.00", credit: "0.01", narration: "needle" }),
    ledger("c", "2026-11-09", { debit: "0.02", narration: "hidden" }),
    ledger("d", "2026-11-10", { debit: "0.03", narration: "needle" }),
  ]);
  const input = { ...range, q: "needle", voucher: "all" };
  const report = await action.loadFinancialLedgerReport({ ...input, kind: "daybook" });
  assert.equal(report.opening, "90071992547409.99");
  assert.deepEqual(Array.from(report.rows, (r) => r.id), ["c_b", "c_d"]);
  assert.equal(report.rows[0].balance, "90071992547409.98");
  assert.equal(report.rows[1].balance, "90071992547410.03");
  assert.equal(report.debit, "0.03");
  assert.equal(report.credit, "0.01");
  const csv = await action.exportDaybookCsvAction(input);
  assert.equal(csv.filename, "daybook-2026-11-09-2026-11-10.csv");
  assert.doesNotThrow(() => JSON.stringify(csv));
  assert.match(csv.csv, /90071992547410\.03/);
  assert.match(csv.csv, /include filtered-out entries/);
  assert.doesNotMatch(csv.csv, /hidden/);
});

for (const [label, changes] of [
  ["null effective date", { effective_date: null }],
  ["null basis", { effective_date_basis: null }],
  ["ambiguous basis", { effective_date_basis: "AMBIGUOUS" }],
  ["unclassified basis", { effective_date_basis: "UNCLASSIFIED" }],
  ["evidence classification without persisted provenance", { effective_date_basis: "EVIDENCE_CLASSIFIED" }],
  ["unknown basis", { effective_date_basis: "UNEXPECTED" }],
  ["missing derived instant", { effective_date_basis: "DERIVED_FROM_OCCURRED_AT" }],
  ["inconsistent derived instant", { effective_date_basis: "DERIVED_FROM_OCCURRED_AT", occurred_at: new Date("2026-11-10T00:00:00Z") }],
  ["non-date marker", { effective_date: new Date("2026-11-09T12:00:00Z") }],
  ["year-zero effective date", { effective_date: day("0000-01-01") }],
]) {
  test(`fails closed for ${label}, even outside the requested period`, async () => {
    const { action } = harness([ledger("future", "2026-11-30", changes)]);
    await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "daybook" }), /Report unavailable: 1 of 1 ledger entries have unknown or untrusted effective dates/);
    const exported = await action.exportDaybookCsvAction(range);
    assert.equal(exported.ok, false);
    assert.match(exported.reason, /Report unavailable: 1 of 1 ledger entries/);
  });
}

test("trusted derived IST day and explicit date work; refunds are not mislabeled as payments", async () => {
  const { action } = harness([
    ledger("a", "2026-11-10", { effective_date_basis: "DERIVED_FROM_OCCURRED_AT", occurred_at: new Date("2026-11-09T20:30:00Z"), entry_type: "PAYMENT_RECEIVED", reference_type: "payment_refund" }),
    ledger("b", "2026-11-10", { effective_date_basis: "EXPLICIT" }),
  ]);
  const report = await action.loadFinancialLedgerReport({ ...range, kind: "daybook" });
  assert.equal(report.rows[0].voucher_type, "Payment refund");
  assert.equal(report.rows.length, 2);
  const payments = await action.loadFinancialLedgerReport({ ...range, kind: "daybook", voucher: "payment" });
  assert.equal(payments.rows.length, 0);
});

test("tenant and counterparty bounds exclude foreign rows and unknown dates", async () => {
  const { action, calls } = harness([
    ledger("a", "2026-11-09"),
    ledger("foreign", "2026-11-09", { tenant_id: "tenant-b", customer_id: "customer-b", effective_date: null }),
    ledger("other", "2026-11-09", { customer_id: "other", effective_date: null }),
  ]);
  const report = await action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-a" });
  assert.equal(report.rows.length, 1);
  assert.equal(calls[0][1].where.tenant_id, "tenant-a");
  assert.equal(calls[0][1].where.customer_id, "customer-a");
  assert.equal(calls.some(([name]) => name === "supplier_ledgers"), false);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-b" }), /not found/);
});

test("row cap fails rather than omitting entries on both report types", async () => {
  const rows = Array.from({ length: 25001 }, (_, i) => ledger(String(i), "2026-11-09"));
  const { action } = harness(rows);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "daybook" }), /safe report limit/);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-a" }), /safe report limit/);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "daybook", mode: "qualified" }), /safe report limit/);
});

test("unknown supplier dates block daybook but not an unrelated customer statement", async () => {
  const supplier = ledger("s", "2026-11-09", {
    customer_id: undefined, supplier_id: "supplier-a", effective_date: null,
    entry_type: "PURCHASE",
  });
  const { action } = harness([ledger("c", "2026-11-09")], [supplier]);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "daybook" }), /1 of 2 ledger entries have unknown or untrusted effective dates/); action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-a" });
  assert.equal(statement.rows.length, 1);
});

test("missing aging due date is displayed as unavailable rather than a zero bucket", async () => {
  const { action } = harness([ledger("a", "2026-11-09")], [], undefined, [{ due_date: day("2026-11-09"), due_date_business: null, balance_due: "15.00" }]);
  const report = await action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-a" });
  assert.equal(report.aging, null);
});

test("statement aging reads canonical due date rather than conflicting legacy date", async () => {
  const now = dates.businessDateToday();
  const { action } = harness([ledger("a", "2026-11-09")], [], undefined, [{
    due_date: day("2001-01-01"), due_date_business: day(now), balance_due: "15.00",
  }]);
  const report = await action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-a" });
  assert.equal(report.aging.current, "15.00");
  assert.equal(report.aging.over90, "0.00");
});

test("permissions and invalid ranges fail closed", async () => {
  const { action } = harness([], [], []);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "daybook" }), /forbidden/);
  await assert.rejects(action.loadFinancialLedgerReport({ ...range, kind: "customer", customerId: "customer-a" }), /forbidden/);
  const permitted = harness().action;
  await assert.rejects(permitted.loadFinancialLedgerReport({ kind: "daybook", from: "2026-02-30", to: "2026-03-01" }), /Business date must be a valid date/);
  await assert.rejects(permitted.loadFinancialLedgerReport({ kind: "daybook", from: "0000-01-01", to: "2026-03-01" }), /Business date must be a valid date/);
  await assert.rejects(permitted.loadFinancialLedgerReport({ kind: "daybook", from: "2026-01-01", to: "0000-01-01" }), /Business date must be a valid date/);
  await assert.rejects(permitted.loadFinancialLedgerReport({ kind: "daybook", from: "2026-11-11", to: "2026-11-09" }), /Invalid report date range/);
});

test("invoice numbers use tenant- and party-scoped lookups for display, search and CSV", async () => {
  const { action } = harness([
    ledger("a", "2026-11-09", { invoice_id: "sale-a", reference_id: "internal-a" }),
    ledger("b", "2026-11-09", { invoice_id: "foreign-sale", reference_id: "fallback-b" }),
    ledger("c", "2026-11-09", { invoice_id: "other-party", reference_id: "fallback-c" }),
  ], [
    ledger("d", "2026-11-09", { supplier_id: "supplier-a", purchase_id: "purchase-a", entry_type: "PURCHASE" }),
  ], undefined, [], {
    sales: [
      { id: "sale-a", tenant_id: "tenant-a", customer_id: "customer-a", invoice_no: "SI-001" },
      { id: "foreign-sale", tenant_id: "tenant-b", customer_id: "customer-a", invoice_no: "FOREIGN" },
      { id: "other-party", tenant_id: "tenant-a", customer_id: "customer-b", invoice_no: "OTHER" },
    ],
    purchases: [{ id: "purchase-a", tenant_id: "tenant-a", supplier_id: "supplier-a", invoice_no: "PI-002" }],
  });
  const report = await action.loadFinancialLedgerReport({ ...range, kind: "daybook" });
  assert.deepEqual(Array.from(report.rows, (r) => r.invoice_ref), ["SI-001", "fallback-b", "fallback-c", "PI-002"]);
  const filtered = await action.loadFinancialLedgerReport({ ...range, kind: "daybook", q: "SI-001" });
  assert.equal(filtered.rows.length, 1);
  const csv = await action.exportDaybookCsvAction({ ...range, q: "PI-002" });
  assert.match(csv.csv, /PI-002/);
  assert.doesNotMatch(csv.csv, /FOREIGN|OTHER/);
});

for (const kind of ["sales", "purchase"]) {
  const permission = kind === "sales" ? "view_invoice" : "view_purchase";
  const actionName = kind === "sales" ? "exportSalesRegisterCsvAction" : "exportPurchaseRegisterCsvAction";
  const partyId = kind === "sales" ? "customer-a" : "supplier-a";
  const partyField = kind === "sales" ? "customer_id" : "supplier_id";
  const invoice = (id, effectiveDate, overrides = {}) => ({
    id, tenant_id: "tenant-a", invoice_no: id, [partyField]: partyId,
    effective_date: effectiveDate, invoice_date: day("2001-01-01"), status: "FINALIZED",
    gross_amount: "10.00", total_discount: "0.00", total_tax: "1.00",
    round_off: "0.00", net_amount: "11.00", paid_amount: "0.00",
    balance_due: "11.00", ...overrides,
  });
  const build = (rows, permissions = [permission]) =>
    harness([], [], permissions, [], kind === "sales" ? { sales: rows } : { purchases: rows }).action;

  test(`${kind} register and CSV apply identical canonical date, party and search filters`, async () => {
    const action = build([
      invoice("MATCH", day("2026-11-09")),
      invoice("OUTSIDE", day("2026-11-08")),
      invoice("FOREIGN", day("2026-11-09"), { tenant_id: "tenant-b", effective_date: null }),
    ]);
    const input = { q: "MATCH", partyId, startDate: "2026-11-09", endDate: "2026-11-09" };
    const report = await action.loadFinancialRegisterReport(kind, input);
    assert.deepEqual(Array.from(report.rows, (row) => row.invoice_no), ["MATCH"]);
    assert.equal(report.rows[0].effective_date, "2026-11-09");
    const csv = await action[actionName](input);
    assert.match(csv.csv, /MATCH/);
    assert.doesNotMatch(csv.csv, /OUTSIDE|FOREIGN|2001/);
  });

  test(`${kind} register fails closed on unknown date before filtering and on row overflow`, async () => {
    const unknown = build([invoice("UNKNOWN", null)]);
    await assert.rejects(unknown.loadFinancialRegisterReport(kind, { q: "not-found" }), /effective dates are unknown/);
    await assert.rejects(unknown[actionName]({ startDate: "2026-11-09" }), /effective dates are unknown/);
    const overflow = build(Array.from({ length: 25001 }, (_, i) => invoice(String(i), day("2026-11-09"))));
    await assert.rejects(overflow.loadFinancialRegisterReport(kind, {}), /safe row limit/);
    await assert.rejects(overflow[actionName](), /safe row limit/);
  });

  test(`${kind} register enforces permissions and validates dates`, async () => {
    await assert.rejects(build([], []).loadFinancialRegisterReport(kind, {}), /forbidden/);
    await assert.rejects(build([], [])[actionName](), /forbidden/);
    await assert.rejects(build([]).loadFinancialRegisterReport(kind, { startDate: "0000-01-01" }), /Business date/);
    await assert.rejects(build([]).loadFinancialRegisterReport(kind, { startDate: "2026-11-10", endDate: "2026-11-09" }), /Invalid register date range/);
  });
}

test("page and statement use the shared fail-closed report and do not call the old capped ledger path", () => {
  assert.match(daybookSource, /loadFinancialLedgerReport/);
  assert.match(daybookSource, /exportDaybookCsvAction\.bind\(null, reportInput\)/);
  assert.match(daybookSource, /Daybook unavailable/);
  assert.match(statementSource, /loadFinancialLedgerReport/);
  assert.match(statementSource, /Statement unavailable/);
  assert.doesNotMatch(statementSource, /listForCustomer/);
  for (const [kind, page, action] of [
    ["sales", salesRegisterSource, "exportSalesRegisterCsvAction"],
    ["purchase", purchaseRegisterSource, "exportPurchaseRegisterCsvAction"],
  ]) {
    assert.ok(page.includes(`loadFinancialRegisterReport("${kind}", reportInput)`));
    assert.ok(page.includes(`${action}.bind(null, reportInput)`));
    assert.match(page, /formatBusinessDate\(p\.effective_date\)/);
    assert.doesNotMatch(page, /p\.invoice_date/);
  }
});
