import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { establishTenantContext, type TenantContext } from "@/lib/db/tenant-context";
import { decimalOrZero } from "@/lib/decimal";

type Tx = Prisma.TransactionClient;
type CounterpartyKind = "customer" | "supplier";
type InvoiceKind = "sales" | "purchase";
type Money = ReturnType<typeof decimalOrZero>;

export type AllocationInput = {
  tenantId: string;
  subjectId: string;
  paymentId: string;
  invoiceId: string;
  invoiceKind: InvoiceKind;
  amount: number;
  idempotencyKey: string;
  actorId?: string;
};

export type ReversalInput = {
  tenantId: string;
  subjectId: string;
  paymentId: string;
  idempotencyKey: string;
  actorId?: string;
  reason?: string;
};

export type AllocationReversalInput = {
  tenantId: string;
  subjectId: string;
  allocationId: string;
  idempotencyKey: string;
  actorId?: string;
};

export type RefundInput = {
  tenantId: string;
  subjectId: string;
  paymentId: string;
  amount: number;
  idempotencyKey: string;
  actorId?: string;
  reason?: string;
};

function hashPayload(operation: string, value: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, value }), "utf8").digest("hex");
}

function money(value: unknown): Money {
  return decimalOrZero(value as any).round(2, "HALF_UP");
}

function isRetryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function retryTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }

  }
  throw lastError;
}

async function establishFinancialContext(tx: Tx, tenantId: string, subjectId: string): Promise<void> {
  await establishTenantContext(tx, {
    tenantId,
    userId: subjectId,
    subjectId,
    membershipId: subjectId,
    roles: [],
    permissions: [],
  });
}

async function lockCounterparty(tx: Tx, tenantId: string, kind: CounterpartyKind, id: string): Promise<void> {
  if (kind === "customer") {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "customers" WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE
    `);
    if (rows.length !== 1) throw new Error("Customer does not belong to this tenant.");
  } else {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "suppliers" WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE
    `);
    if (rows.length !== 1) throw new Error("Supplier does not belong to this tenant.");
  }
}

async function lockPayment(tx: Tx, tenantId: string, paymentId: string) {
  const rows = await tx.$queryRaw<Array<{
    id: string;
    customer_id: string | null;
    supplier_id: string | null;
    amount: unknown;
  }>>(Prisma.sql`
    SELECT id, customer_id, supplier_id, amount
    FROM "payments"
    WHERE tenant_id = ${tenantId} AND id = ${paymentId}
    FOR UPDATE
  `);
  const payment = rows[0];
  if (!payment) throw new Error("Payment does not belong to this tenant.");
  if ((payment.customer_id ? 1 : 0) + (payment.supplier_id ? 1 : 0) !== 1) {
    throw new Error("Payment must have exactly one counterparty.");
  }

  return {
    ...payment,
    counterpartyKind: payment.customer_id ? "customer" as const : "supplier" as const,
    counterpartyId: payment.customer_id ?? payment.supplier_id!,
  };
}

async function discoverPaymentCounterparty(
  tx: Tx,
  tenantId: string,
  paymentId: string,
): Promise<{ kind: CounterpartyKind; id: string }> {
  const payment = await tx.payments.findUnique({
    where: { tenant_id_id: { tenant_id: tenantId, id: paymentId } },
    select: { customer_id: true, supplier_id: true },
  });
  if (!payment || (payment.customer_id ? 1 : 0) + (payment.supplier_id ? 1 : 0) !== 1) {
    throw new Error("Payment does not belong to this tenant or has no valid counterparty.");
  }
  return payment.customer_id
    ? { kind: "customer", id: payment.customer_id }
    : { kind: "supplier", id: payment.supplier_id! };
}

async function lockInvoices(tx: Tx, tenantId: string, invoiceKind: InvoiceKind, ids: string[]): Promise<void> {
  const sorted = [...new Set(ids)].sort();
  for (const id of sorted) {
    const rows = invoiceKind === "sales"
      ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM "sales_invoices" WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE
        `)
      : await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM "purchase_invoices" WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE
        `);
    if (rows.length !== 1) throw new Error("Invoice does not belong to this tenant.");
  }
}

async function activePaymentAllocationTotal(tx: Tx, tenantId: string, paymentId: string): Promise<Money> {
  const rows = await tx.payment_allocations.findMany({
    where: { tenant_id: tenantId, payment_id: paymentId, reversal: null },
    select: { amount: true },
  });
  return rows.reduce((total, row) => total.add(row.amount), decimalOrZero(0));
}

async function activeInvoiceAllocationTotal(
  tx: Tx,
  tenantId: string,
  invoiceKind: InvoiceKind,
  invoiceId: string,
): Promise<Money> {
  const where = invoiceKind === "sales"
    ? { tenant_id: tenantId, sales_invoice_id: invoiceId, reversal: null }
    : { tenant_id: tenantId, purchase_invoice_id: invoiceId, reversal: null };
  const rows = await tx.payment_allocations.findMany({ where, select: { amount: true } });
  return rows.reduce((total, row) => total.add(row.amount), decimalOrZero(0));
}

async function completedRefundTotal(tx: Tx, tenantId: string, paymentId: string): Promise<Money> {
  const rows = await tx.payment_refunds.findMany({
    where: { tenant_id: tenantId, payment_id: paymentId, status: "COMPLETED" },
    select: { amount: true },
  });
  return rows.reduce((total, row) => total.add(row.amount), decimalOrZero(0));
}

async function assertPaymentUsable(
  tx: Tx,
  tenantId: string,
  paymentId: string,
  requested: Money,
  payment: Awaited<ReturnType<typeof lockPayment>>,
) {
  const allocated = await activePaymentAllocationTotal(tx, tenantId, paymentId);
  const refunded = await completedRefundTotal(tx, tenantId, paymentId);
  const reversed = await tx.payment_reversals.findUnique({ where: { tenant_id_payment_id: { tenant_id: tenantId, payment_id: paymentId } } });
  const usable = money(payment.amount).subtract(allocated).subtract(refunded).subtract(reversed?.amount ?? 0);
  if (requested.compare(usable) > 0) throw new Error("Payment does not have enough usable unapplied funds.");
  return { payment, usable };
}

async function updateSalesInvoiceBalance(tx: Tx, tenantId: string, invoiceId: string): Promise<void> {
  const invoice = await tx.sales_invoices.findUnique({
    where: { tenant_id_id: { tenant_id: tenantId, id: invoiceId } },
    select: { net_amount: true },
  });
  if (!invoice) throw new Error("Sales invoice does not belong to this tenant.");
  const allocated = await activeInvoiceAllocationTotal(tx, tenantId, "sales", invoiceId);
  const paid = money(allocated);
  await tx.sales_invoices.update({
    where: { tenant_id_id: { tenant_id: tenantId, id: invoiceId } },
    data: { paid_amount: paid.toNumber(), balance_due: money(invoice.net_amount).subtract(paid).toNumber() },
  });
}

export async function allocatePayment(input: AllocationInput): Promise<{ id: string; replayed: boolean }> {
  const amount = money(input.amount);
  if (amount.compare(0) <= 0) throw new Error("Allocation amount must be positive.");
  const payloadHash = hashPayload("ALLOCATE_PAYMENT", input);
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const existing = await tx.payment_allocations.findUnique({
      where: { tenant_id_idempotency_key: { tenant_id: input.tenantId, idempotency_key: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.request_payload_hash !== payloadHash) throw new Error("Allocation idempotency key was reused with a different payload.");
      return { id: existing.id, replayed: true };
    }
    const counterparty = await discoverPaymentCounterparty(tx, input.tenantId, input.paymentId);
    await lockCounterparty(tx, input.tenantId, counterparty.kind, counterparty.id);
    const payment = await lockPayment(tx, input.tenantId, input.paymentId);
    await lockInvoices(tx, input.tenantId, input.invoiceKind, [input.invoiceId]);
    const { usable } = await assertPaymentUsable(tx, input.tenantId, input.paymentId, amount, payment);
    const allocated = await activeInvoiceAllocationTotal(tx, input.tenantId, input.invoiceKind, input.invoiceId);
    const invoice = input.invoiceKind === "sales"
      ? await tx.sales_invoices.findUnique({ where: { tenant_id_id: { tenant_id: input.tenantId, id: input.invoiceId } }, select: { net_amount: true, status: true } })
      : await tx.purchase_invoices.findUnique({ where: { tenant_id_id: { tenant_id: input.tenantId, id: input.invoiceId } }, select: { net_amount: true, status: true } });
    if (!invoice || invoice.status !== "FINALIZED") throw new Error("Only finalized invoices can receive allocations.");
    const outstanding = money(invoice.net_amount).subtract(allocated);
    if (amount.compare(outstanding) > 0) throw new Error("Allocation exceeds the invoice's eligible outstanding amount.");
    if (amount.compare(usable) > 0) throw new Error("Allocation exceeds the payment's usable amount.");
    const row = await tx.payment_allocations.create({
      data: {
        tenant_id: input.tenantId,
        payment_id: input.paymentId,
        sales_invoice_id: input.invoiceKind === "sales" ? input.invoiceId : null,
        purchase_invoice_id: input.invoiceKind === "purchase" ? input.invoiceId : null,
        amount: amount.toNumber(),
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        allocated_by: input.actorId,
      },
    });
    if (input.invoiceKind === "sales") await updateSalesInvoiceBalance(tx, input.tenantId, input.invoiceId);
    return { id: row.id, replayed: false };
  });
}

export async function reverseAllocation(input: AllocationReversalInput): Promise<{ id: string; replayed: boolean }> {
  const payloadHash = hashPayload("REVERSE_ALLOCATION", input);
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const existing = await tx.allocation_reversals.findUnique({
      where: { tenant_id_idempotency_key: { tenant_id: input.tenantId, idempotency_key: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.request_payload_hash !== payloadHash) throw new Error("Reversal idempotency key was reused with a different payload.");
      return { id: existing.id, replayed: true };
    }
    const allocation = await tx.payment_allocations.findUnique({
      where: { tenant_id_id: { tenant_id: input.tenantId, id: input.allocationId } },
    });
    if (!allocation) throw new Error("Allocation does not belong to this tenant.");
    const counterparty = await discoverPaymentCounterparty(tx, input.tenantId, allocation.payment_id);
    await lockCounterparty(tx, input.tenantId, counterparty.kind, counterparty.id);
    const payment = await lockPayment(tx, input.tenantId, allocation.payment_id);
    const invoiceKind = allocation.sales_invoice_id ? "sales" : "purchase";
    const invoiceId = allocation.sales_invoice_id ?? allocation.purchase_invoice_id!;
    await lockInvoices(tx, input.tenantId, invoiceKind, [invoiceId]);
    const row = await tx.allocation_reversals.create({
      data: {
        tenant_id: input.tenantId,
        allocation_id: allocation.id,
        amount: allocation.amount,
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        reversed_by: input.actorId,
      },
    });
    if (allocation.sales_invoice_id) await updateSalesInvoiceBalance(tx, input.tenantId, allocation.sales_invoice_id);
    return { id: row.id, replayed: false };
  });
}

export async function completeRefund(input: RefundInput): Promise<{ id: string; replayed: boolean }> {
  const amount = money(input.amount);
  if (amount.compare(0) <= 0) throw new Error("Refund amount must be positive.");
  const payloadHash = hashPayload("COMPLETE_REFUND", input);
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const existing = await tx.payment_refunds.findUnique({
      where: { tenant_id_idempotency_key: { tenant_id: input.tenantId, idempotency_key: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.request_payload_hash !== payloadHash) throw new Error("Refund idempotency key was reused with a different payload.");
      return { id: existing.id, replayed: true };
    }
    const counterparty = await discoverPaymentCounterparty(tx, input.tenantId, input.paymentId);
    await lockCounterparty(tx, input.tenantId, counterparty.kind, counterparty.id);
    const payment = await lockPayment(tx, input.tenantId, input.paymentId);
    const allocations = await tx.payment_allocations.findMany({
      where: { tenant_id: input.tenantId, payment_id: input.paymentId, reversal: null },
      orderBy: [{ allocated_at: "asc" }, { id: "asc" }],
      select: { id: true, amount: true, sales_invoice_id: true, purchase_invoice_id: true },
    });
    await lockInvoices(
      tx,
      input.tenantId,
      "sales",
      allocations.flatMap((row) => row.sales_invoice_id ? [row.sales_invoice_id] : []),
    );
    await lockInvoices(
      tx,
      input.tenantId,
      "purchase",
      allocations.flatMap((row) => row.purchase_invoice_id ? [row.purchase_invoice_id] : []),
    );
    const refunded = await completedRefundTotal(tx, input.tenantId, input.paymentId);
    const reversal = await tx.payment_reversals.findUnique({
      where: { tenant_id_payment_id: { tenant_id: input.tenantId, payment_id: input.paymentId } },
    });
    const refundable = money(payment.amount).subtract(refunded).subtract(reversal?.amount ?? 0);
    if (amount.compare(refundable) > 0) throw new Error("Refund exceeds the payment's refundable amount.");
    let remaining = amount;
    for (const allocation of allocations) {
      if (remaining.compare(0) <= 0) break;
      if (remaining.compare(allocation.amount) < 0) {
        throw new Error("Refunds cannot partially reverse an allocation; refund the full allocation or an unapplied amount.");
      }
      const reversedAmount = remaining.compare(allocation.amount) < 0 ? remaining : money(allocation.amount);
      await tx.allocation_reversals.create({
        data: {
          tenant_id: input.tenantId,
          allocation_id: allocation.id,
          amount: reversedAmount.toNumber(),
          idempotency_key: `${input.idempotencyKey}:allocation:${allocation.id}`,
          request_payload_hash: payloadHash,
          reversed_by: input.actorId,
        },
      });
      if (allocation.sales_invoice_id) await updateSalesInvoiceBalance(tx, input.tenantId, allocation.sales_invoice_id);
      remaining = remaining.subtract(reversedAmount);
    }
    const row = await tx.payment_refunds.create({
      data: {
        tenant_id: input.tenantId,
        payment_id: input.paymentId,
        amount: amount.toNumber(),
        status: "COMPLETED",
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        requested_by: input.actorId,
        completed_by: input.actorId,
        completed_at: new Date(),
        reason: input.reason,
      },
    });
    if (payment.counterpartyKind === "customer") {
      await tx.customer_ledgers.create({
        data: {
          tenant_id: input.tenantId,
          customer_id: payment.counterpartyId,
          entry_type: "PAYMENT_RECEIVED",
          debit: amount.toNumber(),
          credit: 0,
          balance: 0,
          reference_type: "payment_refund",
          reference_id: row.id,
          narration: input.reason ?? "Payment refund completed",
          entry_date: new Date(),
        },
      });
      const customer = await tx.customers.findUnique({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        select: { receivable_balance: true },
      });
      await tx.customers.update({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        data: { receivable_balance: money(customer?.receivable_balance).add(amount).toNumber() },
      });
    } else {
      await tx.supplier_ledgers.create({
        data: {
          tenant_id: input.tenantId,
          supplier_id: payment.counterpartyId,
          entry_type: "PAYMENT_MADE",
          debit: 0,
          credit: amount.toNumber(),
          balance: 0,
          reference_type: "payment_refund",
          reference_id: row.id,
          narration: input.reason ?? "Payment refund completed",
          entry_date: new Date(),
        },
      });
      const supplier = await tx.suppliers.findUnique({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        select: { payable_balance: true },
      });
      await tx.suppliers.update({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        data: { payable_balance: money(supplier?.payable_balance).add(amount).toNumber() },
      });
    }
    return { id: row.id, replayed: false };
  });
}

export async function reversePayment(input: ReversalInput): Promise<{ id: string; replayed: boolean }> {
  const payloadHash = hashPayload("REVERSE_PAYMENT", input);
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const existing = await tx.payment_reversals.findUnique({
      where: { tenant_id_idempotency_key: { tenant_id: input.tenantId, idempotency_key: input.idempotencyKey } },
    });
    if (existing) {
      if (existing.request_payload_hash !== payloadHash) throw new Error("Payment reversal idempotency key was reused with a different payload.");
      return { id: existing.id, replayed: true };
    }
    const counterparty = await discoverPaymentCounterparty(tx, input.tenantId, input.paymentId);
    await lockCounterparty(tx, input.tenantId, counterparty.kind, counterparty.id);
    const payment = await lockPayment(tx, input.tenantId, input.paymentId);
    const allocations = await tx.payment_allocations.findMany({
      where: { tenant_id: input.tenantId, payment_id: input.paymentId, reversal: null },
      select: { id: true, sales_invoice_id: true, purchase_invoice_id: true },
    });
    const salesIds = allocations.flatMap((row) => row.sales_invoice_id ? [row.sales_invoice_id] : []);
    const purchaseIds = allocations.flatMap((row) => row.purchase_invoice_id ? [row.purchase_invoice_id] : []);
    await lockInvoices(tx, input.tenantId, "sales", salesIds);
    await lockInvoices(tx, input.tenantId, "purchase", purchaseIds);
    const reversed = await tx.payment_reversals.create({
      data: {
        tenant_id: input.tenantId,
        payment_id: input.paymentId,
        amount: money(payment.amount).toNumber(),
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        reversed_by: input.actorId,
        reason: input.reason,
      },
    });
    for (const allocation of allocations) {
      await tx.allocation_reversals.create({
        data: {
          tenant_id: input.tenantId,
          allocation_id: allocation.id,
          amount: (await tx.payment_allocations.findUniqueOrThrow({ where: { tenant_id_id: { tenant_id: input.tenantId, id: allocation.id } } })).amount,
          idempotency_key: `${input.idempotencyKey}:allocation:${allocation.id}`,
          request_payload_hash: payloadHash,
          reversed_by: input.actorId,
        },
      });
      if (allocation.sales_invoice_id) await updateSalesInvoiceBalance(tx, input.tenantId, allocation.sales_invoice_id);
    }
    return { id: reversed.id, replayed: false };
  });
}

export async function runReconciliationMutation<T>(
  ctx: TenantContext,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return retryTransaction(async (tx) => {
    await establishTenantContext(tx, ctx);
    return work(tx);
  });
}
