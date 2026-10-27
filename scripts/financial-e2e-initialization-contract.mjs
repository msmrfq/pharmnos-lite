import {
    targetBinding,
    validateDatabaseIdentityEvidence,
    validateFinancialE2eTarget,
} from "./financial-e2e-safety.mjs";

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const REQUIRED_MARKER = "pharmnos-financial-e2e";
const REQUIRED_INITIALIZATION_SEQUENCE = Object.freeze([
    "validate_authorization",
    "validate_target_and_roles",
    "establish_marker_bootstrap_only",
    "read_back_marker_and_identity",
    "verify_catalog_and_artifacts",
    "reconnect_runtime_and_verify_rls",
    "emit_sanitized_evidence",
]);

export function validateConnectedInitializationSequence(sequence) {
    if (!Array.isArray(sequence) ||
        sequence.length !== REQUIRED_INITIALIZATION_SEQUENCE.length ||
        sequence.some((step, index) => step !== REQUIRED_INITIALIZATION_SEQUENCE[index])) {
        return {
            ok: false,
            errors: ["Connected initialization must use the approved fail-closed sequence."],
        };
    }
    return { ok: true, errors: [] };
}

function failure(errors) {
    return {
        ok: false,
        ready: false,
        evidenceClass: "SYNTHETIC_OFFLINE",
        errors: [...new Set(errors)],
    };
}

function hasFreshBinding(evidence, { runId, attemptId, binding, now, maxAgeMs, label }) {
    if (!evidence || typeof evidence !== "object") {
        return `${label} evidence is required.`;
    }
    if (evidence.runId !== runId || evidence.initializationAttemptId !== attemptId) {
        return `${label} evidence is not bound to this run and initialization attempt.`;
    }
    if (evidence.targetBinding !== binding) {
        return `${label} evidence is not bound to the approved disposable target.`;
    }
    if (!Number.isFinite(evidence.verifiedAt) ||
        now - evidence.verifiedAt < 0 ||
        now - evidence.verifiedAt > maxAgeMs) {
        return `${label} evidence is missing, stale, or from the future.`;
    }
    return null;
}

export function validateInitializationAuthorizationEvidence(authorization, { runId, attemptId, binding, now, maxAgeMs }) {
    if (!authorization || authorization.approved !== true) {
        return "Explicit authorization for the exact disposable target is required.";
    }
    if (authorization.runId !== runId || authorization.initializationAttemptId !== attemptId) {
        return "Initialization authorization is not bound to this run and attempt.";
    }
    if (authorization.targetBinding !== binding) {
        return "Initialization authorization is not bound to the approved target.";
    }
    if (!Number.isFinite(authorization.authorizedAt) ||
        now - authorization.authorizedAt < 0 ||
        now - authorization.authorizedAt > maxAgeMs) {
        return "Initialization authorization is missing, stale, or from the future.";
    }
    return null;
}

function validateMarkerEvidence(evidence, context) {
    const bindingError = hasFreshBinding(evidence, { ...context, label: "Independent marker" });
    if (bindingError) return bindingError;
    if (evidence.source !== "connected_catalog" || evidence.independentlyEstablished !== true) {
        return "Independent marker evidence is not independent without connected catalog verification.";
    }
    if (evidence.marker !== REQUIRED_MARKER || evidence.databaseName !== context.databaseName) {
        return "Independent disposable marker does not match the approved target.";
    }
    if (evidence.configurationSource === "environment" ||
        evidence.configurationSource === "connection_string" ||
        evidence.configurationSource === "caller") {
        return "Configuration-supplied marker evidence is not independent.";
    }
    return null;
}

function validateRoleEvidence(evidence, context) {
    const bindingError = hasFreshBinding(evidence, { ...context, label: "Role" });
    if (bindingError) return bindingError;
    if (evidence.bootstrapRole !== context.bootstrapRole ||
        evidence.runtimeRole !== context.runtimeRole ||
        evidence.bootstrapRole === evidence.runtimeRole) {
        return "Bootstrap and runtime roles must be distinct approved principals.";
    }
    const runtime = evidence.runtime;
    if (!runtime || runtime.rolcanlogin !== true ||
        runtime.rolsuper !== false ||
        runtime.rolbypassrls !== false) {
        return "Runtime role must be LOGIN, NOSUPERUSER, and NOBYPASSRLS.";
    }
    if (evidence.bootstrap?.rolcanlogin !== true) {
        return "Bootstrap role login evidence is required.";
    }
    return null;
}

function validateCatalogEvidence(evidence, context) {
    const bindingError = hasFreshBinding(evidence, { ...context, label: "Catalog" });
    if (bindingError) return bindingError;
    const required = [
        ["schemaRestrictionsVerified", "schema restriction"],
        ["leastPrivilegeVerified", "least-privilege grant"],
        ["defaultPrivilegesVerified", "default privilege"],
        ["rlsVerified", "RLS"],
        ["triggerOwnershipVerified", "trigger ownership"],
    ];
    for (const [key, label] of required) {
        if (evidence[key] !== true) return `Connected ${label} verification is required.`;
    }
    if (evidence.unexpectedPrivileges === true ||
        evidence.contradictory === true ||
        evidence.publicSchemaPopulated === true) {
        return "Connected catalog evidence contains an unsafe or contradictory result.";
    }
    return null;
}

export async function evaluateDisposableInitialization({
    authorization,
    target,
    runId,
    initializationAttemptId,
    bootstrapRole,
    runtimeRole,
    bootstrapEvidence,
    markerEvidence,
    roleEvidence,
    catalogEvidence,
    identityEvidence,
    now = Date.now(),
    maxAgeMs = DEFAULT_MAX_AGE_MS,
}) {
    const errors = [];
    const normalizedRunId = String(runId ?? "").trim();
    const normalizedAttemptId = String(initializationAttemptId ?? "").trim();
    if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(normalizedRunId)) {
        errors.push("A valid run ID is required.");
    }
    if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(normalizedAttemptId)) {
        errors.push("A valid initialization attempt ID is required.");
    }
    const binding = targetBinding(target?.testUrl);
    if (!binding) errors.push("An approved PostgreSQL disposable target is required.");

    let targetResult;
    if (binding) {
        targetResult = await validateFinancialE2eTarget(target);
        if (!targetResult.ok) errors.push(...targetResult.errors);
    }
    if (!bootstrapRole || !runtimeRole) {
        errors.push("Approved bootstrap and runtime roles are required.");
    }
    if (bootstrapRole && runtimeRole && bootstrapRole === runtimeRole) {
        errors.push("Bootstrap and runtime roles must be distinct.");
    }
    if (errors.length > 0) return failure(errors);

    const context = {
        runId: normalizedRunId,
        attemptId: normalizedAttemptId,
        binding,
        now,
        maxAgeMs,
        databaseName: target.testDatabaseName,
        bootstrapRole,
        runtimeRole,
    };
    for (const error of [
        validateInitializationAuthorizationEvidence(authorization, context),
        hasFreshBinding(bootstrapEvidence, { ...context, label: "Bootstrap identity" }),
        validateMarkerEvidence(markerEvidence, context),
        validateRoleEvidence(roleEvidence, context),
        validateCatalogEvidence(catalogEvidence, context),
    ]) {
        if (error) errors.push(error);
    }

    const identityResult = validateDatabaseIdentityEvidence({
        evidence: identityEvidence,
        expectedDatabase: target.testDatabaseName,
        expectedRole: runtimeRole,
        targetUrl: target.testUrl,
        runId: normalizedRunId,
        now,
        maxAgeMs,
    });
    if (!identityResult.ok) errors.push(`Post-initialization identity: ${identityResult.error}`);

    if (errors.length > 0) return failure(errors);
    return {
        ok: true,
        ready: true,
        evidenceClass: "SYNTHETIC_OFFLINE",
        runId: normalizedRunId,
        initializationAttemptId: normalizedAttemptId,
        targetBound: true,
        connectedVerificationModeled: true,
        databaseAccessed: false,
        scenarioRunnerEnabled: false,
        errors: [],
    };
}

export { DEFAULT_MAX_AGE_MS, REQUIRED_MARKER, REQUIRED_INITIALIZATION_SEQUENCE };
