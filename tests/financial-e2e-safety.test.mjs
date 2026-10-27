import assert from "node:assert/strict";
import test from "node:test";
import {
    validateLocalDisposableTargetCandidate,
    validateDatabaseIdentityEvidence,
    validateFinancialE2eTarget,
    targetBinding,
    verifyDatabaseIdentity,
} from "../scripts/financial-e2e-safety.mjs";

test("accepts only an isolated local disposable target candidate", () => {
    const result = validateLocalDisposableTargetCandidate({
        serviceName: "financial-e2e-postgres",
        profile: "financial-e2e",
        host: "127.0.0.1",
        port: 55432,
        databaseName: "pharmnos_financial_e2e",
        bootstrapRole: "pharmnos_e2e",
        runtimeRole: "pharmnos_e2e_runtime",
        marker: "pharmnos-financial-e2e",
        storage: "tmpfs",
        isolationLabel: "financial-e2e-isolated",
        ordinaryTarget: { host: "127.0.0.1", port: 5432, databaseName: "pharmnos" },
    });
    assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects an ordinary-target overlap in the local candidate contract", () => {
    const result = validateLocalDisposableTargetCandidate({
        serviceName: "financial-e2e-postgres",
        profile: "financial-e2e",
        host: "127.0.0.1",
        port: 55432,
        databaseName: "pharmnos_financial_e2e",
        bootstrapRole: "pharmnos_e2e",
        runtimeRole: "pharmnos_e2e_runtime",
        marker: "pharmnos-financial-e2e",
        storage: "tmpfs",
        isolationLabel: "financial-e2e-isolated",
        ordinaryTarget: { host: "127.0.0.1", port: 55432, databaseName: "pharmnos_financial_e2e" },
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /overlaps/);
});
import { validateFinancialE2eReadiness, validateFixtureCleanup } from "../scripts/financial-e2e-readiness.mjs";
import {
    authorizeFixtureCleanup,
    buildOwnedCleanupPlan,
    canStartFinancialScenario,
    createFixtureManifest,
    recordCleanupSuccess,
    recordCleanupFailure,
    recordFixtureCreationFailure,
    recordFixtureIdentifiers,
    FIXTURE_READY_STATUS,
    RESOURCE_CLEANUP_ORDER,
} from "../scripts/financial-e2e-fixture-lifecycle.mjs";

const ordinaryUrl = "postgresql://tester@localhost:5432/pharmnos";
const isolatedUrl = "postgresql://tester@localhost:55432/pharmnos_test?application_name=pharmnos-financial-e2e";
const validInput = {
    testUrl: isolatedUrl,
    ordinaryUrl,
    testDatabaseName: "pharmnos_test",
    marker: "pharmnos-financial-e2e",
};
const fixtureStrategy = {
    name: "dedicated tenant per test run",
    tenantOwnershipKey: "test_run_id",
    userStrategy: "dedicated test user linked to the test tenant",
};
const cleanupStrategy = {
    name: "delete only records tagged with test_run_id",
    ownershipRule: "every cleanup target must be recorded by this run",
    explicitlyGated: true,
};

const cleanupDependencies = [
    ["purchase_gst_reconciliation_event_lines", "purchase_gst_reconciliation_events"],
    ["purchase_gst_reconciliation_event_lines", "purchase_gst_line_evidence"],
    ["purchase_gst_accounting_decisions", "purchase_gst_evidence_revisions"],
    ["purchase_gst_accounting_decisions", "purchase_invoices"],
    ["purchase_gst_calculations", "purchase_gst_evidence_revisions"],
    ["purchase_gst_calculations", "purchase_invoices"],
    ["purchase_gst_line_evidence", "purchase_gst_evidence_revisions"],
    ["purchase_gst_line_evidence", "purchase_invoice_items"],
    ["purchase_gst_reconciliation_events", "purchase_gst_evidence_revisions"],
    ["purchase_gst_reconciliation_events", "purchase_invoices"],
    ["purchase_posting_operations", "purchase_invoices"],
    ["purchase_gst_evidence_revisions", "purchase_invoices"],
    ["payments", "customers"],
    ["payments", "sales_invoices"],
    ["customer_ledgers", "customers"],
    ["customer_ledgers", "sales_invoices"],
    ["supplier_ledgers", "suppliers"],
    ["supplier_ledgers", "purchase_invoices"],
    ["stock_movements", "products"],
    ["stock_movements", "product_batches"],
    ["sales_invoice_items", "sales_invoices"],
    ["sales_invoice_items", "products"],
    ["sales_invoice_items", "product_batches"],
    ["purchase_invoice_items", "purchase_invoices"],
    ["purchase_invoice_items", "products"],
    ["product_batches", "products"],
    ["product_batches", "suppliers"],
    ["product_batches", "purchase_invoices"],
    ["sales_invoices", "customers"],
    ["purchase_invoices", "suppliers"],
    ["business_profiles", "tenants"],
    ["role_permissions", "roles"],
    ["memberships", "tenants"],
    ["memberships", "users"],
    ["memberships", "roles"],
    ["audit_logs", "tenants"],
    ["audit_logs", "users"],
    ["products", "tenants"],
    ["product_batches", "tenants"],
    ["customers", "tenants"],
    ["suppliers", "tenants"],
    ["purchase_invoices", "tenants"],
    ["sales_invoices", "tenants"],
    ["purchase_invoice_items", "tenants"],
    ["sales_invoice_items", "tenants"],
    ["payments", "tenants"],
    ["stock_movements", "tenants"],
    ["customer_ledgers", "tenants"],
    ["supplier_ledgers", "tenants"],
];

function scenarioInput(manifest) {
    return {
        manifest,
        identityEvidence: identityEvidence(manifest.runId),
        targetUrl: isolatedUrl,
        databaseName: "pharmnos_test",
        databaseRole: "tester",
        runId: manifest.runId,
        now: IDENTITY_NOW,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    };
}

const localResolver = async (hostname) => {
    if (hostname === "localhost") return ["127.0.0.1"];
    throw new Error("unexpected test hostname");
};

const IDENTITY_NOW = 1_000;
function identityEvidence(runId, targetUrl = isolatedUrl, overrides = {}) {
    return {
        version: 1,
        runId,
        targetBinding: targetBinding(targetUrl),
        verifiedAt: IDENTITY_NOW,
        databaseName: "pharmnos_test",
        currentUser: "tester",
        sessionUser: "tester",
        serverAddress: "127.0.0.1",
        serverPort: 55432,
        applicationName: "pharmnos-financial-e2e",
        environmentMarker: "pharmnos-financial-e2e",
        rolsuper: false,
        rolbypassrls: false,
        ...overrides,
    };
}

function authorize(manifest, options = {}) {
    return authorizeFixtureCleanup(manifest, {
        identityEvidence: options.identityEvidence ?? identityEvidence(manifest.runId),
        targetUrl: options.targetUrl ?? isolatedUrl,
        databaseName: options.databaseName ?? "pharmnos_test",
        databaseRole: options.databaseRole ?? "tester",
        runId: manifest.runId,
        cleanupAuthorized: options.cleanupAuthorized ?? true,
        now: options.now ?? IDENTITY_NOW,
    });
}

test("accepts a separately identified disposable target", async () => {
    assert.deepEqual(await validateFinancialE2eTarget({ ...validInput, resolveHost: localResolver }), { ok: true, errors: [] });
});

test("rejects an identical ordinary and test URL", async () => {
    const result = await validateFinancialE2eTarget({ ...validInput, testUrl: ordinaryUrl, resolveHost: localResolver });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /must differ/);
});

test("rejects a target with the same database identity but different query parameters", async () => {
    const result = await validateFinancialE2eTarget({
        ...validInput,
        testUrl: "postgresql://tester@localhost:5432/pharmnos?application_name=pharmnos-financial-e2e",
        resolveHost: localResolver,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /different database identity/);
});

test("rejects missing ordinary database identity", async () => {
    const result = await validateFinancialE2eTarget({ ...validInput, ordinaryUrl: "" });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /DATABASE_URL is required/);
});

test("rejects missing isolation marker and non-test database name", async () => {
    const result = await validateFinancialE2eTarget({
        ...validInput,
        testDatabaseName: "pharmnos",
        marker: "wrong-marker",
        testUrl: "postgresql://tester@localhost:5432/pharmnos_test",
        resolveHost: localResolver,
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /TEST_DATABASE_NAME/);
    assert.match(result.errors.join(" "), /TEST_DATABASE_MARKER/);
    assert.match(result.errors.join(" "), /application marker/);
});

test("rejects Supabase and pooler test endpoints", async () => {
    for (const hostname of ["db.example.supabase.co", "aws-0-ap-south-1.pooler.supabase.com"]) {
        const result = await validateFinancialE2eTarget({
            ...validInput,
            testUrl: `postgresql://tester@${hostname}:5432/pharmnos_test?application_name=pharmnos-financial-e2e`,
            resolveHost: async () => ["127.0.0.1"],
        });
        assert.equal(result.ok, false);
        assert.match(result.errors.join(" "), /Supabase or a pooler/);
    }
});

test("rejects a matching resolved live endpoint", async () => {
    const result = await validateFinancialE2eTarget({
        ...validInput,
        testUrl: "postgresql://tester@test-alias.local:5432/pharmnos_test?application_name=pharmnos-financial-e2e",
        resolveHost: async () => ["10.0.0.8"],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /same database endpoint identity/);
});

test("rejects DNS failure and empty resolution", async () => {
    const failed = await validateFinancialE2eTarget({
        ...validInput,
        resolveHost: async () => { throw new Error("DNS failure"); },
    });
    assert.equal(failed.ok, false);
    assert.match(failed.errors.join(" "), /host resolution failed/);

    const empty = await validateFinancialE2eTarget({
        ...validInput,
        resolveHost: async () => [],
    });
    assert.equal(empty.ok, false);
    assert.match(empty.errors.join(" "), /host resolution failed|returned no addresses/);
});

test("rejects malformed injected DNS resolver results", async () => {
    const malformed = await validateFinancialE2eTarget({
        testUrl: isolatedUrl,
        ordinaryUrl,
        testDatabaseName: "pharmnos_test",
        marker: "pharmnos-financial-e2e",
        resolveHost: async () => [{ address: "127.0.0.1" }],
    });
    assert.equal(malformed.ok, false);
    assert.match(malformed.errors.join(" "), /host resolution failed/);
});

test("verifies a correctly isolated non-superuser test session from mocked metadata", async () => {
    let queryCount = 0;
    const result = await verifyDatabaseIdentity({
        client: {
            query: async (sql) => {
                queryCount += 1;
                assert.match(sql, /current_database\(\)/);
                assert.match(sql, /pg_roles/);
                return {
                    rows: [{
                        database_name: "pharmnos_test",
                        current_user_name: "tester",
                        session_user_name: "tester",
                        server_address: "127.0.0.1",
                        server_port: 55432,
                        application_name: "pharmnos-financial-e2e",
                        environment_marker: "pharmnos-financial-e2e",
                        rolsuper: false,
                        rolbypassrls: false,
                    }],
                };
            },
        },
        expectedDatabase: "pharmnos_test",
        expectedRole: "tester",
        targetUrl: isolatedUrl,
        runId: "run-identity",
        now: IDENTITY_NOW,
    });
    assert.equal(queryCount, 1);
    assert.equal(result.ok, true);
});

test("normalizes valid IPv4 and IPv6 server addresses with optional CIDR suffixes", async () => {
    for (const [serverAddress, expected] of [
        ["127.0.0.1", "127.0.0.1"],
        ["127.0.0.1/32", "127.0.0.1"],
        ["2001:db8::1", "2001:db8::1"],
        ["2001:DB8::1/128", "2001:db8::1"],
    ]) {
        const result = await verifyDatabaseIdentity({
            client: {
                query: async () => ({
                    rows: [{
                        database_name: "pharmnos_test",
                        current_user_name: "tester",
                        session_user_name: "tester",
                        server_address: serverAddress,
                        server_port: 55432,
                        application_name: "pharmnos-financial-e2e",
                        environment_marker: "pharmnos-financial-e2e",
                        rolsuper: false,
                        rolbypassrls: false,
                    }],
                }),
            },
            expectedDatabase: "pharmnos_test",
            expectedRole: "tester",
            targetUrl: isolatedUrl,
            runId: "run-address",
            now: IDENTITY_NOW,
        });
        assert.equal(result.ok, true, serverAddress);
        assert.equal(result.evidence.serverAddress, expected);
    }
});

test("rejects malformed or missing server addresses", async () => {
    for (const serverAddress of ["127.0.0.1/33", "2001:db8::1/129", "127.0.0.1/x", "127.0.0.1/32/extra", "", null, undefined, "not-an-ip"]) {
        const result = await verifyDatabaseIdentity({
            client: {
                query: async () => ({
                    rows: [{
                        database_name: "pharmnos_test",
                        current_user_name: "tester",
                        session_user_name: "tester",
                        server_address: serverAddress,
                        server_port: 55432,
                        application_name: "pharmnos-financial-e2e",
                        environment_marker: "pharmnos-financial-e2e",
                        rolsuper: false,
                        rolbypassrls: false,
                    }],
                }),
            },
            expectedDatabase: "pharmnos_test",
            expectedRole: "tester",
            targetUrl: isolatedUrl,
            runId: "run-address-invalid",
            now: IDENTITY_NOW,
        });
        assert.equal(result.ok, false, String(serverAddress));
        assert.match(result.error, /server identity is incomplete/);
    }
});

test("rejects wrong server identity, role, marker, superuser, and BYPASSRLS metadata", () => {
    const cases = [
        ["databaseName", "wrong_database", /database identity/],
        ["currentUser", "wrong_role", /role/],
        ["serverAddress", "", /server identity/],
        ["environmentMarker", "wrong-marker", /environment marker/],
        ["rolsuper", true, /superuser or BYPASSRLS/],
        ["rolbypassrls", true, /superuser or BYPASSRLS/],
    ];
    for (const [field, value, expected] of cases) {
        const result = validateDatabaseIdentityEvidence({
            evidence: identityEvidence("run-identity", isolatedUrl, { [field]: value }),
            expectedDatabase: "pharmnos_test",
            expectedRole: "tester",
            targetUrl: isolatedUrl,
            runId: "run-identity",
            now: IDENTITY_NOW,
        });
        assert.equal(result.ok, false, field);
        assert.match(result.error, expected, field);
    }
});

test("rejects every non-boolean-false role flag value", () => {
    for (const value of [true, "true", 1, null, undefined, "false", 0]) {
        for (const field of ["rolsuper", "rolbypassrls"]) {
            const result = validateDatabaseIdentityEvidence({
                evidence: identityEvidence("run-role", isolatedUrl, { [field]: value }),
                expectedDatabase: "pharmnos_test",
                expectedRole: "tester",
                targetUrl: isolatedUrl,
                runId: "run-role",
                now: IDENTITY_NOW,
            });
            assert.equal(result.ok, false, `${field}=${String(value)}`);
        }
    }
});

test("rejects invalid or null target bindings independently", () => {
    for (const targetUrl of ["not-a-postgres-url", null, ""]) {
        const result = validateDatabaseIdentityEvidence({
            evidence: identityEvidence("run-target", isolatedUrl),
            expectedDatabase: "pharmnos_test",
            expectedRole: "tester",
            targetUrl,
            runId: "run-target",
            now: IDENTITY_NOW,
        });
        assert.equal(result.ok, false);
        assert.match(result.error, /approved test target|context/);
    }
    const mismatched = validateDatabaseIdentityEvidence({
        evidence: identityEvidence("run-target", isolatedUrl),
        expectedDatabase: "pharmnos_test",
        expectedRole: "tester",
        targetUrl: ordinaryUrl,
        runId: "run-target",
        now: IDENTITY_NOW,
    });
    assert.equal(mismatched.ok, false);
    assert.match(mismatched.error, /approved test target/);
});

test("rejects missing, stale, future, mismatched-target, and mismatched-run evidence", () => {
    const base = {
        expectedDatabase: "pharmnos_test",
        expectedRole: "tester",
        targetUrl: isolatedUrl,
        runId: "run-identity",
        now: IDENTITY_NOW,
    };
    for (const [evidence, expected] of [
        [null, /evidence is required/],
        [identityEvidence("other-run"), /not bound to this test run/],
        [identityEvidence("run-identity", ordinaryUrl), /approved test target/],
        [identityEvidence("run-identity", isolatedUrl, { verifiedAt: -1_000_000 }), /stale/],
        [identityEvidence("run-identity", isolatedUrl, { verifiedAt: IDENTITY_NOW + 1 }), /future/],
    ]) {
        const result = validateDatabaseIdentityEvidence({ ...base, evidence });
        assert.equal(result.ok, false);
        assert.match(result.error, expected);
    }
});

test("readiness and scenario gates reject the former identity boolean API", async () => {
    const readiness = await validateFinancialE2eReadiness({
        target: { ...validInput, resolveHost: localResolver },
        fixtureStrategy,
        cleanupStrategy,
        databaseIdentityVerified: true,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    });
    assert.equal(readiness.ok, false);
    assert.equal(readiness.canExecute, false);

    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-boolean"), [
        { resourceType: "tenants", id: "tenant-boolean", runId: "run-boolean" },
    ]);
    assert.equal(canStartFinancialScenario({
        manifest,
        databaseIdentityVerified: true,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    }), false);
});

test("denies cleanup without validated identity evidence or explicit authorization", () => {
    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-cleanup-gate"), [
        { resourceType: "tenants", id: "tenant-cleanup-gate", runId: "run-cleanup-gate" },
    ]);
    assert.throws(() => authorizeFixtureCleanup(manifest, {
        cleanupAuthorized: true,
        targetUrl: isolatedUrl,
        databaseName: "pharmnos_test",
        databaseRole: "tester",
        runId: manifest.runId,
        now: IDENTITY_NOW,
    }), /identity evidence/);
    assert.throws(() => authorize(manifest, { cleanupAuthorized: false }), /explicit authorization/);
    assert.throws(() => authorize(manifest, {
        identityEvidence: identityEvidence(manifest.runId, isolatedUrl, { verifiedAt: -1_000_000 }),
    }), /stale/);
});

test("reports configuration readiness without claiming database readiness", async () => {
    const result = await validateFinancialE2eReadiness({
        target: { ...validInput, resolveHost: localResolver },
        fixtureStrategy,
        cleanupStrategy,
    });
    assert.equal(result.configurationReady, true);
    assert.equal(result.ok, false);
    assert.equal(result.canExecute, false);
    assert.match(result.errors.join(" "), /Database identity/);
    assert.match(result.errors.join(" "), /explicit authorization/);
});

test("only permits execution after identity and authorization gates are independently supplied", async () => {
    const result = await validateFinancialE2eReadiness({
        target: { ...validInput, resolveHost: localResolver },
        fixtureStrategy,
        cleanupStrategy,
        identityEvidence: identityEvidence("run-readiness"),
        databaseRole: "tester",
        runId: "run-readiness",
        now: IDENTITY_NOW,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    });
    assert.equal(result.configurationReady, true);
    assert.equal(result.ok, true);
    assert.equal(result.canExecute, true);
});

test("rejects missing fixture and cleanup contracts", async () => {
    const result = await validateFinancialE2eReadiness({ target: { ...validInput, resolveHost: localResolver } });
    assert.equal(result.configurationReady, false);
    assert.equal(result.canExecute, false);
    assert.match(result.errors.join(" "), /fixture strategy/);
    assert.match(result.errors.join(" "), /cleanup strategy/);
});

test("rejects an enabled scenario runner even when other gates are supplied", async () => {
    const result = await validateFinancialE2eReadiness({
        target: { ...validInput, resolveHost: localResolver },
        fixtureStrategy,
        cleanupStrategy,
        identityEvidence: identityEvidence("run-readiness-enabled"),
        databaseRole: "tester",
        runId: "run-readiness-enabled",
        now: IDENTITY_NOW,
        executionAuthorized: true,
        scenarioRunnerEnabled: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.canExecute, false);
    assert.match(result.errors.join(" "), /scenario runner must remain disabled/);
});

test("rejects cleanup identifiers not owned by the current run", () => {
    const result = validateFixtureCleanup({
        runId: "run-001",
        ownedIds: ["tenant-run-001", "user-run-001"],
        requestedIds: ["tenant-run-001", "foreign-tenant"],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /not owned/);
});

test("accepts cleanup identifiers owned by the current run", () => {
    assert.deepEqual(
        validateFixtureCleanup({
            runId: "run-001",
            ownedIds: ["tenant-run-001", "user-run-001"],
            requestedIds: ["tenant-run-001", "user-run-001"],
        }),
        { ok: true, errors: [] },
    );
});

test("creates a run-owned fixture manifest and records returned identifiers", () => {
    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-001"), [
        { resourceType: "tenants", id: "tenant-run-001", runId: "run-001" },
        { resourceType: "users", id: "user-run-001", runId: "run-001" },
    ]);
    assert.equal(manifest.status, FIXTURE_READY_STATUS);
    assert.equal(manifest.resources.length, 2);
});

test("rejects missing, duplicate, foreign, and unsupported fixture identifiers", () => {
    assert.throws(() => createFixtureManifest(""), /run ID/);
    const manifest = createFixtureManifest("run-001");
    assert.throws(() => recordFixtureIdentifiers(manifest, []), /at least one/);
    assert.throws(() => recordFixtureIdentifiers(manifest, [{ resourceType: "tenants", id: "t", runId: "other" }]), /matching run ID/);
    assert.throws(() => recordFixtureIdentifiers(manifest, [{ resourceType: "unknown", id: "x", runId: "run-001" }]), /Unsupported/);
    const ready = recordFixtureIdentifiers(manifest, [{ resourceType: "tenants", id: "t", runId: "run-001" }]);
    assert.throws(() => recordFixtureIdentifiers(ready, [{ resourceType: "users", id: "u", runId: "run-001" }]), /newly created/);
    assert.throws(() => recordFixtureIdentifiers(createFixtureManifest("run-002"), [
        { resourceType: "tenants", id: "t", runId: "run-002" },
        { resourceType: "tenants", id: "t", runId: "run-002" },
    ]), /Duplicate/);
    assert.throws(() => recordFixtureIdentifiers(createFixtureManifest("run-003"), [
        { resourceType: "storage_objects", id: "object", runId: "run-003" },
    ]), /Storage objects are prohibited/);
});

test("binds cleanup authorization against supported resource mutations", () => {
    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-001"), [
        { resourceType: "tenants", id: "tenant-run-001", runId: "run-001" },
        { resourceType: "sales_invoices", id: "sale-run-001", runId: "run-001" },
        { resourceType: "sales_invoice_items", id: "line-run-001", runId: "run-001" },
        { resourceType: "stock_movements", id: "movement-run-001", runId: "run-001" },
    ]);
    assert.throws(() => buildOwnedCleanupPlan(manifest), /authorized/);
    const authorized = authorize(manifest);
    assert.throws(() => {
        authorized.resources[0].resourceType = "users";
    }, TypeError);
    assert.throws(() => {
        authorized.resources.push({ resourceType: "users", id: "user-run-001", runId: "run-001" });
    }, TypeError);

    const substitutions = [
        (resources) => resources.map((resource, index) => index === 0 ? { ...resource, resourceType: "users" } : resource),
        (resources) => resources.map((resource, index) => index === 0 ? { ...resource, id: "other-same-run" } : resource),
        (resources) => [{ resourceType: "tenants", id: "replacement", runId: "run-001" }],
        (resources) => [...resources, { ...resources[0] }],
        (resources) => [...resources, { resourceType: "users", id: "foreign", runId: "other-run" }],
    ];
    for (const mutateResources of substitutions) {
        const tampered = { ...authorized, resources: mutateResources(authorized.resources) };
        assert.throws(() => buildOwnedCleanupPlan(tampered), /snapshot|matching run ID|Duplicate/);
    }
    const plan = buildOwnedCleanupPlan(authorized);
    assert.deepEqual(plan.resources.map((resource) => resource.resourceType), [
        "stock_movements",
        "sales_invoice_items",
        "sales_invoices",
        "tenants",
    ]);
});

test("fixture and cleanup failures prevent subsequent scenario execution", () => {
    const failedFixture = recordFixtureCreationFailure(createFixtureManifest("run-001"), "fixture create failed");
    assert.equal(failedFixture.status, "FIXTURE_FAILED");
    assert.equal(canStartFinancialScenario({
        manifest: failedFixture,
        ...scenarioInput(failedFixture),
    }), false);

    const ready = recordFixtureIdentifiers(createFixtureManifest("run-001"), [
        { resourceType: "tenants", id: "tenant-run-001", runId: "run-001" },
    ]);
    const authorized = authorize(ready);
    const failedCleanup = recordCleanupFailure(authorized, "cleanup failed");
    assert.equal(failedCleanup.status, "CLEANUP_FAILED");
    assert.equal(canStartFinancialScenario({
        manifest: failedCleanup,
        ...scenarioInput(failedCleanup),
    }), false);
});

test("allows cleanup planning after failure only for confirmed owned resources", () => {
    const manifest = recordFixtureCreationFailure(
        createFixtureManifest("run-partial"),
        "second fixture operation failed",
        [{ resourceType: "tenants", id: "tenant-partial", runId: "run-partial" }],
    );
    assert.equal(manifest.status, "FIXTURE_FAILED_CLEANUP_READY");
    const authorized = authorize(manifest);
    assert.equal(buildOwnedCleanupPlan(authorized).resources.length, 1);

    const uncertain = recordFixtureCreationFailure(createFixtureManifest("run-uncertain"), "unknown partial failure");
    assert.equal(uncertain.status, "FIXTURE_FAILED");
    assert.throws(() => authorize(uncertain), /READY or ownership-confirmed/);
});

test("rejects forged or mutated manifests at cleanup and scenario boundaries", () => {
    const forged = {
        kind: "pharmnos-financial-e2e-fixture-manifest-v1",
        runId: "run-forged",
        status: "CLEANUP_AUTHORIZED",
        resources: [{ resourceType: "tenants", id: "tenant-forged", runId: "other-run" }],
        fixtureCreationError: null,
        cleanupError: null,
        cleanupAuthorization: { resourceSnapshot: [] },
        cleanupCompletion: null,
    };
    assert.throws(() => buildOwnedCleanupPlan(forged), /matching run ID/);
    assert.equal(canStartFinancialScenario(scenarioInput(forged)), false);

    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-mutate"), [
        { resourceType: "tenants", id: "tenant-mutate", runId: "run-mutate" },
    ]);
    const authorized = authorize(manifest);
    const tampered = { ...authorized, resources: [...authorized.resources, { resourceType: "tenants", id: "foreign", runId: "other-run" }] };
    assert.throws(() => buildOwnedCleanupPlan(tampered), /matching run ID/);
});

test("requires explicit matching executor evidence for cleanup completion", () => {
    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-complete"), [
        { resourceType: "tenants", id: "tenant-complete", runId: "run-complete" },
    ]);
    const authorized = authorize(manifest);
    const plan = buildOwnedCleanupPlan(authorized);
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.resources), true);
    assert.equal(Object.isFrozen(plan.resources[0]), true);
    assert.throws(() => {
        plan.resources[0].id = "changed-after-plan";
    }, TypeError);
    assert.throws(() => {
        plan.resources.push({ resourceType: "users", id: "user-after-plan", runId: "run-complete" });
    }, TypeError);
    assert.throws(() => {
        plan.resources = [];
    }, TypeError);
    assert.throws(() => recordCleanupSuccess(authorized), /explicit executor success/);
    assert.throws(() => recordCleanupSuccess(authorized, { success: false, plan }), /explicit executor success/);
    assert.throws(() => recordCleanupSuccess(authorized, { success: true, plan: { ...plan, resources: [] } }), /plan|resource list/);
    assert.throws(() => recordCleanupSuccess(authorized, {
        success: true,
        plan: {
            ...plan,
            resources: plan.resources.map((resource) => ({ ...resource, unexpected: "extra-field" })),
        },
    }), /exactly/);
    const complete = recordCleanupSuccess(authorized, { success: true, plan });
    assert.equal(complete.status, "CLEANUP_COMPLETE");
    assert.throws(() => buildOwnedCleanupPlan(complete), /authorized/);
    assert.equal(canStartFinancialScenario(scenarioInput(complete)), false);
    assert.throws(() => recordCleanupSuccess(complete, { success: true, plan }), /authorized/);
});

test("cleanup ordering satisfies independently asserted Prisma relationships", () => {
    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-order"), RESOURCE_CLEANUP_ORDER.map((resourceType) => ({
        resourceType,
        id: `${resourceType}-run-order`,
        runId: "run-order",
    })));
    const authorized = authorize(manifest);
    const plan = buildOwnedCleanupPlan(authorized);
    const positions = new Map(plan.resources.map((resource, index) => [resource.resourceType, index]));
    for (const [dependent, parent] of cleanupDependencies) {
        assert.ok(positions.get(dependent) < positions.get(parent), `${dependent} must precede ${parent}`);
    }
    assert.deepEqual(plan.order, RESOURCE_CLEANUP_ORDER);
});

test("enforces lifecycle transitions and blocks every non-ready scenario state", () => {
    const ready = recordFixtureIdentifiers(createFixtureManifest("run-state"), [
        { resourceType: "tenants", id: "tenant-state", runId: "run-state" },
    ]);
    assert.equal(ready.status, FIXTURE_READY_STATUS);
    assert.equal(canStartFinancialScenario(scenarioInput(ready)), true);

    const authorized = authorize(ready);
    assert.equal(canStartFinancialScenario(scenarioInput(authorized)), false);
    assert.throws(() => authorize(authorized), /READY/);
    const failed = recordCleanupFailure(authorized, "cleanup failed");
    assert.equal(failed.fixtureCreationError, null);
    assert.equal(canStartFinancialScenario(scenarioInput(failed)), false);
    assert.throws(() => recordCleanupSuccess(failed, { success: true, plan: buildOwnedCleanupPlan(authorized) }), /authorized/);

    const partial = recordFixtureCreationFailure(createFixtureManifest("run-partial-state"), "fixture failed", [
        { resourceType: "tenants", id: "tenant-partial-state", runId: "run-partial-state" },
    ]);
    assert.equal(canStartFinancialScenario(scenarioInput(partial)), false);
    assert.equal(partial.fixtureCreationError, "fixture failed");
    const partialAuthorized = authorize(partial);
    const partialFailed = recordCleanupFailure(partialAuthorized, "partial cleanup failed");
    assert.equal(partialFailed.fixtureCreationError, "fixture failed");
    assert.equal(canStartFinancialScenario(scenarioInput(partialFailed)), false);

    const uncertain = recordFixtureCreationFailure(createFixtureManifest("run-unknown"), "unknown failure");
    assert.equal(canStartFinancialScenario(scenarioInput(uncertain)), false);
});

test("rejects incomplete and contradictory manifest fields", () => {
    const valid = recordFixtureIdentifiers(createFixtureManifest("run-valid"), [
        { resourceType: "tenants", id: "tenant-valid", runId: "run-valid" },
    ]);
    const incomplete = { ...valid };
    delete incomplete.cleanupAuthorization;
    assert.throws(() => buildOwnedCleanupPlan(incomplete), /Invalid financial E2E fixture manifest/);

    const contradictory = { ...valid, fixtureCreationError: "unexpected failure" };
    assert.throws(() => buildOwnedCleanupPlan(contradictory), /FIXTURE_READY/);
    const forgedCompletion = {
        ...valid,
        status: "CLEANUP_COMPLETE",
        cleanupAuthorization: { resourceSnapshot: valid.resources },
        cleanupCompletion: null,
    };
    assert.throws(() => buildOwnedCleanupPlan(forgedCompletion), /authorized|completion/);
});
