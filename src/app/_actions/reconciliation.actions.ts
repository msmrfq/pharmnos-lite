"use server";

import { PermissionAction } from "@prisma/client";
import {
  approveRefund,
  allocatePayment,
  cancelRefund,
  completeRefund,
  rejectRefund,
  requestRefund,
  reverseAllocation,
  reversePayment,
  type AllocationInput,
  type AllocationReversalInput,
  type RefundCompletionInput,
  type RefundRequestInput,
  type RefundTransitionInput,
  type ReversalInput,
} from "@/domain/services/financial-reconciliation.service";
import { assertPostgresConfigured } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";

function required(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required.`);
  return value.trim();
}

function positiveAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive.");
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

async function financialContext() {
  assertPostgresConfigured("financial reconciliation");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.create_payment);
  return ctx;
}

export async function listCustomerUnappliedCreditsAction(customerId: string) {
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_customer_ledger);
  return repos.payments.listCustomerUnappliedCredits(required(customerId, "Customer"), ctx);
}

export async function allocatePaymentAction(input: Omit<AllocationInput, "tenantId" | "actorId">) {
  const ctx = await financialContext();
  return allocatePayment({
    ...input,
    subjectId: ctx.subjectId,
    paymentId: required(input.paymentId, "Payment"),
    invoiceId: required(input.invoiceId, "Invoice"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    amount: positiveAmount(input.amount),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
  });
}

export async function applyCustomerCreditAction(
  input: Omit<AllocationInput, "tenantId" | "actorId" | "invoiceKind" | "subjectId"> & {
    customerId: string;
  },
) {
  const ctx = await financialContext();
  const customerId = required(input.customerId, "Customer");
  const paymentId = required(input.paymentId, "Payment");
  const invoiceId = required(input.invoiceId, "Invoice");
  return allocatePayment({
    subjectId: ctx.subjectId,
    paymentId,
    invoiceId,
    invoiceKind: "sales",
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    amount: positiveAmount(input.amount),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    expectedCounterpartyId: customerId,
  } as AllocationInput);
}

export async function listSupplierUnappliedAdvancesAction(supplierId: string) {
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_supplier_ledger);
  return repos.payments.listSupplierUnappliedAdvances(required(supplierId, "Supplier"), ctx);
}

export async function applySupplierAdvanceAction(
  input: Omit<AllocationInput, "tenantId" | "actorId" | "invoiceKind" | "subjectId"> & {
    supplierId: string;
  },
) {
  const ctx = await financialContext();
  const supplierId = required(input.supplierId, "Supplier");
  const paymentId = required(input.paymentId, "Payment");
  const invoiceId = required(input.invoiceId, "Invoice");
  return allocatePayment({
    subjectId: ctx.subjectId,
    paymentId,
    invoiceId,
    invoiceKind: "purchase",
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    amount: positiveAmount(input.amount),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    expectedCounterpartyId: supplierId,
  } as AllocationInput);
}

export async function reverseAllocationAction(
  input: Omit<AllocationReversalInput, "tenantId" | "actorId">,
) {
  const ctx = await financialContext();
  return reverseAllocation({
    ...input,
    subjectId: ctx.subjectId,
    allocationId: required(input.allocationId, "Allocation"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
  });
}

export async function requestCustomerRefundAction(
  input: Omit<RefundRequestInput, "tenantId" | "actorId" | "subjectId" | "counterpartyKind" | "counterpartyId"> & {
    customerId: string;
  },
) {
  const ctx = await financialContext();
  return requestRefund({
    ...input,
    subjectId: ctx.subjectId,
    paymentId: required(input.paymentId, "Payment"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    amount: positiveAmount(input.amount),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    counterpartyKind: "customer",
    counterpartyId: required(input.customerId, "Customer"),
  });
}

export async function requestSupplierRefundAction(
  input: Omit<RefundRequestInput, "tenantId" | "actorId" | "subjectId" | "counterpartyKind" | "counterpartyId"> & {
    supplierId: string;
  },
) {
  const ctx = await financialContext();
  return requestRefund({
    ...input,
    subjectId: ctx.subjectId,
    paymentId: required(input.paymentId, "Payment"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    amount: positiveAmount(input.amount),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
    counterpartyKind: "supplier",
    counterpartyId: required(input.supplierId, "Supplier"),
  });
}

function refundTransitionInput(
  ctx: Awaited<ReturnType<typeof requireServerTenantContext>>,
  input: Omit<RefundTransitionInput, "tenantId" | "actorId" | "subjectId">,
): RefundTransitionInput {
  return {
    ...input,
    subjectId: ctx.subjectId,
    refundId: required(input.refundId, "Refund"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
  };
}

export async function approveRefundAction(
  input: Omit<RefundTransitionInput, "tenantId" | "actorId" | "subjectId">,
) {
  const ctx = await financialContext();
  return approveRefund(refundTransitionInput(ctx, input));
}

export async function rejectRefundAction(
  input: Omit<RefundTransitionInput, "tenantId" | "actorId" | "subjectId">,
) {
  const ctx = await financialContext();
  return rejectRefund(refundTransitionInput(ctx, input));
}

export async function cancelRefundAction(
  input: Omit<RefundTransitionInput, "tenantId" | "actorId" | "subjectId">,
) {
  const ctx = await financialContext();
  return cancelRefund(refundTransitionInput(ctx, input));
}

export async function completeRefundAction(
  input: Omit<RefundCompletionInput, "tenantId" | "actorId" | "subjectId">,
) {
  const ctx = await financialContext();
  return completeRefund(refundTransitionInput(ctx, input));
}

export async function reversePaymentAction(input: Omit<ReversalInput, "tenantId" | "actorId">) {
  const ctx = await financialContext();
  return reversePayment({
    ...input,
    subjectId: ctx.subjectId,
    paymentId: required(input.paymentId, "Payment"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
  });
}
