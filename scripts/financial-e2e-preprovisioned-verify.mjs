#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import pg from "pg";
import { verifyDatabaseIdentity } from "./financial-e2e-safety.mjs";
import {
  loadTargetContractFromEnv,
  schemaArtifactHash,
  targetContractBinding,
  verifyTargetSchema,
} from "./financial-e2e-target-contract.mjs";

const { Client } = pg;
const EXPECTED_PROJECT = "pharmnoslite-financial-e2e-0419";
const EXPECTED_CONTAINER = "pharmnoslite-financial-e2e-0419-financial-e2e-postgres-1";
const EXPECTED_TABLES = 33;
const EXPECTED_POLICIES = 84;
const EXPECTED_TRIGGERS = 16;

function required(name) {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function targetUrl(name, password, contract) {
  const url = new URL(required(name));
  url.username = name.includes("RUNTIME") ? contract.runtimeRole : contract.bootstrapRole;
  url.password = password;
  url.searchParams.set("application_name", contract.marker);
  return url.toString();
}

function verifyComposeBinding() {
  const labels = JSON.parse(execFileSync("docker", [
    "inspect", EXPECTED_CONTAINER, "--format", "{{json .Config.Labels}}",
  ], { encoding: "utf8" }));
  if (labels["com.docker.compose.project"] !== EXPECTED_PROJECT ||
      labels["com.docker.compose.service"] !== "financial-e2e-postgres" ||
      labels["com.pharmnos.environment"] !== "financial-e2e-isolated") {
    throw new Error("Pre-provisioned target Compose identity does not match 0419.");
  }
}

async function main() {
  const contract = loadTargetContractFromEnv();
  if (contract.databaseName !== "pharmnos_financial_e2e_0419" ||
      contract.composeProject !== EXPECTED_PROJECT ||
      contract.schemaArtifactHash !== schemaArtifactHash()) {
    throw new Error("Pre-provisioned target contract is not bound to the verified 0419 target.");
  }
  if (process.env.FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING !== targetContractBinding(contract)) {
    throw new Error("Pre-provisioned target binding is inconsistent.");
  }
  verifyComposeBinding();

  const bootstrap = new Client({
    connectionString: targetUrl("TEST_DATABASE_URL", required("FINANCIAL_E2E_DB_PASSWORD"), contract),
    application_name: contract.marker,
  });
  await bootstrap.connect();
  try {
    await bootstrap.query("SELECT set_config('pharmnos.financial_e2e_marker', $1, false)", [contract.marker]);
    const identity = (await bootstrap.query(`
      SELECT current_database() database_name, current_user current_role,
             current_setting('pharmnos.financial_e2e_marker', true) marker
    `)).rows[0];
    if (identity.database_name !== contract.databaseName ||
        identity.current_role !== contract.bootstrapRole ||
        identity.marker !== contract.marker) {
      throw new Error("Pre-provisioned bootstrap identity does not match the target contract.");
    }
    await verifyTargetSchema(bootstrap, contract);
    const catalog = (await bootstrap.query(`
      SELECT
        (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) rls_tables,
        (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') policies,
        (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal) triggers,
        (SELECT count(*) FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN
         ('sales_invoices','sales_invoice_items','products','product_batches','customers','business_profiles')) required_tables,
        (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name IN
         ('sales_invoices','sales_invoice_items','products','product_batches','customers','business_profiles')) required_columns,
        (SELECT count(*) FROM information_schema.table_constraints
         WHERE table_schema = 'public') constraints,
        (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') indexes
    `)).rows[0];
    if (Number(catalog.rls_tables) !== EXPECTED_TABLES ||
        Number(catalog.policies) !== EXPECTED_POLICIES ||
        Number(catalog.triggers) !== EXPECTED_TRIGGERS ||
    Number(catalog.required_tables) !== 6 ||
    Number(catalog.required_columns) < 30 ||
    Number(catalog.constraints) === 0 ||
    Number(catalog.indexes) === 0) {
      throw new Error("Pre-provisioned target schema compatibility checks failed.");
    }
  } finally {
    await bootstrap.end();
  }

  const runtime = new Client({
    connectionString: targetUrl(
      "FINANCIAL_E2E_RUNTIME_DATABASE_URL",
      required("FINANCIAL_E2E_RUNTIME_DB_PASSWORD"),
      contract,
    ),
    application_name: contract.marker,
  });
  await runtime.connect();
  try {
    const identity = await verifyDatabaseIdentity({
      client: runtime,
      expectedDatabase: contract.databaseName,
      expectedRole: contract.runtimeRole,
      targetUrl: process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
      approvedTargetBinding: targetContractBinding(contract),
      runId: contract.runId,
    });
    if (!identity.ok) throw new Error(identity.error);
  } finally {
    await runtime.end();
  }
  console.log("PREPROVISIONED=PASS_TARGET_COMPATIBILITY_AND_ROLE_PREFLIGHT");
}

main().catch((error) => {
  console.error(`PREPROVISIONED=FAIL ${error?.message ?? error}`);
  process.exitCode = 1;
});
