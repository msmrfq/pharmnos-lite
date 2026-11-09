import type { Metadata } from "next";
import Link from "next/link";
import { Phone, Mail, MapPin, Building2, AlertTriangle } from "lucide-react";
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
import { loadFinancialLedgerReport, exportCustomerStatementCsvAction } from "@/app/_actions/exports.actions";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { QualifiedReportBanner } from "@/components/reports/report-completeness-notices";
import { ReportUnavailableError, describeReportFailure } from "@/domain/services/financial-report-completeness";
import { cn } from "@/lib/utils";
import { businessDateToday, formatBusinessDate } from "@/lib/utils/business-date";
import { Decimal } from "@/lib/decimal";
import type { LedgerEntryType } from "@prisma/client";
import { PrintToolbar } from "@/components/print/print-toolbar";

export const metadata: Metadata = {
  title: "Customer Statement",
};

const rupee = (value: string) => {
  const [whole = "0", fraction = "00"] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{2})+(\d{3})(?!\d))/g, ",");
  return `₹ ${negative ? "-" : ""}${grouped}.${fraction.padEnd(2, "0")}`;
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
  searchParams: { from?: string; to?: string; days?: string; mode?: string };
}) {
  const customerId = params.customerId;
  const sp = searchParams ?? {};
  let report: Awaited<ReturnType<typeof loadFinancialLedgerReport>> | null = null;
  let failure: { reason: string; qualifiedModeAvailable: boolean } | null = null;
  let fromStr = sp.from ?? "";
  const toStr = sp.to ?? businessDateToday();
  const rawMode = sp.mode;
  const qualified = rawMode === "qualified";
  const reportInput = { customerId, from: fromStr, to: toStr, ...(rawMode !== undefined ? { mode: rawMode } : {}) };
  if (isPostgresConfigured()) {
    try {
      if (!fromStr) {
        const daysRaw = Number(sp.days ?? "90");
        if (!Number.isSafeInteger(daysRaw) || daysRaw <= 0 || daysRaw > 36500) throw new ReportUnavailableError("INVALID_INPUT", "Invalid date range.");
        const end = new Date(`${toStr}T00:00:00.000Z`);
        if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== toStr) throw new ReportUnavailableError("INVALID_INPUT", "Invalid date range.");
        fromStr = new Date(end.getTime() - daysRaw * 86400000).toISOString().slice(0, 10);
        reportInput.from = fromStr;
      }
      report = await loadFinancialLedgerReport({ kind: "customer", ...reportInput });
    } catch (error) {
      report = null;
      failure = describeReportFailure(error);
    }
  }
  const modeQs = (mode?: string) => {
    const query = new URLSearchParams();
    if (sp.from) query.set("from", sp.from);
    if (sp.to) query.set("to", sp.to);
    if (!sp.from && sp.days) query.set("days", sp.days);
    if (mode) query.set("mode", mode);
    const text = query.toString();
    return `/customers/${customerId}/statement/print${text ? `?${text}` : ""}`;
  };
  if (!report || !report.customer) {
    return (
      <DashboardLayout>
        <PrintToolbar backHref={`/customers/${customerId}`} backLabel="Back to Customer" title="Customer Statement" />
        <CardCanvas>
          <CardContent className="py-10 space-y-3 text-center" role="alert">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-600" />
            <p className="text-body-md text-amber-800">
              Statement unavailable. {failure?.reason ?? "The report could not be loaded."}
            </p>
            {failure?.qualifiedModeAvailable && !qualified ? (
              <p className="text-body-md">
                <Link href={modeQs("qualified")} className="font-medium underline">
                  View qualified (exploratory, incomplete) statement
                </Link>
              </p>
            ) : null}
          </CardContent>
        </CardCanvas>
      </DashboardLayout>
    );
  }
  const customer = report.customer;
  const aging = report.aging;
  const opening = Decimal.from(report.opening);
  const statement = [{
    kind: "opening", id: "__opening__", entry_date: fromStr, entry_type: "OPENING_BALANCE",
    debit: opening.compare(0) > 0 ? opening.toFixed(2) : "0.00",
    credit: opening.compare(0) < 0 ? opening.negate().toFixed(2) : "0.00",
    invoice_id: null as string | null,
    narration: qualified ? "Opening balance (classified entries only)" : "Opening balance", running_balance: report.opening,
  }, ...report.rows.map((r) => ({
    kind: "entry", id: r.id, entry_date: r.effective_date, entry_type: r.entry_type,
    debit: r.debit, credit: r.credit, invoice_id: r.invoice_id, narration: r.narration, running_balance: r.balance,
    voucher_type: r.voucher_type,
  }))];
  const totalDebit = report.debit;
  const totalCredit = report.credit;
  const running = report.closing;

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
        {report.mode === "qualified" ? (
          <QualifiedReportBanner
            excludedLabel="ledger entries"
            excludedCount={report.exclusions.excludedCount}
            amounts={[
              { label: "excluded debit", value: rupee(report.exclusions.excludedDebit) },
              { label: "excluded credit", value: rupee(report.exclusions.excludedCredit) },
              { label: "excluded signed amount (D − C)", value: rupee(report.exclusions.excludedSigned) },
            ]}
            byReason={report.exclusions.byReason}
            completeHref={modeQs()}
            note="Opening and running balances are classified entries only."
          />
        ) : null}
        <div className="print:hidden flex justify-end">
          <ExportCsvButton variant="secondary" action={exportCustomerStatementCsvAction.bind(null, reportInput)}>
            Export CSV
          </ExportCsvButton>
        </div>
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
                      {formatBusinessDate(fromStr)} — {formatBusinessDate(toStr)}
                    </span>
                  </div>
                  <p className="mt-3 text-caption text-muted">Effective-date view of the current ledger; not a historical knowledge-time snapshot. {report.recordingTimeDisclosure}</p>
                </div>
                {aging ? (
                  <div className="grid grid-cols-2 gap-2" aria-label="Current invoice aging, not period aging">
                    <div className="rounded-lg border border-hairline p-3">
                      <p className="text-caption text-muted font-medium">Current</p>
                      <Badge variant="success">{rupee(aging.current)}</Badge>
                    </div>
                    <div className="rounded-lg border border-hairline p-3">
                      <p className="text-caption text-muted font-medium">1-30 days</p>
                      <Badge variant="success">{rupee(aging.d30)}</Badge>
                    </div>
                    <div className="rounded-lg border border-hairline p-3">
                      <p className="text-caption text-muted font-medium">31-60 days</p>
                      <Badge variant="warning">{rupee(aging.d60)}</Badge>
                    </div>
                    <div className="rounded-lg border border-hairline p-3">
                      <p className="text-caption text-muted font-medium">61-90 days</p>
                      <Badge variant="warning">{rupee(aging.d90)}</Badge>
                    </div>
                    <div className="rounded-lg border border-hairline p-3">
                      <p className="text-caption text-muted font-medium">&gt;90 days</p>
                      <Badge variant="destructive">{rupee(aging.over90)}</Badge>
                    </div>
                    <p className="text-caption text-muted">Current invoice aging, not period aging.</p>
                  </div>
                ) : <p className="text-caption text-muted">Current invoice aging unavailable: due dates are incomplete or the safe limit was exceeded.</p>}
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
                  <TableHead className="w-[150px] text-right">Running Balance (₹){qualified ? " classified only" : ""}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statement.map((r) => {
                  const meta =
                    "voucher_type" in r && (r.voucher_type === "Payment refund" || r.voucher_type === "Payment reversal")
                      ? { label: r.voucher_type, variant: "secondary" as const }
                      : r.entry_type === "OPENING_BALANCE"
                      ? { label: qualified ? "Opening Balance (classified entries only)" : "Opening Balance", variant: "secondary" as const }
                      : ENTRY_LABELS[r.entry_type as LedgerEntryType] ?? { label: r.entry_type, variant: "secondary" };
                  const balPositive = Number(r.running_balance) > 0;
                  const balNegative = Number(r.running_balance) < 0;
                  return (
                    <TableRow
                      key={r.id}
                      className={cn(r.kind === "opening" && "bg-surface-soft/30 font-medium")}
                    >
                      <TableCell className="text-body whitespace-nowrap">
                        {r.entry_date ? formatBusinessDate(r.entry_date) : "—"}
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
                        {Number(r.debit) > 0 ? rupee(r.debit) : <span className="text-muted">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium text-body tabular-nums">
                        {Number(r.credit) > 0 ? rupee(r.credit) : <span className="text-muted">—</span>}
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
                    Totals for period{qualified ? " (classified entries only; excluded entries not included)" : ""}
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
                      Number(running) > 0 && "text-semantic-error",
                      Number(running) < 0 && "text-semantic-success",
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
