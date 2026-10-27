import { prisma } from "@/lib/db/prisma";
import { authAdapter } from "@/adapters/auth";
import type { PermissionAction, SystemRole } from "@prisma/client";

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

export function requirePermission(ctx: TenantContext, permission: PermissionAction): void {
  if (!ctx.permissions.includes(permission)) {
    throw new Error("You are not authorized to perform this action.");
  }
}

export function tenantScoped<T extends { tenant_id: string }>(
  where: T,
  ctx: TenantContext,
): T {
  return { ...where, tenant_id: ctx.tenantId };
}

type SessionCtxResult = {
  ok: true;
  ctx: TenantContext;
} | {
  ok: false;
  error: string;
};

export async function getServerTenantContext(): Promise<SessionCtxResult> {
  let session: Awaited<ReturnType<typeof authAdapter.getCurrentSession>> = null;
  try {
    session = await authAdapter.getCurrentSession();
    if (!session || !session.user?.id) {
      return { ok: false, error: "Authentication is required." };
    }
    const externalId = session.user.id;
    const user = await prisma.users.findUnique({
      where: { external_id: externalId },
      include: {
        memberships: {
          where: { status: "active" },
          include: {
            role: {
              include: {
                permissions: { select: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user || !user.memberships.length) {
      throw new Error("Authenticated user has no active tenant membership.");
    }
    const m = user.memberships[0];
    if (!m) {
      throw new Error("Authenticated user has no active tenant membership.");
    }

    try {
      if (externalId && m.tenant_id) {
        await authAdapter.setAppMetadataTenantId(externalId, m.tenant_id);
      }
    } catch (_e) {
      // Best-effort backfill; failures should never break page loads.
    }

    const roles: string[] = m.role ? [m.role.name] : [];
    const permissions: string[] = (m.role?.permissions ?? [])
      .map((rp) => (rp as any).permission as PermissionAction | string)
      .filter((p) => !!p)
      .map((p) => String(p));
    return {
      ok: true,
      ctx: {
        tenantId: m.tenant_id,
        userId: user.id,
        roles,
        permissions,
      },
    };
  } catch (err) {
    if (session?.user?.id) {
      return { ok: false, error: err instanceof Error ? err.message : "Tenant context lookup failed." };
    }
    return { ok: false, error: "Authentication is required." };
  }
}

export async function requireServerTenantContext(): Promise<TenantContext> {
  const res = await getServerTenantContext();
  if (!res.ok) {
    throw new Error(res.error);
  }
  return res.ctx;
}

export type { SystemRole };
