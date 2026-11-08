import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import {
  createLifecycleEvidence,
  loadFinancialE2eEnvironment,
  targetContractFingerprint,
  writeLifecycleEvidence,
} from "./scripts/financial-e2e-target-lifecycle.mjs";
import { runFinancialE2eCompose } from "./scripts/financial-e2e-compose.mjs";
import { createTargetContract, schemaArtifactHash, targetContractBinding } from "./scripts/financial-e2e-target-contract.mjs";

const runId = "recon20261108au";
const port = "55637";
const databaseName = "pharmnos_financial_e2e_recon20261108au";
const composeProject = "pharmnoslite-financial-e2e-recon20261108au";
const repositoryRoot = process.cwd();
const evidenceRoot = ".obsidian-vault/specs";
const bootstrapEvidence = path.join(evidenceRoot, `financial-e2e-infrastructure-evidence-${runId}.json`);
const migrationEvidence = path.join(evidenceRoot, `financial-e2e-initialization-evidence-${runId}.json`);
const harnessEvidence = path.join(evidenceRoot, `financial-e2e-runtime-harness-evidence-${runId}.json`);
const cleanupEvidence = path.join(evidenceRoot, `financial-e2e-cleanup-evidence-${runId}.json`);
const acceptanceEvidence = path.join(evidenceRoot, `financial-reconciliation-focused-runtime-acceptance-${runId}.json`);
const env = loadFinancialE2eEnvironment({ ...process.env });

function urlFor(user, password) {
  const url = new URL("postgresql://127.0.0.1");
  url.port = port;
  url.pathname = `/${databaseName}`;
  url.username = user;
  url.password = password;
  return url.toString();
}

const bootstrapUrl = urlFor(env.FINANCIAL_E2E_DB_USER, env.FINANCIAL_E2E_DB_PASSWORD);
const runtimeUrl = urlFor(env.FINANCIAL_E2E_RUNTIME_DB_USER, env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD);
Object.assign(env, {
  ALLOW_FINANCIAL_E2E: "true",
  FINANCIAL_E2E_TARGET_APPROVED: "true",
  FINANCIAL_E2E_RUN_ID: runId,
  FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID: `${runId}-init01`,
  FINANCIAL_E2E_DB_NAME: databaseName,
  TEST_DATABASE_NAME: databaseName,
  FINANCIAL_E2E_ALLOWED_DATABASE_NAME: databaseName,
  FINANCIAL_E2E_DB_PORT: port,
  FINANCIAL_E2E_COMPOSE_PROJECT: composeProject,
  TEST_DATABASE_MARKER: "pharmnos-financial-e2e",
  TEST_DATABASE_URL: bootstrapUrl,
  FINANCIAL_E2E_RUNTIME_DATABASE_URL: runtimeUrl,
  FINANCIAL_E2E_INFRASTRUCTURE_AUTHORIZED: "true",
  FINANCIAL_E2E_INITIALIZATION_AUTHORIZED: "true",
  FINANCIAL_E2E_EXECUTION_AUTHORIZED: "true",
  FINANCIAL_E2E_EVIDENCE_RECORDING_AUTHORIZED: "true",
  FINANCIAL_E2E_CLEANUP_AUTHORIZED: "true",
  FINANCIAL_E2E_CLEANUP_MODE: "DISPOSABLE_TARGET_DISPOSAL",
  FINANCIAL_E2E_INITIALIZATION_SCOPE: "DATABASE_INITIALIZATION_ONLY",
  FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
  FINANCIAL_E2E_ROLE_SETUP_METHOD: "PRISMA_MIGRATIONS_ONLY",
  FINANCIAL_E2E_BASELINE_PACKAGE: "VERSION_PINNED_REVIEW_ARTIFACTS",
  FINANCIAL_E2E_EVIDENCE_MODE: "SANITIZED_APPEND_ONLY_LOCAL",
  FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS: "30",
  FINANCIAL_E2E_EVIDENCE_PATH_APPROVED: "true",
  FINANCIAL_E2E_RECOVERY_POLICY: "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET",
  FINANCIAL_E2E_INFRASTRUCTURE_EVIDENCE_FILE: bootstrapEvidence,
  FINANCIAL_E2E_INITIALIZATION_EVIDENCE_FILE: migrationEvidence,
  FINANCIAL_E2E_SUITE_EVIDENCE_FILE: harnessEvidence,
  FINANCIAL_E2E_CLEANUP_EVIDENCE_FILE: cleanupEvidence,
  FINANCIAL_E2E_SUITE_NAME: "financial-reconciliation-focused-runtime-acceptance",
  FINANCIAL_E2E_COMPOSE_FILE: "docker-compose.financial-e2e.yml",
  DATABASE_URL: "",
  DIRECT_URL: "",
});

const previousDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = "";
const contract = createTargetContract({
  runId,
  targetUrl: bootstrapUrl,
  runtimeUrl,
  databaseName,
  composeProject,
  schemaArtifactHash: schemaArtifactHash(),
  authorizedAt: Date.now(),
  expiresAt: Date.now() + 2 * 60 * 60 * 1000,
});
if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
else process.env.DATABASE_URL = previousDatabaseUrl;
env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(contract);
env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING = targetContractBinding(contract);
env.FINANCIAL_E2E_AUTHORIZED_TARGET_FINGERPRINT = targetContractFingerprint(contract);

let composeStarted = false;
let migrationStdout = "";
let migrationStderr = "";
let targetIdentity = null;
let migrationRows = [];
let targetRuntimeRole = null;
let probe = null;
let harness = null;
let cleanup = null;
let infrastructure = null;
let exitCode = 0;

function run(command, args, childEnv, timeout = 180000) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: childEnv,
    encoding: "utf8",
    timeout,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message ?? null };
}

try {
  infrastructure = runFinancialE2eCompose({ action: "up", env });
  composeStarted = true;
  const migrationEnv = { ...env, DATABASE_URL: bootstrapUrl, DIRECT_URL: bootstrapUrl };
  const migration = run(process.env.ComSpec, ["/d", "/s", "/c", "pnpm prisma migrate deploy"], migrationEnv);
  migrationStdout = migration.stdout;
  migrationStderr = migration.stderr;
  if (migration.status !== 0) throw new Error(`Prisma migration deploy failed with exit ${migration.status}.`);

  const identityClient = new Client({ connectionString: bootstrapUrl, application_name: `${runId}-identity` });
  await identityClient.connect();
  try {
    const identity = (await identityClient.query(`
      SELECT current_database() AS database_name, current_user AS current_role,
             inet_server_addr()::text AS server_address, inet_server_port() AS server_port
    `)).rows[0];
    if (identity.database_name !== databaseName ||
        identity.current_role !== env.FINANCIAL_E2E_DB_USER ||
        Number(identity.server_port) !== 5432) {
      throw new Error("Connected database name, bootstrap role, or PostgreSQL service port does not match the authorized target.");
    }
    targetIdentity = {
      database: identity.database_name,
      bootstrapRole: identity.current_role,
      serverAddressInsideContainer: identity.server_address,
      serverPortInsideContainer: Number(identity.server_port),
      targetEndpoint: `127.0.0.1:${port}`,
      marker: env.TEST_DATABASE_MARKER,
      composeProject,
    };
    migrationRows = (await identityClient.query(`
      SELECT migration_name, finished_at IS NOT NULL AND rolled_back_at IS NULL AS finished
      FROM _prisma_migrations ORDER BY migration_name
    `)).rows;
    const roleRow = (await identityClient.query(`
      SELECT rolcanlogin, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1
    `, [env.FINANCIAL_E2E_RUNTIME_DB_USER])).rows[0] ?? null;
    targetRuntimeRole = roleRow && {
      canLogin: roleRow.rolcanlogin,
      superuser: roleRow.rolsuper,
      bypassRls: roleRow.rolbypassrls,
    };
    if (migrationRows.length !== 26 ||
        migrationRows.some((row) => row.finished !== true) ||
        migrationRows[0]?.migration_name !== "0001_baseline" ||
        migrationRows.at(-1)?.migration_name !== "0026_add_reconciliation_audit_events") {
      throw new Error(`Expected exactly 26 finished migrations; observed ${migrationRows.length}.`);
    }
  } finally {
    await identityClient.end();
  }
  const initializationRecord = createLifecycleEvidence({
    phase: "SCHEMA_INITIALIZATION",
    lifecycle: infrastructure.lifecycle,
    status: targetRuntimeRole ? "PASS" : "BLOCKED",
    details: {
      migrationSource: "Prisma migrate deploy",
      migrationsApplied: migrationRows.length,
      finishedMigrations: migrationRows.filter((row) => row.finished).length,
      firstMigration: migrationRows[0]?.migration_name,
      lastMigration: migrationRows.at(-1)?.migration_name,
      generatedProvisioningSqlUsedAsMigrationSubstitute: false,
      runtimeRolePresent: Boolean(targetRuntimeRole),
      runtimeRoleAttributes: targetRuntimeRole,
      applicationTestsCanUseBootstrapRole: true,
      restrictedRoleAndRlsEvidenceAvailable: false,
      blockingReason: targetRuntimeRole
        ? null
        : "Fresh Prisma-migrated target has no restricted runtime role; generating role grants/RLS/auth-context objects would alter protected security policy and was not authorized.",
    },
  });
  writeLifecycleEvidence({ filePath: migrationEvidence, evidence: initializationRecord });

  const testEnv = {
    ...env,
    DATABASE_URL: bootstrapUrl,
    DIRECT_URL: bootstrapUrl,
    FINANCIAL_E2E_TEST_MODE: "true",
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
  probe = run(process.execPath, ["scripts/.tmp-financial-acceptance-probe.cjs"], testEnv, 300000);
  if (probe.status !== 0) exitCode = 1;
  let probeResult = null;
  try {
    const start = probe.stdout.indexOf("FINANCIAL_E2E_PROBE_JSON_START");
    const end = probe.stdout.indexOf("FINANCIAL_E2E_PROBE_JSON_END", start);
    if (start >= 0 && end > start) {
      const json = probe.stdout.slice(start + "FINANCIAL_E2E_PROBE_JSON_START".length, end).trim();
      probeResult = JSON.parse(json);
    }
  } catch {
    probeResult = null;
  }

  harness = {
    status: targetRuntimeRole ? "NOT_RUN" : "BLOCKED",
    reason: targetRuntimeRole
      ? "The harness is not needed for this focused campaign."
      : "The existing harness requires a runtime-role connection; that role is absent after Prisma-only migration replay and must not be synthesized by applying generated RLS provisioning.",
  };

  const report = {
    campaign: "Financial Reconciliation — Focused Runtime Acceptance",
    runId,
    recordedAt: new Date().toISOString(),
    ownerAuthorization: {
      status: "OWNER-APPROVED",
      date: "2026-11-08",
      decisionLog: ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-decision-log.md",
      decisions: "A–O approved as written; no amendments stated by owner.",
    },
    gitBaselineFile: "session-state/files/financial-recon-acceptance-baseline-20261108am.json",
    target: targetIdentity,
    prismaMigrations: {
      deployExitCode: migration.status,
      count: migrationRows.length,
      finishedCount: migrationRows.filter((row) => row.finished).length,
      first: migrationRows[0]?.migration_name ?? null,
      last: migrationRows.at(-1)?.migration_name ?? null,
      names: migrationRows.map((row) => row.migration_name),
      outputTail: migrationStdout.split(/\r?\n/).slice(-45),
      stderrTail: migrationStderr.split(/\r?\n/).slice(-12),
    },
    runtimeRole: targetRuntimeRole,
    testSessionBoundary: "Existing target-gated SupabaseAuthAdapter E2E session helper; user, membership, role, and permissions persisted in the target. Application actions run under bootstrap DB role; this is not restricted-role RLS evidence.",
    probe: {
      exitCode: probe.status,
      result: probeResult,
      stderrTail: probe.stderr.split(/\r?\n/).slice(-40),
      outputTail: probeResult ? undefined : probe.stdout.split(/\r?\n/).slice(-220),
    },
    existingHarness: {
      status: harness.status,
      reason: harness.reason,
      evidenceFile: null,
      note: "The existing harness S-29 Promise.allSettled result is not deterministic-barrier evidence.",
    },
    decisionContract: {
      references: [
        ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-accounting-decision-pack.md",
        ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-accounting-invariants.md",
        ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-policy-matrix.md",
        ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-scenario-matrix.md",
        ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-engineering-plan.md",
        ".obsidian-vault/specs/financial-reconciliation/financial-reconciliation-architecture.md",
      ],
    },
    execution: {
      targetInitializedFromPrismaMigrations: true,
      generatedProvisioningSqlUsedAsMigrationSubstitute: false,
      implementationFilesModified: false,
      sourceAssertions: [],
    },
  };
  fs.writeFileSync(acceptanceEvidence, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
} catch (error) {
  console.error(`ACCEPTANCE_RUNNER=FAIL ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  if (composeStarted) {
    try {
      cleanup = runFinancialE2eCompose({ action: "down", env });
    } catch (error) {
      console.error(`CLEANUP=FAIL ${error instanceof Error ? error.message : String(error)}`);
      exitCode = 1;
    }
  }
  const containerCheck = run("docker", ["ps", "-a", "--filter", `name=${composeProject}`, "--format", "{{.Names}}"], env);
  const networkCheck = run("docker", ["network", "ls", "--filter", `name=${composeProject}`, "--format", "{{.Name}}"], env);
  const cleanupReport = {
    runId,
    target: { databaseName, port: Number(port), composeProject },
    cleanupEvidenceFile: cleanupEvidence,
    composeDownPassed: cleanup?.evidence?.status === "PASS",
    containerAbsence: containerCheck.stdout.trim() === "",
    networkAbsence: networkCheck.stdout.trim() === "",
    containerCheckExitCode: containerCheck.status,
    networkCheckExitCode: networkCheck.status,
    checkedAt: new Date().toISOString(),
  };
  if (composeStarted) {
    const output = path.join(repositoryRoot, evidenceRoot, `financial-e2e-post-cleanup-${runId}.json`);
    fs.writeFileSync(output, `${JSON.stringify(cleanupReport, null, 2)}\n`, { flag: "wx" });
  }
  if (!cleanupReport.containerAbsence || !cleanupReport.networkAbsence || containerCheck.status !== 0 || networkCheck.status !== 0) {
    console.error("CLEANUP_ABSENCE=FAIL");
    exitCode = 1;
  }
  if (exitCode !== 0) process.exitCode = exitCode;
}

if (exitCode === 0) console.log(`ACCEPTANCE_EVIDENCE=${acceptanceEvidence}`);
