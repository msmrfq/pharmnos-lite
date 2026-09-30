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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Save, Package, Calendar } from "lucide-react";
import { createSalesDraftAction } from "@/app/_actions/sales.actions";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { sales_invoices } from "@prisma/client";
import { gstCalculator } from "@/domain/services/gst-calculator.service";
import type { GstPlaceOfSupply } from "@/domain/services/gst-calculator.service";

type BatchLite = {
  id: string;
  product_id: string;
  batch_no: string;
  expiry_date?: Date | string | null;
  available_qty?: number | string | null;
  received_qty?: number | string | null;
};

type LineRow = {
  product_id: string;
  batch_id: string;
  batch_no: string;
  batch_expiry?: string;
  batch_available?: number;
  quantity: number;
  free_qty: number;
  sale_rate: number;
  mrp: number;
  trade_discount_pct: number;
  gst_rate: number;
};

type Props = {
  customers: any[];
  products: any[];
  batches: BatchLite[];
};

function fieldError(
  errors: Record<string, string[] | undefined> | undefined,
  field: string,
): string | undefined {
  const e = errors?.[field];
  return e && e.length ? e[0] : undefined;
}

const round2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : 0);

function emptyLine(): LineRow {
  return {
    product_id: "",
    batch_id: "",
    batch_no: "",
    batch_expiry: "",
    batch_available: 0,
    quantity: 1,
    free_qty: 0,
    sale_rate: 0,
    mrp: 0,
    trade_discount_pct: 0,
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

function FefoBatchPicker({
  product,
  batches,
  onPick,
  disabled,
}: {
  product: any;
  batches: BatchLite[];
  onPick: (b: BatchLite) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const candidates = useMemo(() => {
    if (!product?.id) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return batches
      .filter((b) => b.product_id === product.id)
      .filter((b) => {
        const avail = Number(b.available_qty ?? 0);
        if (avail <= 0) return false;
        if (b.expiry_date) {
          const d = new Date(b.expiry_date);
          d.setHours(0, 0, 0, 0);
          if (d.getTime() < today.getTime()) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ae = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        const be = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
        return ae - be;
      });
  }, [product, batches]);

  const rupee = (n: number) =>
    `₹ ${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || !product?.id || candidates.length === 0}
          className="whitespace-nowrap"
        >
          <Package className="h-3.5 w-3.5" /> Pick FEFO
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>FEFO batch picker — {product?.name ?? "Select product first"}</DialogTitle>
          <DialogDescription>
            Batches sorted by earliest expiry. Choose one batch per line item. For partial depletion across batches, split into multiple lines.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 max-h-80 overflow-auto rounded-md border border-hairline">
          {candidates.length === 0 ? (
            <div className="p-6 text-center text-body-sm text-muted">
              {product?.id ? "No available batches for this product." : "Select a product first."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">MRP</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((b, idx) => {
                  const exp = b.expiry_date ? new Date(b.expiry_date) : null;
                  const expStr = exp
                    ? exp.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                    : "no expiry";
                  const avail = Number(b.available_qty ?? 0);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{b.batch_no}</Badge>
                          {idx === 0 && (
                            <Badge variant="default" className="bg-[#111] text-white">
                              FEFO first
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-body-md">
                          <Calendar className="h-3.5 w-3.5 text-muted" />
                          {expStr}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-ink">{avail}</TableCell>
                      <TableCell className="text-right text-body">
                        {/* MRP not on batch; will be shown from product */}—
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onPick(b);
                            setOpen(false);
                          }}
                        >
                          Pick
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const initialState: ActionResult<sales_invoices> = { ok: false };

export default function BillingNewClientForm({ customers, products, batches }: Props) {
  const [state, action] = useFormState(createSalesDraftAction, initialState);
  const errors = state.errors ?? {};
  const { toast } = useToast();
  const params = useSearchParams();
  const [lines, setLines] = useState<LineRow[]>(() => [emptyLine()]);
  const [customerId, setCustomerId] = useState<string>("");

  useEffect(() => {
    const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state.message, state.ok]);

  useEffect(() => {
    const created = params.get("created");
    if (created) {
      toast({
        variant: "success",
        title: "Invoice draft saved",
        description: "You can finalize this draft from the billing list when ready.",
        duration: 5500,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("created")]);

  const placeOfSupply: GstPlaceOfSupply = useMemo(() => {
    const cust = customers.find((c: any) => c.id === customerId);
    const profileState = gstCalculator.detectPlace("", "") === "INTRA" ? "MAHARASHTRA" : "";
    const custState = String(cust?.billing_state ?? cust?.state ?? "").trim().toUpperCase();
    if (!custState) return "INTRA";
    const ownerState = (profileState || "MAHARASHTRA").toUpperCase();
    if (custState && ownerState && custState !== ownerState) return "INTER";
    return "INTRA";
  }, [customerId, customers]);

  const totals = useMemo(() => {
    const taxableLines = lines.map((l, _idx) => {
      const qty = Number(l.quantity ?? 0);
      const rate = Number(l.sale_rate ?? 0);
      const discPct = Number(l.trade_discount_pct ?? 0);
      const gross = round2(qty * rate);
      const discount_amount = round2(gross * (discPct / 100));
      const taxable_value = round2(gross - discount_amount);
      return {
        taxable_value,
        gst_rate_pct: Number(l.gst_rate ?? 0),
      };
    });
    const gstTotals = gstCalculator.computeTotals(taxableLines, { placeOfSupply });
    const gross_amount = round2(
      lines.reduce((s, l) => s + round2(Number(l.quantity ?? 0) * Number(l.sale_rate ?? 0)), 0),
    );
    const total_discount = round2(
      lines.reduce((s, l) => {
        const g = round2(Number(l.quantity ?? 0) * Number(l.sale_rate ?? 0));
        return s + round2(g * (Number(l.trade_discount_pct ?? 0) / 100));
      }, 0),
    );
    const net_amount = round2(gstTotals.grand_total);
    return {
      gross_amount,
      total_discount,
      total_tax: round2(gstTotals.total_tax),
      total_cgst: round2(gstTotals.total_cgst),
      total_sgst: round2(gstTotals.total_sgst),
      total_igst: round2(gstTotals.total_igst),
      round_off: round2(gstTotals.round_off_applied),
      net_amount,
      gstTotals,
    };
  }, [lines, placeOfSupply]);

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
    const patch: Partial<LineRow> = {
      product_id: productId,
      batch_id: "",
      batch_no: "",
      batch_expiry: "",
      batch_available: 0,
    };
    if (p) {
      patch.gst_rate = Number(p.gst_rate ?? 0);
      if (p.mrp !== null && p.mrp !== undefined) patch.mrp = Number(p.mrp);
      if (p.standard_sale_rate !== null && p.standard_sale_rate !== undefined)
        patch.sale_rate = Number(p.standard_sale_rate);
    }
    setLineAt(idx, patch);
  };

  const onPickBatch = (idx: number, b: BatchLite) => {
    const exp = b.expiry_date
      ? new Date(b.expiry_date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
      : "";
    setLineAt(idx, {
      batch_id: b.id,
      batch_no: b.batch_no,
      batch_expiry: exp,
      batch_available: Number(b.available_qty ?? 0),
    });
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const today = new Date().toISOString().slice(0, 10);

  const rupee = (n: number) =>
    `₹ ${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

  const computeLineTotal = (row: LineRow) => {
    const qty = Number(row.quantity ?? 0);
    const rate = Number(row.sale_rate ?? 0);
    const discPct = Number(row.trade_discount_pct ?? 0);
    const gstPct = Number(row.gst_rate ?? 0);
    const gross = round2(qty * rate);
    const discount_amount = round2(gross * (discPct / 100));
    const taxable = round2(gross - discount_amount);
    const gst_amount = round2(taxable * (gstPct / 100));
    return round2(taxable + gst_amount);
  };

  return (
    <form action={action} className="w-full">
      <input type="hidden" name="invoice_date" value={today} />
      <input type="hidden" name="payment_terms_days" defaultValue={0} />
      <input type="hidden" name="gross_amount" value={String(totals.gross_amount)} />
      <input type="hidden" name="total_discount" value={String(totals.total_discount)} />
      <input type="hidden" name="total_tax" value={String(totals.total_tax)} />
      <input type="hidden" name="round_off" value={String(totals.round_off)} />
      <input type="hidden" name="net_amount" value={String(totals.net_amount)} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Customer &amp; invoice</CardTitle>
              {state.message && !state.ok && (
                <CardDescription className="text-destructive pt-2">{state.message}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div
                className="space-y-2 sm:col-span-2"
                data-field-error={!!fieldError(errors, "customer_id")}
              >
                <Label htmlFor="customer_id">Customer *</Label>
                <Select
                  value={customerId || undefined}
                  onValueChange={(v) => {
                    setCustomerId(v);
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
                        {c.business_name ?? c.customer_name ?? "—"}{c.code ? ` (${c.code})` : ""}
                        {c.billing_state ? ` · ${c.billing_state}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" id="customer_id" name="customer_id" defaultValue="" />
                {fieldError(errors, "customer_id") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "customer_id")}</p>
                )}
              </div>
              <div className="space-y-2" data-field-error={!!fieldError(errors, "invoice_date")}>
                <Label htmlFor="invoice_date_visible">Invoice date</Label>
                <Input
                  id="invoice_date_visible"
                  type="date"
                  defaultValue={today}
                  onChange={(e) => {
                    const h = document.querySelector<HTMLInputElement>(
                      'input[name="invoice_date"][type="hidden"]',
                    );
                    if (h) h.value = e.target.value;
                  }}
                />
                {fieldError(errors, "invoice_date") && (
                  <p className="text-caption text-destructive">{fieldError(errors, "invoice_date")}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference_no">Ref no. (optional)</Label>
                <Input id="reference_no" name="reference_no" placeholder="e.g. PO-00421" />
              </div>
              <div className="space-y-2 sm:col-span-2 flex items-center gap-3 pt-1">
                <input
                  type="hidden"
                  name="is_cash_sale"
                  value="off"
                />
                <input
                  id="is_cash_sale"
                  name="is_cash_sale"
                  type="checkbox"
                  className="h-4 w-4 rounded border-hairline accent-[#111]"
                />
                <Label htmlFor="is_cash_sale" className="!mt-0 cursor-pointer select-none">
                  Cash sale (no receivable)
                </Label>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} placeholder="Optional internal notes…" />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-title-md">Line items</CardTitle>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Product *</TableHead>
                      <TableHead className="min-w-[140px]">Batch / FEFO</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Sale rate</TableHead>
                      <TableHead className="text-right">Disc %</TableHead>
                      <TableHead className="text-right">GST %</TableHead>
                      <TableHead className="text-right">Line</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((row, idx) => {
                      const lineTotal = computeLineTotal(row);
                      const productForLine = products.find((p: any) => p.id === row.product_id);
                      const availWarn =
                        row.quantity > 0 &&
                        Number(row.batch_available ?? 0) > 0 &&
                        Number(row.quantity) > Number(row.batch_available ?? 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell
                            data-field-error={!!fieldError(errors, `lines[${idx}].product_id`)}
                          >
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted shrink-0" />
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
                                <input
                                  type="hidden"
                                  name={`lines[${idx}].product_id`}
                                  value={row.product_id}
                                />
                                {fieldError(errors, `lines[${idx}].product_id`) && (
                                  <p className="mt-1 text-caption text-destructive">
                                    {fieldError(errors, `lines[${idx}].product_id`)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-field-error={!!fieldError(errors, `lines[${idx}].batch_id`)}>
                            <div className="space-y-2 min-w-[180px]">
                              <FefoBatchPicker
                                product={productForLine}
                                batches={batches}
                                onPick={(b) => onPickBatch(idx, b)}
                              />
                              {row.batch_no && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{row.batch_no}</Badge>
                                </div>
                              )}
                              <input
                                type="hidden"
                                name={`lines[${idx}].batch_id`}
                                value={row.batch_id}
                              />
                              <input
                                type="hidden"
                                name={`lines[${idx}].batch_no`}
                                value={row.batch_no}
                              />
                              {fieldError(errors, `lines[${idx}].batch_id`) && (
                                <p className="text-caption text-destructive">
                                  {fieldError(errors, `lines[${idx}].batch_id`)}
                                </p>
                              )}
                              {fieldError(errors, `lines[${idx}].batch_no`) && (
                                <p className="text-caption text-destructive">
                                  {fieldError(errors, `lines[${idx}].batch_no`)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-body">
                            {row.batch_expiry || (
                              <span className="text-muted italic">pick batch</span>
                            )}
                          </TableCell>
                          <TableCell data-field-error={!!fieldError(errors, `lines[${idx}].quantity`)}>
                            <div>
                              <Input
                                name={`lines[${idx}].quantity`}
                                type="number"
                                min={1}
                                step={1}
                                defaultValue={row.quantity}
                                className="h-9 w-20 ml-auto text-right"
                                onChange={(e) =>
                                  setLineAt(idx, { quantity: Number(e.target.value || 0) })
                                }
                              />
                              {availWarn && (
                                <p className="mt-1 text-caption text-destructive text-right">
                                  Exceeds available ({row.batch_available})
                                </p>
                              )}
                              {fieldError(errors, `lines[${idx}].quantity`) && (
                                <p className="mt-1 text-caption text-destructive text-right">
                                  {fieldError(errors, `lines[${idx}].quantity`)}
                                </p>
                              )}
                            </div>
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
                          <TableCell
                            data-field-error={!!fieldError(errors, `lines[${idx}].sale_rate`)}
                          >
                            <Input
                              name={`lines[${idx}].sale_rate`}
                              type="number"
                              step="0.01"
                              min={0}
                              defaultValue={row.sale_rate}
                              className="h-9 w-28 ml-auto text-right"
                              onChange={(e) => setLineAt(idx, { sale_rate: Number(e.target.value || 0) })}
                            />
                            {fieldError(errors, `lines[${idx}].sale_rate`) && (
                              <p className="mt-1 text-caption text-destructive text-right">
                                {fieldError(errors, `lines[${idx}].sale_rate`)}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              name={`lines[${idx}].trade_discount_pct`}
                              type="number"
                              step="0.01"
                              min={0}
                              defaultValue={row.trade_discount_pct}
                              className="h-9 w-20 ml-auto text-right"
                              onChange={(e) =>
                                setLineAt(idx, {
                                  trade_discount_pct: Number(e.target.value || 0),
                                })
                              }
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
              </div>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Totals</CardTitle>
              <CardDescription>
                Client-side preview — server recomputes on finalize. {String(placeOfSupply) === "INTER" ? "Inter-state (IGST)." : "Intra-state (CGST+SGST)."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-body-md text-body">
                <span>Goods value</span>
                <span>{rupee(totals.gross_amount)}</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>Trade discount</span>
                <span>- {rupee(totals.total_discount)}</span>
              </div>
              {String(placeOfSupply) === "INTER" ? (
                <div className="flex justify-between text-body-md text-body">
                  <span>IGST</span>
                  <span>+ {rupee(totals.total_igst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-body-md text-body">
                    <span>CGST</span>
                    <span>+ {rupee(totals.total_cgst)}</span>
                  </div>
                  <div className="flex justify-between text-body-md text-body">
                    <span>SGST</span>
                    <span>+ {rupee(totals.total_sgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-body-md text-body">
                <span>Round off</span>
                <span>{totals.round_off === 0 ? "—" : rupee(totals.round_off)}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-baseline gap-4">
                <span className="text-nav-link font-semibold text-ink">Grand total</span>
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
                Saving this form records a DRAFT. Finalize from the billing list to deduct FEFO batches, record outward stock movements, and update the customer ledger.
              </p>
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
