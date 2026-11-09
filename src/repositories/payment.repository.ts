import { Prisma } from "@prisma/client";
import type { payments } from "@prisma/client";
import { BaseRepository, type ListParams, type PagedResult } from "@/lib/db/base-repository";
import type { TenantContext } from "@/lib/db/tenant-context";
import { decimalOrZero } from "@/lib/decimal";

export type CustomerUnappliedCredit = {
  paymentId: string;
  paymentDate: Date | null;
  amount: number;
  unappliedAmount: number;
  referenceNo: string | null;
};

export type SupplierUnappliedAdvance = {
  paymentId: string;
  paymentDate: Date | null;
  amount: number;
  unappliedAmount: number;
  referenceNo: string | null;
};

// Currency is not modeled on payments; sequencing is currency-agnostic and performs no FX.
export async function allocatePaymentReceiptNo(
  client: { $queryRaw<T = unknown>(query: Prisma.Sql): PromiseLike<T> },
  prefix: string,
  tenantId: string,
): Promise<string> {
  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) throw new Error("Receipt prefix is required.");
  const rows = await client.$queryRaw<Array<{ allocated: number | bigint }>>(
    Prisma.sql`
      INSERT INTO "payment_receipt_sequences" ("tenant_id", "prefix", "next_value")
      VALUES (${tenantId}, ${normalizedPrefix}, 2)
      ON CONFLICT ("tenant_id", "prefix")
      DO UPDATE SET "next_value" = "payment_receipt_sequences"."next_value" + 1
      RETURNING "next_value" - 1 AS "allocated"
    `,
  );
  const allocated = rows[0]?.allocated;
  if (allocated === undefined) throw new Error("Could not allocate a payment receipt number.");
  return `${normalizedPrefix}-${String(Number(allocated)).padStart(5, "0")}`;
}

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

  async create(_input: Prisma.paymentsCreateInput, _ctx: TenantContext): Promise<payments> {
    throw new Error(
      "Payments cannot be created through the repository; use the typed payment actions so the payment date is classified.",
    );
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
    const { skip = 0, take = 50, orderBy, search } = params;
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
        orderBy: orderBy ? [orderBy, { id: "asc" }] : [{ effective_date: "desc" }, { id: "asc" }],
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
    return allocatePaymentReceiptNo(this.prisma, prefix, t.tenantId);
  }

  async listCustomerUnappliedCredits(
    customerId: string,
    ctx: TenantContext,
  ): Promise<CustomerUnappliedCredit[]> {
    const t = this.withTenant(ctx);
    const payments = await this.prisma.payments.findMany({
      where: { tenant_id: t.tenantId, customer_id: customerId },
      select: {
        id: true,
        amount: true,
        effective_date: true,
        reference_no: true,
        allocations: {
          select: { amount: true, reversal: { select: { amount: true } } },
        },
        refunds: {
          where: { status: "COMPLETED" },
          select: { amount: true },
        },
        reversals: {
          select: { amount: true },
        },
      },
      orderBy: [{ effective_date: "asc" }, { id: "asc" }],
    });

    return payments.flatMap((payment: any) => {
      const allocated = payment.allocations.reduce(
        (total: ReturnType<typeof decimalOrZero>, allocation: any) =>
          total.add(
            decimalOrZero(allocation.amount).subtract(
              allocation.reversal.reduce(
                (reversed: ReturnType<typeof decimalOrZero>, row: any) =>
                  reversed.add(decimalOrZero(row.amount)),
                decimalOrZero(0),
              ),
            ),
          ),
        decimalOrZero(0),
      );
      const refunded = payment.refunds.reduce(
        (total: ReturnType<typeof decimalOrZero>, row: any) => total.add(decimalOrZero(row.amount)),
        decimalOrZero(0),
      );
      const reversed = payment.reversals.reduce(
        (total: ReturnType<typeof decimalOrZero>, row: any) => total.add(decimalOrZero(row.amount)),
        decimalOrZero(0),
      );
      const unapplied = decimalOrZero(payment.amount)
        .subtract(allocated)
        .subtract(refunded)
        .subtract(reversed)
        .round(2, "HALF_UP");
      if (unapplied.compare(0) <= 0) return [];
      return [{
        paymentId: payment.id,
        paymentDate: payment.effective_date,
        amount: decimalOrZero(payment.amount).round(2, "HALF_UP").toNumber(),
        unappliedAmount: unapplied.toNumber(),
        referenceNo: payment.reference_no,
      }];
    });
  }

  async getCustomerUnappliedCredit(customerId: string, ctx: TenantContext): Promise<number> {
    const credits = await this.listCustomerUnappliedCredits(customerId, ctx);
    return credits
      .reduce(
        (total, credit) => total.add(decimalOrZero(credit.unappliedAmount)),
        decimalOrZero(0),
      )
      .round(2, "HALF_UP")
      .toNumber();
  }

  async listSupplierUnappliedAdvances(
    supplierId: string,
    ctx: TenantContext,
  ): Promise<SupplierUnappliedAdvance[]> {
    const t = this.withTenant(ctx);
    const payments = await this.prisma.payments.findMany({
      where: { tenant_id: t.tenantId, supplier_id: supplierId },
      select: {
        id: true,
        amount: true,
        effective_date: true,
        reference_no: true,
        allocations: {
          select: { amount: true, reversal: { select: { amount: true } } },
        },
        refunds: {
          where: { status: "COMPLETED" },
          select: { amount: true },
        },
        reversals: {
          select: { amount: true },
        },
      },
      orderBy: [{ effective_date: "asc" }, { id: "asc" }],
    });

    return payments.flatMap((payment: any) => {
      const allocated = payment.allocations.reduce(
        (total: ReturnType<typeof decimalOrZero>, allocation: any) =>
          total.add(
            decimalOrZero(allocation.amount).subtract(
              allocation.reversal.reduce(
                (reversed: ReturnType<typeof decimalOrZero>, row: any) =>
                  reversed.add(decimalOrZero(row.amount)),
                decimalOrZero(0),
              ),
            ),
          ),
        decimalOrZero(0),
      );
      const refunded = payment.refunds.reduce(
        (total: ReturnType<typeof decimalOrZero>, row: any) => total.add(decimalOrZero(row.amount)),
        decimalOrZero(0),
      );
      const reversed = payment.reversals.reduce(
        (total: ReturnType<typeof decimalOrZero>, row: any) => total.add(decimalOrZero(row.amount)),
        decimalOrZero(0),
      );
      const unapplied = decimalOrZero(payment.amount)
        .subtract(allocated)
        .subtract(refunded)
        .subtract(reversed)
        .round(2, "HALF_UP");
      if (unapplied.compare(0) <= 0) return [];
      return [{
        paymentId: payment.id,
        paymentDate: payment.effective_date,
        amount: decimalOrZero(payment.amount).round(2, "HALF_UP").toNumber(),
        unappliedAmount: unapplied.toNumber(),
        referenceNo: payment.reference_no,
      }];
    });
  }

  async getSupplierUnappliedAdvance(supplierId: string, ctx: TenantContext): Promise<number> {
    const advances = await this.listSupplierUnappliedAdvances(supplierId, ctx);
    return advances
      .reduce(
        (total, advance) => total.add(decimalOrZero(advance.unappliedAmount)),
        decimalOrZero(0),
      )
      .round(2, "HALF_UP")
      .toNumber();
  }
}
