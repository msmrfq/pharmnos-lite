import { Prisma } from "@prisma/client";
import type { customers } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class CustomerRepository extends BaseRepository<
  customers,
  Prisma.customersCreateInput,
  Prisma.customersUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "customers");
  }

  async getById(id: string, ctx: TenantContext): Promise<customers | null> {
    const t = this.withTenant(ctx);
    return this.prisma.customers.findUnique({ where: { id, tenant_id: t.tenantId } });
  }

  async getByCode(code: string, ctx: TenantContext): Promise<customers | null> {
    const t = this.withTenant(ctx);
    return this.prisma.customers.findUnique({
      where: { tenant_id_code: { tenant_id: t.tenantId, code } },
    });
  }

  async create(input: Prisma.customersCreateInput, ctx: TenantContext): Promise<customers> {
    const t = this.withTenant(ctx);
    return this.prisma.customers.create({
      data: { ...input, tenant_id: t.tenantId } as any,
    });
  }

  async update(
    id: string,
    input: Prisma.customersUpdateInput,
    ctx: TenantContext,
  ): Promise<customers> {
    const t = this.withTenant(ctx);
    return this.prisma.customers.update({ where: { id, tenant_id: t.tenantId }, data: input });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.customers.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<customers>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { business_name: "asc" }, search } = params;
    const where: Prisma.customersWhereInput = {
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
            { contact_person: { contains: search, mode: "insensitive" } },
          ],
        }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.customers.findMany({ where, skip, take, orderBy }),
      this.prisma.customers.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
