import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Share2, Pill, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardCanvas, CardContent } from "@/components/ui/card";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { buildInvoicePrintSnapshot, selectFinalizedInvoiceValue } from "@/domain/services/gst-calculator.service";
import { loadBillingInvoicePrintData } from "./data";
import {
  amountInWords,
  PHARMNOS_PLATFORM_FOOTER,
  stableInvoiceReferences,
  summarizeInvoiceTax,
} from "@/domain/services/invoice-modernization.service";
import {
  renderInvoiceBarcodeDataUrl,
  renderInvoiceQrDataUrl,
} from "@/domain/services/invoice-document.service";

export const metadata: Metadata = {
  title: "Print invoice",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
};

const formatDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default async function BillingInvoicePrintPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  let dbOk = isPostgresConfigured();
  let ctx: any = null;
  let rawInvoice: any = null;
  let businessProfile: any = null;
  let tenant: any = null;
  let notFoundFlag = false;

  if (dbOk) {
    try {
      const loaded = await loadBillingInvoicePrintData(params.invoiceId);
      ctx = loaded.ctx;
      rawInvoice = loaded.rawInvoice;
      businessProfile = loaded.businessProfile;
      tenant = loaded.tenant;
      if (!rawInvoice) {
        notFoundFlag = true;
      }
    } catch (_err) {
      dbOk = false;
    }
  }
  if (notFoundFlag) {
    return (
      <DashboardLayout>
        <PrintToolbar
          backHref="/billing"
          backLabel="Back to billing"
          title="Invoice not found"
        />
        <CardCanvas>
          <CardContent className="py-10 text-center">
            <p className="text-body-md text-destructive">
              Invoice not found or you do not have access.
            </p>
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/billing">Back to billing</Link>
              </Button>
            </div>
          </CardContent>
        </CardCanvas>
      </DashboardLayout>
    );
  }
  if (!dbOk) {
    return (
      <DashboardLayout>
        <PrintToolbar
          backHref="/billing"
          backLabel="Back to billing"
          title="Print invoice"
        />
        <CardCanvas>
          <CardContent className="space-y-3 py-10 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-600" />
            <p className="text-body-md text-amber-800">
              Showing placeholder invoice preview until database is connected — try again in 60 seconds.
            </p>
          </CardContent>
        </CardCanvas>
      </DashboardLayout>
    );
  }
  const finalizedSnapshot =
    rawInvoice.status === "FINALIZED" &&
    rawInvoice.finalized_snapshot &&
    typeof rawInvoice.finalized_snapshot === "object" &&
    rawInvoice.finalized_snapshot.kind === "sales_invoice"
      ? rawInvoice.finalized_snapshot as Record<string, any>
      : null;
  const invoice: any = finalizedSnapshot
    ? {
        ...rawInvoice,
        invoice_no: finalizedSnapshot.invoiceNo,
        invoice_date: finalizedSnapshot.invoiceDate,
        tax_data_status: "COMPLETE",
        seller_name_snapshot: finalizedSnapshot.seller?.name ?? null,
        seller_address_line_1_snapshot: finalizedSnapshot.seller?.addressLine1 ?? null,
        seller_address_line_2_snapshot: finalizedSnapshot.seller?.addressLine2 ?? null,
        seller_city_snapshot: finalizedSnapshot.seller?.city ?? null,
        seller_state_snapshot: finalizedSnapshot.seller?.state ?? null,
        seller_pincode_snapshot: finalizedSnapshot.seller?.pincode ?? null,
        seller_gstin_snapshot: finalizedSnapshot.seller?.gstin ?? null,
        customer_name_snapshot: finalizedSnapshot.buyer?.name ?? null,
        customer_address_line_1_snapshot: finalizedSnapshot.buyer?.addressLine1 ?? null,
        customer_address_line_2_snapshot: finalizedSnapshot.buyer?.addressLine2 ?? null,
        customer_city_snapshot: finalizedSnapshot.buyer?.city ?? null,
        customer_state_snapshot: finalizedSnapshot.buyer?.state ?? null,
        customer_pincode_snapshot: finalizedSnapshot.buyer?.pincode ?? null,
        customer_gstin_snapshot: finalizedSnapshot.buyer?.gstin ?? null,
        place_of_supply_code: finalizedSnapshot.placeOfSupplyCode ?? null,
        gross_amount: finalizedSnapshot.totals?.gross ?? 0,
        total_discount: finalizedSnapshot.totals?.discount ?? 0,
        total_tax: finalizedSnapshot.totals?.tax ?? 0,
        round_off: finalizedSnapshot.totals?.roundOff ?? 0,
        net_amount: finalizedSnapshot.totals?.payable ?? 0,
        items: (finalizedSnapshot.lines ?? []).map((line: any, index: number) => ({
          id: `${rawInvoice.id}-snapshot-${index}`,
          product_name_snapshot: line.product,
          generic_name_snapshot: line.genericName ?? null,
          hsn_code_snapshot: line.hsn,
          batch_no: line.batchNo,
          batch_expiry_snapshot: line.expiry,
          quantity: line.quantity,
          free_qty: 0,
          sale_rate: line.totalAmount && line.quantity ? Number(line.totalAmount) / Number(line.quantity) : 0,
          line_total: line.totalAmount,
          gst_rate: line.gstRate,
          cgst_amount: line.cgstAmount ?? 0,
          sgst_amount: line.sgstAmount ?? 0,
          igst_amount: line.igstAmount ?? 0,
          cess_amount: line.cessAmount ?? 0,
          product: null,
          batch: null,
        })),
        customer: null,
      }
    : rawInvoice;
  if (finalizedSnapshot) {
    businessProfile = null;
  }
  const hasCompleteTaxData = invoice.tax_data_status === "COMPLETE";
  const printSnapshot = buildInvoicePrintSnapshot(
    invoice,
    tenant?.business_name ?? null,
  );
  const snapshot = <T,>(value: T | null | undefined, current: T | null | undefined) =>
    selectFinalizedInvoiceValue(hasCompleteTaxData, value, current);

  const displayBusinessName = printSnapshot.sellerName;

  const businessAddressParts = [
    snapshot(invoice.seller_address_line_1_snapshot, businessProfile?.address_line_1),
    snapshot(invoice.seller_address_line_2_snapshot, businessProfile?.address_line_2),
    [snapshot(invoice.seller_city_snapshot, businessProfile?.city), snapshot(invoice.seller_state_snapshot, businessProfile?.state), snapshot(invoice.seller_pincode_snapshot, businessProfile?.pincode)]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const customer = invoice.customer;
  const customerAddressParts = [
    snapshot(invoice.customer_address_line_1_snapshot, customer?.billing_address_1),
    snapshot(invoice.customer_address_line_2_snapshot, customer?.billing_address_2),
    [snapshot(invoice.customer_city_snapshot, customer?.billing_city), snapshot(invoice.customer_state_snapshot, customer?.billing_state), snapshot(invoice.customer_pincode_snapshot, customer?.billing_pincode)]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const items = invoice.items;

  const gross = Number(invoice.gross_amount ?? 0);
  const discount = Number(invoice.total_discount ?? 0);
  const tax = Number(invoice.total_tax ?? 0);
  const roundOff = Number(invoice.round_off ?? 0);
  const net = Number(invoice.net_amount ?? 0);
  const taxSummary = summarizeInvoiceTax(items.map((item: any) => ({
    cgst: Number(item.cgst_amount ?? 0),
    sgst: Number(item.sgst_amount ?? 0),
    igst: Number(item.igst_amount ?? 0),
    cess: Number(item.cess_amount ?? 0),
  })));
  const invoiceReferences = stableInvoiceReferences(invoice.id, invoice.invoice_no || "DRAFT");
  const qrDataUrl = invoice.status === "FINALIZED" ? await renderInvoiceQrDataUrl(invoice.id, invoice.invoice_no) : null;
  const barcodeDataUrl = invoice.status === "FINALIZED" ? await renderInvoiceBarcodeDataUrl(invoice.id, invoice.invoice_no) : null;

  const isDraftOrCancelled =
    invoice.status === "DRAFT" || invoice.status === "CANCELLED";
  const statusColor =
    invoice.status === "CANCELLED"
      ? "bg-semantic-error/10 text-semantic-error border-semantic-error/30"
      : "bg-semantic-warning/10 text-semantic-warning border-semantic-warning/30";

  return (
    <DashboardLayout>
      <PrintToolbar
        backHref="/billing"
        backLabel="Back"
        title={`Invoice ${invoice.invoice_no || "DRAFT"}`}
      >
        <Button variant="secondary" size="sm" disabled aria-label="Share disabled">
          <Share2 className="h-4 w-4 opacity-50" />
          <span className="opacity-50">Share</span>
        </Button>
      </PrintToolbar>

      {isDraftOrCancelled && (
        <div
          className={cn(
            "no-print mb-6 rounded-lg border p-5",
            statusColor,
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-title-sm font-semibold">
                  This invoice is {invoice.status}. Print not finalized.
                </p>
                <p className="mt-1 text-body-sm opacity-90">
                  Totals and tax split shown are preliminary. Finalize the invoice to lock stock
                  movements and receivables before printing for the customer.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link href={`/billing/${params.invoiceId}/edit`}>
                Edit invoice
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════ A4 LETTERHEAD LAYOUT ═══════════════ */}
      <div className="invoice-print mx-auto w-full max-w-[297mm] bg-canvas lg:rounded-lg lg:border lg:border-hairline lg:shadow-sm">
        <div className="print-break-inside-avoid p-[12mm_14mm]">
          {/* Letterhead */}
          <div className="flex items-start justify-between gap-6 border-b border-hairline pb-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-primary">
                <Pill className="h-7 w-7 text-on-primary" strokeWidth={2.25} />
              </div>
              <div>
                <h1 className="text-display-sm font-bold tracking-brand text-ink">
                  {displayBusinessName || "Seller identity unavailable"}
                </h1>
                {businessAddressParts.length > 0 && (
                  <p className="mt-1 text-body-sm text-body whitespace-pre-line">
                    {businessAddressParts.join("\n")}
                  </p>
                )}
                {!businessAddressParts.length && (
                  <p className="mt-1 text-body-sm text-muted">
                    Seller address was not snapshotted on this invoice.
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted">
                  {snapshot(invoice.seller_gstin_snapshot, businessProfile?.gstin) && (
                    <span>
                      <span className="font-semibold text-body">GSTIN:</span>{" "}
                      {snapshot(invoice.seller_gstin_snapshot, businessProfile?.gstin)}
                    </span>
                  )}
                  {snapshot(invoice.seller_state_snapshot, businessProfile?.state) && (
                    <span>
                      <span className="font-semibold text-body">State:</span>{" "}
                      {snapshot(invoice.seller_state_snapshot, businessProfile?.state)}
                    </span>
                  )}
                  {businessProfile?.drug_license_no_1 && (
                    <span>
                      <span className="font-semibold text-body">DL No.:</span>{" "}
                      {businessProfile.drug_license_no_1}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <h2 className="text-display-md font-bold tracking-brand text-ink uppercase">
                Tax Invoice
              </h2>
              <div className="mt-3 space-y-1.5 text-body-sm">
                <div className="flex justify-end gap-4">
                  <span className="text-muted">Invoice No.</span>
                  <span className="font-semibold text-ink">
                    {invoice.invoice_no || "DRAFT"}
                  </span>
                </div>
                <div className="flex justify-end gap-4">
                  <span className="text-muted">Date</span>
                  <span className="font-medium text-ink">
                    {formatDate(invoice.invoice_date)}
                  </span>
                </div>
                <div className="flex justify-end gap-4">
                  <span className="text-muted">Status</span>
                  <Badge
                    variant={
                      invoice.status === "FINALIZED"
                        ? "success"
                        : invoice.status === "CANCELLED"
                          ? "destructive"
                          : "warning"
                    }
                    className="text-[11px]"
                  >
                    {invoice.status ?? "DRAFT"}
                  </Badge>
                </div>
                {invoice.is_cash_sale && (
                  <div className="flex justify-end gap-4 pt-1">
                    <Badge variant="outline" className="text-[11px]">
                      Cash Sale
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                Bill To
              </p>
              <div className="mt-2">
                <p className="text-title-sm font-semibold text-ink">
                  {printSnapshot.customerName ??
                    (invoice.is_cash_sale ? "Cash Customer" : "Walk-in Customer")}
                </p>
                {customer?.contact_person && (
                  <p className="mt-0.5 text-body-sm text-body">
                    {customer.contact_person}
                  </p>
                )}
                {customerAddressParts.length > 0 && (
                  <p className="mt-1 text-body-sm text-body whitespace-pre-line">
                    {customerAddressParts.join("\n")}
                  </p>
                )}
                <div className="mt-2 space-y-0.5 text-caption text-muted">
                  {snapshot(invoice.customer_gstin_snapshot, customer?.gstin) && (
                    <div>
                      <span className="font-semibold text-body">GSTIN:</span>{" "}
                      {snapshot(invoice.customer_gstin_snapshot, customer?.gstin)}
                    </div>
                  )}
                  {customer?.mobile && (
                    <div>
                      <span className="font-semibold text-body">Mobile:</span>{" "}
                      {customer.mobile}
                    </div>
                  )}
                  {customer?.phone && !customer?.mobile && (
                    <div>
                      <span className="font-semibold text-body">Phone:</span>{" "}
                      {customer.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                Ship To
              </p>
              <div className="mt-2">
                <p className="text-title-sm font-semibold text-ink">
                  {snapshot(invoice.customer_name_snapshot, customer?.business_name) ??
                    (invoice.is_cash_sale ? "Cash Customer" : "Walk-in Customer")}
                </p>
                {customerAddressParts.length > 0 && (
                  <p className="mt-1 text-body-sm text-body whitespace-pre-line">
                    {customerAddressParts.join("\n")}
                  </p>
                )}
                {!customerAddressParts.length && customer && (
                  <p className="mt-1 text-body-sm text-muted">
                    Same as billing address
                  </p>
                )}
              </div>
              <div className="mt-4 rounded-md bg-surface-soft p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-caption text-muted">GST Treatment</p>
                    <p className="text-body-sm font-semibold text-ink mt-0.5">
                      {invoice.gst_treatment ?? "Unavailable (not persisted)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-caption text-muted">Tax mode</p>
                    <p className="text-body-sm font-semibold text-ink mt-0.5">
                      {invoice.tax_mode === "INCLUSIVE" ? "Tax inclusive" : "Tax exclusive"}
                    </p>
                  </div>
                  <div>
                <p className="text-caption text-muted">Place of Supply</p>
                <p className="text-body-sm font-semibold text-ink mt-0.5">
                  {invoice.place_of_supply_code ?? "Unavailable (not persisted)"}
                </p>
                  </div>
                </div>
                <p className="mt-1 text-caption text-muted">
                  {hasCompleteTaxData
                    ? "Finalized tax and snapshot facts are persisted."
                    : "Seller and customer details are current records; historical snapshots are not stored."}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table — 9 cols */}
          <div className="pt-6">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-left text-caption font-semibold text-muted w-10">
                    Sr
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-left text-caption font-semibold text-muted">
                    Item
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-left text-caption font-semibold text-muted w-20">
                    HSN
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-left text-caption font-semibold text-muted w-24">
                    Batch
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-left text-caption font-semibold text-muted w-20">
                    Expiry
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-right text-caption font-semibold text-muted w-16">
                    Qty
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-right text-caption font-semibold text-muted w-24">
                    Rate
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-right text-caption font-semibold text-muted w-28">
                    Amount
                  </th>
                  <th className="border border-hairline bg-surface-soft px-2 py-2 text-right text-caption font-semibold text-muted w-40">
                    Tax Split
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="border border-hairline px-2 py-8 text-center text-body-sm text-muted"
                    >
                      No items in this invoice.
                    </td>
                  </tr>
                ) : (
                  items.map((it: any, idx: number) => {
                    const qty = Number(it.quantity ?? 0);
                    const free = Number(it.free_qty ?? 0);
                    const rate = Number(it.sale_rate ?? 0);
                    const amt = Number(it.line_total ?? 0);
                    const exp = snapshot(it.batch_expiry_snapshot, it.batch?.expiry_date ?? (it as any).expiry_date);
                    return (
                      <tr key={it.id} className="align-top">
                        <td className="border border-hairline px-2 py-2 text-body">
                          {idx + 1}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body">
                          <p className="font-medium text-ink">
                            {printSnapshot.items[idx]?.productName ?? "—"}
                          </p>
                          {snapshot(it.generic_name_snapshot, it.product?.generic_name) && (
                            <p className="text-caption text-muted">
                              {snapshot(it.generic_name_snapshot, it.product?.generic_name)}
                            </p>
                          )}
                          {Number(it.gst_rate ?? 0) > 0 && (
                            <p className="text-caption text-muted mt-0.5">
                              GST {Number(it.gst_rate).toFixed(2)}%
                            </p>
                          )}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body text-muted">
                          {printSnapshot.items[idx]?.hsnCode ?? "—"}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body font-medium text-ink">
                          {it.batch_no ?? "—"}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body text-muted whitespace-nowrap">
                          {formatDate(exp)}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body text-right font-medium text-ink whitespace-nowrap">
                          {qty}
                          {free > 0 && (
                            <span className="text-caption text-muted">
                              {" "}
                              +{free}
                            </span>
                          )}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body text-right text-ink whitespace-nowrap">
                          {rupee(rate)}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-body text-right font-medium text-ink whitespace-nowrap">
                          {rupee(amt)}
                        </td>
                        <td className="border border-hairline px-2 py-2 text-caption text-right whitespace-nowrap">
                          {hasCompleteTaxData ? (
                            <span className="text-muted">
                              {Number(it.cgst_amount ?? 0) > 0 && `CGST ${rupee(it.cgst_amount)} `}
                              {Number(it.sgst_amount ?? 0) > 0 && `SGST ${rupee(it.sgst_amount)} `}
                              {Number(it.igst_amount ?? 0) > 0 && `IGST ${rupee(it.igst_amount)} `}
                              {Number(it.cess_amount ?? 0) > 0 && `Cess ${rupee(it.cess_amount)}`}
                            </span>
                          ) : (
                            <span className="text-muted">Tax split unavailable</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-12">
            <div className="md:col-span-6">
              {invoice.notes && (
                <div className="rounded-md border border-hairline bg-surface-soft/50 p-4">
                  <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                    Notes
                  </p>
                  <p className="mt-1 text-body-sm text-body whitespace-pre-line">
                    {invoice.notes}
                  </p>
                </div>
              )}
              <div className="mt-6">
                <p className="text-caption text-muted mb-1">
                  Total items: {items.length}
                </p>
                <div className="space-y-0.5 text-caption text-muted">
                  <div>
                    {hasCompleteTaxData
                      ? `Persisted tax components; aggregate tax: ${rupee(tax)}`
                      : `Tax component breakdown unavailable; persisted aggregate tax: ${rupee(tax)}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-6">
              <div className="overflow-hidden rounded-lg border border-hairline">
                <div className="divide-y divide-hairline">
                  <div className="flex items-center justify-between px-4 py-2.5 text-body-sm">
                    <span className="text-muted">Gross Amount</span>
                    <span className="font-medium text-ink">{rupee(gross)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-body-sm">
                      <span className="text-muted">Less Discount</span>
                      <span className="font-medium text-emerald-700">
                        − {rupee(discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5 text-body-sm">
                    <span className="text-muted">Tax{hasCompleteTaxData ? "" : " (unresolved)"}</span>
                    <span className="font-medium text-ink">{rupee(tax)}</span>
                  </div>
                  {taxSummary.cgst > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-caption">
                      <span className="text-muted">CGST</span><span>{rupee(taxSummary.cgst)}</span>
                    </div>
                  )}
                  {taxSummary.sgst > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-caption">
                      <span className="text-muted">SGST</span><span>{rupee(taxSummary.sgst)}</span>
                    </div>
                  )}
                  {taxSummary.igst > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-caption">
                      <span className="text-muted">IGST</span><span>{rupee(taxSummary.igst)}</span>
                    </div>
                  )}
                  {taxSummary.cess > 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-caption">
                      <span className="text-muted">Cess</span><span>{rupee(taxSummary.cess)}</span>
                    </div>
                  )}
                  {roundOff !== 0 && (
                    <div className="flex items-center justify-between px-4 py-2.5 text-body-sm">
                      <span className="text-muted">Round Off</span>
                      <span
                        className={cn(
                          "font-medium",
                          roundOff >= 0 ? "text-ink" : "text-emerald-700",
                        )}
                      >
                        {roundOff >= 0 ? "+ " : "− "}
                        {rupee(Math.abs(roundOff))}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-surface-soft px-4 py-3">
                    <span className="text-title-sm font-bold text-ink">Net Amount</span>
                    <span className="text-display-sm font-bold tracking-brand text-ink">
                      {rupee(net)}
                    </span>
                  </div>
                  {invoice.is_cash_sale ? (
                    <div className="flex items-center justify-between px-4 py-2.5 text-body-sm bg-emerald-50">
                      <span className="font-medium text-emerald-800">Paid (Cash)</span>
                      <span className="font-semibold text-emerald-800">
                        {rupee(net)}
                      </span>
                    </div>
                  ) : (
                    <>
                      {Number(invoice.paid_amount ?? 0) > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 text-body-sm">
                          <span className="text-muted">Paid Amount</span>
                          <span className="font-medium text-emerald-700">
                            − {rupee(invoice.paid_amount)}
                          </span>
                        </div>
                      )}
                      {Number(invoice.balance_due ?? 0) > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 text-body-sm bg-amber-50">
                          <span className="font-medium text-amber-800">
                            Balance Due
                          </span>
                          <span className="font-bold text-amber-800">
                            {rupee(invoice.balance_due)}
                          </span>
                        </div>
                      )}
                      {Number(invoice.balance_due ?? 0) === 0 &&
                        Number(invoice.paid_amount ?? 0) > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5 text-body-sm bg-emerald-50">
                            <span className="font-medium text-emerald-800">
                              Fully Paid
                            </span>
                            <span className="font-semibold text-emerald-800">
                              ✓
                            </span>
                          </div>
                        )}
                    </>
                  )}
                </div>
                <p className="px-4 py-2 text-caption text-muted">
                  Amount in words: {amountInWords(net)}
                </p>
              </div>
            </div>
          </div>

          {/* Footer — signed */}
          <div className="mt-12 grid grid-cols-1 gap-8 pt-6 border-t border-dashed border-hairline md:grid-cols-2">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                Terms & Conditions
              </p>
              <ul className="mt-2 space-y-1 text-caption text-muted list-disc list-inside">
                <li>Goods once sold will not be taken back without prior approval.</li>
                <li>Interest @ 24% p.a. will be charged on overdue payments.</li>
                <li>Subject to Pune jurisdiction only.</li>
                <li>Please verify bill / items before leaving the counter.</li>
              </ul>
            </div>
            <div className="md:text-right">
              <p className="text-caption font-semibold uppercase tracking-wide text-muted">
                For {displayBusinessName || "Seller identity unavailable"}
              </p>
              <div className="mt-10 inline-flex flex-col items-end md:items-end">
                <div className="border-b border-ink/60 w-48 h-6" />
                <p className="mt-2 text-title-sm font-semibold text-ink">Rajesh Kumar</p>
                <p className="text-caption text-muted">Authorised Signatory</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-hairline text-center">
            <p className="text-caption text-muted">
              This is a computer-generated invoice. No physical signature is required.
              Thank you for your business!
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════ 80mm THERMAL RECEIPT LAYOUT ═══════════════ */}
      <div className="thermal-only print-only-80mm mt-12 lg:mt-16">
        <div
          className="mx-auto bg-canvas text-ink"
          style={{ width: "80mm", fontFamily: "monospace", fontSize: "11px" }}
        >
          <div className="text-center px-2 py-4">
            <div className="flex justify-center mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                <Pill className="h-5 w-5 text-on-primary" strokeWidth={2.25} />
              </div>
            </div>
            <p className="font-bold text-[13px] leading-tight">
              {displayBusinessName || "Your Pharmacy"}
            </p>
            {businessAddressParts.length > 0 && (
              <p className="mt-1 text-[10px] leading-tight text-body">
                {businessAddressParts.join(", ")}
              </p>
            )}
            {businessProfile?.gstin && (
              <p className="mt-1 text-[10px] text-body">
                GSTIN: {businessProfile.gstin}
              </p>
            )}
          </div>

          <div className="border-t border-dashed border-hairline border-b border-dashed px-2 py-2">
            <div className="flex justify-between text-[11px]">
              <span>Bill: {invoice.invoice_no || "DRAFT"}</span>
              <span>{formatDate(invoice.invoice_date)}</span>
            </div>
            <div className="mt-1 text-[10px] leading-tight">
              <span className="font-semibold">Customer: </span>
              {customer?.business_name ??
                (invoice.is_cash_sale ? "Cash" : "Walk-in")}
            </div>
            {invoice.is_cash_sale && (
              <div className="mt-0.5 text-[10px] text-muted">Cash Sale</div>
            )}
          </div>

          {/* Thermal items — 6 cols */}
          <table className="w-full text-[10px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left px-1 py-1.5 font-semibold text-muted w-6">
                  No
                </th>
                <th className="text-left px-1 py-1.5 font-semibold text-muted">
                  Item
                </th>
                <th className="text-right px-1 py-1.5 font-semibold text-muted w-10">
                  Qty
                </th>
                <th className="text-right px-1 py-1.5 font-semibold text-muted w-14">
                  Rate
                </th>
                <th className="text-right px-1 py-1.5 font-semibold text-muted w-16">
                  Amt
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center px-1 py-4 text-[10px] text-muted"
                  >
                    No items
                  </td>
                </tr>
              ) : (
                items.map((it: any, idx: number) => {
                  const qty = Number(it.quantity ?? 0);
                  const rate = Number(it.sale_rate ?? 0);
                  const amt = Number(it.line_total ?? 0);
                  return (
                    <tr
                      key={it.id}
                      className="border-b border-dashed border-hairline/60"
                    >
                      <td className="text-left px-1 py-1 align-top">{idx + 1}</td>
                      <td className="text-left px-1 py-1 align-top">
                        <p className="font-medium leading-tight">
                          {it.product?.name ?? "—"}
                        </p>
                        <p className="text-[9px] text-muted leading-tight">
                          B:{it.batch_no ?? "-"} |{" "}
                          {Number(it.gst_rate ?? 0) > 0
                            ? `${Number(it.gst_rate).toFixed(0)}%`
                            : "Exempt"}
                        </p>
                      </td>
                      <td className="text-right px-1 py-1 align-top font-medium">
                        {qty}
                      </td>
                      <td className="text-right px-1 py-1 align-top whitespace-nowrap">
                        {Number(rate).toFixed(2)}
                      </td>
                      <td className="text-right px-1 py-1 align-top font-medium whitespace-nowrap">
                        {Number(amt).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Thermal totals */}
          <div className="border-t border-dashed border-hairline px-2 py-2 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted">Gross</span>
              <span>{Number(gross).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Discount</span>
                <span className="text-emerald-700">-{Number(discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted">Tax</span>
              <span>{Number(tax).toFixed(2)}</span>
            </div>
            {roundOff !== 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Round</span>
                <span>
                  {roundOff >= 0 ? "+" : "-"}
                  {Number(Math.abs(roundOff)).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-hairline pt-1.5 mt-1 text-[14px] font-bold">
              <span>TOTAL (₹)</span>
              <span className="tracking-tight">{rupee(net)}</span>
            </div>
            {Number(invoice.paid_amount ?? 0) > 0 && (
              <div className="flex justify-between text-[10px] text-emerald-700">
                <span>Paid</span>
                <span>-{Number(invoice.paid_amount ?? 0).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.balance_due ?? 0) > 0 && (
              <div className="flex justify-between text-[11px] text-amber-700 font-semibold">
                <span>Balance</span>
                <span>{Number(invoice.balance_due ?? 0).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.balance_due ?? 0) === 0 &&
              Number(invoice.paid_amount ?? 0) > 0 && (
                <div className="flex justify-center pt-1 text-[10px] text-emerald-700 font-semibold">
                  FULLY PAID ✓
                </div>
              )}
            {invoice.is_cash_sale && (
              <div className="flex justify-center pt-1 text-[10px] text-emerald-700 font-semibold">
                CASH PAID ✓
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-hairline px-2 py-3 text-center">
            <p className="text-[11px] font-semibold">Thank you for your patronage!</p>
            <p className="mt-1 text-[9px] text-muted">
              Please visit again. E. & O.E.
            </p>
            <p className="mt-2 text-[9px] text-muted">
              — Authorised Signatory —
            </p>
          </div>
          <div className="mt-4 flex items-end justify-between gap-6 border-t border-hairline pt-3 text-[9px] text-muted">
            <div>
              <p className="font-semibold text-ink">{PHARMNOS_PLATFORM_FOOTER.attribution}</p>
              <p>{PHARMNOS_PLATFORM_FOOTER.address}</p>
              <p>{PHARMNOS_PLATFORM_FOOTER.supportEmail} · {PHARMNOS_PLATFORM_FOOTER.phone}</p>
            </div>
            <div className="text-right">
              {barcodeDataUrl ? (
                <Image
                  src={barcodeDataUrl}
                  alt={`Barcode for invoice ${invoiceReferences.barcodeValue}`}
                  width={176}
                  height={48}
                  unoptimized
                  className="ml-auto h-12 w-44 object-contain"
                  data-invoice-barcode={invoiceReferences.barcodeValue}
                />
              ) : (
                <p data-invoice-barcode={invoiceReferences.barcodeValue}>Barcode: {invoiceReferences.barcodeValue}</p>
              )}
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="Internal invoice verification QR code"
                  width={96}
                  height={96}
                  unoptimized
                  className="ml-auto mt-2 h-24 w-24"
                  data-invoice-qr={invoiceReferences.qrPayload}
                />
              ) : (
                <p className="max-w-[260px] break-all" data-invoice-qr={invoiceReferences.qrPayload}>
                  QR reference: {invoiceReferences.qrPayload}
                </p>
              )}
              <p className="mt-1 text-[8px]">Internal reference, not a statutory QR code.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
