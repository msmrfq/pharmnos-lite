import {
    validateDatabaseIdentityEvidence,
    validateFinancialE2eTarget,
} from "./financial-e2e-safety.mjs";

export function validateFixtureCleanup({ runId, ownedIds, requestedIds }) {
    const errors = [];
    const owner = String(runId ?? "").trim();
    const owned = new Set((ownedIds ?? []).map((id) => String(id).trim()).filter(Boolean));
    const requested = (requestedIds ?? []).map((id) => String(id).trim()).filter(Boolean);

    if (!owner) errors.push("A test-run ownership identifier is required.");
    if (requested.length === 0) errors.push("Cleanup must name records owned by the test run.");
    if (new Set(requested).size !== requested.length) errors.push("Cleanup identifiers must be unique.");
    for (const id of requested) {
        if (!owned.has(id)) errors.push(`Cleanup identifier is not owned by test run: ${id}.`);
    }

    return { ok: errors.length === 0, errors };
}

export async function validateFinancialE2eReadiness({
    target,
    fixtureStrategy,
    cleanupStrategy,
    identityEvidence,
    databaseRole,
    runId,
    now = Date.now(),
    executionAuthorized = false,
    scenarioRunnerEnabled = false,
}) {
    const errors = [];
    const targetResult = await validateFinancialE2eTarget(target ?? {});

    if (!targetResult.ok) errors.push(...targetResult.errors);
    if (!fixtureStrategy?.name || !fixtureStrategy?.tenantOwnershipKey) {
        errors.push("A documented tenant fixture strategy and ownership key are required.");
    }
    if (!fixtureStrategy?.userStrategy) {
        errors.push("A documented test-user fixture strategy is required.");
    }
    if (!cleanupStrategy?.name || !cleanupStrategy?.ownershipRule) {
        errors.push("A documented cleanup strategy and ownership rule are required.");
    }
    if (cleanupStrategy?.explicitlyGated !== true) {
        errors.push("Cleanup must have an explicit authorization gate.");
    }
    const identityResult = validateDatabaseIdentityEvidence({
        evidence: identityEvidence,
        expectedDatabase: target?.testDatabaseName,
        expectedRole: databaseRole,
        targetUrl: target?.testUrl,
        runId,
        now,
    });
    if (!identityResult.ok) {
        errors.push(identityResult.error);
    }
    if (executionAuthorized !== true) {
        errors.push("Financial E2E execution requires explicit authorization.");
    }
    if (scenarioRunnerEnabled === true) {
        errors.push("The scenario runner must remain disabled until all execution gates are satisfied.");
    }

    const configurationReady = targetResult.ok &&
        Boolean(fixtureStrategy?.name && fixtureStrategy?.tenantOwnershipKey && fixtureStrategy?.userStrategy) &&
        Boolean(cleanupStrategy?.name && cleanupStrategy?.ownershipRule && cleanupStrategy?.explicitlyGated === true);

    return {
        ok: errors.length === 0,
        configurationReady,
        canExecute: errors.length === 0 && scenarioRunnerEnabled === false,
        errors,
    };
}
