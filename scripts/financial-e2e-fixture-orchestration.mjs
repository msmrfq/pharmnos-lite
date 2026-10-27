import {
    createFixtureManifest,
    recordFixtureCreationFailure,
    recordFixtureIdentifiers,
} from "./financial-e2e-fixture-lifecycle.mjs";

function requireProvider(provider) {
    if (typeof provider !== "function") {
        throw new TypeError("Fixture orchestration requires an injected fixture provider.");
    }
}

function normalizeSpecification(specification) {
    if (!specification || typeof specification !== "object" || Array.isArray(specification)) {
        throw new TypeError("An approved fixture specification is required.");
    }
    if (!Array.isArray(specification.requiredResources) || specification.requiredResources.length === 0) {
        throw new TypeError("Fixture specification must require at least one resource.");
    }

    const required = specification.requiredResources.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new TypeError("Fixture resource requirements must be objects.");
        }
        const resourceType = String(entry.resourceType ?? "").trim();
        const count = entry.count === undefined ? 1 : entry.count;
        if (!resourceType || !Number.isInteger(count) || count < 1) {
            throw new TypeError("Fixture resource requirements need a type and positive count.");
        }
        return { resourceType, count };
    });
    const keys = required.map(({ resourceType }) => resourceType);
    if (new Set(keys).size !== keys.length) {
        throw new TypeError("Fixture resource requirements must not duplicate resource types.");
    }
    return Object.freeze(required.map((entry) => Object.freeze(entry)));
}

function providerIdentifiers(result) {
    if (!result || typeof result !== "object" || !Array.isArray(result.identifiers)) {
        throw new TypeError("Fixture provider must return an identifier list.");
    }
    return result.identifiers;
}

function validateCompleteness(identifiers, required) {
    const counts = new Map();
    for (const identifier of identifiers) {
        const resourceType = String(identifier?.resourceType ?? "").trim();
        counts.set(resourceType, (counts.get(resourceType) ?? 0) + 1);
    }
    for (const requirement of required) {
        if ((counts.get(requirement.resourceType) ?? 0) !== requirement.count) {
            throw new Error(
                `Fixture provider did not return the required ${requirement.count} ${requirement.resourceType} resource(s).`,
            );
        }
    }
    if (counts.size !== required.length) {
        throw new Error("Fixture provider returned a resource outside the approved specification.");
    }
}

function safeFailure(manifest, message, confirmedIdentifiers = []) {
    try {
        return recordFixtureCreationFailure(manifest, message, confirmedIdentifiers);
    } catch {
        return recordFixtureCreationFailure(manifest, message);
    }
}

export async function orchestrateRunOwnedFixtures({
    runId,
    specification,
    provider,
}) {
    const manifest = createFixtureManifest(runId);
    const required = normalizeSpecification(specification);
    requireProvider(provider);

    try {
        const identifiers = providerIdentifiers(await provider({
            runId: manifest.runId,
            specification: required,
        }));
        validateCompleteness(identifiers, required);
        return {
            ok: true,
            manifest: recordFixtureIdentifiers(manifest, identifiers),
        };
    } catch (error) {
        const confirmedIdentifiers = error?.confirmedIdentifiers;
        const failedManifest = safeFailure(
            manifest,
            error instanceof Error ? error.message : "Fixture creation failed.",
            Array.isArray(confirmedIdentifiers) ? confirmedIdentifiers : [],
        );
        return {
            ok: false,
            manifest: failedManifest,
            error: failedManifest.fixtureCreationError,
        };
    }
}
