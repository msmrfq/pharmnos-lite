"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
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
import { Save, Wallet, ArrowDownLeft } from "lucide-react";
import { createCustomerPaymentAction } from "@/app/_actions/sales.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";

type Props = {
  customers: any[];
  prefillCustomerId?: string;
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

export default function BillingPaymentNewClientForm({ customers, prefillCustomerId }: Props) {
  const [state, action] = useFormState(createCustomerPaymentAction, initialState);
  const errors = state.errors ?? {};
  const { toast } = useToast();
  const router = useRouter();

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (c: any) => c.id === (prefillCustomerId || (state as any)?.selectedCustomerId),
      ),
    [customers, prefillCustomerId, state],
  );

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  useEffect(() => {
    if (state.ok === true) {
      toast({
        variant: "success",
        title: "Payment recorded",
        description: state.message ?? "Customer balance updated successfully.",
        duration: 5500,
      });
      setTimeout(() => router.push("/billing"), 900);
    } else if (state.ok === false && state.message && !errors) {
      toast({
        variant: "destructive",
        title: "Could not record payment",
        description: state.message,
        duration: 5500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const today = new Date().toISOString().slice(0, 10);
  const cust = customers.find((c: any) => c.id === prefillCustomerId);
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
              <CardTitle className="text-title-md">Payment received from customer</CardTitle>
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
                data-field-error={!!fieldError(errors, "customer_id")}
              >
                <Label htmlFor="customer_id">Customer *</Label>
                <Select
                  defaultValue={prefillCustomerId || undefined}
                  onValueChange={(v) => {
                    const el = document.getElementById("customer_id") as HTMLInputElement | null;
                    if (el) el.value = v;
                  }}
                >
                  <SelectTrigger id="customer_id_trigger">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customers ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">
                            {c.business_name ?? c.customer_name ?? "—"}
                            {c.code ? ` (${c.code})` : ""}
                          </span>
                          {Number(c.receivable_balance ?? 0) > 0 && (
                            <Badge variant="secondary" className="shrink-0">
                              Dues {rupee(c.receivable_balance)}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" id="customer_id" name="customer_id" defaultValue={prefillCustomerId ?? ""} />
                {fieldError(errors, "customer_id") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "customer_id")}</p>
                )}
                {cust && (
                  <div className="flex items-center gap-2 pt-2 rounded-md border border-hairline bg-[#fafafa] px-3 py-2">
                    <Wallet className="h-4 w-4 text-muted shrink-0" />
                    <p className="text-body-md text-body">
                      Current balance <span className="font-semibold text-ink">{rupee(cust.receivable_balance)}</span>{" "}
                      receivable
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
                <Select name="payment_method" defaultValue="Cash">
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
                <Textarea id="notes" name="notes" rows={2} placeholder="e.g. Cheque dated 05 Oct 2026, ICICI Bank" />
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
                <ArrowDownLeft className="h-4 w-4 text-emerald-700" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-body-sm text-body">
                Customer payment decreases outstanding receivable balance and creates a
                <span className="font-medium text-ink"> PAYMENT_RECEIVED</span> entry in the customer ledger (credit).
              </p>
              <div className="rounded-md border border-hairline bg-[#fafafa] p-3 text-body-sm text-body space-y-1">
                <p>• Customer payments clamp receivable to ₹0; no negative balance will be left.</p>
                <p>• If amount exceeds dues, a warning is returned — please verify the payment.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/billing">Cancel</Link>
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
