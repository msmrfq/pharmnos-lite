export type TenantContext = {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
};

export function requireTenant(ctx: Partial<TenantContext> | null | undefined): TenantContext {
  if (!ctx || !ctx.tenantId) {
    throw new Error("Tenant context is required for this operation.");
  }
  if (!ctx.userId) {
    throw new Error("User context is required for this operation.");
  }
  return ctx as TenantContext;
}

export function tenantScoped<T extends { tenant_id: string }>(
  where: T,
  ctx: TenantContext,
): T {
  return { ...where, tenant_id: ctx.tenantId };
}
