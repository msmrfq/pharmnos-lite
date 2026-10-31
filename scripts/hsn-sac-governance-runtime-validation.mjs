#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import { validateGovernanceRuntimeTarget } from "./financial-e2e-safety.mjs";

const { Client } = pg;
const run = `gov_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const database = `pharmnos_financial_e2e_${run}`;
const runtimeRole = `pharmnos_gov_${run}`;
const runtimePassword = crypto.randomBytes(24).toString("hex");
const evidencePath = process.env.GOVERNANCE_EVIDENCE_PATH ??
  `.obsidian-vault/specs/hsn-sac-governance-runtime-evidence-${run}.json`;
const ids = {
  tenantA: `${run}_tenant_a`,
  tenantB: `${run}_tenant_b`,
  userA: `${run}_user_a`,
  userB: `${run}_user_b`,
  roleA: `${run}_role_a`,
  roleB: `${run}_role_b`,
  membershipA: `${run}_membership_a`,
  membershipB: `${run}_membership_b`,
  catalogA: `${run}_catalog_a`,
  catalogB: `${run}_catalog_b`,
  historyA: `${run}_history_a`,
  historyB: `${run}_history_b`,
};

function isLoopbackServerAddress(address) {
  const normalized = String(address ?? "").trim().toLowerCase().split("/")[0];
  return normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "::ffff:127.0.0.1";
}

function isDockerPrivateServerAddress(address) {
  const normalized = String(address ?? "").trim().split("/")[0];
  const octets = normalized.split(".").map(Number);
  return octets.length === 4 &&
    octets[0] === 172 &&
    octets[1] >= 16 &&
    octets[1] <= 31 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

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

function databaseUrl(raw, name, applicationName) {
  const url = new URL(raw);
  url.pathname = `/${name}`;
  url.searchParams.set("application_name", applicationName);
  return url.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function main() {
  loadEnv();
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) throw new Error("TEST_DATABASE_URL is required.");
  const targetSafety = validateGovernanceRuntimeTarget({
    baseUrl,
    ordinaryUrl: process.env.DATABASE_URL,
    databaseName: database,
    runId: run,
  });
  if (!targetSafety.ok) {
    throw new Error(`Governance runtime target rejected: ${targetSafety.errors.join(" ")}`);
  }
  const adminUrl = databaseUrl(baseUrl, "postgres", "pharmnos-gst-governance-bootstrap");
  const targetUrl = databaseUrl(baseUrl, database, "pharmnos-gst-governance-validation");
  const runtimeUrl = new URL(targetUrl);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = runtimePassword;

  const results = [];
  let bootstrap;
  let admin;
  let targetCreated = false;
  let roleCreated = false;
  let evidence;
  const cleanup = {
    database: { attempted: false, command: null, succeeded: false, verifiedAbsent: false, error: null },
    role: { attempted: false, command: null, succeeded: false, verifiedAbsent: false, error: null },
  };

  async function test(name, fn) {
    const startedAt = new Date().toISOString();
    try {
      const details = await fn();
      results.push({ id: name, status: "PASS", startedAt, details });
    } catch (error) {
      results.push({
        id: name,
        status: "FAIL",
        startedAt,
        sqlState: error?.code ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function expectRejected(fn, expectedCodes = []) {
    try {
      await fn();
    } catch (error) {
      if (expectedCodes.length === 0 || expectedCodes.includes(error?.code)) {
        return { sqlState: error?.code ?? null };
      }
      throw error;
    }
    throw new Error("Expected the operation to be rejected.");
  }

  try {
    admin = await connect(adminUrl);
    const adminIdentity = (await admin.query(`
      SELECT current_database() AS database_name,
             inet_server_addr()::text AS server_address,
             inet_server_port() AS server_port
    `)).rows[0];
    if (adminIdentity.database_name !== "postgres" ||
        (!isLoopbackServerAddress(adminIdentity.server_address) &&
          !isDockerPrivateServerAddress(adminIdentity.server_address)) ||
        net.isIP(String(adminIdentity.server_address ?? "").split("/")[0]) === 0 ||
        !Number.isInteger(adminIdentity.server_port)) {
      throw new Error("Administrative connection is not demonstrably local and disposable.");
    }
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (existing.rowCount) throw new Error(`Unique validation database already exists: ${database}`);
    await admin.query(`CREATE DATABASE "${database}"`);
    targetCreated = true;

    bootstrap = await connect(targetUrl);
    const version = (await bootstrap.query("SELECT version()")).rows[0].version;
    const baseline = fs.readFileSync("prisma/financial-e2e-schema-provisioning.generated.sql", "utf8");
    await bootstrap.query(baseline);
    await bootstrap.query(`CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${runtimePassword}'`);
    roleCreated = true;
    await bootstrap.query(`
      GRANT USAGE ON SCHEMA public TO "${runtimeRole}";
      GRANT SELECT ON "hsn_sac_catalog", "gst_rate_rules" TO "${runtimeRole}";
      GRANT SELECT, INSERT ON "hsn_sac_catalog_history", "gst_rate_rule_history" TO "${runtimeRole}";
      ALTER TABLE "hsn_sac_catalog" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "hsn_sac_catalog" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "hsn_sac_catalog_history" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "hsn_sac_catalog_history" FORCE ROW LEVEL SECURITY;
      ALTER TABLE "gst_rate_rules" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "gst_rate_rules" FORCE ROW LEVEL SECURITY;
      CREATE POLICY "${runtimeRole}_catalog_select" ON "hsn_sac_catalog"
        FOR SELECT TO "${runtimeRole}"
        USING ("tenant_id" = NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''));
      CREATE POLICY "${runtimeRole}_catalog_history_select" ON "hsn_sac_catalog_history"
        FOR SELECT TO "${runtimeRole}"
        USING ("tenant_id" = NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''));
      CREATE POLICY "${runtimeRole}_catalog_history_insert" ON "hsn_sac_catalog_history"
        FOR INSERT TO "${runtimeRole}"
        WITH CHECK ("tenant_id" = NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''));
      CREATE POLICY "${runtimeRole}_rate_select" ON "gst_rate_rules"
        FOR SELECT TO "${runtimeRole}"
        USING ("tenant_id" = NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''));
    `);

    const now = new Date();
    await bootstrap.query(
      "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, $4)",
      [ids.tenantA, `${run}_a`, `${run} A`, now],
    );
    await bootstrap.query(
      "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1, $2, $3, $4)",
      [ids.tenantB, `${run}_b`, `${run} B`, now],
    );
    await bootstrap.query(
      "INSERT INTO users (id, email, updated_at) VALUES ($1, $2, $3)",
      [ids.userA, `${run}-a@example.invalid`, now],
    );
    await bootstrap.query(
      "INSERT INTO users (id, email, updated_at) VALUES ($1, $2, $3)",
      [ids.userB, `${run}-b@example.invalid`, now],
    );
    await bootstrap.query(
      "INSERT INTO roles (id, tenant_id, name, is_default, updated_at) VALUES ($1, $2, 'ADMIN', true, $3)",
      [ids.roleA, ids.tenantA, now],
    );
    await bootstrap.query(
      "INSERT INTO roles (id, tenant_id, name, is_default, updated_at) VALUES ($1, $2, 'ADMIN', true, $3)",
      [ids.roleB, ids.tenantB, now],
    );
    await bootstrap.query(
      "INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at) VALUES ($1, $2, $3, $4, $5)",
      [ids.membershipA, ids.tenantA, ids.userA, ids.roleA, now],
    );
    await bootstrap.query(
      "INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at) VALUES ($1, $2, $3, $4, $5)",
      [ids.membershipB, ids.tenantB, ids.userB, ids.roleB, now],
    );
    await bootstrap.query(
      `INSERT INTO hsn_sac_catalog
        (id, tenant_id, code, classification_type, classification_status, is_active, created_at, updated_at)
       VALUES ($1, $2, 'TEST-A', 'GOODS', 'PENDING', false, $3, $3)`,
      [ids.catalogA, ids.tenantA, now],
    );
    await bootstrap.query(
      `INSERT INTO hsn_sac_catalog
        (id, tenant_id, code, classification_type, classification_status, is_active, created_at, updated_at)
       VALUES ($1, $2, 'TEST-B', 'GOODS', 'PENDING', false, $3, $3)`,
      [ids.catalogB, ids.tenantB, now],
    );
    await bootstrap.query(
      `INSERT INTO hsn_sac_catalog_history
        (id, tenant_id, catalog_id, action, snapshot, actor_membership_id)
       VALUES ($1, $2, $3, 'TEST', '{"tenant":"A"}', $4)`,
      [ids.historyA, ids.tenantA, ids.catalogA, ids.membershipA],
    );
    await bootstrap.query(
      `INSERT INTO hsn_sac_catalog_history
        (id, tenant_id, catalog_id, action, snapshot, actor_membership_id)
       VALUES ($1, $2, $3, 'TEST', '{"tenant":"B"}', $4)`,
      [ids.historyB, ids.tenantB, ids.catalogB, ids.membershipB],
    );

    await test("history_update_privilege_rejected", async () => {
      const runtime = await connect(runtimeUrl.toString());
      try {
        await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
        return await expectRejected(() =>
          runtime.query("UPDATE hsn_sac_catalog_history SET action = 'MUTATED' WHERE id = $1", [ids.historyA]),
        );
      } finally {
        await runtime.end();
      }
    });

    await test("history_delete_privilege_rejected", async () => {
      const runtime = await connect(runtimeUrl.toString());
      try {
        await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
        return await expectRejected(() =>
          runtime.query("DELETE FROM hsn_sac_catalog_history WHERE id = $1", [ids.historyA]),
        );
      } finally {
        await runtime.end();
      }
    });

    await test("history_update_trigger_rejected", async () => {
      return await expectRejected(() =>
        bootstrap.query("UPDATE hsn_sac_catalog_history SET action = 'TRIGGER_MUTATED' WHERE id = $1", [ids.historyA]),
      );
    });

    await test("history_delete_trigger_rejected", async () => {
      return await expectRejected(() =>
        bootstrap.query("DELETE FROM hsn_sac_catalog_history WHERE id = $1", [ids.historyA]),
      );
    });

    await test("cross_tenant_history_isolation", async () => {
      const runtime = await connect(runtimeUrl.toString());
      try {
        await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
        const rows = await runtime.query("SELECT id FROM hsn_sac_catalog_history ORDER BY id");
        if (rows.rowCount !== 1 || rows.rows[0].id !== ids.historyA) {
          throw new Error(`Expected only tenant A history row, received ${rows.rowCount}.`);
        }
      } finally {
        await runtime.end();
      }
    });

    await test("runtime_history_privilege_boundary", async () => {
      const row = (await bootstrap.query(`
        SELECT has_table_privilege($1, 'hsn_sac_catalog_history', 'SELECT') AS can_select,
               has_table_privilege($1, 'hsn_sac_catalog_history', 'INSERT') AS can_insert,
               has_table_privilege($1, 'hsn_sac_catalog_history', 'UPDATE') AS can_update,
               has_table_privilege($1, 'hsn_sac_catalog_history', 'DELETE') AS can_delete
      `, [runtimeRole])).rows[0];
      if (!row.can_select || !row.can_insert || row.can_update || row.can_delete) {
        throw new Error(`Unexpected runtime history privileges: ${JSON.stringify(row)}`);
      }
      return row;
    });

    await test("negative_rate_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          INSERT INTO gst_rate_rules
            (id, tenant_id, rule_version, tax_rate, component_policy, effective_from, updated_at)
          VALUES ($1, $2, 'NEGATIVE', -1, 'IGST', NOW(), NOW())
        `, [`${run}_negative`, ids.tenantA]), ["23514"]);
    });

    await test("non_finite_rate_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          INSERT INTO gst_rate_rules
            (id, tenant_id, rule_version, tax_rate, component_policy, effective_from, updated_at)
          VALUES ($1, $2, 'NONFINITE', 'Infinity', 'IGST', NOW(), NOW())
        `, [`${run}_nonfinite`, ids.tenantA]), ["22P02", "22003"]);
    });

    await test("effective_date_range_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          INSERT INTO gst_rate_rules
            (id, tenant_id, rule_version, tax_rate, component_policy, effective_from, effective_to, updated_at)
          VALUES ($1, $2, 'BAD-DATES', 5, 'IGST', '2026-02-01', '2026-01-01', NOW())
        `, [`${run}_bad_dates`, ids.tenantA]), ["23514"]);
    });

    await test("invalid_governance_state_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          INSERT INTO gst_rate_rules
            (id, tenant_id, rule_version, tax_rate, component_policy, approval_status, is_active, effective_from, updated_at)
          VALUES ($1, $2, 'BAD-STATE', 5, 'IGST', 'APPROVED', true, NOW(), NOW())
        `, [`${run}_bad_state`, ids.tenantA]), ["23514"]);
    });

    async function createRule(id, tenantId, version, from, to = null) {
      await bootstrap.query(`
        INSERT INTO gst_rate_rules
          (id, tenant_id, hsn_sac_catalog_id, rule_version, tax_rate, component_policy,
           approval_status, is_active, effective_from, effective_to, updated_at)
        VALUES ($1, $2, $3, $4, 5, 'IGST', 'PENDING', false, $5, $6, NOW())
      `, [id, tenantId, ids.catalogA, version, from, to]);
    }

    async function concurrentApproval(firstId, secondId) {
      const clients = await Promise.all([connect(targetUrl), connect(targetUrl)]);
      const outcomes = await Promise.all(clients.map(async (client, index) => {
        try {
          await client.query("BEGIN");
          await client.query(`
            UPDATE gst_rate_rules
            SET approval_status = 'APPROVED', is_active = true,
                approved_by_membership_id = $2, approved_at = NOW()
            WHERE id = $1
          `, [index === 0 ? firstId : secondId, ids.membershipA]);
          await client.query("COMMIT");
          return "COMMITTED";
        } catch (error) {
          await client.query("ROLLBACK");
          return `REJECTED:${error.code ?? "unknown"}`;
        } finally {
          await client.end();
        }
      }));
      return outcomes;
    }

    await createRule(`${run}_overlap_a`, ids.tenantA, "OVERLAP-A", "2026-03-01", "2026-06-01");
    await createRule(`${run}_overlap_b`, ids.tenantA, "OVERLAP-B", "2026-04-01", "2026-07-01");
    await test("concurrent_overlapping_approval", async () => {
      const outcomes = await concurrentApproval(`${run}_overlap_a`, `${run}_overlap_b`);
      const approved = (await bootstrap.query(`
        SELECT COUNT(*)::int AS count
        FROM gst_rate_rules
        WHERE id IN ($1, $2) AND approval_status = 'APPROVED' AND is_active = true
      `, [`${run}_overlap_a`, `${run}_overlap_b`])).rows[0].count;
      if (outcomes.filter((value) => value === "COMMITTED").length !== 1 ||
          outcomes.filter((value) => value === "REJECTED:23P01" || value === "REJECTED:40P01").length !== 1 ||
          approved !== 1) {
        throw new Error(`Unexpected overlap outcomes: ${outcomes.join(",")}`);
      }
      return { outcomes, approved };
    });

    await createRule(`${run}_nonoverlap_a`, ids.tenantA, "NONOVERLAP-A", "2027-01-01", "2027-03-01");
    await createRule(`${run}_nonoverlap_b`, ids.tenantA, "NONOVERLAP-B", "2027-03-01", "2027-06-01");
    await test("concurrent_non_overlapping_approval", async () => {
      const outcomes = await concurrentApproval(`${run}_nonoverlap_a`, `${run}_nonoverlap_b`);
      if (outcomes.filter((value) => value === "COMMITTED").length !== 2) {
        throw new Error(`Unexpected non-overlap outcomes: ${outcomes.join(",")}`);
      }
      return { outcomes };
    });

    await test("cross_tenant_approver_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          INSERT INTO gst_rate_rules
            (id, tenant_id, rule_version, tax_rate, component_policy, effective_from,
               approval_status, is_active, approved_by_membership_id, approved_at, updated_at)
          VALUES ($1, $2, 'CROSS-TENANT-ACTOR', 5, 'IGST', NOW(), 'APPROVED', true, $3, NOW(), NOW())
        `, [`${run}_cross_actor`, ids.tenantA, ids.membershipB]), ["23503"]);
    });

    await test("missing_approver_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          INSERT INTO gst_rate_rules
            (id, tenant_id, rule_version, tax_rate, component_policy, effective_from,
               approval_status, is_active, approved_by_membership_id, approved_at, updated_at)
          VALUES ($1, $2, 'MISSING-ACTOR', 5, 'IGST', NOW(), 'APPROVED', true, $3, NOW(), NOW())
        `, [`${run}_missing_actor`, ids.tenantA, `${run}_missing_membership`]), ["23503"]);
    });

    await test("approved_rule_mutation_rejected", async () => {
      return await expectRejected(() => bootstrap.query(`
          UPDATE gst_rate_rules SET tax_rate = 6 WHERE id = $1
        `, [`${run}_nonoverlap_a`]), ["42501"]);
    });

    await test("revision_preserves_approved_original", async () => {
      const original = `${run}_nonoverlap_a`;
      const successor = `${run}_revision`;
      await bootstrap.query(`
        INSERT INTO gst_rate_rules
          (id, tenant_id, hsn_sac_catalog_id, rule_version, tax_rate, component_policy,
           approval_status, is_active, effective_from, effective_to, updated_at)
        SELECT $1, tenant_id, hsn_sac_catalog_id, 'REVISION-PENDING', tax_rate + 1,
               component_policy, 'PENDING', false, effective_from, effective_to, NOW()
        FROM gst_rate_rules WHERE id = $2
      `, [successor, original]);
      const rows = (await bootstrap.query(`
        SELECT
          (SELECT approval_status::text FROM gst_rate_rules WHERE id = $1) AS original_status,
          (SELECT is_active FROM gst_rate_rules WHERE id = $1) AS original_active,
          (SELECT approval_status::text FROM gst_rate_rules WHERE id = $2) AS successor_status,
          (SELECT is_active FROM gst_rate_rules WHERE id = $2) AS successor_active
      `, [original, successor])).rows[0];
      if (rows.original_status !== "APPROVED" || !rows.original_active ||
          rows.successor_status !== "PENDING" || rows.successor_active) {
        throw new Error(`Unexpected revision state: ${JSON.stringify(rows)}`);
      }
      return rows;
    });

    await test("catalog_history_captures_final_state", async () => {
      const historyId = `${run}_final_state_history`;
      await bootstrap.query("BEGIN");
      await bootstrap.query(`
        UPDATE hsn_sac_catalog
        SET classification_type = 'SERVICES', classification_status = 'PENDING',
            is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [ids.catalogA]);
      const row = (await bootstrap.query("SELECT * FROM hsn_sac_catalog WHERE id = $1", [ids.catalogA])).rows[0];
      await bootstrap.query(`
        INSERT INTO hsn_sac_catalog_history
          (id, tenant_id, catalog_id, action, snapshot, actor_membership_id)
        VALUES ($1, $2, $3, 'UPDATED_PENDING', $4::jsonb, $5)
      `, [historyId, ids.tenantA, ids.catalogA, JSON.stringify(row), ids.membershipA]);
      await bootstrap.query("COMMIT");
      const snapshot = (await bootstrap.query(
        "SELECT snapshot->>'classification_type' AS classification_type FROM hsn_sac_catalog_history WHERE id = $1",
        [historyId],
      )).rows[0];
      if (snapshot.classification_type !== "SERVICES") throw new Error("History snapshot was stale.");
      return snapshot;
    });

    const counts = {};
    for (const table of ["tenants", "users", "roles", "memberships", "hsn_sac_catalog", "hsn_sac_catalog_history", "gst_rate_rules", "gst_rate_rule_history"]) {
      counts[table] = Number((await bootstrap.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)).rows[0].count);
    }
    evidence = {
      evidenceVersion: 1,
      run,
      database,
      runtimeRole,
      engineVersion: version,
      harnessCommand: "node scripts/hsn-sac-governance-runtime-validation.mjs",
      target: "new local disposable PostgreSQL database only",
      forbiddenTargets: ["production", "Supabase", "SEC-DEC-03 databases", "prior disposable databases"],
      sourceHashes: {
        migration0008: sha256File("prisma/migrations/0008_hsn_governance_integrity/migration.sql"),
        generatedBaseline: sha256File("prisma/financial-e2e-schema-provisioning.generated.sql"),
        runtimeHarness: sha256File("scripts/hsn-sac-governance-runtime-validation.mjs"),
      },
      results,
      fixtureCountsBeforeCleanup: counts,
      validationCoverage: {
        directDatabaseControlTests: results.map(({ id }) => id),
        applicationPathTests: [],
        staticOnlyChecks: ["manifest-hash-verification", "governance-contract-tests"],
        notExecuted: ["updateHsnSacCatalogRecord", "approveGstRateRule", "createGstRateRuleRevision"],
      },
      cleanup,
    };
  } finally {
    if (bootstrap) await bootstrap.end().catch(() => {});
    if (admin) {
      if (targetCreated) {
        cleanup.database.attempted = true;
        cleanup.database.command = "DROP DATABASE ... WITH (FORCE)";
        try {
          await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
          cleanup.database.succeeded = true;
          cleanup.database.verifiedAbsent =
            (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])).rowCount === 0;
        } catch (error) {
          cleanup.database.error = error instanceof Error ? error.message : String(error);
        }
      }
      if (roleCreated) {
        cleanup.role.attempted = true;
        cleanup.role.command = "DROP ROLE ...";
        try {
          await admin.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
          cleanup.role.succeeded = true;
          cleanup.role.verifiedAbsent =
            (await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [runtimeRole])).rowCount === 0;
        } catch (error) {
          cleanup.role.error = error instanceof Error ? error.message : String(error);
        }
      }
      await admin.end().catch(() => {});
    }
  }

  if (!evidence) throw new Error("Runtime evidence was not produced.");
  evidence.cleanup = cleanup;
  evidence.cleanupVerified =
    cleanup.database.succeeded &&
    cleanup.database.verifiedAbsent &&
    cleanup.role.succeeded &&
    cleanup.role.verifiedAbsent;
  evidence.fixtureCountsAfterCleanup = null;
  evidence.fixtureCountsAfterCleanupStatus = evidence.cleanupVerified
    ? "DATABASE_ABSENT_VERIFIED"
    : "NOT_VERIFIED";
  evidence.noForbiddenTargetAccess = true;
  const finalEvidence = evidence;
  finalEvidence.results.push({
    id: "cleanup_verification",
    status: finalEvidence.cleanupVerified ? "PASS" : "FAIL",
    details: finalEvidence.cleanup,
  });
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, `${JSON.stringify(finalEvidence, null, 2)}\n`, "utf8");
  const failures = finalEvidence.results.filter((result) => result.status !== "PASS");
  console.log(`GOVERNANCE_RUNTIME_EVIDENCE=${evidencePath}`);
  console.log(`GOVERNANCE_RUNTIME_DATABASE=${database}`);
  console.log(`GOVERNANCE_RUNTIME_RESULTS=${finalEvidence.results.length}`);
  console.log(`GOVERNANCE_RUNTIME_FAILURES=${failures.length}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
