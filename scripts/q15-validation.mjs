#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import pg from "pg";

const { Client } = pg;
const run = `q15-${Date.now()}`;
const expectedMigrationCount = fs.readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d+_/.test(entry.name))
  .length;

function loadEnv() {
  for (const file of [".env.local", ".env.financial-e2e"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function connectionUrl(raw, database) {
  const url = new URL(raw);
  url.pathname = `/${database}`;
  url.searchParams.set("application_name", "pharmnos-financial-e2e-q15");
  return url.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function createDatabase(client, database) {
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (exists.rowCount) throw new Error(`Q15 target database already exists: ${database}`);
  await client.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
}

function runMigration(databaseUrl) {
  const command = process.platform === "win32" ? process.env.ComSpec : "pnpm";
  const args = process.platform === "win32"
    ? ["/d", "/c", "pnpm exec prisma migrate deploy"]
    : ["exec", "prisma", "migrate", "deploy"];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]"),
  };
}

function resolveRolledBack(databaseUrl) {
  const command = process.platform === "win32" ? process.env.ComSpec : "pnpm";
  const args = process.platform === "win32"
    ? ["/d", "/c", "pnpm exec prisma migrate resolve --rolled-back 0001_baseline"]
    : ["exec", "prisma", "migrate", "resolve", "--rolled-back", "0001_baseline"];
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]"),
  };
}

function dockerExec(container, args, input) {
  const envArgs = args[0] === "-e" ? args.splice(0, 2) : [];
  return execFileSync("docker", ["exec", ...envArgs, ...(input ? ["-i"] : []), container, ...args], {
    input,
    encoding: input ? undefined : "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function dumpDatabase(container, database, password) {
  return dockerExec(container, [
    "-e", `PGPASSWORD=${password}`,
    "pg_dump", "--format=plain", "--no-owner",
    "-U", "pharmnos_e2e", "-d", database,
  ]);
}

function restoreDatabase(container, database, password, dump) {
  const output = dockerExec(container, [
    "-e", `PGPASSWORD=${password}`,
    "psql", "-v", "ON_ERROR_STOP=1", "-U", "pharmnos_e2e", "-d", database,
  ], Buffer.from(dump));
  return String(output);
}

async function compareRestoredDatabase(source, restored) {
  async function snapshot(client) {
    const tables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `);
    const data = [];
    for (const { tablename } of tables.rows) {
      const identifier = `"${tablename.replaceAll('"', '""')}"`;
      const result = await client.query(`
        SELECT count(*)::int AS rows,
               COALESCE(md5(COALESCE(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), '')), md5('')) AS checksum
        FROM ${identifier} t
      `);
      data.push({ table: tablename, ...result.rows[0] });
    }
    const catalog = await client.query(`
      SELECT jsonb_build_object(
        'tables', (SELECT jsonb_agg(jsonb_build_object('name', tablename, 'rls', rowsecurity, 'forceRls', relforcerowsecurity) ORDER BY tablename)
                   FROM pg_tables p JOIN pg_class c ON c.relname = p.tablename AND c.relnamespace = p.schemaname::regnamespace
                   WHERE p.schemaname = 'public'),
        'constraints', (SELECT jsonb_agg(jsonb_build_object('name', conname, 'type', contype, 'definition', pg_get_constraintdef(oid)) ORDER BY conname)
                        FROM pg_constraint WHERE connamespace = 'public'::regnamespace),
        'indexes', (SELECT jsonb_agg(jsonb_build_object('name', indexname, 'definition', indexdef) ORDER BY indexname)
                    FROM pg_indexes WHERE schemaname = 'public'),
        'policies', (SELECT jsonb_agg(jsonb_build_object('name', policyname, 'table', tablename, 'cmd', cmd, 'roles', roles, 'qual', qual, 'withCheck', with_check) ORDER BY tablename, policyname)
                     FROM pg_policies WHERE schemaname = 'public'),
        'triggers', (SELECT jsonb_agg(jsonb_build_object('name', tgname, 'table', relname, 'definition', pg_get_triggerdef(t.oid)) ORDER BY relname, tgname)
                     FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                     WHERE c.relnamespace = 'public'::regnamespace AND NOT tgisinternal),
        'grants', (SELECT jsonb_agg(jsonb_build_object('grantee', grantee, 'table', table_name, 'privilege', privilege_type) ORDER BY grantee, table_name, privilege_type)
                   FROM information_schema.role_table_grants WHERE table_schema = 'public')
      ) AS catalog
    `);
    const roles = await client.query(`
      SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
      FROM pg_roles WHERE rolname LIKE 'pharmnos_e2e%' ORDER BY rolname
    `);
    return { data, catalog: catalog.rows[0].catalog, roles: roles.rows };
  }
  const [sourceSnapshot, restoredSnapshot] = await Promise.all([
    snapshot(source),
    snapshot(restored),
  ]);
  if (JSON.stringify(sourceSnapshot) !== JSON.stringify(restoredSnapshot)) {
    throw new Error("Restored schema/security/data snapshot differs from source.");
  }
  return sourceSnapshot;
}

async function main() {
  loadEnv();
  const baseUrl = process.env.TEST_DATABASE_URL;
  const bootstrapUrl = connectionUrl(
    connectionUrl(baseUrl, "postgres"),
    "postgres",
  );
  const admin = await connect(bootstrapUrl);
  const migrationDb = `${process.env.TEST_DATABASE_NAME}_migration_${Date.now()}`;
  const conflictDb = `${process.env.TEST_DATABASE_NAME}_conflict_${Date.now()}`;
  const restoreDb = `${process.env.TEST_DATABASE_NAME}_restore_${Date.now()}`;
  const repeatRestoreDb = `${process.env.TEST_DATABASE_NAME}_restore_repeat_${Date.now()}`;
  const container = process.env.FINANCIAL_E2E_CONTAINER ?? "pharmnoslite-financial-e2e-postgres-1";
  const evidenceDir = process.env.Q15_EVIDENCE_DIR ?? process.cwd();
  fs.mkdirSync(evidenceDir, { recursive: true });
  const rawOutput = [];
  try {
    await createDatabase(admin, migrationDb);
    const migrationUrl = connectionUrl(baseUrl, migrationDb);
    const first = runMigration(migrationUrl);
    rawOutput.push(`=== fresh migration (${migrationDb}) ===\n${first.output}`);
    if (first.status !== 0) throw new Error(`Fresh migration failed: ${first.output.slice(-1000)}`);
    const second = runMigration(migrationUrl);
    rawOutput.push(`=== repeated migration (${migrationDb}) ===\n${second.output}`);
    if (second.status !== 0) throw new Error(`Repeated migration failed: ${second.output.slice(-1000)}`);
    const migrated = await connect(migrationUrl);
    const objects = await migrated.query(`
      SELECT
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::int AS tables,
        (SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace)::int AS constraints,
        (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)::int AS applied
    `);
    if (
      objects.rows[0].tables < 28 ||
      objects.rows[0].constraints < 90 ||
      objects.rows[0].applied !== expectedMigrationCount
    ) {
      throw new Error(`Fresh migration catalog mismatch: ${JSON.stringify(objects.rows[0])}`);
    }
    await migrated.end();

    await createDatabase(admin, conflictDb);
    const conflictUrl = connectionUrl(baseUrl, conflictDb);
    const conflictClient = await connect(conflictUrl);
    await conflictClient.query(`CREATE TYPE "SystemRole" AS ENUM ('CONFLICT')`);
    await conflictClient.end();
    const conflict = runMigration(conflictUrl);
    rawOutput.push(`=== conflicting migration (${conflictDb}) ===\n${conflict.output}`);
    if (conflict.status === 0) throw new Error("Conflicting catalog object did not stop migration.");
    const conflictCheck = await connect(conflictUrl);
    const state = await conflictCheck.query(`
      SELECT
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::int AS tables,
        (SELECT count(*) FROM _prisma_migrations)::int AS ledger_rows,
        (SELECT count(*) FROM _prisma_migrations
         WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished
    `).catch(() => ({ rows: [{ tables: 0, ledger_rows: 0 }] }));
    await conflictCheck.end();
    if (state.rows[0].tables !== 1 || state.rows[0].ledger_rows !== 1 || state.rows[0].unfinished !== 1) {
      throw new Error(`Conflict recovery left partial schema: ${JSON.stringify(state.rows[0])}`);
    }
    const recoveryClient = await connect(conflictUrl);
    await recoveryClient.query('DROP TYPE "SystemRole"');
    await recoveryClient.end();
    const resolved = resolveRolledBack(conflictUrl);
    rawOutput.push(`=== resolved failed migration (${conflictDb}) ===\n${resolved.output}`);
    if (resolved.status !== 0) throw new Error(`Failed migration could not be marked rolled back: ${resolved.output.slice(-1000)}`);
    const recovery = runMigration(conflictUrl);
    rawOutput.push(`=== recovered migration (${conflictDb}) ===\n${recovery.output}`);
    if (recovery.status !== 0) throw new Error(`Conflict recovery retry failed: ${recovery.output.slice(-1000)}`);
    const recoveredClient = await connect(conflictUrl);
    const recoveredState = await recoveredClient.query(`
      SELECT
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::int AS tables,
        (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)::int AS applied,
        (SELECT count(*) FROM _prisma_migrations
         WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished
    `);
    await recoveredClient.end();
    if (
      recoveredState.rows[0].tables < 28 ||
      recoveredState.rows[0].applied !== expectedMigrationCount ||
      recoveredState.rows[0].unfinished !== 0
    ) {
      throw new Error(`Conflict recovery produced inconsistent state: ${JSON.stringify(recoveredState.rows[0])}`);
    }
    await createDatabase(admin, restoreDb);
    await createDatabase(admin, repeatRestoreDb);
    const backup = dumpDatabase(
      container,
      process.env.TEST_DATABASE_NAME,
      process.env.FINANCIAL_E2E_DB_PASSWORD,
    );
    const backupPath = `${evidenceDir}\\${run}-backup.sql`;
    fs.writeFileSync(backupPath, backup);
    const checksum = execFileSync("certutil", ["-hashfile", backupPath, "SHA256"], { encoding: "utf8" });
    rawOutput.push(`=== backup (${process.env.TEST_DATABASE_NAME}) ===\ncommand: pg_dump --format=plain --no-owner\nchecksum:\n${checksum}`);
    const restoreOutput = restoreDatabase(container, restoreDb, process.env.FINANCIAL_E2E_DB_PASSWORD, backup);
    rawOutput.push(`=== restore (${restoreDb}) ===\n${restoreOutput}`);
    const repeatedRestoreOutput = restoreDatabase(container, repeatRestoreDb, process.env.FINANCIAL_E2E_DB_PASSWORD, backup);
    rawOutput.push(`=== repeated restore (${repeatRestoreDb}) ===\n${repeatedRestoreOutput}`);
    const restored = await connect(connectionUrl(baseUrl, restoreDb));
    const repeated = await connect(connectionUrl(baseUrl, repeatRestoreDb));
    const source = await connect(connectionUrl(baseUrl, process.env.TEST_DATABASE_NAME));
    try {
      const snapshot = await compareRestoredDatabase(source, restored);
      const repeatedSnapshot = await compareRestoredDatabase(source, repeated);
      const protection = await restored.query(`
        SELECT
          (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sales_invoices'::regclass) AS rls,
          (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.sales_invoices'::regclass) AS force_rls,
          (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')::int AS policies
      `);
      if (!protection.rows[0].rls || !protection.rows[0].force_rls || protection.rows[0].policies < 1) {
        throw new Error(`Restored security protections are incomplete: ${JSON.stringify(protection.rows[0])}`);
      }
      fs.writeFileSync(`${evidenceDir}\\${run}-restore-comparison.json`, JSON.stringify({
        checksum: checksum.trim(),
        sourceDatabase: process.env.TEST_DATABASE_NAME,
        restoreDatabase: restoreDb,
        repeatedRestoreDatabase: repeatRestoreDb,
        snapshot,
        repeatedSnapshot,
        restoredSecurity: protection.rows[0],
      }, null, 2));
      fs.writeFileSync(`${evidenceDir}\\${run}-raw-output.txt`, rawOutput.join("\n\n"));
    } finally {
      await Promise.all([source.end(), restored.end(), repeated.end()]);
    }
    console.log(JSON.stringify({
      run,
      status: "PASS",
      freshMigration: "PASS",
      repeatedMigration: "PASS",
      conflictStop: "PASS",
      partialFailureRecovery: "PASS — SCOPED",
      migrationDatabase: migrationDb,
      conflictDatabase: conflictDb,
      restoreDatabase: restoreDb,
      repeatedRestoreDatabase: repeatRestoreDb,
      backupEvidence: `${run}-backup.sql`,
      restoreEvidence: `${run}-restore-comparison.json`,
    }, null, 2));
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  console.error(`Q15=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
