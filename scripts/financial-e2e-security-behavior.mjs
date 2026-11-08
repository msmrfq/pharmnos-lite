import pg from "pg";
import crypto from "node:crypto";
import { validateFinancialE2eTarget, verifyDatabaseIdentity, REQUIRED_MARKER } from "./financial-e2e-safety.mjs";
import { createSignedFinancialContext } from "./financial-e2e-signed-context.mjs";
import {
    createLifecycleEvidence,
    loadAuthorizedTargetLifecycle,
    writeLifecycleEvidence,
} from "./financial-e2e-target-lifecycle.mjs";

const { Client } = pg;
const run = `security-${Date.now()}`;
const ids = {
    tenantA: `${run}-tenant-a`,
    tenantB: `${run}-tenant-b`,
    userA: `${run}-user-a`,
    userB: `${run}-user-b`,
    externalA: `${run}-external-a`,
    externalB: `${run}-external-b`,
    roleA: `${run}-role-a`,
    roleB: `${run}-role-b`,
    membershipA: `${run}-membership-a`,
    membershipB: `${run}-membership-b`,
    supplierA: `${run}-supplier-a`,
    supplierB: `${run}-supplier-b`,
    customerA: `${run}-customer-a`,
    customerB: `${run}-customer-b`,
    purchaseA: `${run}-purchase-a`,
    purchaseA2: `${run}-purchase-a2`,
    purchaseB: `${run}-purchase-b`,
    paymentCustomerA: `${run}-payment-customer-a`,
    paymentCustomerB: `${run}-payment-customer-b`,
    paymentSupplierA: `${run}-payment-supplier-a`,
    paymentSupplierB: `${run}-payment-supplier-b`,
    allocationA: `${run}-allocation-a`,
    allocationB: `${run}-allocation-b`,
    reversalA: `${run}-reversal-a`,
    reversalB: `${run}-reversal-b`,
    refundA: `${run}-refund-a`,
    refundB: `${run}-refund-b`,
    auditA: `${run}-audit-a`,
    auditB: `${run}-audit-b`,
    auditRuntimeA: `${run}-audit-runtime-a`,
};

function result(id, expected, observed, status = expected === observed ? "PASS" : "FAIL") {
    return { id, expected, observed, status };
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

async function financialSnapshot(client) {
    const snapshot = {};
    for (const table of [
        "customers", "suppliers", "sales_invoices", "purchase_invoices", "payments",
        "payment_allocations", "allocation_reversals", "payment_refunds", "payment_reversals",
        "customer_ledgers", "supplier_ledgers", "audit_logs",
    ]) {
        snapshot[table] = await query(client,
            `SELECT to_jsonb(t) AS row FROM public."${table}" t WHERE tenant_id = ANY($1::text[]) ORDER BY id`,
            [[ids.tenantA, ids.tenantB]]);
    }
    return crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

async function setup(client) {
    await client.query("BEGIN");
    await client.query(
        "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, now()), ($4, $5, $6, now())",
        [ids.tenantA, `${run}-a`, "Synthetic Tenant A", ids.tenantB, `${run}-b`, "Synthetic Tenant B"],
    );
    await client.query(
        "INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1, $2, $3, $4, now()), ($5, $6, $7, $8, now())",
        [ids.userA, ids.externalA, `${run}-a@example.invalid`, "Synthetic A", ids.userB, ids.externalB, `${run}-b@example.invalid`, "Synthetic B"],
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
        "INSERT INTO customers (id, tenant_id, business_name, updated_at) VALUES ($1, $2, $3, now()), ($4, $5, $6, now())",
        [ids.customerA, ids.tenantA, "Synthetic Customer A", ids.customerB, ids.tenantB, "Synthetic Customer B"],
    );
    await client.query(
        `INSERT INTO purchase_invoices
         (id, tenant_id, invoice_no, supplier_id, invoice_date, status, gross_amount, net_amount, updated_at)
         VALUES ($1, $2, $3, $4, now(), 'DRAFT', 100, 100, now()), ($5, $6, $7, $8, now(), 'DRAFT', 100, 100, now()), ($9, $10, $11, $12, now(), 'DRAFT', 100, 100, now())`,
        [ids.purchaseA, ids.tenantA, `${run}-INV-A`, ids.supplierA, ids.purchaseB, ids.tenantB, `${run}-INV-B`, ids.supplierB, ids.purchaseA2, ids.tenantA, `${run}-INV-A2`, ids.supplierA],
    );
    await client.query(
        `INSERT INTO payments
         (id, tenant_id, customer_id, entry_type, amount, payment_date, idempotency_key, request_payload_hash, created_by)
         VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', 100, now(), $4, 'security-fixture-a', $5),
                ($6, $7, $8, 'PAYMENT_RECEIVED', 100, now(), $9, 'security-fixture-b', $10)`,
        [ids.paymentCustomerA, ids.tenantA, ids.customerA, `${run}-payment-customer-a`, ids.userA,
            ids.paymentCustomerB, ids.tenantB, ids.customerB, `${run}-payment-customer-b`, ids.userB],
    );
    await client.query(
        `INSERT INTO payments
         (id, tenant_id, supplier_id, entry_type, amount, payment_date, idempotency_key, request_payload_hash, created_by)
         VALUES ($1, $2, $3, 'PAYMENT_MADE', 100, now(), $4, 'security-fixture-a', $5),
                ($6, $7, $8, 'PAYMENT_MADE', 100, now(), $9, 'security-fixture-b', $10)`,
        [ids.paymentSupplierA, ids.tenantA, ids.supplierA, `${run}-payment-supplier-a`, ids.userA,
            ids.paymentSupplierB, ids.tenantB, ids.supplierB, `${run}-payment-supplier-b`, ids.userB],
    );
    await client.query(
        `INSERT INTO payment_allocations
         (id, tenant_id, payment_id, purchase_invoice_id, amount, idempotency_key, request_payload_hash, allocated_by)
         VALUES ($1, $2, $3, $4, 25, $5, 'security-fixture-a', $6),
                ($7, $8, $9, $10, 25, $11, 'security-fixture-b', $12)`,
        [ids.allocationA, ids.tenantA, ids.paymentSupplierA, ids.purchaseA, `${run}-allocation-a`, ids.userA,
            ids.allocationB, ids.tenantB, ids.paymentSupplierB, ids.purchaseB, `${run}-allocation-b`, ids.userB],
    );
    await client.query(
        `INSERT INTO allocation_reversals
         (id, tenant_id, allocation_id, amount, idempotency_key, request_payload_hash, reversed_by)
         VALUES ($1, $2, $3, 5, $4, 'security-fixture-a', $5),
                ($6, $7, $8, 5, $9, 'security-fixture-b', $10)`,
        [ids.reversalA, ids.tenantA, ids.allocationA, `${run}-reversal-a`, ids.userA,
            ids.reversalB, ids.tenantB, ids.allocationB, `${run}-reversal-b`, ids.userB],
    );
    await client.query(
        `INSERT INTO payment_refunds
         (id, tenant_id, payment_id, amount, status, idempotency_key, request_payload_hash, requested_by)
         VALUES ($1, $2, $3, 10, 'REQUESTED', $4, 'security-fixture-a', $5),
                ($6, $7, $8, 10, 'REQUESTED', $9, 'security-fixture-b', $10)`,
        [ids.refundA, ids.tenantA, ids.paymentCustomerA, `${run}-refund-a`, ids.userA,
            ids.refundB, ids.tenantB, ids.paymentCustomerB, `${run}-refund-b`, ids.userB],
    );
    await client.query(
        `INSERT INTO audit_logs (id, tenant_id, event_type, actor_id, target_type, target_id, metadata)
         VALUES ($1, $2, 'REFUND_REQUESTED', $3, 'payment_refund', $4, '{"source":"security-fixture"}'),
                ($5, $6, 'REFUND_REQUESTED', $7, 'payment_refund', $8, '{"source":"security-fixture"}')`,
        [ids.auditA, ids.tenantA, ids.userA, ids.refundA, ids.auditB, ids.tenantB, ids.userB, ids.refundB],
    );
    await client.query("COMMIT");
}

async function cleanup(client) {
    await client.query("BEGIN");
    try {
        await client.query("DELETE FROM audit_logs WHERE id = ANY($1::text[])", [[ids.auditA, ids.auditB, ids.auditRuntimeA]]);
        await client.query("DELETE FROM payment_refunds WHERE id = ANY($1::text[])", [[ids.refundA, ids.refundB]]);
        await client.query("DELETE FROM allocation_reversals WHERE id = ANY($1::text[])", [[ids.reversalA, ids.reversalB]]);
        await client.query("DELETE FROM payment_allocations WHERE id = ANY($1::text[])", [[ids.allocationA, ids.allocationB]]);
        await client.query("DELETE FROM payments WHERE id = ANY($1::text[])", [[
            ids.paymentCustomerA, ids.paymentCustomerB, ids.paymentSupplierA, ids.paymentSupplierB,
        ]]);
        await client.query("DELETE FROM purchase_invoices WHERE id = ANY($1::text[])", [[
            ids.purchaseA, ids.purchaseA2, ids.purchaseB,
        ]]);
        await client.query("DELETE FROM customers WHERE id = ANY($1::text[])", [[ids.customerA, ids.customerB]]);
        await client.query("DELETE FROM suppliers WHERE id = ANY($1::text[])", [[ids.supplierA, ids.supplierB]]);
        await client.query("DELETE FROM role_permissions WHERE id = ANY($1::text[])", [[`${run}-permission-a`, `${run}-permission-b`]]);
        await client.query("DELETE FROM memberships WHERE id = ANY($1::text[])", [[ids.membershipA, ids.membershipB]]);
        await client.query("DELETE FROM roles WHERE id = ANY($1::text[])", [[ids.roleA, ids.roleB]]);
        await client.query("DELETE FROM users WHERE id = ANY($1::text[])", [[ids.userA, ids.userB]]);
        await client.query("DELETE FROM tenants WHERE id = ANY($1::text[])", [[ids.tenantA, ids.tenantB]]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}

async function withContext(client, tenantId, subjectId, work) {
    await client.query("BEGIN");
    try {
        await client.query(
            "SELECT set_config('pharmnos.auth_context', $1, true)",
            [createSignedFinancialContext(subjectId, tenantId)],
        );
        const result = await work();
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
}

async function main() {
    const lifecycle = loadAuthorizedTargetLifecycle({ phase: "SUITE_EXECUTION" });
    Object.assign(process.env, lifecycle.environment);
    const target = await validateFinancialE2eTarget({
        testUrl: process.env.TEST_DATABASE_URL,
        ordinaryUrl: process.env.DATABASE_URL,
        testDatabaseName: process.env.TEST_DATABASE_NAME,
        marker: process.env.TEST_DATABASE_MARKER,
    });
    if (!target.ok) throw new Error(`TARGET_GUARD=FAIL ${target.errors.join(" ")}`);
    const bootstrap = await connect(bootstrapUrl());
    const runtime = await connect(runtimeUrl());
    const results = [];
    let cleaned = false;
    let fixtureCreated = false;
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
        fixtureCreated = true;

        const role = (await query(runtime, `
            SELECT current_database() AS database_name,
                   current_user AS current_role,
                   session_user AS session_role,
                   r.rolcanlogin,
                   r.rolsuper,
                   r.rolbypassrls,
                   has_table_privilege(current_user, 'public.payments', 'SELECT') AS can_select_payments,
                   has_table_privilege(current_user, 'public.payments', 'INSERT') AS can_insert_payments,
                   has_table_privilege(current_user, 'public.payments', 'DELETE') AS can_delete_payments
            FROM pg_roles r
            WHERE r.rolname = current_user
        `))[0];
        const rolePassed = role?.database_name === process.env.TEST_DATABASE_NAME &&
            role?.current_role === process.env.FINANCIAL_E2E_RUNTIME_DB_USER &&
            role?.session_role === process.env.FINANCIAL_E2E_RUNTIME_DB_USER &&
            role?.rolcanlogin === true && role?.rolsuper === false && role?.rolbypassrls === false &&
            role?.can_select_payments === true && role?.can_insert_payments === true &&
            role?.can_delete_payments === false;
        results.push(result("restricted-role-attributes-and-grants", "LOGIN/NOSUPERUSER/NOBYPASSRLS; scoped DML", rolePassed ? {
            currentRole: role.current_role,
            canLogin: role.rolcanlogin,
            superuser: role.rolsuper,
            bypassRls: role.rolbypassrls,
            canSelectPayments: role.can_select_payments,
            canInsertPayments: role.can_insert_payments,
            canDeletePayments: role.can_delete_payments,
        } : role, rolePassed ? "PASS" : "FAIL"));

        const ownRows = await withContext(runtime, ids.tenantA, ids.externalA, async () => {
            const counts = {};
            for (const [table, id] of [
                ["customers", ids.customerA],
                ["suppliers", ids.supplierA],
                ["payments", ids.paymentCustomerA],
                ["payment_allocations", ids.allocationA],
                ["allocation_reversals", ids.reversalA],
                ["payment_refunds", ids.refundA],
                ["audit_logs", ids.auditA],
            ]) {
                counts[table] = (await query(runtime, `SELECT count(*)::int AS count FROM public."${table}" WHERE id = $1`, [id]))[0].count;
            }
            const paymentUpdate = await runtime.query(
                "UPDATE payments SET notes = 'same-tenant-write' WHERE tenant_id = $1 AND id = $2",
                [ids.tenantA, ids.paymentCustomerA],
            );
            const customerUpdate = await runtime.query(
                "UPDATE customers SET business_name = business_name WHERE tenant_id = $1 AND id = $2",
                [ids.tenantA, ids.customerA],
            );
            const supplierUpdate = await runtime.query(
                "UPDATE suppliers SET business_name = business_name WHERE tenant_id = $1 AND id = $2",
                [ids.tenantA, ids.supplierA],
            );
            const allocationUpdate = await runtime.query(
                "UPDATE payment_allocations SET allocated_by = allocated_by WHERE tenant_id = $1 AND id = $2",
                [ids.tenantA, ids.allocationA],
            );
            const reversalUpdate = await runtime.query(
                "UPDATE allocation_reversals SET reversed_by = reversed_by WHERE tenant_id = $1 AND id = $2",
                [ids.tenantA, ids.reversalA],
            );
            const refundUpdate = await runtime.query(
                "UPDATE payment_refunds SET status = 'APPROVED', approved_at = now(), approved_by = $1 WHERE tenant_id = $2 AND id = $3",
                [ids.userA, ids.tenantA, ids.refundA],
            );
            const auditInsert = await runtime.query(
                `INSERT INTO audit_logs (id, tenant_id, event_type, actor_id, target_type, target_id, metadata)
                 VALUES ($1, $2, 'REFUND_APPROVED', $3, 'payment_refund', $4, '{"source":"restricted-role-runtime"}')`,
                [ids.auditRuntimeA, ids.tenantA, ids.userA, ids.refundA],
            );
            return {
                counts,
                customerUpdate: customerUpdate.rowCount,
                supplierUpdate: supplierUpdate.rowCount,
                paymentUpdate: paymentUpdate.rowCount,
                allocationUpdate: allocationUpdate.rowCount,
                reversalUpdate: reversalUpdate.rowCount,
                refundUpdate: refundUpdate.rowCount,
                auditInsert: auditInsert.rowCount,
            };
        });
        const ownPassed = Object.values(ownRows.counts).every((count) => Number(count) === 1) &&
            ownRows.customerUpdate === 1 && ownRows.supplierUpdate === 1 &&
            ownRows.paymentUpdate === 1 && ownRows.allocationUpdate === 1 &&
            ownRows.reversalUpdate === 1 && ownRows.refundUpdate === 1 &&
            ownRows.auditInsert === 1;
        results.push(result("same-tenant-financial-operations", "read and write own customer, supplier, payment, allocation, reversal, refund and audit", ownRows, ownPassed ? "PASS" : "FAIL"));

        const ownTenantB = await withContext(runtime, ids.tenantB, ids.externalB, async () => {
            const counts = {};
            for (const [table, id] of [
                ["customers", ids.customerB], ["suppliers", ids.supplierB],
                ["payments", ids.paymentCustomerB], ["payment_allocations", ids.allocationB],
                ["allocation_reversals", ids.reversalB], ["payment_refunds", ids.refundB],
                ["audit_logs", ids.auditB],
            ]) {
                counts[table] = (await query(runtime, `SELECT count(*)::int AS count FROM public."${table}" WHERE id = $1`, [id]))[0].count;
            }
            const update = await runtime.query(
                "UPDATE customers SET business_name = business_name WHERE tenant_id = $1 AND id = $2",
                [ids.tenantB, ids.customerB],
            );
            return { counts, customerUpdate: update.rowCount };
        });
        const ownTenantBPassed = Object.values(ownTenantB.counts).every((count) => Number(count) === 1) &&
            ownTenantB.customerUpdate === 1;
        results.push(result("same-tenant-b-financial-operations", "tenant B can read its own financial records and update its customer",
            ownTenantB, ownTenantBPassed ? "PASS" : "FAIL"));

        const snapshotBeforeCrossTenant = await financialSnapshot(bootstrap);
        const crossProbe = (accessTenant, accessSubject, actor, targetTenant, suffix) => withContext(runtime, accessTenant, accessSubject, async () => {
            const counts = {};
            for (const [table, id] of [
                ["customers", ids[`customer${suffix}`]],
                ["suppliers", ids[`supplier${suffix}`]],
                ["payments", ids[`paymentCustomer${suffix}`]],
                ["payment_allocations", ids[`allocation${suffix}`]],
                ["allocation_reversals", ids[`reversal${suffix}`]],
                ["payment_refunds", ids[`refund${suffix}`]],
                ["audit_logs", ids[`audit${suffix}`]],
            ]) {
                counts[table] = (await query(runtime, `SELECT count(*)::int AS count FROM public."${table}" WHERE id = $1`, [id]))[0].count;
            }
            const crossUpdate = await runtime.query(
                "UPDATE payments SET notes = 'cross-tenant-write' WHERE tenant_id = $1 AND id = $2",
                [targetTenant, ids[`paymentCustomer${suffix}`]],
            );
            const customerUpdate = await runtime.query(
                "UPDATE customers SET business_name = 'cross-tenant-write' WHERE tenant_id = $1 AND id = $2",
                [targetTenant, ids[`customer${suffix}`]],
            );
            const supplierUpdate = await runtime.query(
                "UPDATE suppliers SET business_name = 'cross-tenant-write' WHERE tenant_id = $1 AND id = $2",
                [targetTenant, ids[`supplier${suffix}`]],
            );
            const allocationUpdate = await runtime.query(
                "UPDATE payment_allocations SET allocated_by = $1 WHERE tenant_id = $2 AND id = $3",
                [actor, targetTenant, ids[`allocation${suffix}`]],
            );
            const reversalUpdate = await runtime.query(
                "UPDATE allocation_reversals SET reversed_by = $1 WHERE tenant_id = $2 AND id = $3",
                [actor, targetTenant, ids[`reversal${suffix}`]],
            );
            const refundUpdate = await runtime.query(
                "UPDATE payment_refunds SET reason = 'cross-tenant-write' WHERE tenant_id = $1 AND id = $2",
                [targetTenant, ids[`refund${suffix}`]],
            );
            return {
                counts,
                customerUpdate: customerUpdate.rowCount,
                supplierUpdate: supplierUpdate.rowCount,
                paymentUpdate: crossUpdate.rowCount,
                allocationUpdate: allocationUpdate.rowCount,
                reversalUpdate: reversalUpdate.rowCount,
                refundUpdate: refundUpdate.rowCount,
            };
        });
        for (const [direction, rows] of [
            ["b-to-a", await crossProbe(ids.tenantB, ids.externalB, ids.userB, ids.tenantA, "A")],
            ["a-to-b", await crossProbe(ids.tenantA, ids.externalA, ids.userA, ids.tenantB, "B")],
        ]) {
            const passed = Object.values(rows.counts).every((count) => Number(count) === 0) &&
                Object.entries(rows).filter(([key]) => key !== "counts").every(([, count]) => count === 0);
            results.push(result(`cross-tenant-financial-isolation-${direction}`, "no cross-tenant reads or writes for protected financial records",
                rows, passed ? "PASS" : "FAIL"));
        }

        const crossInsert = await withContext(runtime, ids.tenantB, ids.externalB, () => runtime.query(
            `INSERT INTO payments
             (id, tenant_id, customer_id, entry_type, amount, payment_date, idempotency_key, request_payload_hash)
             VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', 1, now(), $4, 'cross-tenant')`,
            [`${run}-cross-payment`, ids.tenantA, ids.customerA, `${run}-cross-payment`],
        )).then(() => "NO_ERROR").catch((error) => `${error.code ?? "ERROR"}:${error.message}`);
        results.push(result("cross-tenant-payment-insert", "RLS denial", crossInsert, crossInsert.startsWith("42501") ? "PASS" : "FAIL"));

        const crossAuditInsert = await withContext(runtime, ids.tenantB, ids.externalB, () => runtime.query(
            `INSERT INTO audit_logs (id, tenant_id, event_type, actor_id, target_type, target_id, metadata)
             VALUES ($1, $2, 'REFUND_REQUESTED', $3, 'payment_refund', $4, '{"source":"cross-tenant-runtime"}')`,
            [`${run}-cross-audit`, ids.tenantA, ids.userB, ids.refundA],
        )).then(() => "NO_ERROR").catch((error) => `${error.code ?? "ERROR"}:${error.message}`);
        results.push(result("cross-tenant-audit-insert", "RLS denial", crossAuditInsert, crossAuditInsert.startsWith("42501") ? "PASS" : "FAIL"));

        const counterpartyMismatch = await withContext(runtime, ids.tenantA, ids.externalA, () => runtime.query(
            `INSERT INTO payments
             (id, tenant_id, customer_id, entry_type, amount, payment_date, idempotency_key, request_payload_hash)
             VALUES ($1, $2, $3, 'PAYMENT_RECEIVED', 1, now(), $4, 'counterparty-mismatch')`,
            [`${run}-wrong-counterparty`, ids.tenantA, ids.customerB, `${run}-wrong-counterparty`],
        )).then(() => "NO_ERROR").catch((error) => `${error.code ?? "ERROR"}:${error.message}`);
        results.push(result("cross-tenant-counterparty-reference", "composite tenant FK denial", counterpartyMismatch, counterpartyMismatch.startsWith("23503") ? "PASS" : "FAIL"));

        const crossAllocation = await withContext(runtime, ids.tenantA, ids.externalA, () => runtime.query(
            `INSERT INTO payment_allocations
             (id, tenant_id, payment_id, purchase_invoice_id, amount, idempotency_key, request_payload_hash)
             VALUES ($1, $2, $3, $4, 1, $5, 'cross-allocation')`,
            [`${run}-cross-allocation`, ids.tenantA, ids.paymentSupplierB, ids.purchaseA, `${run}-cross-allocation`],
        )).then(() => "NO_ERROR").catch((error) => `${error.code ?? "ERROR"}:${error.message}`);
        results.push(result("cross-tenant-allocation-reference", "composite tenant FK denial", crossAllocation, crossAllocation.startsWith("23503") ? "PASS" : "FAIL"));

        const crossRefund = await withContext(runtime, ids.tenantA, ids.externalA, () => runtime.query(
            `INSERT INTO payment_refunds
             (id, tenant_id, payment_id, amount, status, idempotency_key, request_payload_hash, requested_by)
             VALUES ($1, $2, $3, 1, 'REQUESTED', $4, 'cross-refund', $5)`,
            [`${run}-cross-refund`, ids.tenantA, ids.paymentCustomerB, `${run}-cross-refund`, ids.userA],
        )).then(() => "NO_ERROR").catch((error) => `${error.code ?? "ERROR"}:${error.message}`);
        results.push(result("cross-tenant-refund-reference", "composite tenant FK denial", crossRefund, crossRefund.startsWith("23503") ? "PASS" : "FAIL"));
        const snapshotAfterCrossTenant = await financialSnapshot(bootstrap);
        results.push(result("cross-tenant-financial-state-unchanged", "both tenants' financial and audit records remain unchanged",
            { before: snapshotBeforeCrossTenant, after: snapshotAfterCrossTenant },
            snapshotBeforeCrossTenant === snapshotAfterCrossTenant ? "PASS" : "FAIL"));
    } finally {
        try {
            if (fixtureCreated) {
                await cleanup(bootstrap);
                cleaned = true;
            }
        } finally {
            await runtime.end();
            await bootstrap.end();
        }
    }
    const remaining = await connect(bootstrapUrl());
    const cleanupChecks = [
        ["tenants", [ids.tenantA, ids.tenantB]],
        ["users", [ids.userA, ids.userB]],
        ["customers", [ids.customerA, ids.customerB]],
        ["suppliers", [ids.supplierA, ids.supplierB]],
        ["payments", [ids.paymentCustomerA, ids.paymentCustomerB, ids.paymentSupplierA, ids.paymentSupplierB]],
        ["payment_allocations", [ids.allocationA, ids.allocationB]],
        ["allocation_reversals", [ids.reversalA, ids.reversalB]],
        ["payment_refunds", [ids.refundA, ids.refundB]],
        ["audit_logs", [ids.auditA, ids.auditB, ids.auditRuntimeA]],
    ];
    const remainingRows = {};
    for (const [table, rowIds] of cleanupChecks) {
        remainingRows[table] = Number((await query(
            remaining,
            `SELECT count(*)::int AS count FROM public."${table}" WHERE id = ANY($1::text[])`,
            [rowIds],
        ))[0].count);
    }
    await remaining.end();
    results.push(result(
        "restricted-role-fixture-cleanup",
        "all campaign fixture rows removed",
        { fixtureCleanup: cleaned, remainingRows },
        cleaned && Object.values(remainingRows).every((count) => count === 0) ? "PASS" : "FAIL",
    ));
    const evidence = createLifecycleEvidence({
        phase: "SUITE_EXECUTION",
        lifecycle,
        status: results.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
        details: {
            databaseName: process.env.TEST_DATABASE_NAME,
            runtimeRole: process.env.FINANCIAL_E2E_RUNTIME_DB_USER,
            fixtureCleanup: cleaned,
            remainingRows,
            results,
            applicationAuthentication: "Signed database context exercised; Supabase Auth not exercised.",
        },
    });
    writeLifecycleEvidence({
        filePath: process.env.FINANCIAL_E2E_SUITE_EVIDENCE_FILE,
        evidence,
    });
    console.log(JSON.stringify({
        run,
        databaseName: process.env.TEST_DATABASE_NAME,
        runtimeRole: process.env.FINANCIAL_E2E_RUNTIME_DB_USER,
        fixtureCleanup: cleaned,
        remainingRows,
        results,
        applicationAuthentication: "Signed database context exercised; Supabase Auth not exercised.",
    }, null, 2));
    if (results.some((item) => item.status === "FAIL")) process.exitCode = 1;
}

main().catch((error) => {
    console.error(`BEHAVIOR_HARNESS=FAIL ${error instanceof Error ? error.message : "sanitized error"}`);
    process.exitCode = 1;
});
