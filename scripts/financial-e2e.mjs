#!/usr/bin/env node

import { Client } from "pg";

const REQUIRED_MARKER = "pharmnos-financial-e2e";
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

function assertSafeTarget(testUrl, ordinaryUrl, testDatabaseName, marker) {
    if (testUrl === ordinaryUrl) {
        throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL.");
    }
    if (!testDatabaseName.toLowerCase().includes("test") && !testDatabaseName.toLowerCase().includes("e2e")) {
        throw new Error("TEST_DATABASE_NAME must identify an isolated test database.");
    }
    if (marker !== REQUIRED_MARKER) {
        throw new Error(`TEST_DATABASE_MARKER must equal ${REQUIRED_MARKER}.`);
    }
    if (!testUrl.includes("application_name=" + REQUIRED_MARKER)) {
        throw new Error("TEST_DATABASE_URL must include the financial E2E application marker.");
    }
}

async function verifyDatabaseIdentity(testUrl, expectedDatabase, marker) {
    const client = new Client({ connectionString: testUrl, application_name: marker });
    await client.connect();
    try {
        const result = await client.query("SELECT current_database() AS database_name, current_setting('application_name', true) AS application_name");
        const row = result.rows[0];
        if (row?.database_name !== expectedDatabase) {
            throw new Error("Connected database identity does not match TEST_DATABASE_NAME.");
        }
        if (row?.application_name !== marker) {
            throw new Error("Connected database application marker does not match the required test marker.");
        }
    } finally {
        await client.end();
    }
}

async function main() {
    if (process.env.ALLOW_FINANCIAL_E2E !== "true") {
        fail("set ALLOW_FINANCIAL_E2E=true explicitly before any financial test run");
        return;
    }

    let testUrl;
    let ordinaryUrl;
    let testDatabaseName;
    let marker;
    try {
        testUrl = readRequiredEnv("TEST_DATABASE_URL");
        ordinaryUrl = process.env.DATABASE_URL?.trim() ?? "";
        testDatabaseName = readRequiredEnv("TEST_DATABASE_NAME");
        marker = readRequiredEnv("TEST_DATABASE_MARKER");
        assertSafeTarget(testUrl, ordinaryUrl, testDatabaseName, marker);
    } catch (error) {
        fail(error instanceof Error ? error.message : "safety preflight failed");
        return;
    }

    try {
        await verifyDatabaseIdentity(testUrl, testDatabaseName, marker);
    } catch {
        fail("isolated test database identity could not be verified");
        return;
    }

    fail("scenario runner is not enabled; no financial mutations were executed");
}

main().catch(() => {
    fail("safety preflight failed");
});
