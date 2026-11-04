"use server";

import { revalidatePath } from "next/cache.js";
import { redirect } from "next/navigation.js";
import { createHash } from "node:crypto";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import { Prisma } from "@prisma/client";
import type { sales_invoices, InvoiceStatus, StockMovementType, LedgerEntryType, PaymentMode, PermissionAction } from "@prisma/client";
import {
  SalesInvoiceCreateSchema,
  SalesInvoiceLineCreateSchema,
  CustomerPaymentCreateSchema,
  SupplierPaymentCreateSchema,
  STORAGE_SALES_STATUS_DRAFT,
  STORAGE_SALES_STATUS_FINALIZED,
  STORAGE_SALES_STATUS_CANCELLED,
  __MAX_SALES_TOTALS_MISMATCH_PAISE,
} from "@/lib/validation/sales.schemas";
import {
  gstCalculator,
  canMarkSalesInvoiceComplete,
  calculateSalesLineAmounts,
  requireResolvedPlaceOfSupply,
  toPersistedSalesTaxFacts,
  toTaxableGstLine,
  type GstPlaceOfSupply,
  type GstTotals,
} from "@/domain/services/gst-calculator.service";
import { normalizeState } from "@/lib/constants/indian-states";
import { fefoBatchPicker } from "@/domain/services/fefo-batch.service";
import { validateGstTreatment } from "@/lib/gst/treatment";
import {
  isApprovedGstClassification,
  resolveApprovedGstRule,
} from "@/lib/gst/rule-governance";
import { decimalOrZero, sumDecimals } from "@/lib/decimal";
import { lockCounterpartyBalance } from "@/lib/db/counterparty-lock";

const __SalesStatusDRAFT: InvoiceStatus = "DRAFT";
const __SalesStatusFINALIZED: InvoiceStatus = "FINALIZED";
const __SalesStatusCANCELLED: InvoiceStatus = "CANCELLED";
const __MovementSALE_OUT: StockMovementType = "SALE_OUT";
const __LedgerEntryINVOICE: LedgerEntryType = "INVOICE";
const __LedgerEntryPAYMENT_RECEIVED: LedgerEntryType = "PAYMENT_RECEIVED";
const __LedgerEntryPAYMENT_MADE: LedgerEntryType = "PAYMENT_MADE";

function paymentMethodToPrismaMode(method: string): PaymentMode {
  if (method === "Cash") return "CASH";
  if (method === "UPI") return "UPI";
  if (method === "CREDIT") return "CREDIT";
  return "CREDIT";
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
      for (const nk of Object.keys(nested)) out[`${key}.${nk}`] = nested[nk];
    }
  }
  return out;
}

function parseIndexedSalesLinesFromFormData(formData: FormData): any[] {
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

function formDataToSalesObject(formData: FormData): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [rawKey, value] of formData.entries()) {
    const key = String(rawKey);
    if (key.startsWith("lines[")) continue;
    out[key] = value === null ? "" : String(value);
  }
  return out;
}

function round2(n: number): number {
  return decimalOrZero(n).round(2, "HALF_UP").toNumber();
}

function computeServerGstTotals(items: any[], placeOfSupply: GstPlaceOfSupply): GstTotals {
  return gstCalculator.computeTotals(
    items.map((item: any) => toTaxableGstLine(item)),
    { placeOfSupply },
  );
}

function computeFefoAllocationForLine(productId: string, requiredQty: number, batches: any[]) {
  return fefoBatchPicker.pick({
    product_id: productId,
    required_quantity: requiredQty,
    skip_blocked: true,
    min_expiry_date: new Date(),
  }, batches);
}

function canonicalSalesFinalizationPayload(tenantId: string, saleId: string): string {
  return JSON.stringify({
    operation: "FINALIZE_SALES_INVOICE",
    tenantId,
    saleId,
  });
}

function salesFinalizationPayloadHash(tenantId: string, saleId: string): string {
  return createHash("sha256").update(canonicalSalesFinalizationPayload(tenantId, saleId), "utf8").digest("hex");
}

async function resolveSalesLineRules(
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
  const rulesByCatalogId = new Map<string, Array<{
    id: string;
    hsn_sac_catalog_id: string | null;
    rule_version: string;
    tax_rate: number | null;
    component_policy: string;
    approval_status: "PENDING" | "APPROVED" | "REJECTED";
    source_reference: string | null;
    effective_from: Date;
    effective_to: Date | null;
    is_active: boolean;
  }>>();
  for (const rule of rules) {
    if (!rule.hsn_sac_catalog_id) continue;
    const current = rulesByCatalogId.get(rule.hsn_sac_catalog_id) ?? [];
    current.push({ ...rule, tax_rate: rule.tax_rate === null ? null : Number(rule.tax_rate) });
    rulesByCatalogId.set(rule.hsn_sac_catalog_id, current);
  }

  return lines.map((line) => {
    const product = productsById.get(String(line.product_id));
    if (!product) throw new Error("Sales line product is missing or belongs to another tenant.");
    if (!product.hsn_code?.trim()) {
      throw new Error(`Sales GST finalization is blocked: product ${product.id} has no HSN/SAC classification.`);
    }
    const classification = classificationsByCode.get(product.hsn_code);
    if (!classification || !isApprovedGstClassification(classification, effectiveAt)) {
      throw new Error(`Sales GST finalization is blocked: HSN/SAC ${product.hsn_code} is not approved and effective.`);
    }
    const resolution = resolveApprovedGstRule(
      rulesByCatalogId.get(classification.id) ?? [],
      effectiveAt,
      classification.id,
    );
    if (!resolution.ok || resolution.rule.tax_rate === null) {
      throw new Error(`Sales GST finalization is blocked: exactly one approved GST rule is required for HSN/SAC ${product.hsn_code}.`);
    }
    return {
      ...line,
      gst_rate: Number(resolution.rule.tax_rate),
      hsn_code_snapshot: product.hsn_code,
      hsn_sac_catalog_id_snapshot: classification.id,
      gst_rule_version_snapshot: resolution.rule.rule_version,
      gst_rule_source_reference_snapshot: resolution.rule.source_reference,
    };
  });
}

export async function createSalesDraftAction(
  _prevState: ActionResult<sales_invoices>,
  formData: FormData,
): Promise<ActionResult<sales_invoices>> {
  try {
    assertPostgresConfigured("createSalesDraftAction");
    const payload = formDataToSalesObject(formData);
    const linesRaw = parseIndexedSalesLinesFromFormData(formData);
    payload.lines = linesRaw;

    const linesParsed: any[] = [];
    const linesErrors: Record<string, string[] | undefined> = {};
    for (let i = 0; i < linesRaw.length; i += 1) {
      const parsedLine = SalesInvoiceLineCreateSchema.safeParse(linesRaw[i]);
      if (!parsedLine.success) {
        const fe = flattenFieldErrors(parsedLine.error.flatten().fieldErrors);
        for (const k of Object.keys(fe)) linesErrors[`lines[${i}].${k}`] = fe[k];
      } else {
        linesParsed.push(parsedLine.data);
      }
    }

    const parsed = SalesInvoiceCreateSchema.safeParse(payload);
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
    requirePermission(ctx, "create_invoice" as PermissionAction);
    const data = parsed.data;
    const treatment = validateGstTreatment(data.gst_treatment);
    if (!treatment.ok) {
      return { ok: false, message: treatment.error, errors: { gst_treatment: [treatment.error ?? "Invalid GST treatment."] } };
    }

    const profile = await prisma.business_profiles.findUnique({ where: { tenant_id: ctx.tenantId } });
    const customer = data.customer_id
      ? await prisma.customers.findUnique({ where: { id: data.customer_id, tenant_id: ctx.tenantId } })
      : null;
    const businessState = profile?.state ?? null;
    const capturedPlaceOfSupplyState = normalizeState(data.place_of_supply_state);
    const placeResult = gstCalculator.detectPlace(businessState, capturedPlaceOfSupplyState);
    if (placeResult.type === "UNKNOWN") {
      return {
        ok: false,
        message: "Cannot save invoice draft until supplier and customer states are valid.",
      };
    }
    const placeOfSupply = placeResult.type;

    const invoice = await prisma.$transaction(async (tx) => {
      const governedLines = await resolveSalesLineRules(tx, ctx.tenantId, linesParsed, data.invoice_date);
      const gstTotals = computeServerGstTotals(governedLines, placeOfSupply);
      const lineAmounts = governedLines.map((line: any) => calculateSalesLineAmounts(line));
      const totalDiscount = sumDecimals(lineAmounts.map((line) => line.discount_amount))
        .round(2, "HALF_UP")
        .toNumber();
      const created = await tx.sales_invoices.create({
        data: {
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          customer_id: data.customer_id,
          invoice_no: "",
          invoice_date: data.invoice_date instanceof Date ? data.invoice_date : new Date(data.invoice_date as any),
          status: __SalesStatusDRAFT,
          tax_data_status: "UNVERIFIED_DRAFT",
          gst_treatment: treatment.treatment,
          tax_mode: data.tax_mode,
          is_cash_sale: !!data.is_cash_sale,
          gross_amount: round2(gstTotals.total_taxable),
          total_discount: totalDiscount,
          total_tax: gstTotals.total_tax,
          round_off: gstTotals.round_off_applied,
          net_amount: gstTotals.grand_total,
          place_of_supply_code: capturedPlaceOfSupplyState,
          paid_amount: 0,
          balance_due: gstTotals.grand_total,
          payment_mode: data.is_cash_sale ? paymentMethodToPrismaMode("Cash") : null,
          notes: data.notes ?? null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const itemsData = governedLines.map((line: any, index: number) => {
        const qty = Number(line.quantity ?? 0);
        const rate = Number(line.sale_rate ?? 0);
        const lineAmount = lineAmounts[index];
        const lineSplit = gstTotals.lines[index];
        if (!lineSplit || !lineAmount) throw new Error("GST line calculation missing.");
        const persistedTax = toPersistedSalesTaxFacts(lineSplit);
        return {
          tenant_id: ctx.tenantId,
          invoice_id: created.id,
          product_id: line.product_id,
          batch_id: line.batch_id ?? null,
          batch_no: line.batch_no ?? "",
          quantity: qty,
          free_qty: Number(line.free_qty ?? 0),
          sale_rate: rate,
          mrp: line.mrp ? Number(line.mrp) : null,
          discount_pct: Number(line.trade_discount_pct ?? 0),
          discount_amount: lineAmount.discount_amount,
          taxable_amount: persistedTax.taxable_amount,
          gst_rate: Number(line.gst_rate ?? 0),
          gst_amount: persistedTax.gst_amount,
          cgst_amount: persistedTax.cgst_amount,
          sgst_amount: persistedTax.sgst_amount,
          igst_amount: persistedTax.igst_amount,
          cess_amount: persistedTax.cess_amount,
          hsn_code_snapshot: line.hsn_code_snapshot,
          line_total: persistedTax.line_total,
          created_at: new Date(),
        };
      });

      if (itemsData.length > 0) {
        await tx.sales_invoice_items.createMany({ data: itemsData });
      }

      return created;
    });

    revalidatePath("/billing");
    revalidatePath("/dashboard");
    redirect(`/billing?created=${encodeURIComponent(invoice.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Invoice draft could not be saved. Please try again.",
      errors: undefined,
    };
  }
}

export async function cancelSalesDraftAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("cancelSalesDraftAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "cancel_invoice" as PermissionAction);
    const existing = await prisma.sales_invoices.findUnique({
      where: { id, tenant_id: ctx.tenantId },
    });
    if (!existing) return { ok: false, message: "Invoice not found." };
    if (existing.status !== __SalesStatusDRAFT) {
      return { ok: false, message: "Only draft invoices can be cancelled." };
    }
    await prisma.sales_invoices.update({
      where: { id, tenant_id: ctx.tenantId },
      data: {
        status: __SalesStatusCANCELLED,
        cancelled_at: new Date(),
        cancelled_by: ctx.userId,
        updated_at: new Date(),
      },
    });
    revalidatePath("/billing");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (_e: any) {
    return { ok: false, message: "Invoice could not be cancelled. Please try again." };
  }
}

export async function finalizeSalesInvoiceAction(
  saleId: string,
  _prevState: ActionResult<sales_invoices>,
  formData: FormData,
): Promise<ActionResult<sales_invoices>> {
  const requestedIdempotencyKey = String(formData.get("idempotency_key") ?? "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestedIdempotencyKey)) {
    return {
      ok: false,
      message: "A valid idempotency key is required.",
      errors: undefined,
    };
  }
  const idempotencyKey = requestedIdempotencyKey;
  try {
    assertPostgresConfigured("finalizeSalesInvoiceAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "finalize_invoice" as PermissionAction);
    const payloadHash = salesFinalizationPayloadHash(ctx.tenantId, saleId);

    let replayed = false;
    const invoice = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        SELECT set_config('request.jwt.claim.tenant_id', ${ctx.tenantId}, true)
      `);
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            concat(CAST(${ctx.tenantId} AS text), ':', CAST(${idempotencyKey} AS text)),
            0
          )
        )
      `);
      const priorOperation = await tx.sales_posting_operations.findUnique({
        where: {
          tenant_id_idempotency_key: {
            tenant_id: ctx.tenantId,
            idempotency_key: idempotencyKey,
          },
        },
      });
      if (priorOperation) {
        if (priorOperation.request_payload_hash !== payloadHash) {
          throw new Error("This idempotency key was already used with a different sales payload.");
        }
        if (priorOperation.status === "COMPLETED" && priorOperation.result_sales_id) {
          const committed = await tx.sales_invoices.findUnique({
            where: { id: priorOperation.result_sales_id, tenant_id: ctx.tenantId },
          });
          if (!committed) throw new Error("Committed sales operation result is missing.");
          replayed = true;
          return committed;
        }
        throw new Error("This sales finalization operation is already in progress.");
      }

      const existing = await tx.sales_invoices.findUnique({
        where: { id: saleId, tenant_id: ctx.tenantId },
        include: { customer: true, items: { include: { product: true, batch: true } } },
      });
      if (!existing) throw new Error("Invoice not found.");
      if (existing.status === __SalesStatusFINALIZED) throw new Error("Invoice already finalized.");
      if (existing.status !== __SalesStatusDRAFT) throw new Error("Only draft invoices can be finalized.");
      const treatment = validateGstTreatment(existing.gst_treatment);
      if (!treatment.ok) {
        throw new Error(treatment.error ?? "GST treatment must be selected before finalization.");
      }
      if (existing.tax_mode !== "EXCLUSIVE") {
        throw new Error("Only tax-exclusive GST invoices are enabled for finalization.");
      }
      if (!existing.customer) throw new Error("Customer not found.");

      await tx.sales_posting_operations.create({
        data: {
          tenant_id: ctx.tenantId,
          sales_invoice_id: saleId,
          idempotency_key: idempotencyKey,
          request_payload_hash: payloadHash,
          status: "PROCESSING",
        },
      });
      if (
        process.env.FINANCIAL_E2E_TEST_MODE === "true" &&
        process.env.FINANCIAL_E2E_TEST_FAIL_BEFORE_COMMIT === "true"
      ) {
        throw new Error("FINANCIAL_E2E_SIMULATED_PRE_COMMIT_FAILURE");
      }

      const items: any[] = existing.items as any[] ?? [];
      if (items.length === 0) throw new Error("No line items found.");
      const governedLines = await resolveSalesLineRules(tx, ctx.tenantId, items, existing.invoice_date);

      const profile = await tx.business_profiles.findUnique({ where: { tenant_id: ctx.tenantId } });
      const tenant = await tx.tenants.findUnique({
        where: { id: ctx.tenantId },
        select: { business_name: true },
      });
      const businessState = profile?.state ?? null;
      const capturedPlaceOfSupplyState = normalizeState(existing.place_of_supply_code);
      const placeOfSupply = requireResolvedPlaceOfSupply(
        gstCalculator.detectPlace(businessState, capturedPlaceOfSupplyState),
      );
      const serverGst = computeServerGstTotals(governedLines, placeOfSupply);
      const persistedPlaceOfSupplyCode = capturedPlaceOfSupplyState;
      if (!persistedPlaceOfSupplyCode) {
        throw new Error("Cannot finalize invoice until customer place-of-supply state is valid.");
      }
      const cust = existing.customer;
      const snapshotsReady = canMarkSalesInvoiceComplete({
        sellerName: tenant?.business_name,
        sellerState: profile?.state,
        customerName: cust.business_name,
        customerState: cust.billing_state,
        productNames: items.map((line) => line.product?.name),
        placeOfSupplyCode: persistedPlaceOfSupplyCode,
        lines: serverGst.lines.map((line) => ({
          ...line,
          taxable_amount: line.taxable_value,
        })),
      });
      if (!snapshotsReady) {
        throw new Error("Cannot finalize invoice until required historical snapshot facts are available.");
      }
      const diffGross = decimalOrZero(existing.gross_amount?.toString()).subtract(serverGst.total_taxable).abs();
      const diffTax = decimalOrZero(existing.total_tax?.toString()).subtract(serverGst.total_tax).abs();
      const diffNet = decimalOrZero(existing.net_amount?.toString()).subtract(serverGst.grand_total).abs();
      if (
        diffGross.compare(__MAX_SALES_TOTALS_MISMATCH_PAISE) === 1 ||
        diffTax.compare(__MAX_SALES_TOTALS_MISMATCH_PAISE) === 1 ||
        diffNet.compare(__MAX_SALES_TOTALS_MISMATCH_PAISE) === 1
      ) {
        throw new Error("Totals mismatch vs calculated; please review lines, rates or GST.");
      }

      for (let index = 0; index < items.length; index += 1) {
        const line = items[index];
        const calculated = serverGst.lines[index];
        if (!calculated) throw new Error("GST line calculation missing.");
        const persistedTax = toPersistedSalesTaxFacts(calculated);
        await tx.sales_invoice_items.update({
          where: { id: line.id },
          data: {
            taxable_amount: persistedTax.taxable_amount,
            cgst_amount: persistedTax.cgst_amount,
            sgst_amount: persistedTax.sgst_amount,
            igst_amount: persistedTax.igst_amount,
            cess_amount: persistedTax.cess_amount,
            hsn_code_snapshot: governedLines[index]?.hsn_code_snapshot ?? null,
            product_name_snapshot: line.product?.name ?? null,
            generic_name_snapshot: line.product?.generic_name ?? null,
            batch_expiry_snapshot: line.batch?.expiry_date ?? null,
          },
        });
        await tx.$executeRaw(Prisma.sql`
          UPDATE "sales_invoice_items"
          SET
            "hsn_sac_catalog_id_snapshot" = ${governedLines[index]?.hsn_sac_catalog_id_snapshot ?? null},
            "gst_rule_version_snapshot" = ${governedLines[index]?.gst_rule_version_snapshot ?? null},
            "gst_rule_source_reference_snapshot" = ${governedLines[index]?.gst_rule_source_reference_snapshot ?? null}
          WHERE "id" = ${line.id} AND "tenant_id" = ${ctx.tenantId}
        `);
      }

      const distinctProductIds = Array.from(new Set(items.map((it) => it.product_id)));
      const batchesByProductRaw = await tx.product_batches.findMany({
        where: {
          tenant_id: ctx.tenantId,
          product_id: { in: distinctProductIds },
          available_qty: { gt: 0 },
          is_blocked: false,
          OR: [{ expiry_date: { gte: new Date() } }, { expiry_date: null }],
        },
      });
      const batchesByProduct = new Map<string, any[]>();
      for (const b of batchesByProductRaw) {
        const arr = batchesByProduct.get(b.product_id) ?? [];
        arr.push(b);
        batchesByProduct.set(b.product_id, arr);
      }

      for (const line of items) {
        const batches = batchesByProduct.get(line.product_id) ?? [];
        const requiredQty = Number(line.quantity ?? 0);
        const alloc = computeFefoAllocationForLine(line.product_id, requiredQty, batches);
        if (alloc.shortfall > 0) {
          throw new Error(`Insufficient FEFO stock for product line #${items.indexOf(line) + 1}: shortfall ${alloc.shortfall} units.`);
        }
        let runningQty = requiredQty;
        for (const pick of alloc.batches) {
          if (runningQty <= 0) break;
          const deduct = pick.allocated_quantity;
          if (deduct <= 0) continue;
          const decremented = await tx.product_batches.updateMany({
            where: { id: pick.batch_id, tenant_id: ctx.tenantId, available_qty: { gte: deduct } },
            data: { available_qty: { decrement: deduct }, updated_at: new Date() },
          });
          if (decremented.count !== 1) {
            throw new Error("Stock changed while finalizing this invoice. Please try again.");
          }
          const batch = batches.find((candidate) => candidate.id === pick.batch_id);
          if (batch) batch.available_qty = Number(batch.available_qty ?? 0) - deduct;
          await tx.stock_movements.create({
            data: {
              tenant_id: ctx.tenantId,
              product_id: line.product_id,
              batch_id: pick.batch_id,
              movement_type: __MovementSALE_OUT,
              quantity_delta: -deduct,
              reference_type: "sales_invoice",
              reference_id: existing.id,
              unit_rate: Number(line.sale_rate ?? 0),
              notes: null,
              created_by: ctx.userId,
              created_at: new Date(),
            },
          });
          runningQty -= deduct;
        }
      }

      let finalInvoiceNo = existing.invoice_no;
      if (!finalInvoiceNo || !finalInvoiceNo.trim()) {
        const bp = profile ?? await tx.business_profiles.findUnique({ where: { tenant_id: ctx.tenantId } });
        if (bp) {
          const prefix = bp.invoice_prefix ?? "INV";
          const seq = bp.invoice_next_seq ?? 1;
          finalInvoiceNo = `${prefix}-${String(seq).padStart(5, "0")}`;
          await tx.business_profiles.update({
            where: { tenant_id: ctx.tenantId },
            data: { invoice_next_seq: seq + 1, updated_at: new Date() },
          });
        } else {
          const cnt = await tx.sales_invoices.count({ where: { tenant_id: ctx.tenantId } });
          finalInvoiceNo = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(cnt + 1).padStart(3, "0")}`;
        }
      }

      const updated = await tx.sales_invoices.update({
        where: { id: existing.id, tenant_id: ctx.tenantId },
        data: {
          invoice_no: finalInvoiceNo,
          status: __SalesStatusFINALIZED,
          tax_data_status: "COMPLETE",
          place_of_supply_code: persistedPlaceOfSupplyCode,
          seller_name_snapshot: tenant?.business_name ?? null,
          seller_address_line_1_snapshot: profile?.address_line_1 ?? null,
          seller_address_line_2_snapshot: profile?.address_line_2 ?? null,
          seller_city_snapshot: profile?.city ?? null,
          seller_state_snapshot: normalizeState(profile?.state) ?? profile?.state ?? null,
          seller_pincode_snapshot: profile?.pincode ?? null,
          seller_gstin_snapshot: profile?.gstin ?? null,
          customer_name_snapshot: cust.business_name,
          customer_address_line_1_snapshot: cust.billing_address_1 ?? null,
          customer_address_line_2_snapshot: cust.billing_address_2 ?? null,
          customer_city_snapshot: cust.billing_city ?? null,
          customer_state_snapshot: normalizeState(cust.billing_state) ?? cust.billing_state ?? null,
          customer_pincode_snapshot: cust.billing_pincode ?? null,
          customer_gstin_snapshot: cust.gstin ?? null,
          finalized_at: new Date(),
          gross_amount: serverGst.total_taxable,
          total_discount: Number(existing.total_discount ?? 0),
          total_tax: serverGst.total_tax,
          round_off: serverGst.round_off_applied,
          net_amount: serverGst.grand_total,
          balance_due: serverGst.grand_total,
          updated_at: new Date(),
        },
      });

      await lockCounterpartyBalance(tx, ctx.tenantId, "customer", cust.id);
      const currentCustomer = await tx.customers.findUnique({
        where: { id: cust.id, tenant_id: ctx.tenantId },
        select: { receivable_balance: true },
      });
      if (!currentCustomer) throw new Error("Customer not found.");
      const balanceBefore = Number(currentCustomer.receivable_balance ?? 0);
      const debit = serverGst.grand_total;
      const balanceAfter = decimalOrZero(balanceBefore).add(debit).round(2, "HALF_UP").toNumber();

      await tx.customer_ledgers.create({
        data: {
          tenant_id: ctx.tenantId,
          customer_id: cust.id,
          entry_type: __LedgerEntryINVOICE,
          debit,
          credit: 0,
          balance: balanceAfter,
          reference_type: "sales_invoice",
          reference_id: existing.id,
          invoice_id: existing.id,
          narration: `Invoice ${finalInvoiceNo}`,
          entry_date: existing.invoice_date,
          created_at: new Date(),
        },
      });

      await tx.customers.update({
        where: { id: cust.id, tenant_id: ctx.tenantId },
        data: { receivable_balance: { increment: debit }, updated_at: new Date() },
      });

      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          event_type: "INVOICE_FINALIZED",
          actor_id: ctx.userId,
          target_type: "sales_invoice",
          target_id: existing.id,
          metadata: { invoice_no: finalInvoiceNo, net_amount: debit },
          created_at: new Date(),
        },
      });

      await tx.sales_posting_operations.update({
        where: {
          tenant_id_idempotency_key: {
            tenant_id: ctx.tenantId,
            idempotency_key: idempotencyKey,
          },
        },
        data: {
          status: "COMPLETED",
          result_invoice_no: finalInvoiceNo,
          result_sales_id: updated.id,
          updated_at: new Date(),
        },
      });

      return updated;
    });

    if (replayed) {
      redirect(`/billing?created=${encodeURIComponent(invoice.id)}&finalized=1&replayed=1`);
    }
    revalidatePath("/billing");
    revalidatePath("/inventory");
    revalidatePath("/inventory/batches");
    revalidatePath("/inventory/movements");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    redirect(`/billing?created=${encodeURIComponent(invoice.id)}&finalized=1`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    try {
      const ctx = await requireServerTenantContext();
      const retryPayloadHash = salesFinalizationPayloadHash(ctx.tenantId, saleId);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const committed = await prisma.sales_posting_operations.findUnique({
          where: {
            tenant_id_idempotency_key: {
              tenant_id: ctx.tenantId,
              idempotency_key: idempotencyKey,
            },
          },
        });
        if (committed &&
          committed.request_payload_hash === retryPayloadHash &&
          committed.status === "COMPLETED" &&
          committed.result_sales_id) {
          redirect(`/billing?created=${encodeURIComponent(committed.result_sales_id)}&finalized=1&replayed=1`);
        }
        if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } catch (lookupError: any) {
      if (lookupError?.message && typeof lookupError.message === "string" && lookupError.message.includes("NEXT_REDIRECT")) throw lookupError;
    }
    const msg = e?.message && typeof e.message === "string" ? e.message : "Invoice could not be finalized. Please try again.";
    return { ok: false, message: msg, errors: undefined };
  }
}

export async function createCustomerPaymentAction(
  _prevState: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("createCustomerPaymentAction");
    const payload: Record<string, any> = {};
    for (const [rawKey, value] of formData.entries()) {
      payload[String(rawKey)] = value === null ? "" : String(value);
    }
    const parsed = CustomerPaymentCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "view_customer_ledger" as PermissionAction);
    const data = parsed.data;
    const entryDate = data.entry_date ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      await lockCounterpartyBalance(tx, ctx.tenantId, "customer", data.customer_id);
      const cust = await tx.customers.findUnique({
        where: { id: data.customer_id, tenant_id: ctx.tenantId },
        select: { receivable_balance: true },
      });
      if (!cust) throw new Error("Customer not found.");
      const before = decimalOrZero(cust.receivable_balance?.toString());
      const credit = decimalOrZero(data.amount);
      const appliedDecimal = before.compare(credit) < 0 ? before : credit;
      const clamped = before.subtract(appliedDecimal).round(2, "HALF_UP");
      const applied = appliedDecimal.round(2, "HALF_UP").toNumber();
      const newBal = clamped.toNumber();
      const warning = credit.subtract(before).compare("0.001") === 1
        ? "Payment exceeds total dues; clamped to 0 — please verify."
        : null;

      const payment = await tx.payments.create({
        data: {
          tenant_id: ctx.tenantId,
          customer_id: data.customer_id,
          entry_type: __LedgerEntryPAYMENT_RECEIVED,
          payment_mode: paymentMethodToPrismaMode(data.payment_method),
          amount: applied,
          reference_no: data.reference_no,
          payment_date: entryDate,
          notes: data.notes,
          created_by: ctx.userId,
          created_at: new Date(),
        },
      });

      const row = await tx.customer_ledgers.create({
        data: {
          tenant_id: ctx.tenantId,
          customer_id: data.customer_id,
          entry_type: __LedgerEntryPAYMENT_RECEIVED,
          debit: 0,
          credit: applied,
          balance: newBal,
          reference_type: "payment_received",
          reference_id: null,
          invoice_id: null,
          narration: `Payment received — ${data.payment_method}${data.reference_no ? ` #${data.reference_no}` : ""}${data.notes ? ` — ${data.notes}` : ""}`,
          entry_date: entryDate,
          created_at: new Date(),
        },
      });
      await tx.customers.update({
        where: { id: data.customer_id, tenant_id: ctx.tenantId },
        data: { receivable_balance: clamped.toNumber(), updated_at: new Date() },
      });
      return { id: payment.id, warning };
    });

    if (process.env.FINANCIAL_E2E_TEST_MODE !== "true") {
      revalidatePath("/billing");
      revalidatePath("/billing/payments");
      revalidatePath("/customers");
      revalidatePath("/dashboard");
    }
    return {
      ok: true,
      data: { id: result.id },
      message: result.warning ?? undefined,
    };
  } catch (e: any) {
    const msg = e?.message && typeof e.message === "string" ? e.message : "Payment could not be recorded. Please try again.";
    return { ok: false, message: msg, errors: undefined };
  }
}

export async function createSupplierPaymentAction(
  _prevState: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("createSupplierPaymentAction");
    const payload: Record<string, any> = {};
    for (const [rawKey, value] of formData.entries()) {
      payload[String(rawKey)] = value === null ? "" : String(value);
    }
    const parsed = SupplierPaymentCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "view_supplier_ledger" as PermissionAction);
    const data = parsed.data;
    const entryDate = data.entry_date ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      await lockCounterpartyBalance(tx, ctx.tenantId, "supplier", data.supplier_id);
      const sup = await tx.suppliers.findUnique({
        where: { id: data.supplier_id, tenant_id: ctx.tenantId },
        select: { payable_balance: true },
      });
      if (!sup) throw new Error("Supplier not found.");
      const before = decimalOrZero(sup.payable_balance?.toString());
      const debit = decimalOrZero(data.amount);
      const appliedDecimal = before.compare(debit) < 0 ? before : debit;
      const clamped = before.subtract(appliedDecimal).round(2, "HALF_UP");
      const applied = appliedDecimal.round(2, "HALF_UP").toNumber();
      const newBal = clamped.toNumber();
      const warning = debit.subtract(before).compare("0.001") === 1
        ? "Payment exceeds total payables; clamped to 0 — please verify."
        : null;

      const payment = await tx.payments.create({
        data: {
          tenant_id: ctx.tenantId,
          entry_type: __LedgerEntryPAYMENT_MADE,
          payment_mode: paymentMethodToPrismaMode(data.payment_method),
          amount: applied,
          reference_no: data.reference_no,
          payment_date: entryDate,
          notes: data.notes,
          created_by: ctx.userId,
          created_at: new Date(),
        },
      });

      const row = await tx.supplier_ledgers.create({
        data: {
          tenant_id: ctx.tenantId,
          supplier_id: data.supplier_id,
          entry_type: __LedgerEntryPAYMENT_MADE,
          debit: applied,
          credit: 0,
          balance: newBal,
          reference_type: "payment_made",
          reference_id: null,
          purchase_id: null,
          narration: `Payment made — ${data.payment_method}${data.reference_no ? ` #${data.reference_no}` : ""}${data.notes ? ` — ${data.notes}` : ""}`,
          entry_date: entryDate,
          created_at: new Date(),
        },
      });
      await tx.suppliers.update({
        where: { id: data.supplier_id, tenant_id: ctx.tenantId },
        data: { payable_balance: clamped.toNumber(), updated_at: new Date() },
      });
      return { id: payment.id, warning };
    });

    if (process.env.FINANCIAL_E2E_TEST_MODE !== "true") {
      revalidatePath("/purchases");
      revalidatePath("/purchases/payments");
      revalidatePath("/suppliers");
      revalidatePath("/dashboard");
    }
    return {
      ok: true,
      data: { id: result.id },
      message: result.warning ?? undefined,
    };
  } catch (e: any) {
    const msg = e?.message && typeof e.message === "string" ? e.message : "Payment could not be recorded. Please try again.";
    return { ok: false, message: msg, errors: undefined };
  }
}

export async function getSaleForEdit(id: string): Promise<sales_invoices | null> {
  assertPostgresConfigured("getSaleForEdit");
  const ctx = await requireServerTenantContext();
  return prisma.sales_invoices.findUnique({
    where: { id, tenant_id: ctx.tenantId },
    include: { customer: true, items: { include: { product: true, batch: true } } },
  }) as unknown as Promise<sales_invoices | null>;
}
