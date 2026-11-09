import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createTsLoader } from "./helpers/load-ts.mjs";

const { load } = createTsLoader();
const aging = load("src/domain/services/aging-report.service.ts");
const monthly = load("src/domain/services/monthly-stats.service.ts");

const NOON_IST = new Date("2026-11-09T06:30:00.000Z"); // 2026-11-09 12:00 IST
const marker = (value) => new Date(`${value}T00:00:00.000Z`);
const dueDaysAgo = (days, today = "2026-11-09") =>
  new Date(Date.parse(`${today}T00:00:00.000Z`) - days * 86_400_000);
const row = (id, partyId, balance, dueDateBusiness) => ({ id, partyId, balance, dueDateBusiness });

test("buckets are exclusive at every boundary day", () => {
  const cases = [
    [-1, "current"], [0, "current"], [1, "d30"], [30, "d30"], [31, "d60"],
    [60, "d60"], [61, "d90"], [90, "d90"], [91, "over90"],
  ];
  for (const [days, bucket] of cases) {
    const result = aging.computeAging([row("i", "p", "10.50", dueDaysAgo(days))], NOON_IST);
    for (const key of ["current", "d30", "d60", "d90", "over90"]) {
      assert.equal(result.totals[key], key === bucket ? "10.50" : "0.00", `${days} days overdue -> ${key}`);
    }
    assert.equal(result.totals.classified_total, "10.50");
    assert.equal(result.totals.unclassified, "0.00");
    assert.equal(result.completeness, "COMPLETE");
  }
});

test("current_30 keeps the legacy current + 1-30 aggregate", () => {
  const result = aging.computeAging([
    row("a", "p", "1.10", dueDaysAgo(-5)), row("b", "p", "2.20", dueDaysAgo(30)), row("c", "p", "4.40", dueDaysAgo(31)),
  ], NOON_IST);
  assert.equal(result.totals.current_30, "3.30");
  assert.equal(result.totals.d60, "4.40");
});

test("the business day switches exactly at IST midnight", () => {
  const due = [row("i", "p", "100.00", marker("2026-11-09"))];
  const before = aging.computeAging(due, new Date("2026-11-09T18:29:59.999Z"));
  const after = aging.computeAging(due, new Date("2026-11-09T18:30:00.000Z"));
  assert.equal(before.businessDate, "2026-11-09");
  assert.equal(before.totals.current, "100.00");
  assert.equal(after.businessDate, "2026-11-10");
  assert.equal(after.totals.current, "0.00");
  assert.equal(after.totals.d30, "100.00");
  assert.equal(after.parties[0].oldestOverdueDays, 1);
});

test("unclassified invoices are exact, never bucketed, and qualify the report", () => {
  const rows = [
    row("a", "p1", "0.10", null),
    row("b", "p1", "0.20", undefined),
    row("c", "p2", "5.00", new Date("2026-11-09T05:30:00.000Z")), // an instant, not a date marker
    row("d", "p2", "7.70", dueDaysAgo(2)),
  ];
  const result = aging.computeAging(rows, NOON_IST);
  assert.equal(result.totals.unclassified, "5.30");
  assert.equal(result.unclassifiedCount, 3);
  assert.equal(result.totals.d30, "7.70");
  assert.equal(result.totals.classified_total, "7.70");
  assert.equal(result.totals.total, "13.00");
  assert.equal(result.completeness, "QUALIFIED");
  assert.equal(result.openInvoiceCount, 4);
  const [p1, p2] = result.parties;
  assert.equal(p1.unclassified, "0.30");
  assert.equal(p1.unclassifiedCount, 2);
  assert.equal(p1.classified_total, "0.00");
  assert.equal(p2.unclassified, "5.00");
  assert.equal(
    aging.unclassifiedBanner(result.unclassifiedCount, result.totals.unclassified),
    "INCOMPLETE — 3 invoices ₹5.30 have no classified due date and are not in the aging buckets",
  );
  assert.equal(aging.unclassifiedBanner(0, "0.00"), null);
});

test("settled and over-applied invoices are not counted", () => {
  const result = aging.computeAging([
    row("paid", "p", "0.00", dueDaysAgo(10)), row("over", "p", "-3.00", dueDaysAgo(10)), row("open", "p", "9.99", dueDaysAgo(10)),
  ], NOON_IST);
  assert.equal(result.openInvoiceCount, 1);
  assert.equal(result.totals.d30, "9.99");
  assert.equal(aging.computeAging([row("paid", "p", "0", null)], NOON_IST).completeness, "COMPLETE");
});

test("multi-party grouping is exact and independent of input order", () => {
  const rows = [
    row("1", "b", "10.10", dueDaysAgo(0)), row("2", "a", "20.20", dueDaysAgo(45)), row("3", "b", "30.30", dueDaysAgo(100)),
    row("4", null, "1.01", dueDaysAgo(3)), row("5", "a", "40.40", dueDaysAgo(-2)),
  ];
  const forward = aging.computeAging(rows, NOON_IST);
  const reversed = aging.computeAging([...rows].reverse(), NOON_IST);
  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.parties.map((party) => party.partyId), ["a", "b", null]);
  const [a, b, none] = forward.parties;
  assert.equal(a.current, "40.40");
  assert.equal(a.d60, "20.20");
  assert.equal(a.oldestOverdueDays, 45);
  assert.equal(b.current, "10.10");
  assert.equal(b.over90, "30.30");
  assert.equal(none.d30, "1.01");
  assert.equal(forward.totals.total, "102.01");
  const partySum = forward.parties.reduce((sum, party) => sum + Math.round(Number(party.total) * 100), 0);
  assert.equal(partySum, 10201);
});

test("invalid amounts and instants fail closed", () => {
  assert.throws(() => aging.computeAging([row("x", "p", "abc", null)], NOON_IST));
  assert.throws(() => aging.computeAging([], new Date("invalid")));
});

test("purchase balance is net amount less allocations net of reversals, exactly", () => {
  const balance = (net, allocations) => aging.remainingPurchaseBalanceDecimal({ net_amount: net, payment_allocations: allocations }).toFixed(2);
  assert.equal(balance("1000.10", [{ amount: "400.05", reversal: [{ amount: "100.02" }] }]), "700.07");
  assert.equal(balance("50.00", [{ amount: "50.00", reversal: [] }]), "0.00");
  assert.equal(balance("50.00", [{ amount: "50.00", reversal: [{ amount: "50.00" }] }]), "50.00");
});

test("report build joins names, orders deterministically and refuses a missing party", () => {
  const party = (id, name) => ({ id, name, code: id.toUpperCase(), contact: null, phone: null, city: null, state: null, cachedBalance: null });
  const invoices = [row("1", "z", "1.00", dueDaysAgo(1)), row("2", "a", "2.00", dueDaysAgo(1)), row("3", "m", "3.00", null)];
  const report = aging.buildAgingReport("customer", invoices, [party("z", "alpha"), party("a", "Zed"), party("m", "alpha")], NOON_IST);
  assert.deepEqual(report.rows.map((entry) => entry.party.id), ["m", "z", "a"]);
  assert.equal(report.completeness, "QUALIFIED");
  assert.match(report.banner, /^INCOMPLETE — 1 invoices ₹3\.00 have no classified due date/);
  assert.throws(() => aging.buildAgingReport("customer", invoices, [party("z", "alpha")], NOON_IST), /counterparty is missing/);
  const noParty = aging.buildAgingReport("supplier", [row("9", null, "4.00", dueDaysAgo(0))], [], NOON_IST);
  assert.equal(noParty.rows[0].party.name, "No supplier on invoice");
});

test("rupee formatting uses exact Indian grouping", () => {
  assert.equal(aging.formatRupeeAmount("1234567.5"), "₹12,34,567.50");
  assert.equal(aging.formatRupeeAmount("999"), "₹999.00");
  assert.equal(aging.formatRupeeAmount("12345678901234567.89"), "₹12,34,56,78,90,12,34,567.89");
  assert.equal(aging.formatRupeeAmount("12345678"), "₹1,23,45,678.00");
});

test("CSV carries the same figures as the report and discloses qualification", () => {
  const party = (id, name) => ({ id, name, code: id, contact: null, phone: null, city: "Pune", state: "MH", cachedBalance: "9.00" });
  const invoices = [row("1", "a", "10.00", dueDaysAgo(2)), row("2", "a", "5.50", null), row("3", "b", "=cmd", dueDaysAgo(0))].slice(0, 2);
  const report = aging.buildAgingReport("supplier", invoices, [party("a", "=HYPERLINK(1)")], NOON_IST);
  const rows = aging.agingReportCsvRows(report);
  assert.deepEqual(rows[3], ["Completeness", "QUALIFIED"]);
  assert.equal(rows[4][0], report.banner);
  const headerIndex = rows.findIndex((entry) => entry[0] === "Code");
  assert.equal(rows[headerIndex][1], "Supplier");
  const dataRow = rows[headerIndex + 1];
  assert.deepEqual(dataRow.slice(4, 12), ["0.00", "10.00", "0.00", "0.00", "0.00", "5.50", "15.50", "2"]);
  const totalRow = rows[rows.length - 1];
  assert.equal(totalRow[1], "TOTAL");
  assert.equal(totalRow[10], report.totals.total);
  const csv = aging.agingReportCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=HYPERLINK(1)"), "formula-like party names are neutralised");
  assert.ok(csv.includes(report.banner));

  const complete = aging.buildAgingReport("customer", [row("1", "a", "1.00", dueDaysAgo(0))], [party("a", "A")], NOON_IST);
  const completeRows = aging.agingReportCsvRows(complete);
  assert.deepEqual(completeRows[3], ["Completeness", "COMPLETE"]);
  assert.equal(completeRows.some((entry) => /INCOMPLETE/.test(entry[0])), false);
});

test("monthly bounds follow the IST month, including the UTC month-end boundary", () => {
  const november = monthly.istMonthBounds(new Date("2026-11-30T18:29:59.999Z"));
  assert.equal(november.month, "2026-11");
  assert.equal(november.start.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(november.endExclusive.toISOString(), "2026-12-01T00:00:00.000Z");
  const december = monthly.istMonthBounds(new Date("2026-11-30T18:30:00.000Z"));
  assert.equal(december.month, "2026-12");
  assert.equal(december.start.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(december.endExclusive.toISOString(), "2027-01-01T00:00:00.000Z");
  const early = monthly.istMonthBounds(new Date("2026-12-01T00:00:00.000Z"));
  assert.equal(early.month, "2026-12");
});

test("monthly summary separates included totals from exact unclassified exclusions", () => {
  const included = { _sum: { gross_amount: "100.10", total_discount: "0.10", total_tax: "12.00", net_amount: "112.00" }, _count: { id: 2 } };
  const none = { _sum: { net_amount: null }, _count: { id: 0 } };
  const complete = monthly.summarizeMonthlyStats("sales", "2026-11", included, none);
  assert.equal(complete.netAmount, "112.00");
  assert.equal(complete.invoiceCount, 2);
  assert.equal(complete.completeness, "COMPLETE");
  assert.equal(complete.exclusionNote, null);
  const qualified = monthly.summarizeMonthlyStats("sales", "2026-11", included, { _sum: { net_amount: "1234.50" }, _count: { id: 3 } });
  assert.equal(qualified.excludedCount, 3);
  assert.equal(qualified.excludedNetAmount, "1234.50");
  assert.equal(qualified.completeness, "QUALIFIED");
  assert.equal(qualified.exclusionNote, "3 invoices ₹1,234.50 excluded — date not classified");
  assert.equal(qualified.netAmount, "112.00", "excluded invoices never leak into the included total");
  const empty = monthly.summarizeMonthlyStats("purchase", "2026-11", { _sum: null, _count: null }, none);
  assert.equal(empty.netAmount, "0.00");
});

test("results are identical under Asia/Kolkata, UTC and America/Los_Angeles host timezones", () => {
  const child = fileURLToPath(new URL("./helpers/aging-timezone-child.mjs", import.meta.url));
  const outputs = ["Asia/Kolkata", "UTC", "America/Los_Angeles"].map((TZ) =>
    execFileSync(process.execPath, [child], { env: { ...process.env, TZ }, encoding: "utf8" }));
  assert.equal(outputs[1], outputs[0]);
  assert.equal(outputs[2], outputs[0]);
  const [beforeMidnight, afterMidnight, , december] = JSON.parse(outputs[0]);
  assert.equal(beforeMidnight.businessDate, "2026-11-09");
  assert.equal(afterMidnight.businessDate, "2026-11-10");
  assert.equal(beforeMidnight.totals.current, "100.10");
  assert.equal(afterMidnight.totals.d30, "300.30");
  assert.equal(afterMidnight.totals.d90, "300.30");
  assert.equal(december.month, "2026-12");
});
