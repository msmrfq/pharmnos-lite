import { Prisma } from "@prisma/client";
import type { users } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";
import { tenantScoped } from "@/lib/db/tenant-context";

export class UserRepository extends BaseRepository<
  users,
  Prisma.usersCreateInput,
  Prisma.usersUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "users");
  }

  async getById(id: string, _ctx: TenantContext): Promise<users | null> {
    return this.prisma.users.findUnique({ where: { id } });
  }

  async getByEmail(email: string): Promise<users | null> {
    return this.prisma.users.findUnique({ where: { email } });
  }

  async getByExternalId(externalId: string): Promise<users | null> {
    return this.prisma.users.findUnique({ where: { external_id: externalId } });
  }

  async create(input: Prisma.usersCreateInput, _ctx: TenantContext): Promise<users> {
    return this.prisma.users.create({ data: input });
  }

  async update(id: string, input: Prisma.usersUpdateInput, _ctx: TenantContext): Promise<users> {
    return this.prisma.users.update({ where: { id }, data: input });
  }

  async delete(id: string, _ctx: TenantContext): Promise<void> {
    await this.prisma.users.delete({ where: { id } });
  }

  async list(
    params: ListParams,
    _ctx: TenantContext,
  ): Promise<PagedResult<users>> {
    const { skip = 0, take = 50, orderBy = { created_at: "desc" }, search } = params;
    const where: Prisma.usersWhereInput = search
      ? {
          OR: [
            { full_name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.users.findMany({ where, skip, take, orderBy }),
      this.prisma.users.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listForTenant(
    params: ListParams,
    ctx: TenantContext,
  ): Promise<PagedResult<users & { memberships?: any[] }>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { created_at: "desc" }, search } = params;
    const userWhere: Prisma.usersWhereInput = {
      memberships: { some: { tenant_id: t.tenantId } },
      ...(search
        ? {
            OR: [
              { full_name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.users.findMany({
        where: userWhere,
        include: { memberships: { where: { tenant_id: t.tenantId }, include: { role: true } } },
        skip,
        take,
        orderBy,
      }),
      this.prisma.users.count({ where: userWhere }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
