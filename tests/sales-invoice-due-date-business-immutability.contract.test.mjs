import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(new URL("../src/repositories/sales-invoice.repository.ts", import.meta.url), "utf8");
const repositoryModule = { exports: {} };
new Function("require", "module", "exports", ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(
  (specifier) => {
    if (specifier === "@prisma/client") return { Prisma: {} };
    if (specifier === "@/lib/db/base-repository") {
      return {
        BaseRepository: class {
          constructor(prisma) { this.prisma = prisma; }
          withTenant(ctx) { return ctx; }
        },
      };
    }
    throw new Error(`Unexpected dependency: ${specifier}`);
  },
  repositoryModule,
  repositoryModule.exports,
);
const { SalesInvoiceRepository } = repositoryModule.exports;
const context = { tenantId: "tenant-1", userId: "user-1" };
const original = new Date("2026-01-10T00:00:00.000Z");

const sameDate = (left, right) =>
  left === null || right === null ? left === right : new Date(left).getTime() === new Date(right).getTime();

// Evaluates the where clause the way the database would, including nested OR groups.
function evaluate(condition, invoice) {
  if (condition.OR) return condition.OR.some((entry) => evaluate(entry, invoice));
  if (condition.AND) return condition.AND.every((entry) => evaluate(entry, invoice));
  if (condition.id !== undefined && condition.id !== invoice.id) return false;
  if (condition.tenant_id !== undefined && condition.tenant_id !== invoice.tenant_id) return false;
  if (condition.status !== undefined && condition.status.not === invoice.status) return false;
  for (const field of ["due_date", "due_date_business"]) {
    if (Object.hasOwn(condition, field) && !sameDate(condition[field], invoice[field])) return false;
  }
  return true;
}

function harness({ status = "FINALIZED", dueDateBusiness = original, beforeUpdate } = {}) {
  const invoice = {
    id: "invoice-1",
    tenant_id: context.tenantId,
    status,
    due_date: original,
    due_date_business: dueDateBusiness,
    paid_amount: 0,
  };
  const updates = [];
  const prisma = {
    sales_invoices: {
      update: async ({ where, data }) => {
        updates.push({ where, data });
        beforeUpdate?.(invoice);
        if (!evaluate(where, invoice)) throw new Error("Record to update not found.");
        for (const [key, value] of Object.entries(data)) {
          invoice[key] = value && typeof value === "object" && "set" in value ? value.set : value;
        }
        return { ...invoice };
      },
    },
  };
  return { repository: new SalesInvoiceRepository(prisma), invoice, updates };
}

test("finalized due_date_business permits the unchanged date across Date, string and set forms", async () => {
  for (const due_date_business of [
    new Date(original),
    original.toISOString(),
    { set: new Date(original) },
    { set: original.toISOString() },
  ]) {
    const { repository, invoice, updates } = harness();
    await repository.update(invoice.id, { due_date_business, paid_amount: 5 }, context);
    assert.equal(invoice.paid_amount, 5);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].where.tenant_id, context.tenantId);
  }
});

test("finalized due_date_business rejects a changed or null value without applying other fields", async () => {
  for (const due_date_business of [new Date("2026-01-11T00:00:00.000Z"), { set: null }, null]) {
    const { repository, invoice } = harness();
    await assert.rejects(
      repository.update(invoice.id, { due_date_business, paid_amount: 25 }, context),
      /Record to update not found/,
    );
    assert.equal(invoice.due_date_business.toISOString(), original.toISOString());
    assert.equal(invoice.paid_amount, 0);
  }
});

test("a finalized invoice with an unclassified (null) due_date_business may only retain null", async () => {
  const kept = harness({ dueDateBusiness: null });
  await kept.repository.update(kept.invoice.id, { due_date_business: null }, context);
  assert.equal(kept.invoice.due_date_business, null);

  // Setting a date on a finalized unclassified invoice would be a guess.
  const classified = harness({ dueDateBusiness: null });
  await assert.rejects(
    classified.repository.update(classified.invoice.id, { due_date_business: original }, context),
    /Record to update not found/,
  );
  assert.equal(classified.invoice.due_date_business, null);
});

test("draft due_date_business may change, but not after a concurrent finalization", async () => {
  const draft = harness({ status: "DRAFT" });
  const changed = new Date("2026-02-01T00:00:00.000Z");
  await draft.repository.update(draft.invoice.id, { due_date_business: changed }, context);
  assert.equal(draft.invoice.due_date_business.toISOString(), changed.toISOString());

  const racing = harness({ status: "DRAFT", beforeUpdate: (current) => { current.status = "FINALIZED"; } });
  await assert.rejects(
    racing.repository.update(racing.invoice.id, { due_date_business: changed }, context),
    /Record to update not found/,
  );
  assert.equal(racing.invoice.due_date_business.toISOString(), original.toISOString());
});

test("finalizing together with a changed due_date_business is rejected; an unchanged one is allowed", async () => {
  const bad = harness({ status: "DRAFT" });
  await assert.rejects(
    bad.repository.update(bad.invoice.id, { status: "FINALIZED", due_date_business: new Date("2026-03-01T00:00:00.000Z") }, context),
    /Record to update not found/,
  );
  assert.equal(bad.invoice.status, "DRAFT");

  const good = harness({ status: "DRAFT" });
  await good.repository.update(good.invoice.id, { status: "FINALIZED", due_date_business: new Date(original) }, context);
  assert.equal(good.invoice.status, "FINALIZED");
});

test("updates without due_date_business keep the existing predicate shape", async () => {
  const { repository, invoice, updates } = harness();
  await repository.update(invoice.id, { paid_amount: 1 }, context);
  assert.deepEqual(updates[0].where, { id: invoice.id, tenant_id: context.tenantId });
  await assert.rejects(
    repository.update(invoice.id, { due_date_business: undefined, status: "DRAFT" }, context),
    /Record to update not found/,
  );
});
