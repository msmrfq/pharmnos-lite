export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

declare const businessDateBrand: unique symbol;
export type BusinessDate = string & { readonly [businessDateBrand]: true };

const businessDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const utcBusinessDateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const businessInstantFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parseBusinessInstant(value: Date | string): Date {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new RangeError("Invalid business instant.");
    return value;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const isZonedInstant = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!isDateOnly && !isZonedInstant) {
    throw new RangeError("Business instant must be an ISO date or zoned timestamp.");
  }

  parseUtcDate(value.slice(0, 10));
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new RangeError("Invalid business instant.");
  return parsed;
}

function parseUtcDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    throw new RangeError("Business date must be a valid date.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RangeError("Business date must be a valid date.");
  }
  return parsed;
}

export function parseBusinessDate(value: string): BusinessDate {
  parseUtcDate(value);
  return value as BusinessDate;
}

export function businessDateToPrismaDate(value: BusinessDate): Date {
  return parseUtcDate(value);
}

export function businessDateFromPrismaDate(value: Date): BusinessDate {
  if (!Number.isFinite(value.getTime())) throw new RangeError("Invalid database business date.");
  const iso = value.toISOString();
  if (!iso.endsWith("T00:00:00.000Z")) {
    throw new RangeError("Database business date must be a UTC date-only marker.");
  }
  return parseBusinessDate(iso.slice(0, 10));
}

export function businessDateToday(now: Date = new Date()): string {
  const parts = businessDateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("Unable to determine the business date.");
  }

  return `${year}-${month}-${day}`;
}

export function formatBusinessDate(value: Date | string): string {
  let dateKey: string;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new RangeError("Invalid business date.");
    dateKey = value.toISOString().slice(0, 10);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    dateKey = value;
  } else {
    dateKey = parseBusinessInstant(value).toISOString().slice(0, 10);
  }

  return utcBusinessDateFormatter.format(parseUtcDate(dateKey));
}

export function formatBusinessInstant(value: Date | string): string {
  return businessInstantFormatter.format(parseBusinessInstant(value));
}

export function businessDateStart(now: Date = new Date()): Date {
  return new Date(`${businessDateToday(now)}T00:00:00.000Z`);
}
