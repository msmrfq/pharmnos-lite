import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

function walk(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(name)) files.push(path);
  }
  return files;
}

const sourceFiles = walk(join(root, "src")).map((path) => ({
  path: relative(root, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

// Returns the text of every `<table>.create(...)` call, with balanced parentheses.
function createCalls(text, tables) {
  const pattern = new RegExp(`\\b(${tables.join("|")})\\.create\\(`, "g");
  const calls = [];
  for (const match of text.matchAll(pattern)) {
    let depth = 0;
    let index = match.index + match[0].length - 1;
    const start = index;
    for (; index < text.length; index += 1) {
      if (text[index] === "(") depth += 1;
      if (text[index] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push({ table: match[1], body: text.slice(start, index + 1), offset: match.index });
  }
  return calls;
}

const FINANCIAL_TABLES = ["customer_ledgers", "supplier_ledgers", "payments"];
const TYPED_MAPPER = /ledgerTemporalFields\(|paymentTemporalFields\(|\.\.\.operationDate\.ledger\b/;

const sites = sourceFiles.flatMap((file) =>
  createCalls(file.text, FINANCIAL_TABLES).map((call) => ({ ...call, file: file.path })));

test("every customer_ledgers/supplier_ledgers/payments create site is enumerated", () => {
  const counts = {};
  for (const site of sites) {
    const key = `${site.file}::${site.table}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  assert.deepEqual(counts, {
    "src/app/_actions/masters.actions.ts::customer_ledgers": 1,
    "src/app/_actions/masters.actions.ts::supplier_ledgers": 1,
    "src/app/_actions/purchases.actions.ts::supplier_ledgers": 1,
    "src/app/_actions/sales.actions.ts::customer_ledgers": 2,
    "src/app/_actions/sales.actions.ts::payments": 2,
    "src/app/_actions/sales.actions.ts::supplier_ledgers": 1,
    "src/domain/services/financial-reconciliation.service.ts::customer_ledgers": 2,
    "src/domain/services/financial-reconciliation.service.ts::supplier_ledgers": 2,
    "src/domain/services/ledger-impact.service.ts::customer_ledgers": 1,
    "src/domain/services/ledger-impact.service.ts::supplier_ledgers": 1,
  });
});

test("every financial row create derives its dates from the typed temporal mappers", () => {
  for (const site of sites) {
    const label = `${site.file} ${site.table}.create @${site.offset}`;
    const data = site.body.split(/\bselect:/)[0];
    assert.match(data, TYPED_MAPPER, `${label} must use the typed temporal mappers`);
    assert.doesNotMatch(data, /\b(entry_date|payment_date|effective_date|effective_date_basis|occurred_at)\s*:/,
      `${label} must not set date columns by hand`);
    assert.doesNotMatch(data, /new Date\(/, `${label} must not build a date from a raw new Date(`);
    assert.doesNotMatch(data, /\b\w*recorded_at\b/, `${label} must leave recorded_at to the database trigger`);
  }
});

test("a payment and its ledger row share one resolved temporal fact", () => {
  const sales = read("src/app/_actions/sales.actions.ts");
  for (const [table, ledgerTable] of [["payments", "customer_ledgers"], ["payments", "supplier_ledgers"]]) {
    const payment = createCalls(sales, [table]);
    const ledger = createCalls(sales, [ledgerTable]).filter((call) => /payment_(received|made)/.test(call.body));
    assert.ok(payment.length >= 2 && ledger.length >= 1);
  }
  for (const action of ["createCustomerPaymentAction", "createSupplierPaymentAction"]) {
    const start = sales.indexOf(`export async function ${action}`);
    const body = sales.slice(start, sales.indexOf("export async function", start + 10));
    assert.equal((body.match(/captureSystemInstant\(\)/g) ?? []).length, 1, `${action} captures one instant`);
    assert.equal((body.match(/resolvePaymentTemporal\(/g) ?? []).length, 1);
    assert.equal((body.match(/paymentTemporalFields\(temporal\)/g) ?? []).length, 1);
    assert.equal((body.match(/ledgerTemporalFields\(temporal\)/g) ?? []).length, 1);
  }
});

test("producers contain no ad-hoc business-date derivation from an instant", () => {
  for (const path of [
    "src/app/_actions/sales.actions.ts",
    "src/app/_actions/purchases.actions.ts",
    "src/app/_actions/masters.actions.ts",
    "src/domain/services/financial-reconciliation.service.ts",
    "src/domain/services/ledger-impact.service.ts",
  ]) {
    const text = read(path);
    assert.doesNotMatch(text, /businessDateToday\(/, `${path} must use resolveFinancialTemporal`);
    assert.doesNotMatch(text, /businessDateToPrismaDate\(businessDateFromPrismaDate\(existing\.effective_date\)\)/);
    assert.doesNotMatch(text, /\b\w*recorded_at\s*:/, `${path} must not assign recorded_at`);
  }
  const reconciliation = read("src/domain/services/financial-reconciliation.service.ts");
  assert.doesNotMatch(reconciliation, /new Date\(/);
  assert.match(reconciliation, /resolveFinancialTemporal\(\{ occurredAt: captureSystemInstant\(\) \}\)/);
});

test("repository create() cannot write financial rows with ad-hoc dates", () => {
  const ledger = read("src/repositories/ledger.repository.ts");
  const payments = read("src/repositories/payment.repository.ts");
  for (const [text, label] of [[ledger, "ledger"], [payments, "payment"]]) {
    const creates = [...text.matchAll(/async create\(([\s\S]*?)\n  \}/g)];
    assert.ok(creates.length >= 1, `${label} repository declares create()`);
    for (const [block] of creates) {
      assert.match(block, /throw new Error\(/);
      assert.doesNotMatch(block, /this\.prisma\./);
    }
  }
  assert.equal([...ledger.matchAll(/async create\(/g)].length, 2);
  assert.equal(sites.some((site) => /repositories\//.test(site.file)), false);
  for (const file of sourceFiles) {
    assert.doesNotMatch(
      file.text,
      /\brepos?\.(customerLedgers|supplierLedgers|payments)\.create\(/,
      `${file.path} must not call a financial repository create()`,
    );
  }
});

test("ledger-impact wrappers and inputs have no bare Date parameters", () => {
  const path = "src/domain/services/ledger-impact.service.ts";
  const text = read(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const bareDate = (node) =>
    node && ts.isTypeReferenceNode(node) && node.typeName.getText(file) === "Date";
  const offenders = [];
  const visit = (node) => {
    if (ts.isParameter(node) && bareDate(node.type)) {
      offenders.push(node.getText(file));
    }
    if (ts.isPropertySignature(node) && ts.isTypeLiteralNode(node.parent) &&
        ts.isTypeAliasDeclaration(node.parent.parent) && /Input$/.test(node.parent.parent.name.text) &&
        (bareDate(node.type) || node.name.getText(file) === "entry_date")) {
      offenders.push(`${node.parent.parent.name.text}.${node.name.getText(file)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.deepEqual(offenders, []);

  for (const name of ["CustomerLedgerImpactInput", "SupplierLedgerImpactInput"]) {
    const declaration = file.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === name);
    assert.ok(declaration, `${name} exists`);
    const property = declaration.type.members.find((member) => member.name.getText(file) === "temporal");
    assert.ok(property, `${name} requires temporal`);
    assert.equal(property.questionToken, undefined, `${name}.temporal must be required`);
    assert.equal(property.type.getText(file), "FinancialTemporalInput");
  }

  const service = file.statements.find((node) => ts.isClassDeclaration(node) && node.name?.text === "LedgerImpactService");
  const wrappers = service.members.filter((member) =>
    ts.isMethodDeclaration(member) &&
    ["finalizeCustomerInvoice", "finalizePurchaseInvoice", "customerPaymentReceived", "supplierPaymentMade"]
      .includes(member.name.getText(file)));
  assert.equal(wrappers.length, 4);
  for (const wrapper of wrappers) {
    const typed = wrapper.parameters.filter((parameter) =>
      /^(invoiceDate|paymentDate)$/.test(parameter.name.getText(file)));
    assert.equal(typed.length, 1);
    assert.match(typed[0].type.getText(file), /^(InvoiceBusinessDateInput|FinancialTemporalInput)$/);
  }
  assert.doesNotMatch(text, /new Date\(/);
  assert.doesNotMatch(text, /entry_date:\s*\{/);
});

test("the generic ledger balance never reads or orders by the legacy entry_date", () => {
  const text = read("src/domain/services/ledger-impact.service.ts");
  assert.doesNotMatch(text, /entry_date:\s*\{\s*lte/);
  assert.doesNotMatch(text, /orderBy:[^\n]*entry_date/);
  assert.match(text, /FOR UPDATE/);
  assert.match(text, /establishTenantContext\(tx, ctx\)/);
});

test("rule and GST resolution use the typed effective date and fail closed when it is null", () => {
  const sales = read("src/app/_actions/sales.actions.ts");
  const purchases = read("src/app/_actions/purchases.actions.ts");
  for (const [label, text] of [["sales", sales], ["purchases", purchases]]) {
    const calls = [...text.matchAll(/resolve(?:Sales|Purchase)LineRules\(tx, ctx\.tenantId, [^)]*\)/g)]
      .map((match) => match[0]);
    assert.ok(calls.length >= 2, `${label} rule resolution calls found`);
    for (const call of calls) {
      assert.doesNotMatch(call, /\b(existing|purchase|created)\.invoice_date\)/, `${label}: ${call} must not use the legacy invoice_date of a stored draft`);
    }
  }
  assert.match(purchases, /requirePurchaseEffectiveDate\(purchase\.effective_date\)/);
  assert.match(purchases, /requirePurchaseEffectiveDate\(existing\.effective_date\)/);
  assert.match(purchases, /if \(!effectiveDate\) \{\s*throw new Error\("Purchase business dates are unclassified/);
  assert.match(sales, /resolveSalesLineRules\(tx, ctx\.tenantId, items, invoiceTemporal\.effectiveDate\)/);
});

