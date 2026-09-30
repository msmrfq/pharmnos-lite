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
  title: "Customer statement",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const formatDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const entryTypeLabel = (t: string | null | undefined) => {
  switch (t) {
    case "OPENING_BALANCE":
      return "Opening balance";
    case "SALES_INVOICE":
      return "Invoice";
    case "SALES_CANCEL":
      return "Invoice cancelled";
    case "PAYMENT_RECEIVED":
      return "Payment received";
    case "CREDIT_NOTE":
      return "Credit note";
    case "DEBIT_NOTE":
      return "Debit note";
    case "WRITE_OFF":
      return "Write off";
    default:
      return t ?? "—";
  }
};

const entryTypeBadge = (t: string | null | undefined) => {
  switch (t) {
    case "SALES_INVOICE":
    case "DEBIT_NOTE":
    case "OPENING_BALANCE":
      return "default" as const;
    case "PAYMENT_RECEIVED":
    case "CREDIT_NOTE":
      return "success" as const;
    case "SALES_CANCEL":
      return "secondary" as const;
    case "WRITE_OFF":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

export default async function CustomerDetailPage({
  params,
}: {
  params: { customerId: string };
}) {
  const customerId = params.customerId;
  let dbOk = isPostgresConfigured();
  let customer: any = null;
  let ledger: any[] = [];
  let balance = 0;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      [customer, ledger, balance] = await Promise.all([
        repos.customers.getById(customerId, ctx),
        repos.customerLedgers.listForCustomer(customerId, ctx, 500),
        repos.customerLedgers.getBalance(customerId, ctx),
      ]);
    } catch (_err) {
      dbOk = false;
    }
  }

  if (!customer) {
    return (
      <DashboardLayout>
        <PrintToolbar
          backHref="/customers"
          backLabel="Back to customers"
          title="Customer not found"
        />
        <CardCanvas>
          <CardContent className="py-10 text-center">
            <p className="text-body-md text-destructive">
              Customer not found or you do not have access.
            </p>
            <div className="mt-4">
              <Button asChild variant="secondary">
                <Link href="/customers">Back to customers</Link>
              </Button>
            </div>
          </CardContent>
        </CardCanvas>
      </DashboardLayout>
    );
  }

  let running = 0;
  const rows = ledger.map((l: any) => {
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    running = running + debit - credit;
    return { ...l, _debit: debit, _credit: credit, _balance: running };
  });

  return (
    <DashboardLayout>
      <PrintToolbar
        backHref="/customers"
        backLabel="Back to customers"
        title={`Statement — ${customer.business_name ?? customer.customer_name ?? customer.code ?? "Customer"}`}
      />
      <CardCanvas className="invoice-print">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className="md:col-span-2">
              <h1 className="text-2xl font-bold text-ink mb-2">CUSTOMER STATEMENT</h1>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-body text-muted">Customer code:</span>
                <span className="font-mono font-semibold text-ink">
                  {customer.code ?? "—"}
                </span>
                {customer.is_active === false && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              <p className="font-semibold text-title-md text-ink mb-1">
                {customer.business_name ?? customer.customer_name ?? "—"}
              </p>
              <div className="space-y-0.5 text-body text-muted">
                {customer.contact_person && <p>{customer.contact_person}</p>}
                {customer.billing_address1 && <p>{customer.billing_address1}</p>}
                {[customer.billing_city, customer.billing_state, customer.billing_postcode]
                  .filter(Boolean)
                  .join(", ") && (
                  <p>
                    {[customer.billing_city, customer.billing_state, customer.billing_postcode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
                {customer.mobile && <p>Mobile: {customer.mobile}</p>}
                {customer.phone && <p>Phone: {customer.phone}</p>}
                {customer.email && <p>Email: {customer.email}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="p-4 rounded-lg border border-hairline bg-surface-soft">
                <p className="text-caption text-muted uppercase tracking-wide mb-1">
                  Credit limit
                </p>
                <p className="text-title-sm font-semibold text-ink">
                  {rupee(customer.credit_limit)}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-hairline bg-surface-soft">
                <p className="text-caption text-muted uppercase tracking-wide mb-1">
                  Outstanding balance
                </p>
                <p
                  className={`text-title-sm font-semibold ${
                    balance > 0 ? "text-destructive" : "text-emerald-700"
                  }`}
                >
                  {rupee(balance)}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-hairline bg-surface-soft">
                <p className="text-caption text-muted uppercase tracking-wide mb-1">
                  Statement date
                </p>
                <p className="text-title-sm font-semibold text-ink">
                  {formatDate(new Date())}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-b border-hairline mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit (₹)</TableHead>
                  <TableHead className="text-right">Credit (₹)</TableHead>
                  <TableHead className="text-right">Balance (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-body whitespace-nowrap">
                      {formatDate(l.entry_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entryTypeBadge(l.entry_type)}>
                        {entryTypeLabel(l.entry_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-body text-ink">
                      {l.reference_no ?? l.description ?? "—"}
                      {l.invoice_no && (
                        <span className="ml-2 font-mono text-muted text-caption">
                          ({l.invoice_no})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-body">
                      {l._debit > 0 ? (
                        <span className="text-ink">{rupee(l._debit)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-body">
                      {l._credit > 0 ? (
                        <span className="text-emerald-700">{rupee(l._credit)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium whitespace-nowrap ${
                        l._balance > 0
                          ? "text-destructive"
                          : l._balance < 0
                            ? "text-emerald-700"
                            : "text-ink"
                      }`}
                    >
                      {rupee(l._balance)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted">
                      No ledger entries. Customer has a clean account.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              {customer.notes && (
                <>
                  <p className="text-caption text-muted uppercase tracking-wide mb-1">
                    Customer notes
                  </p>
                  <p className="text-body text-ink whitespace-pre-wrap">{customer.notes}</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-body">
                <span className="text-muted">Total debits</span>
                <span className="text-ink">
                  {rupee(rows.reduce((s: number, r: any) => s + r._debit, 0))}
                </span>
              </div>
              <div className="flex justify-between text-body">
                <span className="text-muted">Total credits</span>
                <span className="text-emerald-700">
                  {rupee(rows.reduce((s: number, r: any) => s + r._credit, 0))}
                </span>
              </div>
              <div className="flex justify-between text-title-sm font-semibold pt-2 border-t border-hairline">
                <span className="text-ink">Closing balance</span>
                <span
                  className={
                    balance > 0
                      ? "text-destructive"
                      : balance < 0
                        ? "text-emerald-700"
                        : "text-ink"
                  }
                >
                  {rupee(balance)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </CardCanvas>
    </DashboardLayout>
  );
}
