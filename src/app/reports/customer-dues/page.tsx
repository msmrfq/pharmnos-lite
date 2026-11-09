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
  Users,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { formatBusinessDate } from "@/lib/utils/business-date";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportCustomerDuesCsvAction, loadCustomerAgingReport } from "@/app/_actions/aging-report.actions";
import type { AgingReport } from "@/domain/services/aging-report.service";
import { formatRupeeAmount } from "@/domain/services/aging-report.service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Customer Dues",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const agingBucketBadge = (overdueDays: number) => {
  if (overdueDays <= 0) return { label: "Current", variant: "success" as const };
  if (overdueDays <= 30) return { label: "1-30 days", variant: "success" as const };
  if (overdueDays <= 60) return { label: "31-60 days", variant: "warning" as const };
  if (overdueDays <= 90) return { label: "61-90 days", variant: "warning" as const };
  return { label: ">90 days", variant: "destructive" as const };
};

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar", "Chandigarh", "Dadra and Nagar Haveli",
  "Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

export default async function CustomerDuesPage({
  searchParams,
}: {
  searchParams: { q?: string; state?: string; min_due?: string; page?: string };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() ?? "";
  const stateFilter = searchParams?.state?.trim() ?? "";
  const minDueRaw = searchParams?.min_due?.trim() ?? "";
  const minDue = minDueRaw ? Number(minDueRaw) : 0;
  const dbOk = isPostgresConfigured();

  let report: AgingReport | null = null;
  let unavailableReason: string | null = null;

  if (dbOk) {
    try {
      const loaded = await loadCustomerAgingReport();
      if (loaded.ok) report = loaded.report;
      else unavailableReason = loaded.reason;
    } catch (error) {
      console.error("Customer dues report failed:", error);
      unavailableReason = "Customer dues unavailable: access or tenant context could not be verified.";
    }
  }
  const reportError = dbOk && report === null;

  const needle = q.toLowerCase();
  const allRows = report?.rows ?? [];
  const distinctStates = [...new Set(allRows.map((row) => row.party.state).filter((s): s is string => Boolean(s)))].sort();
  const filteredRows = allRows.filter((row) => {
    const party = row.party;
    if (needle && ![party.name, party.code, party.contact, party.phone, party.city, party.state]
      .some((value) => (value ?? "").toLowerCase().includes(needle))) return false;
    if (stateFilter && (party.state ?? "").toLowerCase() !== stateFilter.toLowerCase()) return false;
    if (Number.isFinite(minDue) && minDue > 0 && Number(row.total) < minDue) return false;
    return true;
  });
  const total = filteredRows.length;
  const items = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stateFilter) params.set("state", stateFilter);
    if (minDueRaw) params.set("min_due", minDueRaw);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "") params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/customer-dues?${qs}` : "/reports/customer-dues";
  };

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Customer Dues (Aging)</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Receivables by customer with current / 1-30 / 31-60 / 61-90 / &gt;90 days aging buckets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportCustomerDuesCsvAction} disabled={!dbOk || reportError}>
            <Download className="h-4 w-4" /> Export CSV
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">Customer dues unavailable: database is not configured.</strong>
          </div>
        </div>
      )}
      {reportError && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unavailableReason ?? "Customer dues unavailable."} No totals are shown.
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
        </p>
      )}

      <form action="/reports/customer-dues" method="get" className="mb-5">
        <CardCanvas>
          <CardContent className="py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              <div className="space-y-1.5">
                <label htmlFor="q" className="text-caption font-medium text-muted block">
                  <span className="inline-flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5" /> Search customer
                  </span>
                </label>
                <Input
                  id="q"
                  name="q"
                  type="search"
                  placeholder="Business, code, phone, GSTIN..."
                  defaultValue={q}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="state" className="text-caption font-medium text-muted block">
                  <span className="inline-flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" /> State
                  </span>
                </label>
                <select
                  id="state"
                  name="state"
                  defaultValue={stateFilter}
                  className={cn(
                    "flex h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-body-md text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <option value="">All states</option>
                  {(distinctStates.length > 0 ? distinctStates : INDIAN_STATES).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="min_due" className="text-caption font-medium text-muted block">
                  Minimum receivable (₹)
                </label>
                <Input
                  id="min_due"
                  name="min_due"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 5000"
                  defaultValue={minDueRaw}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="default">
                  Apply
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                >
                  <Link href="/reports/customer-dues">Reset</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </CardCanvas>
      </form>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1-30</TableHead>
                <TableHead className="text-right">31-60</TableHead>
                <TableHead className="text-right">61-90</TableHead>
                <TableHead className="text-right">&gt;90</TableHead>
                <TableHead className="text-right">Due date unclassified</TableHead>
                <TableHead className="text-right">Total open</TableHead>
                <TableHead className="text-right">Recorded balance</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && !reportError && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted text-body-md">
                    {report && report.rows.length === 0 ? "No customers have open invoices." : "No customers match the current filters."}
                  </TableCell>
                </TableRow>
              ) : !dbOk || reportError ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-muted text-body-md">
                    Customer dues unavailable; no financial results are shown.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((buckets) => {
                  const c = buckets.party;
                  const agingDays = buckets.oldestOverdueDays;
                  const bucket = agingBucketBadge(agingDays);
                  const totalDue = Number(buckets.total);
                  return (
                    <TableRow key={`${c.id}`}>
                      <TableCell className="font-medium text-ink">
                        {c.id ? (
                          <Link
                            href={`/customers/${c.id}`}
                            className="inline-flex items-center gap-2 hover:underline"
                          >
                            <Users className="h-4 w-4 text-muted" />
                            {c.code ?? "—"}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-ink">{c.name || "—"}</p>
                        {c.contact && (
                          <p className="text-caption text-body">{c.contact}</p>
                        )}
                        {c.phone && (
                          <p className="text-caption text-muted">{c.phone}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-body">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.current)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.d30)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.d60)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.d90)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.over90)}</TableCell>
                      <TableCell className="text-right text-body">
                        {rupee(buckets.unclassified)}
                        {buckets.unclassifiedCount > 0 && (
                          <p className="text-caption text-muted">{buckets.unclassifiedCount} invoices</p>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${totalDue > 0 ? "text-semantic-error" : "text-ink"}`}>
                        {rupee(totalDue)}
                      </TableCell>
                      <TableCell className="text-right text-body">{c.cachedBalance === null ? "—" : rupee(c.cachedBalance)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Number(buckets.classified_total) > 0 && (
                            <Badge variant={bucket.variant}>
                              {agingDays > 0 ? `${agingDays}d · ` : ""}{bucket.label}
                            </Badge>
                          )}
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

      {dbOk && !reportError && <div className="mt-6 flex items-center justify-between">
        <p className="text-caption text-muted">
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} customers · Page {page} / {totalPages}
          {q && <span className="ml-2">· Search: “{q}”</span>}
          {stateFilter && <span className="ml-2">· State: {stateFilter}</span>}
          {Number.isFinite(minDue) && minDue > 0 && <span className="ml-2">· Min due ≥ ₹{minDue.toLocaleString("en-IN")}</span>}
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
            <Link href={page <= 1 ? buildHref({}) : buildHref({ page: page - 1 })}>
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
            <Link href={buildHref({ page: page + 1 })}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>}
    </DashboardLayout>
  );
}
