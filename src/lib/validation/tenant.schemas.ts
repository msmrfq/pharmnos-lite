import { z } from "zod";

export const businessProfileSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{0,6}$/, "Pincode must be 6 digits or less")
    .optional(),
  country: z.string().default("India"),
  gstin: z
    .string()
    .regex(/^[0-9A-Z]{0,15}$/, "GSTIN must be 15 alphanumeric characters or less")
    .optional(),
  pan: z
    .string()
    .regex(/^[A-Z]{0,10}$/, "PAN must be 10 uppercase letters or less")
    .optional(),
  drugLicenseNo1: z.string().max(50).optional(),
  drugLicenseNo2: z.string().max(50).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  invoicePrefix: z
    .string()
    .min(1, "Invoice prefix is required")
    .max(10)
    .regex(/^[A-Za-z0-9-]+$/, "Only letters, numbers, and dashes allowed"),
  purchasePrefix: z
    .string()
    .min(1, "Purchase prefix is required")
    .max(10)
    .regex(/^[A-Za-z0-9-]+$/, "Only letters, numbers, and dashes allowed"),
  defaultGstRate: z.coerce.number().min(0).max(28).optional(),
  nearExpiryDays: z.coerce.number().int().min(7).max(365).default(60),
});

export const onboardingBusinessSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  slug: z
    .string()
    .min(3, "Short ID must be at least 3 characters")
    .max(20)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes"),
  gstin: z
    .string()
    .regex(/^[0-9A-Z]{0,15}$/, "GSTIN must be 15 alphanumeric characters or less")
    .optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  contactPhone: z.string().max(20).optional(),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type OnboardingBusinessInput = z.infer<typeof onboardingBusinessSchema>;
