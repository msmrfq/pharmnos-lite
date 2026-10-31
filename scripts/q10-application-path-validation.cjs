#!/usr/bin/env node

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { Client } = require("pg");
let activeBootstrap;

const environmentFile = process.env.FINANCIAL_E2E_ENV_FILE || ".env.financial-e2e";
for (const line of fs.readFileSync(environmentFile, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}

function connectionUrl(raw, username, password) {
  const url = new URL(raw);
  if (username) url.username = username;
  if (password !== undefined) url.password = password;
  return url.toString();
}

process.env.DATABASE_URL = connectionUrl(
  process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
  process.env.FINANCIAL_E2E_RUNTIME_DB_USER,
  process.env.FINANCIAL_E2E_RUNTIME_DB_PASSWORD,
);
process.env.FINANCIAL_E2E_TEST_MODE = "true";
process.env.ALLOW_FINANCIAL_E2E = "true";
process.env.NODE_ENV = "test";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  jsx: "preserve",
});

const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve(path.join(process.cwd(), "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};
Module._load = function (request, parent, isMain) {
  if (request === "next/cache" || request === "next/cache.js") return { revalidatePath() {} };
  if (request === "next/navigation" || request === "next/navigation.js") {
    return { redirect(url) { throw new Error(`NEXT_REDIRECT:${url}`); } };
  }
  if (request === "@/lib/db/tenant-context") {
    return {
      requireServerTenantContext: async () => global.__q10Context,
      requirePermission() {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
require("ts-node/register/transpile-only");

async function main() {
  const bootstrap = new Client({
    connectionString: connectionUrl(
      process.env.TEST_DATABASE_URL,
      process.env.FINANCIAL_E2E_DB_USER,
      process.env.FINANCIAL_E2E_DB_PASSWORD,
    ),
  });
  activeBootstrap = bootstrap;
  await bootstrap.connect();
  const run = `q10-app-${Date.now()}`;
  const tenant = `${run}-tenant`;
  const user = `${run}-user`;
  const role = `${run}-role`;
  const membership = `${run}-membership`;
  const catalog = `${run}-catalog`;
  const rule = `${run}-rule`;
  const customer = `${run}-customer`;
  const product = `${run}-product`;
  const batch = `${run}-batch`;
  await bootstrap.query("BEGIN");
  try {
    await bootstrap.query(
      `INSERT INTO tenants (id, slug, business_name, updated_at)
       VALUES ($1, $2, $3, now())`,
      [tenant, run, "Q10 Application Synthetic"],
    );
    await bootstrap.query(
      `INSERT INTO users (id, external_id, email, full_name, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [user, run, `${run}@example.invalid`, "Q10 Application User"],
    );
    await bootstrap.query(
      `INSERT INTO roles (id, tenant_id, name, is_default, updated_at)
       VALUES ($1, $2, $3, true, now())`,
      [role, tenant, "Q10 Application Role"],
    );
    await bootstrap.query(
      `INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [membership, tenant, user, role],
    );
    await bootstrap.query(
      `INSERT INTO hsn_sac_catalog
       (id, tenant_id, code, description, classification_type, classification_status,
        rate_approval_status, source_reference, effective_from, is_active,
        classification_approved_by_membership_id, classification_approved_at, created_at, updated_at)
       VALUES ($1, $2, 'SYNTHETIC', 'Q10 synthetic classification', 'GOODS', 'APPROVED',
               'APPROVED', 'Q10-TEST', now() - interval '1 day', true, $3, now(), now(), now())`,
      [catalog, tenant, membership],
    );
    await bootstrap.query(
      `INSERT INTO gst_rate_rules
       (id, tenant_id, hsn_sac_catalog_id, rule_version, tax_rate, component_policy,
        approval_status, source_reference, effective_from, is_active,
        approved_by_membership_id, approved_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Q10-SYNTHETIC-18', 18, 'CGST_SGST', 'APPROVED',
               'Q10-TEST', now() - interval '1 day', true, $4, now(), now(), now())`,
      [rule, tenant, catalog, membership],
    );
    await bootstrap.query(
      `INSERT INTO business_profiles (id, tenant_id, state, invoice_prefix, updated_at)
       VALUES ($1, $2, 'MH', 'QAPP', now())`,
      [`${run}-profile`, tenant],
    );
    await bootstrap.query(
      `INSERT INTO customers (id, tenant_id, business_name, billing_state, updated_at)
       VALUES ($1, $2, 'Q10 Application Customer', 'MH', now())`,
      [customer, tenant],
    );
    await bootstrap.query(
      `INSERT INTO products
       (id, tenant_id, name, hsn_code, gst_rate, standard_sale_rate, updated_at)
       VALUES ($1, $2, 'Q10 Application Product', 'SYNTHETIC', 18, 100, now())`,
      [product, tenant],
    );
    await bootstrap.query(
      `INSERT INTO product_batches
       (id, tenant_id, product_id, batch_no, expiry_date, sale_rate, received_qty, available_qty, updated_at)
       VALUES ($1, $2, $3, $4, now() + interval '365 days', 100, 100, 100, now())`,
      [batch, tenant, product, `${run}-batch`],
    );
    for (let index = 0; index < 3; index += 1) {
      const invoice = `${run}-invoice-${index}`;
      await bootstrap.query(
        `INSERT INTO sales_invoices
         (id, tenant_id, invoice_no, customer_id, invoice_date, status, gross_amount,
          total_tax, net_amount, balance_due, place_of_supply_code, gst_treatment,
          tax_mode, created_by, updated_at)
         VALUES ($1, $2, $3, $4, now(), 'DRAFT', 100, 18, 118, 118, 'MH',
                 'Registered Business – Regular', 'EXCLUSIVE', $5, now())`,
        [invoice, tenant, `${run}-draft-${index}`, customer, user],
      );
      await bootstrap.query(
        `INSERT INTO sales_invoice_items
         (id, tenant_id, invoice_id, product_id, batch_id, batch_no, quantity,
          sale_rate, gst_rate, gst_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, 1, 100, 18, 18, 118)`,
        [`${run}-item-${index}`, tenant, invoice, product, batch, `${run}-batch`],
      );
    }
    await bootstrap.query("COMMIT");
  } catch (error) {
    await bootstrap.query("ROLLBACK");
    throw error;
  }
  const fixtures = (await bootstrap.query(`
    SELECT i.id AS invoice_id, i.tenant_id, i.created_by AS user_id
    FROM sales_invoices i
    WHERE i.status = 'DRAFT'
      AND i.tenant_id = (
        SELECT tenant_id FROM sales_invoices
        WHERE status = 'DRAFT'
        ORDER BY updated_at DESC
        LIMIT 1
      )
    ORDER BY i.updated_at DESC
    LIMIT 3
  `)).rows;
  const fixture = fixtures[0];
  if (!fixture) throw new Error("No synthetic draft fixture is available.");
  global.__q10Context = {
    tenantId: fixture.tenant_id,
    userId: fixture.user_id,
    roles: [],
    permissions: ["finalize_invoice"],
  };
  const { finalizeSalesInvoiceAction } = require(path.join(process.cwd(), "src/app/_actions/sales.actions.ts"));
  const key = `${run}-same-key`;
  const request = new FormData();
  request.set("idempotency_key", key);
  const invoke = async () => {
    try {
      const result = await finalizeSalesInvoiceAction(fixture.invoice_id, { ok: false }, request);
      return result?.ok === false ? `RETURNED:${result.message}` : "UNEXPECTED_RETURN";
    } catch (error) {
      const message = String(error?.message);
      if (message.startsWith("NEXT_REDIRECT")) {
        return message.includes("replayed=1") ? "REPLAY" : "COMMITTED";
      }
      throw error;
    }
  };
  for (const invalidKey of ["", "   ", "bad key", "short"]) {
    const invalidRequest = new FormData();
    invalidRequest.set("idempotency_key", invalidKey);
    const invalidResult = await finalizeSalesInvoiceAction(fixture.invoice_id, { ok: false }, invalidRequest);
    if (invalidResult.ok || invalidResult.message !== "A valid idempotency key is required.") {
      throw new Error(`Invalid key was accepted: ${JSON.stringify(invalidKey)}`);
    }
  }
  const first = await invoke();
  const replay = await invoke();
  let conflicting = "NOT_RUN";
  let concurrent = "NOT_RUN";
  let preCommitFailure = "NOT_RUN";
  if (fixtures[1]) {
    const conflictingRequest = new FormData();
    conflictingRequest.set("idempotency_key", key);
    try {
      const conflictingResult = await finalizeSalesInvoiceAction(fixtures[1].invoice_id, { ok: false }, conflictingRequest);
      conflicting = conflictingResult?.ok === false &&
        conflictingResult.message === "This idempotency key was already used with a different sales payload."
        ? "CONFLICT_REJECTED"
        : "UNEXPECTED_COMMIT";
    } catch (error) {
      conflicting = String(error?.message).includes("NEXT_REDIRECT") ? "UNEXPECTED_COMMIT" : "UNHANDLED_ERROR";
    }
  }
  if (fixtures[1]) {
    global.__q10Context = {
      tenantId: fixtures[1].tenant_id,
      userId: fixtures[1].user_id,
      roles: [],
      permissions: ["finalize_invoice"],
    };
    const concurrentRequest = new FormData();
    concurrentRequest.set("idempotency_key", `${run}-concurrent`);
    const outcomes = await Promise.all([
      finalizeSalesInvoiceAction(fixtures[1].invoice_id, { ok: false }, concurrentRequest)
        .then((result) => result?.ok === false ? `RETURNED:${result.message}` : "UNEXPECTED_RETURN")
        .catch((error) => {
          const message = String(error?.message);
          if (!message.startsWith("NEXT_REDIRECT")) return "ERROR";
          return message.includes("replayed=1") ? "REPLAY" : "COMMITTED";
        }),
      finalizeSalesInvoiceAction(fixtures[1].invoice_id, { ok: false }, concurrentRequest)
        .then((result) => result?.ok === false ? `RETURNED:${result.message}` : "UNEXPECTED_RETURN")
        .catch((error) => {
          const message = String(error?.message);
          if (!message.startsWith("NEXT_REDIRECT")) return "ERROR";
          return message.includes("replayed=1") ? "REPLAY" : "COMMITTED";
        }),
    ]);
    concurrent = outcomes.sort().join("+");
    if (outcomes.filter((outcome) => outcome === "COMMITTED").length !== 1 ||
        outcomes.filter((outcome) => outcome === "REPLAY").length !== 1) {
      throw new Error(`Concurrent application invocation failed: ${concurrent}`);
    }
    if (fixtures[2]) {
      global.__q10Context = {
        tenantId: fixtures[2].tenant_id,
        userId: fixtures[2].user_id,
        roles: [],
        permissions: ["finalize_invoice"],
      };
      const failureRequest = new FormData();
      const failureKey = `${run}-pre-commit`;
      failureRequest.set("idempotency_key", failureKey);
      process.env.FINANCIAL_E2E_TEST_FAIL_BEFORE_COMMIT = "true";
      const failed = await finalizeSalesInvoiceAction(fixtures[2].invoice_id, { ok: false }, failureRequest);
      delete process.env.FINANCIAL_E2E_TEST_FAIL_BEFORE_COMMIT;
      const effects = (await bootstrap.query(`
        SELECT
          (SELECT count(*) FROM sales_posting_operations WHERE tenant_id = $1 AND idempotency_key = $2) AS operations,
          (SELECT count(*) FROM stock_movements WHERE reference_id = $3) AS movements,
          (SELECT count(*) FROM customer_ledgers WHERE invoice_id = $3) AS ledgers,
          (SELECT status FROM sales_invoices WHERE id = $3) AS status
      `, [fixtures[2].tenant_id, failureKey, fixtures[2].invoice_id])).rows[0];
      preCommitFailure = failed.ok === false &&
        `${effects.operations}/${effects.movements}/${effects.ledgers}/${effects.status}` === "0/0/0/DRAFT"
        ? "ROLLED_BACK"
        : "FAILED";
    }
  }
  const counts = (await bootstrap.query(`
    SELECT
      (SELECT count(*) FROM sales_posting_operations WHERE tenant_id = $1 AND idempotency_key = $2) AS operations,
      (SELECT count(*) FROM stock_movements WHERE reference_id = $3) AS movements,
      (SELECT count(*) FROM customer_ledgers WHERE invoice_id = $3) AS ledgers,
      (SELECT status FROM sales_invoices WHERE id = $3) AS status
  `, [fixture.tenant_id, key, fixture.invoice_id])).rows[0];
  if (first !== "COMMITTED" || replay !== "REPLAY" ||
      (fixtures[1] && conflicting !== "CONFLICT_REJECTED") ||
      (fixtures[2] && preCommitFailure !== "ROLLED_BACK") ||
      `${counts.operations}/${counts.movements}/${counts.ledgers}/${counts.status}` !== "1/1/1/FINALIZED") {
    throw new Error(`Application-path assertion failed: ${JSON.stringify({
      first, replay, conflicting, concurrent, preCommitFailure, fixtureCount: fixtures.length, counts,
    })}`);
  }
  console.log(JSON.stringify({
    status: "PASS",
    path: "finalizeSalesInvoiceAction",
    first,
    replay,
    invalidKeys: "REJECTED",
    conflictingKeyReuse: conflicting,
    concurrentIdentical: concurrent,
    preCommitFailure,
    postCommitRetry: replay,
    financialEffects: counts,
  }, null, 2));
  await bootstrap.end();
}

main().catch((error) => {
  console.error(`Q10_APPLICATION=FAIL ${error instanceof Error ? error.message : String(error)}`);
  Promise.resolve(activeBootstrap?.end()).finally(() => {
    process.exitCode = 1;
  });
});
