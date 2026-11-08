import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createSignedFinancialContext } from "../scripts/financial-e2e-signed-context.mjs";

const secret = "0123456789abcdef0123456789abcdef";

test("creates a short-lived signed context without exposing the secret", () => {
    const value = createSignedFinancialContext("subject-a", "tenant-a", secret);
    const second = createSignedFinancialContext("subject-a", "tenant-a", secret);
    assert.match(value, /^v1\|subject-a\|tenant-a\|\d+\|[0-9a-f]{32}\.[0-9a-f]{64}$/);
    assert.notEqual(value, second);
    assert.doesNotMatch(value, /0123456789/);
});

test("the TypeScript verifier validates the nonce-bearing format", () => {
    const source = fs.readFileSync(path.resolve("src/lib/db/financial-auth-context.ts"), "utf8");
    assert.match(source, /split\("\\|", 5\)/);
    assert.match(source, /nonce/);
    assert.match(source, /\^\[0-9a-f\]\{32\}\$/);
});

test("rejects malformed identity components and missing signing secrets", () => {
    assert.throws(() => createSignedFinancialContext("subject|forged", "tenant-a", secret), /invalid identity/i);
    assert.throws(() => createSignedFinancialContext("subject-a", "tenant.a", secret), /invalid identity/i);
    assert.throws(() => createSignedFinancialContext("subject-a", "tenant-a", ""), /required/i);
});

test("database verifier binds the signed tenant to an active membership", () => {
    const source = fs.readFileSync(path.resolve("scripts/financial-e2e-provision-local.mjs"), "utf8");
    assert.match(source, /JOIN public\.memberships AS m ON m\.user_id = u\.id/);
    assert.match(source, /m\.tenant_id::text = context_tenant/);
    assert.match(source, /m\.status = 'active'/);
});

test("subject-only contexts resolve only a unique active tenant", () => {
    const source = fs.readFileSync(path.resolve("scripts/financial-e2e-provision-local.mjs"), "utf8");
    assert.match(source, /IF context_tenant IS NULL THEN/);
    assert.match(source, /HAVING count\(\*\) = 1/);
    assert.match(source, /IF context_tenant IS NULL THEN RETURN; END IF;/);
});

test("subject-scoped RLS reads remain bound to the signed tenant", () => {
    const source = fs.readFileSync(path.resolve("scripts/financial-e2e-provision-local.mjs"), "utf8");
    assert.equal((source.match(/memberships\.tenant_id::text = public\.financial_context_tenant_id\(\)/g) ?? []).length, 1);
    assert.equal((source.match(/m\.tenant_id::text = public\.financial_context_tenant_id\(\)/g) ?? []).length, 2);
});

test("authorization-table writes require signed admin authority", () => {
    const source = fs.readFileSync(path.resolve("scripts/financial-e2e-provision-local.mjs"), "utf8");
    assert.match(source, /financial_context_is_admin/);
    assert.match(source, /const writePredicate = \["memberships", "roles", "role_permissions"\]/);
    assert.match(source, /GRANT EXECUTE ON FUNCTION public\.financial_context_is_admin\(\)/);
});
