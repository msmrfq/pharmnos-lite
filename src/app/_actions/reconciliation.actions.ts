"use server";

import { PermissionAction } from "@prisma/client";
import {
  allocatePayment,
  completeRefund,
  reverseAllocation,
  reversePayment,
  type AllocationInput,
  type AllocationReversalInput,
  type RefundInput,
  type ReversalInput,
} from "@/domain/services/financial-reconciliation.service";
import { assertPostgresConfigured } from "@/lib/db/prisma";
import {
  requirePermission,
  requireServerTenantContext,
} from "@/lib/db/tenant-context";

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

export async function completeRefundAction(input: Omit<RefundInput, "tenantId" | "actorId">) {
  const ctx = await financialContext();
  return completeRefund({
    ...input,
    subjectId: ctx.subjectId,
    paymentId: required(input.paymentId, "Payment"),
    idempotencyKey: required(input.idempotencyKey, "Idempotency key"),
    amount: positiveAmount(input.amount),
    tenantId: ctx.tenantId,
    actorId: ctx.userId,
  });
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
