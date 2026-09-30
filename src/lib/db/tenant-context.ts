import { prisma } from "@/lib/db/prisma";
import { authAdapter } from "@/adapters/auth";
import type { PermissionAction, SystemRole } from "@prisma/client";

export type TenantContext = {
  tenantId: string;
  userId: string;
  roles: string[];
  permissions: string[];
};

const DEMO_TENANT_ID = "tn_maharashtra_pharma_0000000000001";
const DEMO_USER_ID = "usr_rajesh_kumar_0000000000001";

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

const demoContext: TenantContext = {
  tenantId: DEMO_TENANT_ID,
  userId: DEMO_USER_ID,
  roles: [],
  permissions: [],
};

export function getDemoTenantContext(): TenantContext {
  return demoContext;
}

type SessionCtxResult = {
  ok: true;
  ctx: TenantContext;
  demoFallback: boolean;
} | {
  ok: false;
  error: string;
};

export async function getServerTenantContext(): Promise<SessionCtxResult> {
  try {
    const session = await authAdapter.getCurrentSession();
    if (!session || !session.user?.id) {
      return {
        ok: true,
        ctx: getDemoTenantContext(),
        demoFallback: true,
      };
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
      return {
        ok: true,
        ctx: getDemoTenantContext(),
        demoFallback: true,
      };
    }
    const m = user.memberships[0];
    if (!m) {
      return {
        ok: true,
        ctx: getDemoTenantContext(),
        demoFallback: true,
      };
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
      demoFallback: false,
    };
  } catch (_err) {
    return {
      ok: true,
      ctx: getDemoTenantContext(),
      demoFallback: true,
    };
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
