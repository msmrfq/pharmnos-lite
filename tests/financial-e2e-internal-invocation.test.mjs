import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const bindingPath = new URL(
    "../src/lib/financial-e2e/app-hosted-binding.ts",
    import.meta.url,
);

async function readBinding() {
    return fs.readFile(bindingPath, "utf8");
}

test("provides one internal invocation and no public entry point", async () => {
    const source = await readBinding();
    assert.match(source, /export async function invokeRequestScopedFinancialE2e/);
    assert.doesNotMatch(source, /export async function (GET|POST|PUT|PATCH|DELETE)/);
    assert.doesNotMatch(source, /"use server"/);
});

test("internal invocation fixes production authentication and authorization", async () => {
    const source = await readBinding();
    assert.match(source, /resolveTenantContext:\s*requireServerTenantContext/);
    assert.match(source, /requirePermission,\s*$/m);
    assert.doesNotMatch(source, /requestedTenantId\s*:/);
    assert.doesNotMatch(source, /getCurrentSession|accessToken|refreshToken/);
});

test("internal invocation registers no financial operations", async () => {
    const source = await readBinding();
    assert.match(source, /scenarioOperations:\s*\{\}/);
    assert.match(source, /return boundary\.dispatch\(request\)/);
});

test("internal invocation leaves the safety gate as a required dependency", async () => {
    const source = await readBinding();
    assert.match(source, /canStartScenario: ApplicationHostedFinancialE2eBoundaryOptions\["canStartScenario"\]/);
    assert.match(source, /canStartScenario,/);
});

test("production denial remains enforced for internal construction", async () => {
    const source = await readBinding();
    assert.match(source, /process\.env\.NODE_ENV === "production"/);
    assert.match(source, /Financial E2E application binding is disabled in production/);
});
