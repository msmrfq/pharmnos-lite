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
import { exportNearExpiryCsvAction } from "@/app/_actions/exports.actions";
import { Clock, Download, AlertTriangle } from "lucide-react";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";

export const metadata: Metadata = {
  title: "Near expiry",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const daysBetween = (target: Date | string | null | undefined): number => {
  if (!target) return 0;
  const t = target instanceof Date ? target : new Date(target);
  if (!Number.isFinite(t.getTime())) return 0;
  const ms = t.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const bucketVariant = (days: number): "destructive" | "warning" | "success" | "secondary" => {
  if (days <= 0) return "destructive";
  if (days <= 90) return "destructive";
  if (days <= 180) return "warning";
  return "success";
};

export default async function NearExpiryPage() {
  let dbOk = isPostgresConfigured();
  const windows = [60, 180, 365];
  let items: any[] = [];
  let valAtRisk = 0;
  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      // Session ctx wired. Demo fallback active when no Supabase auth session exists or DB membership missing.
      const maxWindow = Math.max(...windows);
      const rows = await repos.productBatches.listNearExpiry(ctx, maxWindow);
      items = rows;
      for (const b of rows as any) {
        valAtRisk += Number(b.mrp ?? b.product?.mrp ?? 0) * Number(b.available_qty ?? 0);
      }
    } catch (_err) {
      dbOk = false;
    }
  }
  const in90 = items.filter((b) => daysBetween(b.expiry_date) <= 90).length;
  const in180 = items.filter((b) => {
    const d = daysBetween(b.expiry_date);
    return d > 90 && d <= 180;
  }).length;
  const autoBlock = items.filter((b) => daysBetween(b.expiry_date) <= 0).length;

  return (
    <DashboardLayout>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand flex items-center gap-2">
            <Clock className="h-6 w-6" style={{ color: "var(--color-orange)" }} />
            Near expiry
          </CardTitle>
          <p className="mt-1 text-body-md text-body">
            Batches expiring within the next 180 days. Protect margin, flag for blocking.
          </p>
          {!dbOk && <p className="mt-2 text-caption text-destructive">Database not configured.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton variant="secondary" action={exportNearExpiryCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">At risk (≤90d)</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{in90}</p>
              <Badge variant="destructive" className="mt-2">{in90} batches</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">≤ 180 days</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{in90 + in180}</p>
              <Badge variant="warning" className="mt-2">{in180} more</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline" style={{ color: "var(--color-orange)" }}>
              <Clock className="h-5 w-5" />
            </span>
          </CardContent>
        </CardCanvas>
        <CardCanvas>
          <CardContent className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-muted">Blocked / expired</p>
              <p className="mt-1 text-display-sm font-display tracking-brand text-ink">{autoBlock}</p>
              <Badge variant="secondary" className="mt-2">Value {rupee(valAtRisk)}</Badge>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
              <AlertTriangle className="h-5 w-5" />
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
                <TableHead>Batch no.</TableHead>
                <TableHead className="text-right">Expiry</TableHead>
                <TableHead className="text-right">Days left</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Stock value</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dbOk && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted text-body-md">
                    No batches near expiry.
                  </TableCell>
                </TableRow>
              ) : !dbOk ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted text-body-md">
                    Empty grid — connect database to see near-expiry batches.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((b: any) => {
                  const days = daysBetween(b.expiry_date);
                  const exp = b.expiry_date ? new Date(b.expiry_date) : null;
                  const expStr = exp ? exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  const qty = Number(b.available_qty ?? 0);
                  const mrp = Number(b.mrp ?? b.product?.mrp ?? 0);
                  const value = qty * mrp;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-ink">
                        {b.product?.name ?? "—"}
                        <p className="text-caption text-muted font-mono">{b.product?.sku ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.batch_no}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-body">{expStr}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={bucketVariant(days)}>{days}d</Badge>
                      </TableCell>
                      <TableCell className="text-right text-body">{qty}</TableCell>
                      <TableCell className="text-right font-semibold text-ink">{rupee(value)}</TableCell>
                      <TableCell>
                        {(b as any).product?.id ? (
                          <Button asChild size="sm" variant="secondary">
                            <Link href={`/inventory/products/${(b as any).product.id}/edit#batches`}>Manage batches</Link>
                          </Button>
                        ) : (
                          <span className="text-muted text-caption">—</span>
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
    </DashboardLayout>
  );
}
