import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const provisioning = fs.readFileSync(new URL("../scripts/financial-e2e-provision-local.mjs", import.meta.url), "utf8");
const allocator = fs.readFileSync(new URL("../src/repositories/payment.repository.ts", import.meta.url), "utf8");
const matrix = fs.readFileSync(new URL("../.obsidian-vault/specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md", import.meta.url), "utf8");
const generated = fs.readFileSync(new URL("../prisma/financial-e2e-schema-provisioning.generated.sql", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../prisma/migrations/0025_payment_receipt_sequence/migration.sql", import.meta.url), "utf8");
const refundMigration = fs.readFileSync(new URL("../prisma/migrations/0027_refund_lifecycle/migration.sql", import.meta.url), "utf8");

test("generated receipt schema retains migration constraints and regenerates deterministically", () => {
    for (const sql of [generated, migration]) {
        assert.match(sql, /"next_value" INTEGER NOT NULL DEFAULT 1/);
        assert.match(sql, /CONSTRAINT "payment_receipt_sequences_next_value_check"\s+CHECK \("next_value" > 0\)/);
        assert.match(sql, /CONSTRAINT "payment_receipt_sequences_tenant_id_fkey"[\s\S]*?FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\)\s+ON DELETE CASCADE ON UPDATE CASCADE/);
        assert.match(sql, /PRIMARY KEY \("tenant_id",\s*"prefix"\)/);
    }
    const result = spawnSync(process.execPath, ["scripts/generate-financial-e2e-schema.mjs", "--check"], {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "postgresql://placeholder:placeholder@127.0.0.1:1/placeholder",
            DIRECT_URL: "postgresql://placeholder:placeholder@127.0.0.1:1/placeholder" },
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test("generated baseline retains refund safeguards without executing a migration during initialization", () => {
    for (const name of [
        "payments_one_counterparty_check",
        "payment_refunds_approved_actor_pair_check",
        "payment_refunds_rejected_actor_pair_check",
        "payment_refunds_cancelled_actor_pair_check",
    ]) {
        const pattern = new RegExp(`ADD CONSTRAINT "${name}"\\s+(CHECK \\([^\\n]+\\));`);
        assert.equal(generated.match(pattern)?.[1], refundMigration.match(pattern)?.[1], name);
        assert.ok(generated.match(pattern), name);
    }
    const fn = /CREATE OR REPLACE FUNCTION public\.guard_payment_refund_lifecycle\(\)[\s\S]*?\$function\$;/;
    assert.ok(refundMigration.match(fn));
    assert.equal(generated.match(fn)?.[0], refundMigration.match(fn)?.[0]);
    for (const name of [
        "payments_tenant_customer_fkey", "payments_tenant_supplier_fkey",
        "audit_logs_refund_lifecycle_idempotency_key", "payment_refunds_lifecycle_guard",
    ]) assert.ok(generated.includes(name), name);
    assert.doesNotMatch(provisioning, /REFUND_LIFECYCLE_MIGRATION_PATH|fs\.readFile\([^)]*0027_refund_lifecycle/);
});

test("receipt sequences receive signed tenant RLS in both initialization modes with narrow grants", () => {
    assert.match(provisioning, /const directTenantTables = \[[\s\S]*?"payment_receipt_sequences"/);
    assert.match(provisioning, /ALTER TABLE public\.\$\{ident\(table\)\} ENABLE ROW LEVEL SECURITY/);
    assert.match(provisioning, /ALTER TABLE public\.\$\{ident\(table\)\} FORCE ROW LEVEL SECURITY/);
    assert.match(provisioning, /tenant_id::text = public\.financial_context_tenant_id\(\)/);
    assert.match(provisioning, /allTenantTables\.filter\(\(table\) => table !== "payment_receipt_sequences"\)/);
    assert.match(provisioning, /GRANT UPDATE \(next_value\) ON TABLE public\.\$\{ident\("payment_receipt_sequences"\)\}/);
    assert.match(provisioning, /REVOKE ALL ON TABLE public\.\$\{ident\("payment_receipt_sequences"\)\} FROM PUBLIC/);
    assert.match(provisioning, /await client\.query\(buildControlSql\(contextSigningSecret\)\)/);
});

test("receipt allocator uses a tenant-scoped transactional upsert", () => {
    assert.match(allocator, /ON CONFLICT \("tenant_id", "prefix"\)/);
    assert.match(allocator, /"next_value" = "payment_receipt_sequences"\."next_value" \+ 1/);
    assert.match(allocator, /RETURNING "next_value" - 1 AS "allocated"/);
});

test("approved scenario expectations preserve signed net equations and commercial scope", () => {
    const row = (id) => matrix.split(/\r?\n/).find((line) => line.startsWith(`| ${id} |`)) ?? "";
    for (const [id, fragment] of [
        ["S-07", "credit ₹400; net AR ₹600"],
        ["S-08", "credit ₹1,000; net AR ₹0"],
        ["S-09", "credit ₹1,500; net AR ₹500"],
        ["S-10", "credit ₹700; net AR ₹300"],
        ["S-22", "credit ₹100; net AR ₹500"],
        ["S-23", "credit ₹400; net AR -₹300"],
        ["S-24", "credit ₹200; net AR ₹0"],
        ["S-31", "advance ₹2,000; net AP ₹0"],
        ["S-32", "advance ₹3,000; net AP ₹0"],
        ["S-33", "advance ₹750; net AP ₹1,250"],
        ["S-37", "original invoice face ₹2,000"],
        ["S-38", "Gross AP ₹1,900"],
    ]) assert.ok(row(id).includes(fragment), `${id} must include ${fragment}`);
    assert.match(row("S-09"), /atomically or neither/);
    assert.match(row("S-18"), /commercial customer credit note/);
    assert.match(row("S-18"), /not a GST workflow/);
    assert.match(row("S-38"), /No additional ₹550 adjustment/);
});
