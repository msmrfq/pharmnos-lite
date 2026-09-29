import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CardCanvas,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, PackagePlus, Check } from "lucide-react";

export const metadata: Metadata = {
  title: "New purchase",
};

const purchaseItems = [
  { product: "Amoxicillin 250mg Cap (10x10)", batch: "AM-7730", expiry: "Feb 2029", qty: 20, purchaseRate: "₹ 420", mrp: "₹ 820" },
  { product: "Montelukast 10mg Tab (10x10)", batch: "MN-5112", expiry: "Dec 2028", qty: 15, purchaseRate: "₹ 580", mrp: "₹ 1,140" },
];

export default function NewPurchasePage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/purchases" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">New purchase entry</CardTitle>
            <CardDescription>
              Record stock received from a supplier. Batches are created on save.
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Save draft</Button>
          <Button>
            <Check className="h-4 w-4" /> Confirm inward
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Search or pick supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cipla">Cipla Distributors</SelectItem>
                    <SelectItem value="sun">Sun Pharma Ltd</SelectItem>
                    <SelectItem value="arbor">Arbor Drugs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Supplier invoice no.</Label>
                <Input placeholder="e.g. INV/CIP/00219" />
              </div>
              <div className="space-y-2">
                <Label>Purchase date</Label>
                <Input type="date" defaultValue="2026-09-29" />
              </div>
              <div className="space-y-2">
                <Label>Payment terms</Label>
                <Select defaultValue="45">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Cash</SelectItem>
                    <SelectItem value="30">Net 30</SelectItem>
                    <SelectItem value="45">Net 45</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-title-md">Items received</CardTitle>
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Purchase rate</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseItems.map((li) => (
                    <TableRow key={li.product}>
                      <TableCell className="font-medium text-ink">
                        <div className="flex items-center gap-2">
                          <PackagePlus className="h-4 w-4 text-muted" />
                          {li.product}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="badge-violet">{li.batch}</Badge>
                      </TableCell>
                      <TableCell className="text-body">{li.expiry}</TableCell>
                      <TableCell className="text-right">
                        <Input className="h-9 w-20 ml-auto text-right" defaultValue={li.qty} />
                      </TableCell>
                      <TableCell className="text-right text-body">{li.purchaseRate}</TableCell>
                      <TableCell className="text-right text-body">{li.mrp}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>
        </div>

        <div className="space-y-6">
          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-body-md text-body">
                <span>Goods value</span>
                <span>₹ 17,100</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>GST 18% (IGST)</span>
                <span>₹ 3,078</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>Freight / misc</span>
                <span>+ ₹ 0</span>
              </div>
              <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-baseline">
                <span className="text-nav-link font-semibold text-ink">Payable</span>
                <span className="text-title-lg font-semibold text-ink">₹ 20,178</span>
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Stock impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-body-sm text-body">
                Confirming this entry will create 2 new batches and 2 inward stock movements.
              </p>
            </CardContent>
          </CardCanvas>
        </div>
      </div>
    </DashboardLayout>
  );
}
