import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function load(compiled, imports = {}) {
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", compiled)((name) => {
    if (name in imports) return imports[name];
    if (name === "node:crypto") return require(name);
    return new Proxy({}, {
      get: (_target, key) => key === "__esModule" ? true : () => undefined,
    });
  }, actionModule, actionModule.exports);
  return actionModule.exports;
}

const businessDate = load(compile("../src/lib/utils/business-date.ts"));
const financialTemporal = load(
  compile("../src/lib/utils/financial-temporal.ts"),
  { "@/lib/utils/business-date": businessDate },
);
const actionSources = {
  sales: compile("../src/app/_actions/sales.actions.ts"),
  purchase: compile("../src/app/_actions/purchases.actions.ts"),
};

function setup(kind, dates) {
  const writes = [];
  let treatmentReached = false;
  const invoice = {
    id: "invoice-1",
    status: "DRAFT",
    invoice_date: new Date("2026-11-07T00:00:00.000Z"),
    due_date: new Date("2026-11-14T00:00:00.000Z"),
    ...dates,
  };
  const tx = {
    $executeRaw: async () => {},
    sales_posting_operations: { findUnique: async () => null, create: async () => writes.push("posting") },
    sales_invoices: { findUnique: async () => invoice, update: async () => writes.push("invoice") },
    purchase_invoices: { findUnique: async () => invoice, updateMany: async () => writes.push("invoice") },
  };
  const prisma = { $transaction: async (work) => work(tx) };
  const actions = load(actionSources[kind], {
    "@/lib/db/prisma": { prisma, assertPostgresConfigured: () => {} },
    "@/lib/db/tenant-context": {
      establishTenantContext: async () => {},
      requirePermission: () => {},
      requireServerTenantContext: async () => ({ tenantId: "tenant-1", userId: "user-1" }),
    },
    "@/lib/gst/treatment": {
      validateGstTreatment: () => {
        treatmentReached = true;
        throw new Error("Reached treatment validation");
      },
    },
    "@/lib/utils/business-date": businessDate,
    "@/lib/utils/financial-temporal": financialTemporal,
    "@prisma/client": {
      Prisma: { sql: () => ({}), PrismaClientKnownRequestError: class extends Error {} },
      PermissionAction: {},
    },
    "next/cache.js": { revalidatePath: () => {} },
    "next/navigation.js": { redirect: () => {} },
  });
  return {
    action: actions[kind === "sales" ? "finalizeSalesInvoiceAction" : "finalizePurchaseAction"],
    writes,
    treatmentReached: () => treatmentReached,
  };
}

for (const kind of ["sales", "purchase"]) {
  for (const [label, effectiveDate, dueDate] of [
    ["both", null, null],
    ["effective date", null, new Date("2026-11-14T00:00:00.000Z")],
    ["due date", new Date("2026-11-07T00:00:00.000Z"), null],
  ]) {
    test(`${kind} draft with unclassified ${label} fails before posting`, async () => {
      const { action, writes, treatmentReached } = setup(kind, {
        effective_date: effectiveDate,
        due_date_business: dueDate,
      });
      const form = new FormData();
      form.set("idempotency_key", "test-key-1");
      const result = await action("invoice-1", {}, form);
      assert.equal(result.ok, false);
      assert.match(result.message, /business dates are unclassified/);
      assert.equal(treatmentReached(), false);
      assert.deepEqual(writes, []);
    });
  }

  test(`${kind} draft with classified dates proceeds to ordinary validation`, async () => {
    const { action, writes, treatmentReached } = setup(kind, {
      effective_date: new Date("2026-11-07T00:00:00.000Z"),
      due_date_business: new Date("2026-11-14T00:00:00.000Z"),
    });
    const form = new FormData();
    form.set("idempotency_key", "test-key-1");
    const result = await action("invoice-1", {}, form);
    assert.equal(result.ok, false);
    assert.equal(result.message, "Reached treatment validation");
    assert.equal(treatmentReached(), true);
    assert.deepEqual(writes, []);
  });
}
