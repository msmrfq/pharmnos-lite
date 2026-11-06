"use server";

import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import { storageAdapter } from "@/adapters/storage";
import {
  buildInvoiceArtifactKey,
  buildSupplierDocumentKey,
  INVOICE_ARTIFACT_BUCKET,
  SUPPLIER_DOCUMENT_BUCKET,
  renderInvoicePdf,
  supplierDocumentChecksum,
  validateSupplierDocument,
  validateSupplierDocumentBytes,
} from "@/domain/services/invoice-document.service";

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function generateSalesInvoicePdfAction(invoiceId: string): Promise<{
  ok: true;
  key: string;
} | {
  ok: false;
  error: string;
}> {
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "view_invoice");
  const invoice = await prisma.sales_invoices.findFirst({
    where: { id: invoiceId, tenant_id: ctx.tenantId },
    select: {
      id: true,
      status: true,
      finalized_snapshot: true,
      pdf_artifact_key: true,
      pdf_generation_status: true,
      pdf_checksum_sha256: true,
      pdf_byte_size: true,
    },
  });
  if (!invoice || invoice.status !== "FINALIZED" || !invoice.finalized_snapshot || typeof invoice.finalized_snapshot !== "object") {
    return { ok: false, error: "Only finalized invoices with an immutable snapshot can generate a PDF." };
  }
  const key = buildInvoiceArtifactKey(ctx, invoice.id);
  if (invoice.pdf_generation_status === "READY" && invoice.pdf_artifact_key === key) {
    try {
      const bytes = await storageAdapter.download(INVOICE_ARTIFACT_BUCKET, key);
      const checksumMatches = !invoice.pdf_checksum_sha256 || checksum(bytes) === invoice.pdf_checksum_sha256;
      const sizeMatches = invoice.pdf_byte_size === null || invoice.pdf_byte_size === bytes.byteLength;
      if (checksumMatches && sizeMatches) return { ok: true, key };
    } catch {
      // The persisted metadata is stale; regenerate the same deterministic artifact.
    }
  }
  const claimed = await prisma.sales_invoices.updateMany({
    where: {
      id: invoice.id,
      tenant_id: ctx.tenantId,
      status: "FINALIZED",
      pdf_generation_status: { in: ["PENDING", "FAILED", "READY"] },
    },
    data: { pdf_generation_status: "GENERATING", pdf_error: null },
  });
  if (claimed.count !== 1) return { ok: false, error: "PDF generation is already in progress; retry shortly." };
  try {
    const bytes = await renderInvoicePdf(invoice.finalized_snapshot as Record<string, any>);
    await storageAdapter.ensureBucket(INVOICE_ARTIFACT_BUCKET, false);
    await storageAdapter.upload(INVOICE_ARTIFACT_BUCKET, key, Buffer.from(bytes), "application/pdf");
    await prisma.sales_invoices.update({
      where: { id: invoice.id, tenant_id: ctx.tenantId },
      data: {
        pdf_artifact_key: key,
        pdf_generation_status: "READY",
        pdf_generated_at: new Date(),
        pdf_rendering_version: String((invoice.finalized_snapshot as Record<string, any>).renderingVersion ?? "unknown"),
        pdf_byte_size: bytes.byteLength,
        pdf_checksum_sha256: checksum(bytes),
        pdf_error: null,
      },
    });
    return { ok: true, key };
  } catch {
    await prisma.sales_invoices.updateMany({
      where: { id: invoice.id, tenant_id: ctx.tenantId },
      data: { pdf_generation_status: "FAILED", pdf_error: "PDF generation failed; retry is available." },
    });
    return { ok: false, error: "PDF generation failed; retry is available." };
  }
}

export async function getSalesInvoicePdfUrlAction(invoiceId: string): Promise<{
  ok: true;
  url: string;
} | {
  ok: false;
  error: string;
}> {
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "view_invoice");
  const invoice = await prisma.sales_invoices.findFirst({
    where: { id: invoiceId, tenant_id: ctx.tenantId, status: "FINALIZED", pdf_generation_status: "READY" },
    select: {
      pdf_artifact_key: true,
      pdf_checksum_sha256: true,
      pdf_byte_size: true,
    },
  });
  if (!invoice?.pdf_artifact_key) return { ok: false, error: "Invoice PDF is not ready." };
  const expectedKey = buildInvoiceArtifactKey(ctx, invoiceId);
  if (invoice.pdf_artifact_key !== expectedKey) return { ok: false, error: "Invoice PDF metadata is invalid." };
  try {
    const bytes = await storageAdapter.download(INVOICE_ARTIFACT_BUCKET, expectedKey);
    if (
      (invoice.pdf_checksum_sha256 && checksum(bytes) !== invoice.pdf_checksum_sha256) ||
      (invoice.pdf_byte_size !== null && bytes.byteLength !== invoice.pdf_byte_size)
    ) {
      return { ok: false, error: "Invoice PDF integrity validation failed." };
    }
    return {
      ok: true,
      url: await storageAdapter.getSignedUrl(INVOICE_ARTIFACT_BUCKET, expectedKey, {
        expiresInSeconds: 300,
        download: true,
      }),
    };
  } catch {
    return { ok: false, error: "Invoice PDF is unavailable." };
  }
}

export async function uploadSupplierInvoiceDocumentAction(formData: FormData): Promise<{
  ok: true;
  documentId: string;
} | {
  ok: false;
  error: string;
}> {
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "edit_purchase");
  const purchaseId = String(formData.get("purchase_id") ?? "").trim();
  const file = formData.get("supplier_invoice_file");
  if (!(file instanceof File)) return { ok: false, error: "Supplier invoice file is required." };
  const validation = validateSupplierDocument(file);
  if (!validation.ok) return validation;
  const purchase = await prisma.purchase_invoices.findFirst({
    where: { id: purchaseId, tenant_id: ctx.tenantId },
    select: { id: true, supplier_id: true },
  });
  if (!purchase) return { ok: false, error: "Purchase not found or belongs to another business." };
  return persistSupplierInvoiceDocument(ctx, purchase.id, file);
}

export async function persistSupplierInvoiceDocument(
  ctx: Awaited<ReturnType<typeof requireServerTenantContext>>,
  purchaseId: string,
  file: File,
): Promise<{ ok: true; documentId: string } | { ok: false; error: string }> {
  const verifiedCtx = await requireServerTenantContext();
  requirePermission(verifiedCtx, "edit_purchase");
  if (verifiedCtx.tenantId !== ctx.tenantId || verifiedCtx.userId !== ctx.userId) {
    return { ok: false, error: "Supplier invoice upload context is invalid." };
  }
  const validation = validateSupplierDocument(file);
  if (!validation.ok) return validation;
  const purchase = await prisma.purchase_invoices.findFirst({
    where: { id: purchaseId, tenant_id: ctx.tenantId },
    select: { id: true, supplier_id: true },
  });
  if (!purchase) return { ok: false, error: "Purchase not found or belongs to another business." };
  const documentId = randomUUID();
  const filename = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
  const key = buildSupplierDocumentKey(ctx, purchase.id, documentId, filename);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentValidation = validateSupplierDocumentBytes(file.type, bytes);
  if (!contentValidation.ok) return contentValidation;
  try {
    await storageAdapter.ensureBucket(SUPPLIER_DOCUMENT_BUCKET, false);
    await storageAdapter.upload(SUPPLIER_DOCUMENT_BUCKET, key, Buffer.from(bytes), file.type);
    await prisma.$transaction(async (tx) => {
      const current = await tx.purchase_supplier_documents.findFirst({
        where: { tenant_id: ctx.tenantId, purchase_invoice_id: purchase.id, replaced_at: null },
        orderBy: { uploaded_at: "desc" },
        select: { id: true },
      });
      if (current) {
        await tx.purchase_supplier_documents.update({
          where: { id: current.id, tenant_id: ctx.tenantId },
          data: { replaced_at: new Date() },
        });
      }
      await tx.purchase_supplier_documents.create({
        data: {
          id: documentId,
          tenant_id: ctx.tenantId,
          purchase_invoice_id: purchase.id,
          supplier_id: purchase.supplier_id,
          storage_key: key,
          original_filename: file.name,
          mime_type: file.type,
          byte_size: bytes.byteLength,
          checksum_sha256: supplierDocumentChecksum(bytes),
          uploaded_by: ctx.userId,
          supersedes_id: current?.id ?? null,
        },
      });
    });
    return { ok: true, documentId };
  } catch {
    try {
      await storageAdapter.delete(SUPPLIER_DOCUMENT_BUCKET, key);
    } catch {
      // The metadata transaction remains authoritative; cleanup can be retried safely.
    }
    return { ok: false, error: "Supplier invoice upload failed; no document was recorded." };
  }
}

export async function getSupplierInvoiceDocumentUrlAction(documentId: string): Promise<{
  ok: true;
  url: string;
} | {
  ok: false;
  error: string;
}> {
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, "view_purchase");
  const document = await prisma.purchase_supplier_documents.findFirst({
    where: { id: documentId, tenant_id: ctx.tenantId },
    select: { storage_key: true },
  });
  if (!document) return { ok: false, error: "Supplier invoice document not found." };
  try {
    return {
      ok: true,
      url: await storageAdapter.getSignedUrl(SUPPLIER_DOCUMENT_BUCKET, document.storage_key, {
        expiresInSeconds: 300,
        download: true,
      }),
    };
  } catch {
    return { ok: false, error: "Supplier invoice document is unavailable." };
  }
}
