"use server";

import { revalidatePath } from "next/cache";
import { assertPostgresConfigured } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import { businessProfileSchema, type BusinessProfileInput } from "@/lib/validation/tenant.schemas";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { business_profiles } from "@prisma/client";

function formDataToObject(formData: FormData): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
        result[key] = value === null ? "" : String(value);
    }
    return result;
}

function flattenFieldErrors(fieldErrors: Record<string, unknown>): Record<string, string[] | undefined> {
    const result: Record<string, string[] | undefined> = {};
    for (const [key, value] of Object.entries(fieldErrors)) {
        if (Array.isArray(value)) {
            result[key] = value.filter((item): item is string => typeof item === "string");
        }
    }
    return result;
}

export function toBusinessProfileUpdate(data: BusinessProfileInput) {
    return {
        address_line_1: data.addressLine1 || null,
        address_line_2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state,
        pincode: data.pincode || null,
        country: data.country || "India",
        gstin: data.gstin || null,
        pan: data.pan || null,
        drug_license_no_1: data.drugLicenseNo1 || null,
        drug_license_no_2: data.drugLicenseNo2 || null,
        contact_phone: data.contactPhone || null,
        contact_email: data.contactEmail || null,
        invoice_prefix: data.invoicePrefix,
        purchase_prefix: data.purchasePrefix,
        default_gst_rate: data.defaultGstRate ?? null,
        near_expiry_days: data.nearExpiryDays,
        updated_at: new Date(),
    };
}

export async function updateBusinessProfileAction(
    _previous: ActionResult<business_profiles>,
    formData: FormData,
): Promise<ActionResult<business_profiles>> {
    try {
        assertPostgresConfigured("updateBusinessProfileAction");
        const parsed = businessProfileSchema.safeParse(formDataToObject(formData));
        if (!parsed.success) {
            return {
                ok: false,
                errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
                message: "Please fix the highlighted business-profile fields.",
            };
        }

        const ctx = await requireServerTenantContext();
        requirePermission(ctx, "manage_business_profile");
        const data = parsed.data;
        const profile = await repos.businessProfiles.upsertForTenant(toBusinessProfileUpdate(data), ctx);

        revalidatePath("/settings");
        revalidatePath("/billing/new");
        return { ok: true, data: profile, message: "Business profile saved." };
    } catch (error: any) {
        return {
            ok: false,
            message: typeof error?.message === "string" ? error.message : "Business profile could not be saved.",
        };
    }
}
