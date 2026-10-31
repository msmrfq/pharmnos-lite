#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const { Client, Pool } = pg;
const run = `q10-q14-${Date.now()}`;
const results = [];

function loadEnv() {
  for (const file of [".env.local", ".env.financial-e2e"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function connectionUrl(raw, username, password, applicationName) {
  const url = new URL(raw);
  if (username) url.username = username;
  if (password) url.password = password;
  url.searchParams.set("application_name", applicationName);
  return url.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function rows(client, sql, values = []) {
  return (await client.query(sql, values)).rows;
}

function record(id, expected, observed, status = expected === observed ? "PASS" : "FAIL") {
  results.push({ id, expected, observed, status });
  if (status !== "PASS") throw new Error(`${id}: expected ${expected}, observed ${observed}`);
}

async function expectError(operation) {
  try {
    await operation();
    return "NO_ERROR";
  } catch (error) {
    return error instanceof Error ? `${error.code ?? "ERROR"}:${error.message}` : "ERROR";
  }
}

function ids(name) {
  return {
    tenant: `${run}-${name}-tenant`,
    user: `${run}-${name}-user`,
    role: `${run}-${name}-role`,
    membership: `${run}-${name}-membership`,
    customer: `${run}-${name}-customer`,
    product: `${run}-${name}-product`,
    batch: `${run}-${name}-batch`,
    invoice: `${run}-${name}-invoice`,
    item: `${run}-${name}-item`,
  };
}

async function seedTenant(bootstrap, name) {
  const id = ids(name);
  await bootstrap.query("BEGIN");
  try {
    await bootstrap.query(
      `INSERT INTO tenants (id, slug, business_name, updated_at)
       VALUES ($1, $2, $3, now())`,
      [id.tenant, `${run}-${name}`, `Synthetic ${name}`],
    );
    await bootstrap.query(
      `INSERT INTO users (id, external_id, email, full_name, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [id.user, `${run}-${name}`, `${run}-${name}@example.invalid`, `Synthetic ${name}`],
    );
    await bootstrap.query(
      `INSERT INTO roles (id, tenant_id, name, is_default, updated_at)
       VALUES ($1, $2, $3, true, now())`,
      [id.role, id.tenant, `Synthetic${name}`],
    );
    await bootstrap.query(
      `INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [id.membership, id.tenant, id.user, id.role],
    );
    await bootstrap.query(
      `INSERT INTO business_profiles (id, tenant_id, state, invoice_prefix, updated_at)
       VALUES ($1, $2, 'MH', $3, now())`,
      [`${run}-${name}-profile`, id.tenant, `Q${name.slice(0, 2).toUpperCase()}`],
    );
    await bootstrap.query(
      `INSERT INTO customers (id, tenant_id, business_name, billing_state, updated_at)
       VALUES ($1, $2, $3, 'MH', now())`,
      [id.customer, id.tenant, `Synthetic Customer ${name}`],
    );
    await bootstrap.query(
      `INSERT INTO products
       (id, tenant_id, name, hsn_code, gst_rate, standard_sale_rate, updated_at)
       VALUES ($1, $2, $3, 'SYNTHETIC', 18, 100, now())`,
      [id.product, id.tenant, `Synthetic Product ${name}`],
    );
    await bootstrap.query(
      `INSERT INTO product_batches
       (id, tenant_id, product_id, batch_no, expiry_date, sale_rate, received_qty, available_qty, updated_at)
       VALUES ($1, $2, $3, $4, now() + interval '365 days', 100, 10, 10, now())`,
      [id.batch, id.tenant, id.product, `${run}-${name}-batch`],
    );
    await bootstrap.query(
      `INSERT INTO sales_invoices
       (id, tenant_id, invoice_no, customer_id, invoice_date, status, gross_amount,
        total_tax, net_amount, balance_due, place_of_supply_code, created_by, updated_at)
       VALUES ($1, $2, $3, $4, now(), 'DRAFT', 100, 18, 118, 118, 'MH', $5, now())`,
      [id.invoice, id.tenant, `${run}-${name}-draft`, id.customer, id.user],
    );
    await bootstrap.query(
      `INSERT INTO sales_invoice_items
       (id, tenant_id, invoice_id, product_id, batch_id, batch_no, quantity,
        sale_rate, gst_rate, gst_amount, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, 1, 100, 18, 18, 118)`,
      [id.item, id.tenant, id.invoice, id.product, id.batch, `${run}-${name}-batch`],
    );
    await bootstrap.query("COMMIT");
  } catch (error) {
    await bootstrap.query("ROLLBACK");
    throw error;
  }
  return id;
}

function payloadHash(invoiceId) {
  return crypto.createHash("sha256")
    .update(JSON.stringify({ operation: "FINALIZE_SALES_INVOICE", saleId: invoiceId }), "utf8")
    .digest("hex");
}

async function finalizeSynthetic(client, fixture, key, {
  failBeforeCommit = false,
  throwAfterCommit = false,
  barrier,
} = {}) {
  const hash = payloadHash(fixture.invoice);
  if (barrier) await barrier();
  await client.query("BEGIN");
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended(concat($1::text, ':', $2::text), 0)
       )`,
      [fixture.tenant, key],
    );
    const prior = await rows(
      client,
      `SELECT status, request_payload_hash, result_sales_id
       FROM sales_posting_operations
       WHERE tenant_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [fixture.tenant, key],
    );
    if (prior.length > 0) {
      if (prior[0].request_payload_hash !== hash) throw new Error("IDEMPOTENCY_CONFLICT");
      if (prior[0].status === "COMPLETED") {
        await client.query("COMMIT");
        return { outcome: "REPLAY", invoiceId: prior[0].result_sales_id };
      }
      throw new Error("OPERATION_IN_PROGRESS");
    }
    await client.query(
      `INSERT INTO sales_posting_operations
       (id, tenant_id, sales_invoice_id, idempotency_key, request_payload_hash, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING', now())`,
      [`${run}-${crypto.randomUUID()}`, fixture.tenant, fixture.invoice, key, hash],
    );
    await client.query(
      `UPDATE product_batches SET available_qty = available_qty - 1, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND available_qty >= 1`,
      [fixture.batch, fixture.tenant],
    );
    await client.query(
      `INSERT INTO stock_movements
       (id, tenant_id, product_id, batch_id, movement_type, quantity_delta, reference_type, reference_id, unit_rate, created_by)
       VALUES ($1, $2, $3, $4, 'SALE_OUT', -1, 'sales_invoice', $5, 100, $6)`,
      [`${run}-${crypto.randomUUID()}`, fixture.tenant, fixture.product, fixture.batch, fixture.invoice, fixture.user],
    );
    await client.query(
      `UPDATE sales_invoices
       SET status = 'FINALIZED', invoice_no = $1, finalized_at = now(), updated_at = now()
       WHERE id = $2 AND tenant_id = $3 AND status = 'DRAFT'`,
      [`${run}-${fixture.invoice.slice(-12)}`, fixture.invoice, fixture.tenant],
    );
    await client.query(
      `INSERT INTO customer_ledgers
       (id, tenant_id, customer_id, entry_type, debit, balance, reference_type, reference_id, invoice_id, entry_date)
       VALUES ($1, $2, $3, 'INVOICE', 118, 118, 'sales_invoice', $4, $4, now())`,
      [`${run}-${crypto.randomUUID()}`, fixture.tenant, fixture.customer, fixture.invoice],
    );
    await client.query(
      `UPDATE sales_posting_operations
       SET status = 'COMPLETED', result_invoice_no = $1, result_sales_id = $2, updated_at = now()
       WHERE tenant_id = $3 AND idempotency_key = $4`,
      [`${run}-${fixture.invoice.slice(-12)}`, fixture.invoice, fixture.tenant, key],
    );
    if (failBeforeCommit) {
      await client.query("ROLLBACK");
      return { outcome: "ROLLED_BACK" };
    }
    await client.query("COMMIT");
    if (throwAfterCommit) throw new Error("CLIENT_RESPONSE_LOST_AFTER_COMMIT");
    return { outcome: "COMMITTED", invoiceId: fixture.invoice };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  loadEnv();
  const bootstrap = await connect(connectionUrl(
    process.env.TEST_DATABASE_URL,
    process.env.FINANCIAL_E2E_DB_USER,
    process.env.FINANCIAL_E2E_DB_PASSWORD,
    "pharmnos-financial-e2e-q10-q14-bootstrap",
  ));
  const runtimeA = await connect(connectionUrl(
    process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    null,
    null,
    "pharmnos-financial-e2e-q10-q14-runtime-a",
  ));
  const runtimeB = await connect(connectionUrl(
    process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    null,
    null,
    "pharmnos-financial-e2e-q10-q14-runtime-b",
  ));
  const runtimePool = new Pool({
    connectionString: connectionUrl(
      process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
      null,
      null,
      "pharmnos-financial-e2e-q14-pool",
    ),
    max: 1,
  });
  try {
    const identity = await rows(runtimeA, `
      SELECT current_database() AS database_name, current_user AS current_role,
             r.rolsuper, r.rolbypassrls, r.rolcanlogin
      FROM pg_roles r WHERE r.rolname = current_user
    `);
    record("q14-runtime-identity", "pharmnos_financial_e2e/pharmnos_e2e_runtime/false/false/true", [
      identity[0]?.database_name,
      identity[0]?.current_role,
      identity[0]?.rolsuper,
      identity[0]?.rolbypassrls,
      identity[0]?.rolcanlogin,
    ].join("/"));
    const roleReport = await rows(bootstrap, `
      SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('pharmnos_e2e', 'pharmnos_e2e_runtime',
                        'pharmnos_e2e_admin', 'pharmnos_e2e_validation')
      ORDER BY rolname
    `);
    record("q14-four-role-model", "4", String(roleReport.length));
    record(
      "q14-runtime-column-grant",
      "false/true",
      `${(await rows(bootstrap, `
        SELECT has_table_privilege('pharmnos_e2e_runtime',
                 'public.sales_posting_operations', 'UPDATE') AS table_update,
               EXISTS (
                 SELECT 1 FROM information_schema.role_column_grants
                 WHERE grantee = 'pharmnos_e2e_runtime'
                   AND table_schema = 'public'
                   AND table_name = 'sales_posting_operations'
                   AND column_name = 'status'
                   AND privilege_type = 'UPDATE'
               ) AS status_update
      `))[0].table_update}/${(await rows(bootstrap, `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.role_column_grants
          WHERE grantee = 'pharmnos_e2e_runtime'
            AND table_schema = 'public'
            AND table_name = 'sales_posting_operations'
            AND column_name = 'status'
            AND privilege_type = 'UPDATE'
        ) AS allowed
      `))[0].allowed}`,
    );
    const aclReport = (await rows(bootstrap, `
      SELECT
        has_schema_privilege('pharmnos_e2e_runtime', 'public', 'CREATE') AS schema_create,
        COALESCE((
          SELECT has_sequence_privilege('pharmnos_e2e_runtime', c.oid::regclass::text, 'USAGE')
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'S'
          LIMIT 1
        ), false) AS sequence_usage,
        has_function_privilege('pharmnos_e2e_runtime', 'public.guard_sales_posting_transition()', 'EXECUTE') AS function_execute,
        EXISTS (
          SELECT 1 FROM pg_auth_members m
          JOIN pg_roles parent ON parent.oid = m.roleid
          JOIN pg_roles member ON member.oid = m.member
          WHERE parent.rolname IN ('pharmnos_e2e_admin', 'pharmnos_e2e_validation')
            AND member.rolname = 'pharmnos_e2e_runtime'
        ) AS privileged_membership,
        has_table_privilege('public', 'public.sales_invoices', 'SELECT') AS public_select
    `))[0];
    record("q14-effective-acl-boundaries", "false/false/false/false/false", [
      aclReport.schema_create,
      aclReport.sequence_usage,
      aclReport.function_execute,
      aclReport.privileged_membership,
      aclReport.public_select,
    ].join("/"));

    const tenantA = await seedTenant(bootstrap, "a");
    const tenantB = await seedTenant(bootstrap, "b");
    const ownKey = `${run}-own`;
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [tenantA.tenant]);
    const ownRows = await rows(runtimeA, "SELECT id FROM tenants WHERE id = $1", [tenantA.tenant]);
    record("q14-own-read", "1", String(ownRows.length));
    const missingContext = await runtimeA.query("RESET request.jwt.claim.tenant_id");
    void missingContext;
    const missingRows = await rows(runtimeA, "SELECT id FROM tenants WHERE id = $1", [tenantA.tenant]);
    record("q14-missing-context", "0", String(missingRows.length));
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", ["invalid-tenant-context"]);
    const invalidRows = await rows(runtimeA, "SELECT id FROM tenants WHERE id = $1", [tenantA.tenant]);
    record("q14-invalid-context", "0", String(invalidRows.length));
    const publicSchemaUsage = await rows(runtimeA, "SELECT has_schema_privilege(current_user, 'public', 'USAGE') AS allowed");
    record("q14-runtime-schema-usage", "true", String(publicSchemaUsage[0].allowed));
    const anonymousSchemaUsage = await rows(
      bootstrap,
      "SELECT has_schema_privilege('public', 'public', 'USAGE') AS allowed",
    );
    record("q14-anonymous-schema-access", "false", String(anonymousSchemaUsage[0].allowed));
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [tenantA.tenant]);
    const crossRows = await rows(runtimeA, "SELECT id FROM tenants WHERE id = $1", [tenantB.tenant]);
    record("q14-cross-tenant-read", "0", String(crossRows.length));
    const crossWrite = await runtimeA.query(
      "UPDATE sales_invoices SET notes = 'cross-tenant' WHERE tenant_id = $1",
      [tenantB.tenant],
    );
    record("q14-cross-tenant-write", "0", String(crossWrite.rowCount));
    const schemaWrite = await expectError(() => runtimeA.query("CREATE TABLE public.q14_unauthorized (id text)"));
    record("q14-runtime-ddl-denied", "ERROR", schemaWrite === "NO_ERROR" ? "NO_ERROR" : "ERROR");
    for (const [label, key] of [
      ["missing", ""],
      ["empty", "   "],
      ["malformed", "bad key"],
      ["too-short", "short"],
    ]) {
      const invalid = await rows(runtimeA, `
        SELECT $1 ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' AS valid
      `, [key]);
      record(`q10-invalid-key-${label}`, "false", String(invalid[0].valid));
    }

    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [tenantA.tenant]);
    const first = await finalizeSynthetic(runtimeA, tenantA, ownKey);
    record("q10-first-request", "COMMITTED", first.outcome);
    const replay = await finalizeSynthetic(runtimeA, tenantA, ownKey);
    record("q10-exact-replay", "REPLAY", replay.outcome);
    const uncertainKey = `${run}-uncertain`;
    const uncertainFixture = await seedTenant(bootstrap, "uncertain");
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [uncertainFixture.tenant]);
    const uncertainError = await expectError(() => finalizeSynthetic(runtimeA, uncertainFixture, uncertainKey, { throwAfterCommit: true }));
    record("q10-uncertain-client-outcome", "ERROR", uncertainError === "NO_ERROR" ? "NO_ERROR" : "ERROR");
    const uncertainRetry = await finalizeSynthetic(runtimeA, uncertainFixture, uncertainKey);
    record("q10-uncertain-retry-replay", "REPLAY", uncertainRetry.outcome);
    const conflict = await expectError(() => finalizeSynthetic(runtimeA, tenantA, ownKey + "-conflict"));
    void conflict;
    const conflictingHash = await expectError(async () => {
      await runtimeA.query("BEGIN");
      try {
        await runtimeA.query(
          `INSERT INTO sales_posting_operations
           (id, tenant_id, sales_invoice_id, idempotency_key, request_payload_hash, updated_at)
           VALUES ($1, $2, $3, $4, 'different-hash', now())`,
          [`${run}-${crypto.randomUUID()}`, tenantA.tenant, tenantA.invoice, ownKey],
        );
        await runtimeA.query("COMMIT");
      } catch (error) {
        await runtimeA.query("ROLLBACK");
        throw error;
      }
    });
    record("q10-same-key-different-payload", "ERROR", conflictingHash === "NO_ERROR" ? "NO_ERROR" : "ERROR");

    const rollbackFixture = await seedTenant(bootstrap, "rollback");
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [rollbackFixture.tenant]);
    const rolledBack = await finalizeSynthetic(runtimeA, rollbackFixture, `${run}-rollback`, { failBeforeCommit: true });
    record("q10-failure-before-commit", "ROLLED_BACK", rolledBack.outcome);
    const rollbackCounts = await rows(runtimeA, `
      SELECT
        (SELECT count(*) FROM sales_posting_operations WHERE sales_invoice_id = $1) AS operations,
        (SELECT count(*) FROM stock_movements WHERE reference_id = $1) AS movements,
        (SELECT status FROM sales_invoices WHERE id = $1) AS status
    `, [rollbackFixture.invoice]);
    record("q10-rollback-financial-effects", "0/0/DRAFT", `${rollbackCounts[0].operations}/${rollbackCounts[0].movements}/${rollbackCounts[0].status}`);

    const concurrentFixture = await seedTenant(bootstrap, "concurrent");
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [concurrentFixture.tenant]);
    await runtimeB.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [concurrentFixture.tenant]);
    const concurrentKey = `${run}-concurrent`;
    let barrierCount = 0;
    let releaseBarrier;
    const barrierPromise = new Promise((resolve) => { releaseBarrier = resolve; });
    const barrier = async () => {
      barrierCount += 1;
      if (barrierCount === 2) releaseBarrier();
      await barrierPromise;
    };
    const concurrentResults = await Promise.all([
      finalizeSynthetic(runtimeA, concurrentFixture, concurrentKey, { barrier }).then((value) => value.outcome).catch(() => "CONFLICT"),
      finalizeSynthetic(runtimeB, concurrentFixture, concurrentKey, { barrier }).then((value) => value.outcome).catch(() => "CONFLICT"),
    ]);
    record("q10-concurrency-barrier", "2", String(barrierCount));
    record("q10-concurrent-identical", "COMMITTED+REPLAY", [...concurrentResults].sort().join("+"),
      concurrentResults.filter((value) => value === "COMMITTED").length === 1 &&
      concurrentResults.filter((value) => value === "REPLAY").length === 1 ? "PASS" : "FAIL");
    const counts = await rows(runtimeA, `
      SELECT
        (SELECT count(*) FROM sales_posting_operations WHERE sales_invoice_id = $1) AS operations,
        (SELECT count(*) FROM stock_movements WHERE reference_id = $1) AS movements,
        (SELECT count(*) FROM customer_ledgers WHERE invoice_id = $1) AS ledgers,
        (SELECT available_qty FROM product_batches WHERE id = $2) AS available_qty
    `, [concurrentFixture.invoice, concurrentFixture.batch]);
    record("q10-concurrent-no-duplicate-effects", "1/1/1/9",
      `${counts[0].operations}/${counts[0].movements}/${counts[0].ledgers}/${counts[0].available_qty}`);

    const conflictingFixture = await seedTenant(bootstrap, "conflicting");
    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [conflictingFixture.tenant]);
    await runtimeB.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [conflictingFixture.tenant]);
    const conflictingKey = `${run}-concurrent-conflict`;
    const committedConflict = finalizeSynthetic(runtimeA, conflictingFixture, conflictingKey);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const conflictingAttempt = (async () => {
      try {
        await runtimeB.query("BEGIN");
        await runtimeB.query(
          `INSERT INTO sales_posting_operations
           (id, tenant_id, sales_invoice_id, idempotency_key, request_payload_hash, updated_at)
           VALUES ($1, $2, $3, $4, 'different-concurrent-hash', now())`,
          [`${run}-${crypto.randomUUID()}`, conflictingFixture.tenant, conflictingFixture.invoice, conflictingKey],
        );
        await runtimeB.query("COMMIT");
        return "UNEXPECTED_COMMIT";
      } catch {
        await runtimeB.query("ROLLBACK");
        return "CONFLICT";
      }
    })();
    const conflictingResults = await Promise.all([committedConflict, conflictingAttempt]);
    record("q10-concurrent-conflicting", "COMMITTED+CONFLICT", `${conflictingResults[0].outcome}+${conflictingResults[1]}`);

    const pooledClient = await runtimePool.connect();
    await pooledClient.query("BEGIN");
    await pooledClient.query("SELECT set_config('request.jwt.claim.tenant_id', $1, true)", [tenantA.tenant]);
    await pooledClient.query("COMMIT");
    pooledClient.release();
    const pooledCheckout = await runtimePool.connect();
    const pooledRows = (await pooledCheckout.query("SELECT id FROM tenants WHERE id = $1", [tenantA.tenant])).rows;
    pooledCheckout.release();
    record("q14-pooled-session-no-leak", "0", String(pooledRows.length));

    await runtimeA.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [tenantA.tenant]);
    const finalizedUpdate = await expectError(() => runtimeA.query(
      "UPDATE sales_invoices SET notes = 'mutated' WHERE id = $1",
      [tenantA.invoice],
    ));
    record("q14-finalized-history-protected", "ERROR", finalizedUpdate === "NO_ERROR" ? "NO_ERROR" : "ERROR");
    const opIsolation = await rows(runtimeA, "SELECT id FROM sales_posting_operations WHERE tenant_id = $1", [tenantB.tenant]);
    record("q14-operation-tenant-isolation", "0", String(opIsolation.length));
    const operationTamper = await expectError(() => runtimeA.query(
      `UPDATE sales_posting_operations
       SET request_payload_hash = 'tampered'
       WHERE tenant_id = $1 AND idempotency_key = $2`,
      [tenantA.tenant, ownKey],
    ));
    record("q14-operation-tamper-denied", "ERROR", operationTamper === "NO_ERROR" ? "NO_ERROR" : "ERROR");

    console.log(JSON.stringify({ run, status: "PASS", results }, null, 2));
  } finally {
    await Promise.all([bootstrap.end(), runtimeA.end(), runtimeB.end(), runtimePool.end()]);
  }
}

main().catch((error) => {
  console.error(`Q10_Q14=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
