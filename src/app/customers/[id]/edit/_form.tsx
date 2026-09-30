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
import { updateCustomerAction } from "@/app/_actions/masters.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { customers } from "@prisma/client";

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
      <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save customer"}
    </Button>
  );
}

const initialState: ActionResult<customers> = { ok: false };

export default function CustomerEditForm({
  customerId,
  existing,
}: {
  customerId: string;
  existing: any;
}) {
  const bound = (updateCustomerAction as any).bind(null, customerId);
  const [state, action] = useFormState<ActionResult<customers>, FormData>(bound, initialState);
  const errors = state.errors ?? {};

  const str = (v: any, fallback = ""): string => (v === null || v === undefined ? fallback : String(v));
  const numStr = (v: any, fallback = ""): string => {
    if (v === null || v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return String(n);
  };

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
                  placeholder="MedPlus Pharmacy"
                  aria-invalid={!!fieldError(errors, "business_name")}
                />
                {fieldError(errors, "business_name") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "business_name")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Customer code</Label>
                <Input
                  id="code"
                  name="code"
                  defaultValue={str(existing?.code)}
                  placeholder="C-00124 (optional auto)"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "contact_person")}>
                <Label htmlFor="contact_person">Contact person</Label>
                <Input
                  id="contact_person"
                  name="contact_person"
                  defaultValue={str(existing?.contact_person)}
                  placeholder="Suresh Reddy"
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
                  placeholder="owner@medpluspharmacy.in"
                />
                {fieldError(errors, "email") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "email")}</p>
                )}
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Billing address</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billing_address_1">Address line 1</Label>
                <Input
                  id="billing_address_1"
                  name="billing_address_1"
                  defaultValue={str(existing?.billing_address_1)}
                  placeholder="Shop no 5, High street"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billing_address_2">Address line 2</Label>
                <Input
                  id="billing_address_2"
                  name="billing_address_2"
                  defaultValue={str(existing?.billing_address_2)}
                  placeholder="Kothrud (optional)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_city">City</Label>
                <Input
                  id="billing_city"
                  name="billing_city"
                  defaultValue={str(existing?.billing_city)}
                  placeholder="Pune"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "billing_state")}>
                <Label htmlFor="billing_state">State (2-letter ISO)</Label>
                <Input
                  id="billing_state"
                  name="billing_state"
                  defaultValue={str(existing?.billing_state)}
                  placeholder="MH"
                  maxLength={2}
                  className="uppercase font-mono"
                />
                {fieldError(errors, "billing_state") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "billing_state")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_pincode">PIN code</Label>
                <Input
                  id="billing_pincode"
                  name="billing_pincode"
                  defaultValue={str(existing?.billing_pincode)}
                  placeholder="411038"
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
              <div className="space-y-2">
                <Label htmlFor="drug_license_no_1">Drug license #1</Label>
                <Input
                  id="drug_license_no_1"
                  name="drug_license_no_1"
                  defaultValue={str(existing?.drug_license_no_1)}
                  placeholder="MHL-XXX-0000001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drug_license_no_2">Drug license #2</Label>
                <Input
                  id="drug_license_no_2"
                  name="drug_license_no_2"
                  defaultValue={str(existing?.drug_license_no_2)}
                  placeholder="Optional"
                />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Credit &amp; status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2" data-field-error={!!fieldError(errors, "credit_limit")}>
                <Label htmlFor="credit_limit">Credit limit (₹)</Label>
                <Input
                  id="credit_limit"
                  name="credit_limit"
                  inputMode="decimal"
                  defaultValue={numStr(existing?.credit_limit, "100000")}
                  placeholder="100000"
                />
                {fieldError(errors, "credit_limit") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "credit_limit")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Status</Label>
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
                    Active. Uncheck to soft-delete (preserves invoices and ledger history).
                  </Label>
                </div>
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Save customer</CardTitle>
              <CardDescription>
                Credit limit changes affect new orders only. Opening balance adjustments are handled via Payments (Phase 5).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-stretch gap-3">
              <div className="text-caption text-muted">
                <ul className="list-disc list-inside space-y-1">
                  <li>Customer metadata updated atomically</li>
                  <li>Existing invoices and ledger rows are preserved</li>
                  <li>Opening balance is immutable; adjust via Payments later</li>
                  <li>On success you are redirected back to customer list</li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/customers">Cancel</Link>
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
