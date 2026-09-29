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
import { BarChart3, Download, TrendingUp, FileSpreadsheet, Calendar } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Reports",
};

const kpis = [
  { label: "Sales this month", value: "₹ 8,42,180", delta: "+12.4% MoM", variant: "success" as const, icon: TrendingUp },
  { label: "Gross margin", value: "19.2%", delta: "+0.6 pts", variant: "success" as const, icon: BarChart3 },
  { label: "Avg invoice value", value: "₹ 16,820", delta: "+4.2%", variant: "default" as const, icon: FileSpreadsheet },
  { label: "Invoices (MTD)", value: "50", delta: "-2 vs last month", variant: "secondary" as const, icon: Calendar },
];

const reports = [
  { name: "Sales register", description: "Daily sales summary with taxes and line-item detail", href: "#" },
  { name: "Purchase register", description: "Supplier purchase entries by date range", href: "#" },
  { name: "Stock position", description: "Closing stock value, stock-turn by product", href: "#" },
  { name: "Customer aging", description: "Receivables in 0-30 / 31-60 / 61-90 / 90+ buckets", href: "#" },
  { name: "Supplier aging", description: "Payables by credit terms and due date", href: "#" },
  { name: "Batch expiry", description: "Expiry schedule by month, batches at risk", href: "#" },
  { name: "GST summary", description: "IGST/CGST/SGST by tax rate, HSN summary", href: "#" },
  { name: "Daybook", description: "Ledger-style chronological daybook", href: "#" },
];

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Reports</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Built-in ledgers and analytics for India GST and day-to-day visibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <Calendar className="h-4 w-4" /> Month: Sep 2026
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <CardCanvas key={k.label}>
              <CardContent className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    {k.label}
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {k.value}
                  </p>
                  <div className="mt-2">
                    <Badge variant={k.variant}>{k.delta}</Badge>
                  </div>
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
          <TabsTrigger value="sales">Sales</TabsTrigger>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium text-ink">{r.name}</TableCell>
                      <TableCell className="text-body">{r.description}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={r.href}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
