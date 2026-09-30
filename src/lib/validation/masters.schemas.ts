import { z } from "zod";
import { ScheduleClass, LedgerEntryType } from "@prisma/client";

const pad2 = (n: number) => n.toString().padStart(2, "0");

const YYYYMMDDInteger = (dt: Date | string | null | undefined): number | null => {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  return Number(`${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`);
};

const SCHEDULE_CLASS_VALUES: readonly ScheduleClass[] = Object.freeze([
  ScheduleClass.H,
  ScheduleClass.H1,
  ScheduleClass.X,
  ScheduleClass.SCHEDULE_H,
  ScheduleClass.SCHEDULE_H1,
  ScheduleClass.SCHEDULE_X,
  ScheduleClass.OTC,
  ScheduleClass.OTHER,
]) as readonly ScheduleClass[];

const OPENING_BALANCE_TYPE_VALUES = z.enum(["debit", "credit"]);
type OpeningBalanceType = z.infer<typeof OPENING_BALANCE_TYPE_VALUES>;

const decimalFromString = z.string().transform((s, ctx) => {
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

const decimalFromStringOptional = z.string().or(z.number()).optional().transform((v) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
});

const integerFromStringGteZero = z
  .string()
  .or(z.number())
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = Math.floor(Number(typeof v === "number" ? v : String(v).trim()));
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  });

export const productBatchCreateSchema = z
  .object({
    batch_no: z.string().min(1, "Batch number is required").max(50),
    manufacture_date: z.string().min(1, "Manufacture date is required"),
    expiry_date: z.string().min(1, "Expiry date is required"),
    received_qty: integerFromStringGteZero.refine((n) => n > 0, "Quantity must be > 0"),
    mrp: decimalFromString,
    ptr: decimalFromString,
  })
  .superRefine((b, ctx) => {
    const exp = new Date(b.expiry_date);
    const mfg = new Date(b.manufacture_date);
    if (Number.isNaN(exp.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid expiry date", path: ["expiry_date"] });
    }
    if (Number.isNaN(mfg.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid manufacture date", path: ["manufacture_date"] });
    }
    if (!Number.isNaN(mfg.getTime()) && !Number.isNaN(exp.getTime()) && exp.getTime() <= mfg.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiry must be after manufacture date",
        path: ["expiry_date"],
      });
    }
  })
  .transform((b) => ({
    ...b,
    manufacture_date: new Date(b.manufacture_date),
    expiry_date: new Date(b.expiry_date),
  }));

export const productEditSchema = z.object({
  sku: z.string().min(3, "SKU must be at least 3 characters").max(50).trim(),
  name: z.string().min(2, "Product name is required").max(200).trim(),
  generic_name: z.string().max(200).optional().or(z.literal("")).transform((v) => v || null),
  manufacturer: z.string().max(200).optional().or(z.literal("")).transform((v) => v || null),
  schedule_classification: z.enum(SCHEDULE_CLASS_VALUES as unknown as [ScheduleClass, ...ScheduleClass[]], {
    required_error: "Schedule class is required",
  }),
  hsn_code: z.string().max(20).optional().or(z.literal("")).transform((v) => v || null),
  pack_size: z.string().max(100).optional().or(z.literal("")).transform((v) => v || null),
  gst_rate: decimalFromStringOptional,
  mrp: decimalFromString,
  standard_sale_rate: decimalFromStringOptional,
  purchase_rate: decimalFromStringOptional,
  reorder_level: integerFromStringGteZero,
  is_active: z.coerce.boolean().optional().default(true),
});

export const productCreateSchema = productEditSchema.extend({}).extend({
  batches: z.array(productBatchCreateSchema).min(1, "At least one batch is required").max(100),
});

const INDIAN_PHONE_REGEX = /^[0-9]{10}$/;
const INDIAN_GSTIN_REGEX = /^[0-9A-Z]{15}$/;
const INDIAN_STATE_REGEX = /^[A-Z]{2}$/;

export const customerEditSchema = z.object({
  code: z.string().max(20).optional().or(z.literal("")).transform((v) => v || null),
  business_name: z.string().min(2, "Customer business name is required").max(200).trim(),
  contact_person: z.string().max(200).optional().or(z.literal("")).transform((v) => v || null),
  phone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (typeof v === "string" ? v.replace(/[^0-9]/g, "") : ""))
    .pipe(z.string().regex(INDIAN_PHONE_REGEX, "Enter a 10-digit mobile number").or(z.literal(""))),
  mobile: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (typeof v === "string" ? v.replace(/[^0-9]/g, "") : ""))
    .pipe(z.string().regex(INDIAN_PHONE_REGEX, "Enter a 10-digit mobile number").or(z.literal(""))),
  email: z.string().email("Valid email or leave blank").optional().or(z.literal("")),
  billing_address_1: z.string().max(500).optional().or(z.literal("")).transform((v) => v || null),
  billing_address_2: z.string().max(500).optional().or(z.literal("")).transform((v) => v || null),
  billing_city: z.string().max(100).optional().or(z.literal("")).transform((v) => v || null),
  billing_state: z
    .string()
    .max(3)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v || "").toUpperCase())
    .pipe(z.string().regex(INDIAN_STATE_REGEX, "2-letter ISO state code, e.g. MH").or(z.literal(""))),
  billing_pincode: z.string().max(10).optional().or(z.literal("")).transform((v) => v || null),
  gstin: z
    .string()
    .max(15)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v || "").toUpperCase())
    .pipe(z.string().regex(INDIAN_GSTIN_REGEX, "15-character GSTIN e.g. 27AACXX0000B1ZP").or(z.literal(""))),
  drug_license_no_1: z.string().max(50).optional().or(z.literal("")).transform((v) => v || null),
  drug_license_no_2: z.string().max(50).optional().or(z.literal("")).transform((v) => v || null),
  credit_limit: decimalFromStringOptional,
  is_active: z.coerce.boolean().optional().default(true),
});

export const customerCreateSchema = customerEditSchema.extend({}).extend({
  opening_balance: decimalFromStringOptional,
  opening_balance_type: OPENING_BALANCE_TYPE_VALUES.default("debit"),
});

export const supplierEditSchema = z.object({
  code: z.string().max(20).optional().or(z.literal("")).transform((v) => v || null),
  business_name: z.string().min(2, "Supplier name is required").max(200).trim(),
  contact_person: z.string().max(200).optional().or(z.literal("")).transform((v) => v || null),
  phone: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (typeof v === "string" ? v.replace(/[^0-9]/g, "") : ""))
    .pipe(z.string().regex(INDIAN_PHONE_REGEX, "Enter a 10-digit phone number").or(z.literal(""))),
  mobile: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (typeof v === "string" ? v.replace(/[^0-9]/g, "") : ""))
    .pipe(z.string().regex(INDIAN_PHONE_REGEX, "Enter a 10-digit mobile number").or(z.literal(""))),
  email: z.string().email("Valid email or leave blank").optional().or(z.literal("")),
  address_1: z.string().max(500).optional().or(z.literal("")).transform((v) => v || null),
  address_2: z.string().max(500).optional().or(z.literal("")).transform((v) => v || null),
  city: z.string().max(100).optional().or(z.literal("")).transform((v) => v || null),
  state: z
    .string()
    .max(3)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v || "").toUpperCase())
    .pipe(z.string().regex(INDIAN_STATE_REGEX, "2-letter ISO state code, e.g. MH").or(z.literal(""))),
  pincode: z.string().max(10).optional().or(z.literal("")).transform((v) => v || null),
  gstin: z
    .string()
    .max(15)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v || "").toUpperCase())
    .pipe(z.string().regex(INDIAN_GSTIN_REGEX, "15-character GSTIN e.g. 27AACXX0000B1ZP").or(z.literal(""))),
  drug_license_no: z.string().max(50).optional().or(z.literal("")).transform((v) => v || null),
  is_active: z.coerce.boolean().optional().default(true),
});

export const supplierCreateSchema = supplierEditSchema.extend({}).extend({
  opening_balance: decimalFromStringOptional,
  opening_balance_type: OPENING_BALANCE_TYPE_VALUES.default("credit"),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductEditInput = z.infer<typeof productEditSchema>;
export type ProductBatchCreateInput = z.infer<typeof productBatchCreateSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema> & { opening_balance_type: OpeningBalanceType };
export type CustomerEditInput = z.infer<typeof customerEditSchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema> & { opening_balance_type: OpeningBalanceType };
export type SupplierEditInput = z.infer<typeof supplierEditSchema>;
export type { OpeningBalanceType };
export const CustomerOpeningType = OPENING_BALANCE_TYPE_VALUES;
export const SupplierOpeningType = OPENING_BALANCE_TYPE_VALUES;
export const __LedgerEntryType_OPENING_BALANCE: LedgerEntryType = "OPENING_BALANCE";
