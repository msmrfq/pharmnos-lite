"use server";

import { assertPostgresConfigured, prisma } from "@/lib/db/prisma";
import { repos } from "@/repositories";
import { establishTenantContext, requirePermission, requireServerTenantContext } from "@/lib/db/tenant-context";
import { PermissionAction, Prisma } from "@prisma/client";
import { istMonthBounds, summarizeMonthlyStats, type MonthlyStats } from "@/domain/services/monthly-stats.service";

type MonthlyStatsResult = { ok: true; stats: MonthlyStats } | { ok: false; reason: string };

async function loadMonthlyStats(kind: "sales" | "purchase"): Promise<MonthlyStatsResult> {
  const actionName = kind === "sales" ? "loadMonthlySalesStats" : "loadMonthlyPurchaseStats";
  assertPostgresConfigured(actionName);
  const ctx = await requireServerTenantContext();
  requirePermission(ctx, kind === "sales" ? PermissionAction.view_invoice : PermissionAction.view_purchase);
  const bounds = istMonthBounds(new Date());
  try {
    // Included and excluded aggregates are read from one snapshot so they describe the same invoice set.
    const aggregates = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctx);
      return kind === "sales"
        ? repos.salesInvoices.monthlyEffectiveStats(ctx, bounds, tx)
        : repos.purchaseInvoices.monthlyEffectiveStats(ctx, bounds, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    return { ok: true, stats: summarizeMonthlyStats(kind, bounds.month, aggregates.included, aggregates.unclassified) };
  } catch (error) {
    console.error(`${actionName} failed:`, error);
    return { ok: false, reason: "Monthly totals could not be read from the database." };
  }
}

export async function loadMonthlySalesStats(): Promise<MonthlyStatsResult> {
  return loadMonthlyStats("sales");
}

export async function loadMonthlyPurchaseStats(): Promise<MonthlyStatsResult> {
  return loadMonthlyStats("purchase");
}
