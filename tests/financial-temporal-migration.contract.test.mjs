import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validateArtifacts, validateTemporalMigration } from "../scripts/financial-e2e-provisioning-static-guard.mjs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync("prisma/migrations/0028_financial_event_dates/migration.sql", "utf8");
const baseline = fs.readFileSync("prisma/financial-e2e-schema-provisioning.generated.sql", "utf8");

function model(name) {
    return schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? "";
}

test("Prisma models expose the additive date and instant contract", () => {
    for (const name of ["sales_invoices", "purchase_invoices"]) {
        const block = model(name);
        assert.match(block, /effective_date\s+DateTime\?\s+@db\.Date/);
        assert.match(block, /due_date_business\s+DateTime\?\s+@db\.Date/);
        assert.match(block, /finalized_recorded_at\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
    }

    for (const name of ["payments", "customer_ledgers", "supplier_ledgers"]) {
        const block = model(name);
        assert.match(block, /effective_date\s+DateTime\?\s+@db\.Date/);
        assert.match(block, /effective_date_basis\s+FinancialDateBasis\?/);
        assert.match(block, /occurred_at\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
        assert.match(block, /recorded_at\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
    }

    for (const name of ["payment_allocations", "allocation_reversals", "payment_reversals"]) {
        const block = model(name);
        assert.match(block, /effective_date\s+DateTime\?\s+@db\.Date/);
        assert.match(block, /occurred_at\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
        assert.match(block, /recorded_at\s+DateTime\?\s+@db\.Timestamptz\(3\)/);
    }

    const refunds = model("payment_refunds");
    for (const field of ["requested_business_date", "completed_effective_date"]) {
        assert.match(refunds, new RegExp(`${field}\\s+DateTime\\?\\s+@db\\.Date`));
    }
    for (const field of ["requested_occurred_at", "requested_recorded_at", "completed_occurred_at", "completed_recorded_at"]) {
        assert.match(refunds, new RegExp(`${field}\\s+DateTime\\?\\s+@db\\.Timestamptz\\(3\\)`));
    }
    assert.match(refunds, /completed_effective_date_basis\s+FinancialDateBasis\?/);
    assert.match(schema, /enum FinancialDateBasis\s*\{[^}]*EXPLICIT[^}]*DERIVED_FROM_OCCURRED_AT[^}]*EVIDENCE_CLASSIFIED[^}]*AMBIGUOUS[^}]*UNCLASSIFIED/s);
});

test("migration is nullable and additive without historical updates or date inference", () => {
    const addedColumns = [...migration.matchAll(/ADD COLUMN "([^"]+)" ([A-Z]+(?:\([^)]+\))?)(?:,|;)/g)];
    assert.ok(addedColumns.length >= 30);
    assert.ok(addedColumns.every(([, , type]) => ["DATE", "TIMESTAMPTZ(3)", '"FinancialDateBasis"'].includes(type)));
    assert.doesNotMatch(migration, /\bUPDATE\s+"(?:sales_invoices|purchase_invoices|payments|customer_ledgers|supplier_ledgers|payment_allocations|allocation_reversals|payment_refunds|payment_reversals)"\b/i);
    assert.doesNotMatch(migration, /NEW\.(?:effective_date|occurred_at|due_date_business)\s*:=/i);
    assert.match(migration, /"effective_date" = \("occurred_at" AT TIME ZONE 'Asia\/Kolkata'\)::date/);
    assert.match(migration, /"completed_effective_date" = \("completed_occurred_at" AT TIME ZONE 'Asia\/Kolkata'\)::date/);
    assert.deepEqual(validateTemporalMigration(migration, schema), []);
});

test("evidence-classified dates are rejected until provenance handling is authorized", () => {
    const checks = [
        "payments_effective_date_basis_check",
        "customer_ledgers_effective_date_basis_check",
        "supplier_ledgers_effective_date_basis_check",
        "payment_refunds_completed_effective_date_basis_check",
    ];
    for (const name of checks) {
        const start = migration.indexOf(`ADD CONSTRAINT "${name}"`);
        const end = start < 0 ? -1 : migration.indexOf(";", start);
        const check = start < 0 || end < 0 ? "" : migration.slice(start, end);
        assert.ok(check, "expected database date-basis constraint");
        assert.doesNotMatch(check, /EVIDENCE_CLASSIFIED/);
    }
    assert.match(schema, /EVIDENCE_CLASSIFIED/);

    const unsafe = migration.replace(
        /('DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis")/,
        '$1, \'EVIDENCE_CLASSIFIED\'::"FinancialDateBasis"',
    );
    assert.notEqual(unsafe, migration, "mutation must inject the forbidden basis");
    assert.ok(validateTemporalMigration(unsafe, schema).some((error) => error.includes("EVIDENCE_CLASSIFIED")));
});

test("database triggers assign recording time but leave event dates and instants producer-owned", () => {
    assert.match(migration, /NEW\.recorded_at := clock_timestamp\(\)/);
    assert.match(migration, /NEW\.finalized_recorded_at := clock_timestamp\(\)/);
    assert.match(migration, /NEW\.requested_recorded_at := clock_timestamp\(\)/);
    assert.match(migration, /NEW\.completed_recorded_at := clock_timestamp\(\)/);
    assert.match(migration, /NEW\.recorded_at IS NOT NULL/);
    assert.match(migration, /NEW\.finalized_recorded_at IS NOT NULL/);
    assert.match(migration, /NEW\.requested_recorded_at IS NOT NULL/);
    assert.match(migration, /NEW\.completed_recorded_at IS NOT NULL/);
    assert.match(migration, /NEW\.occurred_at IS DISTINCT FROM OLD\.occurred_at/);
    assert.match(migration, /NEW\.effective_date IS DISTINCT FROM OLD\.effective_date/);
    assert.doesNotMatch(migration, /AT TIME ZONE 'Asia\/Kolkata'[^;]*clock_timestamp\(\)/);
});

test("generated empty-schema baseline includes migration temporal controls and columns", () => {
    for (const marker of [
        '"FinancialDateBasis"',
        '"effective_date"',
        '"due_date_business"',
        '"finalized_recorded_at"',
        '"requested_business_date"',
        '"completed_effective_date"',
        "public.assign_financial_recorded_at()",
        "public.guard_invoice_financial_dates()",
        "public.guard_refund_financial_dates()",
        "payments_derived_date_requires_occurred_at_check",
    ]) {
        assert.ok(baseline.includes(marker), `baseline is missing ${marker}`);
    }
});

test("mixed-version: an old writer's insert yields unclassified-by-NULL rows with a database recorded time", () => {
    const normalized = migration.replace(/\s+/g, " ");
    // Every added column is nullable without a default, so a legacy-shaped INSERT remains valid
    // and cannot be classified by a column default.
    assert.doesNotMatch(normalized, /ADD COLUMN[^;]*\b(?:NOT NULL|DEFAULT)\b/i);
    assert.doesNotMatch(normalized, /\bSET\s+(?:NOT NULL|DEFAULT)\b/i);
    // Nothing rejects a NULL date, basis or instant; only supplied recorded-time or completion facts are rejected.
    assert.doesNotMatch(migration, /NEW\.(?:effective_date|effective_date_basis|occurred_at|due_date_business|requested_business_date|requested_occurred_at)\s+IS\s+NULL/i);
    for (const check of ["payments", "customer_ledgers", "supplier_ledgers"].map((table) => `ADD CONSTRAINT "${table}_effective_date_basis_check" CHECK ( ("effective_date" IS NULL AND "effective_date_basis" IS NULL)`)) {
        assert.ok(normalized.includes(check), "NULL date with NULL basis must remain a valid state");
    }
    assert.ok(normalized.includes('ADD CONSTRAINT "payment_refunds_completed_effective_date_basis_check" CHECK ( ("completed_effective_date" IS NULL AND "completed_effective_date_basis" IS NULL)'));
    for (const rule of [
        '"effective_date_basis" IS DISTINCT FROM \'DERIVED_FROM_OCCURRED_AT\'::"FinancialDateBasis" OR "occurred_at" IS NOT NULL',
        '"effective_date_basis" IS DISTINCT FROM \'DERIVED_FROM_OCCURRED_AT\'::"FinancialDateBasis" OR "effective_date" =',
    ]) {
        assert.ok(normalized.includes(rule), "a NULL basis must satisfy the derived-date rules");
    }
    // The database still assigns recorded time, so a post-migration old-writer row is
    // (NULL dates, non-NULL recorded time), distinct from a pre-migration row (all NULL).
    assert.match(migration, /CREATE TRIGGER "payments_assign_recorded_at"\s+BEFORE INSERT/);
    assert.match(migration, /IF NEW\.recorded_at IS NOT NULL THEN/);
    assert.match(migration, /NEW\.recorded_at := clock_timestamp\(\)/);
    assert.match(migration, /IF NEW\.status = 'FINALIZED'::public\."InvoiceStatus" THEN\s+NEW\.finalized_recorded_at := clock_timestamp\(\)/);
});

test("rollback by read-switch preserves new evidence: the migration is strictly additive", () => {
    assert.doesNotMatch(migration, /\bDROP\s+(?:COLUMN|TABLE|TYPE|CONSTRAINT|TRIGGER)\b/i);
    assert.doesNotMatch(migration, /\b(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO|TRUNCATE)\b\s+(?:"?public"?\.)?"?(?:sales_invoices|purchase_invoices|payments|customer_ledgers|supplier_ledgers|payment_allocations|allocation_reversals|payment_reversals|payment_refunds)\b/i);
    assert.doesNotMatch(migration, /\bRENAME\b/i);
    for (const legacy of ["entry_date", "payment_date", "due_date", "invoice_date", "created_at"]) {
        assert.doesNotMatch(migration, new RegExp(`ALTER COLUMN "${legacy}"`));
    }
    assert.doesNotMatch(migration, /\bADD COLUMN "(?:entry_date|payment_date|due_date|invoice_date)"/);
});

test("recorded-time columns carry the honest pre-commit comment and the guard enforces it", () => {
    assert.match(migration, /COMMENT ON TYPE "FinancialDateBasis" IS/);
    assert.match(baseline, /COMMENT ON COLUMN "payment_refunds"\."completed_recorded_at" IS/);
    const stripped = migration.replace(/COMMENT ON COLUMN "payments"\."recorded_at" IS\s+'[^']*';/, "");
    assert.notEqual(stripped, migration);
    assert.ok(validateTemporalMigration(stripped, schema).some((error) => error.includes("payments.recorded_at")));
    const dishonest = migration.replace(/NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant\. Caller-supplied values are rejected and updates are blocked\. NULL = legacy row, unknown\.'/, "commit-visible time.'");
    assert.notEqual(dishonest, migration);
    assert.ok(validateTemporalMigration(dishonest, schema).length > 0);
    const undocumented = schema.replace(/\/\/\/ Pre-commit database acceptance time of the request[^\n]*\n[^\n]*\n/, "");
    assert.notEqual(undocumented, schema);
    assert.ok(validateTemporalMigration(migration, undocumented).some((error) => error.includes("requested_recorded_at")));
});

test("tenant controls cover every temporal table, including allocations, reversals and refunds", () => {
    assert.deepEqual(validateArtifacts(), []);
    const securitySql = fs.readFileSync("prisma/financial-e2e-security-controls.review.sql", "utf8");
    const rlsSql = fs.readFileSync("prisma/financial-e2e-rls-policies.review.sql", "utf8");
    for (const table of ["payment_allocations", "allocation_reversals", "payment_refunds", "payment_reversals"]) {
        assert.match(securitySql, new RegExp(`GRANT SELECT, INSERT, UPDATE ON TABLE[\\s\\S]*?public\\.${table}[\\s\\S]*?TO pharmnos_e2e_runtime;`));
        for (const policy of ["select", "insert", "update"]) {
            assert.ok(rlsSql.includes(`tenant_${policy}_${table}`), `${policy} policy for ${table}`);
        }
        const required = securitySql.match(/Required tenant-scoped tables:([\s\S]*?)sales_posting_operations is tenant-scoped/)[1];
        assert.match(required, new RegExp(`\\b${table}\\b`));
        const mutated = securitySql.replace(required, required.replace(new RegExp(`\\b${table}\\b`), "redacted"));
        assert.ok(validateArtifacts({ securitySql: mutated }).some((error) => error.includes(table)), `${table} omission must be detected`);
    }
});

