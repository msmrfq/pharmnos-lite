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
import { Truck, Plus, Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import SuccessCreatedToast from "@/components/toast/creation-success-toast";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportSuppliersCsvAction } from "@/app/_actions/exports.actions";
import { deleteSupplierAction } from "@/app/_actions/masters.actions";
import MasterActionsCell from "@/components/ui/master-actions-cell";

export const metadata: Metadata = {
  title: "Suppliers",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

export default async function SuppliersPage({
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
      const result = await repos.suppliers.list({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { business_name: "asc" } }, ctx);
      items = result.items;
      total = result.total;
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <DashboardLayout>
      <SuccessCreatedToast
        entityLabel="Supplier"
        createdId={searchParams?.created ?? undefined}
        updatedId={searchParams?.updated ?? undefined}
        deletedId={searchParams?.deleted ?? undefined}
      />
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Suppliers</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Suppliers, credit terms and payable balances.
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
          <ExportCsvButton variant="secondary" action={exportSuppliersCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
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
          <TabsTrigger value="active" aria-disabled title="Active only (Phase 4)">Active</TabsTrigger>
          <TabsTrigger value="inactive" aria-disabled title="Inactive only (Phase 4)">Inactive</TabsTrigger>
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
                      <TableHead className="text-right">Payable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted text-body-md">
                        No suppliers yet.{" "}
                        <Link href="/suppliers/new" className="text-ink font-medium underline underline-offset-4 hover:no-underline">
                          Create your first supplier
                        </Link>
                      </TableCell>
                    </TableRow>
                  ) : !dbOk ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted text-body-md">
                        Showing placeholder rows until database is connected.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((s: any) => {
                      const pay = Number(s.payable_balance ?? 0);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-ink">
                            <Link
                              href={`/suppliers/${s.id}`}
                              className="inline-flex items-center gap-2 hover:underline"
                            >
                              <Truck className="h-4 w-4 text-muted" />
                              {s.code ?? "—"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-body font-medium text-ink">{s.business_name}</TableCell>
                          <TableCell className="text-body">
                            <p className="text-ink">{s.contact_person ?? "—"}</p>
                            <p className="text-caption text-muted">{s.mobile ?? s.phone ?? "—"}</p>
                          </TableCell>
                          <TableCell className="text-body">
                            {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-body font-mono text-xs uppercase">{s.state ?? "—"}</TableCell>
                          <TableCell className={`text-right font-semibold ${pay > 0 ? "text-destructive" : "text-ink"}`}>
                            {rupee(pay)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={s.is_active === false ? "secondary" : "success"}>
                              {s.is_active === false ? "Inactive" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {dbOk && (
                              <MasterActionsCell
                                entityId={s.id}
                                entityLabel="Supplier"
                                editHref={`/suppliers/${s.id}/edit`}
                                deleteAction={deleteSupplierAction}
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
              Showing {dbOk ? Math.min(items.length, total) : 0} of {total} suppliers · Page {page} / {totalPages}
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
                <Link href={page <= 1 ? "/suppliers" : `/suppliers?page=${page - 1}`}>
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
                <Link href={`/suppliers?page=${page + 1}`}>
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
