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
import { ClipboardList, Filter, Download, Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Audit log",
};

const logs = [
  {
    ts: "29 Sep 2026 · 14:22",
    user: "Rajesh Kumar (Admin)",
    module: "Invoice",
    action: "Finalized",
    ref: "INV-00182",
    detail: "Gross ₹ 38,232 → Net ₹ 42,820 after 12% GST",
    variant: "success" as const,
  },
  {
    ts: "29 Sep 2026 · 12:08",
    user: "Neha (Inventory)",
    module: "Purchase",
    action: "Created",
    ref: "PU-00092",
    detail: "18 items from Cipla Distributors",
    variant: "secondary" as const,
  },
  {
    ts: "28 Sep 2026 · 19:04",
    user: "Rajesh Kumar (Admin)",
    module: "Product",
    action: "Edited",
    ref: "OME-20-100",
    detail: "Reorder level changed 20 → 50",
    variant: "default" as const,
  },
  {
    ts: "28 Sep 2026 · 09:51",
    user: "System",
    module: "Batch",
    action: "Blocked",
    ref: "CTZ-10 · batch CT-4021",
    detail: "Expired in 30 days; auto-flagged",
    variant: "warning" as const,
  },
  {
    ts: "27 Sep 2026 · 16:17",
    user: "Rajesh Kumar (Admin)",
    module: "Customer",
    action: "Created",
    ref: "C-00124 · MedLife Retail",
    detail: "Credit limit set to ₹ 1,00,000",
    variant: "badge-violet" as const,
  },
  {
    ts: "27 Sep 2026 · 09:11",
    user: "Neha (Inventory)",
    module: "Stock",
    action: "Adjusted",
    ref: "STK-ADJ-024",
    detail: "Damaged Omeprazole 20mg · 5 strips written off",
    variant: "destructive" as const,
  },
];

export default function AuditPage() {
  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Audit log</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Immutable record of every change in the workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary">
            <Calendar className="h-4 w-4" /> Last 30 days
          </Button>
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
                <TableHead className="w-[170px]">Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="text-body text-caption">{l.ts}</TableCell>
                  <TableCell className="text-body">{l.user}</TableCell>
                  <TableCell className="text-body">
                    <Badge variant="outline">{l.module}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.variant}>
                      <ClipboardList className="h-3 w-3 mr-1" />
                      {l.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-ink">{l.ref}</TableCell>
                  <TableCell className="text-body">{l.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>

      <p className="mt-5 text-caption text-muted">
        Read-only. Export via CSV for statutory audit submissions.
      </p>
    </DashboardLayout>
  );
}
