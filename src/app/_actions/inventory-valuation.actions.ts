"use server";

import { createHash } from "node:crypto";
import { Prisma, type InventoryValuationAdjustmentKind, type InventoryValuationDecisionStatus, type PermissionAction } from "@prisma/client";
import { assertPostgresConfigured, prisma } from "@/lib/db/prisma";
import { establishTenantContext, requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import {
  calculateInventoryValuationAdjustment,
  resolveInventoryValuation,
  type InventoryEligibilityStatus,
} from "@/domain/services/inventory-valuation.service";

type ValuationSnapshotInput = {
  eligibilityStatus: InventoryEligibilityStatus;
  recoverableItc?: number | null;
  nonRecoverableGst?: number | null;
  approvedDirectAcquisitionCost?: number | null;
  policyVersion: string;
  decisionReference: string;
  rationale: string;
};

type ValuationDecisionInput = ValuationSnapshotInput & {
  purchaseId: string;
  purchaseItemId: string;
  batchId: string;
  stockMovementId?: string | null;
  idempotencyKey: string;
  status?: InventoryValuationDecisionStatus;
};

type ValuationAdjustmentInput = ValuationDecisionInput & {
  priorDecisionId: string;
  adjustmentKind: InventoryValuationAdjustmentKind;
};

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function finiteAmount(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite non-negative amount.`);
  return Number(value.toFixed(4));
}

function acceptedAmount(value: Prisma.Decimal | null | undefined): number {
  if (value === null || value === undefined) {
    throw new Error("Accepted GST evidence is required before valuation.");
  }
  const amount = value.toNumber();
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Accepted GST evidence is invalid.");
  return Number(amount.toFixed(4));
}

function snapshotFromDecision(decision: {
  recoverable_itc: Prisma.Decimal | null;
  non_recoverable_gst: Prisma.Decimal | null;
  inventory_acquisition_cost: Prisma.Decimal | null;
}) {
  if (
    decision.recoverable_itc === null ||
    decision.non_recoverable_gst === null ||
    decision.inventory_acquisition_cost === null
  ) {
    throw new Error("Only an approved valuation can be adjusted.");
  }
  return {
    recoverableItc: decision.recoverable_itc.toNumber(),
    nonRecoverableGst: decision.non_recoverable_gst.toNumber(),
    inventoryAcquisitionCost: decision.inventory_acquisition_cost.toNumber(),
  };
}

async function lockValuationTarget(tx: Prisma.TransactionClient, tenantId: string, input: ValuationDecisionInput) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        concat(${tenantId}, ':inventory-valuation:', ${input.batchId}),
        0
      )
    )
  `);
}

async function loadTarget(tx: Prisma.TransactionClient, tenantId: string, input: ValuationDecisionInput) {
  const purchase = await tx.purchase_invoices.findFirst({
    where: { id: input.purchaseId, tenant_id: tenantId },
    select: { id: true, status: true },
  });
  if (!purchase || purchase.status !== "FINALIZED") {
    throw new Error("Only a finalized purchase can receive an inventory valuation decision.");
  }

  const item = await tx.purchase_invoice_items.findFirst({
    where: { id: input.purchaseItemId, purchase_id: input.purchaseId, tenant_id: tenantId },
    select: {
      id: true,
      purchase_id: true,
      product_id: true,
      batch_no: true,
      accepted_taxable_value: true,
      accepted_cgst: true,
      accepted_sgst: true,
      accepted_igst: true,
      accepted_cess: true,
    },
  });
  if (!item) throw new Error("Purchase line was not found in the current tenant.");

  const batch = await tx.product_batches.findFirst({
    where: { id: input.batchId, tenant_id: tenantId, product_id: item.product_id, purchase_id: input.purchaseId, batch_no: item.batch_no },
    select: { id: true },
  });
  if (!batch) throw new Error("Product batch does not match the finalized purchase line.");

  let movementId: string | null = input.stockMovementId ?? null;
  if (movementId) {
    const movement = await tx.stock_movements.findFirst({
      where: { id: movementId, tenant_id: tenantId, batch_id: batch.id, reference_id: input.purchaseId },
      select: { id: true },
    });
    if (!movement) throw new Error("Stock movement does not match the valuation target.");
  }

  const acceptedTaxableValue = acceptedAmount(item.accepted_taxable_value);
  const acceptedGst = [
    item.accepted_cgst,
    item.accepted_sgst,
    item.accepted_igst,
    item.accepted_cess,
  ].reduce((sum, value) => sum + acceptedAmount(value), 0);

  return { purchase, item, batch, movementId, acceptedTaxableValue, acceptedGst };
}

function valuationData(
  input: ValuationDecisionInput,
  target: Awaited<ReturnType<typeof loadTarget>>,
  ctx: { membershipId: string },
) {
  const recoverableItc = finiteAmount(input.recoverableItc, "recoverableItc");
  const nonRecoverableGst = finiteAmount(input.nonRecoverableGst, "nonRecoverableGst");
  const directAcquisitionCost = finiteAmount(input.approvedDirectAcquisitionCost, "approvedDirectAcquisitionCost") ?? 0;
  const result = resolveInventoryValuation({
    acceptedTaxableValue: target.acceptedTaxableValue,
    acceptedGst: target.acceptedGst,
    eligibilityStatus: input.eligibilityStatus,
    recoverableItc,
    nonRecoverableGst,
    approvedDirectAcquisitionCost: directAcquisitionCost,
    policyVersion: input.policyVersion,
    decisionReference: input.decisionReference,
    decidedByMembershipId: ctx.membershipId,
  });
  const requestedStatus = input.status ?? (result.status === "APPROVED" ? "APPROVED" : result.status);
  if (requestedStatus === "APPROVED" && result.status !== "APPROVED") {
    throw new Error(result.reason ?? "Valuation is not complete enough to approve.");
  }
  if (requestedStatus === "REJECTED" && input.eligibilityStatus !== "REJECTED") {
    throw new Error("Rejected decisions require REJECTED eligibility.");
  }
  const approved = requestedStatus === "APPROVED";
  return {
    status: requestedStatus,
    accounting_status: approved ? ("PENDING_POLICY" as const) : ("NOT_APPLICABLE" as const),
    eligibility_status: input.eligibilityStatus,
    accepted_taxable_value: new Prisma.Decimal(target.acceptedTaxableValue),
    accepted_gst: new Prisma.Decimal(target.acceptedGst),
    recoverable_itc: approved ? new Prisma.Decimal(recoverableItc ?? 0) : null,
    non_recoverable_gst: approved ? new Prisma.Decimal(nonRecoverableGst ?? 0) : null,
    direct_acquisition_cost: new Prisma.Decimal(directAcquisitionCost),
    inventory_acquisition_cost: approved ? new Prisma.Decimal(result.inventoryAcquisitionCost ?? 0) : null,
    policy_version: input.policyVersion.trim(),
    decision_reference: input.decisionReference.trim(),
    rationale: input.rationale.trim(),
  };
}

export async function recordInventoryValuationDecisionAction(
  input: ValuationDecisionInput,
): Promise<ActionResult<{ decisionId: string; status: string }>> {
  try {
    assertPostgresConfigured("recordInventoryValuationDecisionAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "manage_batches" as PermissionAction);
    if (!input.idempotencyKey.trim() || !input.rationale.trim()) throw new Error("Idempotency key and rationale are required.");
    const payloadHash = hashPayload(input);
    const decision = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      await lockValuationTarget(tx, ctx.tenantId, input);
      const existing = await tx.inventory_valuation_decisions.findUnique({
        where: { tenant_id_idempotency_key: { tenant_id: ctx.tenantId, idempotency_key: input.idempotencyKey } },
        select: { id: true, status: true, request_payload_hash: true },
      });
      if (existing) {
        if (existing.request_payload_hash !== payloadHash) throw new Error("Idempotency key was already used with a different valuation payload.");
        return existing;
      }
      const target = await loadTarget(tx, ctx.tenantId, input);
      const priorApproved = await tx.inventory_valuation_decisions.findFirst({
        where: {
          tenant_id: ctx.tenantId,
          purchase_invoice_item_id: target.item.id,
          product_batch_id: target.batch.id,
          status: "APPROVED",
        },
        select: { id: true },
      });
      if (priorApproved) {
        throw new Error("An approved valuation already exists; record a correction or reversal instead.");
      }
      const data = valuationData(input, target, ctx);
      const created = await tx.inventory_valuation_decisions.create({
        data: {
          ...data,
          tenant_id: ctx.tenantId,
          purchase_invoice_id: target.purchase.id,
          purchase_invoice_item_id: target.item.id,
          product_batch_id: target.batch.id,
          stock_movement_id: target.movementId,
          idempotency_key: input.idempotencyKey,
          request_payload_hash: payloadHash,
          decided_by_membership_id: ctx.membershipId,
        },
      });
      await tx.purchase_invoice_items.updateMany({
        where: { tenant_id: ctx.tenantId, id: target.item.id },
        data: {
          recoverable_itc: data.recoverable_itc,
          non_recoverable_gst: data.non_recoverable_gst,
          inventory_acquisition_cost: data.inventory_acquisition_cost,
          inventory_valuation_status: data.status,
          inventory_valuation_policy_version: data.policy_version,
        },
      });
      await tx.product_batches.updateMany({
        where: { tenant_id: ctx.tenantId, id: target.batch.id },
        data: {
          inventory_acquisition_cost: data.inventory_acquisition_cost,
          inventory_valuation_status: data.status,
          inventory_valuation_policy_version: data.policy_version,
        },
      });
      if (target.movementId) {
        await tx.stock_movements.updateMany({
          where: { tenant_id: ctx.tenantId, id: target.movementId },
          data: {
            inventory_acquisition_cost: data.inventory_acquisition_cost,
            inventory_valuation_status: data.status,
            inventory_valuation_policy_version: data.policy_version,
          },
        });
      }
      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          event_type: "STOCK_ADJUSTED",
          actor_id: ctx.userId,
          target_type: "inventory_valuation_decision",
          target_id: created.id,
          metadata: { status: data.status, accountingStatus: data.accounting_status, policyVersion: data.policy_version },
        },
      });
      return created;
    });
    return { ok: true, data: { decisionId: decision.id, status: decision.status }, message: "Inventory valuation decision recorded." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Inventory valuation decision failed." };
  }
}

export async function recordInventoryValuationAdjustmentAction(
  input: ValuationAdjustmentInput,
): Promise<ActionResult<{ decisionId: string; adjustmentId: string; status: string }>> {
  try {
    assertPostgresConfigured("recordInventoryValuationAdjustmentAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "manage_batches" as PermissionAction);
    const payloadHash = hashPayload(input);
    const result = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      await lockValuationTarget(tx, ctx.tenantId, input);
      const existing = await tx.inventory_valuation_adjustments.findUnique({
        where: { tenant_id_idempotency_key: { tenant_id: ctx.tenantId, idempotency_key: input.idempotencyKey } },
        select: { id: true, resulting_decision_id: true, request_payload_hash: true },
      });
      if (existing) {
        if (existing.request_payload_hash !== payloadHash) throw new Error("Idempotency key was already used with a different adjustment payload.");
        return { decisionId: existing.resulting_decision_id, adjustmentId: existing.id, status: "REPLAYED" };
      }
      const prior = await tx.inventory_valuation_decisions.findFirst({
        where: { id: input.priorDecisionId, tenant_id: ctx.tenantId, status: "APPROVED" },
      });
      if (!prior) throw new Error("Only an approved valuation decision can be adjusted.");
      const target = await loadTarget(tx, ctx.tenantId, input);
      if (
        prior.purchase_invoice_id !== target.purchase.id ||
        prior.purchase_invoice_item_id !== target.item.id ||
        prior.product_batch_id !== target.batch.id ||
        prior.stock_movement_id !== target.movementId
      ) {
        throw new Error("Adjustment target does not match the prior valuation decision.");
      }
      const data = valuationData(input, target, ctx);
      const previousSnapshot = snapshotFromDecision(prior);
      const nextSnapshot = {
        recoverableItc: data.recoverable_itc?.toNumber() ?? 0,
        nonRecoverableGst: data.non_recoverable_gst?.toNumber() ?? 0,
        inventoryAcquisitionCost: data.inventory_acquisition_cost?.toNumber() ?? 0,
      };
      const delta = calculateInventoryValuationAdjustment(previousSnapshot, nextSnapshot);
      const created = await tx.inventory_valuation_decisions.create({
        data: {
          ...data,
          tenant_id: ctx.tenantId,
          purchase_invoice_id: target.purchase.id,
          purchase_invoice_item_id: target.item.id,
          product_batch_id: target.batch.id,
          stock_movement_id: target.movementId,
          idempotency_key: input.idempotencyKey,
          request_payload_hash: payloadHash,
          supersedes_decision_id: prior.id,
          decided_by_membership_id: ctx.membershipId,
        },
      });
      const adjustment = await tx.inventory_valuation_adjustments.create({
        data: {
          tenant_id: ctx.tenantId,
          prior_decision_id: prior.id,
          resulting_decision_id: created.id,
          adjustment_kind: input.adjustmentKind,
          recoverable_itc_delta: new Prisma.Decimal(delta.recoverableItcDelta),
          non_recoverable_gst_delta: new Prisma.Decimal(delta.nonRecoverableGstDelta),
          inventory_cost_delta: new Prisma.Decimal(delta.inventoryAcquisitionCostDelta),
          reason: input.rationale.trim(),
          idempotency_key: input.idempotencyKey,
          request_payload_hash: payloadHash,
          adjusted_by_membership_id: ctx.membershipId,
        },
      });
      await tx.purchase_invoice_items.updateMany({ where: { tenant_id: ctx.tenantId, id: target.item.id }, data: { recoverable_itc: data.recoverable_itc, non_recoverable_gst: data.non_recoverable_gst, inventory_acquisition_cost: data.inventory_acquisition_cost, inventory_valuation_status: data.status, inventory_valuation_policy_version: data.policy_version } });
      await tx.product_batches.updateMany({ where: { tenant_id: ctx.tenantId, id: target.batch.id }, data: { inventory_acquisition_cost: data.inventory_acquisition_cost, inventory_valuation_status: data.status, inventory_valuation_policy_version: data.policy_version } });
      if (target.movementId) await tx.stock_movements.updateMany({ where: { tenant_id: ctx.tenantId, id: target.movementId }, data: { inventory_acquisition_cost: data.inventory_acquisition_cost, inventory_valuation_status: data.status, inventory_valuation_policy_version: data.policy_version } });
      return { decisionId: created.id, adjustmentId: adjustment.id, status: created.status };
    });
    return { ok: true, data: result, message: "Inventory valuation adjustment recorded." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Inventory valuation adjustment failed." };
  }
}
