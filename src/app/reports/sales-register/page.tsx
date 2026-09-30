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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Receipt, Download, ChevronLeft, ChevronRight, Search, AlertTriangle, X } from "lucide-react";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportSalesRegisterCsvAction } from "@/app/_actions/exports.actions";

export const metadata: Metadata = {
  title: "Sales Register",
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

function buildQs(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const merged = { ...base, ...overrides };
  const parts: string[] = [];
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "" && v !== null) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export default async function SalesRegisterPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    q?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q ?? "";
  const customerId = searchParams?.customerId ?? "";
  const startDate = searchParams?.startDate ?? "";
  const endDate = searchParams?.endDate ?? "";
  let dbOk = isPostgresConfigured();

  let items: any[] = [];
  let total = 0;
  let customers: any[] = [];

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const [result, custResult] = await Promise.all([
        repos.salesInvoices.list(
          {
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { invoice_date: "desc" },
            search: q || undefined,
            customerId: customerId || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
          ctx,
        ),
        repos.customers.list({ skip: 0, take: 500, orderBy: { business_name: "asc" } }, ctx),
      ]);
      items = result.items;
      total = result.total;
      customers = custResult.items;
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(q || customerId || startDate || endDate);

  const baseQs: Record<string, string | undefined> = {
    q: q || undefined,
    customerId: customerId || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Sales register</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Line-item sales by invoice, with date range, counterparty filter and CSV export.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Database is not configured — showing empty grid.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportSalesRegisterCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">Showing placeholder numbers until database is connected.</strong>
            <span className="ml-1">Temporary Supabase pooler timeout — retry in 60 seconds.</span>
          </div>
        </div>
      )}

      <CardCanvas className="mb-5">
        <CardContent className="pt-4">
          <form action="/reports/sales-register" method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Invoice no, ref, customer…"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerId">Customer</Label>
              <Select name="customerId" defaultValue={customerId || "all"}>
                <SelectTrigger id="customerId">
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.business_name ?? c.customer_name ?? c.code ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">From date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={startDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">To date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={endDate} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Apply
              </Button>
              {hasFilters && (
                <Button type="button" variant="secondary" asChild>
                  <Link href="/reports/sales-register">
                    <X className="h-4 w-4" /> Clear
                  </Link>
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </CardCanvas>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inv no</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Disc</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Round</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Bal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted text-body-md">
                    No invoices match the current filters.
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-muted text-body-md">
                    Showing placeholder rows until database is connected.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p: any) => {
                  const d = p.invoice_date ? new Date(p.invoice_date) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-ink">
                        <div className="inline-flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted" />
                          {p.invoice_no || "DRAFT"}
                        </div>
                      </TableCell>
                      <TableCell className="text-body whitespace-nowrap">
                        {d
                          ? d.toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-body">
                        {p.customer?.business_name ?? p.customer?.customer_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-body text-muted">
                        {p.reference_no ?? "—"}
                      </TableCell>
                      <TableCell>
                        {p.is_cash_sale ? (
                          <Badge variant="outline">Cash</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>
                          {p.status ?? "DRAFT"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(p.gross_amount)}</TableCell>
                      <TableCell className={`text-right ${Number(p.total_discount ?? 0) > 0 ? "text-body" : "text-muted"}`}>
                        {rupee(p.total_discount)}
                      </TableCell>
                      <TableCell className="text-right text-body">{rupee(p.total_tax)}</TableCell>
                      <TableCell className={`text-right ${Number(p.round_off ?? 0) !== 0 ? "text-body" : "text-muted"}`}>
                        {rupee(p.round_off)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-ink whitespace-nowrap">
                        {rupee(p.net_amount)}
                      </TableCell>
                      <TableCell className="text-right text-body whitespace-nowrap">
                        {rupee(p.paid_amount)}
                      </TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap ${
                          p.is_cash_sale || Number(p.balance_due ?? 0) === 0
                            ? "text-emerald-700 font-medium"
                            : "text-amber-700 font-medium"
                        }`}
                      >
                        {p.is_cash_sale || Number(p.paid_amount ?? 0) >= Number(p.net_amount ?? 0)
                          ? "Paid"
                          : rupee(p.balance_due)}
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
            <Link
              href={
                page <= 1
                  ? `/reports/sales-register${buildQs(baseQs)}`
                  : `/reports/sales-register${buildQs(baseQs, { page: String(page - 1) })}`
              }
            >
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
            <Link href={`/reports/sales-register${buildQs(baseQs, { page: String(page + 1) })}`}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
