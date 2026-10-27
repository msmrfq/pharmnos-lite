import assert from "node:assert/strict";
import test from "node:test";
import {
    createFinancialE2eOrchestrator,
    ORCHESTRATION_STATUS,
} from "../scripts/financial-e2e-orchestration.mjs";

const context = {
    tenantId: "authenticated-tenant",
    userId: "authenticated-user",
    roles: ["Billing"],
    permissions: ["finalize_invoice"],
};

function makeOrchestrator(overrides = {}) {
    return createFinancialE2eOrchestrator({
        getAuthenticatedContext: async () => context,
        requirePermission: (resolvedContext, permission) => {
            if (!resolvedContext.permissions.includes(permission)) throw new Error("denied");
        },
        canStartScenario: async () => true,
        scenarioOperations: {
            "sales-finalization": async ({ context: resolvedContext, input }) => ({
                tenantId: resolvedContext.tenantId,
                input,
            }),
        },
        ...overrides,
    });
}

test("rejects missing authenticated context", async () => {
    const orchestrator = makeOrchestrator({ getAuthenticatedContext: async () => null });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.deepEqual(result, {
        status: ORCHESTRATION_STATUS.BLOCKED,
        code: "AUTHENTICATION_REQUIRED",
        message: "An authenticated tenant context is required.",
    });
});

test("rejects invalid tenant context", async () => {
    const orchestrator = makeOrchestrator({
        getAuthenticatedContext: async () => ({ tenantId: "caller-supplied-only", userId: "", permissions: [] }),
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "INVALID_TENANT_CONTEXT");
});

test("enforces the existing permission boundary", async () => {
    let called = false;
    const orchestrator = makeOrchestrator({
        requirePermission: () => {
            throw new Error("denied");
        },
        scenarioOperations: {
            "sales-finalization": async () => {
                called = true;
            },
        },
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "PERMISSION_DENIED");
    assert.equal(called, false);
});

test("blocks dispatch when the safety gate is false", async () => {
    let called = false;
    const orchestrator = makeOrchestrator({
        canStartScenario: async () => false,
        scenarioOperations: {
            "sales-finalization": async () => {
                called = true;
            },
        },
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: { scenarioRunnerEnabled: true },
    });
    assert.equal(result.code, "SAFETY_GATE_BLOCKED");
    assert.equal(called, false);
});

test("dispatch requires explicit execution authorization through the gate", async () => {
    let receivedGate;
    const orchestrator = makeOrchestrator({
        canStartScenario: async (gate) => {
            receivedGate = gate;
            return gate.executionAuthorized === true && gate.scenarioRunnerEnabled === false;
        },
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: { executionAuthorized: true, scenarioRunnerEnabled: false },
    });
    assert.equal(result.status, ORCHESTRATION_STATUS.DISPATCHED);
    assert.deepEqual(receivedGate, { executionAuthorized: true, scenarioRunnerEnabled: false });
});

test("does not trust a caller tenant ID over authenticated context", async () => {
    const orchestrator = makeOrchestrator();
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
        input: { tenantId: "untrusted-caller-tenant" },
    });
    assert.equal(result.status, ORCHESTRATION_STATUS.DISPATCHED);
    assert.equal(result.result.tenantId, "authenticated-tenant");
});

test("classifies operation failures without reporting success", async () => {
    const orchestrator = makeOrchestrator({
        scenarioOperations: {
            "sales-finalization": async () => {
                throw new Error("expected operation failure");
            },
        },
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.deepEqual(result, {
        status: ORCHESTRATION_STATUS.BLOCKED,
        code: "SCENARIO_FAILED",
        message: "Financial scenario operation failed; no success assertion was recorded.",
    });
});

test("rejects unregistered scenarios without invoking any operation", async () => {
    const result = await makeOrchestrator().dispatch({
        scenario: "payment",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "SCENARIO_NOT_REGISTERED");
});
