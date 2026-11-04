import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import {
  createTargetContract,
  schemaArtifactHash,
  targetContractBinding,
} from "../scripts/financial-e2e-target-contract.mjs";
import { targetContractFingerprint } from "../scripts/financial-e2e-target-lifecycle.mjs";

const require = createRequire(import.meta.url);
const { runSalesGstAcceptance } = require("../scripts/sales-gst-application-acceptance.cjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pharmnos-sales-gst-acceptance-"));
test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

function environment(overrides = {}) {
  const contract = createTargetContract({
    runId: "sales_gst_contract_test",
    targetUrl: "postgresql://pharmnos_e2e@127.0.0.1:55491/pharmnos_financial_e2e_sales",
    runtimeUrl: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55491/pharmnos_financial_e2e_sales",
    databaseName: "pharmnos_financial_e2e_sales",
    composeProject: "pharmnoslite-financial-e2e-sales-test",
    schemaArtifactHash: schemaArtifactHash(),
    authorizedAt: Date.now() - 1_000,
    expiresAt: Date.now() + 60_000,
  });
  const binding = targetContractBinding(contract);
  const fingerprint = targetContractFingerprint(contract);
  const infrastructureEvidence = path.join(tempRoot, "infrastructure.json");
  const initializationEvidence = path.join(tempRoot, "initialization.json");
  const suiteEvidence = path.join(tempRoot, "suite.json");
  const infrastructureUpstream = JSON.stringify({
    evidenceVersion: 1,
    phase: "INFRASTRUCTURE_CREATION",
    status: "PASS",
    targetBinding: binding,
    targetFingerprint: fingerprint,
    recordedAt: Date.now(),
    details: {
      containerId: "container-1",
      project: contract.composeProject,
      service: contract.composeService,
      profile: contract.composeProfile,
      image: "postgres:17-alpine",
      host: "127.0.0.1",
      port: contract.port,
      containerPort: 5432,
      restartPolicy: "no",
      storage: "tmpfs",
      isolationLabel: "financial-e2e-isolated",
      containerCount: 1,
    },
  });
  const initializationUpstream = JSON.stringify({
    evidenceVersion: 1,
    phase: "SCHEMA_INITIALIZATION",
    status: "PASS",
    targetBinding: binding,
    targetFingerprint: fingerprint,
    recordedAt: Date.now(),
    details: {
      databaseName: contract.databaseName,
      bootstrapRole: contract.bootstrapRole,
      runtimeRole: contract.runtimeRole,
      schemaArtifactHash: contract.schemaArtifactHash,
      runtimeRestricted: true,
      runtimeDeletePrivileges: 0,
    },
  });
  fs.writeFileSync(infrastructureEvidence, infrastructureUpstream);
  fs.writeFileSync(initializationEvidence, initializationUpstream);
  return {
    ALLOW_FINANCIAL_E2E: "true",
    DATABASE_URL: "postgresql://ordinary@127.0.0.1:55430/pharmnos_local",
    TEST_DATABASE_URL: "postgresql://pharmnos_e2e@127.0.0.1:55491/pharmnos_financial_e2e_sales",
    TEST_DATABASE_NAME: contract.databaseName,
    TEST_DATABASE_MARKER: contract.marker,
    FINANCIAL_E2E_DB_NAME: contract.databaseName,
    FINANCIAL_E2E_DB_PORT: String(contract.port),
    FINANCIAL_E2E_DB_USER: contract.bootstrapRole,
    FINANCIAL_E2E_DB_PASSWORD: "test-bootstrap-secret",
    FINANCIAL_E2E_RUNTIME_DB_USER: contract.runtimeRole,
    FINANCIAL_E2E_RUNTIME_DB_PASSWORD: "test-runtime-secret",
    FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55491/pharmnos_financial_e2e_sales",
    FINANCIAL_E2E_COMPOSE_PROJECT: contract.composeProject,
    FINANCIAL_E2E_TARGET_CONTRACT: JSON.stringify(contract),
    FINANCIAL_E2E_RUN_ID: contract.runId,
    FINANCIAL_E2E_TARGET_APPROVED: "true",
    FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING: binding,
    FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT: fingerprint,
    FINANCIAL_E2E_EXECUTION_AUTHORIZED: "true",
    FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED: "true",
    FINANCIAL_E2E_SUITE_NAME: "sales-gst",
    FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE: infrastructureEvidence,
    FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE: initializationEvidence,
    FINANCIAL_E2E_SUITE_EVIDENCE_FILE: suiteEvidence,
    FINANCIAL_E2E_CLEANUP_AUTHORIZED: "false",
    ...overrides,
  };
}

test("Sales GST consumes one externally authorized target and never provisions it", async () => {
  const calls = [];
  const env = environment();
  const result = await runSalesGstAcceptance({
    environment: env,
    runChild: (script, childEnv) => calls.push({ script, childEnv }),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].script, "scripts/gst-application-e2e-runner.mjs");
  assert.equal(calls[0].childEnv.FINANCIAL_E2E_TARGET_CONTRACT, env.FINANCIAL_E2E_TARGET_CONTRACT);
  assert.equal(calls[0].childEnv.FINANCIAL_E2E_EXECUTION_AUTHORIZED, "true");
  assert.equal(calls[0].childEnv.FINANCIAL_E2E_CLEANUP_AUTHORIZED, "false");
  assert.equal(result.targetContractFingerprint, env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT);
});

test("Sales GST refuses an unbound target before launching the suite", async () => {
  const calls = [];
  await assert.rejects(
    () => runSalesGstAcceptance({
      environment: environment({ FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT: "0".repeat(64) }),
      runChild: (...args) => calls.push(args),
    }),
    /target lifecycle gate failed|fingerprint/i,
  );
  assert.equal(calls.length, 0);
});

test("Sales GST refuses expired target authorization", async () => {
  const env = environment();
  const expired = JSON.parse(env.FINANCIAL_E2E_TARGET_CONTRACT);
  expired.expiresAt = Date.now() - 1;
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(expired);
  await assert.rejects(
    () => runSalesGstAcceptance({ environment: env, runChild: () => { throw new Error("must not run"); } }),
    /stale|fingerprint|binding/i,
  );
});

test("Sales GST refuses bootstrap/runtime endpoint drift", async () => {
  await assert.rejects(
    () => runSalesGstAcceptance({
      environment: environment({
        FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55492/pharmnos_financial_e2e_sales",
      }),
      runChild: () => { throw new Error("must not run"); },
    }),
    /does not match|same target|target lifecycle/i,
  );
});
