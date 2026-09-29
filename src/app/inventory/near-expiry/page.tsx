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
import { Clock, Filter, Download, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Near expiry",
};

const batches = [
  { product: "Cetirizine 10mg (10x10)", batch: "CT-4021", expiry: "15 Nov 2026", daysLeft: 47, qty: 120, unit: "Strip", value: "₹ 25,200", variant: "badge-orange" as const },
  { product: "Amoxicillin 250mg (10x10)", batch: "AM-7730", expiry: "28 Feb 2027", daysLeft: 152, qty: 480, unit: "Strip", value: "₹ 2,01,600", variant: "warning" as const },
  { product: "Montelukast 10mg (10x10)", batch: "MN-5112", expiry: "10 Dec 2028", daysLeft: 802, qty: 92, unit: "Strip", value: "₹ 53,360", variant: "success" as const },
];

export default function NearExpiryPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand flex items-center gap-2">
            <Clock className="h-6 w-6 text-badge-orange" />
            Near expiry
          </CardTitle>
          <p className="mt-1 text-body-md text-body">
            Batches expiring in the next 90, 180, and 365 days — protect margin, block stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <Filter className="h-4 w-4" /> Window: 90 days
          </Button>
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">At risk (≤90d)</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">₹ 25,200</p>
              <Badge variant="destructive" className="mt-2">1 batch</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-semantic-error">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">≤ 180 days</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">₹ 2,26,800</p>
              <Badge variant="warning" className="mt-2">2 batches</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-badge-orange">
              <Clock className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">Blocked batches</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">1</p>
              <Badge variant="secondary" className="mt-2">CT-4021 · auto</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
      </div>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Batch no.</TableHead>
                <TableHead className="text-right">Expiry</TableHead>
                <TableHead className="text-right">Days left</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Stock value</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.batch}>
                  <TableCell className="font-medium text-ink">{b.product}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{b.batch}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-body">{b.expiry}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={b.variant}>{b.daysLeft}d</Badge>
                  </TableCell>
                  <TableCell className="text-right text-body">
                    {b.qty} {b.unit}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-ink">{b.value}</TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="secondary">
                      <Link href="#">Manage</Link>
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
