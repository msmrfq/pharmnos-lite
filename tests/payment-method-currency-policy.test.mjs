import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

const treatmentSource = readFileSync(
  new URL("../src/lib/gst/treatment.ts", import.meta.url),
  "utf8",
);
const businessDateSource = readFileSync(
  new URL("../src/lib/utils/business-date.ts", import.meta.url),
  "utf8",
);
const purchasesSource = readFileSync(
  new URL("../src/lib/validation/purchases.schemas.ts", import.meta.url),
  "utf8",
);
const salesSource = readFileSync(
  new URL("../src/lib/validation/sales.schemas.ts", import.meta.url),
  "utf8",
);
const actionsSource = readFileSync(
  new URL("../src/app/_actions/sales.actions.ts", import.meta.url),
  "utf8",
);
const customerFormSource = readFileSync(
  new URL("../src/app/billing/payments/new/_form.tsx", import.meta.url),
  "utf8",
);
const supplierFormSource = readFileSync(
  new URL("../src/app/purchases/payments/new/_form.tsx", import.meta.url),
  "utf8",
);
const prismaSchemaSource = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const runtimeHarnessSource = readFileSync(
  new URL("../scripts/financial-reconciliation-runtime-harness.cjs", import.meta.url),
  "utf8",
);

function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

function loadModule(source, resolve) {
  const module = { exports: {} };
  new Function("require", "module", "exports", transpile(source))(
    resolve,
    module,
    module.exports,
  );
  return module.exports;
}

const treatment = loadModule(treatmentSource, (specifier) => require(specifier));
const businessDate = loadModule(businessDateSource, (specifier) => require(specifier));
const purchases = loadModule(purchasesSource, (specifier) => {
  if (specifier === "@/lib/gst/treatment") return treatment;
  if (specifier === "@/lib/utils/business-date") return businessDate;
  return require(specifier);
});
const sales = loadModule(salesSource, (specifier) => {
  if (specifier === "./purchases.schemas") return purchases;
  if (specifier === "@/lib/gst/treatment") return treatment;
  return require(specifier);
});

const SCHEMAS = [
  ["customer", sales.CustomerPaymentCreateSchema],
  ["supplier", sales.SupplierPaymentCreateSchema],
];

function paymentInput(kind, overrides = {}) {
  return {
    [`${kind}_id`]: `${kind}-1`,
    idempotency_key: `${kind}-payment-key`,
    amount: "125.50",
    payment_method: "Cash",
    ...overrides,
  };
}

function actionBody(name) {
  const start = actionsSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = actionsSource.indexOf("export async function", start + 1);
  return actionsSource.slice(start, next === -1 ? undefined : next);
}

// S-27 — Cheque is an accepted V1 payment method.

test("S-27: Cheque is accepted by both customer and supplier payment schemas", () => {
  for (const [kind, schema] of SCHEMAS) {
    const result = schema.safeParse(paymentInput(kind, { payment_method: "Cheque" }));
    assert.equal(result.success, true, `${kind} Cheque payment must validate`);
    assert.equal(result.data.payment_method, "Cheque");
  }
});

test("S-27: every supported V1 payment method validates consistently", () => {
  for (const method of ["Cash", "UPI", "Cheque", "Bank Transfer", "NEFT"]) {
    for (const [kind, schema] of SCHEMAS) {
      const result = schema.safeParse(paymentInput(kind, { payment_method: method }));
      assert.equal(result.success, true, `${kind} ${method} payment must validate`);
      assert.equal(result.data.payment_method, method);
    }
  }
});

test("S-27: unsupported payment methods stay rejected", () => {
  for (const method of ["Card", "cheque", "CREDIT", "", "BankTransfer"]) {
    for (const [kind, schema] of SCHEMAS) {
      const result = schema.safeParse(paymentInput(kind, { payment_method: method }));
      assert.equal(result.success, false, `${kind} ${method} payment must be rejected`);
      assert.ok(result.error.flatten().fieldErrors.payment_method);
    }
  }
});

test("S-27: both payment forms offer Cheque and the action maps it explicitly", () => {
  for (const source of [customerFormSource, supplierFormSource]) {
    assert.match(source, /const PAYMENT_METHODS = \["Cash", "UPI", "Cheque", "Bank Transfer", "NEFT"\] as const;/);
  }
  assert.match(actionsSource, /if \(method === "Cheque"\) return "CHEQUE";/);
  assert.match(actionsSource, /throw new Error\("Unsupported payment method\."\);/);
  assert.doesNotMatch(actionsSource, /return "CREDIT";/);
});

test("S-27: the disposable runtime harness persists a Cheque payment", () => {
  assert.match(runtimeHarnessSource, /form\.set\("payment_method", "Cheque"\)/);
  assert.match(runtimeHarnessSource, /p\.payment_mode/);
  assert.match(runtimeHarnessSource, /row\?\.payment_mode === "CHEQUE"/);
});

// S-30 — INR only at the trusted validation boundary.

test("S-30: INR is accepted by both payment schemas", () => {
  for (const [kind, schema] of SCHEMAS) {
    for (const currency of ["INR", "inr", " INR "]) {
      const result = schema.safeParse(paymentInput(kind, { currency }));
      assert.equal(result.success, true, `${kind} ${currency} payment must validate`);
      assert.equal(result.data.currency, "INR");
      assert.equal(Number(result.data.amount), 125.5);
    }
  }
});

test("S-30: non-INR currency is rejected before any financial mutation", () => {
  for (const currency of ["USD", "EUR", "GBP", "AED", "US Dollars", "XINR"]) {
    for (const [kind, schema] of SCHEMAS) {
      const result = schema.safeParse(paymentInput(kind, { currency }));
      assert.equal(result.success, false, `${kind} ${currency} payment must be rejected`);
      const messages = result.error.flatten().fieldErrors.currency ?? [];
      assert.ok(
        messages.some((message) => /Only INR payments are supported/.test(message)),
        "rejection must state the INR-only policy",
      );
    }
  }
});

test("S-30: a missing currency follows the approved single-currency contract", () => {
  for (const [kind, schema] of SCHEMAS) {
    const absent = paymentInput(kind);
    assert.equal(Object.hasOwn(absent, "currency"), false);
    for (const input of [absent, paymentInput(kind, { currency: null }), paymentInput(kind, { currency: "" }), paymentInput(kind, { currency: "   " })]) {
      const result = schema.safeParse(input);
      assert.equal(result.success, true, `${kind} missing currency must validate`);
      assert.equal(result.data.currency, undefined);
    }
  }
});

test("S-30: non-string currency values are rejected rather than coerced", () => {
  for (const currency of [123, 1.5, true, ["INR"], { code: "INR" }]) {
    for (const [kind, schema] of SCHEMAS) {
      const result = schema.safeParse(paymentInput(kind, { currency }));
      assert.equal(result.success, false, `${kind} ${JSON.stringify(currency)} must be rejected`);
    }
  }
});

test("S-30: both payment actions validate before opening a transaction", () => {
  for (const [name, schemaName] of [
    ["createCustomerPaymentAction", "CustomerPaymentCreateSchema"],
    ["createSupplierPaymentAction", "SupplierPaymentCreateSchema"],
  ]) {
    const body = actionBody(name);
    const parseIndex = body.indexOf(`${schemaName}.safeParse(payload)`);
    const transactionIndex = body.indexOf("prisma.$transaction");
    assert.notEqual(parseIndex, -1, `${name} must validate through ${schemaName}`);
    assert.notEqual(transactionIndex, -1, `${name} must open a transaction`);
    assert.ok(parseIndex < transactionIndex, `${name} must reject invalid input before mutation`);
    assert.match(body, /if \(!parsed\.success\) \{[\s\S]*?return \{[\s\S]*?ok: false/);
  }
});

test("S-30: no currency is persisted or converted by the payment schema", () => {
  const paymentsModel = prismaSchemaSource.match(/model payments \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(paymentsModel, "payments model must exist");
  assert.doesNotMatch(paymentsModel, /\bcurrency\b/i);
  assert.doesNotMatch(actionsSource, /currency\s*:/);
  assert.match(salesSource, /export const PaymentCurrencySchema = z\.preprocess/);
  assert.match(salesSource, /z\s*\.enum\(\["INR"\]/);
  assert.match(salesSource, /Currency conversion is not available/);
});
