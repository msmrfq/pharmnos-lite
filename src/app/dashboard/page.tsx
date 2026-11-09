import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardCanvas,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  PackagePlus,
  AlertTriangle,
  TrendingUp,
  Users,
  Truck,
  ArrowUpRight,
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import { businessDateToday, formatBusinessDate, formatBusinessInstant } from "@/lib/utils/business-date";
import { Decimal } from "@/lib/decimal";
import { formatRupeeAmount, type AgingReport } from "@/domain/services/aging-report.service";
import { loadCustomerAgingReport, loadSupplierAgingReport } from "@/app/_actions/aging-report.actions";
import { loadMonthlySalesStats } from "@/app/_actions/monthly-stats.actions";

export const metadata: Metadata = {
  title: "Dashboard",
};

const rupee = (n: number | null | undefined | string | bigint) => {
  const num = typeof n === "string" || typeof n === "bigint" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "₹ 0";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};
const longMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const quickLinks = [
  { label: "New invoice", icon: Receipt, href: "/billing/new" },
  { label: "Purchase entry", icon: PackagePlus, href: "/purchases/new" },
  { label: "Add product", icon: FileSpreadsheet, href: "/inventory/products/new" },
  { label: "Add customer", icon: Users, href: "/customers/new" },
  { label: "Add supplier", icon: Truck, href: "/suppliers/new" },
];

export default async function DashboardPage() {
  const dbOk = isPostgresConfigured();
  const ctx = dbOk ? await requireServerTenantContext().catch((error) => {
    console.error("Dashboard tenant context failed:", error);
    return null;
  }) : null;

  type Metric = { label: string; value: string; change: string; variant: any; icon: any; href: string };
  let metrics: Metric[] = [];
  let recentInvoices: any[] = [];
  let lowStockQueue: any[] = [];
  let recentActivity: any[] = [];
  let invoicesAvailable = false;
  let stockAvailable = false;
  let activityAvailable = false;

  if (dbOk && ctx) {
    try {
      const results = await Promise.allSettled([
          repos.productBatches.stockValuation(ctx),
          repos.salesInvoices.list({ take: 6, skip: 0, orderBy: { invoice_date: "desc" } as any, search: undefined } as any, ctx),
          repos.auditLogs.list({ take: 10, skip: 0, orderBy: { created_at: "desc" } as any } as any, ctx),
          loadMonthlySalesStats(),
          loadCustomerAgingReport(),
          loadSupplierAgingReport(),
        ]);
      for (const result of results) {
        if (result.status === "rejected") console.error("Dashboard query failed:", result.reason);
      }
      const [stockResult, invoicesResult, auditResult, salesStatsResult, receivablesResult, payablesResult] = results;
      const stockVal = stockResult.status === "fulfilled" ? stockResult.value : null;
      const lastInvoices = invoicesResult.status === "fulfilled" ? invoicesResult.value : null;
      const lastAudits = auditResult.status === "fulfilled" ? auditResult.value : null;
      const salesStats = salesStatsResult.status === "fulfilled" && salesStatsResult.value.ok ? salesStatsResult.value.stats : null;
      const receivables = receivablesResult.status === "fulfilled" && receivablesResult.value.ok ? receivablesResult.value.report : null;
      const payables = payablesResult.status === "fulfilled" && payablesResult.value.ok ? payablesResult.value.report : null;
      invoicesAvailable = lastInvoices !== null;
      stockAvailable = stockVal !== null;
      activityAvailable = lastAudits !== null;

      const unclassifiedNote = (report: AgingReport) => report.unclassifiedCount > 0
        ? ` · ${formatRupeeAmount(report.totals.unclassified)} (${report.unclassifiedCount} invoices) due date unclassified`
        : "";
      const overdueSince31 = receivables
        ? Decimal.from(receivables.totals.d60).add(receivables.totals.d90).add(receivables.totals.over90)
        : null;
      const overdueCount = receivables ? receivables.rows.filter((row) => row.oldestOverdueDays > 0).length : 0;

      metrics = [
        {
          label: "Sales this month",
          value: salesStats ? rupee(salesStats.netAmount) : "Unavailable",
          change: !salesStats ? "Monthly sales unavailable" : `${salesStats.invoiceCount} invoices${salesStats.exclusionNote ? ` · ${salesStats.exclusionNote}` : ""}`,
          variant: !salesStats || salesStats.completeness === "QUALIFIED" ? ("warning" as const) : ("default" as const),
          icon: Receipt,
          href: "/billing",
        },
        {
          label: "Receivables",
          value: receivables ? rupee(receivables.totals.classified_total) : "Unavailable",
          change: !receivables || !overdueSince31 ? "Aging unavailable" : (
            overdueCount > 0
              ? `${overdueCount} overdue · ${rupee(overdueSince31.toString())} pending 31+ days`
              : receivables.openInvoiceCount === 0 ? "No open receivables" : "No classified overdue accounts"
          ) + unclassifiedNote(receivables),
          variant: !receivables || receivables.completeness === "QUALIFIED" || Number(overdueSince31?.toString()) > 0.01
            ? ("warning" as const) : ("success" as const),
          icon: TrendingUp,
          href: "/reports/customer-dues",
        },
        {
          label: "Approved stock value",
          value: stockVal ? rupee(stockVal.total_value_inr) : "Unavailable",
          change: !stockVal ? "Stock unavailable" : stockVal.pending_batches_count > 0
            ? `${stockVal.pending_batches_count} batches pending valuation`
            : `${stockVal.sku_count} SKUs · ${stockVal.batches_count} batches`,
          variant: !stockVal || stockVal.pending_batches_count > 0 ? ("warning" as const) : ("default" as const),
          icon: FileSpreadsheet,
          href: "/reports/stock-valuation",
        },
        {
          label: "Near expiry (60d)",
          value: stockVal ? `${stockVal.sku_count ? Math.min(stockVal.batches_count, 999) : 0} batches` : "Unavailable",
          change: `${!stockVal ? "Stock unavailable" : stockVal.near_expiry_60d_value > 0.01 ? `${rupee(stockVal.near_expiry_60d_value)} at risk` : "No near-expiry batches"} · ${
            payables ? `Payables ${rupee(payables.totals.classified_total)}${unclassifiedNote(payables)}` : "Payables unavailable"}`,
          variant: !stockVal || (payables?.completeness ?? "QUALIFIED") === "QUALIFIED" ? ("warning" as const)
            : stockVal.near_expiry_60d_value > 0.01 ? ("badge-orange" as const) : ("success" as const),
          icon: Clock,
          href: "/inventory?tab=batches",
        },
      ];

      recentInvoices = (lastInvoices?.items ?? []).slice(0, 6).map((inv: any) => ({
        no: inv.invoice_no ?? inv.id.slice(0, 8).toUpperCase(),
        customer: inv.customer ? (inv.customer.business_name || inv.customer.customer_name || "—") : "Cash customer",
        amount: rupee(inv.net_amount),
        status: inv.is_cash_sale ? "Cash" : Number(inv.balance_due ?? 0) < 0.01 ? "Paid" : "Credit",
        statusVariant:
          inv.status === "FINALIZED"
            ? inv.is_cash_sale || Number(inv.balance_due ?? 0) < 0.01
              ? ("success" as const)
              : ("badge-orange" as const)
            : ("warning" as const),
        date: inv.invoice_date ? formatBusinessDate(inv.invoice_date) : "—",
        href: `/billing/${encodeURIComponent(inv.id)}/print`,
      }));

      lowStockQueue = !stockVal ? [] : (stockVal.batches_count > 0 ? [{
        name: `${stockVal.sku_count} active SKUs`,
        stock: `${stockVal.batches_count} batches`,
        note: stockVal.near_expiry_60d_value > 0 ? "Near-expiry batches present" : "All batches fresh",
        variant: stockVal.near_expiry_60d_value > 0 ? ("badge-orange" as const) : ("success" as const),
      }] : [
        { name: "No inventory batches loaded", stock: "—", note: dbOk ? "Create a purchase first" : "DB unavailable", variant: ("secondary" as const) },
      ]) as any;

      recentActivity = (lastAudits?.items ?? []).slice(0, 10).map((a: any) => ({
        ts: a.created_at ? formatBusinessInstant(a.created_at) : "—",
        user: a.actor?.display_name || a.actor?.email || "System",
        module: a.audit_type || "General",
        action: a.event_type || "Logged",
        ref: a.target_id ? String(a.target_id).slice(0, 10) : "—",
        detail: a.message || a.details ? typeof a.details === "string" ? a.details : String(a.details ?? a.message ?? "") : "",
        variant: (a.event_type === "CREATED" || a.event_type === "Finalized") ? "success" as const : a.event_type === "CANCELLED" || a.event_type?.includes("Adjust") ? "destructive" as const : "default" as const,
      }));
    } catch (err) {
      console.error("Dashboard rendering data failed:", err);
    }
  }

  if (metrics.length === 0) {
    metrics = [
      { label: "Sales this month", value: "Unavailable", change: "Monthly sales unavailable", variant: "warning" as const, icon: Receipt, href: "/billing" },
      { label: "Receivables", value: "Unavailable", change: "Aging unavailable", variant: "warning" as const, icon: TrendingUp, href: "/reports/customer-dues" },
      { label: "Stock value", value: "Unavailable", change: "Stock unavailable", variant: "warning" as const, icon: FileSpreadsheet, href: "/reports/stock-valuation" },
      { label: "Near expiry (60d)", value: "Unavailable", change: "Stock unavailable · Payables unavailable", variant: "warning" as const, icon: Clock, href: "/inventory?tab=batches" },
    ];
    recentInvoices = [];
    lowStockQueue = [];
    recentActivity = [];
  }

  const [todayYear, todayMonth, todayDay] = businessDateToday().split("-");
  const todayLabel = `${Number(todayDay)} ${longMonths[Number(todayMonth) - 1]} ${todayYear}`;

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <div className="space-y-6">
        {/* Welcome row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display tracking-tight text-display-sm md:text-display-md text-ink">
              Good afternoon, Rajesh.
            </h1>
            <p className="text-body-md text-body">
              Here&apos;s how your pharmacy is performing today — {todayLabel}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" asChild>
              <Link href="/purchases/new">
                <PackagePlus className="h-4 w-4" /> Purchase entry
              </Link>
            </Button>
            <Button asChild>
              <Link href="/billing/new">
                <Receipt className="h-4 w-4" /> New invoice
              </Link>
            </Button>
          </div>
        </div>

        {(!dbOk || !ctx) && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong className="font-semibold">Dashboard data unavailable: database or tenant context is unavailable.</strong>
            </div>
          </div>
        )}

        {/* Metric cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.label}
                href={m.href}
                className="block transition-none hover:ring-1 hover:ring-ink/10 rounded-lg"
              >
                <Card>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div>
                      <CardDescription className="text-caption font-medium uppercase tracking-wide text-muted">
                        {m.label}
                      </CardDescription>
                      <CardTitle className="mt-2 font-display tracking-brand text-display-sm text-ink">
                        {m.value}
                      </CardTitle>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas border border-hairline text-ink">
                      <Icon className="h-5 w-5" />
                    </span>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between">
                    <Badge variant={m.variant}>{m.change}</Badge>
                    <ArrowUpRight className="h-4 w-4 text-muted" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Quick actions */}
        <Card className="p-5 flex flex-wrap gap-2">
          <span className="text-caption font-semibold uppercase tracking-wide text-muted mr-2 self-center">
            Quick actions
          </span>
          {quickLinks.map((ql) => {
            const Icon = ql.icon;
            return (
              <Button key={ql.label} variant="secondary" size="sm" asChild>
                <Link href={ql.href} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {ql.label}
                </Link>
              </Button>
            );
          })}
        </Card>

        {/* Recent invoices + Low stock */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent invoices</CardTitle>
                <CardDescription>Last finalized sales invoices</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/reports/sales-register">Register</Link>
                </Button>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/billing/new">New</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!invoicesAvailable ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted">
                        Recent invoices unavailable.
                      </TableCell>
                    </TableRow>
                  ) : recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted">
                        No invoices yet — create your first invoice from the quick actions above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentInvoices.map((r: any, idx: number) => (
                      <TableRow key={r.no + idx}>
                        <TableCell className="font-medium text-ink">
                          <Link href={r.href} className="hover:underline">
                            {r.no}
                          </Link>
                        </TableCell>
                        <TableCell>{r.customer}</TableCell>
                        <TableCell className="text-right font-medium text-ink">{r.amount}</TableCell>
                        <TableCell>
                          <Badge variant={r.statusVariant}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted">{r.date}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Low stock queue</CardTitle>
                <CardDescription>Replenishment priorities</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/inventory/low-stock">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {!stockAvailable ? (
                <p className="text-muted py-4 text-center">Stock queue unavailable.</p>
              ) : (
                lowStockQueue.map((item: any, idx: number) => (
                  <div
                    key={item.name + idx}
                    className="rounded-lg bg-surface-card p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-body font-medium text-ink truncate">{item.name}</p>
                      <p className="text-caption text-muted">{item.note}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-nav-link font-semibold text-ink">{item.stock}</span>
                      <Badge variant={item.variant}>Order</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </CardCanvas>
        </div>

        {/* Recent activity table */}
        <CardCanvas>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Last 10 events from audit log</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit">Open audit</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!activityAvailable ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted">
                      Activity timeline unavailable.
                    </TableCell>
                  </TableRow>
                ) : recentActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted">
                      No activity yet — start by creating a purchase or an invoice.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentActivity.map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted">{r.ts}</TableCell>
                      <TableCell className="text-ink">{r.user}</TableCell>
                      <TableCell>
                        <Badge variant="default">{r.module}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.variant}>{r.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted">{r.ref}</TableCell>
                      <TableCell className="text-body text-ink truncate max-w-[300px]">{r.detail || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </CardCanvas>
      </div>
    </DashboardLayout>
  );
}
