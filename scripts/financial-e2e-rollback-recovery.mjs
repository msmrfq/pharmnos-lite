import pg from "pg";
import fs from "node:fs";
import {
    REQUIRED_MARKER,
    validateFinancialE2eTarget,
    verifyDatabaseIdentity,
} from "./financial-e2e-safety.mjs";

const { Client } = pg;
const run = `rollback-${Date.now()}`;
const ids = {
    tenant: `${run}-tenant`,
    user: `${run}-user`,
    role: `${run}-role`,
    membership: `${run}-membership`,
    supplier: `${run}-supplier`,
    purchase: `${run}-purchase`,
    purchaseRetry: `${run}-purchase-retry`,
    postingRollback: `${run}-posting-rollback`,
    postingRetry: `${run}-posting-retry`,
    evidence: `${run}-evidence`,
    calculation: `${run}-calculation`,
};

function loadEnv() {
    for (const file of [".env.local", ".env.financial-e2e"]) {
        if (!fs.existsSync(file)) continue;
        for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
        }
    }
}

function connectionUrl(raw, username, password, applicationName) {
    const url = new URL(raw);
    if (username) url.username = username;
    if (password) url.password = password;
    url.searchParams.set("application_name", applicationName);
    return url.toString();
}

async function connect(url) {
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
}

async function rows(client, sql, values = []) {
    return (await client.query(sql, values)).rows;
}

async function expectError(operation) {
    try {
        await operation();
        return "NO_ERROR";
    } catch (error) {
        return error instanceof Error ? `${error.code ?? "ERROR"}:${error.message}` : "ERROR";
    }
}

function record(results, id, expected, observed, status = expected === observed ? "PASS" : "FAIL") {
    results.push({ id, failureInjection: observed.injection ?? null, expectedState: expected, observedState: observed.state ?? observed, status });
}

async function setup(bootstrap) {
    await bootstrap.query("BEGIN");
    try {
        await bootstrap.query(
            "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, now())",
            [ids.tenant, `${run}-slug`, "Synthetic Rollback Tenant"],
        );
        await bootstrap.query(
            "INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1, $2, $3, $4, now())",
            [ids.user, `${run}-external`, `${run}@example.invalid`, "Synthetic Rollback User"],
        );
        await bootstrap.query(
            "INSERT INTO roles (id, tenant_id, name, is_default, updated_at) VALUES ($1, $2, $3, true, now())",
            [ids.role, ids.tenant, "SyntheticRollbackRole"],
        );
        await bootstrap.query(
            "INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at) VALUES ($1, $2, $3, $4, now())",
            [ids.membership, ids.tenant, ids.user, ids.role],
        );
        await bootstrap.query(
            "INSERT INTO suppliers (id, tenant_id, business_name, updated_at) VALUES ($1, $2, $3, now())",
            [ids.supplier, ids.tenant, "Synthetic Rollback Supplier"],
        );
        await bootstrap.query(
            `INSERT INTO purchase_invoices
             (id, tenant_id, invoice_no, supplier_id, invoice_date, status, gross_amount, net_amount, updated_at)
             VALUES ($1, $2, $3, $4, now(), 'DRAFT', 100, 100, now()),
                    ($5, $2, $6, $4, now(), 'DRAFT', 100, 100, now())`,
            [ids.purchase, ids.tenant, `${run}-invoice`, ids.supplier, ids.purchaseRetry, `${run}-invoice-retry`],
        );
        await bootstrap.query("COMMIT");
    } catch (error) {
        await bootstrap.query("ROLLBACK");
        throw error;
    }
}

async function cleanup(bootstrap) {
    await bootstrap.query("BEGIN");
    try {
        await bootstrap.query("DELETE FROM purchase_posting_operations WHERE tenant_id = $1", [ids.tenant]);
        await bootstrap.query("DELETE FROM purchase_invoices WHERE tenant_id = $1", [ids.tenant]);
        await bootstrap.query("DELETE FROM suppliers WHERE tenant_id = $1", [ids.tenant]);
        await bootstrap.query("DELETE FROM memberships WHERE tenant_id = $1", [ids.tenant]);
        await bootstrap.query("DELETE FROM roles WHERE tenant_id = $1", [ids.tenant]);
        await bootstrap.query("DELETE FROM users WHERE id = $1", [ids.user]);
        await bootstrap.query("DELETE FROM tenants WHERE id = $1", [ids.tenant]);
        await bootstrap.query("COMMIT");
    } catch (error) {
        await bootstrap.query("ROLLBACK");
        throw error;
    }
}

async function countOwned(bootstrap) {
    const tables = [
        ["tenants", "id"],
        ["users", "id"],
        ["roles", "id"],
        ["memberships", "id"],
        ["suppliers", "id"],
        ["purchase_invoices", "id"],
        ["purchase_posting_operations", "id"],
        ["purchase_gst_evidence_revisions", "id"],
        ["purchase_gst_calculations", "id"],
    ];
    let total = 0;
    for (const [table, column] of tables) {
        total += Number((await rows(bootstrap, `SELECT count(*)::int AS count FROM public."${table}" WHERE "${column}" LIKE $1`, [`${run}%`]))[0].count);
    }
    return total;
}

async function main() {
    throw new Error("BLOCKED: direct rollback execution requires the gated initialization adapter.");
    loadEnv();
    const target = await validateFinancialE2eTarget({
        testUrl: process.env.TEST_DATABASE_URL,
        ordinaryUrl: process.env.DATABASE_URL,
        testDatabaseName: process.env.TEST_DATABASE_NAME,
        marker: process.env.TEST_DATABASE_MARKER,
    });
    if (!target.ok) throw new Error(`TARGET_GUARD=FAIL ${target.errors.join(" ")}`);

    const bootstrap = await connect(connectionUrl(
        process.env.TEST_DATABASE_URL,
        process.env.FINANCIAL_E2E_DB_USER,
        process.env.FINANCIAL_E2E_DB_PASSWORD,
        "pharmnos-financial-e2e-rollback-bootstrap",
    ));
    const runtime = await connect(connectionUrl(
        process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
        null,
        null,
        REQUIRED_MARKER,
    ));
    const results = [];
    let cleaned = false;
    try {
        const identity = await verifyDatabaseIdentity({
            client: runtime,
            expectedDatabase: process.env.TEST_DATABASE_NAME,
            expectedRole: process.env.FINANCIAL_E2E_RUNTIME_DB_USER,
            targetUrl: process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
            runId: run,
            expectedEnvironmentMarker: REQUIRED_MARKER,
        });
        if (!identity.ok) throw new Error(`IDENTITY=FAIL ${identity.error}`);

        await setup(bootstrap);
        await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenant]);

        await runtime.query("BEGIN");
        await runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [ids.postingRollback, ids.tenant, ids.purchase, `${run}-rollback-key`, "rollback-hash"],
        );
        const rollbackFailure = await expectError(() => runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [`${run}-posting-rollback-duplicate`, ids.tenant, ids.purchase, `${run}-rollback-key`, "duplicate-hash"],
        ));
        await runtime.query("ROLLBACK");
        const rollbackCount = await rows(runtime, "SELECT count(*)::int AS count FROM purchase_posting_operations WHERE id = $1", [ids.postingRollback]);
        record(results, "rollback-posting-after-expected-unique-failure", "0 rows and expected unique error", {
            injection: rollbackFailure,
            state: `${rollbackCount[0].count} rows`,
        }, rollbackFailure.startsWith("23505") && rollbackCount[0].count === 0 ? "PASS" : "FAIL");

        await runtime.query("BEGIN");
        await runtime.query(
            `INSERT INTO purchase_gst_evidence_revisions
             (id, tenant_id, purchase_invoice_id, revision_number, revision_kind, capture_channel, captured_by_membership_id)
             VALUES ($1, $2, $3, 1, 'INITIAL', 'rollback-test', $4)`,
            [ids.evidence, ids.tenant, ids.purchase, ids.membership],
        );
        await runtime.query(
            `INSERT INTO purchase_gst_calculations
             (id, tenant_id, purchase_invoice_id, evidence_revision_id, rule_version)
             VALUES ($1, $2, $3, $4, 'rollback-test-v1')`,
            [ids.calculation, ids.tenant, ids.purchase, ids.evidence],
        );
        const fkFailure = await expectError(() => runtime.query(
            "UPDATE purchase_invoices SET current_gst_calculation_id = $1 WHERE id = $2",
            [`${run}-missing-calculation`, ids.purchase],
        ));
        await runtime.query("ROLLBACK");
        const relatedCounts = await rows(runtime, `
            SELECT
              (SELECT count(*) FROM purchase_gst_evidence_revisions WHERE id = $1)::int AS evidence,
              (SELECT count(*) FROM purchase_gst_calculations WHERE id = $2)::int AS calculation
        `, [ids.evidence, ids.calculation]);
        record(results, "rollback-related-gst-records-after-fk-failure", "0 evidence and 0 calculations", {
            injection: fkFailure,
            state: `${relatedCounts[0].evidence} evidence and ${relatedCounts[0].calculation} calculations`,
        }, fkFailure.startsWith("23503") && relatedCounts[0].evidence === 0 && relatedCounts[0].calculation === 0 ? "PASS" : "FAIL");

        await runtime.query("BEGIN");
        await runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [ids.postingRetry, ids.tenant, ids.purchaseRetry, `${run}-retry-key`, "retry-hash"],
        );
        const retryFailure = await expectError(() => runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [`${run}-posting-retry-duplicate`, ids.tenant, ids.purchaseRetry, `${run}-retry-key`, "retry-duplicate-hash"],
        ));
        await runtime.query("ROLLBACK");
        const retryInsert = await runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [ids.postingRetry, ids.tenant, ids.purchaseRetry, `${run}-retry-key`, "retry-hash"],
        );
        const replayFailure = await expectError(() => runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [`${run}-posting-replay`, ids.tenant, ids.purchaseRetry, `${run}-retry-key`, "retry-hash"],
        ));
        record(results, "failed-posting-retry-and-replay", "failed first attempt, retry succeeds, replay denied", {
            injection: retryFailure,
            state: `${retryInsert.rowCount} retry row and ${replayFailure}`,
        }, retryFailure.startsWith("23505") && retryInsert.rowCount === 1 && replayFailure.startsWith("23505") ? "PASS" : "FAIL");

        record(results, "stale-version-recovery", "NOT RUN: no version-check contract exists", {
            injection: "schema inspection",
            state: "NOT RUN",
        }, "NOT RUN");
        record(results, "controlled-cleanup-failure-recovery", "NOT RUN: no safe cleanup-failure seam exists", {
            injection: "safety boundary",
            state: "NOT RUN",
        }, "NOT RUN");
    } finally {
        try {
            await cleanup(bootstrap);
            cleaned = true;
        } finally {
            await runtime.end();
            await bootstrap.end();
        }
    }

    const verify = await connect(connectionUrl(
        process.env.TEST_DATABASE_URL,
        process.env.FINANCIAL_E2E_DB_USER,
        process.env.FINANCIAL_E2E_DB_PASSWORD,
        "pharmnos-financial-e2e-rollback-verification",
    ));
    const remaining = await countOwned(verify);
    const catalog = (await rows(verify, `
        SELECT
          (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public') AS policies,
          (SELECT count(*)::int FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS triggers
    `))[0];
    await verify.end();
    console.log(JSON.stringify({ run, fixtureCleanup: cleaned, results, ownedRowsAfterCleanup: remaining, catalog }, null, 2));
    if (!cleaned || remaining !== 0 || results.some(({ status }) => status === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
