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
import { Truck, Plus, Download, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Suppliers",
};

const suppliers = [
  {
    code: "S-00081",
    name: "Cipla Distributors",
    contact: "Anil Kapoor",
    mobile: "+91 98 8801 2311",
    place: "Mumbai, MH",
    balance: "₹ 84,200",
    terms: "Net 45",
    rating: "Active",
    variant: "success" as const,
  },
  {
    code: "S-00082",
    name: "Sun Pharma Ltd",
    contact: "Dinesh Patel",
    mobile: "+91 99 2010 1203",
    place: "Vadodara, GJ",
    balance: "₹ 12,800",
    terms: "Net 30",
    rating: "Active",
    variant: "success" as const,
  },
  {
    code: "S-00083",
    name: "Arbor Drugs",
    contact: "Rohit Mehra",
    mobile: "+91 93 1120 9912",
    place: "Ahmedabad, GJ",
    balance: "₹ 0",
    terms: "Net 30",
    rating: "New",
    variant: "secondary" as const,
  },
];

export default function SuppliersPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Suppliers</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Suppliers, credit terms and payable balances.
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
            <Link href="/suppliers/new">
              <Plus className="h-4 w-4" /> Add supplier
            </Link>
          </Button>
        </div>
      </CardHeader>

      <Tabs defaultValue="all">
        <TabsList className="mb-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Place</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((s) => (
                    <TableRow key={s.code}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/suppliers/${s.code}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <Truck className="h-4 w-4 text-muted" />
                          {s.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-body font-medium text-ink">{s.name}</TableCell>
                      <TableCell className="text-body">
                        <p className="text-ink">{s.contact}</p>
                        <p className="text-caption text-muted">{s.mobile}</p>
                      </TableCell>
                      <TableCell className="text-body">{s.place}</TableCell>
                      <TableCell className="text-right font-semibold text-ink">{s.balance}</TableCell>
                      <TableCell className="text-body">{s.terms}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.rating}</Badge>
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
