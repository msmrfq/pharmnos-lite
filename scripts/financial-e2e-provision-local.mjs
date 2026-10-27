import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
    REQUIRED_MARKER,
    targetBinding,
    validateLocalDisposableTargetCandidate,
    validateFinancialE2eTarget,
} from "./financial-e2e-safety.mjs";
import {
    verifyArtifactFiles,
} from "./financial-e2e-artifact-package.mjs";
import {
    REQUIRED_INITIALIZATION_SEQUENCE,
    validateConnectedInitializationSequence,
} from "./financial-e2e-initialization-contract.mjs";

const { Client } = pg;
const BOOTSTRAP_ROLE = "pharmnos_e2e";
const RUNTIME_ROLE = "pharmnos_e2e_runtime";
const DATABASE_NAME = "pharmnos_financial_e2e";
const BASELINE_PATH = new URL("../prisma/financial-e2e-schema-provisioning.generated.sql", import.meta.url);
const TRUSTED_REPOSITORY_ROOT = fileURLToPath(new URL("..", import.meta.url));

const directTenantTables = [
    "memberships",
    "roles",
    "role_permissions",
    "business_profiles",
    "products",
    "product_batches",
    "customers",
    "suppliers",
    "purchase_invoices",
    "purchase_posting_operations",
    "purchase_invoice_items",
    "purchase_gst_evidence_revisions",
    "purchase_gst_line_evidence",
    "purchase_gst_calculations",
    "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events",
    "purchase_gst_reconciliation_event_lines",
    "sales_invoices",
    "sales_invoice_items",
    "payments",
    "stock_movements",
    "customer_ledgers",
    "supplier_ledgers",
    "audit_logs",
];
const immutableTables = [
    "purchase_gst_evidence_revisions",
    "purchase_gst_line_evidence",
    "purchase_gst_calculations",
    "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events",
    "purchase_gst_reconciliation_event_lines",
];
const mutableTables = [
    "tenants",
    "users",
    ...directTenantTables.filter((table) => !immutableTables.includes(table) && table !== "audit_logs"),
];
const allTenantTables = ["tenants", "users", ...directTenantTables];
const enumTypes = [
    "SystemRole",
    "PermissionAction",
    "InvoiceStatus",
    "TaxDataStatus",
    "PurchaseGstReconciliationStatus",
    "PurchaseGstAccountingAcceptanceStatus",
    "PurchaseGstEvidenceRevisionKind",
    "PurchaseGstReconciliationEventKind",
    "PaymentMode",
    "StockMovementType",
    "ScheduleClass",
    "AuditEventType",
    "LedgerEntryType",
];

function ident(value) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
}

function directPredicate(table) {
    if (table === "tenants") {
        return `id::text = NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')`;
    }
    if (table === "users") {
        return `EXISTS (
            SELECT 1 FROM public.memberships AS m
            WHERE m.user_id = users.id
              AND m.tenant_id::text = NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')
        )`;
    }
    if (table === "role_permissions") {
        return `EXISTS (
            SELECT 1 FROM public.roles AS r
            WHERE r.id = role_permissions.role_id
              AND r.tenant_id::text = NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')
        )`;
    }
    return `tenant_id::text = NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')`;
}

function policyStatements() {
    const statements = [];
    for (const table of allTenantTables) {
        const predicate = directPredicate(table);
        statements.push(
            `ALTER TABLE public.${ident(table)} ENABLE ROW LEVEL SECURITY`,
            `ALTER TABLE public.${ident(table)} FORCE ROW LEVEL SECURITY`,
            `CREATE POLICY ${ident(`tenant_select_${table}`)} ON public.${ident(table)} FOR SELECT TO ${ident(RUNTIME_ROLE)} USING (${predicate})`,
            `CREATE POLICY ${ident(`tenant_insert_${table}`)} ON public.${ident(table)} FOR INSERT TO ${ident(RUNTIME_ROLE)} WITH CHECK (${predicate})`,
        );
        if (!immutableTables.includes(table) && table !== "audit_logs") {
            statements.push(
                `CREATE POLICY ${ident(`tenant_update_${table}`)} ON public.${ident(table)} FOR UPDATE TO ${ident(RUNTIME_ROLE)} USING (${predicate}) WITH CHECK (${predicate})`,
            );
        }
    }
    return statements;
}

function grantStatements() {
    const statements = [
        `REVOKE ALL ON SCHEMA public FROM PUBLIC`,
        `GRANT USAGE ON SCHEMA public TO ${ident(RUNTIME_ROLE)}`,
        `REVOKE CREATE ON SCHEMA public FROM ${ident(RUNTIME_ROLE)}`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(BOOTSTRAP_ROLE)} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(BOOTSTRAP_ROLE)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC`,
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(BOOTSTRAP_ROLE)} IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`,
        `GRANT SELECT, INSERT, UPDATE ON TABLE ${allTenantTables.map((table) => `public.${ident(table)}`).join(", ")} TO ${ident(RUNTIME_ROLE)}`,
        `REVOKE UPDATE, DELETE ON TABLE ${immutableTables.map((table) => `public.${ident(table)}`).join(", ")} FROM ${ident(RUNTIME_ROLE)}`,
        `REVOKE DELETE ON TABLE public.${ident("audit_logs")} FROM ${ident(RUNTIME_ROLE)}`,
        `GRANT USAGE ON TYPE ${enumTypes.map((type) => `public.${ident(type)}`).join(", ")} TO ${ident(RUNTIME_ROLE)}`,
    ];
    return statements;
}

const controlSql = [
    ...grantStatements(),
    ...policyStatements(),
    `CREATE OR REPLACE FUNCTION public.prevent_financial_history_mutation()
     RETURNS trigger
     LANGUAGE plpgsql
     SET search_path = pg_catalog, public
     AS $function$
     BEGIN
       RAISE EXCEPTION 'Immutable financial history cannot be changed: %', TG_TABLE_NAME
         USING ERRCODE = '42501';
     END;
     $function$`,
    ...immutableTables.map((table) =>
        `CREATE TRIGGER ${ident(`prevent_${table}_mutation`)}
         BEFORE UPDATE OR DELETE ON public.${ident(table)}
         FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_history_mutation()`),
    `CREATE OR REPLACE FUNCTION public.prevent_finalized_purchase_mutation()
     RETURNS trigger
     LANGUAGE plpgsql
     SET search_path = pg_catalog, public
     AS $function$
     BEGIN
       IF OLD.status = 'FINALIZED'::public."InvoiceStatus"
          AND (NEW.status IS DISTINCT FROM OLD.status
            OR NEW.current_gst_evidence_revision_id IS DISTINCT FROM OLD.current_gst_evidence_revision_id
            OR NEW.current_gst_calculation_id IS DISTINCT FROM OLD.current_gst_calculation_id
            OR NEW.current_gst_accounting_decision_id IS DISTINCT FROM OLD.current_gst_accounting_decision_id
            OR NEW.gst_reconciliation_status IS DISTINCT FROM OLD.gst_reconciliation_status
            OR NEW.gst_accounting_acceptance_status IS DISTINCT FROM OLD.gst_accounting_acceptance_status
            OR NEW.gst_record_version IS DISTINCT FROM OLD.gst_record_version)
       THEN
         RAISE EXCEPTION 'Finalized purchase GST facts are immutable'
           USING ERRCODE = '42501';
       END IF;
       RETURN NEW;
     END;
     $function$`,
    `CREATE TRIGGER prevent_finalized_purchase_mutation
     BEFORE UPDATE ON public."purchase_invoices"
     FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_purchase_mutation()`,
    `CREATE OR REPLACE FUNCTION public.prevent_finalized_sales_mutation()
     RETURNS trigger
     LANGUAGE plpgsql
     SET search_path = pg_catalog, public
     AS $function$
     DECLARE
       invoice_status public."InvoiceStatus";
     BEGIN
       IF TG_TABLE_NAME = 'sales_invoices' THEN
         IF OLD.status = 'FINALIZED'::public."InvoiceStatus" THEN
           RAISE EXCEPTION 'Finalized sales invoice facts are immutable'
             USING ERRCODE = '42501';
         END IF;
       ELSE
         SELECT status INTO invoice_status
         FROM public."sales_invoices"
         WHERE id = OLD.invoice_id AND tenant_id = OLD.tenant_id;
         IF invoice_status = 'FINALIZED'::public."InvoiceStatus" THEN
           RAISE EXCEPTION 'Finalized sales invoice lines are immutable'
             USING ERRCODE = '42501';
         END IF;
       END IF;
       RETURN NEW;
     END;
     $function$`,
    `CREATE TRIGGER prevent_finalized_sales_invoice_mutation
     BEFORE UPDATE OR DELETE ON public."sales_invoices"
     FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_sales_mutation()`,
    `CREATE TRIGGER prevent_finalized_sales_item_mutation
     BEFORE UPDATE OR DELETE ON public."sales_invoice_items"
     FOR EACH ROW EXECUTE FUNCTION public.prevent_finalized_sales_mutation()`,
    `CREATE OR REPLACE FUNCTION public.guard_purchase_posting_transition()
     RETURNS trigger
     LANGUAGE plpgsql
     SET search_path = pg_catalog, public
     AS $function$
     BEGIN
       IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
          OR NEW.purchase_invoice_id IS DISTINCT FROM OLD.purchase_invoice_id
          OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
          OR NEW.request_payload_hash IS DISTINCT FROM OLD.request_payload_hash
       THEN
         RAISE EXCEPTION 'Posting operation identity is immutable'
           USING ERRCODE = '23514';
       END IF;
       IF NEW.status IS DISTINCT FROM OLD.status
          AND NOT (OLD.status = 'PROCESSING' AND NEW.status IN ('COMPLETED', 'FAILED'))
       THEN
         RAISE EXCEPTION 'Invalid purchase posting transition'
           USING ERRCODE = '23514';
       END IF;
       RETURN NEW;
     END;
     $function$`,
    `CREATE TRIGGER guard_purchase_posting_transition
     BEFORE UPDATE ON public."purchase_posting_operations"
     FOR EACH ROW EXECUTE FUNCTION public.guard_purchase_posting_transition()`,
].join(";\n");

async function queryRows(client, sql, values = []) {
    return (await client.query(sql, values)).rows;
}

async function assertEmpty(client) {
    const rows = await queryRows(client, `
        SELECT count(*)::int AS count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    `);
    if (rows[0].count !== 0) {
        throw new Error(`STOP: public schema is not empty (${rows[0].count} objects).`);
    }
}

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;

export function classifyProvisioningFailure({
    transactionStarted = false,
    rollbackAttempted = false,
    rollbackSucceeded = false,
} = {}) {
    if (transactionStarted && (!rollbackAttempted || !rollbackSucceeded)) {
        return "UNTRUSTED_UNKNOWN_OUTCOME";
    }
    return "KNOWN_ROLLBACK";
}

export function sanitizeProvisioningDiagnostic(value) {
    return String(value ?? "Provisioning failed")
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
        .replace(/([?&]?(?:password|pass|secret|token|apikey|api_key)\s*[:=]\s*)[^&\s,;]+/gi, "$1[REDACTED]")
        .slice(0, 500);
}

export function createSanitizedProvisioningEvidence({
    targetBinding: approvedTargetBinding,
    runId,
    initializationAttemptId,
    outcome,
    verifiedAt,
} = {}) {
    if (!RUN_ID_PATTERN.test(String(runId ?? "").trim()) ||
        !RUN_ID_PATTERN.test(String(initializationAttemptId ?? "").trim()) ||
        typeof approvedTargetBinding !== "string" ||
        !approvedTargetBinding.trim()) {
        throw new TypeError("Sanitized provisioning evidence requires bound identifiers.");
    }
    if (!["KNOWN_ROLLBACK", "UNTRUSTED_UNKNOWN_OUTCOME"].includes(outcome)) {
        throw new TypeError("Sanitized provisioning evidence requires a valid outcome.");
    }
    return Object.freeze({
        evidenceVersion: 1,
        targetBinding: approvedTargetBinding.trim(),
        runId: String(runId).trim(),
        initializationAttemptId: String(initializationAttemptId).trim(),
        outcome,
        verifiedAt: Number.isFinite(verifiedAt) ? verifiedAt : Date.now(),
        databaseAccessed: true,
    });
}

export function validateInitializationAuthorization({
    approved,
    runId,
    initializationAttemptId,
    testUrl,
    authorizedTargetBinding,
}) {
    if (approved !== true) {
        return { ok: false, error: "Explicit disposable-target initialization authorization is required." };
    }
    if (!RUN_ID_PATTERN.test(String(runId ?? "").trim())) {
        return { ok: false, error: "A valid financial E2E run ID is required." };
    }
    if (!RUN_ID_PATTERN.test(String(initializationAttemptId ?? "").trim())) {
        return { ok: false, error: "A valid initialization attempt ID is required." };
    }
    const binding = targetBinding(testUrl);
    if (!binding || String(authorizedTargetBinding ?? "").trim() !== binding) {
        return { ok: false, error: "Initialization authorization is not bound to the exact disposable target." };
    }
    return {
        ok: true,
        runId: String(runId).trim(),
        initializationAttemptId: String(initializationAttemptId).trim(),
        targetBinding: binding,
    };
}

export function validateConnectedInitializationRequest({
    authorization,
    target,
    bootstrapRole,
    runtimeRole,
    marker,
    initializationScope,
    targetApproved,
    markerEstablishmentMethod,
    roleSetupMethod,
    baselinePackage,
    evidencePolicy,
    recoveryPolicy,
    runtimeRoleAttributes,
} = {}) {
    const errors = [];
    if (!authorization?.ok ||
        !authorization.targetBinding ||
        !authorization.runId ||
        !authorization.initializationAttemptId) {
        errors.push("A validated target-bound initialization authorization is required.");
    }
    if (!target?.testUrl || !target?.testDatabaseName) {
        errors.push("An exact disposable target is required.");
    }
    if (authorization?.targetBinding && target?.testUrl &&
        authorization.targetBinding !== targetBinding(target.testUrl)) {
        errors.push("Initialization authorization does not match the disposable target.");
    }
    if (initializationScope !== "DATABASE_INITIALIZATION_ONLY") {
        errors.push("Initialization scope must be DATABASE_INITIALIZATION_ONLY.");
    }
    if (targetApproved !== true) {
        errors.push("Exact target approval is required before connected initialization.");
    }
    if (!String(bootstrapRole ?? "").trim() || !String(runtimeRole ?? "").trim()) {
        errors.push("Distinct bootstrap and runtime roles are required.");
    } else if (bootstrapRole === runtimeRole) {
        errors.push("Bootstrap and runtime roles must be distinct.");
    }
    if (String(marker ?? "").trim() !== REQUIRED_MARKER) {
        errors.push(`The independent marker must equal ${REQUIRED_MARKER}.`);
    }
    if (markerEstablishmentMethod !== "BOOTSTRAP_CONNECTED_CATALOG_READBACK") {
        errors.push("The approved bootstrap marker-establishment method is required.");
    }
    if (roleSetupMethod !== "PRECREATED_LOCAL_CREDENTIAL_PROCEDURE") {
        errors.push("The approved pre-created local role procedure is required.");
    }
    if (baselinePackage !== "VERSION_PINNED_REVIEW_ARTIFACTS") {
        errors.push("The version-pinned review artifact package is required.");
    }
    if (!evidencePolicy ||
        evidencePolicy.mode !== "SANITIZED_APPEND_ONLY_LOCAL" ||
        evidencePolicy.retentionDays !== 30 ||
        evidencePolicy.localPathApproved !== true) {
        errors.push("The approved sanitized append-only local evidence policy is required.");
    }
    if (recoveryPolicy !== "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET") {
        errors.push("The approved uncertain-outcome recovery policy is required.");
    }
    if (!runtimeRoleAttributes ||
        runtimeRoleAttributes.rolcanlogin !== true ||
        runtimeRoleAttributes.rolsuper !== false ||
        runtimeRoleAttributes.rolbypassrls !== false) {
        errors.push("Runtime role attributes must be LOGIN, NOSUPERUSER, and NOBYPASSRLS.");
    }
    return {
        ok: errors.length === 0,
        errors,
    };
}

async function main() {
    const required = [
        "TEST_DATABASE_URL",
        "DATABASE_URL",
        "TEST_DATABASE_NAME",
        "TEST_DATABASE_MARKER",
        "FINANCIAL_E2E_RUNTIME_DATABASE_URL",
        "FINANCIAL_E2E_RUNTIME_DB_USER",
        "FINANCIAL_E2E_RUNTIME_DB_PASSWORD",
        "FINANCIAL_E2E_INITIALIZATION_AUTHORIZED",
        "FINANCIAL_E2E_RUN_ID",
        "FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID",
        "FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING",
        "FINANCIAL_E2E_RUNTIME_DB_USER",
        "FINANCIAL_E2E_INITIALIZATION_SCOPE",
        "FINANCIAL_E2E_TARGET_APPROVED",
        "FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD",
        "FINANCIAL_E2E_ROLE_SETUP_METHOD",
        "FINANCIAL_E2E_BASELINE_PACKAGE",
        "FINANCIAL_E2E_EVIDENCE_MODE",
        "FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS",
        "FINANCIAL_E2E_EVIDENCE_PATH_APPROVED",
        "FINANCIAL_E2E_RECOVERY_POLICY",
    ];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing required target configuration: ${missing.join(", ")}`);
    }
    const authorization = validateInitializationAuthorization({
        approved: process.env.FINANCIAL_E2E_INITIALIZATION_AUTHORIZED === "true",
        runId: process.env.FINANCIAL_E2E_RUN_ID,
        initializationAttemptId: process.env.FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID,
        testUrl: process.env.TEST_DATABASE_URL,
        authorizedTargetBinding: process.env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING,
    });
    if (!authorization.ok) throw new Error(authorization.error);
    const target = await validateFinancialE2eTarget({
        testUrl: process.env.TEST_DATABASE_URL,
        ordinaryUrl: process.env.DATABASE_URL,
        testDatabaseName: process.env.TEST_DATABASE_NAME,
        marker: process.env.TEST_DATABASE_MARKER,
    });
    if (!target.ok) throw new Error(`Target guard failed: ${target.errors.join(" ")}`);

    const targetUrl = new URL(process.env.TEST_DATABASE_URL);
    const ordinaryUrl = new URL(process.env.DATABASE_URL);
    const candidate = validateLocalDisposableTargetCandidate({
        serviceName: "financial-e2e-postgres",
        profile: "financial-e2e",
        host: targetUrl.hostname,
        port: Number(targetUrl.port || 5432),
        databaseName: process.env.TEST_DATABASE_NAME,
        bootstrapRole: process.env.FINANCIAL_E2E_DB_USER,
        runtimeRole: process.env.FINANCIAL_E2E_RUNTIME_DB_USER,
        marker: process.env.TEST_DATABASE_MARKER,
        storage: "tmpfs",
        isolationLabel: "financial-e2e-isolated",
        ordinaryTarget: {
            host: ordinaryUrl.hostname,
            port: Number(ordinaryUrl.port || 5432),
            databaseName: ordinaryUrl.pathname,
        },
    });
    if (!candidate.ok) throw new Error(`Candidate target guard failed: ${candidate.errors.join(" ")}`);

    const preparation = validateConnectedInitializationRequest({
        authorization,
        target: {
            testUrl: process.env.TEST_DATABASE_URL,
            testDatabaseName: process.env.TEST_DATABASE_NAME,
        },
        bootstrapRole: process.env.FINANCIAL_E2E_DB_USER,
        runtimeRole: process.env.FINANCIAL_E2E_RUNTIME_DB_USER,
        marker: process.env.TEST_DATABASE_MARKER,
        initializationScope: process.env.FINANCIAL_E2E_INITIALIZATION_SCOPE,
        targetApproved: process.env.FINANCIAL_E2E_TARGET_APPROVED === "true",
        markerEstablishmentMethod: process.env.FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD,
        roleSetupMethod: process.env.FINANCIAL_E2E_ROLE_SETUP_METHOD,
        baselinePackage: process.env.FINANCIAL_E2E_BASELINE_PACKAGE,
        evidencePolicy: {
            mode: process.env.FINANCIAL_E2E_EVIDENCE_MODE,
            retentionDays: Number(process.env.FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS),
            localPathApproved: process.env.FINANCIAL_E2E_EVIDENCE_PATH_APPROVED === "true",
        },
        recoveryPolicy: process.env.FINANCIAL_E2E_RECOVERY_POLICY,
        runtimeRoleAttributes: {
            rolcanlogin: true,
            rolsuper: false,
            rolbypassrls: false,
        },
    });
    if (!preparation.ok) throw new Error(`Initialization preparation guard failed: ${preparation.errors.join(" ")}`);

    const sequence = validateConnectedInitializationSequence(REQUIRED_INITIALIZATION_SEQUENCE);
    if (!sequence.ok) throw new Error(`Initialization sequence guard failed: ${sequence.errors.join(" ")}`);

    const manifest = JSON.parse(await fs.readFile(new URL("../prisma/financial-e2e-artifact-manifest.json", import.meta.url), "utf8"));
    const artifactVerification = verifyArtifactFiles(manifest, TRUSTED_REPOSITORY_ROOT);
    if (!artifactVerification.ok) {
        throw new Error(`Artifact manifest verification failed: ${artifactVerification.errors.join(" ")}`);
    }
    if (manifest.approved !== true || manifest.artifacts.some((artifact) => artifact.classification !== "executable")) {
        throw new Error("An explicitly approved executable artifact package is required before connected initialization.");
    }

    const client = new Client({
        connectionString: process.env.TEST_DATABASE_URL,
        application_name: REQUIRED_MARKER,
    });
    const runtimePassword = process.env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD;
    let transactionStarted = false;
    try {
        await client.connect();
        await client.query(
            `ALTER DATABASE ${ident(DATABASE_NAME)}
             SET pharmnos.financial_e2e_marker = '${REQUIRED_MARKER}'`,
        );
        await client.query("SELECT set_config('pharmnos.financial_e2e_marker', $1, false)", [REQUIRED_MARKER]);
        const identityRows = await queryRows(client, `
            SELECT current_database() AS database_name,
                   current_user AS current_role,
                   current_setting('pharmnos.financial_e2e_marker', true) AS marker
        `);
        const identity = identityRows[0];
        if (identity?.database_name !== DATABASE_NAME ||
            identity.current_role !== BOOTSTRAP_ROLE ||
            identity.marker !== REQUIRED_MARKER) {
            throw new Error("Bootstrap identity did not match the verified local target.");
        }
        const bootstrapFlags = await queryRows(client, `
            SELECT rolsuper, rolbypassrls, rolcanlogin
            FROM pg_roles WHERE rolname = current_user
        `);
        if (bootstrapFlags[0]?.rolcanlogin !== true) {
            throw new Error("Bootstrap role is not a login role.");
        }
        await assertEmpty(client);

        const baseline = (await fs.readFile(BASELINE_PATH, "utf8")).replace(/^\uFEFF/, "");
        if (baseline.includes("\\ir ") || !baseline.includes("CREATE TABLE")) {
            throw new Error("Baseline artifact is not a self-contained SQL baseline.");
        }
        await client.query("BEGIN");
        transactionStarted = true;
        await client.query(baseline);
        await client.query(
            `DO $$
             BEGIN
               IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $role$${RUNTIME_ROLE}$role$) THEN
                 CREATE ROLE ${ident(RUNTIME_ROLE)} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${runtimePassword.replaceAll("'", "''")}';
               END IF;
             END
             $$;`,
        );
        await client.query(controlSql);
        await client.query("COMMIT");
        transactionStarted = false;
        const catalog = await queryRows(client, `
            SELECT
              (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity) AS rls_enabled,
              (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS policy_count,
              (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS trigger_count,
              (SELECT COUNT(*) FROM pg_constraint c
                JOIN pg_class r ON r.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = r.relnamespace
                WHERE n.nspname = 'public') AS constraint_count,
              (SELECT COUNT(*) FROM unnest($2::text[]) AS table_name
                WHERE has_table_privilege($1, format('public.%I', table_name), 'DELETE')) AS runtime_delete_privileges,
              (SELECT rolsuper FROM pg_roles WHERE rolname = $1) AS runtime_superuser,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = $1) AS runtime_bypassrls,
              (SELECT rolcanlogin FROM pg_roles WHERE rolname = $1) AS runtime_can_login
        `, [RUNTIME_ROLE, allTenantTables]);
        const row = catalog[0];
        if (Number(row?.rls_enabled) !== allTenantTables.length ||
            Number(row?.policy_count) < allTenantTables.length * 2 ||
            Number(row?.constraint_count) === 0 ||
            Number(row?.runtime_delete_privileges) !== 0 ||
            row?.runtime_superuser !== false ||
            row?.runtime_bypassrls !== false ||
            row?.runtime_can_login !== true) {
            throw new Error("Connected catalog verification did not satisfy RLS, policy, or runtime-role requirements.");
        }
        const runtimeUrl = new URL(process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL);
        if (runtimeUrl.hostname !== targetUrl.hostname ||
            Number(runtimeUrl.port || 5432) !== Number(targetUrl.port || 5432) ||
            runtimeUrl.pathname !== targetUrl.pathname ||
            decodeURIComponent(runtimeUrl.username) !== RUNTIME_ROLE) {
            throw new Error("Runtime connection is not bound to the initialized disposable target.");
        }
        runtimeUrl.password = runtimePassword;
        const runtimeClient = new Client({
            connectionString: runtimeUrl.toString(),
            application_name: `${REQUIRED_MARKER}-runtime`,
        });
        try {
            await runtimeClient.connect();
            await runtimeClient.query("SELECT set_config('pharmnos.financial_e2e_marker', $1, false)", [REQUIRED_MARKER]);
            const runtimeIdentity = (await runtimeClient.query(`
                SELECT current_database() AS database_name,
                       current_user AS current_role,
                       current_setting('pharmnos.financial_e2e_marker', true) AS marker
            `)).rows[0];
            if (runtimeIdentity?.database_name !== DATABASE_NAME ||
                runtimeIdentity.current_role !== RUNTIME_ROLE ||
                runtimeIdentity.marker !== REQUIRED_MARKER) {
                throw new Error("Runtime identity did not match the initialized disposable target.");
            }
            const runtimeRole = (await runtimeClient.query(`
                SELECT rolcanlogin, rolsuper, rolbypassrls
                FROM pg_roles WHERE rolname = current_user
            `)).rows[0];
            if (runtimeRole?.rolcanlogin !== true ||
                runtimeRole.rolsuper !== false ||
                runtimeRole.rolbypassrls !== false) {
                throw new Error("Runtime connection did not use the restricted role.");
            }
            for (const table of allTenantTables) {
                await runtimeClient.query(`SELECT count(*) FROM public.${ident(table)}`);
            }
        } finally {
            await runtimeClient.end().catch(() => {});
        }
        console.log("PROVISIONING=PASS");
        console.log("BASELINE_APPLIED=financial-e2e-schema-provisioning.generated.sql");
        console.log("SECURITY_CONTROLS_APPLIED=grants,rls,immutable-history,finalized-invoice,posting-transition");
        console.log(`TARGET_DATABASE=${DATABASE_NAME}`);
        console.log(`TARGET_BOOTSTRAP_ROLE=${BOOTSTRAP_ROLE}`);
        console.log(`TARGET_RUNTIME_ROLE=${RUNTIME_ROLE}`);
        console.log(`RLS_TABLES=${row.rls_enabled}`);
        console.log(`POLICIES=${row.policy_count}`);
        console.log(`TRIGGERS=${row.trigger_count}`);
        console.log(`CONSTRAINTS=${row.constraint_count}`);
        console.log(`RUNTIME_DELETE_PRIVILEGES=${row.runtime_delete_privileges}`);
        console.log("RUNTIME_RLS=VERIFIED_EMPTY_TARGET");
        console.log("GST_SCENARIOS=NOT_EXECUTED");
    } catch (error) {
        let rollbackSucceeded = false;
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
                rollbackSucceeded = true;
            } catch {
                rollbackSucceeded = false;
            }
        }
        const outcome = classifyProvisioningFailure({
            transactionStarted,
            rollbackAttempted: transactionStarted,
            rollbackSucceeded,
        });
        const detail = sanitizeProvisioningDiagnostic(error instanceof Error ? error.message : "Provisioning failed");
        throw new Error(`${outcome}: ${detail}`);
    } finally {
        await client.end().catch(() => {});
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((error) => {
        console.error(`PROVISIONING=FAIL ${error instanceof Error ? error.message : "sanitized error"}`);
        process.exitCode = 1;
    });
}
