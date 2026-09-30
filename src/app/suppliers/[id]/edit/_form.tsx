"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardCanvas,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save } from "lucide-react";
import { updateSupplierAction } from "@/app/_actions/masters.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { suppliers } from "@prisma/client";

function fieldError(
  errors: Record<string, string[] | undefined> | undefined,
  field: string,
): string | undefined {
  const e = errors?.[field];
  return e && e.length ? e[0] : undefined;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save supplier"}
    </Button>
  );
}

const initialState: ActionResult<suppliers> = { ok: false };

export default function SupplierEditForm({
  supplierId,
  existing,
}: {
  supplierId: string;
  existing: any;
}) {
  const bound = (updateSupplierAction as any).bind(null, supplierId);
  const [state, action] = useFormState<ActionResult<suppliers>, FormData>(bound, initialState);
  const errors = state.errors ?? {};

  const str = (v: any, fallback = ""): string => (v === null || v === undefined ? fallback : String(v));

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  return (
    <form action={action as any} className="w-full">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Business information</CardTitle>
              {state.message && !state.ok && (
                <CardDescription className="text-destructive pt-2">{state.message}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2" data-field-error={!!fieldError(errors, "business_name")}>
                <Label htmlFor="business_name">Business name *</Label>
                <Input
                  id="business_name"
                  name="business_name"
                  defaultValue={str(existing?.business_name)}
                  placeholder="Intas Pharma Distributors"
                  aria-invalid={!!fieldError(errors, "business_name")}
                />
                {fieldError(errors, "business_name") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "business_name")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Supplier code</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={str(existing?.code)}
                  placeholder="S-00124 (optional auto)"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "contact_person")}>
                <Label htmlFor="contact_person">Contact person</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  defaultValue={str(existing?.contact_person)}
                  placeholder="Rakesh Kumar"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "phone")}>
                <Label htmlFor="phone">Phone (landline)</Label>
                <Input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  defaultValue={str(existing?.phone)}
                  placeholder="020-4123 4567"
                />
                {fieldError(errors, "phone") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "phone")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "mobile")}>
                <Label htmlFor="mobile">Mobile (10 digits)</Label>
                <Input
                  id="mobile"
                  name="mobile"
                  inputMode="tel"
                  defaultValue={str(existing?.mobile)}
                  placeholder="98765 41209"
                />
                {fieldError(errors, "mobile") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "mobile")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2" data-field-error={!!fieldError(errors, "email")}>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={str(existing?.email)}
                  placeholder="support@intas-pharma.in"
                />
                {fieldError(errors, "email") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "email")}</p>
                )}
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Office address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_1">Address line 1</Label>
                <Input
                  id="address_1"
                  name="address_1"
                  defaultValue={str(existing?.address_1)}
                  placeholder="Plot 56, MIDC"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_2">Address line 2</Label>
                <Input
                  id="address_2"
                  name="address_2"
                  defaultValue={str(existing?.address_2)}
                  placeholder="Bhakti Park (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={str(existing?.city)}
                  placeholder="Mumbai"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "state")}>
                <Label htmlFor="state">State (2-letter ISO)</Label>
                <Input
                  id="state"
                  name="state"
                  defaultValue={str(existing?.state)}
                  placeholder="MH"
                  maxLength={2}
                  className="uppercase font-mono"
                />
                {fieldError(errors, "state") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "state")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">PIN code</Label>
                <Input
                  id="pincode"
                  name="pincode"
                  defaultValue={str(existing?.pincode)}
                  placeholder="400078"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "gstin")}>
                <Label htmlFor="gstin">GSTIN (15 chars)</Label>
                <Input
                  id="gstin"
                  name="gstin"
                  defaultValue={str(existing?.gstin)}
                  placeholder="27AACXX0000B1ZP"
                  className="uppercase font-mono"
                />
                {fieldError(errors, "gstin") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "gstin")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="drug_license_no">Drug license</Label>
                <Input
                  id="drug_license_no"
                  name="drug_license_no"
                  defaultValue={str(existing?.drug_license_no)}
                  placeholder="MHL-XXX-0000001"
                />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3">
                  <input type="hidden" name="is_active" value="off" />
                  <input
                    id="is_active"
                    name="is_active"
                    type="checkbox"
                    value="on"
                    defaultChecked={existing?.is_active !== false}
                    className="h-4 w-4 rounded border border-hairline"
                  />
                  <Label htmlFor="is_active" className="!mb-0">
                    Active. Uncheck to soft-delete (preserves all bills and ledger history).
                  </Label>
                </div>
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Save supplier</CardTitle>
              <CardDescription>
                Updates are applied immediately. Opening balance and bill adjustments handled in Purchases and Payments.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-stretch gap-3">
              <div className="text-caption text-muted">
                <ul className="list-disc list-inside space-y-1">
                  <li>Supplier metadata updated atomically</li>
                  <li>Existing purchase bills and ledger rows preserved</li>
                  <li>On success redirected back to supplier list</li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/suppliers">Cancel</Link>
                </Button>
                <SubmitButton />
              </div>
            </CardContent>
          </CardCanvas>
        </div>
      </div>
    </form>
  );
}
void DashboardLayout;
