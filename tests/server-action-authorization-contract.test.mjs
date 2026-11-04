import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mastersSource = await readFile(
    new URL("../src/app/_actions/masters.actions.ts", import.meta.url),
    "utf8",
);
const authSource = await readFile(
    new URL("../src/app/auth/_actions/auth.actions.ts", import.meta.url),
    "utf8",
);

function exportedFunctionBody(source, name) {
    const start = source.indexOf(`export async function ${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const end = source.indexOf("\nexport async function ", start + 1);
    return source.slice(start, end === -1 ? source.length : end);
}

test("master create and update actions require their write permissions before database access", () => {
    const actions = [
        ["createProductAction", "create_product", "prisma.$transaction"],
        ["updateProductAction", "edit_product", "prisma.products.findUnique"],
        ["createCustomerAction", "create_customer", "prisma.$transaction"],
        ["updateCustomerAction", "edit_customer", "prisma.customers.findUnique"],
        ["createSupplierAction", "create_supplier", "prisma.$transaction"],
        ["updateSupplierAction", "edit_supplier", "prisma.suppliers.findUnique"],
    ];

    for (const [name, permission, firstDatabaseAccess] of actions) {
        const body = exportedFunctionBody(mastersSource, name);
        const contextIndex = body.indexOf("const ctx = await requireServerTenantContext();");
        const permissionIndex = body.indexOf(`requirePermission(ctx, PermissionAction.${permission});`);
        const databaseIndex = body.indexOf(firstDatabaseAccess);

        assert.ok(contextIndex >= 0, `${name} must establish tenant context`);
        assert.ok(permissionIndex > contextIndex, `${name} must require ${permission} after tenant context`);
        assert.ok(databaseIndex > permissionIndex, `${name} must authorize before database access`);
    }
});

test("privileged auth helpers are private while signup retains the onboarding call", () => {
    assert.match(authSource, /async function ensureRolePermissionsForTenant\(/);
    assert.match(authSource, /async function onboardNewTenant\(/);
    assert.doesNotMatch(authSource, /export async function ensureRolePermissionsForTenant\(/);
    assert.doesNotMatch(authSource, /export async function onboardNewTenant\(/);

    const signupBody = exportedFunctionBody(authSource, "signUpAction");
    assert.match(signupBody, /await onboardNewTenant\(/);
});
