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
import { Users, Plus, Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import SuccessCreatedToast from "@/components/toast/creation-success-toast";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportCustomersCsvAction } from "@/app/_actions/exports.actions";
import { deleteCustomerAction } from "@/app/_actions/masters.actions";
import CustomerActionsCell from "./_actions-cell";

export const metadata: Metadata = {
  title: "Customers",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const agingBucket = (overdueDays: number) => {
  if (overdueDays <= 0) return { label: "Current", variant: "success" as const };
  if (overdueDays <= 30) return { label: "0-30 days", variant: "success" as const };
  if (overdueDays <= 60) return { label: "31-60 days", variant: "warning" as const };
  if (overdueDays <= 90) return { label: "61-90 days", variant: "warning" as const };
  return { label: "90+ days", variant: "destructive" as const };
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { page?: string; created?: string; updated?: string; deleted?: string };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 25;
  let dbOk = isPostgresConfigured();

  let items: any[] = [];
  let total = 0;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      // Session ctx wired. Demo fallback active when no Supabase auth session exists or DB membership missing.
      const result = await repos.customers.list({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { business_name: "asc" } }, ctx);
      items = result.items;
      total = result.total;
      const perCustomerAging = new Map<string, number>();
      for (const c of items) {
        try {
          if (Number(c.receivable_balance ?? 0) <= 0) {
            perCustomerAging.set(c.id, 0);
            continue;
          }
          const d = await repos.customerLedgers.getOldestOverdueDays(c.id, ctx);
          perCustomerAging.set(c.id, Number.isFinite(d) ? d : 0);
        } catch (_) {
          perCustomerAging.set(c.id, 0);
        }
      }
      (items as any)._agingMap = perCustomerAging;
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout>
      <SuccessCreatedToast
        entityLabel="Customer"
        createdId={searchParams?.created ?? undefined}
        updatedId={searchParams?.updated ?? undefined}
        deletedId={searchParams?.deleted ?? undefined}
      />
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Customers</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Customer master, credit profiles and account balances.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Database is not configured — showing empty grid.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button" aria-disabled title="Filter (Phase 4)">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <ExportCsvButton variant="secondary" action={exportCustomersCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
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
          <TabsTrigger value="active" aria-disabled title="Active only (Phase 4)">Active</TabsTrigger>
          <TabsTrigger value="overdue" aria-disabled title="Overdue only (Phase 4)">Overdue</TabsTrigger>
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
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Credit limit</TableHead>
                    <TableHead className="text-right">Receivable</TableHead>
                    <TableHead>Aging</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                        No customers yet.{" "}
                        <Link href="/customers/new" className="text-ink font-medium underline underline-offset-4 hover:no-underline">
                          Create your first customer
                        </Link>
                      </TableCell>
                    </TableRow>
                  ) : !dbOk ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                        Showing placeholder rows until database is connected.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((c: any) => {
                      const recv = Number(c.receivable_balance ?? 0);
                      const agingMap = (items as any)._agingMap as Map<string, number> | undefined;
                      const agingDays = agingMap?.get(c.id) ?? (recv > 0 ? 7 : 0);
                      const bucket = agingBucket(agingDays);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-ink">
                            <Link
                              href={`/customers/${c.id}`}
                              className="inline-flex items-center gap-2 hover:underline"
                            >
                              <Users className="h-4 w-4 text-muted" />
                              {c.code ?? "—"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-body font-medium text-ink">{c.business_name}</TableCell>
                          <TableCell className="text-body">
                            <p className="text-ink">{c.contact_person ?? "—"}</p>
                            <p className="text-caption text-muted">{c.mobile ?? c.phone ?? "—"}</p>
                          </TableCell>
                          <TableCell className="text-body">
                            {[c.billing_city, c.billing_state].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-body font-mono text-xs uppercase">{c.billing_state ?? "—"}</TableCell>
                          <TableCell className="text-right text-body">{rupee(c.credit_limit)}</TableCell>
                          <TableCell className={`text-right font-semibold ${recv > 0 ? "text-destructive" : "text-ink"}`}>
                            {rupee(recv)}
                          </TableCell>
                          <TableCell>
                            {recv > 0 ? (
                              <Badge variant={bucket.variant}>{bucket.label}</Badge>
                            ) : (
                              <Badge variant="success">No dues</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.is_active === false ? "secondary" : "default"} className={c.is_active === false ? "" : "bg-[#111] text-white"}>
                              {c.is_active === false ? "Inactive" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {dbOk && (
                              <CustomerActionsCell
                                entityId={c.id}
                                entityLabel="Customer"
                                editHref={`/customers/${c.id}/edit`}
                                deleteAction={deleteCustomerAction}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </CardCanvas>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-caption text-muted">
              Showing {dbOk ? Math.min(items.length, total) : 0} of {total} customers · Page {page} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                asChild
                aria-disabled={page <= 1}
                className={page <= 1 ? "opacity-60 pointer-events-none" : ""}
              >
                <Link href={page <= 1 ? "/customers" : `/customers?page=${page - 1}`}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                asChild
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "opacity-60 pointer-events-none" : ""}
              >
                <Link href={`/customers?page=${page + 1}`}>
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
