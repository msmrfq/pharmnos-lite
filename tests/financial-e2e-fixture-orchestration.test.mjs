import assert from "node:assert/strict";
import test from "node:test";
import { orchestrateRunOwnedFixtures } from "../scripts/financial-e2e-fixture-orchestration.mjs";

const specification = {
    requiredResources: [
        { resourceType: "tenants", count: 1 },
        { resourceType: "users", count: 1 },
    ],
};

const identifiers = [
    { resourceType: "tenants", id: "tenant-run-g", runId: "run-g-001" },
    { resourceType: "users", id: "user-run-g", runId: "run-g-001" },
];

test("creates a ready run-owned manifest through an injected provider", async () => {
    let received;
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-001",
        specification,
        provider: async (request) => {
            received = request;
            return { identifiers };
        },
    });
    assert.equal(result.ok, true);
    assert.equal(result.manifest.status, "FIXTURE_READY");
    assert.deepEqual(received, { runId: "run-g-001", specification: specification.requiredResources });
});

test("rejects invalid run IDs and fixture specifications before provider use", async () => {
    let called = false;
    const provider = async () => {
        called = true;
        return { identifiers };
    };
    await assert.rejects(
        orchestrateRunOwnedFixtures({ runId: "Bad", specification, provider }),
        /run ID/,
    );
    await assert.rejects(
        orchestrateRunOwnedFixtures({ runId: "run-g-002", specification: {}, provider }),
        /at least one resource/,
    );
    assert.equal(called, false);
});

test("requires an injected provider", async () => {
    await assert.rejects(
        orchestrateRunOwnedFixtures({ runId: "run-g-003", specification }),
        /injected fixture provider/,
    );
});

test("records provider failure before creation as FIXTURE_FAILED", async () => {
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-004",
        specification,
        provider: async () => {
            throw new Error("provider unavailable");
        },
    });
    assert.equal(result.ok, false);
    assert.equal(result.manifest.status, "FIXTURE_FAILED");
    assert.equal(result.manifest.resources.length, 0);
    assert.equal(result.error, "provider unavailable");
});

test("records confirmed partial provider failure as cleanup-ready failure", async () => {
    const error = new Error("user creation failed");
    error.confirmedIdentifiers = [{
        resourceType: "tenants",
        id: "tenant-run-g",
        runId: "run-g-005",
    }];
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-005",
        specification,
        provider: async () => {
            throw error;
        },
    });
    assert.equal(result.ok, false);
    assert.equal(result.manifest.status, "FIXTURE_FAILED_CLEANUP_READY");
    assert.deepEqual(result.manifest.resources, [error.confirmedIdentifiers[0]]);
});

test("rejects missing required resources without reporting success", async () => {
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-006",
        specification,
        provider: async () => ({
            identifiers: [identifiers[0]],
        }),
    });
    assert.equal(result.ok, false);
    assert.notEqual(result.manifest.status, "FIXTURE_READY");
    assert.equal(result.manifest.status, "FIXTURE_FAILED");
});

test("rejects duplicate identifiers without reporting success", async () => {
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-007",
        specification: { requiredResources: [{ resourceType: "tenants", count: 2 }] },
        provider: async () => ({
            identifiers: [
                identifiers[0],
                identifiers[0],
            ],
        }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.manifest.status, "FIXTURE_FAILED");
});

test("rejects foreign-owned identifiers without reporting success", async () => {
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-008",
        specification: { requiredResources: [{ resourceType: "tenants", count: 1 }] },
        provider: async () => ({
            identifiers: [{ ...identifiers[0], runId: "other-run" }],
        }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.manifest.status, "FIXTURE_FAILED");
});

test("rejects malformed and unapproved resources without reporting success", async () => {
    const malformed = await orchestrateRunOwnedFixtures({
        runId: "run-g-009",
        specification,
        provider: async () => ({
            identifiers: [{ resourceType: "tenants", runId: "run-g-009" }],
        }),
    });
    assert.equal(malformed.ok, false);
    assert.equal(malformed.manifest.status, "FIXTURE_FAILED");

    const unapproved = await orchestrateRunOwnedFixtures({
        runId: "run-g-010",
        specification,
        provider: async () => ({
            identifiers: [
                { resourceType: "tenants", id: "tenant-run-g", runId: "run-g-010" },
                { resourceType: "users", id: "user-run-g", runId: "run-g-010" },
                { resourceType: "products", id: "product-run-g", runId: "run-g-010" },
            ],
        }),
    });
    assert.equal(unapproved.ok, false);
    assert.equal(unapproved.manifest.status, "FIXTURE_FAILED");
});

test("does not call cleanup or access a database", async () => {
    let received;
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-011",
        specification,
        provider: async (request) => {
            received = request;
            return {
                identifiers: identifiers.map((identifier) => ({
                    ...identifier,
                    runId: request.runId,
                })),
            };
        },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(received, {
        runId: "run-g-011",
        specification: specification.requiredResources,
    });
    assert.equal(result.manifest.cleanupAuthorization, null);
    assert.equal(result.manifest.cleanupCompletion, null);
});

test("does not produce a success-shaped result after manifest recording failure", async () => {
    const result = await orchestrateRunOwnedFixtures({
        runId: "run-g-012",
        specification,
        provider: async () => ({
            identifiers: [
                { resourceType: "tenants", id: "tenant-run-g", runId: "other-run" },
                { resourceType: "users", id: "user-run-g", runId: "run-g-012" },
            ],
        }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.manifest.status, "FIXTURE_FAILED");
    assert.equal("success" in result, false);
});
