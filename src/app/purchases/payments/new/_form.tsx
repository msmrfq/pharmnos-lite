"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Save, Wallet, ArrowUpRight } from "lucide-react";
import { createSupplierPaymentAction } from "@/app/_actions/sales.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";

type Props = {
  suppliers: any[];
  prefillSupplierId?: string;
};

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
    <Button type="submit" disabled={pending} className="bg-[#111] hover:bg-black text-white">
      <Save className="h-4 w-4" /> {pending ? "Recording…" : "Record payment"}
    </Button>
  );
}

const PAYMENT_METHODS = ["Cash", "UPI", "Cheque", "Bank Transfer", "NEFT"] as const;

const initialState: ActionResult<{ id: string }> = { ok: false };

export default function PurchasePaymentNewClientForm({ suppliers, prefillSupplierId }: Props) {
  const [state, action] = useFormState(createSupplierPaymentAction, initialState);
  const errors = state.errors ?? {};
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  useEffect(() => {
    if (state.ok === true) {
      toast({
        variant: "success",
        title: "Supplier payment recorded",
        description: state.message ?? "Supplier payable balance updated successfully.",
        duration: 5500,
      });
      setTimeout(() => router.push("/purchases"), 900);
    } else if (state.ok === false && state.message && !errors) {
      toast({
        variant: "destructive",
        title: "Could not record supplier payment",
        description: state.message,
        duration: 5500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const today = new Date().toISOString().slice(0, 10);
  const sup = suppliers.find((s: any) => s.id === prefillSupplierId);
  const rupee = (n: number | null | undefined | string) => {
    const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
    if (!Number.isFinite(num)) return "—";
    return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  };

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="entry_date" defaultValue={today} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Payment made to supplier</CardTitle>
              {state.message && !state.ok && errors && (
                <CardDescription className="text-destructive pt-2">{state.message}</CardDescription>
              )}
              {state.message && state.ok && (
                <CardDescription className="text-emerald-700 pt-2">{state.message}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div
                className="space-y-2 sm:col-span-2"
                data-field-error={!!fieldError(errors, "supplier_id")}
              >
                <Label htmlFor="supplier_id">Supplier *</Label>
                <Select
                  defaultValue={prefillSupplierId || undefined}
                  onValueChange={(v) => {
                    const el = document.getElementById("supplier_id") as HTMLInputElement | null;
                    if (el) el.value = v;
                  }}
                >
                  <SelectTrigger id="supplier_id_trigger">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">
                            {s.business_name ?? "—"}
                            {s.code ? ` (${s.code})` : ""}
                          </span>
                          {Number(s.payable_balance ?? 0) > 0 && (
                            <Badge variant="secondary" className="shrink-0">
                              Owe {rupee(s.payable_balance)}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" id="supplier_id" name="supplier_id" defaultValue={prefillSupplierId ?? ""} />
                {fieldError(errors, "supplier_id") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "supplier_id")}</p>
                )}
                {sup && (
                  <div className="flex items-center gap-2 pt-2 rounded-md border border-hairline bg-[#fafafa] px-3 py-2">
                    <Wallet className="h-4 w-4 text-muted shrink-0" />
                    <p className="text-body-md text-body">
                      Current balance <span className="font-semibold text-ink">{rupee(sup.payable_balance)}</span>{" "}
                      payable
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2" data-field-error={!!fieldError(errors, "amount")}>
                <Label htmlFor="amount">Amount (₹) *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  inputMode="decimal"
                  className="text-lg font-semibold text-ink"
                />
                {fieldError(errors, "amount") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "amount")}</p>
                )}
              </div>

              <div className="space-y-2" data-field-error={!!fieldError(errors, "payment_method")}>
                <Label htmlFor="payment_method">Payment method *</Label>
                <Select name="payment_method" defaultValue="Bank Transfer">
                  <SelectTrigger id="payment_method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError(errors, "payment_method") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "payment_method")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_date_visible">Entry date</Label>
                <Input
                  id="entry_date_visible"
                  type="date"
                  defaultValue={today}
                  onChange={(e) => {
                    const h = document.querySelector<HTMLInputElement>(
                      'input[name="entry_date"][type="hidden"]',
                    );
                    if (h) h.value = e.target.value;
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference_no">Reference no. (optional)</Label>
                <Input id="reference_no" name="reference_no" placeholder="Cheque no. / UPI txn / NEFT ref" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" name="notes" rows={2} placeholder="e.g. Cheque dated 05 Oct 2026, HDFC Bank" />
                {fieldError(errors, "notes") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "notes")}</p>
                )}
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-amber-700" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-body-sm text-body">
                Supplier payment decreases outstanding payable balance and creates a
                <span className="font-medium text-ink"> PAYMENT_MADE</span> entry in the supplier ledger (debit).
              </p>
              <div className="rounded-md border border-hairline bg-[#fafafa] p-3 text-body-sm text-body space-y-1">
                <p>• Supplier payments clamp payable to ₹0; no negative balance will be left.</p>
                <p>• If amount exceeds payable, a warning is returned — please verify the payment.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/purchases">Cancel</Link>
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
