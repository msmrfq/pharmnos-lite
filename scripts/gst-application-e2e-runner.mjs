import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";
import { installFinancialE2eTestSession, clearFinancialE2eTestSession } from "../src/adapters/auth/supabase-auth.adapter.ts";

const { Client } = pg;
const APPROVED = Object.freeze({
  database: "pharmnos_financial_e2e",
  host: "127.0.0.1",
  port: "55432",
  runtimeRole: "pharmnos_e2e_runtime",
  bootstrapRole: "pharmnos_e2e",
  marker: "pharmnos-financial-e2e",
  runId: "pharmnos-gst-validation-20261026",
  attemptId: "pharmnos-gst-init-20261026-01",
});

function loadEnv() {
  for (const line of fs.readFileSync(".env.financial-e2e", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
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

async function query(client, text, values = []) {
  return (await client.query(text, values)).rows;
}

async function gate() {
  loadEnv();
  assert.equal(process.env.ALLOW_FINANCIAL_E2E, "true");
  assert.equal(process.env.TEST_DATABASE_NAME, APPROVED.database);
  assert.equal(process.env.TEST_DATABASE_MARKER, APPROVED.marker);
  const configured = new URL(process.env.TEST_DATABASE_URL);
  assert.equal(configured.hostname, APPROVED.host);
  assert.equal(configured.port, APPROVED.port);
  assert.equal(configured.pathname, `/${APPROVED.database}`);
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
    assert.equal(identity.database_name, APPROVED.database);
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
    const catalog = (await bootstrap.query(`
      SELECT
        (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity) AS rls_tables,
        (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal) AS triggers
    `)).rows[0];
    assert.equal(Number(catalog.rls_tables), 26);
    assert.equal(Number(catalog.triggers), 10);
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
    for (const permission of ["finalize_invoice", "finalize_purchase", "view_invoice", "view_customer_ledger", "view_supplier_ledger", "edit_product", "edit_customer"]) {
      await bootstrap.query("INSERT INTO role_permissions (id, role_id, permission) VALUES ($1,$2,$3)", [id(`permission_${permission}`), role, permission]);
    }
    await bootstrap.query("INSERT INTO business_profiles (id, tenant_id, state, invoice_prefix, invoice_next_seq, purchase_prefix, purchase_next_seq, updated_at) VALUES ($1,$2,'MH','INV',41,'PUR',71,now())", [profile, tenant]);
    await bootstrap.query("INSERT INTO customers (id, tenant_id, business_name, billing_state, receivable_balance, updated_at) VALUES ($1,$2,'GST Customer','MH',250,now())", [customer, tenant]);
    await bootstrap.query("INSERT INTO suppliers (id, tenant_id, business_name, payable_balance, updated_at) VALUES ($1,$2,'GST Supplier',125,now())", [supplier, tenant]);
    for (const [product, name] of [[productA, "GST Product A"], [productB, "GST Product B"]]) {
      await bootstrap.query("INSERT INTO products (id, tenant_id, name, generic_name, hsn_code, gst_rate, standard_sale_rate, updated_at) VALUES ($1,$2,$3,$4,'3004',18,100,now())", [product, tenant, name, `${name} Generic`]);
    }
    await bootstrap.query("INSERT INTO product_batches (id, tenant_id, product_id, batch_no, sale_rate, received_qty, available_qty, updated_at) VALUES ($1,$2,$3,'A-1',100,1,1,now()), ($4,$2,$5,'B-1',100,1,0,now())", [batchA, tenant, productA, batchB, productB]);
    await bootstrap.query(`INSERT INTO sales_invoices (id,tenant_id,invoice_no,customer_id,invoice_date,status,gross_amount,total_discount,total_tax,net_amount,balance_due,place_of_supply_code,updated_at)
    VALUES ($1,$2,$4,$3,now(),'DRAFT',200,0,36,236,236,'MH',now())`, [sales, tenant, customer, `DRAFT-${sales.slice(-8)}`]);
    await bootstrap.query(`INSERT INTO sales_invoice_items (id,tenant_id,invoice_id,product_id,batch_id,batch_no,quantity,sale_rate,gst_rate,line_total)
    VALUES ($1,$2,$3,$4,$5,'A-1',1,100,18,118),($6,$2,$3,$7,$8,'B-1',1,100,18,118)`, [salesItemA, tenant, sales, productA, batchA, salesItemB, productB, batchB]);
    await bootstrap.query("INSERT INTO product_batches (id, tenant_id, product_id, batch_no, sale_rate, received_qty, available_qty, updated_at) VALUES ($1,$2,$3,'SUCCESS-1',100,5,5,now())", [id("success_batch"), tenant, productA]);
    const successBatch = (await bootstrap.query("SELECT id FROM product_batches WHERE tenant_id=$1 AND product_id=$2 AND batch_no='SUCCESS-1'", [tenant, productA])).rows[0].id;
    await bootstrap.query(`INSERT INTO sales_invoices (id,tenant_id,invoice_no,customer_id,invoice_date,status,gross_amount,total_discount,total_tax,net_amount,balance_due,place_of_supply_code,updated_at)
      VALUES ($1,$2,$4,$3,now(),'DRAFT',100,0,18,118,118,'MH',now())`, [salesSuccess, tenant, customer, `DRAFT-${salesSuccess.slice(-8)}`]);
    await bootstrap.query(`INSERT INTO sales_invoice_items (id,tenant_id,invoice_id,product_id,batch_id,batch_no,quantity,sale_rate,gst_rate,line_total)
      VALUES ($1,$2,$3,$4,$5,'SUCCESS-1',1,100,18,118)`, [salesSuccessItem, tenant, salesSuccess, productA, successBatch]);
    await bootstrap.query("INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,supplier_invoice_no,invoice_date,status,gst_reconciliation_status,gst_accounting_acceptance_status,gst_record_version,gross_amount,total_discount,total_tax,round_off,net_amount,updated_at) VALUES ($1,$2,'',$3,NULL,now(),'DRAFT','MATCHED','ACCEPTED',0,100,0,18,0,118,now()), ($4,$2,'PUR-00071',$3,'CONFLICT',now(),'DRAFT','NOT_RECONCILED','NOT_ACCEPTED',0,100,0,0,0,100,now())", [purchase, tenant, supplier, purchaseConflict]);
    await bootstrap.query("INSERT INTO purchase_invoice_items (id,tenant_id,purchase_id,product_id,batch_no,quantity,purchase_rate,gst_rate,gst_amount,line_total) VALUES ($1,$2,$3,$4,'P-1',1,100,18,18,118)", [purchaseItem, tenant, purchase, productA]);
    const evidence = id("evidence");
    const calculation = id("calculation");
    const decision = id("decision");
    await bootstrap.query("INSERT INTO purchase_gst_evidence_revisions (id,tenant_id,purchase_invoice_id,revision_number,revision_kind,source_document_reference,capture_channel,captured_by_membership_id,declared_taxable_value,declared_cgst,declared_sgst,declared_igst,declared_cess,declared_invoice_total,declared_round_off) VALUES ($1,$2,$3,1,'INITIAL','E2E-SOURCE-ROLLBACK','E2E',$4,100,9,9,0,0,118,0)", [evidence, tenant, purchase, membership]);
    await bootstrap.query("INSERT INTO purchase_gst_calculations (id,tenant_id,purchase_invoice_id,evidence_revision_id,rule_version,calculated_taxable_value,calculated_cgst,calculated_sgst,calculated_igst,calculated_cess,calculated_invoice_total,calculated_round_off) VALUES ($1,$2,$3,$4,'e2e-v1',100,9,9,0,0,118,0)", [calculation, tenant, purchase, evidence]);
    await bootstrap.query("INSERT INTO purchase_gst_accounting_decisions (id,tenant_id,purchase_invoice_id,evidence_revision_id,calculation_id,accepted_taxable_value,accepted_cgst,accepted_sgst,accepted_igst,accepted_cess,accepted_invoice_total,accepted_round_off,accepted_value_source,decision_reference,decision_outcome,rationale,decided_by_membership_id) VALUES ($1,$2,$3,$4,$5,100,9,9,0,0,118,0,'SUPPLIER_DECLARED','E2E-ACCEPT','ACCEPTED','E2E',$6)", [decision, tenant, purchase, evidence, calculation, membership]);
    await bootstrap.query("UPDATE purchase_invoices SET current_gst_evidence_revision_id=$1,current_gst_calculation_id=$2,current_gst_accounting_decision_id=$3 WHERE id=$4 AND tenant_id=$5", [evidence, calculation, decision, purchase, tenant]);
    await bootstrap.query("INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,supplier_invoice_no,invoice_date,status,gst_reconciliation_status,gst_accounting_acceptance_status,gst_record_version,gross_amount,total_discount,total_tax,round_off,net_amount,updated_at) VALUES ($1,$2,$5,$3,$4,now(),'DRAFT','MATCHED','ACCEPTED',0,100,0,18,0,118,now())", [purchaseSuccess, tenant, supplier, `SUCCESS-${purchaseSuccess.slice(-8)}`, `DRAFT-${purchaseSuccess.slice(-8)}`]);
    await bootstrap.query("INSERT INTO purchase_invoice_items (id,tenant_id,purchase_id,product_id,batch_no,quantity,purchase_rate,gst_rate,gst_amount,line_total) VALUES ($1,$2,$3,$4,'SUCCESS-P-1',2,50,18,18,118)", [purchaseSuccessItem, tenant, purchaseSuccess, productA]);
    const successEvidence = id("success_evidence");
    const successCalculation = id("success_calculation");
    const successDecision = id("success_decision");
    await bootstrap.query("INSERT INTO purchase_gst_evidence_revisions (id,tenant_id,purchase_invoice_id,revision_number,revision_kind,source_document_reference,capture_channel,captured_by_membership_id,declared_taxable_value,declared_cgst,declared_sgst,declared_igst,declared_cess,declared_invoice_total,declared_round_off) VALUES ($1,$2,$3,1,'INITIAL','E2E-SOURCE-SUCCESS','E2E',$4,100,9,9,0,0,118,0)", [successEvidence, tenant, purchaseSuccess, membership]);
    await bootstrap.query("INSERT INTO purchase_gst_calculations (id,tenant_id,purchase_invoice_id,evidence_revision_id,rule_version,calculated_taxable_value,calculated_cgst,calculated_sgst,calculated_igst,calculated_cess,calculated_invoice_total,calculated_round_off) VALUES ($1,$2,$3,$4,'e2e-v1',100,9,9,0,0,118,0)", [successCalculation, tenant, purchaseSuccess, successEvidence]);
    await bootstrap.query("INSERT INTO purchase_gst_accounting_decisions (id,tenant_id,purchase_invoice_id,evidence_revision_id,calculation_id,accepted_taxable_value,accepted_cgst,accepted_sgst,accepted_igst,accepted_cess,accepted_invoice_total,accepted_round_off,accepted_value_source,decision_reference,decision_outcome,rationale,decided_by_membership_id) VALUES ($1,$2,$3,$4,$5,100,9,9,0,0,118,0,'SUPPLIER_DECLARED','E2E-SUCCESS','ACCEPTED','E2E',$6)", [successDecision, tenant, purchaseSuccess, successEvidence, successCalculation, membership]);
    await bootstrap.query("UPDATE purchase_invoices SET current_gst_evidence_revision_id=$1,current_gst_calculation_id=$2,current_gst_accounting_decision_id=$3 WHERE id=$4 AND tenant_id=$5", [successEvidence, successCalculation, successDecision, purchaseSuccess, tenant]);
    await bootstrap.query("INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,supplier_invoice_no,invoice_date,status,gst_reconciliation_status,gst_accounting_acceptance_status,gst_record_version,gross_amount,total_discount,total_tax,round_off,net_amount,updated_at) VALUES ($1,$2,$5,$3,$4,now(),'DRAFT','DISCREPANCY_REQUIRES_REVIEW','NOT_ACCEPTED',0,100,0,18,0,118,now())", [purchaseReview, tenant, supplier, `REVIEW-${purchaseReview.slice(-8)}`, `DRAFT-${purchaseReview.slice(-8)}`]);
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
  process.env.TEST_DATABASE_NAME = APPROVED.database;
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
    assert.match(error?.message ?? "", /^NEXT_REDIRECT:/);
    return;
  }
  throw new Error("Expected the authorized master-data action to redirect after updating.");
}

async function invokeSuccessfulAction(action) {
  try {
    return await action();
  } catch (error) {
    if (error?.message?.startsWith("NEXT_REDIRECT:")) return { ok: true, redirected: true };
    throw error;
  }
}

async function verifyTenantIsolationAndPrivileges(bootstrap, fixture) {
  const tenantB = id("tenant_b");
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
      await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [claim]);
      const own = await query(runtime, "SELECT id FROM tenants WHERE id = $1", [expectedOwn]);
      const cross = await query(runtime, "SELECT id FROM tenants WHERE id = $1", [expectedCross]);
      assert.equal(own.length, 1);
      assert.equal(cross.length, 0);
    }
    await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [tenantB]);
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
  assert.equal(Number(catalog.forced_rls_tables), 26);
  assert.equal(Number(catalog.policies), 71);
  assert.equal(Number(catalog.triggers), 10);
  assert.equal(Number(catalog.runtime_delete_grants), 0);
  assert.equal(catalog.runtime_can_select_tenants, true);
  assert.equal(catalog.runtime_can_insert_tenants, true);
  assert.equal(catalog.restricted_runtime, true);
  console.log("TENANT-RLS-PRIVILEGES=PASS_DATABASE_EVIDENCE");
}

async function main() {
  let bootstrap = null;
  let prisma = null;
  try {
    bootstrap = await gate();
    const fixture = await createFixture(bootstrap);
    await verifyTenantIsolationAndPrivileges(bootstrap, fixture);
    const snapshotFixture = await createSnapshotFixtures(bootstrap, fixture);
    await bootstrap.end();
    bootstrap = null;
    prisma = await appClient(fixture.tenant);
    installFinancialE2eTestSession(fixture.externalId);
    const { finalizeSalesInvoiceAction } = await import("../src/app/_actions/sales.actions.ts");
    const { finalizePurchaseAction } = await import("../src/app/_actions/purchases.actions.ts");
    const { createCustomerPaymentAction, createSupplierPaymentAction } = await import("../src/app/_actions/sales.actions.ts");
    const { repos } = await import("../src/repositories/index.ts");
    const onlyGst016 = process.env.GST_E2E_ONLY === "016";
    if (!onlyGst016) {
    const salesBefore = await prisma.sales_invoices.findUnique({ where: { id: fixture.sales, tenant_id: fixture.tenant }, include: { items: true, customer: true } });
    const batchesBefore = await prisma.product_batches.findMany({ where: { id: { in: [fixture.batchA, fixture.batchB] }, tenant_id: fixture.tenant } });
    const profileBefore = await prisma.business_profiles.findUnique({ where: { tenant_id: fixture.tenant } });
    const salesResult = await finalizeSalesInvoiceAction(fixture.sales, {} , new FormData());
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
    const salesSuccessBatchesBefore = await prisma.product_batches.findMany({ where: { tenant_id: fixture.tenant, product_id: fixture.productA } });
    const salesSuccessResult = await invokeSuccessfulAction(() =>
      finalizeSalesInvoiceAction(fixture.salesSuccess, {}, new FormData()));
    assert.equal(salesSuccessResult.ok, true);
    const salesSuccessAfter = await prisma.sales_invoices.findUnique({ where: { id: fixture.salesSuccess, tenant_id: fixture.tenant }, include: { items: true } });
    assert.equal(salesSuccessAfter.status, "FINALIZED");
    assert.ok(salesSuccessAfter.invoice_no);
    assert.equal(Number(salesSuccessAfter.items[0].cgst_amount), 9);
    assert.equal(Number(salesSuccessAfter.items[0].sgst_amount), 9);
    assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.salesSuccess } }), 1);
    assert.equal(await prisma.customer_ledgers.count({ where: { tenant_id: fixture.tenant, invoice_id: fixture.salesSuccess } }), 1);
    assert.equal(Number((await prisma.customers.findUnique({ where: { id: fixture.customer, tenant_id: fixture.tenant } })).receivable_balance), Number(salesSuccessCustomerBefore.receivable_balance) + 118);
    assert.equal(await prisma.audit_logs.count({ where: { tenant_id: fixture.tenant, target_id: fixture.salesSuccess, event_type: "INVOICE_FINALIZED" } }), 1);
    const salesSuccessBatchesAfter = await prisma.product_batches.findMany({ where: { tenant_id: fixture.tenant, product_id: fixture.productA } });
    const availableBefore = salesSuccessBatchesBefore.reduce((total, batch) => total + Number(batch.available_qty), 0);
    const availableAfter = salesSuccessBatchesAfter.reduce((total, batch) => total + Number(batch.available_qty), 0);
    assert.equal(availableAfter, availableBefore - 1);
    console.log("SALES-SUCCESS=PASS_APPLICATION_PATH_DATABASE_E2E");

    const purchaseSuccessBefore = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseSuccess, tenant_id: fixture.tenant } });
    const purchaseSuccessForm = new FormData();
    purchaseSuccessForm.append("idempotency_key", `gst-e2e-success-${fixture.purchaseSuccess}`);
    const purchaseSuccessResult = await invokeSuccessfulAction(() =>
      finalizePurchaseAction(fixture.purchaseSuccess, {}, purchaseSuccessForm));
    assert.equal(purchaseSuccessResult.ok, true);
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
    console.log("PURCHASE-SUCCESS=PASS_APPLICATION_PATH_DATABASE_E2E");
    const reviewBefore = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseReview, tenant_id: fixture.tenant } });
    const reviewResult = await finalizePurchaseAction(fixture.purchaseReview, {}, new FormData());
    assert.equal(reviewResult.ok, false);
    const reviewAfter = await prisma.purchase_invoices.findUnique({ where: { id: fixture.purchaseReview, tenant_id: fixture.tenant } });
    assert.equal(reviewAfter.status, reviewBefore.status);
    assert.equal(await prisma.purchase_posting_operations.count({ where: { tenant_id: fixture.tenant, purchase_invoice_id: fixture.purchaseReview } }), 0);
    assert.equal(await prisma.stock_movements.count({ where: { tenant_id: fixture.tenant, reference_id: fixture.purchaseReview } }), 0);
    console.log("PURCHASE-GST-REVIEW-GUARD=PASS_APPLICATION_PATH_DATABASE_E2E");

    const customerPaymentForm = new FormData();
    for (const [key, value] of Object.entries({ customer_id: fixture.customer, amount: "50", payment_method: "Cash", reference_no: `GST-${fixture.salesSuccess}`, notes: "" })) customerPaymentForm.append(key, value);
    const customerBeforePayment = await prisma.customers.findUnique({ where: { id: fixture.customer, tenant_id: fixture.tenant } });
    const customerPayment = await createCustomerPaymentAction({}, customerPaymentForm);
    assert.equal(customerPayment.ok, true);
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
  const { updateProductAction, updateCustomerAction } = await import("../src/app/_actions/masters.actions.ts");
  const { loadBillingInvoicePrintData } = await import("../src/app/billing/[invoiceId]/print/data.ts");
  const { buildInvoicePrintSnapshot } = await import("../src/domain/services/gst-calculator.service.ts");
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
  } finally {
    clearFinancialE2eTestSession();
    if (prisma) await prisma.$disconnect().catch(() => {});
    if (bootstrap) await bootstrap.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
