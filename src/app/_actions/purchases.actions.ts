"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import { requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import type { purchase_invoices, InvoiceStatus, StockMovementType, LedgerEntryType } from "@prisma/client";
import {
  PurchaseInvoiceCreateSchema,
  PurchaseInvoiceLineCreateSchema,
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

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function computeLineTotals(line: any) {
  const qty = Number(line.quantity ?? 0);
  const rate = Number(line.purchase_rate ?? 0);
  const discPct = Number(line.discount_pct ?? 0);
  const gstPct = Number(line.gst_rate ?? 0);
  const gross = round2(qty * rate);
  const discount_amount = round2(gross * (discPct / 100));
  const taxable = round2(gross - discount_amount);
  const gst_amount = round2(taxable * (gstPct / 100));
  const line_total = round2(taxable + gst_amount);
  return { gross, discount_amount, gst_amount, line_total };
}

function computeInvoiceTotals(linesTotals: Array<{ gross: number; discount_amount: number; gst_amount: number; line_total: number }>) {
  const gross_amount = round2(linesTotals.reduce((s, l) => s + l.gross, 0));
  const total_discount = round2(linesTotals.reduce((s, l) => s + l.discount_amount, 0));
  const total_tax = round2(linesTotals.reduce((s, l) => s + l.gst_amount, 0));
  const subtotal = round2(gross_amount - total_discount + total_tax);
  const rounded = Math.round(subtotal);
  const round_off = round2(rounded - subtotal);
  const net_amount = round2(subtotal + round_off);
  return { gross_amount, total_discount, total_tax, round_off, net_amount };
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
    const data = parsed.data;

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
        const totals = computeLineTotals(line);
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

export async function cancelPurchaseDraftAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("cancelPurchaseDraftAction");
    const ctx = await requireServerTenantContext();
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

    const invoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchase_invoices.findUnique({
        where: { id: purchaseId, tenant_id: ctx.tenantId },
        include: { supplier: true, items: true },
      });
      if (!existing) {
        throw new Error("Purchase not found.");
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

      const items: any[] = existing.items as any[] ?? [];
      if (items.length === 0) {
        throw new Error("No line items found.");
      }

      const lineComputed = items.map((it: any) => computeLineTotals({
        quantity: Number(it.quantity ?? 0),
        purchase_rate: Number(it.purchase_rate ?? 0),
        discount_pct: Number(it.discount_pct ?? 0),
        gst_rate: Number(it.gst_rate ?? 0),
      }));
      const serverTotals = computeInvoiceTotals(lineComputed);

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
        const profile = await tx.business_profiles.findUnique({
          where: { tenant_id: ctx.tenantId },
        });
        if (profile) {
          const prefix = profile.purchase_prefix ?? "PUR";
          const seq = profile.purchase_next_seq ?? 1;
          finalInvoiceNo = `${prefix}-${String(seq).padStart(5, "0")}`;
          await tx.business_profiles.update({
            where: { tenant_id: ctx.tenantId },
            data: { purchase_next_seq: seq + 1, updated_at: new Date() },
          });
        } else {
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

      const supplierRow = await tx.suppliers.findUnique({
        where: { id: existing.supplier_id, tenant_id: ctx.tenantId },
        select: { payable_balance: true },
      });
      const balanceBefore = Number(supplierRow?.payable_balance ?? 0);
      const credit = serverTotals.net_amount;
      const balanceAfter = round2(balanceBefore + credit);

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
