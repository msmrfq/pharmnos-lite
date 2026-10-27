import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const bindingPath = new URL(
    "../src/lib/financial-e2e/app-hosted-binding.ts",
    import.meta.url,
);

test("binds the existing request-scoped production resolver", async () => {
    const source = await fs.readFile(bindingPath, "utf8");
    assert.match(source, /requireServerTenantContext/);
    assert.match(source, /resolveTenantContext:\s*requireServerTenantContext/);
    assert.match(source, /requirePermission,\s*$/m);
});

test("rejects production construction and has no public route", async () => {
    const source = await fs.readFile(bindingPath, "utf8");
    assert.match(source, /process\.env\.NODE_ENV === "production"/);
    assert.match(source, /disabled in production/);
    assert.doesNotMatch(source, /export async function (GET|POST|PUT|PATCH|DELETE)/);
});

test("does not accept caller authentication or tenant authority", async () => {
    const source = await fs.readFile(bindingPath, "utf8");
    assert.doesNotMatch(source, /tenantId\s*:/);
    assert.doesNotMatch(source, /getCurrentSession/);
    assert.doesNotMatch(source, /session|cookie|accessToken|refreshToken/);
});
