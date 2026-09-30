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
import {
  BarChart3,
  FileSpreadsheet,
  AlertTriangle,
  Truck,
  Users,
  Package,
  ClipboardList,
  CalendarDays,
  Calendar as CalendarIcon,
  Receipt,
  FileText,
  TrendingUp,
  ExternalLink,
  Clock,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";

export const metadata: Metadata = {
  title: "Reports",
};

const aliveReports = [
  {
    name: "Sales register",
    description: "Daily sales summary with invoice details, counterparty, taxes and net totals.",
    href: "/reports/sales-register",
    icon: Receipt,
    tab: "sales",
    alive: true,
    deferred: false,
  },
  {
    name: "Purchase register",
    description: "Supplier purchase entries by date range, supplier invoice reference.",
    href: "/reports/purchase-register",
    icon: Truck,
    tab: "sales",
    alive: true,
    deferred: false,
  },
  {
    name: "Customer dues (aging)",
    description: "Receivables by customer with 0-30 / 31-60 / 61-90 / 90+ days buckets.",
    href: "/reports/customer-dues",
    icon: Users,
    tab: "ledger",
    alive: true,
    deferred: false,
  },
  {
    name: "Supplier payables (aging)",
    description: "Payables by supplier with same 4 aging buckets, weekly payment cycle support.",
    href: "/reports/supplier-payables",
    icon: Package,
    tab: "ledger",
    alive: true,
    deferred: false,
  },
  {
    name: "Stock valuation",
    description: "Closing stock value at average purchase rate, expiry status, SKU-level detail.",
    href: "/reports/stock-valuation",
    icon: FileSpreadsheet,
    tab: "inventory",
    alive: true,
    deferred: false,
  },
  {
    name: "Batch expiry calendar",
    description: "Expiry schedule by month, batches at risk, near-expiry prioritized actions.",
    href: "#",
    icon: CalendarDays,
    tab: "inventory",
    alive: false,
    deferred: true,
  },
  {
    name: "GST summary (B2B / HSN)",
    description: "IGST/CGST/SGST by tax rate and HSN code for GST returns filing.",
    href: "#",
    icon: FileText,
    tab: "sales",
    alive: false,
    deferred: true,
  },
  {
    name: "Daybook",
    description: "Ledger-style chronological daybook, debit/credit running balance.",
    href: "#",
    icon: ClipboardList,
    tab: "ledger",
    alive: false,
    deferred: true,
  },
];

export default async function ReportsPage() {
  let dbOk = isPostgresConfigured();
  const ctx = dbOk ? await requireServerTenantContext().catch(() => null) : null;
  let summary: { salesNet: number; purchaseNet: number; duesTotal: number; payablesTotal: number; invoicesCount: number } = {
    salesNet: 0, purchaseNet: 0, duesTotal: 0, payablesTotal: 0, invoicesCount: 0,
  };
  if (dbOk && ctx) {
    try {
      const [sales, purchase, dues, pays] = await Promise.all([
        repos.salesInvoices.monthlyStats(ctx, 1).catch(() => null),
        repos.purchaseInvoices.monthlyStats(ctx, 1).catch(() => null),
        repos.customerLedgers.agedReceivablesTotals(ctx).catch(() => null),
        repos.supplierLedgers.agedPayablesTotals(ctx).catch(() => null),
      ]);
      summary = {
        salesNet: Number(sales?._sum?.net_amount ?? 0),
        purchaseNet: Number(purchase?._sum?.net_amount ?? 0),
        duesTotal: Number(dues?.total ?? 0),
        payablesTotal: Number(pays?.total ?? 0),
        invoicesCount: Number(sales?._count?.id ?? 0),
      };
    } catch { dbOk = false; }
  }

  const rupee = (n: number) => `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  const summaryCards = [
    { label: "Sales this month", value: rupee(summary.salesNet), delta: `${summary.invoicesCount} invoices`, variant: "success" as const, icon: TrendingUp },
    { label: "Purchases this month", value: rupee(summary.purchaseNet), delta: dbOk ? "Landed stock" : "Aggregates loading…", variant: "default" as const, icon: BarChart3 },
    { label: "Customer dues", value: rupee(summary.duesTotal), delta: summary.duesTotal > 0 ? "Aging buckets → Customer dues" : "No dues outstanding", variant: summary.duesTotal > 0 ? ("warning" as const) : ("success" as const), icon: Users },
    { label: "Supplier payables", value: rupee(summary.payablesTotal), delta: summary.payablesTotal > 0 ? "Weekly payment cycle" : "All payables settled", variant: summary.payablesTotal > 0 ? ("badge-orange" as const) : ("success" as const), icon: Truck },
  ];

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Reports</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Built-in ledgers and analytics for India GST and day-to-day visibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <CalendarIcon className="h-4 w-4" /> Month: {new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          </Button>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {summaryCards.map((k) => {
          const Icon = k.icon;
          return (
            <CardCanvas key={k.label}>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">{k.label}</p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{k.value}</p>
                  <div className="mt-2"><Badge variant={k.variant}>{k.delta}</Badge></div>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </CardCanvas>
          );
        })}
      </div>

      <Tabs defaultValue="catalog">
        <TabsList className="mb-5">
          <TabsTrigger value="catalog">Report catalog</TabsTrigger>
          <TabsTrigger value="sales">Sales / Purchases</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="ledger">Ledgers</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aliveReports.map((r) => {
                    const Icon = r.icon;
                    return (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium text-ink">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-canvas border border-hairline text-muted shrink-0">
                              <Icon className="h-4 w-4" />
                            </span>
                            {r.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-body max-w-lg">{r.description}</TableCell>
                        <TableCell>
                          {r.deferred ? (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" /> Deferred Phase 7
                            </Badge>
                          ) : (
                            <Badge variant="success" className="gap-1">
                              <BarChart3 className="h-3 w-3" /> Available now
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.deferred ? (
                            <Button size="sm" variant="ghost" disabled>
                              Coming soon
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="secondary" className="gap-1">
                              <Link href={r.href}>
                                Open <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>
        </TabsContent>

        <TabsContent value="sales">
          <div className="grid gap-4 md:grid-cols-2">
            {aliveReports.filter((r) => r.tab === "sales").map((r) => (
              <CardCanvas key={r.name}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas border border-hairline text-ink">
                      <r.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-lg tracking-brand">{r.name}</CardTitle>
                      <p className="mt-1 text-body-sm text-muted">{r.description}</p>
                    </div>
                  </div>
                  {r.deferred ? (
                    <Badge variant="secondary">Phase 7</Badge>
                  ) : (
                    <Badge variant="success">Available</Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4 flex items-end justify-between gap-4 flex-wrap">
                  <div className="text-body-sm text-muted">Date range + counterparty filter + 50 rows pagination + CSV export.</div>
                  {r.deferred ? (
                    <Button variant="ghost" disabled>Coming soon</Button>
                  ) : (
                    <Button asChild variant="secondary"><Link href={r.href}>Open report</Link></Button>
                  )}
                </CardContent>
              </CardCanvas>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="grid gap-4 md:grid-cols-2">
            {aliveReports.filter((r) => r.tab === "inventory").map((r) => (
              <CardCanvas key={r.name}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas border border-hairline text-ink">
                      <r.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-lg tracking-brand">{r.name}</CardTitle>
                      <p className="mt-1 text-body-sm text-muted">{r.description}</p>
                    </div>
                  </div>
                  {r.deferred ? (
                    <Badge variant="secondary">Phase 7</Badge>
                  ) : (
                    <Badge variant="success">Available</Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4 flex items-end justify-between gap-4 flex-wrap">
                  <div className="text-body-sm text-muted">
                    {r.name === "Stock valuation"
                      ? "Method: average purchase rate per batch × available quantity; footer method disclosure."
                      : "Month-by-month expiry calendar; batch prioritization for dispatch."}
                  </div>
                  {r.deferred ? (
                    <Button variant="ghost" disabled>Coming soon</Button>
                  ) : (
                    <Button asChild variant="secondary"><Link href={r.href}>Open report</Link></Button>
                  )}
                </CardContent>
              </CardCanvas>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <div className="grid gap-4 md:grid-cols-2">
            {aliveReports.filter((r) => r.tab === "ledger").map((r) => (
              <CardCanvas key={r.name}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas border border-hairline text-ink">
                      <r.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-lg tracking-brand">{r.name}</CardTitle>
                      <p className="mt-1 text-body-sm text-muted">{r.description}</p>
                    </div>
                  </div>
                  {r.deferred ? (
                    <Badge variant="secondary">Phase 7</Badge>
                  ) : (
                    <Badge variant="success">Available</Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4 flex items-end justify-between gap-4 flex-wrap">
                  <div className="text-body-sm text-muted">
                    {r.name === "Daybook" ? "Debit/credit chronological daybook by entry date, running balance per ledger." : "Aging 4 buckets; CSV with totals for collection / AP weeklies."}
                  </div>
                  {r.deferred ? (
                    <Button variant="ghost" disabled>Coming soon</Button>
                  ) : (
                    <Button asChild variant="secondary"><Link href={r.href}>Open report</Link></Button>
                  )}
                </CardContent>
              </CardCanvas>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
