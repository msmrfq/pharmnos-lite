import { Prisma } from "@prisma/client";
import type { purchase_invoices } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class PurchaseInvoiceRepository extends BaseRepository<
  purchase_invoices,
  Prisma.purchase_invoicesCreateInput,
  Prisma.purchase_invoicesUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "purchase_invoices");
  }

  async getById(id: string, ctx: TenantContext): Promise<purchase_invoices | null> {
    const t = this.withTenant(ctx);
    return this.prisma.purchase_invoices.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: {
        supplier: true,
        items: { include: { product: true } },
      },
    });
  }

  async getByInvoiceNo(
    invoiceNo: string,
    ctx: TenantContext,
  ): Promise<purchase_invoices | null> {
    const t = this.withTenant(ctx);
    return this.prisma.purchase_invoices.findUnique({
      where: { tenant_id_invoice_no: { tenant_id: t.tenantId, invoice_no: invoiceNo } },
    });
  }

  async create(
    input: Prisma.purchase_invoicesCreateInput,
    ctx: TenantContext,
  ): Promise<purchase_invoices> {
    const t = this.withTenant(ctx);
    return this.prisma.purchase_invoices.create({
      data: {
        ...input,
        tenant_id: (input as any).tenant_id ?? t.tenantId,
        created_by: (input as any).created_by ?? t.userId,
      },
    });
  }

  async update(
    id: string,
    input: Prisma.purchase_invoicesUpdateInput,
    ctx: TenantContext,
  ): Promise<purchase_invoices> {
    const t = this.withTenant(ctx);
    return this.prisma.purchase_invoices.update({
      where: { id, tenant_id: t.tenantId },
      data: input,
    });
  }

  async delete(id: string, ctx: TenantContext): Promise<void> {
    const t = this.withTenant(ctx);
    await this.prisma.purchase_invoices.delete({ where: { id, tenant_id: t.tenantId } });
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<purchase_invoices>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { invoice_date: "desc" }, search } = params;
    const where: Prisma.purchase_invoicesWhereInput = {
      tenant_id: t.tenantId,
      ...(search
        ? {
            OR: [
              { invoice_no: { contains: search, mode: "insensitive" } },
              { supplier_invoice_no: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rawItems, total] = await Promise.all([
      this.prisma.purchase_invoices.findMany({
        where,
        include: { supplier: true },
        skip,
        take,
        orderBy,
      }),
      this.prisma.purchase_invoices.count({ where }),
    ]);
    const items: any = rawItems;
    if (search) {
      const supplierFiltered = await this.prisma.purchase_invoices.findMany({
        where: { tenant_id: t.tenantId, supplier: { business_name: { contains: search, mode: "insensitive" } } },
        include: { supplier: true },
      });
      const seen = new Set(items.map((x: any) => x.id));
      for (const sf of supplierFiltered as any[]) if (!seen.has(sf.id)) items.push(sf);
    }
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async getNextSequence(ctx: TenantContext): Promise<number> {
    const t = this.withTenant(ctx);
    const cnt = await this.prisma.purchase_invoices.count({ where: { tenant_id: t.tenantId } });
    return cnt + 1;
  }
}
