import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildComposeArgs,
  runFinancialE2eCompose,
} from "../scripts/financial-e2e-compose.mjs";
import {
  targetContractBinding,
} from "../scripts/financial-e2e-target-contract.mjs";
import {
  targetContractFingerprint,
} from "../scripts/financial-e2e-target-lifecycle.mjs";
import { createTargetContract, migrationInventoryHash, schemaArtifactHash } from "../scripts/financial-e2e-target-contract.mjs";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pharmnos-financial-e2e-compose-"));
test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

function environment(overrides = {}) {
  const contract = createTargetContract({
    runId: "compose_contract_test",
    targetUrl: "postgresql://pharmnos_e2e@127.0.0.1:55492/pharmnos_financial_e2e_compose",
    runtimeUrl: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55492/pharmnos_financial_e2e_compose",
    databaseName: "pharmnos_financial_e2e_compose",
    composeProject: "pharmnoslite-financial-e2e-compose-test",
    schemaArtifactHash: schemaArtifactHash(),
    schemaMode: "PRISMA_MIGRATIONS_REPLAYED",
    migrationInventoryHash: migrationInventoryHash(),
    authorizedAt: Date.now() - 1_000,
    expiresAt: Date.now() + 60_000,
  });
  return {
    ALLOW_FINANCIAL_E2E: "true",
    DATABASE_URL: "postgresql://ordinary@127.0.0.1:55430/pharmnos_local",
    TEST_DATABASE_URL: "postgresql://pharmnos_e2e@127.0.0.1:55492/pharmnos_financial_e2e_compose",
    TEST_DATABASE_NAME: contract.databaseName,
    TEST_DATABASE_MARKER: contract.marker,
    FINANCIAL_E2E_DB_NAME: contract.databaseName,
    FINANCIAL_E2E_DB_PORT: String(contract.port),
    FINANCIAL_E2E_DB_USER: contract.bootstrapRole,
    FINANCIAL_E2E_RUNTIME_DB_USER: contract.runtimeRole,
    FINANCIAL_E2E_RUNTIME_DATABASE_URL: "postgresql://pharmnos_e2e_runtime@127.0.0.1:55492/pharmnos_financial_e2e_compose",
    FINANCIAL_E2E_COMPOSE_PROJECT: contract.composeProject,
    FINANCIAL_E2E_TARGET_CONTRACT: JSON.stringify(contract),
    FINANCIAL_E2E_SCHEMA_MODE: contract.schemaMode,
    FINANCIAL_E2E_RUN_ID: contract.runId,
    FINANCIAL_E2E_TARGET_APPROVED: "true",
    FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING: targetContractBinding(contract),
    FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT: targetContractFingerprint(contract),
    FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED: "true",
    FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE: path.join(tempRoot, "infrastructure.json"),
    FINANCIAL_E2E_COMPOSE_FILE: "docker-compose.financial-e2e.yml",
    ...overrides,
  };
}

function inspection(contract) {
  return JSON.stringify([{
    Id: "container-1",
    Config: {
      Image: "postgres:17-alpine",
      Labels: {
        "com.docker.compose.project": contract.composeProject,
        "com.docker.compose.service": contract.composeService,
        "com.pharmnos.environment": "financial-e2e-isolated",
      },
    },
    HostConfig: {
      RestartPolicy: { Name: "no" },
      PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: String(contract.port) }] },
      Tmpfs: { "/var/lib/postgresql/data": "" },
    },
    Mounts: [],
  }]);
}

test("builds a project-bound Compose command without orphan cleanup", () => {
  const args = buildComposeArgs({
    action: "down",
    composeProject: "pharmnoslite-financial-e2e-compose-test",
  });
  assert.deepEqual(args, [
    "compose",
    "--project-name",
    "pharmnoslite-financial-e2e-compose-test",
    "--file",
    "docker-compose.financial-e2e.yml",
    "--profile",
    "financial-e2e",
    "down",
    "--volumes",
  ]);
  assert.equal(args.includes("--remove-orphans"), false);
});

test("records exact infrastructure identity after a mocked contract-bound Compose up", () => {
  const env = environment();
  const contract = JSON.parse(env.FINANCIAL_E2E_TARGET_CONTRACT);
  const calls = [];
  const runner = (_command, args) => {
    calls.push(args);
    if (args.includes("inspect")) return { status: 0, stdout: inspection(contract), stderr: "" };
    if (args.includes("ps") && calls.filter((call) => call.includes("ps")).length === 1) {
      return { status: 0, stdout: "", stderr: "" };
    }
    if (args.includes("ps")) return { status: 0, stdout: "container-1\n", stderr: "" };
    return { status: 0, stdout: "", stderr: "" };
  };
  const result = runFinancialE2eCompose({ action: "up", env, runner });
  assert.equal(result.evidence.details.containerId, "container-1");
  assert.equal(fs.existsSync(env.FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE), true);
  assert.equal(calls.some((args) => args.includes("--remove-orphans")), false);
});

test("refuses cleanup when the recorded container identity does not match", () => {
  const env = environment({
    FINANCIAL_E2E_CLEANUP_AUTHORIZED: "true",
    FINANCIAL_E2E_CLEANUP_MODE: "DISPOSABLE_TARGET_DISPOSAL",
    FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE: path.join(tempRoot, "cleanup.json"),
    FINANCIAL_E2E_CREATED_CONTAINER_ID: "unrelated-container",
  });
  const contract = JSON.parse(env.FINANCIAL_E2E_TARGET_CONTRACT);
  fs.writeFileSync(env.FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE, JSON.stringify({
    evidenceVersion: 1,
    phase: "INFRASTRUCTURE_CREATION",
    status: "PASS",
    targetBinding: env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING,
    targetFingerprint: env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT,
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
  }));
  const calls = [];
  const runner = (_command, args) => {
    calls.push(args);
    if (args.includes("inspect")) return { status: 0, stdout: inspection(contract), stderr: "" };
    return { status: 0, stdout: "container-1\n", stderr: "" };
  };
  assert.throws(
    () => runFinancialE2eCompose({ action: "down", env, runner }),
    /exact recorded Compose container/,
  );
  assert.equal(calls.some((args) => args.includes("down")), false);
});
