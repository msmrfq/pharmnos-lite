#!/usr/bin/env node

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const REQUIRED_ENV = [
  "ALLOW_FINANCIAL_E2E",
  "TEST_DATABASE_URL",
  "DATABASE_URL",
  "TEST_DATABASE_NAME",
  "TEST_DATABASE_MARKER",
  "FINANCIAL_E2E_DB_PORT",
  "FINANCIAL_E2E_DB_USER",
  "FINANCIAL_E2E_DB_PASSWORD",
  "FINANCIAL_E2E_RUNTIME_DB_USER",
  "FINANCIAL_E2E_RUNTIME_DB_PASSWORD",
  "FINANCIAL_E2E_RUNTIME_DATABASE_URL",
  "FINANCIAL_E2E_TARGET_CONTRACT",
  "FINANCIAL_E2E_RUN_ID",
  "FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING",
  "FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT",
  "FINANCIAL_E2E_EXECUTION_AUTHORIZED",
  "FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED",
  "FINANCIAL_E2E_SUITE_NAME",
  "FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE",
  "FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE",
  "FINANCIAL_E2E_SUITE_EVIDENCE_FILE",
];

function loadEnvironment(base = process.env) {
  const environment = { ...base };
  const files = [
    environment.FINANCIAL_E2E_BASE_ENV_FILE,
    environment.FINANCIAL_E2E_ENV_FILE || ".env.financial-e2e",
  ].filter(Boolean);
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

function createInitializationEnvironment(environment, contract, serializedContract, binding, fingerprint) {
  return {
    ...environment,
    TEST_DATABASE_NAME: contract.databaseName,
    FINANCIAL_E2E_DB_NAME: contract.databaseName,
    FINANCIAL_E2E_RUNTIME_DATABASE_URL: environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING: binding,
    FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT: fingerprint,
    FINANCIAL_E2E_RUN_ID: contract.runId,
    FINANCIAL_E2E_INITIALIZATION_AUTHORIZED: "false",
    FINANCIAL_E2E_INITIALIZATION_SCOPE: "PREPROVISIONED_VERIFICATION_ONLY",
    FINANCIAL_E2E_EXECUTION_AUTHORIZED: "true",
    FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED: environment.FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED || "false",
    FINANCIAL_E2E_SUITE_NAME: "sales-gst",
    FINANCIAL_E2E_SUITE_RUN_ID: environment.FINANCIAL_E2E_SUITE_RUN_ID || contract.runId,
    FINANCIAL_E2E_TARGET_APPROVED: "true",
    FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
    FINANCIAL_E2E_ROLE_SETUP_METHOD: "PRECREATED_LOCAL_CREDENTIAL_PROCEDURE",
    FINANCIAL_E2E_BASELINE_PACKAGE: "VERSION_PINNED_REVIEW_ARTIFACTS",
    FINANCIAL_E2E_EVIDENCE_MODE: "SANITIZED_APPEND_ONLY_LOCAL",
    FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS: "30",
    FINANCIAL_E2E_EVIDENCE_PATH_APPROVED: "true",
    FINANCIAL_E2E_RECOVERY_POLICY: "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET",
    FINANCIAL_E2E_CLEANUP_AUTHORIZED: environment.FINANCIAL_E2E_CLEANUP_AUTHORIZED || "false",
    FINANCIAL_E2E_CLEANUP_MODE: environment.FINANCIAL_E2E_CLEANUP_MODE || "ROW_LEVEL_CLEANUP",
    FINANCIAL_E2E_TARGET_CONTRACT: serializedContract,
  };
}

async function runSalesGstAcceptance({
  environment = loadEnvironment(),
  runChild = (script, childEnvironment) => execFileSync(
    process.execPath,
    [script],
    { cwd: process.cwd(), env: childEnvironment, stdio: "inherit" },
  ),
} = {}) {
  assertRequiredEnvironment(environment);
  const target = assertSafeTarget(environment);
  const {
    loadAuthorizedTargetLifecycle,
    targetContractFingerprint,
  } = await import("./financial-e2e-target-lifecycle.mjs");
  const { targetContractBinding } = await import("./financial-e2e-target-contract.mjs");
  const lifecycle = loadAuthorizedTargetLifecycle({
    env: environment,
    phase: "SUITE_EXECUTION",
    suiteName: "sales-gst",
  });
  const contract = lifecycle.contract;
  const binding = targetContractBinding(contract);
  const fingerprint = targetContractFingerprint(contract);
  if (target.port !== String(contract.port)) throw new Error("Sales GST target port is not contract-bound.");
  const serializedContract = String(environment.FINANCIAL_E2E_TARGET_CONTRACT);
  if (targetContractFingerprint(JSON.parse(serializedContract)) !== fingerprint) {
    throw new Error("Sales GST target contract serialization changed the authorized contract.");
  }
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
    fingerprint,
  );
  runChild("scripts/gst-application-e2e-runner.mjs", childEnvironment);
  return {
    runId: contract.runId,
    databaseName: contract.databaseName,
    port: target.port,
    serializedContract,
    targetContractFingerprint: fingerprint,
  };
}

async function main() {
  await runSalesGstAcceptance();
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
