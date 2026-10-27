const VALID_SCENARIO = /^[a-z][a-z0-9-]*$/;

export const ORCHESTRATION_STATUS = Object.freeze({
    DISPATCHED: "DISPATCHED",
    BLOCKED: "BLOCKED",
    REJECTED: "REJECTED",
});

export class FinancialE2eOrchestrationError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "FinancialE2eOrchestrationError";
        this.code = code;
    }
}

function requireDependency(dependencies, name) {
    if (typeof dependencies[name] !== "function") {
        throw new TypeError(`Financial E2E orchestration requires ${name}().`);
    }
}

function validateAuthenticatedContext(context) {
    if (!context || typeof context !== "object") {
        throw new FinancialE2eOrchestrationError(
            "AUTHENTICATION_REQUIRED",
            "An authenticated tenant context is required.",
        );
    }
    if (!String(context.tenantId ?? "").trim() || !String(context.userId ?? "").trim()) {
        throw new FinancialE2eOrchestrationError(
            "INVALID_TENANT_CONTEXT",
            "Authenticated tenant context must include tenant and user identity.",
        );
    }
    if (!Array.isArray(context.permissions)) {
        throw new FinancialE2eOrchestrationError(
            "INVALID_TENANT_CONTEXT",
            "Authenticated tenant context must include resolved permissions.",
        );
    }
}

export function createFinancialE2eOrchestrator({
    getAuthenticatedContext,
    requirePermission,
    canStartScenario,
    scenarioOperations = {},
}) {
    const dependencies = {
        getAuthenticatedContext,
        requirePermission,
        canStartScenario,
    };
    requireDependency(dependencies, "getAuthenticatedContext");
    requireDependency(dependencies, "requirePermission");
    requireDependency(dependencies, "canStartScenario");
    if (!scenarioOperations || typeof scenarioOperations !== "object" || Array.isArray(scenarioOperations)) {
        throw new TypeError("Financial E2E scenario operations must be an object.");
    }

    return Object.freeze({
        async dispatch({
            scenario,
            requiredPermission,
            gate,
            input = undefined,
            requestedTenantId = undefined,
        }) {
            if (typeof scenario !== "string" || !VALID_SCENARIO.test(scenario)) {
                return {
                    status: ORCHESTRATION_STATUS.REJECTED,
                    code: "INVALID_SCENARIO",
                    message: "A valid scenario name is required.",
                };
            }
            if (!String(requiredPermission ?? "").trim()) {
                return {
                    status: ORCHESTRATION_STATUS.REJECTED,
                    code: "PERMISSION_REQUIRED",
                    message: "A required permission is needed before scenario dispatch.",
                };
            }

            let context;
            try {
                context = await getAuthenticatedContext({ requestedTenantId });
                validateAuthenticatedContext(context);
            } catch (error) {
                if (error instanceof FinancialE2eOrchestrationError) {
                    return { status: ORCHESTRATION_STATUS.BLOCKED, code: error.code, message: error.message };
                }
                return {
                    status: ORCHESTRATION_STATUS.BLOCKED,
                    code: "AUTHENTICATION_FAILED",
                    message: "Authenticated tenant context could not be established.",
                };
            }

            try {
                requirePermission(context, requiredPermission);
            } catch {
                return {
                    status: ORCHESTRATION_STATUS.BLOCKED,
                    code: "PERMISSION_DENIED",
                    message: "Authenticated context does not have the required permission.",
                };
            }

            let allowed = false;
            try {
                allowed = (await canStartScenario(gate)) === true;
            } catch {
                return {
                    status: ORCHESTRATION_STATUS.BLOCKED,
                    code: "SAFETY_GATE_ERROR",
                    message: "The financial E2E safety gate could not be established.",
                };
            }
            if (!allowed) {
                return {
                    status: ORCHESTRATION_STATUS.BLOCKED,
                    code: "SAFETY_GATE_BLOCKED",
                    message: "Financial E2E safety gates do not permit scenario dispatch.",
                };
            }

            const operation = scenarioOperations[scenario];
            if (typeof operation !== "function") {
                return {
                    status: ORCHESTRATION_STATUS.REJECTED,
                    code: "SCENARIO_NOT_REGISTERED",
                    message: `No operation is registered for scenario: ${scenario}.`,
                };
            }

            try {
                const result = await operation({ context, input });
                return { status: ORCHESTRATION_STATUS.DISPATCHED, scenario, result };
            } catch {
                return {
                    status: ORCHESTRATION_STATUS.BLOCKED,
                    code: "SCENARIO_FAILED",
                    message: "Financial scenario operation failed; no success assertion was recorded.",
                };
            }
        },
    });
}
