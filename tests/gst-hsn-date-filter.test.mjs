import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [datesSource, decimalSource, completenessSource, filterSource, actionsSource, pageSource] = await Promise.all([
  read("../src/lib/utils/business-date.ts"),
  read("../src/lib/decimal.ts"),
  read("../src/domain/services/financial-report-completeness.ts"),
  read("../src/domain/services/gst-hsn-date-filter.ts"),
  read("../src/app/_actions/exports.actions.ts"),
  read("../src/app/reports/gst-hsn-summary/page.tsx"),
]);

function compile(sourceText, require = () => ({})) {
  const module = { exports: {} };
  const js = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require, Date, Intl, Set, Map, Response, URL, RangeError, Error });
  return module.exports;
}

const dates = compile(datesSource);
const decimal = compile(decimalSource);
const completeness = compile(completenessSource, (name) => {
  if (name === "@/lib/utils/business-date") return dates;
  if (name === "@/lib/decimal") return decimal;
  throw new Error(`Unexpected import: ${name}`);
});
const hsn = compile(filterSource, (name) => {
  if (name === "@/lib/utils/business-date") return dates;
  if (name === "@/lib/decimal") return decimal;
  if (name === "@/domain/services/financial-report-completeness") return completeness;
  throw new Error(`Unexpected import: ${name}`);
});

const day = (value) => new Date(`${value}T00:00:00.000Z`);
const noon = (iso) => new Date(iso);

function item(overrides = {}) {
  return {
    hsn_code_snapshot: "3004", product_name_snapshot: "Paracetamol", gst_rate: "12", gst_amount: "12.00",
    taxable_amount: "100.00", line_total: "112.00", cgst_amount: "6.00", sgst_amount: "6.00", igst_amount: "0.00",
    quantity: 10, free_qty: 1, ...overrides,
  };
}
function invoice(id, effective, overrides = {}) {
  return {
    id, tenant_id: "tenant-a", status: "FINALIZED", effective_date: effective === null ? null : day(effective),
    invoice_date: day("2001-01-01"), customer_gstin_snapshot: "27ABCDE1234F1Z5", items: [item()], ...overrides,
  };
}

function matchesDate(value, condition) {
  if (condition === null) return value === null;
  if (value === null) return false;
  return (!condition.gte || value >= condition.gte) && (!condition.lte || value <= condition.lte);
}
function makeDb(rows) {
  const calls = [];
  return {
    calls,
    sales_invoices: {
      async findMany(args) {
        calls.push(args);
        assert.ok(!("invoice_date" in args.where), "legacy invoice_date must not be a filter");
        const selected = rows.filter((row) => row.tenant_id === args.where.tenant_id && row.status === args.where.status &&
          matchesDate(row.effective_date, args.where.effective_date));
        const order = args.orderBy ?? [];
        selected.sort((a, b) => {
          for (const spec of order) {
            const [[key, dir]] = Object.entries(spec);
            const av = a[key] instanceof Date ? a[key].getTime() : a[key];
            const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
            if (av < bv) return dir === "asc" ? -1 : 1;
            if (av > bv) return dir === "asc" ? 1 : -1;
          }
          return 0;
        });
        return selected.slice(0, args.take);
      },
    },
  };
}

function errorOf(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

test("dates are validated strictly before any query", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-1", " 2026-11-09", "2026-11-09 ", "2026-11-09T00:00:00Z",
    "09/11/2026", "0000-01-01", "2027-02-29", 20261109, null, {}, ["2026-11-09"]]) {
    for (const field of ["from", "to"]) {
      const error = errorOf(() => hsn.parseHsnFilter({ from: "2026-11-01", to: "2026-11-30", [field]: bad }));
      assert.ok(error, `${field}=${JSON.stringify(bad)} must be rejected`);
      assert.equal(error.code, "INVALID_INPUT");
      assert.match(error.message, /Business date must be a valid date/);
    }
  }
  assert.match(errorOf(() => hsn.parseHsnFilter({ from: "2026-11-10", to: "2026-11-09" })).message, /from date is after the to date/);
  assert.match(errorOf(() => hsn.parseHsnFilter({ party: "everyone" })).message, /counterparty/);
  assert.match(errorOf(() => hsn.parseHsnFilter({ q: "x".repeat(201) })).message, /search text/);
  assert.match(errorOf(() => hsn.parseHsnFilter(null)).message, /Invalid report request/);
  assert.equal(hsn.parseHsnFilter({ from: "2028-02-29", to: "2028-02-29" }).from, "2028-02-29");
});

test("default period is the current Asia/Kolkata month, including month, year and leap boundaries", () => {
  const cases = [
    ["2026-10-31T19:00:00.000Z", "2026-11-01", "2026-11-30"], // 00:30 IST on 1 Nov, still 31 Oct UTC
    ["2026-11-30T18:29:59.999Z", "2026-11-01", "2026-11-30"],
    ["2026-11-30T18:30:00.000Z", "2026-12-01", "2026-12-31"],
    ["2026-12-31T18:30:00.000Z", "2027-01-01", "2027-01-31"],
    ["2028-02-10T05:00:00.000Z", "2028-02-01", "2028-02-29"],
    ["2027-02-10T05:00:00.000Z", "2027-02-01", "2027-02-28"],
    ["2100-02-10T05:00:00.000Z", "2100-02-01", "2100-02-28"],
    ["2026-02-28T18:30:00.000Z", "2026-03-01", "2026-03-31"],
  ];
  for (const [instant, from, to] of cases) {
    const bounds = hsn.currentBusinessMonthBounds(noon(instant));
    assert.deepEqual({ from: bounds.from, to: bounds.to }, { from, to }, instant);
    const filter = hsn.parseHsnFilter({}, noon(instant));
    assert.deepEqual({ from: filter.from, to: filter.to }, { from, to }, instant);
  }
  const partial = hsn.parseHsnFilter({ from: "", to: "2026-11-15" }, noon("2026-11-20T00:00:00.000Z"));
  assert.deepEqual({ from: partial.from, to: partial.to }, { from: "2026-11-01", to: "2026-11-15" });
});

test("default month bounds are identical in every host timezone", () => {
  const script = `
    import { readFileSync } from "node:fs";
    import vm from "node:vm";
    import ts from "typescript";
    const load = (path, req) => {
      const module = { exports: {} };
      const js = ts.transpileModule(readFileSync(new URL(path), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      vm.runInNewContext(js, { module, exports: module.exports, require: req, Date, Intl, RangeError });
      return module.exports;
    };
    const dates = load(process.env.DATES, () => ({}));
    const decimal = load(process.env.DECIMAL, () => ({}));
    const completeness = load(process.env.COMPLETENESS, (n) => n === "@/lib/decimal" ? decimal : dates);
    const hsn = load(process.env.FILTER, (n) => n === "@/lib/decimal" ? decimal : n === "@/domain/services/financial-report-completeness" ? completeness : dates);
    const out = ["2026-10-31T19:00:00.000Z", "2026-11-30T18:30:00.000Z", "2028-02-10T05:00:00.000Z"].map((i) => hsn.currentBusinessMonthBounds(new Date(i)));
    process.stdout.write(JSON.stringify(out));
  `;
  const run = (TZ) => JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    env: {
      ...process.env, TZ,
      DATES: new URL("../src/lib/utils/business-date.ts", import.meta.url).href,
      DECIMAL: new URL("../src/lib/decimal.ts", import.meta.url).href,
      COMPLETENESS: new URL("../src/domain/services/financial-report-completeness.ts", import.meta.url).href,
      FILTER: new URL("../src/domain/services/gst-hsn-date-filter.ts", import.meta.url).href,
    },
    encoding: "utf8", cwd: new URL("..", import.meta.url),
  }));
  const baseline = run("Asia/Kolkata");
  assert.deepEqual(baseline[0], { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(run("UTC"), baseline);
  assert.deepEqual(run("America/Los_Angeles"), baseline);
});

test("where clauses use inclusive DATE-marker bounds on effective_date, the tenant and FINALIZED status", () => {
  const where = hsn.hsnClassifiedWhere("tenant-a", { from: "2026-11-01", to: "2026-11-30" });
  assert.equal(where.tenant_id, "tenant-a");
  assert.equal(where.status, "FINALIZED");
  assert.deepEqual(Object.keys(where.effective_date), ["gte", "lte"]);
  assert.equal(where.effective_date.gte.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(where.effective_date.lte.toISOString(), "2026-11-30T00:00:00.000Z", "end is the end date marker, not +86399999");
  assert.equal("invoice_date" in where, false);
  assert.deepEqual({ ...hsn.hsnUnclassifiedWhere("tenant-a") }, { tenant_id: "tenant-a", status: "FINALIZED", effective_date: null });
});

test("inclusive endpoints, month, year and leap boundaries select exactly the right invoices", async () => {
  const rows = [
    invoice("oct-31", "2026-10-31"), invoice("nov-01", "2026-11-01"), invoice("nov-15", "2026-11-15"),
    invoice("nov-30", "2026-11-30"), invoice("dec-01", "2026-12-01"),
    invoice("dec-31", "2026-12-31"), invoice("jan-01", "2027-01-01"),
    invoice("feb-28", "2028-02-28"), invoice("feb-29", "2028-02-29"), invoice("mar-01", "2028-03-01"),
  ];
  const ids = async (from, to) =>
    Array.from((await hsn.loadHsnInvoices(makeDb(rows), "tenant-a", hsn.parseHsnFilter({ from, to }))).invoices, (i) => i.id);
  assert.deepEqual(await ids("2026-11-01", "2026-11-30"), ["nov-01", "nov-15", "nov-30"]);
  assert.deepEqual(await ids("2026-11-30", "2026-11-30"), ["nov-30"]);
  assert.deepEqual(await ids("2026-12-01", "2026-12-31"), ["dec-01", "dec-31"]);
  assert.deepEqual(await ids("2026-12-31", "2027-01-01"), ["dec-31", "jan-01"]);
  assert.deepEqual(await ids("2028-02-01", "2028-02-29"), ["feb-28", "feb-29"]);
  assert.deepEqual(await ids("2026-01-01", "2026-12-31"), ["oct-31", "nov-01", "nov-15", "nov-30", "dec-01", "dec-31"]);
});

test("legacy invoice_date never decides placement; ordering is deterministic", async () => {
  const rows = [
    invoice("b", "2026-11-09", { invoice_date: day("2025-01-01") }),
    invoice("a", "2026-11-09", { invoice_date: day("2030-01-01") }),
    invoice("c", "2026-11-08", { invoice_date: day("2030-01-01") }),
  ];
  const result = await hsn.loadHsnInvoices(makeDb(rows), "tenant-a", hsn.parseHsnFilter({ from: "2026-11-08", to: "2026-11-09" }));
  assert.deepEqual(Array.from(result.invoices, (i) => i.id), ["c", "a", "b"]);
});

test("NULL-effective finalized invoices are excluded and disclosed with exact amounts", async () => {
  const rows = [
    invoice("dated", "2026-11-09"),
    invoice("u1", null, { items: [item({ taxable_amount: "0.10", gst_amount: "0.01" }), item({ taxable_amount: "0.20", gst_amount: "0.02" })] }),
    invoice("u2", null, { items: [item({ taxable_amount: "90071992547409.99", gst_amount: "0.01" })] }),
    invoice("u3", null, { items: [item({ taxable_amount: null, gst_amount: "5.00", line_total: "105.00" })] }),
    invoice("draft", null, { status: "DRAFT" }),
    invoice("other-tenant", null, { tenant_id: "tenant-b" }),
  ];
  const result = await hsn.loadHsnInvoices(makeDb(rows), "tenant-a", hsn.parseHsnFilter({ from: "2026-11-01", to: "2026-11-30" }));
  assert.deepEqual(Array.from(result.invoices, (i) => i.id), ["dated"]);
  assert.deepEqual({ ...result.exclusions }, {
    count: 3, taxable: "90071992547510.29", gst: "5.04", total: "90071992547515.33",
  });
  assert.equal(
    hsn.hsnExclusionNotice(result.exclusions),
    "3 invoices excluded \u2014 date not classified (taxable INR 90071992547510.29, tax INR 5.04, total INR 90071992547515.33)",
  );
  assert.equal(hsn.hsnExclusionNotice({ count: 1, taxable: "1.00", gst: "0.00", total: "1.00" }).startsWith("1 invoice excluded"), true);
  assert.equal(hsn.hsnExclusionNotice({ count: 0, taxable: "0.00", gst: "0.00", total: "0.00" }), null);
});

test("party and search filters scope the disclosed exclusions the same way as the rows", async () => {
  const rows = [
    invoice("b2b", null, { items: [item({ taxable_amount: "10.00", gst_amount: "1.00" })] }),
    invoice("retail", null, { customer_gstin_snapshot: "  ", items: [item({ taxable_amount: "20.00", gst_amount: "2.00", hsn_code_snapshot: "3005" })] }),
    invoice("retail-null", null, { customer_gstin_snapshot: null, items: [item({ taxable_amount: "30.00", gst_amount: "3.00" })] }),
  ];
  const summary = async (input) =>
    ({ ...(await hsn.loadHsnInvoices(makeDb(rows), "tenant-a", hsn.parseHsnFilter(input))).exclusions });
  assert.deepEqual(await summary({}), { count: 3, taxable: "60.00", gst: "6.00", total: "66.00" });
  assert.deepEqual(await summary({ party: "b2b" }), { count: 1, taxable: "10.00", gst: "1.00", total: "11.00" });
  assert.deepEqual(await summary({ party: "unregistered" }), { count: 2, taxable: "50.00", gst: "5.00", total: "55.00" });
  assert.deepEqual(await summary({ q: "3005" }), { count: 1, taxable: "20.00", gst: "2.00", total: "22.00" });
});

test("fails closed instead of truncating beyond the row limit", async () => {
  const rows = Array.from({ length: 25001 }, (_, i) => invoice(`u${String(i).padStart(5, "0")}`, null, { items: [] }));
  await assert.rejects(
    hsn.loadHsnInvoices(makeDb(rows), "tenant-a", hsn.parseHsnFilter({ from: "2026-11-01", to: "2026-11-30" })),
    (error) => error.code === "ROW_LIMIT",
  );
});

test("every query is tenant scoped and ordered deterministically", async () => {
  const db = makeDb([invoice("x", "2026-11-09")]);
  await hsn.loadHsnInvoices(db, "tenant-a", hsn.parseHsnFilter({ from: "2026-11-01", to: "2026-11-30" }));
  assert.equal(db.calls.length, 2);
  for (const call of db.calls) {
    assert.equal(call.where.tenant_id, "tenant-a");
    assert.equal(call.where.status, "FINALIZED");
    assert.deepEqual(Array.from(call.orderBy.at(-1)), ["id"].length ? Array.from(call.orderBy.at(-1)) : []);
    assert.deepEqual({ ...call.orderBy.at(-1) }, { id: "asc" });
  }
});

function actionHarness(rows, permissions = ["view_reports"]) {
  const db = makeDb(rows);
  let transactions = 0;
  let established = 0;
  const ctx = { tenantId: "tenant-a", permissions };
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, "RepeatableRead");
      transactions += 1;
      return fn(db);
    },
  };
  const action = compile(actionsSource, (name) => {
    if (name === "@/lib/db/prisma") return { prisma, assertPostgresConfigured() {} };
    if (name === "@/repositories") return { repos: {} };
    if (name === "@/lib/db/tenant-context") return {
      requireServerTenantContext: async () => ctx,
      establishTenantContext: async (given, active) => { assert.equal(given, db); assert.equal(active, ctx); established += 1; },
      requirePermission: (active, permission) => { if (!active.permissions.includes(permission)) throw new Error("forbidden"); },
    };
    if (name === "@prisma/client") return {
      Prisma: { TransactionIsolationLevel: { RepeatableRead: "RepeatableRead" } },
      PermissionAction: new Proxy({}, { get: (_target, key) => key }),
    };
    if (name === "@/lib/utils/business-date") return dates;
    if (name === "@/lib/decimal") return decimal;
    if (name === "@/domain/services/financial-report-completeness") return completeness;
    if (name === "@/domain/services/gst-hsn-date-filter") return hsn;
    throw new Error(`Unexpected import: ${name}`);
  });
  return { action, db, counts: () => ({ transactions, established }) };
}

const csvRows = (csv) => csv.replace(/^\uFEFF/, "").split("\n");

test("the CSV applies the same filter, qualifies for excluded invoices and discloses the exact exclusion", async () => {
  const { action, db, counts } = actionHarness([
    invoice("in", "2026-11-30"),
    invoice("before", "2026-10-31"),
    invoice("after", "2026-12-01"),
    invoice("legacy", null, { items: [item({ taxable_amount: "250.00", gst_amount: "30.00" })] }),
  ]);
  const result = await action.exportGstHsnSummaryCsvAction({ from: "2026-11-01", to: "2026-11-30" });
  assert.equal(result.ok, true);
  assert.equal(result.filename, "gst-hsn-summary-2026-11-01-2026-11-30-qualified.csv");
  assert.deepEqual(counts(), { transactions: 1, established: 1 });
  for (const call of db.calls) assert.equal(call.where.tenant_id, "tenant-a");
  const lines = csvRows(result.csv);
  assert.ok(lines.includes("INCOMPLETE \u2014 qualified report, not a complete GST HSN summary"));
  assert.ok(lines.some((l) => l.startsWith("1 invoice excluded \u2014 date not classified (taxable INR 250.00, tax INR 30.00, total INR 280.00)")));
  assert.ok(lines.includes("Excluded total INR,280.00"));
  const data = lines.slice(lines.findIndex((l) => l.startsWith("HSN,")) + 1);
  assert.deepEqual(data, ["3004,Paracetamol,12.00,11,100.00,6.00,6.00,0.00,12.00,1,112.00"]);
});

test("a fully classified period yields an unqualified CSV with an explicit coverage line", async () => {
  const { action } = actionHarness([invoice("in", "2026-11-09")]);
  const result = await action.exportGstHsnSummaryCsvAction({ from: "2026-11-09", to: "2026-11-09", party: "b2b", q: "para" });
  assert.equal(result.ok, true);
  assert.equal(result.filename, "gst-hsn-summary-2026-11-09-2026-11-09.csv");
  const lines = csvRows(result.csv);
  assert.ok(lines.includes("Date coverage,All finalized invoices in scope are date-classified"));
  assert.ok(!lines.some((l) => l.includes("INCOMPLETE")));
  assert.ok(lines.includes("Search,para"));
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("invalid dates return an unavailable result before any query or transaction", async () => {
  const { action, db, counts } = actionHarness([invoice("in", "2026-11-09")]);
  for (const input of [{ from: "2026-02-30" }, { to: "tomorrow" }, { from: "2026-11-10", to: "2026-11-09" }, { party: "x" }]) {
    const result = await action.exportGstHsnSummaryCsvAction(input);
    assert.equal(result.ok, false);
    assert.equal(typeof result.reason, "string");
  }
  assert.equal(db.calls.length, 0);
  assert.deepEqual(counts(), { transactions: 0, established: 0 });
});

test("the CSV still requires view_reports before touching data", async () => {
  const { action, db } = actionHarness([invoice("in", "2026-11-09")], ["view_inventory"]);
  await assert.rejects(action.exportGstHsnSummaryCsvAction({ from: "2026-11-09", to: "2026-11-09" }), /forbidden/);
  assert.equal(db.calls.length, 0);
});

test("page and CSV share one filter helper and neither uses host-local or legacy-date bounds", () => {
  const start = actionsSource.indexOf("export async function exportGstHsnSummaryCsvAction");
  const end = actionsSource.indexOf("\ntype LedgerReportInput", start);
  const actionBody = actionsSource.slice(start, end);
  for (const [label, source] of [["CSV action", actionBody], ["page", pageSource]]) {
    assert.match(source, /parseHsnFilter\(/, `${label} must validate with the shared parser`);
    assert.match(source, /loadHsnInvoices\(/, `${label} must load through the shared query path`);
    assert.match(source, /hsnRowMatchesQuery\(/, `${label} must use the shared search predicate`);
    assert.match(source, /establishTenantContext\(/, `${label} must establish the tenant context`);
    assert.doesNotMatch(source, /86399999|T23:59:59|T00:00:00|getFullYear|getMonth\(|invoice_date|new Date\(/);
    assert.match(source, /it\.hsn_code_snapshot/);
    assert.match(source, /it\.product_name_snapshot/);
  }
  assert.match(actionBody, /hsnCsvPreamble\(/);
  assert.match(pageSource, /hsnExclusionNotice\(exclusions\)/);
  assert.match(pageSource, /HSN_INCOMPLETE_BANNER/);
  assert.match(pageSource, /exportGstHsnSummaryCsvAction\.bind\(null, reportInput\)/);
  assert.match(pageSource, /const reportInput = \{ from: fromStr, to: toStr, party, q \}/);
  assert.match(pageSource, /requirePermission\(ctx, PermissionAction\.view_reports\)/);
  assert.doesNotMatch(filterSource, /86399999|getFullYear|getMonth\(|toLocale|invoice_date:/);
});

test("the export button contract accepts the { ok, csv, filename } success and { ok: false } unavailable shapes", async () => {
  const buttonSource = await read("../src/components/ui/export-csv-button.tsx");
  const resultSource = await read("../src/lib/utils/csv-export-result.ts");
  assert.match(buttonSource, /resolveCsvExport\(await action\(\)/);
  assert.match(resultSource, /\{ ok: true; csv: string; filename: string \}/);
  assert.match(resultSource, /\{ ok: false; reason: string \}/);
  const actionResultSource = completenessSource;
  assert.match(actionResultSource, /ReportCsvResult = \{ ok: true; csv: string; filename: string \} \| \{ ok: false; reason: string \}/);
});
