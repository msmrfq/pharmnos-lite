import dns from "node:dns/promises";
import net from "node:net";

const REQUIRED_MARKER = "pharmnos-financial-e2e";
const REQUIRED_ENVIRONMENT_MARKER = "pharmnos-financial-e2e";
const IDENTITY_EVIDENCE_VERSION = 1;
const DEFAULT_IDENTITY_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000;
const SUPABASE_HOST_PATTERN = /(^|\.)supabase\.(co|com)$/i;
const SUPABASE_POOLER_PATTERN = /(^|\.)(pooler|pgbouncer)(\.|$)/i;

function connectionIdentity(rawUrl) {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
        return {
            protocol: url.protocol,
            hostname: url.hostname.toLowerCase(),
            port: url.port || "5432",
            database: url.pathname,
            username: url.username,
        };
    } catch {
        return null;
    }
}

function identityKey(identity) {
    return [identity.protocol, identity.hostname, identity.port, identity.database, identity.username].join("|");
}

function isLoopbackHost(hostname) {
    const normalized = String(hostname ?? "").trim().toLowerCase();
    return normalized === "127.0.0.1" || normalized === "::1" || normalized === "localhost";
}

export function validateLocalDisposableTargetCandidate({
    serviceName,
    profile,
    host,
    port,
    databaseName,
    bootstrapRole,
    runtimeRole,
    marker,
    storage,
    isolationLabel,
    ordinaryTarget,
} = {}) {
    const errors = [];
    if (serviceName !== "financial-e2e-postgres") errors.push("The disposable service name is not approved.");
    if (profile !== "financial-e2e") errors.push("The disposable Compose profile is not approved.");
    if (!isLoopbackHost(host)) errors.push("The disposable database must bind to loopback only.");
    if (!Number.isInteger(port) || port <= 0 || port > 65535) errors.push("A valid disposable database port is required.");
    if (databaseName !== "pharmnos_financial_e2e") errors.push("The disposable database name is not approved.");
    if (bootstrapRole !== "pharmnos_e2e" || runtimeRole !== "pharmnos_e2e_runtime") {
        errors.push("The approved bootstrap and runtime roles are required.");
    }
    if (bootstrapRole === runtimeRole) errors.push("Bootstrap and runtime roles must be distinct.");
    if (marker !== REQUIRED_MARKER) errors.push(`The disposable marker must equal ${REQUIRED_MARKER}.`);
    if (storage !== "tmpfs") errors.push("Disposable database storage must be ephemeral tmpfs.");
    if (isolationLabel !== "financial-e2e-isolated") {
        errors.push("The disposable isolation label is required.");
    }
    if (!ordinaryTarget || typeof ordinaryTarget !== "object") {
        errors.push("Independent ordinary-target identity is required.");
    } else {
        if (ordinaryTarget.host === host && ordinaryTarget.port === port) {
            errors.push("Disposable target overlaps the ordinary database endpoint.");
        }
        if (ordinaryTarget.databaseName === databaseName) {
            errors.push("Disposable target overlaps the ordinary database name.");
        }
    }
    return { ok: errors.length === 0, errors };
}

function targetBinding(rawUrl) {
    const identity = connectionIdentity(rawUrl);
    return identity ? identityKey(identity) : null;
}

function resolvedIdentityKey(identity, address) {
    return [identity.protocol, address, identity.port].join("|");
}

function isBlockedHost(hostname) {
    return SUPABASE_HOST_PATTERN.test(hostname) ||
        SUPABASE_POOLER_PATTERN.test(hostname) ||
        hostname.toLowerCase().includes("supabase");
}

async function defaultResolveHost(hostname) {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    return normalizeResolvedAddresses(addresses.map(({ address }) => address));
}

function normalizeResolvedAddresses(addresses) {
    if (!Array.isArray(addresses) || addresses.length === 0) {
        throw new Error("Host resolution returned no valid addresses.");
    }
    const normalized = addresses.map((address) => {
        if (typeof address !== "string" || net.isIP(address.trim()) === 0) {
            throw new Error("Host resolution returned a malformed address.");
        }
        return address.trim().toLowerCase();
    });
    return [...new Set(normalized)].sort();
}

export async function validateFinancialE2eTarget({
    testUrl,
    ordinaryUrl,
    testDatabaseName,
    marker,
    resolveHost = defaultResolveHost,
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
    if (testIdentity && isBlockedHost(testIdentity.hostname)) {
        errors.push("TEST_DATABASE_URL must not target Supabase or a pooler endpoint.");
    }
    if (testIdentity && ordinaryIdentity && identityKey(testIdentity) === identityKey(ordinaryIdentity)) {
        errors.push("TEST_DATABASE_URL must target a different database identity than DATABASE_URL.");
    }

    if (testIdentity && ordinaryIdentity && errors.length === 0) {
        let testAddresses;
        let ordinaryAddresses;
        try {
            [testAddresses, ordinaryAddresses] = await Promise.all([
                resolveHost(testIdentity.hostname).then(normalizeResolvedAddresses),
                resolveHost(ordinaryIdentity.hostname).then(normalizeResolvedAddresses),
            ]);
        } catch {
            errors.push("Database endpoint host resolution failed; target identity cannot be independently verified.");
        }
        if (testAddresses && ordinaryAddresses) {
            if (testAddresses.length === 0 || ordinaryAddresses.length === 0) {
                errors.push("Database endpoint host resolution returned no addresses.");
            } else {
                const ordinaryResolved = new Set(ordinaryAddresses.map((address) =>
                    resolvedIdentityKey(ordinaryIdentity, address)));
                const sharesLiveResolvedIdentity = testAddresses.some((address) =>
                    ordinaryResolved.has(resolvedIdentityKey(testIdentity, address)));
                if (sharesLiveResolvedIdentity) {
                    errors.push("TEST_DATABASE_URL resolves to the same database endpoint identity as DATABASE_URL.");
                }
            }
        }
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

function failIdentity(message) {
    return { ok: false, error: message };
}

function normalizeServerAddress(value) {
    if (typeof value !== "string") return null;
    const parts = value.trim().split("/");
    if (parts.length > 2) return null;
    const address = parts[0];
    const version = net.isIP(address);
    if (version === 0) return null;
    if (parts.length === 1) return address.toLowerCase();
    if (!/^\d+$/.test(parts[1])) return null;
    const prefix = Number(parts[1]);
    return prefix <= (version === 4 ? 32 : 128) ? address.toLowerCase() : null;
}

export function validateDatabaseIdentityEvidence({
    evidence,
    expectedDatabase,
    expectedRole,
    expectedEnvironmentMarker = REQUIRED_ENVIRONMENT_MARKER,
    targetUrl,
    runId,
    now = Date.now(),
    maxAgeMs = DEFAULT_IDENTITY_EVIDENCE_MAX_AGE_MS,
}) {
    if (!evidence || typeof evidence !== "object") return failIdentity("Database identity evidence is required.");
    if (!expectedDatabase || !expectedRole || !targetUrl || !runId) {
        return failIdentity("Approved database identity context is required.");
    }
    if (evidence.version !== IDENTITY_EVIDENCE_VERSION) return failIdentity("Database identity evidence version is unsupported.");
    if (!runId || evidence.runId !== runId) return failIdentity("Database identity evidence is not bound to this test run.");
    const approvedTargetBinding = targetBinding(targetUrl);
    if (!approvedTargetBinding || evidence.targetBinding !== approvedTargetBinding) {
        return failIdentity("Database identity evidence is not bound to the approved test target.");
    }
    if (!Number.isFinite(evidence.verifiedAt) || now - evidence.verifiedAt < 0 || now - evidence.verifiedAt > maxAgeMs) {
        return failIdentity("Database identity evidence is missing, stale, or from the future.");
    }
    if (evidence.databaseName !== expectedDatabase) return failIdentity("Connected database identity does not match the approved test database.");
    if (evidence.currentUser !== expectedRole || evidence.sessionUser !== expectedRole) {
        return failIdentity("Connected database role does not match the approved test role.");
    }
    if (evidence.environmentMarker !== expectedEnvironmentMarker) {
        return failIdentity("Connected database environment marker does not match the approved disposable marker.");
    }
    if (evidence.applicationName !== REQUIRED_MARKER) return failIdentity("Connected database application marker is invalid.");
    if (evidence.rolsuper !== false || evidence.rolbypassrls !== false) {
        return failIdentity("The financial E2E role must not be superuser or BYPASSRLS.");
    }
    if (!normalizeServerAddress(evidence.serverAddress) ||
        !Number.isInteger(evidence.serverPort) || evidence.serverPort <= 0) {
        return failIdentity("Connected database server identity is incomplete.");
    }
    return { ok: true, evidence };
}

export async function verifyDatabaseIdentity({
    client,
    expectedDatabase,
    expectedRole,
    targetUrl,
    runId,
    expectedEnvironmentMarker = REQUIRED_ENVIRONMENT_MARKER,
    now = Date.now(),
    maxAgeMs = DEFAULT_IDENTITY_EVIDENCE_MAX_AGE_MS,
}) {
    if (!client || typeof client.query !== "function") {
        return failIdentity("A database client query interface is required.");
    }
    const result = await client.query(`
        SELECT
            current_database() AS database_name,
            current_user AS current_user_name,
            session_user AS session_user_name,
            inet_server_addr()::text AS server_address,
            inet_server_port() AS server_port,
            current_setting('application_name', true) AS application_name,
            current_setting('pharmnos.financial_e2e_marker', true) AS environment_marker,
            role.rolsuper AS rolsuper,
            role.rolbypassrls AS rolbypassrls
        FROM pg_roles AS role
        WHERE role.rolname = current_user
    `);
    const row = result?.rows?.[0];
    const evidence = Object.freeze({
        version: IDENTITY_EVIDENCE_VERSION,
        runId,
        targetBinding: targetBinding(targetUrl),
        verifiedAt: now,
        databaseName: row?.database_name,
        currentUser: row?.current_user_name,
        sessionUser: row?.session_user_name,
        serverAddress: normalizeServerAddress(row?.server_address),
        serverPort: row?.server_port,
        applicationName: row?.application_name,
        environmentMarker: row?.environment_marker,
        rolsuper: row?.rolsuper,
        rolbypassrls: row?.rolbypassrls,
    });
    return validateDatabaseIdentityEvidence({
        evidence,
        expectedDatabase,
        expectedRole,
        expectedEnvironmentMarker,
        targetUrl,
        runId,
        now,
        maxAgeMs,
    });
}

export {
    DEFAULT_IDENTITY_EVIDENCE_MAX_AGE_MS,
    IDENTITY_EVIDENCE_VERSION,
    REQUIRED_ENVIRONMENT_MARKER,
    REQUIRED_MARKER,
    identityKey,
    targetBinding,
};
