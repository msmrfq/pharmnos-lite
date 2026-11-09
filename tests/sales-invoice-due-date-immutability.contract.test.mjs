import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const sourcePath = new URL("../src/repositories/sales-invoice.repository.ts", import.meta.url);
const repositorySource = fs.readFileSync(sourcePath, "utf8");
const repositoryModule = { exports: {} };
const repositoryCode = ts.transpileModule(repositorySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

new Function("require", "module", "exports", repositoryCode)(
  (specifier) => {
    if (specifier === "@prisma/client") return { Prisma: {} };
    if (specifier === "@/lib/db/base-repository") {
      return {
        BaseRepository: class {
          constructor(prisma) {
            this.prisma = prisma;
          }

          withTenant(ctx) {
            assert.ok(ctx?.tenantId);
            return ctx;
          }
        },
      };
    }
    throw new Error(`Unexpected repository dependency: ${specifier}`);
  },
  repositoryModule,
  repositoryModule.exports,
);

const { SalesInvoiceRepository } = repositoryModule.exports;
const context = { tenantId: "tenant-1", userId: "user-1" };

function makeHarness({
  status = "FINALIZED",
  dueDate = new Date("2026-01-10T00:00:00.000Z"),
  beforeUpdate,
  beforeApply,
} = {}) {
  const invoice = {
    id: "invoice-1",
    tenant_id: context.tenantId,
    invoice_no: "INV-00001",
    status,
    due_date: dueDate,
    paid_amount: 0,
    balance_due: 100,
  };
  const calls = { updates: [] };
  const matchesCondition = (condition) => {
    if (condition.status !== undefined) {
      if (typeof condition.status === "object") {
        if (condition.status.not === invoice.status) return false;
        if (condition.status.set !== undefined && condition.status.set !== invoice.status) return false;
      } else if (condition.status !== invoice.status) {
        return false;
      }
    }
    return !Object.hasOwn(condition, "due_date") || sameDate(condition.due_date, invoice.due_date);
  };
  const matches = (where) => {
    if (beforeUpdate) beforeUpdate(invoice);
    if (where.id !== invoice.id || where.tenant_id !== invoice.tenant_id) return false;
    if (where.OR && !where.OR.some(matchesCondition)) return false;
    if (where.AND && !where.AND.every(matchesCondition)) return false;
    return true;
  };
  const apply = (data) => {
    for (const [key, value] of Object.entries(data)) {
      if (key === "status" && value && typeof value === "object") {
        invoice.status = value.set;
      } else if (key === "due_date" && value && typeof value === "object" && !(value instanceof Date)) {
        invoice[key] = typeof value.set === "string" ? new Date(value.set) : value.set;
      } else if (key === "due_date" && typeof value === "string") {
        invoice[key] = new Date(value);
      } else {
        invoice[key] = value;
      }
    }
  };
  const prisma = {
    sales_invoices: {
      update: async ({ where, data }) => {
        calls.updates.push({ where, data });
        if (!matches(where)) throw new Error("Record to update not found.");
        beforeApply?.({ invoice, data });
        apply(data);
        return { ...invoice };
      },
    },
  };
  return { repository: new SalesInvoiceRepository(prisma), invoice, calls };
}

function sameDate(left, right) {
  if (left === null || right === null) return left === right;
  return new Date(left).getTime() === new Date(right).getTime();
}

test("finalized due-date writes permit the unchanged date across Date, string, and set forms", async () => {
  const original = new Date("2026-01-10T00:00:00.000Z");
  for (const due_date of [
    new Date(original),
    original.toISOString(),
    { set: new Date(original) },
    { set: original.toISOString() },
  ]) {
    const { repository, invoice, calls } = makeHarness({ dueDate: original });
    const updated = await repository.update(invoice.id, { due_date }, context);
    assert.equal(updated.due_date.getTime(), original.getTime());
    assert.equal(calls.updates.length, 1);
    assert.deepEqual(calls.updates[0].where.OR, [
      { status: { not: "FINALIZED" } },
      { due_date: original },
    ]);
    assert.equal(calls.updates[0].where.tenant_id, context.tenantId);
  }
});

test("finalized due-date writes reject changed and null dates without applying other fields", async () => {
  for (const due_date of [
    new Date("2026-01-11T00:00:00.000Z"),
    { set: null },
  ]) {
    const { repository, invoice, calls } = makeHarness();
    await assert.rejects(
      repository.update(invoice.id, { due_date, paid_amount: 25 }, context),
      /Record to update not found/,
    );
    assert.equal(invoice.due_date.toISOString(), "2026-01-10T00:00:00.000Z");
    assert.equal(invoice.paid_amount, 0);
    assert.equal(calls.updates.length, 1);
  }
});

test("finalized invoices with null due dates may explicitly retain null", async () => {
  const { repository, invoice, calls } = makeHarness({ dueDate: null });
  const updated = await repository.update(invoice.id, { due_date: { set: null } }, context);
  assert.equal(updated.due_date, null);
  assert.deepEqual(calls.updates[0].where.OR, [
    { status: { not: "FINALIZED" } },
    { due_date: null },
  ]);
});

test("draft due dates may be changed to a concrete date or null", async () => {
  for (const due_date of [
    { set: new Date("2026-02-01T00:00:00.000Z") },
    null,
  ]) {
    const { repository, invoice, calls } = makeHarness({ status: "DRAFT" });
    await repository.update(invoice.id, { due_date }, context);
    assert.equal(invoice.due_date, due_date?.set ?? due_date);
    assert.deepEqual(calls.updates[0].where.OR[0].status, { not: "FINALIZED" });
  }
});

test("the atomic predicate blocks a due-date change after a concurrent finalization", async () => {
  const { repository, invoice, calls } = makeHarness({
    status: "DRAFT",
    beforeUpdate: (current) => {
      current.status = "FINALIZED";
    },
  });
  await assert.rejects(
    repository.update(invoice.id, { due_date: new Date("2026-01-12T00:00:00.000Z") }, context),
    /Record to update not found/,
  );
  assert.equal(invoice.due_date.toISOString(), "2026-01-10T00:00:00.000Z");
  assert.deepEqual(calls.updates[0].where.OR[0].status, { not: "FINALIZED" });
  assert.equal(calls.updates[0].where.OR[1].due_date.toISOString(), "2026-01-12T00:00:00.000Z");
});

test("the unchanged-date exception still delegates other finalized-field guards to the database", async () => {
  const { repository, invoice, calls } = makeHarness({
    beforeApply: ({ invoice: current, data }) => {
      if (current.status === "FINALIZED" && data.invoice_no !== undefined) {
        throw new Error("Finalized sales invoice facts are immutable");
      }
    },
  });
  await assert.rejects(
    repository.update(invoice.id, {
      due_date: new Date("2026-01-10T00:00:00.000Z"),
      invoice_no: "CHANGED",
    }, context),
    /Finalized sales invoice facts are immutable/,
  );
  assert.equal(invoice.due_date.toISOString(), "2026-01-10T00:00:00.000Z");
  assert.equal(invoice.invoice_no, "INV-00001");
  assert.equal(calls.updates.length, 1);
});

test("a concurrent finalization permits a due-date update that remains unchanged", async () => {
  const dueDate = new Date("2026-01-10T00:00:00.000Z");
  const { repository, invoice, calls } = makeHarness({
    status: "DRAFT",
    beforeUpdate: (current) => {
      current.status = "FINALIZED";
    },
  });
  const updated = await repository.update(invoice.id, { due_date: dueDate.toISOString() }, context);
  assert.equal(updated.status, "FINALIZED");
  assert.equal(updated.due_date.getTime(), dueDate.getTime());
  assert.equal(calls.updates.length, 1);
});

test("updates without due_date retain ordinary rollup and protected-field handling", async () => {
  const { repository, invoice, calls } = makeHarness();
  const updated = await repository.update(invoice.id, { paid_amount: 25, balance_due: 75 }, context);
  assert.equal(updated.paid_amount, 25);
  assert.equal(updated.balance_due, 75);
  assert.deepEqual(calls.updates[0].where, { id: invoice.id, tenant_id: context.tenantId });
});

test("unsupported due-date update expressions fail closed before writing", async () => {
  const { repository, invoice, calls } = makeHarness();
  await assert.rejects(
    repository.update(invoice.id, { due_date: {} }, context),
    /concrete date or null/,
  );
  assert.equal(calls.updates.length, 0);
});

test("invalid dates fail closed before writing", async () => {
  for (const due_date of [
    new Date(Number.NaN),
    { set: new Date(Number.NaN) },
    "not-a-date",
  ]) {
    const { repository, invoice, calls } = makeHarness();
    await assert.rejects(
      repository.update(invoice.id, { due_date }, context),
      /valid date or null/,
    );
    assert.equal(invoice.due_date.toISOString(), "2026-01-10T00:00:00.000Z");
    assert.equal(calls.updates.length, 0);
  }
});

test("nested relation updates remain on the original Prisma update operation", async () => {
  const { repository, invoice, calls } = makeHarness();
  const customerUpdate = { update: { business_name: "Updated customer" } };
  await repository.update(invoice.id, {
    due_date: new Date("2026-01-10T00:00:00.000Z"),
    customer: customerUpdate,
  }, context);
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].data.customer, customerUpdate);
});

test("finalizing with a changed due date is rejected atomically", async () => {
  const { repository, invoice, calls } = makeHarness({ status: "DRAFT" });
  await assert.rejects(
    repository.update(invoice.id, {
      status: "FINALIZED",
      due_date: new Date("2026-01-11T00:00:00.000Z"),
    }, context),
    /Record to update not found/,
  );
  assert.equal(invoice.status, "DRAFT");
  assert.equal(invoice.due_date.toISOString(), "2026-01-10T00:00:00.000Z");
  assert.deepEqual(calls.updates[0].where.AND, [
    { due_date: new Date("2026-01-11T00:00:00.000Z") },
  ]);
});

test("finalization with an unchanged due date is permitted", async () => {
  const dueDate = new Date("2026-01-10T00:00:00.000Z");
  const { repository, invoice, calls } = makeHarness({ status: "DRAFT", dueDate });
  await repository.update(invoice.id, {
    status: { set: "FINALIZED" },
    due_date: dueDate,
  }, context);
  assert.equal(invoice.status, "FINALIZED");
  assert.equal(invoice.due_date.getTime(), dueDate.getTime());
  assert.deepEqual(calls.updates[0].where.AND, [{ due_date: dueDate }]);
});

test("finalized invoices cannot be demoted through a status-only update", async () => {
  for (const status of ["DRAFT", "CANCELLED", { set: "DRAFT" }, { set: "CANCELLED" }]) {
    const { repository, invoice, calls } = makeHarness();
    await assert.rejects(
      repository.update(invoice.id, { status }, context),
      /Record to update not found/,
    );
    assert.equal(invoice.status, "FINALIZED");
    assert.deepEqual(calls.updates[0].where, {
      id: invoice.id,
      tenant_id: context.tenantId,
      AND: [{ status: { not: "FINALIZED" } }],
    });
  }
});

test("a two-call finalized-to-draft then due-date bypass is rejected at both writes", async () => {
  const { repository, invoice, calls } = makeHarness();
  await assert.rejects(
    repository.update(invoice.id, { status: "DRAFT" }, context),
    /Record to update not found/,
  );
  await assert.rejects(
    repository.update(invoice.id, { due_date: new Date("2026-01-11T00:00:00.000Z") }, context),
    /Record to update not found/,
  );
  assert.equal(invoice.status, "FINALIZED");
  assert.equal(invoice.due_date.toISOString(), "2026-01-10T00:00:00.000Z");
  assert.equal(calls.updates.length, 2);
});

test("same-finalized and normal draft status updates remain permitted", async () => {
  const finalized = makeHarness();
  await finalized.repository.update(finalized.invoice.id, { status: "FINALIZED" }, context);
  assert.equal(finalized.invoice.status, "FINALIZED");
  assert.deepEqual(finalized.calls.updates[0].where, {
    id: finalized.invoice.id,
    tenant_id: context.tenantId,
  });

  const draft = makeHarness({ status: "DRAFT" });
  await draft.repository.update(draft.invoice.id, { status: "CANCELLED" }, context);
  assert.equal(draft.invoice.status, "CANCELLED");
  assert.deepEqual(draft.calls.updates[0].where.AND, [
    { status: { not: "FINALIZED" } },
  ]);
});

test("status-only update predicate rejects concurrent finalization and preserves tenant scope", async () => {
  const { repository, invoice, calls } = makeHarness({
    status: "DRAFT",
    beforeUpdate: (current) => {
      current.status = "FINALIZED";
    },
  });
  await assert.rejects(
    repository.update(invoice.id, { status: "CANCELLED" }, context),
    /Record to update not found/,
  );
  assert.equal(invoice.status, "FINALIZED");
  assert.equal(calls.updates[0].where.id, invoice.id);
  assert.equal(calls.updates[0].where.tenant_id, context.tenantId);
  assert.deepEqual(calls.updates[0].where.AND, [
    { status: { not: "FINALIZED" } },
  ]);
});
