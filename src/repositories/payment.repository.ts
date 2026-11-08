import { Prisma } from "@prisma/client";
import type { payments } from "@prisma/client";
import { BaseRepository, type ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class PaymentRepository extends BaseRepository<
  payments,
  Prisma.paymentsCreateInput,
  Prisma.paymentsUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "payments");
  }

  async getById(id: string, ctx: TenantContext): Promise<payments | null> {
    const t = this.withTenant(ctx);
    return this.prisma.payments.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: { customer: true, supplier: true, invoice: true },
    });
  }

  async create(input: Prisma.paymentsCreateInput, ctx: TenantContext): Promise<payments> {
    const t = this.withTenant(ctx);
    return this.prisma.payments.create({
      data: {
        ...input,
        tenant_id: t.tenantId,
        created_by: t.userId,
      } as any,
    });
  }

  async update(
    _id: string,
    _input: Prisma.paymentsUpdateInput,
    _ctx: TenantContext,
  ): Promise<payments> {
    throw new Error("Payments are immutable; create a reversal instead.");
  }

  async delete(_id: string, _ctx: TenantContext): Promise<void> {
    throw new Error("Payments are immutable; create a reversal instead.");
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<payments>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { payment_date: "desc" }, search } = params;
    const where: Prisma.paymentsWhereInput = {
      tenant_id: t.tenantId,
      ...(search
        ? {
          OR: [
            { reference_no: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
          ],
        }
        : {}),
    };
    const [rawItems, total] = await Promise.all([
      this.prisma.payments.findMany({
        where,
        include: { customer: true, supplier: true, invoice: true },
        skip,
        take,
        orderBy,
      }),
      this.prisma.payments.count({ where }),
    ]);
    const items: any = rawItems;
    if (search) {
      const byCust = await this.prisma.payments.findMany({
        where: {
          tenant_id: t.tenantId,
          customer: { business_name: { contains: search, mode: "insensitive" } },
        },
        include: { customer: true, supplier: true, invoice: true },
      });
      const seen = new Set(items.map((x: any) => x.id));
      for (const sf of byCust as any[]) if (!seen.has(sf.id)) items.push(sf);
    }
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async getNextReceiptNo(prefix: string, ctx: TenantContext): Promise<string> {
    const t = this.withTenant(ctx);
    const count = await this.prisma.payments.count({ where: { tenant_id: t.tenantId } });
    return `${prefix}-${String(count + 1).padStart(5, "0")}`;
  }
}
