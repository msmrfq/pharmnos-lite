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
const repositoryJs = ts.transpileModule(repositorySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const businessDateJs = ts.transpileModule(businessDateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

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

  const businessDateModule = { exports: {} };
  vm.runInNewContext(businessDateJs, {
    Date: FixedDate,
    Intl,
    exports: businessDateModule.exports,
    module: businessDateModule,
  });

  const repositoryModule = { exports: {} };
  vm.runInNewContext(repositoryJs, {
    Date: FixedDate,
    exports: repositoryModule.exports,
    module: repositoryModule,
    require(specifier) {
      if (specifier === "@/lib/db/base-repository") {
        return {
          BaseRepository: class {
            constructor(prisma) {
              this.prisma = prisma;
            }

            withTenant(ctx) {
              return { tenantId: ctx.tenantId };
            }
          },
        };
      }
      if (specifier === "@prisma/client") return {};
      if (specifier === "@/lib/utils/business-date") return businessDateModule.exports;
      throw new Error(`Unexpected dependency: ${specifier}`);
    },
  });
  return repositoryModule.exports;
}

const asOf = new Date("2026-11-09T06:30:00.000Z");
const context = { tenantId: "tenant-1" };
const day = (offset) => {
  const date = new Date("2026-11-09T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
};
const allocated = (amount, reversed = 0) => ({
  amount,
  reversal: reversed ? [{ amount: reversed }] : [],
});

function getCustomerRepo(rows, calls = {}) {
  const { CustomerLedgerRepository } = loadRepositories(asOf);
  return new CustomerLedgerRepository({
    sales_invoices: {
      findMany: async (args) => {
        calls.args = args;
        return rows;
      },
    },
  });
}

function getSupplierRepo(rows, calls = {}) {
  const { SupplierLedgerRepository } = loadRepositories(asOf);
  return new SupplierLedgerRepository({
    purchase_invoices: {
      findMany: async (args) => {
        calls.args = args;
        return rows;
      },
    },
  });
}

test("customer aging uses classified business due dates and tenant scope", async () => {
  const calls = {};
  const repository = getCustomerRepo([{
    id: "invoice-1",
    due_date: day(-100),
    due_date_business: day(-10),
    balance_due: 125,
  }], calls);

  assert.deepEqual({ ...await repository.getAgingBuckets(context, "customer-1") }, {
    current: 0,
    d30: 125,
    d60: 0,
    d90: 0,
    over90: 0,
    total: 125,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.args.where)), {
    tenant_id: "tenant-1",
    customer_id: "customer-1",
    status: "FINALIZED",
    balance_due: { gt: 0 },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.args.select)), {
    id: true,
    due_date_business: true,
    balance_due: true,
  });
});

test("supplier aging uses classified business due dates and outstanding allocations", async () => {
  const calls = {};
  const repository = getSupplierRepo([{
    id: "purchase-1",
    due_date: day(-100),
    due_date_business: day(-31),
    net_amount: 200,
    payment_allocations: [allocated(100), allocated(50, 25)],
  }], calls);

  assert.deepEqual({ ...await repository.getAgingBuckets(context, "supplier-1") }, {
    current: 0,
    d30: 0,
    d60: 75,
    d90: 0,
    over90: 0,
    total: 75,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.args.where)), {
    tenant_id: "tenant-1",
    supplier_id: "supplier-1",
    status: "FINALIZED",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.args.select)), {
    id: true,
    due_date_business: true,
    net_amount: true,
    payment_allocations: { select: { amount: true, reversal: { select: { amount: true } } } },
  });
  await repository.getOldestOverdueDays("supplier-1", context, asOf);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.args.orderBy)), [
    { due_date_business: "asc" },
    { id: "asc" },
  ]);
});

test("aging fails closed for any material customer invoice with an unclassified business due date", async () => {
  const legacyOnlyRow = { id: "legacy", due_date: day(-10), due_date_business: null, balance_due: 10 };
  await assert.rejects(
    getCustomerRepo([legacyOnlyRow]).getAgingBuckets(context),
    /unclassified business due date/,
  );
  await assert.rejects(
    getCustomerRepo([legacyOnlyRow]).getOldestOverdueDays("customer-1", context, asOf),
    /unclassified business due date/,
  );
});

test("aging fails closed for any material supplier invoice with an unclassified business due date", async () => {
  const legacyOnlyRow = {
    id: "legacy",
    due_date: day(-10),
    due_date_business: null,
    net_amount: 100,
    payment_allocations: [allocated(25)],
  };
  await assert.rejects(
    getSupplierRepo([legacyOnlyRow]).getAgingBuckets(context),
    /unclassified business due date/,
  );
  await assert.rejects(
    getSupplierRepo([legacyOnlyRow]).getOldestOverdueDays("supplier-1", context, asOf),
    /unclassified business due date/,
  );
});

test("unclassified fully settled invoices do not block aging totals", async () => {
  const customer = await getCustomerRepo([{
    id: "settled-customer",
    due_date_business: null,
    balance_due: 0,
  }]).getAgingBuckets(context);
  const supplier = await getSupplierRepo([{
    id: "settled-supplier",
    due_date_business: null,
    net_amount: 100,
    payment_allocations: [allocated(100)],
  }]).getAgingBuckets(context);

  assert.equal(customer.total, 0);
  assert.equal(supplier.total, 0);
});

test("oldest overdue selection orders equal business dates by invoice id", async () => {
  const calls = {};
  const repository = getCustomerRepo([
    { id: "b", due_date_business: day(-5), balance_due: 10 },
    { id: "a", due_date_business: day(-5), balance_due: 10 },
    { id: "oldest", due_date_business: day(-12), balance_due: 10 },
  ], calls);

  assert.equal(await repository.getOldestOverdueDays("customer-1", context, asOf), 12);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.args.orderBy)), [
    { due_date_business: "asc" },
    { id: "asc" },
  ]);
});
