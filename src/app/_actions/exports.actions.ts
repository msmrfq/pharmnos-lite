"use server";

import { assertPostgresConfigured, prisma } from "@/lib/db/prisma";
import { repos } from "@/repositories";
import { establishTenantContext, requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import { PermissionAction, Prisma } from "@prisma/client";
import { businessDateFromPrismaDate, businessDateToday, businessDateToPrismaDate, formatBusinessDate, formatBusinessInstant, parseBusinessDate } from "@/lib/utils/business-date";
import { Decimal } from "@/lib/decimal";
import {
  REPORT_RECORDING_TIME_DISCLOSURE, REPORT_ROW_LIMIT, balanceContext, classifyInvoiceEffectiveDate,
  classifyLedgerEffectiveDate, coverageGapError, formatInstantOrBlank, integrityError, isoInstantOrNull,
  ledgerCsvPreamble, parseOptionalReportDate, parseReportId, parseReportInputObject, parseReportMode,
  parseReportText, parseStrictReportDate, registerCsvPreamble, rowLimitError, summarizeLedgerExclusions,
  summarizeRegisterExclusions, toCsvResult, BALANCE_BASIS_COMPLETE, BALANCE_BASIS_QUALIFIED,
  type ExclusionReason, type ReportCsvResult, type ReportMode, ReportUnavailableError,
} from "@/domain/services/financial-report-completeness";
import {
  hsnCsvPreamble, hsnRowMatchesQuery, loadHsnInvoices, parseHsnFilter,
} from "@/domain/services/gst-hsn-date-filter";

const csvEscape = (v: any): string => {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
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
  requirePermission(ctx, PermissionAction.view_inventory);
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
  requirePermission(ctx, PermissionAction.view_inventory);
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
  requirePermission(ctx, PermissionAction.view_inventory);
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
  requirePermission(ctx, PermissionAction.view_customer);
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
  requirePermission(ctx, PermissionAction.view_supplier);
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

type RegisterInput = { q?: string; partyId?: string; startDate?: string; endDate?: string; mode?: string };

export async function loadFinancialRegisterReport(kind: "sales" | "purchase", input: RegisterInput = {}) {
  assertPostgresConfigured("loadFinancialRegisterReport");
  const ctx = await requireServerTenantContext();
  if (kind !== "sales" && kind !== "purchase") throw new Error("Invalid register.");
  requirePermission(ctx, kind === "sales" ? PermissionAction.view_invoice : PermissionAction.view_purchase);
  const raw = parseReportInputObject(input);
  const mode = parseReportMode(raw.mode);
  const start = parseOptionalReportDate(raw.startDate, "startDate");
  const end = parseOptionalReportDate(raw.endDate, "endDate");
  if (start && end && start > end) throw new ReportUnavailableError("INVALID_INPUT", "Invalid register date range.");
  const partyRaw = parseReportText(raw.partyId, "party filter", 100);
  const partyId = partyRaw === "all" ? "" : partyRaw;
  const q = parseReportText(raw.q, "search text").trim().toLowerCase();
  const data = await prisma.$transaction(async (tx) => {
    await establishTenantContext(tx, ctx);
    const db = tx as any;
    const invoices = await (kind === "sales" ? db.sales_invoices : db.purchase_invoices).findMany({
      where: { tenant_id: ctx.tenantId }, orderBy: { id: "asc" }, take: REPORT_ROW_LIMIT + 1,
    });
    if (invoices.length > REPORT_ROW_LIMIT) throw rowLimitError("invoices");
    const ids = [...new Set(invoices.flatMap((invoice: any) => {
      const id = kind === "sales" ? invoice.customer_id : invoice.supplier_id;
      return id ? [id] : [];
    }))];
    const parties = ids.length ? await (kind === "sales" ? db.customers : db.suppliers).findMany({
      where: { tenant_id: ctx.tenantId, id: { in: ids } }, select: { id: true, business_name: true, code: true },
    }) : [];
    return { invoices, parties };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const parties = new Map<string, { id: string; business_name: string; code: string }>(
    data.parties.map((p: any) => [p.id, { id: p.id, business_name: p.business_name ?? "", code: p.code ?? "" }]),
  );
  const excluded: { reason: ExclusionReason; net: string; partyId: string | null; searchable: string[] }[] = [];
  const rows = data.invoices.flatMap((invoice: any) => {
    const id = kind === "sales" ? invoice.customer_id : invoice.supplier_id;
    const party = id ? parties.get(id) : null;
    if (id && !party) throw integrityError("invoice counterparty is missing.");
    const searchable = [invoice.invoice_no ?? "", invoice.reference_no ?? "", invoice.supplier_invoice_no ?? "",
      invoice.notes ?? "", party?.business_name ?? ""].map((value: string) => String(value));
    const classified = classifyInvoiceEffectiveDate(invoice);
    if (!classified.trusted) {
      excluded.push({ reason: classified.reason, net: Decimal.from(invoice.net_amount ?? "0").toFixed(2),
        partyId: id ?? null, searchable });
      return [];
    }
    return [{
      id: invoice.id as string, invoice_no: invoice.invoice_no as string,
      effective_date: classified.date as string, party_id: id as string | null, party,
      supplier_invoice_no: (invoice.supplier_invoice_no ?? "") as string,
      reference_no: (invoice.reference_no ?? "") as string, notes: (invoice.notes ?? "") as string,
      status: invoice.status as string, is_cash_sale: Boolean(invoice.is_cash_sale),
      gross_amount: String(invoice.gross_amount), total_discount: String(invoice.total_discount),
      total_tax: String(invoice.total_tax), round_off: String(invoice.round_off),
      net_amount: String(invoice.net_amount), paid_amount: String(invoice.paid_amount ?? "0"),
      balance_due: String(invoice.balance_due ?? "0"),
      created_at: invoice.created_at ? formatBusinessInstant(invoice.created_at) : "",
    }];
  });
  // Party and search filters do not depend on the date, so they also define which
  // undated invoices are in scope; the date range cannot be applied to them.
  const inScopeExcluded = excluded.filter((item) => (!partyId || item.partyId === partyId) &&
    (!q || item.searchable.some((value) => value.toLowerCase().includes(q))));
  const exclusions = summarizeRegisterExclusions(data.invoices.length, inScopeExcluded);
  if (mode === "complete" && exclusions.excludedCount > 0) {
    throw coverageGapError("invoices", data.invoices.length, exclusions.excludedCount, exclusions.byReason);
  }
  const filtered = rows.filter((row: any) => {
    if (partyId && row.party_id !== partyId) return false;
    if ((start && row.effective_date < start) || (end && row.effective_date > end)) return false;
    return !q || [row.invoice_no, row.reference_no, row.supplier_invoice_no, row.notes,
      row.party?.business_name ?? ""].some((value: string) => value.toLowerCase().includes(q));
  }).sort((a: any, b: any) => compareText(b.effective_date, a.effective_date) || compareText(a.id, b.id));
  return {
    mode, complete: mode === "complete", startDate: start, endDate: end, rows: filtered, exclusions,
    parties: [...parties.values()].sort((a, b) => a.business_name.localeCompare(b.business_name) || compareText(a.id, b.id)),
    recordingTimeDisclosure: REPORT_RECORDING_TIME_DISCLOSURE,
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function serializeCsv(rows: string[][]): string {
  return bom + rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export async function exportPurchaseRegisterCsvAction(input: RegisterInput = {}): Promise<ReportCsvResult> {
  assertPostgresConfigured("exportPurchaseRegisterCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_purchase);
  return toCsvResult(async () => {
    const result = await loadFinancialRegisterReport("purchase", input);
    const rows: string[][] = [
      ...registerCsvPreamble("Purchase register", result.startDate, result.endDate, result.mode, result.exclusions),
      ["Invoice no", "Date", "Supplier", "Supplier invoice", "Status", "Gross", "Discount", "Tax", "Round off", "Net", "Created at"],
    ];
    for (const p of result.rows) {
      rows.push([
        p.invoice_no ?? "",
        formatBusinessDate(p.effective_date),
        p.party?.business_name ?? "",
        p.supplier_invoice_no ?? "",
        p.status ?? "",
        String(p.gross_amount ?? ""),
        String(p.total_discount ?? ""),
        String(p.total_tax ?? ""),
        String(p.round_off ?? ""),
        String(p.net_amount ?? ""),
        p.created_at,
      ]);
    }
    return { csv: serializeCsv(rows), filename: `purchase-register-${businessDateToday()}${result.complete ? "" : "-qualified"}.csv` };
  });
}

export async function exportSalesRegisterCsvAction(input: RegisterInput = {}): Promise<ReportCsvResult> {
  assertPostgresConfigured("exportSalesRegisterCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_invoice);
  return toCsvResult(async () => {
    const result = await loadFinancialRegisterReport("sales", input);
    const rows: string[][] = [
      ...registerCsvPreamble("Sales register", result.startDate, result.endDate, result.mode, result.exclusions),
      ["Invoice no", "Date", "Customer", "Reference no", "Cash sale", "Status", "Gross", "Discount", "Tax", "Round off", "Net", "Paid", "Balance due", "Created at"],
    ];
    for (const p of result.rows) {
      rows.push([
        p.invoice_no ?? "",
        formatBusinessDate(p.effective_date),
        p.party?.business_name ?? "",
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
        p.created_at,
      ]);
    }
    return { csv: serializeCsv(rows), filename: `sales-register-${businessDateToday()}${result.complete ? "" : "-qualified"}.csv` };
  });
}

export async function exportStockValuationCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportStockValuationCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_inventory);
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
    ["SKU", "Product", "Schedule", "HSN", "MRP", "Approved avg acquisition cost", "Total available qty", "Total batches", "Total value (₹)", "Near expiry batches"],
  ];

  for (const p of items as any[]) {
    const batches = p.batches ?? [];
    const avail = batches.reduce((s: number, b: any) => s + Number(b.available_qty ?? 0), 0);
    const batchesCount = batches.length;
    let weightedSum = 0;
    let approvedAvail = 0;
    let valuationPending = false;
    for (const b of batches) {
      if (b.inventory_valuation_status !== "APPROVED" || b.inventory_acquisition_cost === null) {
        valuationPending = valuationPending || Number(b.available_qty ?? 0) > 0;
        continue;
      }
      const available = Number(b.available_qty ?? 0);
      approvedAvail += available;
      weightedSum += available * Number(b.inventory_acquisition_cost ?? 0);
    }
    const avgRate = approvedAvail > 0 ? weightedSum / approvedAvail : 0;
    const totalValue = weightedSum;
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
      valuationPending ? "PENDING" : String(Number.isFinite(totalValue) ? totalValue.toFixed(2) : ""),
      String(nearExpireCount),
    ]);
  }

  return respondCsv(`stock-valuation-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

export async function exportBatchExpiryCsvAction(): Promise<Response> {
  assertPostgresConfigured("exportBatchExpiryCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_inventory);
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

type GstHsnExportInput = { from?: string; to?: string; party?: string; q?: string };

export async function exportGstHsnSummaryCsvAction(input: GstHsnExportInput = {}): Promise<ReportCsvResult> {
  assertPostgresConfigured("exportGstHsnSummaryCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_reports);
  const t = ctx;

  return toCsvResult(async () => {
  const filter = parseHsnFilter(input);
  const { invoices, exclusions } = await prisma.$transaction(async (tx) => {
    await establishTenantContext(tx, ctx);
    return loadHsnInvoices(tx as any, t.tenantId, filter);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  const groupMap = new Map<string, {
    hsn: string; description: string; ratePct: number; taxableValue: number;
    totalQty: number; cgst: number; sgst: number; igst: number; totalGst: number; invoicesSet: Set<string>;
  }>();

  for (const inv of invoices as any[]) {
    const invId = inv.id;
    const items = inv.items ?? [];
    for (const it of items) {
      const hsn = it.hsn_code_snapshot ?? "UNCLASSIFIED";
      const ratePct = Number(it.gst_rate ?? 0);
      const gstAmount = Number(it.gst_amount ?? 0);
      const lineTotal = Number(it.line_total ?? 0);
      const taxableValue = Number(it.taxable_amount ?? (lineTotal - gstAmount));
      const key = `${hsn}||${ratePct}`;
      let g = groupMap.get(key);
      if (!g) {
        g = { hsn, description: "", ratePct, taxableValue: 0, totalQty: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, invoicesSet: new Set() };
        groupMap.set(key, g);
      }
      g.description = it.product_name_snapshot ?? g.description;
      g.taxableValue += taxableValue;
      g.totalQty += Number(it.quantity ?? 0) + Number(it.free_qty ?? 0);
      g.cgst += Number(it.cgst_amount ?? 0);
      g.sgst += Number(it.sgst_amount ?? 0);
      g.igst += Number(it.igst_amount ?? 0);
      g.totalGst += gstAmount;
      g.invoicesSet.add(invId);
    }
  }

  const rows: string[][] = [
    ...hsnCsvPreamble(filter, exclusions),
    ["HSN", "Description", "Tax rate %", "Qty", "Taxable value \u20B9", "CGST \u20B9", "SGST \u20B9", "IGST \u20B9", "Total tax \u20B9", "Invoices count", "Total invoice value \u20B9"],
  ];

  const groups = [...groupMap.values()]
    .filter((g) => hsnRowMatchesQuery({ hsn: g.hsn, description: g.description }, filter.q))
    .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.ratePct - b.ratePct);
  for (const g of groups) {
    const totalGst = g.totalGst;
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

  return {
    csv: serializeCsv(rows),
    filename: `gst-hsn-summary-${filter.from}-${filter.to}${exclusions.count > 0 ? "-qualified" : ""}.csv`,
  };
  });
}

type LedgerReportInput = {
  kind: "daybook" | "customer";
  customerId?: string;
  from: string;
  to: string;
  q?: string;
  voucher?: string;
  mode?: string;
};

type ReportLedgerRow = {
  id: string;
  effective_date: string;
  /** Genuine event instant (ISO, UTC) when one exists; distinct from the effective date. */
  event_instant: string | null;
  /** Database statement time captured before commit (ISO, UTC); see the recording-time disclosure. */
  recorded_at: string | null;
  entry_type: string;
  voucher_type: string;
  counterparty: string;
  debit: string;
  credit: string;
  balance: string;
  narration: string | null;
  invoice_ref: string | null;
  invoice_id: string | null;
};

const REPORT_LEDGER_LIMIT = REPORT_ROW_LIMIT;

function voucherType(row: any, kind: "customer" | "supplier"): string {
  if (row.reference_type === "payment_refund") return "Payment refund";
  if (row.reference_type === "payment_reversal") return "Payment reversal";
  if (row.entry_type === "OPENING_BALANCE") return "Opening balance";
  if (row.entry_type === "INVOICE" && kind === "customer") return "Customer Invoice";
  if (row.entry_type === "PURCHASE" && kind === "supplier") return "Supplier Invoice";
  if (row.entry_type === "PAYMENT_RECEIVED" && kind === "customer") return "Customer Payment";
  if (row.entry_type === "PAYMENT_MADE" && kind === "supplier") return "Supplier Payment";
  return row.entry_type.replaceAll("_", " ");
}

function compareLedgerRows(a: ReportLedgerRow, b: ReportLedgerRow): number {
  return compareText(a.effective_date, b.effective_date) || compareText(a.id, b.id);
}

export async function loadFinancialLedgerReport(input: LedgerReportInput) {
  assertPostgresConfigured("loadFinancialLedgerReport");
  const ctx = await requireServerTenantContext();
  const raw = parseReportInputObject(input);
  if (raw.kind !== "daybook" && raw.kind !== "customer") throw new ReportUnavailableError("INVALID_INPUT", "Invalid report.");
  const kind: "daybook" | "customer" = raw.kind;
  requirePermission(ctx, kind === "daybook" ? PermissionAction.view_reports : PermissionAction.view_customer_ledger);
  const mode = parseReportMode(raw.mode);
  const from = parseStrictReportDate(raw.from, "from");
  const to = parseStrictReportDate(raw.to, "to");
  if (from > to) throw new ReportUnavailableError("INVALID_INPUT", "Invalid report date range.");
  const customerId = kind === "customer" ? parseReportId(raw.customerId, "Customer") : undefined;
  const voucher = raw.voucher === undefined ? "all" : raw.voucher;
  if (voucher !== "all" && voucher !== "invoice" && voucher !== "payment") {
    throw new ReportUnavailableError("INVALID_INPUT", "Invalid voucher filter.");
  }
  const q = parseReportText(raw.q, "search text").trim().toLowerCase();

  const data = await prisma.$transaction(async (tx) => {
    await establishTenantContext(tx, ctx);
    const db = tx as any;
    const customer = kind === "customer" ? await db.customers.findFirst({
      where: { tenant_id: ctx.tenantId, id: customerId },
      select: { id: true, business_name: true, code: true, contact_person: true, mobile: true, phone: true, email: true, gstin: true,
        billing_address_1: true, billing_address_2: true, billing_city: true, billing_state: true, billing_pincode: true },
    }) : null;
    if (kind === "customer" && !customer) throw new ReportUnavailableError("INVALID_INPUT", "Customer not found.");
    const agingRows = kind === "customer" ? await db.sales_invoices.findMany({
      where: { tenant_id: ctx.tenantId, customer_id: customerId, status: "FINALIZED", balance_due: { gt: 0 } },
      select: { due_date_business: true, balance_due: true }, take: REPORT_LEDGER_LIMIT + 1,
    }) : [];
    const customerRows = await db.customer_ledgers.findMany({
      where: { tenant_id: ctx.tenantId, ...(kind === "customer" ? { customer_id: customerId } : {}) },
      orderBy: { id: "asc" }, take: REPORT_LEDGER_LIMIT + 1,
    });
    const supplierRows = kind === "daybook" ? await db.supplier_ledgers.findMany({
      where: { tenant_id: ctx.tenantId }, orderBy: { id: "asc" }, take: REPORT_LEDGER_LIMIT + 1,
    }) : [];
    if (customerRows.length + supplierRows.length > REPORT_LEDGER_LIMIT) throw rowLimitError("ledger entries");
    const customers = kind === "daybook" ? await db.customers.findMany({
      where: { tenant_id: ctx.tenantId, id: { in: [...new Set(customerRows.map((row: any) => row.customer_id))] } },
      select: { id: true, business_name: true },
    }) : customer ? [customer] : [];
    const suppliers = input.kind === "daybook" ? await db.suppliers.findMany({
      where: { tenant_id: ctx.tenantId, id: { in: [...new Set(supplierRows.map((row: any) => row.supplier_id))] } },
      select: { id: true, business_name: true },
    }) : [];
    const invoiceIds = [...new Set(customerRows.flatMap((row: any) => row.invoice_id ? [row.invoice_id] : []))];
    const purchaseIds = [...new Set(supplierRows.flatMap((row: any) => row.purchase_id ? [row.purchase_id] : []))];
    const salesInvoices = invoiceIds.length ? await db.sales_invoices.findMany({
      where: { tenant_id: ctx.tenantId, id: { in: invoiceIds } },
      select: { id: true, customer_id: true, invoice_no: true },
    }) : [];
    const purchaseInvoices = purchaseIds.length ? await db.purchase_invoices.findMany({
      where: { tenant_id: ctx.tenantId, id: { in: purchaseIds } },
      select: { id: true, supplier_id: true, invoice_no: true },
    }) : [];
    const invoiceNumbers = new Map<string, string>([
      ...salesInvoices.filter((r: any) => r.invoice_no && r.customer_id)
        .map((r: any) => [`c_${r.customer_id}_${r.id}`, r.invoice_no] as [string, string]),
      ...purchaseInvoices.filter((r: any) => r.invoice_no && r.supplier_id)
        .map((r: any) => [`s_${r.supplier_id}_${r.id}`, r.invoice_no] as [string, string]),
    ]);
    const names = new Map<string, string>([...customers.map((r: any) => [`c_${r.id}`, r.business_name ?? ""] as [string, string]),
      ...suppliers.map((r: any) => [`s_${r.id}`, r.business_name ?? ""] as [string, string])]);
    const rows = [...customerRows.map((row: any) => ({ row, kind: "customer" as const })),
      ...supplierRows.map((row: any) => ({ row, kind: "supplier" as const }))];
    return { customer, rows, names, agingRows, invoiceNumbers };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

  const excluded: { reason: ExclusionReason; debit: string; credit: string }[] = [];
  const classifiedRows: ReportLedgerRow[] = [];
  for (const { row, kind: rowKind } of data.rows as { row: any; kind: "customer" | "supplier" }[]) {
    const partyKey = rowKind === "customer" ? `c_${row.customer_id}` : `s_${row.supplier_id}`;
    if (!data.names.has(partyKey)) throw integrityError("ledger counterparty is missing.");
    const debitAmount = Decimal.from(row.debit).toFixed(2);
    const creditAmount = Decimal.from(row.credit).toFixed(2);
    const classified = classifyLedgerEffectiveDate(row);
    if (!classified.trusted) {
      excluded.push({ reason: classified.reason, debit: debitAmount, credit: creditAmount });
      continue;
    }
    classifiedRows.push({
      id: `${rowKind === "customer" ? "c" : "s"}_${row.id}`,
      effective_date: classified.date, event_instant: isoInstantOrNull(row.occurred_at),
      recorded_at: isoInstantOrNull(row.recorded_at), entry_type: row.entry_type,
      voucher_type: voucherType(row, rowKind),
      counterparty: data.names.get(partyKey) ?? "", debit: debitAmount,
      credit: creditAmount, balance: "0.00", narration: row.narration ?? null,
      invoice_ref: data.invoiceNumbers.get(`${partyKey}_${rowKind === "customer" ? row.invoice_id : row.purchase_id}`) ??
        row.reference_id ?? row.invoice_id ?? row.purchase_id ?? null,
      invoice_id: row.invoice_id ?? null,
    });
  }
  const exclusions = summarizeLedgerExclusions(data.rows.length, excluded);
  if (mode === "complete" && exclusions.excludedCount > 0) {
    throw coverageGapError("ledger entries", exclusions.totalEntries, exclusions.excludedCount, exclusions.byReason);
  }
  const rows = classifiedRows.sort(compareLedgerRows);

  let running = Decimal.zero();
  let opening = Decimal.zero();
  let debit = Decimal.zero();
  let credit = Decimal.zero();
  const visible: ReportLedgerRow[] = [];
  for (const row of rows) {
    if (row.effective_date > to) break;
    running = running.add(row.debit).subtract(row.credit);
    if (row.effective_date < from) { opening = running; continue; }
    row.balance = running.toFixed(2);
    const isInvoice = row.voucher_type === "Customer Invoice" || row.voucher_type === "Supplier Invoice";
    const isPayment = row.voucher_type === "Customer Payment" || row.voucher_type === "Supplier Payment";
    if ((voucher === "invoice" && !isInvoice) || (voucher === "payment" && !isPayment)) continue;
    if (q && ![row.counterparty, row.narration ?? "", row.invoice_ref ?? ""].some((value) => value.toLowerCase().includes(q))) continue;
    debit = debit.add(row.debit);
    credit = credit.add(row.credit);
    visible.push(row);
  }
  let aging: { current: string; d30: string; d60: string; d90: string; over90: string } | null = null;
  if (kind === "customer" && data.agingRows.length <= REPORT_LEDGER_LIMIT) {
    const today = Date.parse(`${businessDateToday()}T00:00:00.000Z`);
    const buckets = { current: Decimal.zero(), d30: Decimal.zero(), d60: Decimal.zero(), d90: Decimal.zero(), over90: Decimal.zero() };
    let complete = true;
    for (const invoice of data.agingRows) {
      if (!(invoice.due_date_business instanceof Date)) { complete = false; break; }
      let dueDate: string;
      try { dueDate = businessDateFromPrismaDate(invoice.due_date_business); }
      catch { complete = false; break; }
      const days = Math.floor((today - businessDateToPrismaDate(parseBusinessDate(dueDate)).getTime()) / 86400000);
      const bucket = days <= 0 ? "current" : days <= 30 ? "d30" : days <= 60 ? "d60" : days <= 90 ? "d90" : "over90";
      buckets[bucket] = buckets[bucket].add(invoice.balance_due);
    }
    if (complete) aging = { current: buckets.current.toFixed(2), d30: buckets.d30.toFixed(2),
      d60: buckets.d60.toFixed(2), d90: buckets.d90.toFixed(2), over90: buckets.over90.toFixed(2) };
  }
  return { mode, complete: mode === "complete", from, to, customer: data.customer, aging, rows: visible,
    opening: opening.toFixed(2), debit: debit.toFixed(2), credit: credit.toFixed(2),
    net: debit.subtract(credit).toFixed(2), closing: running.toFixed(2),
    balanceBasis: mode === "qualified" ? BALANCE_BASIS_QUALIFIED : BALANCE_BASIS_COMPLETE,
    balanceContext: balanceContext(mode), exclusions, recordingTimeDisclosure: REPORT_RECORDING_TIME_DISCLOSURE };
}

type LedgerReport = Awaited<ReturnType<typeof loadFinancialLedgerReport>>;

function ledgerCsvRows(report: LedgerReport, title: string): string[][] {
  const qualified = report.mode === "qualified";
  return [
    ...ledgerCsvPreamble(title, report.from, report.to, report.mode, report.exclusions),
    ["Date", "Voucher type", "Counterparty", "Debit ₹", "Credit ₹", "Balance ₹", "Narration", "Invoice ref",
      "Event instant (IST)", "Recorded at (IST)", "Balance context"],
    [report.from, qualified ? "Opening balance (classified entries only)" : "Opening balance", "", "", "", report.opening,
      "Brought forward", "", "", "", report.balanceContext],
    ...report.rows.map((r) => [r.effective_date, r.voucher_type, r.counterparty, r.debit, r.credit, r.balance,
      r.narration ?? "", r.invoice_ref ?? "", formatInstantOrBlank(r.event_instant), formatInstantOrBlank(r.recorded_at),
      report.balanceContext]),
  ];
}

export async function exportDaybookCsvAction(input: Omit<LedgerReportInput, "kind" | "customerId">): Promise<ReportCsvResult> {
  assertPostgresConfigured("exportDaybookCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_reports);
  return toCsvResult(async () => {
    const report = await loadFinancialLedgerReport({ ...input, kind: "daybook" });
    return { csv: serializeCsv(ledgerCsvRows(report, "Daybook")),
      filename: `daybook-${report.from}-${report.to}${report.complete ? "" : "-qualified"}.csv` };
  });
}

export async function exportCustomerStatementCsvAction(
  input: Omit<LedgerReportInput, "kind">,
): Promise<ReportCsvResult> {
  assertPostgresConfigured("exportCustomerStatementCsvAction");
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, PermissionAction.view_customer_ledger);
  return toCsvResult(async () => {
    const report = await loadFinancialLedgerReport({ ...input, kind: "customer" });
    const customer = report.customer;
    return { csv: serializeCsv(ledgerCsvRows(report, `Customer statement: ${customer?.business_name ?? ""} (${customer?.code ?? ""})`)),
      filename: `customer-statement-${report.from}-${report.to}${report.complete ? "" : "-qualified"}.csv` };
  });
}
