import assert from "node:assert/strict";
import test from "node:test";
import {
    evaluateDisposableInitialization,
    REQUIRED_MARKER,
    REQUIRED_INITIALIZATION_SEQUENCE,
    validateConnectedInitializationSequence,
} from "../scripts/financial-e2e-initialization-contract.mjs";
import { targetBinding } from "../scripts/financial-e2e-safety.mjs";

const now = 10_000;
const target = {
    testUrl: "postgresql://tester@localhost:55432/pharmnos_test?application_name=pharmnos-financial-e2e",
    ordinaryUrl: "postgresql://tester@localhost:5432/pharmnos",
    testDatabaseName: "pharmnos_test",
    marker: REQUIRED_MARKER,
    resolveHost: async () => ["127.0.0.1"],
};
const runId = "run-i-001";
const attemptId = "init-i-001";
const binding = targetBinding(target.testUrl);
const roles = { bootstrap: "pharmnos_e2e", runtime: "pharmnos_e2e_runtime" };

test("requires the approved connected initialization sequence", () => {
    assert.deepEqual(validateConnectedInitializationSequence(REQUIRED_INITIALIZATION_SEQUENCE), {
        ok: true,
        errors: [],
    });
    assert.equal(validateConnectedInitializationSequence([
        ...REQUIRED_INITIALIZATION_SEQUENCE.slice(0, 3),
        "execute_sql",
    ]).ok, false);
});

function input(overrides = {}) {
    return {
        authorization: {
            approved: true,
            runId,
            initializationAttemptId: attemptId,
            targetBinding: binding,
            authorizedAt: now,
        },
        target,
        runId,
        initializationAttemptId: attemptId,
        bootstrapRole: roles.bootstrap,
        runtimeRole: roles.runtime,
        bootstrapEvidence: {
            runId,
            initializationAttemptId: attemptId,
            targetBinding: binding,
            verifiedAt: now,
        },
        markerEvidence: {
            runId,
            initializationAttemptId: attemptId,
            targetBinding: binding,
            verifiedAt: now,
            source: "connected_catalog",
            independentlyEstablished: true,
            marker: REQUIRED_MARKER,
            databaseName: "pharmnos_test",
        },
        roleEvidence: {
            runId,
            initializationAttemptId: attemptId,
            targetBinding: binding,
            verifiedAt: now,
            bootstrapRole: roles.bootstrap,
            runtimeRole: roles.runtime,
            bootstrap: { rolcanlogin: true },
            runtime: { rolcanlogin: true, rolsuper: false, rolbypassrls: false },
        },
        catalogEvidence: {
            runId,
            initializationAttemptId: attemptId,
            targetBinding: binding,
            verifiedAt: now,
            schemaRestrictionsVerified: true,
            leastPrivilegeVerified: true,
            defaultPrivilegesVerified: true,
            rlsVerified: true,
            triggerOwnershipVerified: true,
            unexpectedPrivileges: false,
            contradictory: false,
            publicSchemaPopulated: false,
        },
        identityEvidence: {
            version: 1,
            runId,
            targetBinding: binding,
            verifiedAt: now,
            databaseName: "pharmnos_test",
            currentUser: roles.runtime,
            sessionUser: roles.runtime,
            serverAddress: "127.0.0.1",
            serverPort: 55432,
            applicationName: REQUIRED_MARKER,
            environmentMarker: REQUIRED_MARKER,
            rolsuper: false,
            rolbypassrls: false,
        },
        now,
        ...overrides,
    };
}

test("blocks missing or false authorization", async () => {
    for (const authorization of [undefined, { ...input().authorization, approved: false }]) {
        const result = await evaluateDisposableInitialization(input({ authorization }));
        assert.equal(result.ok, false);
        assert.match(result.errors.join(" "), /authorization/i);
    }
});

test("rejects wrong target, run, and attempt bindings", async () => {
    const result = await evaluateDisposableInitialization(input({
        runId: "run-i-002",
        identityEvidence: input().identityEvidence,
    }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /run|attempt|authorization/i);
});

test("requires independent marker evidence", async () => {
    const result = await evaluateDisposableInitialization(input({
        markerEvidence: undefined,
    }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /marker evidence is required/i);
});

test("rejects configuration-only marker evidence", async () => {
    const result = await evaluateDisposableInitialization(input({
        markerEvidence: { ...input().markerEvidence, source: "environment", independentlyEstablished: false },
    }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /not independent/i);
});

test("rejects bootstrap/runtime identity collision", async () => {
    const result = await evaluateDisposableInitialization(input({
        runtimeRole: roles.bootstrap,
        roleEvidence: { ...input().roleEvidence, runtimeRole: roles.bootstrap },
    }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /distinct/i);
});

test("rejects superuser or BYPASSRLS runtime evidence", async () => {
    for (const key of ["rolsuper", "rolbypassrls"]) {
        const runtime = { ...input().roleEvidence.runtime, [key]: true };
        const result = await evaluateDisposableInitialization(input({
            roleEvidence: { ...input().roleEvidence, runtime },
        }));
        assert.equal(result.ok, false);
        assert.match(result.errors.join(" "), /LOGIN, NOSUPERUSER, and NOBYPASSRLS/i);
    }
});

test("requires schema, grants, RLS, and trigger ownership evidence", async () => {
    for (const key of ["schemaRestrictionsVerified", "leastPrivilegeVerified", "rlsVerified", "triggerOwnershipVerified"]) {
        const result = await evaluateDisposableInitialization(input({
            catalogEvidence: { ...input().catalogEvidence, [key]: false },
        }));
        assert.equal(result.ok, false);
        assert.match(result.errors.join(" "), /verification is required/i);
    }
});

test("rejects stale or cross-run evidence", async () => {
    const stale = await evaluateDisposableInitialization(input({
        now: now + 300_001,
    }));
    assert.equal(stale.ok, false);
    assert.match(stale.errors.join(" "), /stale|future/i);

    const crossRun = await evaluateDisposableInitialization(input({
        markerEvidence: { ...input().markerEvidence, runId: "run-i-999" },
    }));
    assert.equal(crossRun.ok, false);
    assert.match(crossRun.errors.join(" "), /not bound/i);
});

test("rejects contradictory catalog results", async () => {
    const result = await evaluateDisposableInitialization(input({
        catalogEvidence: { ...input().catalogEvidence, contradictory: true },
    }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /unsafe or contradictory/i);
});

test("returns a successful synthetic offline evaluation", async () => {
    const result = await evaluateDisposableInitialization(input());
    assert.deepEqual(result, {
        ok: true,
        ready: true,
        evidenceClass: "SYNTHETIC_OFFLINE",
        runId,
        initializationAttemptId: attemptId,
        targetBound: true,
        connectedVerificationModeled: true,
        databaseAccessed: false,
        scenarioRunnerEnabled: false,
        errors: [],
    });
});

test("sanitizes failures and never returns credentials or full URLs", async () => {
    const result = await evaluateDisposableInitialization(input({
        authorization: { ...input().authorization, approved: false, secret: "do-not-return" },
    }));
    const serialized = JSON.stringify(result);
    assert.equal(result.ok, false);
    assert.doesNotMatch(serialized, /do-not-return|postgresql:\/\/|password|token/i);
});

test("does not create a database client or activate scenarios", async () => {
    const result = await evaluateDisposableInitialization(input());
    assert.equal(result.databaseAccessed, false);
    assert.equal(result.scenarioRunnerEnabled, false);
});
