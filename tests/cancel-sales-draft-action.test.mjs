import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(new URL("../src/app/_actions/sales.actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function loadAction({ invoiceStatus = "DRAFT", raceFinalization = false } = {}) {
  const invoice = { id: "invoice-1", tenant_id: "tenant-1", status: invoiceStatus };
  const calls = { findUnique: [], update: [], permissions: [], revalidated: [] };
  const prisma = {
    sales_invoices: {
      findUnique: async (args) => {
        calls.findUnique.push(args);
        return args.where.id === invoice.id ? { ...invoice } : null;
      },
      update: async (args) => {
        calls.update.push(args);
        if (raceFinalization) invoice.status = "FINALIZED";
        const where = args.where;
        if (
          where.id !== invoice.id ||
          where.tenant_id !== invoice.tenant_id ||
          where.status !== invoice.status
        ) {
          throw new Error("Record to update not found.");
        }
        Object.assign(invoice, args.data);
        return { ...invoice };
      },
    },
  };
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (specifier) => {
      if (specifier === "@/lib/db/prisma") {
        return { prisma, assertPostgresConfigured: () => {} };
      }
      if (specifier === "@/lib/db/tenant-context") {
        return {
          establishTenantContext: async () => {},
          requirePermission: (...args) => calls.permissions.push(args),
          requireServerTenantContext: async () => ({ tenantId: "tenant-1", userId: "user-1" }),
        };
      }
      if (specifier === "next/cache.js") {
        return { revalidatePath: (route) => calls.revalidated.push(route) };
      }
      if (specifier === "next/navigation.js") return { redirect: () => {} };
      if (specifier === "node:crypto") return require("node:crypto");
      return new Proxy({}, {
        get: (_target, key) => {
          if (key === "__esModule") return true;
          return (..._args) => undefined;
        },
      });
    },
    actionModule,
    actionModule.exports,
  );
  return {
    action: actionModule.exports.cancelSalesDraftAction,
    invoice,
    calls,
  };
}

test("cancellation conditionally updates only the tenant-owned draft", async () => {
  const { action, invoice, calls } = loadAction();
  const result = await action(invoice.id);
  assert.deepEqual(result, { ok: true, data: { id: invoice.id } });
  assert.deepEqual(calls.update[0].where, {
    id: invoice.id,
    tenant_id: "tenant-1",
    status: "DRAFT",
  });
  assert.equal(calls.update[0].data.status, "CANCELLED");
  assert.equal(calls.update[0].data.cancelled_by, "user-1");
  assert.ok(calls.update[0].data.cancelled_at instanceof Date);
  assert.ok(calls.update[0].data.updated_at instanceof Date);
  assert.deepEqual(calls.permissions, [[{ tenantId: "tenant-1", userId: "user-1" }, "cancel_invoice"]]);
  assert.deepEqual(calls.revalidated, ["/billing", "/dashboard"]);
  assert.equal(invoice.status, "CANCELLED");
});

test("a concurrent finalization makes the conditional cancellation fail without revalidation", async () => {
  const { action, invoice, calls } = loadAction({ raceFinalization: true });
  const result = await action(invoice.id);
  assert.deepEqual(result, {
    ok: false,
    message: "Invoice could not be cancelled. Please try again.",
  });
  assert.equal(calls.findUnique.length, 1);
  assert.deepEqual(calls.update[0].where, {
    id: invoice.id,
    tenant_id: "tenant-1",
    status: "DRAFT",
  });
  assert.deepEqual(calls.revalidated, []);
  assert.equal(invoice.status, "FINALIZED");
});

test("non-draft invoices retain the existing rejection and are not updated", async () => {
  const { action, calls } = loadAction({ invoiceStatus: "FINALIZED" });
  const result = await action("invoice-1");
  assert.deepEqual(result, { ok: false, message: "Only draft invoices can be cancelled." });
  assert.equal(calls.update.length, 0);
  assert.deepEqual(calls.revalidated, []);
});

test("missing invoices retain the existing not-found result", async () => {
  const { action, calls } = loadAction();
  const result = await action("missing-invoice");
  assert.deepEqual(result, { ok: false, message: "Invoice not found." });
  assert.equal(calls.update.length, 0);
});
