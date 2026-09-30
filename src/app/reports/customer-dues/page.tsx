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
import { isPostgresConfigured, prisma } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportCustomerDuesCsvAction } from "@/app/_actions/exports.actions";
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
  if (overdueDays <= 30) return { label: "0-30 days", variant: "success" as const };
  if (overdueDays <= 60) return { label: "31-60 days", variant: "warning" as const };
  if (overdueDays <= 90) return { label: "61-90 days", variant: "warning" as const };
  return { label: "90+ days", variant: "destructive" as const };
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
  let dbOk = isPostgresConfigured();

  let items: any[] = [];
  let total = 0;
  let distinctStates: string[] = [];
  const bucketMap = new Map<string, { current: number; d30: number; d60: number; d90: number; over90: number; total: number }>();
  const agingMap = new Map<string, number>();

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const t = await requireServerTenantContext();

      try {
        const stateRows = await (prisma as any).customers.findMany({
          where: { tenant_id: t.tenantId, billing_state: { not: null } },
          select: { billing_state: true },
          distinct: ["billing_state"],
          take: 100,
        });
        distinctStates = stateRows
          .map((r: any) => r.billing_state as string)
          .filter((s: any) => typeof s === "string" && s.trim().length > 0)
          .sort();
      } catch {
        distinctStates = [];
      }

      const where: any = {
        tenant_id: t.tenantId,
        ...(q
          ? {
              OR: [
                { business_name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { gstin: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { mobile: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { contact_person: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(stateFilter ? { billing_state: { equals: stateFilter, mode: "insensitive" as const } } : {}),
      };

      const [rawItems, countResult] = await Promise.all([
        (prisma as any).customers.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { business_name: "asc" },
        }),
        (prisma as any).customers.count({ where }),
      ]);

      const filteredItems = Number.isFinite(minDue) && minDue > 0
        ? rawItems.filter((c: any) => Number(c.receivable_balance ?? 0) >= minDue)
        : rawItems;

      items = filteredItems;
      total = countResult;

      for (const c of items) {
        try {
          const buckets = await repos.customerLedgers.getAgingBuckets(ctx, c.id);
          bucketMap.set(c.id, buckets);
        } catch {
          bucketMap.set(c.id, { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 });
        }
        try {
          const oldestDays = await repos.customerLedgers.getOldestOverdueDays(c.id, ctx);
          agingMap.set(c.id, Number.isFinite(oldestDays) ? oldestDays : 0);
        } catch {
          agingMap.set(c.id, 0);
        }
      }
    } catch {
      dbOk = false;
    }
  }

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
            Receivables by customer with 0-30 / 31-60 / 61-90 / 90+ days aging buckets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportCustomerDuesCsvAction}>
            <Download className="h-4 w-4" /> Export CSV
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">Showing placeholder numbers until database is connected.</strong>
            <span className="ml-1">Temporary Supabase pooler timeout — retry in 60 seconds.</span>
          </div>
        </div>
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
                <TableHead className="text-right">Current 0-30</TableHead>
                <TableHead className="text-right">31-60</TableHead>
                <TableHead className="text-right">61-90</TableHead>
                <TableHead className="text-right">90+</TableHead>
                <TableHead className="text-right">Total due</TableHead>
                <TableHead className="text-right">Receivable balance</TableHead>
                <TableHead>Aging</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                    No customers match the current filters.
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                    Showing placeholder rows until database is connected.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((c: any) => {
                  const buckets = bucketMap.get(c.id) ?? { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
                  const agingDays = agingMap.get(c.id) ?? 0;
                  const bucket = agingBucketBadge(agingDays);
                  const receivable = Number(c.receivable_balance ?? 0);
                  const totalDue = buckets.total > 0 ? buckets.total : receivable;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/customers/${c.id}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <Users className="h-4 w-4 text-muted" />
                          {c.code ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-ink">{c.business_name ?? "—"}</p>
                        {c.contact_person && (
                          <p className="text-caption text-body">{c.contact_person}</p>
                        )}
                        {(c.phone || c.mobile) && (
                          <p className="text-caption text-muted">{c.mobile ?? c.phone}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-body">
                        {[c.billing_city, c.billing_state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.current)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.d30)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.d60)}</TableCell>
                      <TableCell className="text-right text-body">{rupee(buckets.over90)}</TableCell>
                      <TableCell className={`text-right font-semibold ${totalDue > 0 ? "text-semantic-error" : "text-ink"}`}>
                        {rupee(totalDue)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${receivable > 0 ? "text-semantic-error" : "text-ink"}`}>
                        {rupee(receivable)}
                      </TableCell>
                      <TableCell>
                        {receivable > 0 ? (
                          <Badge variant={bucket.variant}>
                            {agingDays > 0 ? `${agingDays}d · ` : ""}{bucket.label}
                          </Badge>
                        ) : (
                          <Badge variant="success">No dues</Badge>
                        )}
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
      </div>
    </DashboardLayout>
  );
}
