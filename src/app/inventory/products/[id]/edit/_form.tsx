"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, Save, Warehouse } from "lucide-react";
import { updateProductAction } from "@/app/_actions/masters.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { products } from "@prisma/client";
import { ScheduleClass } from "@prisma/client";

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

const initialState: ActionResult<products> = { ok: false };

export default function ProductEditForm({
  productId,
  existing,
  batches = [],
}: {
  productId: string;
  existing: any;
  batches?: any[];
}) {
  const bound = (updateProductAction as any).bind(null, productId);
  const [state, action] = useFormState<ActionResult<products>, FormData>(bound, initialState);
  const [schedule, setSchedule] = useState<string>(String(existing?.schedule_classification ?? ScheduleClass.OTC));
  const formErrors = state.errors ?? {};

  const formatDate = (v: any): string => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  void formatDate;

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
        <input type="hidden" name="schedule_classification" value={schedule} />

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
                <Input
                  id="name"
                  name="name"
                  defaultValue={str(existing?.name)}
                  placeholder="Paracetamol 500mg Tablet (10x10)"
                  aria-invalid={!!fieldError(formErrors, "name")}
                />
                {fieldError(formErrors, "name") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "name")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "sku")}>
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  name="sku"
                  defaultValue={str(existing?.sku)}
                  placeholder="PCM-500-100"
                  aria-invalid={!!fieldError(formErrors, "sku")}
                />
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
                <Input
                  id="generic_name"
                  name="generic_name"
                  defaultValue={str(existing?.generic_name)}
                  placeholder="Paracetamol IP 500mg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer / brand</Label>
                <Input
                  id="manufacturer"
                  name="manufacturer"
                  defaultValue={str(existing?.manufacturer)}
                  placeholder="Cipla / Dolo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pack_size">Pack description</Label>
                <Input
                  id="pack_size"
                  name="pack_size"
                  defaultValue={str(existing?.pack_size)}
                  placeholder="10 x 10 tablets"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "hsn_code")}>
                <Label htmlFor="hsn_code">HSN / SAC code</Label>
                <Input
                  id="hsn_code"
                  name="hsn_code"
                  defaultValue={str(existing?.hsn_code)}
                  placeholder="3004.90"
                />
                {fieldError(formErrors, "hsn_code") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "hsn_code")}</p>
                )}
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
                <Input
                  id="mrp"
                  name="mrp"
                  inputMode="decimal"
                  defaultValue={numStr(existing?.mrp, "")}
                  placeholder="380.00"
                />
                {fieldError(formErrors, "mrp") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "mrp")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "standard_sale_rate")}>
                <Label htmlFor="standard_sale_rate">Default PTR / sale rate (₹)</Label>
                <Input
                  id="standard_sale_rate"
                  name="standard_sale_rate"
                  inputMode="decimal"
                  defaultValue={numStr(existing?.standard_sale_rate, "")}
                  placeholder="240.00"
                />
                {fieldError(formErrors, "standard_sale_rate") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "standard_sale_rate")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase_rate">Default purchase rate (₹)</Label>
                <Input
                  id="purchase_rate"
                  name="purchase_rate"
                  inputMode="decimal"
                  defaultValue={numStr(existing?.purchase_rate, "")}
                  placeholder="180.00"
                />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "gst_rate")}>
                <Label htmlFor="gst_rate">GST rate (%)</Label>
                <Input
                  id="gst_rate"
                  name="gst_rate"
                  inputMode="decimal"
                  defaultValue={numStr(existing?.gst_rate, "")}
                  placeholder="18"
                />
                {fieldError(formErrors, "gst_rate") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "gst_rate")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(formErrors, "reorder_level")}>
                <Label htmlFor="reorder_level">Reorder level (qty)</Label>
                <Input
                  id="reorder_level"
                  name="reorder_level"
                  inputMode="numeric"
                  defaultValue={numStr(existing?.reorder_level, "50")}
                />
                {fieldError(formErrors, "reorder_level") && (
                  <p className="text-caption text-destructive">{fieldError(formErrors, "reorder_level")}</p>
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
                    Active (appears in sales lists and search). Uncheck to soft-delete.
                  </Label>
                </div>
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Save product</CardTitle>
              <CardDescription>
                Pricing and thresholds apply to new orders. Batch stock and expiry adjusted via purchases and stock adjustments.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-stretch gap-3">
              <div className="text-caption text-muted">
                <ul className="list-disc list-inside space-y-1">
                  <li>Product metadata updated atomically</li>
                  <li>Batch quantity and expiry not editable here</li>
                  <li>On success you are redirected back to inventory</li>
                  <li>Unchecking Active keeps all invoices and ledger history intact</li>
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

      <div id="batches" className="scroll-mt-20">
        <CardCanvas className="mt-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-title-md flex items-center gap-2">
              <Warehouse className="h-5 w-5" /> Existing batches
            </CardTitle>
            <CardDescription>
              Read-only view. Batches are created by purchase invoices and adjusted via Inventory → Adjust stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch no.</TableHead>
                  <TableHead className="text-right">Expiry</TableHead>
                  <TableHead className="text-right">Received qty</TableHead>
                  <TableHead className="text-right">Available qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted text-body-md">
                      No batches yet. Create a purchase invoice for this product to receive stock into a batch.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b: any) => {
                    const received = Number(b.received_qty ?? 0);
                    const avail = Number(b.available_qty ?? 0);
                    const exp = b.expiry_date ? new Date(b.expiry_date) : null;
                    const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                    const expStr = exp ? exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                    const variant: any = b.is_blocked ? "secondary" : daysLeft <= 0 ? "destructive" : daysLeft <= 90 ? "warning" : "success";
                    const label = b.is_blocked ? "Blocked" : daysLeft <= 0 ? "Expired" : daysLeft <= 90 ? `${daysLeft}d left` : "Active";
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{b.batch_no}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-body">{expStr}</TableCell>
                        <TableCell className="text-right text-body">{received}</TableCell>
                        <TableCell className={`text-right font-semibold ${avail <= 0 ? "text-destructive" : "text-ink"}`}>{avail}</TableCell>
                        <TableCell>
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </CardCanvas>
      </div>
    </form>
  );
}
void DashboardLayout;
