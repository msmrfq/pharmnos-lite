import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { createRequire } from "node:module";
import pg from "pg";
import { verifyDatabaseIdentity } from "./financial-e2e-safety.mjs";
import {
  cleanupRunOwnedFixtures,
  createFixtureManifest,
  recordFixtureIdentifiers,
} from "./financial-e2e-fixture-lifecycle.mjs";
import {
  CLEANUP_TABLES,
  collectOwnedResources,
} from "./financial-e2e-fixture-ownership.mjs";
import { targetContractBinding, verifyTargetSchema } from "./financial-e2e-target-contract.mjs";
import {
  createLifecycleEvidence,
  loadAuthorizedTargetLifecycle,
  loadFinancialE2eEnvironment,
  writeLifecycleEvidence,
} from "./financial-e2e-target-lifecycle.mjs";

const { Client } = pg;
const require = createRequire(import.meta.url);
const root = process.cwd();
const SALES_SOURCE_FILES = [
  "src/app/_actions/sales.actions.ts",
  "src/domain/services/gst-calculator.service.ts",
  "src/lib/decimal.ts",
  "prisma/schema.prisma",
  "prisma/financial-e2e-schema-provisioning.generated.sql",
  "scripts/gst-application-e2e-runner.mjs",
];
const sourceHashes = () => Object.fromEntries(
  SALES_SOURCE_FILES.map((file) => [
    file,
    crypto.createHash("sha256").update(fs.readFileSync(path.resolve(root, file))).digest("hex"),
  ]),
);
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  jsx: "preserve",
});
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
const {
  installFinancialE2eTestSession,
  clearFinancialE2eTestSession,
} = require("../src/adapters/auth/index.ts");
let APPROVED;
let LIFECYCLE;
let salesPersistenceEvidence = null;

async function cleanupOwnedResources(plan, client) {
  await client.query("BEGIN");
  try {
    for (const resourceType of plan.order) {
      const ids = plan.resources
        .filter((resource) => resource.resourceType === resourceType)
        .map((resource) => resource.id);
      if (ids.length === 0) continue;
      const table = CLEANUP_TABLES[resourceType];
      await client.query(`DELETE FROM ${table} WHERE id::text = ANY($1::text[])`, [ids]);
    }
    await client.query("COMMIT");
    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

function loadEnv() {
  Object.assign(process.env, loadFinancialE2eEnvironment(process.env));
}

function targetUrl(name, password, options = "") {
  const url = new URL(process.env[name]);
  url.username = name.includes("RUNTIME") ? APPROVED.runtimeRole : APPROVED.bootstrapRole;
  url.password = password;
  if (options) url.searchParams.set("options", options);
  url.searchParams.set("application_name", APPROVED.marker);
  return url.toString();
}

function id(label) {
  return `gst_e2e_${label}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function query(client, text, values) {
  return (await client.query(text, values)).rows;
}

async function gate() {
  loadEnv();
  LIFECYCLE = loadAuthorizedTargetLifecycle({
    env: process.env,
    phase: "SUITE_EXECUTION",
    suiteName: "sales-gst",
  });
  APPROVED = LIFECYCLE.contract;
  assert.equal(process.env.ALLOW_FINANCIAL_E2E, "true");
  assert.equal(process.env.TEST_DATABASE_NAME, APPROVED.databaseName);
  assert.equal(process.env.TEST_DATABASE_MARKER, APPROVED.marker);
  const configured = new URL(process.env.TEST_DATABASE_URL);
  assert.equal(configured.hostname, APPROVED.host);
  assert.equal(Number(configured.port), APPROVED.port);
  assert.equal(configured.pathname, `/${APPROVED.databaseName}`);
  assert.equal(process.env.FINANCIAL_E2E_RUNTIME_DB_USER, APPROVED.runtimeRole);
  const bootstrap = new Client({ connectionString: targetUrl("TEST_DATABASE_URL", process.env.FINANCIAL_E2E_DB_PASSWORD) });
  await bootstrap.connect();
  try {
    await bootstrap.query("SELECT set_config('pharmnos.financial_e2e_marker', $1, false)", [APPROVED.marker]);
    const identity = (await bootstrap.query(`
      SELECT current_database() AS database_name,
             current_user AS current_user_name,
             session_user AS session_user_name,
             current_setting('application_name', true) AS application_name,
             current_setting('pharmnos.financial_e2e_marker', true) AS environment_marker
    `)).rows[0];
    assert.equal(identity.database_name, APPROVED.databaseName);
    assert.equal(identity.current_user_name, APPROVED.bootstrapRole);
    assert.equal(identity.session_user_name, APPROVED.bootstrapRole);
    assert.equal(identity.application_name, APPROVED.marker);
    assert.equal(identity.environment_marker, APPROVED.marker);
    const runtime = (await bootstrap.query(
      "SELECT rolcanlogin, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1",
      [APPROVED.runtimeRole],
    )).rows[0];
    assert.ok(runtime, "The restricted runtime role has not been initialized.");
    assert.equal(runtime.rolcanlogin, true);
    assert.equal(runtime.rolsuper, false);
    assert.equal(runtime.rolbypassrls, false);
    await verifyTargetSchema(bootstrap, APPROVED);
    const catalog = (await bootstrap.query(`
      SELECT
        (SELECT count(*) FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relkind = 'r'
           AND c.relrowsecurity
           AND c.relname NOT IN ('q14_maintenance_probe', 'q14_trigger_allowlist')) AS rls_tables,
        (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS triggers
    `)).rows[0];
    assert.equal(Number(catalog.rls_tables), 33);
    assert.equal(Number(catalog.triggers), 16);
    return bootstrap;
  } catch (error) {
    await bootstrap.end();
    throw error;
  }
}

async function createFixture(bootstrap) {
  const tenant = id("tenant");
  const user = id("user");
  const role = id("role");
  const membership = id("membership");
  const profile = id("profile");
  const customer = id("customer");
  const supplier = id("supplier");
  const productA = id("product_a");
  const productB = id("product_b");
  const batchA = id("batch_a");
  const batchB = id("batch_b");
  const sales = id("sales");
  const salesItemA = id("sales_item_a");
  const salesItemB = id("sales_item_b");
  const purchase = id("purchase");
  const purchaseItem = id("purchase_item");
  const purchaseConflict = id("purchase_conflict");
  const salesSuccess = id("sales_success");
  const salesSuccessItem = id("sales_success_item");
  const purchaseSuccess = id("purchase_success");
  const purchaseSuccessItem = id("purchase_success_item");
  const purchaseReview = id("purchase_review");
  const purchaseReviewItem = id("purchase_review_item");
  const reviewEvidence = id("review_evidence");
  const reviewCalculation = id("review_calculation");
  const invoiceUser = `${user}@financial-e2e.invalid`;
  await bootstrap.query("BEGIN");
  try {
    await bootstrap.query("INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1,$2,$3,now())", [tenant, `${APPROVED.runId}-${tenant}`, "GST E2E Business"]);
    await bootstrap.query("INSERT INTO users (id, external_id, email, full_name, updated_at) VALUES ($1,$2,$3,$4,now())", [user, invoiceUser, invoiceUser, "GST E2E User"]);
    await bootstrap.query("INSERT INTO roles (id, tenant_id, name, is_default, updated_at) VALUES ($1,$2,$3,true,now())", [role, tenant, "GST E2E Role"]);
    await bootstrap.query("INSERT INTO memberships (id, tenant_id, user_id, role_id, status, updated_at) VALUES ($1,$2,$3,$4,'active',now())", [membership, tenant, user, role]);
    for (const permission of ["create_purchase", "accept_purchase_gst", "finalize_invoice", "finalize_purchase", "view_invoice", "view_customer_ledger", "view_supplier_ledger", "edit_product", "edit_customer"]) {
      await bootstrap.query("INSERT INTO role_permissions (id, role_id, permission) VALUES ($1,$2,$3)", [id(`permission_${permission}`), role, permission]);
    }
    await bootstrap.query("INSERT INTO business_profiles (id, tenant_id, state, invoice_prefix, invoice_next_seq, purchase_prefix, purchase_next_seq, updated_at) VALUES ($1,$2,'MH','INV',41,'PUR',71,now())", [profile, tenant]);
    await bootstrap.query("INSERT INTO customers (id, tenant_id, business_name, billing_state, receivable_balance, updated_at) VALUES ($1,$2,'GST Customer','MH',250,now())", [customer, tenant]);
    await bootstrap.query("INSERT INTO suppliers (id, tenant_id, business_name, payable_balance, updated_at) VALUES ($1,$2,'GST Supplier',125,now())", [supplier, tenant]);
    for (const [product, name] of [[productA, "GST Product A"], [productB, "GST Product B"]]) {
      await bootstrap.query("INSERT INTO products (id, tenant_id, name, generic_name, hsn_code, gst_rate, standard_sale_rate, updated_at) VALUES ($1,$2,$3,$4,'3004',18,100,now())", [product, tenant, name, `${name} Generic`]);
    }
    const catalog = id("catalog");
    const catalogNine = id("catalog_9999");
    const rateRule = id("rate_rule");
    await bootstrap.query(`INSERT INTO hsn_sac_catalog (id,tenant_id,code,description,classification_type,classification_status,rate_approval_status,source_reference,effective_from,is_active,classification_approved_by_membership_id,classification_approved_at,created_at,updated_at) VALUES ($1,$2,'3004','GST E2E Goods','GOODS','APPROVED','APPROVED','E2E-SOURCE','2020-01-01',true,$3,now(),now(),now()), ($4,$2,'9999','GST E2E Edited Goods','GOODS','APPROVED','APPROVED','E2E-SOURCE','2020-01-01',true,$3,now(),now(),now())`, [catalog, tenant, membership, catalogNine]);
    await bootstrap.query(`INSERT INTO gst_rate_rules (id,tenant_id,hsn_sac_catalog_id,rule_version,tax_rate,component_policy,approval_status,source_reference,effective_from,is_active,approved_by_membership_id,approved_at,created_at,updated_at) VALUES ($1,$2,$3,'e2e-v1',18,'IGST','APPROVED','E2E-RATE','2020-01-01',true,$4,now(),now(),now())`, [rateRule, tenant, catalog, membership]);
    await bootstrap.query("INSERT INTO product_batches (id, tenant_id, product_id, batch_no, sale_rate, received_qty, available_qty, updated_at) VALUES ($1,$2,$3,'A-1',100,1,1,now()), ($4,$2,$5,'B-1',100,1,0,now())", [batchA, tenant, productA, batchB, productB]);
    await bootstrap.query(`INSERT INTO sales_invoices (id,tenant_id,invoice_no,customer_id,invoice_date,status,gst_treatment,tax_mode,gross_amount,total_discount,total_tax,net_amount,balance_due,place_of_supply_code,updated_at)
    VALUES ($1,$2,$4,$3,now(),'DRAFT','Registered Business – Regular','EXCLUSIVE',200,0,36,236,236,'MH',now())`, [sales, tenant, customer, `DRAFT-${sales.slice(-8)}`]);
    await bootstrap.query(`INSERT INTO sales_invoice_items (id,tenant_id,invoice_id,product_id,batch_id,batch_no,quantity,sale_rate,gst_rate,line_total)
    VALUES ($1,$2,$3,$4,$5,'A-1',1,100,18,118),($6,$2,$3,$7,$8,'B-1',1,100,18,118)`, [salesItemA, tenant, sales, productA, batchA, salesItemB, productB, batchB]);
    await bootstrap.query("INSERT INTO product_batches (id, tenant_id, product_id, batch_no, sale_rate, received_qty, available_qty, updated_at) VALUES ($1,$2,$3,'SUCCESS-1',100,5,5,now())", [id("success_batch"), tenant, productA]);
    const successBatch = (await bootstrap.query("SELECT id FROM product_batches WHERE tenant_id=$1 AND product_id=$2 AND batch_no='SUCCESS-1'", [tenant, productA])).rows[0].id;
    await bootstrap.query(`INSERT INTO sales_invoices (id,tenant_id,invoice_no,customer_id,invoice_date,status,gst_treatment,tax_mode,gross_amount,total_discount,total_tax,net_amount,balance_due,place_of_supply_code,updated_at)
      VALUES ($1,$2,$4,$3,now(),'DRAFT','Registered Business – Regular','EXCLUSIVE',100,0,18,118,118,'MH',now())`, [salesSuccess, tenant, customer, `DRAFT-${salesSuccess.slice(-8)}`]);
    await bootstrap.query(`INSERT INTO sales_invoice_items (id,tenant_id,invoice_id,product_id,batch_id,batch_no,quantity,sale_rate,gst_rate,line_total)
      VALUES ($1,$2,$3,$4,$5,'SUCCESS-1',1,100,18,118)`, [salesSuccessItem, tenant, salesSuccess, productA, successBatch]);
    await bootstrap.query("INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,supplier_invoice_no,invoice_date,status,gst_treatment,tax_mode,gst_reconciliation_status,gst_accounting_acceptance_status,gst_record_version,gross_amount,total_discount,total_tax,round_off,net_amount,updated_at) VALUES ($1,$2,'',$3,NULL,now(),'DRAFT','Registered Business – Regular','EXCLUSIVE','MATCHED','ACCEPTED',0,100,0,18,0,118,now()), ($4,$2,'PUR-00071',$3,'CONFLICT',now(),'DRAFT','Registered Business – Regular','EXCLUSIVE','NOT_RECONCILED','NOT_ACCEPTED',0,100,0,0,0,100,now())", [purchase, tenant, supplier, purchaseConflict]);
    await bootstrap.query("INSERT INTO purchase_invoice_items (id,tenant_id,purchase_id,product_id,batch_no,quantity,purchase_rate,gst_rate,gst_amount,line_total) VALUES ($1,$2,$3,$4,'P-1',1,100,18,18,118)", [purchaseItem, tenant, purchase, productA]);
    const evidence = id("evidence");
    const calculation = id("calculation");
    const decision = id("decision");
    await bootstrap.query("INSERT INTO purchase_gst_evidence_revisions (id,tenant_id,purchase_invoice_id,revision_number,revision_kind,source_document_reference,capture_channel,captured_by_membership_id,declared_taxable_value,declared_cgst,declared_sgst,declared_igst,declared_cess,declared_invoice_total,declared_round_off) VALUES ($1,$2,$3,1,'INITIAL','E2E-SOURCE-ROLLBACK','E2E',$4,100,9,9,0,0,118,0)", [evidence, tenant, purchase, membership]);
    await bootstrap.query("INSERT INTO purchase_gst_calculations (id,tenant_id,purchase_invoice_id,evidence_revision_id,rule_version,calculated_taxable_value,calculated_cgst,calculated_sgst,calculated_igst,calculated_cess,calculated_invoice_total,calculated_round_off) VALUES ($1,$2,$3,$4,'e2e-v1',100,9,9,0,0,118,0)", [calculation, tenant, purchase, evidence]);
    await bootstrap.query("INSERT INTO purchase_gst_accounting_decisions (id,tenant_id,purchase_invoice_id,evidence_revision_id,calculation_id,accepted_taxable_value,accepted_cgst,accepted_sgst,accepted_igst,accepted_cess,accepted_invoice_total,accepted_round_off,accepted_value_source,decision_reference,decision_outcome,rationale,decided_by_membership_id) VALUES ($1,$2,$3,$4,$5,100,9,9,0,0,118,0,'SUPPLIER_DECLARED','E2E-ACCEPT','ACCEPTED','E2E',$6)", [decision, tenant, purchase, evidence, calculation, membership]);
    await bootstrap.query("UPDATE purchase_invoices SET current_gst_evidence_revision_id=$1,current_gst_calculation_id=$2,current_gst_accounting_decision_id=$3 WHERE id=$4 AND tenant_id=$5", [evidence, calculation, decision, purchase, tenant]);
    await bootstrap.query("INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,supplier_invoice_no,invoice_date,status,gst_treatment,tax_mode,gst_reconciliation_status,gst_accounting_acceptance_status,gst_record_version,gross_amount,total_discount,total_tax,round_off,net_amount,updated_at) VALUES ($1,$2,$5,$3,$4,now(),'DRAFT','Registered Business – Regular','EXCLUSIVE','MATCHED','ACCEPTED',0,100,0,18,0,118,now())", [purchaseSuccess, tenant, supplier, `SUCCESS-${purchaseSuccess.slice(-8)}`, `DRAFT-${purchaseSuccess.slice(-8)}`]);
    await bootstrap.query("INSERT INTO purchase_invoice_items (id,tenant_id,purchase_id,product_id,batch_no,quantity,purchase_rate,gst_rate,gst_amount,line_total,hsn_code_snapshot,calculated_taxable_value,calculated_cgst,calculated_sgst,calculated_igst,calculated_cess,gst_calculation_reference) VALUES ($1,$2,$3,$4,'SUCCESS-P-1',2,50,18,18,118,'3004',100,9,9,0,0,'e2e-v1')", [purchaseSuccessItem, tenant, purchaseSuccess, productA]);
    const successEvidence = id("success_evidence");
    const successCalculation = id("success_calculation");
    const successDecision = id("success_decision");
    await bootstrap.query("INSERT INTO purchase_gst_evidence_revisions (id,tenant_id,purchase_invoice_id,revision_number,revision_kind,source_document_reference,capture_channel,captured_by_membership_id,declared_taxable_value,declared_cgst,declared_sgst,declared_igst,declared_cess,declared_invoice_total,declared_round_off) VALUES ($1,$2,$3,1,'INITIAL','E2E-SOURCE-SUCCESS','E2E',$4,100,9,9,0,0,118,0)", [successEvidence, tenant, purchaseSuccess, membership]);
    await bootstrap.query("INSERT INTO purchase_gst_calculations (id,tenant_id,purchase_invoice_id,evidence_revision_id,rule_version,calculated_taxable_value,calculated_cgst,calculated_sgst,calculated_igst,calculated_cess,calculated_invoice_total,calculated_round_off) VALUES ($1,$2,$3,$4,'e2e-v1',100,9,9,0,0,118,0)", [successCalculation, tenant, purchaseSuccess, successEvidence]);
    await bootstrap.query("INSERT INTO purchase_gst_line_evidence (id,tenant_id,purchase_invoice_id,evidence_revision_id,purchase_invoice_item_id,declared_taxable_value,declared_cgst,declared_sgst,declared_igst,declared_cess,declared_line_total) VALUES ($1,$2,$3,$4,$5,100,9,9,0,0,118)", [id("success_line_evidence"), tenant, purchaseSuccess, successEvidence, purchaseSuccessItem]);
    await bootstrap.query("INSERT INTO purchase_gst_accounting_decisions (id,tenant_id,purchase_invoice_id,evidence_revision_id,calculation_id,accepted_taxable_value,accepted_cgst,accepted_sgst,accepted_igst,accepted_cess,accepted_invoice_total,accepted_round_off,accepted_value_source,decision_reference,decision_outcome,rationale,decided_by_membership_id) VALUES ($1,$2,$3,$4,$5,100,9,9,0,0,118,0,'SUPPLIER_DECLARED','E2E-SUCCESS','ACCEPTED','E2E',$6)", [successDecision, tenant, purchaseSuccess, successEvidence, successCalculation, membership]);
    await bootstrap.query("UPDATE purchase_invoice_items SET accepted_taxable_value=100, accepted_cgst=9, accepted_sgst=9, accepted_igst=0, accepted_cess=0, accepted_line_total=118, accepted_value_source='SUPPLIER_DECLARED', accepted_at=now(), accepted_by_membership_id=$2, accepted_decision_id=$3, gst_acceptance_reference='E2E-SUCCESS', gst_acceptance_status='ACCEPTED' WHERE id=$1 AND tenant_id=$4", [purchaseSuccessItem, membership, successDecision, tenant]);
    await bootstrap.query("UPDATE purchase_invoices SET current_gst_evidence_revision_id=$1,current_gst_calculation_id=$2,current_gst_accounting_decision_id=$3 WHERE id=$4 AND tenant_id=$5", [successEvidence, successCalculation, successDecision, purchaseSuccess, tenant]);
    await bootstrap.query("INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,supplier_invoice_no,invoice_date,status,gst_treatment,tax_mode,gst_reconciliation_status,gst_accounting_acceptance_status,gst_record_version,gross_amount,total_discount,total_tax,round_off,net_amount,updated_at) VALUES ($1,$2,$5,$3,$4,now(),'DRAFT','Registered Business – Regular','EXCLUSIVE','DISCREPANCY_REQUIRES_REVIEW','NOT_ACCEPTED',0,100,0,18,0,118,now())", [purchaseReview, tenant, supplier, `REVIEW-${purchaseReview.slice(-8)}`, `DRAFT-${purchaseReview.slice(-8)}`]);
    await bootstrap.query("INSERT INTO purchase_invoice_items (id,tenant_id,purchase_id,product_id,batch_no,quantity,purchase_rate,gst_rate,gst_amount,line_total) VALUES ($1,$2,$3,$4,'REVIEW-P-1',1,100,18,18,118)", [purchaseReviewItem, tenant, purchaseReview, productA]);
    await bootstrap.query("INSERT INTO purchase_gst_evidence_revisions (id,tenant_id,purchase_invoice_id,revision_number,revision_kind,source_document_reference,capture_channel,captured_by_membership_id,declared_taxable_value,declared_cgst,declared_sgst,declared_igst,declared_cess,declared_invoice_total,declared_round_off) VALUES ($1,$2,$3,1,'INITIAL','E2E-SOURCE-REVIEW','E2E',$4,100,9,9,0,0,118,0)", [reviewEvidence, tenant, purchaseReview, membership]);
    await bootstrap.query("INSERT INTO purchase_gst_calculations (id,tenant_id,purchase_invoice_id,evidence_revision_id,rule_version,calculated_taxable_value,calculated_cgst,calculated_sgst,calculated_igst,calculated_cess,calculated_invoice_total,calculated_round_off) VALUES ($1,$2,$3,$4,'e2e-v1',100,10,8,0,0,118,0)", [reviewCalculation, tenant, purchaseReview, reviewEvidence]);
    await bootstrap.query("UPDATE purchase_invoices SET current_gst_evidence_revision_id=$1,current_gst_calculation_id=$2 WHERE id=$3 AND tenant_id=$4", [reviewEvidence, reviewCalculation, purchaseReview, tenant]);
    await bootstrap.query("COMMIT");
    return { tenant, user, externalId: invoiceUser, membership, profile, customer, supplier, productA, productB, batchA, batchB, sales, salesItemA, salesItemB, salesSuccess, salesSuccessItem, purchase, purchaseItem, purchaseConflict, purchaseSuccess, purchaseSuccessItem, purchaseReview };
  } catch (error) {
    await bootstrap.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function appClient(tenant) {
  const url = targetUrl("FINANCIAL_E2E_RUNTIME_DATABASE_URL", process.env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD, `-c request.jwt.claim.tenant_id=${tenant}`);
  process.env.DATABASE_URL = url;
  process.env.FINANCIAL_E2E_TEST_MODE = "true";
  process.env.TEST_DATABASE_NAME = APPROVED.databaseName;
  process.env.TEST_DATABASE_MARKER = APPROVED.marker;
  const { prisma } = await import("../src/lib/db/prisma.ts");
  return prisma;
}

async function createSnapshotFixtures(bootstrap, baseFixture) {
  const { tenant, user, customer, productA: product, batchA: batch } = baseFixture;
  const completeInvoice = id("snapshot_complete_invoice");
  const completeItem = id("snapshot_complete_item");
  const missingInvoice = id("snapshot_missing_invoice");
  const missingItem = id("snapshot_missing_item");
  await bootstrap.query("BEGIN");
  try {
    for (const [invoiceId, itemId, taxStatus] of [[completeInvoice, completeItem, "COMPLETE"], [missingInvoice, missingItem, "COMPLETE"]]) {
      await bootstrap.query(
        `INSERT INTO sales_invoices
          (id,tenant_id,invoice_no,customer_id,invoice_date,status,tax_data_status,place_of_supply_code,
           gross_amount,total_discount,total_tax,net_amount,balance_due,seller_name_snapshot,seller_state_snapshot,
           customer_name_snapshot,customer_state_snapshot,updated_at)
         VALUES ($1,$2,$3,$4,now(),'FINALIZED',$5,'MH',100,0,18,118,118,
           $6,'MH',$7,'MH',now())`,
        [invoiceId, tenant, `GST016-${invoiceId.slice(-12)}`, customer, taxStatus,
          invoiceId === completeInvoice ? "Original Seller" : null,
          invoiceId === completeInvoice ? "Original Customer" : null],
      );
      await bootstrap.query(
        `INSERT INTO sales_invoice_items
          (id,tenant_id,invoice_id,product_id,batch_id,batch_no,quantity,sale_rate,gst_rate,taxable_amount,
           gst_amount,cgst_amount,sgst_amount,igst_amount,cess_amount,line_total,product_name_snapshot,
           generic_name_snapshot,hsn_code_snapshot)
         VALUES ($1,$2,$3,$4,$5,'SNAP-1',1,100,18,100,18,9,9,0,0,118,$6,$7,'3004')`,
        [itemId, tenant, invoiceId, product, batch,
          invoiceId === completeInvoice ? "Original Product" : null,
          invoiceId === completeInvoice ? "Original Generic" : null],
      );
    }
    await bootstrap.query("COMMIT");
    return { tenant, user, externalId: baseFixture.externalId, customer, product, completeInvoice, completeItem, missingInvoice, missingItem };
  } catch (error) {
    await bootstrap.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function expectRedirect(action) {
  try {
    await action();
  } catch (error) {
    assert.match(error?.message ?? "", /^NEXT_REDIRECT/);
    return;
  }
  throw new Error("Expected the authorized master-data action to redirect after updating.");
}

async function invokeSuccessfulAction(action) {
  try {
    return await action();
  } catch (error) {
    if (error?.message?.startsWith("NEXT_REDIRECT")) return { ok: true, redirected: true };
    throw error;
  }
}

function appendFormFields(formData, fields) {
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, String(value));
  }
}

async function createPurchaseWithGstEvidence({
  createPurchaseDraftAction,
  prisma,
  fixture,
  invoiceNo,
  supplierInvoiceNo,
  supplierState,
  recipientState,
  deliveryState,
  scenario,
  declared,
  batchNo,
}) {
  const formData = new FormData();
  appendFormFields(formData, {
    invoice_no: invoiceNo,
    supplier_id: fixture.supplier,
    supplier_invoice_no: supplierInvoiceNo,
    invoice_date: "2026-11-01",
    gst_treatment: "Registered Business – Regular",
    tax_mode: "EXCLUSIVE",
    gross_amount: "100",
    total_discount: "0",
    total_tax: "18",
    round_off: "0",
    net_amount: "118",
    declared_taxable_value: declared.taxable,
    declared_cgst: declared.cgst,
    declared_sgst: declared.sgst,
    declared_igst: declared.igst,
    declared_cess: "0",
    declared_invoice_total: "118",
    declared_round_off: "0",
    supplier_state_at_transaction: supplierState,
    recipient_state_at_transaction: recipientState,
    delivery_state_at_transaction: deliveryState,
    supply_scenario: scenario,
    "lines[0].product_id": fixture.productA,
    "lines[0].batch_no": batchNo,
    "lines[0].quantity": "1",
    "lines[0].free_qty": "0",
    "lines[0].mrp": "120",
    "lines[0].purchase_rate": "100",
    "lines[0].sale_rate": "100",
    "lines[0].discount_pct": "0",
    "lines[0].gst_rate": "18",
    "lines[0].declared_taxable_value": declared.taxable,
    "lines[0].declared_cgst": declared.cgst,
    "lines[0].declared_sgst": declared.sgst,
    "lines[0].declared_igst": declared.igst,
    "lines[0].declared_cess": "0",
    "lines[0].declared_line_total": "118",
  });
  const result = await invokeSuccessfulAction(() => createPurchaseDraftAction({}, formData));
  assert.equal(result.ok, true, result.message ?? "Purchase draft creation failed.");
  const created = await prisma.purchase_invoices.findFirst({
    where: { tenant_id: fixture.tenant, supplier_invoice_no: supplierInvoiceNo },
  });
  assert.ok(created, `Purchase draft ${supplierInvoiceNo} was not persisted.`);
  return created;
}

async function verifyTenantIsolationAndPrivileges(bootstrap, fixture) {
  const tenantB = id("tenant_b");
  fixture.tenantB = tenantB;
  await bootstrap.query(
    "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1,$2,$3,now())",
    [tenantB, `${APPROVED.runId}-${tenantB}`, "GST E2E Tenant B"],
  );
  const runtime = new Client({
    connectionString: targetUrl("FINANCIAL_E2E_RUNTIME_DATABASE_URL", process.env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD),
  });
  try {
    await runtime.connect();
    for (const [claim, expectedOwn, expectedCross] of [
      [fixture.tenant, fixture.tenant, tenantB],
      [tenantB, tenantB, fixture.tenant],
    ]) {
      await runtime.query(
        "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.tenant_id', $2, false)",
        [fixture.externalId, claim],
      );
      const own = await query(runtime, "SELECT id FROM tenants WHERE id = $1", [expectedOwn]);
      const cross = await query(runtime, "SELECT id FROM tenants WHERE id = $1", [expectedCross]);
      assert.equal(own.length, 1);
      assert.equal(cross.length, 0);
    }
    await runtime.query(
      "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.tenant_id', $2, false)",
      [fixture.externalId, tenantB],
    );
    assert.equal(
      (await query(runtime, "SELECT id FROM sales_invoices WHERE id = $1", [fixture.sales])).length,
      0,
    );
    assert.equal(
      (await query(runtime, "SELECT id FROM purchase_invoices WHERE id = $1", [fixture.purchase])).length,
      0,
    );
    for (const [table, idValue] of [
      ["sales_invoices", fixture.sales],
      ["purchase_invoices", fixture.purchase],
    ]) {
      try {
        assert.equal(
          (await runtime.query(
            `UPDATE ${table} SET notes = $1 WHERE id = $2`,
            ["cross-tenant-write", idValue],
          )).rowCount,
          0,
        );
      } catch (error) {
        assert.equal(error?.code, "42501");
      }
    }
    await assert.rejects(
      runtime.query(
        "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1,$2,$3,now())",
        [id("cross_tenant_insert"), "cross-tenant-insert", "Denied"],
      ),
      (error) => error?.code === "42501",
    );
  } finally {
    await runtime.end();
  }
  const catalog = (await query(bootstrap, `
    SELECT
      (SELECT count(*) FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity AND c.relforcerowsecurity) AS forced_rls_tables,
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies,
      (SELECT count(*) FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS triggers,
      (SELECT count(*) FROM information_schema.role_table_grants
       WHERE grantee = $1 AND privilege_type = 'DELETE') AS runtime_delete_grants,
      (SELECT has_table_privilege($1, 'public.tenants', 'SELECT')) AS runtime_can_select_tenants,
      (SELECT has_table_privilege($1, 'public.tenants', 'INSERT')) AS runtime_can_insert_tenants,
      (SELECT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname = $1) AS restricted_runtime
  `, [APPROVED.runtimeRole]))[0];
  assert.equal(Number(catalog.forced_rls_tables), 33);
  assert.equal(Number(catalog.policies), 84);
  assert.equal(Number(catalog.triggers), 16);
  assert.equal(Number(catalog.runtime_delete_grants), 0);
  assert.equal(catalog.runtime_can_select_tenants, true);
  assert.equal(catalog.runtime_can_insert_tenants, true);
  assert.equal(catalog.restricted_runtime, true);
  console.log("TENANT-RLS-PRIVILEGES=PASS_DATABASE_EVIDENCE");
}

async function main() {
  let bootstrap = null;
  let prisma = null;
  let fixture = null;
  let fixtureManifest = null;
  let suiteFailure = null;
  let ordinaryDatabaseUrl = null;
  let salesOnly = false;
  try {
    bootstrap = await gate();
    ordinaryDatabaseUrl = process.env.DATABASE_URL;
    fixture = await createFixture(bootstrap);
    await verifyTenantIsolationAndPrivileges(bootstrap, fixture);
    const snapshotFixture = await createSnapshotFixtures(bootstrap, fixture);
    fixtureManifest = recordFixtureIdentifiers(
      createFixtureManifest(APPROVED.runId),
      await collectOwnedResources(bootstrap, [fixture.tenant, fixture.tenantB], APPROVED.runId),
    );
    await bootstrap.end();
    bootstrap = null;
    prisma = await appClient(fixture.tenant);
    installFinancialE2eTestSession(fixture.externalId);
    const { finalizeSalesInvoiceAction, createCustomerPaymentAction, createSupplierPaymentAction } = require("../src/app/_actions/sales.actions.ts");
    const {
      acceptPurchaseGstAction,
      createPurchaseDraftAction,
      finalizePurchaseAction,
    } = require("../src/app/_actions/purchases.actions.ts");
    const { repos } = require("../src/repositories/index.ts");
    const onlyGst016 = process.env.GST_E2E_ONLY === "016";
    salesOnly = process.env.GST_E2E_SALES_ONLY === "true";
    if (!onlyGst016 && !salesOnly) {
    const salesBefore = await prisma.sales_invoices.findUnique({ where: { id: fixture.sales, tenant_id: fixture.tenant }, include: { items: true, customer: true } });
    const batchesBefore = await prisma.product_batches.findMany({ where: { id: { in: [fixture.batchA, fixture.batchB] }, tenant_id: fixture.tenant } });
    const profileBefore = await prisma.business_profiles.findUnique({ where: { tenant_id: fixture.tenant } });
    const salesForm = new FormData();
    salesForm.append("idempotency_key", `gst-e2e-sales-${fixture.sales}`);
    const salesResult = await finalizeSalesInvoiceAction(fixture.sales, {} , salesForm);
  assert.equal(salesResult.ok, false);
  assert.match(salesResult.message ?? "", /Insufficient FEFO stock/);
    const salesAfter = await prisma.sales_invoices.findUnique({ where: { id: fixture.sales, tenant_id: fixture.tenant }, include: { items: true, customer: true } });
  assert.equal(salesAfter.status, salesBefore.status);
  assert.equal(salesAfter.invoice_no, salesBefore.invoice_no);
  assert.deepEqual(salesAfter.items.map((x) => x.taxable_amount), salesBefore.items.map((x) => x.taxable_amount));
  assert.deepEqual(await prisma.product_batches.findMany({ where: { id: { in: [fixture.batchA, fixture.batchB] }, tenant_id: fixture.tenant } }), batchesBefore);
  assert.equal((await prisma.business_profiles.findUnique({ where: { tenant_id: fixture.tenant } })).invoice_next_seq, profileBefore.invoice_next_seq);
  assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.sales } }), 0);
  assert.equal(await prisma.customer_ledgers.count({ where: { tenant_id: fixture.tenant, invoice_id: fixture.sales } }), 0);
  console.log("GST-014=PASS_APPLICATION_PATH_DATABASE_E2E");
  const purchaseBefore = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchase, tenant_id: fixture.tenant } });
  const purchaseProfileBefore = await prisma.business_profiles.findUnique({ where: { tenant_id: fixture.tenant } });
  const purchaseForm = new FormData();
  purchaseForm.append("idempotency_key", "gst-e2e-purchase");
  const purchaseResult = await finalizePurchaseAction(fixture.purchase, {}, purchaseForm);
  assert.equal(purchaseResult.ok, false);
  const purchaseAfter = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchase, tenant_id: fixture.tenant } });
  assert.equal(purchaseAfter.status, purchaseBefore.status);
  assert.equal((await prisma.business_profiles.findUnique({ where: { tenant_id: fixture.tenant } })).purchase_next_seq, purchaseProfileBefore.purchase_next_seq);
  assert.equal(await prisma.purchase_posting_operations.count({ where: { tenant_id: fixture.tenant, purchase_invoice_id: fixture.purchase } }), 0);
  assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.purchase } }), 0);
  assert.equal(await prisma.supplier_ledgers.count({ where: { tenant_id: fixture.tenant, purchase_id: fixture.purchase } }), 0);
  console.log("GST-015=PASS_APPLICATION_PATH_DATABASE_E2E");
    }
    const salesSuccessBefore = await prisma.sales_invoices.findUnique({ where: { id: fixture.salesSuccess, tenant_id: fixture.tenant }, include: { items: true } });
    const salesSuccessCustomerBefore = await prisma.customers.findUnique({ where: { id: fixture.customer, tenant_id: fixture.tenant } });
    const salesSuccessSupplierBefore = await prisma.suppliers.findUnique({ where: { id: fixture.supplier, tenant_id: fixture.tenant } });
    const salesSuccessBatchesBefore = await prisma.product_batches.findMany({ where: { tenant_id: fixture.tenant, product_id: fixture.productA } });
    const salesSuccessForm = new FormData();
    salesSuccessForm.append("idempotency_key", `gst-e2e-success-${fixture.salesSuccess}`);
    const salesSuccessResult = await invokeSuccessfulAction(() =>
      finalizeSalesInvoiceAction(fixture.salesSuccess, {}, salesSuccessForm));
    assert.equal(salesSuccessResult.ok, true, salesSuccessResult.message ?? "Sales finalization failed.");
    const salesSuccessAfter = await prisma.sales_invoices.findUnique({ where: { id: fixture.salesSuccess, tenant_id: fixture.tenant }, include: { items: true } });
    assert.equal(salesSuccessAfter.status, "FINALIZED");
    assert.ok(salesSuccessAfter.invoice_no);
    const salesSuccessItemAfter = salesSuccessAfter.items[0];
    assert.equal(salesSuccessAfter.gst_treatment, "Registered Business – Regular");
    assert.equal(salesSuccessAfter.tax_mode, "EXCLUSIVE");
    assert.equal(salesSuccessAfter.place_of_supply_code, "MH");
    assert.equal(salesSuccessAfter.tax_data_status, "COMPLETE");
    assert.equal(Number(salesSuccessAfter.gross_amount), 100);
    assert.equal(Number(salesSuccessAfter.total_discount), 0);
    assert.equal(Number(salesSuccessAfter.total_tax), 18);
    assert.equal(Number(salesSuccessAfter.round_off), 0);
    assert.equal(Number(salesSuccessAfter.net_amount), 118);
    assert.equal(Number(salesSuccessAfter.balance_due), 118);
    assert.equal(Number(salesSuccessItemAfter.line_total), 118);
    assert.equal(Number(salesSuccessItemAfter.taxable_amount), 100);
    assert.equal(Number(salesSuccessItemAfter.cgst_amount), 9);
    assert.equal(Number(salesSuccessItemAfter.sgst_amount), 9);
    assert.equal(Number(salesSuccessItemAfter.igst_amount), 0);
    assert.equal(Number(salesSuccessItemAfter.cess_amount), 0);
    assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.salesSuccess } }), 1);
    assert.equal(await prisma.customer_ledgers.count({ where: { tenant_id: fixture.tenant, invoice_id: fixture.salesSuccess } }), 1);
    const salesSuccessCustomerAfter = await prisma.customers.findUnique({ where: { id: fixture.customer, tenant_id: fixture.tenant } });
    const salesSuccessSupplierAfter = await prisma.suppliers.findUnique({ where: { id: fixture.supplier, tenant_id: fixture.tenant } });
    assert.equal(Number(salesSuccessCustomerAfter.receivable_balance), Number(salesSuccessCustomerBefore.receivable_balance) + 118);
    if (salesOnly) {
      assert.equal(Number(salesSuccessSupplierAfter.payable_balance), Number(salesSuccessSupplierBefore.payable_balance));
    }
    assert.equal(await prisma.audit_logs.count({ where: { tenant_id: fixture.tenant, target_id: fixture.salesSuccess, event_type: "INVOICE_FINALIZED" } }), 1);
    const salesSuccessBatchesAfter = await prisma.product_batches.findMany({ where: { tenant_id: fixture.tenant, product_id: fixture.productA } });
    const availableBefore = salesSuccessBatchesBefore.reduce((total, batch) => total + Number(batch.available_qty), 0);
    const availableAfter = salesSuccessBatchesAfter.reduce((total, batch) => total + Number(batch.available_qty), 0);
    assert.equal(availableAfter, availableBefore - 1);
    const salesRetryResult = await invokeSuccessfulAction(() =>
      finalizeSalesInvoiceAction(fixture.salesSuccess, {}, salesSuccessForm));
    assert.equal(salesRetryResult.ok, true);
    assert.equal(await prisma.sales_posting_operations.count({
      where: { tenant_id: fixture.tenant, sales_invoice_id: fixture.salesSuccess },
    }), 1);
    assert.equal(await prisma.stock_movements.count({
      where: { tenant_id: fixture.tenant, reference_id: fixture.salesSuccess },
    }), 1);
    assert.equal(await prisma.customer_ledgers.count({
      where: { tenant_id: fixture.tenant, invoice_id: fixture.salesSuccess },
    }), 1);
    const changedPayloadForm = new FormData();
    changedPayloadForm.append("idempotency_key", salesSuccessForm.get("idempotency_key"));
    const changedPayloadResult = await finalizeSalesInvoiceAction(fixture.sales, {}, changedPayloadForm);
    assert.equal(changedPayloadResult.ok, false);
    assert.match(changedPayloadResult.message ?? "", /different sales payload/);
    assert.equal(await prisma.sales_posting_operations.count({
      where: { tenant_id: fixture.tenant, sales_invoice_id: fixture.sales },
    }), 0);
    const rollbackForm = new FormData();
    rollbackForm.append("idempotency_key", `gst-gap-sales-rollback-${fixture.sales}`);
    process.env.FINANCIAL_E2E_TEST_FAIL_BEFORE_COMMIT = "true";
    const rollbackResult = await finalizeSalesInvoiceAction(fixture.sales, {}, rollbackForm);
    delete process.env.FINANCIAL_E2E_TEST_FAIL_BEFORE_COMMIT;
    assert.equal(rollbackResult.ok, false);
    assert.match(rollbackResult.message ?? "", /FINANCIAL_E2E_SIMULATED_PRE_COMMIT_FAILURE/);
    assert.equal(await prisma.sales_posting_operations.count({
      where: { tenant_id: fixture.tenant, sales_invoice_id: fixture.sales },
    }), 0);
    assert.equal((await prisma.sales_invoices.findUnique({
      where: { id: fixture.sales, tenant_id: fixture.tenant },
    })).status, "DRAFT");
    salesPersistenceEvidence = {
      scenario: "INTRA_STATE_SALES_FINALIZATION",
      invoiceId: fixture.salesSuccess,
      invoice: {
        status: salesSuccessAfter.status,
        invoiceNo: salesSuccessAfter.invoice_no,
        gstTreatment: salesSuccessAfter.gst_treatment,
        taxMode: salesSuccessAfter.tax_mode,
        placeOfSupplyCode: salesSuccessAfter.place_of_supply_code,
        taxDataStatus: salesSuccessAfter.tax_data_status,
        grossAmount: Number(salesSuccessAfter.gross_amount),
        totalDiscount: Number(salesSuccessAfter.total_discount),
        totalTax: Number(salesSuccessAfter.total_tax),
        roundOff: Number(salesSuccessAfter.round_off),
        netAmount: Number(salesSuccessAfter.net_amount),
        balanceDue: Number(salesSuccessAfter.balance_due),
      },
      line: {
        lineTotal: Number(salesSuccessItemAfter.line_total),
        taxableAmount: Number(salesSuccessItemAfter.taxable_amount),
        cgstAmount: Number(salesSuccessItemAfter.cgst_amount),
        sgstAmount: Number(salesSuccessItemAfter.sgst_amount),
        igstAmount: Number(salesSuccessItemAfter.igst_amount),
        cessAmount: Number(salesSuccessItemAfter.cess_amount),
      },
      customer: {
        beforeReceivableBalance: Number(salesSuccessCustomerBefore.receivable_balance),
        afterReceivableBalance: Number(salesSuccessCustomerAfter.receivable_balance),
      },
      supplier: {
        beforePayableBalance: Number(salesSuccessSupplierBefore.payable_balance),
        afterPayableBalance: Number(salesSuccessSupplierAfter.payable_balance),
      },
      posting: {
        stockMovements: await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.salesSuccess } }),
        customerLedgers: await prisma.customer_ledgers.count({ where: { tenant_id: fixture.tenant, invoice_id: fixture.salesSuccess } }),
        auditLogs: await prisma.audit_logs.count({ where: { tenant_id: fixture.tenant, target_id: fixture.salesSuccess, event_type: "INVOICE_FINALIZED" } }),
      },
    };
    console.log("SALES-IDEMPOTENCY-RETRY-CONFLICT-ROLLBACK=PASS_CURRENT_CAMPAIGN");
    console.log("SALES-SUCCESS=PASS_APPLICATION_PATH_DATABASE_E2E");
    if (salesOnly) console.log("T25-SALES-PERSISTENCE=PASS_CURRENT_SOURCE_DATABASE_READBACK");

    if (!salesOnly) {
    const purchaseSuccessBefore = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseSuccess, tenant_id: fixture.tenant } });
    const purchaseSuccessForm = new FormData();
    purchaseSuccessForm.append("idempotency_key", `gst-e2e-success-${fixture.purchaseSuccess}`);
    const purchaseSuccessResult = await invokeSuccessfulAction(() =>
      finalizePurchaseAction(fixture.purchaseSuccess, {}, purchaseSuccessForm));
    assert.equal(purchaseSuccessResult.ok, true, purchaseSuccessResult.message ?? "Purchase finalization failed.");
    const purchaseSuccessAfter = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseSuccess, tenant_id: fixture.tenant } });
    assert.equal(purchaseSuccessAfter.status, "FINALIZED");
    assert.equal(purchaseSuccessAfter.invoice_no, purchaseSuccessBefore.invoice_no);
    assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.purchaseSuccess } }), 1);
    assert.equal(await prisma.purchase_posting_operations.count({ where: { tenant_id: fixture.tenant, purchase_invoice_id: fixture.purchaseSuccess, status: "COMPLETED" } }), 1);
    assert.equal(await prisma.supplier_ledgers.count({ where: { tenant_id: fixture.tenant, purchase_id: fixture.purchaseSuccess } }), 1);
    assert.equal(Number((await prisma.suppliers.findUnique({ where: { id: fixture.supplier, tenant_id: fixture.tenant } })).payable_balance), 243);
    assert.equal(await prisma.audit_logs.count({ where: { tenant_id: fixture.tenant, target_id: fixture.purchaseSuccess, event_type: "PURCHASE_FINALIZED" } }), 1);
    const purchaseSuccessEvidence = await prisma.purchase_gst_evidence_revisions.findFirst({ where: { purchase_invoice_id: fixture.purchaseSuccess, tenant_id: fixture.tenant } });
    const purchaseSuccessCalculation = await prisma.purchase_gst_calculations.findFirst({ where: { purchase_invoice_id: fixture.purchaseSuccess, tenant_id: fixture.tenant } });
    const purchaseSuccessDecision = await prisma.purchase_gst_accounting_decisions.findFirst({ where: { purchase_invoice_id: fixture.purchaseSuccess, tenant_id: fixture.tenant } });
    assert.equal(Number(purchaseSuccessEvidence.declared_taxable_value), 100);
    assert.equal(Number(purchaseSuccessCalculation.calculated_cgst), 9);
    assert.equal(Number(purchaseSuccessDecision.accepted_cgst), 9);
    const purchaseSuccessItemAfter = await prisma.purchase_invoice_items.findUnique({ where: { id: fixture.purchaseSuccessItem } });
    assert.equal(Number(purchaseSuccessItemAfter.calculated_taxable_value), 100);
    assert.equal(Number(purchaseSuccessItemAfter.calculated_cgst), 9);
    assert.equal(Number(purchaseSuccessItemAfter.accepted_taxable_value), 100);
    assert.equal(Number(purchaseSuccessItemAfter.accepted_cgst), 9);
    assert.equal(purchaseSuccessItemAfter.gst_acceptance_status, "ACCEPTED");
    console.log("PURCHASE-SUCCESS=PASS_APPLICATION_PATH_DATABASE_E2E");
    const reviewBefore = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseReview, tenant_id: fixture.tenant } });
    const reviewResult = await finalizePurchaseAction(fixture.purchaseReview, {}, new FormData());
    assert.equal(reviewResult.ok, false);
    const reviewAfter = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseReview, tenant_id: fixture.tenant } });
    assert.equal(reviewAfter.status, reviewBefore.status);
    assert.equal(await prisma.purchase_posting_operations.count({ where: { tenant_id: fixture.tenant, purchase_invoice_id: fixture.purchaseReview } }), 0);
    assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.purchaseReview } }), 0);
    console.log("PURCHASE-GST-REVIEW-GUARD=PASS_APPLICATION_PATH_DATABASE_E2E");

    const interPurchase = await createPurchaseWithGstEvidence({
      createPurchaseDraftAction,
      prisma,
      fixture,
      invoiceNo: `PUR-INTER-${fixture.tenant.slice(-8)}`,
      supplierInvoiceNo: `GST-INTER-${fixture.tenant.slice(-8)}`,
      supplierState: "GJ",
      recipientState: "MH",
      deliveryState: "MH",
      scenario: "INTER_STATE",
      declared: { taxable: "100", cgst: "0", sgst: "0", igst: "18" },
      batchNo: `INTER-${fixture.tenant.slice(-8)}`,
    });
    const interEvidence = await prisma.purchase_gst_evidence_revisions.findFirst({
      where: { purchase_invoice_id: interPurchase.id, tenant_id: fixture.tenant },
    });
    const interCalculation = await prisma.purchase_gst_calculations.findFirst({
      where: { purchase_invoice_id: interPurchase.id, tenant_id: fixture.tenant },
    });
    assert.ok(interEvidence);
    assert.ok(interCalculation);
    assert.equal(interEvidence.supply_scenario, "INTER_STATE");
    assert.equal(Number(interEvidence.declared_igst), 18);
    assert.equal(Number(interCalculation.calculated_cgst), 0);
    assert.equal(Number(interCalculation.calculated_sgst), 0);
    assert.equal(Number(interCalculation.calculated_igst), 18);
    const interAcceptanceForm = new FormData();
    appendFormFields(interAcceptanceForm, {
      decision_reference: `E2E-INTER-${fixture.tenant.slice(-8)}`,
      rationale: "Current campaign inter-state application-calculated acceptance.",
      accepted_value_source: "APPLICATION_CALCULATED",
      expected_gst_record_version: interPurchase.gst_record_version,
      expected_gst_evidence_revision_id: interPurchase.current_gst_evidence_revision_id,
      expected_gst_calculation_id: interPurchase.current_gst_calculation_id,
    });
    const interAcceptance = await acceptPurchaseGstAction(interPurchase.id, interAcceptanceForm);
    assert.equal(interAcceptance.ok, true, interAcceptance.message ?? "Inter-state acceptance failed.");
    const interDecision = await prisma.purchase_gst_accounting_decisions.findFirst({
      where: { purchase_invoice_id: interPurchase.id, tenant_id: fixture.tenant },
    });
    assert.ok(interDecision);
    assert.equal(interDecision.accepted_value_source, "APPLICATION_CALCULATED");
    assert.equal(Number(interDecision.accepted_igst), 18);
    const interFinalizeForm = new FormData();
    interFinalizeForm.append("idempotency_key", `gst-gap-inter-${interPurchase.id}`);
    const interFinalized = await invokeSuccessfulAction(() =>
      finalizePurchaseAction(interPurchase.id, {}, interFinalizeForm));
    assert.equal(interFinalized.ok, true, interFinalized.message ?? "Inter-state finalization failed.");
    const interAfter = await prisma.purchase_invoices.findUnique({
      where: { id: interPurchase.id, tenant_id: fixture.tenant },
    });
    const interItem = await prisma.purchase_invoice_items.findFirst({
      where: { purchase_id: interPurchase.id, tenant_id: fixture.tenant },
    });
    assert.equal(interAfter.status, "FINALIZED");
    assert.ok(interItem);
    assert.equal(Number(interItem.accepted_igst), 18);
    assert.equal(Number(interItem.gst_amount), 18);
    assert.equal(Number(interItem.line_total), 118);
    assert.equal(await prisma.purchase_posting_operations.count({
      where: { tenant_id: fixture.tenant, purchase_invoice_id: interPurchase.id, status: "COMPLETED" },
    }), 1);
    assert.equal(await prisma.supplier_ledgers.count({
      where: { tenant_id: fixture.tenant, purchase_id: interPurchase.id },
    }), 1);
    console.log("PURCHASE-INTER-STATE-IGST=PASS_CURRENT_CAMPAIGN");

    const revisionPurchase = await createPurchaseWithGstEvidence({
      createPurchaseDraftAction,
      prisma,
      fixture,
      invoiceNo: `PUR-REVISION-${fixture.tenant.slice(-8)}`,
      supplierInvoiceNo: `GST-REVISION-${fixture.tenant.slice(-8)}`,
      supplierState: "MH",
      recipientState: "MH",
      deliveryState: "MH",
      scenario: "INTRA_STATE",
      declared: { taxable: "100", cgst: "9", sgst: "9", igst: "0" },
      batchNo: `REVISION-${fixture.tenant.slice(-8)}`,
    });
    const staleRevision = revisionPurchase.gst_record_version;
    const revisionAcceptanceForm = new FormData();
    appendFormFields(revisionAcceptanceForm, {
      decision_reference: `E2E-REVISION-${fixture.tenant.slice(-8)}`,
      rationale: "Current campaign revision acceptance.",
      accepted_value_source: "APPLICATION_CALCULATED",
      expected_gst_record_version: revisionPurchase.gst_record_version,
      expected_gst_evidence_revision_id: revisionPurchase.current_gst_evidence_revision_id,
      expected_gst_calculation_id: revisionPurchase.current_gst_calculation_id,
    });
    const revisionAcceptance = await acceptPurchaseGstAction(revisionPurchase.id, revisionAcceptanceForm);
    assert.equal(revisionAcceptance.ok, true, revisionAcceptance.message ?? "Revision acceptance failed.");
    const revisionAfterAcceptance = await prisma.purchase_invoices.findUnique({
      where: { id: revisionPurchase.id, tenant_id: fixture.tenant },
    });
    assert.equal(revisionAfterAcceptance.gst_record_version, staleRevision + 1);
    assert.equal(await prisma.purchase_invoices.count({
      where: {
        id: revisionPurchase.id,
        tenant_id: fixture.tenant,
        status: "DRAFT",
        gst_record_version: staleRevision,
      },
    }), 0);
    assert.equal(revisionAfterAcceptance.status, "DRAFT");
    const revisionAForm = new FormData();
    revisionAForm.append("idempotency_key", `gst-gap-revision-a-${revisionPurchase.id}`);
    const revisionBForm = new FormData();
    revisionBForm.append("idempotency_key", `gst-gap-revision-b-${revisionPurchase.id}`);
    const revisionResults = await Promise.all([
      invokeSuccessfulAction(() => finalizePurchaseAction(revisionPurchase.id, {}, revisionAForm)),
      invokeSuccessfulAction(() => finalizePurchaseAction(revisionPurchase.id, {}, revisionBForm)),
    ]);
    assert.equal(revisionResults.filter((result) => result.ok).length, 1);
    assert.equal(revisionResults.filter((result) => !result.ok).length, 1);
    const staleFailure = revisionResults.find((result) => !result.ok);
    assert.ok(staleFailure);
    assert.match(staleFailure.message ?? "", /changed while finalization was starting|already finalized|being processed/);
    assert.equal(await prisma.purchase_posting_operations.count({
      where: { tenant_id: fixture.tenant, purchase_invoice_id: revisionPurchase.id, status: "COMPLETED" },
    }), 1);
    assert.equal(await prisma.stock_movements.count({
      where: { tenant_id: fixture.tenant, reference_id: revisionPurchase.id },
    }), 1);
    assert.equal(await prisma.supplier_ledgers.count({
      where: { tenant_id: fixture.tenant, purchase_id: revisionPurchase.id },
    }), 1);
    console.log("PURCHASE-STALE-REVISION-AND-POSTING=PASS_CURRENT_CAMPAIGN");

    const legacyBefore = await prisma.purchase_invoices.findUnique({
      where: { id: fixture.purchaseConflict, tenant_id: fixture.tenant },
    });
    const legacyProfileBefore = await prisma.business_profiles.findUnique({
      where: { tenant_id: fixture.tenant },
    });
    const legacyResult = await finalizePurchaseAction(fixture.purchaseConflict, {}, new FormData());
    assert.equal(legacyResult.ok, false);
    assert.match(legacyResult.message ?? "", /No line items|supplier evidence|GST finalization is blocked/i);
    const legacyAfter = await prisma.purchase_invoices.findUnique({
      where: { id: fixture.purchaseConflict, tenant_id: fixture.tenant },
    });
    assert.equal(legacyAfter.status, legacyBefore.status);
    assert.equal(legacyAfter.gst_record_version, legacyBefore.gst_record_version);
    assert.equal((await prisma.business_profiles.findUnique({
      where: { tenant_id: fixture.tenant },
    })).purchase_next_seq, legacyProfileBefore.purchase_next_seq);
    assert.equal(await prisma.purchase_posting_operations.count({
      where: { tenant_id: fixture.tenant, purchase_invoice_id: fixture.purchaseConflict },
    }), 0);
    assert.equal(await prisma.stock_movements.count({
      where: { tenant_id: fixture.tenant, reference_id: fixture.purchaseConflict },
    }), 0);
    assert.equal(await prisma.supplier_ledgers.count({
      where: { tenant_id: fixture.tenant, purchase_id: fixture.purchaseConflict },
    }), 0);
    console.log("PURCHASE-INCOMPLETE-LEGACY-HOLD=PASS_CURRENT_CAMPAIGN");

    const customerPaymentForm = new FormData();
    for (const [key, value] of Object.entries({ customer_id: fixture.customer, amount: "50", payment_method: "Cash", reference_no: `GST-${fixture.salesSuccess}`, notes: "" })) customerPaymentForm.append(key, value);
    const customerBeforePayment = await prisma.customers.findUnique({ where: { id: fixture.customer, tenant_id: fixture.tenant } });
    const customerPayment = await createCustomerPaymentAction({}, customerPaymentForm);
    assert.equal(customerPayment.ok, true, customerPayment.message ?? "Customer payment failed.");
    assert.equal(Number((await prisma.customers.findUnique({ where: { id: fixture.customer, tenant_id: fixture.tenant } })).receivable_balance), Number(customerBeforePayment.receivable_balance) - 50);
    assert.equal(await prisma.payments.count({ where: { tenant_id: fixture.tenant, id: customerPayment.data.id } }), 1);
    assert.equal(await prisma.customer_ledgers.count({ where: { tenant_id: fixture.tenant, reference_type: "payment_received", reference_id: null } }), 1);
    const badPayment = new FormData();
    for (const [key, value] of Object.entries({ customer_id: id("missing_customer"), amount: "10", payment_method: "Cash", reference_no: "GST-BAD", notes: "" })) badPayment.append(key, value);
    const paymentFailure = await createCustomerPaymentAction({}, badPayment);
    assert.equal(paymentFailure.ok, false);
    const supplierPaymentForm = new FormData();
    for (const [key, value] of Object.entries({ supplier_id: fixture.supplier, amount: "40", payment_method: "Bank Transfer", reference_no: `GST-SUP-${fixture.purchaseSuccess}`, notes: "" })) supplierPaymentForm.append(key, value);
    const supplierBeforePayment = await prisma.suppliers.findUnique({ where: { id: fixture.supplier, tenant_id: fixture.tenant } });
    const supplierPayment = await createSupplierPaymentAction({}, supplierPaymentForm);
    assert.equal(supplierPayment.ok, true);
    assert.equal(Number((await prisma.suppliers.findUnique({ where: { id: fixture.supplier, tenant_id: fixture.tenant } })).payable_balance), Number(supplierBeforePayment.payable_balance) - 40);
    assert.equal(await prisma.payments.count({ where: { tenant_id: fixture.tenant, id: supplierPayment.data.id } }), 1);
    assert.equal(await prisma.supplier_ledgers.count({ where: { tenant_id: fixture.tenant, supplier_id: fixture.supplier, reference_type: "payment_made", reference_id: null } }), 1);
    const badSupplierPayment = new FormData();
    for (const [key, value] of Object.entries({ supplier_id: id("missing_supplier"), amount: "10", payment_method: "Cash", reference_no: "GST-BAD-SUP", notes: "" })) badSupplierPayment.append(key, value);
    const supplierPaymentFailure = await createSupplierPaymentAction({}, badSupplierPayment);
    assert.equal(supplierPaymentFailure.ok, false);
    console.log("PAYMENT=PASS_APPLICATION_PATH_DATABASE_E2E");
    }
  const { updateProductAction, updateCustomerAction } = require("../src/app/_actions/masters.actions.ts");
  const { loadBillingInvoicePrintData } = require("../src/app/billing/[invoiceId]/print/data.ts");
  const { buildInvoicePrintSnapshot } = require("../src/domain/services/gst-calculator.service.ts");
  clearFinancialE2eTestSession();
  installFinancialE2eTestSession(snapshotFixture.externalId);
  const completeBefore = await prisma.sales_invoices.findUnique({
    where: { id: snapshotFixture.completeInvoice, tenant_id: snapshotFixture.tenant },
    include: { items: { include: { product: true, batch: true } }, customer: true },
  });
  assert.equal(completeBefore.tax_data_status, "COMPLETE");
  assert.equal(completeBefore.seller_name_snapshot, "Original Seller");
  assert.equal(completeBefore.items[0].product_name_snapshot, "Original Product");
  const productForm = new FormData();
  for (const [key, value] of Object.entries({
    sku: "SNAP-001-EDITED", name: "Changed Product", generic_name: "Changed Generic",
    manufacturer: "", schedule_classification: "OTC", hsn_code: "9999", pack_size: "",
    gst_rate: "18", mrp: "100", standard_sale_rate: "100", purchase_rate: "100",
    reorder_level: "0", is_active: "true",
  })) productForm.append(key, value);
  await expectRedirect(() => updateProductAction(snapshotFixture.product, {}, productForm));
  const customerForm = new FormData();
  for (const [key, value] of Object.entries({
    code: "", business_name: "Changed Customer", contact_person: "", phone: "", mobile: "",
    email: "", billing_address_1: "", billing_address_2: "", billing_city: "",
    billing_state: "MH", billing_pincode: "", gstin: "", drug_license_no_1: "",
    drug_license_no_2: "", credit_limit: "0", is_active: "true",
  })) customerForm.append(key, value);
  await expectRedirect(() => updateCustomerAction(snapshotFixture.customer, {}, customerForm));
  const loadedPrintData = await loadBillingInvoicePrintData(snapshotFixture.completeInvoice);
  assert.equal(loadedPrintData.ctx.tenantId, snapshotFixture.tenant);
  const printSnapshot = buildInvoicePrintSnapshot(
    loadedPrintData.rawInvoice,
    loadedPrintData.businessProfile?.business_name,
  );
  assert.equal(printSnapshot.sellerName, "Original Seller");
  assert.equal(printSnapshot.customerName, "Original Customer");
  assert.equal(printSnapshot.items[0].productName, "Original Product");
  assert.equal(printSnapshot.items[0].genericName, "Original Generic");
  assert.equal(printSnapshot.items[0].hsnCode, "3004");
  const changedMasters = await prisma.sales_invoices.findUnique({
    where: { id: snapshotFixture.completeInvoice, tenant_id: snapshotFixture.tenant },
    include: { items: { include: { product: true } }, customer: true },
  });
  assert.equal(changedMasters.customer.business_name, "Changed Customer");
  assert.equal(changedMasters.items[0].product.name, "Changed Product");
  assert.equal(changedMasters.seller_name_snapshot, "Original Seller");
  assert.equal(changedMasters.items[0].product_name_snapshot, "Original Product");
  const missingData = await loadBillingInvoicePrintData(snapshotFixture.missingInvoice);
  const missingSnapshot = buildInvoicePrintSnapshot(missingData.rawInvoice, "Changed Seller");
  assert.equal(missingData.rawInvoice.tax_data_status, "COMPLETE");
  assert.equal(missingSnapshot.customerName, null);
  assert.equal(missingSnapshot.items[0].productName, null);
  assert.equal(missingSnapshot.items[0].genericName, null);
  await assert.rejects(
    () => repos.salesInvoices.update(snapshotFixture.completeInvoice, { notes: "forbidden" }, loadedPrintData.ctx),
    /finalized|immutable|mutation|permission/i,
  );
  await assert.rejects(
    () => prisma.sales_invoice_items.update({
      where: { id: snapshotFixture.completeItem, tenant_id: snapshotFixture.tenant },
      data: { product_name_snapshot: "Tampered Product" },
    }),
    /finalized|immutable|mutation|permission/i,
  );
  const persistedAfterMutationAttempts = await prisma.sales_invoices.findUnique({
    where: { id: snapshotFixture.completeInvoice, tenant_id: snapshotFixture.tenant },
    include: { items: true },
  });
  assert.equal(persistedAfterMutationAttempts.seller_name_snapshot, "Original Seller");
  assert.equal(persistedAfterMutationAttempts.items[0].product_name_snapshot, "Original Product");
  const crossTenant = await repos.salesInvoices.getById(snapshotFixture.completeInvoice, {
    tenantId: id("unauthorized_tenant"),
    userId: fixture.user,
    roles: ["GST E2E Role"],
    permissions: ["view_invoice"],
  });
  assert.equal(crossTenant, null);
  console.log(`GST-016=PASS_APPLICATION_PATH_DATABASE_E2E fixture=${snapshotFixture.completeInvoice} missing=${snapshotFixture.missingInvoice}`);
  } catch (error) {
    suiteFailure = error;
    throw error;
  } finally {
    clearFinancialE2eTestSession();
    if (prisma) await prisma.$disconnect().catch(() => {});
    if (bootstrap) await bootstrap.end().catch(() => {});
    if (fixture) {
      const recoveryBootstrap = new Client({
        connectionString: targetUrl("TEST_DATABASE_URL", process.env.FINANCIAL_E2E_DB_PASSWORD),
      });
      await recoveryBootstrap.connect();
      try {
        fixtureManifest = recordFixtureIdentifiers(
          createFixtureManifest(APPROVED.runId),
          await collectOwnedResources(
            recoveryBootstrap,
            [fixture.tenant, fixture.tenantB].filter(Boolean),
            APPROVED.runId,
          ),
        );
      } finally {
        await recoveryBootstrap.end();
      }
    }
    if (fixtureManifest && process.env.FINANCIAL_E2E_CLEANUP_MODE === "DISPOSABLE_TARGET_DISPOSAL") {
      console.log("FIXTURE-DISPOSAL=DATABASE_LEVEL_DEFERRED");
      console.log("IMMUTABLE-HISTORY=PRESERVED_NOT_DELETED");
      console.log(`OWNED_RESOURCES=${fixtureManifest.resources.length}`);
      console.log(`TARGET_DATABASE=${APPROVED.databaseName}`);
    } else if (fixtureManifest) {
      const cleanupBootstrap = new Client({
        connectionString: targetUrl("TEST_DATABASE_URL", process.env.FINANCIAL_E2E_DB_PASSWORD),
      });
      await cleanupBootstrap.connect();
      try {
        const runtime = new Client({
          connectionString: targetUrl("FINANCIAL_E2E_RUNTIME_DATABASE_URL", process.env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD),
        });
        await runtime.connect();
        let identityEvidence;
        try {
          identityEvidence = await verifyDatabaseIdentity({
            client: runtime,
            expectedDatabase: APPROVED.databaseName,
            expectedRole: APPROVED.runtimeRole,
            targetUrl: process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
            approvedTargetBinding: targetContractBinding(APPROVED),
            runId: APPROVED.runId,
          });
        } finally {
          await runtime.end();
        }
        if (!identityEvidence.ok) throw new Error(identityEvidence.error);
        const completed = await cleanupRunOwnedFixtures({
          manifest: fixtureManifest,
          identityEvidence: identityEvidence.evidence,
          targetUrl: process.env.TEST_DATABASE_URL,
          runtimeUrl: process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
          ordinaryUrl: ordinaryDatabaseUrl,
          databaseName: APPROVED.databaseName,
          databaseRole: APPROVED.runtimeRole,
          runId: APPROVED.runId,
          cleanupAuthorized: process.env.FINANCIAL_E2E_CLEANUP_AUTHORIZED === "true",
          targetContract: APPROVED,
          executePlan: (plan) => cleanupOwnedResources(plan, cleanupBootstrap),
          verifyCompletion: async (plan) => {
            for (const resource of plan.resources) {
              const table = resource.resourceType === "role_permissions"
                ? "role_permissions"
                : CLEANUP_TABLES[resource.resourceType];
              const remaining = await query(cleanupBootstrap, `SELECT 1 FROM ${table} WHERE id::text = $1 LIMIT 1`, [resource.id]);
              assert.equal(remaining.length, 0, `Cleanup left ${resource.resourceType}/${resource.id}.`);
            }
          },
        });
        assert.equal(completed.status, "CLEANUP_COMPLETE");
        console.log("FIXTURE-CLEANUP=PASS_RUN_SCOPED_POST_VERIFIED");
      } finally {
        await cleanupBootstrap.end();
      }
    }
    if (ordinaryDatabaseUrl) process.env.DATABASE_URL = ordinaryDatabaseUrl;
    if (LIFECYCLE && process.env.FINANCIAL_E2E_SUITE_EVIDENCE_FILE) {
      const evidenceLifecycle = loadAuthorizedTargetLifecycle({
        env: process.env,
        phase: "EVIDENCE_RECORDING",
        suiteName: "sales-gst",
      });
      const evidence = createLifecycleEvidence({
        phase: "EVIDENCE_RECORDING",
        lifecycle: evidenceLifecycle,
        status: suiteFailure ? "FAIL" : "PASS",
        details: {
          suite: "sales-gst",
          command: process.env.FINANCIAL_E2E_SUITE_COMMAND || "pnpm exec node .\\scripts\\sales-gst-application-acceptance.cjs",
          databaseAccessed: true,
          salesOnly,
          sourceHashes: sourceHashes(),
          salesPersistence: salesPersistenceEvidence,
          fixtureResourceCount: fixtureManifest?.resources?.length ?? 0,
          cleanupMode: process.env.FINANCIAL_E2E_CLEANUP_MODE || "ROW_LEVEL_CLEANUP",
          cleanupAuthorization: process.env.FINANCIAL_E2E_CLEANUP_AUTHORIZED === "true",
          failure: suiteFailure ? String(suiteFailure.message || "suite failure").slice(0, 500) : null,
        },
      });
      writeLifecycleEvidence({
        filePath: process.env.FINANCIAL_E2E_SUITE_EVIDENCE_FILE,
        evidence,
      });
      console.log(`FINANCIAL_E2E_SUITE_EVIDENCE=${process.env.FINANCIAL_E2E_SUITE_EVIDENCE_FILE}`);
    }
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
