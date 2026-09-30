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
  FilterX,
} from "lucide-react";
import { isPostgresConfigured, prisma } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportBatchExpiryCsvAction } from "@/app/_actions/exports.actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Batch Expiry",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "\u2014";
  return `\u20B9 ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const WINDOW_OPTIONS = [60, 90, 180, 365];

type BatchRow = {
  id: string;
  batch_no: string;
  product_name: string;
  sku: string | null;
  expiry_date: Date | null;
  days_left: number;
  mrp: number | null;
  purchase_rate: number | null;
  received_qty: number;
  available_qty: number;
  status: "Expired" | "\u226430 days" | "\u226460 days" | "\u226490 days" | "Healthy";
};

const computeStatus = (daysLeft: number): BatchRow["status"] => {
  if (daysLeft < 0) return "Expired";
  if (daysLeft <= 30) return "\u226430 days";
  if (daysLeft <= 60) return "\u226460 days";
  if (daysLeft <= 90) return "\u226490 days";
  return "Healthy";
};

const statusVariant = (s: BatchRow["status"]): "destructive" | "warning" | "success" => {
  if (s === "Expired" || s === "\u226430 days") return "destructive";
  if (s === "\u226460 days" || s === "\u226490 days") return "warning";
  return "success";
};

export default async function BatchExpiryPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    window?: string;
    page?: string;
  };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() ?? "";
  const windowRaw = Number(searchParams?.window ?? "60");
  const windowDays = WINDOW_OPTIONS.includes(windowRaw) ? windowRaw : 60;
  const hasFilter = Boolean(q);

  let dbOk = isPostgresConfigured();

  let items: BatchRow[] = [];
  let total = 0;
  let summaryAtRisk = 0;
  let summaryExpired = 0;
  let summarySkuAtRisk = 0;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const t = ctx;

      const allBatches = await (prisma as any).product_batches.findMany({
        where: { tenant_id: t.tenantId, is_blocked: false },
        include: { product: { select: { name: true, sku: true } } },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() + windowDays);

      const computed: BatchRow[] = [];
      for (const b of allBatches as any[]) {
        const exp = b.expiry_date ? new Date(b.expiry_date) : null;
        const daysLeft = exp ? Math.ceil((exp.getTime() - today.getTime()) / 86400000) : Infinity;
        if (exp && daysLeft > windowDays) continue;
        computed.push({
          id: b.id,
          batch_no: b.batch_no ?? "",
          product_name: b.product?.name ?? "",
          sku: b.product?.sku ?? null,
          expiry_date: exp,
          days_left: Number.isFinite(daysLeft) ? daysLeft : 99999,
          mrp: b.mrp ?? null,
          purchase_rate: b.purchase_rate ?? null,
          received_qty: Number(b.received_qty ?? 0),
          available_qty: Number(b.available_qty ?? 0),
          status: exp ? computeStatus(daysLeft) : "Healthy",
        });
      }

      computed.sort((a, b) => a.days_left - b.days_left);

      let filtered = computed;

      if (q) {
        const qLower = q.toLowerCase();
        filtered = filtered.filter((r) =>
          (r.product_name?.toLowerCase().includes(qLower) ?? false) ||
          (r.sku?.toLowerCase().includes(qLower) ?? false) ||
          (r.batch_no?.toLowerCase().includes(qLower) ?? false)
        );
      }

      total = filtered.length;
      const atRiskSkus = new Set<string>();
      for (const r of filtered) {
        if (r.status !== "Healthy") {
          summaryAtRisk++;
          if (r.sku) atRiskSkus.add(r.sku);
        }
        if (r.status === "Expired") summaryExpired++;
      }
      summarySkuAtRisk = atRiskSkus.size;

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
    if (windowDays !== 60) params.set("window", String(windowDays));
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/batch-expiry?${qs}` : "/reports/batch-expiry";
  };

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5 flex-wrap">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Batch Expiry</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Product batches sorted by soonest expiry first, for recall, discount and FEFO dispatch planning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportBatchExpiryCsvAction}>
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
            <span className="ml-1">Temporary Supabase pooler timeout \u2014 retry in 60 seconds.</span>
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
                placeholder="Product, SKU, batch no\u2026"
                defaultValue={q}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="window" className="text-caption font-medium text-muted block">
                Expiry window (days)
              </Label>
              <select
                id="window"
                name="window"
                defaultValue={String(windowDays)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-body-md text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {WINDOW_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w} days
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" variant="default">
                Apply
              </Button>
              {hasFilter ? (
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                >
                  <Link href={windowDays !== 60 ? `/reports/batch-expiry?window=${windowDays}` : "/reports/batch-expiry"}>
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
                <TableHead>Batch</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Days left</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Purchase rate</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                    {hasFilter
                      ? "No batches match the current filters."
                      : "No batches within the selected expiry window yet."}
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
                    <TableCell className="font-mono text-xs text-ink">
                      {r.batch_no ?? "\u2014"}
                    </TableCell>
                    <TableCell className="font-medium text-ink">
                      {r.product_name ?? "\u2014"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted">
                      {r.sku ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-body whitespace-nowrap">
                      {r.expiry_date
                        ? new Date(r.expiry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                        : "\u2014"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${r.days_left < 0 || r.days_left <= 30 ? "text-destructive" : r.days_left <= 90 ? "text-warning" : "text-ink"}`}>
                      {Number.isFinite(r.days_left) && r.days_left < 99999 ? r.days_left : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.mrp ? rupee(r.mrp) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.purchase_rate ? rupee(r.purchase_rate) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right text-body tabular-nums">
                      {r.received_qty}
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${r.available_qty === 0 ? "text-muted" : "text-ink"}`}>
                      {r.available_qty}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
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
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} batches \u00b7 Page {page} / {totalPages}
          {q && <span className="ml-2">\u00b7 Search: \u201C{q}\u201D</span>}
          <span className="ml-2">\u00b7 Window: {windowDays}d</span>
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
                    Batches at risk
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? summaryAtRisk : 0}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Expired count
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? summaryExpired : 0}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total SKU at risk
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? summarySkuAtRisk : 0}
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
