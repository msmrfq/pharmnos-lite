#!/usr/bin/env node

import fs from "node:fs";

const schemaPath = "prisma/schema.prisma";
const generatedSqlPath = "prisma/financial-e2e-schema-provisioning.generated.sql";
const securitySqlPath = "prisma/financial-e2e-security-controls.review.sql";
const rlsSqlPath = "prisma/financial-e2e-rls-policies.review.sql";
const additiveSqlPath = "prisma/financial-e2e-additive-provisioning.review.sql";
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
    "purchase_posting_operations", "purchase_invoice_items",
    "purchase_gst_evidence_revisions", "purchase_gst_line_evidence",
    "purchase_gst_calculations", "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events", "purchase_gst_reconciliation_event_lines",
    "sales_invoices", "sales_invoice_items", "payments", "stock_movements",
    "customer_ledgers", "supplier_ledgers", "audit_logs",
];

const immutableTables = [
    "purchase_gst_evidence_revisions",
    "purchase_gst_line_evidence",
    "purchase_gst_calculations",
    "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events",
    "purchase_gst_reconciliation_event_lines",
];

export function validateArtifacts({
    schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "",
    sql = fs.existsSync(generatedSqlPath) ? fs.readFileSync(generatedSqlPath, "utf8") : "",
    securitySql = fs.existsSync(securitySqlPath) ? fs.readFileSync(securitySqlPath, "utf8") : "",
    rlsSql = fs.existsSync(rlsSqlPath) ? fs.readFileSync(rlsSqlPath, "utf8") : "",
    additiveSql = fs.existsSync(additiveSqlPath) ? fs.readFileSync(additiveSqlPath, "utf8") : "",
    runbook = fs.existsSync(runbookPath) ? fs.readFileSync(runbookPath, "utf8") : "",
} = {}) {
    const errors = [];

    if (!schema) errors.push("schema is missing.");
    if (!sql) errors.push("generated provisioning artifact is missing.");
    if (!securitySql) errors.push("security controls artifact is missing.");
    if (!rlsSql) errors.push("RLS policy artifact is missing.");
    if (!additiveSql) errors.push("additive review wrapper is missing.");
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
            !rlsSql.includes(`tenant_insert_${table}`)) {
            errors.push(`RLS artifact omits SELECT/INSERT policy coverage: ${table}`);
        }
        if (!immutableTables.includes(table) && table !== "audit_logs" &&
            !rlsSql.includes(`tenant_update_${table}`)) {
            errors.push(`RLS artifact omits UPDATE policy coverage: ${table}`);
        }
    }
    for (const marker of [
        "ENABLE ROW LEVEL SECURITY",
        "FORCE ROW LEVEL SECURITY",
        "current_setting(",
        "'request.jwt.claim.tenant_id'",
        "WITH CHECK",
        "REVOKE CREATE ON SCHEMA public",
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
    for (const marker of [
        "ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY",
        "tenant_id::text = NULLIF(current_setting(",
        "id::text = NULLIF(current_setting(",
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
    if (!sql.includes('"purchase_gst_decision_calculation_fkey"') ||
        !/purchase_gst_accounting_decisions[\s\S]*calculation purchase_gst_calculations/.test(schema)) {
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
