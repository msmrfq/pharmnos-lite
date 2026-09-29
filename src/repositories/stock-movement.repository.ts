import { Prisma } from "@prisma/client";
import type { stock_movements } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class StockMovementRepository extends BaseRepository<
  stock_movements,
  Prisma.stock_movementsCreateInput,
  Prisma.stock_movementsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "stock_movements");
  }

  async getById(id: string, ctx: TenantContext): Promise<stock_movements | null> {
    const t = this.withTenant(ctx);
    return this.prisma.stock_movements.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: { product: true, batch: true },
    });
  }

  async create(
    input: Prisma.stock_movementsCreateInput,
    ctx: TenantContext,
  ): Promise<stock_movements> {
    const t = this.withTenant(ctx);
    return this.prisma.stock_movements.create({
      data: {
        ...input,
        tenant_id: (input as any).tenant_id ?? t.tenantId,
        created_by: (input as any).created_by ?? t.userId,
      },
    });
  }

  async update(
    _id: string,
    _input: Prisma.stock_movementsUpdateInput,
    _ctx: TenantContext,
  ): Promise<stock_movements> {
    throw new Error("Stock movements are immutable. Create a reversing entry instead.");
  }

  async delete(_id: string, _ctx: TenantContext): Promise<void> {
    throw new Error("Stock movements are immutable and cannot be deleted.");
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<stock_movements>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { created_at: "desc" }, search } = params;
    const where: Prisma.stock_movementsWhereInput = {
      tenant_id: t.tenantId,
      ...(search
        ? {
            OR: [
              { reference_id: { contains: search, mode: "insensitive" } },
              { reference_type: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rawItems, total] = await Promise.all([
      this.prisma.stock_movements.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true } },
          batch: { select: { batch_no: true, expiry_date: true } },
        },
        skip,
        take,
        orderBy,
      }),
      this.prisma.stock_movements.count({ where }),
    ]);
    const items: any = rawItems;
    if (search) {
      const byProd = await this.prisma.stock_movements.findMany({
        where: {
          tenant_id: t.tenantId,
          product: { name: { contains: search, mode: "insensitive" } },
        },
        include: {
          product: { select: { name: true, sku: true } },
          batch: { select: { batch_no: true, expiry_date: true } },
        },
      });
      const seen = new Set(items.map((x: any) => x.id));
      for (const sf of byProd as any[]) if (!seen.has(sf.id)) items.push(sf);
    }
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listForBatch(
    batchId: string,
    ctx: TenantContext,
  ): Promise<Array<stock_movements & { product: any }>> {
    const t = this.withTenant(ctx);
    return this.prisma.stock_movements.findMany({
      where: { tenant_id: t.tenantId, batch_id: batchId },
      include: { product: { select: { name: true, sku: true } } },
      orderBy: { created_at: "asc" },
    }) as any;
  }

  async listForProduct(
    productId: string,
    ctx: TenantContext,
    limit: number = 100,
  ): Promise<Array<stock_movements & { product: any; batch: any }>> {
    const t = this.withTenant(ctx);
    return this.prisma.stock_movements.findMany({
      where: { tenant_id: t.tenantId, product_id: productId },
      include: {
        product: { select: { name: true } },
        batch: { select: { batch_no: true, expiry_date: true } },
      },
      take: limit,
      orderBy: { created_at: "desc" },
    }) as any;
  }
}
