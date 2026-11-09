import { formatBusinessDate } from "@/lib/utils/business-date";

export const LEGACY_INVOICE_DATE_LABEL = "legacy \u2014 not classified";

export type InvoiceDisplayDate = {
  text: string;
  /** False when only the legacy invoice_date is available (effective_date is NULL). */
  classified: boolean;
};

/**
 * Invoice date for display. Prefers the typed business-date marker (effective_date);
 * a NULL effective_date falls back to the legacy/snapshot invoice_date through the
 * same host-independent UTC-date-key formatter and is reported as unclassified so the
 * caller can label it. Never uses host-local date formatting.
 */
export function resolveInvoiceDisplayDate(invoice: {
  effective_date?: Date | string | null;
  invoice_date?: Date | string | null;
}): InvoiceDisplayDate {
  if (invoice.effective_date) return { text: formatBusinessDate(invoice.effective_date), classified: true };
  if (invoice.invoice_date) return { text: formatBusinessDate(invoice.invoice_date), classified: false };
  return { text: "\u2014", classified: true };
}
