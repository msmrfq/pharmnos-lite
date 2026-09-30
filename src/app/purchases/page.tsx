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
import { PackagePlus, Plus, Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import SuccessCreatedToast from "@/components/toast/creation-success-toast";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportPurchaseRegisterCsvAction } from "@/app/_actions/exports.actions";
import PurchaseActionsCell from "./_actions-cell";

export const metadata: Metadata = {
  title: "Purchases",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

function statusVariant(s: string) {
  if (s === "FINALIZED") return "success" as const;
  if (s === "CANCELLED") return "secondary" as const;
  return "warning" as const;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: { page?: string; created?: string; updated?: string; deleted?: string; finalized?: string };
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
      const result = await repos.purchaseInvoices.list(
        { skip: (page - 1) * pageSize, take: pageSize, orderBy: { invoice_date: "desc" } },
        ctx,
      );
      items = result.items;
      total = result.total;
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const finalizedYes = searchParams?.finalized === "1";

  return (
    <DashboardLayout>
      <SuccessCreatedToast
        entityLabel="Purchase"
        createdId={searchParams?.created ?? undefined}
        updatedId={searchParams?.updated ?? undefined}
        deletedId={searchParams?.deleted ?? undefined}
      />
      {finalizedYes && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-body-md">
          Purchase finalized — stock received and supplier payable updated.
        </div>
      )}
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Purchases</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Supplier purchase entries create batches and stock movements on finalize.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Database is not configured — showing empty grid.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button" aria-disabled title="Filter (Phase 5)">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <ExportCsvButton variant="secondary" action={exportPurchaseRegisterCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
          <Button asChild>
            <Link href="/purchases/new">
              <Plus className="h-4 w-4" /> Purchase entry
            </Link>
          </Button>
        </div>
      </CardHeader>

      <Tabs defaultValue="all">
        <TabsList className="mb-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft" aria-disabled title="Draft only (Phase 5)">Draft</TabsTrigger>
          <TabsTrigger value="finalized" aria-disabled title="Finalized only (Phase 5)">Finalized</TabsTrigger>
          <TabsTrigger value="returns" aria-disabled title="Returns (Phase 5)">Returns</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase no.</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Supplier invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                        No purchases yet.{" "}
                        <Link href="/purchases/new" className="text-ink font-medium underline underline-offset-4 hover:no-underline">
                          Create your first purchase
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
                    items.map((p: any) => {
                      const d = p.invoice_date ? new Date(p.invoice_date) : null;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-ink">
                            <Link
                              href={`/purchases/${p.id}`}
                              className="inline-flex items-center gap-2 hover:underline"
                              aria-disabled
                              style={{ pointerEvents: "none", cursor: "default", textDecoration: "none" }}
                              title="View purchase (Phase 5)"
                            >
                              <PackagePlus className="h-4 w-4 text-muted" />
                              {p.invoice_no || "—"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-body">
                            {p.supplier?.business_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-body text-muted">
                            {p.supplier_invoice_no ?? "—"}
                          </TableCell>
                          <TableCell className="text-body whitespace-nowrap">
                            {d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-body">{rupee(p.gross_amount)}</TableCell>
                          <TableCell className={`text-right ${Number(p.total_discount ?? 0) > 0 ? "text-body" : "text-muted"}`}>{rupee(p.total_discount)}</TableCell>
                          <TableCell className="text-right text-body">{rupee(p.total_tax)}</TableCell>
                          <TableCell className="text-right font-semibold text-ink whitespace-nowrap">{rupee(p.net_amount)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(p.status)}>
                              {p.status ?? "DRAFT"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {dbOk && (
                              <PurchaseActionsCell
                                purchaseId={p.id}
                                status={p.status ?? "DRAFT"}
                                invoiceNo={p.invoice_no || ""}
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
              Showing {dbOk ? Math.min(items.length, total) : 0} of {total} purchases · Page {page} / {totalPages}
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
                <Link href={page <= 1 ? "/purchases" : `/purchases?page=${page - 1}`}>
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
                <Link href={`/purchases?page=${page + 1}`}>
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
