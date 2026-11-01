import crypto from "node:crypto";
import fs from "node:fs";

export const TARGET_CONTRACT_VERSION = 1;
export const REQUIRED_TARGET_MARKER = "pharmnos-financial-e2e";
export const REQUIRED_TARGET_SERVICE = "financial-e2e-postgres";
export const REQUIRED_TARGET_PROFILE = "financial-e2e";
export const REQUIRED_BOOTSTRAP_ROLE = "pharmnos_e2e";
export const REQUIRED_RUNTIME_ROLE = "pharmnos_e2e_runtime";
export const REQUIRED_BOOTSTRAP_CREDENTIAL_SOURCE = "FINANCIAL_E2E_DB_PASSWORD";
export const REQUIRED_RUNTIME_CREDENTIAL_SOURCE = "FINANCIAL_E2E_RUNTIME_DB_PASSWORD";
export const REQUIRED_SCHEMA_ARTIFACT = "prisma/financial-e2e-schema-provisioning.generated.sql";

function isLoopbackHost(host) {
    return ["127.0.0.1", "::1", "localhost"].includes(String(host ?? "").toLowerCase());
}

function parseUrl(raw, label) {
    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error(`${label} must be a PostgreSQL URL.`);
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
        throw new Error(`${label} must be a PostgreSQL URL.`);
    }
    return url;
}

function normalizedUrlIdentity(raw, label) {
    const url = parseUrl(raw, label);
    return {
        protocol: url.protocol,
        host: url.hostname.toLowerCase(),
        port: Number(url.port || 5432),
        database: decodeURIComponent(url.pathname.slice(1)),
        user: decodeURIComponent(url.username),
    };
}

function endpointKey(identity) {
    return [identity.protocol, identity.host, identity.port, identity.database].join("|");
}

function exactRunId(value) {
    return /^[a-z0-9][a-z0-9_-]{2,63}$/.test(String(value ?? ""));
}

function exactProject(value) {
    return /^pharmnoslite(?:-financial-e2e(?:-[a-z0-9][a-z0-9_-]*)?)?$/.test(String(value ?? ""));
}

function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
    return value;
}

export function targetContractBinding(contract) {
    if (!contract || typeof contract !== "object") return null;
    return [
        contract.version,
        contract.runId,
        contract.host,
        contract.port,
        contract.databaseName,
        contract.bootstrapRole,
        contract.runtimeRole,
        contract.bootstrapCredentialSource,
        contract.runtimeCredentialSource,
        contract.marker,
        contract.composeProject,
        contract.composeService,
        contract.schemaArtifactHash,
    ].join("|");
}

export function createTargetContract({
    runId,
    targetUrl,
    runtimeUrl,
    databaseName,
    marker = REQUIRED_TARGET_MARKER,
    bootstrapRole = REQUIRED_BOOTSTRAP_ROLE,
    runtimeRole = REQUIRED_RUNTIME_ROLE,
    bootstrapCredentialSource = REQUIRED_BOOTSTRAP_CREDENTIAL_SOURCE,
    runtimeCredentialSource = REQUIRED_RUNTIME_CREDENTIAL_SOURCE,
    composeProject,
    composeService = REQUIRED_TARGET_SERVICE,
    composeProfile = REQUIRED_TARGET_PROFILE,
    schemaArtifactHash,
    authorizedAt = Date.now(),
    expiresAt,
} = {}) {
    const target = normalizedUrlIdentity(targetUrl, "TEST_DATABASE_URL");
    const runtime = normalizedUrlIdentity(runtimeUrl, "FINANCIAL_E2E_RUNTIME_DATABASE_URL");
    const contract = {
        version: TARGET_CONTRACT_VERSION,
        runId: String(runId ?? ""),
        host: target.host,
        port: target.port,
        databaseName: String(databaseName ?? ""),
        bootstrapRole: String(bootstrapRole ?? ""),
        runtimeRole: String(runtimeRole ?? ""),
        bootstrapCredentialSource: String(bootstrapCredentialSource ?? ""),
        runtimeCredentialSource: String(runtimeCredentialSource ?? ""),
        marker: String(marker ?? ""),
        composeProject: String(composeProject ?? ""),
        composeService: String(composeService ?? ""),
        composeProfile: String(composeProfile ?? ""),
        schemaArtifact: REQUIRED_SCHEMA_ARTIFACT,
        schemaArtifactHash: String(schemaArtifactHash ?? ""),
        authorizedAt,
        expiresAt,
    };
    const result = validateTargetContract({
        contract,
        targetUrl,
        runtimeUrl,
        ordinaryUrl: process.env.DATABASE_URL,
    });
    if (!result.ok) throw new Error(result.errors.join(" "));
    return freeze(contract);
}

export function validateTargetContract({
    contract,
    targetUrl,
    runtimeUrl,
    ordinaryUrl,
    now = Date.now(),
} = {}) {
    const errors = [];
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
        return { ok: false, errors: ["An immutable financial E2E target contract is required."] };
    }
    if (contract.version !== TARGET_CONTRACT_VERSION) errors.push("Unsupported target contract version.");
    if (!exactRunId(contract.runId)) errors.push("Target contract run ID is invalid.");
    if (!isLoopbackHost(contract.host)) errors.push("Target contract host must be loopback.");
    if (!Number.isInteger(contract.port) || contract.port <= 0 || contract.port > 65535 || contract.port === 5432) {
        errors.push("Target contract port must be a non-default disposable port.");
    }
    if (!/^pharmnos_financial_e2e(?:_[a-z0-9][a-z0-9_-]*)?$/.test(contract.databaseName ?? "")) {
        errors.push("Target contract database name is not disposable.");
    }
    if (contract.bootstrapRole !== REQUIRED_BOOTSTRAP_ROLE ||
        contract.runtimeRole !== REQUIRED_RUNTIME_ROLE ||
        contract.bootstrapRole === contract.runtimeRole) {
        errors.push("Target contract roles are not the approved distinct roles.");
    }
    if (contract.bootstrapCredentialSource !== REQUIRED_BOOTSTRAP_CREDENTIAL_SOURCE ||
        contract.runtimeCredentialSource !== REQUIRED_RUNTIME_CREDENTIAL_SOURCE) {
        errors.push("Target contract credential sources are not the approved environment variables.");
    }
    if (contract.marker !== REQUIRED_TARGET_MARKER) errors.push("Target contract marker is invalid.");
    if (!exactProject(contract.composeProject)) errors.push("Target contract Compose project is invalid.");
    if (contract.composeService !== REQUIRED_TARGET_SERVICE ||
        contract.composeProfile !== REQUIRED_TARGET_PROFILE) {
        errors.push("Target contract Compose service/profile is invalid.");
    }
    if (contract.schemaArtifact !== REQUIRED_SCHEMA_ARTIFACT ||
        !/^[a-f0-9]{64}$/.test(contract.schemaArtifactHash ?? "")) {
        errors.push("Target contract schema artifact fingerprint is invalid.");
    }
    if (!Number.isFinite(contract.authorizedAt) || contract.authorizedAt > now) {
        errors.push("Target contract authorization time is invalid.");
    }
    if (!Number.isFinite(contract.expiresAt) || contract.expiresAt <= now) {
        errors.push("Target contract is missing or stale.");
    }

    let target;
    let runtime;
    let ordinary;
    try {
        target = normalizedUrlIdentity(targetUrl, "TEST_DATABASE_URL");
        runtime = normalizedUrlIdentity(runtimeUrl, "FINANCIAL_E2E_RUNTIME_DATABASE_URL");
        ordinary = ordinaryUrl ? normalizedUrlIdentity(ordinaryUrl, "DATABASE_URL") : null;
    } catch (error) {
        errors.push(error.message);
    }
    if (target) {
        if (endpointKey(target) !== [target.protocol, contract.host, contract.port, contract.databaseName].join("|")) {
            errors.push("TEST_DATABASE_URL does not match the authorized target contract.");
        }
        if (target.user !== contract.bootstrapRole) errors.push("TEST_DATABASE_URL uses an unauthorized bootstrap role.");
    }
    if (runtime) {
        if (endpointKey(runtime) !== [runtime.protocol, contract.host, contract.port, contract.databaseName].join("|")) {
            errors.push("FINANCIAL_E2E_RUNTIME_DATABASE_URL does not match the authorized target contract.");
        }
        if (runtime.user !== contract.runtimeRole) errors.push("Runtime URL uses an unauthorized role.");
    }
    if (target && runtime && targetUrl === runtimeUrl) {
        errors.push("Bootstrap and runtime URLs must resolve to distinct credentials.");
    }
    if (ordinary && target && endpointKey(ordinary) === endpointKey(target)) {
        errors.push("Disposable target overlaps the ordinary database endpoint.");
    }
    return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function loadTargetContractFromEnv(env = process.env) {
    const raw = String(env.FINANCIAL_E2E_TARGET_CONTRACT ?? "").trim();
    if (!raw) throw new Error("FINANCIAL_E2E_TARGET_CONTRACT is required.");
    let contract;
    try {
        contract = JSON.parse(raw);
    } catch {
        throw new Error("FINANCIAL_E2E_TARGET_CONTRACT is invalid JSON.");
    }
    const result = validateTargetContract({
        contract,
        targetUrl: env.TEST_DATABASE_URL,
        runtimeUrl: env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
        ordinaryUrl: env.DATABASE_URL,
    });
    if (!result.ok) throw new Error(result.errors.join(" "));
    return freeze(contract);
}

export function schemaArtifactHash(path = REQUIRED_SCHEMA_ARTIFACT) {
    return crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}

export async function verifyTargetSchema(client, contract) {
    if (!client || typeof client.query !== "function") {
        throw new Error("A connected database client is required for schema verification.");
    }
    const rows = (await client.query(`
        SELECT
          to_regclass('public.users') IS NOT NULL AS users_present,
          to_regclass('public.purchase_gst_calculations') IS NOT NULL AS gst_tables_present,
          role.rolcanlogin,
          role.rolsuper,
          role.rolbypassrls
        FROM pg_roles AS role
        WHERE role.rolname = $1
    `, [contract.runtimeRole])).rows;
    const row = rows[0];
    if (!row?.users_present || !row?.gst_tables_present) {
        throw new Error("Connected target schema does not match the authorized financial-E2E baseline.");
    }
    if (row.rolcanlogin !== true || row.rolsuper !== false || row.rolbypassrls !== false) {
        throw new Error("Authorized runtime role must be LOGIN, NOSUPERUSER, and NOBYPASSRLS.");
    }
    return Object.freeze({ schemaVerified: true, runtimeRoleVerified: true });
}
