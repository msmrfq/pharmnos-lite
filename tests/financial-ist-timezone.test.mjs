import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const originalTimezone = process.env.TZ;
const ledgerSource = await readFile(
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
const ledgerJavaScript = ts.transpileModule(ledgerSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const businessDateJavaScript = ts.transpileModule(businessDateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const context = { tenantId: "ist-aging-test" };
const ages = [-1, 0, 1, 29, 30, 31, 32, 59, 60, 61, 62, 89, 90, 91, 92, 119, 120, 121, 122];

function fixedInstant(isoTimestamp) {
  return new Date(isoTimestamp);
}

function dateOnlyAtISTCalendarDayOffset(daysFromNovemberNinth) {
  return new Date(Date.UTC(2026, 10, 9 + daysFromNovemberNinth));
}

function rowForAge(age, amount) {
  const dueDate = dateOnlyAtISTCalendarDayOffset(-age);
  return {
    due_date: dueDate,
    due_date_business: dueDate,
    balance_due: amount,
    net_amount: amount,
    payment_allocations: [],
  };
}

function loadLedgerRepositories(now) {
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

    withTenant(tenantContext) {
      return { tenantId: tenantContext.tenantId };
    }
  }

  const businessDateModule = { exports: {} };
  vm.runInNewContext(businessDateJavaScript, {
    Date: FixedDate,
    Intl,
    exports: businessDateModule.exports,
    module: businessDateModule,
  });

  vm.runInNewContext(ledgerJavaScript, {
    Date: FixedDate,
    exports: testModule.exports,
    module: testModule,
    require(specifier) {
      if (specifier === "@/lib/db/base-repository") return { BaseRepository };
      if (specifier === "@prisma/client") return {};
      if (specifier === "@/lib/utils/business-date") return businessDateModule.exports;
      throw new Error(`Unexpected ledger dependency: ${specifier}`);
    },
  });
  return testModule.exports;
}

function mockPrisma(rows) {
  return {
    sales_invoices: { findMany: async () => rows },
    purchase_invoices: { findMany: async () => rows },
  };
}

function expectedBuckets(age, amount) {
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: amount };
  if (age <= 0) buckets.current = amount;
  else if (age <= 30) buckets.d30 = amount;
  else if (age <= 60) buckets.d60 = amount;
  else if (age <= 90) buckets.d90 = amount;
  else buckets.over90 = amount;
  return buckets;
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
  assert.match(salesActionsSource, /new Date\(data\.invoice_date as any\)/);
  assert.match(salesActionsSource, /deriveSalesDueDate\(invoiceDate, data\.payment_terms_days\)/);

  const compiled = ts.transpileModule(declaration.getText(sourceFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return vm.runInNewContext(`${compiled}\nderiveSalesDueDate`);
}

test("customer aging follows IST calendar-day boundaries for every requested age", async () => {
  const now = fixedInstant("2026-11-08T18:30:00.000Z");
  const { CustomerLedgerRepository } = loadLedgerRepositories(now);

  for (const [index, age] of ages.entries()) {
    const amount = index + 1;
    const repository = new CustomerLedgerRepository(mockPrisma([rowForAge(age, amount)]));
    const buckets = await repository.getAgingBuckets(context);

    assert.deepEqual(
      { ...buckets },
      expectedBuckets(age, amount),
      `customer invoice due ${age} IST calendar day(s) from 2026-11-09`,
    );
  }
});

test("supplier aging follows IST calendar-day boundaries for every requested age", async () => {
  const now = fixedInstant("2026-11-08T18:30:00.000Z");
  const { SupplierLedgerRepository } = loadLedgerRepositories(now);

  for (const [index, age] of ages.entries()) {
    const amount = index + 1;
    const repository = new SupplierLedgerRepository(mockPrisma([rowForAge(age, amount)]));
    const buckets = await repository.getAgingBuckets(context);

    assert.deepEqual(
      { ...buckets },
      expectedBuckets(age, amount),
      `supplier invoice due ${age} IST calendar day(s) from 2026-11-09`,
    );
  }
});

test("customer and supplier aging summaries combine the expected IST buckets", async () => {
  const now = fixedInstant("2026-11-08T18:30:00.000Z");
  const rows = [-1, 0, 1, 30, 31, 60, 61, 90, 91].map((age, index) => rowForAge(age, index + 1));
  const { CustomerLedgerRepository, SupplierLedgerRepository } = loadLedgerRepositories(now);

  for (const [kind, Repository, summaryMethod] of [
    ["customer", CustomerLedgerRepository, "agedReceivablesTotals"],
    ["supplier", SupplierLedgerRepository, "agedPayablesTotals"],
  ]) {
    const repository = new Repository(mockPrisma(rows));
    const buckets = await repository.getAgingBuckets(context);

    assert.deepEqual(
      { ...buckets },
      { current: 3, d30: 7, d60: 11, d90: 15, over90: 9, total: 45 },
      `${kind} summary source buckets`,
    );
    assert.deepEqual(
      { ...(await repository[summaryMethod](context)) },
      {
        current_30: 10,
        bucket_31_60: 11,
        bucket_61_90: 15,
        bucket_over_90: 9,
        total: 45,
      },
      `${kind} aging totals`,
    );
  }
});

test("customer and supplier aging switch dates exactly at IST midnight", async () => {
  const instants = [
    {
      label: "one millisecond before IST midnight",
      now: "2026-11-08T18:29:59.999Z",
      expected: { current: 500, d30: 100, d60: 0, d90: 0, over90: 0, total: 600 },
    },
    {
      label: "at IST midnight",
      now: "2026-11-08T18:30:00.000Z",
      expected: { current: 300, d30: 300, d60: 0, d90: 0, over90: 0, total: 600 },
    },
  ];

  for (const instant of instants) {
    const rows = [
      { ...rowForAge(2, 100), due_date_business: new Date("2026-11-07") },
      { ...rowForAge(1, 200), due_date_business: new Date("2026-11-08") },
      { ...rowForAge(0, 300), due_date_business: new Date("2026-11-09") },
    ];
    const { CustomerLedgerRepository, SupplierLedgerRepository } = loadLedgerRepositories(
      fixedInstant(instant.now),
    );

    for (const [kind, Repository] of [
      ["customer", CustomerLedgerRepository],
      ["supplier", SupplierLedgerRepository],
    ]) {
      const repository = new Repository(mockPrisma(rows));
      assert.deepEqual(
        { ...(await repository.getAgingBuckets(context)) },
        instant.expected,
        `${kind} aging ${instant.label}`,
      );
    }
  }
});

test("oldest-overdue calculations exclude IST due-today rows on both sides of midnight", async () => {
  const instants = [
    {
      label: "before IST midnight",
      now: "2026-11-08T18:29:59.999Z",
      overdueDays: 1,
    },
    {
      label: "at IST midnight",
      now: "2026-11-08T18:30:00.000Z",
      overdueDays: 2,
    },
  ];

  for (const instant of instants) {
    const asOf = fixedInstant(instant.now);
    const { CustomerLedgerRepository, SupplierLedgerRepository } = loadLedgerRepositories(asOf);

    for (const [kind, Repository, prismaModel, partyId] of [
      ["customer", CustomerLedgerRepository, "sales_invoices", "customer-test"],
      ["supplier", SupplierLedgerRepository, "purchase_invoices", "supplier-test"],
    ]) {
      const candidates = [
        new Date("2026-11-07T00:00:00.000Z"),
        new Date("2026-11-08T00:00:00.000Z"),
        new Date("2026-11-09T00:00:00.000Z"),
      ];
      const rows = candidates.map((due_date_business, index) => ({
        id: `invoice-${index}`,
        due_date_business,
        balance_due: 100,
        net_amount: 100,
        payment_allocations: [],
      }));
      const prisma = {
        [prismaModel]: {
          findMany: async () => rows,
        },
      };

      const repository = new Repository(prisma);
      const overdueDays = await repository.getOldestOverdueDays(partyId, context, asOf);

      assert.equal(overdueDays, instant.overdueDays, `${kind} overdue days ${instant.label}`);
    }
  }
});

test("date-only sales dates and due dates derive across month, leap-year, and year boundaries", () => {
  const deriveSalesDueDate = loadSalesDueDateDerivation();
  const cases = [
    { invoiceDate: "2026-11-09", terms: 0, expected: "2026-11-09T00:00:00.000Z" },
    { invoiceDate: "2026-01-31", terms: 1, expected: "2026-02-01T00:00:00.000Z" },
    { invoiceDate: "2024-02-28", terms: 1, expected: "2024-02-29T00:00:00.000Z" },
    { invoiceDate: "2024-02-29", terms: 1, expected: "2024-03-01T00:00:00.000Z" },
    { invoiceDate: "2026-12-31", terms: 1, expected: "2027-01-01T00:00:00.000Z" },
  ];

  for (const { invoiceDate: dateOnly, terms, expected } of cases) {
    const parsedInvoiceDate = new Date(dateOnly);
    assert.equal(
      parsedInvoiceDate.toISOString(),
      `${dateOnly}T00:00:00.000Z`,
      `${dateOnly} date-only input parses to the persisted UTC date`,
    );
    assert.equal(
      deriveSalesDueDate(parsedInvoiceDate, terms).toISOString(),
      expected,
      `${dateOnly} plus ${terms} payment-term day(s)`,
    );
  }
});

test("the Date mock does not modify the process timezone", () => {
  assert.equal(process.env.TZ, originalTimezone);
});
