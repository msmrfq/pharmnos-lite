#!/usr/bin/env node
/**
 * Pharmnos Lite - disposable PostgreSQL runtime verification harness.
 *
 * Proves, against a real isolated PostgreSQL instance:
 *   Phase 3  - migration/schema/catalog alignment for the signed-context module
 *   Phase 4  - signed-context authentication and tenant isolation (direct + Prisma app path)
 *   Phase 5  - database protection contracts (immutability, batches, partial uniqueness)
 *   Phase 6  - inventory finalization contracts (explicit batch, FEFO, quantity+free_qty,
 *              rollback, oversell concurrency, valuation deferral)
 *   Phase 7  - core financial invariants (unapplied credit, allocation/reversal, refunds,
 *              concurrency, idempotency)
 *   Phase 8  - temporal contracts (Asia/Kolkata derivation, date-only semantics, guards)
 *
 * The harness never contains credentials. Every connection string and the signing
 * secret are read from environment variables supplied by the operator.
 *
 * Required env:
 *   TEST_DATABASE_URL                 bootstrap/owner connection (loopback disposable DB)
 *   FINANCIAL_E2E_RUNTIME_DATABASE_URL  runtime role connection (NOSUPERUSER NOBYPASSRLS)
 *   DATABASE_AUTH_CONTEXT_SIGNING_SECRET
 *   FINANCIAL_E2E_RUN_ID
 *   EVIDENCE_FILE                     absolute or repo-relative JSON evidence path
 *   FINANCIAL_E2E_DB_PORT             host port (must match the loopback URL)
 *   TEST_DATABASE_NAME                expected database name
 *
 * Guarded synthetic auth is enabled only when the caller also sets:
 *   FINANCIAL_E2E_TEST_MODE=true ALLOW_FINANCIAL_E2E=true
 *   TEST_DATABASE_MARKER=pharmnos-financial-e2e
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import pg from "pg";

const { Client } = pg;
const require = createRequire(import.meta.url);
const repoRoot = process.cwd();

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`${name} is required.`);
  return value;
}

const OWNER_URL = required("TEST_DATABASE_URL");
const RUNTIME_URL = required("FINANCIAL_E2E_RUNTIME_DATABASE_URL");
const SIGNING_SECRET = required("DATABASE_AUTH_CONTEXT_SIGNING_SECRET");
const RUN_ID = required("FINANCIAL_E2E_RUN_ID");
const EVIDENCE_FILE = required("EVIDENCE_FILE");
const EXPECTED_DATABASE = required("TEST_DATABASE_NAME");

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run runtime verification with NODE_ENV=production.");
}
if (!OWNER_URL.includes("127.0.0.1") || !RUNTIME_URL.includes("127.0.0.1")) {
  throw new Error("Both database URLs must target 127.0.0.1.");
}

// Application modules import "@/..." and Next request APIs. Patch both for node.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(repoRoot, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
const originalLoad = Module._load;
Module._load = function loadNextStubs(request, parent, isMain) {
  if (request === "next/cache" || request === "next/cache.js") {
    return { revalidatePath() {}, revalidateTag() {} };
  }
  if (request === "next/headers" || request === "next/headers.js") {
    return { cookies: () => ({ get: () => undefined, set() {}, delete() {} }) };
  }
  if (request === "next/navigation" || request === "next/navigation.js") {
    return {
      redirect(location) {
        throw new Error(`NEXT_REDIRECT:${location}`);
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "commonjs", moduleResolution: "node" });
require("ts-node/register/transpile-only");

// The application runtime must use the restricted runtime role.
process.env.DATABASE_URL = RUNTIME_URL;

const rid = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const now = new Date();
const BUSINESS_TREATMENT = "Registered Business – Regular";

function signContext({ subjectId, tenantId = "", expiresIn = 60, signature, nonce }) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const n = nonce ?? crypto.randomBytes(16).toString("hex");
  const payload = `v1|${subjectId}|${tenantId}|${expiresAt}|${n}`;
  const sig = signature ?? crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

const results = [];
function record(phase, id, contract, pass, expected, actual, dbEvidence = undefined) {
  results.push({ phase, id, contract, status: pass ? "PASS" : "FAIL", expected, actual, dbEvidence });
  return pass;
}

async function expectReject(fn, codes = []) {
  try {
    await fn();
    return { rejected: false, error: null };
  } catch (error) {
    const code = error?.code ?? null;
    return {
      rejected: true,
      error: { message: error?.message ?? String(error), code },
      codeMatched: codes.length === 0 || codes.includes(code),
    };
  }
}

function insertSql(table, row) {
  const keys = Object.keys(row);
  return `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys
    .map((_, i) => `$${i + 1}`)
    .join(",")})`;
}

async function insert(client, table, row) {
  const result = await client.query(insertSql(table, row), Object.values(row));
  return result.rows[0];
}

async function main() {
  const owner = new Client({ connectionString: OWNER_URL, application_name: "pharmnos-runtime-verify-owner" });
  const runtime = new Client({ connectionString: RUNTIME_URL, application_name: "pharmnos-runtime-verify-runtime" });
  await owner.connect();
  await runtime.connect();

  let prisma;
  let auth;
  let actions;
  let adjustActions;
  let valuationActions;
  let financial;
  let businessDate;
  const fixture = {};

  const exec = (text, values) => owner.query(text, values);
  const ownerCount = async (text, values) => Number((await exec(text, values)).rows[0].count);

  async function runtimeTx(context, work, mode = "rollback") {
    await runtime.query("BEGIN");
    try {
      if (context) {
        await runtime.query("SELECT set_config('pharmnos.auth_context', $1, true)", [context]);
      }
      const value = await work(runtime);
      await runtime.query(mode === "commit" ? "COMMIT" : "ROLLBACK");
      return value;
    } catch (error) {
      await runtime.query("ROLLBACK").catch(() => {});
      throw error;
    }
  }

  async function batchState(ids) {
    const r = await exec(
      `SELECT id, available_qty, received_qty, inventory_valuation_status
         FROM product_batches WHERE id = ANY($1::text[])`,
      [ids],
    );
    return Object.fromEntries(
      r.rows.map((row) => [
        row.id,
        {
          available: Number(row.available_qty),
          received: Number(row.received_qty),
          valuation: row.inventory_valuation_status,
        },
      ]),
    );
  }

  async function movementSummary(invoiceId) {
    const r = await exec(
      `SELECT COALESCE(SUM(quantity_delta), 0)::int AS delta, COUNT(*)::int AS rows,
              COALESCE(SUM(CASE WHEN batch_id = $3 THEN quantity_delta ELSE 0 END), 0)::int AS selected_delta
         FROM stock_movements WHERE tenant_id = $1 AND reference_id = $2 AND reference_type = 'sales_invoice'`,
      [fixture.tenantA, invoiceId, fixture.batchExplicit],
    );
    return r.rows[0];
  }

  async function seedDraft({ productId, batchId = null, batchNo = "", quantity, freeQty = 0, saleRate = 100 }) {
    const gross = quantity * saleRate;
    const tax = Number((gross * 0.18).toFixed(2));
    const net = Number((gross + tax).toFixed(2));
    const invoiceId = rid("draft");
    const itemId = rid("item");
    await insert(owner, "sales_invoices", {
      id: invoiceId,
      tenant_id: fixture.tenantA,
      invoice_no: "",
      customer_id: fixture.customerA,
      invoice_date: now,
      effective_date: "2026-11-01",
      due_date_business: "2026-11-15",
      status: "DRAFT",
      gst_treatment: BUSINESS_TREATMENT,
      tax_mode: "EXCLUSIVE",
      place_of_supply_code: "MH",
      gross_amount: gross,
      total_tax: tax,
      net_amount: net,
      balance_due: net,
      updated_at: now,
    });
    await insert(owner, "sales_invoice_items", {
      id: itemId,
      tenant_id: fixture.tenantA,
      invoice_id: invoiceId,
      product_id: productId,
      batch_id: batchId,
      batch_no: batchNo,
      quantity,
      free_qty: freeQty,
      sale_rate: saleRate,
      gst_rate: 18,
      line_total: net,
    });
    return { invoiceId, itemId };
  }

  async function invokeFinalize(invoiceId, idempotencyKey) {
    const form = new FormData();
    form.set("idempotency_key", idempotencyKey);
    try {
      const value = await actions.finalizeSalesInvoiceAction(invoiceId, {}, form);
      return { ok: value?.ok !== false, value };
    } catch (error) {
      if (String(error?.message ?? "").startsWith("NEXT_REDIRECT")) return { ok: true, redirected: true };
      return { ok: false, error: error?.message ?? String(error) };
    }
  }

  try {
    // ---------------------------------------------------------------------
    // Environment and catalog assertions (Phase 3)
    // ---------------------------------------------------------------------
    const identity = await exec(
      `SELECT current_database() AS db, current_user AS role, current_setting('server_version') AS version`,
    );
    record(
      3, "ENV-01", "Database identity and PostgreSQL version",
      identity.rows[0].db === EXPECTED_DATABASE && identity.rows[0].version.startsWith("17."),
      { database: EXPECTED_DATABASE, version: "17.x" },
      identity.rows[0],
    );

    const roleAttrs = await exec(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin, rolinherit
         FROM pg_roles WHERE rolname IN ('pharmnos_e2e_runtime', current_user) ORDER BY rolname`,
    );
    const runtimeAttrs = roleAttrs.rows.find((r) => r.rolname === "pharmnos_e2e_runtime");
    record(
      2, "ENV-02", "Runtime role is NOSUPERUSER NOBYPASSRLS with no DDL rights",
      !!runtimeAttrs && !runtimeAttrs.rolsuper && !runtimeAttrs.rolbypassrls &&
        !runtimeAttrs.rolcreatedb && !runtimeAttrs.rolcreaterole && runtimeAttrs.rolcanlogin,
      { rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolcanlogin: true },
      runtimeAttrs ?? null,
    );

    const catalog = await exec(`
      SELECT
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
            AND EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname AND p.policyname='signed_ctx_select')) AS protected,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND NOT (c.relrowsecurity AND c.relforcerowsecurity)) AS unprotected,
        (SELECT array_agg(c.relname ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND NOT (c.relrowsecurity AND c.relforcerowsecurity)) AS unprotected_tables,
        (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
        (SELECT count(*)::int FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations
    `);
    const cat = catalog.rows[0];
    const unprotectedList = String(cat.unprotected_tables ?? "").replace(/^\{|\}$/g, "");
    record(
      3, "ENV-03", "39 tenant-scoped tables have ENABLE + FORCE RLS and a signed_ctx_select policy",
      cat.protected === 39 && cat.unprotected === 1 && unprotectedList === "_prisma_migrations",
      { protected: 39, unprotected: ["_prisma_migrations"] },
      cat,
    );
    record(
      3, "ENV-04", "All 31 migrations are recorded as applied",
      Number(cat.migrations) === 31,
      { applied: 31 },
      { applied: Number(cat.migrations) },
    );

    const immutable = [
      "purchase_gst_evidence_revisions", "purchase_gst_line_evidence", "purchase_gst_calculations",
      "purchase_gst_accounting_decisions", "purchase_gst_reconciliation_events",
      "purchase_gst_reconciliation_event_lines", "inventory_valuation_decisions",
      "inventory_valuation_adjustments", "hsn_sac_catalog_history", "gst_rate_rule_history", "audit_logs",
    ];
    const badImmutable = await exec(`
      SELECT tablename FROM pg_policies
      WHERE schemaname='public' AND policyname='signed_ctx_update' AND tablename = ANY($1::text[])
    `, [immutable]);
    record(
      3, "ENV-05", "Immutable/audit tables expose no signed-context UPDATE policy",
      badImmutable.rows.length === 0,
      { unexpectedUpdatePolicies: [] },
      { unexpectedUpdatePolicies: badImmutable.rows.map((r) => r.tablename) },
    );

    const fnPriv = await exec(`
      SELECT has_function_privilege('pharmnos_e2e_runtime',
               'pharmnos_private.verify_auth_context(text)', 'EXECUTE') AS private_verify,
             has_function_privilege('pharmnos_e2e_runtime',
               'public.financial_context_tenant_id()', 'EXECUTE') AS public_wrapper,
             has_table_privilege('pharmnos_e2e_runtime', 'public.payment_receipt_sequences', 'DELETE') AS can_delete,
             has_table_privilege('pharmnos_e2e_runtime', 'public.payment_receipt_sequences', 'UPDATE') AS can_update
    `);
    record(
      3, "ENV-06", "Runtime role cannot execute the private verifier but can execute the public SECURITY DEFINER wrappers",
      fnPriv.rows[0].private_verify === false && fnPriv.rows[0].public_wrapper === true,
      { privateVerifyExecute: false, publicWrapperExecute: true },
      fnPriv.rows[0],
    );
    record(
      3, "ENV-07", "Runtime role has UPDATE but no DELETE privilege (least privilege)",
      fnPriv.rows[0].can_delete === false && fnPriv.rows[0].can_update === true,
      { delete: false, update: true },
      { delete: fnPriv.rows[0].can_delete, update: fnPriv.rows[0].can_update },
    );

    const indexes = await exec(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname='public' AND indexname IN (
        'sales_invoices_tenant_id_invoice_no_key',
        'purchase_invoices_tenant_id_invoice_no_key',
        'purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key')
    `);
    const indexMap = Object.fromEntries(indexes.rows.map((r) => [r.indexname, r.indexdef]));
    record(
      3, "ENV-08", "Partial unique indexes for invoice numbers exist with the expected predicates",
      /WHERE \(invoice_no <> ''::text\)/.test(indexMap.sales_invoices_tenant_id_invoice_no_key ?? "") &&
        /WHERE \(invoice_no <> ''::text\)/.test(indexMap.purchase_invoices_tenant_id_invoice_no_key ?? "") &&
        /btrim\(supplier_invoice_no\)/.test(indexMap.purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key ?? ""),
      { salesPartial: true, purchasePartial: true, supplierTrimmedUnique: true },
      indexMap,
    );

    const triggers = await exec(`
      SELECT tgrelid::regclass::text AS table_name, tgname
      FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1, 2
    `);
    const triggerSet = new Set(triggers.rows.map((r) => `${r.table_name}::${r.tgname}`));
    const requiredTriggers = [
      "sales_invoices::prevent_finalized_sales_mutation",
      "sales_invoice_items::prevent_finalized_sales_item_mutation",
      "purchase_invoices::prevent_finalized_purchase_mutation",
      "sales_invoices::sales_invoices_guard_financial_dates",
      "purchase_invoices::purchase_invoices_guard_financial_dates",
      "payments::payments_assign_recorded_at",
      "customer_ledgers::customer_ledgers_protect_financial_dates",
      "payment_refunds::payment_refunds_guard_financial_dates",
    ];
    record(
      3, "ENV-09", "Immutability and financial-date triggers are installed",
      requiredTriggers.every((t) => triggerSet.has(t)),
      { required: requiredTriggers },
      { present: requiredTriggers.filter((t) => triggerSet.has(t)), missing: requiredTriggers.filter((t) => !triggerSet.has(t)) },
    );

    const batchColumns = await exec(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='product_batches'
        AND column_name IN ('manufacture_date','created_by') ORDER BY column_name
    `);
    record(
      3, "ENV-10", "product_batches.manufacture_date and created_by exist",
      batchColumns.rows.length === 2,
      { columns: ["created_by", "manufacture_date"] },
      batchColumns.rows,
    );

    // ---------------------------------------------------------------------
    // Fixtures (bootstrap/owner role; RLS does not apply to the owner)
    // ---------------------------------------------------------------------
    const tenantA = rid("tenant_a");
    const tenantB = rid("tenant_b");
    const userA = rid("user_a");
    const userB = rid("user_b");
    const roleA = rid("role_a");
    const roleB = rid("role_b");
    const membershipA = rid("membership_a");
    const membershipB = rid("membership_b");
    const customerA = rid("customer_a");
    const customerB = rid("customer_b");
    const supplierA = rid("supplier_a");
    const productExplicit = rid("product_explicit");
    const productFefo = rid("product_fefo");
    const productShort = rid("product_short");
    const productRollback = rid("product_rollback");
    const productConcurrent = rid("product_concurrent");
    const productValuation = rid("product_valuation");
    const productAdjust = rid("product_adjust");
    const batchExplicit = rid("batch_explicit");
    const batchExplicitOther = rid("batch_explicit_other");
    const batchFefoEarly = rid("batch_fefo_early");
    const batchFefoLate = rid("batch_fefo_late");
    const batchShort = rid("batch_short");
    const batchRollback = rid("batch_rollback");
    const batchConcurrent = rid("batch_concurrent");
    const batchAdjust = rid("batch_adjust");
    const finalizedSales = rid("finalized_sales");
    const finalizedSalesItem = rid("finalized_sales_item");
    const finalizedSalesB = rid("finalized_sales_b");
    const finalizedPurchase = rid("finalized_purchase");
    const finalizedPurchaseItem = rid("finalized_purchase_item");
    const finalizedPurchaseBatch = rid("finalized_purchase_batch");
    const finalizedPurchaseMovement = rid("finalized_purchase_movement");
    const draftPurchase = rid("draft_purchase");
    const draftPurchaseItem = rid("draft_purchase_item");
    const draftPurchaseBatch = rid("draft_purchase_batch");
    const subjectA = `subject-a-${userA}`;
    const subjectB = `subject-b-${userB}`;

    Object.assign(fixture, {
      tenantA, tenantB, userA, userB, subjectA, subjectB, membershipA,
      customerA, customerB, supplierA,
      productExplicit, productFefo, productShort, productRollback, productConcurrent, productValuation, productAdjust,
      batchExplicit, batchExplicitOther, batchFefoEarly, batchFefoLate, batchShort, batchRollback, batchConcurrent, batchAdjust,
      finalizedSales, finalizedSalesItem, finalizedPurchase, finalizedPurchaseItem,
      finalizedPurchaseBatch, draftPurchase, draftPurchaseItem, draftPurchaseBatch,
    });

    await exec("BEGIN");
    try {
      await insert(owner, "tenants", { id: tenantA, slug: `runtime-a-${tenantA}`, business_name: "Runtime Tenant A", updated_at: now });
      await insert(owner, "tenants", { id: tenantB, slug: `runtime-b-${tenantB}`, business_name: "Runtime Tenant B", updated_at: now });
      await insert(owner, "users", { id: userA, external_id: subjectA, email: subjectA, full_name: "Runtime A", updated_at: now });
      await insert(owner, "users", { id: userB, external_id: subjectB, email: subjectB, full_name: "Runtime B", updated_at: now });
      await insert(owner, "roles", { id: roleA, tenant_id: tenantA, name: "runtime-role-a", is_default: true, updated_at: now });
      await insert(owner, "roles", { id: roleB, tenant_id: tenantB, name: "runtime-role-b", is_default: true, updated_at: now });
      for (const permission of ["create_invoice", "finalize_invoice", "create_payment", "manage_batches", "adjust_stock"]) {
        await insert(owner, "role_permissions", { id: rid("perm"), role_id: roleA, permission });
      }
      await insert(owner, "memberships", { id: membershipA, tenant_id: tenantA, user_id: userA, role_id: roleA, status: "active", updated_at: now });
      await insert(owner, "memberships", { id: membershipB, tenant_id: tenantB, user_id: userB, role_id: roleB, status: "active", updated_at: now });
      await insert(owner, "business_profiles", {
        id: rid("profile"), tenant_id: tenantA, state: "MH", invoice_prefix: "INV", invoice_next_seq: 41,
        purchase_prefix: "PUR", purchase_next_seq: 71, updated_at: now,
      });
      await insert(owner, "customers", { id: customerA, tenant_id: tenantA, business_name: "Runtime Customer A", billing_state: "MH", receivable_balance: 0, updated_at: now });
      await insert(owner, "customers", { id: customerB, tenant_id: tenantB, business_name: "Runtime Customer B", billing_state: "MH", receivable_balance: 0, updated_at: now });
      await insert(owner, "suppliers", { id: supplierA, tenant_id: tenantA, business_name: "Runtime Supplier A", payable_balance: 0, updated_at: now });

      const catalogId = rid("catalog");
      await insert(owner, "hsn_sac_catalog", {
        id: catalogId, tenant_id: tenantA, code: "3004", description: "Runtime goods",
        classification_type: "GOODS", classification_status: "APPROVED", rate_approval_status: "APPROVED",
        source_reference: "RUNTIME-SOURCE", effective_from: "2020-01-01", is_active: true,
        classification_approved_by_membership_id: membershipA, classification_approved_at: now,
        created_at: now, updated_at: now,
      });
      await insert(owner, "gst_rate_rules", {
        id: rid("rate"), tenant_id: tenantA, hsn_sac_catalog_id: catalogId, rule_version: "runtime-v1",
        tax_rate: 18, component_policy: "IGST", approval_status: "APPROVED", source_reference: "RUNTIME-RATE",
        effective_from: "2020-01-01", is_active: true, approved_by_membership_id: membershipA,
        approved_at: now, created_at: now, updated_at: now,
      });

      for (const [id, name] of [
        [productExplicit, "Explicit Batch Product"],
        [productFefo, "FEFO Product"],
        [productShort, "Short Stock Product"],
        [productRollback, "Rollback Product"],
        [productConcurrent, "Concurrent Product"],
        [productValuation, "Valuation Product"],
        [productAdjust, "Adjustment Product"],
      ]) {
        await insert(owner, "products", {
          id, tenant_id: tenantA, name, hsn_code: "3004", gst_rate: 18,
          standard_sale_rate: 100, updated_at: now,
        });
      }

      const batch = (id, productId, batchNo, available, expiry, extra = {}) => ({
        id, tenant_id: tenantA, product_id: productId, batch_no: batchNo, sale_rate: 100,
        received_qty: available, available_qty: available,
        expiry_date: expiry ? new Date(`${expiry}T00:00:00.000Z`) : null,
        updated_at: now, ...extra,
      });
      await insert(owner, "product_batches", batch(batchExplicit, productExplicit, "EX-SELECTED", 5, "2027-06-15"));
      await insert(owner, "product_batches", batch(batchExplicitOther, productExplicit, "EX-EARLIER", 5, "2027-01-15"));
      await insert(owner, "product_batches", batch(batchFefoEarly, productFefo, "FEFO-EARLY", 1, "2027-01-10"));
      await insert(owner, "product_batches", batch(batchFefoLate, productFefo, "FEFO-LATE", 5, "2027-06-10"));
      await insert(owner, "product_batches", batch(batchShort, productShort, "SHORT-1", 1, "2027-03-01"));
      await insert(owner, "product_batches", batch(batchRollback, productRollback, "ROLLBACK-1", 5, "2027-04-01"));
      await insert(owner, "product_batches", batch(batchConcurrent, productConcurrent, "CONCUR-1", 6, "2027-05-01"));
      await insert(owner, "product_batches", batch(batchAdjust, productAdjust, "ADJUST-1", 10, "2027-09-01"));

      await insert(owner, "sales_invoices", {
        id: finalizedSales, tenant_id: tenantA, invoice_no: "FIN-A-1", customer_id: customerA,
        invoice_date: new Date("2026-10-20T00:00:00.000Z"), effective_date: "2026-10-20",
        due_date_business: "2026-11-03", status: "DRAFT", gst_treatment: BUSINESS_TREATMENT,
        tax_mode: "EXCLUSIVE", place_of_supply_code: "MH", gross_amount: 1000, total_tax: 180,
        net_amount: 1180, paid_amount: 0, balance_due: 1180, updated_at: now,
      });
      await insert(owner, "sales_invoice_items", {
        id: finalizedSalesItem, tenant_id: tenantA, invoice_id: finalizedSales,
        product_id: productExplicit, batch_id: batchExplicit, batch_no: "EX-SELECTED",
        quantity: 10, free_qty: 0, sale_rate: 100, gst_rate: 18, line_total: 1180,
      });
      // Finalize after its items exist: item inserts into a FINALIZED invoice are
      // deliberately impossible, so the fixture must follow the real transition.
      await exec(
        `UPDATE sales_invoices SET status = 'FINALIZED', finalized_at = $2 WHERE id = $1`,
        [finalizedSales, now],
      );
      await insert(owner, "sales_invoices", {
        id: finalizedSalesB, tenant_id: tenantB, invoice_no: "FIN-B-1", customer_id: customerB,
        invoice_date: new Date("2026-10-20T00:00:00.000Z"), effective_date: "2026-10-20",
        due_date_business: "2026-11-03", status: "FINALIZED", gst_treatment: BUSINESS_TREATMENT,
        tax_mode: "EXCLUSIVE", place_of_supply_code: "MH", gross_amount: 700, total_tax: 126,
        net_amount: 826, paid_amount: 0, balance_due: 826, finalized_at: now, updated_at: now,
      });

      await insert(owner, "purchase_invoices", {
        id: finalizedPurchase, tenant_id: tenantA, invoice_no: "PUR-A-1", supplier_id: supplierA,
        supplier_invoice_no: "SUP-A-1", invoice_date: new Date("2026-10-01T00:00:00.000Z"),
        effective_date: "2026-10-01", due_date_business: "2026-10-31", status: "FINALIZED",
        gst_treatment: BUSINESS_TREATMENT, tax_mode: "EXCLUSIVE", gross_amount: 100, total_tax: 18,
        net_amount: 118, finalized_at: now, updated_at: now,
      });
      await insert(owner, "purchase_invoice_items", {
        id: finalizedPurchaseItem, tenant_id: tenantA, purchase_id: finalizedPurchase,
        product_id: productValuation, batch_no: "VAL-1", quantity: 1, purchase_rate: 100,
        gst_rate: 18, gst_amount: 18, line_total: 118,
        accepted_taxable_value: 100, accepted_cgst: 9, accepted_sgst: 9, accepted_igst: 0,
        accepted_cess: 0, accepted_line_total: 118, accepted_value_source: "SUPPLIER_DECLARED",
        accepted_at: now, accepted_by_membership_id: membershipA, gst_acceptance_status: "ACCEPTED",
      });
      await insert(owner, "product_batches", {
        ...batch(finalizedPurchaseBatch, productValuation, "VAL-1", 1, "2027-07-01"),
        purchase_id: finalizedPurchase, purchase_rate: 100, inventory_valuation_status: "PENDING",
      });
      await insert(owner, "stock_movements", {
        id: finalizedPurchaseMovement, tenant_id: tenantA, product_id: productValuation,
        batch_id: finalizedPurchaseBatch, movement_type: "PURCHASE_IN", quantity_delta: 1,
        reference_type: "purchase_invoice", reference_id: finalizedPurchase, unit_rate: 100,
        inventory_valuation_status: "PENDING", created_by: userA, created_at: now,
      });

      await insert(owner, "purchase_invoices", {
        id: draftPurchase, tenant_id: tenantA, invoice_no: "", supplier_id: supplierA,
        supplier_invoice_no: "SUP-DRAFT-1", invoice_date: now, effective_date: "2026-11-01",
        due_date_business: "2026-11-15", status: "DRAFT", gst_treatment: BUSINESS_TREATMENT,
        tax_mode: "EXCLUSIVE", gross_amount: 100, total_tax: 18, net_amount: 118, updated_at: now,
      });
      await insert(owner, "purchase_invoice_items", {
        id: draftPurchaseItem, tenant_id: tenantA, purchase_id: draftPurchase,
        product_id: productValuation, batch_no: "DRAFT-VAL-1", quantity: 1, purchase_rate: 100,
        gst_rate: 18, gst_amount: 18, line_total: 118,
      });
      await insert(owner, "product_batches", {
        ...batch(draftPurchaseBatch, productValuation, "DRAFT-VAL-1", 1, "2027-08-01"),
        purchase_id: draftPurchase, purchase_rate: 100, inventory_valuation_status: "PENDING",
      });
      await exec("COMMIT");
    } catch (error) {
      await exec("ROLLBACK").catch(() => {});
      throw error;
    }

    // ---------------------------------------------------------------------
    // Phase 4 - signed context, direct PostgreSQL path
    // ---------------------------------------------------------------------
    const contextA = () => signContext({ subjectId: subjectA, tenantId: tenantA });
    const contextB = () => signContext({ subjectId: subjectB, tenantId: tenantB });

    const valid = await runtimeTx(contextA(), async (client) => {
      const r = await client.query(
        `SELECT public.financial_context_subject() AS subject,
                public.financial_context_tenant_id() AS tenant,
                (SELECT count(*)::int FROM sales_invoices) AS visible`,
      );
      return r.rows[0];
    });
    record(
      4, "AC-01", "Valid context resolves subject/tenant and permits same-tenant reads",
      valid.subject === subjectA && valid.tenant === tenantA && Number(valid.visible) >= 1,
      { subject: subjectA, tenant: tenantA, visibleAtLeast: 1 },
      { subject: valid.subject, tenant: valid.tenant, visible: Number(valid.visible) },
    );

    const noContext = await runtimeTx(null, async (client) => {
      const r = await client.query(
        `SELECT (SELECT count(*)::int FROM sales_invoices) AS sales,
                public.financial_context_tenant_id() AS tenant`,
      );
      return r.rows[0];
    });
    record(
      4, "AC-02", "Missing context fails closed (no rows, no tenant identity)",
      Number(noContext.sales) === 0 && noContext.tenant === null,
      { sales: 0, tenant: null },
      { sales: Number(noContext.sales), tenant: noContext.tenant },
    );

    const negativeContexts = [
      ["AC-03", "Malformed context fails closed", "not-a-signed-context"],
      ["AC-04", "Invalid HMAC signature fails closed", `${contextA().split(".")[0]}.${"0".repeat(64)}`],
      ["AC-05", "Expired context fails closed", signContext({ subjectId: subjectA, tenantId: tenantA, expiresIn: -5 })],
      ["AC-06", "Tenant mismatch (subject A, tenant B) fails closed", signContext({ subjectId: subjectA, tenantId: tenantB })],
      ["AC-07", "Unknown subject fails closed", signContext({ subjectId: "missing-subject", tenantId: tenantA })],
    ];
    for (const [id, contract, context] of negativeContexts) {
      const observed = await runtimeTx(context, async (client) => {
        const r = await client.query(
          `SELECT public.financial_context_tenant_id() AS tenant,
                  (SELECT count(*)::int FROM sales_invoices) AS visible`,
        );
        return r.rows[0];
      });
      record(
        4, id, contract,
        observed.tenant === null && Number(observed.visible) === 0,
        { tenant: null, visible: 0 },
        { tenant: observed.tenant, visible: Number(observed.visible) },
      );
    }

    const replayContext = contextA();
    const firstUse = await runtimeTx(replayContext, async (client) => {
      const r = await client.query("SELECT public.financial_context_tenant_id() AS tenant");
      return r.rows[0];
    }, "commit");
    const secondUse = await runtimeTx(replayContext, async (client) => {
      const r = await client.query("SELECT public.financial_context_tenant_id() AS tenant");
      return r.rows[0];
    });
    record(
      4, "AC-08", "A context nonce is single-transaction; reuse in another transaction fails closed",
      firstUse.tenant === tenantA && secondUse.tenant === null,
      { first: tenantA, second: null },
      { first: firstUse.tenant, second: secondUse.tenant },
    );

    const afterContextTx = await runtimeTx(null, async (client) =>
      (await client.query("SELECT count(*)::int AS visible FROM sales_invoices")).rows[0]);
    record(
      4, "AC-09", "Context does not leak across transactions",
      Number(afterContextTx.visible) === 0,
      { visible: 0 },
      { visible: Number(afterContextTx.visible) },
    );

    const crossRead = await runtimeTx(contextA(), async (client) => {
      const r = await client.query(
        `SELECT (SELECT count(*)::int FROM sales_invoices WHERE tenant_id = $1) AS cross_tenant,
                (SELECT count(*)::int FROM sales_invoices) AS all_visible`,
        [tenantB],
      );
      return r.rows[0];
    });
    record(
      4, "AC-10", "Cross-tenant reads return zero rows under a tenant-A context",
      Number(crossRead.cross_tenant) === 0 && Number(crossRead.all_visible) >= 1,
      { crossTenant: 0, ownTenantVisible: ">=1" },
      { crossTenant: Number(crossRead.cross_tenant), allVisible: Number(crossRead.all_visible) },
    );

    const crossUpdate = await runtimeTx(contextA(), async (client) => {
      const r = await client.query(
        `UPDATE sales_invoices SET notes = 'cross-tenant-update' WHERE tenant_id = $1 RETURNING id`,
        [tenantB],
      );
      return r.rowCount;
    });
    record(
      4, "AC-11", "Cross-tenant UPDATE affects zero rows",
      crossUpdate === 0,
      { updated: 0 },
      { updated: crossUpdate },
    );

    const crossInsert = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `INSERT INTO sales_invoices (id, tenant_id, invoice_no, invoice_date, gross_amount, net_amount, updated_at)
           VALUES ($1, $2, 'X-TENANT', now(), 1, 1, now())`,
          [rid("cross"), tenantB],
        );
      }),
      ["42501"],
    );
    record(
      4, "AC-12", "Cross-tenant INSERT is rejected by row-level security (42501)",
      crossInsert.rejected && crossInsert.codeMatched,
      { sqlstate: "42501" },
      crossInsert.error,
    );

    const sameTenant = await runtimeTx(contextA(), async (client) => {
      const created = await client.query(
        `INSERT INTO sales_invoices (id, tenant_id, invoice_no, invoice_date, gross_amount, net_amount, updated_at)
         VALUES ($1, $2, '', now(), 1, 1, now()) RETURNING id`,
        [rid("own"), tenantA],
      );
      const updated = await client.query(
        `UPDATE sales_invoices SET notes = 'same-tenant-update' WHERE id = $1 RETURNING id`,
        [created.rows[0].id],
      );
      return { created: created.rowCount, updated: updated.rowCount };
    }, "commit");
    record(
      4, "AC-13", "Same-tenant INSERT and UPDATE succeed",
      sameTenant.created === 1 && sameTenant.updated === 1,
      { created: 1, updated: 1 },
      sameTenant,
    );

    const bypassOff = await expectReject(
      () => runtimeTx(null, async (client) => {
        await client.query("SET LOCAL row_security = off");
        await client.query("SELECT count(*) FROM sales_invoices");
      }),
      ["42501"],
    );
    record(
      4, "AC-14", "Runtime role cannot disable row-level security",
      bypassOff.rejected && bypassOff.codeMatched,
      { sqlstate: "42501" },
      bypassOff.error,
    );

    const privateCall = await expectReject(
      () => runtimeTx(contextA(), async (client) =>
        client.query("SELECT * FROM pharmnos_private.verify_auth_context($1)", [contextA()])),
      ["42501"],
    );
    record(
      4, "AC-15", "Historical 42501 reproduced only for the private verifier; public wrappers are the intended path",
      privateCall.rejected && privateCall.codeMatched,
      { privateVerifySqlstate: "42501" },
      privateCall.error,
    );

    // ---------------------------------------------------------------------
    // Phase 4 - application Prisma transaction path
    // ---------------------------------------------------------------------
    prisma = require("@/lib/db/prisma.ts").prisma;
    auth = require("@/adapters/auth/index.ts");
    const tenantContext = require("@/lib/db/tenant-context.ts");
    const establishTenantContext = tenantContext.establishTenantContext;
    auth.authAdapter.setAppMetadataTenantId = async () => {};
    const ctxA = {
      tenantId: tenantA, userId: userA, subjectId: subjectA, membershipId: membershipA,
      roles: ["runtime-role-a"], permissions: ["finalize_invoice", "create_payment", "manage_batches", "adjust_stock"],
    };

    const appOwn = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctxA);
      const rows = await tx.sales_invoices.findMany({ select: { tenant_id: true } });
      return { count: rows.length, tenants: [...new Set(rows.map((r) => r.tenant_id))] };
    });
    record(
      4, "APP-01", "establishTenantContext + Prisma transaction returns only the caller tenant",
      appOwn.count >= 1 && appOwn.tenants.length === 1 && appOwn.tenants[0] === tenantA,
      { tenants: [tenantA] },
      appOwn,
    );

    const appCross = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctxA);
      return tx.sales_invoices.findFirst({ where: { id: finalizedSalesB, tenant_id: tenantB } });
    });
    record(
      4, "APP-02", "Cross-tenant Prisma read inside a tenant-A transaction returns null",
      appCross === null,
      { result: null },
      { result: appCross },
    );

    const appNoContext = await prisma.sales_invoices.findMany({ select: { id: true } });
    record(
      4, "APP-03", "Prisma query without establishTenantContext returns zero rows",
      appNoContext.length === 0,
      { rows: 0 },
      { rows: appNoContext.length },
    );

    const appCrossInsert = await expectReject(
      () => prisma.$transaction(async (tx) => {
        await establishTenantContext(tx, ctxA);
        await tx.sales_invoices.create({
          data: {
            id: rid("app_cross"), tenant_id: tenantB, invoice_no: "APP-X", invoice_date: now,
            gross_amount: 1, net_amount: 1,
          },
        });
      }),
    );
    record(
      4, "APP-04", "Cross-tenant Prisma INSERT is rejected",
      appCrossInsert.rejected,
      { rejected: true },
      appCrossInsert.error,
    );

    const appSame = await prisma.$transaction(async (tx) => {
      await establishTenantContext(tx, ctxA);
      return tx.sales_invoices.create({
        data: {
          id: rid("app_own"), tenant_id: tenantA, invoice_no: "", invoice_date: now,
          gross_amount: 1, net_amount: 1,
        },
        select: { id: true, tenant_id: true },
      });
    });
    record(
      4, "APP-05", "Same-tenant Prisma INSERT succeeds and persists tenant ownership",
      appSame.tenant_id === tenantA,
      { tenant_id: tenantA },
      appSame,
    );

    const appLeak = await prisma.sales_invoices.findMany({ select: { id: true } });
    record(
      4, "APP-06", "Established context does not leak to later Prisma transactions",
      appLeak.length === 0,
      { rows: 0 },
      { rows: appLeak.length },
    );

    auth.installFinancialE2eTestSession(subjectA);
    let sessionCtx;
    try {
      sessionCtx = await tenantContext.requireServerTenantContext();
    } finally {
      auth.clearFinancialE2eTestSession();
    }
    record(
      4, "APP-07", "Subject -> membership -> permissions -> tenant context resolves through RLS",
      sessionCtx.tenantId === tenantA && sessionCtx.subjectId === subjectA &&
        sessionCtx.permissions.includes("finalize_invoice"),
      { tenantId: tenantA, subjectId: subjectA, hasFinalize: true },
      {
        tenantId: sessionCtx.tenantId, subjectId: sessionCtx.subjectId,
        permissions: sessionCtx.permissions, membershipId: sessionCtx.membershipId,
      },
    );

    // ---------------------------------------------------------------------
    // Phase 5 - database protection contracts
    // ---------------------------------------------------------------------
    const updateFinalized = await expectReject(() =>
      exec(`UPDATE sales_invoices SET gross_amount = 1 WHERE id = $1`, [finalizedSales]));
    record(
      5, "DP-01", "Finalized sales header cannot be mutated",
      updateFinalized.rejected,
      { rejected: true },
      updateFinalized.error,
    );

    const updateFinalizedItem = await expectReject(() =>
      exec(`UPDATE sales_invoice_items SET quantity = 99 WHERE id = $1`, [finalizedSalesItem]));
    record(
      5, "DP-02", "Finalized sales item cannot be mutated",
      updateFinalizedItem.rejected,
      { rejected: true },
      updateFinalizedItem.error,
    );

    const deleteFinalized = await expectReject(() =>
      exec(`DELETE FROM sales_invoices WHERE id = $1`, [finalizedSales]));
    record(
      5, "DP-03", "Finalized sales header cannot be deleted",
      deleteFinalized.rejected,
      { rejected: true },
      deleteFinalized.error,
    );

    const mutableFields = await expectReject(() =>
      exec(`UPDATE sales_invoices SET paid_amount = 10, balance_due = 1170 WHERE id = $1`, [finalizedSales]));
    record(
      5, "DP-04", "Legitimately mutable finalized fields (paid_amount/balance_due) remain writable",
      !mutableFields.rejected,
      { rejected: false },
      mutableFields.error,
    );

    const draftProtected = await seedDraft({ productId: productExplicit, batchId: batchExplicit, batchNo: "EX-SELECTED", quantity: 1 });
    const draftUpdate = await expectReject(() =>
      exec(`UPDATE sales_invoices SET notes = 'draft-editable' WHERE id = $1`, [draftProtected.invoiceId]));
    const draftDelete = await expectReject(() =>
      exec(`DELETE FROM sales_invoices WHERE id = $1`, [draftProtected.invoiceId]));
    record(
      5, "DP-05", "Draft invoices remain editable and deletable",
      !draftUpdate.rejected && !draftDelete.rejected,
      { updateRejected: false, deleteRejected: false },
      { updateError: draftUpdate.error, deleteError: draftDelete.error },
    );

    const purchaseUpdate = await expectReject(() =>
      exec(`UPDATE purchase_invoices SET net_amount = 1 WHERE id = $1`, [finalizedPurchase]));
    const purchaseDelete = await expectReject(() =>
      exec(`DELETE FROM purchase_invoices WHERE id = $1`, [finalizedPurchase]));
    record(
      5, "DP-06", "Finalized purchase header cannot be mutated or deleted",
      purchaseUpdate.rejected && purchaseDelete.rejected,
      { updateRejected: true, deleteRejected: true },
      { updateError: purchaseUpdate.error, deleteError: purchaseDelete.error },
    );

    const batchId = rid("batch_props");
    await insert(owner, "product_batches", {
      id: batchId, tenant_id: tenantA, product_id: productExplicit, batch_no: "PROPS-1",
      sale_rate: 100, received_qty: 0, available_qty: 0, manufacture_date: "2025-03-01",
      created_by: userA, updated_at: now,
    });
    const batchProps = (await exec(
      `SELECT manufacture_date::text AS manufacture_date, created_by, tenant_id FROM product_batches WHERE id = $1`,
      [batchId],
    )).rows[0];
    record(
      5, "DP-07", "Product batch manufacture_date/created_by persist with tenant ownership",
      String(batchProps.manufacture_date).startsWith("2025-03-01") &&
        batchProps.created_by === userA && batchProps.tenant_id === tenantA,
      { manufacture_date: "2025-03-01", created_by: userA, tenant_id: tenantA },
      batchProps,
    );

    await insert(owner, "sales_invoices", {
      id: rid("empty1"), tenant_id: tenantA, invoice_no: "", invoice_date: now,
      gross_amount: 0, net_amount: 0, updated_at: now,
    });
    const emptyDup = await expectReject(() =>
      insert(owner, "sales_invoices", {
        id: rid("empty2"), tenant_id: tenantA, invoice_no: "", invoice_date: now,
        gross_amount: 0, net_amount: 0, updated_at: now,
      }));
    record(
      5, "DP-08", "Empty draft invoice numbers do not collide within a tenant",
      !emptyDup.rejected,
      { rejected: false },
      emptyDup.error,
    );

    await insert(owner, "sales_invoices", {
      id: rid("dup1"), tenant_id: tenantA, invoice_no: "DUP-1", invoice_date: now,
      gross_amount: 0, net_amount: 0, updated_at: now,
    });
    const nonEmptyDup = await expectReject(() =>
      insert(owner, "sales_invoices", {
        id: rid("dup2"), tenant_id: tenantA, invoice_no: "DUP-1", invoice_date: now,
        gross_amount: 0, net_amount: 0, updated_at: now,
      }));
    record(
      5, "DP-09", "Non-empty invoice numbers stay unique per tenant",
      nonEmptyDup.rejected && nonEmptyDup.codeMatched === true,
      { sqlstate: "23505" },
      nonEmptyDup.error,
    );

    const crossTenantNumber = await expectReject(() =>
      insert(owner, "sales_invoices", {
        id: rid("dup3"), tenant_id: tenantB, invoice_no: "DUP-1", invoice_date: now,
        gross_amount: 0, net_amount: 0, updated_at: now,
      }));
    record(
      5, "DP-10", "The same invoice number is allowed in a different tenant",
      !crossTenantNumber.rejected,
      { rejected: false },
      crossTenantNumber.error,
    );

    const recordedGuard = await expectReject(() =>
      exec(`UPDATE sales_invoices SET finalized_recorded_at = now() WHERE id = $1`, [finalizedSales]));
    record(
      5, "DP-11", "finalized_recorded_at is database-assigned and immutable",
      recordedGuard.rejected && recordedGuard.codeMatched,
      { sqlstate: "42501" },
      recordedGuard.error,
    );

    // ---------------------------------------------------------------------
    // Phase 6 - inventory finalization
    // ---------------------------------------------------------------------
    auth.installFinancialE2eTestSession(subjectA);
    actions = require("@/app/_actions/sales.actions.ts");
    adjustActions = require("@/app/_actions/purchases.actions.ts");
    valuationActions = require("@/app/_actions/inventory-valuation.actions.ts");

    try {
      const explicitDraft = await seedDraft({
        productId: productExplicit, batchId: batchExplicit, batchNo: "EX-SELECTED",
        quantity: 1, freeQty: 1,
      });
      const explicitBefore = await batchState([batchExplicit, batchExplicitOther]);
      const explicitResult = await invokeFinalize(explicitDraft.invoiceId, `explicit-${RUN_ID}`);
      const explicitAfter = await batchState([batchExplicit, batchExplicitOther]);
      const explicitMovements = await movementSummary(explicitDraft.invoiceId);
      const explicitInvoice = (await exec(
        `SELECT status, invoice_no FROM sales_invoices WHERE id = $1`, [explicitDraft.invoiceId])).rows[0];
      const explicitItem = (await exec(
        `SELECT free_qty, batch_id FROM sales_invoice_items WHERE id = $1`, [explicitDraft.itemId])).rows[0];
      record(
        6, "INV-01", "Explicit batch_id selection overrides FEFO and is honored",
        explicitResult.ok && explicitAfter[batchExplicit].available === explicitBefore[batchExplicit].available - 2 &&
          explicitAfter[batchExplicitOther].available === explicitBefore[batchExplicitOther].available &&
          explicitItem.batch_id === batchExplicit,
        { explicitBatchDelta: -2, otherBatchDelta: 0, selectedBatch: batchExplicit },
        {
          result: explicitResult, before: explicitBefore, after: explicitAfter,
          movements: explicitMovements, item: explicitItem,
        },
      );
      record(
        6, "INV-02", "Sales depletion consumes quantity + free_qty",
        explicitMovements.delta === -2 && explicitMovements.rows === 1,
        { movementDelta: -2, movementRows: 1 },
        explicitMovements,
      );
      record(
        6, "INV-03", "Persisted batch balance and stock movement agree",
        explicitAfter[batchExplicit].available === explicitBefore[batchExplicit].available +
          Number(explicitMovements.delta) &&
          explicitInvoice.status === "FINALIZED" && Boolean(explicitInvoice.invoice_no),
        { balanceEqualsReceivedPlusMovements: true, status: "FINALIZED" },
        { after: explicitAfter[batchExplicit], movements: explicitMovements, invoice: explicitInvoice },
      );

      const fefoDraft = await seedDraft({ productId: productFefo, quantity: 2 });
      const fefoBefore = await batchState([batchFefoEarly, batchFefoLate]);
      const fefoResult = await invokeFinalize(fefoDraft.invoiceId, `fefo-${RUN_ID}`);
      const fefoAfter = await batchState([batchFefoEarly, batchFefoLate]);
      const fefoMovements = (await exec(
        `SELECT batch_id, quantity_delta FROM stock_movements
          WHERE tenant_id = $1 AND reference_id = $2 ORDER BY batch_id`,
        [tenantA, fefoDraft.invoiceId])).rows;
      record(
        6, "INV-04", "FEFO fallback depletes the earliest-expiring batch first",
        fefoResult.ok && fefoAfter[batchFefoEarly].available === fefoBefore[batchFefoEarly].available - 1 &&
          fefoAfter[batchFefoLate].available === fefoBefore[batchFefoLate].available - 1 &&
          fefoMovements.length === 2 &&
          Number(fefoMovements.find((m) => m.batch_id === batchFefoEarly)?.quantity_delta) === -1 &&
          Number(fefoMovements.find((m) => m.batch_id === batchFefoLate)?.quantity_delta) === -1,
        { earlyDelta: -1, lateDelta: -1, movementRows: 2 },
        { result: fefoResult, before: fefoBefore, after: fefoAfter, movements: fefoMovements },
      );

      const shortDraft = await seedDraft({
        productId: productShort, batchId: batchShort, batchNo: "SHORT-1", quantity: 2,
      });
      const shortBefore = await batchState([batchShort]);
      const shortResult = await invokeFinalize(shortDraft.invoiceId, `short-${RUN_ID}`);
      const shortAfter = await batchState([batchShort]);
      const shortInvoice = (await exec(
        `SELECT status FROM sales_invoices WHERE id = $1`, [shortDraft.invoiceId])).rows[0];
      const shortMovements = await ownerCount(
        `SELECT count(*)::int AS count FROM stock_movements WHERE tenant_id = $1 AND reference_id = $2`,
        [tenantA, shortDraft.invoiceId]);
      record(
        6, "INV-05", "Insufficient stock rejects finalization with no partial persistence",
        !shortResult.ok && shortInvoice.status === "DRAFT" &&
          shortAfter[batchShort].available === shortBefore[batchShort].available && shortMovements === 0,
        { finalized: false, status: "DRAFT", stockUnchanged: true, movements: 0 },
        { result: shortResult, status: shortInvoice.status, before: shortBefore, after: shortAfter, movements: shortMovements },
      );

      const rollbackDraft = await seedDraft({
        productId: productRollback, batchId: batchRollback, batchNo: "ROLLBACK-1", quantity: 1,
      });
      const rollbackBefore = await batchState([batchRollback]);
      await exec(`
        CREATE OR REPLACE FUNCTION public.__runtime_fail_ledger() RETURNS trigger
        LANGUAGE plpgsql AS $fn$
        BEGIN
          IF NEW.reference_id = '${rollbackDraft.invoiceId}' THEN
            RAISE EXCEPTION 'runtime fault injection: ledger failure';
          END IF;
          RETURN NEW;
        END;
        $fn$;
        CREATE TRIGGER __runtime_fail_ledger BEFORE INSERT ON public.customer_ledgers
          FOR EACH ROW EXECUTE FUNCTION public.__runtime_fail_ledger();
      `);
      let rollbackResult;
      try {
        rollbackResult = await invokeFinalize(rollbackDraft.invoiceId, `rollback-${RUN_ID}`);
      } finally {
        await exec(`
          DROP TRIGGER IF EXISTS __runtime_fail_ledger ON public.customer_ledgers;
          DROP FUNCTION IF EXISTS public.__runtime_fail_ledger();
        `);
      }
      const rollbackAfter = await batchState([batchRollback]);
      const rollbackState = (await exec(
        `SELECT
           (SELECT status FROM sales_invoices WHERE id = $1) AS status,
           (SELECT count(*)::int FROM stock_movements WHERE tenant_id = $2 AND reference_id = $1) AS movements,
           (SELECT count(*)::int FROM customer_ledgers WHERE tenant_id = $2 AND invoice_id = $1) AS ledgers,
           (SELECT count(*)::int FROM sales_posting_operations WHERE tenant_id = $2 AND sales_invoice_id = $1) AS postings,
           (SELECT count(*)::int FROM audit_logs WHERE tenant_id = $2 AND target_id = $1) AS audits`,
        [rollbackDraft.invoiceId, tenantA])).rows[0];
      record(
        6, "INV-06", "Failed finalization rolls back stock, movements, ledger, posting and audit",
        !rollbackResult.ok && Number(rollbackState.movements) === 0 && Number(rollbackState.ledgers) === 0 &&
          Number(rollbackState.postings) === 0 && Number(rollbackState.audits) === 0 &&
          rollbackAfter[batchRollback].available === rollbackBefore[batchRollback].available &&
          rollbackState.status === "DRAFT",
        { movements: 0, ledgers: 0, postings: 0, audits: 0, stockRestored: true, status: "DRAFT" },
        { result: rollbackResult, state: rollbackState, before: rollbackBefore, after: rollbackAfter },
      );

      const concurrentLeft = await seedDraft({
        productId: productConcurrent, batchId: batchConcurrent, batchNo: "CONCUR-1", quantity: 6,
      });
      const concurrentRight = await seedDraft({
        productId: productConcurrent, batchId: batchConcurrent, batchNo: "CONCUR-1", quantity: 6,
      });
      const [left, right] = await Promise.all([
        invokeFinalize(concurrentLeft.invoiceId, `concurrent-left-${RUN_ID}`),
        invokeFinalize(concurrentRight.invoiceId, `concurrent-right-${RUN_ID}`),
      ]);
      const concurrentState = (await exec(
        `SELECT
           (SELECT available_qty FROM product_batches WHERE id = $1) AS available,
           (SELECT count(*)::int FROM sales_invoices WHERE id = ANY($2::text[]) AND status = 'FINALIZED') AS finalized,
           (SELECT count(*)::int FROM stock_movements WHERE tenant_id = $3 AND reference_id = ANY($2::text[])) AS movements,
           (SELECT COALESCE(SUM(quantity_delta), 0)::int FROM stock_movements WHERE tenant_id = $3 AND reference_id = ANY($2::text[])) AS delta`,
        [batchConcurrent, [concurrentLeft.invoiceId, concurrentRight.invoiceId], tenantA])).rows[0];
      record(
        6, "INV-07", "Concurrent finalizations cannot oversell stock",
        [left.ok, right.ok].filter(Boolean).length === 1 &&
          Number(concurrentState.available) === 0 && Number(concurrentState.finalized) === 1 &&
          Number(concurrentState.delta) === -6,
        { successes: 1, available: 0, finalized: 1, movementDelta: -6 },
        { left, right, state: concurrentState },
      );

      const draftValuation = await valuationActions.recordInventoryValuationDecisionAction({
        purchaseId: draftPurchase, purchaseItemId: draftPurchaseItem, batchId: draftPurchaseBatch,
        eligibilityStatus: "RECOVERABLE", recoverableItc: 18, nonRecoverableGst: 0,
        policyVersion: "runtime-policy-v1", decisionReference: "RUNTIME-DRAFT",
        rationale: "draft purchase must be refused", idempotencyKey: `valuation-draft-${RUN_ID}`,
      });
      const draftValuationRows = await ownerCount(
        `SELECT count(*)::int AS count FROM inventory_valuation_decisions WHERE tenant_id = $1`, [tenantA]);
      record(
        6, "INV-08", "Valuation deferral refuses a non-finalized purchase without misleading success",
        draftValuation.ok === false && draftValuationRows === 0,
        { ok: false, decisions: 0 },
        { result: draftValuation, decisions: draftValuationRows },
      );

      const mismatchedValuation = await valuationActions.recordInventoryValuationDecisionAction({
        purchaseId: finalizedPurchase, purchaseItemId: finalizedPurchaseItem, batchId: batchRollback,
        eligibilityStatus: "RECOVERABLE", recoverableItc: 18, nonRecoverableGst: 0,
        policyVersion: "runtime-policy-v1", decisionReference: "RUNTIME-MISMATCH",
        rationale: "batch does not belong to the purchase", idempotencyKey: `valuation-mismatch-${RUN_ID}`,
      });
      record(
        6, "INV-09", "Valuation refuses a batch that does not belong to the finalized purchase line",
        mismatchedValuation.ok === false && /Product batch does not match/.test(mismatchedValuation.message ?? ""),
        { ok: false, message: "batch mismatch" },
        mismatchedValuation,
      );

      const approvedValuation = await valuationActions.recordInventoryValuationDecisionAction({
        purchaseId: finalizedPurchase, purchaseItemId: finalizedPurchaseItem, batchId: finalizedPurchaseBatch,
        stockMovementId: finalizedPurchaseMovement,
        eligibilityStatus: "RECOVERABLE", recoverableItc: 18, nonRecoverableGst: 0,
        policyVersion: "runtime-policy-v1", decisionReference: "RUNTIME-APPROVED",
        rationale: "accepted GST evidence reconciles", idempotencyKey: `valuation-approved-${RUN_ID}`,
      });
      const valuationBatch = await batchState([finalizedPurchaseBatch]);
      const replayValuation = await valuationActions.recordInventoryValuationDecisionAction({
        purchaseId: finalizedPurchase, purchaseItemId: finalizedPurchaseItem, batchId: finalizedPurchaseBatch,
        stockMovementId: finalizedPurchaseMovement,
        eligibilityStatus: "RECOVERABLE", recoverableItc: 18, nonRecoverableGst: 0,
        policyVersion: "runtime-policy-v1", decisionReference: "RUNTIME-APPROVED",
        rationale: "accepted GST evidence reconciles", idempotencyKey: `valuation-approved-${RUN_ID}`,
      });
      record(
        6, "INV-10", "Complete accepted evidence approves valuation exactly once and updates the batch",
        approvedValuation.ok === true && approvedValuation.data.status === "APPROVED" &&
          valuationBatch[finalizedPurchaseBatch].valuation === "APPROVED" &&
          replayValuation.ok === true && replayValuation.data.decisionId === approvedValuation.data.decisionId,
        { status: "APPROVED", replaySameDecision: true },
        { approved: approvedValuation, batch: valuationBatch[finalizedPurchaseBatch], replay: replayValuation },
      );

      const adjustForm = new FormData();
      adjustForm.set("product_id", productAdjust);
      adjustForm.set("batch_id", batchAdjust);
      adjustForm.set("quantity_delta", "-3");
      adjustForm.set("idempotency_key", `stock-adjust-${RUN_ID}`);
      adjustForm.set("reason", "Damaged");
      adjustForm.set("notes", "runtime verification");
      const adjustBefore = await batchState([batchAdjust]);
      const adjustResult = await adjustActions.createStockAdjustmentAction({}, adjustForm);
      const adjustReplay = await adjustActions.createStockAdjustmentAction({}, adjustForm);
      const adjustAfter = await batchState([batchAdjust]);
      const adjustMovements = (await exec(
        `SELECT id, quantity_delta, movement_type FROM stock_movements
          WHERE tenant_id = $1 AND reference_type = 'stock_adjustment' AND reference_id = $2`,
        [tenantA, `stock-adjust-${RUN_ID}`])).rows;
      record(
        6, "INV-11", "Stock adjustment advisory lock executes and applies exactly one idempotent movement",
        adjustResult?.ok === true && adjustReplay?.ok === true &&
          Number(adjustAfter[batchAdjust].available) === Number(adjustBefore[batchAdjust].available) - 3 &&
          adjustMovements.length === 1 && Number(adjustMovements[0].quantity_delta) === -3 &&
          adjustMovements[0].movement_type === "ADJUSTMENT_OUT",
        { delta: -3, movements: 1, idempotent: true },
        { first: adjustResult, replay: adjustReplay, before: adjustBefore, after: adjustAfter, movements: adjustMovements },
      );
    } finally {
      auth.clearFinancialE2eTestSession();
    }

    // ---------------------------------------------------------------------
    // Phase 7 - core financial invariants (service + action paths)
    // ---------------------------------------------------------------------
    financial = require("@/domain/services/financial-reconciliation.service.ts");
    await exec("BEGIN");
    try {
      await insert(owner, "sales_invoices", {
        id: rid("fin_invoice"), tenant_id: tenantA, invoice_no: `FIN-${RUN_ID}`, customer_id: customerA,
        invoice_date: new Date("2026-11-01T00:00:00.000Z"), effective_date: "2026-11-01",
        due_date_business: "2026-11-15", status: "FINALIZED", gst_treatment: BUSINESS_TREATMENT,
        tax_mode: "EXCLUSIVE", place_of_supply_code: "MH", gross_amount: 1000, total_tax: 180,
        net_amount: 1180, paid_amount: 0, balance_due: 1180, finalized_at: now, updated_at: now,
      });
      await exec("COMMIT");
    } catch (error) {
      await exec("ROLLBACK").catch(() => {});
      throw error;
    }
    const financeInvoice = (await exec(
      `SELECT id FROM sales_invoices WHERE tenant_id = $1 AND invoice_no = $2`, [tenantA, `FIN-${RUN_ID}`])).rows[0].id;
    fixture.financeInvoice = financeInvoice;

    const paymentKey = `payment-${RUN_ID}`;
    const paymentForm = new FormData();
    paymentForm.set("customer_id", customerA);
    paymentForm.set("amount", "300");
    paymentForm.set("payment_method", "Cash");
    paymentForm.set("entry_date", "2026-11-13");
    paymentForm.set("idempotency_key", paymentKey);

    auth.installFinancialE2eTestSession(subjectA);
    let paymentResult;
    let paymentReplay;
    try {
      paymentResult = await actions.createCustomerPaymentAction({}, paymentForm);
      paymentReplay = await actions.createCustomerPaymentAction({}, paymentForm);
    } finally {
      auth.clearFinancialE2eTestSession();
    }
    const paymentRow = (await exec(
      `SELECT id, amount, receipt_no FROM payments WHERE tenant_id = $1 AND idempotency_key = $2`,
      [tenantA, paymentKey])).rows[0];
    const paymentLedger = (await exec(
      `SELECT COALESCE(SUM(credit), 0)::numeric AS credit, count(*)::int AS rows
         FROM customer_ledgers WHERE tenant_id = $1 AND reference_id = $2`,
      [tenantA, paymentRow?.id ?? ""])).rows[0];
    record(
      7, "FIN-01", "Unallocated customer payment persists once and becomes unapplied credit",
      paymentResult?.ok === true && paymentReplay?.ok === true &&
        paymentResult?.data?.id === paymentReplay?.data?.id &&
        paymentRow && Number(paymentRow.amount) === 300 && Boolean(paymentRow.receipt_no) &&
        Number(paymentLedger.credit) === 300 && Number(paymentLedger.rows) === 1,
      { amount: 300, unappliedCredit: 300, ledgerRows: 1, idempotent: true },
      { first: paymentResult, replay: paymentReplay, payment: paymentRow, ledger: paymentLedger },
    );

    const allocationKey = `allocation-${RUN_ID}`;
    const allocationInput = {
      tenantId: tenantA, subjectId: subjectA, paymentId: paymentRow.id,
      invoiceId: financeInvoice, invoiceKind: "sales", amount: 200, idempotencyKey: allocationKey,
    };
    const allocation = await financial.allocatePayment(allocationInput);
    const allocationReplay = await financial.allocatePayment(allocationInput);
    const afterAllocation = (await exec(
      `SELECT
         (SELECT COALESCE(SUM(amount),0) FROM payment_allocations WHERE tenant_id=$1 AND payment_id=$2) AS allocated,
         (SELECT paid_amount FROM sales_invoices WHERE id=$3) AS paid,
         (SELECT balance_due FROM sales_invoices WHERE id=$3) AS due`,
      [tenantA, paymentRow.id, financeInvoice])).rows[0];
    record(
      7, "FIN-02", "Allocation reduces unapplied credit and updates the invoice balance",
      allocation.id === allocationReplay.id && allocationReplay.replayed === true &&
        Number(afterAllocation.allocated) === 200 && Number(afterAllocation.paid) === 200 &&
        Number(afterAllocation.due) === 980,
      { allocated: 200, paid: 200, due: 980, replayedSameId: true },
      { allocation, replay: allocationReplay, state: afterAllocation },
    );

    const reversalInput = {
      tenantId: tenantA, subjectId: subjectA, allocationId: allocation.id,
      idempotencyKey: `reversal-${RUN_ID}`,
    };
    const reversal = await financial.reverseAllocation(reversalInput);
    const reversalReplay = await financial.reverseAllocation(reversalInput);
    const afterReversal = (await exec(
      `SELECT
         (SELECT COALESCE(SUM(ar.amount),0) FROM allocation_reversals ar WHERE ar.tenant_id=$1 AND ar.allocation_id=$2) AS reversed,
         (SELECT paid_amount FROM sales_invoices WHERE id=$3) AS paid,
         (SELECT balance_due FROM sales_invoices WHERE id=$3) AS due`,
      [tenantA, allocation.id, financeInvoice])).rows[0];
    const usableAfterReversal = 300 - 200 + Number(afterReversal.reversed) - 0 - 0;
    record(
      7, "FIN-03", "Allocation reversal restores credit exactly once",
      reversal.id === reversalReplay.id && reversalReplay.replayed === true &&
        Number(afterReversal.reversed) === 200 && Number(afterReversal.paid) === 0 &&
        Number(afterReversal.due) === 1180 && usableAfterReversal === 300,
      { reversed: 200, paid: 0, due: 1180, usable: 300 },
      { reversal, replay: reversalReplay, state: afterReversal, usableAfterReversal },
    );

    const concurrentKeyBase = `concurrent-allocation-${RUN_ID}`;
    const concurrentCalls = await Promise.allSettled([
      financial.allocatePayment({
        ...allocationInput, amount: 200, idempotencyKey: `${concurrentKeyBase}-a`,
      }),
      financial.allocatePayment({
        ...allocationInput, amount: 200, idempotencyKey: `${concurrentKeyBase}-b`,
      }),
    ]);
    const concurrentFulfilled = concurrentCalls.filter((r) => r.status === "fulfilled").length;
    const activeAllocated = Number((await exec(
      `SELECT COALESCE(SUM(pa.amount - COALESCE(rev.total, 0)), 0) AS allocated
         FROM payment_allocations pa
         LEFT JOIN LATERAL (
           SELECT SUM(ar.amount) AS total FROM allocation_reversals ar
           WHERE ar.tenant_id = pa.tenant_id AND ar.allocation_id = pa.id
         ) rev ON true
        WHERE pa.tenant_id = $1 AND pa.payment_id = $2`,
      [tenantA, paymentRow.id])).rows[0].allocated);
    record(
      7, "FIN-04", "Concurrent allocations cannot over-consume unapplied credit",
      concurrentFulfilled === 1 && activeAllocated === 200,
      { fulfilled: 1, activeAllocated: 200, usable: 100 },
      {
        fulfilled: concurrentFulfilled,
        activeAllocated,
        outcomes: concurrentCalls.map((r) => (r.status === "fulfilled" ? { id: r.value.id } : { error: r.reason?.message })),
      },
    );

    const refundRequestKey = `refund-request-${RUN_ID}`;
    const refundRequest = await financial.requestRefund({
      tenantId: tenantA, subjectId: subjectA, paymentId: paymentRow.id,
      counterpartyKind: "customer", counterpartyId: customerA, amount: 100,
      idempotencyKey: refundRequestKey, actorId: userA,
    });
    const pendingConsumption = (await exec(
      `SELECT
         (SELECT status FROM payment_refunds WHERE id = $1) AS status,
         (SELECT COALESCE(SUM(amount),0) FROM payment_refunds WHERE tenant_id=$2 AND payment_id=$3 AND status='COMPLETED') AS completed`,
      [refundRequest.id, tenantA, paymentRow.id])).rows[0];
    record(
      7, "FIN-05", "Pending refund does not consume usable payment",
      pendingConsumption.status === "REQUESTED" && Number(pendingConsumption.completed) === 0,
      { status: "REQUESTED", completedConsumption: 0 },
      pendingConsumption,
    );

    await financial.approveRefund({
      tenantId: tenantA, subjectId: subjectA, refundId: refundRequest.id,
      idempotencyKey: `refund-approve-${RUN_ID}`, actorId: userA,
    });
    const completionKey = `refund-complete-${RUN_ID}`;
    const completion = await financial.completeRefund({
      tenantId: tenantA, subjectId: subjectA, refundId: refundRequest.id,
      idempotencyKey: completionKey, actorId: userA,
    });
    const completionReplay = await financial.completeRefund({
      tenantId: tenantA, subjectId: subjectA, refundId: refundRequest.id,
      idempotencyKey: completionKey, actorId: userA,
    });
    const completedState = (await exec(
      `SELECT status, completed_effective_date::text AS completed_date,
              (SELECT COALESCE(SUM(amount),0) FROM payment_refunds WHERE tenant_id=$2 AND payment_id=$3 AND status='COMPLETED') AS completed
         FROM payment_refunds WHERE id = $1`,
      [refundRequest.id, tenantA, paymentRow.id])).rows[0];
    record(
      7, "FIN-06", "Completed refund consumes the payment exactly once; repeated completion is idempotent",
      completion.id === completionReplay.id && completionReplay.replayed === true &&
        completedState.status === "COMPLETED" && Number(completedState.completed) === 100,
      { completed: 100, replaySameId: true, status: "COMPLETED" },
      { completion, replay: completionReplay, state: completedState },
    );

    // ---------------------------------------------------------------------
    // Phase 8 - temporal contracts
    // ---------------------------------------------------------------------
    businessDate = require("@/lib/utils/business-date.ts");
    const derivedMismatch = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
             effective_date, effective_date_basis, occurred_at)
           VALUES ($1,$2,$3,'PAYMENT_RECEIVED',10,now(),'2026-11-13','DERIVED_FROM_OCCURRED_AT','2026-11-13T19:30:00Z')`,
          [rid("pay"), tenantA, customerA],
        );
      }),
      ["23514"],
    );
    record(
      8, "TMP-01", "Derived effective date must equal the Asia/Kolkata date of occurred_at",
      derivedMismatch.rejected && derivedMismatch.codeMatched,
      { sqlstate: "23514" },
      derivedMismatch.error,
    );

    const derivedMatch = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
             effective_date, effective_date_basis, occurred_at)
           VALUES ($1,$2,$3,'PAYMENT_RECEIVED',10,now(),'2026-11-14','DERIVED_FROM_OCCURRED_AT','2026-11-13T19:30:00Z')`,
          [rid("pay"), tenantA, customerA],
        );
      }));
    record(
      8, "TMP-02", "19:30Z derives to the next IST calendar date (2026-11-14)",
      !derivedMatch.rejected,
      { rejected: false, istDate: "2026-11-14" },
      derivedMatch.error,
    );

    const missingBasis = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date, effective_date)
           VALUES ($1,$2,$3,'PAYMENT_RECEIVED',10,now(),'2026-11-13')`,
          [rid("pay"), tenantA, customerA],
        );
      }),
      ["23514"],
    );
    record(
      8, "TMP-03", "A populated effective date without provenance is rejected",
      missingBasis.rejected && missingBasis.codeMatched,
      { sqlstate: "23514" },
      missingBasis.error,
    );

    const reservedBasis = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date,
             effective_date, effective_date_basis)
           VALUES ($1,$2,$3,'PAYMENT_RECEIVED',10,now(),'2026-11-13','EVIDENCE_CLASSIFIED')`,
          [rid("pay"), tenantA, customerA],
        );
      }),
      ["23514"],
    );
    record(
      8, "TMP-04", "Reserved/unverifiable date provenance is rejected",
      reservedBasis.rejected && reservedBasis.codeMatched,
      { sqlstate: "23514" },
      reservedBasis.error,
    );

    const suppliedRecordedAt = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `INSERT INTO payments (id, tenant_id, customer_id, entry_type, amount, payment_date, recorded_at)
           VALUES ($1,$2,$3,'PAYMENT_RECEIVED',10,now(),now())`,
          [rid("pay"), tenantA, customerA],
        );
      }),
      ["42501"],
    );
    record(
      8, "TMP-05", "Caller-supplied recorded_at is rejected",
      suppliedRecordedAt.rejected && suppliedRecordedAt.codeMatched,
      { sqlstate: "42501" },
      suppliedRecordedAt.error,
    );

    const recordedUpdate = await expectReject(
      () => runtimeTx(contextA(), async (client) => {
        await client.query(
          `UPDATE payments SET recorded_at = now() WHERE id = $1`, [paymentRow.id]);
      }),
      ["42501"],
    );
    record(
      8, "TMP-06", "recorded_at is immutable after insert",
      recordedUpdate.rejected && recordedUpdate.codeMatched,
      { sqlstate: "42501" },
      recordedUpdate.error,
    );

    const finalizedDateChange = await expectReject(
      () => exec(`UPDATE sales_invoices SET effective_date = '2026-10-21' WHERE id = $1`, [finalizedSales]));
    record(
      8, "TMP-07", "Finalized invoice business date is immutable",
      finalizedDateChange.rejected,
      { rejected: true },
      finalizedDateChange.error,
    );

    let businessDateError = null;
    const nonMidnightMarker = (() => {
      try {
        businessDate.businessDateFromPrismaDate(new Date("2026-03-31T18:30:00.000Z"));
        return false;
      } catch (error) {
        businessDateError = error.message;
        return true;
      }
    })();
    record(
      8, "TMP-08", "Date-only values must round-trip as UTC midnight markers (no 5h30m shift)",
      businessDate.BUSINESS_TIME_ZONE === "Asia/Kolkata" &&
        businessDate.businessDateFromPrismaDate(new Date("2026-03-31T00:00:00.000Z")) === "2026-03-31" &&
        nonMidnightMarker,
      { timezone: "Asia/Kolkata", dateOnly: "2026-03-31", rejectsShiftedInstant: true },
      { timezone: businessDate.BUSINESS_TIME_ZONE, nonMidnightError: businessDateError },
    );

    const istInstant = businessDate.businessDateToday(new Date("2026-11-13T19:30:00.000Z"));
    const istBefore = businessDate.businessDateToday(new Date("2026-11-13T18:29:59.000Z"));
    const dbIstDate = (await exec(
      `SELECT ('2026-11-13T19:30:00Z'::timestamptz AT TIME ZONE 'Asia/Kolkata')::date::text AS ist_date`,
    )).rows[0].ist_date;
    record(
      8, "TMP-09", "IST calendar date derivation matches PostgreSQL for the same instant",
      istInstant === "2026-11-14" && istBefore === "2026-11-13" && dbIstDate === "2026-11-14",
      { at1930Z: "2026-11-14", at1829_59Z: "2026-11-13", postgres: "2026-11-14" },
      { at1930Z: istInstant, at1829_59Z: istBefore, postgres: dbIstDate },
    );
  } finally {
    await runtime.end().catch(() => {});
    await owner.end().catch(() => {});
  }

  const summary = {
    runId: RUN_ID,
    recordedAt: new Date().toISOString(),
    target: EXPECTED_DATABASE,
    totals: {
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
    },
    results,
  };
  const target = path.isAbsolute(EVIDENCE_FILE) ? EVIDENCE_FILE : path.join(repoRoot, EVIDENCE_FILE);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary.totals));
  const failed = results.filter((r) => r.status === "FAIL");
  for (const failure of failed) {
    console.error(`FAIL ${failure.id} ${failure.contract}: ${JSON.stringify(failure.actual)}`);
  }
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`POSTGRES_RUNTIME_VERIFICATION=ERROR: ${error?.stack ?? error}`);
  try {
    const summary = {
      runId: RUN_ID,
      recordedAt: new Date().toISOString(),
      target: EXPECTED_DATABASE,
      aborted: true,
      abortError: error?.message ?? String(error),
      totals: {
        passed: results.filter((r) => r.status === "PASS").length,
        failed: results.filter((r) => r.status === "FAIL").length,
      },
      results,
    };
    const target = path.isAbsolute(EVIDENCE_FILE) ? EVIDENCE_FILE : path.join(repoRoot, EVIDENCE_FILE);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(summary, null, 2)}\n`);
  } catch (writeError) {
    console.error(`could not write partial evidence: ${writeError?.message ?? writeError}`);
  }
  process.exitCode = 1;
});
