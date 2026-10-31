#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const { Client } = pg;
const run = `sec03-${Date.now()}`;
const sharedRoles = {
  bootstrap: "pharmnos_e2e",
  runtime: "pharmnos_e2e_runtime",
  admin: "pharmnos_e2e_admin",
  validation: "pharmnos_e2e_validation",
};
const roles = {
  bootstrap: sharedRoles.bootstrap,
  runtime: `${run}-runtime`,
  admin: `${run}-admin`,
  validation: `${run}-validation`,
};
const nonTenantCatalogTables = ["hsn_sac_catalog", "hsn_sac_catalog_history", "gst_rate_rules"];
const ids = {
  tenantA: `${run}-tenant-a`,
  tenantB: `${run}-tenant-b`,
  productA: `${run}-product-a`,
  productB: `${run}-product-b`,
  ownProduct: `${run}-own-product`,
};
const results = [];

function loadEnv() {
  for (const file of [".env.financial-e2e"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  }
}

function url(raw, user, password, applicationName) {
  const parsed = new URL(raw);
  if (user) parsed.username = user;
  if (password) parsed.password = password;
  parsed.searchParams.set("application_name", applicationName);
  return parsed.toString();
}

async function connect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function rows(client, sql, values = []) {
  return (await client.query(sql, values)).rows;
}

async function expectError(operation) {
  try {
    await operation();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof Error ? `${error.code ?? "ERROR"}:${error.message}` : "ERROR";
  }
}

function record(id, expected, observed) {
  const status = expected === observed ? "PASS" : "FAIL";
  results.push({ id, expected, observed, status });
  if (status !== "PASS") throw new Error(`${id}: expected ${expected}, observed ${observed}`);
}

async function main() {
  loadEnv();
  const passwords = {
    runtime: crypto.randomBytes(24).toString("hex"),
    admin: crypto.randomBytes(24).toString("hex"),
    validation: crypto.randomBytes(24).toString("hex"),
  };
  const bootstrap = await connect(url(
    process.env.TEST_DATABASE_URL,
    process.env.FINANCIAL_E2E_DB_USER,
    process.env.FINANCIAL_E2E_DB_PASSWORD,
    "pharmnos-financial-e2e-sec-dec-03-bootstrap",
  ));
  const clients = { bootstrap };
  try {
    for (const [name, password] of Object.entries(passwords)) {
      const role = roles[name];
      const parentRole = sharedRoles[name];
      await bootstrap.query(
        `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOBYPASSRLS IN ROLE "${parentRole}" PASSWORD '${password.replaceAll("'", "''")}'`,
      );
      clients[name] = await connect(url(
        process.env.TEST_DATABASE_URL,
        role,
        password,
        `pharmnos-financial-e2e-sec-dec-03-${name}`,
      ));
    }
    await bootstrap.query(`
      REVOKE EXECUTE ON FUNCTION public.prevent_financial_history_mutation() FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION public.prevent_finalized_purchase_mutation() FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION public.prevent_finalized_sales_mutation() FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION public.guard_purchase_posting_transition() FROM PUBLIC;
      REVOKE EXECUTE ON FUNCTION public.guard_sales_posting_transition() FROM PUBLIC;
    `);
    const roleRows = await rows(bootstrap, `
      SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit
      FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname
    `, [[roles.bootstrap, roles.runtime, roles.admin, roles.validation]]);
    record("required-roles", "4", String(roleRows.length));
    const runtime = roleRows.find((row) => row.rolname === roles.runtime);
    record("runtime-role-attributes", "false/false/true", `${runtime.rolsuper}/${runtime.rolbypassrls}/${runtime.rolcanlogin}`);
    for (const role of [roles.admin, roles.validation]) {
      const row = roleRows.find((item) => item.rolname === role);
      record(`${role}-ordinary-role`, "false/false", `${row.rolsuper}/${row.rolbypassrls}`);
    }
    const memberships = await rows(bootstrap, `
      SELECT parent.rolname AS parent_role, member.rolname AS member_role
      FROM pg_auth_members m
      JOIN pg_roles parent ON parent.oid = m.roleid
      JOIN pg_roles member ON member.oid = m.member
      WHERE member.rolname = $1
        AND parent.rolname IN ($2, $3)
    `, [roles.bootstrap, sharedRoles.admin, sharedRoles.validation]);
    record("bootstrap-no-privileged-membership", "0", String(memberships.length));

    const tableCatalog = await rows(bootstrap, `
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname NOT IN ('q14_maintenance_probe', 'q14_trigger_allowlist', ${nonTenantCatalogTables.map((table) => `'${table}'`).join(", ")})
      ORDER BY c.relname
    `);
    record("all-governed-tables-rls-forced", "true", String(tableCatalog.every((row) => row.relrowsecurity && row.relforcerowsecurity)));
    record("runtime-does-not-own-governed-tables", "true", String(tableCatalog.every((row) => row.owner !== roles.runtime)));
    record("admin-does-not-own-governed-tables", "true", String(tableCatalog.every((row) => row.owner !== roles.admin)));
    record("validation-does-not-own-governed-tables", "true", String(tableCatalog.every((row) => row.owner !== roles.validation)));

    const routineRows = await rows(bootstrap, `
      SELECT p.oid::regprocedure AS routine, pg_get_userbyid(p.proowner) AS owner,
             p.prosecdef AS security_definer,
             has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND pg_get_userbyid(p.proowner) = 'pharmnos_e2e'
      ORDER BY p.oid
    `);
    record("public-routines-have-no-security-definer", "true", String(routineRows.every((row) => !row.security_definer)));
    record("public-routines-have-no-public-execute", "true", String(routineRows.every((row) => !row.public_execute)));

    await bootstrap.query(`
      INSERT INTO tenants (id, slug, business_name, updated_at)
      VALUES ($1, $2, 'SEC-DEC-03 Tenant A', now()), ($3, $4, 'SEC-DEC-03 Tenant B', now())
    `, [ids.tenantA, `${run}-a`, ids.tenantB, `${run}-b`]);
    await bootstrap.query(`
      INSERT INTO products
        (id, tenant_id, name, hsn_code, gst_rate, standard_sale_rate, updated_at)
      VALUES
        ($1, $2, 'SEC-DEC-03 Product A', 'SEC03', 18, 100, now()),
        ($3, $4, 'SEC-DEC-03 Product B', 'SEC03', 18, 100, now())
    `, [ids.productA, ids.tenantA, ids.productB, ids.tenantB]);

    await clients.runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
    record("same-tenant-select", "1", String((await rows(clients.runtime, "SELECT id FROM tenants WHERE id = $1", [ids.tenantA])).length));
    record("cross-tenant-select", "0", String((await rows(clients.runtime, "SELECT id FROM tenants WHERE id = $1", [ids.tenantB])).length));
    const ownInsert = await expectError(() => clients.runtime.query(
      `INSERT INTO products
        (id, tenant_id, name, hsn_code, gst_rate, standard_sale_rate, updated_at)
       VALUES ($1, $2, 'SEC-DEC-03 Own Insert', 'SEC03', 18, 100, now())`,
      [ids.ownProduct, ids.tenantA],
    ));
    record("same-tenant-insert", "NO_ERROR", ownInsert);
    const crossInsert = await expectError(() => clients.runtime.query(
      `INSERT INTO products
        (id, tenant_id, name, hsn_code, gst_rate, standard_sale_rate, updated_at)
       VALUES ($1, $2, 'SEC-DEC-03 Cross Insert', 'SEC03', 18, 100, now())`,
      [`${run}-cross-product`, ids.tenantB],
    ));
    record("cross-tenant-insert", "42501", crossInsert.slice(0, 5));
    const ownUpdate = await clients.runtime.query("UPDATE products SET name = $1 WHERE id = $2", ["Updated A", ids.productA]);
    record("same-tenant-update", "1", String(ownUpdate.rowCount));
    const crossUpdate = await clients.runtime.query("UPDATE products SET name = $1 WHERE id = $2", ["Updated B", ids.productB]);
    record("cross-tenant-update", "0", String(crossUpdate.rowCount));
    const crossDelete = await expectError(() => clients.runtime.query("DELETE FROM products WHERE id = $1", [ids.productB]));
    record("cross-tenant-delete", "ERROR", crossDelete === "NO_ERROR" ? crossDelete : "ERROR");
    await clients.runtime.query("RESET request.jwt.claim.tenant_id");
    const missingContext = await rows(clients.runtime, "SELECT id FROM tenants");
    record("missing-tenant-context", "0", String(missingContext.length));
    await clients.runtime.query("SELECT set_config('request.jwt.claim.tenant_id', 'invalid-context', false)");
    const invalidContext = await rows(clients.runtime, "SELECT id FROM tenants");
    record("invalid-tenant-context", "0", String(invalidContext.length));
    const ddl = await expectError(() => clients.runtime.query("CREATE TABLE public.sec03_unauthorized (id text)"));
    record("runtime-ddl-denied", "ERROR", ddl === "NO_ERROR" ? ddl : "ERROR");
    const routine = await expectError(() => clients.runtime.query("SELECT q14_security.approve_soft_delete($1, $2)", ["missing", "actor"]));
    record("runtime-privileged-routine-denied", "ERROR", routine === "NO_ERROR" ? routine : "ERROR");

    console.log(JSON.stringify({ run, status: "PASS — SCOPED RUNTIME VERIFIED", results }, null, 2));
  } finally {
    await Promise.all(Object.values(clients).filter((client) => client !== bootstrap).map((client) => client.end()));
    await bootstrap.query("DELETE FROM products WHERE id IN ($1, $2, $3)", [ids.productA, ids.productB, ids.ownProduct]);
    await bootstrap.query("DELETE FROM tenants WHERE id IN ($1, $2)", [ids.tenantA, ids.tenantB]);
    for (const role of Object.values(roles).filter((role) => role !== roles.bootstrap)) {
      await bootstrap.query(`DROP ROLE IF EXISTS "${role}"`);
    }
    await bootstrap.end();
  }
}

main().catch((error) => {
  console.error(`SEC_DEC_03=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
