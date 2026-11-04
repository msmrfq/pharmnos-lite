import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  loadTargetContractFromEnv,
  schemaArtifactHash,
  targetContractBinding,
  validateTargetContract,
} from "./financial-e2e-target-contract.mjs";

const PHASE_AUTHORIZATION = Object.freeze({
  INFRASTRUCTURE_CREATION: "FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED",
  SCHEMA_INITIALIZATION: "FINANCIAL_E2E_INITIALIZATION_AUTHORIZED",
  SUITE_EXECUTION: "FINANCIAL_E2E_EXECUTION_AUTHORIZED",
  EVIDENCE_RECORDING: "FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED",
  CLEANUP_AUTHORIZATION: "FINANCIAL_E2E_CLEANUP_AUTHORIZED",
});

const PHASE_EVIDENCE_FILES = Object.freeze({
  INFRASTRUCTURE_CREATION: "FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE",
  SCHEMA_INITIALIZATION: "FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE",
  SUITE_EXECUTION: "FINANCIAL_E2E_SUITE_EVIDENCE_FILE",
  EVIDENCE_RECORDING: "FINANCIAL_E2E_SUITE_EVIDENCE_FILE",
  CLEANUP_AUTHORIZATION: "FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE",
});

const REQUIRED_PHASES = new Set([
  "TARGET_VALIDATION",
  ...Object.keys(PHASE_AUTHORIZATION),
]);

const FINANCIAL_E2E_MARKER = "pharmnos-financial-e2e";
const DISPOSABLE_COMPOSE_SERVICE = "financial-e2e-postgres";
const DISPOSABLE_COMPOSE_PROFILE = "financial-e2e";
const DISPOSABLE_IMAGE = "postgres:17-alpine";
const LOOPBACK_HOST = "127.0.0.1";
const MAX_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;

function required(value, name) {
  if (!String(value ?? "").trim()) throw new Error(`${name} is required.`);
  return String(value).trim();
}

function parseEnvironmentFile(filePath) {
  const parsed = {};
  if (!filePath || !fs.existsSync(filePath)) return parsed;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    parsed[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return parsed;
}

export function loadFinancialE2eEnvironment(base = process.env) {
  const environment = { ...base };
  const configuredFile = environment.FINANCIAL_E2E_ENV_FILE || ".env.financial-e2e";
  if (!configuredFile) return environment;
  const fileEnvironment = parseEnvironmentFile(path.resolve(configuredFile));
  for (const [name, value] of Object.entries(fileEnvironment)) {
    if (environment[name] === undefined) environment[name] = value;
  }
  return environment;
}

function canonicalContract(contract) {
  return {
    version: contract.version,
    runId: contract.runId,
    host: contract.host,
    port: contract.port,
    databaseName: contract.databaseName,
    bootstrapRole: contract.bootstrapRole,
    runtimeRole: contract.runtimeRole,
    bootstrapCredentialSource: contract.bootstrapCredentialSource,
    runtimeCredentialSource: contract.runtimeCredentialSource,
    marker: contract.marker,
    composeProject: contract.composeProject,
    composeService: contract.composeService,
    composeProfile: contract.composeProfile,
    schemaArtifactPath: contract.schemaArtifact,
    schemaArtifactHash: contract.schemaArtifactHash,
    authorizedAt: contract.authorizedAt,
    expiresAt: contract.expiresAt,
  };
}

export function targetContractFingerprint(contract) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalContract(contract)))
    .digest("hex");
}

function phaseEvidencePath(environment, phase) {
  const variable = PHASE_EVIDENCE_FILES[phase];
  return variable ? String(environment[variable] ?? "").trim() : "";
}

function phaseAuthorizationBinding(environment, phase) {
  const bindingVariable = `FINANCIAL_E2E_${phase}_AUTHORIZED_TARGET_BINDING`;
  const fingerprintVariable = `FINANCIAL_E2E_${phase}_AUTHORIZED_TARGET_FINGERPRINT`;
  return {
    binding: String(environment[bindingVariable] ?? environment.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING ?? "").trim(),
    fingerprint: String(environment[fingerprintVariable] ?? environment.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT ?? "").trim(),
  };
}

function assertExactDatabaseUrls(environment, contract) {
  const bootstrap = new URL(required(environment.TEST_DATABASE_URL, "TEST_DATABASE_URL"));
  const runtime = new URL(required(environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL, "FINANCIAL_E2E_RUNTIME_DATABASE_URL"));
  const ordinary = new URL(required(environment.DATABASE_URL, "DATABASE_URL"));
  const errors = [];
  if (bootstrap.hostname !== contract.host || Number(bootstrap.port) !== contract.port ||
      bootstrap.pathname !== `/${contract.databaseName}`) {
    errors.push("TEST_DATABASE_URL does not match the immutable target contract.");
  }
  if (runtime.hostname !== contract.host || Number(runtime.port) !== contract.port ||
      runtime.pathname !== `/${contract.databaseName}`) {
    errors.push("FINANCIAL_E2E_RUNTIME_DATABASE_URL does not match the immutable target contract.");
  }
  if (bootstrap.hostname !== runtime.hostname ||
      Number(bootstrap.port) !== Number(runtime.port) ||
      bootstrap.pathname !== runtime.pathname) {
    errors.push("Bootstrap and runtime URLs do not identify the same target.");
  }
  if (ordinary.hostname === contract.host && Number(ordinary.port) === contract.port &&
      ordinary.pathname === `/${contract.databaseName}`) {
    errors.push("DATABASE_URL must remain separate from the disposable target.");
  }
  if (bootstrap.username && bootstrap.username !== contract.bootstrapRole) {
    errors.push("TEST_DATABASE_URL username does not match the bootstrap role.");
  }
  if (runtime.username && runtime.username !== contract.runtimeRole) {
    errors.push("FINANCIAL_E2E_RUNTIME_DATABASE_URL username does not match the runtime role.");
  }
  return errors;
}

function assertContractEnvironment(environment, contract) {
  const errors = [];
  if (environment.ALLOW_FINANCIAL_E2E !== "true") errors.push("ALLOW_FINANCIAL_E2E=true is required.");
  if (environment.FINANCIAL_E2E_TARGET_APPROVED !== "true") {
    errors.push("FINANCIAL_E2E_TARGET_APPROVED=true is required.");
  }
  if (environment.TEST_DATABASE_NAME !== contract.databaseName) {
    errors.push("TEST_DATABASE_NAME does not match the immutable target contract.");
  }
  if (environment.FINANCIAL_E2E_DB_NAME !== contract.databaseName) {
    errors.push("FINANCIAL_E2E_DB_NAME does not match the immutable target contract.");
  }
  if (String(environment.FINANCIAL_E2E_DB_PORT ?? "") !== String(contract.port)) {
    errors.push("FINANCIAL_E2E_DB_PORT does not match the immutable target contract.");
  }
  if (environment.TEST_DATABASE_MARKER !== contract.marker || contract.marker !== FINANCIAL_E2E_MARKER) {
    errors.push("The disposable target marker does not match the approved marker.");
  }
  if (environment.FINANCIAL_E2E_DB_USER !== contract.bootstrapRole) {
    errors.push("FINANCIAL_E2E_DB_USER does not match the bootstrap role.");
  }
  if (environment.FINANCIAL_E2E_RUNTIME_DB_USER !== contract.runtimeRole) {
    errors.push("FINANCIAL_E2E_RUNTIME_DB_USER does not match the runtime role.");
  }
  if (environment.FINANCIAL_E2E_COMPOSE_PROJECT !== contract.composeProject) {
    errors.push("FINANCIAL_E2E_COMPOSE_PROJECT does not match the immutable target contract.");
  }
  errors.push(...assertExactDatabaseUrls(environment, contract));
  return errors;
}

function assertPhaseEvidence(environment, phase, contract, now, requireUpstreamEvidence) {
  const errors = [];
  const filePath = phaseEvidencePath(environment, phase);
  if (phase !== "TARGET_VALIDATION" && !filePath) {
    errors.push(`${PHASE_EVIDENCE_FILES[phase]} is required.`);
  }
  if (!requireUpstreamEvidence || phase === "TARGET_VALIDATION" || phase === "INFRASTRUCTURE_CREATION") {
    return errors;
  }
  const upstreamPath = phase === "SUITE_EXECUTION" || phase === "EVIDENCE_RECORDING"
    ? phaseEvidencePath(environment, "SCHEMA_INITIALIZATION")
    : phaseEvidencePath(environment, "INFRASTRUCTURE_CREATION");
  const expectedUpstreamPhase = phase === "SUITE_EXECUTION" || phase === "EVIDENCE_RECORDING"
    ? "SCHEMA_INITIALIZATION"
    : "INFRASTRUCTURE_CREATION";
  if (!upstreamPath) {
    errors.push("The preceding lifecycle phase evidence file is required.");
    return errors;
  }
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(path.resolve(upstreamPath), "utf8"));
  } catch {
    errors.push("The preceding lifecycle phase evidence file is unreadable.");
    return errors;
  }
  if (evidence.phase !== expectedUpstreamPhase) {
    errors.push(`The preceding lifecycle evidence must be for ${expectedUpstreamPhase}.`);
  }
  if (evidence.status !== "PASS") {
    errors.push("The preceding lifecycle evidence must have PASS status.");
  }
  if (evidence.targetBinding !== targetContractBinding(contract) ||
      evidence.targetFingerprint !== targetContractFingerprint(contract)) {
    errors.push("The preceding lifecycle evidence is bound to a different target contract.");
  }
  if (!Number.isFinite(Number(evidence.recordedAt)) ||
      now - Number(evidence.recordedAt) > MAX_EVIDENCE_AGE_MS) {
    errors.push("The preceding lifecycle evidence is stale.");
  }
  const details = evidence.details && typeof evidence.details === "object" ? evidence.details : {};
  if (expectedUpstreamPhase === "INFRASTRUCTURE_CREATION") {
    const infrastructureMatches = details.containerId &&
      (details.project || details.composeProject) === contract.composeProject &&
      details.service === contract.composeService &&
      details.profile === contract.composeProfile &&
      details.image === DISPOSABLE_IMAGE &&
      details.host === LOOPBACK_HOST &&
      Number(details.port) === contract.port &&
      Number(details.containerPort) === 5432 &&
      details.restartPolicy === "no" &&
      details.storage === "tmpfs" &&
      details.isolationLabel === "financial-e2e-isolated" &&
      Number(details.containerCount) === 1;
    if (!infrastructureMatches) {
      errors.push("Infrastructure evidence does not prove the exact isolated Compose target.");
    }
  } else {
    const initializationMatches = details.databaseName === contract.databaseName &&
      details.bootstrapRole === contract.bootstrapRole &&
      details.runtimeRole === contract.runtimeRole &&
      details.schemaArtifactHash === contract.schemaArtifactHash &&
      details.runtimeRestricted === true &&
      Number(details.runtimeDeletePrivileges) === 0;
    if (!initializationMatches) {
      errors.push("Initialization evidence does not prove the exact schema and restricted runtime identity.");
    }
  }
  return errors;
}

export function loadAuthorizedTargetLifecycle({
  env = process.env,
  phase = "TARGET_VALIDATION",
  suiteName,
  now = Date.now(),
  requireUpstreamEvidence = true,
} = {}) {
  if (!REQUIRED_PHASES.has(phase)) throw new Error(`Unknown financial E2E lifecycle phase: ${phase}.`);
  const environment = loadFinancialE2eEnvironment(env);
  const contract = loadTargetContractFromEnv(environment);
  const actualSchemaArtifactHash = schemaArtifactHash(contract.schemaArtifact);
  const validation = validateTargetContract({
    contract,
    targetUrl: environment.TEST_DATABASE_URL,
    runtimeUrl: environment.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    ordinaryUrl: environment.DATABASE_URL,
    now,
  });
  const errors = validation.ok ? [] : [...validation.errors];
  if (actualSchemaArtifactHash !== contract.schemaArtifactHash) {
    errors.push("Target contract schema artifact fingerprint does not match the checked-in artifact.");
  }
  errors.push(...assertContractEnvironment(environment, contract));
  const binding = targetContractBinding(contract);
  const fingerprint = targetContractFingerprint(contract);
  if (environment.FINANCIAL_E2E_RUN_ID !== contract.runId) {
    errors.push("FINANCIAL_E2E_RUN_ID does not match the immutable target contract.");
  }
  if (environment.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING !== binding) {
    errors.push("FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING does not match the immutable target contract.");
  }
  if (environment.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT !== fingerprint) {
    errors.push("FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT does not match the immutable target contract.");
  }
  if (suiteName && environment.FINANCIAL_E2E_SUITE_NAME !== suiteName) {
    errors.push(`FINANCIAL_E2E_SUITE_NAME must be ${suiteName}.`);
  }
  if (phase !== "TARGET_VALIDATION") {
    if (environment[PHASE_AUTHORIZATION[phase]] !== "true") {
      errors.push(`Explicit ${phase} authorization is required.`);
    }
    const phaseBinding = phaseAuthorizationBinding(environment, phase);
    if (phaseBinding.binding && phaseBinding.binding !== binding) {
      errors.push(`${phase} authorization binding does not match the immutable target contract.`);
    }
    if (phaseBinding.fingerprint && phaseBinding.fingerprint !== fingerprint) {
      errors.push(`${phase} authorization fingerprint does not match the immutable target contract.`);
    }
  }
  errors.push(...assertPhaseEvidence(environment, phase, contract, now, requireUpstreamEvidence));
  if (errors.length > 0) {
    throw new Error(`Financial E2E ${phase} gate failed: ${errors.join(" ")}`);
  }
  return Object.freeze({
    phase,
    suiteName: suiteName || environment.FINANCIAL_E2E_SUITE_NAME || null,
    runId: contract.runId,
    targetBinding: binding,
    targetFingerprint: fingerprint,
    contract,
    environment,
  });
}

export function validateComposeTargetSnapshot(snapshot, contract) {
  const errors = [];
  if (!snapshot || typeof snapshot !== "object") return { ok: false, errors: ["Compose target inspection is required."] };
  if (snapshot.project !== contract.composeProject) errors.push("Compose project does not match the immutable target contract.");
  if (snapshot.service !== contract.composeService || snapshot.service !== DISPOSABLE_COMPOSE_SERVICE) {
    errors.push("Compose service does not match the approved disposable service.");
  }
  if (snapshot.profile !== contract.composeProfile || snapshot.profile !== DISPOSABLE_COMPOSE_PROFILE) {
    errors.push("Compose profile does not match the approved disposable profile.");
  }
  if (snapshot.image !== DISPOSABLE_IMAGE) errors.push("Compose image does not match the approved disposable image.");
  if (snapshot.host !== LOOPBACK_HOST || Number(snapshot.port) !== contract.port) {
    errors.push("Compose endpoint is not the exact loopback endpoint in the contract.");
  }
  if (snapshot.containerPort !== undefined && Number(snapshot.containerPort) !== 5432) {
    errors.push("Compose database container port is not 5432.");
  }
  if (snapshot.restartPolicy !== "no") errors.push("Compose restart policy must be no.");
  if (snapshot.storage !== "tmpfs") errors.push("Compose storage must be tmpfs-only.");
  if (snapshot.isolationLabel !== "financial-e2e-isolated") {
    errors.push("Compose isolation label is missing or incorrect.");
  }
  if (snapshot.containerCount !== undefined && Number(snapshot.containerCount) !== 1) {
    errors.push("Exactly one exact-target Compose container is required.");
  }
  return { ok: errors.length === 0, errors };
}

export function createLifecycleEvidence({
  phase,
  lifecycle,
  status = "PASS",
  details = {},
  recordedAt = Date.now(),
} = {}) {
  if (!lifecycle?.contract || !REQUIRED_PHASES.has(phase) || phase === "TARGET_VALIDATION") {
    throw new TypeError("Lifecycle evidence requires a validated target phase.");
  }
  const evidence = {
    evidenceVersion: 1,
    phase,
    status,
    runId: lifecycle.runId,
    targetBinding: lifecycle.targetBinding,
    targetFingerprint: lifecycle.targetFingerprint,
    target: {
      host: lifecycle.contract.host,
      port: lifecycle.contract.port,
      databaseName: lifecycle.contract.databaseName,
      bootstrapRole: lifecycle.contract.bootstrapRole,
      runtimeRole: lifecycle.contract.runtimeRole,
      composeProject: lifecycle.contract.composeProject,
      composeService: lifecycle.contract.composeService,
      composeProfile: lifecycle.contract.composeProfile,
      schemaArtifactHash: lifecycle.contract.schemaArtifactHash,
    },
    recordedAt,
    details,
  };
  const serialized = JSON.stringify(evidence);
  if (/postgres(?:ql)?:\/\//i.test(serialized)) {
    throw new Error("Lifecycle evidence cannot contain database connection strings.");
  }
  return Object.freeze(evidence);
}

export function writeLifecycleEvidence({ filePath, evidence } = {}) {
  const outputPath = path.resolve(required(filePath, "Lifecycle evidence file path"));
  if (!evidence || typeof evidence !== "object") throw new TypeError("Lifecycle evidence is required.");
  if (/postgres(?:ql)?:\/\//i.test(JSON.stringify(evidence))) {
    throw new Error("Lifecycle evidence cannot contain database connection strings.");
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
  return outputPath;
}

export {
  DISPOSABLE_COMPOSE_PROFILE,
  DISPOSABLE_COMPOSE_SERVICE,
  DISPOSABLE_IMAGE,
  FINANCIAL_E2E_MARKER,
  LOOPBACK_HOST,
  PHASE_AUTHORIZATION,
  PHASE_EVIDENCE_FILES,
};
