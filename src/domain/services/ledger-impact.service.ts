import { LedgerEntryType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import type { TenantContext } from "@/lib/db/tenant-context";

export type CustomerLedgerImpactInput = {
  customer_id: string;
  entry_type: LedgerEntryType;
  debit?: number;
  credit?: number;
  invoice_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  narration?: string | null;
  entry_date?: Date;
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
  entry_date?: Date;
};

export type LedgerEntryResult = {
  id: string;
  tenant_id: string;
  counterparty_id: string;
  counterparty_kind: "customer" | "supplier";
  debit: number;
  credit: number;
  balance: number;
  entry_date: Date;
};

const round2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;

async function customerRunningBalance(
  tx: any,
  tenantId: string,
  customerId: string,
  atOrBefore: Date,
): Promise<number> {
  const rows = await tx.customer_ledgers.findMany({
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
      entry_date: { lte: atOrBefore },
    },
    orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
    select: { debit: true, credit: true, entry_date: true, created_at: true, id: true },
  });
  if (!rows.length) return 0;
  let bal = 0;
  for (const r of rows) bal = round2(bal + Number(r.debit) - Number(r.credit));
  return bal;
}

async function supplierRunningBalance(
  tx: any,
  tenantId: string,
  supplierId: string,
  atOrBefore: Date,
): Promise<number> {
  const rows = await tx.supplier_ledgers.findMany({
    where: {
      tenant_id: tenantId,
      supplier_id: supplierId,
      entry_date: { lte: atOrBefore },
    },
    orderBy: [{ entry_date: "asc" }, { created_at: "asc" }],
    select: { debit: true, credit: true },
  });
  if (!rows.length) return 0;
  let bal = 0;
  for (const r of rows) bal = round2(bal + Number(r.credit) - Number(r.debit));
  return bal;
}

export class LedgerImpactService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async impactCustomer(
    input: CustomerLedgerImpactInput,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    const t = ctx as any;
    if (!t.tenantId) throw new Error("Tenant required for customer ledger impact.");
    const debit = round2(input.debit ?? 0);
    const credit = round2(input.credit ?? 0);
    const entryDate = input.entry_date ?? new Date();
    const refType = input.reference_type ?? mapLedgerRefType(input.entry_type);

    return this.prisma.$transaction(async (tx: any) => {
      const latestBal = await customerRunningBalance(tx, t.tenantId, input.customer_id, entryDate);
      const newBal = round2(latestBal + debit - credit);
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
          entry_date: entryDate,
        },
        select: { id: true, tenant_id: true, customer_id: true, debit: true, credit: true, balance: true, entry_date: true },
      });

      if (input.entry_type === "PAYMENT_RECEIVED" || input.entry_type === "INVOICE" || input.entry_type === "CREDIT_NOTE" || input.entry_type === "OPENING_BALANCE") {
        const allBal = await customerRunningBalance(tx, t.tenantId, input.customer_id, new Date("2999-12-31"));
        await tx.customers.update({
          where: { id: input.customer_id, tenant_id: t.tenantId },
          data: { receivable_balance: Math.max(0, round2(allBal)) },
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
      };
    });
  }

  async impactSupplier(
    input: SupplierLedgerImpactInput,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
    const t = ctx as any;
    if (!t.tenantId) throw new Error("Tenant required for supplier ledger impact.");
    const debit = round2(input.debit ?? 0);
    const credit = round2(input.credit ?? 0);
    const entryDate = input.entry_date ?? new Date();
    const refType = input.reference_type ?? mapLedgerRefType(input.entry_type);

    return this.prisma.$transaction(async (tx: any) => {
      const latestBal = await supplierRunningBalance(tx, t.tenantId, input.supplier_id, entryDate);
      const newBal = round2(latestBal + credit - debit);
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
          entry_date: entryDate,
        },
        select: { id: true, tenant_id: true, supplier_id: true, debit: true, credit: true, balance: true, entry_date: true },
      });

      if (
        input.entry_type === "PAYMENT_MADE" ||
        input.entry_type === "PURCHASE" ||
        input.entry_type === "DEBIT_NOTE" ||
        input.entry_type === "OPENING_BALANCE"
      ) {
        const allBal = await supplierRunningBalance(tx, t.tenantId, input.supplier_id, new Date("2999-12-31"));
        await tx.suppliers.update({
          where: { id: input.supplier_id, tenant_id: t.tenantId },
          data: { payable_balance: Math.max(0, round2(allBal)) },
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
      };
    });
  }

  async finalizeCustomerInvoice(
    customerId: string,
    invoiceId: string,
    invoiceDate: Date,
    invoiceTotal: number,
    narration: string,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
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
        entry_date: invoiceDate,
      },
      ctx,
    );
  }

  async finalizePurchaseInvoice(
    supplierId: string,
    purchaseId: string,
    invoiceDate: Date,
    purchaseTotal: number,
    narration: string,
    ctx: TenantContext,
  ): Promise<LedgerEntryResult> {
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
        entry_date: invoiceDate,
      },
      ctx,
    );
  }

  async customerPaymentReceived(
    customerId: string,
    invoiceId: string | null,
    paymentId: string,
    paymentDate: Date,
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
        entry_date: paymentDate,
      },
      ctx,
    );
  }

  async supplierPaymentMade(
    supplierId: string,
    purchaseId: string | null,
    paymentId: string,
    paymentDate: Date,
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
        entry_date: paymentDate,
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
