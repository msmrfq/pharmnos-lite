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
import { Warehouse, AlertTriangle, Plus, Clock, FileSpreadsheet, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Inventory",
};

const summary = [
  { label: "Active products", value: "482", variant: "default" as const, icon: FileSpreadsheet, href: "/inventory/products" },
  { label: "Active batches", value: "1,304", variant: "default" as const, icon: Warehouse, href: "/inventory" },
  { label: "Low stock", value: "18", variant: "destructive" as const, icon: AlertTriangle, href: "/inventory/low-stock" },
  { label: "Near expiry (60d)", value: "7", variant: "badge-orange" as const, icon: Clock, href: "/inventory/near-expiry" },
];

const products = [
  {
    name: "Paracetamol 500mg Tab (10x10)",
    sku: "PCM-500-100",
    stock: 412,
    unit: "Strip",
    mrp: "₹ 380",
    lastSaleRate: "₹ 240",
    batches: 3,
    status: "In stock",
    statusVariant: "success" as const,
  },
  {
    name: "Cetirizine 10mg Tab (10x10)",
    sku: "CTZ-10-100",
    stock: 21,
    unit: "Strip",
    mrp: "₹ 210",
    lastSaleRate: "₹ 140",
    batches: 2,
    status: "Low",
    statusVariant: "warning" as const,
  },
  {
    name: "Omeprazole 20mg Cap (10x10)",
    sku: "OME-20-100",
    stock: 8,
    unit: "Strip",
    mrp: "₹ 520",
    lastSaleRate: "₹ 310",
    batches: 1,
    status: "Reorder",
    statusVariant: "destructive" as const,
  },
];

export default function InventoryPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Inventory</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Browse products, track batches, monitor low stock and near-expiry items.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button asChild>
            <Link href="/inventory/products/new">
              <Plus className="h-4 w-4" /> Add product
            </Link>
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {summary.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="block transition-none hover:ring-1 hover:ring-ink/10 rounded-lg"
            >
              <CardCanvas>
                <CardContent className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-caption font-medium uppercase tracking-wide text-muted">
                      {s.label}
                    </p>
                    <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                      {s.value}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </CardCanvas>
            </Link>
          );
        })}
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-5">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="low-stock">Low stock</TabsTrigger>
          <TabsTrigger value="near-expiry">Near expiry</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Last rate</TableHead>
                    <TableHead className="text-right">Batches</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.sku}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/inventory/products/${p.sku}`}
                          className="hover:underline"
                        >
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-body">{p.sku}</TableCell>
                      <TableCell className="text-right text-body">
                        {p.stock} {p.unit}
                      </TableCell>
                      <TableCell className="text-right text-body">{p.mrp}</TableCell>
                      <TableCell className="text-right text-body">{p.lastSaleRate}</TableCell>
                      <TableCell className="text-right text-body">{p.batches}</TableCell>
                      <TableCell>
                        <Badge variant={p.statusVariant}>{p.status}</Badge>
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
