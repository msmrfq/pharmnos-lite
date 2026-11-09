import { Prisma } from "@prisma/client";
import type { sales_invoices } from "@prisma/client";
import { BaseRepository, type ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export type SalesInvoiceListParams = ListParams & {
  customerId?: string;
};

function requestedDateGuard(
  input: Prisma.sales_invoicesUpdateInput,
  field: "due_date" | "due_date_business",
): { present: false } | { present: true; value: Date | null } {
  const rawValue = (input as Record<string, unknown>)[field];
  if (!Object.prototype.hasOwnProperty.call(input, field) || rawValue === undefined) {
    return { present: false };
  }

  const value: Date | null | string | undefined = rawValue instanceof Date || rawValue === null || typeof rawValue === "string"
    ? rawValue
    : typeof rawValue === "object" && rawValue !== null && "set" in rawValue
      ? (rawValue as { set?: Date | string | null }).set
      : undefined;

  if (value === undefined) {
    throw new Error(`Sales invoice ${field} updates must use a concrete date or null.`);
  }
  if (value === null) return { present: true, value: null };
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Sales invoice ${field} updates must use a valid date or null.`);
  }
  return { present: true, value: date };
}

export class SalesInvoiceRepository extends BaseRepository<
  sales_invoices,
  Prisma.sales_invoicesCreateInput,
  Prisma.sales_invoicesUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "sales_invoices");
  }

  async getById(id: string, ctx: TenantContext): Promise<sales_invoices | null> {
    const t = this.withTenant(ctx);
    return this.prisma.sales_invoices.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: {
        customer: true,
        items: { include: { product: true, batch: true } },
      },
    });
  }

  async getByInvoiceNo(invoiceNo: string, ctx: TenantContext): Promise<sales_invoices | null> {
    const t = this.withTenant(ctx);
    return this.prisma.sales_invoices.findUnique({
      where: { tenant_id_invoice_no: { tenant_id: t.tenantId, invoice_no: invoiceNo } },
    });
  }

  async create(
    input: Prisma.sales_invoicesCreateInput,
    ctx: TenantContext,
  ): Promise<sales_invoices> {
    const t = this.withTenant(ctx);
    return this.prisma.sales_invoices.create({
      data: {
        ...input,
        tenant_id: t.tenantId,
        created_by: (input as any).created_by ?? t.userId,
      } as any,
    });
  }

  async update(
    id: string,
    input: Prisma.sales_invoicesUpdateInput,
    ctx: TenantContext,
  ): Promise<sales_invoices> {
    const t = this.withTenant(ctx);
    const dueDate = requestedDateGuard(input, "due_date");
    const dueDateBusiness = requestedDateGuard(input, "due_date_business");
    const status = input.status;
    const finalizes = status === "FINALIZED" ||
      (typeof status === "object" && status !== null && "set" in status && status.set === "FINALIZED");
    const changesStatus = status !== undefined;
    if (dueDate.present || dueDateBusiness.present || (changesStatus && !finalizes)) {
      const additionalConditions = [
        ...(changesStatus && !finalizes ? [{ status: { not: "FINALIZED" as const } }] : []),
        ...(dueDate.present && finalizes ? [{ due_date: dueDate.value }] : []),
        ...(dueDateBusiness.present
          ? [
            {
              OR: [
                { status: { not: "FINALIZED" as const } },
                { due_date_business: dueDateBusiness.value },
              ],
            },
            ...(finalizes ? [{ due_date_business: dueDateBusiness.value }] : []),
          ]
          : []),
      ];
      return this.prisma.sales_invoices.update({
        // This conditional protects repository updates only, not direct Prisma or SQL writes.
        where: {
          id,
          tenant_id: t.tenantId,
          ...(dueDate.present
            ? {
              OR: [
                { status: { not: "FINALIZED" as const } },
                { due_date: dueDate.value },
              ],
            }
            : {}),
          ...(additionalConditions.length ? { AND: additionalConditions } : {}),
        },
        data: input,
      });
    }
    return this.prisma.sales_invoices.update({
      where: { id, tenant_id: t.tenantId },
      data: input,
    });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.sales_invoices.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: SalesInvoiceListParams, ctx: TenantContext): Promise<PagedResult<sales_invoices>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { invoice_date: "desc" }, search, customerId } = params;
    const where: Prisma.sales_invoicesWhereInput = {
      tenant_id: t.tenantId,
      ...(customerId ? { customer_id: customerId } : {}),
      ...(search
        ? {
          OR: [
            { invoice_no: { contains: search, mode: "insensitive" } },
            { notes: { contains: search, mode: "insensitive" } },
            { cancel_reason: { contains: search, mode: "insensitive" } },
          ],
        }
        : {}),
    };
    const [rawItems, total] = await Promise.all([
      this.prisma.sales_invoices.findMany({
        where,
        include: { customer: true },
        skip,
        take,
        orderBy,
      }),
      this.prisma.sales_invoices.count({ where }),
    ]);
    const items: any = rawItems;
    if (search) {
      const byCust = await this.prisma.sales_invoices.findMany({
        where: { tenant_id: t.tenantId, customer: { business_name: { contains: search, mode: "insensitive" } } },
        include: { customer: true },
      });
      const seen = new Set(items.map((x: any) => x.id));
      for (const sf of byCust as any[]) if (!seen.has(sf.id)) items.push(sf);
    }
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async getNextSequence(ctx: TenantContext): Promise<number> {
    const t = this.withTenant(ctx);
    const cnt = await this.prisma.sales_invoices.count({ where: { tenant_id: t.tenantId } });
    return cnt + 1;
  }

  async monthlyStats(ctx: TenantContext, monthsBack: number = 1) {
    const t = this.withTenant(ctx);
    const start = new Date();
    start.setMonth(start.getMonth() - monthsBack);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return this.prisma.sales_invoices.aggregate({
      where: { tenant_id: t.tenantId, invoice_date: { gte: start }, status: "FINALIZED" },
      _sum: { gross_amount: true, total_discount: true, total_tax: true, net_amount: true, paid_amount: true, balance_due: true },
      _count: { id: true },
    });
  }

  /**
   * Same FINALIZED filter as monthlyStats, but keyed on the date-only effective_date
   * (inclusive start, exclusive end) and reporting finalized invoices with no
   * effective_date separately so they are never silently dropped.
   */
  async monthlyEffectiveStats(
    ctx: TenantContext,
    bounds: { start: Date; endExclusive: Date },
    db: any = this.prisma,
  ) {
    const t = this.withTenant(ctx);
    const base = { tenant_id: t.tenantId, status: "FINALIZED" as const };
    const included = await db.sales_invoices.aggregate({
      where: { ...base, effective_date: { gte: bounds.start, lt: bounds.endExclusive } },
      _sum: { gross_amount: true, total_discount: true, total_tax: true, net_amount: true, paid_amount: true, balance_due: true },
      _count: { id: true },
    });
    const unclassified = await db.sales_invoices.aggregate({
      where: { ...base, effective_date: null },
      _sum: { net_amount: true },
      _count: { id: true },
    });
    return { included, unclassified };
  }
}
