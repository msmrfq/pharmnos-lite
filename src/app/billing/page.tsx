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
import { Receipt, Plus, Download, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Billing",
};

const recentInvoices = [
  {
    no: "INV-00182",
    customer: "MedPlus Pharmacy",
    date: "29 Sep 2026",
    items: 12,
    total: "₹ 42,820",
    status: "Paid",
    statusVariant: "success" as const,
  },
  {
    no: "INV-00181",
    customer: "Franklin Medico",
    date: "28 Sep 2026",
    items: 8,
    total: "₹ 18,450",
    status: "Credit",
    statusVariant: "warning" as const,
  },
  {
    no: "INV-00180",
    customer: "Sharda Agencies",
    date: "28 Sep 2026",
    items: 24,
    total: "₹ 1,02,340",
    status: "Draft",
    statusVariant: "secondary" as const,
  },
];

export default function BillingPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Billing</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Create and track wholesale invoices for your customers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button asChild>
            <Link href="/billing/new">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          </Button>
        </div>
      </CardHeader>

      <Tabs defaultValue="all">
        <TabsList className="mb-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="final">Finalized</TabsTrigger>
          <TabsTrigger value="return">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice no.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.no}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/billing/${inv.no}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <Receipt className="h-4 w-4 text-muted" />
                          {inv.no}
                        </Link>
                      </TableCell>
                      <TableCell className="text-body">{inv.customer}</TableCell>
                      <TableCell className="text-body">{inv.date}</TableCell>
                      <TableCell className="text-right text-body">{inv.items}</TableCell>
                      <TableCell className="text-right font-semibold text-ink">
                        {inv.total}
                      </TableCell>
                      <TableCell>
                        <Badge variant={inv.statusVariant}>{inv.status}</Badge>
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
