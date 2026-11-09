"use server";

import { assertPostgresConfigured, prisma } from "@/lib/db/prisma";
import { establishTenantContext, requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import { PermissionAction, Prisma } from "@prisma/client";
import { Decimal } from "@/lib/decimal";
import {
  agingReportCsv,
  buildAgingReport,
  remainingPurchaseBalanceDecimal,
  type AgingInvoiceRow,
  type AgingKind,
  type AgingPartyInfo,
  type AgingReport,
} from "@/domain/services/aging-report.service";

const OPEN_INVOICE_CAP = 25000;
const SCAN_CAP = 250000;
const SCAN_BATCH = 5000;

type AgingLoadResult = { ok: true; report: AgingReport } | { ok: false; reason: string };

class AgingCapError extends Error {}

const money = (value: unknown): string | null =>
  value === null || value === undefined ? null : Decimal.from(value as string).toFixed(2);

async function loadAgingReport(kind: AgingKind): Promise<AgingLoadResult> {
  const actionName = kind === "customer" ? "loadCustomerAgingReport" : "loadSupplierAgingReport";
  assertPostgresConfigured(actionName);
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, kind === "customer" ? PermissionAction.view_customer_ledger : PermissionAction.view_supplier_ledger);

  try {
    // One repeatable-read snapshot and one captured instant for every row and party of the report.
    const data = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      const asOf = new Date();
      const db = tx as any;
      const invoices = kind === "customer" ? db.sales_invoices : db.purchase_invoices;
      const open: AgingInvoiceRow[] = [];
      let scanned = 0;
      let cursor: string | undefined;
      for (;;) {
        const batch: any[] = await invoices.findMany({
          where: {
            tenant_id: ctx.tenantId,
            status: "FINALIZED",
            ...(kind === "customer" ? { balance_due: { gt: 0 } } : {}),
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          select: kind === "customer"
            ? { id: true, customer_id: true, balance_due: true, due_date_business: true }
            : {
              id: true, supplier_id: true, net_amount: true, due_date_business: true,
              payment_allocations: { select: { amount: true, reversal: { select: { amount: true } } } },
            },
          orderBy: { id: "asc" },
          take: SCAN_BATCH,
        });
        scanned += batch.length;
        if (scanned > SCAN_CAP) throw new AgingCapError("Aging unavailable: too many finalized invoices to aggregate safely.");
        for (const row of batch) {
          const balance = kind === "customer" ? Decimal.from(row.balance_due) : remainingPurchaseBalanceDecimal(row);
          if (balance.compare(0) <= 0) continue;
          open.push({
            id: row.id,
            partyId: (kind === "customer" ? row.customer_id : row.supplier_id) ?? null,
            balance,
            dueDateBusiness: row.due_date_business ?? null,
          });
        }
        if (open.length > OPEN_INVOICE_CAP) {
          throw new AgingCapError("Aging unavailable: more open invoices than the safe report limit.");
        }
        if (batch.length < SCAN_BATCH) break;
        cursor = batch[batch.length - 1].id;
      }
      const partyIds = [...new Set(open.flatMap((row) => row.partyId ? [row.partyId] : []))];
      const partyRows: any[] = partyIds.length
        ? await (kind === "customer" ? db.customers : db.suppliers).findMany({
          where: { tenant_id: ctx.tenantId, id: { in: partyIds } },
          select: kind === "customer"
            ? { id: true, code: true, business_name: true, contact_person: true, phone: true, mobile: true, billing_city: true, billing_state: true, receivable_balance: true }
            : { id: true, code: true, business_name: true, contact_person: true, phone: true, mobile: true, city: true, state: true, payable_balance: true },
        })
        : [];
      return { asOf, open, partyRows };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });

    const parties: AgingPartyInfo[] = data.partyRows.map((row) => ({
      id: row.id,
      name: row.business_name ?? "",
      code: row.code ?? null,
      contact: row.contact_person ?? null,
      phone: row.mobile ?? row.phone ?? null,
      city: (kind === "customer" ? row.billing_city : row.city) ?? null,
      state: (kind === "customer" ? row.billing_state : row.state) ?? null,
      cachedBalance: money(kind === "customer" ? row.receivable_balance : row.payable_balance),
    }));
    return { ok: true, report: buildAgingReport(kind, data.open, parties, data.asOf) };
  } catch (error) {
    console.error(`${actionName} failed:`, error);
    return {
      ok: false,
      reason: error instanceof AgingCapError
        ? error.message
        : "Aging unavailable: the report could not be read consistently from the database.",
    };
  }
}

export async function loadCustomerAgingReport(): Promise<AgingLoadResult> {
  return loadAgingReport("customer");
}

export async function loadSupplierAgingReport(): Promise<AgingLoadResult> {
  return loadAgingReport("supplier");
}

type CsvResult = { ok: true; csv: string; filename: string } | { ok: false; reason: string };

async function exportAgingCsv(kind: AgingKind): Promise<CsvResult> {
  const loaded = await (kind === "customer" ? loadCustomerAgingReport() : loadSupplierAgingReport());
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const name = kind === "customer" ? "customer-dues" : "supplier-payables";
  return { ok: true, csv: agingReportCsv(loaded.report), filename: `${name}-${loaded.report.businessDate}.csv` };
}

export async function exportCustomerDuesCsvAction(): Promise<CsvResult> {
  return exportAgingCsv("customer");
}

export async function exportSupplierPayablesCsvAction(): Promise<CsvResult> {
  return exportAgingCsv("supplier");
}
