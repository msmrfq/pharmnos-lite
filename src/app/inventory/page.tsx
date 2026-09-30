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
import { Warehouse, AlertTriangle, Plus, Clock, FileSpreadsheet, Filter, ChevronLeft, ChevronRight, Download, RefreshCcw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { repos } from "@/repositories";
import { isPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { ScheduleClass, StockMovementType } from "@prisma/client";
import ExportCsvButton from "@/components/ui/export-csv-button";
import { exportInventoryCsvAction } from "@/app/_actions/exports.actions";
import { deleteProductAction } from "@/app/_actions/masters.actions";
import MasterActionsCell from "@/components/ui/master-actions-cell";
import SuccessCreatedToast from "@/components/toast/creation-success-toast";
import StockAdjustmentDialog from "./_stock-adjustment-dialog";

export const metadata: Metadata = {
  title: "Inventory",
};

const rupee = (n: number | null | undefined | string) => {
  const num = typeof n === "string" ? Number(n) : Number(n ?? 0);
  if (!Number.isFinite(num)) return "—";
  return `₹ ${num.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

const scheduleLabel = (sc: ScheduleClass | null | undefined): string => {
  if (!sc) return "—";
  switch (sc) {
    case ScheduleClass.SCHEDULE_H:
      return "Schedule H";
    case ScheduleClass.SCHEDULE_H1:
      return "Schedule H1";
    case ScheduleClass.SCHEDULE_X:
      return "Schedule X";
    default:
      return sc;
  }
};

type ProductWithBatches = {
  id: string;
  sku: string | null;
  name: string;
  schedule_classification: ScheduleClass | null;
  hsn_code: string | null;
  mrp: any;
  standard_sale_rate: any;
  pack_size: string | null;
  reorder_level: number;
  batches: Array<{
    id: string;
    batch_no: string;
    expiry_date: Date;
    available_qty: number;
  }>;
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { page?: string; tab?: string; created?: string; updated?: string; deleted?: string };
}) {
  const pageRaw = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = 25;
  const tabValue = searchParams?.tab ?? "products";

  let items: ProductWithBatches[] = [];
  let total = 0;
  let summaryLowStock = 0;
  let summaryActiveProducts = 0;
  let summaryActiveBatches = 0;
  let summaryNearExpiry = 0;
  let batchItems: any[] = [];
  let batchTotal = 0;
  let movementItems: any[] = [];
  let movementTotal = 0;
  let dbOk = isPostgresConfigured();

  if (dbOk) {
    try {
      const ctx = await requireServerTenantContext();
      // Session ctx wired. Demo fallback active when no Supabase auth session exists or DB membership missing.
      const [result, allCount, batchesResult, movementsResult] = await Promise.all([
        repos.products.list({ skip: (page - 1) * pageSize, take: pageSize, orderBy: { name: "asc" } }, ctx),
        repos.products.list({ take: 10000 }, ctx),
        repos.productBatches.list({ skip: 0, take: 50, orderBy: { expiry_date: "asc" } }, ctx),
        repos.stockMovements.list({ skip: 0, take: 50, orderBy: { created_at: "desc" } }, ctx),
      ]);
      items = (result.items as unknown) as ProductWithBatches[];
      total = result.total;

      summaryActiveProducts = allCount.total;

      let bTotal = 0;
      let lowCount = 0;
      let nearExpiryCount = 0;
      const nowCutoff = new Date();
      nowCutoff.setDate(nowCutoff.getDate() + 60);
      for (const p of (allCount.items as unknown) as ProductWithBatches[]) {
        const avail = p.batches.reduce((s, b) => s + (Number(b.available_qty ?? 0)), 0);
        bTotal += p.batches.length;
        if (avail <= (Number((p as any).reorder_level ?? 0) || 10)) lowCount += 1;
        if (p.batches.length && p.batches.some((b) => b.expiry_date && b.expiry_date.getTime() <= nowCutoff.getTime() && Number(b.available_qty ?? 0) > 0)) {
          nearExpiryCount += 1;
        }
      }
      summaryActiveBatches = bTotal;
      summaryLowStock = lowCount;
      summaryNearExpiry = nearExpiryCount;

      batchItems = batchesResult.items ?? [];
      batchTotal = batchesResult.total;
      movementItems = movementsResult.items ?? [];
      movementTotal = movementsResult.total;
    } catch (_err) {
      dbOk = false;
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const summary = [
    { label: "Active products", value: String(summaryActiveProducts), variant: "default" as const, icon: FileSpreadsheet, href: "/inventory" },
    { label: "Active batches", value: String(summaryActiveBatches), variant: "default" as const, icon: Warehouse, href: "/inventory" },
    { label: "Low stock", value: String(summaryLowStock), variant: "destructive" as const, icon: AlertTriangle, href: "/inventory/low-stock" },
    { label: "Near expiry (60d)", value: String(summaryNearExpiry), variant: "badge-orange" as const, icon: Clock, href: "/inventory/near-expiry" },
  ];

  return (
    <DashboardLayout>
      <SuccessCreatedToast
        entityLabel="Product"
        createdId={searchParams?.created ?? undefined}
        updatedId={searchParams?.updated ?? undefined}
        deletedId={searchParams?.deleted ?? undefined}
      />
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-0 pb-5">
        <div>
          <CardTitle className="text-display-sm tracking-brand">Inventory</CardTitle>
          <p className="mt-1 text-body-md text-body">
            Browse products, track batches, monitor low stock and near-expiry items.
          </p>
          {!dbOk && (
            <p className="mt-2 text-caption text-destructive">
              Database is not configured — showing empty grid. Go to Dashboard for setup instructions.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <ExportCsvButton variant="secondary" action={exportInventoryCsvAction}>
            <Download className="h-4 w-4" /> Export
          </ExportCsvButton>
          <Button asChild>
            <Link href="/inventory/products/new">
              <Plus className="h-4 w-4" /> Add product
            </Link>
          </Button>
        </div>
      </CardHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {summary.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="block transition-none hover:ring-1 hover:ring-ink/10 rounded-lg"
            >
              <CardCanvas>
                <CardContent className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-caption font-medium uppercase tracking-wide text-muted">
                      {s.label}
                    </p>
                    <p className="mt-1 text-display-sm font-display tracking-brand text-ink">
                      {s.value}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-card border border-hairline text-ink">
                    <Icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </CardCanvas>
            </Link>
          );
        })}
      </div>

      <Tabs defaultValue={tabValue === "products" || tabValue === "batches" || tabValue === "movements" || tabValue === "low-stock" || tabValue === "near-expiry" ? tabValue : "products"}>
        <TabsList className="mb-5">
          <TabsTrigger value="products" asChild>
            <Link href="/inventory?tab=products">Products</Link>
          </TabsTrigger>
          <TabsTrigger value="batches" asChild>
            <Link href="/inventory?tab=batches">Batches</Link>
          </TabsTrigger>
          <TabsTrigger value="movements" asChild>
            <Link href="/inventory?tab=movements">Movements</Link>
          </TabsTrigger>
          <TabsTrigger value="low-stock" asChild>
            <Link href="/inventory/low-stock">Low stock</Link>
          </TabsTrigger>
          <TabsTrigger value="near-expiry" asChild>
            <Link href="/inventory/near-expiry">Near expiry</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">PTR</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>FEFO expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Adjust</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-10 text-center text-muted text-body-md">
                        No products yet.{" "}
                        <Link href="/inventory/products/new" className="text-ink font-medium underline underline-offset-4 hover:no-underline">
                          Create your first product
                        </Link>
                      </TableCell>
                    </TableRow>
                  ) : !dbOk ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-10 text-center text-muted text-body-md">
                        Showing placeholder rows until database is connected.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((p) => {
                      const availableQty = p.batches.reduce((s, b) => s + Number(b.available_qty ?? 0), 0);
                      const lowStockThreshold = Number((p as any).reorder_level ?? 0) || 10;
                      const isLow = availableQty <= lowStockThreshold;
                      const fefoBatch = p.batches.find((b) => Number(b.available_qty ?? 0) > 0);
                      const fefoDate = fefoBatch?.expiry_date
                        ? new Date(fefoBatch.expiry_date)
                        : null;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs text-muted">{p.sku ?? "—"}</TableCell>
                          <TableCell className="font-medium text-ink">
                            <Link
                              href={`/inventory/products/${p.id}`}
                              className="hover:underline"
                            >
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-body">{scheduleLabel(p.schedule_classification)}</TableCell>
                          <TableCell className="text-body font-mono text-xs">{p.hsn_code ?? "—"}</TableCell>
                          <TableCell className="text-right text-body">{rupee(p.mrp)}</TableCell>
                          <TableCell className="text-right text-body">{rupee(p.standard_sale_rate)}</TableCell>
                          <TableCell className="text-body">{p.pack_size ?? "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${isLow ? "text-destructive" : "text-ink"}`}>
                            {availableQty}
                          </TableCell>
                          <TableCell className="text-body">
                            {fefoDate && !Number.isNaN(fefoDate.getTime()) ? (
                              <time dateTime={fefoDate.toISOString()}>
                                {fefoDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                              </time>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isLow ? "destructive" : "success"}>
                              {isLow ? "Low stock" : "In stock"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {dbOk && p.batches.length > 0 && (
                              <StockAdjustmentDialog product={p} trigger={
                                <Button size="sm" variant="secondary" type="button">
                                  <RefreshCcw className="h-4 w-4" /> Adjust
                                </Button>
                              } />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {dbOk && (
                              <MasterActionsCell
                                entityId={p.id}
                                entityLabel="Product"
                                editHref={`/inventory/products/${p.id}/edit`}
                                deleteAction={deleteProductAction}
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
              Showing {dbOk ? Math.min(items.length, total) : 0} of {total} products · Page {page} / {totalPages}
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
                <Link href={page <= 1 ? "/inventory" : `/inventory?page=${page - 1}${tabValue !== "products" ? `&tab=${tabValue}` : ""}`}>
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
                <Link href={`/inventory?page=${page + 1}${tabValue !== "products" ? `&tab=${tabValue}` : ""}`}>
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="batches">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch no.</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Expiry</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && batchItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted text-body-md">
                        No batches yet. Create a purchase invoice to receive stock into batches.
                      </TableCell>
                    </TableRow>
                  ) : !dbOk ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted text-body-md">
                        Empty grid — connect database to see batches.
                      </TableCell>
                    </TableRow>
                  ) : (
                    batchItems.map((b: any) => {
                      const avail = Number(b.available_qty ?? 0);
                      const received = Number(b.received_qty ?? 0);
                      const exp = b.expiry_date ? new Date(b.expiry_date) : null;
                      const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                      const variant: any = b.is_blocked ? "secondary" : daysLeft <= 0 ? "destructive" : daysLeft <= 90 ? "warning" : "success";
                      const expStr = exp ? exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                      return (
                        <TableRow key={b.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{b.batch_no}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-ink">
                            {(b as any).product?.name ?? "—"}
                            <p className="text-caption text-muted font-mono">{(b as any).product?.sku ?? "—"}</p>
                          </TableCell>
                          <TableCell className="text-right text-body">{expStr}</TableCell>
                          <TableCell className="text-right text-body">{received}</TableCell>
                          <TableCell className={`text-right font-semibold ${avail <= 0 ? "text-destructive" : "text-ink"}`}>{avail}</TableCell>
                          <TableCell>
                            <Badge variant={variant}>
                              {b.is_blocked ? "Blocked" : daysLeft <= 0 ? "Expired" : daysLeft <= 90 ? `Expiring ${daysLeft}d` : "Active"}
                            </Badge>
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
              Showing {dbOk ? Math.min(batchItems.length, batchTotal) : 0} of {batchTotal} batches
            </p>
          </div>
        </TabsContent>

        <TabsContent value="movements">
          <CardCanvas>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Qty Δ</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dbOk && movementItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted text-body-md">
                        No stock movements yet. Finalize purchases or adjust stock to create movement rows.
                      </TableCell>
                    </TableRow>
                  ) : !dbOk ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted text-body-md">
                        Empty grid — connect database to see movements.
                      </TableCell>
                    </TableRow>
                  ) : (
                    movementItems.map((m: any) => {
                      const delta = Number(m.delta_qty ?? 0);
                      const d = m.created_at ? new Date(m.created_at) : null;
                      const dateStr = d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                      const mt = m.movement_type as StockMovementType;
                      const typeLabel: Record<string, string> = {
                        PURCHASE_IN: "Purchase in",
                        SALE_OUT: "Sale out",
                        ADJUSTMENT_IN: "Adjust +",
                        ADJUSTMENT_OUT: "Adjust -",
                        WRITE_OFF: "Write off",
                        RETURN_IN: "Return in",
                        TRANSFER_IN: "Transfer in",
                        TRANSFER_OUT: "Transfer out",
                      };
                      const typeVariant: Record<string, any> = {
                        PURCHASE_IN: "success",
                        SALE_OUT: "destructive",
                        ADJUSTMENT_IN: "success",
                        ADJUSTMENT_OUT: "destructive",
                        WRITE_OFF: "destructive",
                        RETURN_IN: "success",
                        TRANSFER_IN: "secondary",
                        TRANSFER_OUT: "secondary",
                      };
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-body text-caption">{dateStr}</TableCell>
                          <TableCell>
                            <Badge variant={typeVariant[mt] ?? "secondary"}>{typeLabel[mt] ?? mt}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-ink">
                            {(m as any).product?.name ?? "—"}
                            <p className="text-caption text-muted font-mono">{(m as any).product?.sku ?? "—"}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{(m as any).batch?.batch_no ?? "—"}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {delta >= 0 ? `+${delta}` : delta}
                          </TableCell>
                          <TableCell className="text-body text-caption font-mono">{m.reference_type ?? "—"}{m.reference_id ? ` #${m.reference_id.slice(0, 8)}` : ""}</TableCell>
                          <TableCell className="text-body text-muted">{m.notes ?? "—"}</TableCell>
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
              Showing {dbOk ? Math.min(movementItems.length, movementTotal) : 0} of {movementTotal} movements · newest first
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
