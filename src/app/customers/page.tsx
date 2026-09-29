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
import { Users, Plus, Download, Filter } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Customers",
};

const customers = [
  {
    code: "C-00121",
    name: "MedPlus Pharmacy",
    owner: "Suresh Reddy",
    mobile: "+91 98 7654 1209",
    place: "Pune, MH",
    balance: "₹ 42,800",
    overdue: 8,
    bucket: "0-30 days",
    bucketVariant: "success" as const,
  },
  {
    code: "C-00122",
    name: "Franklin Medico",
    owner: "Anita Kulkarni",
    mobile: "+91 99 2210 7766",
    place: "Nashik, MH",
    balance: "₹ 18,450",
    overdue: 37,
    bucket: "31-60 days",
    bucketVariant: "warning" as const,
  },
  {
    code: "C-00123",
    name: "Sharda Agencies",
    owner: "Prakash Shah",
    mobile: "+91 93 2110 0998",
    place: "Nagpur, MH",
    balance: "₹ 9,820",
    overdue: 92,
    bucket: "90+ days",
    bucketVariant: "destructive" as const,
  },
];

export default function CustomersPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Customers</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Customer master, credit profiles and account balances.
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
            <Link href="/customers/new">
              <Plus className="h-4 w-4" /> Add customer
            </Link>
          </Button>
        </div>
      </CardHeader>

      <Tabs defaultValue="all">
        <TabsList className="mb-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
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
                    <TableHead className="text-right">Overdue (days)</TableHead>
                    <TableHead>Aging</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.code}>
                      <TableCell className="font-medium text-ink">
                        <Link
                          href={`/customers/${c.code}`}
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <Users className="h-4 w-4 text-muted" />
                          {c.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-body font-medium text-ink">{c.name}</TableCell>
                      <TableCell className="text-body">
                        <p className="text-ink">{c.owner}</p>
                        <p className="text-caption text-muted">{c.mobile}</p>
                      </TableCell>
                      <TableCell className="text-body">{c.place}</TableCell>
                      <TableCell className="text-right font-semibold text-ink">{c.balance}</TableCell>
                      <TableCell className="text-right text-body">{c.overdue}</TableCell>
                      <TableCell>
                        <Badge variant={c.bucketVariant}>{c.bucket}</Badge>
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
