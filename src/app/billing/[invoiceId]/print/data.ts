import { requireServerTenantContext } from "@/lib/db/tenant-context";
import { repos } from "@/repositories";

export async function loadBillingInvoicePrintData(invoiceId: string) {
  const ctx = await requireServerTenantContext();
  const rawInvoice = await repos.salesInvoices.getById(invoiceId, ctx);
  if (!rawInvoice) {
    return { ctx, rawInvoice: null, businessProfile: null, tenant: null };
  }
  const [businessProfile, tenant] = await Promise.all([
    repos.businessProfiles.getForTenant(ctx).catch(() => null),
    repos.tenants.getById(ctx.tenantId, ctx).catch(() => null),
  ]);
  return { ctx, rawInvoice, businessProfile, tenant };
}
