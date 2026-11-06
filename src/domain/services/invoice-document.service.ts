import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import { buildTenantStoragePath } from "@/lib/storage/storage-path";
import type { TenantContext } from "@/lib/db/tenant-context";
import { stableInvoiceReferences } from "./invoice-modernization.service";

export const INVOICE_ARTIFACT_BUCKET = "invoice-artifacts";
export const SUPPLIER_DOCUMENT_BUCKET = "supplier-invoice-documents";
export const MAX_SUPPLIER_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const SUPPLIER_DOCUMENT_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateSupplierDocument(file: {
  type?: string;
  size?: number;
  name?: string;
}): { ok: true } | { ok: false; error: string } {
  const size = file.size ?? 0;
  if (!SUPPLIER_DOCUMENT_MIME_TYPES.includes(file.type ?? "")) {
    return { ok: false, error: "Supplier invoice must be a PDF, JPEG, PNG, or WebP file." };
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_SUPPLIER_DOCUMENT_BYTES) {
    return { ok: false, error: "Supplier invoice file size must be between 1 byte and 10 MB." };
  }
  if (!file.name?.trim()) return { ok: false, error: "Supplier invoice filename is required." };
  return { ok: true };
}

export function supplierDocumentChecksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateSupplierDocumentBytes(
  mimeType: string,
  bytes: Uint8Array,
): { ok: true } | { ok: false; error: string } {
  const startsWith = (signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const valid =
    (mimeType === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") ||
    (mimeType === "image/jpeg" && startsWith([0xff, 0xd8, 0xff])) ||
    (mimeType === "image/png" && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (mimeType === "image/webp" && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP");
  return valid ? { ok: true } : { ok: false, error: "Supplier invoice file content does not match its declared type." };
}

export async function renderInvoiceQrDataUrl(invoiceId: string, invoiceNo: string): Promise<string> {
  const refs = stableInvoiceReferences(invoiceId, invoiceNo);
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "https://pharmnoslite.com").replace(/\/+$/, "");
  const verificationUrl = `${origin}/invoices/${encodeURIComponent(invoiceId)}/verify?ref=${encodeURIComponent(refs.qrPayload)}`;
  return QRCode.toDataURL(verificationUrl, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}

export async function renderInvoiceBarcodeDataUrl(invoiceId: string, invoiceNo: string): Promise<string> {
  const refs = stableInvoiceReferences(invoiceId, invoiceNo);
  const png = await bwipjs.toBuffer({ bcid: "code128", text: refs.barcodeValue, scale: 2, height: 12, includetext: true });
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}

export function buildInvoiceArtifactKey(context: Pick<TenantContext, "tenantId">, invoiceId: string): string {
  return buildTenantStoragePath(context, "sales-invoices", invoiceId, `${invoiceId}.pdf`);
}

export function buildSupplierDocumentKey(
  context: Pick<TenantContext, "tenantId">,
  purchaseId: string,
  documentId: string,
  filename: string,
): string {
  return buildTenantStoragePath(context, "supplier-invoices", purchaseId, `${documentId}-${filename}`);
}

async function drawPageHeader(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  title: string,
  pageNumber: number,
  pageCount: number,
) {
  page.drawText(title, { x: 28, y: 565, size: 18, font, color: rgb(0.05, 0.05, 0.05) });
  page.drawText("Printed with Pharmnos Lite", { x: 28, y: 24, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Page ${pageNumber} of ${pageCount}`, { x: 750, y: 24, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
}

export async function renderInvoicePdf(snapshot: Record<string, any>): Promise<Uint8Array> {
  const invoiceId = String(snapshot.invoiceId ?? "");
  const invoiceNo = String(snapshot.invoiceNo ?? "");
  if (!invoiceId || !invoiceNo || snapshot.kind !== "sales_invoice") {
    throw new Error("A finalized sales invoice snapshot is required.");
  }
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const refs = stableInvoiceReferences(invoiceId, invoiceNo);
  const qrDataUrl = await renderInvoiceQrDataUrl(invoiceId, invoiceNo);
  const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1] ?? "", "base64"));
  const barcode = await bwipjs.toBuffer({ bcid: "code128", text: refs.barcodeValue, scale: 2, height: 12, includetext: true });
  const barcodeImage = await pdf.embedPng(barcode);
  const pages: PDFPage[] = [];
  let page = pdf.addPage([841.89, 595.28]);
  pages.push(page);
  let y = 530;
  const addPage = () => {
    page = pdf.addPage([841.89, 595.28]);
    pages.push(page);
    y = 530;
  };
  const drawLine = (text: string, size = 9) => {
    if (y < 70) addPage();
    page.drawText(text.slice(0, 130), { x: 28, y, size, font });
    y -= size + 7;
  };
  drawLine(`Seller: ${String(snapshot.seller?.name ?? "Unavailable")}`, 10);
  drawLine(`Customer: ${String(snapshot.buyer?.name ?? "Unavailable")}`, 10);
  drawLine(`Invoice date: ${String(snapshot.invoiceDate ?? "Unavailable")}`);
  drawLine(`Classification: ${String(snapshot.classification ?? "Unavailable")}`);
  drawLine(`Place of supply: ${String(snapshot.placeOfSupplyCode ?? "Unavailable")}`);
  y -= 8;
  for (const [index, line] of (snapshot.lines ?? []).entries()) {
    drawLine(
      `${index + 1}. ${String(line.product ?? "—")} | Mfr ${String(line.manufacturer ?? "—")} | Batch ${String(line.batchNo ?? "—")} | Exp ${String(line.expiry ?? "—")}`,
    );
    drawLine(
      `   Qty ${String(line.quantity ?? 0)} | UOM ${String(line.uom ?? "—")} | HSN ${String(line.hsn ?? "—")} | GST ${String(line.gstRate ?? "0")}% | Taxable ${String(line.taxableAmount ?? "0")} | GST ${String(line.gstAmount ?? "0")} | Total ${String(line.totalAmount ?? "0")}`,
    );
  }
  drawLine(`Gross: ${String(snapshot.totals?.gross ?? "0")}`);
  drawLine(`Discount: ${String(snapshot.totals?.discount ?? "0")}`);
  drawLine(`Taxable: ${String(snapshot.totals?.taxable ?? "0")}`);
  drawLine(`GST: ${String(snapshot.totals?.tax ?? "0")}`);
  drawLine(`Round-off: ${String(snapshot.totals?.roundOff ?? "0")}`);
  drawLine(`Payable: ${String(snapshot.totals?.payable ?? "0")}`, 12);
  drawLine(`Amount in words: ${String(snapshot.amountInWords ?? "Not recorded")}`);
  drawLine(`Terms: ${String(snapshot.terms ?? "Standard terms apply")}`);
  drawLine("E.&O.E.");
  drawLine(`Authorized signatory: ${String(snapshot.signatory ?? "Not recorded")}`);
  pages.forEach((currentPage, index) => {
    drawPageHeader(currentPage, font, `Invoice ${invoiceNo}`, index + 1, pages.length);
  });
  const firstPage = pages[0]!;
  firstPage.drawImage(qrImage, { x: 650, y: 380, width: 120, height: 120 });
  firstPage.drawImage(barcodeImage, { x: 610, y: 275, width: 180, height: 55 });
  firstPage.drawText("Internal verification reference; not a statutory government QR code.", { x: 560, y: 250, size: 7, font });
  return pdf.save();
}
