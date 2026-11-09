import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function compile(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function loadModule(compiled, imports = {}) {
  const actionModule = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (name in imports) return imports[name];
      if (name === "node:crypto") return require(name);
      return new Proxy({}, {
        get: (_target, key) => key === "__esModule" ? true : () => undefined,
      });
    },
    actionModule,
    actionModule.exports,
  );
  return actionModule.exports;
}

const decimal = loadModule(compile("../src/lib/decimal.ts"));
const businessDate = loadModule(compile("../src/lib/utils/business-date.ts"));
const financialTemporal = loadModule(
  compile("../src/lib/utils/financial-temporal.ts"),
  { "@/lib/utils/business-date": businessDate },
);
const actionSource = compile("../src/app/_actions/sales.actions.ts");

function legacyPayment(kind, overrides = {}) {
  const paymentDate = new Date("2026-11-07T00:00:00.000Z");
  const hash = createHash("sha256").update(JSON.stringify({
    operation: "CREATE_PAYMENT",
    tenantId: "tenant-1",
    counterpartyType: kind,
    counterpartyId: `${kind}-1`,
    amount: "100",
    paymentMethod: "Cash",
    referenceNo: null,
    entryDate: paymentDate.toISOString(),
    notes: null,
  })).digest("hex");
  return {
    id: "payment-1",
    amount: 100,
    payment_date: paymentDate,
    effective_date: null,
    effective_date_basis: null,
    request_payload_hash: hash,
    ...overrides,
  };
}

function currentPayment(kind, supplied) {
  const payment = legacyPayment(kind);
  const effectiveDate = new Date("2026-11-07T00:00:00.000Z");
  return {
    ...payment,
    effective_date: effectiveDate,
    effective_date_basis: supplied ? "EXPLICIT" : "DERIVED_FROM_OCCURRED_AT",
    request_payload_hash: createHash("sha256").update(JSON.stringify({
      version: 2,
      operation: "CREATE_PAYMENT",
      tenantId: "tenant-1",
      counterpartyType: kind,
      counterpartyId: `${kind}-1`,
      amount: "100",
      paymentMethod: "Cash",
      referenceNo: null,
      entryDate: effectiveDate.toISOString(),
      entryDateWasSupplied: supplied,
      notes: null,
    })).digest("hex"),
  };
}

function setup(kind, path, payment) {
  class KnownRequestError extends Error {
    constructor() {
      super("unique conflict");
      this.code = "P2002";
      this.meta = { target: ["tenant_id", "idempotency_key"] };
    }
  }
  const calls = { lookups: [], writes: 0, permissions: 0, transactions: 0 };
  let lookupCount = 0;
  const tx = {
    payments: {
      findUnique: async (args) => {
        calls.lookups.push(args);
        lookupCount++;
        if (path === "initial") return payment;
        if (path === "locked") return lookupCount === 1 ? null : payment;
        return lookupCount <= 2 ? null : payment;
      },
      create: async () => {
        if (path === "p2002") throw new KnownRequestError();
        calls.writes++;
        throw new Error("Unexpected payment write");
      },
    },
    $queryRaw: async () => [{ receivable_balance: 200, payable_balance: 200 }],
  };
  const prisma = {
    $transaction: async (work) => {
      calls.transactions++;
      return work(tx);
    },
  };
  const schema = {
    safeParse: (input) => ({
      success: true,
      data: {
        ...input,
        amount: Number(input.amount),
        reference_no: input.reference_no || null,
        notes: input.notes || null,
      },
    }),
  };
  const actions = loadModule(actionSource, {
    "@/lib/db/prisma": { prisma, assertPostgresConfigured: () => {} },
    "@/lib/db/tenant-context": {
      establishTenantContext: async () => {},
      requirePermission: () => { calls.permissions++; },
      requireServerTenantContext: async () => ({ tenantId: "tenant-1", userId: "user-1" }),
    },
    "@/lib/validation/sales.schemas": {
      CustomerPaymentCreateSchema: schema,
      SupplierPaymentCreateSchema: schema,
    },
    "@/lib/decimal": decimal,
    "@/lib/utils/business-date": businessDate,
    "@/lib/utils/financial-temporal": financialTemporal,
    "@/repositories/payment.repository": { allocatePaymentReceiptNo: async () => "receipt-1" },
    "@prisma/client": {
      Prisma: { PrismaClientKnownRequestError: KnownRequestError, sql: () => ({}) },
      PermissionAction: { create_payment: "create_payment" },
    },
    "next/cache.js": { revalidatePath: () => {} },
  });
  return { action: actions[kind === "customer" ? "createCustomerPaymentAction" : "createSupplierPaymentAction"], calls };
}

function form(kind, date, extra = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    [`${kind}_id`]: `${kind}-1`,
    idempotency_key: "same-key",
    amount: "100",
    payment_method: "Cash",
    ...extra,
  })) data.set(key, value);
  if (date !== undefined) data.set("entry_date", date);
  return data;
}

for (const kind of ["customer", "supplier"]) {
  for (const path of ["initial", "locked", "p2002"]) {
    test(`${kind} ${path}: legacy explicit date cannot replay as omitted`, async () => {
      const { action, calls } = setup(kind, path, legacyPayment(kind));
      const result = await action({}, form(kind));
      assert.equal(result.ok, false);
      assert.match(result.message, /date-source provenance/);
      assert.equal(calls.permissions, 1);
      assert.equal(calls.writes, 0);
      assert.equal(calls.lookups.length, path === "initial" ? 1 : path === "locked" ? 2 : 3);
      assert.ok(calls.lookups.every((lookup) =>
        lookup.where.tenant_id_idempotency_key.tenant_id === "tenant-1"));
    });

    test(`${kind} ${path}: legacy omitted instant at midnight cannot replay as explicit`, async () => {
      for (const [date, extra] of [
        ["2026-11-07", {}],
        ["2026-11-08", {}],
        ["2026-11-07", { amount: "101" }],
      ]) {
        const { action, calls } = setup(kind, path, legacyPayment(kind));
        const result = await action({}, form(kind, date, extra));
        assert.equal(result.ok, false);
        assert.match(result.message, /date-source provenance/);
        assert.equal(calls.writes, 0);
      }
    });

    test(`${kind} ${path}: current hashes preserve omitted and explicit date provenance`, async () => {
      for (const [supplied, retryDate, extra, expected] of [
        [false, undefined, {}, true],
        [false, "2026-11-07", {}, false],
        [false, undefined, { amount: "101" }, false],
        [true, "2026-11-07", {}, true],
        [true, undefined, {}, false],
        [true, "2026-11-08", {}, false],
      ]) {
        const { action, calls } = setup(kind, path, currentPayment(kind, supplied));
        const result = await action({}, form(kind, retryDate, extra));
        assert.equal(result.ok, expected);
        if (expected) assert.equal(result.data.id, "payment-1");
        else assert.match(result.message, /different payment payload/);
        assert.equal(calls.writes, 0);
      }
    });
  }
}
