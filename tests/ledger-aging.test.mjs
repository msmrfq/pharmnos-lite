import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const repositorySource = await readFile(
  new URL("../src/repositories/ledger.repository.ts", import.meta.url),
  "utf8",
);
const businessDateSource = await readFile(
  new URL("../src/lib/utils/business-date.ts", import.meta.url),
  "utf8",
);
const salesActionsSource = await readFile(
  new URL("../src/app/_actions/sales.actions.ts", import.meta.url),
  "utf8",
);
const salesFormSource = await readFile(
  new URL("../src/app/billing/new/_form.tsx", import.meta.url),
  "utf8",
);
const purchaseFormSource = await readFile(
  new URL("../src/app/purchases/new/_form.tsx", import.meta.url),
  "utf8",
);
const customerDuesSource = await readFile(
  new URL("../src/app/reports/customer-dues/page.tsx", import.meta.url),
  "utf8",
);
const supplierPayablesSource = await readFile(
  new URL("../src/app/reports/supplier-payables/page.tsx", import.meta.url),
  "utf8",
);
const customersPageSource = await readFile(
  new URL("../src/app/customers/page.tsx", import.meta.url),
  "utf8",
);
const repositoryJs = ts.transpileModule(repositorySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const businessDateJs = ts.transpileModule(businessDateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const businessDate = loadBusinessDate();

function loadBusinessDate(DateImplementation = Date) {
  const testModule = { exports: {} };
  vm.runInNewContext(businessDateJs, {
    Date: DateImplementation,
    Intl,
    exports: testModule.exports,
    module: testModule,
  });
  return testModule.exports;
}

function loadSalesDueDateDerivation() {
  const sourceFile = ts.createSourceFile(
    "sales.actions.ts",
    salesActionsSource,
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "deriveSalesDueDate",
  );
  assert.ok(declaration, "sales action must define its production due-date derivation");
  assert.match(salesActionsSource, /deriveSalesDueDate\(invoiceDate, data\.payment_terms_days\)/);
  assert.match(salesActionsSource, /invoice_date:\s*invoiceDate/);

  const compiled = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return vm.runInNewContext(`${compiled}\nderiveSalesDueDate`);
}

function loadArrowFunction(source, fileName, name) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const declaration = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((item) => item.name.getText(sourceFile) === name);
  assert.ok(
    declaration && ts.isArrowFunction(declaration.initializer),
    `${name} must be a production arrow function`,
  );
  const compiled = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return vm.runInNewContext(`${compiled}\n${name}`);
}

function loadRepositories(now) {
  const fixedNow = now.getTime();
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length === 0 ? [fixedNow] : args));
    }

    static now() {
      return fixedNow;
    }
  }

  const testModule = { exports: {} };
  class BaseRepository {
    constructor(prisma) {
      this.prisma = prisma;
    }

    withTenant(ctx) {
      return { tenantId: ctx.tenantId };
    }
  }

  const businessDateModule = { exports: {} };
  vm.runInNewContext(businessDateJs, {
    Date: FixedDate,
    Intl,
    exports: businessDateModule.exports,
    module: businessDateModule,
  });

  vm.runInNewContext(repositoryJs, {
    Date: FixedDate,
    exports: testModule.exports,
    module: testModule,
    require(specifier) {
      if (specifier === "@/lib/db/base-repository") return { BaseRepository };
      if (specifier === "@prisma/client") return {};
      if (specifier === "@/lib/utils/business-date") return businessDateModule.exports;
      throw new Error(`Unexpected repository dependency: ${specifier}`);
    },
  });
  return testModule.exports;
}

function dateOnlyDaysAgo(today, daysAgo) {
  const date = new Date(`${businessDate.businessDateToday(today)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

function agingRow(today, age, amount) {
  const dueDate = dateOnlyDaysAgo(today, age);
  return {
    due_date: dueDate,
    due_date_business: dueDate,
    balance_due: amount,
    net_amount: amount,
    payment_allocations: [],
  };
}

const context = { tenantId: "tenant-test" };

test("business date helpers distinguish IST date boundaries, date markers, and instants", () => {
  const beforeMidnight = new Date("2026-11-08T18:29:59.999Z");
  const atMidnight = new Date("2026-11-08T18:30:00.000Z");
  assert.equal(businessDate.businessDateToday(beforeMidnight), "2026-11-08");
  assert.equal(businessDate.businessDateToday(atMidnight), "2026-11-09");
  assert.equal(businessDate.businessDateToday(new Date("2026-11-08T18:30:00.001Z")), "2026-11-09");

  assert.equal(
    businessDate.businessDateStart(beforeMidnight).toISOString(),
    "2026-11-08T00:00:00.000Z",
  );
  const dateMarker = businessDate.businessDateStart(atMidnight);
  assert.equal(dateMarker.toISOString(), "2026-11-09T00:00:00.000Z");

  const istMidnightInstant = "2026-11-08T18:30:00.000Z";
  assert.equal(businessDate.formatBusinessDate(dateMarker), "09/11/2026");
  assert.equal(businessDate.formatBusinessDate(istMidnightInstant), "08/11/2026");
  assert.equal(businessDate.formatBusinessInstant(istMidnightInstant), "09/11/2026, 00:00:00");
  assert.equal(businessDate.formatBusinessInstant(dateMarker), "09/11/2026, 05:30:00");
});

test("sales and purchase form date defaults come from the production business date helper", () => {
  for (const [party, source] of [
    ["sales", salesFormSource],
    ["purchase", purchaseFormSource],
  ]) {
    assert.match(source, /import \{ businessDateToday \} from "@\/lib\/utils\/business-date"/);
    assert.match(source, /const today = businessDateToday\(\)/);
    assert.match(source, /name="invoice_date" value=\{today\}/);
    assert.match(source, /defaultValue=\{today\}/);
    assert.ok(
      businessDate.businessDateToday(new Date("2026-11-08T18:30:00.000Z")) === "2026-11-09",
      `${party} form defaults to the IST business date`,
    );
  }
});

test("customer aging assigns each requested boundary to exactly one existing bucket", async () => {
  const today = new Date("2026-03-10T06:30:00.000Z");
  const ages = [-1, 0, 1, 29, 30, 31, 32, 59, 60, 61, 62, 89, 90, 91, 92, 119, 120, 121, 122];
  const { CustomerLedgerRepository } = loadRepositories(today);
  const expectedBucket = (age) =>
    age <= 0 ? "current" : age <= 30 ? "d30" : age <= 60 ? "d60" : age <= 90 ? "d90" : "over90";

  for (const [index, age] of ages.entries()) {
    const amount = index + 1;
    const repository = new CustomerLedgerRepository({
      sales_invoices: { findMany: async () => [agingRow(today, age, amount)] },
    });
    const buckets = await repository.getAgingBuckets(context);
    const expected = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: amount };
    expected[expectedBucket(age)] = amount;

    assert.deepEqual({ ...buckets }, expected, `customer invoice aged ${age} calendar day(s)`);
  }
});

test("supplier aging assigns each requested boundary to exactly one existing bucket", async () => {
  const today = new Date("2026-03-10T06:30:00.000Z");
  const { SupplierLedgerRepository } = loadRepositories(today);
  const ages = [-1, 0, 1, 29, 30, 31, 32, 59, 60, 61, 62, 89, 90, 91, 92, 119, 120, 121, 122];
  const expectedBucket = (age) =>
    age <= 0 ? "current" : age <= 30 ? "d30" : age <= 60 ? "d60" : age <= 90 ? "d90" : "over90";

  for (const [index, age] of ages.entries()) {
    const amount = index + 1;
    const repository = new SupplierLedgerRepository({
      purchase_invoices: { findMany: async () => [agingRow(today, age, amount)] },
    });
    const buckets = await repository.getAgingBuckets(context);
    const expected = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: amount };
    expected[expectedBucket(age)] = amount;

    assert.deepEqual({ ...buckets }, expected, `supplier invoice aged ${age} calendar day(s)`);
  }
});

test("customer and supplier summaries retain the 10-day/100-day reproduction amounts", async () => {
  const today = new Date("2026-03-10T06:30:00.000Z");
  const rows = [agingRow(today, 10, 100), agingRow(today, 100, 200)];
  const { CustomerLedgerRepository, SupplierLedgerRepository } = loadRepositories(today);
  const customerRepository = new CustomerLedgerRepository({
    sales_invoices: { findMany: async () => rows },
  });
  const supplierRepository = new SupplierLedgerRepository({
    purchase_invoices: { findMany: async () => rows },
  });

  for (const [kind, repository, summaryMethod] of [
    ["customer", customerRepository, "agedReceivablesTotals"],
    ["supplier", supplierRepository, "agedPayablesTotals"],
  ]) {
    const buckets = await repository.getAgingBuckets(context);
    assert.equal(buckets.current, 0, `${kind} current`);
    assert.equal(buckets.d30, 100, `${kind} 10-day overdue`);
    assert.equal(buckets.d60, 0, `${kind} 31-60`);
    assert.equal(buckets.d90, 0, `${kind} 61-90`);
    assert.equal(buckets.over90, 200, `${kind} 100-day overdue`);
    assert.equal(buckets.total, 300, `${kind} total`);

    const summary = await repository[summaryMethod](context);
    assert.equal(summary.current_30, 100, `${kind} summary current 0-30`);
    assert.equal(summary.bucket_31_60, 0, `${kind} summary 31-60`);
    assert.equal(summary.bucket_61_90, 0, `${kind} summary 61-90`);
    assert.equal(summary.bucket_over_90, 200, `${kind} summary >90`);
    assert.equal(summary.total, 300, `${kind} summary total`);
  }
});

test("calendar-day aging remains correct across the spring DST transition", async () => {
  const today = new Date("2026-03-10T16:00:00.000Z");
  const rows = [
    { due_date_business: dateOnlyDaysAgo(today, 1), balance_due: 1 },
    { due_date_business: dateOnlyDaysAgo(today, 2), balance_due: 1 },
    { due_date_business: dateOnlyDaysAgo(today, 3), balance_due: 1 },
    { due_date_business: dateOnlyDaysAgo(today, 30), balance_due: 1 },
    { due_date_business: dateOnlyDaysAgo(today, 31), balance_due: 1 },
    { due_date_business: dateOnlyDaysAgo(today, 90), balance_due: 1 },
    { due_date_business: dateOnlyDaysAgo(today, 91), balance_due: 1 },
  ];
  const { CustomerLedgerRepository } = loadRepositories(today);
  const repository = new CustomerLedgerRepository({
    sales_invoices: { findMany: async () => rows },
  });

  const buckets = await repository.getAgingBuckets(context);

  assert.deepEqual({ ...buckets }, { current: 0, d30: 4, d60: 1, d90: 1, over90: 1, total: 7 });
  assert.equal(
    today.getTime() - new Date("2026-03-07T17:00:00.000Z").getTime(),
    71 * 60 * 60 * 1000,
    "three calendar days across the New York DST transition span 71 elapsed hours",
  );
});

test("sales due-date derivation uses the persisted UTC date-only calendar across DST", () => {
  const deriveSalesDueDate = loadSalesDueDateDerivation();
  const cases = [
    { invoiceDate: "2026-03-08", terms: 0, expected: "2026-03-08T00:00:00.000Z" },
    { invoiceDate: "2026-03-08", terms: 1, expected: "2026-03-09T00:00:00.000Z" },
    { invoiceDate: "2026-03-07", terms: 1, expected: "2026-03-08T00:00:00.000Z" },
    { invoiceDate: "2026-11-01", terms: 0, expected: "2026-11-01T00:00:00.000Z" },
    { invoiceDate: "2026-11-01", terms: 1, expected: "2026-11-02T00:00:00.000Z" },
    { invoiceDate: "2026-10-31", terms: 1, expected: "2026-11-01T00:00:00.000Z" },
    { invoiceDate: "2026-01-15", terms: 30, expected: "2026-02-14T00:00:00.000Z" },
  ];

  // Historic shifted timestamps are not rewritten because their originating timezone is unknown.
  for (const { invoiceDate: value, terms, expected } of cases) {
    const invoiceDate = new Date(value);
    const originalInvoiceDate = invoiceDate.toISOString();
    const dueDate = deriveSalesDueDate(invoiceDate, terms);

    assert.equal(
      invoiceDate.toISOString(),
      originalInvoiceDate,
      `${value} invoice date remains unchanged`,
    );
    assert.equal(dueDate.toISOString(), expected, `${value} + ${terms} payment-term day(s)`);
  }
});

test("customer and supplier aging badges distinguish current from overdue", () => {
  const customerReportBadge = loadArrowFunction(
    customerDuesSource,
    "customer-dues/page.tsx",
    "agingBucketBadge",
  );
  const customerListBadge = loadArrowFunction(
    customersPageSource,
    "customers/page.tsx",
    "agingBucket",
  );
  const supplierBadge = loadArrowFunction(
    supplierPayablesSource,
    "supplier-payables/page.tsx",
    "agingBucketVariant",
  );

  assert.equal(customerReportBadge(0).label, "Current");
  assert.equal(customerReportBadge(1).label, "1-30 days");
  assert.equal(customerReportBadge(91).label, ">90 days");
  assert.equal(customerListBadge(0).label, "Current");
  assert.equal(customerListBadge(1).label, "1-30 days");
  assert.equal(customerListBadge(91).label, ">90 days");
  assert.equal(supplierBadge({ current: 50, d30: 0, d60: 0, d90: 0, over90: 0 }).label, "Current");
  assert.equal(
    supplierBadge({ current: 0, d30: 50, d60: 0, d90: 0, over90: 0 }).label,
    "1-30 days",
  );
  assert.equal(
    supplierBadge({ current: 50, d30: 25, d60: 0, d90: 0, over90: 0 }).label,
    "1-30 days",
  );
  assert.equal(supplierBadge({ current: 0, d30: 0, d60: 0, d90: 0, over90: 50 }).label, ">90 days");
});

test("oldest overdue-day helpers use calendar days across DST for both parties", async () => {
  const asOf = new Date("2026-03-10T06:30:00.000Z");
  const overdueInvoice = {
    due_date: dateOnlyDaysAgo(asOf, 3),
    due_date_business: dateOnlyDaysAgo(asOf, 3),
    net_amount: 100,
    balance_due: 100,
    payment_allocations: [],
  };
  const prisma = {
    sales_invoices: { findMany: async () => [{
      id: "sales-1",
      due_date_business: overdueInvoice.due_date_business,
      balance_due: overdueInvoice.balance_due,
    }] },
    purchase_invoices: { findMany: async () => [overdueInvoice] },
  };
  const { CustomerLedgerRepository, SupplierLedgerRepository } = loadRepositories(asOf);

  assert.equal(
    await new CustomerLedgerRepository(prisma).getOldestOverdueDays("customer", context, asOf),
    3,
  );
  assert.equal(
    await new SupplierLedgerRepository(prisma).getOldestOverdueDays("supplier", context, asOf),
    3,
  );
});

test("existing aging consumers keep current separate from overdue buckets", async () => {
  const [statement, reports, homePage] = await Promise.all([
    readFile(
      new URL("../src/app/customers/[customerId]/statement/print/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/reports/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const consumer of [customerDuesSource, supplierPayablesSource]) {
    assert.match(consumer, /current \/ 1-30 \/ 31-60 \/ 61-90 \/ &gt;90/);
    assert.match(consumer, /<TableHead className="text-right">Current<\/TableHead>/);
    assert.match(consumer, /<TableHead className="text-right">1-30<\/TableHead>/);
    assert.match(consumer, /buckets\.current\)\}/);
    assert.match(consumer, /buckets\.d30\)\}/);
    assert.match(consumer, /buckets\.d60\)\}/);
    assert.match(consumer, /buckets\.d90\)\}/);
    assert.match(consumer, /buckets\.over90\)\}/);
    assert.doesNotMatch(consumer, /buckets\.current \+ buckets\.d30/);
    const tableHeadCount = (consumer.match(/<TableHead\b/g) ?? []).length;
    const emptyStateColSpans = [...consumer.matchAll(/<TableCell colSpan=\{(\d+)\}/g)].map(
      (match) => Number(match[1]),
    );
    assert.ok(tableHeadCount > 0);
    assert.ok(emptyStateColSpans.every((colSpan) => colSpan === tableHeadCount));
  }
  assert.match(statement, />Current<\/p>/);
  assert.match(statement, /rupee\(aging\.current\)/);
  assert.match(statement, />1-30 days<\/p>/);
  assert.match(statement, /rupee\(aging\.d30\)/);
  assert.match(statement, />31-60 days<\/p>/);
  assert.match(statement, /rupee\(aging\.d60\)/);
  assert.match(statement, />61-90 days<\/p>/);
  assert.match(statement, /rupee\(aging\.d90\)/);
  assert.match(statement, /&gt;90 days<\/p>/);
  assert.match(statement, /rupee\(aging\.over90\)/);
  assert.match(reports, /current \/ 1-30 \/ 31-60 \/ 61-90 \/ >90/);
  assert.match(reports, /Invoice-level aging by business due date; invoices without a classified due date are shown separately/);
  assert.doesNotMatch(reports, /Aging and CSV unavailable/);
  assert.match(homePage, /Customer aging: current \/ 1-30 \/ 31-60 \/ 61-90 \/ >90/);
});
