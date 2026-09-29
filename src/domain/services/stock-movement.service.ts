import { Prisma, StockMovementType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import type { TenantContext } from "@/lib/db/tenant-context";

export type StockInboundRequest = {
  product_id: string;
  batch_id?: string;
  batch_no?: string;
  batch?: {
    batch_no: string;
    expiry_date?: Date | null;
    mrp?: number | null;
    purchase_rate?: number | null;
    sale_rate?: number | null;
    supplier_id?: string | null;
    purchase_id?: string | null;
  };
  quantity: number;
  unit_rate?: number | null;
  movement_type: Extract<
    StockMovementType,
    "PURCHASE_IN" | "ADJUSTMENT_IN" | "SALES_RETURN_IN" | "OPENING_STOCK"
  >;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
};

export type StockOutboundRequest = {
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_rate?: number | null;
  movement_type: Extract<
    StockMovementType,
    "SALE_OUT" | "ADJUSTMENT_OUT" | "PURCHASE_RETURN_OUT"
  >;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
};

export type StockMovementResult = {
  movement_id: string;
  batch_id: string;
  delta_quantity: number;
  batch_available_after: number;
  product_id: string;
};

export type StockMovementManyResult = {
  movements: StockMovementResult[];
  batches_created: number;
  total_in: number;
  total_out: number;
};

export class StockMovementService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  private async ensureBatch(
    tenantId: string,
    req: StockInboundRequest,
    tx: PrismaClient,
  ): Promise<string> {
    if (req.batch_id) return req.batch_id;
    if (req.batch) {
      const existing = await tx.product_batches.findUnique({
        where: {
          tenant_id_product_id_batch_no: {
            tenant_id: tenantId,
            product_id: req.product_id,
            batch_no: req.batch.batch_no,
          },
        },
        select: { id: true },
      });
      if (existing) return existing.id;
      const created = await tx.product_batches.create({
        data: {
          tenant_id: tenantId,
          product_id: req.product_id,
          batch_no: req.batch.batch_no,
          expiry_date: req.batch.expiry_date ?? undefined,
          mrp: req.batch.mrp ?? undefined,
          purchase_rate: req.batch.purchase_rate ?? undefined,
          sale_rate: req.batch.sale_rate ?? undefined,
          supplier_id: req.batch.supplier_id ?? undefined,
          purchase_id: req.batch.purchase_id ?? undefined,
          received_qty: req.quantity,
          available_qty: req.quantity,
        },
        select: { id: true },
      });
      return created.id;
    }
    throw new Error("Inbound movement requires either batch_id or batch creation data.");
  }

  async recordInbound(
    req: StockInboundRequest,
    ctx: TenantContext,
  ): Promise<StockMovementResult> {
    const t = ctx as any;
    if (!t.tenantId) throw new Error("Tenant required.");
    return this.prisma.$transaction(async (tx: any) => {
      const batchId = await this.ensureBatch(t.tenantId, req, tx);
      const delta = Math.max(0, Math.round(req.quantity));

      const batchAfter = await tx.product_batches.update({
        where: { id: batchId, tenant_id: t.tenantId },
        data: {
          received_qty: { increment: delta },
          available_qty: { increment: delta },
        },
        select: { available_qty: true },
      });

      const movement = await tx.stock_movements.create({
        data: {
          tenant_id: t.tenantId,
          product_id: req.product_id,
          batch_id: batchId,
          movement_type: req.movement_type,
          quantity_delta: delta,
          unit_rate: req.unit_rate ?? undefined,
          reference_type: req.reference_type ?? undefined,
          reference_id: req.reference_id ?? undefined,
          notes: req.notes ?? undefined,
          created_by: t.userId ?? undefined,
        },
        select: { id: true },
      });

      return {
        movement_id: movement.id,
        batch_id: batchId,
        delta_quantity: delta,
        batch_available_after: Number(batchAfter.available_qty),
        product_id: req.product_id,
      };
    });
  }

  async recordOutbound(
    req: StockOutboundRequest,
    ctx: TenantContext,
  ): Promise<StockMovementResult> {
    const t = ctx as any;
    if (!t.tenantId) throw new Error("Tenant required.");
    if (req.quantity <= 0) throw new Error("Outbound quantity must be positive.");

    return this.prisma.$transaction(async (tx: any) => {
      const batch = await tx.product_batches.findUnique({
        where: { id: req.batch_id, tenant_id: t.tenantId },
        select: { available_qty: true, is_blocked: true, id: true, product_id: true },
      });
      if (!batch) throw new Error(`Batch not found: ${req.batch_id}`);
      if (batch.is_blocked) throw new Error(`Batch is blocked: ${req.batch_id}`);
      const delta = Math.round(req.quantity);
      if (Number(batch.available_qty) < delta) {
        throw new Error(
          `Insufficient stock on batch ${req.batch_id}: requested ${delta}, available ${batch.available_qty}`,
        );
      }

      const batchAfter = await tx.product_batches.update({
        where: { id: req.batch_id, tenant_id: t.tenantId },
        data: { available_qty: { decrement: delta } },
        select: { available_qty: true },
      });

      const movement = await tx.stock_movements.create({
        data: {
          tenant_id: t.tenantId,
          product_id: req.product_id,
          batch_id: req.batch_id,
          movement_type: req.movement_type,
          quantity_delta: -delta,
          unit_rate: req.unit_rate ?? undefined,
          reference_type: req.reference_type ?? undefined,
          reference_id: req.reference_id ?? undefined,
          notes: req.notes ?? undefined,
          created_by: t.userId ?? undefined,
        },
        select: { id: true },
      });

      return {
        movement_id: movement.id,
        batch_id: req.batch_id,
        delta_quantity: -delta,
        batch_available_after: Number(batchAfter.available_qty),
        product_id: req.product_id,
      };
    });
  }

  async recordMany(
    inbound: StockInboundRequest[],
    outbound: StockOutboundRequest[],
    ctx: TenantContext,
  ): Promise<StockMovementManyResult> {
    const results: StockMovementResult[] = [];
    let createdBatches = 0;
    let totalIn = 0;
    let totalOut = 0;
    for (const req of inbound) {
      const r = await this.recordInbound(req, ctx);
      results.push(r);
      totalIn += r.delta_quantity;
    }
    for (const req of outbound) {
      const r = await this.recordOutbound(req, ctx);
      results.push(r);
      totalOut += Math.abs(r.delta_quantity);
    }
    return { movements: results, batches_created: createdBatches, total_in: totalIn, total_out: totalOut };
  }

  async recordAdjustment(
    productId: string,
    batchId: string,
    newQuantity: number,
    reason: string,
    ctx: TenantContext,
  ): Promise<StockMovementResult> {
    const t = ctx as any;
    const current = await this.prisma.product_batches.findUnique({
      where: { id: batchId, tenant_id: t.tenantId },
      select: { available_qty: true, product_id: true },
    });
    if (!current) throw new Error(`Batch ${batchId} not found for this tenant.`);
    if (current.product_id !== productId) throw new Error("Product/batch mismatch.");
    const delta = newQuantity - Number(current.available_qty);
    if (delta > 0) {
      return this.recordInbound(
        {
          product_id: productId,
          batch_id: batchId,
          quantity: delta,
          movement_type: "ADJUSTMENT_IN",
          notes: reason,
        },
        ctx,
      );
    }
    return this.recordOutbound(
      {
        product_id: productId,
        batch_id: batchId,
        quantity: Math.abs(delta),
        movement_type: "ADJUSTMENT_OUT",
        notes: reason,
      },
      ctx,
    );
  }
}

export const stockMovementService = new StockMovementService();
