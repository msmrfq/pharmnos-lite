import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const zones = ["Asia/Kolkata", "UTC", "America/Los_Angeles"];
const businessDatePath = new URL("../src/lib/utils/business-date.ts", import.meta.url);
const displayDatePath = new URL("../src/lib/utils/invoice-display-date.ts", import.meta.url);

const childScript = `
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(path, require = () => ({})) {
  const module = { exports: {} };
  const js = ts.transpileModule(readFileSync(new URL(path), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require, Date, Intl, RangeError });
  return module.exports;
}
const dates = load(process.env.BUSINESS_DATE_URL);
const display = load(process.env.DISPLAY_DATE_URL, (name) => {
  if (name === "@/lib/utils/business-date") return dates;
  throw new Error("Unexpected import " + name);
});
const marker = new Date("2026-11-09T00:00:00.000Z");
const cases = {
  effectiveMarker: display.resolveInvoiceDisplayDate({ effective_date: marker, invoice_date: new Date("2001-01-01T00:00:00.000Z") }),
  legacyMarker: display.resolveInvoiceDisplayDate({ effective_date: null, invoice_date: marker }),
  legacySnapshotIso: display.resolveInvoiceDisplayDate({ effective_date: null, invoice_date: "2026-11-09T00:00:00.000Z" }),
  snapshotWithEffective: display.resolveInvoiceDisplayDate({ effective_date: marker, invoice_date: "2026-11-09T00:00:00.000Z" }),
  yearEnd: display.resolveInvoiceDisplayDate({ effective_date: new Date("2026-12-31T00:00:00.000Z") }),
  leapDay: display.resolveInvoiceDisplayDate({ effective_date: new Date("2028-02-29T00:00:00.000Z") }),
  missing: display.resolveInvoiceDisplayDate({}),
  expiryMarker: dates.formatBusinessDate(marker),
  genuineInstant: dates.formatBusinessInstant(new Date("2026-11-09T20:00:00.000Z")),
  hostLocalContrast: marker.toLocaleDateString("en-GB"),
  hostZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};
process.stdout.write(JSON.stringify(cases));
`;

function runIn(timeZone) {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", childScript], {
    env: { ...process.env, TZ: timeZone, BUSINESS_DATE_URL: businessDatePath.href, DISPLAY_DATE_URL: displayDatePath.href },
    encoding: "utf8",
    cwd: new URL("..", import.meta.url),
  });
  return JSON.parse(output);
}

const results = Object.fromEntries(zones.map((zone) => [zone, runIn(zone)]));

test("the child processes really ran in three different host timezones", () => {
  assert.equal(results.UTC.hostZone, "UTC");
  assert.equal(results["America/Los_Angeles"].hostZone, "America/Los_Angeles");
  assert.match(results["Asia/Kolkata"].hostZone, /Kolkata|Calcutta/);
  assert.equal(results["America/Los_Angeles"].hostLocalContrast, "08/11/2026", "host-local formatting is zone dependent");
});

test("invoice display dates are identical in Asia/Kolkata, UTC and America/Los_Angeles", () => {
  const { hostLocalContrast: _a, hostZone: _b, ...baseline } = results["Asia/Kolkata"];
  for (const zone of zones) {
    const { hostLocalContrast: _c, hostZone: _d, ...actual } = results[zone];
    assert.deepEqual(actual, baseline, `${zone} output must match Asia/Kolkata`);
  }
});

test("the 2026-11-09T00:00:00Z marker shows 09/11/2026 everywhere", () => {
  for (const zone of zones) {
    const r = results[zone];
    assert.deepEqual(r.effectiveMarker, { text: "09/11/2026", classified: true });
    assert.deepEqual(r.snapshotWithEffective, { text: "09/11/2026", classified: true });
    assert.equal(r.expiryMarker, "09/11/2026");
  }
});

test("NULL effective_date falls back to the legacy date, unclassified, through the UTC date key", () => {
  for (const zone of zones) {
    assert.deepEqual(results[zone].legacyMarker, { text: "09/11/2026", classified: false });
    assert.deepEqual(results[zone].legacySnapshotIso, { text: "09/11/2026", classified: false });
    assert.deepEqual(results[zone].missing, { text: "\u2014", classified: true });
  }
});

test("year-end and leap-day markers are not shifted by the host", () => {
  for (const zone of zones) {
    assert.equal(results[zone].yearEnd.text, "31/12/2026");
    assert.equal(results[zone].leapDay.text, "29/02/2028");
  }
});

test("genuine instants are rendered in explicit IST in every host zone", () => {
  for (const zone of zones) assert.equal(results[zone].genuineInstant, "10/11/2026, 01:30:00");
});

const pages = {
  detail: "../src/app/billing/[invoiceId]/page.tsx",
  print: "../src/app/billing/[invoiceId]/print/page.tsx",
  billingList: "../src/app/billing/page.tsx",
  purchaseList: "../src/app/purchases/page.tsx",
};

for (const [name, path] of Object.entries(pages)) {
  test(`${name} page shows the invoice date through the host-independent resolver and labels legacy dates`, async () => {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /resolveInvoiceDisplayDate\(/);
    assert.match(source, /LEGACY_INVOICE_DATE_LABEL/);
    assert.doesNotMatch(source, /toLocale(?:Date|Time)String|getFullYear|getMonth\(|getDate\(|date-fns/);
    assert.doesNotMatch(source, /import \{[^}]*\bformatDate\b[^}]*\} from "@\/lib\/utils"/);
    assert.doesNotMatch(source, /formatDate\(\s*(?:invoice|p)\.invoice_date/);
  });
}
