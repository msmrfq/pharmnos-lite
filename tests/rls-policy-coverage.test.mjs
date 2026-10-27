#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    GST_POSTING_TABLES,
    verifyRlsRolloutSnapshot,
} from "../scripts/rls-rollout-verifier.mjs";

const rlsSql = await readFile(new URL("../prisma/05-rls-tenant-policies.sql", import.meta.url), "utf8");
const gstTables = GST_POSTING_TABLES;

test("covers every additive GST/posting table with guarded RLS", () => {
    assert.match(rlsSql, /to_regprocedure\('public\.jwt_tenant_id\(\)'\)/);
    assert.match(rlsSql, /to_regclass\(format\('public\.%I', table_name\)\)/);
    for (const table of gstTables) {
        assert.match(rlsSql, new RegExp(`'${table}'`));
    }
    assert.match(rlsSql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.%I TO authenticated/);
    assert.match(rlsSql, /CREATE POLICY "tenant_select_%s"/);
    assert.match(rlsSql, /CREATE POLICY "tenant_insert_%s"/);
    assert.match(rlsSql, /CREATE POLICY "tenant_update_%s"/);
    assert.match(rlsSql, /USING \(tenant_id = public\.jwt_tenant_id\(\)\)/);
    assert.match(rlsSql, /WITH CHECK \(tenant_id = public\.jwt_tenant_id\(\)\)/);
});

test("does not add an anonymous grant for additive GST/posting tables", () => {
    const additiveBlock = rlsSql.slice(rlsSql.indexOf("4. Additive GST/posting policies."));
    assert.doesNotMatch(additiveBlock, /TO anon/i);
    assert.match(additiveBlock, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.%I TO authenticated/);
    assert.doesNotMatch(additiveBlock, /FOR DELETE/);
});

function validSnapshot() {
    return {
        identity: {
            databaseName: "pharmnos_test",
            serverIdentity: "isolated-test-project",
            connectedRole: "authenticated",
            isTargetApproved: true,
        },
        helper: {
            schema: "public",
            name: "jwt_tenant_id",
            usesAppMetadata: true,
            failClosedOnMissingClaim: true,
        },
        tables: gstTables.map((name) => ({
            schema: "public",
            name,
            exists: true,
            rlsEnabled: true,
            policies: [{
                name: "tenant_isolation_policy",
                role: "authenticated",
                using: "tenant_id = public.jwt_tenant_id()",
                withCheck: "tenant_id = public.jwt_tenant_id()",
            }],
            grants: [{ role: "authenticated", privilege: "SELECT" }],
        })),
    };
}

function validOptions() {
    return {
        expectedIdentity: {
            databaseName: "pharmnos_test",
            serverIdentity: "isolated-test-project",
            connectedRole: "authenticated",
        },
        expectedGrants: [{ role: "authenticated", privilege: "SELECT" }],
    };
}

test("accepts a complete verified snapshot with explicitly expected grants", () => {
    assert.deepEqual(
        verifyRlsRolloutSnapshot(validSnapshot(), validOptions()),
        { ok: true, errors: [] },
    );
});

test("rejects an unverified identity, missing table, and skipped policy", () => {
    const snapshot = validSnapshot();
    snapshot.identity.isTargetApproved = false;
    snapshot.tables = snapshot.tables.slice(1);
    snapshot.tables[0].policies = [];

    const result = verifyRlsRolloutSnapshot(snapshot, validOptions());

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /Verified database identity/);
    assert.match(result.errors.join(" "), /Expected table metadata is missing/);
    assert.match(result.errors.join(" "), /Required policy is missing/);
});

test("rejects disabled RLS, wrong predicates, and unexpected grants", () => {
    const snapshot = validSnapshot();
    snapshot.tables[0].rlsEnabled = false;
    snapshot.tables[0].policies[0].using = "true";
    snapshot.tables[0].grants.push({ role: "anon", privilege: "SELECT" });

    const result = verifyRlsRolloutSnapshot(snapshot, validOptions());

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /RLS is disabled/);
    assert.match(result.errors.join(" "), /Wrong USING predicate/);
    assert.match(result.errors.join(" "), /Unexpected grant.*anon:SELECT/);
});

test("supports an explicitly approved least-privilege grant set", () => {
    const snapshot = validSnapshot();
    snapshot.tables = snapshot.tables.map((table) => ({
        ...table,
        grants: [{ role: "prisma", privilege: "SELECT" }],
    }));

    const result = verifyRlsRolloutSnapshot(snapshot, {
        expectedIdentity: validOptions().expectedIdentity,
        expectedGrants: [{ role: "prisma", privilege: "SELECT" }],
    });

    assert.equal(result.ok, true);
});

test("rejects mismatched identity, duplicate tables, duplicate grants, and missing grant approval", () => {
    const snapshot = validSnapshot();
    snapshot.identity.databaseName = "unexpected_database";
    snapshot.tables[0].grants.push({ role: "authenticated", privilege: "select" });
    snapshot.tables.push(snapshot.tables[0]);

    const result = verifyRlsRolloutSnapshot(snapshot, {
        expectedIdentity: validOptions().expectedIdentity,
        expectedGrants: [{ role: "authenticated", privilege: "SELECT" }],
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /must match the approved target identity/);
    assert.match(result.errors.join(" "), /Duplicate table metadata/);
    assert.match(result.errors.join(" "), /Duplicate grants/);
});

test("rejects missing explicit grant and identity approvals", () => {
    const result = verifyRlsRolloutSnapshot(validSnapshot());

    assert.equal(result.ok, false);
    assert.match(result.errors.join(" "), /expected grant set is required/);
    assert.match(result.errors.join(" "), /expected database identity is required/);
});
