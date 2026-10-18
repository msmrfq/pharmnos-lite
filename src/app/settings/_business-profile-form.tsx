"use client";

import { useFormState } from "react-dom";
import { Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardCanvas, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateBusinessProfileAction } from "@/app/_actions/settings.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { business_profiles } from "@prisma/client";

const initialState: ActionResult<business_profiles> = { ok: false };

type BusinessProfileFormProps = {
    businessName: string;
    profile: {
        address_line_1?: string | null;
        address_line_2?: string | null;
        city?: string | null;
        state?: string | null;
        pincode?: string | null;
        country?: string | null;
        gstin?: string | null;
        pan?: string | null;
        drug_license_no_1?: string | null;
        drug_license_no_2?: string | null;
        contact_phone?: string | null;
        contact_email?: string | null;
        invoice_prefix?: string | null;
        purchase_prefix?: string | null;
        default_gst_rate?: number | string | null;
        near_expiry_days?: number | null;
    } | null;
};

function fieldError(state: ActionResult<business_profiles>, key: string): string | undefined {
    return state.errors?.[key]?.[0];
}

export default function BusinessProfileForm({ businessName, profile }: BusinessProfileFormProps) {
    const [state, action] = useFormState(updateBusinessProfileAction, initialState);
    const current = profile ?? {};
    const error = (key: string) => fieldError(state, key);

    return (
        <form action={action} className="space-y-6 lg:col-span-2">
            <input type="hidden" name="businessName" value={businessName} />
            <CardCanvas>
                <CardHeader className="pb-3">
                    <CardTitle className="text-title-md">
                        <span className="inline-flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-muted" />
                            Business profile
                        </span>
                    </CardTitle>
                    {state.message && (
                        <p className={state.ok ? "text-caption text-emerald-700" : "text-caption text-destructive"}>
                            {state.message}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="businessName_display">Business name</Label>
                        <Input id="businessName_display" value={businessName} readOnly />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="addressLine1">Registered address</Label>
                        <Input id="addressLine1" name="addressLine1" defaultValue={current.address_line_1 ?? ""} />
                        {error("addressLine1") && <p className="text-caption text-destructive">{error("addressLine1")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="addressLine2">Address line 2</Label>
                        <Input id="addressLine2" name="addressLine2" defaultValue={current.address_line_2 ?? ""} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" name="city" defaultValue={current.city ?? ""} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="state">State or union territory</Label>
                        <Input id="state" name="state" defaultValue={current.state ?? ""} placeholder="Maharashtra or MH" />
                        {error("state") && <p className="text-caption text-destructive">{error("state")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pincode">PIN code</Label>
                        <Input id="pincode" name="pincode" defaultValue={current.pincode ?? ""} />
                        {error("pincode") && <p className="text-caption text-destructive">{error("pincode")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" name="country" defaultValue={current.country ?? "India"} />
                    </div>
                </CardContent>
            </CardCanvas>

            <CardCanvas>
                <CardHeader className="pb-3">
                    <CardTitle className="text-title-md">Tax and contact details</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="gstin">GSTIN</Label>
                        <Input id="gstin" name="gstin" defaultValue={current.gstin ?? ""} />
                        {error("gstin") && <p className="text-caption text-destructive">{error("gstin")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pan">PAN</Label>
                        <Input id="pan" name="pan" defaultValue={current.pan ?? ""} />
                        {error("pan") && <p className="text-caption text-destructive">{error("pan")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contactPhone">Contact phone</Label>
                        <Input id="contactPhone" name="contactPhone" defaultValue={current.contact_phone ?? ""} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contactEmail">Contact email</Label>
                        <Input id="contactEmail" name="contactEmail" defaultValue={current.contact_email ?? ""} />
                        {error("contactEmail") && <p className="text-caption text-destructive">{error("contactEmail")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="drugLicenseNo1">Drug licence no. 1</Label>
                        <Input id="drugLicenseNo1" name="drugLicenseNo1" defaultValue={current.drug_license_no_1 ?? ""} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="drugLicenseNo2">Drug licence no. 2</Label>
                        <Input id="drugLicenseNo2" name="drugLicenseNo2" defaultValue={current.drug_license_no_2 ?? ""} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="invoicePrefix">Invoice prefix</Label>
                        <Input id="invoicePrefix" name="invoicePrefix" defaultValue={current.invoice_prefix ?? "INV"} />
                        {error("invoicePrefix") && <p className="text-caption text-destructive">{error("invoicePrefix")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="purchasePrefix">Purchase prefix</Label>
                        <Input id="purchasePrefix" name="purchasePrefix" defaultValue={current.purchase_prefix ?? "PUR"} />
                        {error("purchasePrefix") && <p className="text-caption text-destructive">{error("purchasePrefix")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="defaultGstRate">Default GST rate</Label>
                        <Input id="defaultGstRate" name="defaultGstRate" type="number" min="0" max="28" step="0.01" defaultValue={current.default_gst_rate ?? ""} />
                        {error("defaultGstRate") && <p className="text-caption text-destructive">{error("defaultGstRate")}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="nearExpiryDays">Near-expiry window (days)</Label>
                        <Input id="nearExpiryDays" name="nearExpiryDays" type="number" min="7" max="365" defaultValue={current.near_expiry_days ?? 60} />
                        {error("nearExpiryDays") && <p className="text-caption text-destructive">{error("nearExpiryDays")}</p>}
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                        <Button type="submit">
                            <Save className="h-4 w-4" /> Save changes
                        </Button>
                    </div>
                </CardContent>
            </CardCanvas>
        </form>
    );
}
