import assert from "node:assert/strict";
import test from "node:test";
import { CLEANUP_TABLES, collectOwnedResources, ownershipQuery } from "../scripts/financial-e2e-fixture-ownership.mjs";

test("uses direct tenant ownership only for tables with tenant_id", () => {
    assert.match(ownershipQuery("products"), /tenant_id = ANY/);
    assert.match(ownershipQuery("users"), /memberships\.tenant_id = ANY/);
    assert.doesNotMatch(ownershipQuery("users"), /users\.tenant_id/);
});

test("uses verified indirect ownership for users and role permissions", () => {
    assert.match(ownershipQuery("users"), /NOT EXISTS/);
    assert.match(ownershipQuery("role_permissions"), /JOIN roles/);
    assert.match(ownershipQuery("role_permissions"), /role\.tenant_id = ANY/);
});

test("fails closed for unknown ownership relationships", () => {
    assert.throws(() => ownershipQuery("unknown_table"), /Unknown cleanup resource ownership/);
});

test("collects multiple run-owned tenants without broad deletion", async () => {
    const queries = [];
    const client = {
        async query(text, values) {
            queries.push({ text, values });
            return { rows: text.includes("FROM users") ? [{ id: "user-owned" }] : [] };
        },
    };
    const resources = await collectOwnedResources(client, ["tenant-a", "tenant-b"], "run-owned");
    assert.equal(queries.length, Object.keys(CLEANUP_TABLES).length);
    assert.ok(queries.every(({ values }) => values[0].join("|") === "tenant-a|tenant-b"));
    assert.deepEqual(resources.find((resource) => resource.resourceType === "users"), {
        resourceType: "users",
        id: "user-owned",
        runId: "run-owned",
    });
});

test("rejects missing tenant ownership context before querying", async () => {
    await assert.rejects(
        collectOwnedResources({ query: async () => ({ rows: [] }) }, [], "run-owned"),
        /one or more verified run-owned tenants/,
    );
});
