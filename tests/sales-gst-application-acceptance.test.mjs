import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import {
    createTargetContract,
    schemaArtifactHash,
    targetContractBinding,
} from "../scripts/financial-e2e-target-contract.mjs";

const require = createRequire(import.meta.url);
const {
    createInitializationEnvironment,
    runSalesGstAcceptance,
} = require("../scripts/sales-gst-application-acceptance.cjs");

const password = "test-only-bootstrap-secret";
const runtimePassword = "test-only-runtime-secret";

function environment(overrides = {}) {
    return {
        ALLOW_FINANCIAL_E2E: "true",
        TEST_DATABASE_URL: "postgresql://pharmnos_e2e@127.0.0.1:55435/pharmnos_financial_e2e_0419",
        TEST_DATABASE_NAME: "pharmnos_financial_e2e_0419",
        TEST_DATABASE_MARKER: "pharmnos-financial-e2e",
        FINANCIAL_E2E_DB_PORT: "55435",
        FINANCIAL_E2E_DB_USER: "pharmnos_e2e",
        FINANCIAL_E2E_DB_PASSWORD: password,
        FINANCIAL_E2E_RUNTIME_DB_USER: "pharmnos_e2e_runtime",
        FINANCIAL_E2E_RUNTIME_DB_PASSWORD: runtimePassword,
        FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55435/pharmnos_financial_e2e_0419",
        ...overrides,
    };
}

function contractFor(env, composeProject = "pharmnoslite") {
    const contract = createTargetContract({
        runId: "sales_gst_test_run",
        targetUrl: env.TEST_DATABASE_URL,
        runtimeUrl: env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
        databaseName: env.TEST_DATABASE_NAME,
        composeProject,
        schemaArtifactHash: schemaArtifactHash(),
        expiresAt: Date.now() + 60_000,
    });
    return { targetContract: contract, binding: targetContractBinding(contract) };
}

test("forwards exactly one identical serialized contract to provisioning and runner", () => {
    const env = environment();
    const contract = contractFor(env, "pharmnoslite-financial-e2e-0419");
    const serialized = JSON.stringify(contract.targetContract);
    const calls = [];
    const result = runSalesGstAcceptance({
        environment: env,
        createContract: () => contract,
        validateBinding: targetContractBinding,
        serialize: () => serialized,
        runChild: (script, childEnv) => calls.push({ script, contract: childEnv.FINANCIAL_E2E_TARGET_CONTRACT }),
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.script), [
        "scripts/financial-e2e-provision-local.mjs",
        "scripts/gst-application-e2e-runner.mjs",
    ]);
    assert.equal(calls[0].contract, serialized);
    assert.equal(calls[1].contract, serialized);
    assert.equal(result.serializedContract, serialized);
});

test("keeps fresh provisioning as the default mode", () => {
    const env = environment();
    const contract = contractFor(env);
    const calls = [];
    runSalesGstAcceptance({
        environment: env,
        createContract: () => contract,
        validateBinding: targetContractBinding,
        runChild: (script) => calls.push(script),
    });
    assert.deepEqual(calls, [
        "scripts/financial-e2e-provision-local.mjs",
        "scripts/gst-application-e2e-runner.mjs",
    ]);
});

test("pre-provisioned mode skips provisioning and preserves the contract", () => {
    const env = environment({
        FINANCIAL_E2E_TARGET_MODE: "PREPROVISIONED",
        FINANCIAL_E2E_COMPOSE_PROJECT: "pharmnoslite-financial-e2e-0419",
    });
    const contract = contractFor(env, "pharmnoslite-financial-e2e-0419");
    const serialized = JSON.stringify(contract.targetContract);
    const calls = [];
    runSalesGstAcceptance({
        environment: env,
        createContract: () => contract,
        validateBinding: targetContractBinding,
        serialize: () => serialized,
        runChild: (script, childEnv) => calls.push({ script, childEnv }),
    });
    assert.deepEqual(calls.map(({ script }) => script), [
        "scripts/financial-e2e-preprovisioned-verify.mjs",
        "scripts/gst-application-e2e-runner.mjs",
    ]);
    assert.equal(calls[0].childEnv.FINANCIAL_E2E_TARGET_CONTRACT, serialized);
    assert.equal(calls[1].childEnv.FINANCIAL_E2E_TARGET_CONTRACT, serialized);
});

test("pre-provisioned mode rejects a target mismatch before any child", () => {
    const calls = [];
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment({
                FINANCIAL_E2E_TARGET_MODE: "PREPROVISIONED",
                FINANCIAL_E2E_COMPOSE_PROJECT: "pharmnoslite-financial-e2e-0419",
                TEST_DATABASE_NAME: "pharmnos_financial_e2e_other",
                TEST_DATABASE_URL: "postgresql://pharmnos_e2e@127.0.0.1:55436/pharmnos_financial_e2e_other",
                FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55436/pharmnos_financial_e2e_other",
                FINANCIAL_E2E_DB_PORT: "55436",
            }),
            createContract: () => { throw new Error("must not generate"); },
            runChild: (...args) => calls.push(args),
        }),
        /verified target 0419/,
    );
    assert.equal(calls.length, 0);
});

test("pre-provisioned mode rejects marker mismatch before any child", () => {
    const calls = [];
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment({
                FINANCIAL_E2E_TARGET_MODE: "PREPROVISIONED",
                FINANCIAL_E2E_COMPOSE_PROJECT: "pharmnoslite-financial-e2e-0419",
                TEST_DATABASE_MARKER: "wrong-marker",
            }),
            createContract: () => { throw new Error("must not generate"); },
            runChild: (...args) => calls.push(args),
        }),
        /approved disposable target marker/,
    );
    assert.equal(calls.length, 0);
});

test("pre-provisioned mode requires the expected Compose project", () => {
    const calls = [];
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment({
                FINANCIAL_E2E_TARGET_MODE: "PREPROVISIONED",
                FINANCIAL_E2E_COMPOSE_PROJECT: "wrong-project",
            }),
            createContract: () => { throw new Error("must not generate"); },
            runChild: (...args) => calls.push(args),
        }),
        /verified target 0419/,
    );
    assert.equal(calls.length, 0);
});

test("pre-provisioned mode rejects schema drift and privileged application roles", () => {
    const env = environment({
        FINANCIAL_E2E_TARGET_MODE: "PREPROVISIONED",
        FINANCIAL_E2E_COMPOSE_PROJECT: "pharmnoslite-financial-e2e-0419",
    });
    const valid = contractFor(env, "pharmnoslite-financial-e2e-0419");
    for (const invalid of [
        { ...valid.targetContract, schemaArtifactHash: "a".repeat(64) },
        { ...valid.targetContract, runtimeRole: "pharmnos_e2e" },
    ]) {
        assert.throws(
            () => runSalesGstAcceptance({
                environment: env,
                createContract: () => ({ targetContract: invalid, binding: targetContractBinding(invalid) }),
                validateBinding: targetContractBinding,
                runChild: () => { throw new Error("must not run"); },
            }),
            /verified target 0419/,
        );
    }
});

test("forwards explicit cleanup authorization and restricted runtime identity to children", () => {
    const env = environment();
    const contract = contractFor(env);
    const calls = [];
    runSalesGstAcceptance({
        environment: env,
        createContract: () => contract,
        validateBinding: targetContractBinding,
        runChild: (script, childEnv) => calls.push({ script, childEnv }),
    });
    assert.equal(calls.length, 2);
    for (const { childEnv } of calls) {
        assert.equal(childEnv.FINANCIAL_E2E_CLEANUP_AUTHORIZED, "true");
        assert.equal(childEnv.FINANCIAL_E2E_RUNTIME_DB_USER, "pharmnos_e2e_runtime");
        assert.equal(childEnv.FINANCIAL_E2E_TARGET_CONTRACT, calls[0].childEnv.FINANCIAL_E2E_TARGET_CONTRACT);
    }
});

test("fails before provisioning when a credential source is missing", () => {
    const calls = [];
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment({ FINANCIAL_E2E_RUNTIME_DB_PASSWORD: "" }),
            createContract: () => { throw new Error("must not generate"); },
            runChild: (...args) => calls.push(args),
        }),
        /Missing required Sales GST target configuration/,
    );
    assert.equal(calls.length, 0);
});

test("fails before provisioning for the privileged base target", () => {
    const calls = [];
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment({
                TEST_DATABASE_URL: "postgresql://pharmnos_e2e@127.0.0.1:55432/pharmnos_financial_e2e",
                FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55432/pharmnos_financial_e2e",
                TEST_DATABASE_NAME: "pharmnos_financial_e2e",
                FINANCIAL_E2E_DB_PORT: "55432",
            }),
            createContract: () => { throw new Error("must not generate"); },
            runChild: (...args) => calls.push(args),
        }),
        /not port 55432/,
    );
    assert.equal(calls.length, 0);
});

test("provisioning failure prevents runner execution and propagates", () => {
    const calls = [];
    const contract = contractFor(environment());
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment(),
            createContract: () => contract,
            runChild: (script) => {
                calls.push(script);
                if (calls.length === 1) throw new Error("provisioning failed");
            },
        }),
        /provisioning failed/,
    );
    assert.deepEqual(calls, ["scripts/financial-e2e-provision-local.mjs"]);
});

test("orchestration environment keeps parent contract and does not expose secrets", () => {
    const env = environment({ FINANCIAL_E2E_TARGET_CONTRACT: "stale-parent-value" });
    const contract = contractFor(env);
    const serialized = JSON.stringify(contract.targetContract);
    const child = createInitializationEnvironment(
        env,
        contract.targetContract,
        serialized,
        contract.binding,
    );
    assert.equal(child.FINANCIAL_E2E_TARGET_CONTRACT, serialized);
    assert.doesNotMatch(serialized, /test-only-(bootstrap|runtime)-secret/);
});

test("rejects a mismatched contract binding before runtime execution", () => {
    const calls = [];
    const contract = contractFor(environment());
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment(),
            createContract: () => ({ ...contract, binding: "mismatch" }),
            validateBinding: targetContractBinding,
            runChild: (...args) => calls.push(args),
        }),
        /contract binding is invalid/,
    );
    assert.equal(calls.length, 0);
});

test("rejects invalid contract generation before runtime execution", () => {
    const calls = [];
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment(),
            createContract: () => { throw new Error("invalid generated contract"); },
            runChild: (...args) => calls.push(args),
        }),
        /invalid generated contract/,
    );
    assert.equal(calls.length, 0);
});

test("propagates a non-zero child failure", () => {
    const contract = contractFor(environment());
    assert.throws(
        () => runSalesGstAcceptance({
            environment: environment(),
            createContract: () => contract,
            validateBinding: targetContractBinding,
            runChild: () => {
                const error = new Error("runner exited");
                error.status = 7;
                throw error;
            },
        }),
        /runner exited/,
    );
});

test("forwards disposal cleanup mode to children", () => {
    const env = environment({ FINANCIAL_E2E_CLEANUP_MODE: "DISPOSABLE_TARGET_DISPOSAL" });
    const contract = contractFor(env);
    const calls = [];
    runSalesGstAcceptance({
        environment: env,
        createContract: () => contract,
        validateBinding: targetContractBinding,
        runChild: (script, childEnv) => calls.push({ script, childEnv }),
    });
    assert.equal(calls.length, 2);
    for (const { childEnv } of calls) {
        assert.equal(childEnv.FINANCIAL_E2E_CLEANUP_MODE, "DISPOSABLE_TARGET_DISPOSAL");
    }
});

test("defaults to row-level cleanup mode when unspecified", () => {
    const env = environment();
    const contract = contractFor(env);
    let childEnv;
    runSalesGstAcceptance({
        environment: env,
        createContract: () => contract,
        validateBinding: targetContractBinding,
        runChild: (script, childEnvArg) => { childEnv = childEnvArg; },
    });
    assert.equal(childEnv.FINANCIAL_E2E_CLEANUP_MODE, "ROW_LEVEL_CLEANUP");
});
