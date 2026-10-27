"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import { Prisma } from "@prisma/client";
import type { purchase_invoices, InvoiceStatus, StockMovementType, LedgerEntryType, PermissionAction } from "@prisma/client";
import { calculatePurchaseInvoiceTotals, calculatePurchaseLineTotals } from "@/domain/services/purchase-calculator.service";
import {
  calculatePurchaseGstExpected,
  canCompletePurchaseAccounting,
  reconcilePurchaseGstEvidence,
  resolvePurchaseGstReconciliation,
  type AccountingAcceptedPurchaseGst,
  type SupplierDeclaredPurchaseGstEvidence,
  type PurchaseGstResolution,
} from "@/domain/services/purchase-gst-reconciliation.service";
import {
  PurchaseInvoiceCreateSchema,
  PurchaseInvoiceLineCreateSchema,
  PurchaseGstAcceptanceSchema,
  PurchaseGstResolutionSchema,
  StockAdjustmentSchema,
  STORAGE_PURCHASE_STATUS_DRAFT,
  STORAGE_PURCHASE_STATUS_FINALIZED,
  STORAGE_PURCHASE_STATUS_CANCELLED,
} from "@/lib/validation/purchases.schemas";

const __PurchaseStatusDRAFT: InvoiceStatus = "DRAFT";
const __PurchaseStatusFINALIZED: InvoiceStatus = "FINALIZED";
const __PurchaseStatusCANCELLED: InvoiceStatus = "CANCELLED";
const __MovementPURCHASE_IN: StockMovementType = "PURCHASE_IN";
const __MovementADJUSTMENT_IN: StockMovementType = "ADJUSTMENT_IN";
const __MovementADJUSTMENT_OUT: StockMovementType = "ADJUSTMENT_OUT";
const __LedgerEntryPURCHASE: LedgerEntryType = "PURCHASE";

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function flattenFieldErrors(zodFieldErrors: Record<string, any>): Record<string, string[] | undefined> {
  const out: Record<string, string[] | undefined> = {};
  for (const key of Object.keys(zodFieldErrors)) {
    const v = zodFieldErrors[key];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[key] = v as string[];
    } else if (typeof v === "string") {
      out[key] = [v];
    } else if (v !== null && typeof v === "object") {
      const nested = flattenFieldErrors(v as Record<string, any>);
      for (const nk of Object.keys(nested)) {
        out[`${key}.${nk}`] = nested[nk];
      }
    }
  }
  return out;
}

function parseIndexedPurchaseLinesFromFormData(formData: FormData): any[] {
  const lines: Array<Record<string, any>> = [];
  for (const [rawKey, value] of formData.entries()) {
    const key = String(rawKey);
    const m = key.match(/^lines\[(\d+)\]\.(.+)$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2];
    if (!Number.isFinite(idx) || !field) continue;
    while (lines.length <= idx) lines.push({});
    const slot = lines[idx];
    if (!slot) continue;
    if (value !== null && value !== undefined) {
      slot[field] = String(value);
    }
  }
  return lines.filter((l) => Object.keys(l).length > 0);
}

function formDataToPurchaseObject(formData: FormData): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [rawKey, value] of formData.entries()) {
    const key = String(rawKey);
    if (key.startsWith("lines[")) continue;
    out[key] = value === null ? "" : String(value);
  }
  return out;
}

function decimalOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? round2(n) : null;
  }

  function requestHash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  function purchaseAmountFactsFromRecord(record: {
    taxable_value: unknown;
    cgst: unknown;
    sgst: unknown;
    igst: unknown;
    cess: unknown;
    invoice_total: unknown;
    round_off: unknown;
  }) {
    return {
      taxable_value: record.taxable_value === null ? null : Number(record.taxable_value),
      cgst: record.cgst === null ? null : Number(record.cgst),
      sgst: record.sgst === null ? null : Number(record.sgst),
      igst: record.igst === null ? null : Number(record.igst),
      cess: record.cess === null ? null : Number(record.cess),
      invoice_total: record.invoice_total === null ? null : Number(record.invoice_total),
      round_off: record.round_off === null ? null : Number(record.round_off),
    };
  }

function purchaseGstEvidenceFromData(data: any): SupplierDeclaredPurchaseGstEvidence | null {
    const amountKeys = [
      "declared_taxable_value",
      "declared_cgst",
      "declared_sgst",
      "declared_igst",
      "declared_cess",
      "declared_invoice_total",
      "declared_round_off",
    ];
    const hasEvidence = amountKeys.some((key) => data[key] !== undefined && data[key] !== null && data[key] !== "");
    if (!hasEvidence) return null;
    const requiredFacts = [
      "supplier_state_at_transaction",
      "recipient_state_at_transaction",
      "delivery_state_at_transaction",
      "supply_scenario",
    ];
    if (requiredFacts.some((key) => !String(data[key] ?? "").trim())) {
      throw new Error("Complete supplier GST evidence and transaction supply facts are required together.");
    }
    return {
      source_document_reference: data.supplier_invoice_no ?? null,
      amounts: {
        taxable_value: decimalOrNull(data.declared_taxable_value),
        cgst: decimalOrNull(data.declared_cgst),
        sgst: decimalOrNull(data.declared_sgst),
        igst: decimalOrNull(data.declared_igst),
        cess: decimalOrNull(data.declared_cess),
        invoice_total: decimalOrNull(data.declared_invoice_total),
        round_off: decimalOrNull(data.declared_round_off),
      },
    };
  }

async function persistPurchaseGstEvidence(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseId: string,
    membershipId: string,
    data: any,
    totals: { gross_amount: number; total_discount: number; total_tax: number; round_off: number; net_amount: number },
    options?: {
      revisionNumber?: number;
      supersedesRevisionId?: string;
      correctionReason?: string;
    },
  ) {
    const declared = purchaseGstEvidenceFromData(data);
    if (!declared) return null;
    const supplyFacts = {
      supplier_state_at_transaction: String(data.supplier_state_at_transaction).trim(),
      recipient_state_at_transaction: String(data.recipient_state_at_transaction).trim(),
      delivery_state_at_transaction: String(data.delivery_state_at_transaction).trim(),
      supply_scenario: data.supply_scenario,
    } as const;
    const calculated = calculatePurchaseGstExpected(totals, supplyFacts);
    const reconciliation = reconcilePurchaseGstEvidence(declared, calculated);
    const evidence = await tx.purchase_gst_evidence_revisions.create({
      data: {
        tenant_id: tenantId,
        purchase_invoice_id: purchaseId,
        revision_number: options?.revisionNumber ?? 1,
        revision_kind: options?.supersedesRevisionId ? "CORRECTION" : "INITIAL",
        supersedes_revision_id: options?.supersedesRevisionId ?? null,
        source_document_reference: declared.source_document_reference,
        capture_channel: "purchase_draft",
        correction_reason: options?.correctionReason ?? null,
        captured_by_membership_id: membershipId,
        declared_taxable_value: declared.amounts.taxable_value,
        declared_cgst: declared.amounts.cgst,
        declared_sgst: declared.amounts.sgst,
        declared_igst: declared.amounts.igst,
        declared_cess: declared.amounts.cess,
        declared_invoice_total: declared.amounts.invoice_total,
        declared_round_off: declared.amounts.round_off,
        declared_taxable_value_raw: String(data.declared_taxable_value),
        declared_cgst_raw: String(data.declared_cgst),
        declared_sgst_raw: String(data.declared_sgst),
        declared_igst_raw: String(data.declared_igst),
        declared_cess_raw: String(data.declared_cess),
        declared_invoice_total_raw: String(data.declared_invoice_total),
        declared_round_off_raw: String(data.declared_round_off),
        supplier_state_at_transaction: supplyFacts.supplier_state_at_transaction,
        recipient_state_at_transaction: supplyFacts.recipient_state_at_transaction,
        delivery_state_at_transaction: supplyFacts.delivery_state_at_transaction,
        supply_scenario: supplyFacts.supply_scenario,
        supply_facts: supplyFacts,
        capture_provenance: { source: "supplier_invoice_form", source_document_reference: declared.source_document_reference },
      },
    });
    const calculation = await tx.purchase_gst_calculations.create({
      data: {
        tenant_id: tenantId,
        purchase_invoice_id: purchaseId,
        evidence_revision_id: evidence.id,
        rule_version: calculated.rule_version,
        calculated_taxable_value: calculated.amounts.taxable_value,
        calculated_cgst: calculated.amounts.cgst,
        calculated_sgst: calculated.amounts.sgst,
        calculated_igst: calculated.amounts.igst,
        calculated_cess: calculated.amounts.cess,
        calculated_invoice_total: calculated.amounts.invoice_total,
        calculated_round_off: calculated.amounts.round_off,
        calculation_provenance: { source: "purchase-gst-rules-v1", supply_facts: supplyFacts },
      },
    });
    const event = await tx.purchase_gst_reconciliation_events.create({
      data: {
        tenant_id: tenantId,
        purchase_invoice_id: purchaseId,
        evidence_revision_id: evidence.id,
        event_kind: options?.supersedesRevisionId
          ? "CORRECTED"
          : reconciliation.status === "MATCHED" ? "MATCHED" : "DISCREPANCY_REQUIRES_REVIEW",
        from_status: options?.supersedesRevisionId ? "DISCREPANCY_REQUIRES_REVIEW" : "NOT_RECONCILED",
        to_status: reconciliation.status,
        operation: "purchase_gst_reconciliation",
        idempotency_key: `purchase:${purchaseId}:gst:${evidence.id}`,
        rule_version: calculated.rule_version,
        actor_membership_id: membershipId,
        declared_snapshot: declared,
        calculated_snapshot: calculated,
        discrepancy_details: reconciliation.material_discrepancy
          ? {
              missing_fields: reconciliation.missing_fields,
              differing_fields: reconciliation.differing_fields,
              invalid_fields: reconciliation.invalid_fields,
            }
          : Prisma.JsonNull,
      },
    });
    const purchaseItems = await tx.purchase_invoice_items.findMany({
      where: { tenant_id: tenantId, purchase_id: purchaseId },
      orderBy: { created_at: "asc" },
      select: { id: true },
    });
    const lines = Array.isArray(data.lines) ? data.lines : [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const item = purchaseItems[index];
      if (!item) continue;
      const lineFields = [
        "declared_taxable_value",
        "declared_cgst",
        "declared_sgst",
        "declared_igst",
        "declared_cess",
        "declared_line_total",
      ];
      if (!lineFields.some((field) => line[field] !== undefined && line[field] !== "")) continue;
      const lineEvidence = await tx.purchase_gst_line_evidence.create({
        data: {
          tenant_id: tenantId,
          purchase_invoice_id: purchaseId,
          evidence_revision_id: evidence.id,
          purchase_invoice_item_id: item.id,
          declared_taxable_value_raw: String(line.declared_taxable_value ?? ""),
          declared_cgst_raw: String(line.declared_cgst ?? ""),
          declared_sgst_raw: String(line.declared_sgst ?? ""),
          declared_igst_raw: String(line.declared_igst ?? ""),
          declared_cess_raw: String(line.declared_cess ?? ""),
          declared_line_total_raw: String(line.declared_line_total ?? ""),
          declared_taxable_value: decimalOrNull(line.declared_taxable_value),
          declared_cgst: decimalOrNull(line.declared_cgst),
          declared_sgst: decimalOrNull(line.declared_sgst),
          declared_igst: decimalOrNull(line.declared_igst),
          declared_cess: decimalOrNull(line.declared_cess),
          declared_line_total: decimalOrNull(line.declared_line_total),
        },
      });
      await tx.purchase_gst_reconciliation_event_lines.create({
        data: {
          tenant_id: tenantId,
          purchase_invoice_id: purchaseId,
          evidence_revision_id: evidence.id,
          event_id: event.id,
          line_evidence_id: lineEvidence.id,
        },
      });
    }
    await tx.purchase_invoices.update({
      where: { id: purchaseId, tenant_id: tenantId },
      data: {
        current_gst_evidence_revision_id: evidence.id,
        current_gst_calculation_id: calculation.id,
        gst_reconciliation_status: reconciliation.status,
        gst_accounting_acceptance_status: "NOT_ACCEPTED",
        current_gst_accounting_decision_id: null,
        gst_record_version: { increment: 1 },
      },
    });
    return { evidence, calculation, event, reconciliation };
}

export async function createPurchaseDraftAction(
  _prevState: ActionResult<purchase_invoices>,
  formData: FormData,
): Promise<ActionResult<purchase_invoices>> {
  try {
    assertPostgresConfigured("createPurchaseDraftAction");
    const payload = formDataToPurchaseObject(formData);
    const linesRaw = parseIndexedPurchaseLinesFromFormData(formData);
    payload.lines = linesRaw;

    const linesParsed: any[] = [];
    const linesErrors: Record<string, string[] | undefined> = {};
    for (let i = 0; i < linesRaw.length; i += 1) {
      const parsedLine = PurchaseInvoiceLineCreateSchema.safeParse(linesRaw[i]);
      if (!parsedLine.success) {
        const fe = flattenFieldErrors(parsedLine.error.flatten().fieldErrors);
        for (const k of Object.keys(fe)) linesErrors[`lines[${i}].${k}`] = fe[k];
      } else {
        linesParsed.push(parsedLine.data);
      }
    }

    const parsed = PurchaseInvoiceCreateSchema.safeParse(payload);
    let allErrors = parsed.success ? {} : flattenFieldErrors(parsed.error.flatten().fieldErrors);
    for (const k of Object.keys(linesErrors)) allErrors[k] = linesErrors[k];

    if (!parsed.success || Object.keys(linesErrors).length > 0 || linesParsed.length === 0) {
      if (linesParsed.length === 0) {
        allErrors["lines"] = ["At least one line item is required"];
      }
      return {
        ok: false,
        errors: allErrors,
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "create_purchase" as PermissionAction);
    const data = { ...parsed.data, lines: linesParsed };
    const gstEvidence = purchaseGstEvidenceFromData(data);
    const membership = gstEvidence
      ? await prisma.memberships.findFirst({
          where: { tenant_id: ctx.tenantId, user_id: ctx.userId, status: "active" },
          select: { id: true },
        })
      : null;
    if (gstEvidence && !membership) {
      return { ok: false, message: "Active tenant membership is required to capture GST evidence.", errors: undefined };
    }

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase_invoices.create({
        data: {
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          invoice_no: data.invoice_no && String(data.invoice_no).trim() ? String(data.invoice_no).trim() : "",
          supplier_id: data.supplier_id,
          supplier_invoice_no: data.supplier_invoice_no ?? null,
          invoice_date: data.invoice_date instanceof Date ? data.invoice_date : new Date(data.invoice_date as any),
          status: __PurchaseStatusDRAFT,
          gross_amount: Number(data.gross_amount ?? 0),
          total_discount: Number(data.total_discount ?? 0),
          total_tax: Number(data.total_tax ?? 0),
          round_off: Number(data.round_off ?? 0),
          net_amount: Number(data.net_amount ?? 0),
          notes: data.notes ?? null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const itemsData = linesParsed.map((line: any, idx: number) => {
        const totals = calculatePurchaseLineTotals(line);
        return {
          tenant_id: ctx.tenantId,
          purchase_id: created.id,
          product_id: line.product_id,
          batch_no: line.batch_no,
          expiry_date: line.expiry_date ?? null,
          quantity: Number(line.quantity ?? 0),
          free_qty: Number(line.free_qty ?? 0),
          purchase_rate: Number(line.purchase_rate ?? 0),
          discount_pct: Number(line.discount_pct ?? 0),
          discount_amount: totals.discount_amount,
          gst_rate: Number(line.gst_rate ?? 0),
          gst_amount: totals.gst_amount,
          mrp: line.mrp ? Number(line.mrp) : null,
          sale_rate: line.sale_rate ? Number(line.sale_rate) : null,
          line_total: totals.line_total,
          created_at: new Date(),
        };
      });

      if (itemsData.length > 0) {
        await tx.purchase_invoice_items.createMany({ data: itemsData });
      }
      if (gstEvidence && membership) {
        await persistPurchaseGstEvidence(
          tx,
          ctx.tenantId,
          created.id,
          membership.id,
          data,
          {
            gross_amount: Number(data.gross_amount ?? 0),
            total_discount: Number(data.total_discount ?? 0),
            total_tax: Number(data.total_tax ?? 0),
            round_off: Number(data.round_off ?? 0),
            net_amount: Number(data.net_amount ?? 0),
          },
        );
      }

      return created;
    });

    revalidatePath("/purchases");
    revalidatePath("/dashboard");
    redirect(`/purchases?created=${encodeURIComponent(invoice.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Purchase draft could not be saved. Please try again.",
      errors: undefined,
    };
  }
}

export async function acceptPurchaseGstAction(
  purchaseId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("acceptPurchaseGstAction");
    const parsed = PurchaseGstAcceptanceSchema.safeParse(formDataToPurchaseObject(formData));
    if (!parsed.success) {
      return {
        ok: false,
        message: "A decision reference, rationale, and accepted value source are required.",
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
      };
    }

    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "accept_purchase_gst" as PermissionAction);
    const membership = await prisma.memberships.findFirst({
      where: { tenant_id: ctx.tenantId, user_id: ctx.userId, status: "active" },
      select: { id: true },
    });
    if (!membership) return { ok: false, message: "Active tenant membership is required.", errors: undefined };

    const accepted = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase_invoices.findUnique({
        where: { id: purchaseId, tenant_id: ctx.tenantId },
      });
      if (!purchase || purchase.status !== __PurchaseStatusDRAFT) {
        throw new Error("Only an existing draft purchase can receive GST acceptance.");
      }
      if (!purchase.current_gst_evidence_revision_id || !purchase.current_gst_calculation_id) {
        throw new Error("Supplier GST evidence and application calculation are required before acceptance.");
      }
      if (purchase.gst_reconciliation_status !== "MATCHED") {
        throw new Error("Only a matched GST reconciliation can be accepted; discrepancies require explicit resolution.");
      }
      const [evidence, calculation] = await Promise.all([
        tx.purchase_gst_evidence_revisions.findFirst({
          where: {
            tenant_id: ctx.tenantId,
            purchase_invoice_id: purchase.id,
            id: purchase.current_gst_evidence_revision_id,
          },
        }),
        tx.purchase_gst_calculations.findFirst({
          where: {
            tenant_id: ctx.tenantId,
            purchase_invoice_id: purchase.id,
            id: purchase.current_gst_calculation_id,
          },
        }),
      ]);
      if (!evidence || !calculation) throw new Error("Current GST revisions could not be loaded.");
      const source = parsed.data.accepted_value_source;
      if (source === "EXPLICIT_DECISION") {
        throw new Error("Explicit accepted values require a discrepancy-resolution workflow.");
      }
      const amounts = source === "SUPPLIER_DECLARED"
        ? {
            taxable_value: evidence.declared_taxable_value === null ? null : Number(evidence.declared_taxable_value),
            cgst: evidence.declared_cgst === null ? null : Number(evidence.declared_cgst),
            sgst: evidence.declared_sgst === null ? null : Number(evidence.declared_sgst),
            igst: evidence.declared_igst === null ? null : Number(evidence.declared_igst),
            cess: evidence.declared_cess === null ? null : Number(evidence.declared_cess),
            invoice_total: evidence.declared_invoice_total === null ? null : Number(evidence.declared_invoice_total),
            round_off: evidence.declared_round_off === null ? null : Number(evidence.declared_round_off),
          }
        : {
            taxable_value: calculation.calculated_taxable_value === null ? null : Number(calculation.calculated_taxable_value),
            cgst: calculation.calculated_cgst === null ? null : Number(calculation.calculated_cgst),
            sgst: calculation.calculated_sgst === null ? null : Number(calculation.calculated_sgst),
            igst: calculation.calculated_igst === null ? null : Number(calculation.calculated_igst),
            cess: calculation.calculated_cess === null ? null : Number(calculation.calculated_cess),
            invoice_total: calculation.calculated_invoice_total === null ? null : Number(calculation.calculated_invoice_total),
            round_off: calculation.calculated_round_off === null ? null : Number(calculation.calculated_round_off),
          };
      const acceptedValues: AccountingAcceptedPurchaseGst = {
        amounts,
        source,
        decision_reference: parsed.data.decision_reference,
      };
      if (!canCompletePurchaseAccounting(
        { status: "MATCHED", source_document_reference: evidence.source_document_reference, rule_version: calculation.rule_version, comparisons: [], missing_fields: [], differing_fields: [], invalid_fields: [], material_discrepancy: false },
        acceptedValues,
      )) {
        throw new Error("Accepted GST values are incomplete or invalid.");
      }
      const decision = await tx.purchase_gst_accounting_decisions.create({
        data: {
          tenant_id: ctx.tenantId,
          purchase_invoice_id: purchase.id,
          evidence_revision_id: evidence.id,
          calculation_id: calculation.id,
          accepted_taxable_value: amounts.taxable_value,
          accepted_cgst: amounts.cgst,
          accepted_sgst: amounts.sgst,
          accepted_igst: amounts.igst,
          accepted_cess: amounts.cess,
          accepted_invoice_total: amounts.invoice_total,
          accepted_round_off: amounts.round_off,
          accepted_value_source: source,
          decision_reference: parsed.data.decision_reference,
          decision_outcome: "ACCEPTED",
          rationale: parsed.data.rationale,
          decided_by_membership_id: membership.id,
        },
      });
      const updated = await tx.purchase_invoices.updateMany({
        where: {
          id: purchase.id,
          tenant_id: ctx.tenantId,
          gst_record_version: purchase.gst_record_version,
          current_gst_evidence_revision_id: evidence.id,
          current_gst_calculation_id: calculation.id,
        },
        data: {
          current_gst_accounting_decision_id: decision.id,
          gst_accounting_acceptance_status: "ACCEPTED",
          gst_record_version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("GST record changed while acceptance was being recorded; retry.");
      await tx.purchase_gst_reconciliation_events.create({
        data: {
          tenant_id: ctx.tenantId,
          purchase_invoice_id: purchase.id,
          evidence_revision_id: evidence.id,
          event_kind: "ACCOUNTING_ACCEPTED",
          from_status: purchase.gst_reconciliation_status,
          to_status: purchase.gst_reconciliation_status,
          operation: "purchase_gst_accounting_acceptance",
          idempotency_key: `purchase:${purchase.id}:gst-accept:${parsed.data.decision_reference}`,
          decision_reference: parsed.data.decision_reference,
          rule_version: calculation.rule_version,
          actor_membership_id: membership.id,
          accepted_snapshot: acceptedValues,
          metadata: { calculation_id: calculation.id },
        },
      });
      return { id: purchase.id };
    });
    revalidatePath("/purchases");
    return { ok: true, data: accepted };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Purchase GST acceptance could not be recorded.", errors: undefined };
  }
}

export async function resolvePurchaseGstDiscrepancyAction(
  purchaseId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("resolvePurchaseGstDiscrepancyAction");
    const parsed = PurchaseGstResolutionSchema.safeParse(formDataToPurchaseObject(formData));
    if (!parsed.success) return { ok: false, message: "A resolution decision, rationale, source, and complete accepted values are required.", errors: flattenFieldErrors(parsed.error.flatten().fieldErrors) };
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "accept_purchase_gst" as PermissionAction);
    const membership = await prisma.memberships.findFirst({ where: { tenant_id: ctx.tenantId, user_id: ctx.userId, status: "active" }, select: { id: true } });
    if (!membership) return { ok: false, message: "Active tenant membership is required.", errors: undefined };
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase_invoices.findUnique({ where: { id: purchaseId, tenant_id: ctx.tenantId } });
      if (!purchase || purchase.status !== __PurchaseStatusDRAFT) throw new Error("Only an existing draft purchase can be resolved.");
      if (!purchase.current_gst_evidence_revision_id || !purchase.current_gst_calculation_id) throw new Error("Current GST evidence and calculation are required.");
      if (purchase.gst_reconciliation_status !== "DISCREPANCY_REQUIRES_REVIEW") throw new Error("Only a review-required GST discrepancy can be resolved.");
      const evidence = await tx.purchase_gst_evidence_revisions.findFirst({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, id: purchase.current_gst_evidence_revision_id } });
      const calculation = await tx.purchase_gst_calculations.findFirst({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, id: purchase.current_gst_calculation_id } });
      if (!evidence || !calculation) throw new Error("Current GST revisions could not be loaded.");
      const reconciliation = reconcilePurchaseGstEvidence(
        {
          source_document_reference: evidence.source_document_reference,
          amounts: purchaseAmountFactsFromRecord({
            taxable_value: evidence.declared_taxable_value,
            cgst: evidence.declared_cgst,
            sgst: evidence.declared_sgst,
            igst: evidence.declared_igst,
            cess: evidence.declared_cess,
            invoice_total: evidence.declared_invoice_total,
            round_off: evidence.declared_round_off,
          }),
        },
        {
          rule_version: calculation.rule_version,
          amounts: purchaseAmountFactsFromRecord({
            taxable_value: calculation.calculated_taxable_value,
            cgst: calculation.calculated_cgst,
            sgst: calculation.calculated_sgst,
            igst: calculation.calculated_igst,
            cess: calculation.calculated_cess,
            invoice_total: calculation.calculated_invoice_total,
            round_off: calculation.calculated_round_off,
          }),
        },
      );
      const accepted = {
        amounts: {
          taxable_value: decimalOrNull(parsed.data.accepted_taxable_value),
          cgst: decimalOrNull(parsed.data.accepted_cgst),
          sgst: decimalOrNull(parsed.data.accepted_sgst),
          igst: decimalOrNull(parsed.data.accepted_igst),
          cess: decimalOrNull(parsed.data.accepted_cess),
          invoice_total: decimalOrNull(parsed.data.accepted_invoice_total),
          round_off: decimalOrNull(parsed.data.accepted_round_off),
        },
        source: parsed.data.accepted_value_source,
        decision_reference: parsed.data.decision_reference,
      } as AccountingAcceptedPurchaseGst;
      const resolved = resolvePurchaseGstReconciliation(reconciliation, {
        decision_reference: parsed.data.decision_reference,
        decision: parsed.data.decision,
        rationale: parsed.data.rationale,
        approved_by: membership.id,
        resolved_at: new Date().toISOString(),
        accepted,
      });
      if (!canCompletePurchaseAccounting(resolved, accepted)) throw new Error("Resolution accepted values are incomplete or invalid.");
      const decision = await tx.purchase_gst_accounting_decisions.create({
        data: {
          tenant_id: ctx.tenantId,
          purchase_invoice_id: purchase.id,
          evidence_revision_id: evidence.id,
          calculation_id: calculation.id,
          accepted_taxable_value: accepted.amounts.taxable_value,
          accepted_cgst: accepted.amounts.cgst,
          accepted_sgst: accepted.amounts.sgst,
          accepted_igst: accepted.amounts.igst,
          accepted_cess: accepted.amounts.cess,
          accepted_invoice_total: accepted.amounts.invoice_total,
          accepted_round_off: accepted.amounts.round_off,
          accepted_value_source: accepted.source,
          decision_reference: accepted.decision_reference,
          decision_outcome: "RESOLVED_ACCEPTED",
          rationale: parsed.data.rationale,
          decided_by_membership_id: membership.id,
        },
      });
      const updated = await tx.purchase_invoices.updateMany({
        where: { id: purchase.id, tenant_id: ctx.tenantId, gst_record_version: purchase.gst_record_version, current_gst_evidence_revision_id: evidence.id, current_gst_calculation_id: calculation.id, gst_reconciliation_status: "DISCREPANCY_REQUIRES_REVIEW", gst_accounting_acceptance_status: "NOT_ACCEPTED" },
        data: { current_gst_accounting_decision_id: decision.id, gst_reconciliation_status: "RESOLVED", gst_accounting_acceptance_status: "ACCEPTED", gst_record_version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new Error("GST record changed while resolving; retry.");
      await tx.purchase_gst_reconciliation_events.create({
        data: {
          tenant_id: ctx.tenantId,
          purchase_invoice_id: purchase.id,
          evidence_revision_id: evidence.id,
          event_kind: "RESOLVED",
          from_status: "DISCREPANCY_REQUIRES_REVIEW",
          to_status: "RESOLVED",
          operation: "purchase_gst_discrepancy_resolution",
          idempotency_key: `purchase:${purchase.id}:gst-resolve:${accepted.decision_reference}`,
          decision_reference: accepted.decision_reference,
          rule_version: calculation.rule_version,
          actor_membership_id: membership.id,
          declared_snapshot: reconciliation,
          calculated_snapshot: { rule_version: calculation.rule_version, amounts: resolved.comparisons },
          accepted_snapshot: accepted,
          discrepancy_details: { differing_fields: reconciliation.differing_fields, missing_fields: reconciliation.missing_fields, invalid_fields: reconciliation.invalid_fields, decision: parsed.data.decision },
        },
      });
      return { id: purchase.id };
    });
    revalidatePath("/purchases");
    return { ok: true, data: result };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Purchase GST discrepancy could not be resolved.", errors: undefined };
  }
}

export async function correctPurchaseGstEvidenceAction(
  purchaseId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("correctPurchaseGstEvidenceAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "accept_purchase_gst" as PermissionAction);
    const membership = await prisma.memberships.findFirst({ where: { tenant_id: ctx.tenantId, user_id: ctx.userId, status: "active" }, select: { id: true } });
    if (!membership) return { ok: false, message: "Active tenant membership is required.", errors: undefined };
    const data = formDataToPurchaseObject(formData);
    if (!String(data.correction_reason ?? "").trim()) return { ok: false, message: "Correction reason is required.", errors: undefined };
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase_invoices.findUnique({ where: { id: purchaseId, tenant_id: ctx.tenantId } });
      if (!purchase || purchase.status !== __PurchaseStatusDRAFT) throw new Error("Only a draft purchase can be corrected.");
      if (!purchase.current_gst_evidence_revision_id) throw new Error("Current GST evidence is required.");
      const current = await tx.purchase_gst_evidence_revisions.findFirst({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, id: purchase.current_gst_evidence_revision_id } });
      if (!current) throw new Error("Current GST evidence could not be loaded.");
      const nextRevision = await tx.purchase_gst_evidence_revisions.count({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id } }) + 1;
      await persistPurchaseGstEvidence(tx, ctx.tenantId, purchase.id, membership.id, data, {
        gross_amount: Number(purchase.gross_amount),
        total_discount: Number(purchase.total_discount),
        total_tax: Number(purchase.total_tax),
        round_off: Number(purchase.round_off),
        net_amount: Number(purchase.net_amount),
      }, { revisionNumber: nextRevision, supersedesRevisionId: current.id, correctionReason: String(data.correction_reason).trim() });
      return { id: purchase.id };
    });
    revalidatePath("/purchases");
    return { ok: true, data: result };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Purchase GST correction could not be recorded.", errors: undefined };
  }
}

export async function cancelPurchaseDraftAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("cancelPurchaseDraftAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "edit_purchase" as PermissionAction);
    const existing = await prisma.purchase_invoices.findUnique({
      where: { id, tenant_id: ctx.tenantId },
    });
    if (!existing) {
      return { ok: false, message: "Purchase not found." };
    }
    if (existing.status !== __PurchaseStatusDRAFT) {
      return { ok: false, message: "Only draft purchases can be cancelled." };
    }
    await prisma.purchase_invoices.update({
      where: { id, tenant_id: ctx.tenantId },
      data: {
        status: __PurchaseStatusCANCELLED,
        cancelled_at: new Date(),
        cancelled_by: ctx.userId,
        updated_at: new Date(),
      },
    });
    revalidatePath("/purchases");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (_e: any) {
    return {
      ok: false,
      message: "Purchase could not be cancelled. Please try again.",
    };
  }
}

export async function finalizePurchaseAction(
  purchaseId: string,
  _prevState: ActionResult<purchase_invoices>,
  formData: FormData,
): Promise<ActionResult<purchase_invoices>> {
  try {
    assertPostgresConfigured("finalizePurchaseAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "finalize_purchase" as PermissionAction);
    const idempotencyKey = String(formData.get("idempotency_key") ?? `purchase:${purchaseId}:finalize`);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase_invoices.findUnique({
        where: { id: purchaseId, tenant_id: ctx.tenantId },
        include: { supplier: true, items: true },
      });
      if (!existing) {
        throw new Error("Purchase not found.");
      }
      const postingPayload = {
        purchase_id: purchaseId,
        supplier_invoice_no: existing.supplier_invoice_no,
        gst_record_version: existing.gst_record_version,
        current_gst_evidence_revision_id: existing.current_gst_evidence_revision_id,
        current_gst_calculation_id: existing.current_gst_calculation_id,
        current_gst_accounting_decision_id: existing.current_gst_accounting_decision_id,
        totals: {
          gross_amount: String(existing.gross_amount),
          total_discount: String(existing.total_discount),
          total_tax: String(existing.total_tax),
          round_off: String(existing.round_off),
          net_amount: String(existing.net_amount),
        },
        items: existing.items.map((item) => ({
          product_id: item.product_id,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date?.toISOString() ?? null,
          quantity: item.quantity,
          free_qty: item.free_qty,
          purchase_rate: String(item.purchase_rate),
          discount_pct: item.discount_pct === null ? null : String(item.discount_pct),
          discount_amount: String(item.discount_amount),
          gst_rate: String(item.gst_rate),
          gst_amount: String(item.gst_amount),
          mrp: item.mrp === null ? null : String(item.mrp),
          sale_rate: item.sale_rate === null ? null : String(item.sale_rate),
          line_total: String(item.line_total),
        })),
      };
      const payloadHash = requestHash(postingPayload);
      const priorOperation = await tx.purchase_posting_operations.findUnique({
        where: { tenant_id_idempotency_key: { tenant_id: ctx.tenantId, idempotency_key: idempotencyKey } },
      });
      if (priorOperation) {
        if (priorOperation.request_payload_hash !== payloadHash) {
          throw new Error("This idempotency key was already used with a different purchase payload.");
        }
        if (priorOperation.status === "COMPLETED") return existing;
        throw new Error("This purchase finalization is already being processed; retry with the same key.");
      }
      if (existing.status === __PurchaseStatusFINALIZED) {
        throw new Error("Purchase already finalized.");
      }
      if (existing.status !== __PurchaseStatusDRAFT) {
        throw new Error("Only draft purchases can be finalized.");
      }
      if (!existing.supplier) {
        throw new Error("Supplier not found.");
      }
      if (existing.supplier_invoice_no?.trim()) {
        const duplicate = await tx.purchase_invoices.findFirst({
          where: {
            tenant_id: ctx.tenantId,
            supplier_id: existing.supplier_id,
            supplier_invoice_no: existing.supplier_invoice_no,
            id: { not: existing.id },
          },
          select: { id: true, status: true, invoice_no: true },
        });
        if (duplicate) {
          throw new Error(`Supplier invoice ${existing.supplier_invoice_no} already exists on ${duplicate.invoice_no || duplicate.id}; review the possible duplicate before posting.`);
        }
      }

      const items: any[] = existing.items as any[] ?? [];
      if (items.length === 0) {
        throw new Error("No line items found.");
      }
      const gstEvidence = existing.current_gst_evidence_revision_id
        ? await tx.purchase_gst_evidence_revisions.findFirst({
            where: {
              tenant_id: ctx.tenantId,
              purchase_invoice_id: existing.id,
              id: existing.current_gst_evidence_revision_id,
            },
          })
        : null;
      const gstCalculation = existing.current_gst_calculation_id
        ? await tx.purchase_gst_calculations.findFirst({
            where: {
              tenant_id: ctx.tenantId,
              purchase_invoice_id: existing.id,
              id: existing.current_gst_calculation_id,
            },
          })
        : null;
      const gstDecision = existing.current_gst_accounting_decision_id
        ? await tx.purchase_gst_accounting_decisions.findFirst({
            where: {
              tenant_id: ctx.tenantId,
              purchase_invoice_id: existing.id,
              id: existing.current_gst_accounting_decision_id,
            },
          })
        : null;
      if (
        !gstEvidence ||
        !gstCalculation ||
        !gstDecision ||
        (existing.gst_reconciliation_status !== "MATCHED" &&
          existing.gst_reconciliation_status !== "RESOLVED") ||
        existing.gst_accounting_acceptance_status !== "ACCEPTED"
      ) {
        throw new Error(
          "Purchase GST finalization is blocked: supplier evidence, a versioned calculation, a reconciled state, and explicit accounting acceptance are required. The current form captures no component tax facts or accounting decision, so this draft remains saveable but cannot be finalized.",
        );
      }
      const claimed = await tx.purchase_invoices.updateMany({
        where: {
          id: existing.id,
          tenant_id: ctx.tenantId,
          status: __PurchaseStatusDRAFT,
          gst_record_version: existing.gst_record_version,
        },
        data: { status: __PurchaseStatusFINALIZED },
      });
      if (claimed.count !== 1) throw new Error("Purchase changed while finalization was starting; retry.");
      await tx.purchase_posting_operations.create({
        data: {
          tenant_id: ctx.tenantId,
          purchase_invoice_id: existing.id,
          idempotency_key: idempotencyKey,
          request_payload_hash: payloadHash,
          status: "PROCESSING",
        },
      });
      if (
        gstDecision.evidence_revision_id !== gstEvidence.id ||
        gstDecision.calculation_id !== gstCalculation.id ||
        !canCompletePurchaseAccounting(
          {
            status: existing.gst_reconciliation_status,
            source_document_reference: gstEvidence.source_document_reference,
            rule_version: gstCalculation.rule_version,
            comparisons: [],
            missing_fields: [],
            differing_fields: [],
            invalid_fields: [],
            material_discrepancy: existing.gst_reconciliation_status !== "MATCHED",
          },
          {
            amounts: {
              taxable_value: gstDecision.accepted_taxable_value === null ? null : Number(gstDecision.accepted_taxable_value),
              cgst: gstDecision.accepted_cgst === null ? null : Number(gstDecision.accepted_cgst),
              sgst: gstDecision.accepted_sgst === null ? null : Number(gstDecision.accepted_sgst),
              igst: gstDecision.accepted_igst === null ? null : Number(gstDecision.accepted_igst),
              cess: gstDecision.accepted_cess === null ? null : Number(gstDecision.accepted_cess),
              invoice_total: gstDecision.accepted_invoice_total === null ? null : Number(gstDecision.accepted_invoice_total),
              round_off: gstDecision.accepted_round_off === null ? null : Number(gstDecision.accepted_round_off),
            },
            source: gstDecision.accepted_value_source as AccountingAcceptedPurchaseGst["source"],
            decision_reference: gstDecision.decision_reference,
          },
        )
      ) {
        throw new Error("Purchase GST finalization is blocked: accounting acceptance is stale or incomplete.");
      }

      const lineComputed = items.map((it: any) => calculatePurchaseLineTotals({
        quantity: Number(it.quantity ?? 0),
        purchase_rate: Number(it.purchase_rate ?? 0),
        discount_pct: Number(it.discount_pct ?? 0),
        gst_rate: Number(it.gst_rate ?? 0),
      }));
      const serverTotals = calculatePurchaseInvoiceTotals(lineComputed);

      const diffGross = Math.abs(Number(existing.gross_amount ?? 0) - serverTotals.gross_amount);
      const diffDisc = Math.abs(Number(existing.total_discount ?? 0) - serverTotals.total_discount);
      const diffTax = Math.abs(Number(existing.total_tax ?? 0) - serverTotals.total_tax);
      const diffNet = Math.abs(Number(existing.net_amount ?? 0) - serverTotals.net_amount);
      if (diffGross > 0.01 || diffDisc > 0.01 || diffTax > 0.01 || diffNet > 0.01) {
        throw new Error("Totals mismatch vs calculated; please review.");
      }

      for (let i = 0; i < items.length; i += 1) {
        const line = items[i];
        const qty = Number(line.quantity ?? 0);
        await tx.product_batches.upsert({
          where: {
            tenant_id_product_id_batch_no: {
              tenant_id: ctx.tenantId,
              product_id: line.product_id,
              batch_no: line.batch_no,
            },
          },
          create: {
            tenant_id: ctx.tenantId,
            product_id: line.product_id,
            batch_no: line.batch_no,
            expiry_date: line.expiry_date ?? null,
            mrp: line.mrp ? Number(line.mrp) : null,
            purchase_rate: Number(line.purchase_rate ?? 0),
            sale_rate: line.sale_rate ? Number(line.sale_rate) : null,
            received_qty: qty,
            available_qty: qty,
            supplier_id: existing.supplier_id,
            purchase_id: existing.id,
            is_blocked: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
          update: {
            received_qty: { increment: qty },
            available_qty: { increment: qty },
            updated_at: new Date(),
          },
        });
      }

      const movementPromises = [];
      for (let i = 0; i < items.length; i += 1) {
        const line = items[i];
        const qty = Number(line.quantity ?? 0);
        const batch = await tx.product_batches.findUnique({
          where: {
            tenant_id_product_id_batch_no: {
              tenant_id: ctx.tenantId,
              product_id: line.product_id,
              batch_no: line.batch_no,
            },
          },
          select: { id: true },
        });
        movementPromises.push(
          tx.stock_movements.create({
            data: {
              tenant_id: ctx.tenantId,
              product_id: line.product_id,
              batch_id: batch?.id ?? null,
              movement_type: __MovementPURCHASE_IN,
              quantity_delta: qty,
              reference_type: "purchase_invoice",
              reference_id: existing.id,
              unit_rate: Number(line.purchase_rate ?? 0),
              notes: null,
              created_by: ctx.userId,
              created_at: new Date(),
            },
          }),
        );
      }
      await Promise.all(movementPromises);

      let finalInvoiceNo = existing.invoice_no;
      if (!finalInvoiceNo || !finalInvoiceNo.trim()) {
        const profiles = await tx.$queryRaw<Array<{
          purchase_next_seq: number;
          purchase_prefix: string | null;
        }>>`
          SELECT purchase_next_seq, purchase_prefix
          FROM business_profiles
          WHERE tenant_id = ${ctx.tenantId}
          FOR UPDATE
        `;
        const profile = profiles[0];
        if (profile) {
          const seq = profile.purchase_next_seq ?? 1;
          finalInvoiceNo = `${profile.purchase_prefix ?? "PUR"}-${String(seq).padStart(5, "0")}`;
          await tx.business_profiles.update({
            where: { tenant_id: ctx.tenantId },
            data: { purchase_next_seq: seq + 1, updated_at: new Date() },
          });
        } else {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${ctx.tenantId}, 0))
          `;
          const cnt = await tx.purchase_invoices.count({ where: { tenant_id: ctx.tenantId } });
          finalInvoiceNo = `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(cnt + 1).padStart(3, "0")}`;
        }
      }

      const updated = await tx.purchase_invoices.update({
        where: { id: existing.id, tenant_id: ctx.tenantId },
        data: {
          invoice_no: finalInvoiceNo,
          status: __PurchaseStatusFINALIZED,
          finalized_at: new Date(),
          gross_amount: serverTotals.gross_amount,
          total_discount: serverTotals.total_discount,
          total_tax: serverTotals.total_tax,
          round_off: serverTotals.round_off,
          net_amount: serverTotals.net_amount,
          updated_at: new Date(),
        },
      });

      await tx.purchase_posting_operations.update({
        where: { tenant_id_idempotency_key: { tenant_id: ctx.tenantId, idempotency_key: idempotencyKey } },
        data: {
          status: "COMPLETED",
          result_purchase_id: updated.id,
          result_invoice_no: finalInvoiceNo,
        },
      });

      const supplierRow = await tx.suppliers.findUnique({
        where: { id: existing.supplier_id, tenant_id: ctx.tenantId },
        select: { payable_balance: true },
      });
      const balanceBefore = Number(supplierRow?.payable_balance ?? 0);
      const credit = serverTotals.net_amount;
      const balanceAfter = Math.round((balanceBefore + credit) * 100) / 100;

      await tx.supplier_ledgers.create({
        data: {
          tenant_id: ctx.tenantId,
          supplier_id: existing.supplier_id,
          entry_type: __LedgerEntryPURCHASE,
          debit: 0,
          credit,
          balance: balanceAfter,
          reference_type: "purchase_invoice",
          reference_id: existing.id,
          purchase_id: existing.id,
          narration: `Purchase ${finalInvoiceNo}`,
          entry_date: existing.invoice_date,
          created_at: new Date(),
        },
      });

      await tx.suppliers.update({
        where: { id: existing.supplier_id, tenant_id: ctx.tenantId },
        data: { payable_balance: { increment: credit }, updated_at: new Date() },
      });

      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          event_type: "PURCHASE_FINALIZED",
          actor_id: ctx.userId,
          target_type: "purchase_invoice",
          target_id: existing.id,
          metadata: { invoice_no: finalInvoiceNo, net_amount: credit },
          created_at: new Date(),
        },
      });

      return updated;
    });

    revalidatePath("/purchases");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    redirect(`/purchases?created=${encodeURIComponent(invoice.id)}&finalized=1`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    const msg = e?.message && typeof e.message === "string" ? e.message : "Purchase could not be finalized. Please try again.";
    return { ok: false, message: msg, errors: undefined };
  }
}

export async function createStockAdjustmentAction(
  _prevState: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("createStockAdjustmentAction");
    const payload: Record<string, any> = {};
    for (const [rawKey, value] of formData.entries()) {
      payload[String(rawKey)] = value === null ? "" : String(value);
    }
    const parsed = StockAdjustmentSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "adjust_stock" as PermissionAction);
    const data = parsed.data;

    await prisma.$transaction(async (tx) => {
      const batch = await tx.product_batches.findUnique({
        where: { id: data.batch_id, tenant_id: ctx.tenantId },
      });
      if (!batch) {
        throw new Error("Batch not found.");
      }
      const before = Number(batch.available_qty ?? 0);
      const delta = Number(data.quantity_delta);
      if (delta < 0 && before < Math.abs(delta)) {
        throw new Error("Insufficient available quantity for this batch.");
      }
      await tx.product_batches.update({
        where: { id: data.batch_id, tenant_id: ctx.tenantId },
        data: {
          available_qty: { increment: delta },
          updated_at: new Date(),
        },
      });
      const movement: StockMovementType = delta > 0 ? __MovementADJUSTMENT_IN : __MovementADJUSTMENT_OUT;
      await tx.stock_movements.create({
        data: {
          tenant_id: ctx.tenantId,
          product_id: batch.product_id,
          batch_id: batch.id,
          movement_type: movement,
          quantity_delta: delta,
          reference_type: "stock_adjustment",
          reference_id: null,
          unit_rate: batch.purchase_rate ? Number(batch.purchase_rate) : 0,
          notes: data.reason + (data.notes ? ` — ${data.notes}` : ""),
          created_by: ctx.userId,
          created_at: new Date(),
        },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          event_type: "STOCK_ADJUSTED",
          actor_id: ctx.userId,
          target_type: "product_batch",
          target_id: batch.id,
          metadata: { quantity_delta: delta, product_id: batch.product_id },
          created_at: new Date(),
        },
      });
    });

    revalidatePath("/inventory");
    revalidatePath("/inventory/products");
    revalidatePath("/inventory/low-stock");
    revalidatePath("/inventory/near-expiry");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: data.batch_id } };
  } catch (e: any) {
    const msg = e?.message && typeof e.message === "string" ? e.message : "Stock adjustment could not be saved. Please try again.";
    return { ok: false, message: msg, errors: undefined };
  }
}

export async function getPurchaseForEdit(id: string): Promise<purchase_invoices | null> {
  assertPostgresConfigured("getPurchaseForEdit");
  const ctx = await requireServerTenantContext();
  return prisma.purchase_invoices.findUnique({
    where: { id, tenant_id: ctx.tenantId },
    include: { supplier: true, items: { include: { product: true } } },
  }) as unknown as Promise<purchase_invoices | null>;
}
