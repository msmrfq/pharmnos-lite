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
  AlertTriangle,
  FileSpreadsheet,
  Warehouse,
  IndianRupee,
  Clock,
  Info,
  FilterX,
} from "lucide-react";
import { isPostgresConfigured, prisma } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportStockValuationCsvAction } from "@/app/_actions/exports.actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Stock Valuation",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const SCHEDULE_OPTIONS = [
  "OTC",
  "H",
  "H1",
  "X",
  "SCHEDULE_H",
  "SCHEDULE_H1",
  "SCHEDULE_X",
  "OTHER",
];

const scheduleLabel = (sc: string | null | undefined): string => {
  if (!sc) return "—";
  switch (sc) {
    case "SCHEDULE_H":
    case "H":
      return "Schedule H";
    case "SCHEDULE_H1":
    case "H1":
      return "Schedule H1";
    case "SCHEDULE_X":
    case "X":
      return "Schedule X";
    case "OTC":
      return "OTC";
    case "OTHER":
      return "Other";
    default:
      return sc;
  }
};

type ValuationRow = {
  id: string;
  sku: string | null;
  name: string;
  schedule_classification: string | null;
  hsn_code: string | null;
  mrp: number | null;
  avail: number;
  batchesCount: number;
  avgRate: number;
  totalValue: number;
  nearExpireCount: number;
};

export default async function StockValuationPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    schedule?: string;
    include_expiring_only?: string;
    page?: string;
  };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() ?? "";
  const scheduleFilter = searchParams?.schedule?.trim() ?? "";
  const includeExpiringOnly = searchParams?.include_expiring_only === "1";
  const hasFilter = Boolean(q || scheduleFilter || includeExpiringOnly);

  let dbOk = isPostgresConfigured();

  let items: ValuationRow[] = [];
  let total = 0;
  let distinctSchedules: string[] = [];
  let summarySkus = 0;
  let summaryBatches = 0;
  let summaryValue = 0;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const t = ctx;

      try {
        const schedRows = await (prisma as any).products.findMany({
          where: { tenant_id: t.tenantId, schedule_classification: { not: null } },
          select: { schedule_classification: true },
          distinct: ["schedule_classification"],
          take: 100,
        });
        distinctSchedules = schedRows
          .map((r: any) => r.schedule_classification as string)
          .filter((s: any) => typeof s === "string" && s.trim().length > 0)
          .sort();
      } catch {
        distinctSchedules = [];
      }

      const allProducts = await (prisma as any).products.findMany({
        where: { tenant_id: t.tenantId },
        include: {
          batches: {
            orderBy: { expiry_date: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      const nearCutoff = new Date();
      nearCutoff.setDate(nearCutoff.getDate() + 60);

      const computed: ValuationRow[] = [];
      for (const p of allProducts as any[]) {
        const batches = p.batches ?? [];
        const avail = batches.reduce((s: number, b: any) => s + Number(b.available_qty ?? 0), 0);
        const batchesCount = batches.length;
        let weightedSum = 0;
        for (const b of batches) {
          weightedSum += Number(b.available_qty ?? 0) * Number(b.purchase_rate ?? 0);
        }
        const avgRate = avail > 0 ? weightedSum / avail : 0;
        const totalValue = avail * avgRate;
        let nearExpireCount = 0;
        for (const b of batches) {
          if (b.expiry_date && Number(b.available_qty ?? 0) > 0) {
            const exp = b.expiry_date instanceof Date ? b.expiry_date : new Date(b.expiry_date);
            if (exp.getTime() <= nearCutoff.getTime()) {
              nearExpireCount++;
            }
          }
        }
        computed.push({
          id: p.id,
          sku: p.sku ?? null,
          name: p.name ?? "",
          schedule_classification: p.schedule_classification ?? null,
          hsn_code: p.hsn_code ?? null,
          mrp: p.mrp ?? null,
          avail,
          batchesCount,
          avgRate,
          totalValue,
          nearExpireCount,
        });
      }

      let filtered = computed;

      if (q) {
        const qLower = q.toLowerCase();
        filtered = filtered.filter((r) =>
          (r.name?.toLowerCase().includes(qLower) ?? false) ||
          (r.sku?.toLowerCase().includes(qLower) ?? false) ||
          (r.hsn_code?.toLowerCase().includes(qLower) ?? false)
        );
      }

      if (scheduleFilter) {
        filtered = filtered.filter((r) => r.schedule_classification === scheduleFilter);
      }

      if (includeExpiringOnly) {
        filtered = filtered.filter((r) => r.nearExpireCount > 0);
      }

      total = filtered.length;
      summarySkus = filtered.length;
      for (const r of filtered) {
        summaryBatches += r.batchesCount;
        summaryValue += r.totalValue;
      }

      const startIdx = (page - 1) * pageSize;
      items = filtered.slice(startIdx, startIdx + pageSize);
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (scheduleFilter) params.set("schedule", scheduleFilter);
    if (includeExpiringOnly) params.set("include_expiring_only", "1");
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/stock-valuation?${qs}` : "/reports/stock-valuation";
  };

  const totalPagesLabel = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5 flex-wrap">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Stock Valuation</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Closing stock value at weighted average purchase rate per SKU × available quantity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportStockValuationCsvAction}>
            <Download className="h-4 w-4" /> Export CSV
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">Showing placeholder rows until database is connected.</strong>
            <span className="ml-1">Temporary Supabase pooler timeout — retry in 60 seconds.</span>
          </div>
        </div>
      )}

      <CardCanvas className="mb-5">
        <CardContent className="p-4">
          <form
            action={buildHref({ page: undefined })}
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end"
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
                placeholder="Product, SKU, HSN..."
                defaultValue={q}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule" className="text-caption font-medium text-muted block">
                Schedule
              </Label>
              <select
                id="schedule"
                name="schedule"
                defaultValue={scheduleFilter}
                className={cn(
                  "flex h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-body-md text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="">All schedules</option>
                {(distinctSchedules.length > 0 ? distinctSchedules : SCHEDULE_OPTIONS).map((s) => (
                  <option key={s} value={s}>
                    {scheduleLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-caption font-medium text-muted block">
                &nbsp;
              </Label>
              <label className="flex items-center gap-2.5 h-10 px-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="include_expiring_only"
                  value="1"
                  defaultChecked={includeExpiringOnly}
                  className="h-4 w-4 rounded border-hairline text-primary focus:ring-ink/30"
                />
                <span className="text-body-md text-ink">
                  Only SKUs with near-expiry batches
                </span>
              </label>
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
                  <Link href="/reports/stock-valuation">
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
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Avg rate</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Batches</TableHead>
                <TableHead className="text-right">Value ₹</TableHead>
                <TableHead>Near-exp batches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                    {hasFilter
                      ? "No SKUs match the current filters."
                      : "No products with stock valuation data yet."}
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
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted">
                      {r.sku ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium text-ink">
                      {r.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-body">
                      {scheduleLabel(r.schedule_classification)}
                    </TableCell>
                    <TableCell className="text-body font-mono text-xs">
                      {r.hsn_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.mrp ? rupee(r.mrp) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.avail > 0 ? rupee(r.avgRate) : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${r.avail === 0 ? "text-muted" : "text-ink"}`}>
                      {r.avail}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.batchesCount}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                      {rupee(r.totalValue)}
                    </TableCell>
                    <TableCell>
                      {r.nearExpireCount > 0 ? (
                        <Badge variant={r.nearExpireCount >= 3 ? "destructive" : "warning"}>
                          <Clock className="h-3 w-3" /> {r.nearExpireCount}
                        </Badge>
                      ) : (
                        <Badge variant="success">0</Badge>
                      )}
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
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} SKUs · Page {page} / {totalPagesLabel}
          {q && <span className="ml-2">· Search: “{q}”</span>}
          {scheduleFilter && <span className="ml-2">· Schedule: {scheduleLabel(scheduleFilter)}</span>}
          {includeExpiringOnly && <span className="ml-2">· Near-expiry only</span>}
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
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total SKUs
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? summarySkus : 0}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <Warehouse className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total batches
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? summaryBatches : 0}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Closing stock value
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryValue) : rupee(0)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-hairline-soft">
              <div className="flex items-start gap-2 text-caption text-muted">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  Method: weighted average purchase rate × available quantity per SKU.
                  Near-expiry window = 60 days from today.
                </p>
              </div>
            </div>
          </CardContent>
        </CardCanvas>
      </div>
    </DashboardLayout>
  );
}
