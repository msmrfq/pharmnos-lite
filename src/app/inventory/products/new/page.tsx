"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
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
import { ArrowLeft, FileSpreadsheet, Save, Plus, Trash2 } from "lucide-react";
import { createProductAction } from "@/app/_actions/masters.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { products } from "@prisma/client";
import { ScheduleClass } from "@prisma/client";
import { useSearchParams } from "next/navigation";

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
      <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save product"}
    </Button>
  );
}

type Batch = {
  key: string;
  batch_no: string;
  manufacture_date: string;
  expiry_date: string;
  received_qty: string;
  mrp: string;
  ptr: string;
};

const emptyBatch = (idx: number): Batch => ({
  key: `b-${Date.now()}-${idx}`,
  batch_no: "",
  manufacture_date: "",
  expiry_date: "",
  received_qty: "",
  mrp: "",
  ptr: "",
});

const SCHEDULE_OPTIONS: Array<{ value: ScheduleClass; label: string }> = [
  { value: ScheduleClass.OTC, label: "OTC — over the counter" },
  { value: ScheduleClass.H, label: "Schedule H — prescription" },
  { value: ScheduleClass.H1, label: "Schedule H1 — narcotics" },
  { value: ScheduleClass.X, label: "Schedule X" },
  { value: ScheduleClass.SCHEDULE_H, label: "Schedule H (legacy)" },
  { value: ScheduleClass.SCHEDULE_H1, label: "Schedule H1 (legacy)" },
  { value: ScheduleClass.SCHEDULE_X, label: "Schedule X (legacy)" },
  { value: ScheduleClass.OTHER, label: "Other / unclassified" },
];

const initialProductState: ActionResult<products> = { ok: false };

function ProductNewForm() {
  const [state, action] = useFormState(createProductAction, initialProductState);
  const [batches, setBatches] = useState<Batch[]>([emptyBatch(0)]);
  const [schedule, setSchedule] = useState<string>(ScheduleClass.OTC);

  const addBatch = useCallback(() => {
    setBatches((prev) => [...prev, emptyBatch(prev.length)]);
  }, []);

  const removeBatch = useCallback((key: string) => {
    setBatches((prev) => (prev.length > 1 ? prev.filter((b) => b.key !== key) : prev));
  }, []);

  const updateBatch = useCallback((key: string, patch: Partial<Batch>) => {
    setBatches((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }, []);

  const formErrors = state.errors ?? {};
  const batchesErrors = useMemo(() => {
    const out: Array<Record<string, string | undefined>> = batches.map(() => ({}));
    for (const [k, v] of Object.entries(formErrors)) {
      if (!k.startsWith("batches.")) continue;
      const rest = k.slice("batches.".length);
      const dot = rest.indexOf(".");
      if (dot < 0) continue;
      const idx = Number(rest.slice(0, dot));
      const f = rest.slice(dot + 1);
      if (!Number.isFinite(idx) || idx < 0 || idx >= out.length) continue;
      const target = out[idx];
      if (!target) continue;
      const firstErr = Array.isArray(v) ? v[0] : undefined;
      if (firstErr) target[f] = firstErr;
    }
    return out;
  }, [formErrors, batches]);

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  return (
    <form action={action} className="w-full">
      <div className="grid gap-6 lg:grid-cols-3">
        <input type="hidden" name="schedule_classification" value={schedule} />
        <input type="hidden" name="is_active" value="on" />

        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">
                <span className="inline-flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted" />
                  Basic information
                </span>
              </CardTitle>
              {state.message && !state.ok && (
                <CardDescription className="text-destructive pt-2">{state.message}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2" data-field-error={!!fieldError(formErrors, "name")}>
                <Label htmlFor="name">Product name *</Label>
                <Input id="name" name="name" placeholder="Paracetamol 500mg Tablet (10x10)" aria-invalid={!!fieldError(formErrors, "name")} />
                {fieldError(formErrors, "name") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "name")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "sku")}>
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" name="sku" placeholder="PCM-500-100" aria-invalid={!!fieldError(formErrors, "sku")} />
                {fieldError(formErrors, "sku") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "sku")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "schedule_classification")}>
                <Label>Schedule class *</Label>
                <Select value={schedule} onValueChange={setSchedule}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError(formErrors, "schedule_classification") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "schedule_classification")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="generic_name">Generic / salt name</Label>
                <Input id="generic_name" name="generic_name" placeholder="Paracetamol IP 500mg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer / brand</Label>
                <Input id="manufacturer" name="manufacturer" placeholder="Cipla / Dolo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pack_size">Pack description</Label>
                <Input id="pack_size" name="pack_size" placeholder="10 x 10 tablets" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "hsn_code")}>
                <Label htmlFor="hsn_code">HSN / SAC code</Label>
                <Input id="hsn_code" name="hsn_code" placeholder="3004.90" />
                {fieldError(formErrors, "hsn_code") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "hsn_code")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Notes / description</Label>
                <Textarea id="description" name="description" rows={2} placeholder="Optional" />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-title-md">Pricing &amp; thresholds</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "mrp")}>
                <Label htmlFor="mrp">MRP (₹) *</Label>
                <Input id="mrp" name="mrp" inputMode="decimal" placeholder="380.00" />
                {fieldError(formErrors, "mrp") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "mrp")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "standard_sale_rate")}>
                <Label htmlFor="standard_sale_rate">Default PTR / sale rate (₹)</Label>
                <Input id="standard_sale_rate" name="standard_sale_rate" inputMode="decimal" placeholder="240.00" />
                {fieldError(formErrors, "standard_sale_rate") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "standard_sale_rate")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_rate">Default purchase rate (₹)</Label>
                <Input id="purchase_rate" name="purchase_rate" inputMode="decimal" placeholder="180.00" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "gst_rate")}>
                <Label htmlFor="gst_rate">GST rate (%)</Label>
                <Input id="gst_rate" name="gst_rate" inputMode="decimal" placeholder="18" defaultValue="18" />
                {fieldError(formErrors, "gst_rate") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "gst_rate")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "reorder_level")}>
                <Label htmlFor="reorder_level">Reorder level (qty)</Label>
                <Input id="reorder_level" name="reorder_level" inputMode="numeric" defaultValue="50" />
                {fieldError(formErrors, "reorder_level") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "reorder_level")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "low_stock_threshold")}>
                <Label htmlFor="low_stock_threshold">Low-stock threshold (qty)</Label>
                <Input id="low_stock_threshold" name="low_stock_threshold" inputMode="numeric" defaultValue="10" />
                {fieldError(formErrors, "low_stock_threshold") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "low_stock_threshold")}</p>
                )}
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-title-md">Batches / stock</CardTitle>
                <CardDescription>
                  Add at least one batch. FEFO expiry order is computed automatically from the expiry date.
                </CardDescription>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addBatch}>
                <Plus className="h-4 w-4" /> Add batch
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {batches.map((b, idx) => (
                <div key={b.key} className="rounded-lg border border-hairline p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-title-sm font-semibold text-ink">Batch #{idx + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove batch"
                      onClick={() => removeBatch(b.key)}
                      className={batches.length === 1 ? "opacity-40" : ""}
                      disabled={batches.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2" data-field-error={!!batchesErrors[idx]?.batch_no}>
                      <Label htmlFor={`batches-${idx}-batch_no`}>Batch number *</Label>
                      <Input
                        id={`batches-${idx}-batch_no`}
                        name={`batches[${idx}].batch_no`}
                        value={b.batch_no}
                        onChange={(e) => updateBatch(b.key, { batch_no: e.target.value })}
                        placeholder="B2026-0925"
                      />
                      {batchesErrors[idx]?.batch_no && (
                        <p className="text-caption text-destructive">{batchesErrors[idx].batch_no}</p>
                      )}
                    </div>
                    <div className="space-y-2" data-field-error={!!batchesErrors[idx]?.manufacture_date}>
                      <Label htmlFor={`batches-${idx}-mfg`}>Manufacture date *</Label>
                      <Input
                        id={`batches-${idx}-mfg`}
                        type="date"
                        name={`batches[${idx}].manufacture_date`}
                        value={b.manufacture_date}
                        onChange={(e) => updateBatch(b.key, { manufacture_date: e.target.value })}
                      />
                      {batchesErrors[idx]?.manufacture_date && (
                        <p className="text-caption text-destructive">{batchesErrors[idx].manufacture_date}</p>
                      )}
                    </div>
                    <div className="space-y-2" data-field-error={!!batchesErrors[idx]?.expiry_date}>
                      <Label htmlFor={`batches-${idx}-exp`}>Expiry date *</Label>
                      <Input
                        id={`batches-${idx}-exp`}
                        type="date"
                        name={`batches[${idx}].expiry_date`}
                        value={b.expiry_date}
                        onChange={(e) => updateBatch(b.key, { expiry_date: e.target.value })}
                      />
                      {batchesErrors[idx]?.expiry_date && (
                        <p className="text-caption text-destructive">{batchesErrors[idx].expiry_date}</p>
                      )}
                    </div>
                    <div className="space-y-2" data-field-error={!!batchesErrors[idx]?.received_qty}>
                      <Label htmlFor={`batches-${idx}-qty`}>Received quantity *</Label>
                      <Input
                        id={`batches-${idx}-qty`}
                        inputMode="numeric"
                        name={`batches[${idx}].received_qty`}
                        value={b.received_qty}
                        onChange={(e) => updateBatch(b.key, { received_qty: e.target.value })}
                        placeholder="500"
                      />
                      {batchesErrors[idx]?.received_qty && (
                        <p className="text-caption text-destructive">{batchesErrors[idx].received_qty}</p>
                      )}
                    </div>
                    <div className="space-y-2" data-field-error={!!batchesErrors[idx]?.mrp}>
                      <Label htmlFor={`batches-${idx}-mrp`}>MRP per unit (₹) *</Label>
                      <Input
                        id={`batches-${idx}-mrp`}
                        inputMode="decimal"
                        name={`batches[${idx}].mrp`}
                        value={b.mrp}
                        onChange={(e) => updateBatch(b.key, { mrp: e.target.value })}
                        placeholder="3.80"
                      />
                      {batchesErrors[idx]?.mrp && (
                        <p className="text-caption text-destructive">{batchesErrors[idx].mrp}</p>
                      )}
                    </div>
                    <div className="space-y-2" data-field-error={!!batchesErrors[idx]?.ptr}>
                      <Label htmlFor={`batches-${idx}-ptr`}>PTR per unit (₹) *</Label>
                      <Input
                        id={`batches-${idx}-ptr`}
                        inputMode="decimal"
                        name={`batches[${idx}].ptr`}
                        value={b.ptr}
                        onChange={(e) => updateBatch(b.key, { ptr: e.target.value })}
                        placeholder="2.40"
                      />
                      {batchesErrors[idx]?.ptr && (
                        <p className="text-caption text-destructive">{batchesErrors[idx].ptr}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Save product</CardTitle>
              <CardDescription>
                Click once. Creating a new product creates all listed batches atomically in one transaction.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-stretch gap-3">
              <div className="text-caption text-muted">
                <ul className="list-disc list-inside space-y-1">
                  <li>Product &amp; batches written in one atomic transaction</li>
                  <li>Available qty initializes to received qty</li>
                  <li>FEFO expiry order computed from expiry date</li>
                  <li>On success you are redirected back to inventory</li>
                </ul>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/inventory">Cancel</Link>
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
      title: "Product created",
      description: "Your new product is now available in inventory.",
      duration: 4500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);
  return null;
}

export default function NewProductPage() {
  return (
    <DashboardLayout>
      <SuccessToastIfCreated />
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/inventory" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">Add product</CardTitle>
            <CardDescription>
              Register a new product master with one or more opening stock batches.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <ProductNewForm />
    </DashboardLayout>
  );
}
