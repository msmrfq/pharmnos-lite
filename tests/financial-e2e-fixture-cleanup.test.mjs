import assert from "node:assert/strict";
import test from "node:test";
import {
    assertRowDeletionSafe,
    cleanupRunOwnedFixtures,
    createFixtureManifest,
    recordFixtureIdentifiers,
} from "../scripts/financial-e2e-fixture-lifecycle.mjs";
import { createTargetContract, migrationInventoryHash, schemaArtifactHash, targetContractBinding } from "../scripts/financial-e2e-target-contract.mjs";

const targetUrl = "postgresql://pharmnos_e2e@127.0.0.1:55435/pharmnos_financial_e2e_0419";
const runtimeUrl = "postgresql://pharmnos_e2e_runtime@127.0.0.1:55435/pharmnos_financial_e2e_0419";
const ordinaryUrl = "postgresql://postgres@127.0.0.1:5432/pharmnos";
const runId = "sales_gst_cleanup_test";
const contract = createTargetContract({
    runId,
    targetUrl,
    runtimeUrl,
    databaseName: "pharmnos_financial_e2e_0419",
    composeProject: "pharmnoslite-financial-e2e-0419",
    schemaArtifactHash: schemaArtifactHash(),
    schemaMode: "PRISMA_MIGRATIONS_REPLAYED",
    migrationInventoryHash: migrationInventoryHash(),
    expiresAt: Date.now() + 60_000,
});
const identityEvidence = {
    version: 1,
    runId,
    targetBinding: targetContractBinding(contract),
    verifiedAt: Date.now(),
    databaseName: contract.databaseName,
    currentUser: contract.runtimeRole,
    sessionUser: contract.runtimeRole,
    environmentMarker: contract.marker,
    applicationName: contract.marker,
    rolsuper: false,
    rolbypassrls: false,
    serverAddress: "127.0.0.1",
    serverPort: contract.port,
};

function ready(resources = [{ resourceType: "tenants", id: "tenant-owned", runId }]) {
    return recordFixtureIdentifiers(createFixtureManifest(runId), resources);
}

async function cleanup(options = {}) {
    return cleanupRunOwnedFixtures({
        manifest: ready(options.resources),
        identityEvidence: options.identityEvidence ?? identityEvidence,
        targetUrl,
        runtimeUrl,
        ordinaryUrl,
        databaseName: contract.databaseName,
        databaseRole: contract.runtimeRole,
        runId,
        cleanupAuthorized: true,
        targetContract: options.targetContract ?? contract,
        executePlan: options.executePlan ?? (async () => ({ success: true })),
        verifyCompletion: options.verifyCompletion ?? (async () => {}),
    });
}

test("performs successful run-scoped cleanup and verifies completion", async () => {
    let executed;
    const result = await cleanup({
        executePlan: async (plan) => {
            executed = plan;
            return { success: true };
        },
    });
    assert.equal(result.status, "CLEANUP_COMPLETE");
    assert.equal(executed.runId, runId);
    assert.deepEqual(executed.resources.map((item) => item.id), ["tenant-owned"]);
});

test("preserves pre-existing records by executing only the authorized resource set", async () => {
    let executed;
    await cleanup({
        resources: [
            { resourceType: "tenants", id: "tenant-owned", runId },
            { resourceType: "users", id: "user-owned", runId },
        ],
        executePlan: async (plan) => {
            executed = plan.resources;
            return { success: true };
        },
    });
    assert.deepEqual(executed.map((item) => item.id), ["user-owned", "tenant-owned"]);
});

test("rejects target-contract mismatch", async () => {
    await assert.rejects(
        cleanup({ targetContract: { ...contract, databaseName: "pharmnos_financial_e2e_other" } }),
        /target contract|does not match/i,
    );
});

test("rejects a contract with altered authorization times at fixture cleanup", async () => {
    await assert.rejects(
        cleanup({ targetContract: { ...contract, expiresAt: contract.expiresAt + 1000 } }),
        /not bound to the approved test target/i,
    );
});

test("rejects missing run identity", async () => {
    await assert.rejects(
        cleanup({ identityEvidence: { ...identityEvidence, runId: "other_run" } }),
        /bound to this test run|run ID/i,
    );
});

test("rejects fixtures not owned by the current run", async () => {
    assert.throws(
        () => ready([{ resourceType: "tenants", id: "foreign", runId: "other_run" }]),
        /matching run ID/,
    );
});

test("propagates cleanup failure", async () => {
    await assert.rejects(
        cleanup({ executePlan: async () => { throw new Error("delete failed"); } }),
        /delete failed/,
    );
});

test("rejects post-cleanup verification failure", async () => {
    await assert.rejects(
        cleanup({ verifyCompletion: async () => { throw new Error("records remain"); } }),
        /records remain/,
    );
});

test("rejects row-level deletion of immutable financial history", async () => {
    await assert.rejects(
        cleanup({ resources: [{ resourceType: "purchase_gst_accounting_decisions", id: "immutable-decision", runId }] }),
        /prohibited for immutable financial history/,
    );
});

test("allows row-level deletion of mutable fixtures only", () => {
    assert.doesNotThrow(() => assertRowDeletionSafe([
        { resourceType: "tenants", id: "tenant-owned", runId },
        { resourceType: "users", id: "user-owned", runId },
    ]));
});
