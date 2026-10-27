import { z } from "zod";

const pad2 = (n: number) => n.toString().padStart(2, "0");

const dateOrStringToDate = (raw: any): Date | null => {
  if (!raw) return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    const a = String(parts[0] ?? "");
    const b = String(parts[1] ?? "");
    const c = String(parts[2] ?? "");
    if (a.length === 4) return new Date(Number(a), Number(b) - 1, Number(c));
    if (c.length === 4) return new Date(Number(c), Number(b) - 1, Number(a));
  }
  return null;
};

export const dateRequired = z
  .string()
  .or(z.date())
  .nullable()
  .optional()
  .transform((v, ctx) => {
    const d = dateOrStringToDate(v);
    if (!d) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date is required" });
      return z.NEVER;
    }
    return d;
  });

export const dateOptional = z
  .string()
  .or(z.date())
  .nullable()
  .optional()
  .transform((v) => dateOrStringToDate(v));

export const decimalFromString = z.string().transform((s, ctx) => {
  const trimmed = s.trim();
  if (!trimmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required" });
    return z.NEVER;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a number ≥ 0" });
    return z.NEVER;
  }
  return n;
});

export const decimalFromStringOptional = z
  .string()
  .or(z.number())
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  });

export const integerFromStringGteOne = z
  .string()
  .or(z.number())
  .transform((v, ctx) => {
    const raw = typeof v === "number" ? v : Number(String(v ?? "").trim());
    const n = Math.floor(raw);
    if (!Number.isFinite(n) || n < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantity must be ≥ 1" });
      return z.NEVER;
    }
    return n;
  });

export const integerFromStringSigned = z
  .string()
  .or(z.number())
  .transform((v, ctx) => {
    const raw = typeof v === "number" ? v : Number(String(v ?? "").trim());
    const n = Math.trunc(raw);
    if (!Number.isFinite(n) || n === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Delta must be non-zero integer" });
      return z.NEVER;
    }
    return n;
  });

export const integerFromStringGteZero = z
  .string()
  .or(z.number())
  .nullable()
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = Math.floor(typeof v === "number" ? v : Number(String(v).trim()));
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  });

export const PurchaseInvoiceLineCreateSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  batch_no: z.string().min(1, "Batch number is required").max(50),
  expiry_date: dateOptional,
  quantity: integerFromStringGteOne,
  free_qty: integerFromStringGteZero,
  mrp: decimalFromStringOptional,
  purchase_rate: decimalFromString,
  sale_rate: decimalFromStringOptional,
  discount_pct: decimalFromStringOptional,
  gst_rate: decimalFromStringOptional,
  declared_taxable_value: decimalFromStringOptional,
  declared_cgst: decimalFromStringOptional,
  declared_sgst: decimalFromStringOptional,
  declared_igst: decimalFromStringOptional,
  declared_cess: decimalFromStringOptional,
  declared_line_total: decimalFromStringOptional,
});

export type PurchaseInvoiceLineCreateInput = z.infer<typeof PurchaseInvoiceLineCreateSchema>;

export const PurchaseInvoiceCreateSchema = z
  .object({
    invoice_no: z.string().max(50).optional().or(z.literal("")),
    supplier_id: z.string().min(1, "Supplier is required"),
    supplier_invoice_no: z.string().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
    invoice_date: dateRequired,
    notes: z.string().max(500).optional().or(z.literal("")).transform((v) => (v || null)),
    gross_amount: decimalFromStringOptional,
    total_discount: decimalFromStringOptional,
    total_tax: decimalFromStringOptional,
    round_off: decimalFromStringOptional,
    net_amount: decimalFromStringOptional,
    declared_taxable_value: decimalFromStringOptional,
    declared_cgst: decimalFromStringOptional,
    declared_sgst: decimalFromStringOptional,
    declared_igst: decimalFromStringOptional,
    declared_cess: decimalFromStringOptional,
    declared_invoice_total: decimalFromStringOptional,
    declared_round_off: decimalFromStringOptional,
    supplier_state_at_transaction: z.string().trim().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
    recipient_state_at_transaction: z.string().trim().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
    delivery_state_at_transaction: z.string().trim().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
    supply_scenario: z.enum(["INTRA_STATE", "INTER_STATE"]).optional(),
  })
  .superRefine((_val, ctx) => {
    const linesRaw = (ctx as any).lines as any[] | undefined;
    if (!linesRaw || linesRaw.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one line item is required",
        path: ["lines"],
      });
    }
  });

export type PurchaseInvoiceCreateInput = z.infer<typeof PurchaseInvoiceCreateSchema> & {
  lines: PurchaseInvoiceLineCreateInput[];
};

export const PurchaseGstAcceptanceSchema = z.object({
  decision_reference: z.string().trim().min(1).max(100),
  rationale: z.string().trim().min(1).max(1000),
  accepted_value_source: z.enum(["SUPPLIER_DECLARED", "APPLICATION_CALCULATED", "EXPLICIT_DECISION"]),
});

export const PurchaseGstResolutionSchema = z.object({
  decision_reference: z.string().trim().min(1).max(100),
  decision: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(1000),
  accepted_value_source: z.enum(["SUPPLIER_DECLARED", "APPLICATION_CALCULATED", "EXPLICIT_DECISION"]),
  accepted_taxable_value: decimalFromStringOptional,
  accepted_cgst: decimalFromStringOptional,
  accepted_sgst: decimalFromStringOptional,
  accepted_igst: decimalFromStringOptional,
  accepted_cess: decimalFromStringOptional,
  accepted_invoice_total: decimalFromStringOptional,
  accepted_round_off: decimalFromStringOptional,
});

export const StockAdjustmentSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  batch_id: z.string().min(1, "Batch is required"),
  quantity_delta: integerFromStringSigned,
  reason: z.enum(["Damaged", "Expired write-off", "Found / Stock count correction", "Other"]),
  notes: z.string().max(500).optional().or(z.literal("")).transform((v) => (v || null)),
});

export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;

export const STORAGE_PURCHASE_STATUS_DRAFT = "DRAFT";
export const STORAGE_PURCHASE_STATUS_FINALIZED = "FINALIZED";
export const STORAGE_PURCHASE_STATUS_CANCELLED = "CANCELLED";
