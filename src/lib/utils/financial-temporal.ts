import {
  businessDateToPrismaDate,
  businessDateToday,
  parseBusinessDate,
  type BusinessDate,
} from "@/lib/utils/business-date";

declare const capturedInstantBrand: unique symbol;

/**
 * A genuine system event instant captured at the operation boundary. It can only
 * be created by captureSystemInstant, so an arbitrary Date (for example a
 * UTC-midnight date marker read from the database) does not type-check as one.
 */
export type CapturedInstant = Date & { readonly [capturedInstantBrand]: true };

export type EffectiveDateBasis = "EXPLICIT" | "DERIVED_FROM_OCCURRED_AT";

/**
 * Exactly one semantic is allowed:
 * - businessDate: an explicitly supplied date-only business date; no instant exists.
 * - occurredAt: a genuine captured instant; its IST calendar date is derived from it.
 */
export type FinancialTemporalInput =
  | { readonly businessDate: BusinessDate; readonly occurredAt?: never }
  | { readonly occurredAt: CapturedInstant; readonly businessDate?: never };

export type ResolvedFinancialTemporal = {
  effectiveBusinessDate: BusinessDate;
  /** UTC-midnight marker for a Prisma `@db.Date` column. */
  effectiveDate: Date;
  effectiveDateBasis: EffectiveDateBasis;
  /** Present only when a genuine instant exists. */
  occurredAt: Date | null;
  /**
   * Value for the legacy timezone-less `entry_date`/`payment_date` columns: the
   * date marker for a business date, the genuine instant otherwise. Preserved
   * unchanged for compatibility; new readers use the typed fields.
   */
  legacyTimestamp: Date;
};

const ALLOWED_KEYS = new Set(["businessDate", "occurredAt"]);

function isDate(value: unknown): value is Date {
  return Object.prototype.toString.call(value) === "[object Date]";
}

export function captureSystemInstant(now: Date = new Date()): CapturedInstant {
  if (!isDate(now) || !Number.isFinite(now.getTime())) {
    throw new RangeError("A system instant must be a valid Date.");
  }
  return new Date(now.getTime()) as CapturedInstant;
}

/**
 * Trust-boundary validation of a financial temporal input. Compile-time types
 * prevent an ambiguous Date; this also rejects untyped callers.
 */
export function resolveFinancialTemporal(input: FinancialTemporalInput): ResolvedFinancialTemporal {
  if (input === null || typeof input !== "object" || Array.isArray(input) || isDate(input)) {
    throw new TypeError("Financial temporal input must name a business date or an occurred-at instant.");
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new TypeError(`Unsupported financial temporal field: ${key}.`);
    }
  }
  const hasBusinessDate = record.businessDate !== undefined;
  const hasOccurredAt = record.occurredAt !== undefined;
  if (hasBusinessDate === hasOccurredAt) {
    throw new TypeError("Provide exactly one of businessDate or occurredAt.");
  }

  if (hasBusinessDate) {
    if (typeof record.businessDate !== "string") {
      throw new TypeError("businessDate must be a YYYY-MM-DD string.");
    }
    const effectiveBusinessDate = parseBusinessDate(record.businessDate);
    const effectiveDate = businessDateToPrismaDate(effectiveBusinessDate);
    return {
      effectiveBusinessDate,
      effectiveDate,
      effectiveDateBasis: "EXPLICIT",
      occurredAt: null,
      legacyTimestamp: effectiveDate,
    };
  }

  if (!isDate(record.occurredAt) || !Number.isFinite(record.occurredAt.getTime())) {
    throw new TypeError("occurredAt must be a valid captured Date.");
  }
  const occurredAt = new Date(record.occurredAt.getTime());
  const effectiveBusinessDate = parseBusinessDate(businessDateToday(occurredAt));
  return {
    effectiveBusinessDate,
    effectiveDate: businessDateToPrismaDate(effectiveBusinessDate),
    effectiveDateBasis: "DERIVED_FROM_OCCURRED_AT",
    occurredAt,
    legacyTimestamp: occurredAt,
  };
}

/** Ledger columns derived from one resolved temporal fact. */
export function ledgerTemporalFields(resolved: ResolvedFinancialTemporal) {
  return {
    entry_date: resolved.legacyTimestamp,
    effective_date: resolved.effectiveDate,
    effective_date_basis: resolved.effectiveDateBasis,
    occurred_at: resolved.occurredAt,
  };
}

/** Payment columns derived from one resolved temporal fact. */
export function paymentTemporalFields(resolved: ResolvedFinancialTemporal) {
  return {
    payment_date: resolved.legacyTimestamp,
    effective_date: resolved.effectiveDate,
    effective_date_basis: resolved.effectiveDateBasis,
    occurred_at: resolved.occurredAt,
  };
}

/** Event tables (allocations and reversals) record their own date and instant. */
export function eventTemporalFields(resolved: ResolvedFinancialTemporal) {
  if (resolved.occurredAt === null) {
    throw new TypeError("System events require a captured occurred-at instant.");
  }
  return {
    effective_date: resolved.effectiveDate,
    occurred_at: resolved.occurredAt,
  };
}