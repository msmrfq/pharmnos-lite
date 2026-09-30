"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, PackagePlus } from "lucide-react";
import { createPurchaseDraftAction } from "@/app/_actions/purchases.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { purchase_invoices } from "@prisma/client";

type LineRow = {
  product_id: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  free_qty: number;
  mrp: number;
  purchase_rate: number;
  sale_rate: number;
  discount_pct: number;
  gst_rate: number;
};

type Props = {
  suppliers: any[];
  products: any[];
};

function fieldError(
  errors: Record<string, string[] | undefined> | undefined,
  field: string,
): string | undefined {
  const e = errors?.[field];
  return e && e.length ? e[0] : undefined;
}

const round2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

function computeLineTotals(row: LineRow) {
  const qty = Number(row.quantity ?? 0);
  const rate = Number(row.purchase_rate ?? 0);
  const discPct = Number(row.discount_pct ?? 0);
  const gstPct = Number(row.gst_rate ?? 0);
  const gross = round2(qty * rate);
  const discount_amount = round2(gross * (discPct / 100));
  const taxable = round2(gross - discount_amount);
  const gst_amount = round2(taxable * (gstPct / 100));
  const line_total = round2(taxable + gst_amount);
  return { gross, discount_amount, gst_amount, line_total };
}

function emptyLine(): LineRow {
  return {
    product_id: "",
    batch_no: "",
    expiry_date: "",
    quantity: 1,
    free_qty: 0,
    mrp: 0,
    purchase_rate: 0,
    sale_rate: 0,
    discount_pct: 0,
    gst_rate: 0,
  };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Save className="h-4 w-4" /> {pending ? "Saving…" : "Save draft"}
    </Button>
  );
}

const initialState: ActionResult<purchase_invoices> = { ok: false };

export default function PurchasesNewClientForm({ suppliers, products }: Props) {
  const [state, action] = useFormState(createPurchaseDraftAction, initialState);
  const errors = state.errors ?? {};
  const { toast } = useToast();
  const params = useSearchParams();
  const [lines, setLines] = useState<LineRow[]>(() => [emptyLine()]);

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  useEffect(() => {
    const created = params.get("created");
    if (created) {
      toast({
        variant: "success",
        title: "Purchase draft saved",
        description: "You can finalize this draft from the purchases list when ready to confirm inward.",
        duration: 5500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("created")]);

  const totals = useMemo(() => {
    const lineTotals = lines.map((l) => computeLineTotals(l));
    const gross_amount = round2(lineTotals.reduce((s, l) => s + l.gross, 0));
    const total_discount = round2(lineTotals.reduce((s, l) => s + l.discount_amount, 0));
    const total_tax = round2(lineTotals.reduce((s, l) => s + l.gst_amount, 0));
    const subtotal = round2(gross_amount - total_discount + total_tax);
    const rounded = Math.round(subtotal * 100) / 100;
    const round_off = round2(Math.round(rounded) - rounded);
    const net_amount = round2(rounded + round_off);
    return { gross_amount, total_discount, total_tax, round_off, net_amount, lineTotals };
  }, [lines]);

  const setLineAt = (idx: number, patch: Partial<LineRow>) => {
    setLines((prev) => {
      const next = prev.slice();
      const row = next[idx];
      if (!row) return prev;
      next[idx] = { ...row, ...patch };
      return next;
    });
  };

  const onProductChange = (idx: number, productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    const patch: Partial<LineRow> = { product_id: productId };
    if (p) {
      patch.gst_rate = Number(p.gst_rate ?? 0);
      if (p.mrp !== null && p.mrp !== undefined) patch.mrp = Number(p.mrp);
      if (p.purchase_rate !== null && p.purchase_rate !== undefined) patch.purchase_rate = Number(p.purchase_rate);
      if (p.standard_sale_rate !== null && p.standard_sale_rate !== undefined) patch.sale_rate = Number(p.standard_sale_rate);
    }
    setLineAt(idx, patch);
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const today = new Date().toISOString().slice(0, 10);

  const rupee = (n: number) =>
    `₹ ${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="invoice_date" value={today} />
      <input type="hidden" name="gross_amount" value={String(totals.gross_amount)} />
      <input type="hidden" name="total_discount" value={String(totals.total_discount)} />
      <input type="hidden" name="total_tax" value={String(totals.total_tax)} />
      <input type="hidden" name="round_off" value={String(totals.round_off)} />
      <input type="hidden" name="net_amount" value={String(totals.net_amount)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Supplier &amp; invoice</CardTitle>
              {state.message && !state.ok && (
                <CardDescription className="text-destructive pt-2">{state.message}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2" data-field-error={!!fieldError(errors, "supplier_id")}>
                <Label htmlFor="supplier_id">Supplier *</Label>
                <Select
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
                        {s.business_name ?? "—"} {s.code ? `(${s.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" id="supplier_id" name="supplier_id" defaultValue="" />
                {fieldError(errors, "supplier_id") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "supplier_id")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_invoice_no">Supplier invoice no.</Label>
                <Input id="supplier_invoice_no" name="supplier_invoice_no" placeholder="e.g. INV/CIP/00219" />
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "invoice_date")}>
                <Label htmlFor="invoice_date_visible">Purchase date</Label>
                <Input id="invoice_date_visible" type="date" defaultValue={today} onChange={(e) => {
                  const h = document.querySelector<HTMLInputElement>('input[name="invoice_date"][type="hidden"]');
                  if (h) h.value = e.target.value;
                }} />
                {fieldError(errors, "invoice_date") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "invoice_date")}</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} placeholder="Optional internal notes…" />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-title-md">Items received</CardTitle>
              <Button size="sm" variant="secondary" type="button" onClick={addLine}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {fieldError(errors, "lines") && (
                <div className="px-4 pt-4">
                  <p className="text-caption text-destructive">{fieldError(errors, "lines")}</p>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Product *</TableHead>
                    <TableHead>Batch *</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Purchase rate</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Line</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((row, idx) => {
                    const lineTotal = totals.lineTotals[idx]?.line_total ?? 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell data-field-error={!!fieldError(errors, `lines[${idx}].product_id`)}>
                          <div className="flex items-center gap-2">
                            <PackagePlus className="h-4 w-4 text-muted shrink-0" />
                            <div className="min-w-0 flex-1">
                              <Select
                                value={row.product_id || undefined}
                                onValueChange={(v) => onProductChange(idx, v)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(products ?? []).map((p: any) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name ?? "—"}{p.sku ? ` (${p.sku})` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <input type="hidden" name={`lines[${idx}].product_id`} value={row.product_id} />
                              {fieldError(errors, `lines[${idx}].product_id`) && (
                                <p className="mt-1 text-caption text-destructive">
                                  {fieldError(errors, `lines[${idx}].product_id`)}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell data-field-error={!!fieldError(errors, `lines[${idx}].batch_no`)}>
                          <Input
                            name={`lines[${idx}].batch_no`}
                            className="h-9 w-28"
                            placeholder="BATCH-01"
                            defaultValue={row.batch_no}
                          />
                          {fieldError(errors, `lines[${idx}].batch_no`) && (
                            <p className="mt-1 text-caption text-destructive">
                              {fieldError(errors, `lines[${idx}].batch_no`)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            name={`lines[${idx}].expiry_date`}
                            type="date"
                            className="h-9 w-36"
                            defaultValue={row.expiry_date}
                          />
                        </TableCell>
                        <TableCell data-field-error={!!fieldError(errors, `lines[${idx}].quantity`)}>
                          <Input
                            name={`lines[${idx}].quantity`}
                            type="number"
                            min={1}
                            step={1}
                            defaultValue={row.quantity}
                            className="h-9 w-20 ml-auto text-right"
                            onChange={(e) => setLineAt(idx, { quantity: Number(e.target.value || 0) })}
                          />
                          {fieldError(errors, `lines[${idx}].quantity`) && (
                            <p className="mt-1 text-caption text-destructive text-right">
                              {fieldError(errors, `lines[${idx}].quantity`)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            name={`lines[${idx}].mrp`}
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={row.mrp}
                            className="h-9 w-24 ml-auto text-right"
                            onChange={(e) => setLineAt(idx, { mrp: Number(e.target.value || 0) })}
                          />
                        </TableCell>
                        <TableCell data-field-error={!!fieldError(errors, `lines[${idx}].purchase_rate`)}>
                          <Input
                            name={`lines[${idx}].purchase_rate`}
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={row.purchase_rate}
                            className="h-9 w-28 ml-auto text-right"
                            onChange={(e) => setLineAt(idx, { purchase_rate: Number(e.target.value || 0) })}
                          />
                          {fieldError(errors, `lines[${idx}].purchase_rate`) && (
                            <p className="mt-1 text-caption text-destructive text-right">
                              {fieldError(errors, `lines[${idx}].purchase_rate`)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            name={`lines[${idx}].discount_pct`}
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={row.discount_pct}
                            className="h-9 w-20 ml-auto text-right"
                            onChange={(e) => setLineAt(idx, { discount_pct: Number(e.target.value || 0) })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            name={`lines[${idx}].gst_rate`}
                            type="number"
                            step="0.01"
                            min={0}
                            defaultValue={row.gst_rate}
                            className="h-9 w-20 ml-auto text-right"
                            onChange={(e) => setLineAt(idx, { gst_rate: Number(e.target.value || 0) })}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-ink whitespace-nowrap">
                          {rupee(lineTotal)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              type="button"
                              aria-label="Remove line"
                              disabled={lines.length <= 1}
                              onClick={() => removeLine(idx)}
                              className={lines.length <= 1 ? "opacity-40 pointer-events-none" : ""}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Totals</CardTitle>
              <CardDescription>
                Client-side preview only — server recomputes on finalize.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-body-md text-body">
                <span>Goods value</span>
                <span>{rupee(totals.gross_amount)}</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>Discount</span>
                <span>- {rupee(totals.total_discount)}</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>Tax (GST)</span>
                <span>+ {rupee(totals.total_tax)}</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>Round off</span>
                <span>{totals.round_off === 0 ? "—" : rupee(totals.round_off)}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-baseline gap-4">
                <span className="text-nav-link font-semibold text-ink">Payable (net)</span>
                <span className="text-title-lg font-semibold text-ink whitespace-nowrap">
                  {rupee(totals.net_amount)}
                </span>
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Stock impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-body-sm text-body">
                Saving this form records a DRAFT. Finalize a draft from the purchase list to create new batches and inward stock movements.
              </p>
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
