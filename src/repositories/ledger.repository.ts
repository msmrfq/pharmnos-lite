import { Prisma } from "@prisma/client";
import type { customer_ledgers, supplier_ledgers } from "@prisma/client";
import { BaseRepository, ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";

export class CustomerLedgerRepository extends BaseRepository<
  customer_ledgers,
  Prisma.customer_ledgersCreateInput,
  Prisma.customer_ledgersUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "customer_ledgers");
  }

  async getById(id: string, ctx: TenantContext): Promise<customer_ledgers | null> {
    const t = this.withTenant(ctx);
    return this.prisma.customer_ledgers.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: { customer: true, invoice: true },
    });
  }

  async create(
    input: Prisma.customer_ledgersCreateInput,
    ctx: TenantContext,
  ): Promise<customer_ledgers> {
    const t = this.withTenant(ctx);
    return this.prisma.customer_ledgers.create({
      data: { ...input, tenant_id: (input as any).tenant_id ?? t.tenantId },
    });
  }

  async update(
    _id: string,
    _input: Prisma.customer_ledgersUpdateInput,
    _ctx: TenantContext,
  ): Promise<customer_ledgers> {
    throw new Error("Ledger entries are immutable. Create a reversing entry.");
  }

  async delete(_id: string, _ctx: TenantContext): Promise<void> {
    throw new Error("Ledger entries are immutable and cannot be deleted.");
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<customer_ledgers>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { entry_date: "desc" } } = params;
    const where: Prisma.customer_ledgersWhereInput = { tenant_id: t.tenantId };
    const [items, total] = await Promise.all([
      this.prisma.customer_ledgers.findMany({
        where,
        include: { customer: true },
        skip,
        take,
        orderBy,
      }),
      this.prisma.customer_ledgers.count({ where }),
    ]);
    return { items: items as any, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listForCustomer(
    customerId: string,
    ctx: TenantContext,
    limit: number = 100,
  ): Promise<customer_ledgers[]> {
    const t = this.withTenant(ctx);
    return this.prisma.customer_ledgers.findMany({
      where: { tenant_id: t.tenantId, customer_id: customerId },
      orderBy: { entry_date: "asc" },
      take: limit,
    });
  }

  async getBalance(customerId: string, ctx: TenantContext): Promise<number> {
    const t = this.withTenant(ctx);
    const result = await this.prisma.customer_ledgers.aggregate({
      where: { tenant_id: t.tenantId, customer_id: customerId },
      _sum: { debit: true, credit: true, balance: true },
    });
    const sum = result._sum;
    if (!sum) return 0;
    const debit = Number(sum.debit ?? 0);
    const credit = Number(sum.credit ?? 0);
    return debit - credit;
  }

  async getAgingBuckets(
    ctx: TenantContext,
  ): Promise<{
    current: number;
    d30: number;
    d60: number;
    d90: number;
    over90: number;
    total: number;
  }> {
    const t = this.withTenant(ctx);
    const today = new Date();
    const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
    const d60 = new Date(today); d60.setDate(d60.getDate() - 60);
    const d90 = new Date(today); d90.setDate(d90.getDate() - 90);
    const rows = await this.prisma.customer_ledgers.findMany({
      where: { tenant_id: t.tenantId },
      select: { entry_date: true, debit: true, credit: true },
    });
    let current = 0, b30 = 0, b60 = 0, b90 = 0, over90 = 0;
    for (const row of rows) {
      const bal = Number(row.debit) - Number(row.credit);
      if (bal <= 0) continue;
      if (row.entry_date >= d30) current += bal;
      else if (row.entry_date >= d60) b30 += bal;
      else if (row.entry_date >= d90) b60 += bal;
      else over90 += bal;
    }
    return {
      current,
      d30: b30,
      d60: b60,
      d90: b90,
      over90,
      total: current + b30 + b60 + b90 + over90,
    };
  }
}

export class SupplierLedgerRepository extends BaseRepository<
  supplier_ledgers,
  Prisma.supplier_ledgersCreateInput,
  Prisma.supplier_ledgersUpdateInput,
  string
> {
  constructor(prisma: any) {
    super(prisma, "supplier_ledgers");
  }

  async getById(id: string, ctx: TenantContext): Promise<supplier_ledgers | null> {
    const t = this.withTenant(ctx);
    return this.prisma.supplier_ledgers.findUnique({
      where: { id, tenant_id: t.tenantId },
      include: { supplier: true, purchase: true },
    });
  }

  async create(
    input: Prisma.supplier_ledgersCreateInput,
    ctx: TenantContext,
  ): Promise<supplier_ledgers> {
    const t = this.withTenant(ctx);
    return this.prisma.supplier_ledgers.create({
      data: { ...input, tenant_id: (input as any).tenant_id ?? t.tenantId },
    });
  }

  async update(
    _id: string,
    _input: Prisma.supplier_ledgersUpdateInput,
    _ctx: TenantContext,
  ): Promise<supplier_ledgers> {
    throw new Error("Ledger entries are immutable. Create a reversing entry.");
  }

  async delete(_id: string, _ctx: TenantContext): Promise<void> {
    throw new Error("Ledger entries are immutable and cannot be deleted.");
  }

  async list(params: ListParams, ctx: TenantContext): Promise<PagedResult<supplier_ledgers>> {
    const t = this.withTenant(ctx);
    const { skip = 0, take = 50, orderBy = { entry_date: "desc" } } = params;
    const where: Prisma.supplier_ledgersWhereInput = { tenant_id: t.tenantId };
    const [items, total] = await Promise.all([
      this.prisma.supplier_ledgers.findMany({
        where,
        include: { supplier: true },
        skip,
        take,
        orderBy,
      }),
      this.prisma.supplier_ledgers.count({ where }),
    ]);
    return { items: items as any, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }

  async listForSupplier(
    supplierId: string,
    ctx: TenantContext,
    limit: number = 100,
  ): Promise<supplier_ledgers[]> {
    const t = this.withTenant(ctx);
    return this.prisma.supplier_ledgers.findMany({
      where: { tenant_id: t.tenantId, supplier_id: supplierId },
      orderBy: { entry_date: "asc" },
      take: limit,
    });
  }

  async getBalance(supplierId: string, ctx: TenantContext): Promise<number> {
    const t = this.withTenant(ctx);
    const result = await this.prisma.supplier_ledgers.aggregate({
      where: { tenant_id: t.tenantId, supplier_id: supplierId },
      _sum: { debit: true, credit: true, balance: true },
    });
    const sum = result._sum;
    if (!sum) return 0;
    return Number(sum.credit ?? 0) - Number(sum.debit ?? 0);
  }
}
