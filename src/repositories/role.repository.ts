import { Prisma } from "@prisma/client";
import type { roles, role_permissions } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class RoleRepository extends BaseRepository<
  roles,
  Prisma.rolesCreateInput,
  Prisma.rolesUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "roles");
  }

  async getById(id: string, ctx: TenantContext): Promise<roles | null> {
    const t = this.withTenant(ctx);
    return this.prisma.roles.findUnique({ where: { id, tenant_id: t.tenantId } });
  }

  async getByName(name: string, ctx: TenantContext): Promise<roles | null> {
    const t = this.withTenant(ctx);
    return this.prisma.roles.findUnique({
      where: { tenant_id_name: { tenant_id: t.tenantId, name } },
    });
  }

  async create(input: Prisma.rolesCreateInput, ctx: TenantContext): Promise<roles> {
    const t = this.withTenant(ctx);
    return this.prisma.roles.create({
      data: { ...input, tenant_id: input.tenant_id ?? t.tenantId } as any,
    });
  }

  async update(id: string, input: Prisma.rolesUpdateInput, ctx: TenantContext): Promise<roles> {
    const t = this.withTenant(ctx);
    return this.prisma.roles.update({ where: { id, tenant_id: t.tenantId }, data: input });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.roles.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<roles>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { created_at: "desc" }, search } = params;
    const where: Prisma.rolesWhereInput = {
      tenant_id: t.tenantId,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.roles.findMany({ where, skip, take, orderBy }),
      this.prisma.roles.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listWithPermissions(
    ctx: TenantContext,
  ): Promise<Array<roles & { permissions: role_permissions[] }>> {
    const t = this.withTenant(ctx);
    return this.prisma.roles.findMany({
      where: { tenant_id: t.tenantId },
      include: { permissions: true },
      orderBy: { name: "asc" },
    });
  }
}

export class RolePermissionRepository extends BaseRepository<
  role_permissions,
  Prisma.role_permissionsCreateInput,
  Prisma.role_permissionsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "role_permissions");
  }

  async getById(id: string, _ctx: TenantContext): Promise<role_permissions | null> {
    return this.prisma.role_permissions.findUnique({ where: { id } });
  }

  async create(
    input: Prisma.role_permissionsCreateInput,
    _ctx: TenantContext,
  ): Promise<role_permissions> {
    return this.prisma.role_permissions.create({ data: input });
  }

  async update(
    id: string,
    input: Prisma.role_permissionsUpdateInput,
    _ctx: TenantContext,
  ): Promise<role_permissions> {
    return this.prisma.role_permissions.update({ where: { id }, data: input });
  }

  async delete(id: string, _ctx: TenantContext): Promise<void> {
    await this.prisma.role_permissions.delete({ where: { id } });
  }

  async list(params: ListParams, _ctx: TenantContext): Promise<PagedResult<role_permissions>> {
    const { skip = 0, take = 50, orderBy = { permission: "asc" } } = params;
    const [items, total] = await Promise.all([
      this.prisma.role_permissions.findMany({ skip, take, orderBy }),
      this.prisma.role_permissions.count(),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async deleteForRole(roleId: string): Promise<void> {
    await this.prisma.role_permissions.deleteMany({ where: { role_id: roleId } });
  }
}
