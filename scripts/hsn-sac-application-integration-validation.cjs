#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const Module = require("node:module");
const path = require("node:path");
const { Client } = require("pg");

for (const line of fs.readFileSync(".env.financial-e2e", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}

if (process.env.ALLOW_FINANCIAL_E2E !== "true" ||
    process.env.TEST_DATABASE_NAME !== "pharmnos_financial_e2e" ||
    process.env.TEST_DATABASE_MARKER !== "pharmnos-financial-e2e") {
  throw new Error("The approved disposable application target is not enabled.");
}

const target = new URL(process.env.TEST_DATABASE_URL);
if (target.hostname !== "127.0.0.1" || target.port !== "55432" ||
    target.pathname !== "/pharmnos_financial_e2e") {
  throw new Error("Application validation requires the approved loopback disposable database.");
}

process.env.FINANCIAL_E2E_TEST_MODE = "true";
process.env.ALLOW_FINANCIAL_E2E = "true";
process.env.NODE_ENV = "test";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  jsx: "preserve",
});

const root = process.cwd();
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(root, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
Module._load = function (request, parent, isMain) {
  if (request === "next/cache" || request === "next/cache.js") return { revalidatePath() {} };
  if (request === "next/headers" || request === "next/headers.js") {
    return { cookies: () => ({ get: () => undefined, set() {}, delete() {} }) };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require("ts-node/register/transpile-only");

const run = `hsn_app_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const appDatabase = `${process.env.TEST_DATABASE_NAME}_${run}`;
const appDatabaseUrl = new URL(process.env.TEST_DATABASE_URL);
appDatabaseUrl.pathname = `/${appDatabase}`;
appDatabaseUrl.searchParams.set("application_name", "pharmnos-hsn-application");
const guardDatabaseUrl = process.env.TEST_DATABASE_URL;
const ids = {
  tenantA: `${run}_tenant_a`,
  tenantB: `${run}_tenant_b`,
  userA: `${run}_user_a`,
  userB: `${run}_user_b`,
  roleManage: `${run}_role_manage`,
  roleApprove: `${run}_role_approve`,
  roleNone: `${run}_role_none`,
  membershipA: `${run}_membership_a`,
  membershipB: `${run}_membership_b`,
  membershipNone: `${run}_membership_none`,
  catalogPending: `${run}_catalog_pending`,
  catalogOtherTenant: `${run}_catalog_other`,
  catalogApproved: `${run}_catalog_approved`,
  rulePending: `${run}_rule_pending`,
  ruleBlocked: `${run}_rule_blocked`,
  ruleConcurrent: `${run}_rule_concurrent`,
  ruleApproved: `${run}_rule_approved`,
};

const sourceFiles = [
  "src/app/_actions/gst-catalog.actions.ts",
  "src/lib/db/tenant-context.ts",
  "src/lib/db/prisma.ts",
  "src/adapters/auth/supabase-auth.adapter.ts",
];
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const evidence = {
  evidenceVersion: 1,
  run,
  target: "approved local disposable PostgreSQL database only",
  applicationConnection: "verified disposable bootstrap connection; no Supabase or production",
  sourceHashes: Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)])),
  tests: [],
  cleanup: {},
};
let installFinancialE2eTestSession;
let clearFinancialE2eTestSession;
let updateHsnSacCatalogRecord;
let approveGstRateRule;
let createGstRateRuleRevision;
let prisma;

async function connect(connectionString = appDatabaseUrl.toString()) {
  const client = new Client({ connectionString });
  client.on("error", () => {});
  await client.connect();
  return client;
}

async function snapshot(db) {
  const rows = await db.query(`
    SELECT
      (SELECT classification_status::text FROM hsn_sac_catalog WHERE id = $1) AS catalog_status,
      (SELECT is_active FROM hsn_sac_catalog WHERE id = $1) AS catalog_active,
      (SELECT approval_status::text FROM gst_rate_rules WHERE id = $2) AS rule_status,
      (SELECT is_active FROM gst_rate_rules WHERE id = $2) AS rule_active,
      (SELECT tax_rate::text FROM gst_rate_rules WHERE id = $3) AS approved_tax_rate,
      (SELECT approval_status::text FROM gst_rate_rules WHERE id = $3) AS approved_status,
      (SELECT count(*)::int FROM hsn_sac_catalog_history WHERE catalog_id = $1) AS catalog_history_count,
      (SELECT count(*)::int FROM gst_rate_rule_history WHERE rule_id = $2) AS pending_rule_history_count,
      (SELECT count(*)::int FROM gst_rate_rule_history WHERE rule_id = $3) AS approved_rule_history_count,
      (SELECT count(*)::int FROM gst_rate_rules WHERE tenant_id = $4 AND rule_version LIKE $5) AS revision_count,
      (SELECT count(*)::int FROM gst_rate_rule_history h
        JOIN gst_rate_rules r ON r.tenant_id = h.tenant_id AND r.id = h.rule_id
        WHERE h.tenant_id = $4 AND r.rule_version LIKE $5) AS revision_history_count
  `, [ids.catalogPending, ids.rulePending, ids.ruleApproved, ids.tenantA, `${run}-REVISION-%`]);
  return rows.rows[0];
}

async function revisionState(db, predecessorId) {
  const rows = await db.query(`
    SELECT
      predecessor.id AS predecessor_id,
      predecessor.rule_version AS predecessor_version,
      predecessor.approval_status::text AS predecessor_status,
      predecessor.is_active AS predecessor_active,
      predecessor.tax_rate::text AS predecessor_tax_rate,
      COALESCE(successors.successor_count, 0)::int AS successor_count,
      COALESCE(history.history_count, 0)::int AS revision_history_count,
      COALESCE(successors.successors, '[]'::json) AS successors,
      COALESCE(history.revision_history, '[]'::json) AS revision_history
    FROM gst_rate_rules predecessor
    LEFT JOIN LATERAL (
      SELECT count(*) AS successor_count,
             json_agg(json_build_object(
               'id', id,
               'rule_version', rule_version,
               'approval_status', approval_status,
               'is_active', is_active,
               'tax_rate', tax_rate::text
             ) ORDER BY created_at, id) AS successors
      FROM gst_rate_rules
      WHERE tenant_id = predecessor.tenant_id
        AND rule_version LIKE $2
    ) successors ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS history_count,
             json_agg(json_build_object(
               'rule_id', rule_id,
               'action', action,
               'snapshot', snapshot
             ) ORDER BY created_at, id) AS revision_history
      FROM gst_rate_rule_history
      WHERE tenant_id = predecessor.tenant_id
        AND action = 'REVISION_CREATED'
        AND snapshot->>'supersedes_rule_id' = predecessor.id
    ) history ON true
    WHERE predecessor.id = $1 AND predecessor.tenant_id = $3
  `, [predecessorId, `${run}-REVISION-%`, ids.tenantA]);
  return rows.rows[0];
}

async function expectRejected(fn, expectedText) {
  try {
    await fn();
  } catch (error) {
    if (!expectedText || String(error?.message).includes(expectedText)) {
      return { message: String(error?.message) };
    }
    throw new Error(`Rejected with unexpected message: ${error?.message}`);
  }
  throw new Error("Expected application action to reject.");
}

async function invoke(userExternalId, fn) {
  installFinancialE2eTestSession(userExternalId);
  try {
    return await fn();
  } finally {
    clearFinancialE2eTestSession();
  }
}

async function test(db, id, functionName, userExternalId, expected, fn, options = {}) {
  const before = await snapshot(db);
  try {
    const actual = await invoke(userExternalId, fn);
    const after = await snapshot(db);
    evidence.tests.push({ id, function: functionName, authentication: userExternalId, expected, actual, before, after, status: "PASS" });
  } catch (error) {
    const after = await snapshot(db);
    const rejected = options.expectedRejection === true;
    evidence.tests.push({ id, function: functionName, authentication: userExternalId, expected, actual: { error: String(error?.message) }, before, after, status: rejected ? "PASS" : "FAIL", outcome: rejected ? "REJECTED_AS_EXPECTED" : undefined });
  }
}

async function main() {
  const admin = await connect(new URL(process.env.TEST_DATABASE_URL).toString());
  await admin.query(`CREATE DATABASE "${appDatabase}"`);
  const db = await connect();
  await db.query(fs.readFileSync("prisma/financial-e2e-schema-provisioning.generated.sql", "utf8"));
  const identity = (await db.query(`
    SELECT current_database() AS database_name, current_user AS current_user_name,
           inet_server_addr()::text AS server_address, inet_server_port() AS server_port
  `)).rows[0];
  evidence.databaseIdentity = identity;
  if (identity.database_name !== appDatabase ||
      !["127.0.0.1", "::1"].includes(String(identity.server_address).split("/")[0]) &&
      !String(identity.server_address).startsWith("172.")) {
    throw new Error("Database identity is not the approved disposable target.");
  }
  const role = (await db.query(`
    SELECT current_user AS current_user_name, session_user AS session_user_name,
         r.rolsuper AS is_superuser, r.rolbypassrls AS bypasses_rls
    FROM pg_roles r
    WHERE r.rolname = current_user
  `)).rows[0];
  evidence.databaseRoleAssessment = {
    ...role,
    restrictedRuntimeRoleDemonstrated: false,
    rlsAcceptance: "NOT_ESTABLISHED",
    reason: "Application probe used the approved bootstrap role to provision and exercise the disposable database; no restricted runtime-role session with tenant-context RLS enforcement was used.",
  };

  evidence.disposableSchemaPreparation = {
    appliedGeneratedBaseline: true,
    governanceControlsSource: "prisma/financial-e2e-schema-provisioning.generated.sql",
    targetDatabase: appDatabase,
  };

  process.env.DATABASE_URL = appDatabaseUrl.toString();
  ({ prisma } = require(path.join(root, "src/lib/db/prisma.ts")));
  process.env.DATABASE_URL = guardDatabaseUrl;
  ({
    installFinancialE2eTestSession,
    clearFinancialE2eTestSession,
  } = require(path.join(root, "src/adapters/auth/supabase-auth.adapter.ts")));
  ({
    updateHsnSacCatalogRecord,
    approveGstRateRule,
    createGstRateRuleRevision,
  } = require(path.join(root, "src/app/_actions/gst-catalog.actions.ts")));

  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1,$2,$3,now()),($4,$5,$6,now())",
      [ids.tenantA, run, "HSN Application A", ids.tenantB, `${run}_b`, "HSN Application B"]);
    await db.query("INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1,$2,$3,$4,now()),($5,$6,$7,$8,now())",
      [ids.userA, ids.userA, `${ids.userA}@example.invalid`, "HSN A", ids.userB, ids.userB, `${ids.userB}@example.invalid`, "HSN B"]);
    await db.query("INSERT INTO roles (id,tenant_id,name,is_default,updated_at) VALUES ($1,$2,'MANAGE',true,now()),($3,$2,'APPROVE',false,now()),($4,$5,'NONE',true,now())",
      [ids.roleManage, ids.tenantA, ids.roleApprove, ids.roleNone, ids.tenantB]);
    await db.query("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,updated_at) VALUES ($1,$2,$3,$4,'active',now()),($5,$6,$7,$8,'active',now())",
      [ids.membershipA, ids.tenantA, ids.userA, ids.roleManage, ids.membershipB, ids.tenantB, ids.userB, ids.roleNone]);
    for (const [role, permission] of [
      [ids.roleManage, "manage_hsn_catalog"],
      [ids.roleApprove, "approve_gst_rates"],
    ]) await db.query("INSERT INTO role_permissions (id,role_id,permission) VALUES ($1,$2,$3)", [`${role}_${permission}`, role, permission]);
    await db.query("INSERT INTO role_permissions (id,role_id,permission) VALUES ($1,$2,$3)",
      [`${ids.roleManage}_approve_gst_rates`, ids.roleManage, "approve_gst_rates"]);
    await db.query(`INSERT INTO hsn_sac_catalog
      (id,tenant_id,code,description,classification_type,classification_status,rate_approval_status,is_active,
       classification_approved_by_membership_id,classification_approved_at,created_at,updated_at)
      VALUES ($1,$2,'APP-PENDING','Pending','GOODS','PENDING','PENDING',false,NULL,NULL,now(),now()),
             ($3,$4,'APP-OTHER','Other','GOODS','PENDING','PENDING',false,NULL,NULL,now(),now()),
             ($5,$2,'APP-APPROVED','Approved','GOODS','APPROVED','APPROVED',true,$6,now(),now(),now())`,
      [ids.catalogPending, ids.tenantA, ids.catalogOtherTenant, ids.tenantB, ids.catalogApproved, ids.membershipA]);
    await db.query(`INSERT INTO gst_rate_rules
      (id,tenant_id,hsn_sac_catalog_id,rule_version,tax_rate,component_policy,approval_status,is_active,effective_from,
       approved_by_membership_id,approved_at,created_at,updated_at)
      VALUES ($1,$2,NULL,'PENDING-1',18,'IGST','PENDING',false,'2027-01-01',NULL,NULL,now(),now()),
             ($3,$2,$4,'BLOCKED-1',18,'IGST','PENDING',false,'2027-02-01',NULL,NULL,now(),now()),
             ($8,$2,NULL,'CONCURRENT-1',18,'CGST_SGST','PENDING',false,'2028-01-01',NULL,NULL,now(),now()),
             ($5,$2,$6,'APPROVED-1',18,'IGST','APPROVED',true,'2027-03-01',$7,now(),now(),now())`,
      [ids.rulePending, ids.tenantA, ids.ruleBlocked, ids.catalogPending, ids.ruleApproved, ids.catalogApproved, ids.membershipA, ids.ruleConcurrent]);
    await db.query(`INSERT INTO gst_rate_rule_history
      (id,tenant_id,rule_id,action,snapshot,actor_membership_id)
      VALUES ($1,$2,$3,'SEED_APPROVED','{"status":"APPROVED","tax_rate":18}',$4)`,
      [`${run}_approved_history`, ids.tenantA, ids.ruleApproved, ids.membershipA]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  evidence.applicationContexts = {
    authorizedUser: {
      externalId: ids.userA,
      tenantId: ids.tenantA,
      membershipId: ids.membershipA,
      permissions: ["manage_hsn_catalog", "approve_gst_rates"],
    },
    unauthorizedCrossTenantUser: {
      externalId: ids.userB,
      tenantId: ids.tenantB,
      membershipId: ids.membershipB,
      permissions: [],
    },
    crossTenantAttempt: {
      callerExternalId: ids.userA,
      callerTenantId: ids.tenantA,
      targetTenantId: ids.tenantB,
    },
  };

  await test(db, "update_authorized_success", "updateHsnSacCatalogRecord", ids.userA,
    "Catalog is reset to pending and final state is audited",
    () => updateHsnSacCatalogRecord(ids.catalogPending, {
      description: "Updated by application",
      classification_type: "GOODS",
      source_reference: "APP-UPDATE",
    }));
  await test(db, "update_unauthorized_rejected", "updateHsnSacCatalogRecord", ids.userB,
    "Permission rejection with no state change",
    () => updateHsnSacCatalogRecord(ids.catalogPending, { description: "Unauthorized" }), { expectedRejection: true });
  await test(db, "update_cross_tenant_rejected", "updateHsnSacCatalogRecord", ids.userA,
    "Cross-tenant catalog is not found",
    () => updateHsnSacCatalogRecord(ids.catalogOtherTenant, { description: "Cross tenant" }), { expectedRejection: true });

  await test(db, "approve_rate_pending_classification_rejected", "approveGstRateRule", ids.userA,
    "Rate approval blocks until classification is approved and active",
    () => approveGstRateRule(ids.ruleBlocked, "APP-BLOCKED"), { expectedRejection: true });
  await test(db, "approve_rate_unauthorized_rejected", "approveGstRateRule", ids.userB,
    "Permission rejection with no state change",
    () => approveGstRateRule(ids.rulePending, "APP-UNAUTHORIZED"), { expectedRejection: true });

  await test(db, "approve_rate_authorized_success", "approveGstRateRule", ids.userA,
    "Pending unclassified rule becomes approved and history is written",
    () => approveGstRateRule(ids.rulePending, "APP-APPROVAL"));
  await test(db, "approve_rate_duplicate_rejected", "approveGstRateRule", ids.userA,
    "Second approval is rejected and does not add history",
    () => approveGstRateRule(ids.rulePending, "APP-DUPLICATE"), { expectedRejection: true });

  await test(db, "approve_rate_concurrent_duplicate", "approveGstRateRule", ids.userA,
    "Concurrent duplicate approvals produce one success and one rejection",
    async () => {
      installFinancialE2eTestSession(ids.userA);
      try {
        const outcomes = await Promise.all([
          approveGstRateRule(ids.ruleConcurrent, "APP-CONCURRENT-A")
            .then(() => "COMMITTED")
            .catch((error) => `REJECTED:${error.message}`),
          approveGstRateRule(ids.ruleConcurrent, "APP-CONCURRENT-B")
            .then(() => "COMMITTED")
            .catch((error) => `REJECTED:${error.message}`),
        ]);
        if (outcomes.filter((outcome) => outcome === "COMMITTED").length !== 1 ||
            outcomes.filter((outcome) => outcome.startsWith("REJECTED:")).length !== 1) {
          throw new Error(`Unexpected concurrent outcomes: ${outcomes.join(" | ")}`);
        }
        return { outcomes };
      } finally {
        clearFinancialE2eTestSession();
      }
    });

  const approvedBeforeRevision = await revisionState(db, ids.ruleApproved);
  await test(db, "revision_authorized_success", "createGstRateRuleRevision", ids.userA,
    "Approved predecessor remains unchanged; pending successor and history are created",
    () => createGstRateRuleRevision(ids.ruleApproved, {
      rule_version: `${run}-REVISION-1`,
      tax_rate: 20,
      component_policy: "IGST",
      source_reference: "APP-REVISION",
      effective_from: new Date("2027-04-01T00:00:00.000Z"),
    }));
  const approvedAfterRevision = await revisionState(db, ids.ruleApproved);
  evidence.revisionInvariant = {
    predecessorBefore: approvedBeforeRevision,
    predecessorAfter: approvedAfterRevision,
    unchanged: approvedBeforeRevision.predecessor_tax_rate === approvedAfterRevision.predecessor_tax_rate &&
      approvedAfterRevision.predecessor_status === "APPROVED" &&
      approvedAfterRevision.predecessor_active === true,
    auditHistoryMatchesPersistedSuccessor:
      approvedAfterRevision.revision_history.every((entry) => {
        const successor = approvedAfterRevision.successors.find((row) => row.id === entry.rule_id);
        return successor && entry.action === "REVISION_CREATED" &&
          entry.snapshot?.id === successor.id &&
          entry.snapshot?.rule_version === successor.rule_version &&
          entry.snapshot?.approval_status === successor.approval_status;
      }),
  };
  await test(db, "revision_unapproved_rejected", "createGstRateRuleRevision", ids.userA,
    "Unapproved predecessor cannot be revised",
    () => createGstRateRuleRevision(ids.ruleBlocked, {
      rule_version: `${run}-INVALID-REVISION`,
      tax_rate: 19,
      component_policy: "IGST",
      effective_from: new Date("2027-05-01T00:00:00.000Z"),
    }), { expectedRejection: true });

  const rollbackBefore = await revisionState(db, ids.ruleApproved);
  await test(db, "revision_forced_rollback", "createGstRateRuleRevision", ids.userA,
    "Duplicate rule version fails inside the transaction without successor or history",
    () => createGstRateRuleRevision(ids.ruleApproved, {
      rule_version: "APPROVED-1",
      tax_rate: 21,
      component_policy: "IGST",
      effective_from: new Date("2027-06-01T00:00:00.000Z"),
    }), { expectedRejection: true });
  const rollbackAfter = await revisionState(db, ids.ruleApproved);
  evidence.revisionRollback = {
    before: rollbackBefore,
    after: rollbackAfter,
    predecessorUnchanged:
      rollbackBefore.predecessor_version === rollbackAfter.predecessor_version &&
      rollbackBefore.predecessor_status === rollbackAfter.predecessor_status &&
      rollbackBefore.predecessor_active === rollbackAfter.predecessor_active &&
      rollbackBefore.predecessor_tax_rate === rollbackAfter.predecessor_tax_rate,
    noPartialSuccessor: rollbackBefore.successor_count === rollbackAfter.successor_count,
    noPartialHistory: rollbackBefore.revision_history_count === rollbackAfter.revision_history_count,
  };

  const concurrentVersion = `${run}-REVISION-CONCURRENT`;
  const concurrentBefore = await revisionState(db, ids.ruleApproved);
  await test(db, "revision_concurrent_same_version", "createGstRateRuleRevision", ids.userA,
    "Concurrent revisions with the same version yield one successor and one rejected transaction",
    async () => {
      const outcomes = await Promise.all([
        invoke(ids.userA, () => createGstRateRuleRevision(ids.ruleApproved, {
          rule_version: concurrentVersion,
          tax_rate: 22,
          component_policy: "IGST",
          effective_from: new Date("2027-07-01T00:00:00.000Z"),
        })).then(() => "COMMITTED").catch((error) => `REJECTED:${error.message}`),
        invoke(ids.userA, () => createGstRateRuleRevision(ids.ruleApproved, {
          rule_version: concurrentVersion,
          tax_rate: 22,
          component_policy: "IGST",
          effective_from: new Date("2027-07-01T00:00:00.000Z"),
        })).then(() => "COMMITTED").catch((error) => `REJECTED:${error.message}`),
      ]);
      if (outcomes.filter((outcome) => outcome === "COMMITTED").length !== 1 ||
          outcomes.filter((outcome) => outcome.startsWith("REJECTED:")).length !== 1) {
        throw new Error(`Unexpected concurrent revision outcomes: ${outcomes.join(" | ")}`);
      }
      return { outcomes };
    });
  const concurrentAfter = await revisionState(db, ids.ruleApproved);
  evidence.revisionConcurrency = {
    before: concurrentBefore,
    after: concurrentAfter,
    exactlyOneSuccess:
      concurrentAfter.successor_count === concurrentBefore.successor_count + 1 &&
      concurrentAfter.revision_history_count === concurrentBefore.revision_history_count + 1,
    auditHistoryMatchesPersistedSuccessor:
      concurrentAfter.revision_history.every((entry) => {
        const successor = concurrentAfter.successors.find((row) => row.id === entry.rule_id);
        return successor && entry.action === "REVISION_CREATED" &&
          entry.snapshot?.id === successor.id &&
          entry.snapshot?.rule_version === successor.rule_version;
      }),
  };

  await db.end();
  await prisma.$disconnect();
  await admin.query(`DROP DATABASE "${appDatabase}" WITH (FORCE)`);
  evidence.cleanup.databaseDropped = true;
  evidence.cleanup.databaseVerifiedAbsent = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [appDatabase])).rowCount === 0;
  await admin.end();
  evidence.cleanup.verifiedAbsent = evidence.cleanup.databaseVerifiedAbsent;
  const output = `.obsidian-vault/specs/hsn-sac-application-runtime-evidence-${run}.json`;
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`APPLICATION_EVIDENCE=${output}`);
  console.log(`APPLICATION_RESULTS=${evidence.tests.length}`);
  console.log(`APPLICATION_FAILURES=${evidence.tests.filter((test) => test.status !== "PASS").length}`);
  if (evidence.tests.some((test) => test.status !== "PASS") || !evidence.cleanup.verifiedAbsent ||
      evidence.revisionInvariant?.unchanged !== true ||
      evidence.revisionInvariant?.auditHistoryMatchesPersistedSuccessor !== true ||
      evidence.revisionRollback?.predecessorUnchanged !== true ||
      evidence.revisionRollback?.noPartialSuccessor !== true ||
      evidence.revisionRollback?.noPartialHistory !== true ||
      evidence.revisionConcurrency?.exactlyOneSuccess !== true ||
      evidence.revisionConcurrency?.auditHistoryMatchesPersistedSuccessor !== true) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error?.stack ?? error);
  try { await prisma.$disconnect(); } catch {}
  process.exitCode = 1;
});
