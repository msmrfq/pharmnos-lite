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
import { AlertTriangle, PackagePlus, Filter, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Low stock",
};

const items = [
  { name: "Omeprazole 20mg Cap (10x10)", sku: "OME-20-100", available: 8, reorder: 50, unit: "Strip", variant: "destructive" as const, supplier: "Arbor Drugs" },
  { name: "Multivitamin Gold (1x15)", sku: "MVG-15-001", available: 3, reorder: 20, unit: "Strip", variant: "destructive" as const, supplier: "Cipla Distributors" },
  { name: "Cetirizine 10mg Tab (10x10)", sku: "CTZ-10-100", available: 21, reorder: 100, unit: "Strip", variant: "warning" as const, supplier: "Sun Pharma Ltd" },
  { name: "Azithromycin 250mg (1x6)", sku: "AZM-250-006", available: 33, reorder: 75, unit: "Strip", variant: "badge-orange" as const, supplier: "Sun Pharma Ltd" },
  { name: "Metformin 500mg SR (10x10)", sku: "MET-500-100", available: 41, reorder: 120, unit: "Strip", variant: "badge-orange" as const, supplier: "Cipla Distributors" },
];

export default function LowStockPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-semantic-error" />
            Low stock
          </CardTitle>
          <p className="mt-1 text-body-md text-body">
            Items at or below your reorder level — create purchase orders here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search products…" className="w-64" />
          <Button variant="secondary">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reorder level</TableHead>
                <TableHead>Preferred supplier</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.sku}>
                  <TableCell className="font-medium text-ink">
                    <Link href={`/inventory/products/${it.sku}`} className="hover:underline">
                      {it.name}
                    </Link>
                    <p className="text-caption text-muted">{it.sku}</p>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-ink">
                    {it.available} {it.unit}
                  </TableCell>
                  <TableCell className="text-right text-body">{it.reorder} {it.unit}</TableCell>
                  <TableCell className="text-body">{it.supplier}</TableCell>
                  <TableCell>
                    <Badge variant={it.variant}>
                      {it.variant === "destructive" ? "Below reorder" : "Low"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/purchases/new">
                        <PackagePlus className="h-4 w-4" /> Create PO
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>
    </DashboardLayout>
  );
}
