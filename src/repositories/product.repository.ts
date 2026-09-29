import { Prisma } from "@prisma/client";
import type { products } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class ProductRepository extends BaseRepository<
  products,
  Prisma.productsCreateInput,
  Prisma.productsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "products");
  }

  async getById(id: string, ctx: TenantContext): Promise<products | null> {
    const t = this.withTenant(ctx);
    return this.prisma.products.findUnique({ where: { id, tenant_id: t.tenantId } });
  }

  async getBySku(sku: string, ctx: TenantContext): Promise<products | null> {
    const t = this.withTenant(ctx);
    return this.prisma.products.findUnique({
      where: { tenant_id_sku: { tenant_id: t.tenantId, sku } },
    });
  }

  async create(input: Prisma.productsCreateInput, ctx: TenantContext): Promise<products> {
    const t = this.withTenant(ctx);
    return this.prisma.products.create({
      data: { ...input, tenant_id: (input as any).tenant_id ?? t.tenantId, created_by: t.userId },
    });
  }

  async update(
    id: string,
    input: Prisma.productsUpdateInput,
    ctx: TenantContext,
  ): Promise<products> {
    const t = this.withTenant(ctx);
    return this.prisma.products.update({ where: { id, tenant_id: t.tenantId }, data: input });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.products.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<products>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { name: "asc" }, search } = params;
    const where: Prisma.productsWhereInput = {
      tenant_id: t.tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { generic_name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { hsn_code: { contains: search, mode: "insensitive" } },
              { manufacturer: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        include: {
          batches: {
            where: { available_qty: { gt: 0 } },
            orderBy: { expiry_date: "asc" },
            take: 3,
          },
        },
        skip,
        take,
        orderBy,
      }),
      this.prisma.products.count({ where }),
    ]);
    return { items: items as any, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listLowStock(
    params: ListParams,
    ctx: TenantContext,
  ): Promise<PagedResult<products & { batches: any; total_available: number }>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { name: "asc" } } = params;
    const items: any = await this.prisma.products.findMany({
      where: { tenant_id: t.tenantId, is_active: true },
      include: {
        batches: {
          where: { is_blocked: false },
          select: { available_qty: true, expiry_date: true, batch_no: true },
          orderBy: { expiry_date: "asc" },
        },
      },
      skip,
      take,
      orderBy,
    });
    const withAgg = items
      .map((p: any) => ({
        ...p,
        total_available: p.batches.reduce((sum: number, b: any) => sum + (b.available_qty ?? 0), 0),
      }))
      .filter((p: any) => p.total_available <= (p.reorder_level ?? 10));
    return {
      items: withAgg,
      total: withAgg.length,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }
}
