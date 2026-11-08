import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createTargetContract,
  governanceArtifactHash,
  migrationInventoryHash,
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
    schemaMode: "PRISMA_MIGRATIONS_REPLAYED",
    migrationInventoryHash: migrationInventoryHash(),
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
    FINANCIAL_E2E_SCHEMA_MODE: contract.schemaMode,
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

test("security harness preserves explicit environment rather than loading unrelated default files", () => {
  const cwd = fs.mkdtempSync(path.join(tempRoot, "security-env-"));
  fs.writeFileSync(path.join(cwd, ".env.financial-e2e"), "FINANCIAL_E2E_TARGET_CONTRACT=\n");
  fs.writeFileSync(path.join(cwd, ".env.local"), "FINANCIAL_E2E_TARGET_CONTRACT=\n");
  const child = spawnSync(process.execPath, [
    path.resolve("scripts/financial-e2e-security-behavior.mjs"),
  ], {
    cwd,
    env: { ...process.env, FINANCIAL_E2E_ENV_FILE: path.join(cwd, "missing"),
      FINANCIAL_E2E_TARGET_CONTRACT: "not-json" },
    encoding: "utf8",
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /FINANCIAL_E2E_TARGET_CONTRACT is invalid JSON/);
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

test("binds explicit migration replay and its current inventory to the contract", () => {
  const fixture = createFixture();
  const replay = {
    ...fixture.contract,
    schemaMode: "PRISMA_MIGRATIONS_REPLAYED",
    migrationInventoryHash: migrationInventoryHash(),
  };
  const env = fixture.environment;
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(replay);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(replay);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(replay);
  env.FINANCIAL_E2E_SCHEMA_MODE = replay.schemaMode;
  assert.doesNotThrow(() => loadAuthorizedTargetLifecycle({ env }));
  delete env.FINANCIAL_E2E_SCHEMA_MODE;
  assert.throws(() => loadAuthorizedTargetLifecycle({ env }), /SCHEMA_MODE/);
  env.FINANCIAL_E2E_SCHEMA_MODE = "EMPTY_BASELINE";
  assert.throws(() => loadAuthorizedTargetLifecycle({ env }), /SCHEMA_MODE/);
  env.FINANCIAL_E2E_SCHEMA_MODE = replay.schemaMode;
  const stale = { ...replay, migrationInventoryHash: "0".repeat(64) };
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(stale);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(stale);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(stale);
  assert.throws(() => loadAuthorizedTargetLifecycle({ env }), /migration inventory fingerprint/);
});

test("rejects invalid migration replay contracts at construction", () => {
  const fixture = createFixture();
  assert.throws(() => createTargetContract({
    runId: fixture.contract.runId,
    targetUrl: fixture.environment.TEST_DATABASE_URL,
    runtimeUrl: fixture.environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    databaseName: fixture.contract.databaseName,
    composeProject: fixture.contract.composeProject,
    schemaArtifactHash: schemaArtifactHash(),
    schemaMode: "EMPTY_BASELINE",
    migrationInventoryHash: migrationInventoryHash(),
    expiresAt: Date.now() + 60_000,
  }), /governance artifact fingerprint and no migration inventory/);
});

test("binds a serialized empty baseline contract to both artifacts and every lifecycle authorization", () => {
  const fixture = createFixture();
  const { migrationInventoryHash: unused, ...base } = fixture.contract;
  const empty = { ...base, schemaMode: "EMPTY_BASELINE", governanceArtifactHash: governanceArtifactHash() };
  const env = fixture.environment;
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(empty);
  env.FINANCIAL_E2E_SCHEMA_MODE = empty.schemaMode;
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(empty);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(empty);
  const lifecycle = loadAuthorizedTargetLifecycle({ env });
  assert.equal(lifecycle.contract.schemaMode, "EMPTY_BASELINE");
  assert.equal(lifecycle.contract.governanceArtifactHash, governanceArtifactHash());
  assert.equal(Object.isFrozen(lifecycle.contract), true);

  for (const patch of [
    { governanceArtifactHash: undefined },
    { governanceArtifactHash: "0".repeat(64) },
    { schemaArtifactHash: "0".repeat(64) },
    { migrationInventoryHash: migrationInventoryHash() },
    { schemaMode: "UNKNOWN" },
    { schemaMode: undefined },
    { unexpected: true },
  ]) {
    env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify({ ...empty, ...patch });
    assert.throws(() => loadAuthorizedTargetLifecycle({ env }));
  }
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify({ ...empty, expiresAt: empty.expiresAt + 1 });
  assert.throws(() => loadAuthorizedTargetLifecycle({ env }), /BINDING/);
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(empty);
  env.FINANCIAL_E2E_SCHEMA_MODE = "PRISMA_MIGRATIONS_REPLAYED";
  assert.throws(() => loadAuthorizedTargetLifecycle({ env }), /SCHEMA_MODE/);
});

test("rejects altered empty baseline authorization before initialization", () => {
  const fixture = createFixture();
  const { migrationInventoryHash: unused, ...base } = fixture.contract;
  const empty = { ...base, schemaMode: "EMPTY_BASELINE", governanceArtifactHash: governanceArtifactHash() };
  const env = fixture.environment;
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(empty);
  env.FINANCIAL_E2E_SCHEMA_MODE = empty.schemaMode;
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(empty);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(empty);
  const upstream = JSON.parse(fs.readFileSync(fixture.infrastructureEvidence, "utf8"));
  upstream.targetBinding = targetContractBinding(empty);
  upstream.targetFingerprint = targetContractFingerprint(empty);
  fs.writeFileSync(fixture.infrastructureEvidence, JSON.stringify(upstream));
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = "0".repeat(64);
  const child = spawnSync(process.execPath, ["scripts/financial-e2e-provision-local.mjs"], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /AUTHORIZED_TARGET_FINGERPRINT/);
});

test("rejects reused infrastructure evidence across runs and targets", () => {
  const first = createFixture();
  const second = createFixture();
  const other = { ...second.contract, runId: "another_run", port: 55493 };
  const env = second.environment;
  env.TEST_DATABASE_URL = env.TEST_DATABASE_URL.replace(":55491", ":55493");
  env.FINANCIAL_E2E_RUNTIME_DATABASE_URL = env.FINANCIAL_E2E_RUNTIME_DATABASE_URL.replace(":55491", ":55493");
  env.FINANCIAL_E2E_DB_PORT = "55493";
  env.FINANCIAL_E2E_RUN_ID = other.runId;
  env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(other);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(other);
  env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(other);
  env.FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE = first.infrastructureEvidence;
  assert.throws(() => loadAuthorizedTargetLifecycle({ env, phase: "SCHEMA_INITIALIZATION" }),
    /different target contract|exact isolated Compose target/);
});

test("rejects unauthorized infrastructure, suite, and cleanup phases", () => {
  const fixture = createFixture();
  for (const [phase, variable] of [
    ["INFRASTRUCTURE_CREATION", "FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED"],
    ["SUITE_EXECUTION", "FINANCIAL_E2E_EXECUTION_AUTHORIZED"],
    ["CLEANUP_AUTHORIZATION", "FINANCIAL_E2E_CLEANUP_AUTHORIZED"],
  ]) {
    const env = { ...fixture.environment, [variable]: "false",
      FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE: path.join(tempRoot, "cleanup.json") };
    assert.throws(() => loadAuthorizedTargetLifecycle({ env, phase }), /authorization is required/);
  }
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
