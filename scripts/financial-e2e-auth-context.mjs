import { FinancialE2eOrchestrationError } from "./financial-e2e-orchestration.mjs";

function requireDependency(dependencies, name) {
    if (typeof dependencies[name] !== "function") {
        throw new TypeError(`Authenticated context adapter requires ${name}().`);
    }
}

function fail(code, message) {
    throw new FinancialE2eOrchestrationError(code, message);
}

function resolveActiveMembership(user) {
    if (!user || !Array.isArray(user.memberships)) {
        fail("APPLICATION_USER_NOT_FOUND", "Authenticated application user could not be resolved.");
    }
    const membership = user.memberships.find((candidate) => candidate?.status === "active");
    if (!membership || !String(membership.tenant_id ?? "").trim()) {
        fail("ACTIVE_MEMBERSHIP_REQUIRED", "Authenticated user has no active tenant membership.");
    }
    return membership;
}

function buildTenantContext(user, membership) {
    const permissions = Array.isArray(membership.role?.permissions)
        ? membership.role.permissions
            .map((permission) => permission?.permission)
            .filter((permission) => typeof permission === "string" && permission.trim())
            .map((permission) => permission.trim())
        : [];

    return Object.freeze({
        tenantId: membership.tenant_id,
        userId: user.id,
        roles: membership.role?.name ? [membership.role.name] : [],
        permissions,
    });
}

export function createFinancialE2eAuthContextAdapter({
    getCurrentSession,
    findUserByExternalId,
}) {
    requireDependency({ getCurrentSession }, "getCurrentSession");
    requireDependency({ findUserByExternalId }, "findUserByExternalId");

    return Object.freeze({
        async getAuthenticatedContext({ requestedTenantId } = {}) {
            if (requestedTenantId !== undefined && requestedTenantId !== null) {
                fail(
                    "TENANT_OVERRIDE_REJECTED",
                    "Caller-supplied tenant IDs cannot establish authorization.",
                );
            }

            let session;
            try {
                session = await getCurrentSession();
            } catch {
                fail("AUTHENTICATION_FAILED", "Authenticated session could not be established.");
            }
            if (!session?.user?.id) {
                fail("AUTHENTICATION_REQUIRED", "An authenticated session is required.");
            }

            let user;
            try {
                user = await findUserByExternalId(session.user.id);
            } catch {
                fail("APPLICATION_USER_LOOKUP_FAILED", "Authenticated application user lookup failed.");
            }
            const membership = resolveActiveMembership(user);
            return buildTenantContext(user, membership);
        },
    });
}
