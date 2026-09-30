import { Prisma } from "@prisma/client";
import type { suppliers } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class SupplierRepository extends BaseRepository<
  suppliers,
  Prisma.suppliersCreateInput,
  Prisma.suppliersUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "suppliers");
  }

  async getById(id: string, ctx: TenantContext): Promise<suppliers | null> {
    const t = this.withTenant(ctx);
    return this.prisma.suppliers.findUnique({ where: { id, tenant_id: t.tenantId } });
  }

  async getByCode(code: string, ctx: TenantContext): Promise<suppliers | null> {
    const t = this.withTenant(ctx);
    return this.prisma.suppliers.findUnique({
      where: { tenant_id_code: { tenant_id: t.tenantId, code } },
    });
  }

  async create(input: Prisma.suppliersCreateInput, ctx: TenantContext): Promise<suppliers> {
    const t = this.withTenant(ctx);
    return this.prisma.suppliers.create({
      data: { ...input, tenant_id: (input as any).tenant_id ?? t.tenantId },
    });
  }

  async update(
    id: string,
    input: Prisma.suppliersUpdateInput,
    ctx: TenantContext,
  ): Promise<suppliers> {
    const t = this.withTenant(ctx);
    return this.prisma.suppliers.update({ where: { id, tenant_id: t.tenantId }, data: input });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.suppliers.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams & { state?: string; minPayable?: number }, ctx: TenantContext): Promise<PagedResult<suppliers>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { business_name: "asc" }, search, state, minPayable } = params;
    const where: Prisma.suppliersWhereInput = {
      tenant_id: t.tenantId,
      ...(search
        ? {
            OR: [
              { business_name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { gstin: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { mobile: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { drug_license_no: { contains: search, mode: "insensitive" } },
              { contact_person: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(state ? { state: { equals: state, mode: "insensitive" as Prisma.QueryMode } } : {}),
      ...(minPayable !== undefined ? { payable_balance: { gte: minPayable as unknown as Prisma.Decimal } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.suppliers.findMany({ where, skip, take, orderBy }),
      this.prisma.suppliers.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
