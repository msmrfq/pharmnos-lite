"use server";

import { assertPostgresConfigured } from "@/lib/db/prisma";
import { repos } from "@/repositories";
import { requireServerTenantContext } from "@/lib/db/tenant-context";

const csvEscape = (v: any): string => {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const bom = "\uFEFF";

function respondCsv(filename: string, rows: string[][]): Response {
  const header = rows[0]?.map(csvEscape).join(",") ?? "";
  const body = rows.slice(1).map((r) => r.map(csvEscape).join(",")).join("\n");
  const payload = bom + header + (body ? "\n" + body : "");
  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function exportInventoryCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportInventoryCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.products.list({ skip: 0, take: 25000, orderBy: { name: "asc" } }, ctx);
  const rows: string[][] = [
    ["SKU", "Product", "Schedule", "HSN", "MRP", "PTR", "Pack", "Reorder level", "Available", "FEFO expiry"],
  ];
  for (const p of (result.items as any) ?? []) {
    const batches = p.batches ?? [];
    const avail = batches.reduce((s: number, b: any) => s + Number(b.available_qty ?? 0), 0);
    const fefo = batches.find((b: any) => Number(b.available_qty ?? 0) > 0)?.expiry_date;
    const fefoStr = fefo ? new Date(fefo).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";
    rows.push([
      p.sku ?? "",
      p.name ?? "",
      p.schedule_classification ?? "",
      p.hsn_code ?? "",
      String(p.mrp ?? ""),
      String(p.standard_sale_rate ?? ""),
      p.pack_size ?? "",
      String(p.reorder_level ?? ""),
      String(avail),
      fefoStr,
    ]);
  }
  return respondCsv(`inventory-products-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportLowStockCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportLowStockCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.products.listLowStock({ skip: 0, take: 25000, orderBy: { name: "asc" } }, ctx);
  const rows: string[][] = [
    ["SKU", "Product", "Available total", "Reorder level", "Schedule", "HSN", "MRP", "Pack"],
  ];
  for (const p of (result.items as any) ?? []) {
    rows.push([
      p.sku ?? "",
      p.name ?? "",
      String(p.total_available ?? 0),
      String(p.reorder_level ?? ""),
      p.schedule_classification ?? "",
      p.hsn_code ?? "",
      String(p.mrp ?? ""),
      p.pack_size ?? "",
    ]);
  }
  return respondCsv(`low-stock-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportNearExpiryCsvAction(windowDays = 180): Promise<Response> {
  assertPostgresConfigured("exportNearExpiryCsvAction");
  const ctx = await requireServerTenantContext();
  const items = await repos.productBatches.listNearExpiry(ctx, windowDays);
  const rows: string[][] = [
    ["Product", "SKU", "Schedule", "Batch no.", "Expiry date", "Available qty", "MRP", "Stock value (MRP)"],
  ];
  for (const b of (items as any) ?? []) {
    const exp = b.expiry_date ? new Date(b.expiry_date) : null;
    const expStr = exp ? exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
    const mrp = Number(b.mrp ?? b.product?.mrp ?? 0);
    const val = mrp * Number(b.available_qty ?? 0);
    rows.push([
      b.product?.name ?? "",
      b.product?.sku ?? "",
      b.product?.schedule_classification ?? "",
      b.batch_no ?? "",
      expStr,
      String(b.available_qty ?? 0),
      String(mrp),
      String(val),
    ]);
  }
  return respondCsv(`near-expiry-${windowDays}d-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportCustomersCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportCustomersCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.customers.list({ skip: 0, take: 25000, orderBy: { business_name: "asc" } }, ctx);
  const rows: string[][] = [
    ["Code", "Business", "Contact person", "Phone", "Mobile", "Email", "City", "State", "GSTIN", "Credit limit", "Receivable", "Active"],
  ];
  for (const c of (result.items as any) ?? []) {
    rows.push([
      c.code ?? "",
      c.business_name ?? "",
      c.contact_person ?? "",
      c.phone ?? "",
      c.mobile ?? "",
      c.email ?? "",
      c.billing_city ?? "",
      c.billing_state ?? "",
      c.gstin ?? "",
      String(c.credit_limit ?? ""),
      String(c.receivable_balance ?? 0),
      c.is_active === false ? "No" : "Yes",
    ]);
  }
  return respondCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportSuppliersCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportSuppliersCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.suppliers.list({ skip: 0, take: 25000, orderBy: { business_name: "asc" } }, ctx);
  const rows: string[][] = [
    ["Code", "Business", "Contact person", "Phone", "Mobile", "Email", "City", "State", "GSTIN", "Payable", "Active"],
  ];
  for (const s of (result.items as any) ?? []) {
    rows.push([
      s.code ?? "",
      s.business_name ?? "",
      s.contact_person ?? "",
      s.phone ?? "",
      s.mobile ?? "",
      s.email ?? "",
      s.city ?? "",
      s.state ?? "",
      s.gstin ?? "",
      String(s.payable_balance ?? 0),
      s.is_active === false ? "No" : "Yes",
    ]);
  }
  return respondCsv(`suppliers-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportPurchaseRegisterCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportPurchaseRegisterCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.purchaseInvoices.list({ skip: 0, take: 25000, orderBy: { invoice_date: "desc" } }, ctx);
  const rows: string[][] = [
    ["Invoice no", "Date", "Supplier", "Supplier invoice", "Status", "Gross", "Discount", "Tax", "Round off", "Net", "Created at"],
  ];
  for (const p of (result.items as any) ?? []) {
    const d = p.invoice_date ? new Date(p.invoice_date) : null;
    const c = p.created_at ? new Date(p.created_at) : null;
    rows.push([
      p.invoice_no ?? "",
      d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
      p.supplier?.business_name ?? "",
      p.supplier_invoice_no ?? "",
      p.status ?? "",
      String(p.gross_amount ?? ""),
      String(p.total_discount ?? ""),
      String(p.total_tax ?? ""),
      String(p.round_off ?? ""),
      String(p.net_amount ?? ""),
      c ? c.toLocaleString("en-IN") : "",
    ]);
  }
  return respondCsv(`purchase-register-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportSalesRegisterCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportSalesRegisterCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.salesInvoices.list({ skip: 0, take: 25000, orderBy: { invoice_date: "desc" } }, ctx);
  const rows: string[][] = [
    ["Invoice no", "Date", "Customer", "Reference no", "Cash sale", "Status", "Gross", "Discount", "Tax", "Round off", "Net", "Paid", "Balance due", "Created at"],
  ];
  for (const p of (result.items as any) ?? []) {
    const d = p.invoice_date ? new Date(p.invoice_date) : null;
    const c = p.created_at ? new Date(p.created_at) : null;
    rows.push([
      p.invoice_no ?? "",
      d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
      p.customer?.business_name ?? p.customer?.customer_name ?? "",
      p.reference_no ?? "",
      p.is_cash_sale ? "Yes" : "No",
      p.status ?? "",
      String(p.gross_amount ?? ""),
      String(p.total_discount ?? ""),
      String(p.total_tax ?? ""),
      String(p.round_off ?? ""),
      String(p.net_amount ?? ""),
      String(p.paid_amount ?? ""),
      String(p.balance_due ?? ""),
      c ? c.toLocaleString("en-IN") : "",
    ]);
  }
  return respondCsv(`sales-register-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
