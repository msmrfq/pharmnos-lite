import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  CardCanvas,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const metadata: Metadata = {
  title: "Invoice",
};

const rupee = (n: number | null | undefined | string | bigint) => {
  const num = typeof n === "string" || typeof n === "bigint" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const formatDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default async function BillingInvoiceDetailPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  let dbOk = isPostgresConfigured();
  let invoice: any = null;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      invoice = await repos.salesInvoices.getById(params.invoiceId, ctx);
    } catch (_err) {
      dbOk = false;
    }
  }

  if (!invoice) {
    return (
      <DashboardLayout>
        <PrintToolbar backHref="/billing" backLabel="Back to billing" title="Invoice not found" />
        <CardCanvas>
          <CardContent className="py-10 text-center">
            <p className="text-body-md text-destructive">
              {dbOk ? "Invoice not found or you do not have access." : "Database not connected — try again in 60 seconds."}
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

  const customer = invoice.customer;
  const items = invoice.items ?? [];
  const statusBadge: any =
    invoice.status === "FINALIZED"
      ? "success"
      : invoice.status === "CANCELLED"
        ? "secondary"
        : "warning";
  const paid = Number(invoice.paid_amount ?? 0);
  const net = Number(invoice.net_amount ?? 0);
  const bal = Number(invoice.balance_due ?? 0);
  const allPaid = invoice.is_cash_sale || (paid > 0 && Math.abs(bal) < 0.01);

  return (
    <DashboardLayout>
      <PrintToolbar
        backHref="/billing"
        backLabel="Back to billing"
        title={`Invoice ${invoice.invoice_no || "DRAFT"}`}
      >
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/billing/${encodeURIComponent(params.invoiceId)}/edit`}>Edit invoice</Link>
        </Button>
        <Button size="sm" asChild>
          <Link href={`/billing/${encodeURIComponent(params.invoiceId)}/print`} target="_blank" rel="noopener noreferrer">Print</Link>
        </Button>
      </PrintToolbar>

      <CardCanvas className="invoice-print">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-ink mb-2">INVOICE</h1>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-body text-muted">Invoice no:</span>
                <span className="font-mono font-semibold text-ink">
                  {invoice.invoice_no || "DRAFT"}
                </span>
                <Badge variant={statusBadge}>{invoice.status}</Badge>
                {invoice.is_cash_sale && <Badge variant="outline">Cash sale</Badge>}
              </div>
              <div className="space-y-1 text-body">
                <p><span className="text-muted">Date:</span> <span className="text-ink">{formatDate(invoice.invoice_date)}</span></p>
                {invoice.reference_no && <p><span className="text-muted">Ref no:</span> <span className="text-ink">{invoice.reference_no}</span></p>}
              </div>
            </div>
            {customer && (
              <div className="text-right">
                <p className="font-semibold text-title-md text-ink mb-1">
                  {customer.business_name ?? customer.customer_name ?? "—"}
                </p>
                <div className="space-y-0.5 text-body text-muted">
                  {customer.contact_person && <p>{customer.contact_person}</p>}
                  {customer.billing_address1 && <p>{customer.billing_address1}</p>}
                  {([customer.billing_city, customer.billing_state, customer.billing_postcode].filter(Boolean).length > 0) && (
                    <p>{[customer.billing_city, customer.billing_state, customer.billing_postcode].filter(Boolean).join(", ")}</p>
                  )}
                  {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
                  {customer.mobile && <p>Mobile: {customer.mobile}</p>}
                  {customer.phone && <p>Phone: {customer.phone}</p>}
                  {customer.email && <p>Email: {customer.email}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-b border-hairline mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Disc %</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it: any, i: number) => {
                  const qty = Number(it.quantity ?? 0);
                  const rate = Number(it.sale_rate ?? 0);
                  const discPct = Number(it.trade_discount_pct ?? 0);
                  const taxPct = Number(it.gst_rate_pct ?? 0);
                  const gross = qty * rate;
                  const disc = gross * (discPct / 100);
                  const taxable = gross - disc;
                  const tax = taxable * (taxPct / 100);
                  const lineTotal = taxable + tax;
                  return (
                    <TableRow key={it.id ?? i}>
                      <TableCell className="text-muted">{i + 1}</TableCell>
                      <TableCell className="text-ink">
                        <p className="font-medium">{it.product?.name ?? "—"}</p>
                        {it.product?.composition && <p className="text-caption text-muted">{it.product.composition}</p>}
                      </TableCell>
                      <TableCell className="text-body">
                        {it.batch?.batch_no ?? "—"}
                        {it.batch?.expiry_date && <p className="text-caption text-muted">Exp {formatDate(it.batch.expiry_date)}</p>}
                      </TableCell>
                      <TableCell className="text-right text-body">{qty}</TableCell>
                      <TableCell className="text-right text-body">{rupee(rate)}</TableCell>
                      <TableCell className="text-right text-body">{discPct}%</TableCell>
                      <TableCell className="text-right text-body">{taxPct}%</TableCell>
                      <TableCell className="text-right font-medium text-ink">{rupee(lineTotal)}</TableCell>
                    </TableRow>
                  );
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted">No line items yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start print-break-inside-avoid">
            <div className="space-y-2 text-body-sm text-muted">
              <p><strong className="text-ink">Notes:</strong> {invoice.notes ?? "E. & O.E."}</p>
              <p><strong className="text-ink">Terms:</strong> Payment due as per ledger aging.</p>
            </div>
            <div className="md:justify-self-end md:w-[360px]">
              <Table className="border border-hairline">
                <TableBody>
                  <TableRow>
                    <TableHead className="bg-surface-card text-left">Gross amount</TableHead>
                    <TableCell className="text-right">{rupee(invoice.gross_amount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-surface-card text-left">Discount</TableHead>
                    <TableCell className="text-right">−{rupee(invoice.total_discount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-surface-card text-left">Tax</TableHead>
                    <TableCell className="text-right">{rupee(invoice.total_tax)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-surface-card text-left">Round off</TableHead>
                    <TableCell className="text-right">{rupee(invoice.round_off)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-canvas text-left font-semibold">Net amount</TableHead>
                    <TableCell className="text-right font-semibold text-ink">{rupee(net)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-canvas text-left">Paid</TableHead>
                    <TableCell className="text-right">{rupee(paid)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-canvas text-left font-semibold">Balance due</TableHead>
                    <TableCell className="text-right font-semibold">
                      <Badge variant={allPaid ? "success" : "warning"}>
                        {allPaid ? "Fully paid" : rupee(bal)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-dashed border-hairline flex items-end justify-between gap-4 flex-wrap print-break-inside-avoid">
            <p className="text-caption text-muted">
              Authorised signatory · This is a system-generated invoice.
            </p>
            <div className="text-right">
              <div className="border-t border-hairline w-56 inline-block pt-1">
                <p className="text-body font-medium text-ink">Rajesh Kumar</p>
              </div>
            </div>
          </div>
        </CardContent>
      </CardCanvas>
    </DashboardLayout>
  );
}
