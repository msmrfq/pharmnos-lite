import assert from "node:assert/strict";
import test from "node:test";
import {
    createFinancialE2eAuthContextAdapter,
} from "../scripts/financial-e2e-auth-context.mjs";
import {
    createFinancialE2eOrchestrator,
    ORCHESTRATION_STATUS,
} from "../scripts/financial-e2e-orchestration.mjs";

const session = { user: { id: "supabase-user-id" } };
const user = {
    id: "application-user-id",
    external_id: "supabase-user-id",
    memberships: [{
        status: "active",
        tenant_id: "tenant-from-membership",
        role: {
            name: "Billing",
            permissions: [{ permission: "finalize_invoice" }],
        },
    }],
};

function makeAdapter(overrides = {}) {
    return createFinancialE2eAuthContextAdapter({
        getCurrentSession: async () => session,
        findUserByExternalId: async (externalId) => externalId === session.user.id ? user : null,
        ...overrides,
    });
}

test("rejects a missing authentication session", async () => {
    const adapter = makeAdapter({ getCurrentSession: async () => null });
    await assert.rejects(
        adapter.getAuthenticatedContext(),
        (error) => error.code === "AUTHENTICATION_REQUIRED",
    );
});

test("rejects an application-user mapping miss", async () => {
    const adapter = makeAdapter({ findUserByExternalId: async () => null });
    await assert.rejects(
        adapter.getAuthenticatedContext(),
        (error) => error.code === "APPLICATION_USER_NOT_FOUND",
    );
});

test("rejects missing or inactive tenant membership", async () => {
    const adapter = makeAdapter({
        findUserByExternalId: async () => ({
            ...user,
            memberships: [{ ...user.memberships[0], status: "disabled" }],
        }),
    });
    await assert.rejects(
        adapter.getAuthenticatedContext(),
        (error) => error.code === "ACTIVE_MEMBERSHIP_REQUIRED",
    );
});

test("builds context from the authenticated membership and permissions", async () => {
    const adapter = makeAdapter();
    const context = await adapter.getAuthenticatedContext();
    assert.deepEqual(context, {
        tenantId: "tenant-from-membership",
        userId: "application-user-id",
        roles: ["Billing"],
        permissions: ["finalize_invoice"],
    });
});

test("rejects a caller-supplied tenant ID as an authority source", async () => {
    const adapter = makeAdapter();
    await assert.rejects(
        adapter.getAuthenticatedContext({ requestedTenantId: "caller-tenant" }),
        (error) => error.code === "TENANT_OVERRIDE_REJECTED",
    );
});

test("does not expose session or credential details in adapter errors", async () => {
    const adapter = makeAdapter({
        getCurrentSession: async () => {
            throw new Error("session token secret");
        },
    });
    await assert.rejects(
        adapter.getAuthenticatedContext(),
        (error) => error.message === "Authenticated session could not be established." &&
            !error.message.includes("secret"),
    );
});

test("propagates the authenticated context through the dispatcher", async () => {
    const adapter = makeAdapter();
    let invoked = false;
    const orchestrator = createFinancialE2eOrchestrator({
        getAuthenticatedContext: adapter.getAuthenticatedContext,
        requirePermission: (context, permission) => {
            if (!context.permissions.includes(permission)) throw new Error("denied");
        },
        canStartScenario: async () => true,
        scenarioOperations: {
            "sales-finalization": async ({ context }) => {
                invoked = true;
                return { tenantId: context.tenantId, userId: context.userId };
            },
        },
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: { executionAuthorized: true, scenarioRunnerEnabled: false },
    });
    assert.equal(result.status, ORCHESTRATION_STATUS.DISPATCHED);
    assert.deepEqual(result.result, {
        tenantId: "tenant-from-membership",
        userId: "application-user-id",
    });
    assert.equal(invoked, true);
});

test("blocks dispatch when the readiness gate rejects", async () => {
    const adapter = makeAdapter();
    let invoked = false;
    const orchestrator = createFinancialE2eOrchestrator({
        getAuthenticatedContext: adapter.getAuthenticatedContext,
        requirePermission: () => {},
        canStartScenario: async () => false,
        scenarioOperations: {
            "sales-finalization": async () => {
                invoked = true;
            },
        },
    });
    const result = await orchestrator.dispatch({
        scenario: "sales-finalization",
        requiredPermission: "finalize_invoice",
        gate: { executionAuthorized: false, scenarioRunnerEnabled: true },
    });
    assert.equal(result.code, "SAFETY_GATE_BLOCKED");
    assert.equal(invoked, false);
});
