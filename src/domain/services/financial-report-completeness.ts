import {
  businessDateFromPrismaDate,
  businessDateToday,
  formatBusinessInstant,
  parseBusinessDate,
  type BusinessDate,
} from "@/lib/utils/business-date";
import { Decimal } from "@/lib/decimal";

/**
 * Completeness contract shared by every report that places financial rows on a
 * business date (daybook, customer statement, sales/purchase registers) and by
 * their CSV exports.
 *
 * - complete (default): fails closed, with a specific reason, when any row has an
 *   unknown or untrusted effective date.
 * - qualified (explicit opt-in): shows trusted-classified rows only, and always
 *   reports the excluded rows (count, amounts, reasons). Excluded rows are never
 *   assigned to a period and never silently dropped.
 */
export type ReportMode = "complete" | "qualified";

export const REPORT_ROW_LIMIT = 25000;

export const TRUSTED_DATE_BASES: ReadonlySet<string> = new Set(["EXPLICIT", "DERIVED_FROM_OCCURRED_AT"]);

export type ExclusionReason =
  | "UNKNOWN_EFFECTIVE_DATE"
  | "UNTRUSTED_DATE_BASIS"
  | "INCONSISTENT_DATE_EVIDENCE";

const EXCLUSION_REASONS: readonly ExclusionReason[] = [
  "UNKNOWN_EFFECTIVE_DATE",
  "UNTRUSTED_DATE_BASIS",
  "INCONSISTENT_DATE_EVIDENCE",
];

const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  UNKNOWN_EFFECTIVE_DATE: "unknown effective date",
  UNTRUSTED_DATE_BASIS: "untrusted date basis",
  INCONSISTENT_DATE_EVIDENCE: "inconsistent date evidence",
};

export const REPORT_RECORDING_TIME_DISCLOSURE =
  "Recording time is the database statement time captured before commit; it is NOT commit-visible and NOT proof of knowledge-as-of. " +
  "This is an effective-date view of the current records, not a historical knowledge-time snapshot.";

export const QUALIFIED_BANNER_TITLE = "INCOMPLETE — qualified report, not a complete financial total";

export type ReportFailureCode = "INVALID_INPUT" | "DATE_COVERAGE" | "ROW_LIMIT" | "DATA_INTEGRITY";

/**
 * An expected, user-explainable reason a report cannot be produced. Its message
 * is safe to show. Unexpected failures must stay generic.
 */
export class ReportUnavailableError extends Error {
  readonly code: ReportFailureCode;
  readonly qualifiedModeAvailable: boolean;

  constructor(code: ReportFailureCode, message: string, qualifiedModeAvailable = false) {
    super(message);
    this.name = "ReportUnavailableError";
    this.code = code;
    this.qualifiedModeAvailable = qualifiedModeAvailable;
  }
}

export type ReportCsvResult = { ok: true; csv: string; filename: string } | { ok: false; reason: string };

export const GENERIC_REPORT_FAILURE =
  "The report could not be loaded. Check permissions and try again; no financial totals are shown.";

export function describeReportFailure(error: unknown): { reason: string; qualifiedModeAvailable: boolean } {
  if (error instanceof ReportUnavailableError) {
    return { reason: error.message, qualifiedModeAvailable: error.qualifiedModeAvailable };
  }
  return { reason: GENERIC_REPORT_FAILURE, qualifiedModeAvailable: false };
}

/** Runs an export and converts expected unavailability into the typed result. */
export async function toCsvResult(run: () => Promise<{ csv: string; filename: string }>): Promise<ReportCsvResult> {
  try {
    const { csv, filename } = await run();
    return { ok: true, csv, filename };
  } catch (error) {
    if (error instanceof ReportUnavailableError) return { ok: false, reason: error.message };
    throw error;
  }
}

function invalidInput(message: string): ReportUnavailableError {
  return new ReportUnavailableError("INVALID_INPUT", message);
}

export function parseReportMode(value: unknown): ReportMode {
  if (value === undefined) return "complete";
  if (value === "complete" || value === "qualified") return value;
  throw invalidInput('Invalid report mode: use "complete" or "qualified".');
}

/** Strict calendar date: a string, YYYY-MM-DD, a real date, no whitespace or time. */
export function parseStrictReportDate(value: unknown, field: string): BusinessDate {
  if (typeof value !== "string") throw invalidInput(`Business date must be a valid date (${field}).`);
  try {
    return parseBusinessDate(value);
  } catch {
    throw invalidInput(`Business date must be a valid date (${field}).`);
  }
}

export function parseOptionalReportDate(value: unknown, field: string): BusinessDate | "" {
  if (value === undefined || value === "") return "";
  return parseStrictReportDate(value, field);
}

export function parseReportText(value: unknown, field: string, maxLength = 200): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > maxLength) throw invalidInput(`Invalid ${field}.`);
  return value;
}

export function parseReportId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 100) throw invalidInput(`${field} is required.`);
  return value;
}

export function parseReportInputObject(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw invalidInput("Invalid report request.");
  return input as Record<string, unknown>;
}

export type DateClassification =
  | { trusted: true; date: BusinessDate }
  | { trusted: false; reason: ExclusionReason };

function readBusinessDate(value: unknown): BusinessDate | null {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return null;
  try {
    return businessDateFromPrismaDate(value);
  } catch {
    return null;
  }
}

/**
 * Trusted effective dates are exactly EXPLICIT and DERIVED_FROM_OCCURRED_AT (the
 * latter only when its instant still maps to the stored IST calendar date).
 * Everything else, including legacy rows without provenance, is untrusted.
 */
export function classifyLedgerEffectiveDate(row: {
  effective_date?: unknown;
  effective_date_basis?: unknown;
  occurred_at?: unknown;
}): DateClassification {
  if (row.effective_date === null || row.effective_date === undefined) {
    return { trusted: false, reason: "UNKNOWN_EFFECTIVE_DATE" };
  }
  const date = readBusinessDate(row.effective_date);
  if (date === null) return { trusted: false, reason: "INCONSISTENT_DATE_EVIDENCE" };
  if (typeof row.effective_date_basis !== "string" || !TRUSTED_DATE_BASES.has(row.effective_date_basis)) {
    return { trusted: false, reason: "UNTRUSTED_DATE_BASIS" };
  }
  if (row.effective_date_basis === "DERIVED_FROM_OCCURRED_AT") {
    const occurredAt = row.occurred_at;
    if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime()) ||
        businessDateToday(occurredAt) !== date) {
      return { trusted: false, reason: "INCONSISTENT_DATE_EVIDENCE" };
    }
  }
  return { trusted: true, date };
}

/** Invoices carry only a business-date marker (no basis column): null or malformed is untrusted. */
export function classifyInvoiceEffectiveDate(row: { effective_date?: unknown }): DateClassification {
  if (row.effective_date === null || row.effective_date === undefined) {
    return { trusted: false, reason: "UNKNOWN_EFFECTIVE_DATE" };
  }
  const date = readBusinessDate(row.effective_date);
  return date === null ? { trusted: false, reason: "INCONSISTENT_DATE_EVIDENCE" } : { trusted: true, date };
}

export function emptyReasonCounts(): Record<ExclusionReason, number> {
  return { UNKNOWN_EFFECTIVE_DATE: 0, UNTRUSTED_DATE_BASIS: 0, INCONSISTENT_DATE_EVIDENCE: 0 };
}

export type LedgerExclusionSummary = {
  totalEntries: number;
  classifiedEntries: number;
  excludedCount: number;
  excludedDebit: string;
  excludedCredit: string;
  /** debit minus credit, exact 2dp */
  excludedSigned: string;
  byReason: Record<ExclusionReason, number>;
};

export function summarizeLedgerExclusions(
  totalEntries: number,
  excluded: ReadonlyArray<{ reason: ExclusionReason; debit: string; credit: string }>,
): LedgerExclusionSummary {
  let debit = Decimal.zero();
  let credit = Decimal.zero();
  const byReason = emptyReasonCounts();
  for (const item of excluded) {
    debit = debit.add(item.debit);
    credit = credit.add(item.credit);
    byReason[item.reason] += 1;
  }
  return {
    totalEntries,
    classifiedEntries: totalEntries - excluded.length,
    excludedCount: excluded.length,
    excludedDebit: debit.toFixed(2),
    excludedCredit: credit.toFixed(2),
    excludedSigned: debit.subtract(credit).toFixed(2),
    byReason,
  };
}

export type RegisterExclusionSummary = {
  totalInvoices: number;
  classifiedInvoices: number;
  excludedCount: number;
  excludedNet: string;
  byReason: Record<ExclusionReason, number>;
};

export function summarizeRegisterExclusions(
  totalInvoices: number,
  excluded: ReadonlyArray<{ reason: ExclusionReason; net: string }>,
): RegisterExclusionSummary {
  let net = Decimal.zero();
  const byReason = emptyReasonCounts();
  for (const item of excluded) {
    net = net.add(item.net);
    byReason[item.reason] += 1;
  }
  return {
    totalInvoices,
    classifiedInvoices: totalInvoices - excluded.length,
    excludedCount: excluded.length,
    excludedNet: net.toFixed(2),
    byReason,
  };
}

function reasonBreakdown(byReason: Record<ExclusionReason, number>): string {
  return EXCLUSION_REASONS.filter((reason) => byReason[reason] > 0)
    .map((reason) => `${byReason[reason]} ${EXCLUSION_REASON_LABELS[reason]}`).join(", ");
}

/** Specific, safe complete-mode failure naming the exact missing coverage. */
export function coverageGapError(
  subject: "ledger entries" | "invoices",
  total: number,
  excludedCount: number,
  byReason: Record<ExclusionReason, number>,
): ReportUnavailableError {
  return new ReportUnavailableError(
    "DATE_COVERAGE",
    `Report unavailable: ${excludedCount} of ${total} ${subject} have unknown or untrusted effective dates ` +
      `(${reasonBreakdown(byReason)}), so a complete report cannot place them on a business date. ` +
      "Open the qualified (exploratory) view to see classified rows only, with these exclusions shown.",
    true,
  );
}

export function rowLimitError(subject: "ledger entries" | "invoices"): ReportUnavailableError {
  return new ReportUnavailableError(
    "ROW_LIMIT",
    `Report unavailable: more than ${REPORT_ROW_LIMIT} ${subject} exist, exceeding the safe report limit; ` +
      "no partial report is shown, in complete or qualified mode.",
  );
}

export function integrityError(message: string): ReportUnavailableError {
  return new ReportUnavailableError("DATA_INTEGRITY", `Report unavailable: ${message}`);
}

export const BALANCE_BASIS_COMPLETE = "All ledger entries";
export const BALANCE_BASIS_QUALIFIED = "Classified entries only";

export function balanceContext(mode: ReportMode): string {
  return mode === "qualified"
    ? "Balances cover classified entries only and include filtered-out classified entries; excluded entries are not included; effective-date view, not a knowledge-time snapshot."
    : "Balances include filtered-out entries; effective-date view, not a knowledge-time snapshot.";
}

function modeLabel(mode: ReportMode): string {
  return mode === "qualified" ? "QUALIFIED (EXPLORATORY)" : "COMPLETE";
}

function reasonRows(byReason: Record<ExclusionReason, number>): string[][] {
  return EXCLUSION_REASONS.filter((reason) => byReason[reason] > 0)
    .map((reason) => [`Excluded: ${EXCLUSION_REASON_LABELS[reason]}`, String(byReason[reason])]);
}

export function ledgerCsvPreamble(
  title: string,
  from: string,
  to: string,
  mode: ReportMode,
  exclusions: LedgerExclusionSummary,
): string[][] {
  const rows: string[][] = [
    ["Report", title],
    ["Period (inclusive, Asia/Kolkata business dates)", `${from} to ${to}`],
    ["Report mode", modeLabel(mode)],
  ];
  if (mode === "qualified") {
    rows.push(
      ["Completeness", QUALIFIED_BANNER_TITLE],
      ["Opening and running balances", "Classified entries only"],
      ["Excluded entries", String(exclusions.excludedCount)],
      ["Excluded debit", exclusions.excludedDebit],
      ["Excluded credit", exclusions.excludedCredit],
      ["Excluded signed amount (debit minus credit)", exclusions.excludedSigned],
      ...reasonRows(exclusions.byReason),
      ["Exclusion note", "Excluded entries are not assigned to any period or balance"],
    );
  } else {
    rows.push(["Completeness", "COMPLETE: every ledger entry has a trusted effective date"]);
  }
  rows.push(["Recording time", REPORT_RECORDING_TIME_DISCLOSURE], []);
  return rows;
}

export function registerCsvPreamble(
  title: string,
  startDate: string,
  endDate: string,
  mode: ReportMode,
  exclusions: RegisterExclusionSummary,
): string[][] {
  const rows: string[][] = [
    ["Report", title],
    ["Period (inclusive, Asia/Kolkata business dates)", `${startDate || "start"} to ${endDate || "end"}`],
    ["Report mode", modeLabel(mode)],
  ];
  if (mode === "qualified") {
    rows.push(
      ["Completeness", QUALIFIED_BANNER_TITLE],
      ["Excluded invoices", String(exclusions.excludedCount)],
      ["Excluded net amount", exclusions.excludedNet],
      ...reasonRows(exclusions.byReason),
      ["Exclusion note", "Excluded invoices are not assigned to any period"],
    );
  } else {
    rows.push(["Completeness", "COMPLETE: every invoice in scope has a trusted effective date"]);
  }
  rows.push(["Recording time", REPORT_RECORDING_TIME_DISCLOSURE], []);
  return rows;
}

/** ISO instant for a genuine Date, otherwise null. */
export function isoInstantOrNull(value: unknown): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

export function formatInstantOrBlank(value: string | null): string {
  return value ? formatBusinessInstant(value) : "";
}

export { EXCLUSION_REASONS, EXCLUSION_REASON_LABELS };
