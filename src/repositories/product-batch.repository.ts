import { Prisma } from "@prisma/client";
import type { product_batches } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class ProductBatchRepository extends BaseRepository<
  product_batches,
  Prisma.product_batchesCreateInput,
  Prisma.product_batchesUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "product_batches");
  }

  async getById(id: string, ctx: TenantContext): Promise<product_batches | null> {
    const t = this.withTenant(ctx);
    return this.prisma.product_batches.findUnique({ where: { id, tenant_id: t.tenantId } });
  }

  async getByBatchKey(
    productId: string,
    batchNo: string,
    ctx: TenantContext,
  ): Promise<product_batches | null> {
    const t = this.withTenant(ctx);
    return this.prisma.product_batches.findUnique({
      where: {
        tenant_id_product_id_batch_no: {
          tenant_id: t.tenantId,
          product_id: productId,
          batch_no: batchNo,
        },
      },
    });
  }

  async create(
    input: Prisma.product_batchesCreateInput,
    ctx: TenantContext,
  ): Promise<product_batches> {
    const t = this.withTenant(ctx);
    return this.prisma.product_batches.create({
      data: { ...input, tenant_id: t.tenantId } as any,
    });
  }

  async update(
    id: string,
    input: Prisma.product_batchesUpdateInput,
    ctx: TenantContext,
  ): Promise<product_batches> {
    const t = this.withTenant(ctx);
    return this.prisma.product_batches.update({
      where: { id, tenant_id: t.tenantId },
      data: input,
    });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.product_batches.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<product_batches>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { expiry_date: "asc" }, search } = params;
    const where: Prisma.product_batchesWhereInput = {
      tenant_id: t.tenantId,
      ...(search
        ? {
          OR: [
            { batch_no: { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.product_batches.findMany({
        where,
        include: { product: { select: { name: true, sku: true } } },
        skip,
        take,
        orderBy,
      }),
      this.prisma.product_batches.count({ where }),
    ]);
    return { items: items as any, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listForProduct(
    productId: string,
    ctx: TenantContext,
    includeBlocked = false,
  ): Promise<product_batches[]> {
    const t = this.withTenant(ctx);
    return this.prisma.product_batches.findMany({
      where: {
        tenant_id: t.tenantId,
        product_id: productId,
        ...(includeBlocked ? {} : { is_blocked: false }),
      },
      orderBy: { expiry_date: "asc" },
    });
  }

  async listFefoCandidates(
    productId: string,
    ctx: TenantContext,
    asOfDate: Date = new Date(),
  ): Promise<Array<product_batches>> {
    const t = this.withTenant(ctx);
    return this.prisma.product_batches.findMany({
      where: {
        tenant_id: t.tenantId,
        product_id: productId,
        is_blocked: false,
        available_qty: { gt: 0 },
      },
      orderBy: [{ expiry_date: "asc" }, { created_at: "asc" }],
    });
  }

  async listNearExpiry(
    ctx: TenantContext,
    windowDays: number = 60,
  ): Promise<Array<product_batches & { product: any }>> {
    const t = this.withTenant(ctx);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + windowDays);
    return this.prisma.product_batches.findMany({
      where: {
        tenant_id: t.tenantId,
        is_blocked: false,
        available_qty: { gt: 0 },
        expiry_date: { lte: cutoff },
      },
      include: { product: { select: { name: true, sku: true, schedule_classification: true } } },
      orderBy: [{ expiry_date: "asc" }, { available_qty: "desc" }],
    }) as any;
  }

  async stockValuation(ctx: TenantContext, nearExpiryDays: number = 60) {
    const t = this.withTenant(ctx);
    const nearCutoff = new Date();
    nearCutoff.setDate(nearCutoff.getDate() + nearExpiryDays);
    const batches = await this.prisma.product_batches.findMany({
      where: { tenant_id: t.tenantId, is_blocked: false },
      select: {
        product_id: true,
        available_qty: true,
        received_qty: true,
        purchase_rate: true,
        expiry_date: true,
      },
    });
    let total_value_inr = 0;
    let near_expiry_60d_value = 0;
    const skuSeen = new Set<string>();
    let batches_count = 0;
    for (const b of batches) {
      const rate = Number(b.purchase_rate ?? 0);
      const avail = Number(b.available_qty ?? 0);
      const lineValue = avail * rate;
      total_value_inr += lineValue;
      batches_count += 1;
      if (b.product_id) skuSeen.add(b.product_id);
      if (b.expiry_date && b.expiry_date <= nearCutoff && avail > 0) {
        near_expiry_60d_value += lineValue;
      }
    }
    return {
      total_value_inr,
      sku_count: skuSeen.size,
      batches_count,
      near_expiry_60d_value,
    };
  }
}
