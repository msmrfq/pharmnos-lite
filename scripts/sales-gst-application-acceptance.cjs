#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const PREPROVISIONED_MODE = "PREPROVISIONED";
const PREPROVISIONED_HOST = "127.0.0.1";
const PREPROVISIONED_PORT = "55435";
const PREPROVISIONED_DATABASE = "pharmnos_financial_e2e_0419";
const PREPROVISIONED_COMPOSE_PROJECT = "pharmnoslite-financial-e2e-0419";
const SCHEMA_ARTIFACT_PATH = "prisma/financial-e2e-schema-provisioning.generated.sql";

const REQUIRED_ENV = [
  "ALLOW_FINANCIAL_E2E",
  "TEST_DATABASE_URL",
  "TEST_DATABASE_NAME",
  "TEST_DATABASE_MARKER",
  "FINANCIAL_E2E_DB_PORT",
  "FINANCIAL_E2E_DB_USER",
  "FINANCIAL_E2E_DB_PASSWORD",
  "FINANCIAL_E2E_RUNTIME_DB_USER",
  "FINANCIAL_E2E_RUNTIME_DB_PASSWORD",
  "FINANCIAL_E2E_RUNTIME_DATABASE_URL",
];

function loadEnvironment(base = process.env) {
  const environment = { ...base };
  const files = [
    environment.FINANCIAL_E2E_BASE_ENV_FILE || ".env.local",
    environment.FINANCIAL_E2E_ENV_FILE || ".env.financial-e2e",
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && environment[match[1]] === undefined) {
        environment[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  }
  return environment;
}

function assertRequiredEnvironment(environment) {
  if (environment.ALLOW_FINANCIAL_E2E !== "true") {
    throw new Error("The approved disposable Sales GST target is not enabled.");
  }
  const missing = REQUIRED_ENV.filter((name) => !String(environment[name] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(`Missing required Sales GST target configuration: ${missing.join(", ")}`);
  }
  if (environment.TEST_DATABASE_MARKER !== "pharmnos-financial-e2e") {
    throw new Error("Sales GST requires the approved disposable target marker.");
  }
}

function assertSafeTarget(environment) {
  const target = new URL(environment.TEST_DATABASE_URL);
  const runtime = new URL(environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL);
  if (target.hostname !== "127.0.0.1" || Number(target.port) === 55432) {
    throw new Error("Sales GST requires an explicitly verified restricted disposable target, not port 55432.");
  }
  if (target.port !== String(environment.FINANCIAL_E2E_DB_PORT)) {
    throw new Error("Sales GST target port does not match FINANCIAL_E2E_DB_PORT.");
  }
  if (target.pathname !== `/${environment.TEST_DATABASE_NAME}` ||
      runtime.hostname !== target.hostname ||
      Number(runtime.port) !== Number(target.port) ||
      runtime.pathname !== target.pathname) {
    throw new Error("Sales GST bootstrap and runtime URLs do not identify the same target.");
  }
  if (environment.FINANCIAL_E2E_RUNTIME_DB_USER !== "pharmnos_e2e_runtime") {
    throw new Error("Sales GST requires the approved restricted runtime role.");
  }
  return target;
}

function assertPreProvisionedTarget(environment, target) {
  if (environment.FINANCIAL_E2E_TARGET_MODE !== PREPROVISIONED_MODE) {
    throw new Error("Pre-provisioned execution requires explicit FINANCIAL_E2E_TARGET_MODE=PREPROVISIONED.");
  }
  if (target.hostname !== PREPROVISIONED_HOST ||
      Number(target.port) !== Number(PREPROVISIONED_PORT) ||
      target.pathname !== `/${PREPROVISIONED_DATABASE}` ||
      environment.TEST_DATABASE_NAME !== PREPROVISIONED_DATABASE ||
      environment.FINANCIAL_E2E_DB_PORT !== PREPROVISIONED_PORT ||
      environment.FINANCIAL_E2E_COMPOSE_PROJECT !== PREPROVISIONED_COMPOSE_PROJECT) {
    throw new Error("Pre-provisioned mode is authorized only for verified target 0419.");
  }
}

function assertPreProvisionedContract(contract) {
  if (contract.host !== PREPROVISIONED_HOST ||
      Number(contract.port) !== Number(PREPROVISIONED_PORT) ||
      contract.databaseName !== PREPROVISIONED_DATABASE ||
      contract.composeProject !== PREPROVISIONED_COMPOSE_PROJECT ||
      contract.bootstrapRole !== "pharmnos_e2e" ||
      contract.runtimeRole !== "pharmnos_e2e_runtime" ||
      contract.schemaArtifactHash !== crypto.createHash("sha256")
        .update(fs.readFileSync(SCHEMA_ARTIFACT_PATH))
        .digest("hex")) {
    throw new Error("Pre-provisioned target contract is not bound to verified target 0419.");
  }
}

function createInitializationEnvironment(environment, contract, serializedContract, binding, mode = "FRESH_PROVISIONING") {
  const preProvisioned = mode === PREPROVISIONED_MODE;
  return {
    ...environment,
    TEST_DATABASE_NAME: contract.databaseName,
    FINANCIAL_E2E_DB_NAME: contract.databaseName,
    FINANCIAL_E2E_RUNTIME_DATABASE_URL: environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING: binding,
    FINANCIAL_E2E_RUN_ID: contract.runId,
    FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID: `${contract.runId}-attempt`,
    FINANCIAL_E2E_INITIALIZATION_AUTHORIZED: preProvisioned ? "false" : "true",
    FINANCIAL_E2E_INITIALIZATION_SCOPE: preProvisioned
      ? "PREPROVISIONED_VERIFICATION_ONLY"
      : "DATABASE_INITIALIZATION_ONLY",
    FINANCIAL_E2E_TARGET_APPROVED: "true",
    FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
    FINANCIAL_E2E_ROLE_SETUP_METHOD: "PRECREATED_LOCAL_CREDENTIAL_PROCEDURE",
    FINANCIAL_E2E_BASELINE_PACKAGE: "VERSION_PINNED_REVIEW_ARTIFACTS",
    FINANCIAL_E2E_EVIDENCE_MODE: "SANITIZED_APPEND_ONLY_LOCAL",
    FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS: "30",
    FINANCIAL_E2E_EVIDENCE_PATH_APPROVED: "true",
    FINANCIAL_E2E_RECOVERY_POLICY: "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET",
    FINANCIAL_E2E_CLEANUP_AUTHORIZED: "true",
    FINANCIAL_E2E_TARGET_CONTRACT: serializedContract,
  };
}

function runSalesGstAcceptance({
  environment = loadEnvironment(),
  createContract,
  validateBinding,
  serialize = JSON.stringify,
  runChild = (script, childEnvironment) => execFileSync(
    process.execPath,
    [script],
    { cwd: process.cwd(), env: childEnvironment, stdio: "inherit" },
  ),
} = {}) {
  assertRequiredEnvironment(environment);
  const target = assertSafeTarget(environment);
  const preProvisioned = environment.FINANCIAL_E2E_TARGET_MODE === PREPROVISIONED_MODE;
  if (preProvisioned) assertPreProvisionedTarget(environment, target);
  const generated = createContract({
    runId: `sales_gst_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    targetUrl: environment.TEST_DATABASE_URL,
    runtimeUrl: environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    databaseName: environment.TEST_DATABASE_NAME,
    composeProject: environment.FINANCIAL_E2E_COMPOSE_PROJECT || "pharmnoslite",
  });
  const contract = generated.targetContract || generated;
  if (preProvisioned) assertPreProvisionedContract(contract);
  const binding = generated.binding;
  if (!binding || (validateBinding && binding !== validateBinding(contract))) {
    throw new Error("Sales GST target contract binding is invalid.");
  }
  const serializedContract = serialize(contract);
  if (!serializedContract || serializedContract.includes(environment.FINANCIAL_E2E_DB_PASSWORD) ||
      serializedContract.includes(environment.FINANCIAL_E2E_RUNTIME_DB_PASSWORD)) {
    throw new Error("Sales GST target contract must not contain credentials.");
  }
  process.env.FINANCIAL_E2E_TARGET_CONTRACT = serializedContract;
  const childEnvironment = createInitializationEnvironment(
    environment,
    contract,
    serializedContract,
    binding,
    preProvisioned ? PREPROVISIONED_MODE : "FRESH_PROVISIONING",
  );
  runChild(
    preProvisioned
      ? "scripts/financial-e2e-preprovisioned-verify.mjs"
      : "scripts/financial-e2e-provision-local.mjs",
    childEnvironment,
  );
  runChild("scripts/gst-application-e2e-runner.mjs", childEnvironment);
  return {
    runId: contract.runId,
    databaseName: contract.databaseName,
    port: target.port,
    serializedContract,
  };
}

async function main() {
  const {
    createTargetContract,
    schemaArtifactHash,
    targetContractBinding,
  } = await import("./financial-e2e-target-contract.mjs");
  const createContract = (input) => {
    const contract = createTargetContract({
      ...input,
      schemaArtifactHash: schemaArtifactHash(),
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });
    return {
      targetContract: contract,
      binding: targetContractBinding(contract),
    };
  };
  runSalesGstAcceptance({ createContract, validateBinding: targetContractBinding });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  });
}

module.exports = {
  loadEnvironment,
  assertRequiredEnvironment,
  assertSafeTarget,
  createInitializationEnvironment,
  runSalesGstAcceptance,
};
