"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
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
  type LineItemTaxable,
  type GstTotals,
} from "@/domain/services/gst-calculator.service";
import { fefoBatchPicker } from "@/domain/services/fefo-batch.service";

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
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function isInterStateFromCustomer(businessProfileState: string | null | undefined, customerState: string | null | undefined): boolean {
  if (!businessProfileState || !customerState) return false;
  return businessProfileState.trim().toLowerCase() !== customerState.trim().toLowerCase();
}

function computeServerGstTotals(items: any[], isInterState: boolean): GstTotals {
  const lines: LineItemTaxable[] = items.map((it: any) => {
    const qty = Number(it.quantity ?? 0);
    const rate = Number(it.sale_rate ?? 0);
    const discPct = Number(it.trade_discount_pct ?? 0);
    const gross = qty * rate;
    const disc = gross * (discPct / 100);
    const taxable = Math.max(0, round2(gross - disc));
    return {
      taxable_value: taxable,
      gst_rate_pct: Number(it.gst_rate ?? 0),
    };
  });
  return gstCalculator.computeTotals(lines, { placeOfSupply: isInterState ? "INTER" : "INTRA" });
}

function computeFefoAllocationForLine(productId: string, requiredQty: number, batches: any[]) {
  return fefoBatchPicker.pick({
    product_id: productId,
    required_quantity: requiredQty,
    skip_blocked: true,
    min_expiry_date: new Date(),
  }, batches);
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

    const profile = await prisma.business_profiles.findUnique({ where: { tenant_id: ctx.tenantId } });
    const customer = data.customer_id
      ? await prisma.customers.findUnique({ where: { id: data.customer_id, tenant_id: ctx.tenantId } })
      : null;
    const businessState = profile?.state ?? null;
    const customerBillingState = customer?.billing_state ?? null;
    const isInterState = isInterStateFromCustomer(businessState, customerBillingState);

    const gstTotals = computeServerGstTotals(linesParsed, isInterState);

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.sales_invoices.create({
        data: {
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          customer_id: data.customer_id,
          invoice_no: "",
          invoice_date: data.invoice_date instanceof Date ? data.invoice_date : new Date(data.invoice_date as any),
          status: __SalesStatusDRAFT,
          is_cash_sale: !!data.is_cash_sale,
          gross_amount: round2(gstTotals.total_taxable),
          total_discount: Number(data.total_discount ?? 0),
          total_tax: gstTotals.total_tax,
          round_off: gstTotals.round_off_applied,
          net_amount: gstTotals.grand_total,
          paid_amount: 0,
          balance_due: gstTotals.grand_total,
          payment_mode: data.is_cash_sale ? paymentMethodToPrismaMode("Cash") : null,
          notes: data.notes ?? null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const itemsData = linesParsed.map((line: any) => {
        const qty = Number(line.quantity ?? 0);
        const rate = Number(line.sale_rate ?? 0);
        const discPct = Number(line.trade_discount_pct ?? 0);
        const lineGross = round2(qty * rate);
        const lineDiscAmt = round2(lineGross * (discPct / 100));
        const lineTaxable = round2(lineGross - lineDiscAmt);
        const lineGst = round2(lineTaxable * (Number(line.gst_rate ?? 0) / 100));
        const lineTotal = round2(lineTaxable + lineGst);
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
          discount_amount: lineDiscAmt,
          gst_rate: Number(line.gst_rate ?? 0),
          gst_amount: lineGst,
          line_total: lineTotal,
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
  try {
    assertPostgresConfigured("finalizeSalesInvoiceAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, "finalize_invoice" as PermissionAction);

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.sales_invoices.findUnique({
        where: { id: saleId, tenant_id: ctx.tenantId },
        include: { customer: true, items: true },
      });
      if (!existing) throw new Error("Invoice not found.");
      if (existing.status === __SalesStatusFINALIZED) throw new Error("Invoice already finalized.");
      if (existing.status !== __SalesStatusDRAFT) throw new Error("Only draft invoices can be finalized.");
      if (!existing.customer) throw new Error("Customer not found.");

      const items: any[] = existing.items as any[] ?? [];
      if (items.length === 0) throw new Error("No line items found.");

      const profile = await tx.business_profiles.findUnique({ where: { tenant_id: ctx.tenantId } });
      const businessState = profile?.state ?? null;
      const customerBillingState = existing.customer.billing_state ?? null;
      const isInterState = isInterStateFromCustomer(businessState, customerBillingState);

      const serverGst = computeServerGstTotals(items, isInterState);
      const diffGross = Math.abs(Number(existing.gross_amount ?? 0) - serverGst.total_taxable);
      const diffTax = Math.abs(Number(existing.total_tax ?? 0) - serverGst.total_tax);
      const diffNet = Math.abs(Number(existing.net_amount ?? 0) - serverGst.grand_total);
      if (
        diffGross > __MAX_SALES_TOTALS_MISMATCH_PAISE ||
        diffTax > __MAX_SALES_TOTALS_MISMATCH_PAISE ||
        diffNet > __MAX_SALES_TOTALS_MISMATCH_PAISE
      ) {
        throw new Error("Totals mismatch vs calculated; please review lines, rates or GST.");
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

      const cust = existing.customer;
      const balanceBefore = Number(cust.receivable_balance ?? 0);
      const debit = serverGst.grand_total;
      const balanceAfter = round2(balanceBefore + debit);

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

      return updated;
    });

    revalidatePath("/billing");
    revalidatePath("/inventory");
    revalidatePath("/inventory/batches");
    revalidatePath("/inventory/movements");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    redirect(`/billing?created=${encodeURIComponent(invoice.id)}&finalized=1`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
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
      const cust = await tx.customers.findUnique({
        where: { id: data.customer_id, tenant_id: ctx.tenantId },
        select: { receivable_balance: true },
      });
      if (!cust) throw new Error("Customer not found.");
      const before = Number(cust.receivable_balance ?? 0);
      const credit = Number(data.amount);
      const applied = Math.min(before, credit);
      const clamped = Math.max(0, before - applied);
      const newBal = round2(clamped);
      const warning = before < credit - 0.001 ? "Payment exceeds total dues; clamped to 0 — please verify." : null;

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
        data: { receivable_balance: clamped, updated_at: new Date() },
      });
      return { id: payment.id, warning };
    });

    revalidatePath("/billing");
    revalidatePath("/billing/payments");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
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
      const sup = await tx.suppliers.findUnique({
        where: { id: data.supplier_id, tenant_id: ctx.tenantId },
        select: { payable_balance: true },
      });
      if (!sup) throw new Error("Supplier not found.");
      const before = Number(sup.payable_balance ?? 0);
      const debit = Number(data.amount);
      const applied = Math.min(before, debit);
      const clamped = Math.max(0, before - applied);
      const newBal = round2(clamped);
      const warning = before < debit - 0.001 ? "Payment exceeds total payables; clamped to 0 — please verify." : null;

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
        data: { payable_balance: clamped, updated_at: new Date() },
      });
      return { id: payment.id, warning };
    });

    revalidatePath("/purchases");
    revalidatePath("/purchases/payments");
    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
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
