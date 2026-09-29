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
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

export const metadata: Metadata = {
  title: "New invoice",
};

const lineItems = [
  { product: "Paracetamol 500mg (10x10)", batch: "PA-2409", expiry: "Nov 2027", qty: 5, rate: "₹ 240", amount: "₹ 1,200" },
  { product: "Azithromycin 250mg (1x6)", batch: "AZ-1172", expiry: "Mar 2028", qty: 10, rate: "₹ 680", amount: "₹ 6,800" },
  { product: "Cetirizine 10mg (10x10)", batch: "CT-4021", expiry: "Aug 2027", qty: 3, rate: "₹ 140", amount: "₹ 420" },
];

export default function NewBillingPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/billing" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <CardTitle className="text-display-sm tracking-brand">New invoice</CardTitle>
            <CardDescription>
              Select a customer, add items by batch, and finalize when ready.
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Save draft</Button>
          <Button>
            <Save className="h-4 w-4" /> Finalize
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardCanvas>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Search or pick customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medplus">MedPlus Pharmacy</SelectItem>
                    <SelectItem value="franklin">Franklin Medico</SelectItem>
                    <SelectItem value="sharda">Sharda Agencies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice date</Label>
                <Input type="date" defaultValue="2026-09-29" />
              </div>
              <div className="space-y-2">
                <Label>Payment terms</Label>
                <Select defaultValue="30">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Cash / Due on receipt</SelectItem>
                    <SelectItem value="15">Net 15 days</SelectItem>
                    <SelectItem value="30">Net 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ref no. (optional)</Label>
                <Input placeholder="e.g. PO-00421" />
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-title-md">Line items</CardTitle>
              <Button size="sm" variant="secondary">
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((li) => (
                    <TableRow key={li.product}>
                      <TableCell className="font-medium text-ink">{li.product}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{li.batch}</Badge>
                      </TableCell>
                      <TableCell className="text-body">{li.expiry}</TableCell>
                      <TableCell className="text-right">
                        <Input className="h-9 w-20 ml-auto text-right" defaultValue={li.qty} />
                      </TableCell>
                      <TableCell className="text-right text-body">{li.rate}</TableCell>
                      <TableCell className="text-right font-semibold text-ink">{li.amount}</TableCell>
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
                <span>Subtotal</span>
                <span>₹ 8,420</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>GST 12%</span>
                <span>₹ 1,010</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>GST 18%</span>
                <span>₹ 360</span>
              </div>
              <div className="flex justify-between text-body-md text-body">
                <span>Discount</span>
                <span>- ₹ 0</span>
              </div>
              <div className="mt-3 pt-3 border-t border-hairline flex justify-between items-baseline">
                <span className="text-nav-link font-semibold text-ink">Grand total</span>
                <span className="text-title-lg font-semibold text-ink">₹ 9,790</span>
              </div>
            </CardContent>
          </CardCanvas>

          <CardCanvas>
            <CardHeader className="pb-3">
              <CardTitle className="text-title-md">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-body-sm text-body">
                No notes. Stock will deduct on finalize using FEFO batch allocation.
              </p>
            </CardContent>
          </CardCanvas>
        </div>
      </div>
    </DashboardLayout>
  );
}
