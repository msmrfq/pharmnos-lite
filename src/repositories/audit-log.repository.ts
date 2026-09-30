import { Prisma } from "@prisma/client";
import type { audit_logs, AuditEventType } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export type AuditLogListParams = ListParams & {
  eventType?: AuditEventType;
  userId?: string;
  startDate?: string;
  endDate?: string;
};

export class AuditLogRepository extends BaseRepository<
  audit_logs,
  Prisma.audit_logsCreateInput,
  Prisma.audit_logsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "audit_logs");
  }

  async getById(id: string, ctx: TenantContext): Promise<audit_logs | null> {
    const t = this.withTenant(ctx);
    return this.prisma.audit_logs.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: { actor: true },
    });
  }

  async create(
    input: Prisma.audit_logsCreateInput,
    ctx: TenantContext,
  ): Promise<audit_logs> {
    const t = this.withTenant(ctx);
    return this.prisma.audit_logs.create({
      data: { ...input, tenant_id: (input as any).tenant_id ?? t.tenantId, actor_id: (input as any).actor_id ?? t.userId },
    });
  }

  async update(
    _id: string,
    _input: Prisma.audit_logsUpdateInput,
    _ctx: TenantContext,
  ): Promise<audit_logs> {
    throw new Error("Audit logs are immutable.");
  }

  async delete(_id: string, _ctx: TenantContext): Promise<void> {
    throw new Error("Audit logs are immutable and cannot be deleted.");
  }

  async list(params: AuditLogListParams, ctx: TenantContext): Promise<PagedResult<audit_logs>> {
    const t = this.withTenant(ctx);
    const {
      skip = 0,
      take = 50,
      orderBy = { created_at: "desc" },
      search,
      eventType,
      userId,
      startDate,
      endDate,
    } = params;
    const where: Prisma.audit_logsWhereInput = {
      tenant_id: t.tenantId,
      ...(eventType ? { event_type: eventType } : {}),
      ...(userId ? { actor_id: userId } : {}),
      ...(startDate || endDate
        ? {
            created_at: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate + "T23:59:59.999Z") } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { target_type: { contains: search, mode: "insensitive" } },
              { target_id: { contains: search, mode: "insensitive" } },
              { ip_address: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rawItems, total] = await Promise.all([
      this.prisma.audit_logs.findMany({
        where,
        include: { actor: { select: { full_name: true, email: true } } },
        skip,
        take,
        orderBy,
      }),
      this.prisma.audit_logs.count({ where }),
    ]);
    const items: any = rawItems;
    if (search && !eventType && !userId && !startDate && !endDate) {
      const byActor = await this.prisma.audit_logs.findMany({
        where: {
          tenant_id: t.tenantId,
          actor: {
            OR: [
              { full_name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        include: { actor: { select: { full_name: true, email: true } } },
      });
      const seen = new Set(items.map((x: any) => x.id));
      for (const sf of byActor as any[]) if (!seen.has(sf.id)) items.push(sf);
    }
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
