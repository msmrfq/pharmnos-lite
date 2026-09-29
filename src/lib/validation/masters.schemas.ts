import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().max(50).optional(),
  name: z.string().min(2, "Product name is required"),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  packSize: z.string().optional(),
  hsnCode: z.string().max(20).optional(),
  gstRate: z.coerce.number().min(0).max(28),
  scheduleClassification: z.enum(["H", "H1", "X", "SCHEDULE_H", "SCHEDULE_H1", "SCHEDULE_X", "OTC", "OTHER"]).optional(),
  mrp: z.coerce.number().min(0).optional(),
  standardSaleRate: z.coerce.number().min(0).optional(),
  purchaseRate: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const customerSchema = z.object({
  code: z.string().max(20).optional(),
  businessName: z.string().min(2, "Customer name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().max(20).optional(),
  mobile: z.string().max(20).optional(),
  email: z.string().email("Valid email or empty").optional().or(z.literal("")),
  billingAddress1: z.string().optional(),
  billingAddress2: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingPincode: z.string().max(10).optional(),
  gstin: z.string().max(15).optional(),
  drugLicenseNo1: z.string().max(50).optional(),
  drugLicenseNo2: z.string().max(50).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  openingBalance: z.coerce.number().optional(),
  isActive: z.boolean().default(true),
});

export const supplierSchema = z.object({
  code: z.string().max(20).optional(),
  businessName: z.string().min(2, "Supplier name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().max(20).optional(),
  mobile: z.string().max(20).optional(),
  email: z.string().email("Valid email or empty").optional().or(z.literal("")),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().max(10).optional(),
  gstin: z.string().max(15).optional(),
  drugLicenseNo: z.string().max(50).optional(),
  openingBalance: z.coerce.number().optional(),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
