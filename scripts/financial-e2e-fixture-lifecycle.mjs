import { validateDatabaseIdentityEvidence } from "./financial-e2e-safety.mjs";

const RESOURCE_CLEANUP_ORDER = Object.freeze([
    "payments",
    "customer_ledgers",
    "supplier_ledgers",
    "stock_movements",
    "purchase_gst_reconciliation_event_lines",
    "purchase_gst_accounting_decisions",
    "purchase_gst_calculations",
    "purchase_gst_line_evidence",
    "purchase_gst_reconciliation_events",
    "purchase_posting_operations",
    "purchase_gst_evidence_revisions",
    "sales_invoice_items",
    "purchase_invoice_items",
    "sales_invoices",
    "product_batches",
    "purchase_invoices",
    "customers",
    "suppliers",
    "products",
    "audit_logs",
    "business_profiles",
    "role_permissions",
    "memberships",
    "roles",
    "users",
    "tenants",
]);

const RESOURCE_ORDER_INDEX = new Map(RESOURCE_CLEANUP_ORDER.map((name, index) => [name, index]));
const MANIFEST_KIND = "pharmnos-financial-e2e-fixture-manifest-v1";
const FIXTURE_READY_STATUS = "FIXTURE_READY";
const CLEANUP_READY_FAILURE_STATUS = "FIXTURE_FAILED_CLEANUP_READY";
const CLEANUP_COMPLETE_STATUS = "CLEANUP_COMPLETE";
const MANIFEST_KEYS = [
    "cleanupAuthorization",
    "cleanupCompletion",
    "cleanupError",
    "fixtureCreationError",
    "kind",
    "resources",
    "runId",
    "status",
].sort();
const RESOURCE_KEYS = ["id", "resourceType", "runId"];

function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
}

function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
    return isPlainObject(value) &&
        Object.keys(value).sort().join("|") === [...expectedKeys].sort().join("|");
}

function sameResourceSet(left, right) {
    return left.length === right.length && left.every((resource, index) =>
        resource.resourceType === right[index].resourceType &&
        resource.id === right[index].id &&
        resource.runId === right[index].runId);
}

function validateCleanupAuthorization(manifest) {
    const evidence = manifest.cleanupAuthorization;
    if (!hasExactKeys(evidence, ["resourceSnapshot"]) || !Array.isArray(evidence.resourceSnapshot)) {
        throw new Error("Cleanup authorization evidence must contain the authorized resource snapshot.");
    }
    const snapshot = validateResourceList(manifest, evidence.resourceSnapshot, { requireNonEmpty: true });
    if (!sameResourceSet(snapshot, manifest.resources)) {
        throw new Error("Cleanup authorization resource snapshot does not match the manifest resources.");
    }
}

function validateCleanupCompletion(manifest) {
    const completion = manifest.cleanupCompletion;
    if (!hasExactKeys(completion, ["plan"]) || !isPlainObject(completion.plan)) {
        throw new Error("Cleanup completion evidence must contain the authorized cleanup plan.");
    }
    validateCleanupPlan(manifest, completion.plan);
}

function validateCleanupPlan(manifest, plan) {
    if (!hasExactKeys(plan, ["order", "resources", "runId"]) || plan.runId !== manifest.runId || !Array.isArray(plan.order)) {
        throw new Error("Cleanup plan must contain exactly the run ID, order, and resources.");
    }
    if (plan.order.length !== RESOURCE_CLEANUP_ORDER.length ||
        plan.order.some((resourceType, index) => resourceType !== RESOURCE_CLEANUP_ORDER[index])) {
        throw new Error("Cleanup plan order does not match the authorized cleanup order.");
    }
    const planResources = validateResourceList(manifest, plan.resources, { requireNonEmpty: true });
    const expectedResources = [...manifest.resources].sort(
        (left, right) => RESOURCE_ORDER_INDEX.get(left.resourceType) - RESOURCE_ORDER_INDEX.get(right.resourceType),
    );
    if (!sameResourceSet(planResources, expectedResources)) {
        throw new Error("Cleanup plan does not match the authorized resource set.");
    }
    return { runId: plan.runId, resources: planResources, order: [...plan.order] };
}

function validateResourceList(manifest, resources, { requireNonEmpty = false } = {}) {
    if (!Array.isArray(resources) || (requireNonEmpty && resources.length === 0)) {
        throw new Error("Fixture resource list is required and must not be empty.");
    }
    const seen = new Set();
    return resources.map((resource) => {
        if (!hasExactKeys(resource, RESOURCE_KEYS)) {
            throw new Error("Fixture resources must contain exactly resource type, ID, and run ID.");
        }
        const resourceType = String(resource?.resourceType ?? "").trim();
        const id = String(resource?.id ?? "").trim();
        const runId = String(resource?.runId ?? "").trim();
        if (!resourceType || !id || !runId || runId !== manifest.runId) {
            throw new Error("Fixture identifiers must include a non-empty resource type, ID, and matching run ID.");
        }
        if (resourceType === "storage_objects") {
            throw new Error("Storage objects are prohibited in financial fixtures.");
        }
        if (!RESOURCE_ORDER_INDEX.has(resourceType)) {
            throw new Error(`Unsupported fixture resource type: ${resourceType}.`);
        }
        const key = `${resourceType}:${id}`;
        if (seen.has(key)) throw new Error(`Duplicate fixture identifier: ${key}.`);
        seen.add(key);
        return { resourceType, id, runId };
    });
}

function validateManifest(manifest) {
    if (!hasExactKeys(manifest, MANIFEST_KEYS) || manifest.kind !== MANIFEST_KIND || !validRunId(manifest.runId)) {
        throw new Error("Invalid financial E2E fixture manifest.");
    }
    const legalStates = new Set([
        "CREATED",
        FIXTURE_READY_STATUS,
        "FIXTURE_FAILED",
        CLEANUP_READY_FAILURE_STATUS,
        "CLEANUP_AUTHORIZED",
        "CLEANUP_FAILED",
        CLEANUP_COMPLETE_STATUS,
    ]);
    if (!legalStates.has(manifest.status)) throw new Error("Invalid fixture manifest state.");
    validateResourceList(manifest, manifest.resources);
    if (manifest.fixtureCreationError !== null && (typeof manifest.fixtureCreationError !== "string" || !manifest.fixtureCreationError.trim())) {
        throw new Error("Fixture creation error metadata must be null or a string.");
    }
    if (manifest.cleanupError !== null && (typeof manifest.cleanupError !== "string" || !manifest.cleanupError.trim())) {
        throw new Error("Cleanup error metadata must be null or a string.");
    }
    const failureHasError = typeof manifest.fixtureCreationError === "string";
    const cleanupHasError = typeof manifest.cleanupError === "string";
    if (manifest.status === "CREATED" && (manifest.resources.length !== 0 || failureHasError || manifest.cleanupAuthorization || manifest.cleanupCompletion || cleanupHasError)) {
        throw new Error("CREATED manifests cannot contain fixture resources, failure metadata, or cleanup evidence.");
    }
    if (manifest.status === FIXTURE_READY_STATUS && (manifest.resources.length === 0 || failureHasError || manifest.cleanupAuthorization || manifest.cleanupCompletion || cleanupHasError)) {
        throw new Error("FIXTURE_READY manifests require resources and cannot contain failure or cleanup evidence.");
    }
    if (manifest.status === "FIXTURE_FAILED" && (manifest.resources.length !== 0 || !failureHasError || manifest.cleanupAuthorization || manifest.cleanupCompletion || cleanupHasError)) {
        throw new Error("FIXTURE_FAILED manifests require only fixture-creation failure metadata.");
    }
    if (manifest.status === CLEANUP_READY_FAILURE_STATUS && (manifest.resources.length === 0 || !failureHasError || manifest.cleanupAuthorization || manifest.cleanupCompletion || cleanupHasError)) {
        throw new Error("Partial fixture failures require confirmed resources and fixture-creation failure metadata.");
    }
    if (manifest.status === "CLEANUP_AUTHORIZED" || manifest.status === "CLEANUP_FAILED" || manifest.status === CLEANUP_COMPLETE_STATUS) {
        if (manifest.resources.length === 0 || cleanupHasError !== (manifest.status === "CLEANUP_FAILED") || manifest.cleanupCompletion !== null) {
            if (manifest.status !== CLEANUP_COMPLETE_STATUS) throw new Error("Cleanup lifecycle metadata is contradictory.");
        }
        validateCleanupAuthorization(manifest);
    } else if (manifest.cleanupAuthorization !== null || manifest.cleanupCompletion !== null || cleanupHasError) {
        throw new Error("Cleanup evidence is not valid for this lifecycle state.");
    }
    if (manifest.status === CLEANUP_COMPLETE_STATUS) {
        if (cleanupHasError || !manifest.cleanupCompletion) throw new Error("CLEANUP_COMPLETE requires completion evidence and no cleanup error.");
        validateCleanupCompletion(manifest);
    }
    return manifest;
}

function validRunId(runId) {
    return /^[a-z0-9][a-z0-9_-]{2,63}$/.test(String(runId ?? "").trim());
}

export function createFixtureManifest(runId) {
    if (!validRunId(runId)) {
        throw new Error("Fixture run ID must be 3-64 lowercase letters, numbers, underscores, or dashes.");
    }
    return deepFreeze({
        kind: MANIFEST_KIND,
        runId: String(runId).trim(),
        status: "CREATED",
        resources: [],
        fixtureCreationError: null,
        cleanupError: null,
        cleanupAuthorization: null,
        cleanupCompletion: null,
    });
}

export function recordFixtureIdentifiers(manifest, identifiers) {
    validateManifest(manifest);
    if (manifest.status !== "CREATED") {
        throw new Error("Fixture identifiers can only be recorded on a newly created manifest.");
    }
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
        throw new Error("Fixture creation must return at least one owned identifier.");
    }

    const additions = validateResourceList(manifest, identifiers, { requireNonEmpty: true });
    const existing = new Set(manifest.resources.map((resource) => `${resource.resourceType}:${resource.id}`));
    for (const resource of additions) {
        const key = `${resource.resourceType}:${resource.id}`;
        if (existing.has(key)) throw new Error(`Duplicate fixture identifier: ${key}.`);
        existing.add(key);
    }

    return deepFreeze({
        ...manifest,
        status: FIXTURE_READY_STATUS,
        resources: [...manifest.resources, ...additions],
    });
}

export function recordFixtureCreationFailure(manifest, errorMessage, confirmedIdentifiers = []) {
    validateManifest(manifest);
    if (manifest.status !== "CREATED" && manifest.status !== FIXTURE_READY_STATUS) {
        throw new Error("Fixture creation failure cannot update this manifest.");
    }
    let resources = manifest.resources;
    if (manifest.status === "CREATED" && confirmedIdentifiers.length > 0) {
        resources = validateResourceList(manifest, confirmedIdentifiers, { requireNonEmpty: true });
    }
    const hasConfirmedOwnedResources = resources.length > 0;
    return deepFreeze({
        ...manifest,
        status: hasConfirmedOwnedResources ? CLEANUP_READY_FAILURE_STATUS : "FIXTURE_FAILED",
        resources,
        fixtureCreationError: String(errorMessage || "Fixture creation failed."),
    });
}

export function authorizeFixtureCleanup(manifest, {
    identityEvidence,
    targetUrl,
    databaseName,
    databaseRole,
    runId,
    cleanupAuthorized,
    now = Date.now(),
}) {
    validateManifest(manifest);
    if (manifest.status !== FIXTURE_READY_STATUS && manifest.status !== CLEANUP_READY_FAILURE_STATUS) {
        throw new Error("Cleanup requires a FIXTURE_READY or ownership-confirmed partial-failure manifest.");
    }
    const identityResult = validateDatabaseIdentityEvidence({
        evidence: identityEvidence,
        targetUrl,
        expectedDatabase: databaseName,
        expectedRole: databaseRole,
        runId,
        now,
    });
    if (!identityResult?.ok) {
        throw new Error(identityResult?.error || "Cleanup requires valid database identity evidence.");
    }
    if (cleanupAuthorized !== true) {
        throw new Error("Cleanup requires explicit authorization.");
    }
    return deepFreeze({
        ...manifest,
        status: "CLEANUP_AUTHORIZED",
        cleanupAuthorization: { resourceSnapshot: manifest.resources.map((resource) => ({ ...resource })) },
    });
}

export function buildOwnedCleanupPlan(manifest) {
    validateManifest(manifest);
    if (manifest.status !== "CLEANUP_AUTHORIZED") {
        throw new Error("Cleanup plan requires an authorized fixture manifest.");
    }
    validateCleanupAuthorization(manifest);
    const resources = [...manifest.resources].sort(
        (left, right) => RESOURCE_ORDER_INDEX.get(left.resourceType) - RESOURCE_ORDER_INDEX.get(right.resourceType),
    );
    return deepFreeze({
        runId: manifest.runId,
        resources,
        order: RESOURCE_CLEANUP_ORDER,
    });
}

export function recordCleanupFailure(manifest, errorMessage) {
    validateManifest(manifest);
    if (manifest.status !== "CLEANUP_AUTHORIZED") {
        throw new Error("Cleanup failure cannot update this manifest.");
    }
    return deepFreeze({
        ...manifest,
        status: "CLEANUP_FAILED",
        cleanupError: String(errorMessage || "Cleanup failed."),
    });
}

export function recordCleanupSuccess(manifest, result) {
    validateManifest(manifest);
    if (manifest.status !== "CLEANUP_AUTHORIZED") {
        throw new Error("Cleanup success requires an authorized cleanup manifest.");
    }
    const expectedPlan = buildOwnedCleanupPlan(manifest);
    if (!hasExactKeys(result, ["plan", "success"]) || result.success !== true) {
        throw new Error("Cleanup success requires an explicit executor success result and cleanup plan.");
    }
    const suppliedPlan = validateCleanupPlan(manifest, result.plan);
    if (!sameResourceSet(suppliedPlan.resources, expectedPlan.resources)) {
        throw new Error("Cleanup success result does not match the authorized cleanup plan.");
    }
    return deepFreeze({
        ...manifest,
        status: CLEANUP_COMPLETE_STATUS,
        cleanupError: null,
        cleanupCompletion: { plan: suppliedPlan },
    });
}

export function canStartFinancialScenario({
    manifest,
    identityEvidence,
    targetUrl,
    databaseName,
    databaseRole,
    runId,
    now = Date.now(),
    executionAuthorized,
    scenarioRunnerEnabled,
}) {
    try {
        validateManifest(manifest);
        const identityResult = validateDatabaseIdentityEvidence({
            evidence: identityEvidence,
            expectedDatabase: databaseName,
            expectedRole: databaseRole,
            targetUrl,
            runId,
            now,
        });
        return Boolean(
            manifest.status === FIXTURE_READY_STATUS &&
            identityResult.ok &&
            manifest.runId === runId &&
            executionAuthorized === true &&
            scenarioRunnerEnabled === false,
        );
    } catch {
        return false;
    }
}

export { CLEANUP_COMPLETE_STATUS, FIXTURE_READY_STATUS, MANIFEST_KIND, RESOURCE_CLEANUP_ORDER };
