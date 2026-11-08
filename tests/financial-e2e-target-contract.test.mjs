import assert from "node:assert/strict";
import test from "node:test";
import {
    createTargetContract,
    governanceArtifactHash,
    loadTargetContractFromEnv,
    migrationInventoryHash,
    schemaArtifactHash,
    targetContractBinding,
    validateTargetContract,
} from "../scripts/financial-e2e-target-contract.mjs";

const now = Date.now();
const targetUrl = "postgresql://pharmnos_e2e:bootstrap-secret@127.0.0.1:55435/pharmnos_financial_e2e_0419?application_name=pharmnos-financial-e2e";
const runtimeUrl = "postgresql://pharmnos_e2e_runtime:runtime-secret@127.0.0.1:55435/pharmnos_financial_e2e_0419?application_name=pharmnos-financial-e2e";
const ordinaryUrl = "postgresql://app:ordinary-secret@127.0.0.1:5432/pharmnos";

function contract() {
    return createTargetContract({
        runId: "run_0419",
        targetUrl,
        runtimeUrl,
        databaseName: "pharmnos_financial_e2e_0419",
        composeProject: "pharmnoslite-financial-e2e-0419",
        schemaArtifactHash: schemaArtifactHash(),
        schemaMode: "PRISMA_MIGRATIONS_REPLAYED",
        migrationInventoryHash: migrationInventoryHash(),
        authorizedAt: now - 1000,
        expiresAt: now + 60_000,
    });
}

test("accepts one authorized target for bootstrap and runtime", () => {
    const value = contract();
    const result = validateTargetContract({
        contract: value,
        targetUrl,
        runtimeUrl,
        ordinaryUrl,
        now,
    });
    assert.deepEqual(result, { ok: true, errors: [] });
    assert.equal(targetContractBinding(value), targetContractBinding(Object.freeze({ ...value })));
});

test("creates an explicitly bound empty-baseline contract and rejects contradictory or stale inputs", () => {
    const options = {
        runId: "run_0419",
        targetUrl,
        runtimeUrl,
        databaseName: "pharmnos_financial_e2e_0419",
        composeProject: "pharmnoslite-financial-e2e-0419",
        schemaMode: "EMPTY_BASELINE",
        schemaArtifactHash: schemaArtifactHash(),
        governanceArtifactHash: governanceArtifactHash(),
        authorizedAt: now - 1000,
        expiresAt: now + 60_000,
    };
    const value = createTargetContract(options);
    assert.equal(value.schemaMode, "EMPTY_BASELINE");
    assert.equal(Object.hasOwn(value, "migrationInventoryHash"), false);
    assert.equal(Object.isFrozen(value), true);
    for (const patch of [
        { schemaMode: undefined },
        { schemaMode: "UNKNOWN" },
        { schemaArtifactHash: undefined },
        { schemaArtifactHash: "0".repeat(64) },
        { governanceArtifactHash: undefined },
        { governanceArtifactHash: "0".repeat(64) },
        { migrationInventoryHash: migrationInventoryHash() },
    ]) assert.throws(() => createTargetContract({ ...options, ...patch }));
    assert.throws(() => createTargetContract({
        ...options,
        schemaMode: "PRISMA_MIGRATIONS_REPLAYED",
        governanceArtifactHash: undefined,
    }), /migration inventory fingerprint/);
});

test("rejects a mismatched port before execution", () => {
    const result = validateTargetContract({
        contract: contract(),
        targetUrl: targetUrl.replace("55435", "55434"),
        runtimeUrl,
        ordinaryUrl,
        now,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /does not match the authorized target contract/);
});

test("rejects unsuffixed shared database and Compose identities", () => {
    const value = { ...contract(), databaseName: "pharmnos_financial_e2e", composeProject: "pharmnoslite" };
    const result = validateTargetContract({ contract: value, targetUrl, runtimeUrl, ordinaryUrl, now });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /database name is not disposable/);
    assert.match(result.errors.join(" "), /Compose project is invalid/);
});

test("rejects a mismatched database name before execution", () => {
    const result = validateTargetContract({
        contract: contract(),
        targetUrl: targetUrl.replace("pharmnos_financial_e2e_0419", "pharmnos_financial_e2e_0418"),
        runtimeUrl,
        ordinaryUrl,
        now,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /does not match the authorized target contract/);
});

test("rejects mismatched target identity and runtime credentials", () => {
    const value = contract();
    const result = validateTargetContract({
        contract: value,
        targetUrl: targetUrl.replace("pharmnos_e2e:", "other_role:"),
        runtimeUrl: runtimeUrl.replace("pharmnos_e2e_runtime:", "pharmnos_e2e:"),
        ordinaryUrl,
        now,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /unauthorized bootstrap role|unauthorized role/);
});

test("rejects a contract with inconsistent credential sources", () => {
    const value = { ...contract(), runtimeCredentialSource: "OTHER_RUNTIME_SECRET" };
    const result = validateTargetContract({
        contract: value,
        targetUrl,
        runtimeUrl,
        ordinaryUrl,
        now,
    });

    test("rejects a contract with an inconsistent context secret source", () => {
        const value = { ...contract(), contextSecretSource: "OTHER_CONTEXT_SECRET" };
        const result = validateTargetContract({
            contract: value,
            targetUrl,
            runtimeUrl,
            ordinaryUrl,
            now,
        });
        assert.equal(result.ok, false);
        assert.match(result.errors.join(" "), /credential sources/);
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /credential sources/);
});

test("rejects stale and unauthorized compose target metadata", () => {
    const value = {
        ...contract(),
        composeProject: "unrelated-compose-project",
        expiresAt: now - 1,
    };
    const result = validateTargetContract({
        contract: value,
        targetUrl,
        runtimeUrl,
        ordinaryUrl,
        now,
    });

    test("rejects missing target metadata before any connection attempt", () => {
        assert.throws(
            () => loadTargetContractFromEnv({
                TEST_DATABASE_URL: targetUrl,
                FINANCIAL_E2E_RUNTIME_DATABASE_URL: runtimeUrl,
            }),
            /FINANCIAL_E2E_TARGET_CONTRACT is required/,
        );
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /Compose project|stale/);
});
