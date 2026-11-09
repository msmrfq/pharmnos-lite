import {
  businessDateToPrismaDate,
  businessDateToday,
  parseBusinessDate,
  type BusinessDate,
} from "@/lib/utils/business-date";
import { Decimal } from "@/lib/decimal";
import { REPORT_ROW_LIMIT, ReportUnavailableError } from "@/domain/services/financial-report-completeness";

/**
 * Shared date, party and search filter for the GST HSN summary page and its CSV export.
 * Business dates are Asia/Kolkata calendar dates applied inclusively to the typed
 * invoice effective_date DATE marker; the host timezone never participates.
 * Finalized invoices whose effective_date is NULL cannot be placed in any period: they
 * are never assigned to one, never silently dropped, and are reported as an exclusion.
 */
export type HsnParty = "all" | "b2b" | "unregistered";

export type HsnFilter = { from: BusinessDate; to: BusinessDate; party: HsnParty; q: string };

export type HsnFilterInput = { from?: unknown; to?: unknown; party?: unknown; q?: unknown };

const PARTIES: readonly HsnParty[] = ["all", "b2b", "unregistered"];
const MAX_QUERY_LENGTH = 200;

export const HSN_INCOMPLETE_BANNER = "INCOMPLETE \u2014 qualified report, not a complete GST HSN summary";

export const HSN_INVOICE_ORDER = [{ effective_date: "asc" }, { id: "asc" }] as const;

function invalidInput(message: string): ReportUnavailableError {
  return new ReportUnavailableError("INVALID_INPUT", message);
}

function strictDate(value: unknown, field: string): BusinessDate {
  if (typeof value !== "string") throw invalidInput(`Business date must be a valid date (${field}).`);
  try {
    return parseBusinessDate(value);
  } catch {
    throw invalidInput(`Business date must be a valid date (${field}).`);
  }
}

/** First and last day of the current Asia/Kolkata month. */
export function currentBusinessMonthBounds(now: Date = new Date()): { from: BusinessDate; to: BusinessDate } {
  const [year, month] = businessDateToday(now).split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return {
    from: parseBusinessDate(`${prefix}-01`),
    to: parseBusinessDate(`${prefix}-${String(lastDay).padStart(2, "0")}`),
  };
}

/** Strictly validates every input before any query; absent or empty dates use the current IST month. */
export function parseHsnFilter(input: HsnFilterInput, now: Date = new Date()): HsnFilter {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw invalidInput("Invalid report request.");
  const defaults = currentBusinessMonthBounds(now);
  const from = input.from === undefined || input.from === "" ? defaults.from : strictDate(input.from, "from");
  const to = input.to === undefined || input.to === "" ? defaults.to : strictDate(input.to, "to");
  if (from > to) throw invalidInput("Invalid date range: the from date is after the to date.");

  const partyRaw = input.party === undefined || input.party === "" ? "all" : input.party;
  if (typeof partyRaw !== "string" || !PARTIES.includes(partyRaw as HsnParty)) {
    throw invalidInput("Invalid counterparty filter.");
  }

  const qRaw = input.q === undefined ? "" : input.q;
  if (typeof qRaw !== "string" || qRaw.length > MAX_QUERY_LENGTH) throw invalidInput("Invalid search text.");

  return { from, to, party: partyRaw as HsnParty, q: qRaw.trim() };
}

export function hsnClassifiedWhere(tenantId: string, filter: Pick<HsnFilter, "from" | "to">) {
  return {
    tenant_id: tenantId,
    status: "FINALIZED",
    effective_date: { gte: businessDateToPrismaDate(filter.from), lte: businessDateToPrismaDate(filter.to) },
  };
}

export function hsnUnclassifiedWhere(tenantId: string) {
  return { tenant_id: tenantId, status: "FINALIZED", effective_date: null };
}

export function hsnPartyMatches(invoice: { customer_gstin_snapshot?: string | null }, party: HsnParty): boolean {
  if (party === "all") return true;
  const registered = Boolean(invoice.customer_gstin_snapshot?.trim());
  return party === "b2b" ? registered : !registered;
}

export function hsnRowMatchesQuery(row: { hsn?: string | null; description?: string | null }, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (row.hsn?.toLowerCase().includes(needle) ?? false) || (row.description?.toLowerCase().includes(needle) ?? false);
}

export type HsnExclusionSummary = { count: number; taxable: string; gst: string; total: string };

function itemFacts(item: any) {
  const gst = Decimal.from(item.gst_amount ?? 0);
  const taxable = item.taxable_amount ?? null;
  const taxableValue = taxable === null ? Decimal.from(item.line_total ?? 0).subtract(gst) : Decimal.from(taxable);
  return { taxable: taxableValue, gst };
}

/**
 * Exact sums (decimal arithmetic) over the undated finalized invoices that are in scope
 * for the party and search filters, which do not depend on the date. With a search text
 * only the matching lines are counted, mirroring the HSN row filter.
 */
export function summarizeHsnUnclassified(invoices: any[], filter: Pick<HsnFilter, "party" | "q">): HsnExclusionSummary {
  let count = 0;
  let taxable = Decimal.zero();
  let gst = Decimal.zero();
  for (const invoice of invoices) {
    if (!hsnPartyMatches(invoice, filter.party)) continue;
    const items = (invoice.items ?? []).filter((item: any) =>
      hsnRowMatchesQuery({ hsn: item.hsn_code_snapshot ?? "UNCLASSIFIED", description: item.product_name_snapshot ?? "" }, filter.q));
    if (items.length === 0) continue;
    count += 1;
    for (const item of items) {
      const facts = itemFacts(item);
      taxable = taxable.add(facts.taxable);
      gst = gst.add(facts.gst);
    }
  }
  return { count, taxable: taxable.toFixed(2), gst: gst.toFixed(2), total: taxable.add(gst).toFixed(2) };
}

export function hsnExclusionNotice(summary: HsnExclusionSummary): string | null {
  if (summary.count === 0) return null;
  const noun = summary.count === 1 ? "invoice" : "invoices";
  return `${summary.count} ${noun} excluded \u2014 date not classified ` +
    `(taxable INR ${summary.taxable}, tax INR ${summary.gst}, total INR ${summary.total})`;
}

export type HsnInvoiceDb = {
  sales_invoices: { findMany(args: any): Promise<any[]> };
};

/**
 * The single query path for page and CSV. Both reads must run in the caller's one
 * transaction so the dated rows and the exclusion summary describe the same snapshot.
 * Fails closed beyond the row limit instead of truncating.
 */
export async function loadHsnInvoices(db: HsnInvoiceDb, tenantId: string, filter: HsnFilter) {
  const dated = await db.sales_invoices.findMany({
    where: hsnClassifiedWhere(tenantId, filter),
    include: { items: true },
    orderBy: HSN_INVOICE_ORDER,
    take: REPORT_ROW_LIMIT + 1,
  });
  const undated = await db.sales_invoices.findMany({
    where: hsnUnclassifiedWhere(tenantId),
    include: { items: true },
    orderBy: [{ id: "asc" }],
    take: REPORT_ROW_LIMIT + 1,
  });
  if (dated.length > REPORT_ROW_LIMIT || undated.length > REPORT_ROW_LIMIT) {
    throw new ReportUnavailableError("ROW_LIMIT", "Too many invoices for a complete GST HSN summary; narrow the date range.");
  }
  return {
    invoices: dated.filter((invoice) => hsnPartyMatches(invoice, filter.party)),
    exclusions: summarizeHsnUnclassified(undated, filter),
  };
}

export function hsnCsvPreamble(filter: HsnFilter, exclusions: HsnExclusionSummary): string[][] {
  const rows: string[][] = [
    ["GST HSN summary"],
    ["Period (inclusive, Asia/Kolkata business dates)", `${filter.from} to ${filter.to}`],
    ["Date basis", "Invoice effective date (business-date marker)"],
    ["Counterparty", filter.party],
    ["Search", filter.q],
  ];
  if (exclusions.count > 0) {
    rows.push(
      [HSN_INCOMPLETE_BANNER],
      [hsnExclusionNotice(exclusions) as string],
      ["Excluded invoices \u2014 date not classified", String(exclusions.count)],
      ["Excluded taxable value INR", exclusions.taxable],
      ["Excluded tax INR", exclusions.gst],
      ["Excluded total INR", exclusions.total],
    );
  } else {
    rows.push(["Date coverage", "All finalized invoices in scope are date-classified"]);
  }
  rows.push([""]);
  return rows;
}
