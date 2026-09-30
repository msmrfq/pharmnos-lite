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
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportLowStockCsvAction } from "@/app/_actions/exports.actions";
import { AlertTriangle, PackagePlus, Download } from "lucide-react";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";

export const metadata: Metadata = {
  title: "Low stock",
};

export default async function LowStockPage() {
  let dbOk = isPostgresConfigured();
  let items: any[] = [];
  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      // Session ctx wired. Demo fallback active when no Supabase auth session exists or DB membership missing.
      const result = await repos.products.listLowStock({ skip: 0, take: 500, orderBy: { name: "asc" } }, ctx);
      items = result.items ?? [];
    } catch (_err) {
      dbOk = false;
    }
  }
  const summaryBelow = items.filter((p) => Number(p.total_available ?? 0) <= 0.5 * Number(p.reorder_level ?? 10)).length;

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Low stock
          </CardTitle>
          <p className="mt-1 text-body-md text-body">
            Items at or below reorder level. Create purchase orders to restock.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">Database not configured — empty grid.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportLowStockCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
          <Button asChild>
            <Link href="/purchases/new">
              <PackagePlus className="h-4 w-4" /> New purchase order
            </Link>
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">Products low stock</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{items.length}</p>
              <Badge variant="warning" className="mt-2">Below reorder</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">Critical (≤50% reorder)</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{summaryBelow}</p>
              <Badge variant="destructive" className="mt-2">Urgent reorder</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">Suggested POs</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{Math.ceil(items.length / 5)}</p>
              <Badge variant="secondary" className="mt-2">Group by supplier</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
              <PackagePlus className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
      </div>

      <CardCanvas>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Reorder level</TableHead>
                <TableHead>Shortfall</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted text-body-md">
                    No low-stock products. Good job.
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted text-body-md">
                    Empty grid — connect database to see low-stock list.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((p: any) => {
                  const avail = Number(p.total_available ?? 0);
                  const reorder = Number(p.reorder_level ?? 10);
                  const short = Math.max(0, reorder - avail);
                  const critical = avail <= 0.5 * reorder;
                  const variant = critical ? "destructive" : "warning";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-ink">
                        <Link href={`/inventory/products/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-caption text-muted font-mono">{p.sku ?? "—"}</p>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${critical ? "text-destructive" : "text-ink"}`}>
                        {avail}
                      </TableCell>
                      <TableCell className="text-right text-body">{reorder}</TableCell>
                      <TableCell className="text-body">
                        {short > 0 ? <span className="text-destructive font-medium">-{short}</span> : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={variant}>
                          {critical ? "Critical" : "Low"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href="/purchases/new">
                            <PackagePlus className="h-4 w-4" /> Create PO
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </CardCanvas>
    </DashboardLayout>
  );
}
