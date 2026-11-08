import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { establishTenantContext, type TenantContext } from "@/lib/db/tenant-context";
import { decimalOrZero } from "@/lib/decimal";

type Tx = Prisma.TransactionClient;
type CounterpartyKind = "customer" | "supplier";
type InvoiceKind = "sales" | "purchase";
type Money = ReturnType<typeof decimalOrZero>;

function sumReversals(rows: Array<{ amount: unknown }>): Money {
  return rows.reduce((total, row) => total.add(money(row.amount)), decimalOrZero(0));
}

export type AllocationInput = {
  tenantId: string;
  subjectId: string;
  paymentId: string;
  invoiceId: string;
  invoiceKind: InvoiceKind;
  expectedCounterpartyId?: string;
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

export type RefundRequestInput = {
  tenantId: string;
  subjectId: string;
  paymentId: string;
  counterpartyKind: CounterpartyKind;
  counterpartyId: string;
  amount: number;
  idempotencyKey: string;
  actorId?: string;
  reason?: string;
};

export type RefundTransitionInput = {
  tenantId: string;
  subjectId: string;
  refundId: string;
  idempotencyKey: string;
  actorId?: string;
  reason?: string;
};

export type RefundCompletionInput = RefundTransitionInput;

function hashPayload(operation: string, value: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, value }), "utf8").digest("hex");
}

function money(value: unknown): Money {
  return decimalOrZero(value as any).round(2, "HALF_UP");
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2034" ||
    (error.code === "P2010" && String((error.meta as { code?: unknown } | undefined)?.code ?? "") === "40001");
}

async function retryTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  let lastError: unknown;
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === maxAttempts - 1) throw error;
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
    where: { tenant_id: tenantId, payment_id: paymentId },
    select: { amount: true, reversal: { select: { amount: true } } },
  });
  return rows.reduce(
    (total, row) => total.add(money(row.amount).subtract(sumReversals(row.reversal))),
    decimalOrZero(0),
  );
}

async function activeInvoiceAllocationTotal(
  tx: Tx,
  tenantId: string,
  invoiceKind: InvoiceKind,
  invoiceId: string,
): Promise<Money> {
  const where = invoiceKind === "sales"
    ? { tenant_id: tenantId, sales_invoice_id: invoiceId }
    : { tenant_id: tenantId, purchase_invoice_id: invoiceId };
  const rows = await tx.payment_allocations.findMany({
    where,
    select: { amount: true, reversal: { select: { amount: true } } },
  });
  return rows.reduce(
    (total, row) => total.add(money(row.amount).subtract(sumReversals(row.reversal))),
    decimalOrZero(0),
  );
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

async function updateSupplierPayable(tx: Tx, tenantId: string, supplierId: string, delta: Money): Promise<void> {
  const supplier = await tx.suppliers.findUnique({
    where: { tenant_id_id: { tenant_id: tenantId, id: supplierId } },
    select: { payable_balance: true },
  });
  if (!supplier) throw new Error("Supplier does not belong to this tenant.");
  await tx.suppliers.update({
    where: { tenant_id_id: { tenant_id: tenantId, id: supplierId } },
    data: { payable_balance: money(supplier.payable_balance).add(delta).toNumber() },
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
    const invoiceOwner = input.invoiceKind === "sales"
      ? await tx.sales_invoices.findUnique({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: input.invoiceId } },
        select: { customer_id: true },
      })
      : await tx.purchase_invoices.findUnique({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: input.invoiceId } },
        select: { supplier_id: true },
      });
    const invoiceCounterpartyId = input.invoiceKind === "sales"
      ? (invoiceOwner as { customer_id: string | null } | null)?.customer_id ?? null
      : (invoiceOwner as { supplier_id: string } | null)?.supplier_id ?? null;
    if (!invoiceCounterpartyId || payment.counterpartyId !== invoiceCounterpartyId ||
      (input.expectedCounterpartyId && (
        payment.counterpartyId !== input.expectedCounterpartyId ||
        invoiceCounterpartyId !== input.expectedCounterpartyId
      ))) {
      throw new Error("Payment and invoice do not belong to the requested counterparty.");
    }
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
    await tx.audit_logs.create({
      data: {
        tenant_id: input.tenantId,
        event_type: "ALLOCATION_CREATED",
        actor_id: input.actorId,
        target_type: "payment_allocation",
        target_id: row.id,
        metadata: {
          paymentId: input.paymentId,
          invoiceId: input.invoiceId,
          invoiceKind: input.invoiceKind,
          amount: amount.toNumber(),
          idempotencyKey: input.idempotencyKey,
        },
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
      include: { reversal: { select: { amount: true } } },
    });
    if (!allocation) throw new Error("Allocation does not belong to this tenant.");
    const reversedAmount = sumReversals(allocation.reversal);
    const remainingAmount = money(allocation.amount).subtract(reversedAmount);
    if (remainingAmount.compare(0) <= 0) throw new Error("Allocation has already been fully reversed.");
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
        amount: remainingAmount.toNumber(),
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        reversed_by: input.actorId,
      },
    });
    await tx.audit_logs.create({
      data: {
        tenant_id: input.tenantId,
        event_type: "ALLOCATION_REVERSED",
        actor_id: input.actorId,
        target_type: "allocation_reversal",
        target_id: row.id,
        metadata: { allocationId: allocation.id, amount: remainingAmount.toNumber(), idempotencyKey: input.idempotencyKey },
      },
    });
    if (allocation.sales_invoice_id) await updateSalesInvoiceBalance(tx, input.tenantId, allocation.sales_invoice_id);
    return { id: row.id, replayed: false };
  });
}

type RefundAction = "REQUEST" | "APPROVE" | "REJECT" | "CANCEL" | "COMPLETE";
type RefundAuditEvent =
  | "REFUND_REQUESTED"
  | "REFUND_APPROVED"
  | "REFUND_REJECTED"
  | "REFUND_CANCELLED"
  | "REFUND_COMPLETED";

function requiredActor(actorId: string | undefined): string {
  if (!actorId) throw new Error("Refund actor is required.");
  return actorId;
}

async function findRefundActionReplay(
  tx: Tx,
  tenantId: string,
  idempotencyKey: string,
  eventType: RefundAuditEvent,
  payloadHash: string,
  refundId?: string,
): Promise<{ id: string; replayed: true } | null> {
  const rows = await tx.$queryRaw<Array<{ target_id: string; event_type: string; metadata: unknown }>>(Prisma.sql`
    SELECT target_id, event_type::text AS event_type, metadata
    FROM "audit_logs"
    WHERE tenant_id = ${tenantId}
      AND target_type = 'payment_refund'
      AND metadata ->> 'refundLifecycleVersion' = '1'
      AND metadata ->> 'idempotencyKey' = ${idempotencyKey}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  const metadata = row.metadata && typeof row.metadata === "object"
    ? row.metadata as Record<string, unknown>
    : {};
  if (row.event_type !== eventType ||
      metadata.payloadHash !== payloadHash ||
      (refundId !== undefined && row.target_id !== refundId)) {
    throw new Error("Refund idempotency key was reused with a different action or payload.");
  }
  return { id: row.target_id, replayed: true };
}

async function recordRefundAction(
  tx: Tx,
  input: RefundTransitionInput,
  eventType: RefundAuditEvent,
  payloadHash: string,
  details: Record<string, unknown>,
): Promise<void> {
  await tx.audit_logs.create({
    data: {
      tenant_id: input.tenantId,
      event_type: eventType,
      actor_id: requiredActor(input.actorId),
      target_type: "payment_refund",
      target_id: input.refundId,
      metadata: {
        refundLifecycleVersion: 1,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        ...details,
      },
    },
  });
}

async function lockRefundPayment(
  tx: Tx,
  tenantId: string,
  refundId: string,
) {
  const before = await tx.payment_refunds.findUnique({
    where: { tenant_id_id: { tenant_id: tenantId, id: refundId } },
  });
  if (!before) throw new Error("Refund does not belong to this tenant.");
  const counterparty = await discoverPaymentCounterparty(tx, tenantId, before.payment_id);
  await lockCounterparty(tx, tenantId, counterparty.kind, counterparty.id);
  const payment = await lockPayment(tx, tenantId, before.payment_id);
  const refund = await tx.payment_refunds.findUnique({
    where: { tenant_id_id: { tenant_id: tenantId, id: refundId } },
  });
  if (!refund || refund.payment_id !== payment.id ||
      payment.counterpartyKind !== counterparty.kind ||
      payment.counterpartyId !== counterparty.id) {
    throw new Error("Refund payment or counterparty changed during processing.");
  }
  return { refund, payment };
}

async function assertRefundableAmount(
  tx: Tx,
  tenantId: string,
  paymentId: string,
  paymentAmount: unknown,
  requested: Money,
): Promise<void> {
  const refunded = await completedRefundTotal(tx, tenantId, paymentId);
  const reversal = await tx.payment_reversals.findUnique({
    where: { tenant_id_payment_id: { tenant_id: tenantId, payment_id: paymentId } },
  });
  const refundable = money(paymentAmount).subtract(refunded).subtract(reversal?.amount ?? 0);
  if (requested.compare(refundable) > 0) {
    throw new Error("Refund exceeds the payment's refundable amount.");
  }
}

export async function requestRefund(input: RefundRequestInput): Promise<{ id: string; replayed: boolean }> {
  const actorId = requiredActor(input.actorId);
  const amount = money(input.amount);
  if (amount.compare(0) <= 0) throw new Error("Refund amount must be positive.");
  const payloadHash = hashPayload("REQUEST_REFUND", {
    paymentId: input.paymentId,
    counterpartyKind: input.counterpartyKind,
    counterpartyId: input.counterpartyId,
    amount: amount.toString(),
    reason: input.reason ?? null,
  });
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const existing = await tx.payment_refunds.findUnique({
      where: {
        tenant_id_idempotency_key: {
          tenant_id: input.tenantId,
          idempotency_key: input.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.request_payload_hash !== payloadHash) {
        throw new Error("Refund idempotency key was reused with a different payload.");
      }
      return { id: existing.id, replayed: true };
    }
    const actionReplay = await findRefundActionReplay(
      tx,
      input.tenantId,
      input.idempotencyKey,
      "REFUND_REQUESTED",
      payloadHash,
    );
    if (actionReplay) return actionReplay;
    const counterparty = await discoverPaymentCounterparty(tx, input.tenantId, input.paymentId);
    if (counterparty.kind !== input.counterpartyKind || counterparty.id !== input.counterpartyId) {
      throw new Error("Payment does not belong to the requested counterparty.");
    }
    await lockCounterparty(tx, input.tenantId, counterparty.kind, counterparty.id);
    const payment = await lockPayment(tx, input.tenantId, input.paymentId);
    if (payment.counterpartyKind !== input.counterpartyKind || payment.counterpartyId !== input.counterpartyId) {
      throw new Error("Payment does not belong to the requested counterparty.");
    }
    await assertRefundableAmount(tx, input.tenantId, payment.id, payment.amount, amount);
    const row = await tx.payment_refunds.create({
      data: {
        tenant_id: input.tenantId,
        payment_id: payment.id,
        amount: amount.toNumber(),
        status: "REQUESTED",
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        requested_by: actorId,
        reason: input.reason,
      },
    });
    await recordRefundAction(
      tx,
      { ...input, refundId: row.id },
      "REFUND_REQUESTED",
      payloadHash,
      { paymentId: payment.id, amount: amount.toNumber(), reason: input.reason ?? null },
    );
    return { id: row.id, replayed: false };
  });
}

type RefundTransition = {
  action: Exclude<RefundAction, "REQUEST" | "COMPLETE">;
  from: "REQUESTED" | "APPROVED" | Array<"REQUESTED" | "APPROVED">;
  to: "APPROVED" | "REJECTED" | "CANCELLED";
  eventType: Exclude<RefundAuditEvent, "REFUND_REQUESTED" | "REFUND_COMPLETED">;
  actorField: "approved_by" | "rejected_by" | "cancelled_by";
  timestampField: "approved_at" | "rejected_at" | "cancelled_at";
};

async function transitionRefund(
  input: RefundTransitionInput,
  transition: RefundTransition,
): Promise<{ id: string; replayed: boolean }> {
  const actorId = requiredActor(input.actorId);
  const payloadHash = hashPayload(`${transition.action}_REFUND`, {
    refundId: input.refundId,
    reason: input.reason ?? null,
  });
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const replay = await findRefundActionReplay(
      tx,
      input.tenantId,
      input.idempotencyKey,
      transition.eventType,
      payloadHash,
      input.refundId,
    );
    if (replay) return replay;
    const { refund, payment } = await lockRefundPayment(tx, input.tenantId, input.refundId);
    const lockedReplay = await findRefundActionReplay(
      tx,
      input.tenantId,
      input.idempotencyKey,
      transition.eventType,
      payloadHash,
      input.refundId,
    );
    if (lockedReplay) return lockedReplay;
    const from = Array.isArray(transition.from) ? transition.from : [transition.from];
    if (!from.includes(refund.status as "REQUESTED" | "APPROVED")) {
      throw new Error(`Refund cannot transition from ${refund.status} to ${transition.to}.`);
    }
    if (transition.to === "APPROVED") {
      await assertRefundableAmount(tx, input.tenantId, payment.id, payment.amount, money(refund.amount));
    }
    const timestamp = new Date();
    await tx.payment_refunds.update({
      where: { tenant_id_id: { tenant_id: input.tenantId, id: refund.id } },
      data: {
        status: transition.to,
        [transition.actorField]: actorId,
        [transition.timestampField]: timestamp,
        resolution_reason: input.reason,
      },
    });
    await recordRefundAction(tx, input, transition.eventType, payloadHash, {
      paymentId: payment.id,
      amount: money(refund.amount).toNumber(),
      reason: input.reason ?? null,
    });
    return { id: refund.id, replayed: false };
  });
}

export function approveRefund(input: RefundTransitionInput) {
  return transitionRefund(input, {
    action: "APPROVE",
    from: "REQUESTED",
    to: "APPROVED",
    eventType: "REFUND_APPROVED",
    actorField: "approved_by",
    timestampField: "approved_at",
  });
}

export function rejectRefund(input: RefundTransitionInput) {
  return transitionRefund(input, {
    action: "REJECT",
    from: "REQUESTED",
    to: "REJECTED",
    eventType: "REFUND_REJECTED",
    actorField: "rejected_by",
    timestampField: "rejected_at",
  });
}

export function cancelRefund(input: RefundTransitionInput) {
  return transitionRefund(input, {
    action: "CANCEL",
    from: ["REQUESTED", "APPROVED"],
    to: "CANCELLED",
    eventType: "REFUND_CANCELLED",
    actorField: "cancelled_by",
    timestampField: "cancelled_at",
  });
}

export async function completeRefund(
  input: RefundCompletionInput,
): Promise<{ id: string; replayed: boolean }> {
  const actorId = requiredActor(input.actorId);
  const payloadHash = hashPayload("COMPLETE_REFUND", {
    refundId: input.refundId,
    reason: input.reason ?? null,
  });
  return retryTransaction(async (tx) => {
    await establishFinancialContext(tx, input.tenantId, input.subjectId);
    const replay = await findRefundActionReplay(
      tx,
      input.tenantId,
      input.idempotencyKey,
      "REFUND_COMPLETED",
      payloadHash,
      input.refundId,
    );
    if (replay) return replay;
    const { refund: initialRefund } = await lockRefundPayment(tx, input.tenantId, input.refundId);
    const allocationSnapshot = await tx.payment_allocations.findMany({
      where: { tenant_id: input.tenantId, payment_id: initialRefund.payment_id },
      select: { sales_invoice_id: true, purchase_invoice_id: true },
    });
    await lockInvoices(
      tx,
      input.tenantId,
      "sales",
      allocationSnapshot.flatMap((row) => row.sales_invoice_id ? [row.sales_invoice_id] : []),
    );
    await lockInvoices(
      tx,
      input.tenantId,
      "purchase",
      allocationSnapshot.flatMap((row) => row.purchase_invoice_id ? [row.purchase_invoice_id] : []),
    );
    const lockedReplay = await findRefundActionReplay(
      tx,
      input.tenantId,
      input.idempotencyKey,
      "REFUND_COMPLETED",
      payloadHash,
      input.refundId,
    );
    if (lockedReplay) return lockedReplay;
    const { refund, payment } = await lockRefundPayment(tx, input.tenantId, input.refundId);
    if (refund.status !== "APPROVED") {
      throw new Error(`Only an approved refund can be completed; current status is ${refund.status}.`);
    }
    const amount = money(refund.amount);
    await assertRefundableAmount(tx, input.tenantId, payment.id, payment.amount, amount);
    const allocations = await tx.payment_allocations.findMany({
      where: { tenant_id: input.tenantId, payment_id: payment.id },
      orderBy: [{ allocated_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        amount: true,
        sales_invoice_id: true,
        purchase_invoice_id: true,
        reversal: { select: { amount: true } },
      },
    });
    const activeAllocations = allocations
      .map((allocation) => ({
        ...allocation,
        remainingAmount: money(allocation.amount).subtract(sumReversals(allocation.reversal)),
      }))
      .filter((allocation) => allocation.remainingAmount.compare(0) > 0);
    let remaining = amount;
    for (const allocation of activeAllocations) {
      if (remaining.compare(0) <= 0) break;
      const reversedAmount = remaining.compare(allocation.remainingAmount) < 0
        ? remaining
        : allocation.remainingAmount;
      const reversalKey = `${input.idempotencyKey}:allocation:${allocation.id}`;
      const reversalPayloadHash = hashPayload("REFUND_ALLOCATION_REVERSAL", {
        refundId: refund.id,
        allocationId: allocation.id,
        amount: reversedAmount.toString(),
      });
      const reversalRow = await tx.allocation_reversals.create({
        data: {
          tenant_id: input.tenantId,
          allocation_id: allocation.id,
          amount: reversedAmount.toNumber(),
          idempotency_key: reversalKey,
          request_payload_hash: reversalPayloadHash,
          reversed_by: actorId,
        },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: input.tenantId,
          event_type: "ALLOCATION_REVERSED",
          actor_id: actorId,
          target_type: "allocation_reversal",
          target_id: reversalRow.id,
          metadata: {
            allocationId: allocation.id,
            refundId: refund.id,
            amount: reversedAmount.toNumber(),
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (allocation.sales_invoice_id) {
        await updateSalesInvoiceBalance(tx, input.tenantId, allocation.sales_invoice_id);
      }
      remaining = remaining.subtract(reversedAmount);
    }
    const timestamp = new Date();
    await tx.payment_refunds.update({
      where: { tenant_id_id: { tenant_id: input.tenantId, id: refund.id } },
      data: {
        status: "COMPLETED",
        completed_by: actorId,
        completed_at: timestamp,
        resolution_reason: input.reason ?? refund.resolution_reason,
      },
    });
    await recordRefundAction(tx, input, "REFUND_COMPLETED", payloadHash, {
      paymentId: payment.id,
      amount: amount.toNumber(),
      reason: input.reason ?? null,
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
          reference_id: refund.id,
          narration: input.reason ?? "Payment refund completed",
          entry_date: timestamp,
        },
      });
      const customer = await tx.customers.findUnique({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        select: { receivable_balance: true },
      });
      if (!customer) throw new Error("Customer does not belong to this tenant.");
      await tx.customers.update({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        data: { receivable_balance: money(customer.receivable_balance).add(amount).toNumber() },
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
          reference_id: refund.id,
          narration: input.reason ?? "Payment refund completed",
          entry_date: timestamp,
        },
      });
      await updateSupplierPayable(tx, input.tenantId, payment.counterpartyId, amount);
    }
    return { id: refund.id, replayed: false };
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
      where: { tenant_id: input.tenantId, payment_id: input.paymentId },
      select: { id: true, amount: true, sales_invoice_id: true, purchase_invoice_id: true, reversal: { select: { amount: true } } },
    });
    const activeAllocations = allocations
      .map((allocation) => ({ ...allocation, remainingAmount: money(allocation.amount).subtract(sumReversals(allocation.reversal)) }))
      .filter((allocation) => allocation.remainingAmount.compare(0) > 0);
    const salesIds = activeAllocations.flatMap((row) => row.sales_invoice_id ? [row.sales_invoice_id] : []);
    const purchaseIds = activeAllocations.flatMap((row) => row.purchase_invoice_id ? [row.purchase_invoice_id] : []);
    await lockInvoices(tx, input.tenantId, "sales", salesIds);
    await lockInvoices(tx, input.tenantId, "purchase", purchaseIds);
    const refunded = await completedRefundTotal(tx, input.tenantId, input.paymentId);
    const reversed = await tx.payment_reversals.create({
      data: {
        tenant_id: input.tenantId,
        payment_id: input.paymentId,
        amount: money(payment.amount).subtract(refunded).toNumber(),
        idempotency_key: input.idempotencyKey,
        request_payload_hash: payloadHash,
        reversed_by: input.actorId,
        reason: input.reason,
      },
    });
    await tx.audit_logs.create({
      data: {
        tenant_id: input.tenantId,
        event_type: "PAYMENT_REVERSED",
        actor_id: input.actorId,
        target_type: "payment_reversal",
        target_id: reversed.id,
        metadata: { paymentId: input.paymentId, amount: reversed.amount, idempotencyKey: input.idempotencyKey },
      },
    });
    for (const allocation of activeAllocations) {
      const reversalRow = await tx.allocation_reversals.create({
        data: {
          tenant_id: input.tenantId,
          allocation_id: allocation.id,
          amount: allocation.remainingAmount.toNumber(),
          idempotency_key: `${input.idempotencyKey}:allocation:${allocation.id}`,
          request_payload_hash: payloadHash,
          reversed_by: input.actorId,
        },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: input.tenantId,
          event_type: "ALLOCATION_REVERSED",
          actor_id: input.actorId,
          target_type: "allocation_reversal",
          target_id: reversalRow.id,
          metadata: { allocationId: allocation.id, amount: allocation.remainingAmount.toNumber(), idempotencyKey: input.idempotencyKey },
        },
      });
      if (allocation.sales_invoice_id) await updateSalesInvoiceBalance(tx, input.tenantId, allocation.sales_invoice_id);
    }
    if (payment.counterpartyKind === "customer") {
      await tx.customer_ledgers.create({
        data: {
          tenant_id: input.tenantId,
          customer_id: payment.counterpartyId,
          entry_type: "PAYMENT_RECEIVED",
          debit: reversed.amount,
          credit: 0,
          balance: 0,
          reference_type: "payment_reversal",
          reference_id: reversed.id,
          narration: input.reason ?? "Payment reversal completed",
          entry_date: new Date(),
        },
      });
      const customer = await tx.customers.findUnique({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        select: { receivable_balance: true },
      });
      if (!customer) throw new Error("Customer does not belong to this tenant.");
      await tx.customers.update({
        where: { tenant_id_id: { tenant_id: input.tenantId, id: payment.counterpartyId } },
        data: { receivable_balance: money(customer.receivable_balance).add(reversed.amount).toNumber() },
      });
    } else {
      await tx.supplier_ledgers.create({
        data: {
          tenant_id: input.tenantId,
          supplier_id: payment.counterpartyId,
          entry_type: "PAYMENT_MADE",
          debit: 0,
          credit: reversed.amount,
          balance: 0,
          reference_type: "payment_reversal",
          reference_id: reversed.id,
          narration: input.reason ?? "Payment reversal completed",
          entry_date: new Date(),
        },
      });
      await updateSupplierPayable(tx, input.tenantId, payment.counterpartyId, money(reversed.amount));
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
