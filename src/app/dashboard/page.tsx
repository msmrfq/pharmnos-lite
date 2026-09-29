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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Dashboard",
};

const metrics = [
  {
    label: "Today's sales",
    value: "₹ 42,820",
    change: "+8.2% vs yesterday",
    variant: "success" as const,
    icon: Receipt,
    href: "/billing",
  },
  {
    label: "Receivables",
    value: "₹ 12,84,300",
    change: "12 accounts overdue",
    variant: "warning" as const,
    icon: TrendingUp,
    href: "/customers",
  },
  {
    label: "Low stock",
    value: "18 items",
    change: "3 below reorder",
    variant: "destructive" as const,
    icon: AlertTriangle,
    href: "/inventory/low-stock",
  },
  {
    label: "Near expiry (60d)",
    value: "7 batches",
    change: "₹ 42,100 at risk",
    variant: "badge-orange" as const,
    icon: Clock,
    href: "/inventory/near-expiry",
  },
];

const quickLinks = [
  { label: "New invoice", icon: Receipt, href: "/billing/new" },
  { label: "Purchase entry", icon: PackagePlus, href: "/purchases/new" },
  { label: "Add product", icon: FileSpreadsheet, href: "/inventory/products/new" },
  { label: "Add customer", icon: Users, href: "/customers/new" },
  { label: "Add supplier", icon: Truck, href: "/suppliers/new" },
];

const recentInvoices = [
  {
    no: "INV-00182",
    customer: "MedPlus Pharmacy",
    amount: "₹ 40,035.70",
    status: "Paid",
    statusVariant: "success" as const,
    time: "11:42 AM",
  },
  {
    no: "INV-00181",
    customer: "Franklin Medico",
    amount: "₹ 18,450.00",
    status: "Credit",
    statusVariant: "badge-orange" as const,
    time: "10:28 AM",
  },
  {
    no: "INV-00180",
    customer: "Sharda Agencies",
    amount: "₹ 9,820.00",
    status: "Paid",
    statusVariant: "success" as const,
    time: "9:16 AM",
  },
];

const lowStockQueue = [
  { name: "Cetirizine 10mg", stock: "21 tabs", note: "Reorder 100", variant: "warning" as const },
  { name: "Omeprazole 20mg", stock: "8 caps", note: "Below reorder", variant: "destructive" as const },
  { name: "Diclofenac Gel", stock: "34 units", note: "Low", variant: "badge-orange" as const },
];

export default function DashboardPage() {
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
              Here&apos;s how your pharmacy is performing today — {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
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
              <Tabs defaultValue="today">
                <TabsList>
                  <TabsTrigger value="today">Today</TabsTrigger>
                  <TabsTrigger value="week">This week</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
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
                  {recentInvoices.map((r) => (
                    <TableRow key={r.no}>
                      <TableCell className="font-medium text-ink">
                        <Link href={`/billing/${r.no}`} className="hover:underline">
                          {r.no}
                        </Link>
                      </TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell className="text-right font-medium text-ink">
                        {r.amount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.statusVariant}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted">{r.time}</TableCell>
                    </TableRow>
                  ))}
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
              {lowStockQueue.map((item) => (
                <div
                  key={item.name}
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
              ))}
            </CardContent>
          </CardCanvas>
        </div>
      </div>
    </DashboardLayout>
  );
}
