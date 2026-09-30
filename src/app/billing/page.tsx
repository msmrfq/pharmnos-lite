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
import { Receipt, Plus, Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import SuccessCreatedToast from "@/components/toast/creation-success-toast";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportSalesRegisterCsvAction } from "@/app/_actions/exports.actions";
import SaleActionsCell from "./_actions-cell";

export const metadata: Metadata = {
  title: "Billing",
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

export default async function BillingPage({
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
      const result = await repos.salesInvoices.list(
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
        entityLabel="Invoice"
        createdId={searchParams?.created ?? undefined}
        updatedId={searchParams?.updated ?? undefined}
        deletedId={searchParams?.deleted ?? undefined}
      />
      {finalizedYes && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-body-md">
          Invoice finalized — stock deducted and customer receivable updated.
        </div>
      )}
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Billing</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Wholesale invoices deduct FEFO batches and update customer receivables on finalize.
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
          <ExportCsvButton variant="secondary" action={exportSalesRegisterCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
          <Button asChild>
            <Link href="/billing/new">
              <Plus className="h-4 w-4" /> New invoice
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
                    <TableHead>Invoice no.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted text-body-md">
                        No invoices yet.{" "}
                        <Link
                          href="/billing/new"
                          className="text-ink font-medium underline underline-offset-4 hover:no-underline"
                        >
                          Create your first invoice
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
                      const net = Number(p.net_amount ?? 0);
                      const paid = Number(p.paid_amount ?? 0);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium text-ink">
                            <Link
                              href={`/billing/${p.id}`}
                              className="inline-flex items-center gap-2 hover:underline"
                              aria-disabled
                              style={{ pointerEvents: "none", cursor: "default", textDecoration: "none" }}
                              title="View invoice (Phase 5)"
                            >
                              <Receipt className="h-4 w-4 text-muted" />
                              {p.invoice_no || "DRAFT"}
                            </Link>
                          </TableCell>
                          <TableCell className="text-body">
                            {p.customer?.business_name ?? p.customer?.customer_name ?? "—"}
                            {p.is_cash_sale && (
                              <>
                                {" "}
                                <Badge variant="outline" className="align-middle">
                                  Cash
                                </Badge>
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-body text-muted">{p.reference_no ?? "—"}</TableCell>
                          <TableCell className="text-body whitespace-nowrap">
                            {d
                              ? d.toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right text-body">{rupee(p.gross_amount)}</TableCell>
                          <TableCell className="text-right text-body">{rupee(p.total_tax)}</TableCell>
                          <TableCell className="text-right font-semibold text-ink whitespace-nowrap">
                            {rupee(net)}
                          </TableCell>
                          <TableCell
                            className={`text-right whitespace-nowrap ${
                              p.is_cash_sale || Number(p.balance_due ?? 0) === 0
                                ? "text-emerald-700 font-medium"
                                : "text-amber-700 font-medium"
                            }`}
                          >
                            {p.is_cash_sale || paid >= net ? "Paid" : rupee(p.balance_due)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(p.status)}>{p.status ?? "DRAFT"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {dbOk && (
                              <SaleActionsCell
                                saleId={p.id}
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
              Showing {dbOk ? Math.min(items.length, total) : 0} of {total} invoices · Page {page} / {totalPages}
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
                <Link href={page <= 1 ? "/billing" : `/billing?page=${page - 1}`}>
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
                <Link href={`/billing?page=${page + 1}`}>
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
