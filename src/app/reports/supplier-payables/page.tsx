import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Package,
  Download,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  FilterX,
} from "lucide-react";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportSupplierPayablesCsvAction } from "@/app/_actions/exports.actions";

export const metadata: Metadata = {
  title: "Supplier Payables",
};

const rupee = (n: number | null | undefined | string | bigint) => {
  const num = typeof n === "string" || typeof n === "bigint" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "₹ 0.00";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const agingBucketVariant = (buckets: {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  over90: number;
}) => {
  if (buckets.over90 > 0.001) return { label: "90+ days", variant: "destructive" as const };
  if (buckets.d90 > 0.001) return { label: "61-90 days", variant: "warning" as const };
  if (buckets.d60 > 0.001) return { label: "31-60 days", variant: "warning" as const };
  if (buckets.d30 > 0.001 || buckets.current > 0.001) return { label: "Current", variant: "success" as const };
  return { label: "No dues", variant: "success" as const };
};

type AgingBuckets = { current: number; d30: number; d60: number; d90: number; over90: number; total: number };

export default async function SupplierPayablesPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; state?: string; min_payable?: string };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() || undefined;
  const state = searchParams?.state?.trim() || undefined;
  const minPayableRaw = searchParams?.min_payable?.trim();
  const minPayable = minPayableRaw ? Number(minPayableRaw) : undefined;
  const hasFilter = Boolean(q || state || (minPayable !== undefined && Number.isFinite(minPayable)));

  let dbOk = isPostgresConfigured();
  const ctx = dbOk ? await requireServerTenantContext().catch(() => null) : null;

  let items: any[] = [];
  let total = 0;
  const agingPerSupplier = new Map<string, AgingBuckets>();

  if (dbOk && ctx) {
    try {
      const listParams: any = {
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { business_name: "asc" },
        search: q,
        state,
      };
      if (minPayable !== undefined && Number.isFinite(minPayable) && minPayable >= 0) {
        listParams.minPayable = minPayable;
      }
      const result = await repos.suppliers.list(listParams, ctx);
      items = result.items;
      total = result.total;

      const perItemCalls: Promise<void>[] = items.map(async (s: any) => {
        try {
          const pay = Number(s.payable_balance ?? 0);
          if (pay <= 0.001) {
            agingPerSupplier.set(s.id, { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 });
            return;
          }
          const buckets = await repos.supplierLedgers.getAgingBuckets(ctx, s.id);
          agingPerSupplier.set(s.id, buckets);
        } catch (_) {
          agingPerSupplier.set(s.id, { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 });
        }
      });
      await Promise.all(perItemCalls);
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (state) params.set("state", state);
    if (minPayableRaw) params.set("min_payable", minPayableRaw);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/supplier-payables?${qs}` : `/reports/supplier-payables`;
  };

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5 flex-wrap">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Supplier Payables (Aging)</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Outstanding payables by supplier with 0-30 / 31-60 / 61-90 / 90+ days buckets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportSupplierPayablesCsvAction}>
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
            <strong className="font-semibold">Showing placeholder values until database is connected.</strong>
            <span className="ml-1">Temporary Supabase pooler timeout is common on the free tier — try again in 60 seconds.</span>
          </div>
        </div>
      )}

      <CardCanvas className="mb-4">
        <CardContent className="p-4">
          <form action={buildHref({ page: undefined })} method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] items-end">
            <div className="space-y-1.5">
              <label className="text-caption font-medium uppercase tracking-wide text-muted">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Code, supplier, phone, GSTIN…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-caption font-medium uppercase tracking-wide text-muted">State</label>
              <Input
                name="state"
                defaultValue={state}
                placeholder="e.g. Maharashtra"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-caption font-medium uppercase tracking-wide text-muted">Min. payable (₹)</label>
              <Input
                name="min_payable"
                type="number"
                min="0"
                step="1"
                defaultValue={minPayableRaw}
                placeholder="e.g. 1000"
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full md:w-auto">
              Apply
            </Button>
            {hasFilter ? (
              <Button
                type="button"
                variant="ghost"
                asChild
                className="w-full md:w-auto"
              >
                <Link href="/reports/supplier-payables">
                  <FilterX className="h-4 w-4" /> Clear
                </Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </CardCanvas>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>City</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Payable</TableHead>
                <TableHead className="text-right">Current 0-30</TableHead>
                <TableHead className="text-right">31-60</TableHead>
                <TableHead className="text-right">61-90</TableHead>
                <TableHead className="text-right">90+</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-muted text-body-md">
                    {hasFilter
                      ? "No suppliers match the current filters."
                      : "No suppliers with payable balances yet."}
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-muted text-body-md">
                    Showing placeholder rows until database is connected.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((s: any) => {
                  const pay = Number(s.payable_balance ?? 0);
                  const buckets = agingPerSupplier.get(s.id) ?? {
                    current: 0,
                    d30: 0,
                    d60: 0,
                    d90: 0,
                    over90: 0,
                    total: 0,
                  };
                  const badge = agingBucketVariant(buckets);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <Package className="h-4 w-4 text-muted" />
                          {s.code ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-body font-medium text-ink">{s.business_name ?? "—"}</TableCell>
                      <TableCell className="text-body">{s.city ?? "—"}</TableCell>
                      <TableCell className="text-body font-mono text-xs uppercase">{s.state ?? "—"}</TableCell>
                      <TableCell className="text-body">{s.phone ?? s.mobile ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${pay > 0 ? "text-semantic-error" : "text-ink"}`}>
                        {rupee(pay)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.current)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.d30)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.d60)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.over90)}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>

      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <p className="text-caption text-muted">
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} suppliers · Page {page} / {totalPages}
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
    </DashboardLayout>
  );
}
