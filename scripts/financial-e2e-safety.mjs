const REQUIRED_MARKER = "pharmnos-financial-e2e";

function connectionIdentity(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return [url.protocol, url.hostname, url.port || "5432", url.pathname, url.username].join("|");
    } catch {
        return null;
    }
}

export function validateFinancialE2eTarget({
    testUrl,
    ordinaryUrl,
    testDatabaseName,
    marker,
}) {
    const errors = [];
    const test = String(testUrl ?? "").trim();
    const ordinary = String(ordinaryUrl ?? "").trim();
    const databaseName = String(testDatabaseName ?? "").trim();
    const applicationMarker = String(marker ?? "").trim();

    if (!test) errors.push("TEST_DATABASE_URL is required.");
    if (!ordinary) errors.push("DATABASE_URL is required to compare the test target.");
    if (!databaseName) errors.push("TEST_DATABASE_NAME is required.");
    if (!applicationMarker) errors.push("TEST_DATABASE_MARKER is required.");

    if (test && ordinary && test === ordinary) {
        errors.push("TEST_DATABASE_URL must differ from DATABASE_URL.");
    }

    const testIdentity = test ? connectionIdentity(test) : null;
    const ordinaryIdentity = ordinary ? connectionIdentity(ordinary) : null;
    if (test && !testIdentity) errors.push("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
    if (ordinary && !ordinaryIdentity) errors.push("DATABASE_URL must be a valid PostgreSQL URL.");
    if (testIdentity && ordinaryIdentity && testIdentity === ordinaryIdentity) {
        errors.push("TEST_DATABASE_URL must target a different database identity than DATABASE_URL.");
    }

    if (databaseName && !/(test|e2e)/i.test(databaseName)) {
        errors.push("TEST_DATABASE_NAME must identify an isolated test database.");
    }
    if (applicationMarker !== REQUIRED_MARKER) {
        errors.push(`TEST_DATABASE_MARKER must equal ${REQUIRED_MARKER}.`);
    }
    if (test && !test.includes(`application_name=${REQUIRED_MARKER}`)) {
        errors.push("TEST_DATABASE_URL must include the financial E2E application marker.");
    }

    return { ok: errors.length === 0, errors };
}

export { REQUIRED_MARKER };
