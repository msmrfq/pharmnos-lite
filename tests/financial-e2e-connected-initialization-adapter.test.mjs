import assert from "node:assert/strict";
import test from "node:test";
import {
    createSanitizedEvidence,
    prepareConnectedInitialization,
    runConnectedInitialization,
} from "../scripts/financial-e2e-connected-initialization-adapter.mjs";
import { sha256 } from "../scripts/financial-e2e-artifact-package.mjs";
import { targetBinding } from "../scripts/financial-e2e-safety.mjs";

const now = 10_000;
const target = {
    testUrl: "postgresql://pharmnos_e2e@127.0.0.1:55432/pharmnos_financial_e2e?application_name=pharmnos-financial-e2e",
    ordinaryUrl: "postgresql://app@localhost:5432/pharmnos",
    testDatabaseName: "pharmnos_financial_e2e",
    marker: "pharmnos-financial-e2e",
    resolveHost: async (host) => host === "localhost" ? ["127.0.0.1"] : ["127.0.0.2"],
};
const binding = targetBinding(target.testUrl);

function input(overrides = {}) {
    return {
        authorization: {
            approved: true,
            runId: "run-adapter-1",
            initializationAttemptId: "attempt-adapter-1",
            targetBinding: binding,
            authorizedAt: now,
        },
        target,
        candidateTarget: {
            serviceName: "financial-e2e-postgres",
            profile: "financial-e2e",
            host: "127.0.0.1",
            port: 55432,
            databaseName: "pharmnos_financial_e2e",
            bootstrapRole: "pharmnos_e2e",
            runtimeRole: "pharmnos_e2e_runtime",
            marker: "pharmnos-financial-e2e",
            storage: "tmpfs",
            isolationLabel: "financial-e2e-isolated",
            ordinaryTarget: { host: "127.0.0.1", port: 5432, databaseName: "pharmnos" },
        },
        runId: "run-adapter-1",
        initializationAttemptId: "attempt-adapter-1",
        bootstrapRole: "pharmnos_e2e",
        runtimeRole: "pharmnos_e2e_runtime",
        initializationScope: "DATABASE_INITIALIZATION_ONLY",
        markerEstablishmentMethod: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
        now,
        ...overrides,
    };
}

test("preparation accepts the approved executable artifact package", async () => {
    const result = await prepareConnectedInitialization(input());
    assert.equal(result.ok, true);
    assert.equal(result.state, "PREPARATION_VALIDATED");
});

test("preparation rejects malformed authorization and candidate mismatch", async () => {
    for (const overrides of [
        { authorization: { ...input().authorization, authorizedAt: "not-a-timestamp" } },
        { candidateTarget: { ...input().candidateTarget, port: 5433 } },
        { target: { ...target, testUrl: "postgresql://user@example.com:55432/pharmnos_financial_e2e" } },
    ]) {
        assert.equal((await prepareConnectedInitialization(input(overrides))).ok, false);
    }
});

test("connected operations run in the approved order", async () => {
    const calls = [];
    const operations = Object.fromEntries([
        "establishMarker",
        "readIdentity",
        "verifyCatalog",
        "reconnectRuntime",
        "verifyRls",
    ].map((name) => [name, async () => calls.push(name)]));
    const result = await runConnectedInitialization(input(), operations);
    assert.equal(result.ok, true);
    assert.equal(result.state, "COMPLETED");
    assert.deepEqual(calls, [
        "establishMarker",
        "readIdentity",
        "verifyCatalog",
        "reconnectRuntime",
        "verifyRls",
    ]);
});

test("sanitized evidence contains only bound hashes and no database URL", () => {
    const evidence = createSanitizedEvidence({
        context: { binding, runId: "run-adapter-1", initializationAttemptId: "attempt-adapter-1", now },
        artifactHashes: [sha256("artifact")],
        state: "UNTRUSTED",
        verification: {},
        failureClassification: "postgresql://user:secret@example.invalid/db",
    });
    assert.doesNotMatch(JSON.stringify(evidence), /postgresql:\/\//);
    assert.equal(evidence.targetBinding, binding);
});
