import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Download, Search, ChevronLeft, ChevronRight, Truck, Calendar as CalendarIcon } from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportPurchaseRegisterCsvAction, loadFinancialRegisterReport } from "@/app/_actions/exports.actions";
import { describeReportFailure, type RegisterExclusionSummary } from "@/domain/services/financial-report-completeness";
import { QualifiedReportBanner, ReportUnavailableNotice } from "@/components/reports/report-completeness-notices";
import { formatBusinessDate } from "@/lib/utils/business-date";

export const metadata: Metadata = {
  title: "Purchase Register",
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

function buildQs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`).join("&");
}

export default async function PurchaseRegisterPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; supplierId?: string; startDate?: string; endDate?: string; mode?: string };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q ?? "";
  const supplierId = searchParams?.supplierId === "all" ? "" : (searchParams?.supplierId ?? "");
  const startDate = searchParams?.startDate ?? "";
  const endDate = searchParams?.endDate ?? "";
  const rawMode = searchParams?.mode;
  const qualified = rawMode === "qualified";
  // The raw mode is validated by the report loader; an unknown mode fails closed there.
  const reportInput = { q, partyId: supplierId, startDate, endDate, ...(rawMode !== undefined ? { mode: rawMode } : {}) };
  let dbOk = isPostgresConfigured();
  let failure: { reason: string; qualifiedModeAvailable: boolean } | null = null;
  let exclusions: RegisterExclusionSummary | null = null;

  let items: any[] = [];
  let total = 0;
  let suppliers: any[] = [];

  if (dbOk) {
    try {
      const result = await loadFinancialRegisterReport("purchase", reportInput);
      suppliers = result.parties;
      total = result.rows.length;
      const startIdx = (page - 1) * pageSize;
      items = result.rows.slice(startIdx, startIdx + pageSize);
      exclusions = result.mode === "qualified" ? result.exclusions : null;
    } catch (error) {
      dbOk = false;
      failure = describeReportFailure(error);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filterQs = (overrides: Record<string, string | undefined> = {}) =>
    buildQs({
      q: q || undefined,
      supplierId: supplierId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      mode: rawMode,
      ...overrides,
    });
  const pageQs = (p: number) => filterQs({ page: p > 1 ? String(p) : undefined });

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Purchase Register</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Purchases by effective date, supplier and reference. Export uses the same filters; not a historical knowledge-time snapshot.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Register unavailable; no financial results are shown.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportPurchaseRegisterCsvAction.bind(null, reportInput)} disabled={!dbOk}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
          <Button asChild variant="secondary">
            <Link href="/reports">
              Back to reports
            </Link>
          </Button>
        </div>
      </CardHeader>

      {!dbOk && (
        <ReportUnavailableNotice
          title="Register unavailable."
          reason={failure?.reason ?? "The report could not be loaded."}
          qualifiedHref={failure?.qualifiedModeAvailable && !qualified ? `/reports/purchase-register${filterQs({ mode: "qualified" })}` : null}
        />
      )}

      {dbOk && exclusions && (
        <QualifiedReportBanner
          excludedLabel="invoices"
          excludedCount={exclusions.excludedCount}
          amounts={[{ label: "excluded net amount", value: rupee(exclusions.excludedNet) }]}
          byReason={exclusions.byReason}
          completeHref={`/reports/purchase-register${filterQs({ mode: undefined })}`}
        />
      )}

      {!dbOk || !exclusions ? null : (
        <p className="mb-4 text-caption text-muted">
          Recording time is database statement time captured before commit; not commit-visible and not proof of knowledge-as-of.
        </p>
      )}

      <CardCanvas className="mb-5">
        <CardContent>
          <form action="" method="get" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end">
            {rawMode !== undefined ? <input type="hidden" name="mode" value={rawMode} /> : null}
            <div className="space-y-1.5">
              <label className="text-caption font-medium text-muted">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Invoice no, supplier, ref"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-medium text-muted">Supplier</label>
              <Select name="supplierId" defaultValue={supplierId || "all"}>
                <SelectTrigger>
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.business_name || s.code || s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-medium text-muted flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> From date
              </label>
              <Input
                type="date"
                name="startDate"
                defaultValue={startDate}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-medium text-muted flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> To date
              </label>
              <Input
                type="date"
                name="endDate"
                defaultValue={endDate}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="default">
                Apply
              </Button>
              <Button
                type="button"
                variant="ghost"
                asChild
              >
                <Link href="/reports/purchase-register">
                  Reset
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </CardCanvas>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice no.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Disc</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-muted text-body-md">
                    No purchase entries found for the current filters.
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-muted text-body-md">
                    Register unavailable; no financial results are shown.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p: any) => {
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted" />
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
                        {p.supplier_invoice_no ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>
                          {p.status ?? "DRAFT"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(p.gross_amount)}</TableCell>
                      <TableCell
                        className={`text-right ${
                          Number(p.total_discount ?? 0) > 0 ? "text-body" : "text-muted"
                        }`}
                      >
                        {rupee(p.total_discount)}
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(p.total_tax)}</TableCell>
                      <TableCell className="text-right font-semibold text-ink whitespace-nowrap">
                        {rupee(p.net_amount)}
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
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} entries · Page {page} / {totalPages}
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
            <Link href={page <= 1 ? "/reports/purchase-register" : `/reports/purchase-register${pageQs(page - 1)}`}>
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
            <Link href={`/reports/purchase-register${pageQs(page + 1)}`}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
