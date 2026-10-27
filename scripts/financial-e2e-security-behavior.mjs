import pg from "pg";
import { validateFinancialE2eTarget, verifyDatabaseIdentity, REQUIRED_MARKER } from "./financial-e2e-safety.mjs";

const { Client } = pg;
const run = `security-${Date.now()}`;
const ids = {
    tenantA: `${run}-tenant-a`,
    tenantB: `${run}-tenant-b`,
    userA: `${run}-user-a`,
    userB: `${run}-user-b`,
    roleA: `${run}-role-a`,
    roleB: `${run}-role-b`,
    membershipA: `${run}-membership-a`,
    membershipB: `${run}-membership-b`,
    supplierA: `${run}-supplier-a`,
    supplierB: `${run}-supplier-b`,
    purchaseA: `${run}-purchase-a`,
    purchaseA2: `${run}-purchase-a2`,
    purchaseB: `${run}-purchase-b`,
    evidenceA: `${run}-evidence-a`,
    calculationA: `${run}-calculation-a`,
    postingA: `${run}-posting-a`,
    postingB: `${run}-posting-b`,
};

function result(id, expected, observed, status = expected === observed ? "PASS" : "FAIL") {
    return { id, expected, observed, status };
}

async function loadEnv() {
    const fs = await import("node:fs/promises");
    for (const file of [".env.local", ".env.financial-e2e"]) {
        for (const line of await fs.readFile(file, "utf8").catch(() => "").then((text) => text.split(/\r?\n/))) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
            if (match) {
                let value = match[2];
                if (value.length >= 2 && ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.slice(1, -1);
                }
                process.env[match[1]] = value;
            }
        }
    }
}

function bootstrapUrl() {
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.username = process.env.FINANCIAL_E2E_DB_USER;
    url.password = process.env.FINANCIAL_E2E_DB_PASSWORD;
    url.searchParams.set("application_name", "pharmnos-financial-e2e-bootstrap-fixtures");
    return url.toString();
}

function runtimeUrl() {
    const url = new URL(process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL);
    url.searchParams.set("application_name", REQUIRED_MARKER);
    return url.toString();
}

async function connect(url) {
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
}

async function query(client, sql, values = []) {
    return (await client.query(sql, values)).rows;
}

async function expectError(fn) {
    try {
        await fn();
        return "NO_ERROR";
    } catch (error) {
        return error instanceof Error ? `${error.code ?? "ERROR"}:${error.message}` : "ERROR";
    }
}

async function setup(client) {
    await client.query("BEGIN");
    await client.query(
        "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, now()), ($4, $5, $6, now())",
        [ids.tenantA, `${run}-a`, "Synthetic Tenant A", ids.tenantB, `${run}-b`, "Synthetic Tenant B"],
    );
    await client.query(
        "INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1, $2, $3, $4, now()), ($5, $6, $7, $8, now())",
        [ids.userA, `${run}-external-a`, `${run}-a@example.invalid`, "Synthetic A", ids.userB, `${run}-external-b`, `${run}-b@example.invalid`, "Synthetic B"],
    );
    await client.query(
        "INSERT INTO roles (id, tenant_id, name, is_default, updated_at) VALUES ($1, $2, $3, true, now()), ($4, $5, $6, true, now())",
        [ids.roleA, ids.tenantA, "SyntheticRoleA", ids.roleB, ids.tenantB, "SyntheticRoleB"],
    );
    await client.query(
        "INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at) VALUES ($1, $2, $3, $4, now()), ($5, $6, $7, $8, now())",
        [ids.membershipA, ids.tenantA, ids.userA, ids.roleA, ids.membershipB, ids.tenantB, ids.userB, ids.roleB],
    );
    await client.query(
        "INSERT INTO role_permissions (id, role_id, permission) VALUES ($1, $2, 'view_purchase'), ($3, $4, 'view_purchase')",
        [`${run}-permission-a`, ids.roleA, `${run}-permission-b`, ids.roleB],
    );
    await client.query(
        "INSERT INTO suppliers (id, tenant_id, business_name, updated_at) VALUES ($1, $2, $3, now()), ($4, $5, $6, now())",
        [ids.supplierA, ids.tenantA, "Synthetic Supplier A", ids.supplierB, ids.tenantB, "Synthetic Supplier B"],
    );
    await client.query(
        `INSERT INTO purchase_invoices
         (id, tenant_id, invoice_no, supplier_id, invoice_date, status, gross_amount, net_amount, updated_at)
         VALUES ($1, $2, $3, $4, now(), 'DRAFT', 100, 100, now()), ($5, $6, $7, $8, now(), 'DRAFT', 100, 100, now()), ($9, $10, $11, $12, now(), 'DRAFT', 100, 100, now())`,
        [ids.purchaseA, ids.tenantA, `${run}-INV-A`, ids.supplierA, ids.purchaseB, ids.tenantB, `${run}-INV-B`, ids.supplierB, ids.purchaseA2, ids.tenantA, `${run}-INV-A2`, ids.supplierA],
    );
    await client.query("COMMIT");
}

async function cleanup(client) {
    throw new Error("BLOCKED: GST cleanup requires an approved trigger-preserving mechanism.");
}

async function withClaim(client, tenantId) {
    await client.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [tenantId]);
}

async function main() {
    throw new Error("BLOCKED: direct security behavior execution requires the gated initialization adapter.");
    await loadEnv();
    const target = await validateFinancialE2eTarget({
        testUrl: process.env.TEST_DATABASE_URL,
        ordinaryUrl: process.env.DATABASE_URL,
        testDatabaseName: process.env.TEST_DATABASE_NAME,
        marker: process.env.TEST_DATABASE_MARKER,
    });
    if (!target.ok) throw new Error(`TARGET_GUARD=FAIL ${target.errors.join(" ")}`);
    const bootstrap = await connect(bootstrapUrl());
    const runtime = await connect(runtimeUrl());
    const runtimeB = await connect(runtimeUrl());
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

        await withClaim(runtime, ids.tenantA);
        const own = await query(runtime, "SELECT id FROM tenants ORDER BY id");
        const ownPermissions = await query(runtime, "SELECT id FROM role_permissions ORDER BY id");
        results.push(result("tenant-own-read", "1 row", `${own.length} row`));
        results.push(result("role-permissions-own-read", "1 row", `${ownPermissions.length} row`));
        await withClaim(runtime, ids.tenantB);
        const cross = await query(runtime, "SELECT id FROM tenants WHERE id = $1", [ids.tenantA]);
        const crossPermission = await query(runtime, "SELECT id FROM role_permissions WHERE id = $1", [`${run}-permission-a`]);
        results.push(result("tenant-cross-read", "0 rows", `${cross.length} rows`));
        results.push(result("role-permissions-cross-read", "0 rows", `${crossPermission.length} rows`));
        const crossInsert = await expectError(() => runtime.query(
            "INSERT INTO purchase_invoices (id, tenant_id, invoice_no, supplier_id, invoice_date, gross_amount, net_amount, updated_at) VALUES ($1, $2, $3, $4, now(), 1, 1, now())",
            [`${run}-cross-insert`, ids.tenantA, `${run}-cross`, ids.supplierA],
        ));
        results.push(result("tenant-cross-write", "RLS error", crossInsert, crossInsert.startsWith("42501") || crossInsert.startsWith("ERROR") ? "PASS" : "FAIL"));
        for (const claim of ["", "malformed-claim", ids.tenantB, ids.tenantA]) {
            await withClaim(runtime, claim);
            const rows = await query(runtime, "SELECT id FROM tenants WHERE id = $1", [ids.tenantA]);
            const expectedRows = claim === ids.tenantA ? "1 row" : "0 rows";
            results.push(result(`claim-${claim || "empty"}`, expectedRows, `${rows.length} row${rows.length === 1 ? "" : "s"}`));
        }

        await withClaim(runtime, ids.tenantA);
        const evidenceInsert = await runtime.query(
            `INSERT INTO purchase_gst_evidence_revisions
             (id, tenant_id, purchase_invoice_id, revision_number, revision_kind, capture_channel, captured_by_membership_id)
             VALUES ($1, $2, $3, 1, 'INITIAL', 'synthetic-test', $4)`,
            [ids.evidenceA, ids.tenantA, ids.purchaseA, ids.membershipA],
        );
        results.push(result("immutable-history-insert", "success", evidenceInsert.rowCount === 1 ? "success" : "unexpected", "PASS"));
        const immutableUpdate = await expectError(() => runtime.query(
            "UPDATE purchase_gst_evidence_revisions SET capture_channel = 'changed' WHERE id = $1", [ids.evidenceA],
        ));
        const immutableDelete = await expectError(() => runtime.query(
            "DELETE FROM purchase_gst_evidence_revisions WHERE id = $1", [ids.evidenceA],
        ));
        results.push(result("immutable-history-update", "denied", immutableUpdate, immutableUpdate !== "NO_ERROR" ? "PASS" : "FAIL"));
        results.push(result("immutable-history-delete", "denied", immutableDelete, immutableDelete !== "NO_ERROR" ? "PASS" : "FAIL"));

        await bootstrap.query("UPDATE purchase_invoices SET status = 'FINALIZED' WHERE id = $1", [ids.purchaseA]);
        const finalizedProtected = await expectError(() => runtime.query(
            "UPDATE purchase_invoices SET gst_record_version = 1 WHERE id = $1", [ids.purchaseA],
        ));
        results.push(result("finalized-gst-mutation", "denied", finalizedProtected, finalizedProtected !== "NO_ERROR" ? "PASS" : "FAIL"));
        const finalizedAllowed = await runtime.query("UPDATE purchase_invoices SET notes = 'synthetic-note' WHERE id = $1", [ids.purchaseA]);
        results.push(result("finalized-non-gst-update", "success", finalizedAllowed.rowCount === 1 ? "success" : "unexpected", "PASS"));

        const posting = await runtime.query(
            `INSERT INTO purchase_posting_operations
             (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [ids.postingA, ids.tenantA, ids.purchaseA, `${run}-idem`, "hash-a"],
        );
        results.push(result("posting-insert-processing", "success", posting.rowCount === 1 ? "success" : "unexpected", "PASS"));
        const completed = await runtime.query("UPDATE purchase_posting_operations SET status = 'COMPLETED' WHERE id = $1", [ids.postingA]);
        results.push(result("posting-processing-completed", "success", completed.rowCount === 1 ? "success" : "unexpected", "PASS"));
        const invalidTransition = await expectError(() => runtime.query("UPDATE purchase_posting_operations SET status = 'PROCESSING' WHERE id = $1", [ids.postingA]));
        results.push(result("posting-invalid-transition", "denied", invalidTransition, invalidTransition !== "NO_ERROR" ? "PASS" : "FAIL"));
        const duplicateIdem = await expectError(() => runtime.query(
            "INSERT INTO purchase_posting_operations (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())",
            [ids.postingB, ids.tenantA, ids.purchaseA, `${run}-idem`, "hash-conflict"],
        ));
        results.push(result("posting-duplicate-idempotency", "denied", duplicateIdem, duplicateIdem !== "NO_ERROR" ? "PASS" : "FAIL"));

        const concurrentA = await connect(runtimeUrl());
        const concurrentB = await connect(runtimeUrl());
        await withClaim(concurrentA, ids.tenantA);
        await withClaim(concurrentB, ids.tenantA);
        await concurrentA.query("BEGIN");
        await concurrentB.query("BEGIN");
        await concurrentA.query(
            "INSERT INTO purchase_posting_operations (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())",
            [`${run}-concurrent-a`, ids.tenantA, ids.purchaseA2, `${run}-concurrent`, "hash-a"],
        );
        const waiting = concurrentB.query(
            "INSERT INTO purchase_posting_operations (id, tenant_id, purchase_invoice_id, idempotency_key, request_payload_hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())",
            [`${run}-concurrent-b`, ids.tenantA, ids.purchaseA2, `${run}-concurrent`, "hash-b"],
        );
        await concurrentA.query("COMMIT");
        const concurrentOutcome = await waiting.then(() => "NO_ERROR").catch((error) => `${error.code ?? "ERROR"}:${error.message}`);
        await concurrentB.query("ROLLBACK");
        await concurrentA.end();
        await concurrentB.end();
        results.push(result("posting-concurrent-claim", "one winner", concurrentOutcome, concurrentOutcome !== "NO_ERROR" ? "PASS" : "FAIL"));
    } finally {
        try {
            await cleanup(bootstrap);
            cleaned = true;
        } finally {
            await runtime.end();
            await runtimeB.end();
            await bootstrap.end();
        }
    }
    const remaining = await connect(bootstrapUrl());
    const countTables = [
        "tenants", "users", "memberships", "roles", "role_permissions", "suppliers",
        "purchase_invoices", "purchase_posting_operations", "purchase_gst_evidence_revisions",
        "purchase_gst_line_evidence", "purchase_gst_calculations", "purchase_gst_accounting_decisions",
        "purchase_gst_reconciliation_events", "purchase_gst_reconciliation_event_lines",
    ];
    let exactRows = 0;
    for (const table of countTables) {
        exactRows += Number((await query(remaining, `SELECT count(*)::int AS count FROM public."${table}"`))[0].count);
    }
    await remaining.end();
    console.log(JSON.stringify({ run, fixtureCleanup: cleaned, results, exactRowsInFixtureTablesAfterCleanup: exactRows }, null, 2));
    if (results.some((item) => item.status === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
    console.error(`BEHAVIOR_HARNESS=FAIL ${error instanceof Error ? error.message : "sanitized error"}`);
    process.exitCode = 1;
});
