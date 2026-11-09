import { createTsLoader } from "./load-ts.mjs";

// Prints the aging/month-bound results for fixed instants; the parent test runs this under several host timezones.
const { load } = createTsLoader();
const aging = load("src/domain/services/aging-report.service.ts");
const monthly = load("src/domain/services/monthly-stats.service.ts");

const marker = (value) => new Date(`${value}T00:00:00.000Z`);
const rows = [
  { id: "a", partyId: "p1", balance: "100.10", dueDateBusiness: marker("2026-11-09") },
  { id: "b", partyId: "p1", balance: "200.20", dueDateBusiness: marker("2026-11-08") },
  { id: "c", partyId: "p2", balance: "300.30", dueDateBusiness: marker("2026-09-10") },
  { id: "d", partyId: "p2", balance: "0.01", dueDateBusiness: null },
];
const instants = [
  "2026-11-09T18:29:59.999Z",
  "2026-11-09T18:30:00.000Z",
  "2026-11-30T18:29:59.999Z",
  "2026-11-30T18:30:00.000Z",
];
const output = instants.map((iso) => {
  const when = new Date(iso);
  const result = aging.computeAging(rows, when);
  const bounds = monthly.istMonthBounds(when);
  return {
    iso,
    businessDate: result.businessDate,
    totals: result.totals,
    parties: result.parties.map((party) => [party.partyId, party.oldestOverdueDays, party.total]),
    month: bounds.month,
    start: bounds.start.toISOString(),
    end: bounds.endExclusive.toISOString(),
  };
});
process.stdout.write(JSON.stringify(output));
