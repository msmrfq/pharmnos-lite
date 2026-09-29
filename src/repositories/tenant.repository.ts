import { Prisma } from "@prisma/client";
import type { tenants } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class TenantRepository extends BaseRepository<
  tenants,
  Prisma.tenantsCreateInput,
  Prisma.tenantsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "tenants");
  }

  async getById(id: string, _ctx: TenantContext): Promise<tenants | null> {
    return this.prisma.tenants.findUnique({ where: { id } });
  }

  async getBySlug(slug: string): Promise<tenants | null> {
    return this.prisma.tenants.findUnique({ where: { slug } });
  }

  async create(input: Prisma.tenantsCreateInput, _ctx: TenantContext): Promise<tenants> {
    return this.prisma.tenants.create({ data: input });
  }

  async update(id: string, input: Prisma.tenantsUpdateInput, _ctx: TenantContext): Promise<tenants> {
    return this.prisma.tenants.update({ where: { id }, data: input });
  }

  async delete(id: string, _ctx: TenantContext): Promise<void> {
    await this.prisma.tenants.delete({ where: { id } });
  }

  async list(
    params: ListParams,
    _ctx: TenantContext,
  ): Promise<PagedResult<tenants>> {
    const { skip = 0, take = 50, orderBy = { created_at: "desc" }, search } = params;
    const where: Prisma.tenantsWhereInput = search
      ? {
          OR: [
            { business_name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.tenants.findMany({ where, skip, take, orderBy }),
      this.prisma.tenants.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
