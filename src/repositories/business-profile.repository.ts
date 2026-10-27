import { Prisma } from "@prisma/client";
import type { business_profiles } from "@prisma/client";
import { BaseRepository, type ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";
import { businessProfileStateSchema } from "@/lib/validation/tenant.schemas";

function normalizeBusinessProfileState(input: Record<string, any>): Record<string, any> {
  if (!Object.prototype.hasOwnProperty.call(input, "state") || input.state === null) {
    return input;
  }
  if (typeof input.state !== "string") {
    throw new Error("Business profile state must be a supported Indian state or union-territory name/code.");
  }
  return { ...input, state: businessProfileStateSchema.parse(input.state) };
}

export class BusinessProfileRepository extends BaseRepository<
  business_profiles,
  Prisma.business_profilesCreateInput,
  Prisma.business_profilesUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "business_profiles");
  }

  async getById(id: string, ctx: TenantContext): Promise<business_profiles | null> {
    const t = this.withTenant(ctx);
    return this.prisma.business_profiles.findUnique({
      where: { id, tenant_id: t.tenantId },
    });
  }

  async getForTenant(ctx: TenantContext): Promise<business_profiles | null> {
    const t = this.withTenant(ctx);
    return this.prisma.business_profiles.findUnique({ where: { tenant_id: t.tenantId } });
  }

  async create(
    input: Prisma.business_profilesCreateInput,
    ctx: TenantContext,
  ): Promise<business_profiles> {
    const t = this.withTenant(ctx);
    return this.prisma.business_profiles.create({
      data: { ...normalizeBusinessProfileState(input as any), tenant_id: t.tenantId } as any,
    });
  }

  async update(
    id: string,
    input: Prisma.business_profilesUpdateInput,
    ctx: TenantContext,
  ): Promise<business_profiles> {
    const t = this.withTenant(ctx);
    return this.prisma.business_profiles.update({
      where: { id, tenant_id: t.tenantId },
      data: normalizeBusinessProfileState(input as any) as any,
    });
  }

  async upsertForTenant(
    input: Prisma.business_profilesUpdateInput,
    ctx: TenantContext,
  ): Promise<business_profiles> {
    const t = this.withTenant(ctx);
    const normalizedInput = normalizeBusinessProfileState(input as any);
    return this.prisma.business_profiles.upsert({
      where: { tenant_id: t.tenantId },
      create: { ...normalizedInput, tenant_id: t.tenantId } as any,
      update: normalizedInput as any,
    });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.business_profiles.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, _ctx: TenantContext): Promise<PagedResult<business_profiles>> {
    const { skip = 0, take = 50, orderBy = { created_at: "desc" } } = params;
    const [items, total] = await Promise.all([
      this.prisma.business_profiles.findMany({ skip, take, orderBy }),
      this.prisma.business_profiles.count(),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
