import Link from "next/link";
import type { Metadata } from "next";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  IndianRupee,
  FilterX,
} from "lucide-react";
import { isPostgresConfigured, prisma } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportDaybookCsvAction } from "@/app/_actions/exports.actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Daybook",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "\u2014";
  return `\u20B9 ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10);

type DaybookRow = {
  id: string;
  entry_date: Date;
  voucher_type: "Customer Invoice" | "Customer Payment" | "Supplier Invoice" | "Supplier Payment" | "Opening balance";
  counterparty: string;
  debit: number;
  credit: number;
  balance: number;
  narration: string | null;
  invoice_ref: string | null;
};

type VoucherFilter = "all" | "invoice" | "payment";

export default async function DaybookPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    from?: string;
    to?: string;
    voucher?: string;
    page?: string;
  };
}) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fromStr = searchParams?.from?.trim() || yyyymmdd(firstOfMonth);
  const toStr = searchParams?.to?.trim() || yyyymmdd(lastOfMonth);
  const fromDate = new Date(fromStr + "T00:00:00.000Z");
  const toDate = new Date(toStr + "T23:59:59.999Z");
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 50;
  const q = searchParams?.q?.trim() ?? "";
  const voucherRaw = (searchParams?.voucher?.trim() ?? "all") as VoucherFilter;
  const voucher: VoucherFilter = ["all", "invoice", "payment"].includes(voucherRaw) ? voucherRaw : "all";
  const hasFilter = Boolean(q || voucher !== "all" || fromStr !== yyyymmdd(firstOfMonth) || toStr !== yyyymmdd(lastOfMonth));

  let dbOk = isPostgresConfigured();

  let items: DaybookRow[] = [];
  let total = 0;
  let openingBalance = 0;
  let summaryDebit = 0;
  let summaryCredit = 0;
  let summaryNet = 0;

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      const t = ctx;

      const custBefore = await (prisma as any).customer_ledgers.findMany({
        where: { tenant_id: t.tenantId, entry_date: { lt: fromDate } },
        select: { debit: true, credit: true },
      });
      const suppBefore = await (prisma as any).supplier_ledgers.findMany({
        where: { tenant_id: t.tenantId, entry_date: { lt: fromDate } },
        select: { debit: true, credit: true },
      });
      let ob = 0;
      for (const r of custBefore as any[]) ob += Number(r.debit ?? 0) - Number(r.credit ?? 0);
      for (const r of suppBefore as any[]) ob += Number(r.debit ?? 0) - Number(r.credit ?? 0);
      openingBalance = ob;

      const custRows = await (prisma as any).customer_ledgers.findMany({
        where: { tenant_id: t.tenantId, entry_date: { gte: fromDate, lte: toDate } },
        include: {
          customer: { select: { business_name: true } },
          invoice: { select: { invoice_no: true } },
        },
        orderBy: { entry_date: "asc" },
      });
      const suppRows = await (prisma as any).supplier_ledgers.findMany({
        where: { tenant_id: t.tenantId, entry_date: { gte: fromDate, lte: toDate } },
        include: {
          supplier: { select: { business_name: true } },
          purchase: { select: { invoice_no: true } },
        },
        orderBy: { entry_date: "asc" },
      });

      type U = {
        id: string; entry_date: Date; voucher_type: DaybookRow["voucher_type"];
        counterparty: string; debit: number; credit: number;
        narration: string | null; invoice_ref: string | null;
      };
      const unified: U[] = [];
      for (const r of custRows as any[]) {
        let vt: DaybookRow["voucher_type"] = "Customer Invoice";
        if (r.entry_type === "PAYMENT_RECEIVED") vt = "Customer Payment";
        else if (r.entry_type === "OPENING_BALANCE") vt = "Opening balance";
        unified.push({
          id: `c_${r.id}`,
          entry_date: r.entry_date,
          voucher_type: vt,
          counterparty: r.customer?.business_name ?? "",
          debit: Number(r.debit ?? 0),
          credit: Number(r.credit ?? 0),
          narration: r.narration ?? null,
          invoice_ref: r.invoice?.invoice_no ?? r.reference_id ?? null,
        });
      }
      for (const r of suppRows as any[]) {
        let vt: DaybookRow["voucher_type"] = "Supplier Invoice";
        if (r.entry_type === "PAYMENT_MADE") vt = "Supplier Payment";
        else if (r.entry_type === "OPENING_BALANCE") vt = "Opening balance";
        unified.push({
          id: `s_${r.id}`,
          entry_date: r.entry_date,
          voucher_type: vt,
          counterparty: r.supplier?.business_name ?? "",
          debit: Number(r.debit ?? 0),
          credit: Number(r.credit ?? 0),
          narration: r.narration ?? null,
          invoice_ref: r.purchase?.invoice_no ?? r.reference_id ?? null,
        });
      }
      unified.sort((a, b) => a.entry_date.getTime() - b.entry_date.getTime() || a.id.localeCompare(b.id));

      let filtered = unified;

      if (voucher === "invoice") {
        filtered = filtered.filter((r) => r.voucher_type === "Customer Invoice" || r.voucher_type === "Supplier Invoice");
      } else if (voucher === "payment") {
        filtered = filtered.filter((r) => r.voucher_type === "Customer Payment" || r.voucher_type === "Supplier Payment");
      }

      if (q) {
        const qLower = q.toLowerCase();
        filtered = filtered.filter((r) =>
          (r.counterparty?.toLowerCase().includes(qLower) ?? false) ||
          (r.narration?.toLowerCase().includes(qLower) ?? false) ||
          (r.invoice_ref?.toLowerCase().includes(qLower) ?? false)
        );
      }

      const withBal: DaybookRow[] = [];
      let running = openingBalance;
      for (const u of filtered) {
        running += u.debit - u.credit;
        withBal.push({ ...u, balance: running });
      }

      total = withBal.length;
      for (const r of filtered) {
        summaryDebit += r.debit;
        summaryCredit += r.credit;
      }
      summaryNet = summaryDebit - summaryCredit;

      const startIdx = (page - 1) * pageSize;
      items = withBal.slice(startIdx, startIdx + pageSize);
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    if (voucher !== "all") params.set("voucher", voucher);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === "" || v === null) params.delete(k);
      else params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `/reports/daybook?${qs}` : "/reports/daybook";
  };

  return (
    <DashboardLayout
      tenantName="Maharashtra Pharma Distributors"
      userName="Rajesh Kumar"
      userInitials="RK"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5 flex-wrap">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Daybook</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Chronological debit/credit daybook with running balance for customer + supplier ledgers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportDaybookCsvAction}>
            <Download className="h-4 w-4" /> Export CSV
          </ExportCsvButton>
        </div>
      </CardHeader>

      {!dbOk && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold">Showing placeholder rows until database is connected.</strong>
            <span className="ml-1">Temporary Supabase pooler timeout \u2014 retry in 60 seconds.</span>
          </div>
        </div>
      )}

      <CardCanvas className="mb-5">
        <CardContent className="p-4">
          <form
            action={buildHref({ page: undefined })}
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="q" className="text-caption font-medium text-muted block">
                <span className="inline-flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5" /> Search
                </span>
              </Label>
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="Counterparty, narration, ref\u2026"
                defaultValue={q}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from" className="text-caption font-medium text-muted block">
                From date
              </Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={fromStr}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to" className="text-caption font-medium text-muted block">
                To date
              </Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={toStr}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voucher" className="text-caption font-medium text-muted block">
                Voucher type
              </Label>
              <select
                id="voucher"
                name="voucher"
                defaultValue={voucher}
                className={cn(
                  "flex h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-body-md text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="all">All vouchers</option>
                <option value="invoice">Invoices only</option>
                <option value="payment">Payments only</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="default">
                Apply
              </Button>
              {hasFilter ? (
                <Button
                  type="button"
                  variant="secondary"
                  asChild
                >
                  <Link href="/reports/daybook">
                    <FilterX className="h-4 w-4" /> Reset
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </CardCanvas>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher type</TableHead>
                <TableHead>Counterparty</TableHead>
                <TableHead className="text-right">Debit \u20B9</TableHead>
                <TableHead className="text-right">Credit \u20B9</TableHead>
                <TableHead className="text-right">Balance \u20B9</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead>Invoice ref</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted text-body-md">
                    {hasFilter
                      ? "No daybook entries match the current filters."
                      : "No ledger entries in the selected date range yet."}
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted text-body-md">
                    Showing placeholder rows until database is connected.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-body whitespace-nowrap tabular-nums">
                      {new Date(r.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-body whitespace-nowrap">
                      <Badge variant="secondary">{r.voucher_type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-ink max-w-xs truncate">
                      {r.counterparty ?? "\u2014"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums whitespace-nowrap ${r.debit > 0 ? "font-medium text-ink" : "text-muted"}`}>
                      {r.debit > 0 ? rupee(r.debit) : "\u2014"}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums whitespace-nowrap ${r.credit > 0 ? "font-medium text-ink" : "text-muted"}`}>
                      {r.credit > 0 ? rupee(r.credit) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {r.balance < 0 ? (
                        <Badge variant="destructive">{rupee(r.balance)}</Badge>
                      ) : (
                        <span className="font-semibold text-ink">{rupee(r.balance)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-body max-w-xs truncate">
                      {r.narration ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-body font-mono text-xs whitespace-nowrap">
                      {r.invoice_ref ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>

      <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
        <p className="text-caption text-muted">
          Showing {dbOk ? Math.min(items.length, total) : 0} of {total} entries \u00b7 Page {page} / {totalPages}
          {q && <span className="ml-2">\u00b7 Search: \u201C{q}\u201D</span>}
          <span className="ml-2">\u00b7 Range: {fromStr} \u2192 {toStr}</span>
          {voucher !== "all" && <span className="ml-2">\u00b7 {voucher === "invoice" ? "Invoices only" : "Payments only"}</span>}
          <span className="ml-2">\u00b7 Opening: {dbOk ? rupee(openingBalance) : rupee(0)}</span>
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
            <Link href={buildHref({ page: page <= 1 ? undefined : page - 1 })}>
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
            <Link href={buildHref({ page: page >= totalPages ? undefined : page + 1 })}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <CardCanvas>
          <CardContent className="p-5">
            <div className="grid gap-5 sm:grid-cols-3 items-start">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total debits
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryDebit) : rupee(0)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Total credits
                  </p>
                  <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                    {dbOk ? rupee(summaryCredit) : rupee(0)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-card border border-hairline text-muted">
                  <IndianRupee className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-muted">
                    Net movement (D \u2212 C)
                  </p>
                  <p className={`mt-1 text-display-sm font-display tracking-brand ${summaryNet < 0 ? "text-destructive" : "text-ink"}`}>
                    {dbOk ? rupee(summaryNet) : rupee(0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </CardCanvas>
      </div>
    </DashboardLayout>
  );
}
