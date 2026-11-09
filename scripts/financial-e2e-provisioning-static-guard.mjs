#!/usr/bin/env node

import fs from "node:fs";

const schemaPath = "prisma/schema.prisma";
const generatedSqlPath = "prisma/financial-e2e-schema-provisioning.generated.sql";
const securitySqlPath = "prisma/financial-e2e-security-controls.review.sql";
const rlsSqlPath = "prisma/financial-e2e-rls-policies.review.sql";
const additiveSqlPath = "prisma/financial-e2e-additive-provisioning.review.sql";
const temporalMigrationPath = "prisma/migrations/0028_financial_event_dates/migration.sql";
const provisionerPath = "scripts/financial-e2e-provision-local.mjs";
const runbookPath = ".obsidian-vault/specs/financial-e2e-provisioning-artifacts-2026-10-25.md";

const expectedEnums = [
    "PurchaseGstReconciliationStatus",
    "PurchaseGstAccountingAcceptanceStatus",
    "PurchaseGstEvidenceRevisionKind",
    "PurchaseGstReconciliationEventKind",
];

const expectedTables = [
    "purchase_posting_operations",
    "purchase_gst_evidence_revisions",
    "purchase_gst_line_evidence",
    "purchase_gst_calculations",
    "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events",
    "purchase_gst_reconciliation_event_lines",
    "inventory_valuation_decisions",
    "inventory_valuation_adjustments",
];

const requiredMarkers = [
    "purchase_gst_decision_calculation_fkey",
    "purchase_invoices_current_gst_evidence_fkey",
    "purchase_invoices_current_gst_calculation_fkey",
    "purchase_invoices_current_gst_accounting_decision_fkey",
];

const tenantTables = [
    "tenants", "users", "memberships", "roles", "role_permissions", "business_profiles", "products",
    "product_batches", "customers", "suppliers", "purchase_invoices",
    "purchase_supplier_documents",
    "purchase_posting_operations", "purchase_invoice_items",
    "purchase_gst_evidence_revisions", "purchase_gst_line_evidence",
    "purchase_gst_calculations", "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events", "purchase_gst_reconciliation_event_lines",
    "inventory_valuation_decisions", "inventory_valuation_adjustments",
    "sales_invoices", "sales_posting_operations", "sales_invoice_items", "payments", "stock_movements",
    "payment_allocations", "allocation_reversals", "payment_refunds", "payment_reversals",
    "customer_ledgers", "supplier_ledgers", "audit_logs",
    "hsn_sac_catalog", "gst_rate_rules", "hsn_sac_catalog_history", "gst_rate_rule_history",
];

const immutableTables = [
    "purchase_gst_evidence_revisions",
    "purchase_gst_line_evidence",
    "purchase_gst_calculations",
    "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events",
    "purchase_gst_reconciliation_event_lines",
    "hsn_sac_catalog_history",
    "gst_rate_rule_history",
    "inventory_valuation_decisions",
    "inventory_valuation_adjustments",
];
const readOnlyCatalogTables = ["hsn_sac_catalog", "gst_rate_rules"];

export function validateGovernanceMigration(migration = "") {
    const errors = [];
    const normalized = String(migration).replace(/\s+/g, " ").trim();
    const foreignKeys = [
        {
            declaration: 'ALTER TABLE "hsn_sac_catalog" ADD CONSTRAINT "hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey" FOREIGN KEY ("tenant_id", "classification_approved_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE',
        },
        {
            declaration: 'ALTER TABLE "gst_rate_rules" ADD CONSTRAINT "gst_rate_rules_tenant_id_approved_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "approved_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE',
        },
    ];
    for (const foreignKey of foreignKeys) {
        if (!normalized.includes(foreignKey.declaration)) {
            errors.push(`missing exact tenant-aware foreign key: ${foreignKey.declaration.match(/"([^"]+_fkey)"/)?.[1] ?? "unknown"}`);
        }
    }
    for (const marker of [
        "hsn_sac_catalog_approval_state_check",
        "gst_rate_rules_approval_state_check",
        "prevent_hsn_sac_catalog_history_mutation",
        "prevent_gst_rate_rule_history_mutation",
        "prevent_approved_gst_rule_mutation",
        "gst_rate_rules_approved_period_excl",
    ]) {
        if (!normalized.includes(marker)) errors.push(`missing governance migration marker: ${marker}`);
    }
    if (!normalized.includes("conname <> 'hsn_sac_catalog_tenant_id_classification_approved_by_membe_fkey'") ||
        !normalized.includes("Equivalent classification approver foreign key exists under a different name")) {
        errors.push("missing classification approver duplicate-definition guard");
    }
    if (!normalized.includes("conname <> 'gst_rate_rules_tenant_id_approved_by_membership_id_fkey'") ||
        !normalized.includes("Equivalent GST rate approver foreign key exists under a different name")) {
        errors.push("missing GST rate approver duplicate-definition guard");
    }
    return errors;
}

export function validateTemporalMigration(migration = "", schema = "") {
    const errors = [];
    const normalized = String(migration).replace(/\s+/g, " ");
    const tables = [
        "sales_invoices", "purchase_invoices", "payments", "customer_ledgers",
        "supplier_ledgers", "payment_allocations", "allocation_reversals",
        "payment_refunds", "payment_reversals",
    ];
    if (!normalized.includes('CREATE TYPE "FinancialDateBasis" AS ENUM')) {
        errors.push("temporal migration omits FinancialDateBasis.");
    }
    for (const table of tables) {
        if (!new RegExp(`ALTER TABLE "${table}" ADD COLUMN`).test(normalized)) {
            errors.push(`temporal migration omits additive fields for ${table}.`);
        }
    }
    for (const marker of [
        "clock_timestamp()",
        "public.assign_financial_recorded_at()",
        "public.protect_financial_recorded_at()",
        "public.guard_invoice_financial_dates()",
        "public.guard_refund_financial_dates()",
        "NEW.recorded_at IS NOT NULL",
        "NEW.finalized_recorded_at IS NOT NULL",
        "NEW.requested_recorded_at IS NOT NULL",
        "NEW.completed_recorded_at IS NOT NULL",
        "DERIVED_FROM_OCCURRED_AT",
        "NEW.effective_date IS DISTINCT FROM OLD.effective_date",
        "NEW.occurred_at IS DISTINCT FROM OLD.occurred_at",
        "(to_jsonb(NEW) -> 'effective_date_basis') IS DISTINCT FROM (to_jsonb(OLD) -> 'effective_date_basis')",
        "recorded_at := clock_timestamp()",
        "AT TIME ZONE 'Asia/Kolkata'",
        "BEGIN GENERATED BASELINE FINANCIAL TEMPORAL CONTROLS",
        "END GENERATED BASELINE FINANCIAL TEMPORAL CONTROLS",
    ]) {
        if (!normalized.includes(marker)) errors.push(`temporal migration omits required control: ${marker}`);
    }
    if (/NEW\.(effective_date|occurred_at|due_date_business)\s*:=/i.test(migration)) {
        errors.push("temporal recording trigger derives or overwrites producer-owned event facts.");
    }
    const basisChecks = [
        "payments_effective_date_basis_check",
        "customer_ledgers_effective_date_basis_check",
        "supplier_ledgers_effective_date_basis_check",
        "payment_refunds_completed_effective_date_basis_check",
    ];
    for (const name of basisChecks) {
        const start = migration.indexOf(`ADD CONSTRAINT "${name}"`);
        const end = start < 0 ? -1 : migration.indexOf(";", start);
        const check = start < 0 || end < 0 ? "" : migration.slice(start, end);
        if (!check) {
            errors.push("temporal migration omits a financial date-basis check.");
        } else if (check.includes("EVIDENCE_CLASSIFIED")) {
            errors.push("EVIDENCE_CLASSIFIED must remain unavailable until provenance is separately authorized.");
        }
    }
    if (/\bUPDATE\s+"(?:sales_invoices|purchase_invoices|payments|customer_ledgers|supplier_ledgers|payment_allocations|allocation_reversals|payment_refunds|payment_reversals)"\b/i.test(migration)) {
        errors.push("temporal migration updates existing financial rows.");
    }
    for (const model of [
        "payments", "customer_ledgers", "supplier_ledgers",
    ]) {
        const modelBlock = String(schema).match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? "";
        for (const field of ["effective_date", "effective_date_basis", "occurred_at", "recorded_at"]) {
            if (!new RegExp(`^\\s*${field}\\s+`, "m").test(modelBlock)) {
                errors.push(`Prisma model ${model} omits ${field}.`);
            }
        }
    }
    if (/ADD COLUMN[^;]*\b(?:NOT NULL|DEFAULT)\b/i.test(migration) ||
        /\bSET\s+(?:NOT NULL|DEFAULT)\b|\bDROP\s+(?:COLUMN|TABLE|TYPE|CONSTRAINT)\b/i.test(migration)) {
        errors.push("temporal migration must stay additive: nullable columns without defaults and no drops.");
    }
    const recordedColumns = [
        ["payments", "recorded_at"], ["customer_ledgers", "recorded_at"], ["supplier_ledgers", "recorded_at"],
        ["payment_allocations", "recorded_at"], ["allocation_reversals", "recorded_at"], ["payment_reversals", "recorded_at"],
        ["sales_invoices", "finalized_recorded_at"], ["purchase_invoices", "finalized_recorded_at"],
        ["payment_refunds", "requested_recorded_at"], ["payment_refunds", "completed_recorded_at"],
    ];
    const honest = (text) => /pre-commit/i.test(text) && text.includes("NOT commit-visible") &&
        text.includes("NOT proof of historical knowledge");
    for (const [table, column] of recordedColumns) {
        const comment = migration.match(new RegExp(`COMMENT ON COLUMN "${table}"\\."${column}" IS\\s+'([^']*)'`))?.[1] ?? "";
        if (!honest(comment)) errors.push(`recorded-time column ${table}.${column} lacks the pre-commit SQL COMMENT.`);
        const modelBlock = String(schema).match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? "";
        const doc = modelBlock.match(new RegExp(`((?:^[ \\t]*///.*\\r?\\n)+)[ \\t]*${column}[ \\t]+DateTime`, "m"))?.[1] ?? "";
        if (!honest(doc)) errors.push(`recorded-time column ${table}.${column} lacks the pre-commit Prisma doc comment.`);
    }
    return errors;
}

export function validateArtifacts({
    schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "",
    sql = fs.existsSync(generatedSqlPath) ? fs.readFileSync(generatedSqlPath, "utf8") : "",
    securitySql = fs.existsSync(securitySqlPath) ? fs.readFileSync(securitySqlPath, "utf8") : "",
    rlsSql = fs.existsSync(rlsSqlPath) ? fs.readFileSync(rlsSqlPath, "utf8") : "",
    additiveSql = fs.existsSync(additiveSqlPath) ? fs.readFileSync(additiveSqlPath, "utf8") : "",
    temporalMigration = fs.existsSync(temporalMigrationPath) ? fs.readFileSync(temporalMigrationPath, "utf8") : "",
    provisioner = fs.existsSync(provisionerPath) ? fs.readFileSync(provisionerPath, "utf8") : "",
    runbook = fs.existsSync(runbookPath) ? fs.readFileSync(runbookPath, "utf8") : "",
    migration = fs.existsSync("prisma/migrations/0008_hsn_governance_integrity/migration.sql")
        ? fs.readFileSync("prisma/migrations/0008_hsn_governance_integrity/migration.sql", "utf8")
        : "",
} = {}) {
    const errors = [];
    errors.push(...validateGovernanceMigration(migration));
    errors.push(...validateTemporalMigration(temporalMigration, schema));

    if (!schema) errors.push("schema is missing.");
    if (!sql) errors.push("generated provisioning artifact is missing.");
    if (!securitySql) errors.push("security controls artifact is missing.");
    if (!rlsSql) errors.push("RLS policy artifact is missing.");
    if (!additiveSql) errors.push("additive review wrapper is missing.");
    if (!provisioner) errors.push("connected provisioner is missing.");
    if (!runbook) errors.push("provisioning runbook is missing.");
    if (!/Generated offline from the current Prisma schema[\s\S]*complete baseline/i.test(sql)) {
        errors.push("generated SQL is not explicitly labeled as a complete baseline.");
    }
    if (!/REVIEW ARTIFACT ONLY[\s\S]*not an additive migration/i.test(additiveSql)) {
        errors.push("additive wrapper is not explicitly labeled review-only/non-additive.");
    }
    if (!/REVIEW ARTIFACT ONLY[\s\S]*not an executable provisioning file/i.test(securitySql)) {
        errors.push("security artifact is not explicitly labeled review-only.");
    }
    if (!/REVIEW SPECIFICATION ONLY[\s\S]*Do not execute/i.test(rlsSql)) {
        errors.push("RLS artifact is not explicitly labeled review-only.");
    }
    if (/\bDROP\s+(TABLE|TYPE|SCHEMA)\b/i.test(sql)) {
        errors.push("generated schema contains a destructive DROP statement.");
    }
    const prismaEnums = [...schema.matchAll(/^enum\s+([A-Za-z0-9_]+)/gm)].map((match) => match[1]);
    for (const name of prismaEnums) {
        if (!new RegExp(`CREATE TYPE "${name}" AS ENUM`, "i").test(sql)) {
            errors.push(`generated baseline omits Prisma enum: ${name}`);
        }
    }
    const prismaModels = [...schema.matchAll(/^model\s+([A-Za-z0-9_]+)/gm)].map((match) => match[1]);
    for (const name of prismaModels) {
        if (!new RegExp(`CREATE TABLE "${name}"`, "i").test(sql)) {
            errors.push(`generated baseline omits Prisma model table: ${name}`);
        }
    }
    if (/\bTRUNCATE\b/i.test(sql)) {
        errors.push("generated schema contains TRUNCATE.");
    }
    const forbidden = [
        /\bGRANT\s+ALL\b/i,
        /\bCREATE\s+ROLE\b/i,
        /\bALTER\s+ROLE\b/i,
        /\bGRANT\b[\s\S]{0,120}\bTO\s+PUBLIC\b/i,
        /\bDROP\s+(TABLE|TYPE|SCHEMA|FUNCTION|TRIGGER)\b/i,
        /\bTRUNCATE\b/i,
    ];
    for (const pattern of forbidden) {
        if (pattern.test(securitySql)) errors.push(`security artifact contains forbidden pattern: ${pattern}`);
    }
    for (const role of ["pharmnos_e2e", "pharmnos_e2e_runtime"]) {
        if (!securitySql.includes(role)) errors.push(`security artifact omits supported role: ${role}`);
    }
    for (const table of tenantTables) {
        if (!securitySql.includes(`public.${table}`)) {
            errors.push(`security artifact omits tenant table coverage: ${table}`);
        }
        if (!rlsSql.includes(`tenant_select_${table}`) ||
            (!readOnlyCatalogTables.includes(table) && !rlsSql.includes(`tenant_insert_${table}`))) {
            errors.push(`RLS artifact omits SELECT/INSERT policy coverage: ${table}`);
        }
        if (!readOnlyCatalogTables.includes(table) &&
            !immutableTables.includes(table) && table !== "audit_logs" &&
            !rlsSql.includes(`tenant_update_${table}`)) {
            errors.push(`RLS artifact omits UPDATE policy coverage: ${table}`);
        }
    }
    const requiredTenantBlock = securitySql.match(/Required tenant-scoped tables:([\s\S]*?)sales_posting_operations is tenant-scoped/)?.[1] ?? "";
    const runtimeGrants = [...securitySql.matchAll(/GRANT SELECT, INSERT, UPDATE ON TABLE([\s\S]*?)TO pharmnos_e2e_runtime;/g)].map((match) => match[1]);
    for (const table of [
        "sales_invoices", "purchase_invoices", "payments", "customer_ledgers", "supplier_ledgers",
        "payment_allocations", "allocation_reversals", "payment_refunds", "payment_reversals",
    ]) {
        if (!new RegExp(`\\b${table}\\b`).test(requiredTenantBlock)) {
            errors.push(`security artifact required-table list omits temporal table: ${table}`);
        }
        if (!runtimeGrants.some((grant) => grant.includes(`public.${table}`))) {
            errors.push(`security artifact runtime grant omits temporal table: ${table}`);
        }
        if (!provisioner.includes(`"${table}",`)) {
            errors.push(`connected provisioner omits tenant control coverage for temporal table: ${table}`);
        }
    }
    for (const marker of [
        "ENABLE ROW LEVEL SECURITY",
        "FORCE ROW LEVEL SECURITY",
        "current_setting(",
        "'pharmnos.auth_context'",
        "auth_context_replays",
        "txid_current()",
        "ON CONFLICT (nonce) DO NOTHING",
        "WITH CHECK",
        "REVOKE CREATE ON SCHEMA public",
        'REVOKE ALL ON TYPE public."FinancialDateBasis" FROM PUBLIC',
        'GRANT USAGE ON TYPE public."FinancialDateBasis" TO pharmnos_e2e_runtime',
        "ALTER DEFAULT PRIVILEGES",
        "SECURITY DEFINER",
        "SET search_path = pg_catalog, public",
        "SQLSTATE 42501",
        "SQLSTATE 23514",
        "PROCESSING -> COMPLETED",
        "PROCESSING -> FAILED",
    ]) {
        if (!securitySql.includes(marker)) errors.push(`security artifact omits control marker: ${marker}`);
    }
    if (!provisioner.includes('"FinancialDateBasis"') ||
        !provisioner.includes('REVOKE ALL ON TYPE public.${ident("FinancialDateBasis")} FROM PUBLIC')) {
        errors.push("connected provisioner omits the FinancialDateBasis privilege controls.");
    }
    for (const marker of [
        "ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY",
        "tenant_id::text = public.financial_context_tenant_id()",
        "id::text = public.financial_context_tenant_id()",
        "public.financial_context_subject()",
        "EXISTS (",
        "tenant_select_tenants",
        "tenant_select_role_permissions",
        "tenant_select_users",
        "EXISTS (",
        "public.memberships AS m",
        "no UPDATE/DELETE",
    ]) {
        if (!rlsSql.includes(marker)) errors.push(`RLS artifact omits control marker: ${marker}`);
    }
    for (const marker of [
        "financial-e2e-schema-provisioning.generated.sql",
        "financial-e2e-additive-provisioning.review.sql",
        "financial-e2e-security-controls.review.sql",
        "financial-e2e-rls-policies.review.sql",
    ]) {
        if (!runbook.includes(marker) && !securitySql.includes(marker)) {
            errors.push(`artifact cross-reference is missing: ${marker}`);
        }
    }
    if (!additiveSql.includes("REVIEW ARTIFACT ONLY") ||
        !additiveSql.includes("ROLLBACK")) {
        errors.push("additive wrapper is not clearly review-only and rollback-bounded.");
    }
    for (const marker of [
        "target identity",
        "bootstrap role",
        "runtime role",
        "RLS",
        "immutability",
        "fixtures",
        "financial E2E",
        "Owner's Decision - controlled-function ownership",
    ]) {
        if (!runbook.toLowerCase().includes(marker.toLowerCase())) {
            errors.push(`runbook omits required provisioning evidence: ${marker}`);
        }
    }
    for (const name of expectedEnums) {
        if (!new RegExp(`CREATE TYPE "${name}" AS ENUM`, "i").test(sql)) {
            errors.push(`missing generated enum: ${name}`);
        }
        if (!new RegExp(`enum ${name}\\s*\\{`, "m").test(schema)) {
            errors.push(`missing Prisma enum: ${name}`);
        }
    }
    for (const name of expectedTables) {
        if (!new RegExp(`CREATE TABLE "${name}"`, "i").test(sql)) {
            errors.push(`missing generated table: ${name}`);
        }
        if (!new RegExp(`model ${name}\\s*\\{`, "m").test(schema)) {
            errors.push(`missing Prisma model: ${name}`);
        }
    }
    for (const marker of requiredMarkers) {
        if (!sql.includes(marker)) errors.push(`missing mapped constraint: ${marker}`);
    }
    for (const marker of [
        "prevent_hsn_sac_catalog_history_mutation",
        "prevent_gst_rate_rule_history_mutation",
        "prevent_approved_gst_rule_mutation",
        "hsn_sac_catalog_approval_state_check",
        "gst_rate_rules_approval_state_check",
        "gst_rate_rules_approved_period_excl",
        "REVOKE UPDATE, DELETE ON TABLE \"hsn_sac_catalog_history\", \"gst_rate_rule_history\" FROM PUBLIC",
    ]) {
        if (!sql.includes(marker)) errors.push(`generated baseline omits governance control: ${marker}`);
    }
    if (!sql.includes('"purchase_gst_decision_calculation_fkey"') ||
        !/purchase_gst_accounting_decisions[\s\S]*calculation\s+purchase_gst_calculations/.test(schema)) {
        errors.push("Option B calculation relation is not represented in both artifacts.");
    }
    return errors;
}

const errors = validateArtifacts();
if (errors.length > 0) {
    console.error("PROVISIONING_STATIC_GUARD=FAIL");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log("PROVISIONING_STATIC_GUARD=PASS");
    console.log(`EXPECTED_GST_ENUMS=${expectedEnums.length}`);
    console.log(`EXPECTED_GST_TABLES=${expectedTables.length}`);
    console.log(`EXPECTED_RLS_TABLES=${tenantTables.length}`);
    console.log("DESTRUCTIVE_STATEMENTS=none");
    console.log("FORBIDDEN_PRIVILEGES=absent");
    console.log("OPTION_B_CALCULATION_RELATION=present");
}
