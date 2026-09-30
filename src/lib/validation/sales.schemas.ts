import { z } from "zod";
import {
  dateRequired,
  dateOptional,
  decimalFromString,
  decimalFromStringOptional,
  integerFromStringGteOne,
  integerFromStringGteZero,
} from "./purchases.schemas";

export const CustomerPaymentMethodSchema = z.enum([
  "Cash",
  "UPI",
  "Cheque",
  "Bank Transfer",
  "NEFT",
]);
export const SupplierPaymentMethodSchema = CustomerPaymentMethodSchema;

export const SalesInvoiceLineCreateSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  batch_id: z.string().min(1, "Batch is required — use Pick FEFO batches"),
  batch_no: z.string().min(1, "Batch number required"),
  quantity: integerFromStringGteOne,
  free_qty: integerFromStringGteZero,
  sale_rate: decimalFromString,
  mrp: decimalFromStringOptional,
  trade_discount_pct: decimalFromStringOptional,
  gst_rate: decimalFromStringOptional,
});

export type SalesInvoiceLineCreateInput = z.infer<typeof SalesInvoiceLineCreateSchema>;

export const SalesInvoiceCreateSchema = z
  .object({
    customer_id: z.string().min(1, "Customer is required"),
    invoice_date: dateRequired,
    payment_terms_days: integerFromStringGteZero,
    reference_no: z.string().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
    is_cash_sale: z
      .string()
      .or(z.boolean())
      .nullable()
      .optional()
      .transform((v) => v === "on" || v === true || v === "true"),
    gross_amount: decimalFromStringOptional,
    total_discount: decimalFromStringOptional,
    total_tax: decimalFromStringOptional,
    round_off: decimalFromStringOptional,
    net_amount: decimalFromStringOptional,
    notes: z.string().max(500).optional().or(z.literal("")).transform((v) => (v || null)),
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

export type SalesInvoiceCreateInput = z.infer<typeof SalesInvoiceCreateSchema> & {
  lines: SalesInvoiceLineCreateInput[];
};

export const CustomerPaymentCreateSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  amount: decimalFromString,
  payment_method: CustomerPaymentMethodSchema,
  reference_no: z.string().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
  entry_date: dateOptional,
  notes: z.string().max(500).optional().or(z.literal("")).transform((v) => (v || null)),
});

export type CustomerPaymentCreateInput = z.infer<typeof CustomerPaymentCreateSchema>;

export const SupplierPaymentCreateSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  amount: decimalFromString,
  payment_method: SupplierPaymentMethodSchema,
  reference_no: z.string().max(100).optional().or(z.literal("")).transform((v) => (v || null)),
  entry_date: dateOptional,
  notes: z.string().max(500).optional().or(z.literal("")).transform((v) => (v || null)),
});

export type SupplierPaymentCreateInput = z.infer<typeof SupplierPaymentCreateSchema>;

export const STORAGE_SALES_STATUS_DRAFT = "DRAFT";
export const STORAGE_SALES_STATUS_FINALIZED = "FINALIZED";
export const STORAGE_SALES_STATUS_CANCELLED = "CANCELLED";

export const __MAX_SALES_TOTALS_MISMATCH_PAISE = 0.02;
