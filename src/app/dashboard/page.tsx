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

export const metadata: Metadata = {
  title: "Dashboard",
};

const rupee = (n: number | null | undefined | string | bigint) => {
  const num = typeof n === "string" || typeof n === "bigint" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "₹ 0";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const quickLinks = [
  { label: "New invoice", icon: Receipt, href: "/billing/new" },
  { label: "Purchase entry", icon: PackagePlus, href: "/purchases/new" },
  { label: "Add product", icon: FileSpreadsheet, href: "/inventory/products/new" },
  { label: "Add customer", icon: Users, href: "/customers/new" },
  { label: "Add supplier", icon: Truck, href: "/suppliers/new" },
];

export default async function DashboardPage() {
  let dbOk = isPostgresConfigured();
  const ctx = dbOk ? await requireServerTenantContext().catch(() => null) : null;

  type Metric = { label: string; value: string; change: string; variant: any; icon: any; href: string };
  let metrics: Metric[] = [];
  let recentInvoices: any[] = [];
  let lowStockQueue: any[] = [];
  let recentActivity: any[] = [];

  if (dbOk && ctx) {
    try {
      const [salesStats, purchaseStats, stockVal, agedRecv, agedPay, lastInvoices, customersList, lastAudits] =
        await Promise.all([
          repos.salesInvoices.monthlyStats(ctx, 1),
          repos.purchaseInvoices.monthlyStats(ctx, 1),
          repos.productBatches.stockValuation(ctx),
          repos.customerLedgers.agedReceivablesTotals(ctx),
          repos.supplierLedgers.agedPayablesTotals(ctx),
          repos.salesInvoices.list({ take: 6, skip: 0, orderBy: { invoice_date: "desc" } as any, search: undefined } as any, ctx),
          repos.customers.list({ take: 200, skip: 0, search: undefined } as any, ctx),
          repos.auditLogs.list ? repos.auditLogs.list({ take: 10, skip: 0, orderBy: { created_at: "desc" } as any } as any, ctx).catch(() => ({ items: [], total: 0, page: 1, pageSize: 10 })) : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 10 }),
        ]);

      const salesNet = Number(salesStats?._sum?.net_amount ?? 0);
      const overdueRecvTotal = agedRecv.bucket_31_60 + agedRecv.bucket_61_90 + agedRecv.bucket_over_90;
      const overdueCount = (customersList?.items ?? []).filter((c: any) => Number(c.receivable_balance ?? 0) > 0.01).length;

      metrics = [
        {
          label: "Sales this month",
          value: rupee(salesNet),
          change: `${salesStats?._count?.id ?? 0} invoices · Purchase ${rupee(Number(purchaseStats?._sum?.net_amount ?? 0))}`,
          variant: "success" as const,
          icon: Receipt,
          href: "/billing",
        },
        {
          label: "Receivables",
          value: rupee(agedRecv.total),
          change: overdueCount > 0 ? `${overdueCount} overdue · ${rupee(overdueRecvTotal)} pending 30+` : "All accounts current",
          variant: overdueRecvTotal > 0.01 ? ("warning" as const) : ("success" as const),
          icon: TrendingUp,
          href: "/reports/customer-dues",
        },
        {
          label: "Stock value",
          value: rupee(stockVal.total_value_inr),
          change: `${stockVal.sku_count} SKUs · ${stockVal.batches_count} batches`,
          variant: "default" as const,
          icon: FileSpreadsheet,
          href: "/reports/stock-valuation",
        },
        {
          label: "Near expiry (60d)",
          value: `${stockVal.sku_count ? Math.min(stockVal.batches_count, 999) : 0} batches`,
          change: stockVal.near_expiry_60d_value > 0.01 ? `${rupee(stockVal.near_expiry_60d_value)} at risk · Payables ${rupee(agedPay.total)}` : `No near-expiry batches · Payables ${rupee(agedPay.total)}`,
          variant: stockVal.near_expiry_60d_value > 0.01 ? ("badge-orange" as const) : ("success" as const),
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
        time: inv.invoice_date ? new Date(inv.invoice_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—",
        href: `/billing/${encodeURIComponent(inv.id)}/print`,
      }));

      lowStockQueue = (stockVal.batches_count > 0 ? [{
        name: `${stockVal.sku_count} active SKUs`,
        stock: `${stockVal.batches_count} batches`,
        note: stockVal.near_expiry_60d_value > 0 ? "Near-expiry batches present" : "All batches fresh",
        variant: stockVal.near_expiry_60d_value > 0 ? ("badge-orange" as const) : ("success" as const),
      }] : [
        { name: "No inventory batches loaded", stock: "—", note: dbOk ? "Create a purchase first" : "DB unavailable", variant: ("secondary" as const) },
      ]) as any;

      recentActivity = (lastAudits.items ?? []).slice(0, 10).map((a: any) => ({
        ts: a.created_at ? new Date(a.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—",
        user: a.actor?.display_name || a.actor?.email || "System",
        module: a.audit_type || "General",
        action: a.event_type || "Logged",
        ref: a.target_id ? String(a.target_id).slice(0, 10) : "—",
        detail: a.message || a.details ? typeof a.details === "string" ? a.details : String(a.details ?? a.message ?? "") : "",
        variant: (a.event_type === "CREATED" || a.event_type === "Finalized") ? "success" as const : a.event_type === "CANCELLED" || a.event_type?.includes("Adjust") ? "destructive" as const : "default" as const,
      }));
    } catch (err) {
      dbOk = false;
    }
  }

  if (metrics.length === 0) {
    metrics = [
      { label: "Sales this month", value: "₹ 0", change: "Aggregates loading…", variant: "default" as const, icon: Receipt, href: "/billing" },
      { label: "Receivables", value: "₹ 0", change: "Aggregates loading…", variant: "default" as const, icon: TrendingUp, href: "/reports/customer-dues" },
      { label: "Stock value", value: "₹ 0", change: "Aggregates loading…", variant: "default" as const, icon: FileSpreadsheet, href: "/reports/stock-valuation" },
      { label: "Near expiry (60d)", value: "0 batches", change: "Aggregates loading…", variant: "default" as const, icon: Clock, href: "/inventory?tab=batches" },
    ];
    recentInvoices = [];
    lowStockQueue = [];
    recentActivity = [];
  }

  const todayLabel = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

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

        {!dbOk && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong className="font-semibold">Showing placeholder values until database is connected.</strong>
              <span className="ml-1">Temporary Supabase pooler timeout is common on the free tier — try again in 60 seconds.</span>
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
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted">
                        No invoices yet — create your first invoice from the quick actions above.
                      </TableCell>
                    </TableRow>
                  ) : !dbOk ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted">
                        Recent invoices hidden until database is connected.
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
                        <TableCell className="text-muted">{r.time}</TableCell>
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
              {lowStockQueue.length === 0 ? (
                <p className="text-muted py-4 text-center">Queue loading…</p>
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
                {!dbOk ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted">
                      Activity timeline hidden until database is connected.
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
