#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const Module = require("node:module");
const path = require("node:path");
const { Client } = require("pg");

const environmentFiles = [
  process.env.FINANCIAL_E2E_BASE_ENV_FILE || ".env.local",
  process.env.FINANCIAL_E2E_ENV_FILE || ".env.financial-e2e",
];
for (const environmentFile of environmentFiles) {
  if (!fs.existsSync(environmentFile)) continue;
  for (const line of fs.readFileSync(environmentFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

if (process.env.ALLOW_FINANCIAL_E2E !== "true" ||
    !process.env.TEST_DATABASE_NAME ||
    process.env.TEST_DATABASE_MARKER !== "pharmnos-financial-e2e") {
  throw new Error("The approved disposable purchase target is not enabled.");
}

const target = new URL(process.env.TEST_DATABASE_URL);
if (target.hostname !== "127.0.0.1" ||
    target.port !== String(process.env.FINANCIAL_E2E_DB_PORT) ||
    target.pathname !== `/${process.env.TEST_DATABASE_NAME}`) {
  throw new Error("Purchase validation requires the approved loopback disposable database.");
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
  if (request === "next/navigation" || request === "next/navigation.js") {
    return { redirect: (location) => { throw new Error(`NEXT_REDIRECT:${location}`); } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require("ts-node/register/transpile-only");

const run = `purchase_gst_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const databaseName = `${process.env.TEST_DATABASE_NAME}_${run}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
const ordinaryDatabaseUrl = process.env.DATABASE_URL;
databaseUrl.pathname = `/${databaseName}`;
databaseUrl.searchParams.set("application_name", "pharmnos-purchase-gst");
const ids = {
  tenantA: `${run}_tenant_a`,
  tenantB: `${run}_tenant_b`,
  userA: `${run}_user_a`,
  userB: `${run}_user_b`,
  userInactive: `${run}_user_inactive`,
  externalUserA: `${run}_external_user_a`,
  externalUserB: `${run}_external_user_b`,
  externalUserInactive: `${run}_external_user_inactive`,
  rolePurchase: `${run}_role_purchase`,
  roleNone: `${run}_role_none`,
  membershipA: `${run}_membership_a`,
  membershipB: `${run}_membership_b`,
  membershipInactive: `${run}_membership_inactive`,
  supplierA: `${run}_supplier_a`,
  supplierB: `${run}_supplier_b`,
  productA: `${run}_product_a`,
  productB: `${run}_product_b`,
  catalogA: `${run}_catalog_a`,
  catalogB: `${run}_catalog_b`,
  ruleA: `${run}_rule_a`,
  ruleB: `${run}_rule_b`,
};
const sourceFiles = [
  "src/app/_actions/purchases.actions.ts",
  "src/domain/services/purchase-calculator.service.ts",
  "src/domain/services/purchase-gst-reconciliation.service.ts",
  "src/lib/validation/purchases.schemas.ts",
  "prisma/schema.prisma",
  "prisma/migrations/0009_purchase_gst_line_acceptance/migration.sql",
  "prisma/financial-e2e-schema-provisioning.generated.sql",
  "src/lib/db/tenant-context.ts",
  "src/lib/db/prisma.ts",
  "src/adapters/auth/supabase-auth.adapter.ts",
  "scripts/purchase-gst-application-acceptance.cjs",
  "scripts/financial-e2e-provision-local.mjs",
  "scripts/financial-e2e-provisioning-static-guard.mjs",
];
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const requestHash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const evidence = {
  evidenceVersion: 1,
  run,
  target: "approved local disposable PostgreSQL database only",
  applicationConnection: "application actions use restricted runtime role; bootstrap is fixture/assertion-only; no Supabase or production",
  sourceHashes: Object.fromEntries(sourceFiles.map((file) => [file, sha256(file)])),
  tests: [],
  cleanup: {},
};
let admin;
let db;
let prisma;
let authorizedTargetContract;
let validateAuthorizedTargetContract;
let authorizedTargetUrl;
let authorizedRuntimeUrl;
let installFinancialE2eTestSession;
let clearFinancialE2eTestSession;
let createPurchaseDraftAction;
let acceptPurchaseGstAction;
let resolvePurchaseGstDiscrepancyAction;
let finalizePurchaseAction;

async function connect(connectionString) {
  const client = new Client({ connectionString });
  client.on("error", () => {});
  await client.connect();
  return client;
}

async function invoke(userExternalId, fn) {
  installFinancialE2eTestSession(userExternalId);
  try {
    return await fn();
  } finally {
    clearFinancialE2eTestSession();
  }
}

async function purchaseState(purchaseId) {
  if (!purchaseId) return null;
  const result = await db.query(`
    SELECT
      p.id,
      p.tenant_id,
      p.status::text AS status,
      p.gst_reconciliation_status::text AS gst_reconciliation_status,
      p.gst_accounting_acceptance_status::text AS gst_accounting_acceptance_status,
      p.gst_record_version,
      p.current_gst_evidence_revision_id,
      p.current_gst_calculation_id,
      p.current_gst_accounting_decision_id,
      p.supplier_invoice_no,
      p.gross_amount::text,
      p.total_discount::text,
      p.total_tax::text,
      p.net_amount::text,
      (SELECT count(*)::int FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS item_count,
      (SELECT count(*)::int FROM purchase_gst_evidence_revisions e WHERE e.tenant_id = p.tenant_id AND e.purchase_invoice_id = p.id) AS evidence_count,
      (SELECT count(*)::int FROM purchase_gst_calculations c WHERE c.tenant_id = p.tenant_id AND c.purchase_invoice_id = p.id) AS calculation_count,
      (SELECT count(*)::int FROM purchase_gst_accounting_decisions d WHERE d.tenant_id = p.tenant_id AND d.purchase_invoice_id = p.id) AS decision_count,
      (SELECT count(*)::int FROM purchase_gst_reconciliation_events e WHERE e.tenant_id = p.tenant_id AND e.purchase_invoice_id = p.id) AS event_count,
      (SELECT count(*)::int FROM purchase_posting_operations o WHERE o.tenant_id = p.tenant_id AND o.purchase_invoice_id = p.id) AS posting_operation_count,
      (SELECT count(*)::int FROM stock_movements s WHERE s.tenant_id = p.tenant_id AND s.reference_id = p.id) AS stock_movement_count,
      (SELECT count(*)::int FROM supplier_ledgers l WHERE l.tenant_id = p.tenant_id AND l.purchase_id = p.id) AS supplier_ledger_count,
      (SELECT count(*)::int FROM audit_logs a WHERE a.tenant_id = p.tenant_id AND a.target_id = p.id AND a.event_type = 'PURCHASE_FINALIZED') AS audit_count
    FROM purchase_invoices p
    WHERE p.id = $1 AND p.tenant_id = $2
  `, [purchaseId, ids.tenantA]);
  return result.rows[0] ?? null;
}

async function itemState(purchaseId) {
  const result = await db.query(`
    SELECT id, product_id, batch_no, quantity, free_qty, expiry_date, purchase_rate::text,
      discount_pct::text, discount_amount::text, gst_rate::text, gst_amount::text,
      calculated_taxable_value::text, calculated_cgst::text, calculated_sgst::text,
      calculated_igst::text, accepted_taxable_value::text, accepted_cgst::text,
      accepted_sgst::text, accepted_igst::text, accepted_cess::text,
      accepted_line_total::text, accepted_value_source, accepted_reason,
      accepted_at, accepted_by_membership_id, accepted_decision_id,
      gst_acceptance_status,
      gst_acceptance_reference, hsn_sac_catalog_id_snapshot, gst_rule_version_snapshot
      ,mrp::text, sale_rate::text, line_total::text,
      recoverable_itc::text, non_recoverable_gst::text,
      inventory_acquisition_cost::text, inventory_valuation_status
    FROM purchase_invoice_items
    WHERE tenant_id = $1 AND purchase_id = $2
    ORDER BY created_at, id
  `, [ids.tenantA, purchaseId]);
  return result.rows;
}

async function postingState(purchaseId) {
  const result = await db.query(`
    SELECT
      p.gross_amount::text,
      p.total_discount::text,
      p.total_tax::text,
      p.round_off::text,
      p.net_amount::text,
      (SELECT COALESCE(sum(i.accepted_taxable_value), 0)::text FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS accepted_taxable_total,
      (SELECT COALESCE(sum(i.accepted_cgst), 0)::text FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS accepted_cgst_total,
      (SELECT COALESCE(sum(i.accepted_sgst), 0)::text FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS accepted_sgst_total,
      (SELECT COALESCE(sum(i.accepted_line_total), 0)::text FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS accepted_line_total,
      (SELECT COALESCE(sum(i.line_total), 0)::text FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS canonical_line_total,
      (SELECT COALESCE(sum(i.gst_amount), 0)::text FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id) AS canonical_gst_amount,
      (SELECT count(*)::int FROM purchase_invoice_items i WHERE i.tenant_id = p.tenant_id AND i.purchase_id = p.id AND i.inventory_valuation_status = 'PENDING') AS pending_valuation_line_count,
      (SELECT count(*)::int
       FROM product_batches b
       WHERE b.tenant_id = p.tenant_id
         AND b.inventory_valuation_status = 'PENDING'
         AND EXISTS (
           SELECT 1
           FROM stock_movements s
           WHERE s.tenant_id = p.tenant_id
             AND s.reference_id = p.id
             AND s.batch_id = b.id
         )) AS pending_valuation_batch_count,
      (SELECT count(*)::int FROM stock_movements s WHERE s.tenant_id = p.tenant_id AND s.reference_id = p.id AND s.inventory_valuation_status = 'PENDING') AS pending_valuation_movement_count,
      (SELECT count(*)::int FROM stock_movements s WHERE s.tenant_id = p.tenant_id AND s.reference_id = p.id AND s.inventory_acquisition_cost IS NULL) AS null_valuation_movement_count,
      l.credit::text AS supplier_ledger_credit,
      l.balance::text AS supplier_ledger_balance,
      o.request_payload_hash,
      o.status AS posting_status,
      a.metadata AS audit_metadata
    FROM purchase_invoices p
    LEFT JOIN supplier_ledgers l
      ON l.tenant_id = p.tenant_id AND l.purchase_id = p.id
    LEFT JOIN purchase_posting_operations o
      ON o.tenant_id = p.tenant_id AND o.purchase_invoice_id = p.id
    LEFT JOIN audit_logs a
      ON a.tenant_id = p.tenant_id
      AND a.target_id = p.id
      AND a.event_type = 'PURCHASE_FINALIZED'
    WHERE p.id = $1 AND p.tenant_id = $2
    ORDER BY l.created_at DESC, o.created_at DESC, a.created_at DESC
    LIMIT 1
  `, [purchaseId, ids.tenantA]);
  return result.rows[0] ?? null;
}

function createDraftForm({ supplierId, supplierInvoiceNo, declaredTotal }) {
  const form = new ApplicationFormData();
  const fields = {
    invoice_no: supplierInvoiceNo,
    supplier_id: supplierId,
    supplier_invoice_no: supplierInvoiceNo,
    invoice_date: "2027-04-01",
    gst_treatment: `Registered Business ${String.fromCodePoint(0x2013)} Regular`,
    tax_mode: "EXCLUSIVE",
    gross_amount: "200",
    total_discount: "10",
    total_tax: "27",
    round_off: "0",
    net_amount: "217",
    declared_taxable_value: "190",
    declared_cgst: "13.50",
    declared_sgst: "13.50",
    declared_igst: "0",
    declared_cess: "0",
    declared_invoice_total: String(declaredTotal),
    declared_round_off: "0",
    supplier_state_at_transaction: "Maharashtra",
    recipient_state_at_transaction: "Maharashtra",
    delivery_state_at_transaction: "Maharashtra",
    supply_scenario: "INTRA_STATE",
    notes: "Purchase GST acceptance campaign",
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const lines = [
    { product_id: ids.productA, batch_no: "BATCH-A", quantity: "1", free_qty: "0", purchase_rate: "100", sale_rate: "120", mrp: "130", discount_pct: "0", gst_rate: "18", declared_taxable_value: "100", declared_cgst: "9", declared_sgst: "9", declared_igst: "0", declared_cess: "0", declared_line_total: "118" },
    { product_id: ids.productB, batch_no: "BATCH-B", quantity: "2", free_qty: "0", purchase_rate: "50", sale_rate: "60", mrp: "70", discount_pct: "10", gst_rate: "10", declared_taxable_value: "90", declared_cgst: "4.50", declared_sgst: "4.50", declared_igst: "0", declared_cess: "0", declared_line_total: "99" },
  ];
  lines.forEach((line, index) => {
    for (const [key, value] of Object.entries(line)) form.set(`lines[${index}].${key}`, value);
  });
  return form;
}

function formDataFromEntries(entries) {
  const form = new ApplicationFormData();
  for (const [key, value] of entries) form.set(key, value);
  return form;
}

class ApplicationFormData {
  constructor() {
    this.values = new Map();
  }
  set(key, value) {
    this.values.set(String(key), String(value));
  }
  get(key) {
    return this.values.get(String(key)) ?? null;
  }
  entries() {
    return Array.from(this.values.entries());
  }
}

async function runTest(id, functionName, userExternalId, purchaseId, expected, fn, predicate) {
  const before = purchaseId ? await purchaseState(purchaseId) : null;
  let actual;
  let error;
  try {
    actual = await invoke(userExternalId, fn);
  } catch (caught) {
    error = String(caught?.message ?? caught);
  }
  const after = purchaseId ? await purchaseState(purchaseId) : null;
  const afterFinancial = purchaseId ? await postingState(purchaseId) : null;
  const passed = predicate({ actual, error, before, after, afterFinancial });
  evidence.tests.push({
    id,
    function: functionName,
    source: "src/app/_actions/purchases.actions.ts",
    authentication: userExternalId,
    tenant: userExternalId === ids.externalUserA
      ? ids.tenantA
      : userExternalId === ids.externalUserB ? ids.tenantB : null,
    expected,
    actual: error ? { error } : actual,
    before,
    after,
    afterFinancial,
    status: passed ? "PASS" : "FAIL",
  });
  return { actual, error, before, after, passed };
}

async function createMatchedPurchase(suffix) {
  const supplierInvoiceNo = `${run.slice(-12)}-${suffix}`;
  let createResult;
  try {
    createResult = await invoke(ids.externalUserA, () => createPurchaseDraftAction(
      { ok: false },
      createDraftForm({ supplierId: ids.supplierA, supplierInvoiceNo, declaredTotal: 217 }),
    ));
  } catch (error) {
    if (!String(error?.message ?? error).startsWith("NEXT_REDIRECT:")) throw error;
  }
  const purchaseId = (await db.query(
    "SELECT id FROM purchase_invoices WHERE tenant_id = $1 AND supplier_invoice_no = $2",
    [ids.tenantA, supplierInvoiceNo],
  )).rows[0]?.id;
  if (!purchaseId) throw new Error(`Concurrent fixture was not created: ${JSON.stringify(createResult)}`);
  return purchaseId;
}

async function createAndAcceptMatchedPurchase(suffix) {
  const purchaseId = await createMatchedPurchase(suffix);
  const acceptance = await invoke(ids.externalUserA, () => acceptPurchaseGstAction(
    purchaseId,
    formDataFromEntries([
      ["decision_reference", `${run}-${suffix}-ACCEPT`],
      ["rationale", "Concurrent application-path validation."],
      ["accepted_value_source", "APPLICATION_CALCULATED"],
    ]),
  ));
  if (!acceptance?.ok) throw new Error(`Concurrent fixture acceptance failed: ${JSON.stringify(acceptance)}`);
  return purchaseId;
}

async function recordConcurrentTest(id, purchaseId, expected, operations, predicate) {
  const before = await purchaseState(purchaseId);
  const outcomes = await Promise.all(operations.map(async (operation) => {
    try {
      return { result: await invoke(ids.externalUserA, operation) };
    } catch (error) {
      return { error: String(error?.message ?? error) };
    }
  }));
  const after = await purchaseState(purchaseId);
  const afterFinancial = await postingState(purchaseId);
  const passed = predicate({ outcomes, before, after, afterFinancial });
  evidence.tests.push({
    id,
    function: "finalizePurchaseAction/acceptPurchaseGstAction",
    source: "src/app/_actions/purchases.actions.ts",
    authentication: ids.externalUserA,
    tenant: ids.tenantA,
    expected,
    actual: outcomes,
    before,
    after,
    afterFinancial,
    status: passed ? "PASS" : "FAIL",
  });
  return { outcomes, before, after, afterFinancial, passed };
}

async function main() {
  const {
    createTargetContract,
    schemaArtifactHash,
    targetContractBinding,
    validateTargetContract,
    verifyTargetSchema,
  } = await import("./financial-e2e-target-contract.mjs");
  const runtimeDatabaseUrl = new URL(databaseUrl.toString());
  runtimeDatabaseUrl.username = process.env.FINANCIAL_E2E_RUNTIME_DB_USER;
  runtimeDatabaseUrl.password = process.env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD;
  runtimeDatabaseUrl.searchParams.set("application_name", "pharmnos-purchase-gst");
  const targetContract = createTargetContract({
    runId: `${run}-provision`,
    targetUrl: databaseUrl.toString(),
    runtimeUrl: runtimeDatabaseUrl.toString(),
    databaseName,
    composeProject: process.env.FINANCIAL_E2E_COMPOSE_PROJECT || "pharmnoslite",
    schemaArtifactHash: schemaArtifactHash(),
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  });
  authorizedTargetContract = targetContract;
  validateAuthorizedTargetContract = validateTargetContract;
  authorizedTargetUrl = databaseUrl.toString();
  authorizedRuntimeUrl = runtimeDatabaseUrl.toString();
  process.env.FINANCIAL_E2E_TARGET_CONTRACT = JSON.stringify(targetContract);
  admin = await connect(process.env.TEST_DATABASE_URL);
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseUrl.searchParams.set("application_name", "pharmnos-financial-e2e");
  runtimeDatabaseUrl.searchParams.set("application_name", "pharmnos-financial-e2e");
  const provisioningIdentity = targetContractBinding(targetContract);
  execFileSync(process.execPath, ["scripts/financial-e2e-provision-local.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      TEST_DATABASE_URL: databaseUrl.toString(),
      TEST_DATABASE_NAME: databaseName,
      FINANCIAL_E2E_DB_NAME: databaseName,
      FINANCIAL_E2E_RUNTIME_DATABASE_URL: runtimeDatabaseUrl.toString(),
      FINANCIAL_E2E_AUTHORIZED_TARGET_BINDING: provisioningIdentity,
      FINANCIAL_E2E_RUN_ID: `${run}-provision`,
      FINANCIAL_E2E_INITIALIZATION_ATTEMPT_ID: `${run}-attempt`,
      FINANCIAL_E2E_INITIALIZATION_AUTHORIZED: "true",
      FINANCIAL_E2E_INITIALIZATION_SCOPE: "DATABASE_INITIALIZATION_ONLY",
      FINANCIAL_E2E_TARGET_APPROVED: "true",
      FINANCIAL_E2E_MARKER_ESTABLISHMENT_METHOD: "BOOTSTRAP_CONNECTED_CATALOG_READBACK",
      FINANCIAL_E2E_ROLE_SETUP_METHOD: "PRECREATED_LOCAL_CREDENTIAL_PROCEDURE",
      FINANCIAL_E2E_BASELINE_PACKAGE: "VERSION_PINNED_REVIEW_ARTIFACTS",
      FINANCIAL_E2E_EVIDENCE_MODE: "SANITIZED_APPEND_ONLY_LOCAL",
      FINANCIAL_E2E_EVIDENCE_RETENTION_DAYS: "30",
      FINANCIAL_E2E_EVIDENCE_PATH_APPROVED: "true",
      FINANCIAL_E2E_RECOVERY_POLICY: "UNTRUSTED_STOP_INSPECT_REAUTHORIZE_NEW_TARGET",
      FINANCIAL_E2E_TARGET_CONTRACT: JSON.stringify(targetContract),
    },
    stdio: "inherit",
  });
  db = await connect(databaseUrl.toString());
  const identity = (await db.query(`
    SELECT current_database() AS database_name, current_user AS current_user_name,
      session_user AS session_user_name, inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port
  `)).rows[0];
  evidence.databaseIdentity = identity;
  if (identity.database_name !== databaseName ||
      !String(identity.server_address).startsWith("172.") &&
      !["127.0.0.1", "::1"].includes(String(identity.server_address).split("/")[0])) {
    throw new Error("Database identity is not the approved disposable target.");
  }
  const role = (await db.query(`
    SELECT rolsuper AS is_superuser, rolbypassrls AS bypasses_rls
    FROM pg_roles WHERE rolname = current_user
  `)).rows[0];
  evidence.databaseRoleAssessment = {
    ...role,
    restrictedRuntimeRoleDemonstrated: true,
    rlsAcceptance: "APPLICATION_RUNTIME_ROLE_SEPARATELY_VERIFIED",
    reason: "Bootstrap role was used only for fixture setup and persisted-state assertions; application actions used the restricted runtime role.",
  };
  const runtimeProbe = await connect(runtimeDatabaseUrl.toString());
  evidence.applicationDatabaseIdentity = (await runtimeProbe.query(`
    SELECT current_database() AS database_name, current_user AS current_user_name,
      session_user AS session_user_name, inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port
  `)).rows[0];
  evidence.applicationDatabaseRoleAssessment = (await runtimeProbe.query(`
    SELECT rolcanlogin AS can_login, rolsuper AS is_superuser, rolbypassrls AS bypasses_rls
    FROM pg_roles WHERE rolname = current_user
  `)).rows[0];
  await verifyTargetSchema(runtimeProbe, targetContract);
  evidence.authenticatedTenantContext = {
    status: "VERIFIED",
    source: "authenticated session user ID -> users.external_id -> active membership",
    tenantClaimSource: "verified membership returned by getServerTenantContext",
    transactionClaims: "SET LOCAL request.jwt.claim.sub and request.jwt.claim.tenant_id",
    callerSuppliedTenantOverride: "REJECTED",
    fixedTenantConnectionClaim: "NOT USED",
    applicationRole: evidence.applicationDatabaseIdentity.current_user_name,
  };
  await runtimeProbe.end();

  await db.query(
    "INSERT INTO tenants (id,slug,business_name,updated_at) VALUES ($1,$3,'Purchase GST A',now()),($2,$4,'Purchase GST B',now())",
    [ids.tenantA, ids.tenantB, `${run}_a`, `${run}_b`],
  );
  await db.query(
    "INSERT INTO users (id,external_id,email,full_name,updated_at) VALUES ($1,$2,$3,'Purchase A',now()),($4,$5,$6,'Purchase B',now()),($7,$8,$9,'Inactive Purchase User',now())",
    [ids.userA, ids.externalUserA, `${ids.externalUserA}@example.invalid`, ids.userB, ids.externalUserB, `${ids.externalUserB}@example.invalid`, ids.userInactive, ids.externalUserInactive, `${ids.externalUserInactive}@example.invalid`],
  );
  await db.query(
    "INSERT INTO roles (id,tenant_id,name,is_default,updated_at) VALUES ($1,$3,'PURCHASE',true,now()),($2,$4,'NONE',true,now())",
    [ids.rolePurchase, ids.roleNone, ids.tenantA, ids.tenantB],
  );
  await db.query(
    "INSERT INTO memberships (id,tenant_id,user_id,role_id,status,updated_at) VALUES ($1,$3,$5,$7,'active',now()),($2,$4,$6,$8,'active',now()),($9,$3,$10,$8,'inactive',now())",
    [ids.membershipA, ids.membershipB, ids.tenantA, ids.tenantB, ids.userA, ids.userB, ids.rolePurchase, ids.roleNone, ids.membershipInactive, ids.userInactive],
  );
  const isolationA = await connect(runtimeDatabaseUrl.toString());
  const isolationB = await connect(runtimeDatabaseUrl.toString());
  let isolationPassed = false;
  try {
    await isolationA.query("BEGIN");
    await isolationA.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ids.externalUserA]);
    const [claimA, claimB, visibleA, visibleB] = await Promise.all([
      isolationA.query("SELECT current_setting('request.jwt.claim.sub', true) AS subject"),
      isolationB.query("SELECT current_setting('request.jwt.claim.sub', true) AS subject"),
      isolationA.query("SELECT count(*)::int AS count FROM users WHERE external_id = $1", [ids.externalUserA]),
      isolationB.query("SELECT count(*)::int AS count FROM users WHERE external_id = $1", [ids.externalUserA]),
    ]);
    await isolationA.query("COMMIT");
    const resetA = await isolationA.query("SELECT current_setting('request.jwt.claim.sub', true) AS subject");
    isolationPassed = claimA.rows[0].subject === ids.externalUserA &&
      !claimB.rows[0].subject &&
      visibleA.rows[0].count === 1 &&
      visibleB.rows[0].count === 0 &&
      !resetA.rows[0].subject;
    evidence.transactionClaimIsolation = {
      status: isolationPassed ? "PASS" : "FAIL",
      transactionA: { subject: claimA.rows[0].subject, visibleUserCount: visibleA.rows[0].count },
      concurrentTransactionB: { subject: claimB.rows[0].subject, visibleUserCount: visibleB.rows[0].count },
      afterCommitTransactionA: { subject: resetA.rows[0].subject },
      claims: "SET LOCAL semantics verified across independent pooled connections",
    };
  } finally {
    await isolationA.end();
    await isolationB.end();
  }
  if (!isolationPassed) throw new Error("Transaction-local tenant claims were not isolated.");
  await db.query(
    "INSERT INTO role_permissions (id,role_id,permission) VALUES ($1,$2,'create_purchase'),($3,$2,'accept_purchase_gst'),($4,$2,'finalize_purchase'),($5,$2,'view_purchase')",
    [`${run}_perm_create`, ids.rolePurchase, `${run}_perm_accept`, `${run}_perm_finalize`, `${run}_perm_view`],
  );
  await db.query(
    "INSERT INTO business_profiles (id,tenant_id,state,purchase_prefix,purchase_next_seq,updated_at) VALUES ($1,$2,'Maharashtra','PUR',1,now())",
    [`${run}_profile`, ids.tenantA],
  );
  await db.query(
    "INSERT INTO suppliers (id,tenant_id,code,business_name,state,payable_balance,updated_at) VALUES ($1,$3,'SUP-A','Supplier A','Maharashtra',0,now()),($2,$4,'SUP-B','Supplier B','Gujarat',0,now())",
    [ids.supplierA, ids.supplierB, ids.tenantA, ids.tenantB],
  );
  await db.query(
    "INSERT INTO products (id,tenant_id,sku,name,hsn_code,gst_rate,purchase_rate,updated_at) VALUES ($1,$3,'SKU-A','Product A','3004',18,100,now()),($2,$3,'SKU-B','Product B','2106',10,50,now())",
    [ids.productA, ids.productB, ids.tenantA],
  );
  await db.query(
    `INSERT INTO hsn_sac_catalog
      (id,tenant_id,code,description,classification_type,classification_status,rate_approval_status,
       source_reference,effective_from,is_active,classification_approved_by_membership_id,
       classification_approved_at,created_at,updated_at)
      VALUES ($1,$3,'3004','Approved A','GOODS','APPROVED','APPROVED','TEST-SOURCE',
              '2027-01-01',true,$4,now(),now(),now()),
             ($2,$3,'2106','Approved B','GOODS','APPROVED','APPROVED','TEST-SOURCE',
              '2027-01-01',true,$4,now(),now(),now())`,
    [ids.catalogA, ids.catalogB, ids.tenantA, ids.membershipA],
  );
  await db.query(
    `INSERT INTO gst_rate_rules
      (id,tenant_id,hsn_sac_catalog_id,rule_version,tax_rate,component_policy,approval_status,
       source_reference,effective_from,is_active,approved_by_membership_id,approved_at,created_at,updated_at)
      VALUES ($1,$5,$3,'PURCHASE-18',18,'IGST','APPROVED','TEST-RATE','2027-01-01',true,$6,now(),now(),now()),
             ($2,$5,$4,'PURCHASE-10',10,'IGST','APPROVED','TEST-RATE','2027-01-01',true,$6,now(),now(),now())`,
    [ids.ruleA, ids.ruleB, ids.catalogA, ids.catalogB, ids.tenantA, ids.membershipA],
  );
  evidence.fixture = {
    tenantA: ids.tenantA,
    tenantB: ids.tenantB,
    users: {
      authorized: { internalId: ids.userA, externalId: ids.externalUserA, membershipId: ids.membershipA, status: "active" },
      unrelated: { internalId: ids.userB, externalId: ids.externalUserB, membershipId: ids.membershipB, status: "active" },
      inactive: { internalId: ids.userInactive, externalId: ids.externalUserInactive, membershipId: ids.membershipInactive, status: "inactive" },
    },
    supplier: ids.supplierA,
    products: [ids.productA, ids.productB],
    approvedClassifications: [ids.catalogA, ids.catalogB],
    approvedRules: [ids.ruleA, ids.ruleB],
  };

  process.env.FINANCIAL_E2E_ALLOWED_DATABASE_NAME = databaseName;
  process.env.DATABASE_URL = runtimeDatabaseUrl.toString();
  ({ prisma } = require(path.join(root, "src/lib/db/prisma.ts")));
  ({ installFinancialE2eTestSession, clearFinancialE2eTestSession } =
    require(path.join(root, "src/adapters/auth/supabase-auth.adapter.ts")));
  ({ createPurchaseDraftAction, acceptPurchaseGstAction, resolvePurchaseGstDiscrepancyAction, finalizePurchaseAction } =
    require(path.join(root, "src/app/_actions/purchases.actions.ts")));

  evidence.applicationContexts = {
    authorized: { user: ids.externalUserA, tenant: ids.tenantA, permissions: ["create_purchase", "accept_purchase_gst", "finalize_purchase"] },
    unauthorized: { user: ids.externalUserB, tenant: ids.tenantB, permissions: [] },
    inactive: { user: ids.externalUserInactive, tenant: null, permissions: [] },
  };

  await runTest(
    "inactive_membership_rejected",
    "createPurchaseDraftAction",
    ids.externalUserInactive,
    null,
    "Authenticated user with only an inactive membership is denied before purchase access",
    () => createPurchaseDraftAction({ ok: false }, createDraftForm({
      supplierId: ids.supplierA,
      supplierInvoiceNo: `${run}-INACTIVE`,
      declaredTotal: 217,
    })),
    ({ actual, error, after, afterFinancial }) => actual?.ok === false &&
      !error &&
      actual.message === "Purchase draft could not be saved. Please try again." &&
      after === null &&
      afterFinancial === null,
  );

  const matchedDraftForm = await createDraftForm({ supplierId: ids.supplierA, supplierInvoiceNo: `${run}-SUP-001`, declaredTotal: 217 });
  const createResult = await runTest(
    "create_matched_mixed_rate_purchase",
    "createPurchaseDraftAction",
    ids.externalUserA,
    null,
    "Real draft action persists supplier evidence, governed calculation, line snapshots, and mixed-rate totals",
    () => createPurchaseDraftAction({ ok: false }, matchedDraftForm),
    ({ actual, error }) => Boolean(error?.startsWith("NEXT_REDIRECT:")) && !actual,
  );
  const matchedPurchase = (await db.query(
    "SELECT id FROM purchase_invoices WHERE tenant_id = $1 AND supplier_invoice_no = $2",
    [ids.tenantA, `${run}-SUP-001`],
  )).rows[0]?.id;
  evidence.createDraftResult = { error: createResult.error, purchaseId: matchedPurchase };
  if (!matchedPurchase) {
    throw new Error(`The real createPurchaseDraftAction did not create the matched purchase. result=${JSON.stringify(createResult)}`);
  }

  await runTest(
    "accept_authorized_calculated_values",
    "acceptPurchaseGstAction",
    ids.externalUserA,
    matchedPurchase,
    "Matched GST is explicitly accepted from application-calculated values",
    () => acceptPurchaseGstAction(matchedPurchase, formDataFromEntries([
      ["decision_reference", `${run}-ACCEPT-001`],
      ["rationale", "Calculated values match supplier declaration."],
      ["accepted_value_source", "APPLICATION_CALCULATED"],
    ])),
    ({ actual }) => actual?.ok === true && actual.data?.id === matchedPurchase,
  );
  await runTest(
    "accept_unauthorized_rejected",
    "acceptPurchaseGstAction",
    ids.externalUserB,
    matchedPurchase,
    "Cross-tenant unauthorized acceptance is rejected without mutation",
    () => acceptPurchaseGstAction(matchedPurchase, formDataFromEntries([
      ["decision_reference", `${run}-UNAUTHORIZED`],
      ["rationale", "Unauthorized"],
      ["accepted_value_source", "APPLICATION_CALCULATED"],
    ])),
    ({ actual, before, after }) => actual?.ok === false &&
      (String(actual.message).includes("authorized") ||
       String(actual.message).includes("no active tenant membership")) &&
      before?.decision_count === after?.decision_count &&
      before?.gst_accounting_acceptance_status === after?.gst_accounting_acceptance_status,
  );
  await runTest(
    "finalize_authorized_purchase",
    "finalizePurchaseAction",
    ids.externalUserA,
    matchedPurchase,
    "Finalization posts exactly one inventory movement, supplier ledger, audit event, and completed operation",
    () => finalizePurchaseAction(matchedPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-FINAL-001`]])),
    ({ error, after }) => Boolean(error?.startsWith("NEXT_REDIRECT:")) &&
      after?.status === "FINALIZED" &&
      after?.posting_operation_count === 1 &&
      after?.stock_movement_count === 2 &&
      after?.supplier_ledger_count === 1 &&
      after?.audit_count === 1,
  );
  const afterFinalizeItems = await itemState(matchedPurchase);
  evidence.matchedPurchaseFinalItems = afterFinalizeItems;
  await runTest(
    "finalize_same_key_replay",
    "finalizePurchaseAction",
    ids.externalUserA,
    matchedPurchase,
    "Same-key same-payload retry has one financial effect set",
    () => finalizePurchaseAction(matchedPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-FINAL-001`]])),
    ({ error, after }) => Boolean(error?.startsWith("NEXT_REDIRECT:")) &&
      after?.posting_operation_count === 1 &&
      after?.stock_movement_count === 2 &&
      after?.supplier_ledger_count === 1,
  );

  const sameKeyConcurrentPurchase = await createAndAcceptMatchedPurchase("SUP-CONCURRENT-SAME-KEY");
  await recordConcurrentTest(
    "finalize_concurrent_same_key_same_payload",
    sameKeyConcurrentPurchase,
    "Both requests complete as commit/replay with exactly one financial effect set",
    [
      () => finalizePurchaseAction(sameKeyConcurrentPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-CONCURRENT-SAME`]])),
      () => finalizePurchaseAction(sameKeyConcurrentPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-CONCURRENT-SAME`]])),
    ],
    ({ outcomes, after }) => outcomes.every(({ error }) => String(error ?? "").startsWith("NEXT_REDIRECT:")) &&
      after?.status === "FINALIZED" &&
      after?.posting_operation_count === 1 &&
      after?.stock_movement_count === 2 &&
      after?.supplier_ledger_count === 1 &&
      after?.audit_count === 1,
  );

  const differentKeyConcurrentPurchase = await createAndAcceptMatchedPurchase("SUP-CONCURRENT-DIFFERENT-KEY");
  await recordConcurrentTest(
    "finalize_concurrent_different_keys_same_purchase",
    differentKeyConcurrentPurchase,
    "Exactly one request commits and the competing key cannot create duplicate effects",
    [
      () => finalizePurchaseAction(differentKeyConcurrentPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-CONCURRENT-A`]])),
      () => finalizePurchaseAction(differentKeyConcurrentPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-CONCURRENT-B`]])),
    ],
    ({ outcomes, after }) => outcomes.filter(({ error }) => !error).length === 1 &&
      outcomes.filter(({ result }) => result?.ok === false).length === 1 &&
      after?.status === "FINALIZED" &&
      after?.posting_operation_count === 1 &&
      after?.stock_movement_count === 2 &&
      after?.supplier_ledger_count === 1 &&
      after?.audit_count === 1,
  );

  const concurrentAcceptancePurchase = await createMatchedPurchase("SUP-CONCURRENT-ACCEPTANCE-BASE");
  const acceptanceConcurrent = await recordConcurrentTest(
    "accept_concurrent_same_purchase",
    concurrentAcceptancePurchase,
    "One acceptance commits and the competing acceptance rolls back without duplicate decisions",
    [
      () => acceptPurchaseGstAction(concurrentAcceptancePurchase, formDataFromEntries([
        ["decision_reference", `${run}-CONCURRENT-ACCEPT`],
        ["rationale", "Concurrent acceptance validation."],
        ["accepted_value_source", "APPLICATION_CALCULATED"],
      ])),
      () => acceptPurchaseGstAction(concurrentAcceptancePurchase, formDataFromEntries([
        ["decision_reference", `${run}-CONCURRENT-ACCEPT`],
        ["rationale", "Concurrent acceptance validation."],
        ["accepted_value_source", "APPLICATION_CALCULATED"],
      ])),
    ],
    ({ outcomes, after }) => outcomes.filter(({ result }) => result?.ok === true).length === 1 &&
      (outcomes.filter(({ result }) => result?.ok === false).length === 1 ||
        outcomes.filter(({ error }) => Boolean(error)).length === 1) &&
      after?.decision_count === 1 &&
      after?.gst_accounting_acceptance_status === "ACCEPTED",
  );
  if (!acceptanceConcurrent.passed) throw new Error("Concurrent acceptance validation failed.");

  const rollbackPurchase = await createAndAcceptMatchedPurchase("SUP-ROLLBACK");
  const rollbackTriggerFunction = `${run}_forced_purchase_rollback`;
  const rollbackTrigger = `${run}_forced_purchase_rollback_trigger`;
  await db.query(`
    CREATE OR REPLACE FUNCTION "${rollbackTriggerFunction}"()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $forced$
    BEGIN
      RAISE EXCEPTION 'forced purchase posting failure for rollback validation';
    END;
    $forced$;
    CREATE TRIGGER "${rollbackTrigger}"
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION "${rollbackTriggerFunction}"();
  `);
  await runTest(
    "finalize_forced_failure_rolls_back_all_effects",
    "finalizePurchaseAction",
    ids.externalUserA,
    rollbackPurchase,
    "A failure after stock-effect attempt rolls back invoice, posting, stock, ledger, and audit changes",
    () => finalizePurchaseAction(rollbackPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-ROLLBACK`]])),
    ({ actual, before, after }) => actual?.ok === false &&
      String(actual.message).includes("forced purchase posting failure") &&
      before?.status === "DRAFT" &&
      after?.status === "DRAFT" &&
      after?.posting_operation_count === 0 &&
      after?.stock_movement_count === 0 &&
      after?.supplier_ledger_count === 0 &&
      after?.audit_count === 0,
  );
  await db.query(`DROP TRIGGER "${rollbackTrigger}" ON stock_movements; DROP FUNCTION "${rollbackTriggerFunction}"();`);
  await runTest(
    "finalize_retry_after_rollback",
    "finalizePurchaseAction",
    ids.externalUserA,
    rollbackPurchase,
    "Retry after rollback commits exactly one complete financial effect set",
    () => finalizePurchaseAction(rollbackPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-ROLLBACK`]])),
    ({ error, after }) => Boolean(error?.startsWith("NEXT_REDIRECT:")) &&
      after?.status === "FINALIZED" &&
      after?.posting_operation_count === 1 &&
      after?.stock_movement_count === 2 &&
      after?.supplier_ledger_count === 1 &&
      after?.audit_count === 1,
  );

  const discrepancyCreate = await runTest(
    "create_discrepant_purchase",
    "createPurchaseDraftAction",
    ids.externalUserA,
    null,
    "Supplier-declared discrepancy is retained and requires review",
    () => createPurchaseDraftAction({ ok: false }, createDraftForm({ supplierId: ids.supplierA, supplierInvoiceNo: `${run}-SUP-002`, declaredTotal: 218 })),
    ({ actual, error }) => Boolean(error?.startsWith("NEXT_REDIRECT:")) && !actual,
  );
  const discrepancyPurchase = (await db.query(
    "SELECT id FROM purchase_invoices WHERE tenant_id = $1 AND supplier_invoice_no = $2",
    [ids.tenantA, `${run}-SUP-002`],
  )).rows[0]?.id;
  evidence.discrepantPurchase = { error: discrepancyCreate.error, purchaseId: discrepancyPurchase };
  if (!discrepancyPurchase) {
    throw new Error(`The real createPurchaseDraftAction did not create the discrepancy purchase. result=${JSON.stringify(discrepancyCreate)}`);
  }

  await runTest(
    "accept_discrepancy_rejected",
    "acceptPurchaseGstAction",
    ids.externalUserA,
    discrepancyPurchase,
    "Discrepancy cannot be accepted by the matched-only acceptance path",
    () => acceptPurchaseGstAction(discrepancyPurchase, formDataFromEntries([
      ["decision_reference", `${run}-DISCREPANCY-ACCEPT`],
      ["rationale", "Must use explicit resolution."],
      ["accepted_value_source", "APPLICATION_CALCULATED"],
    ])),
    ({ actual, before, after }) => actual?.ok === false &&
      String(actual.message).includes("matched") &&
      before?.decision_count === after?.decision_count &&
      before?.gst_accounting_acceptance_status === after?.gst_accounting_acceptance_status,
  );
  const discrepancyItems = await itemState(discrepancyPurchase);
  const resolutionEntries = [
    ["decision_reference", `${run}-RESOLVE-001`],
    ["decision", "Accept explicitly documented line values"],
    ["rationale", "Explicit line-level values reconcile exactly to the invoice aggregate."],
    ["accepted_value_source", "EXPLICIT_DECISION"],
    ["accepted_taxable_value", "191"],
    ["accepted_cgst", "13.63"],
    ["accepted_sgst", "13.63"],
    ["accepted_igst", "0"],
    ["accepted_cess", "0"],
    ["accepted_invoice_total", "218.34"],
    ["accepted_round_off", "0"],
  ];
  resolutionEntries.push(
    ["gst_lines[0].item_id", discrepancyItems[0].id],
    ["gst_lines[0].accepted_taxable_value", "103"],
    ["gst_lines[0].accepted_cgst", "9.27"],
    ["gst_lines[0].accepted_sgst", "9.27"],
    ["gst_lines[0].accepted_igst", "0"],
    ["gst_lines[0].accepted_cess", "0"],
    ["gst_lines[0].accepted_line_total", "121.54"],
    ["gst_lines[0].line_reason", "Explicitly accepted line taxable value per accounting review."],
    ["gst_lines[1].item_id", discrepancyItems[1].id],
    ["gst_lines[1].accepted_taxable_value", "88"],
    ["gst_lines[1].accepted_cgst", "4.36"],
    ["gst_lines[1].accepted_sgst", "4.36"],
    ["gst_lines[1].accepted_igst", "0"],
    ["gst_lines[1].accepted_cess", "0"],
    ["gst_lines[1].accepted_line_total", "96.80"],
    ["gst_lines[1].line_reason", "Explicitly accepted line taxable value per accounting review."],
  );
  const resolutionForm = formDataFromEntries(resolutionEntries);
  const resolutionResult = await runTest(
    "resolve_discrepancy_explicit_decision",
    "resolvePurchaseGstDiscrepancyAction",
    ids.externalUserA,
    discrepancyPurchase,
    "Authorized line-level explicit resolution persists accepted values and audit metadata",
    () => resolvePurchaseGstDiscrepancyAction(discrepancyPurchase, resolutionForm),
    ({ actual }) => actual?.ok === true && actual.data?.id === discrepancyPurchase,
  );
  const resolvedState = await purchaseState(discrepancyPurchase);
  evidence.resolvedDiscrepancyState = resolvedState;
  evidence.resolvedDiscrepancyItems = await itemState(discrepancyPurchase);
  await runTest(
    "finalize_same_key_different_purchase_conflict",
    "finalizePurchaseAction",
    ids.externalUserA,
    discrepancyPurchase,
    "A completed idempotency key cannot be reused for a different purchase",
    () => finalizePurchaseAction(discrepancyPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-FINAL-001`]])),
    ({ actual, before, after }) => actual?.ok === false &&
      String(actual.message).includes("different purchase payload") &&
      before?.status === after?.status &&
      before?.posting_operation_count === after?.posting_operation_count,
  );
  const explicitFinalize = await runTest(
    "finalize_explicit_decision_purchase",
    "finalizePurchaseAction",
    ids.externalUserA,
    discrepancyPurchase,
    "Explicit line-level accepted values reconcile and reach atomic final financial posting",
    () => finalizePurchaseAction(discrepancyPurchase, { ok: false }, formDataFromEntries([["idempotency_key", `${run}-FINAL-002`]])),
    ({ error, after, afterFinancial }) => Boolean(error?.startsWith("NEXT_REDIRECT:")) &&
      after?.status === "FINALIZED" &&
      after?.posting_operation_count === 1 &&
      after?.stock_movement_count === 2 &&
      after?.supplier_ledger_count === 1 &&
      after?.audit_count === 1 &&
      after?.gross_amount === "201.00" &&
      after?.total_tax === "27.26" &&
      after?.net_amount === "218.34" &&
      afterFinancial?.accepted_taxable_total === "191.0000" &&
      afterFinancial?.accepted_cgst_total === "13.6300" &&
      afterFinancial?.accepted_sgst_total === "13.6300" &&
      afterFinancial?.accepted_line_total === "218.3400" &&
      afterFinancial?.canonical_line_total === "218.34" &&
      afterFinancial?.canonical_gst_amount === "27.26" &&
      afterFinancial?.pending_valuation_line_count === 2 &&
      afterFinancial?.pending_valuation_batch_count === 2 &&
      afterFinancial?.pending_valuation_movement_count === 2 &&
      afterFinancial?.null_valuation_movement_count === 2 &&
      afterFinancial?.supplier_ledger_credit === "218.34" &&
      afterFinancial?.audit_metadata?.net_amount === 218.34 &&
      afterFinancial?.posting_status === "COMPLETED",
  );
  const explicitItems = await itemState(discrepancyPurchase);
  const explicitPostingState = await postingState(discrepancyPurchase);
  const expectedPostingPayload = {
    purchase_id: discrepancyPurchase,
    supplier_invoice_no: resolvedState.supplier_invoice_no,
    gst_record_version: resolvedState.gst_record_version,
    current_gst_evidence_revision_id: resolvedState.current_gst_evidence_revision_id,
    current_gst_calculation_id: resolvedState.current_gst_calculation_id,
    current_gst_accounting_decision_id: resolvedState.current_gst_accounting_decision_id,
    totals: {
      gross_amount: "201",
      total_discount: "10",
      total_tax: "27.26",
      round_off: "0",
      net_amount: "218.34",
    },
    items: explicitItems.map((item) => ({
      product_id: item.product_id,
      batch_no: item.batch_no,
      expiry_date: item.expiry_date?.toISOString() ?? null,
      quantity: item.quantity,
      free_qty: item.free_qty,
      purchase_rate: String(Number(item.purchase_rate)),
      discount_pct: item.discount_pct === null ? null : String(Number(item.discount_pct)),
      discount_amount: String(Number(item.discount_amount)),
      gst_rate: String(Number(item.gst_rate)),
      gst_amount: String(Number(item.gst_amount)),
      accepted_taxable_value: String(Number(item.accepted_taxable_value)),
      accepted_cgst: String(Number(item.accepted_cgst)),
      accepted_sgst: String(Number(item.accepted_sgst)),
      accepted_igst: String(Number(item.accepted_igst)),
      accepted_cess: String(Number(item.accepted_cess)),
      accepted_line_total: String(Number(item.accepted_line_total)),
      mrp: item.mrp === null ? null : String(Number(item.mrp)),
      sale_rate: item.sale_rate === null ? null : String(Number(item.sale_rate)),
      line_total: String(Number(item.line_total)),
    })),
  };
  evidence.explicitDecisionPostingAssessment = {
    result: explicitFinalize,
    items: explicitItems,
    financialState: explicitPostingState,
    expectedPostingPayload,
    postingPayloadHashMatchesAcceptedSnapshot:
      explicitPostingState.request_payload_hash === requestHash(expectedPostingPayload),
    verdict: "ACCEPTED",
    note: "Explicit line-level values were supplied by the authorized accounting decision, reconciled exactly to invoice aggregates, persisted with actor/source/reason metadata, and posted atomically.",
  };
  if (!evidence.explicitDecisionPostingAssessment.postingPayloadHashMatchesAcceptedSnapshot) {
    const postingTest = evidence.tests.find((test) => test.id === "finalize_explicit_decision_purchase");
    if (postingTest) {
      postingTest.status = "FAIL";
      postingTest.actual = {
        ...(postingTest.actual ?? {}),
        error: "Posting payload hash did not match the persisted accepted snapshot.",
      };
    }
  }
  evidence.verdict = "PARTIALLY_ACCEPTED";
  evidence.blockers = [
    "Cess, inclusive-tax, freight allocation, discount allocation, rounding precedence, and discrepancy tolerance policies remain unresolved where applicable.",
  ];

  await db.end();
  await prisma.$disconnect();
  const cleanupCheck = validateAuthorizedTargetContract({
    contract: authorizedTargetContract,
    targetUrl: databaseUrl.toString(),
    runtimeUrl: runtimeDatabaseUrl.toString(),
    ordinaryUrl: ordinaryDatabaseUrl,
  });
  if (!cleanupCheck.ok || authorizedTargetContract.databaseName !== databaseName) {
    throw new Error("Cleanup target does not match the authorized immutable target contract.");
  }
  await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  evidence.cleanup.databaseDropped = true;
  evidence.cleanup.databaseVerifiedAbsent =
    (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])).rowCount === 0;
  await admin.end();
  evidence.cleanup.verifiedAbsent = evidence.cleanup.databaseVerifiedAbsent;
  const output = `.obsidian-vault/specs/purchase-gst-application-evidence-${run}.json`;
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`PURCHASE_GST_EVIDENCE=${output}`);
  console.log(`PURCHASE_GST_RESULTS=${evidence.tests.length}`);
  console.log(`PURCHASE_GST_FAILURES=${evidence.tests.filter((test) => test.status !== "PASS").length}`);
  if (evidence.tests.some((test) => test.status !== "PASS") || !evidence.cleanup.verifiedAbsent) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error?.stack ?? error);
  try { await db?.end(); } catch {}
  try { await prisma?.$disconnect(); } catch {}
  try {
    if (admin && authorizedTargetContract && validateAuthorizedTargetContract) {
      const cleanupCheck = validateAuthorizedTargetContract({
        contract: authorizedTargetContract,
        targetUrl: authorizedTargetUrl,
        runtimeUrl: authorizedRuntimeUrl,
        ordinaryUrl: ordinaryDatabaseUrl,
      });
      if (!cleanupCheck.ok || authorizedTargetContract.databaseName !== databaseName) {
        console.error("CLEANUP=BLOCKED_TARGET_CONTRACT_MISMATCH");
        throw new Error("Cleanup target did not match the authorized immutable target contract.");
      }
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.end();
    }
  } catch {}
  process.exitCode = 1;
});
