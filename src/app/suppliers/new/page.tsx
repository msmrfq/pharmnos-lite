"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { createSupplierAction } from "@/app/_actions/masters.actions";
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

function SupplierNewForm() {
  const [state, action] = useFormState(createSupplierAction, initialState);
  const [openingType, setOpeningType] = useState("credit");
  const errors = state.errors ?? {};

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  return (
    <form action={action} className="w-full">
      <div className="grid gap-6 lg:grid-cols-3">
        <input type="hidden" name="opening_balance_type" value={openingType} />
        <input type="hidden" name="is_active" value="on" />

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
                <Input id="business_name" name="business_name" placeholder="Intas Pharma Distributors" aria-invalid={!!fieldError(errors, "business_name")} />
                {fieldError(errors, "business_name") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "business_name")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Supplier code</Label>
                <Input id="code" name="code" placeholder="S-00124 (optional auto)" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "credit_days")}>
                <Label htmlFor="credit_days">Credit days</Label>
                <Input id="credit_days" name="credit_days" inputMode="numeric" placeholder="30" defaultValue="30" />
                {fieldError(errors, "credit_days") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "credit_days")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact person</Label>
                <Input id="contact_person" name="contact_person" placeholder="Rakesh Kumar" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "phone")}>
                <Label htmlFor="phone">Phone (landline)</Label>
                <Input id="phone" name="phone" inputMode="tel" placeholder="020-4123 4567" />
                {fieldError(errors, "phone") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "phone")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "mobile")}>
                <Label htmlFor="mobile">Mobile (10 digits)</Label>
                <Input id="mobile" name="mobile" inputMode="tel" placeholder="98765 41209" />
                {fieldError(errors, "mobile") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "mobile")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2" data-field-error={!!fieldError(errors, "email")}>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="support@intas-pharma.in" />
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
                <Input id="address_1" name="address_1" placeholder="Plot 56, MIDC" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address_2">Address line 2</Label>
                <Input id="address_2" name="address_2" placeholder="Bhakti Park (optional)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Mumbai" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "state")}>
                <Label htmlFor="state">State (2-letter ISO)</Label>
                <Input id="state" name="state" placeholder="MH" maxLength={2} className="uppercase font-mono" />
                {fieldError(errors, "state") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "state")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">PIN code</Label>
                <Input id="pincode" name="pincode" placeholder="400078" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "gstin")}>
                <Label htmlFor="gstin">GSTIN (15 chars)</Label>
                <Input id="gstin" name="gstin" placeholder="27AACXX0000B1ZP" className="uppercase font-mono" />
                {fieldError(errors, "gstin") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "gstin")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bank_details">Bank details (optional free text)</Label>
                <Input id="bank_details" name="bank_details" placeholder="Bank name | A/c | IFSC (free text)" />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Opening balance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2" data-field-error={!!fieldError(errors, "opening_balance")}>
                <Label htmlFor="opening_balance">Opening balance (₹)</Label>
                <Input id="opening_balance" name="opening_balance" inputMode="decimal" placeholder="0.00" defaultValue="0" />
                {fieldError(errors, "opening_balance") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "opening_balance")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-1 sm:col-start-2" data-field-error={!!fieldError(errors, "opening_balance_type")}>
                <Label>Opening balance direction</Label>
                <Select value={openingType} onValueChange={setOpeningType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (we owe supplier — increases payable)</SelectItem>
                    <SelectItem value="debit">Debit (supplier owes us / advance paid)</SelectItem>
                  </SelectContent>
                </Select>
                {fieldError(errors, "opening_balance_type") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "opening_balance_type")}</p>
                )}
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Save supplier</CardTitle>
              <CardDescription>
                Creating a new supplier posts any opening balance to the supplier ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-stretch gap-3">
              <div className="text-caption text-muted">
                <ul className="list-disc list-inside space-y-1">
                  <li>Written atomically in one database transaction</li>
                  <li>If opening balance &gt; 0, a single OPENING_BALANCE ledger row is inserted</li>
                  <li>Supplier payable_balance is set accordingly</li>
                  <li>On success you are redirected back to supplier list</li>
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

function SuccessToastIfCreated() {
  const { toast } = useToast();
  const params = useSearchParams();
  const created = params.get("created");
  useEffect(() => {
    if (!created) return;
    toast({
      variant: "success",
      title: "Supplier created",
      description: "Supplier has been added to the master list.",
      duration: 4500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);
  return null;
}

export default function NewSupplierPage() {
  return (
    <DashboardLayout>
      <SuccessToastIfCreated />
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/suppliers" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">Add supplier</CardTitle>
            <CardDescription>
              Register a new supplier with credit terms and opening balance.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <SupplierNewForm />
    </DashboardLayout>
  );
}
