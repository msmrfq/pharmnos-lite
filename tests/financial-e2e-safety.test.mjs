import assert from "node:assert/strict";
import test from "node:test";
import { validateFinancialE2eTarget } from "../scripts/financial-e2e-safety.mjs";
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
const isolatedUrl = "postgresql://tester@localhost:5432/pharmnos_test?application_name=pharmnos-financial-e2e";
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
        databaseIdentityVerified: true,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    };
}

test("accepts a separately identified disposable target", () => {
    assert.deepEqual(validateFinancialE2eTarget(validInput), { ok: true, errors: [] });
});

test("rejects an identical ordinary and test URL", () => {
    const result = validateFinancialE2eTarget({ ...validInput, testUrl: ordinaryUrl });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /must differ/);
});

test("rejects a target with the same database identity but different query parameters", () => {
    const result = validateFinancialE2eTarget({
        ...validInput,
        testUrl: "postgresql://tester@localhost:5432/pharmnos?application_name=pharmnos-financial-e2e",
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /different database identity/);
});

test("rejects missing ordinary database identity", () => {
    const result = validateFinancialE2eTarget({ ...validInput, ordinaryUrl: "" });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /DATABASE_URL is required/);
});

test("rejects missing isolation marker and non-test database name", () => {
    const result = validateFinancialE2eTarget({
        ...validInput,
        testDatabaseName: "pharmnos",
        marker: "wrong-marker",
        testUrl: "postgresql://tester@localhost:5432/pharmnos_test",
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /TEST_DATABASE_NAME/);
    assert.match(result.errors.join(" "), /TEST_DATABASE_MARKER/);
    assert.match(result.errors.join(" "), /application marker/);
});

test("reports configuration readiness without claiming database readiness", () => {
    const result = validateFinancialE2eReadiness({
        target: validInput,
        fixtureStrategy,
        cleanupStrategy,
    });
    assert.equal(result.configurationReady, true);
    assert.equal(result.ok, false);
    assert.equal(result.canExecute, false);
    assert.match(result.errors.join(" "), /Database identity/);
    assert.match(result.errors.join(" "), /explicit authorization/);
});

test("only permits execution after identity and authorization gates are independently supplied", () => {
    const result = validateFinancialE2eReadiness({
        target: validInput,
        fixtureStrategy,
        cleanupStrategy,
        databaseIdentityVerified: true,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    });
    assert.equal(result.configurationReady, true);
    assert.equal(result.ok, true);
    assert.equal(result.canExecute, true);
});

test("rejects missing fixture and cleanup contracts", () => {
    const result = validateFinancialE2eReadiness({ target: validInput });
    assert.equal(result.configurationReady, false);
    assert.equal(result.canExecute, false);
    assert.match(result.errors.join(" "), /fixture strategy/);
    assert.match(result.errors.join(" "), /cleanup strategy/);
});

test("rejects an enabled scenario runner even when other gates are supplied", () => {
    const result = validateFinancialE2eReadiness({
        target: validInput,
        fixtureStrategy,
        cleanupStrategy,
        databaseIdentityVerified: true,
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
    const authorized = authorizeFixtureCleanup(manifest, {
        databaseIdentityVerified: true,
        cleanupAuthorized: true,
    });
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
        databaseIdentityVerified: true,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    }), false);

    const ready = recordFixtureIdentifiers(createFixtureManifest("run-001"), [
        { resourceType: "tenants", id: "tenant-run-001", runId: "run-001" },
    ]);
    const authorized = authorizeFixtureCleanup(ready, { databaseIdentityVerified: true, cleanupAuthorized: true });
    const failedCleanup = recordCleanupFailure(authorized, "cleanup failed");
    assert.equal(failedCleanup.status, "CLEANUP_FAILED");
    assert.equal(canStartFinancialScenario({
        manifest: failedCleanup,
        databaseIdentityVerified: true,
        executionAuthorized: true,
        scenarioRunnerEnabled: false,
    }), false);
});

test("allows cleanup planning after failure only for confirmed owned resources", () => {
    const manifest = recordFixtureCreationFailure(
        createFixtureManifest("run-partial"),
        "second fixture operation failed",
        [{ resourceType: "tenants", id: "tenant-partial", runId: "run-partial" }],
    );
    assert.equal(manifest.status, "FIXTURE_FAILED_CLEANUP_READY");
    const authorized = authorizeFixtureCleanup(manifest, {
        databaseIdentityVerified: true,
        cleanupAuthorized: true,
    });
    assert.equal(buildOwnedCleanupPlan(authorized).resources.length, 1);

    const uncertain = recordFixtureCreationFailure(createFixtureManifest("run-uncertain"), "unknown partial failure");
    assert.equal(uncertain.status, "FIXTURE_FAILED");
    assert.throws(() => authorizeFixtureCleanup(uncertain, {
        databaseIdentityVerified: true,
        cleanupAuthorized: true,
    }), /READY or ownership-confirmed/);
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
    const authorized = authorizeFixtureCleanup(manifest, { databaseIdentityVerified: true, cleanupAuthorized: true });
    const tampered = { ...authorized, resources: [...authorized.resources, { resourceType: "tenants", id: "foreign", runId: "other-run" }] };
    assert.throws(() => buildOwnedCleanupPlan(tampered), /matching run ID/);
});

test("requires explicit matching executor evidence for cleanup completion", () => {
    const manifest = recordFixtureIdentifiers(createFixtureManifest("run-complete"), [
        { resourceType: "tenants", id: "tenant-complete", runId: "run-complete" },
    ]);
    const authorized = authorizeFixtureCleanup(manifest, { databaseIdentityVerified: true, cleanupAuthorized: true });
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
    const authorized = authorizeFixtureCleanup(manifest, { databaseIdentityVerified: true, cleanupAuthorized: true });
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

    const authorized = authorizeFixtureCleanup(ready, { databaseIdentityVerified: true, cleanupAuthorized: true });
    assert.equal(canStartFinancialScenario(scenarioInput(authorized)), false);
    assert.throws(() => authorizeFixtureCleanup(authorized, { databaseIdentityVerified: true, cleanupAuthorized: true }), /READY/);
    const failed = recordCleanupFailure(authorized, "cleanup failed");
    assert.equal(failed.fixtureCreationError, null);
    assert.equal(canStartFinancialScenario(scenarioInput(failed)), false);
    assert.throws(() => recordCleanupSuccess(failed, { success: true, plan: buildOwnedCleanupPlan(authorized) }), /authorized/);

    const partial = recordFixtureCreationFailure(createFixtureManifest("run-partial-state"), "fixture failed", [
        { resourceType: "tenants", id: "tenant-partial-state", runId: "run-partial-state" },
    ]);
    assert.equal(canStartFinancialScenario(scenarioInput(partial)), false);
    assert.equal(partial.fixtureCreationError, "fixture failed");
    const partialAuthorized = authorizeFixtureCleanup(partial, { databaseIdentityVerified: true, cleanupAuthorized: true });
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
