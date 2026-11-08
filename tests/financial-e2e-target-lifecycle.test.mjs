import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createTargetContract,
  schemaArtifactHash,
  targetContractBinding,
} from "../scripts/financial-e2e-target-contract.mjs";
import {
  createLifecycleEvidence,
  loadAuthorizedTargetLifecycle,
  targetContractFingerprint,
  validateComposeTargetSnapshot,
  writeLifecycleEvidence,
} from "../scripts/financial-e2e-target-lifecycle.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pharmnos-financial-e2e-lifecycle-"));
test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

function createFixture() {
  const contract = createTargetContract({
    runId: "lifecycle_contract_test",
    targetUrl: "postgresql://pharmnos_e2e@127.0.0.1:55491/pharmnos_financial_e2e_lifecycle",
    runtimeUrl: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55491/pharmnos_financial_e2e_lifecycle",
    databaseName: "pharmnos_financial_e2e_lifecycle",
    composeProject: "pharmnoslite-financial-e2e-lifecycle-test",
    schemaArtifactHash: schemaArtifactHash(),
    authorizedAt: Date.now() - 1_000,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  const binding = targetContractBinding(contract);
  const fingerprint = targetContractFingerprint(contract);
  const infrastructureEvidence = path.join(tempRoot, `${crypto.randomUUID()}-infrastructure.json`);
  const initializationEvidence = path.join(tempRoot, `${crypto.randomUUID()}-initialization.json`);
  const suiteEvidence = path.join(tempRoot, `${crypto.randomUUID()}-suite.json`);
  const environment = {
    FINANCIAL_E2E_ENV_FILE: path.join(tempRoot, "missing-test-environment"),
    ALLOW_FINANCIAL_E2E: "true",
    DATABASE_URL: "postgresql://ordinary@127.0.0.1:55430/pharmnos_local",
    TEST_DATABASE_URL: "postgresql://pharmnos_e2e@127.0.0.1:55491/pharmnos_financial_e2e_lifecycle",
    TEST_DATABASE_NAME: contract.databaseName,
    TEST_DATABASE_MARKER: contract.marker,
    FINANCIAL_E2E_DB_NAME: contract.databaseName,
    FINANCIAL_E2E_DB_PORT: String(contract.port),
    FINANCIAL_E2E_DB_USER: contract.bootstrapRole,
    FINANCIAL_E2E_RUNTIME_DB_USER: contract.runtimeRole,
    FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55491/pharmnos_financial_e2e_lifecycle",
    FINANCIAL_E2E_COMPOSE_PROJECT: contract.composeProject,
    FINANCIAL_E2E_TARGET_CONTRACT: JSON.stringify(contract),
    FINANCIAL_E2E_RUN_ID: contract.runId,
    FINANCIAL_E2E_TARGET_APPROVED: "true",
    FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING: binding,
    FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT: fingerprint,
    FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED: "true",
    FINANCIAL_E2E_INITIALIZATION_AUTHORIZED: "true",
    FINANCIAL_E2E_EXECUTION_AUTHORIZED: "true",
    FINANCIAL_E2E_SUITE_NAME: "sales-gst",
    FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE: infrastructureEvidence,
    FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE: initializationEvidence,
    FINANCIAL_E2E_SUITE_EVIDENCE_FILE: suiteEvidence,
  };
  const infrastructure = {
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
  };
  const initialization = {
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
  };
  fs.writeFileSync(infrastructureEvidence, JSON.stringify(infrastructure));
  fs.writeFileSync(initializationEvidence, JSON.stringify(initialization));
  return { contract, binding, fingerprint, environment, infrastructureEvidence, initializationEvidence };
}

test("validates an exact target contract before phase work", () => {
  const fixture = createFixture();
  const lifecycle = loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "TARGET_VALIDATION",
  });
  assert.equal(lifecycle.targetBinding, fixture.binding);
  assert.equal(lifecycle.targetFingerprint, fixture.fingerprint);
});

test("accepts a missing ordinary database URL without using it as a runtime dependency", () => {
  const fixture = createFixture();
  delete fixture.environment.DATABASE_URL;
  assert.doesNotThrow(() => loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "TARGET_VALIDATION",
  }));
});

test("rejects a missing full-contract fingerprint", () => {
  const fixture = createFixture();
  delete fixture.environment.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT;
  assert.throws(
    () => loadAuthorizedTargetLifecycle({ env: fixture.environment, phase: "TARGET_VALIDATION" }),
    /AUTHORIZED_TARGET_FINGERPRINT/,
  );
});

test("rejects an expired contract before a lifecycle phase", () => {
  const fixture = createFixture();
  const expired = { ...fixture.contract, expiresAt: Date.now() - 1 };
  fixture.environment.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(expired);
  assert.throws(
    () => loadAuthorizedTargetLifecycle({ env: fixture.environment, phase: "TARGET_VALIDATION" }),
    /stale|fingerprint|binding/i,
  );
});

test("rejects a contract whose schema artifact fingerprint is stale", () => {
  const fixture = createFixture();
  const stale = { ...fixture.contract, schemaArtifactHash: "0".repeat(64) };
  fixture.environment.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(stale);
  fixture.environment.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(stale);
  fixture.environment.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(stale);
  assert.throws(
    () => loadAuthorizedTargetLifecycle({ env: fixture.environment, phase: "TARGET_VALIDATION" }),
    /schema artifact fingerprint/,
  );
});

test("rejects a generic environment URL that resolves to the disposable target", () => {
  const fixture = createFixture();
  fixture.environment.DATABASE_URL = fixture.environment.TEST_DATABASE_URL;
  assert.throws(
    () => loadAuthorizedTargetLifecycle({ env: fixture.environment, phase: "TARGET_VALIDATION" }),
    /ordinary database endpoint|DATABASE_URL must remain separate/,
  );
});

test("rejects a Supabase or pooler ordinary database URL", () => {
  const fixture = createFixture();
  fixture.environment.DATABASE_URL = "postgresql://ordinary:placeholder@db.example.supabase.co:5432/production";
  assert.throws(
    () => loadAuthorizedTargetLifecycle({ env: fixture.environment, phase: "TARGET_VALIDATION" }),
    /Supabase|pooler/,
  );
});

test("keeps infrastructure and initialization authorizations separate", () => {
  const fixture = createFixture();
  delete fixture.environment.FINANCIAL_E2E_INITIALIZATION_AUTHORIZED;
  assert.doesNotThrow(() => loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "INFRASTRUCTURE_CREATION",
  }));
  assert.throws(
    () => loadAuthorizedTargetLifecycle({
      env: fixture.environment,
      phase: "SCHEMA_INITIALIZATION",
    }),
    /INITIALIZATION authorization/,
  );
});

test("requires a fresh upstream initialization evidence record for suite execution", () => {
  const fixture = createFixture();
  fs.writeFileSync(fixture.initializationEvidence, JSON.stringify({
    evidenceVersion: 1,
    targetBinding: fixture.binding,
    targetFingerprint: fixture.fingerprint,
    recordedAt: Date.now() - (25 * 60 * 60 * 1000),
  }));
  assert.throws(
    () => loadAuthorizedTargetLifecycle({
      env: fixture.environment,
      phase: "SUITE_EXECUTION",
      suiteName: "sales-gst",
    }),
    /stale/,
  );
});

test("keeps suite execution and evidence recording authorizations separate", () => {
  const fixture = createFixture();
  assert.doesNotThrow(() => loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "SUITE_EXECUTION",
    suiteName: "sales-gst",
  }));
  fixture.environment.FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED = "true";
  assert.doesNotThrow(() => loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "EVIDENCE_RECORDING",
    suiteName: "sales-gst",
  }));
  delete fixture.environment.FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED;
  assert.throws(
    () => loadAuthorizedTargetLifecycle({
      env: fixture.environment,
      phase: "EVIDENCE_RECORDING",
      suiteName: "sales-gst",
    }),
    /EVIDENCE_RECORDING authorization/,
  );
});

test("records independent suite outcomes without overwriting another suite", () => {
  const fixture = createFixture();
  fixture.environment.FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED = "true";
  const salesLifecycle = loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "EVIDENCE_RECORDING",
    suiteName: "sales-gst",
  });
  const purchasePath = path.join(tempRoot, `${crypto.randomUUID()}-purchase.json`);
  const purchaseLifecycle = loadAuthorizedTargetLifecycle({
    env: {
      ...fixture.environment,
      FINANCIAL_E2E_SUITE_NAME: "purchase-gst",
      FINANCIAL_E2E_SUITE_EVIDENCE_FILE: purchasePath,
    },
    phase: "EVIDENCE_RECORDING",
    suiteName: "purchase-gst",
  });
  writeLifecycleEvidence({
    filePath: fixture.environment.FINANCIAL_E2E_SUITE_EVIDENCE_FILE,
    evidence: createLifecycleEvidence({
      phase: "EVIDENCE_RECORDING",
      lifecycle: salesLifecycle,
      status: "FAIL",
      details: { suite: "sales-gst", resultCount: 1, failureCount: 1 },
    }),
  });
  writeLifecycleEvidence({
    filePath: purchasePath,
    evidence: createLifecycleEvidence({
      phase: "EVIDENCE_RECORDING",
      lifecycle: purchaseLifecycle,
      status: "PASS",
      details: { suite: "purchase-gst", resultCount: 2, failureCount: 0 },
    }),
  });
  const salesEvidence = JSON.parse(fs.readFileSync(fixture.environment.FINANCIAL_E2E_SUITE_EVIDENCE_FILE, "utf8"));
  const purchaseEvidence = JSON.parse(fs.readFileSync(purchasePath, "utf8"));
  assert.equal(salesEvidence.status, "FAIL");
  assert.equal(purchaseEvidence.status, "PASS");
  assert.equal(salesEvidence.details.suite, "sales-gst");
  assert.equal(purchaseEvidence.details.suite, "purchase-gst");
});

test("validates exact Compose project, service, profile, image, port, and isolation", () => {
  const fixture = createFixture();
  const valid = validateComposeTargetSnapshot({
    project: fixture.contract.composeProject,
    service: fixture.contract.composeService,
    profile: fixture.contract.composeProfile,
    image: "postgres:17-alpine",
    host: "127.0.0.1",
    port: fixture.contract.port,
    containerPort: 5432,
    restartPolicy: "no",
    storage: "tmpfs",
    isolationLabel: "financial-e2e-isolated",
    containerCount: 1,
  }, fixture.contract);
  assert.equal(valid.ok, true);
  const mismatch = validateComposeTargetSnapshot({
    project: "unrelated-project",
    service: fixture.contract.composeService,
    profile: fixture.contract.composeProfile,
    image: "postgres:17-alpine",
    host: "0.0.0.0",
    port: fixture.contract.port,
    containerPort: 5432,
    restartPolicy: "always",
    storage: "volume",
    isolationLabel: "wrong",
    containerCount: 1,
  }, fixture.contract);
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.errors.length >= 5, true);
});

test("writes sanitized phase evidence once and rejects connection strings", () => {
  const fixture = createFixture();
  const lifecycle = loadAuthorizedTargetLifecycle({
    env: fixture.environment,
    phase: "SUITE_EXECUTION",
    suiteName: "sales-gst",
  });
  const evidence = createLifecycleEvidence({
    phase: "SUITE_EXECUTION",
    lifecycle,
    details: { suite: "sales-gst", databaseAccessed: true },
  });
  const output = path.join(tempRoot, `${crypto.randomUUID()}-evidence.json`);
  assert.equal(writeLifecycleEvidence({ filePath: output, evidence }), output);
  assert.throws(() => writeLifecycleEvidence({ filePath: output, evidence }), /already exists|EEXIST/);
  assert.throws(
    () => createLifecycleEvidence({
      phase: "SUITE_EXECUTION",
      lifecycle,
      details: { connection: "postgresql://secret@example.invalid/db" },
    }),
    /connection strings/,
  );
});
