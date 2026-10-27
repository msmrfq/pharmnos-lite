export const GST_POSTING_TABLES = Object.freeze([
    "purchase_posting_operations",
    "purchase_gst_evidence_revisions",
    "purchase_gst_line_evidence",
    "purchase_gst_calculations",
    "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events",
    "purchase_gst_reconciliation_event_lines",
]);

const REQUIRED_POLICY_NAME = "tenant_isolation_policy";
const REQUIRED_POLICY_PREDICATE = "tenant_id = public.jwt_tenant_id()";

function text(value) {
    return String(value ?? "").trim();
}

function hasVerifiedIdentity(identity, expectedIdentity) {
    return Boolean(
        identity &&
        text(identity.databaseName) &&
        text(identity.serverIdentity) &&
        text(identity.connectedRole) &&
        identity.isTargetApproved === true &&
        expectedIdentity &&
        text(expectedIdentity.databaseName) === text(identity.databaseName) &&
        text(expectedIdentity.serverIdentity) === text(identity.serverIdentity) &&
        text(expectedIdentity.connectedRole).toLowerCase() === text(identity.connectedRole).toLowerCase(),
    );
}

function verifyTable(table, expectedGrants, errors) {
    if (!table || table.schema !== "public" || !GST_POSTING_TABLES.includes(table.name)) {
        errors.push(`Unexpected or invalid GST/posting table metadata: ${text(table?.name) || "<missing>"}.`);
        return;
    }
    if (table.exists !== true) errors.push(`Expected table is missing: public.${table.name}.`);
    if (table.rlsEnabled !== true) errors.push(`RLS is disabled: public.${table.name}.`);

    if (!Array.isArray(table.policies) || !Array.isArray(table.grants)) {
        errors.push(`Malformed policy or grant metadata: public.${table.name}.`);
        return;
    }
    const policies = table.policies;
    const policy = policies.find((candidate) => candidate?.name === REQUIRED_POLICY_NAME);
    if (!policy) {
        errors.push(`Required policy is missing: public.${table.name}.${REQUIRED_POLICY_NAME}.`);
    } else {
        if (policy.using !== REQUIRED_POLICY_PREDICATE) {
            errors.push(`Wrong USING predicate: public.${table.name}.${REQUIRED_POLICY_NAME}.`);
        }
        if (policy.withCheck !== REQUIRED_POLICY_PREDICATE) {
            errors.push(`Wrong WITH CHECK predicate: public.${table.name}.${REQUIRED_POLICY_NAME}.`);
        }
        if (policy.role !== "authenticated") {
            errors.push(`Wrong policy role: public.${table.name}.${REQUIRED_POLICY_NAME}.`);
        }
    }
    if (policies.filter((candidate) => candidate?.name === REQUIRED_POLICY_NAME).length !== 1) {
        errors.push(`Duplicate required policies: public.${table.name}.${REQUIRED_POLICY_NAME}.`);
    }
    for (const candidate of policies) {
        if (!candidate || typeof candidate !== "object" || text(candidate.name) !== REQUIRED_POLICY_NAME) {
            errors.push(`Unexpected or malformed policy: public.${table.name}.`);
        }
    }

    const actualGrantKeys = table.grants.map((grant) =>
        grant && typeof grant === "object"
            ? `${text(grant.role).toLowerCase()}:${text(grant.privilege).toUpperCase()}`
            : "",
    );
    const expectedGrantKeys = expectedGrants.map((grant) =>
        grant && typeof grant === "object"
            ? `${text(grant.role).toLowerCase()}:${text(grant.privilege).toUpperCase()}`
            : "",
    );
    const actualGrants = new Set(actualGrantKeys);
    const expected = new Set(expectedGrantKeys);
    if (actualGrantKeys.some((grant) => !grant) || expectedGrantKeys.some((grant) => !grant)) {
        errors.push(`Malformed grant metadata: public.${table.name}.`);
    }
    if (actualGrantKeys.length !== actualGrants.size) {
        errors.push(`Duplicate grants: public.${table.name}.`);
    }
    if (expectedGrantKeys.length !== expected.size) {
        errors.push("Duplicate expected grants are not valid.");
    }
    for (const grant of expected) {
        if (!actualGrants.has(grant)) errors.push(`Required grant is missing on public.${table.name}: ${grant}.`);
    }
    for (const grant of actualGrants) {
        if (!expected.has(grant)) errors.push(`Unexpected grant on public.${table.name}: ${grant}.`);
    }
}

/**
 * Verifies a read-only snapshot produced by an separately authorized database
 * inspection. This function never connects to a database or executes SQL.
 */
export function verifyRlsRolloutSnapshot(snapshot, options = {}) {
    const errors = [];
    const expectedGrants = options.expectedGrants;
    const expectedIdentity = options.expectedIdentity;

    if (!Array.isArray(expectedGrants)) {
        errors.push("An explicitly approved expected grant set is required.");
    }
    if (!expectedIdentity || typeof expectedIdentity !== "object") {
        errors.push("An explicitly approved expected database identity is required.");
    }
    if (!hasVerifiedIdentity(snapshot?.identity, expectedIdentity)) {
        errors.push("Verified database identity must match the approved target identity.");
    }
    if (snapshot?.helper?.schema !== "public" || snapshot?.helper?.name !== "jwt_tenant_id") {
        errors.push("The public.jwt_tenant_id helper is missing.");
    }
    if (snapshot?.helper?.usesAppMetadata !== true) {
        errors.push("The tenant helper must read app_metadata.");
    }
    if (snapshot?.helper?.failClosedOnMissingClaim !== true) {
        errors.push("The tenant helper must fail closed when the tenant claim is missing.");
    }

    const tables = Array.isArray(snapshot?.tables) ? snapshot.tables : [];
    if (tables.length !== GST_POSTING_TABLES.length) {
        errors.push("The snapshot must contain exactly the seven expected GST/posting tables.");
    }
    const tableNames = tables.map((table) => table?.name);
    if (new Set(tableNames).size !== tableNames.length) {
        errors.push("Duplicate table metadata is not valid.");
    }
    const byName = new Map(tables.map((table) => [table?.name, table]));
    for (const tableName of GST_POSTING_TABLES) {
        const table = byName.get(tableName);
        if (!table) {
            errors.push(`Expected table metadata is missing: public.${tableName}.`);
            continue;
        }
        if (Array.isArray(expectedGrants)) verifyTable(table, expectedGrants, errors);
    }
    for (const table of tables) {
        if (!GST_POSTING_TABLES.includes(table?.name)) {
            errors.push(`Unexpected table metadata was supplied: public.${text(table?.name) || "<missing>"}.`);
        }
    }

    return { ok: errors.length === 0, errors };
}

export { REQUIRED_POLICY_NAME, REQUIRED_POLICY_PREDICATE };
