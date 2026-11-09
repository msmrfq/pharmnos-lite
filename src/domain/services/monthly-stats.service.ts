import { Decimal, type DecimalInput } from "@/lib/decimal";
import { businessDateToPrismaDate, businessDateToday, parseBusinessDate } from "@/lib/utils/business-date";
import { formatRupeeAmount } from "./aging-report.service";

export type MonthBounds = {
  /** IST month as YYYY-MM. */
  month: string;
  /** Inclusive UTC date marker of the first IST day of the month. */
  start: Date;
  /** Exclusive UTC date marker of the first IST day of the next month. */
  endExclusive: Date;
};

/** Month bounds come from the IST business date, never from the host timezone. */
export function istMonthBounds(asOf: Date = new Date()): MonthBounds {
  const today = businessDateToday(asOf);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    month: `${year}-${pad(month)}`,
    start: businessDateToPrismaDate(parseBusinessDate(`${year}-${pad(month)}-01`)),
    endExclusive: businessDateToPrismaDate(parseBusinessDate(`${nextYear}-${pad(nextMonth)}-01`)),
  };
}

export type MonthlyAggregate = {
  _sum?: Record<string, DecimalInput | null | undefined> | null;
  _count?: { id?: number | null } | null;
};

export type MonthlyStats = {
  kind: "sales" | "purchase";
  month: string;
  invoiceCount: number;
  /** Exact decimal strings (2dp) for finalized invoices whose effective date is inside the IST month. */
  grossAmount: string;
  totalDiscount: string;
  totalTax: string;
  netAmount: string;
  excludedCount: number;
  excludedNetAmount: string;
  completeness: "COMPLETE" | "QUALIFIED";
  exclusionNote: string | null;
};

function sum(aggregate: MonthlyAggregate, field: string): string {
  const value = aggregate._sum?.[field];
  return (value === null || value === undefined ? Decimal.zero() : Decimal.from(value)).toFixed(2);
}

function count(aggregate: MonthlyAggregate): number {
  const value = Number(aggregate._count?.id ?? 0);
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Invalid invoice count.");
  return value;
}

export function summarizeMonthlyStats(
  kind: "sales" | "purchase",
  month: string,
  included: MonthlyAggregate,
  unclassified: MonthlyAggregate,
): MonthlyStats {
  const excludedCount = count(unclassified);
  const excludedNetAmount = sum(unclassified, "net_amount");
  return {
    kind,
    month,
    invoiceCount: count(included),
    grossAmount: sum(included, "gross_amount"),
    totalDiscount: sum(included, "total_discount"),
    totalTax: sum(included, "total_tax"),
    netAmount: sum(included, "net_amount"),
    excludedCount,
    excludedNetAmount,
    completeness: excludedCount === 0 ? "COMPLETE" : "QUALIFIED",
    exclusionNote: excludedCount === 0
      ? null
      : `${excludedCount} invoices ${formatRupeeAmount(excludedNetAmount)} excluded — date not classified`,
  };
}
