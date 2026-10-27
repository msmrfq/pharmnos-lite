import assert from "node:assert/strict";
import test from "node:test";
import {
    createApplicationHostedFinancialE2eBoundary,
} from "../scripts/financial-e2e-app-hosted-boundary.mjs";
import { ORCHESTRATION_STATUS } from "../scripts/financial-e2e-orchestration.mjs";

const context = {
    tenantId: "request-tenant",
    userId: "request-user",
    roles: ["Billing"],
    permissions: ["finalize_invoice"],
};

function makeBoundary(overrides = {}) {
    return createApplicationHostedFinancialE2eBoundary({
        resolveTenantContext: async () => context,
        requirePermission: (resolvedContext, permission) => {
            if (!resolvedContext.permissions.includes(permission)) throw new Error("denied");
        },
        canStartScenario: async () => false,
        scenarioOperations: {
            "sales-finalization": async () => {
                throw new Error("must not execute while blocked");
            },
        },
        ...overrides,
    });
}

test("requires an application-hosted resolver", () => {
    assert.throws(
        () => createApplicationHostedFinancialE2eBoundary({
            requirePermission: () => {},
            canStartScenario: async () => false,
        }),
        /requires resolveTenantContext/,
    );
});

test("delegates context resolution to the request-scoped application path", async () => {
    let calls = 0;
    const boundary = makeBoundary({
        resolveTenantContext: async () => {
            calls += 1;
            return context;
        },
    });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "SAFETY_GATE_BLOCKED");
    assert.equal(calls, 1);
});

test("does not accept a caller-supplied tenant override", async () => {
    const boundary = makeBoundary();
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        requestedTenantId: "attacker-tenant",
        gate: {},
    });
    assert.equal(result.status, ORCHESTRATION_STATUS.BLOCKED);
    assert.equal(result.code, "TENANT_OVERRIDE_REJECTED");
});

test("rejects an unauthenticated or missing request context", async () => {
    const boundary = makeBoundary({ resolveTenantContext: async () => null });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "INVALID_TENANT_CONTEXT");
});

test("rejects incomplete or fabricated context", async () => {
    const boundary = makeBoundary({
        resolveTenantContext: async () => ({
            tenantId: "caller-tenant",
            userId: "caller-user",
            permissions: ["finalize_invoice"],
        }),
    });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "INVALID_TENANT_CONTEXT");
});

test("propagates authorization failure without invoking financial work", async () => {
    let invoked = false;
    const boundary = makeBoundary({
        requirePermission: () => {
            throw new Error("not authorized");
        },
        scenarioOperations: {
            "sales-finalization": async () => {
                invoked = true;
            },
        },
    });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "PERMISSION_DENIED");
    assert.equal(invoked, false);
});

test("keeps the financial safety gate mandatory", async () => {
    let invoked = false;
    const boundary = makeBoundary({
        scenarioOperations: {
            "sales-finalization": async () => {
                invoked = true;
            },
        },
    });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: { executionAuthorized: true, scenarioRunnerEnabled: false },
    });
    assert.equal(result.code, "SAFETY_GATE_BLOCKED");
    assert.equal(invoked, false);
});

test("sanitizes resolver failures", async () => {
    const boundary = makeBoundary({
        resolveTenantContext: async () => {
            throw new Error("cookie=session-secret");
        },
    });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: {},
    });
    assert.equal(result.code, "AUTHENTICATION_FAILED");
    assert.equal(result.message.includes("session-secret"), false);
});

test("does not provide a production authorization bypass", async () => {
    let resolved = false;
    const boundary = makeBoundary({
        resolveTenantContext: async () => {
            resolved = true;
            return context;
        },
    });
    const result = await boundary.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "ungranted-permission",
        gate: { executionAuthorized: true },
    });
    assert.equal(result.code, "PERMISSION_DENIED");
    assert.equal(resolved, true);
});
