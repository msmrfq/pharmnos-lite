"use server";

import { assertPostgresConfigured, prisma } from "@/lib/db/prisma";
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

export async function exportCustomerDuesCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportCustomerDuesCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.customers.list({ skip: 0, take: 25000, orderBy: { business_name: "asc" } }, ctx);
  const rows: string[][] = [
    ["Customer code", "Business", "Contact", "City", "State", "Phone", "Total due", "Current 0-30", "31-60", "61-90", "90+", "Oldest overdue days", "Receivable balance", "Active"],
  ];
  for (const c of (result.items as any) ?? []) {
    let buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
    let oldestDays = 0;
    try {
      buckets = await repos.customerLedgers.getAgingBuckets(ctx, c.id);
    } catch {
      buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
    }
    try {
      oldestDays = await repos.customerLedgers.getOldestOverdueDays(c.id, ctx);
    } catch {
      oldestDays = 0;
    }
    const receivable = Number(c.receivable_balance ?? 0);
    const totalDue = buckets.total > 0 ? buckets.total : receivable;
    rows.push([
      c.code ?? "",
      c.business_name ?? "",
      c.contact_person ?? "",
      c.billing_city ?? "",
      c.billing_state ?? "",
      c.phone ?? c.mobile ?? "",
      String(totalDue),
      String(buckets.current),
      String(buckets.d30),
      String(buckets.d60),
      String(buckets.over90),
      String(oldestDays),
      String(receivable),
      c.is_active === false ? "No" : "Yes",
    ]);
  }
  return respondCsv(`customer-dues-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportSupplierPayablesCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportSupplierPayablesCsvAction");
  const ctx = await requireServerTenantContext();
  const result = await repos.suppliers.list({ skip: 0, take: 25000, orderBy: { business_name: "asc" } }, ctx);
  const rows: string[][] = [
    ["Supplier code", "Business", "Contact", "City", "State", "Phone", "Total payable", "Current 0-30", "31-60", "61-90", "90+", "Oldest overdue days", "Payable balance", "Active"],
  ];
  for (const s of (result.items as any) ?? []) {
    let buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
    let oldestDays = 0;
    try {
      buckets = await repos.supplierLedgers.getAgingBuckets(ctx, s.id);
    } catch {
      buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
    }
    try {
      oldestDays = await repos.supplierLedgers.getOldestOverdueDays(s.id, ctx);
    } catch {
      oldestDays = 0;
    }
    const payable = Number(s.payable_balance ?? 0);
    const totalPayable = buckets.total > 0 ? buckets.total : payable;
    rows.push([
      s.code ?? "",
      s.business_name ?? "",
      s.contact_person ?? "",
      s.city ?? "",
      s.state ?? "",
      s.phone ?? s.mobile ?? "",
      String(totalPayable),
      String(buckets.current),
      String(buckets.d30),
      String(buckets.d60),
      String(buckets.over90),
      String(oldestDays),
      String(payable),
      s.is_active === false ? "No" : "Yes",
    ]);
  }
  return respondCsv(`supplier-payables-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportStockValuationCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportStockValuationCsvAction");
  const ctx = await requireServerTenantContext();
  const t = ctx;
  const items = await (prisma as any).products.findMany({
    where: { tenant_id: t.tenantId },
    include: {
      batches: {
        orderBy: { expiry_date: "asc" },
      },
    },
    take: 25000,
    orderBy: { name: "asc" },
  });

  const nearCutoff = new Date();
  nearCutoff.setDate(nearCutoff.getDate() + 60);

  const rows: string[][] = [
    ["SKU", "Product", "Schedule", "HSN", "MRP", "Avg purchase rate", "Total available qty", "Total batches", "Total value (₹)", "Near expiry batches"],
  ];

  for (const p of items as any[]) {
    const batches = p.batches ?? [];
    const avail = batches.reduce((s: number, b: any) => s + Number(b.available_qty ?? 0), 0);
    const batchesCount = batches.length;
    let weightedSum = 0;
    for (const b of batches) {
      weightedSum += Number(b.available_qty ?? 0) * Number(b.purchase_rate ?? 0);
    }
    const avgRate = avail > 0 ? weightedSum / avail : 0;
    const totalValue = avail * avgRate;
    let nearExpireCount = 0;
    for (const b of batches) {
      if (b.expiry_date && Number(b.available_qty ?? 0) > 0) {
        const exp = new Date(b.expiry_date);
        if (exp.getTime() <= nearCutoff.getTime()) {
          nearExpireCount++;
        }
      }
    }
    rows.push([
      p.sku ?? "",
      p.name ?? "",
      p.schedule_classification ?? "",
      p.hsn_code ?? "",
      String(p.mrp ?? ""),
      String(Number.isFinite(avgRate) ? avgRate.toFixed(2) : ""),
      String(avail),
      String(batchesCount),
      String(Number.isFinite(totalValue) ? totalValue.toFixed(2) : ""),
      String(nearExpireCount),
    ]);
  }

  return respondCsv(`stock-valuation-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportBatchExpiryCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportBatchExpiryCsvAction");
  const ctx = await requireServerTenantContext();
  const t = ctx;
  const batches = await (prisma as any).product_batches.findMany({
    where: { tenant_id: t.tenantId, is_blocked: false },
    include: {
      product: { select: { name: true, sku: true } },
      supplier: { select: { business_name: true } },
    },
    orderBy: { expiry_date: "asc" },
    take: 25000,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: string[][] = [
    ["Batch no.", "Product", "SKU", "Supplier", "Expiry date", "Days left", "MRP", "Purchase rate", "Received qty", "Available qty", "Status"],
  ];

  for (const b of batches as any[]) {
    const exp = b.expiry_date ? new Date(b.expiry_date) : null;
    const expStr = exp ? exp.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
    let daysLeft: number | null = null;
    let status = "Healthy";
    if (exp) {
      daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      if (daysLeft < 0) status = "Expired";
      else if (daysLeft <= 30) status = "\u226430 days";
      else if (daysLeft <= 60) status = "\u226460 days";
      else if (daysLeft <= 90) status = "\u226490 days";
      else status = "Healthy";
    }
    rows.push([
      b.batch_no ?? "",
      b.product?.name ?? "",
      b.product?.sku ?? "",
      b.supplier?.business_name ?? "",
      expStr,
      daysLeft === null ? "" : String(daysLeft),
      String(b.mrp ?? ""),
      String(b.purchase_rate ?? ""),
      String(b.received_qty ?? 0),
      String(b.available_qty ?? 0),
      status,
    ]);
  }

  return respondCsv(`batch-expiry-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportGstHsnSummaryCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportGstHsnSummaryCsvAction");
  const ctx = await requireServerTenantContext();
  const t = ctx;

  const now = new Date();
  const fromDefault = new Date(now.getFullYear(), now.getMonth(), 1);
  const toDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const fromStr = yyyymmdd(fromDefault);
  const toStr = yyyymmdd(toDefault);

  const profile = await (prisma as any).business_profiles.findFirst({
    where: { tenant_id: t.tenantId },
    select: { state: true },
  }).catch(() => null);
  const tenantState = profile?.state ?? null;

  const invoices = await (prisma as any).sales_invoices.findMany({
    where: { tenant_id: t.tenantId, status: "FINALIZED", invoice_date: { gte: fromDefault, lte: new Date(toDefault.getTime() + 86399999) } },
    include: {
      customer: { select: { gstin: true, billing_state: true } },
      items: {
        include: { product: { select: { hsn_code: true, gst_rate: true } } },
      },
    },
    take: 25000,
  });

  const groupMap = new Map<string, {
    hsn: string; description: string; ratePct: number; taxableValue: number;
    totalQty: number; cgst: number; sgst: number; igst: number; invoicesSet: Set<string>;
  }>();

  for (const inv of invoices as any[]) {
    const invId = inv.id;
    const custState = inv.customer?.billing_state ?? null;
    const isInterstate = Boolean(tenantState && custState && tenantState !== custState);
    const items = inv.items ?? [];
    for (const it of items) {
      const hsn = it.product?.hsn_code ?? "UNCLASSIFIED";
      const ratePct = Number(it.product?.gst_rate ?? it.gst_rate ?? 0);
      const gstAmount = Number(it.gst_amount ?? 0);
      const lineTotal = Number(it.line_total ?? 0);
      const taxableValue = lineTotal - gstAmount;
      const key = `${hsn}||${ratePct}`;
      let g = groupMap.get(key);
      if (!g) {
        g = { hsn, description: "", ratePct, taxableValue: 0, totalQty: 0, cgst: 0, sgst: 0, igst: 0, invoicesSet: new Set() };
        groupMap.set(key, g);
      }
      g.description = it.product?.name ?? g.description;
      g.taxableValue += taxableValue;
      g.totalQty += Number(it.quantity ?? 0) + Number(it.free_qty ?? 0);
      if (isInterstate) {
        g.igst += gstAmount;
      } else {
        g.cgst += gstAmount / 2;
        g.sgst += gstAmount / 2;
      }
      g.invoicesSet.add(invId);
    }
  }

  const rows: string[][] = [
    ["HSN", "Description", "Tax rate %", "Qty", "Taxable value \u20B9", "CGST \u20B9", "SGST \u20B9", "IGST \u20B9", "Total tax \u20B9", "Invoices count", "Total invoice value \u20B9"],
  ];

  for (const g of groupMap.values()) {
    const totalGst = g.cgst + g.sgst + g.igst;
    const totalValue = g.taxableValue + totalGst;
    rows.push([
      g.hsn,
      g.description,
      String(Number.isFinite(g.ratePct) ? g.ratePct.toFixed(2) : ""),
      String(g.totalQty),
      String(Number.isFinite(g.taxableValue) ? g.taxableValue.toFixed(2) : ""),
      String(Number.isFinite(g.cgst) ? g.cgst.toFixed(2) : ""),
      String(Number.isFinite(g.sgst) ? g.sgst.toFixed(2) : ""),
      String(Number.isFinite(g.igst) ? g.igst.toFixed(2) : ""),
      String(Number.isFinite(totalGst) ? totalGst.toFixed(2) : ""),
      String(g.invoicesSet.size),
      String(Number.isFinite(totalValue) ? totalValue.toFixed(2) : ""),
    ]);
  }

  return respondCsv(`gst-hsn-summary-${fromStr}-${toStr}.csv`, rows);
}

export async function exportDaybookCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportDaybookCsvAction");
  const ctx = await requireServerTenantContext();
  const t = ctx;

  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  const custBefore = await (prisma as any).customer_ledgers.findMany({
    where: { tenant_id: t.tenantId, entry_date: { lt: fromDate } },
    select: { debit: true, credit: true },
  });
  const suppBefore = await (prisma as any).supplier_ledgers.findMany({
    where: { tenant_id: t.tenantId, entry_date: { lt: fromDate } },
    select: { debit: true, credit: true },
  });
  let openingBal = 0;
  for (const r of custBefore as any[]) openingBal += Number(r.debit ?? 0) - Number(r.credit ?? 0);
  for (const r of suppBefore as any[]) openingBal += Number(r.debit ?? 0) - Number(r.credit ?? 0);

  const custRows = await (prisma as any).customer_ledgers.findMany({
    where: { tenant_id: t.tenantId, entry_date: { gte: fromDate, lte: toDate } },
    include: { customer: { select: { business_name: true } }, invoice: { select: { invoice_no: true } } },
    orderBy: { entry_date: "asc" },
    take: 25000,
  });
  const suppRows = await (prisma as any).supplier_ledgers.findMany({
    where: { tenant_id: t.tenantId, entry_date: { gte: fromDate, lte: toDate } },
    include: { supplier: { select: { business_name: true } }, purchase: { select: { invoice_no: true } } },
    orderBy: { entry_date: "asc" },
    take: 25000,
  });

  type Unified = {
    entry_date: Date; voucherType: string; counterparty: string;
    debit: number; credit: number; narration: string | null; ref: string | null;
  };
  const unified: Unified[] = [];
  for (const r of custRows as any[]) {
    let vt = "Customer Invoice";
    if (r.entry_type === "PAYMENT_RECEIVED") vt = "Customer Payment";
    else if (r.entry_type === "OPENING_BALANCE") vt = "Opening balance";
    unified.push({
      entry_date: r.entry_date, voucherType: vt,
      counterparty: r.customer?.business_name ?? "",
      debit: Number(r.debit ?? 0), credit: Number(r.credit ?? 0),
      narration: r.narration ?? null, ref: r.invoice?.invoice_no ?? r.reference_id ?? null,
    });
  }
  for (const r of suppRows as any[]) {
    let vt = "Supplier Invoice";
    if (r.entry_type === "PAYMENT_MADE") vt = "Supplier Payment";
    else if (r.entry_type === "OPENING_BALANCE") vt = "Opening balance";
    unified.push({
      entry_date: r.entry_date, voucherType: vt,
      counterparty: r.supplier?.business_name ?? "",
      debit: Number(r.debit ?? 0), credit: Number(r.credit ?? 0),
      narration: r.narration ?? null, ref: r.purchase?.invoice_no ?? r.reference_id ?? null,
    });
  }
  unified.sort((a, b) => a.entry_date.getTime() - b.entry_date.getTime());

  const yyyymmdd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const fmt = (n: number) => Number.isFinite(n) ? n.toFixed(2) : "";

  const rows: string[][] = [
    ["Date", "Voucher type", "Counterparty", "Debit \u20B9", "Credit \u20B9", "Balance \u20B9", "Narration", "Invoice ref"],
  ];

  let running = openingBal;
  rows.push([
    fromDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    "Opening balance",
    "",
    "",
    "",
    fmt(openingBal),
    "Brought forward",
    "",
  ]);

  for (const r of unified) {
    running += r.debit - r.credit;
    rows.push([
      new Date(r.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      r.voucherType,
      r.counterparty,
      r.debit > 0 ? fmt(r.debit) : "",
      r.credit > 0 ? fmt(r.credit) : "",
      fmt(running),
      r.narration ?? "",
      r.ref ?? "",
    ]);
  }

  return respondCsv(`daybook-${yyyymmdd(fromDate)}-${yyyymmdd(toDate)}.csv`, rows);
}
