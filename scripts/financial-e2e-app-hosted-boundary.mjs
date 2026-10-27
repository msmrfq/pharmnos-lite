import {
    createFinancialE2eOrchestrator,
    FinancialE2eOrchestrationError,
} from "./financial-e2e-orchestration.mjs";

function requireDependency(dependencies, name) {
    if (typeof dependencies[name] !== "function") {
        throw new TypeError(`Application-hosted boundary requires ${name}().`);
    }
}

function rejectTenantOverride(requestedTenantId) {
    if (requestedTenantId !== undefined && requestedTenantId !== null) {
        throw new FinancialE2eOrchestrationError(
            "TENANT_OVERRIDE_REJECTED",
            "Caller-supplied tenant IDs cannot establish authorization.",
        );
    }
}

function validateResolvedContext(context) {
    if (!context || typeof context !== "object") {
        throw new FinancialE2eOrchestrationError(
            "INVALID_TENANT_CONTEXT",
            "Authenticated tenant context is incomplete.",
        );
    }
    if (!String(context.tenantId ?? "").trim() || !String(context.userId ?? "").trim()) {
        throw new FinancialE2eOrchestrationError(
            "INVALID_TENANT_CONTEXT",
            "Authenticated tenant context must include tenant and user identity.",
        );
    }
    if (!Array.isArray(context.roles) || !Array.isArray(context.permissions)) {
        throw new FinancialE2eOrchestrationError(
            "INVALID_TENANT_CONTEXT",
            "Authenticated tenant context must include resolved authorization data.",
        );
    }
    return context;
}

export function createApplicationHostedFinancialE2eBoundary({
    resolveTenantContext,
    requirePermission,
    canStartScenario,
    scenarioOperations = {},
}) {
    requireDependency({ resolveTenantContext }, "resolveTenantContext");

    const orchestrator = createFinancialE2eOrchestrator({
        getAuthenticatedContext: async ({ requestedTenantId } = {}) => {
            rejectTenantOverride(requestedTenantId);
            let context;
            try {
                context = await resolveTenantContext();
            } catch {
                throw new FinancialE2eOrchestrationError(
                    "AUTHENTICATION_FAILED",
                    "Authenticated application context could not be established.",
                );
            }
            return validateResolvedContext(context);
        },
        requirePermission,
        canStartScenario,
        scenarioOperations,
    });

    return Object.freeze({
        dispatch(request) {
            return orchestrator.dispatch(request);
        },
    });
}

/**
 * @typedef {{
 *   resolveTenantContext: () => Promise<{
 *     tenantId: string,
 *     userId: string,
 *     roles: string[],
 *     permissions: string[],
 *   }>,
 *   requirePermission: (context: object, permission: string) => void,
 *   canStartScenario: (gate: unknown) => Promise<boolean>,
 *   scenarioOperations?: Record<string, (request: object) => Promise<unknown>>,
 * }} ApplicationHostedFinancialE2eBoundaryOptions
 */
