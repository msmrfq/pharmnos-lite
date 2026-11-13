import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const productBatch = schema.split("model product_batches {")[1].split("}")[0];
const migration0029 = fs.readFileSync("prisma/migrations/0029_product_batch_manufacture_date/migration.sql", "utf8");
const migration0030 = fs.readFileSync("prisma/migrations/0030_finalized_sales_immutability/migration.sql", "utf8");
const migration0031 = fs.readFileSync("prisma/migrations/0031_draft_invoice_partial_uniqueness/migration.sql", "utf8");
const tenantIsolationSql = fs.readFileSync("prisma/09-signed-context-tenant-isolation.sql", "utf8");

test("C: product_batches model declares manufacture_date and created_by", () => {
  assert.match(productBatch, /manufacture_date\s+DateTime\?/);
  assert.match(productBatch, /created_by\s+String\?/);
});

test("C: migration 0029 adds manufacture_date and created_by as nullable", () => {
  assert.match(migration0029, /ADD COLUMN "manufacture_date" TIMESTAMP\(3\)/);
  assert.match(migration0029, /ADD COLUMN "created_by" TEXT/);
  assert.doesNotMatch(migration0029, /NOT NULL/);
});

test("B: migration 0030 freezes finalized sales financial fields", () => {
  assert.match(migration0030, /CREATE OR REPLACE FUNCTION public\.prevent_finalized_sales_mutation\(\)/);
  assert.match(migration0030, /NEW\.net_amount IS DISTINCT FROM OLD\.net_amount/);
  assert.match(migration0030, /NEW\.finalized_snapshot_hash IS DISTINCT FROM OLD\.finalized_snapshot_hash/);
  assert.match(migration0030, /NEW\.status IS DISTINCT FROM OLD\.status/);
  // reconciliation service maintains these after finalization, so they must stay mutable
  assert.doesNotMatch(migration0030, /NEW\.paid_amount IS DISTINCT FROM OLD\.paid_amount/);
  assert.doesNotMatch(migration0030, /NEW\.balance_due IS DISTINCT FROM OLD\.balance_due/);
  // item trigger present
  assert.match(migration0030, /prevent_finalized_sales_item_mutation/);
  assert.match(migration0030, /Finalized sales invoice lines are immutable/);
});

test("D: migration 0031 rebuilds partial unique indexes for draft coexistence", () => {
  assert.match(migration0031, /DROP INDEX IF EXISTS "sales_invoices_tenant_id_invoice_no_key"/);
  assert.match(migration0031, /DROP INDEX IF EXISTS "purchase_invoices_tenant_id_invoice_no_key"/);
  assert.match(migration0031, /WHERE "invoice_no" <> ''/);
  assert.match(migration0031, /CREATE UNIQUE INDEX "sales_invoices_tenant_id_invoice_no_key"/);
  assert.match(migration0031, /CREATE UNIQUE INDEX "purchase_invoices_tenant_id_invoice_no_key"/);
});

test("A: signed-context tenant isolation module covers all 39 tenant tables", () => {
  const tables = [
    "tenants", "users", "memberships", "roles", "role_permissions", "business_profiles",
    "products", "product_batches", "customers", "suppliers", "purchase_invoices",
    "purchase_supplier_documents", "purchase_posting_operations", "sales_posting_operations",
    "purchase_invoice_items", "purchase_gst_evidence_revisions", "purchase_gst_line_evidence",
    "purchase_gst_calculations", "purchase_gst_accounting_decisions",
    "purchase_gst_reconciliation_events", "purchase_gst_reconciliation_event_lines",
    "inventory_valuation_decisions", "inventory_valuation_adjustments", "sales_invoices",
    "sales_invoice_items", "payments", "payment_receipt_sequences", "payment_allocations",
    "allocation_reversals", "payment_refunds", "payment_reversals", "stock_movements",
    "customer_ledgers", "supplier_ledgers", "audit_logs", "hsn_sac_catalog",
    "hsn_sac_catalog_history", "gst_rate_rules", "gst_rate_rule_history",
  ];
  assert.equal(tables.length, 39, "39 tenant-scoped tables enumerated");
  for (const t of tables) {
    assert.ok(tenantIsolationSql.includes(t), `module references ${t}`);
  }
  assert.match(tenantIsolationSql, /FORCE ROW LEVEL SECURITY/);
  assert.match(tenantIsolationSql, /pharmnos_private\.verify_auth_context/);
  assert.match(tenantIsolationSql, /public\.financial_context_tenant_id\(\)/);
});

test("A: signed-context module fails closed and never commits a secret", () => {
  assert.match(tenantIsolationSql, /IF signing_secret IS NULL THEN RETURN/);
  assert.match(tenantIsolationSql, /IF supplied_signature <> expected_signature THEN RETURN/);
  assert.match(tenantIsolationSql, /IF expires_at <= extract\(epoch FROM clock_timestamp\(\)\)::bigint THEN RETURN/);
  assert.match(tenantIsolationSql, /REVOKE ALL ON SCHEMA pharmnos_private FROM PUBLIC/);
  // The operator insert must be present only as a commented-out placeholder.
  const uncommentedSecretInserts = tenantIsolationSql
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("INSERT INTO pharmnos_private.auth_context_keys"));
  assert.equal(uncommentedSecretInserts.length, 0, "no uncommented signing-secret insert is committed");
  assert.doesNotMatch(tenantIsolationSql, /eyJhbGciOi|postgres:\/\/[^'"]*@/);
});
