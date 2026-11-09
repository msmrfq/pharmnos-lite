import { LedgerEntryType, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { establishTenantContext, type TenantContext } from "@/lib/db/tenant-context";
import { Decimal, decimalOrZero } from "@/lib/decimal";
import type { BusinessDate } from "@/lib/utils/business-date";
import {
  ledgerTemporalFields,
  resolveFinancialTemporal,
  type FinancialTemporalInput,
} from "@/lib/utils/financial-temporal";

/** An invoice's effective date is always an explicit business date, never an instant. */
export type InvoiceBusinessDateInput = { readonly businessDate: BusinessDate; readonly occurredAt?: never };

export type CustomerLedgerImpactInput = {
  customer_id: string;
  entry_type: LedgerEntryType;
  debit?: number;
  credit?: number;
  invoice_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  narration?: string | null;
  temporal: FinancialTemporalInput;
};

export type SupplierLedgerImpactInput = {
  supplier_id: string;
  entry_type: LedgerEntryType;
  debit?: number;
  credit?: number;
  purchase_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  narration?: string | null;
  temporal: FinancialTemporalInput;
};

export type LedgerEntryResult = {
  id: string;
  tenant_id: string;
  counterparty_id: string;
  counterparty_kind: "customer" | "supplier";
  debit: number;
  credit: number;
  balance: number;
  /** Legacy column: the date marker for a business date, the instant otherwise. */
  entry_date: Date;
  effective_date: Date | null;
  effective_date_basis: string | null;
  occurred_at: Date | null;
};

const round2 = (n: number) => decimalOrZero(n).round(2, "HALF_UP").toNumber();

const LEDGER_ORDER = [{ created_at: "asc" }, { id: "asc" }];

function assertNoLegacyDateInput(input: object): void {
  if ("entry_date" in input) {
    throw new TypeError("entry_date is not accepted; provide a typed `temporal` input.");
  }
}

function assertInvoiceBusinessDate(input: unknown): void {
  if (input === null || typeof input !== "object" || (input as { occurredAt?: unknown }).occurredAt !== undefined) {
    throw new TypeError("An invoice ledger entry requires an explicit business date, not an instant.");
  }
}

// The running balance never reads entry_date: legacy rows mix date markers and instants.
async function customerRunningBalance(tx: any, tenantId: string, customerId: string): Promise<number> {
  const rows = await tx.customer_ledgers.findMany({
    where: { tenant_id: tenantId, customer_id: customerId },
    orderBy: LEDGER_ORDER,
    select: { debit: true, credit: true },
  });
  let bal = Decimal.zero();
  for (const r of rows) {
    bal = bal
      .add(r.debit === null || r.debit === undefined ? 0 : r.debit.toString())
      .subtract(r.credit === null || r.credit === undefined ? 0 : r.credit.toString())
      .round(2, "HALF_UP");
  }
  return bal.toNumber();
}

async function supplierRunningBalance(tx: any, tenantId: string, supplierId: string): Promise<number> {
  const rows = await tx.supplier_ledgers.findMany({
    where: { tenant_id: tenantId, supplier_id: supplierId },
    orderBy: LEDGER_ORDER,
    select: { debit: true, credit: true },
  });
  let bal = Decimal.zero();
  for (const r of rows) {
    bal = bal
      .add(r.credit === null || r.credit === undefined ? 0 : r.credit.toString())
      .subtract(r.debit === null || r.debit === undefined ? 0 : r.debit.toString())
      .round(2, "HALF_UP");
  }
  return bal.toNumber();
}

async function lockCounterparty(
  tx: any,
  kind: "customer" | "supplier",
  tenantId: string,
  id: string,
): Promise<void> {
  const rows: unknown[] = kind === "customer"
    ? await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "customers" WHERE "tenant_id" = ${tenantId} AND "id" = ${id} FOR UPDATE
    `)
    : await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "suppliers" WHERE "tenant_id" = ${tenantId} AND "id" = ${id} FOR UPDATE
    `);
  if (rows.length !== 1) {
    throw new Error(kind === "customer" ? "Customer not found." : "Supplier not found.");
  }
}

export class LedgerImpactService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async impactCustomer(
    input: CustomerLedgerImpactInput,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    const t = ctx as any;
    if (!t.tenantId) throw new Error("Tenant required for customer ledger impact.");
    assertNoLegacyDateInput(input);
    const temporal = resolveFinancialTemporal(input.temporal);
    const debit = round2(input.debit ?? 0);
    const credit = round2(input.credit ?? 0);
    const refType = input.reference_type ?? mapLedgerRefType(input.entry_type);

    return this.prisma.$transaction(async (tx: any) => {
      await establishTenantContext(tx, ctx);
      await lockCounterparty(tx, "customer", t.tenantId, input.customer_id);
      const latestBal = await customerRunningBalance(tx, t.tenantId, input.customer_id);
      const newBal = decimalOrZero(latestBal).add(debit).subtract(credit).round(2, "HALF_UP").toNumber();
      const row = await tx.customer_ledgers.create({
        data: {
          tenant_id: t.tenantId,
          customer_id: input.customer_id,
          entry_type: input.entry_type,
          debit,
          credit,
          balance: newBal,
          reference_type: refType,
          reference_id: input.reference_id ?? null,
          invoice_id: input.invoice_id ?? null,
          narration: input.narration ?? null,
          ...ledgerTemporalFields(temporal),
        },
        select: {
          id: true,
          tenant_id: true,
          customer_id: true,
          debit: true,
          credit: true,
          balance: true,
          entry_date: true,
          effective_date: true,
          effective_date_basis: true,
          occurred_at: true,
        },
      });

      if (input.entry_type === "PAYMENT_RECEIVED" || input.entry_type === "INVOICE" || input.entry_type === "CREDIT_NOTE" || input.entry_type === "OPENING_BALANCE") {
        const allBal = await customerRunningBalance(tx, t.tenantId, input.customer_id);
        await tx.customers.update({
          where: { id: input.customer_id, tenant_id: t.tenantId },
          data: { receivable_balance: Decimal.from(allBal).compare(0) === 1 ? round2(allBal) : 0 },
        });
      }

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        counterparty_id: row.customer_id,
        counterparty_kind: "customer" as const,
        debit: Number(row.debit),
        credit: Number(row.credit),
        balance: Number(row.balance),
        entry_date: row.entry_date,
        effective_date: row.effective_date ?? null,
        effective_date_basis: row.effective_date_basis ?? null,
        occurred_at: row.occurred_at ?? null,
      };
    });
  }

  async impactSupplier(
    input: SupplierLedgerImpactInput,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    const t = ctx as any;
    if (!t.tenantId) throw new Error("Tenant required for supplier ledger impact.");
    assertNoLegacyDateInput(input);
    const temporal = resolveFinancialTemporal(input.temporal);
    const debit = round2(input.debit ?? 0);
    const credit = round2(input.credit ?? 0);
    const refType = input.reference_type ?? mapLedgerRefType(input.entry_type);

    return this.prisma.$transaction(async (tx: any) => {
      await establishTenantContext(tx, ctx);
      await lockCounterparty(tx, "supplier", t.tenantId, input.supplier_id);
      const latestBal = await supplierRunningBalance(tx, t.tenantId, input.supplier_id);
      const newBal = decimalOrZero(latestBal).add(credit).subtract(debit).round(2, "HALF_UP").toNumber();
      const row = await tx.supplier_ledgers.create({
        data: {
          tenant_id: t.tenantId,
          supplier_id: input.supplier_id,
          entry_type: input.entry_type,
          debit,
          credit,
          balance: newBal,
          reference_type: refType,
          reference_id: input.reference_id ?? null,
          purchase_id: input.purchase_id ?? null,
          narration: input.narration ?? null,
          ...ledgerTemporalFields(temporal),
        },
        select: {
          id: true,
          tenant_id: true,
          supplier_id: true,
          debit: true,
          credit: true,
          balance: true,
          entry_date: true,
          effective_date: true,
          effective_date_basis: true,
          occurred_at: true,
        },
      });

      if (
        input.entry_type === "PAYMENT_MADE" ||
        input.entry_type === "PURCHASE" ||
        input.entry_type === "DEBIT_NOTE" ||
        input.entry_type === "OPENING_BALANCE"
      ) {
        const allBal = await supplierRunningBalance(tx, t.tenantId, input.supplier_id);
        await tx.suppliers.update({
          where: { id: input.supplier_id, tenant_id: t.tenantId },
          data: { payable_balance: Decimal.from(allBal).compare(0) === 1 ? round2(allBal) : 0 },
        });
      }

      return {
        id: row.id,
        tenant_id: row.tenant_id,
        counterparty_id: row.supplier_id,
        counterparty_kind: "supplier" as const,
        debit: Number(row.debit),
        credit: Number(row.credit),
        balance: Number(row.balance),
        entry_date: row.entry_date,
        effective_date: row.effective_date ?? null,
        effective_date_basis: row.effective_date_basis ?? null,
        occurred_at: row.occurred_at ?? null,
      };
    });
  }

  async finalizeCustomerInvoice(
    customerId: string,
    invoiceId: string,
    invoiceDate: InvoiceBusinessDateInput,
    invoiceTotal: number,
    narration: string,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    assertInvoiceBusinessDate(invoiceDate);
    return this.impactCustomer(
      {
        customer_id: customerId,
        entry_type: "INVOICE",
        debit: invoiceTotal,
        credit: 0,
        invoice_id: invoiceId,
        reference_type: "sales_invoice",
        reference_id: invoiceId,
        narration,
        temporal: invoiceDate,
      },
      ctx,
    );
  }

  async finalizePurchaseInvoice(
    supplierId: string,
    purchaseId: string,
    invoiceDate: InvoiceBusinessDateInput,
    purchaseTotal: number,
    narration: string,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    assertInvoiceBusinessDate(invoiceDate);
    return this.impactSupplier(
      {
        supplier_id: supplierId,
        entry_type: "PURCHASE",
        debit: 0,
        credit: purchaseTotal,
        purchase_id: purchaseId,
        reference_type: "purchase_invoice",
        reference_id: purchaseId,
        narration,
        temporal: invoiceDate,
      },
      ctx,
    );
  }

  async customerPaymentReceived(
    customerId: string,
    invoiceId: string | null,
    paymentId: string,
    paymentDate: FinancialTemporalInput,
    amount: number,
    narration: string,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    return this.impactCustomer(
      {
        customer_id: customerId,
        entry_type: "PAYMENT_RECEIVED",
        debit: 0,
        credit: amount,
        invoice_id: invoiceId ?? undefined,
        reference_type: "payment",
        reference_id: paymentId,
        narration,
        temporal: paymentDate,
      },
      ctx,
    );
  }

  async supplierPaymentMade(
    supplierId: string,
    purchaseId: string | null,
    paymentId: string,
    paymentDate: FinancialTemporalInput,
    amount: number,
    narration: string,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    return this.impactSupplier(
      {
        supplier_id: supplierId,
        entry_type: "PAYMENT_MADE",
        debit: amount,
        credit: 0,
        purchase_id: purchaseId ?? undefined,
        reference_type: "payment",
        reference_id: paymentId,
        narration,
        temporal: paymentDate,
      },
      ctx,
    );
  }
}

function mapLedgerRefType(entry: LedgerEntryType): string {
  switch (entry) {
    case "INVOICE":
      return "sales_invoice";
    case "PAYMENT_RECEIVED":
      return "payment";
    case "CREDIT_NOTE":
      return "credit_note";
    case "PURCHASE":
      return "purchase_invoice";
    case "PAYMENT_MADE":
      return "payment";
    case "DEBIT_NOTE":
      return "debit_note";
    case "OPENING_BALANCE":
      return "opening_balance";
    default:
      return String(entry);
  }
}

export const ledgerImpactService = new LedgerImpactService();
