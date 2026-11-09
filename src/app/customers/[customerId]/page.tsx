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
import { businessDateToday, formatBusinessDate } from "@/lib/utils/business-date";
import { loadFinancialLedgerReport } from "@/app/_actions/exports.actions";
import { describeReportFailure } from "@/domain/services/financial-report-completeness";
import { QualifiedReportBanner, ReportUnavailableNotice } from "@/components/reports/report-completeness-notices";

export const metadata: Metadata = {
  title: "Customer statement",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const entryTypeBadge = (t: string | null | undefined) => {
  switch (t) {
    case "INVOICE":
    case "DEBIT_NOTE":
    case "OPENING_BALANCE":
      return "default" as const;
    case "PAYMENT_RECEIVED":
    case "CREDIT_NOTE":
      return "success" as const;
    default:
      return "outline" as const;
  }
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: { customerId: string };
  searchParams?: { mode?: string };
}) {
  const customerId = params.customerId;
  const rawMode = searchParams?.mode;
  const qualified = rawMode === "qualified";
  let dbOk = isPostgresConfigured();
  let customer: any = null;
  let report: Awaited<ReturnType<typeof loadFinancialLedgerReport>> | null = null;
  let failure: { reason: string; qualifiedModeAvailable: boolean } | null = null;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      customer = await repos.customers.getById(customerId, ctx);
    } catch (_err) {
      dbOk = false;
    }
    if (customer) {
      try {
        // Full history by effective date from one tenant-scoped snapshot, so running balances are exact.
        report = await loadFinancialLedgerReport({
          kind: "customer", customerId, from: "0001-01-01", to: "9999-12-31",
          ...(rawMode !== undefined ? { mode: rawMode } : {}),
        });
      } catch (error) {
        failure = describeReportFailure(error);
      }
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

  const SHOWN_ROWS = 500;
  const allRows = report?.rows ?? [];
  const rows = allRows.slice(-SHOWN_ROWS);
  const hiddenEarlier = allRows.length - rows.length;
  const closing = report?.closing ?? null;

  return (
    <DashboardLayout>
      <PrintToolbar
        backHref="/customers"
        backLabel="Back to customers"
        title={`Statement — ${customer.business_name ?? customer.customer_name ?? customer.code ?? "Customer"}`}
      />
      {!report && (
        <ReportUnavailableNotice
          title="Statement unavailable."
          reason={failure?.reason ?? "The ledger could not be loaded; no financial totals are shown."}
          qualifiedHref={failure?.qualifiedModeAvailable && !qualified ? `/customers/${customerId}?mode=qualified` : null}
        />
      )}
      {report && report.mode === "qualified" && (
        <QualifiedReportBanner
          excludedLabel="ledger entries"
          excludedCount={report.exclusions.excludedCount}
          amounts={[
            { label: "excluded debit", value: rupee(report.exclusions.excludedDebit) },
            { label: "excluded credit", value: rupee(report.exclusions.excludedCredit) },
            { label: "excluded signed amount (D − C)", value: rupee(report.exclusions.excludedSigned) },
          ]}
          byReason={report.exclusions.byReason}
          completeHref={`/customers/${customerId}`}
          note="Running and closing balances are classified entries only."
        />
      )}
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
                  {qualified ? "Closing balance (classified entries only)" : "Closing balance (all ledger entries)"}
                </p>
                <p
                  className={`text-title-sm font-semibold ${
                    closing !== null && Number(closing) > 0 ? "text-destructive" : "text-emerald-700"
                  }`}
                >
                  {closing === null ? "Unavailable" : rupee(closing)}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-hairline bg-surface-soft">
                <p className="text-caption text-muted uppercase tracking-wide mb-1">
                  Statement date
                </p>
                <p className="text-title-sm font-semibold text-ink">
                  {formatBusinessDate(businessDateToday())}
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
                {hiddenEarlier > 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted text-caption">
                      {hiddenEarlier} earlier entries are not listed; the balances below are computed from the full history.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-body whitespace-nowrap">
                      {formatBusinessDate(l.effective_date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={entryTypeBadge(l.entry_type)}>
                        {l.voucher_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-body text-ink">
                      {l.invoice_ref ?? l.narration ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-body">
                      {Number(l.debit) > 0 ? (
                        <span className="text-ink">{rupee(l.debit)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-body">
                      {Number(l.credit) > 0 ? (
                        <span className="text-emerald-700">{rupee(l.credit)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium whitespace-nowrap ${
                        Number(l.balance) > 0
                          ? "text-destructive"
                          : Number(l.balance) < 0
                            ? "text-emerald-700"
                            : "text-ink"
                      }`}
                    >
                      {rupee(l.balance)}
                    </TableCell>
                  </TableRow>
                ))}
                {report && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted">
                      No ledger entries to show.
                    </TableCell>
                  </TableRow>
                )}
                {!report && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted">
                      Statement unavailable; no financial totals are shown.
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
              {report && (
                <p className="mt-3 text-caption text-muted">
                  Effective-date view of the current ledger. {report.recordingTimeDisclosure}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-body">
                <span className="text-muted">Total debits{qualified ? " (classified only)" : ""}</span>
                <span className="text-ink">{report ? rupee(report.debit) : "—"}</span>
              </div>
              <div className="flex justify-between text-body">
                <span className="text-muted">Total credits{qualified ? " (classified only)" : ""}</span>
                <span className="text-emerald-700">{report ? rupee(report.credit) : "—"}</span>
              </div>
              <div className="flex justify-between text-title-sm font-semibold pt-2 border-t border-hairline">
                <span className="text-ink">Closing balance{qualified ? " (classified only)" : ""}</span>
                <span
                  className={
                    closing !== null && Number(closing) > 0
                      ? "text-destructive"
                      : closing !== null && Number(closing) < 0
                        ? "text-emerald-700"
                        : "text-ink"
                  }
                >
                  {closing === null ? "—" : rupee(closing)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </CardCanvas>
    </DashboardLayout>
  );
}
