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
import { isPostgresConfigured } from "@/lib/db/prisma";
import { formatBusinessDate } from "@/lib/utils/business-date";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportSupplierPayablesCsvAction, loadSupplierAgingReport } from "@/app/_actions/aging-report.actions";
import { formatRupeeAmount, type AgingReport } from "@/domain/services/aging-report.service";

export const metadata: Metadata = {
  title: "Supplier Payables",
};

const rupee = (n: number | null | undefined | string | bigint) => {
  const num = typeof n === "string" || typeof n === "bigint" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "₹ 0.00";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const agingBucketVariant = (buckets: {
  current: number | string;
  d30: number | string;
  d60: number | string;
  d90: number | string;
  over90: number | string;
}) => {
  if (Number(buckets.over90) > 0.001) return { label: ">90 days", variant: "destructive" as const };
  if (Number(buckets.d90) > 0.001) return { label: "61-90 days", variant: "warning" as const };
  if (Number(buckets.d60) > 0.001) return { label: "31-60 days", variant: "warning" as const };
  if (Number(buckets.d30) > 0.001) return { label: "1-30 days", variant: "success" as const };
  if (Number(buckets.current) > 0.001) return { label: "Current", variant: "success" as const };
  return { label: "No dues", variant: "success" as const };
};

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

  const dbOk = isPostgresConfigured();

  let report: AgingReport | null = null;
  let unavailableReason: string | null = null;

  if (dbOk) {
    try {
      const loaded = await loadSupplierAgingReport();
      if (loaded.ok) report = loaded.report;
      else unavailableReason = loaded.reason;
    } catch (error) {
      console.error("Supplier payables report failed:", error);
      unavailableReason = "Supplier payables unavailable: access or tenant context could not be verified.";
    }
  }
  const reportError = dbOk && report === null;

  const needle = (q ?? "").toLowerCase();
  const filteredRows = (report?.rows ?? []).filter((row) => {
    const party = row.party;
    if (needle && ![party.name, party.code, party.contact, party.phone, party.city, party.state]
      .some((value) => (value ?? "").toLowerCase().includes(needle))) return false;
    if (state && (party.state ?? "").toLowerCase() !== state.toLowerCase()) return false;
    if (minPayable !== undefined && Number.isFinite(minPayable) && minPayable >= 0 && Number(row.total) < minPayable) return false;
    return true;
  });
  const total = filteredRows.length;
  const items = filteredRows.slice((page - 1) * pageSize, page * pageSize);

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
            Outstanding payables by supplier with current / 1-30 / 31-60 / 61-90 / &gt;90 days buckets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportSupplierPayablesCsvAction} disabled={!dbOk || reportError}>
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
            <strong className="font-semibold">Supplier payables unavailable: database is not configured.</strong>
          </div>
        </div>
      )}
      {reportError && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unavailableReason ?? "Supplier payables unavailable."} No totals are shown.
        </div>
      )}
      {report?.banner && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {report.banner}
        </div>
      )}
      {report && (
        <p className="mb-4 text-caption text-muted">
          As of {formatBusinessDate(report.businessDate)} (Asia/Kolkata) · {report.completeness === "COMPLETE" ? "Complete" : "Qualified"} ·
          Total classified {rupee(report.totals.classified_total)}
          {report.unclassifiedCount > 0 && <> · Due date unclassified {formatRupeeAmount(report.totals.unclassified)} ({report.unclassifiedCount} invoices)</>}
          <br />
          <span className="text-xs">Recording time is database statement time captured before commit; not commit-visible and not proof of knowledge-as-of.</span>
        </p>
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
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1-30</TableHead>
                <TableHead className="text-right">31-60</TableHead>
                <TableHead className="text-right">61-90</TableHead>
                <TableHead className="text-right">&gt;90</TableHead>
                <TableHead className="text-right">Due date unclassified</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && !reportError && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted text-body-md">
                    {hasFilter
                      ? "No suppliers match the current filters."
                      : "No suppliers with payable balances yet."}
                  </TableCell>
                </TableRow>
              ) : !dbOk || reportError ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted text-body-md">
                    Supplier payables unavailable; no financial results are shown.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((buckets) => {
                  const s = buckets.party;
                  const pay = Number(buckets.total);
                  const badge = agingBucketVariant(buckets);
                  return (
                    <TableRow key={s.id || "no-supplier"}>
                      <TableCell className="font-medium text-ink">
                        {s.id ? (
                          <Link
                            href={`/suppliers/${s.id}`}
                            className="inline-flex items-center gap-2 hover:underline"
                          >
                            <Package className="h-4 w-4 text-muted" />
                            {s.code ?? "—"}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-body font-medium text-ink">{s.name || "—"}</TableCell>
                      <TableCell className="text-body">{s.city ?? "—"}</TableCell>
                      <TableCell className="text-body font-mono text-xs uppercase">{s.state ?? "—"}</TableCell>
                      <TableCell className="text-body">{s.phone ?? "—"}</TableCell>
                      <TableCell className={`text-right font-semibold ${pay > 0 ? "text-semantic-error" : "text-ink"}`}>
                        {rupee(pay)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.current)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.d30)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.d60)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.d90)}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupee(buckets.over90)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rupee(buckets.unclassified)}
                        {buckets.unclassifiedCount > 0 && (
                          <p className="text-caption text-muted">{buckets.unclassifiedCount} invoices</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Number(buckets.classified_total) > 0 && <Badge variant={badge.variant}>{badge.label}</Badge>}
                          {buckets.unclassifiedCount > 0 && <Badge variant="warning">Due date unclassified</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>

      {dbOk && !reportError && <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
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
      </div>}
    </DashboardLayout>
  );
}
