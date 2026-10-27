import assert from "node:assert/strict";
import test from "node:test";
import { validateArtifacts } from "../scripts/financial-e2e-provisioning-static-guard.mjs";

test("offline provisioning artifacts satisfy the security contract", () => {
    assert.deepEqual(validateArtifacts(), []);
});

test("offline guard rejects broad privileges", () => {
    const errors = validateArtifacts({
        securitySql: "GRANT ALL ON TABLE public.tenants TO pharmnos_e2e_runtime;",
    });

    assert.ok(errors.some((error) => error.includes("GRANT")));
});

test("offline guard rejects missing forced RLS coverage", () => {
    const errors = validateArtifacts({
        securitySql: "REVOKE CREATE ON SCHEMA public FROM pharmnos_e2e_runtime;",
    });

    assert.ok(errors.some((error) => error.includes("FORCE ROW LEVEL SECURITY")));
});

test("offline guard rejects missing per-table RLS policy coverage", () => {
    const errors = validateArtifacts({
        rlsSql: "ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY;",
    });

    assert.ok(errors.some((error) => error.includes("RLS artifact omits SELECT/INSERT policy coverage")));
});

test("offline guard rejects an unsafe function search path", () => {
    const errors = validateArtifacts({
        securitySql: "SECURITY DEFINER function without a fixed search path",
    });

    assert.ok(errors.some((error) => error.includes("SET search_path = pg_catalog, public")));
});

test("offline guard rejects a missing artifact cross-reference", () => {
    const errors = validateArtifacts({
        runbook: "target identity bootstrap role runtime role RLS immutability fixtures financial E2E",
    });

    assert.ok(errors.some((error) => error.includes("artifact cross-reference")));
});

test("offline guard rejects a baseline that omits a Prisma model", () => {
    const errors = validateArtifacts({
        sql: "Generated offline from the current Prisma schema. complete baseline",
        schema: "model tenants { id String @id }",
        securitySql: "",
        rlsSql: "",
        additiveSql: "",
        runbook: "",
    });

    assert.ok(errors.some((error) => error.includes("generated baseline omits Prisma model table")));
});
