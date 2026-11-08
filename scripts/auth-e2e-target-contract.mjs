import crypto from "node:crypto";

const CONTRACT_VERSION = 1;

function required(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function validRunId(value) {
  return /^[a-z0-9][a-z0-9_-]{2,63}$/.test(String(value ?? ""));
}

function validProject(value) {
  return /^pharmnoslite-authinfra_[a-z0-9][a-z0-9_-]{2,63}$/.test(String(value ?? ""));
}

function validFingerprint(value) {
  return /^[a-f0-9]{64}$/.test(String(value ?? ""));
}

function decodeJwt(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) throw new Error("Auth service-role credential is not a JWT.");
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Auth service-role credential has invalid JWT encoding.");
  }
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: parts[2] };
}

function verifyServiceRoleKey(secret, token) {
  const decoded = decodeJwt(token);
  if (decoded.header.alg !== "HS256" || decoded.payload.role !== "service_role") {
    throw new Error("Auth service-role credential has an unexpected algorithm or role.");
  }
  const expected = crypto.createHmac("sha256", secret).update(decoded.signingInput).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(decoded.signature))) {
    throw new Error("Auth service-role credential does not match the campaign JWT secret.");
  }
  if (!Number.isFinite(decoded.payload.exp) || decoded.payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Auth service-role credential is expired.");
  }
}

export function targetContractBinding(contract) {
  return [
    contract.version,
    contract.runId,
    contract.authHost,
    contract.authPort,
    contract.authDatabaseName,
    contract.composeProject,
    contract.authService,
    contract.financialTargetBinding,
    contract.financialTargetFingerprint,
  ].join("|");
}

export function targetContractFingerprint(contract) {
  return crypto.createHash("sha256").update(targetContractBinding(contract)).digest("hex");
}

export function createAuthE2eTargetContract({
  runId,
  authPort,
  authDatabaseName,
  composeProject,
  financialTargetBinding,
  financialTargetFingerprint,
  authorizedAt = Date.now(),
  expiresAt,
} = {}) {
  const contract = Object.freeze({
    version: CONTRACT_VERSION,
    runId: required(runId, "Auth E2E run ID"),
    authHost: "127.0.0.1",
    authPort: Number(authPort),
    authDatabaseName: required(authDatabaseName, "Auth database name"),
    composeProject: required(composeProject, "Auth Compose project"),
    authService: "auth-e2e-gotrue",
    financialTargetBinding: required(financialTargetBinding, "Financial target binding"),
    financialTargetFingerprint: required(financialTargetFingerprint, "Financial target fingerprint"),
    authorizedAt,
    expiresAt,
  });
  const errors = validateAuthE2eTargetContract(contract, {
    now: authorizedAt + 1,
  });
  if (errors.length) throw new Error(errors.join(" "));
  return contract;
}

export function validateAuthE2eTargetContract(contract, { now = Date.now() } = {}) {
  const errors = [];
  if (contract?.version !== CONTRACT_VERSION) errors.push("Unsupported Auth E2E target contract version.");
  if (!validRunId(contract?.runId)) errors.push("Auth E2E run ID is invalid.");
  if (contract?.authHost !== "127.0.0.1") errors.push("Auth E2E host must be loopback.");
  if (!Number.isInteger(contract?.authPort) || contract.authPort <= 0 || contract.authPort === 5432) {
    errors.push("Auth E2E port must be a non-default disposable port.");
  }
  if (!/^auth_[a-z0-9][a-z0-9_-]{2,63}$/.test(contract?.authDatabaseName ?? "")) {
    errors.push("Auth E2E database name is not disposable.");
  }
  if (!validProject(contract?.composeProject)) errors.push("Auth E2E Compose project is invalid.");
  if (contract?.authService !== "auth-e2e-gotrue") errors.push("Auth E2E service is not the approved GoTrue service.");
  if (!required(contract?.financialTargetBinding, "Financial target binding")) errors.push("Financial target binding is missing.");
  if (!validFingerprint(contract?.financialTargetFingerprint)) errors.push("Financial target fingerprint is invalid.");
  if (!Number.isFinite(contract?.authorizedAt) || contract.authorizedAt > now) errors.push("Auth authorization time is invalid.");
  if (!Number.isFinite(contract?.expiresAt) || contract.expiresAt <= now) errors.push("Auth target contract is missing or stale.");
  return errors;
}

export function validateAuthE2eEnvironment(env = process.env) {
  let contract;
  try {
    contract = JSON.parse(required(env.AUTH_E2E_TARGET_CONTRACT, "AUTH_E2E_TARGET_CONTRACT"));
  } catch (error) {
    throw new Error(error instanceof SyntaxError
      ? "AUTH_E2E_TARGET_CONTRACT must be valid JSON."
      : error.message);
  }
  const errors = validateAuthE2eTargetContract(contract);
  if (env.FINANCIAL_E2E_RUN_ID !== contract.runId) errors.push("Financial and Auth run IDs do not match.");
  if (env.AUTH_PORT !== String(contract.authPort)) errors.push("AUTH_PORT does not match the immutable Auth target.");
  if (env.AUTH_DB_NAME !== contract.authDatabaseName) errors.push("AUTH_DB_NAME does not match the immutable Auth target.");
  if (env.AUTH_COMPOSE_PROJECT !== contract.composeProject) errors.push("AUTH_COMPOSE_PROJECT does not match the immutable Auth target.");
  if (env.AUTH_E2E_AUTHORIZED_TARGET_BINDING !== targetContractBinding(contract)) {
    errors.push("Auth authorized target binding does not match the immutable target contract.");
  }
  if (env.AUTH_E2E_AUTHORIZED_TARGET_FINGERPRINT !== targetContractFingerprint(contract)) {
    errors.push("Auth authorized target fingerprint does not match the immutable target contract.");
  }
  try {
    verifyServiceRoleKey(required(env.AUTH_JWT_SECRET, "AUTH_JWT_SECRET"), required(env.AUTH_SERVICE_ROLE_KEY, "AUTH_SERVICE_ROLE_KEY"));
  } catch (error) {
    errors.push(error.message);
  }
  if (errors.length) throw new Error(`Auth E2E target gate failed: ${errors.join(" ")}`);
  return Object.freeze({ contract, targetBinding: targetContractBinding(contract), targetFingerprint: targetContractFingerprint(contract) });
}
