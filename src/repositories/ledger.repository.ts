import { Prisma } from "@prisma/client";
import type { customer_ledgers, supplier_ledgers } from "@prisma/client";
import { BaseRepository, type ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";
import { businessDateToday } from "@/lib/utils/business-date";

function calendarDayDifference(asOf: Date, dueDate: Date): number {
  const asOfDay = Date.parse(`${businessDateToday(asOf)}T00:00:00.000Z`);
  const dueDay = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  return Math.floor((asOfDay - dueDay) / 86400000);
}

function unclassifiedDueDateError(): Error {
  return new Error("Aging unavailable: a financially material finalized invoice has an unclassified business due date.");
}

function remainingPurchaseBalance(row: {
  net_amount: unknown;
  payment_allocations: Array<{
    amount: unknown;
    reversal: Array<{ amount: unknown }>;
  }>;
}): number {
  return Number(row.net_amount) - row.payment_allocations.reduce((sum, allocation) =>
    sum + Number(allocation.amount) - allocation.reversal.reduce(
      (reversed, entry) => reversed + Number(entry.amount),
      0,
    ), 0);
}

// Unclassified legacy rows (null effective_date) sort last in either direction, then by id.
function effectiveDateOrder(direction: "asc" | "desc") {
  return [
    { effective_date: { sort: direction, nulls: "last" as const } },
    { id: direction },
  ];
}

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
    _input: Prisma.customer_ledgersCreateInput,
    _ctx: TenantContext,
  ): Promise<customer_ledgers> {
    throw new Error(
      "Customer ledger rows cannot be created through the repository; use the typed financial actions or LedgerImpactService so the entry date is classified.",
    );
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
    const { skip = 0, take = 50, orderBy = effectiveDateOrder("desc") } = params;
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
      orderBy: effectiveDateOrder("asc"),
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

  async getOldestOverdueDays(customerId: string, ctx: TenantContext, asOf: Date = new Date()): Promise<number> {
    const t = this.withTenant(ctx);
    const rows = await this.prisma.sales_invoices.findMany({
      where: {
        tenant_id: t.tenantId,
        customer_id: customerId,
        status: "FINALIZED",
        balance_due: { gt: 0 },
      },
      select: { id: true, due_date_business: true, balance_due: true },
      orderBy: [{ due_date_business: "asc" }, { id: "asc" }],
    });
    for (const row of rows) {
      if (Number(row.balance_due) > 0 && !row.due_date_business) throw unclassifiedDueDateError();
    }
    const oldestOverdue = rows
      .filter((row) => row.due_date_business && calendarDayDifference(asOf, row.due_date_business) > 0)
      .sort((left, right) =>
        left.due_date_business!.getTime() - right.due_date_business!.getTime() ||
        (String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0),
      )[0]?.due_date_business;
    if (!oldestOverdue) return 0;
    const days = calendarDayDifference(asOf, oldestOverdue);
    return Math.max(0, Number.isFinite(days) ? days : 0);
  }

  async getAgingBuckets(
    ctx: TenantContext,
    customerId?: string,
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
    const rows = await this.prisma.sales_invoices.findMany({
      where: {
        tenant_id: t.tenantId,
        ...(customerId ? { customer_id: customerId } : {}),
        status: "FINALIZED",
        balance_due: { gt: 0 },
      },
      select: { id: true, due_date_business: true, balance_due: true },
    });
    let current = 0, b30 = 0, b60 = 0, b90 = 0, over90 = 0;
    for (const row of rows) {
      const bal = Number(row.balance_due);
      if (bal <= 0) continue;
      const dueDate = row.due_date_business;
      if (!dueDate) throw unclassifiedDueDateError();
      const daysOverdue = calendarDayDifference(today, dueDate);
      if (daysOverdue <= 0) current += bal;
      else if (daysOverdue <= 30) b30 += bal;
      else if (daysOverdue <= 60) b60 += bal;
      else if (daysOverdue <= 90) b90 += bal;
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

  async agedReceivablesTotals(ctx: TenantContext) {
    const buckets = await this.getAgingBuckets(ctx);
    return {
      current_30: buckets.current + buckets.d30,
      bucket_31_60: buckets.d60,
      bucket_61_90: buckets.d90,
      bucket_over_90: buckets.over90,
      total: buckets.total,
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
    _input: Prisma.supplier_ledgersCreateInput,
    _ctx: TenantContext,
  ): Promise<supplier_ledgers> {
    throw new Error(
      "Supplier ledger rows cannot be created through the repository; use the typed financial actions or LedgerImpactService so the entry date is classified.",
    );
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
    const { skip = 0, take = 50, orderBy = effectiveDateOrder("desc") } = params;
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
      orderBy: effectiveDateOrder("asc"),
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

  async getOldestOverdueDays(supplierId: string, ctx: TenantContext, asOf: Date = new Date()): Promise<number> {
    const t = this.withTenant(ctx);
    const rows = await this.prisma.purchase_invoices.findMany({
      where: {
        tenant_id: t.tenantId,
        supplier_id: supplierId,
        status: "FINALIZED",
      },
      orderBy: [{ due_date_business: "asc" }, { id: "asc" }],
      select: {
        id: true,
        due_date_business: true,
        net_amount: true,
        payment_allocations: { select: { amount: true, reversal: { select: { amount: true } } } },
      },
    });
    for (const row of rows) {
      if (remainingPurchaseBalance(row) > 0 && !row.due_date_business) throw unclassifiedDueDateError();
    }
    const oldestOverdue = rows
      .filter((row) => remainingPurchaseBalance(row) > 0 &&
        row.due_date_business &&
        calendarDayDifference(asOf, row.due_date_business) > 0)
      .sort((left, right) =>
        left.due_date_business!.getTime() - right.due_date_business!.getTime() ||
        (String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0),
      )[0]?.due_date_business;
    if (!oldestOverdue) return 0;
    const days = calendarDayDifference(asOf, oldestOverdue);
    return Math.max(0, Number.isFinite(days) ? days : 0);
  }

  async getAgingBuckets(ctx: TenantContext, supplierId?: string): Promise<{
    current: number;
    d30: number;
    d60: number;
    d90: number;
    over90: number;
    total: number;
  }> {
    const t = this.withTenant(ctx);
    const today = new Date();
    const rows = await this.prisma.purchase_invoices.findMany({
      where: {
        tenant_id: t.tenantId,
        ...(supplierId ? { supplier_id: supplierId } : {}),
        status: "FINALIZED",
      },
      select: {
        id: true,
        due_date_business: true,
        net_amount: true,
        payment_allocations: { select: { amount: true, reversal: { select: { amount: true } } } },
      },
    });
    let current = 0, b30 = 0, b60 = 0, b90 = 0, over90 = 0;
    for (const row of rows) {
      const bal = remainingPurchaseBalance(row);
      if (bal <= 0) continue;
      const dueDate = row.due_date_business;
      if (!dueDate) throw unclassifiedDueDateError();
      const daysOverdue = calendarDayDifference(today, dueDate);
      if (daysOverdue <= 0) current += bal;
      else if (daysOverdue <= 30) b30 += bal;
      else if (daysOverdue <= 60) b60 += bal;
      else if (daysOverdue <= 90) b90 += bal;
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

  async agedPayablesTotals(ctx: TenantContext) {
    const buckets = await this.getAgingBuckets(ctx);
    return {
      current_30: buckets.current + buckets.d30,
      bucket_31_60: buckets.d60,
      bucket_61_90: buckets.d90,
      bucket_over_90: buckets.over90,
      total: buckets.total,
    };
  }
}
