import {
    targetBinding,
    validateDatabaseIdentityEvidence,
    validateFinancialE2eTarget,
    validateLocalDisposableTargetCandidate,
} from "./financial-e2e-safety.mjs";
import {
    REQUIRED_INITIALIZATION_SEQUENCE,
    validateInitializationAuthorizationEvidence,
    validateConnectedInitializationSequence,
} from "./financial-e2e-initialization-contract.mjs";
import {
    verifyCheckedInArtifactManifest,
} from "./financial-e2e-artifact-package.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const TRUSTED_REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REVIEWED_EXPECTATIONS_PATH = path.join(TRUSTED_REPOSITORY_ROOT, "scripts", "financial-e2e-reviewed-expectations.json");
const MARKER = "pharmnos-financial-e2e";
const STRATEGY = "BOOTSTRAP_CONNECTED_CATALOG_READBACK";
const STATES = Object.freeze([
    "NOT_STARTED",
    "PREPARATION_VALIDATED",
    "MARKER_ESTABLISHMENT_ATTEMPTED",
    "MARKER_READBACK_VERIFIED",
    "CATALOG_VERIFICATION_PASSED",
    "RUNTIME_VERIFICATION_PASSED",
    "COMPLETED",
    "FAILED",
    "UNTRUSTED",
]);

function failure(state, errors, details = {}) {
    return Object.freeze({
        ok: false,
        state,
        errors: [...new Set(errors)],
        ...details,
    });
}

function contextOf(input) {
    return {
        runId: String(input.runId ?? "").trim(),
        initializationAttemptId: String(input.initializationAttemptId ?? "").trim(),
        binding: targetBinding(input.target?.testUrl),
        now: input.now ?? Date.now(),
        maxAgeMs: input.maxAgeMs ?? 5 * 60 * 1000,
    };
}

function freshBound(result, context, label) {
    if (!result || typeof result !== "object") return `${label} evidence is required.`;
    if (result.runId !== context.runId ||
        result.initializationAttemptId !== context.initializationAttemptId ||
        result.targetBinding !== context.binding) {
        return `${label} evidence is not bound to the approved run, attempt, and target.`;
    }
    if (!Number.isFinite(result.verifiedAt) ||
        context.now - result.verifiedAt < 0 ||
        context.now - result.verifiedAt > context.maxAgeMs) {
        return `${label} evidence is stale, missing, or from the future.`;
    }
    return null;
}

function sanitize(value) {
    return String(value ?? "unknown")
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
        .replace(/([?&]?(?:password|pass|secret|token|apikey|api_key)\s*[:=]\s*)[^&\s,;]+/gi, "$1[REDACTED]")
        .slice(0, 500);
}

function loadReviewedExpectations() {
    const expectations = JSON.parse(fs.readFileSync(REVIEWED_EXPECTATIONS_PATH, "utf8"));
    if (expectations.version !== 1 || expectations.approved !== false ||
        expectations.status !== "REVIEW_ONLY_PENDING_OWNER_APPROVAL" ||
        !expectations.catalog || !expectations.rls) {
        throw new Error("The checked-in reviewed verification expectations are invalid or unexpectedly approved.");
    }
    return expectations;
}

function validateExpectationList(value, label) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string")
        ? null
        : `${label} expectations are missing or ambiguous.`;
}

function validateReviewedVerification(result, prepared, label) {
    if (!result || typeof result !== "object" || result.expectationsSatisfied !== undefined ||
        result.expectationSource !== undefined || result.expectedArtifactHashes !== undefined) {
        return `${label} cannot accept caller-supplied expectation assertions.`;
    }
    const expected = prepared.expectations[label.toLowerCase()];
    const observed = result.observed;
    if (!expected || !observed || typeof observed !== "object") {
        return `${label} verification observations and reviewed expectations are required.`;
    }
    for (const key of Object.keys(expected)) {
        const expectedError = validateExpectationList(expected[key], `${label}.${key}`);
        if (expectedError) return expectedError;
        if (!Array.isArray(observed[key]) ||
            JSON.stringify([...observed[key]].sort()) !== JSON.stringify([...expected[key]].sort())) {
            return `${label}.${key} does not match the reviewed expectations.`;
        }
    }
    return null;
}

export function createSanitizedEvidence({
    context,
    artifactHashes,
    state,
    verification,
    failureClassification,
} = {}) {
    if (!context?.binding || !ID_PATTERN.test(context.runId) || !ID_PATTERN.test(context.initializationAttemptId)) {
        throw new TypeError("Evidence requires valid target, run, and attempt binding.");
    }
    if (!Array.isArray(artifactHashes) || artifactHashes.some((hash) => !/^[a-f0-9]{64}$/.test(hash))) {
        throw new TypeError("Evidence requires sanitized artifact hashes.");
    }
    return Object.freeze({
        evidenceVersion: 1,
        targetBinding: context.binding,
        runId: context.runId,
        initializationAttemptId: context.initializationAttemptId,
        generatedAt: context.now,
        state,
        artifactHashes: [...artifactHashes],
        verification: Object.freeze({ ...verification }),
        failureClassification: failureClassification ? sanitize(failureClassification) : undefined,
    });
}

function validatePreparation(input, context) {
    const errors = [];
    if (!context.binding || !ID_PATTERN.test(context.runId) || !ID_PATTERN.test(context.initializationAttemptId)) {
        errors.push("Valid target, run ID, and initialization-attempt ID are required.");
    }
    const authorizationError = validateInitializationAuthorizationEvidence(input.authorization, {
        ...context,
        attemptId: context.initializationAttemptId,
    });
    if (authorizationError) errors.push(authorizationError);
    if (input.initializationScope !== "DATABASE_INITIALIZATION_ONLY") {
        errors.push("Initialization-only scope is required.");
    }
    if (input.markerEstablishmentMethod !== STRATEGY) {
        errors.push("The approved bootstrap marker strategy is required.");
    }
    if (!input.bootstrapRole || !input.runtimeRole || input.bootstrapRole === input.runtimeRole) {
        errors.push("Distinct bootstrap and runtime roles are required.");
    }
    if (input.bootstrapRole !== "pharmnos_e2e" || input.runtimeRole !== "pharmnos_e2e_runtime") {
        errors.push("The approved bootstrap and runtime roles are required.");
    }
    if (!input.target?.testUrl || !input.target?.ordinaryUrl) {
        errors.push("Independent ordinary-target comparison is required.");
    } else {
        let parsedTarget;
        try {
            parsedTarget = new URL(input.target.testUrl);
        } catch {
            errors.push("The disposable target URL is invalid.");
        }
        if (parsedTarget &&
            !["127.0.0.1", "::1", "localhost"].includes(parsedTarget.hostname.toLowerCase())) {
            errors.push("The local disposable adapter requires a loopback target URL.");
        }
        if (parsedTarget && input.candidateTarget &&
            (input.candidateTarget.host !== parsedTarget.hostname ||
                input.candidateTarget.port !== Number(parsedTarget.port || 5432) ||
                input.candidateTarget.databaseName !== input.target.testDatabaseName ||
                input.candidateTarget.bootstrapRole !== parsedTarget.username)) {
            errors.push("Candidate target metadata does not match the approved target URL.");
        }
    }
    return errors;
}

export async function prepareConnectedInitialization(input) {
    const context = contextOf(input);
    const errors = validatePreparation(input, context);
    if (errors.length) return failure("FAILED", errors);
    const target = await validateFinancialE2eTarget(input.target);
    if (!target.ok) return failure("FAILED", target.errors);
    const candidate = input.candidateTarget;
    const candidateResult = validateLocalDisposableTargetCandidate(candidate);
    if (!candidateResult.ok) {
        return failure("FAILED", candidateResult.errors);
    }
    const sequence = validateConnectedInitializationSequence(REQUIRED_INITIALIZATION_SEQUENCE);
    if (!sequence.ok) return failure("FAILED", sequence.errors);
    let artifactResult;
    try {
        const manifest = verifyCheckedInArtifactManifest(TRUSTED_REPOSITORY_ROOT);
        artifactResult = manifest.manifest
            ? manifest
            : { ok: true, manifest };
    } catch (error) {
        return failure("FAILED", [sanitize(error?.message)]);
    }
    if (!artifactResult.ok) return failure("FAILED", artifactResult.errors);
    let expectations;
    try {
        expectations = loadReviewedExpectations();
        const expectedApproval = false;
        if (!expectations || expectations.version !== 1 ||
            expectations.approved !== expectedApproval ||
            expectations.status !== "REVIEW_ONLY_PENDING_OWNER_APPROVAL") {
            return failure("FAILED", ["Trusted reviewed verification expectations are not approved for this execution boundary."]);
        }
    } catch (error) {
        return failure("FAILED", [sanitize(error?.message)]);
    }
    return {
        ok: true,
        state: "PREPARATION_VALIDATED",
        context,
        artifactHashes: artifactResult.manifest.artifacts.map((artifact) => artifact.sha256),
        expectations,
        errors: [],
    };
}

export async function runConnectedInitialization(input, operations) {
    const prepared = await prepareConnectedInitialization(input);
    if (!prepared.ok) return prepared;
    const requiredOperations = [
        "establishMarker",
        "readIdentity",
        "verifyCatalog",
        "reconnectRuntime",
        "verifyRls",
    ];
    if (!operations || requiredOperations.some((name) => typeof operations[name] !== "function")) {
        return failure("FAILED", ["Connected initialization operations are incomplete."]);
    }
    const results = {};
    try {
        for (const name of requiredOperations) {
            results[name] = await operations[name]({
                input,
                context: prepared.context,
                artifactHashes: prepared.artifactHashes,
                expectations: prepared.expectations,
            });
        }
    } catch (error) {
        return failure("FAILED", [sanitize(error?.message)]);
    }
    return {
        ok: true,
        state: "COMPLETED",
        context: prepared.context,
        artifactHashes: prepared.artifactHashes,
        verification: results,
        errors: [],
    };
}

export { MARKER, STATES, STRATEGY };
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
