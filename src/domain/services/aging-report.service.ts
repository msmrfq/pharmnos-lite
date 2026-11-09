import { Decimal, type DecimalInput } from "@/lib/decimal";
import { businessDateFromPrismaDate, businessDateToday } from "@/lib/utils/business-date";

export type AgingKind = "customer" | "supplier";

export type AgingInvoiceRow = {
  id: string;
  partyId: string | null;
  balance: DecimalInput;
  dueDateBusiness: Date | null | undefined;
};

export type AgingAmounts = {
  current: string;
  d30: string;
  d60: string;
  d90: string;
  over90: string;
  /** current + 1-30, kept for consumers of the legacy `current_30` aggregate. */
  current_30: string;
  /** Sum of the five exclusive buckets. */
  classified_total: string;
  /** Open balance whose due date is not classified; never placed in a bucket. */
  unclassified: string;
  /** classified_total + unclassified. */
  total: string;
};

export type AgingPartyTotals = AgingAmounts & {
  partyId: string | null;
  openInvoiceCount: number;
  unclassifiedCount: number;
  /** Largest overdue day count among classified open invoices; 0 when none is overdue. */
  oldestOverdueDays: number;
};

export type AgingComputation = {
  asOf: string;
  businessDate: string;
  totals: AgingAmounts;
  openInvoiceCount: number;
  unclassifiedCount: number;
  parties: AgingPartyTotals[];
  completeness: "COMPLETE" | "QUALIFIED";
};

export type AgingPartyInfo = {
  id: string;
  name: string;
  code: string | null;
  contact: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  cachedBalance: string | null;
};

export type AgingReportRow = AgingPartyTotals & { party: AgingPartyInfo };

export type AgingReport = Omit<AgingComputation, "parties"> & {
  kind: AgingKind;
  rows: AgingReportRow[];
  banner: string | null;
};

type Accumulator = {
  current: Decimal;
  d30: Decimal;
  d60: Decimal;
  d90: Decimal;
  over90: Decimal;
  unclassified: Decimal;
  openInvoiceCount: number;
  unclassifiedCount: number;
  oldestOverdueDays: number;
};

const DAY_MS = 86_400_000;
const NO_PARTY_KEY = "\u0000none";

function emptyAccumulator(): Accumulator {
  const zero = Decimal.zero();
  return {
    current: zero, d30: zero, d60: zero, d90: zero, over90: zero, unclassified: zero,
    openInvoiceCount: 0, unclassifiedCount: 0, oldestOverdueDays: 0,
  };
}

function amounts(acc: Accumulator): AgingAmounts {
  const classified = acc.current.add(acc.d30).add(acc.d60).add(acc.d90).add(acc.over90);
  return {
    current: acc.current.toFixed(2),
    d30: acc.d30.toFixed(2),
    d60: acc.d60.toFixed(2),
    d90: acc.d90.toFixed(2),
    over90: acc.over90.toFixed(2),
    current_30: acc.current.add(acc.d30).toFixed(2),
    classified_total: classified.toFixed(2),
    unclassified: acc.unclassified.toFixed(2),
    total: classified.add(acc.unclassified).toFixed(2),
  };
}

/** Calendar days past due; null when the due date is not a trusted UTC date-only marker. */
function overdueDays(dueDate: Date | null | undefined, today: string): number | null {
  if (!(dueDate instanceof Date)) return null;
  let due: string;
  try {
    due = businessDateFromPrismaDate(dueDate);
  } catch {
    return null;
  }
  return Math.round((Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${due}T00:00:00.000Z`)) / DAY_MS);
}

function addToBucket(acc: Accumulator, days: number, balance: Decimal): void {
  if (days <= 0) acc.current = acc.current.add(balance);
  else if (days <= 30) acc.d30 = acc.d30.add(balance);
  else if (days <= 60) acc.d60 = acc.d60.add(balance);
  else if (days <= 90) acc.d90 = acc.d90.add(balance);
  else acc.over90 = acc.over90.add(balance);
  if (days > acc.oldestOverdueDays) acc.oldestOverdueDays = days;
}

function comparePartyKeys(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

/**
 * Pure invoice-level aging. Overdue days are the calendar-day difference between the
 * invoice's business due date (UTC date marker) and today's IST business date at `asOfInstant`.
 * Open balances with no trusted due date are reported as unclassified and never guessed.
 */
export function computeAging(rows: readonly AgingInvoiceRow[], asOfInstant: Date): AgingComputation {
  if (!(asOfInstant instanceof Date) || !Number.isFinite(asOfInstant.getTime())) {
    throw new RangeError("Aging as-of instant must be a valid Date.");
  }
  const today = businessDateToday(asOfInstant);
  const total = emptyAccumulator();
  const byParty = new Map<string, { partyId: string | null; acc: Accumulator }>();

  for (const row of rows) {
    const balance = Decimal.from(row.balance);
    if (balance.compare(0) <= 0) continue;
    const key = row.partyId ?? NO_PARTY_KEY;
    let party = byParty.get(key);
    if (!party) {
      party = { partyId: row.partyId, acc: emptyAccumulator() };
      byParty.set(key, party);
    }
    const days = overdueDays(row.dueDateBusiness, today);
    for (const acc of [total, party.acc]) {
      acc.openInvoiceCount += 1;
      if (days === null) {
        acc.unclassified = acc.unclassified.add(balance);
        acc.unclassifiedCount += 1;
      } else {
        addToBucket(acc, days, balance);
      }
    }
  }

  const parties = [...byParty.values()]
    .sort((left, right) => comparePartyKeys(left.partyId, right.partyId))
    .map(({ partyId, acc }): AgingPartyTotals => ({
      partyId,
      ...amounts(acc),
      openInvoiceCount: acc.openInvoiceCount,
      unclassifiedCount: acc.unclassifiedCount,
      oldestOverdueDays: acc.oldestOverdueDays,
    }));

  return {
    asOf: asOfInstant.toISOString(),
    businessDate: today,
    totals: amounts(total),
    openInvoiceCount: total.openInvoiceCount,
    unclassifiedCount: total.unclassifiedCount,
    parties,
    completeness: total.unclassifiedCount === 0 ? "COMPLETE" : "QUALIFIED",
  };
}

/** Exact outstanding balance of a purchase invoice: net amount less allocations net of reversals. */
export function remainingPurchaseBalanceDecimal(row: {
  net_amount: DecimalInput;
  payment_allocations: ReadonlyArray<{ amount: DecimalInput; reversal: ReadonlyArray<{ amount: DecimalInput }> }>;
}): Decimal {
  let remaining = Decimal.from(row.net_amount);
  for (const allocation of row.payment_allocations) {
    remaining = remaining.subtract(allocation.amount);
    for (const reversal of allocation.reversal) remaining = remaining.add(reversal.amount);
  }
  return remaining;
}

/** Indian digit grouping of an exact decimal string, e.g. "1234567.5" -> "12,34,567.50". */
export function formatRupeeAmount(value: DecimalInput): string {
  const fixed = Decimal.from(value).toFixed(2);
  const negative = fixed.startsWith("-");
  const [whole, fraction] = (negative ? fixed.slice(1) : fixed).split(".");
  const head = whole!.slice(0, -3);
  const grouped = (head ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + whole!.slice(-3);
  return `${negative ? "-" : ""}₹${grouped}.${fraction}`;
}

export function unclassifiedBanner(unclassifiedCount: number, unclassifiedAmount: DecimalInput): string | null {
  if (unclassifiedCount <= 0) return null;
  return `INCOMPLETE — ${unclassifiedCount} invoices ${formatRupeeAmount(unclassifiedAmount)} have no classified due date and are not in the aging buckets`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildAgingReport(
  kind: AgingKind,
  invoices: readonly AgingInvoiceRow[],
  parties: readonly AgingPartyInfo[],
  asOfInstant: Date,
): AgingReport {
  const computation = computeAging(invoices, asOfInstant);
  const infoById = new Map(parties.map((party) => [party.id, party]));
  const rows: AgingReportRow[] = computation.parties.map((totals) => {
    if (totals.partyId === null) {
      return {
        ...totals,
        party: {
          id: "",
          name: kind === "customer" ? "No customer on invoice" : "No supplier on invoice",
          code: null, contact: null, phone: null, city: null, state: null, cachedBalance: null,
        },
      };
    }
    const party = infoById.get(totals.partyId);
    if (!party) throw new Error("Aging report unavailable: invoice counterparty is missing.");
    return { ...totals, party };
  });
  rows.sort((left, right) =>
    compareText(left.party.name.toLowerCase(), right.party.name.toLowerCase()) ||
    compareText(left.party.id, right.party.id));
  return {
    asOf: computation.asOf,
    businessDate: computation.businessDate,
    totals: computation.totals,
    openInvoiceCount: computation.openInvoiceCount,
    unclassifiedCount: computation.unclassifiedCount,
    completeness: computation.completeness,
    kind,
    rows,
    banner: unclassifiedBanner(computation.unclassifiedCount, computation.totals.unclassified),
  };
}

export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Banner and disclosure rows are part of the CSV so an exported file cannot look complete when it is not. */
export function agingReportCsvRows(report: AgingReport): string[][] {
  const partyLabel = report.kind === "customer" ? "Customer" : "Supplier";
  const rows: string[][] = [
    ["Report", report.kind === "customer" ? "Customer dues (aging)" : "Supplier payables (aging)"],
    ["As of business date (Asia/Kolkata)", report.businessDate],
    ["Snapshot instant (UTC)", report.asOf],
    ["Completeness", report.completeness],
  ];
  if (report.banner) rows.push([report.banner]);
  rows.push([
    "Code", partyLabel, "City", "State", "Current", "1-30", "31-60", "61-90", ">90",
    "Due date unclassified", "Total open", "Open invoices", "Unclassified invoices",
    "Oldest overdue days", "Recorded balance (cached)",
  ]);
  for (const row of report.rows) {
    rows.push([
      row.party.code ?? "", row.party.name, row.party.city ?? "", row.party.state ?? "",
      row.current, row.d30, row.d60, row.d90, row.over90, row.unclassified, row.total,
      String(row.openInvoiceCount), String(row.unclassifiedCount), String(row.oldestOverdueDays),
      row.party.cachedBalance ?? "",
    ]);
  }
  const totals = report.totals;
  rows.push([
    "", "TOTAL", "", "", totals.current, totals.d30, totals.d60, totals.d90, totals.over90,
    totals.unclassified, totals.total, String(report.openInvoiceCount), String(report.unclassifiedCount), "", "",
  ]);
  return rows;
}

export function agingReportCsv(report: AgingReport): string {
  return "\uFEFF" + agingReportCsvRows(report).map((row) => row.map(csvCell).join(",")).join("\n");
}
