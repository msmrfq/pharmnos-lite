import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path, require) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(require, module, module.exports);
  return module.exports;
}

const decimal = load("../src/lib/decimal.ts", () => { throw new Error("Unexpected decimal dependency"); });
class BaseRepository {
  constructor(prisma) { this.prisma = prisma; }
  withTenant(ctx) { return { tenantId: ctx.tenantId }; }
}
const { PaymentRepository } = load("../src/repositories/payment.repository.ts", (name) => {
  if (name === "@/lib/decimal") return decimal;
  if (name === "@/lib/db/base-repository") return { BaseRepository };
  if (name === "@prisma/client") return {};
  throw new Error(`Unexpected dependency ${name}`);
});

for (const [kind, method, partyKey] of [
  ["customer", "listCustomerUnappliedCredits", "customer_id"],
  ["supplier", "listSupplierUnappliedAdvances", "supplier_id"],
]) {
  test(`${kind} unapplied balances preserve unknown dates and exact amounts`, async () => {
    const calls = [];
    const marker = new Date("2026-11-09T00:00:00.000Z");
    const rows = [
      { id: "p1", amount: "100.00", effective_date: marker, reference_no: null, allocations: [{ amount: "20.00", reversal: [] }], refunds: [{ amount: "10.00" }], reversals: [] },
      { id: "p2", amount: "25.00", effective_date: null, reference_no: null, allocations: [], refunds: [], reversals: [] },
    ];
    const repo = new PaymentRepository({ payments: { findMany: async (args) => { calls.push(args); return rows; } } });
    const result = await repo[method]("party", { tenantId: "tenant" });
    assert.deepEqual(result.map((row) => row.paymentDate), [marker, null]);
    assert.deepEqual(result.map((row) => row.unappliedAmount), [70, 25]);
    assert.equal(calls[0].where.tenant_id, "tenant");
    assert.equal(calls[0].where[partyKey], "party");
    assert.equal(calls[0].select.effective_date, true);
    assert.deepEqual(calls[0].orderBy, [{ effective_date: "asc" }, { id: "asc" }]);
  });
}
