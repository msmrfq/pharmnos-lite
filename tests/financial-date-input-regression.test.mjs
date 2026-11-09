import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

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

const regularTreatment = "Registered Business – Regular";

function purchaseInput(invoiceDate, expiryDate = undefined) {
  return {
    supplier_id: "supplier-1",
    gst_treatment: regularTreatment,
    invoice_date: invoiceDate,
    lines: [{
      product_id: "product-1",
      batch_no: "batch-1",
      quantity: "1",
      purchase_rate: "1",
      ...(expiryDate === undefined ? {} : { expiry_date: expiryDate }),
    }],
  };
}

function salesInput(invoiceDate) {
  return {
    customer_id: "customer-1",
    gst_treatment: regularTreatment,
    place_of_supply_state: "Maharashtra",
    invoice_date: invoiceDate,
    payment_terms_days: "0",
    lines: [{
      product_id: "product-1",
      batch_id: "batch-1",
      batch_no: "batch-1",
      quantity: "1",
      free_qty: "0",
      sale_rate: "1",
    }],
  };
}

function paymentInput(kind, entryDate) {
  return {
    [`${kind}_id`]: `${kind}-1`,
    idempotency_key: "date-input-test",
    amount: "1",
    payment_method: "Cash",
    ...(entryDate === undefined ? {} : { entry_date: entryDate }),
  };
}

const financialSchemas = [
  {
    name: "sales invoice",
    schema: sales.SalesInvoiceCreateSchema,
    input: salesInput,
    field: "invoice_date",
  },
  {
    name: "purchase invoice",
    schema: purchases.PurchaseInvoiceCreateSchema,
    input: purchaseInput,
    field: "invoice_date",
  },
  {
    name: "customer payment",
    schema: sales.CustomerPaymentCreateSchema,
    input: (date) => paymentInput("customer", date),
    field: "entry_date",
  },
  {
    name: "supplier payment",
    schema: sales.SupplierPaymentCreateSchema,
    input: (date) => paymentInput("supplier", date),
    field: "entry_date",
  },
];

if (process.env.FINANCIAL_DATE_INPUT_TZ_CHECK === "1") {
  const parsed = financialSchemas.map(({ schema, input, field }) => {
    const result = schema.safeParse(input("2024-02-29"));
    return {
      success: result.success,
      iso: result.success ? result.data[field].toISOString() : null,
    };
  });
  process.stdout.write(JSON.stringify(parsed));
} else {
  test("financial invoice and payment schemas reject invalid date-only inputs", () => {
    for (const value of [
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-00-01",
      "2026-2-09",
      "2026-11-09T00:00:00Z",
      "13/11/2026",
      " 2026-11-09",
      " ",
    ]) {
      for (const { name, schema, input, field } of financialSchemas) {
        const result = schema.safeParse(input(value));
        assert.equal(result.success, false, `${name} rejects ${JSON.stringify(value)}`);
        if (!result.success) {
          assert.ok(
            result.error.issues.some((issue) => issue.path.includes(field)),
            `${name} reports the ${field} error`,
          );
        }
      }
    }
  });

  test("financial schemas accept canonical dates and leap day with exact round trips", () => {
    for (const { name, schema, input, field } of financialSchemas) {
      for (const [value, expected] of [
        ["2024-02-29", "2024-02-29T00:00:00.000Z"],
        ["2026-11-09", "2026-11-09T00:00:00.000Z"],
      ]) {
        const result = schema.safeParse(input(value));
        assert.equal(result.success, true, `${name} accepts ${value}`);
        if (result.success) {
          assert.equal(result.data[field].toISOString(), expected, `${name} preserves ${value}`);
        }
      }
    }
  });

  test("payment date fields accept blank or omitted dates but reject invalid nonempty dates", () => {
    for (const [name, schema, kind] of [
      ["customer payment", sales.CustomerPaymentCreateSchema, "customer"],
      ["supplier payment", sales.SupplierPaymentCreateSchema, "supplier"],
    ]) {
      for (const entryDate of ["", undefined]) {
        const result = schema.safeParse(paymentInput(kind, entryDate));
        assert.equal(result.success, true, `${name} accepts blank/omitted entry_date`);
        if (result.success) assert.equal(result.data.entry_date, null);
      }

      for (const entryDate of ["not-a-date", "2026-02-29"]) {
        assert.equal(
          schema.safeParse(paymentInput(kind, entryDate)).success,
          false,
          `${name} rejects nonempty invalid entry_date`,
        );
      }
    }
  });

  test("financial schemas reject Date objects rather than interpreting instants", () => {
    for (const { name, schema, input } of financialSchemas) {
      assert.equal(
        schema.safeParse(input(new Date("2026-11-09T00:00:00.000Z"))).success,
        false,
        `${name} requires a date-only string`,
      );
    }
  });

  test("unexpected date adapter errors are rethrown", () => {
    const originalParseBusinessDate = businessDate.parseBusinessDate;
    const unexpected = new Error("unexpected adapter failure");
    businessDate.parseBusinessDate = () => {
      throw unexpected;
    };
    try {
      assert.throws(
        () => purchases.financialDateRequired.parse("2026-11-09"),
        (error) => error === unexpected,
      );
    } finally {
      businessDate.parseBusinessDate = originalParseBusinessDate;
    }
  });

  test("purchase line expiry retains its legacy date parser", () => {
    const result = purchases.PurchaseInvoiceLineCreateSchema.safeParse({
      product_id: "product-1",
      batch_no: "batch-1",
      quantity: "1",
      purchase_rate: "1",
      expiry_date: "13/11/2026",
    });
    assert.equal(result.success, true);
  });

  test("canonical financial dates parse identically across host timezones", () => {
    const expected = financialSchemas.map(() => ({
      success: true,
      iso: "2024-02-29T00:00:00.000Z",
    }));
    for (const timezone of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        env: {
          ...process.env,
          TZ: timezone,
          FINANCIAL_DATE_INPUT_TZ_CHECK: "1",
        },
      });
      assert.equal(result.status, 0, `${timezone} subprocess exits: ${result.stderr}`);
      assert.deepEqual(JSON.parse(result.stdout), expected, `${timezone} parses identically`);
    }
  });
}
