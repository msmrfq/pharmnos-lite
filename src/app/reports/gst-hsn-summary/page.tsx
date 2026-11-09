import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  IndianRupee,
  FilterX,
  Info,
} from "lucide-react";
import { isPostgresConfigured, prisma } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext, establishTenantContext } from "@/lib/db/tenant-context";
import { PermissionAction, Prisma } from "@prisma/client";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportGstHsnSummaryCsvAction } from "@/app/_actions/exports.actions";
import { ReportUnavailableError, describeReportFailure } from "@/domain/services/financial-report-completeness";
import {
  HSN_INCOMPLETE_BANNER, currentBusinessMonthBounds, hsnExclusionNotice, hsnRowMatchesQuery,
  loadHsnInvoices, parseHsnFilter, type HsnExclusionSummary,
} from "@/domain/services/gst-hsn-date-filter";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "GST HSN Summary",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "\u2014";
  return `\u20B9 ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

type HsnRow = {
  key: string;
  hsn: string;
  description: string;
  rate_pct: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_gst: number;
  invoices_count: number;
  total_invoice_value: number;
};

type CounterpartyFilter = "all" | "b2b" | "unregistered";

export default async function GstHsnSummaryPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    from?: string;
    to?: string;
    party?: string;
    page?: string;
  };
}) {
  const monthDefaults = currentBusinessMonthBounds();
  const fromStr = searchParams?.from?.trim() || monthDefaults.from;
  const toStr = searchParams?.to?.trim() || monthDefaults.to;
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() ?? "";
  const party = (searchParams?.party?.trim() || "all") as CounterpartyFilter;
  // The CSV receives the identical resolved inputs, so page and export share one filter.
  const reportInput = { from: fromStr, to: toStr, party, q };
  const hasFilter = Boolean(q || party !== "all" || fromStr !== monthDefaults.from || toStr !== monthDefaults.to);

  let dbOk = isPostgresConfigured();
  let reportError: string | null = null;
  let exclusions: HsnExclusionSummary = { count: 0, taxable: "0.00", gst: "0.00", total: "0.00" };

  let items: HsnRow[] = [];
  let total = 0;
  let summaryTaxable = 0;
  let summaryGst = 0;
  let summaryGrand = 0;

  if (dbOk) {
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, PermissionAction.view_reports);
    try {
      const t = ctx;
      const filter = parseHsnFilter(reportInput);

      const loaded = await prisma.$transaction(async (tx) => {
        await establishTenantContext(tx, ctx);
        return loadHsnInvoices(tx as any, t.tenantId, filter);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
      const invoices = loaded.invoices;
      exclusions = loaded.exclusions;

      const groupMap = new Map<string, HsnRow>();

      for (const inv of invoices as any[]) {
        const invId = inv.id;
        const invItems = inv.items ?? [];
        for (const it of invItems) {
          const hsn = it.hsn_code_snapshot ?? "UNCLASSIFIED";
          const ratePct = Number(it.gst_rate ?? 0);
          const gstAmount = Number(it.gst_amount ?? 0);
          const lineTotal = Number(it.line_total ?? 0);
          const taxableValue = Number(it.taxable_amount ?? (lineTotal - gstAmount));
          const key = `${hsn}||${ratePct}`;
          let g = groupMap.get(key);
          if (!g) {
            g = {
              key, hsn, description: "", rate_pct: ratePct,
              taxable_value: 0, cgst: 0, sgst: 0, igst: 0, total_gst: 0,
              invoices_count: 0, total_invoice_value: 0,
            };
            (g as any)._invoicesSet = new Set<string>();
            groupMap.set(key, g);
          }
          g.description = it.product_name_snapshot ?? g.description;
          g.taxable_value += taxableValue;
          g.cgst += Number(it.cgst_amount ?? 0);
          g.sgst += Number(it.sgst_amount ?? 0);
          g.igst += Number(it.igst_amount ?? 0);
          g.total_gst += gstAmount;
          (g as any)._invoicesSet.add(invId);
        }
      }

      const computed: HsnRow[] = [];
      for (const g of groupMap.values()) {
        g.total_invoice_value = g.taxable_value + g.total_gst;
        g.invoices_count = (g as any)._invoicesSet?.size ?? 0;
        computed.push(g);
      }
      computed.sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate_pct - b.rate_pct);

      const filtered = computed.filter((r) => hsnRowMatchesQuery(r, filter.q));

      total = filtered.length;
      for (const r of filtered) {
        summaryTaxable += r.taxable_value;
        summaryGst += r.total_gst;
        summaryGrand += r.total_invoice_value;
      }

      const startIdx = (page - 1) * pageSize;
      items = filtered.slice(startIdx, startIdx + pageSize);
    } catch (err) {
      if (err instanceof ReportUnavailableError) {
        reportError = describeReportFailure(err).reason;
      } else {
        dbOk = false;
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    if (party !== "all") params.set("party", party);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/gst-hsn-summary?${qs}` : "/reports/gst-hsn-summary";
  };

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5 flex-wrap">
        <div>
          <CardTitle className="text-display-sm tracking-brand">GST HSN Summary</CardTitle>
          <p className="mt-1 text-body-md text-body">
            IGST / CGST / SGST aggregates by HSN code and GST rate for GSTR-1 returns filing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton
            variant="secondary"
            action={exportGstHsnSummaryCsvAction.bind(null, reportInput)}
            disabled={!dbOk || reportError !== null}
          >
            <Download className="h-4 w-4" /> Export CSV
          </ExportCsvButton>
        </div>
      </CardHeader>

      {reportError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <strong className="font-semibold">GST HSN summary unavailable.</strong>
            <span className="ml-1">{reportError} No totals are shown.</span>
          </div>
        </div>
      )}

      {!reportError && hsnExclusionNotice(exclusions) && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">{HSN_INCOMPLETE_BANNER}.</strong>
            <span className="ml-1">{hsnExclusionNotice(exclusions)}. These invoices are not in any row or total below.</span>
          </div>
        </div>
      )}

      {!dbOk && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">Showing placeholder rows until database is connected.</strong>
            <span className="ml-1">Temporary Supabase pooler timeout \u2014 retry in 60 seconds.</span>
          </div>
        </div>
      )}

      <CardCanvas className="mb-5">
        <CardContent className="p-4">
          <form
            action={buildHref({ page: undefined })}
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end"
          >
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
                placeholder="HSN code, description\u2026"
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
              <Label htmlFor="party" className="text-caption font-medium text-muted block">
                Counterparty
              </Label>
              <select
                id="party"
                name="party"
                defaultValue={party}
                className={cn(
                  "flex h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-body-md text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="all">All counterparties</option>
                <option value="b2b">B2B (with GSTIN)</option>
                <option value="unregistered">Unregistered</option>
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
                  <Link href="/reports/gst-hsn-summary">
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
                <TableHead>HSN</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Tax rate %</TableHead>
                <TableHead className="text-right">Taxable value \u20B9</TableHead>
                <TableHead className="text-right">CGST \u20B9</TableHead>
                <TableHead className="text-right">SGST \u20B9</TableHead>
                <TableHead className="text-right">IGST \u20B9</TableHead>
                <TableHead className="text-right">Total tax \u20B9</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Total \u20B9</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                    {reportError
                      ? "Report unavailable."
                      : hasFilter
                      ? "No HSN rows match the current filters."
                      : "No FINALIZED sales invoices in the selected date range yet."}
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                    Showing placeholder rows until database is connected.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-mono text-xs text-ink whitespace-nowrap">
                      {r.hsn ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-body max-w-xs truncate">
                      {r.description ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {Number.isFinite(r.rate_pct) ? r.rate_pct.toFixed(2) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums whitespace-nowrap">
                      {rupee(r.taxable_value)}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums whitespace-nowrap">
                      {rupee(r.cgst)}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums whitespace-nowrap">
                      {rupee(r.sgst)}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums whitespace-nowrap">
                      {rupee(r.igst)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-ink tabular-nums whitespace-nowrap">
                      {rupee(r.total_gst)}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.invoices_count}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                      {rupee(r.total_invoice_value)}
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
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} HSN rows \u00b7 Page {page} / {totalPages}
          {q && <span className="ml-2">\u00b7 Search: \u201C{q}\u201D</span>}
          <span className="ml-2">\u00b7 Range: {fromStr} \u2192 {toStr}</span>
          {party !== "all" && <span className="ml-2">\u00b7 {party === "b2b" ? "B2B only" : "Unregistered only"}</span>}
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
                    Total taxable{exclusions.count > 0 ? " (dated invoices only)" : ""}
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryTaxable) : rupee(0)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total GST
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryGst) : rupee(0)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Grand total
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryGrand) : rupee(0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-hairline-soft">
              <div className="flex items-start gap-2 text-caption text-muted">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  Method: portable TS aggregate (no SQL group-by). FINALIZED sales invoices only, placed by their
                  effective date (Asia/Kolkata calendar date, inclusive range); invoices without a classified date are
                  excluded and disclosed above.
                  CGST/SGST half-half for intrastate (same state), IGST full for interstate.
                </p>
              </div>
            </div>
          </CardContent>
        </CardCanvas>
      </div>
    </DashboardLayout>
  );
}
