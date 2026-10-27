#!/usr/bin/env node

import { Client } from "pg";
import {
    REQUIRED_MARKER,
    validateFinancialE2eTarget,
    verifyDatabaseIdentity,
} from "./financial-e2e-safety.mjs";
const BLOCKED_EXIT = 2;

function fail(message) {
    console.error(`FINANCIAL_E2E=BLOCKED: ${message}`);
    process.exitCode = BLOCKED_EXIT;
}

function readRequiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required.`);
    return value;
}

async function verifyConnectedIdentity(runtimeUrl, expectedDatabase, expectedRole, marker, runId) {
    const client = new Client({ connectionString: runtimeUrl, application_name: marker });
    await client.connect();
    try {
        return await verifyDatabaseIdentity({
            client,
            expectedDatabase,
            expectedRole,
            targetUrl: runtimeUrl,
            runId,
            expectedEnvironmentMarker: REQUIRED_MARKER,
        });
    } finally {
        await client.end();
    }
}

async function main() {
    fail("connected execution is disabled until the initialization adapter and approved executable package are available");
    return;
    if (process.env.ALLOW_FINANCIAL_E2E !== "true") {
        fail("set ALLOW_FINANCIAL_E2E=true explicitly before any financial test run");
        return;
    }

    let testUrl;
    let ordinaryUrl;
    let testDatabaseName;
    let marker;
    let runtimeUrl;
    let runtimeDatabaseRole;
    const runId = `financial-e2e-${Date.now()}`;
    try {
        testUrl = readRequiredEnv("TEST_DATABASE_URL");
        ordinaryUrl = readRequiredEnv("DATABASE_URL");
        testDatabaseName = readRequiredEnv("TEST_DATABASE_NAME");
        marker = readRequiredEnv("TEST_DATABASE_MARKER");
        runtimeUrl = readRequiredEnv("FINANCIAL_E2E_RUNTIME_DATABASE_URL");
        runtimeDatabaseRole = readRequiredEnv("FINANCIAL_E2E_RUNTIME_DB_USER");
        const safety = await validateFinancialE2eTarget({ testUrl, ordinaryUrl, testDatabaseName, marker });
        if (!safety.ok) throw new Error(safety.errors.join(" "));
        const runtimeSafety = await validateFinancialE2eTarget({
            testUrl: runtimeUrl,
            ordinaryUrl,
            testDatabaseName,
            marker,
        });
        if (!runtimeSafety.ok) throw new Error(runtimeSafety.errors.join(" "));
    } catch (error) {
        fail(error instanceof Error ? error.message : "safety preflight failed");
        return;
    }

    try {
        const identity = await verifyConnectedIdentity(runtimeUrl, testDatabaseName, runtimeDatabaseRole, marker, runId);
        if (!identity.ok) throw new Error(identity.error);
    } catch {
        fail("isolated test database identity could not be verified");
        return;
    }

    fail("scenario runner is not enabled; no financial mutations were executed");
}

main().catch(() => {
    fail("safety preflight failed");
});
