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
import { PackagePlus, Plus, Download, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Purchases",
};

const purchaseOrders = [
  {
    no: "PU-00092",
    supplier: "Cipla Distributors",
    date: "27 Sep 2026",
    items: 18,
    total: "₹ 2,18,640",
    status: "Received",
    statusVariant: "success" as const,
  },
  {
    no: "PU-00091",
    supplier: "Sun Pharma Ltd",
    date: "26 Sep 2026",
    items: 9,
    total: "₹ 74,200",
    status: "Partial",
    statusVariant: "warning" as const,
  },
  {
    no: "PU-00090",
    supplier: "Arbor Drugs",
    date: "25 Sep 2026",
    items: 4,
    total: "₹ 18,920",
    status: "Pending",
    statusVariant: "secondary" as const,
  },
];

export default function PurchasesPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Purchases</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Supplier purchase entries create batches and stock movements automatically.
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
            <Link href="/purchases/new">
              <Plus className="h-4 w-4" /> Purchase entry
            </Link>
          </Button>
        </div>
      </CardHeader>

      <Tabs defaultValue="all">
        <TabsList className="mb-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
          <TabsTrigger value="return">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase no.</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.no}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/purchases/${po.no}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <PackagePlus className="h-4 w-4 text-muted" />
                          {po.no}
                        </Link>
                      </TableCell>
                      <TableCell className="text-body">{po.supplier}</TableCell>
                      <TableCell className="text-body">{po.date}</TableCell>
                      <TableCell className="text-right text-body">{po.items}</TableCell>
                      <TableCell className="text-right font-semibold text-ink">{po.total}</TableCell>
                      <TableCell>
                        <Badge variant={po.statusVariant}>{po.status}</Badge>
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
