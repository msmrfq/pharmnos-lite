"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, assertPostgresConfigured } from "@/lib/db/prisma";
import {
  productCreateSchema,
  productEditSchema,
  customerCreateSchema,
  customerEditSchema,
  supplierCreateSchema,
  supplierEditSchema,
  __LedgerEntryType_OPENING_BALANCE,
} from "@/lib/validation/masters.schemas";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import type { ActionResult } from "@/app/auth/_actions/auth.actions";
import { PermissionAction } from "@prisma/client";
import type { products, customers, suppliers } from "@prisma/client";

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

function parseIndexedBatchesFromFormData(formData: FormData): any[] {
  const batches: Array<Record<string, any>> = [];
  for (const [rawKey, value] of formData.entries()) {
    const key = String(rawKey);
    const m = key.match(/^batches\[(\d+)\]\.(.+)$/);
    if (!m) continue;
    const idx = Number(m[1]);
    const field = m[2];
    if (!Number.isFinite(idx) || !field) continue;
    while (batches.length <= idx) batches.push({});
    const slot = batches[idx];
    if (!slot) continue;
    if (value !== null && value !== undefined) {
      slot[field] = String(value);
    }
  }
  return batches.filter((b) => Object.keys(b).length > 0);
}

function formDataToObject(formData: FormData, allowKeys?: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [rawKey, value] of formData.entries()) {
    const key = String(rawKey);
    if (key.startsWith("batches[")) continue;
    if (allowKeys && !allowKeys.includes(key) && !key.startsWith("batches")) continue;
    if (key === "opening_balance_type" && typeof value === "string") {
      out[key] = value === "debit" ? "debit" : "credit";
    } else {
      out[key] = value === null ? "" : String(value);
    }
  }
  if (out.is_active === undefined) {
    out.is_active = "on";
  }
  out.is_active = String(out.is_active) === "on" || String(out.is_active) === "true" || String(out.is_active) === "1";
  return out;
}

export async function createProductAction(
  _prevState: ActionResult<products>,
  formData: FormData,
): Promise<ActionResult<products>> {
  try {
    assertPostgresConfigured("createProductAction");
    const payload = formDataToObject(formData);
    payload.batches = parseIndexedBatchesFromFormData(formData);

    const parsed = productCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    const data = parsed.data;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.products.create({
        data: {
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          sku: data.sku,
          name: data.name,
          generic_name: data.generic_name ?? null,
          manufacturer: data.manufacturer ?? null,
          schedule_classification: data.schedule_classification,
          hsn_code: data.hsn_code ?? null,
          pack_size: data.pack_size ?? null,
          gst_rate: data.gst_rate ?? 0,
          mrp: data.mrp ?? 0,
          standard_sale_rate: data.standard_sale_rate ?? 0,
          purchase_rate: data.purchase_rate ?? 0,
          reorder_level: data.reorder_level ?? 0,
          is_active: data.is_active ?? true,
        },
      });
      const batchesPayload = (data.batches ?? []).map((b) => ({
        tenant_id: ctx.tenantId,
        product_id: created.id,
        batch_no: b.batch_no,
        manufacture_date: b.manufacture_date,
        expiry_date: b.expiry_date,
        received_qty: Number(b.received_qty ?? 0),
        available_qty: Number(b.received_qty ?? 0),
        mrp: Number(b.mrp ?? created.mrp ?? 0),
        sale_rate: Number(b.ptr ?? created.standard_sale_rate ?? 0),
        is_blocked: false,
        created_by: ctx.userId,
        created_at: new Date(),
        updated_at: new Date(),
      }));
      if (batchesPayload.length) {
        await tx.product_batches.createMany({ data: batchesPayload });
      }
      return created;
    });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    redirect(`/inventory?created=${encodeURIComponent(product.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Product could not be created. Please try again.",
      errors: undefined,
    };
  }
}

export async function updateProductAction(
  productId: string,
  _prevState: ActionResult<products>,
  formData: FormData,
): Promise<ActionResult<products>> {
  try {
    assertPostgresConfigured("updateProductAction");
    const payload = formDataToObject(formData);

    const parsed = productEditSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    const data = parsed.data;

    const existing = await prisma.products.findUnique({
      where: { id: productId, tenant_id: ctx.tenantId },
    });
    if (!existing) {
      return { ok: false, message: "Product not found." };
    }

    const product = await prisma.products.update({
      where: { id: productId, tenant_id: ctx.tenantId },
      data: {
        sku: data.sku,
        name: data.name,
        generic_name: data.generic_name ?? null,
        manufacturer: data.manufacturer ?? null,
        schedule_classification: data.schedule_classification,
        hsn_code: data.hsn_code ?? null,
        pack_size: data.pack_size ?? null,
        gst_rate: data.gst_rate ?? 0,
        mrp: data.mrp ?? 0,
        standard_sale_rate: data.standard_sale_rate ?? 0,
        purchase_rate: data.purchase_rate ?? 0,
        reorder_level: data.reorder_level ?? 0,
        is_active: data.is_active ?? true,
        updated_at: new Date(),
      },
    });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    redirect(`/inventory?updated=${encodeURIComponent(product.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Product could not be updated. Please try again.",
      errors: undefined,
    };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("deleteProductAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, PermissionAction.edit_product);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.products.findUnique({
        where: { id, tenant_id: ctx.tenantId },
      });
      if (!existing) {
        throw new Error("Product not found.");
      }
      if (!existing.is_active) {
        await tx.audit_logs.create({
          data: {
            tenant_id: ctx.tenantId,
            actor_id: ctx.userId,
            event_type: "PRODUCT_UPDATED",
            target_type: "product",
            target_id: id,
            metadata: {
              action: "deactivation_idempotent",
              previous_is_active: false,
            },
          },
        });
        return;
      }

      const operationalBatch = await tx.product_batches.findFirst({
        where: {
          tenant_id: ctx.tenantId,
          product_id: id,
          OR: [
            { is_blocked: false },
            { available_qty: { gt: 0 } },
          ],
        },
        select: { id: true },
      });
      if (operationalBatch) {
        throw new Error("Product has active operational batches or available stock.");
      }

      await tx.products.update({
        where: { id, tenant_id: ctx.tenantId },
        data: { is_active: false, updated_at: new Date() },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          actor_id: ctx.userId,
          event_type: "PRODUCT_UPDATED",
          target_type: "product",
          target_id: id,
          metadata: {
            action: "deactivated",
            previous_is_active: true,
          },
        },
      });
    });
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (e: any) {
    if (e?.message === "Product not found.") {
      return { ok: false, message: e.message };
    }
    if (e?.message === "Product has active operational batches or available stock.") {
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: "Product could not be deleted. Please try again.",
    };
  }
}

export async function createCustomerAction(
  _prevState: ActionResult<customers>,
  formData: FormData,
): Promise<ActionResult<customers>> {
  try {
    assertPostgresConfigured("createCustomerAction");
    const payload = formDataToObject(formData);

    const parsed = customerCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    const data = parsed.data;

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customers.create({
        data: {
          tenant_id: ctx.tenantId,
          code: data.code ?? null,
          business_name: data.business_name,
          contact_person: data.contact_person ?? null,
          phone: (data.phone && typeof data.phone === "string" && data.phone.length) ? data.phone : null,
          mobile: (data.mobile && typeof data.mobile === "string" && data.mobile.length) ? data.mobile : null,
          email: (data.email && typeof data.email === "string" && data.email.length) ? data.email : null,
          billing_address_1: data.billing_address_1 ?? null,
          billing_address_2: data.billing_address_2 ?? null,
          billing_city: data.billing_city ?? null,
          billing_state: data.billing_state ?? null,
          billing_pincode: data.billing_pincode ?? null,
          gstin: data.gstin ?? null,
          drug_license_no_1: data.drug_license_no_1 ?? null,
          drug_license_no_2: data.drug_license_no_2 ?? null,
          credit_limit: data.credit_limit ?? 0,
          opening_balance: data.opening_balance ?? 0,
          receivable_balance: 0,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const obAmount = Number(data.opening_balance ?? 0);
      if (obAmount > 0) {
        const directionDebit = data.opening_balance_type === "debit";
        const debit = directionDebit ? obAmount : 0;
        const credit = directionDebit ? 0 : obAmount;
        const balance = Math.max(0, debit - credit);
        await tx.customer_ledgers.create({
          data: {
            tenant_id: ctx.tenantId,
            customer_id: created.id,
            entry_type: __LedgerEntryType_OPENING_BALANCE,
            entry_date: new Date(),
            debit,
            credit,
            balance,
            narration: "Opening balance",
            reference_type: "opening_balance",
            reference_id: created.id,
          },
        });
        if (balance > 0) {
          await tx.customers.update({
            where: { id: created.id, tenant_id: ctx.tenantId },
            data: { receivable_balance: balance },
          });
        }
      }
      return created;
    });

    revalidatePath("/customers");
    revalidatePath("/dashboard");
    redirect(`/customers?created=${encodeURIComponent(customer.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Customer could not be created. Please try again.",
      errors: undefined,
    };
  }
}

export async function updateCustomerAction(
  customerId: string,
  _prevState: ActionResult<customers>,
  formData: FormData,
): Promise<ActionResult<customers>> {
  try {
    assertPostgresConfigured("updateCustomerAction");
    const payload = formDataToObject(formData);

    const parsed = customerEditSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    const data = parsed.data;

    const existing = await prisma.customers.findUnique({
      where: { id: customerId, tenant_id: ctx.tenantId },
    });
    if (!existing) {
      return { ok: false, message: "Customer not found." };
    }

    const customer = await prisma.customers.update({
      where: { id: customerId, tenant_id: ctx.tenantId },
      data: {
        code: data.code ?? null,
        business_name: data.business_name,
        contact_person: data.contact_person ?? null,
        phone: (data.phone && typeof data.phone === "string" && data.phone.length) ? data.phone : null,
        mobile: (data.mobile && typeof data.mobile === "string" && data.mobile.length) ? data.mobile : null,
        email: (data.email && typeof data.email === "string" && data.email.length) ? data.email : null,
        billing_address_1: data.billing_address_1 ?? null,
        billing_address_2: data.billing_address_2 ?? null,
        billing_city: data.billing_city ?? null,
        billing_state: data.billing_state ?? null,
        billing_pincode: data.billing_pincode ?? null,
        gstin: data.gstin ?? null,
        drug_license_no_1: data.drug_license_no_1 ?? null,
        drug_license_no_2: data.drug_license_no_2 ?? null,
        credit_limit: data.credit_limit ?? 0,
        is_active: data.is_active ?? true,
        updated_at: new Date(),
      },
    });

    revalidatePath("/customers");
    revalidatePath("/dashboard");
    redirect(`/customers?updated=${encodeURIComponent(customer.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Customer could not be updated. Please try again.",
      errors: undefined,
    };
  }
}

export async function deleteCustomerAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("deleteCustomerAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, PermissionAction.edit_customer);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.customers.findUnique({
        where: { id, tenant_id: ctx.tenantId },
      });
      if (!existing) {
        throw new Error("Customer not found.");
      }
      if (!existing.is_active) {
        await tx.audit_logs.create({
          data: {
            tenant_id: ctx.tenantId,
            actor_id: ctx.userId,
            event_type: "CUSTOMER_DEACTIVATED",
            target_type: "customer",
            target_id: id,
            metadata: { action: "deactivation_idempotent", previous_is_active: false },
          },
        });
        return;
      }
      const [invoice, ledger, payment] = await Promise.all([
        tx.sales_invoices.findFirst({
          where: { tenant_id: ctx.tenantId, customer_id: id },
          select: { id: true },
        }),
        tx.customer_ledgers.findFirst({
          where: { tenant_id: ctx.tenantId, customer_id: id },
          select: { id: true },
        }),
        tx.payments.findFirst({
          where: { tenant_id: ctx.tenantId, customer_id: id },
          select: { id: true },
        }),
      ]);
      if (Number(existing.receivable_balance) !== 0 || invoice || ledger || payment) {
        throw new Error("Customer has dependencies that block deactivation.");
      }
      await tx.customers.update({
        where: { id, tenant_id: ctx.tenantId },
        data: { is_active: false, updated_at: new Date() },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          actor_id: ctx.userId,
          event_type: "CUSTOMER_DEACTIVATED",
          target_type: "customer",
          target_id: id,
          metadata: { action: "deactivated", previous_is_active: true },
        },
      });
    });
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (e: any) {
    if (e?.message === "Customer not found." ||
        e?.message === "Customer has dependencies that block deactivation.") {
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: "Customer could not be deleted. Please try again.",
    };
  }
}

export async function createSupplierAction(
  _prevState: ActionResult<suppliers>,
  formData: FormData,
): Promise<ActionResult<suppliers>> {
  try {
    assertPostgresConfigured("createSupplierAction");
    const payload = formDataToObject(formData);

    const parsed = supplierCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    const data = parsed.data;

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.suppliers.create({
        data: {
          tenant_id: ctx.tenantId,
          code: data.code ?? null,
          business_name: data.business_name,
          contact_person: data.contact_person ?? null,
          phone: (data.phone && typeof data.phone === "string" && data.phone.length) ? data.phone : null,
          mobile: (data.mobile && typeof data.mobile === "string" && data.mobile.length) ? data.mobile : null,
          email: (data.email && typeof data.email === "string" && data.email.length) ? data.email : null,
          address_1: data.address_1 ?? null,
          address_2: data.address_2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          pincode: data.pincode ?? null,
          gstin: data.gstin ?? null,
          drug_license_no: data.drug_license_no ?? null,
          opening_balance: data.opening_balance ?? 0,
          payable_balance: 0,
          is_active: data.is_active ?? true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      const obAmount = Number(data.opening_balance ?? 0);
      if (obAmount > 0) {
        const directionCredit = data.opening_balance_type === "credit";
        const credit = directionCredit ? obAmount : 0;
        const debit = directionCredit ? 0 : obAmount;
        const balance = Math.max(0, credit - debit);
        await tx.supplier_ledgers.create({
          data: {
            tenant_id: ctx.tenantId,
            supplier_id: created.id,
            entry_type: __LedgerEntryType_OPENING_BALANCE,
            entry_date: new Date(),
            debit,
            credit,
            balance,
            narration: "Opening balance",
            reference_type: "opening_balance",
            reference_id: created.id,
          },
        });
        if (balance > 0) {
          await tx.suppliers.update({
            where: { id: created.id, tenant_id: ctx.tenantId },
            data: { payable_balance: balance },
          });
        }
      }
      return created;
    });

    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
    redirect(`/suppliers?created=${encodeURIComponent(supplier.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Supplier could not be created. Please try again.",
      errors: undefined,
    };
  }
}

export async function updateSupplierAction(
  supplierId: string,
  _prevState: ActionResult<suppliers>,
  formData: FormData,
): Promise<ActionResult<suppliers>> {
  try {
    assertPostgresConfigured("updateSupplierAction");
    const payload = formDataToObject(formData);

    const parsed = supplierEditSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        errors: flattenFieldErrors(parsed.error.flatten().fieldErrors),
        message: "Please fix the errors below.",
      };
    }

    const ctx = await requireServerTenantContext();
    const data = parsed.data;

    const existing = await prisma.suppliers.findUnique({
      where: { id: supplierId, tenant_id: ctx.tenantId },
    });
    if (!existing) {
      return { ok: false, message: "Supplier not found." };
    }

    const supplier = await prisma.suppliers.update({
      where: { id: supplierId, tenant_id: ctx.tenantId },
      data: {
        code: data.code ?? null,
        business_name: data.business_name,
        contact_person: data.contact_person ?? null,
        phone: (data.phone && typeof data.phone === "string" && data.phone.length) ? data.phone : null,
        mobile: (data.mobile && typeof data.mobile === "string" && data.mobile.length) ? data.mobile : null,
        email: (data.email && typeof data.email === "string" && data.email.length) ? data.email : null,
        address_1: data.address_1 ?? null,
        address_2: data.address_2 ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pincode: data.pincode ?? null,
        gstin: data.gstin ?? null,
        drug_license_no: data.drug_license_no ?? null,
        is_active: data.is_active ?? true,
        updated_at: new Date(),
      },
    });

    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
    redirect(`/suppliers?updated=${encodeURIComponent(supplier.id)}`);
  } catch (e: any) {
    if (e?.message && typeof e.message === "string" && e.message.includes("NEXT_REDIRECT")) throw e;
    return {
      ok: false,
      message: "Supplier could not be updated. Please try again.",
      errors: undefined,
    };
  }
}

export async function deleteSupplierAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    assertPostgresConfigured("deleteSupplierAction");
    const ctx = await requireServerTenantContext();
    requirePermission(ctx, PermissionAction.edit_supplier);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.suppliers.findUnique({
        where: { id, tenant_id: ctx.tenantId },
      });
      if (!existing) {
        throw new Error("Supplier not found.");
      }
      if (!existing.is_active) {
        await tx.audit_logs.create({
          data: {
            tenant_id: ctx.tenantId,
            actor_id: ctx.userId,
            event_type: "SUPPLIER_DEACTIVATED",
            target_type: "supplier",
            target_id: id,
            metadata: { action: "deactivation_idempotent", previous_is_active: false },
          },
        });
        return;
      }
      const [purchase, ledger, batch] = await Promise.all([
        tx.purchase_invoices.findFirst({
          where: { tenant_id: ctx.tenantId, supplier_id: id },
          select: { id: true },
        }),
        tx.supplier_ledgers.findFirst({
          where: { tenant_id: ctx.tenantId, supplier_id: id },
          select: { id: true },
        }),
        tx.product_batches.findFirst({
          where: { tenant_id: ctx.tenantId, supplier_id: id },
          select: { id: true },
        }),
      ]);
      if (Number(existing.payable_balance) !== 0 || purchase || ledger || batch) {
        throw new Error("Supplier has dependencies that block deactivation.");
      }
      await tx.suppliers.update({
        where: { id, tenant_id: ctx.tenantId },
        data: { is_active: false, updated_at: new Date() },
      });
      await tx.audit_logs.create({
        data: {
          tenant_id: ctx.tenantId,
          actor_id: ctx.userId,
          event_type: "SUPPLIER_DEACTIVATED",
          target_type: "supplier",
          target_id: id,
          metadata: { action: "deactivated", previous_is_active: true },
        },
      });
    });
    revalidatePath("/suppliers");
    revalidatePath("/dashboard");
    return { ok: true, data: { id } };
  } catch (e: any) {
    if (e?.message === "Supplier not found." ||
        e?.message === "Supplier has dependencies that block deactivation.") {
      return { ok: false, message: e.message };
    }
    return {
      ok: false,
      message: "Supplier could not be deleted. Please try again.",
    };
  }
}

export async function getProductForEdit(id: string): Promise<products | null> {
  assertPostgresConfigured("getProductForEdit");
  const ctx = await requireServerTenantContext();
  return prisma.products.findUnique({
    where: { id, tenant_id: ctx.tenantId },
  });
}

export async function getCustomerForEdit(id: string): Promise<customers | null> {
  assertPostgresConfigured("getCustomerForEdit");
  const ctx = await requireServerTenantContext();
  return prisma.customers.findUnique({
    where: { id, tenant_id: ctx.tenantId },
  });
}

export async function getSupplierForEdit(id: string): Promise<suppliers | null> {
  assertPostgresConfigured("getSupplierForEdit");
  const ctx = await requireServerTenantContext();
  return prisma.suppliers.findUnique({
    where: { id, tenant_id: ctx.tenantId },
  });
}
