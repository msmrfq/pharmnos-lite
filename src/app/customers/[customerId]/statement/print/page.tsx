import type { Metadata } from "next";
import { FileText, Phone, Mail, MapPin, Building2, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CardCanvas,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import { cn, formatDate } from "@/lib/utils";
import type { LedgerEntryType } from "@prisma/client";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const metadata: Metadata = {
  title: "Customer Statement",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const ENTRY_LABELS: Record<LedgerEntryType, { label: string; variant: any }> = {
  INVOICE: { label: "Invoice", variant: "badge-violet" },
  PAYMENT_RECEIVED: { label: "Payment Received", variant: "success" },
  CREDIT_NOTE: { label: "Credit Note", variant: "badge-emerald" },
  PURCHASE: { label: "Purchase", variant: "badge-orange" },
  PAYMENT_MADE: { label: "Payment Made", variant: "destructive" },
  DEBIT_NOTE: { label: "Debit Note", variant: "warning" },
  OPENING_BALANCE: { label: "Opening Balance", variant: "secondary" },
};

export default async function CustomerStatementPrintPage({
  params,
  searchParams,
}: {
  params: { customerId: string };
  searchParams: { from?: string; to?: string; days?: string };
}) {
  const customerId = params.customerId;
  const sp = searchParams ?? {};
  let dbOk = isPostgresConfigured();
  let ctx: any = null;

  const daysRaw = Number(sp?.days ?? "90");
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 90;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let fromDate: Date;
  let toDate: Date;

  if (sp?.to) {
    const parsed = new Date(sp.to);
    toDate = Number.isFinite(parsed.getTime()) ? parsed : today;
  } else {
    toDate = today;
  }

  if (sp?.from) {
    const parsed = new Date(sp.from);
    fromDate = Number.isFinite(parsed.getTime()) ? parsed : new Date(toDate.getTime() - days * 86400000);
  } else {
    fromDate = new Date(toDate.getTime() - days * 86400000);
  }
  fromDate.setHours(0, 0, 0, 0);

  let customer: any = null;
  let allLedger: any[] = [];
  let aging: any = null;
  let emptyFallback = false;

  if (dbOk) {
    try {
      ctx = await requireServerTenantContext();
      [customer, allLedger, aging] = await Promise.all([
        repos.customers.getById(customerId, ctx),
        repos.customerLedgers.listForCustomer(customerId, ctx, 1000),
        repos.customerLedgers.getAgingBuckets(ctx, customerId),
      ]);
    } catch (_err) {
      dbOk = false;
    }
  }
  if (dbOk && (!customer || allLedger.length === 0)) emptyFallback = true;
  if (!dbOk) {
    return (
      <DashboardLayout
        tenantName="Maharashtra Pharma Distributors"
        userName="Rajesh Kumar"
        userInitials="RK"
      >
        <PrintToolbar
          backHref={`/customers/${customerId}`}
          backLabel="Back to Customer"
          title="Customer Statement"
        />
        <CardCanvas>
          <CardContent className="py-10 space-y-3 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-600" />
            <p className="text-body-md text-amber-800">
              Showing placeholder until database is connected — try again in 60 seconds.
            </p>
          </CardContent>
        </CardCanvas>
      </DashboardLayout>
    );
  }
  if (emptyFallback) {
    return (
      <DashboardLayout
        tenantName="Maharashtra Pharma Distributors"
        userName="Rajesh Kumar"
        userInitials="RK"
      >
        <PrintToolbar
          backHref={`/customers/${customerId}`}
          backLabel="Back to Customer"
          title="Customer Statement"
        />
        <div className="p-4 lg:p-6">
          <CardCanvas>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted" />
              <h3 className="mt-4 text-title-sm font-semibold text-ink">No statement data</h3>
              <p className="mt-2 text-body-md text-muted">
                {!customer
                  ? "Customer not found."
                  : "This customer has no ledger entries yet."}
              </p>
            </CardContent>
          </CardCanvas>
        </div>
      </DashboardLayout>
    );
  }

  const beforeFrom: typeof allLedger = [];
  const inRange: typeof allLedger = [];
  for (const row of allLedger) {
    const d = row.entry_date ? new Date(row.entry_date) : null;
    if (!d) continue;
    if (d.getTime() < fromDate.getTime()) {
      beforeFrom.push(row);
    } else if (d.getTime() <= toDate.getTime()) {
      inRange.push(row);
    }
  }

  let openingDebit = 0;
  let openingCredit = 0;
  for (const r of beforeFrom) {
    openingDebit += Number(r.debit ?? 0);
    openingCredit += Number(r.credit ?? 0);
  }
  const openingBalance = openingDebit - openingCredit;

  const periodRows = inRange.map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    entry_type: r.entry_type,
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    invoice_id: r.invoice_id,
    reference_id: r.reference_id,
    narration: r.narration,
  }));

  type StatementRow = {
    kind: "opening" | "entry";
    id: string;
    entry_date: Date | null;
    entry_type: LedgerEntryType | "OPENING_BALANCE";
    debit: number;
    credit: number;
    invoice_id: string | null;
    narration: string | null;
    running_balance: number;
  };

  const statement: StatementRow[] = [];
  let running = openingBalance;

  statement.push({
    kind: "opening",
    id: "__opening__",
    entry_date: fromDate,
    entry_type: "OPENING_BALANCE",
    debit: openingBalance > 0 ? openingBalance : 0,
    credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
    invoice_id: null,
    narration: "Opening balance",
    running_balance: running,
  });

  for (const r of periodRows) {
    running += r.debit - r.credit;
    statement.push({
      kind: "entry",
      id: r.id,
      entry_date: r.entry_date,
      entry_type: r.entry_type,
      debit: r.debit,
      credit: r.credit,
      invoice_id: r.invoice_id,
      narration: r.narration,
      running_balance: running,
    });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const r of statement) {
    if (r.kind === "opening") continue;
    totalDebit += r.debit;
    totalCredit += r.credit;
  }

  const addressParts = [
    customer.billing_address_1,
    customer.billing_address_2,
    customer.billing_city,
    customer.billing_state,
    customer.billing_pincode,
  ].filter(Boolean);

  const customerPhone = customer.mobile ?? customer.phone;

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <PrintToolbar
        backHref={`/customers/${customerId}`}
        backLabel="Back to Customer"
        title={`Statement — ${customer.business_name ?? customer.code ?? "Customer"}`}
      />

      <div className="print-area p-4 lg:p-6 space-y-6">
        <CardCanvas className="overflow-visible">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between print-break-inside-avoid">
              <div className="space-y-3 min-w-0 flex-1">
                <div>
                  <p className="text-caption text-muted uppercase tracking-wider font-medium">
                    Customer Statement
                  </p>
                  <h1 className="mt-1 text-display-sm font-semibold tracking-brand text-ink">
                    {customer.business_name}
                  </h1>
                  {customer.code && (
                    <p className="mt-1 text-body-md text-muted">
                      Customer Code: <span className="font-medium text-body">{customer.code}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 text-body-md text-body">
                  {customer.contact_person && (
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted mt-0.5 shrink-0" />
                      <span>{customer.contact_person}</span>
                    </div>
                  )}
                  {customerPhone && (
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-muted mt-0.5 shrink-0" />
                      <span>{customerPhone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-muted mt-0.5 shrink-0" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {addressParts.length > 0 && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted mt-0.5 shrink-0" />
                      <span>{addressParts.join(", ")}</span>
                    </div>
                  )}
                  {customer.gstin && (
                    <p className="text-body-md text-muted pt-1">
                      GSTIN: <span className="font-medium text-body">{customer.gstin}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="lg:min-w-[320px] w-full space-y-3">
                <div className="rounded-lg border border-hairline p-4 bg-surface-soft/40">
                  <div className="flex items-baseline justify-between">
                    <span className="text-caption text-muted font-medium">Period</span>
                    <span className="text-body-md font-semibold text-ink">
                      {formatDate(fromDate, "PP")} — {formatDate(toDate, "PP")}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-caption text-muted font-medium">Total Due</span>
                    <span className="text-display-lg font-bold tracking-brand text-semantic-error">
                      {rupee(aging.total > 0 ? aging.total : Number(customer.receivable_balance ?? 0))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-hairline p-3">
                    <p className="text-caption text-muted font-medium">Current (0-30)</p>
                    <div className="mt-1.5">
                      <Badge variant="success">{rupee(aging.current)}</Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-hairline p-3">
                    <p className="text-caption text-muted font-medium">31-60 days</p>
                    <div className="mt-1.5">
                      <Badge variant="warning">{rupee(aging.d30)}</Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-hairline p-3">
                    <p className="text-caption text-muted font-medium">61-90 days</p>
                    <div className="mt-1.5">
                      <Badge variant="warning">{rupee(aging.d60)}</Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border border-hairline p-3">
                    <p className="text-caption text-muted font-medium">90+ days</p>
                    <div className="mt-1.5">
                      <Badge variant="destructive">{rupee(aging.over90)}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </CardCanvas>

        <CardCanvas>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Entry / Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="w-[130px] text-right">Debit (₹)</TableHead>
                  <TableHead className="w-[130px] text-right">Credit (₹)</TableHead>
                  <TableHead className="w-[150px] text-right">Running Balance (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.map((r) => {
                  const meta =
                    r.entry_type === "OPENING_BALANCE"
                      ? { label: "Opening Balance", variant: "secondary" as const }
                      : ENTRY_LABELS[r.entry_type] ?? { label: String(r.entry_type), variant: "default" as const };
                  const balPositive = r.running_balance > 0.001;
                  const balNegative = r.running_balance < -0.001;
                  return (
                    <TableRow
                      key={r.id}
                      className={cn(r.kind === "opening" && "bg-surface-soft/30 font-medium")}
                    >
                      <TableCell className="text-body whitespace-nowrap">
                        {r.entry_date ? formatDate(r.entry_date, "PP") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={meta.variant as any}>{meta.label}</Badge>
                          {r.narration && r.kind !== "opening" && (
                            <span className="text-caption text-muted truncate max-w-[280px]">
                              {r.narration}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-body">
                        {r.invoice_id ? (
                          <span className="font-mono text-[13px] text-ink">{r.invoice_id.slice(0, 12)}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-body tabular-nums">
                        {r.debit > 0 ? rupee(r.debit) : <span className="text-muted">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium text-body tabular-nums">
                        {r.credit > 0 ? rupee(r.credit) : <span className="text-muted">—</span>}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          balPositive && "text-semantic-error",
                          balNegative && "text-semantic-success",
                          !balPositive && !balNegative && "text-ink",
                        )}
                      >
                        {rupee(r.running_balance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold text-ink">
                    Totals for period
                  </TableCell>
                  <TableCell className="text-right font-bold text-ink tabular-nums">
                    {rupee(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-ink tabular-nums">
                    {rupee(totalCredit)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold tabular-nums",
                      running > 0.001 && "text-semantic-error",
                      running < -0.001 && "text-semantic-success",
                    )}
                  >
                    {rupee(running)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </CardCanvas>

        <div className="print-break-inside-avoid pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-caption text-muted">
            <div>
              <p className="font-medium text-body mb-1">Notes</p>
              <p>This is a computer-generated statement. Please verify all entries.</p>
            </div>
            <div>
              <p className="font-medium text-body mb-1">Payment Terms</p>
              <p>Payment due as per agreed credit terms. Overdue amounts attract applicable interest.</p>
            </div>
            <div>
              <p className="font-medium text-body mb-1">Contact</p>
              <p>For any discrepancies, contact accounts department immediately.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
