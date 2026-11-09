import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardCanvas,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  FilterX,
} from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { businessDateToday, formatBusinessDate, formatBusinessInstant } from "@/lib/utils/business-date";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportDaybookCsvAction, loadFinancialLedgerReport } from "@/app/_actions/exports.actions";
import { describeReportFailure, type LedgerExclusionSummary } from "@/domain/services/financial-report-completeness";
import { QualifiedReportBanner, ReportUnavailableNotice } from "@/components/reports/report-completeness-notices";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Daybook",
};

const rupee = (value: string) => {
  const [whole = "0", fraction = "00"] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{2})+(\d{3})(?!\d))/g, ",");
  return `₹ ${negative ? "-" : ""}${grouped}.${fraction.padEnd(2, "0")}`;
};

type DaybookRow = {
  id: string;
  effective_date: string;
  event_instant: string | null;
  recorded_at: string | null;
  voucher_type: string;
  counterparty: string;
  debit: string;
  credit: string;
  balance: string;
  narration: string | null;
  invoice_ref: string | null;
};

type VoucherFilter = "all" | "invoice" | "payment";

export default async function DaybookPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    from?: string;
    to?: string;
    voucher?: string;
    page?: string;
    mode?: string;
  };
}) {
  const today = businessDateToday();
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [year, month] = today.split("-").map(Number);
  const lastOfMonth = new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
  const fromStr = searchParams?.from || firstOfMonth;
  const toStr = searchParams?.to || lastOfMonth;
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() ?? "";
  const voucherRaw = (searchParams?.voucher?.trim() ?? "all") as VoucherFilter;
  const voucher: VoucherFilter = ["all", "invoice", "payment"].includes(voucherRaw) ? voucherRaw : "all";
  const hasFilter = Boolean(q || voucher !== "all" || fromStr !== firstOfMonth || toStr !== lastOfMonth);
  const rawMode = searchParams?.mode;
  const qualified = rawMode === "qualified";
  // The raw mode is validated by the report loader; an unknown mode fails closed there.
  const reportInput = { from: fromStr, to: toStr, q, voucher, ...(rawMode !== undefined ? { mode: rawMode } : {}) };
  let dbOk = isPostgresConfigured();
  let failure: { reason: string; qualifiedModeAvailable: boolean } | null = null;
  let items: DaybookRow[] = [];
  let total = 0;
  let openingBalance = "0.00";
  let summaryDebit = "0.00";
  let summaryCredit = "0.00";
  let summaryNet = "0.00";
  let exclusions: LedgerExclusionSummary | null = null;

  if (dbOk) {
    try {
      const report = await loadFinancialLedgerReport({ ...reportInput, kind: "daybook" });
      total = report.rows.length;
      items = report.rows.slice((page - 1) * pageSize, page * pageSize);
      openingBalance = report.opening;
      summaryDebit = report.debit;
      summaryCredit = report.credit;
      summaryNet = report.net;
      exclusions = report.mode === "qualified" ? report.exclusions : null;
    } catch (error) {
      dbOk = false;
      failure = describeReportFailure(error);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    if (voucher !== "all") params.set("voucher", voucher);
    if (rawMode !== undefined) params.set("mode", rawMode);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/daybook?${qs}` : "/reports/daybook";
  };

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5 flex-wrap">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Daybook</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Effective-date daybook. Running balances include entries hidden by filters; this is not a historical knowledge-time report.
            {" "}Recording time is database statement time captured before commit, not commit-visible and not proof of knowledge-as-of.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportDaybookCsvAction.bind(null, reportInput)} disabled={!dbOk}>
            <Download className="h-4 w-4" /> Export CSV
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <ReportUnavailableNotice
          title="Daybook unavailable."
          reason={failure?.reason ?? "The report could not be loaded; no financial totals are shown."}
          qualifiedHref={failure?.qualifiedModeAvailable && !qualified ? buildHref({ mode: "qualified", page: undefined }) : null}
        />
      )}

      {dbOk && exclusions && (
        <QualifiedReportBanner
          excludedLabel="ledger entries"
          excludedCount={exclusions.excludedCount}
          amounts={[
            { label: "excluded debit", value: rupee(exclusions.excludedDebit) },
            { label: "excluded credit", value: rupee(exclusions.excludedCredit) },
            { label: "excluded signed amount (D − C)", value: rupee(exclusions.excludedSigned) },
          ]}
          byReason={exclusions.byReason}
          completeHref={buildHref({ mode: undefined, page: undefined })}
          note="Opening and running balances are classified entries only."
        />
      )}

      <CardCanvas className="mb-5">
        <CardContent className="p-4">
          <form
            action={buildHref({ page: undefined })}
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end"
          >
            {rawMode !== undefined ? <input type="hidden" name="mode" value={rawMode} /> : null}
            <div className="space-y-1.5">
              <Label htmlFor="q" className="text-caption font-medium text-muted block">
                <span className="inline-flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" /> Search
                </span>
              </Label>
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Counterparty, narration, ref…"
                defaultValue={q}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-caption font-medium text-muted block">
                From date
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={fromStr}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-caption font-medium text-muted block">
                To date
              </Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={toStr}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher" className="text-caption font-medium text-muted block">
                Voucher type
              </Label>
              <select
                id="voucher"
                name="voucher"
                defaultValue={voucher}
                className={cn(
                  "flex h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-body-md text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="all">All vouchers</option>
                <option value="invoice">Invoices only</option>
                <option value="payment">Payments only</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="default">
                Apply
              </Button>
              {hasFilter ? (
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                >
                  <Link href="/reports/daybook">
                    <FilterX className="h-4 w-4" /> Reset
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </CardCanvas>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher type</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-right">Debit ₹</TableHead>
                <TableHead className="text-right">Credit ₹</TableHead>
                <TableHead className="text-right">Balance ₹{qualified ? " (classified only)" : ""}</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead>Invoice ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted text-body-md">
                    {hasFilter
                      ? "No daybook entries match the current filters."
                      : "No ledger entries in the selected date range yet."}
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted text-body-md">
                    Daybook unavailable; no financial totals are shown.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-body whitespace-nowrap tabular-nums">
                      {formatBusinessDate(r.effective_date)}
                      {r.event_instant || r.recorded_at ? (
                        <span className="block text-[11px] text-muted font-normal">
                          {r.event_instant ? `Event: ${formatBusinessInstant(r.event_instant)}` : "Event instant: none"}
                          {r.recorded_at ? ` · Recorded: ${formatBusinessInstant(r.recorded_at)}` : ""}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-body whitespace-nowrap">
                      <Badge variant="secondary">{r.voucher_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-ink max-w-xs truncate">
                      {r.counterparty ?? "\u2014"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums whitespace-nowrap ${Number(r.debit) > 0 ? "font-medium text-ink" : "text-muted"}`}>
                      {Number(r.debit) > 0 ? rupee(r.debit) : "\u2014"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums whitespace-nowrap ${Number(r.credit) > 0 ? "font-medium text-ink" : "text-muted"}`}>
                      {Number(r.credit) > 0 ? rupee(r.credit) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {r.balance.startsWith("-") ? (
                        <Badge variant="destructive">{rupee(r.balance)}</Badge>
                      ) : (
                        <span className="font-semibold text-ink">{rupee(r.balance)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-body max-w-xs truncate">
                      {r.narration ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-body font-mono text-xs whitespace-nowrap">
                      {r.invoice_ref ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>

      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <p className="text-caption text-muted">
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} entries · Page {page} / {totalPages}
          {q && <span className="ml-2">· Search: “{q}”</span>}
          <span className="ml-2">· Range: {fromStr} → {toStr}</span>
          {voucher !== "all" && <span className="ml-2">· {voucher === "invoice" ? "Invoices only" : "Payments only"}</span>}
          <span className="ml-2">· Opening{qualified ? " (classified entries only)" : ""}: {dbOk ? rupee(openingBalance) : "—"}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            asChild
            aria-disabled={page <= 1}
            className={page <= 1 ? "opacity-60 pointer-events-none" : ""}
          >
            <Link href={buildHref({ page: page <= 1 ? undefined : page - 1 })}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            asChild
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "opacity-60 pointer-events-none" : ""}
          >
            <Link href={buildHref({ page: page >= totalPages ? undefined : page + 1 })}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <CardCanvas>
          <CardContent className="p-5">
            <div className="grid gap-5 sm:grid-cols-3 items-start">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total debits{qualified ? " (classified only)" : ""}
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryDebit) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total credits{qualified ? " (classified only)" : ""}
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryCredit) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Net movement (D − C){qualified ? ", classified only" : ""}
                  </p>
                  <p className={`mt-1 text-display-sm font-display tracking-brand ${summaryNet.startsWith("-") ? "text-destructive" : "text-ink"}`}>
                    {dbOk ? rupee(summaryNet) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </CardCanvas>
      </div>
    </DashboardLayout>
  );
}
