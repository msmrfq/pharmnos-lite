import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Receipt, Download, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportSalesRegisterCsvAction, loadFinancialRegisterReport } from "@/app/_actions/exports.actions";
import { describeReportFailure, type RegisterExclusionSummary } from "@/domain/services/financial-report-completeness";
import { QualifiedReportBanner, ReportUnavailableNotice } from "@/components/reports/report-completeness-notices";
import { formatBusinessDate } from "@/lib/utils/business-date";

export const metadata: Metadata = {
  title: "Sales Register",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

function statusVariant(s: string) {
  if (s === "FINALIZED") return "success" as const;
  if (s === "CANCELLED") return "secondary" as const;
  return "warning" as const;
}

function buildQs(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const merged = { ...base, ...overrides };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "" && v !== null) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export default async function SalesRegisterPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    q?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    mode?: string;
  };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q ?? "";
  const customerId = searchParams?.customerId === "all" ? "" : (searchParams?.customerId ?? "");
  const startDate = searchParams?.startDate ?? "";
  const endDate = searchParams?.endDate ?? "";
  const rawMode = searchParams?.mode;
  const qualified = rawMode === "qualified";
  // The raw mode is validated by the report loader; an unknown mode fails closed there.
  const reportInput = { q, partyId: customerId, startDate, endDate, ...(rawMode !== undefined ? { mode: rawMode } : {}) };
  let dbOk = isPostgresConfigured();
  let failure: { reason: string; qualifiedModeAvailable: boolean } | null = null;
  let exclusions: RegisterExclusionSummary | null = null;

  let items: any[] = [];
  let total = 0;
  let customers: any[] = [];

  if (dbOk) {
    try {
      const result = await loadFinancialRegisterReport("sales", reportInput);
      total = result.rows.length;
      items = result.rows.slice((page - 1) * pageSize, page * pageSize);
      customers = result.parties;
      exclusions = result.mode === "qualified" ? result.exclusions : null;
    } catch (error) {
      dbOk = false;
      failure = describeReportFailure(error);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(q || customerId || startDate || endDate);

  const baseQs: Record<string, string | undefined> = {
    q: q || undefined,
    customerId: customerId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    mode: rawMode,
  };

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Sales register</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Invoices by effective date, customer and reference. Export uses the same filters; not a historical knowledge-time snapshot.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Register unavailable; no financial results are shown.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportSalesRegisterCsvAction.bind(null, reportInput)} disabled={!dbOk}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <ReportUnavailableNotice
          title="Register unavailable."
          reason={failure?.reason ?? "The report could not be loaded."}
          qualifiedHref={failure?.qualifiedModeAvailable && !qualified ? `/reports/sales-register${buildQs(baseQs, { mode: "qualified" })}` : null}
        />
      )}

      {dbOk && exclusions && (
        <QualifiedReportBanner
          excludedLabel="invoices"
          excludedCount={exclusions.excludedCount}
          amounts={[{ label: "excluded net amount", value: rupee(exclusions.excludedNet) }]}
          byReason={exclusions.byReason}
          completeHref={`/reports/sales-register${buildQs(baseQs, { mode: undefined })}`}
        />
      )}

      <CardCanvas className="mb-5">
        <CardContent className="pt-4">
          <form action="/reports/sales-register" method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            {rawMode !== undefined ? <input type="hidden" name="mode" value={rawMode} /> : null}
            <div className="space-y-1.5">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Invoice no, ref, customer…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerId">Customer</Label>
              <Select name="customerId" defaultValue={customerId || "all"}>
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.business_name ?? c.customer_name ?? c.code ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">From date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={startDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">To date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={endDate} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Apply
              </Button>
              {hasFilters && (
                <Button type="button" variant="secondary" asChild>
                  <Link href="/reports/sales-register">
                    <X className="h-4 w-4" /> Clear
                  </Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </CardCanvas>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inv no</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Disc</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Round</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Bal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted text-body-md">
                    No invoices match the current filters.
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted text-body-md">
                    Register unavailable; no financial results are shown.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p: any) => {
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="inline-flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted" />
                          {p.invoice_no || "DRAFT"}
                        </div>
                      </TableCell>
                      <TableCell className="text-body whitespace-nowrap">
                        {formatBusinessDate(p.effective_date)}
                      </TableCell>
                      <TableCell className="text-body">
                        {p.party?.business_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-body text-muted">
                        {p.reference_no ?? "—"}
                      </TableCell>
                      <TableCell>
                        {p.is_cash_sale ? (
                          <Badge variant="outline">Cash</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>
                          {p.status ?? "DRAFT"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(p.gross_amount)}</TableCell>
                      <TableCell className={`text-right ${Number(p.total_discount ?? 0) > 0 ? "text-body" : "text-muted"}`}>
                        {rupee(p.total_discount)}
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(p.total_tax)}</TableCell>
                      <TableCell className={`text-right ${Number(p.round_off ?? 0) !== 0 ? "text-body" : "text-muted"}`}>
                        {rupee(p.round_off)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-ink whitespace-nowrap">
                        {rupee(p.net_amount)}
                      </TableCell>
                      <TableCell className="text-right text-body whitespace-nowrap">
                        {rupee(p.paid_amount)}
                      </TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap ${
                          p.is_cash_sale || Number(p.balance_due ?? 0) === 0
                            ? "text-emerald-700 font-medium"
                            : "text-amber-700 font-medium"
                        }`}
                      >
                        {p.is_cash_sale || Number(p.paid_amount ?? 0) >= Number(p.net_amount ?? 0)
                          ? "Paid"
                          : rupee(p.balance_due)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-caption text-muted">
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} invoices · Page {page} / {totalPages}
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
            <Link
              href={
                page <= 1
                  ? `/reports/sales-register${buildQs(baseQs)}`
                  : `/reports/sales-register${buildQs(baseQs, { page: String(page - 1) })}`
              }
            >
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
            <Link href={`/reports/sales-register${buildQs(baseQs, { page: String(page + 1) })}`}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
