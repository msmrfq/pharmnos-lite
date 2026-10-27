import assert from "node:assert/strict";
import test from "node:test";
import {
    classifyProvisioningFailure,
    createSanitizedProvisioningEvidence,
    sanitizeProvisioningDiagnostic,
    validateConnectedInitializationRequest,
    validateInitializationAuthorization,
} from "../scripts/financial-e2e-provision-local.mjs";

const testUrl = "postgresql://pharmnos_e2e@127.0.0.1:55432/pharmnos_financial_e2e?application_name=pharmnos-financial-e2e";
const binding = "postgresql:|127.0.0.1|55432|/pharmnos_financial_e2e|pharmnos_e2e";

function validAuthorization(overrides = {}) {
    return {
        approved: true,
        runId: "financial-e2e-m-001",
        initializationAttemptId: "init-m-001",
        testUrl,
        authorizedTargetBinding: binding,
        ...overrides,
    };
}

test("rejects initialization without explicit authorization", () => {
    const result = validateInitializationAuthorization(validAuthorization({ approved: false }));
    assert.equal(result.ok, false);
    assert.match(result.error, /explicit disposable-target initialization authorization/i);
});

test("rejects missing or malformed run and attempt identifiers", () => {
    for (const overrides of [
        { runId: "" },
        { runId: "Run M 001" },
        { initializationAttemptId: "" },
        { initializationAttemptId: "attempt with spaces" },
    ]) {
        const result = validateInitializationAuthorization(validAuthorization(overrides));
        assert.equal(result.ok, false);
        assert.match(result.error, /valid (financial E2E run ID|initialization attempt ID)/i);
    }
});

test("rejects authorization for a different target binding", () => {
    const result = validateInitializationAuthorization(
        validAuthorization({ authorizedTargetBinding: "postgresql|127.0.0.1|55432|/other|pharmnos_e2e" }),
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /exact disposable target/i);
});

test("accepts only a valid target-bound authorization record", () => {
    const result = validateInitializationAuthorization(validAuthorization());
    assert.deepEqual(result, {
        ok: true,
        runId: "financial-e2e-m-001",
        initializationAttemptId: "init-m-001",
        targetBinding: binding,
    });
});

test("rejects connected initialization preparation without owner-defined prerequisites", () => {
    const result = validateConnectedInitializationRequest({
        authorization: validateInitializationAuthorization(validAuthorization()),
        target: { testUrl, testDatabaseName: "pharmnos_financial_e2e" },
        bootstrapRole: "pharmnos_e2e",
        runtimeRole: "pharmnos_e2e_runtime",
        marker: "pharmnos-financial-e2e",
        initializationScope: "DATABASE_INITIALIZATION_ONLY",
        targetApproved: true,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
        "The approved bootstrap marker-establishment method is required.",
        "The approved pre-created local role procedure is required.",
        "The version-pinned review artifact package is required.",
        "The approved sanitized append-only local evidence policy is required.",
        "The approved uncertain-outcome recovery policy is required.",
        "Runtime role attributes must be LOGIN, NOSUPERUSER, and NOBYPASSRLS.",
    ]);
});

test("accepts only a complete connected initialization request shape", () => {
    const result = validateConnectedInitializationRequest({
        authorization: validateInitializationAuthorization(validAuthorization()),
        target: { testUrl, testDatabaseName: "pharmnos_financial_e2e" },
        bootstrapRole: "pharmnos_e2e",
        runtimeRole: "pharmnos_e2e_runtime",
        marker: "pharmnos-financial-e2e",
        initializationScope: "DATABASE_INITIALIZATION_ONLY",
        targetApproved: true,
        markerEstablishmentMethod: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
        roleSetupMethod: "PRECREATED_LOCAL_CREDENTIAL_PROCEDURE",
        baselinePackage: "VERSION_PINNED_REVIEW_ARTIFACTS",
        evidencePolicy: {
            mode: "SANITIZED_APPEND_ONLY_LOCAL",
            retentionDays: 30,
            localPathApproved: true,
        },
        recoveryPolicy: "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET",
        runtimeRoleAttributes: {
            rolcanlogin: true,
            rolsuper: false,
            rolbypassrls: false,
        },
    });
    assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects unsafe runtime role attributes", () => {
    const result = validateConnectedInitializationRequest({
        authorization: validateInitializationAuthorization(validAuthorization()),
        target: { testUrl, testDatabaseName: "pharmnos_financial_e2e" },
        bootstrapRole: "pharmnos_e2e",
        runtimeRole: "pharmnos_e2e_runtime",
        marker: "pharmnos-financial-e2e",
        initializationScope: "DATABASE_INITIALIZATION_ONLY",
        targetApproved: true,
        markerEstablishmentMethod: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
        roleSetupMethod: "PRECREATED_LOCAL_CREDENTIAL_PROCEDURE",
        baselinePackage: "VERSION_PINNED_REVIEW_ARTIFACTS",
        evidencePolicy: {
            mode: "SANITIZED_APPEND_ONLY_LOCAL",
            retentionDays: 30,
            localPathApproved: true,
        },
        recoveryPolicy: "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET",
        runtimeRoleAttributes: {
            rolcanlogin: true,
            rolsuper: true,
            rolbypassrls: false,
        },
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /LOGIN, NOSUPERUSER, and NOBYPASSRLS/);
});

test("classifies failed transactions with a failed rollback as unknown outcome", () => {
    assert.equal(
        classifyProvisioningFailure({
            transactionStarted: true,
            rollbackAttempted: true,
            rollbackSucceeded: false,
        }),
        "UNTRUSTED_UNKNOWN_OUTCOME",
    );
});

test("classifies a confirmed rollback as known rollback", () => {
    assert.equal(
        classifyProvisioningFailure({
            transactionStarted: true,
            rollbackAttempted: true,
            rollbackSucceeded: true,
        }),
        "KNOWN_ROLLBACK",
    );
});

test("sanitizes database URLs and secret-like diagnostics", () => {
    const result = sanitizeProvisioningDiagnostic(
        "failed postgres://user:password@127.0.0.1/db?password=secret token=private",
    );
    assert.doesNotMatch(result, /postgres:\/\//i);
    assert.doesNotMatch(result, /password@|password=secret|token=private/i);
    assert.match(result, /\[REDACTED_DATABASE_URL\]/);
});

test("emits only bound non-secret provisioning evidence", () => {
    const evidence = createSanitizedProvisioningEvidence({
        targetBinding: binding,
        runId: "financial-e2e-m-001",
        initializationAttemptId: "init-m-001",
        outcome: "UNTRUSTED_UNKNOWN_OUTCOME",
        verifiedAt: 123,
    });
    assert.deepEqual(evidence, {
        evidenceVersion: 1,
        targetBinding: binding,
        runId: "financial-e2e-m-001",
        initializationAttemptId: "init-m-001",
        outcome: "UNTRUSTED_UNKNOWN_OUTCOME",
        verifiedAt: 123,
        databaseAccessed: true,
    });
});
