import { prisma } from "@/lib/db/prisma";
import { authAdapter } from "@/adapters/auth";
import { Prisma } from "@prisma/client";
import type { PermissionAction, SystemRole } from "@prisma/client";
import { createFinancialAuthContext } from "@/lib/db/financial-auth-context";

export type TenantContext = {
  tenantId: string;
  userId: string;
  subjectId: string;
  membershipId: string;
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
  if (!ctx.subjectId) {
    throw new Error("Subject context is required for this operation.");
  }
  return ctx as TenantContext;
}

export function requirePermission(
  ctx: Pick<TenantContext, "permissions">,
  permission: PermissionAction,
): void {
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

export async function establishTenantContext(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
): Promise<void> {
  const signedContext = createFinancialAuthContext(ctx.subjectId, ctx.tenantId);
  // Step 1: Verify context and get tenant/subject IDs
  const result = await tx.$queryRaw<{ subject_id: string; tenant_id: string }[]>`
    SELECT subject_id, tenant_id
    FROM pharmnos_private.verify_auth_context(${signedContext})
    LIMIT 1
  `;
  const row = result[0];
  if (!row || !row.tenant_id || !row.subject_id) {
    throw new Error("Failed to establish tenant context: invalid or expired context");
  }
  const { tenant_id, subject_id } = row;
  // Step 2: Set transaction-local GUCs for RLS policies
  await tx.$executeRaw(Prisma.sql`SET LOCAL pharmnos.auth_context_tenant_id = ${tenant_id}`);
  await tx.$executeRaw(Prisma.sql`SET LOCAL pharmnos.auth_context_subject_id = ${subject_id}`);
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
    const user = await prisma.$transaction(async (tx) => {
      // Verify context and establish tenant GUCs
      const signedContext = createFinancialAuthContext(externalId);
      const result = await tx.$queryRaw<{ subject_id: string; tenant_id: string }[]>`
        SELECT subject_id, tenant_id
        FROM pharmnos_private.verify_auth_context(${signedContext})
        LIMIT 1
      `;
      const row = result[0];
      if (!row || !row.tenant_id || !row.subject_id) {
        throw new Error("Failed to establish tenant context: invalid or expired context");
      }
      const { tenant_id, subject_id } = row;
      await tx.$executeRaw(Prisma.sql`SET LOCAL pharmnos.auth_context_tenant_id = ${tenant_id}`);
      await tx.$executeRaw(Prisma.sql`SET LOCAL pharmnos.auth_context_subject_id = ${subject_id}`);
      
      return tx.users.findUnique({
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
    });
    if (!user || user.memberships.length === 0) {
      throw new Error("Authenticated user has no active tenant membership.");
    }
    if (user.memberships.length !== 1) {
      throw new Error("Authenticated user has ambiguous active tenant memberships.");
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
        subjectId: externalId,
        membershipId: m.id,
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
