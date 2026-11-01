import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const { Client } = pg;
const envFiles = [".env.local", ".env.financial-e2e"];
for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
}

const databaseUrl = new URL(process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL);
if (databaseUrl.hostname !== "127.0.0.1") {
    throw new Error("Trust-boundary audit requires the approved loopback disposable target.");
}

const files = [
    "src/lib/db/tenant-context.ts",
    "src/lib/db/prisma.ts",
    "src/adapters/auth/supabase-auth.adapter.ts",
    "scripts/financial-e2e-provision-local.mjs",
    "prisma/financial-e2e-rls-policies.review.sql",
    "scripts/purchase-gst-application-acceptance.cjs",
];
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const client = new Client({ connectionString: databaseUrl.toString() });
await client.connect();

const identity = (await client.query(`
    SELECT current_database() AS database_name, current_user,
      session_user, inet_server_addr()::text AS server_address, inet_server_port() AS server_port
`)).rows[0];
const role = (await client.query(`
    SELECT rolcanlogin AS can_login, rolsuper AS is_superuser,
      rolbypassrls AS bypasses_rls,
      has_schema_privilege(current_user, 'public', 'CREATE') AS public_schema_create,
      has_function_privilege(current_user, 'pg_catalog.set_config(text,text,boolean)', 'EXECUTE') AS set_config_execute
    FROM pg_roles WHERE rolname = current_user
`)).rows[0];
const helper = (await client.query(`
    SELECT count(*)::int AS count
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'authenticated_subject_user_id'
`)).rows[0];

await client.query("BEGIN");
await client.query(
    "SELECT set_config('request.jwt.claim.sub', 'forged-subject', true), set_config('request.jwt.claim.tenant_id', 'forged-tenant', true)",
);
const forgedClaims = (await client.query(`
    SELECT current_setting('request.jwt.claim.sub', true) AS subject,
      current_setting('request.jwt.claim.tenant_id', true) AS tenant
`)).rows[0];
await client.query("ROLLBACK");
await client.end();

const evidence = {
    evidenceVersion: 1,
    audit: "authenticated-database-trust-boundary",
    target: "approved local disposable PostgreSQL runtime target only",
    databaseIdentity: identity,
    runtimeRole: role,
    securityDefinerHelper: { publicFunctionCount: helper.count, status: helper.count === 0 ? "REMOVED" : "PRESENT" },
    forgedClaimProbe: {
        status: forgedClaims.subject === "forged-subject" && forgedClaims.tenant === "forged-tenant" ? "REPRODUCED" : "NOT_REPRODUCED",
        subject: forgedClaims.subject,
        tenant: forgedClaims.tenant,
        conclusion: "Transaction-local GUCs are mutable by the runtime role and are not, by themselves, authenticated identity.",
    },
    sourceHashes: Object.fromEntries(files.map((file) => [file, sha256(file)])),
    cleanup: "No database or persistent rows were created; transaction was rolled back.",
    verdict: "HIGH_TRUST_BOUNDARY_BLOCKER",
};

const output = `.obsidian-vault/specs/authenticated-database-trust-boundary-evidence-${Date.now()}.json`;
fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`TRUST_BOUNDARY_EVIDENCE=${output}`);
