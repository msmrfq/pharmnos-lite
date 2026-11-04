"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation.js";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { establishTenantContext, requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import { Prisma } from "@prisma/client";
import type {
  purchase_invoices,
  InvoiceStatus,
  StockMovementType,
  LedgerEntryType,
  PermissionAction,
  PurchaseGstReconciliationStatus,
} from "@prisma/client";
import {
  calculatePurchaseInvoiceTotals,
  calculatePurchaseLineGst,
  calculatePurchaseLineTotals,
} from "@/domain/services/purchase-calculator.service";
import {
  calculatePurchaseGstExpected,
  canCompletePurchaseAccounting,
  reconcilePurchaseGstLineEvidence,
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
  PurchaseGstCorrectionSchema,
  PurchaseGstResolutionLineSchema,
  PurchaseGstResolutionSchema,
  StockAdjustmentSchema,
  STORAGE_PURCHASE_STATUS_DRAFT,
  STORAGE_PURCHASE_STATUS_FINALIZED,
  STORAGE_PURCHASE_STATUS_CANCELLED,
} from "@/lib/validation/purchases.schemas";
import { validateGstTreatment } from "@/lib/gst/treatment";
import { resolvePurchaseSupplyFacts } from "@/lib/gst/place-of-supply";
import { isApprovedGstClassification, resolveApprovedGstRule } from "@/lib/gst/rule-governance";
import { Decimal, decimalOrZero } from "@/lib/decimal";

const __PurchaseStatusDRAFT: InvoiceStatus = "DRAFT";
const __PurchaseStatusFINALIZED: InvoiceStatus = "FINALIZED";
const __PurchaseStatusCANCELLED: InvoiceStatus = "CANCELLED";
const __MovementPURCHASE_IN: StockMovementType = "PURCHASE_IN";
const __MovementADJUSTMENT_IN: StockMovementType = "ADJUSTMENT_IN";
const __MovementADJUSTMENT_OUT: StockMovementType = "ADJUSTMENT_OUT";
const __LedgerEntryPURCHASE: LedgerEntryType = "PURCHASE";

function round2(value: number): number {
  return decimalOrZero(value).round(2, "HALF_UP").toNumber();
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

function parseIndexedPurchaseGstResolutionLines(formData: FormData): any[] {
  const lines: Array<Record<string, any>> = [];
  for (const [rawKey, value] of formData.entries()) {
    const match = String(rawKey).match(/^gst_lines\[(\d+)\]\.(.+)$/);
    if (!match) continue;
    const index = Number(match[1]);
    if (!Number.isInteger(index)) continue;
    while (lines.length <= index) lines.push({});
    const line = lines[index];
    const field = match[2];
    if (!line || !field) continue;
    line[field] = value === null || value === undefined ? "" : String(value);
  }
  return lines.filter((line) => Object.keys(line).length > 0);
}

function fixedDecimal(value: unknown): Decimal {
  if (value === null || value === undefined || value === "") return Decimal.zero();
  return Decimal.from(String(value)).round(4, "HALF_UP");
}

function fixedAmount(value: unknown): number {
  return fixedDecimal(value).toNumber();
}

function amountsEqual(left: unknown, right: unknown): boolean {
  return fixedDecimal(left).compare(fixedDecimal(right)) === 0;
}

function decimalOrNull(value: unknown): string | null {
    if (value === null || value === undefined || value === "") return null;
    return Decimal.tryFrom(String(value))?.toString() ?? null;
  }

function assertPurchaseGstRevisionCurrent(
  purchase: {
    gst_record_version: number;
    current_gst_evidence_revision_id: string | null;
    current_gst_calculation_id: string | null;
  },
  expected: {
    expected_gst_record_version: number;
    expected_gst_evidence_revision_id: string;
    expected_gst_calculation_id: string;
  },
): void {
  if (
    purchase.gst_record_version !== expected.expected_gst_record_version ||
    purchase.current_gst_evidence_revision_id !== expected.expected_gst_evidence_revision_id ||
    purchase.current_gst_calculation_id !== expected.expected_gst_calculation_id
  ) {
    throw new Error("Purchase GST revision is stale; refresh before retrying.");
  }
}

  function requestHash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  const SUPPLIER_INVOICE_UNIQUE_INDEX =
    "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key";

  function isSupplierInvoiceUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      return false;
    }
    const target = error.meta?.target;
    const targetValues = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
    return (
      targetValues.includes(SUPPLIER_INVOICE_UNIQUE_INDEX) ||
      ["tenant_id", "supplier_id", "supplier_invoice_no"].every((field) => targetValues.includes(field))
    );
  }

  async function lockSupplierBalance(
    tx: Prisma.TransactionClient,
    tenantId: string,
    supplierId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ payable_balance: unknown }>>(Prisma.sql`
      SELECT "payable_balance"
      FROM "suppliers"
      WHERE "tenant_id" = ${tenantId} AND "id" = ${supplierId}
      FOR UPDATE
    `);
    const row = rows[0];
    if (!row) throw new Error("Supplier not found.");
    return decimalOrZero(String(row.payable_balance ?? "0")).toNumber();
  }

    async function resolvePurchaseLineRules(
    tx: Prisma.TransactionClient,
    tenantId: string,
    lines: any[],
    effectiveAt: Date,
  ) {
    const productIds = Array.from(new Set(lines.map((line) => String(line.product_id))));
    const products = await tx.products.findMany({
      where: { tenant_id: tenantId, id: { in: productIds } },
      select: { id: true, hsn_code: true },
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const codes = Array.from(new Set(products.map((product) => product.hsn_code).filter((code): code is string => Boolean(code?.trim()))));
    const classifications = await tx.hsn_sac_catalog.findMany({
      where: { tenant_id: tenantId, code: { in: codes } },
      select: {
        id: true,
        code: true,
        classification_status: true,
        effective_from: true,
        effective_to: true,
        is_active: true,
        source_reference: true,
      },
    });
    const classificationsByCode = new Map(classifications.map((classification) => [classification.code, classification]));
    const rules = await tx.gst_rate_rules.findMany({
      where: { tenant_id: tenantId, effective_from: { lte: effectiveAt } },
      select: {
        id: true,
        hsn_sac_catalog_id: true,
        rule_version: true,
        tax_rate: true,
        component_policy: true,
        approval_status: true,
        source_reference: true,
        effective_from: true,
        effective_to: true,
        is_active: true,
      },
    });

    return lines.map((line) => {
      const product = productsById.get(String(line.product_id));
      if (!product) throw new Error("Purchase line product is missing or belongs to another tenant.");
      const code = product.hsn_code?.trim();
      const classification = code ? classificationsByCode.get(code) : undefined;
      if (!classification || !isApprovedGstClassification(classification, effectiveAt)) {
        throw new Error(`Purchase GST calculation is blocked: HSN/SAC ${code || "(missing)"} is not approved and effective.`);
      }
      const resolution = resolveApprovedGstRule(
        rules
          .filter((rule) => rule.hsn_sac_catalog_id === classification.id)
          .map((rule) => ({ ...rule, tax_rate: rule.tax_rate === null ? null : Number(rule.tax_rate) })),
        effectiveAt,
        classification.id,
      );
      if (!resolution.ok || resolution.rule.tax_rate === null) {
        throw new Error(`Purchase GST calculation is blocked: exactly one approved GST rule is required for HSN/SAC ${code}.`);
      }
      return {
        ...line,
        gst_rate: Number(resolution.rule.tax_rate),
        hsn_sac_code: classification.code,
        hsn_sac_catalog_id: classification.id,
        rule_version: resolution.rule.rule_version,
        rule_source_reference: resolution.rule.source_reference,
      };
    });
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

function normalizeSupplierInvoiceNo(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
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
    const cess = decimalOrNull(data.declared_cess);
    if (cess !== null && !Decimal.from(cess).isZero()) {
      throw new Error("Non-zero cess is blocked until a governed cess rule and credit-utilization policy are configured.");
    }
    return {
      source_document_reference: normalizeSupplierInvoiceNo(data.supplier_invoice_no),
      amounts: {
        taxable_value: decimalOrNull(data.declared_taxable_value),
        cgst: decimalOrNull(data.declared_cgst),
        sgst: decimalOrNull(data.declared_sgst),
        igst: decimalOrNull(data.declared_igst),
        cess,
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
    governedLines: any[],
    options?: {
      revisionNumber?: number;
      supersedesRevisionId?: string;
      correctionReason?: string;
      expectedRecordVersion?: number;
      expectedCurrentEvidenceRevisionId?: string;
      expectedCurrentCalculationId?: string;
      fromStatus?: PurchaseGstReconciliationStatus;
    },
  ) {
    const declared = purchaseGstEvidenceFromData(data);
    if (!declared) return null;
    const supplyFactsResult = resolvePurchaseSupplyFacts(data);
    if (!supplyFactsResult.ok) throw new Error(supplyFactsResult.error);
    const supplyFacts = supplyFactsResult.facts;
    const calculated = calculatePurchaseGstExpected(totals, supplyFacts, governedLines);
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
        calculation_provenance: {
          source: "purchase-gst-governed-line-rules",
          supply_facts: supplyFacts,
          line_calculations: calculated.line_calculations ?? [],
        },
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
        from_status: options?.supersedesRevisionId
          ? options.fromStatus ?? "DISCREPANCY_REQUIRES_REVIEW"
          : "NOT_RECONCILED",
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
      select: { id: true, product: { select: { hsn_code: true } } },
    });
    const lines = Array.isArray(data.lines) ? data.lines : [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const item = purchaseItems[index];
      if (!item) continue;
      if (data.supply_scenario) {
        const governedLine = governedLines[index];
        const lineGst = calculatePurchaseLineGst(governedLine ?? line, data.supply_scenario);
        await tx.purchase_invoice_items.update({
          where: { id: item.id },
          data: {
            hsn_code_snapshot: item.product?.hsn_code ?? governedLine?.hsn_sac_code ?? line.hsn_code ?? null,
            calculated_taxable_value: lineGst.taxable_value,
            calculated_cgst: lineGst.cgst,
            calculated_sgst: lineGst.sgst,
            calculated_igst: lineGst.igst,
            calculated_cess: lineGst.cess,
            gst_calculation_reference: governedLine?.rule_version ?? calculated.rule_version,
          },
        });
        await tx.$executeRaw(Prisma.sql`
          UPDATE "purchase_invoice_items"
          SET
            "hsn_sac_catalog_id_snapshot" = ${governedLine?.hsn_sac_catalog_id ?? null},
            "gst_rule_version_snapshot" = ${governedLine?.rule_version ?? null},
            "gst_rule_source_reference_snapshot" = ${governedLine?.rule_source_reference ?? null}
          WHERE "id" = ${item.id} AND "tenant_id" = ${tenantId}
        `);
      }
      const lineFields = [
        "declared_taxable_value",
        "declared_cgst",
        "declared_sgst",
        "declared_igst",
        "declared_cess",
        "declared_line_total",
      ];
      if (!lineFields.some((field) => line[field] !== undefined && line[field] !== null && line[field] !== "")) continue;
      const expectedLine = calculated.line_calculations?.[index];
      const lineReconciliation = expectedLine
        ? reconcilePurchaseGstLineEvidence(
            {
              taxable_value: decimalOrNull(line.declared_taxable_value),
              cgst: decimalOrNull(line.declared_cgst),
              sgst: decimalOrNull(line.declared_sgst),
              igst: decimalOrNull(line.declared_igst),
              cess: decimalOrNull(line.declared_cess),
              line_total: decimalOrNull(line.declared_line_total),
            },
            expectedLine.amounts,
          )
        : { status: "DISCREPANCY_REQUIRES_REVIEW" as const, differing_fields: ["calculation"] };
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
      await tx.purchase_invoice_items.update({
        where: { id: item.id },
        data: {
          gst_discrepancy_details: {
            status: lineReconciliation.status,
            differing_fields: lineReconciliation.differing_fields,
          },
        },
      });
    }
    const updated = await tx.purchase_invoices.updateMany({
      where: {
        id: purchaseId,
        tenant_id: tenantId,
        ...(options?.expectedRecordVersion === undefined
          ? {}
          : {
              status: __PurchaseStatusDRAFT,
              gst_record_version: options.expectedRecordVersion,
              current_gst_evidence_revision_id: options.expectedCurrentEvidenceRevisionId,
              current_gst_calculation_id: options.expectedCurrentCalculationId,
            }),
      },
      data: {
        current_gst_evidence_revision_id: evidence.id,
        current_gst_calculation_id: calculation.id,
        gst_reconciliation_status: reconciliation.status,
        gst_accounting_acceptance_status: "NOT_ACCEPTED",
        current_gst_accounting_decision_id: null,
        gst_record_version: { increment: 1 },
      },
    });
    if (options?.expectedRecordVersion !== undefined && updated.count !== 1) {
      throw new Error("Purchase GST revision changed while the correction was being recorded; retry.");
    }
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
    const treatment = validateGstTreatment(data.gst_treatment);
    if (!treatment.ok) {
      return { ok: false, message: treatment.error, errors: { gst_treatment: [treatment.error ?? "Invalid GST treatment."] } };
    }
    if (data.tax_mode !== "EXCLUSIVE") {
      return {
        ok: false,
        message: "Inclusive GST purchases are blocked until governed Rule 35 extraction and rounding are enabled.",
        errors: { tax_mode: ["Inclusive GST purchases are not yet enabled."] },
      };
    }
    const hasSupplyFacts = [
      data.supplier_state_at_transaction,
      data.recipient_state_at_transaction,
      data.delivery_state_at_transaction,
      data.supply_scenario,
    ].some((value) => String(value ?? "").trim() !== "");
    if (hasSupplyFacts) {
      const supplyFacts = resolvePurchaseSupplyFacts(data);
      if (!supplyFacts.ok) {
        return {
          ok: false,
          message: supplyFacts.error,
          errors: { supply_facts: [supplyFacts.error] },
        };
      }
    }
    const gstEvidence = purchaseGstEvidenceFromData(data);

    const invoice = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      const supplier = await tx.suppliers.findUnique({
        where: { id: data.supplier_id, tenant_id: ctx.tenantId },
        select: { id: true },
      });
      if (!supplier) {
        throw new Error("Supplier not found or belongs to another tenant.");
      }

      const productIds = Array.from(new Set(linesParsed.map((line) => String(line.product_id))));
      const products = await tx.products.findMany({
        where: { tenant_id: ctx.tenantId, id: { in: productIds } },
        select: { id: true },
      });
      const ownedProductIds = new Set(products.map((product) => product.id));
      if (productIds.some((productId) => !ownedProductIds.has(productId))) {
        throw new Error("Purchase line product is missing or belongs to another tenant.");
      }

      const referencedBatchIds = linesParsed
        .map((line) => String(line.batch_id ?? "").trim())
        .filter((batchId) => batchId.length > 0);
      if (referencedBatchIds.length > 0) {
        const batches = await tx.product_batches.findMany({
          where: { tenant_id: ctx.tenantId, id: { in: referencedBatchIds } },
          select: { id: true, product_id: true, batch_no: true },
        });
        const batchesById = new Map(batches.map((batch) => [batch.id, batch]));
        for (const line of linesParsed) {
          const batchId = String(line.batch_id ?? "").trim();
          if (!batchId) continue;
          const batch = batchesById.get(batchId);
          if (
            !batch ||
            batch.product_id !== String(line.product_id) ||
            batch.batch_no !== String(line.batch_no)
          ) {
            throw new Error("Purchase line batch is missing or belongs to another tenant.");
          }
        }
      }

      const created = await tx.purchase_invoices.create({
        data: {
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          invoice_no: data.invoice_no && String(data.invoice_no).trim() ? String(data.invoice_no).trim() : "",
          supplier_id: data.supplier_id,
          supplier_invoice_no: normalizeSupplierInvoiceNo(data.supplier_invoice_no),
          invoice_date: data.invoice_date instanceof Date ? data.invoice_date : new Date(data.invoice_date as any),
          status: __PurchaseStatusDRAFT,
          gst_treatment: treatment.treatment,
          tax_mode: data.tax_mode,
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

      const governedLines = data.supply_scenario
        ? await resolvePurchaseLineRules(tx, ctx.tenantId, linesParsed, created.invoice_date)
        : linesParsed;
      const itemsData = governedLines.map((line: any) => {
        const totals = calculatePurchaseLineTotals(line);
        const lineGst = data.supply_scenario
          ? calculatePurchaseLineGst(line, data.supply_scenario)
          : null;
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
          gst_amount: lineGst?.gst_amount ?? totals.gst_amount,
          hsn_code_snapshot: line.hsn_sac_code ? String(line.hsn_sac_code) : null,
          calculated_taxable_value: lineGst?.taxable_value ?? null,
          calculated_cgst: lineGst?.cgst ?? null,
          calculated_sgst: lineGst?.sgst ?? null,
          calculated_igst: lineGst?.igst ?? null,
          calculated_cess: lineGst?.cess ?? null,
          gst_calculation_reference: line.rule_version ?? null,
          mrp: line.mrp ? Number(line.mrp) : null,
          sale_rate: line.sale_rate ? Number(line.sale_rate) : null,
          inventory_valuation_status: "PENDING",
          line_total: totals.line_total,
          created_at: new Date(),
        };
      });

      if (itemsData.length > 0) {
        await tx.purchase_invoice_items.createMany({ data: itemsData });
      }
      if (data.supply_scenario) {
        const createdItems = await tx.purchase_invoice_items.findMany({
          where: { tenant_id: ctx.tenantId, purchase_id: created.id },
          orderBy: { created_at: "asc" },
          select: { id: true },
        });
        for (let index = 0; index < governedLines.length; index += 1) {
          const line = governedLines[index];
          const item = createdItems[index];
          if (!item) continue;
          await tx.$executeRaw(Prisma.sql`
            UPDATE "purchase_invoice_items"
            SET
              "hsn_sac_catalog_id_snapshot" = ${line.hsn_sac_catalog_id ?? null},
              "gst_rule_version_snapshot" = ${line.rule_version ?? null},
              "gst_rule_source_reference_snapshot" = ${line.rule_source_reference ?? null}
            WHERE "id" = ${item.id} AND "tenant_id" = ${ctx.tenantId}
          `);
        }
      }
      if (gstEvidence) {
        await persistPurchaseGstEvidence(
          tx,
          ctx.tenantId,
          created.id,
          ctx.membershipId,
          data,
          {
            gross_amount: Number(data.gross_amount ?? 0),
            total_discount: Number(data.total_discount ?? 0),
            total_tax: Number(data.total_tax ?? 0),
            round_off: Number(data.round_off ?? 0),
            net_amount: Number(data.net_amount ?? 0),
          },
          governedLines,
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
    const accepted = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      const purchase = await tx.purchase_invoices.findUnique({
        where: { id: purchaseId, tenant_id: ctx.tenantId },
      });
      if (!purchase || purchase.status !== __PurchaseStatusDRAFT) {
        throw new Error("Only an existing draft purchase can receive GST acceptance.");
      }
      assertPurchaseGstRevisionCurrent(purchase, parsed.data);
      if (
        purchase.gst_accounting_acceptance_status !== "NOT_ACCEPTED" ||
        purchase.current_gst_accounting_decision_id !== null
      ) {
        throw new Error("GST accounting acceptance is already recorded; refresh before retrying.");
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
      const purchaseItems = await tx.purchase_invoice_items.findMany({
        where: { tenant_id: ctx.tenantId, purchase_id: purchase.id },
        select: { id: true },
      });
      if (purchaseItems.length === 0) {
        throw new Error("Every purchase line requires current GST evidence before acceptance.");
      }
      const currentLineEvidenceCount = await tx.purchase_gst_line_evidence.count({
        where: {
          tenant_id: ctx.tenantId,
          purchase_invoice_id: purchase.id,
          evidence_revision_id: evidence.id,
        },
      });
      if (currentLineEvidenceCount !== purchaseItems.length) {
        throw new Error("Every purchase line requires current GST evidence before acceptance.");
      }
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
          decided_by_membership_id: ctx.membershipId,
        },
      });
      const updatedLineCount = await tx.$executeRaw(Prisma.sql`
        UPDATE "purchase_invoice_items" AS item
        SET
          "accepted_taxable_value" = CASE WHEN ${source} = 'SUPPLIER_DECLARED'
            THEN line."declared_taxable_value" ELSE item."calculated_taxable_value" END,
          "accepted_cgst" = CASE WHEN ${source} = 'SUPPLIER_DECLARED'
            THEN line."declared_cgst" ELSE item."calculated_cgst" END,
          "accepted_sgst" = CASE WHEN ${source} = 'SUPPLIER_DECLARED'
            THEN line."declared_sgst" ELSE item."calculated_sgst" END,
          "accepted_igst" = CASE WHEN ${source} = 'SUPPLIER_DECLARED'
            THEN line."declared_igst" ELSE item."calculated_igst" END,
          "accepted_cess" = CASE WHEN ${source} = 'SUPPLIER_DECLARED'
            THEN line."declared_cess" ELSE item."calculated_cess" END,
          "accepted_line_total" = CASE WHEN ${source} = 'SUPPLIER_DECLARED'
            THEN line."declared_line_total" ELSE item."line_total" END,
          "accepted_value_source" = ${source},
          "accepted_reason" = ${parsed.data.rationale},
          "accepted_at" = CURRENT_TIMESTAMP,
          "accepted_by_membership_id" = ${ctx.membershipId},
          "accepted_decision_id" = ${decision.id},
          "gst_acceptance_status" = 'ACCEPTED',
          "gst_acceptance_reference" = ${parsed.data.decision_reference}
        FROM "purchase_gst_line_evidence" AS line
        WHERE item."tenant_id" = ${ctx.tenantId}
          AND item."purchase_id" = ${purchase.id}
          AND line."tenant_id" = item."tenant_id"
          AND line."purchase_invoice_id" = item."purchase_id"
          AND line."purchase_invoice_item_id" = item."id"
          AND line."evidence_revision_id" = ${evidence.id}
      `);
      if (updatedLineCount !== purchaseItems.length) {
        throw new Error("Every purchase line must receive an immutable accounting acceptance snapshot.");
      }
      const updated = await tx.purchase_invoices.updateMany({
        where: {
          id: purchase.id,
          tenant_id: ctx.tenantId,
          status: __PurchaseStatusDRAFT,
          gst_reconciliation_status: "MATCHED",
          gst_accounting_acceptance_status: "NOT_ACCEPTED",
          current_gst_accounting_decision_id: null,
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
          actor_membership_id: ctx.membershipId,
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
    const lineInputsRaw = parseIndexedPurchaseGstResolutionLines(formData);
    const lineInputs: any[] = [];
    const lineInputErrors: Record<string, string[] | undefined> = {};
    for (let index = 0; index < lineInputsRaw.length; index += 1) {
      const lineParsed = PurchaseGstResolutionLineSchema.safeParse(lineInputsRaw[index]);
      if (!lineParsed.success) {
        Object.assign(lineInputErrors, flattenFieldErrors(lineParsed.error.flatten().fieldErrors));
      } else {
        lineInputs.push(lineParsed.data);
      }
    }
    if (parsed.data.accepted_value_source === "EXPLICIT_DECISION" &&
        (lineInputs.length === 0 || Object.keys(lineInputErrors).length > 0)) {
      return {
        ok: false,
        message: "Explicit discrepancy resolution requires complete accepted values for every purchase line.",
        errors: lineInputErrors,
      };
    }
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "accept_purchase_gst" as PermissionAction);
    const result = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      const purchase = await tx.purchase_invoices.findUnique({ where: { id: purchaseId, tenant_id: ctx.tenantId } });
      if (!purchase || purchase.status !== __PurchaseStatusDRAFT) throw new Error("Only an existing draft purchase can be resolved.");
      assertPurchaseGstRevisionCurrent(purchase, parsed.data);
      if (
        purchase.gst_accounting_acceptance_status !== "NOT_ACCEPTED" ||
        purchase.current_gst_accounting_decision_id !== null
      ) {
        throw new Error("GST accounting acceptance is already recorded; refresh before retrying.");
      }
      if (!purchase.current_gst_evidence_revision_id || !purchase.current_gst_calculation_id) throw new Error("Current GST evidence and calculation are required.");
      if (purchase.gst_reconciliation_status !== "DISCREPANCY_REQUIRES_REVIEW") throw new Error("Only a review-required GST discrepancy can be resolved.");
      const evidence = await tx.purchase_gst_evidence_revisions.findFirst({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, id: purchase.current_gst_evidence_revision_id } });
      const calculation = await tx.purchase_gst_calculations.findFirst({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, id: purchase.current_gst_calculation_id } });
      if (!evidence || !calculation) throw new Error("Current GST revisions could not be loaded.");
      const items = await tx.purchase_invoice_items.findMany({
        where: { tenant_id: ctx.tenantId, purchase_id: purchase.id },
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
      });
      const lineEvidence = await tx.purchase_gst_line_evidence.findMany({
        where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, evidence_revision_id: evidence.id },
      });
      if (items.length === 0 || lineEvidence.length !== items.length) {
        throw new Error("Every purchase line requires current supplier GST evidence before resolution.");
      }
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
      const evidenceByItem = new Map(lineEvidence.map((line) => [line.purchase_invoice_item_id, line]));
      const inputByItem = new Map(lineInputs.map((line) => [line.item_id, line]));
      if (inputByItem.size !== lineInputs.length || (parsed.data.accepted_value_source === "EXPLICIT_DECISION" && inputByItem.size !== items.length)) {
        throw new Error("Each purchase line must have exactly one accepted-value decision.");
      }
      const acceptedLineValues = items.map((item) => {
        const supplierLine = evidenceByItem.get(item.id);
        const explicitLine = inputByItem.get(item.id);
        if (!supplierLine) throw new Error("A purchase line is missing supplier GST evidence.");
        if (parsed.data.accepted_value_source === "EXPLICIT_DECISION") {
          if (!explicitLine) throw new Error("Explicit accepted values are missing for a purchase line.");
          return explicitLine;
        }
        const useSupplier = parsed.data.accepted_value_source === "SUPPLIER_DECLARED";
        return {
          item_id: item.id,
          accepted_taxable_value: fixedAmount(useSupplier ? supplierLine.declared_taxable_value : item.calculated_taxable_value),
          accepted_cgst: fixedAmount(useSupplier ? supplierLine.declared_cgst : item.calculated_cgst),
          accepted_sgst: fixedAmount(useSupplier ? supplierLine.declared_sgst : item.calculated_sgst),
          accepted_igst: fixedAmount(useSupplier ? supplierLine.declared_igst : item.calculated_igst),
          accepted_cess: fixedAmount(useSupplier ? supplierLine.declared_cess : item.calculated_cess),
          accepted_line_total: fixedAmount(useSupplier ? supplierLine.declared_line_total : item.line_total),
          line_reason: parsed.data.rationale,
        };
      });
      const lineTotals = acceptedLineValues.reduce<{
        taxable_value: Decimal;
        cgst: Decimal;
        sgst: Decimal;
        igst: Decimal;
        cess: Decimal;
        invoice_total: Decimal;
      }>((totals, line) => ({
        taxable_value: totals.taxable_value.add(fixedDecimal(line.accepted_taxable_value)),
        cgst: totals.cgst.add(fixedDecimal(line.accepted_cgst)),
        sgst: totals.sgst.add(fixedDecimal(line.accepted_sgst)),
        igst: totals.igst.add(fixedDecimal(line.accepted_igst)),
        cess: totals.cess.add(fixedDecimal(line.accepted_cess)),
        invoice_total: totals.invoice_total.add(fixedDecimal(line.accepted_line_total)),
      }), {
        taxable_value: Decimal.zero(),
        cgst: Decimal.zero(),
        sgst: Decimal.zero(),
        igst: Decimal.zero(),
        cess: Decimal.zero(),
        invoice_total: Decimal.zero(),
      });
      const aggregateChecks = [
        ["taxable value", lineTotals.taxable_value, accepted.amounts.taxable_value],
        ["CGST", lineTotals.cgst, accepted.amounts.cgst],
        ["SGST", lineTotals.sgst, accepted.amounts.sgst],
        ["IGST", lineTotals.igst, accepted.amounts.igst],
        ["cess", lineTotals.cess, accepted.amounts.cess],
        ["invoice total", lineTotals.invoice_total.add(fixedDecimal(accepted.amounts.round_off)), accepted.amounts.invoice_total],
      ];
      const mismatch = aggregateChecks.find(([, lineValue, aggregateValue]) => !amountsEqual(lineValue, aggregateValue));
      if (mismatch) throw new Error(`Accepted line values do not reconcile to the invoice ${mismatch[0]}.`);
      const resolved = resolvePurchaseGstReconciliation(reconciliation, {
        decision_reference: parsed.data.decision_reference,
        decision: parsed.data.decision,
        rationale: parsed.data.rationale,
        approved_by: ctx.membershipId,
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
          decided_by_membership_id: ctx.membershipId,
        },
      });
      for (const line of acceptedLineValues) {
        const updatedLine = await tx.purchase_invoice_items.updateMany({
          where: {
            tenant_id: ctx.tenantId,
            purchase_id: purchase.id,
            id: line.item_id,
            accepted_decision_id: null,
          },
          data: {
            accepted_taxable_value: line.accepted_taxable_value,
            accepted_cgst: line.accepted_cgst,
            accepted_sgst: line.accepted_sgst,
            accepted_igst: line.accepted_igst,
            accepted_cess: line.accepted_cess,
            accepted_line_total: line.accepted_line_total,
            accepted_value_source: accepted.source,
            accepted_reason: line.line_reason,
            accepted_at: new Date(),
            accepted_by_membership_id: ctx.membershipId,
            accepted_decision_id: decision.id,
            gst_acceptance_status: "ACCEPTED",
            gst_acceptance_reference: accepted.decision_reference,
          },
        });
        if (updatedLine.count !== 1) throw new Error("A purchase line was already accepted or changed while resolving.");
      }
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
          actor_membership_id: ctx.membershipId,
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
    const parsed = PurchaseGstCorrectionSchema.safeParse(formDataToPurchaseObject(formData));
    if (!parsed.success) {
      return {
        ok: false,
        message: "A current GST revision and correction reason are required.",
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
      };
    }
    const data = {
      ...parsed.data,
      lines: parseIndexedPurchaseLinesFromFormData(formData),
    };
    const result = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      const purchase = await tx.purchase_invoices.findUnique({ where: { id: purchaseId, tenant_id: ctx.tenantId } });
      if (!purchase || purchase.status !== __PurchaseStatusDRAFT) throw new Error("Only a draft purchase can be corrected.");
      assertPurchaseGstRevisionCurrent(purchase, data);
      if (!purchase.current_gst_evidence_revision_id || !purchase.current_gst_calculation_id) {
        throw new Error("Current GST evidence and calculation are required.");
      }
      const current = await tx.purchase_gst_evidence_revisions.findFirst({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, id: purchase.current_gst_evidence_revision_id } });
      if (!current) throw new Error("Current GST evidence could not be loaded.");
      const nextRevision = await tx.purchase_gst_evidence_revisions.count({ where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id } }) + 1;
      const currentItems = await tx.purchase_invoice_items.findMany({
        where: { tenant_id: ctx.tenantId, purchase_id: purchase.id },
        select: { product_id: true, quantity: true, purchase_rate: true, discount_pct: true, gst_rate: true },
      });
      const governedLines = await resolvePurchaseLineRules(tx, ctx.tenantId, currentItems, purchase.invoice_date);
      await persistPurchaseGstEvidence(tx, ctx.tenantId, purchase.id, ctx.membershipId, data, {
        gross_amount: Number(purchase.gross_amount),
        total_discount: Number(purchase.total_discount),
        total_tax: Number(purchase.total_tax),
        round_off: Number(purchase.round_off),
        net_amount: Number(purchase.net_amount),
      }, governedLines, {
        revisionNumber: nextRevision,
        supersedesRevisionId: current.id,
        correctionReason: data.correction_reason,
        expectedRecordVersion: data.expected_gst_record_version,
        expectedCurrentEvidenceRevisionId: data.expected_gst_evidence_revision_id,
        expectedCurrentCalculationId: data.expected_gst_calculation_id,
        fromStatus: purchase.gst_reconciliation_status,
      });
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
      await establishTenantContext(tx, ctx);
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            concat(CAST(${ctx.tenantId} AS text), ':purchase:', CAST(${idempotencyKey} AS text)),
            0
          )
        )
      `);
      const existing = await tx.purchase_invoices.findUnique({
        where: { id: purchaseId, tenant_id: ctx.tenantId },
        include: { supplier: true, items: true },
      });
      if (!existing) {
        throw new Error("Purchase not found.");
      }
      if (existing.status !== __PurchaseStatusDRAFT) {
        if (existing.status !== __PurchaseStatusFINALIZED) {
          throw new Error("Only draft purchases can be finalized.");
        }
      }
      const treatment = validateGstTreatment(existing.gst_treatment);
      if (!treatment.ok) {
        throw new Error(treatment.error ?? "GST treatment must be selected before finalization.");
      }
      if (existing.tax_mode !== "EXCLUSIVE") {
        throw new Error("Only tax-exclusive GST purchases are enabled for finalization.");
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
      const governedLines = await resolvePurchaseLineRules(tx, ctx.tenantId, items, existing.invoice_date);
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
      if (
        gstDecision.evidence_revision_id !== gstEvidence.id ||
        gstDecision.calculation_id !== gstCalculation.id ||
        !canCompletePurchaseAccounting(
          {
            status: "MATCHED",
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

      const acceptedLineTotals = items.reduce<{
        taxable_value: Decimal;
        cgst: Decimal;
        sgst: Decimal;
        igst: Decimal;
        cess: Decimal;
        invoice_total: Decimal;
      }>((totals, item: any) => {
        if (
          item.accepted_decision_id !== gstDecision.id ||
          item.accepted_value_source !== gstDecision.accepted_value_source ||
          item.gst_acceptance_reference !== gstDecision.decision_reference ||
          item.accepted_taxable_value === null ||
          item.accepted_cgst === null ||
          item.accepted_sgst === null ||
          item.accepted_igst === null ||
          item.accepted_cess === null ||
          item.accepted_line_total === null ||
          item.accepted_at === null ||
          item.accepted_by_membership_id === null
        ) {
          throw new Error("Purchase GST finalization is blocked: every line requires an immutable accounting acceptance snapshot.");
        }
        return {
          taxable_value: totals.taxable_value.add(fixedDecimal(item.accepted_taxable_value)),
          cgst: totals.cgst.add(fixedDecimal(item.accepted_cgst)),
          sgst: totals.sgst.add(fixedDecimal(item.accepted_sgst)),
          igst: totals.igst.add(fixedDecimal(item.accepted_igst)),
          cess: totals.cess.add(fixedDecimal(item.accepted_cess)),
          invoice_total: totals.invoice_total.add(fixedDecimal(item.accepted_line_total)),
        };
      }, {
        taxable_value: Decimal.zero(),
        cgst: Decimal.zero(),
        sgst: Decimal.zero(),
        igst: Decimal.zero(),
        cess: Decimal.zero(),
        invoice_total: Decimal.zero(),
      });
      const postingAggregateChecks = [
        ["taxable value", acceptedLineTotals.taxable_value, gstDecision.accepted_taxable_value],
        ["CGST", acceptedLineTotals.cgst, gstDecision.accepted_cgst],
        ["SGST", acceptedLineTotals.sgst, gstDecision.accepted_sgst],
        ["IGST", acceptedLineTotals.igst, gstDecision.accepted_igst],
        ["cess", acceptedLineTotals.cess, gstDecision.accepted_cess],
        ["invoice total", acceptedLineTotals.invoice_total.add(fixedDecimal(gstDecision.accepted_round_off)), gstDecision.accepted_invoice_total],
      ];
      const postingMismatch = postingAggregateChecks.find(([, lineValue, aggregateValue]) => !amountsEqual(lineValue, aggregateValue));
      if (postingMismatch) throw new Error(`Purchase GST finalization is blocked: accepted line values do not reconcile to the invoice ${postingMismatch[0]}.`);

      const lineComputed = items.map((it: any, index: number) => calculatePurchaseLineTotals({
        quantity: Number(it.quantity ?? 0),
        purchase_rate: Number(it.purchase_rate ?? 0),
        discount_pct: Number(it.discount_pct ?? 0),
        gst_rate: Number(governedLines[index]?.gst_rate ?? 0),
      }));
      const serverTotals = calculatePurchaseInvoiceTotals(lineComputed);
      const hasAcceptedSnapshot =
        gstDecision.accepted_value_source === "SUPPLIER_DECLARED" ||
        gstDecision.accepted_value_source === "APPLICATION_CALCULATED" ||
        gstDecision.accepted_value_source === "EXPLICIT_DECISION";
      const totalDiscount = fixedDecimal(existing.total_discount);
      const acceptedPostingTotals = {
        gross_amount: fixedDecimal(gstDecision.accepted_taxable_value).add(totalDiscount).toNumber(),
        total_discount: totalDiscount.toNumber(),
        total_tax: fixedDecimal(gstDecision.accepted_cgst)
          .add(fixedDecimal(gstDecision.accepted_sgst))
          .add(fixedDecimal(gstDecision.accepted_igst))
          .add(fixedDecimal(gstDecision.accepted_cess))
          .toNumber(),
        round_off: fixedAmount(gstDecision.accepted_round_off),
        net_amount: fixedAmount(gstDecision.accepted_invoice_total),
      };
      const postingTotals = hasAcceptedSnapshot ? acceptedPostingTotals : serverTotals;
      const postingPayload = {
        purchase_id: purchaseId,
        supplier_invoice_no: existing.supplier_invoice_no,
        gst_record_version: existing.gst_record_version,
        current_gst_evidence_revision_id: existing.current_gst_evidence_revision_id,
        current_gst_calculation_id: existing.current_gst_calculation_id,
        current_gst_accounting_decision_id: existing.current_gst_accounting_decision_id,
        totals: Object.fromEntries(
          Object.entries(postingTotals).map(([key, value]) => [key, String(value)]),
        ),
        items: items.map((item: any) => ({
          product_id: item.product_id,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date?.toISOString() ?? null,
          quantity: item.quantity,
          free_qty: item.free_qty,
          purchase_rate: String(item.purchase_rate),
          discount_pct: item.discount_pct === null ? null : String(item.discount_pct),
          discount_amount: String(item.discount_amount),
          gst_rate: String(item.gst_rate),
          gst_amount: hasAcceptedSnapshot
            ? fixedDecimal(item.accepted_cgst)
              .add(fixedDecimal(item.accepted_sgst))
              .add(fixedDecimal(item.accepted_igst))
              .add(fixedDecimal(item.accepted_cess))
              .toString()
            : String(item.gst_amount),
          accepted_taxable_value: String(item.accepted_taxable_value),
          accepted_cgst: String(item.accepted_cgst),
          accepted_sgst: String(item.accepted_sgst),
          accepted_igst: String(item.accepted_igst),
          accepted_cess: String(item.accepted_cess),
          accepted_line_total: String(item.accepted_line_total),
          mrp: item.mrp === null ? null : String(item.mrp),
          sale_rate: item.sale_rate === null ? null : String(item.sale_rate),
          line_total: hasAcceptedSnapshot ? String(item.accepted_line_total) : String(item.line_total),
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

      const diffGross = fixedDecimal(existing.gross_amount).subtract(serverTotals.gross_amount).abs();
      const diffDisc = fixedDecimal(existing.total_discount).subtract(serverTotals.total_discount).abs();
      const diffTax = fixedDecimal(existing.total_tax).subtract(serverTotals.total_tax).abs();
      const diffNet = fixedDecimal(existing.net_amount).subtract(serverTotals.net_amount).abs();
      if (!hasAcceptedSnapshot && (diffGross.compare("0.01") === 1 || diffDisc.compare("0.01") === 1 || diffTax.compare("0.01") === 1 || diffNet.compare("0.01") === 1)) {
        throw new Error("Totals mismatch vs calculated; please review.");
      }

      for (let i = 0; i < items.length; i += 1) {
        const line = items[i];
        const qty = Number(line.quantity ?? 0);
        const governed = governedLines[i];
        await tx.$executeRaw(Prisma.sql`
          UPDATE "purchase_invoice_items"
          SET
            "hsn_sac_catalog_id_snapshot" = ${governed?.hsn_sac_catalog_id ?? null},
            "gst_rule_version_snapshot" = ${governed?.rule_version ?? null},
            "gst_rule_source_reference_snapshot" = ${governed?.rule_source_reference ?? null},
            "gst_rate" = ${Number(governed?.gst_rate ?? 0)},
            "gst_calculation_reference" = ${governed?.rule_version ?? null},
            "gst_amount" = "accepted_cgst" + "accepted_sgst" + "accepted_igst" + "accepted_cess",
            "line_total" = "accepted_line_total",
            "recoverable_itc" = NULL,
            "non_recoverable_gst" = NULL,
            "inventory_acquisition_cost" = NULL,
            "inventory_valuation_status" = 'PENDING',
            "inventory_valuation_policy_version" = NULL
          WHERE "id" = ${line.id} AND "tenant_id" = ${ctx.tenantId}
        `);
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
            inventory_valuation_status: "PENDING",
            inventory_acquisition_cost: null,
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
              unit_rate: null,
              inventory_acquisition_cost: null,
              inventory_valuation_status: "PENDING",
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
          gross_amount: postingTotals.gross_amount,
          total_discount: postingTotals.total_discount,
          total_tax: postingTotals.total_tax,
          round_off: postingTotals.round_off,
          net_amount: postingTotals.net_amount,
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

      const balanceBefore = await lockSupplierBalance(tx, ctx.tenantId, existing.supplier_id);
      const credit = postingTotals.net_amount;
      const balanceAfter = decimalOrZero(balanceBefore).add(credit).round(2, "HALF_UP").toNumber();

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

    if (process.env.FINANCIAL_E2E_TEST_MODE !== "true") {
      revalidatePath("/purchases");
      revalidatePath("/inventory");
      revalidatePath("/dashboard");
    }
    redirect(`/purchases?created=${encodeURIComponent(invoice.id)}&finalized=1`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    if (isSupplierInvoiceUniqueViolation(e)) {
      return {
        ok: false,
        message: "Supplier invoice number already exists for this supplier; review the possible duplicate before posting.",
        errors: undefined,
      };
    }
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
    const delta = data.quantity_delta;
    const adjustmentNotes = data.reason + (data.notes ? ` — ${data.notes}` : "");

    await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            concat(${ctx.tenantId}, ':stock-adjustment:', ${data.idempotency_key}),
            0
          )
        )
      `);
      const batch = await tx.product_batches.findUnique({
        where: { id: data.batch_id, tenant_id: ctx.tenantId },
      });
      if (!batch) {
        throw new Error("Batch not found.");
      }

      const movement: StockMovementType = delta > 0 ? __MovementADJUSTMENT_IN : __MovementADJUSTMENT_OUT;
      const prior = await tx.stock_movements.findFirst({
        where: {
          tenant_id: ctx.tenantId,
          reference_type: "stock_adjustment",
          reference_id: data.idempotency_key,
        },
        select: {
          batch_id: true,
          product_id: true,
          movement_type: true,
          quantity_delta: true,
          notes: true,
        },
      });
      if (prior) {
        if (
          prior.batch_id !== batch.id ||
          prior.product_id !== batch.product_id ||
          prior.movement_type !== movement ||
          prior.quantity_delta !== delta ||
          prior.notes !== adjustmentNotes
        ) {
          throw new Error("This idempotency key was already used with a different stock adjustment.");
        }
        return;
      }

      if (delta < 0) {
        const updated = await tx.product_batches.updateMany({
          where: {
            id: data.batch_id,
            tenant_id: ctx.tenantId,
            available_qty: { gte: Math.abs(delta) },
          },
          data: {
            available_qty: { decrement: Math.abs(delta) },
            updated_at: new Date(),
          },
        });
        if (updated.count !== 1) {
          throw new Error("Insufficient available quantity for this batch.");
        }
      } else {
        await tx.product_batches.update({
          where: { id: data.batch_id, tenant_id: ctx.tenantId },
          data: {
            available_qty: { increment: delta },
            updated_at: new Date(),
          },
        });
      }

      await tx.stock_movements.create({
        data: {
          tenant_id: ctx.tenantId,
          product_id: batch.product_id,
          batch_id: batch.id,
          movement_type: movement,
          quantity_delta: delta,
          reference_type: "stock_adjustment",
          reference_id: data.idempotency_key,
          unit_rate: batch.purchase_rate ? Number(batch.purchase_rate) : 0,
          notes: adjustmentNotes,
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
