import { Prisma } from "@prisma/client";
import type { memberships } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class MembershipRepository extends BaseRepository<
  memberships,
  Prisma.membershipsCreateInput,
  Prisma.membershipsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "memberships");
  }

  async getById(id: string, ctx: TenantContext): Promise<memberships | null> {
    const t = this.withTenant(ctx);
    return this.prisma.memberships.findUnique({ where: { id, tenant_id: t.tenantId } });
  }

  async getByUser(
    userId: string,
    ctx: TenantContext,
  ): Promise<(memberships & { role: { name: string; permissions?: any } }) | null> {
    const t = this.withTenant(ctx);
    return this.prisma.memberships.findUnique({
      where: { tenant_id_user_id: { tenant_id: t.tenantId, user_id: userId } },
      include: { role: { include: { permissions: true } } },
    });
  }

  async listForUser(userId: string): Promise<Array<memberships & { tenant: any; role: any }>> {
    return this.prisma.memberships.findMany({
      where: { user_id: userId },
      include: { tenant: true, role: true },
    });
  }

  async create(
    input: Prisma.membershipsCreateInput,
    ctx: TenantContext,
  ): Promise<memberships> {
    const t = this.withTenant(ctx);
    return this.prisma.memberships.create({
      data: { ...input, tenant_id: t.tenantId } as any,
    });
  }

  async update(
    id: string,
    input: Prisma.membershipsUpdateInput,
    ctx: TenantContext,
  ): Promise<memberships> {
    const t = this.withTenant(ctx);
    return this.prisma.memberships.update({ where: { id, tenant_id: t.tenantId }, data: input });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.memberships.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<memberships>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { created_at: "desc" } } = params;
    const where: Prisma.membershipsWhereInput = { tenant_id: t.tenantId };
    const [items, total] = await Promise.all([
      this.prisma.memberships.findMany({
        where,
        include: { user: true, role: true },
        skip,
        take,
        orderBy,
      }),
      this.prisma.memberships.count({ where }),
    ]);
    return { items: items as any, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
