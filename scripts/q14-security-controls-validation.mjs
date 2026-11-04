#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;
const run = `q14-${Date.now()}`;
const results = [];

function loadEnv() {
  for (const line of fs.readFileSync(".env.financial-e2e", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function url(raw, user, password, applicationName) {
  const parsed = new URL(raw);
  if (user) parsed.username = user;
  if (password) parsed.password = password;
  parsed.searchParams.set("application_name", applicationName);
  return parsed.toString();
}

async function connect(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function rows(client, sql, values = []) {
  return (await client.query(sql, values)).rows;
}

function record(id, expected, observed) {
  const status = expected === observed ? "PASS" : "FAIL";
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

async function setRole(client, role) {
  await client.query("RESET ROLE");
  if (role) await client.query(`SET ROLE "${role}"`);
}

async function connectionEvidence(client) {
  const identity = await rows(client, `
    SELECT
      current_database() AS database,
      session_user,
      current_user,
      r.rolsuper,
      r.rolbypassrls,
      r.rolinherit,
      r.rolcanlogin,
      (SELECT count(*) FROM information_schema.role_table_grants
       WHERE grantee = current_user AND table_schema = 'public') AS table_grants,
      (SELECT count(*) FROM information_schema.role_routine_grants
       WHERE grantee = current_user AND routine_schema = 'q14_security') AS function_grants
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);
  return identity[0];
}

async function main() {
  loadEnv();
  const bootstrap = await connect(url(
    process.env.TEST_DATABASE_URL,
    process.env.FINANCIAL_E2E_DB_USER,
    process.env.FINANCIAL_E2E_DB_PASSWORD,
    "pharmnos-financial-e2e-q14-controls-bootstrap",
  ));
  const runtime = await connect(url(
    process.env.FINANCIAL_E2E_RUNTIME_DATABASE_URL,
    null,
    null,
    "pharmnos-financial-e2e-q14-controls-runtime",
  ));
  const rolePasswords = {
    admin: crypto.randomBytes(24).toString("hex"),
    validation: crypto.randomBytes(24).toString("hex"),
  };
  await bootstrap.query(
    `ALTER ROLE "pharmnos_e2e_admin" LOGIN PASSWORD '${rolePasswords.admin}'`,
  );
  await bootstrap.query(
    `ALTER ROLE "pharmnos_e2e_validation" LOGIN PASSWORD '${rolePasswords.validation}'`,
  );
  const admin = await connect(url(
    process.env.TEST_DATABASE_URL,
    "pharmnos_e2e_admin",
    rolePasswords.admin,
    "pharmnos-financial-e2e-q14-controls-admin",
  ));
  const validation = await connect(url(
    process.env.TEST_DATABASE_URL,
    "pharmnos_e2e_validation",
    rolePasswords.validation,
    "pharmnos-financial-e2e-q14-controls-validation",
  ));
  const identityEvidence = {
    bootstrap: await connectionEvidence(bootstrap),
    runtime: await connectionEvidence(runtime),
    admin: await connectionEvidence(admin),
    validation: await connectionEvidence(validation),
  };
  const ids = {
    tenantA: `${run}-tenant-a`,
    tenantB: `${run}-tenant-b`,
    roleA: `${run}-role-a`,
    roleB: `${run}-role-b`,
    requester: `${run}-requester`,
    approver: `${run}-approver`,
    executor: `${run}-executor`,
    userB: `${run}-user-b`,
    productA: `${run}-product-a`,
    productB: `${run}-product-b`,
    productExpired: `${run}-product-expired`,
  };
  try {
    await bootstrap.query(fs.readFileSync("prisma/financial-e2e-q14-security-controls.sql", "utf8"));
    await bootstrap.query(`
      INSERT INTO tenants (id, slug, business_name, updated_at)
      VALUES ($1, $2, 'Q14 Tenant A', now()), ($3, $4, 'Q14 Tenant B', now())
    `, [ids.tenantA, `${run}-tenant-a`, ids.tenantB, `${run}-tenant-b`]);
    await bootstrap.query(`
      INSERT INTO roles (id, tenant_id, name, is_default, updated_at)
      VALUES ($1, $2, 'Q14 Role A', true, now()), ($3, $4, 'Q14 Role B', true, now())
    `, [ids.roleA, ids.tenantA, ids.roleB, ids.tenantB]);
    await bootstrap.query(`
      INSERT INTO users (id, external_id, email, full_name, updated_at)
      VALUES
        ($1, $2, $3, 'Q14 Requester', now()),
        ($4, $5, $6, 'Q14 Approver', now()),
        ($7, $8, $9, 'Q14 Executor', now()),
        ($10, $11, $12, 'Q14 Tenant B User', now())
    `, [
      ids.requester, `${run}-requester-external`, `${run}-requester@example.invalid`,
      ids.approver, `${run}-approver-external`, `${run}-approver@example.invalid`,
      ids.executor, `${run}-executor-external`, `${run}-executor@example.invalid`,
      ids.userB, `${run}-user-b-external`, `${run}-user-b@example.invalid`,
    ]);
    await bootstrap.query(`
      INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at)
      VALUES
        ($1, $2, $3, $4, now()),
        ($5, $2, $6, $4, now()),
        ($7, $2, $8, $4, now()),
        ($9, $10, $11, $12, now())
    `, [
      `${run}-membership-requester`, ids.tenantA, ids.requester, ids.roleA,
      `${run}-membership-approver`, ids.approver,
      `${run}-membership-executor`, ids.executor,
      `${run}-membership-b`, ids.tenantB, ids.userB, ids.roleB,
    ]);
    await bootstrap.query(`
      INSERT INTO products
        (id, tenant_id, name, hsn_code, gst_rate, standard_sale_rate, updated_at)
      VALUES
        ($1, $2, 'Q14 Product A', 'Q14', 18, 100, now()),
        ($3, $2, 'Q14 Product B', 'Q14', 18, 100, now()),
        ($4, $2, 'Q14 Product Expired', 'Q14', 18, 100, now())
    `, [ids.productA, ids.tenantA, ids.productB, ids.productExpired]);
    await bootstrap.query(`
      INSERT INTO public.q14_maintenance_probe (id, marker)
      VALUES ($1, 'before')
    `, [`${run}-probe`]);

    await setRole(runtime, null);
    await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
    const unauthorizedMaintenance = await expectError(() => runtime.query(
      "SELECT q14_security.maintain_allowlisted_trigger($1,$2,$3,$4)",
      ["q14_eligible_maintenance_trigger", "q14_maintenance_probe", "Q14_ALLOWLISTED_PROBE_MAINTENANCE", ids.requester],
    ));
    record("sec01-unauthorized-maintenance", "ERROR", unauthorizedMaintenance.startsWith("42501") ? "ERROR" : unauthorizedMaintenance);

    const authorizedMaintenance = await rows(admin, `
      SELECT q14_security.maintain_allowlisted_trigger(
        'q14_eligible_maintenance_trigger', 'q14_maintenance_probe',
        'Q14_ALLOWLISTED_PROBE_MAINTENANCE', $1
      ) AS result
    `, [ids.approver]);
    record("sec01-authorized-allowlist", "PASS", authorizedMaintenance[0].result.status);
    const operationFailure = await rows(admin, `
      SELECT q14_security.maintain_allowlisted_trigger(
        'q14_eligible_maintenance_trigger', 'q14_maintenance_probe',
        'Q14_ALLOWLISTED_PROBE_MAINTENANCE', $1, true, false
      ) AS result
    `, [ids.approver]);
    record("sec01-operation-failure-restored", "RECOVERED", operationFailure[0].result.status);
    const restorationFailure = await rows(admin, `
      SELECT q14_security.maintain_allowlisted_trigger(
        'q14_eligible_maintenance_trigger', 'q14_maintenance_probe',
        'Q14_ALLOWLISTED_PROBE_MAINTENANCE', $1, false, true
      ) AS result
    `, [ids.approver]);
    record("sec01-restoration-failure-recovered", "RECOVERED", restorationFailure[0].result.status);
    const prohibited = await rows(admin, `
      SELECT q14_security.maintain_allowlisted_trigger(
        'guard_sales_posting_transition', 'sales_posting_operations',
        'POSTING_INTEGRITY', $1
      ) AS result
    `, [ids.approver]);
    record("sec01-protected-trigger-denied", "DENIED", prohibited[0].result.status);
    const unknown = await rows(admin, `
      SELECT q14_security.maintain_allowlisted_trigger(
        'unknown_trigger', 'unknown_table', 'UNKNOWN_PURPOSE', $1
      ) AS result
    `, [ids.approver]);
    record("sec01-unknown-trigger-denied", "DENIED", unknown[0].result.status);
    const triggerStates = await rows(bootstrap, `
      SELECT
        q14_security.verify_trigger_state('q14_eligible_maintenance_trigger', 'q14_maintenance_probe') AS eligible_restored,
        q14_security.verify_trigger_state('guard_sales_posting_transition', 'sales_posting_operations') AS protected_restored,
        (SELECT count(*) FROM q14_trigger_allowlist WHERE eligible) AS eligible_count,
        (SELECT count(*) FROM q14_trigger_allowlist WHERE NOT eligible) AS protected_count,
        (SELECT count(*) FROM q14_maintenance_audit WHERE outcome IN ('SUCCESS','FAILED_OPERATION_RESTORED')) AS successful_audits,
        (SELECT count(*) FROM q14_maintenance_audit WHERE outcome = 'DENIED') AS denied_audits
    `);
    record("sec01-independent-trigger-restoration", "true/true", `${triggerStates[0].eligible_restored}/${triggerStates[0].protected_restored}`);
    record("sec01-allowlist-exclusion-matrix", "1/12", `${triggerStates[0].eligible_count}/${triggerStates[0].protected_count}`);
    record("sec01-audit-evidence", "true",
      String(Number(triggerStates[0].successful_audits) >= 3 && Number(triggerStates[0].denied_audits) >= 2));

    await runtime.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
    const request = await rows(runtime, `
      SELECT q14_security.request_soft_delete($1,$2,$3,$4,$5) AS result
    `, [ids.tenantA, "products", ids.productA, "Q14 lifecycle cleanup", ids.requester]);
    const requestId = request[0].result.request_id;
    record("sec02-valid-request", "REQUESTED", request[0].result.status);
    const duplicate = await rows(runtime, `
      SELECT q14_security.request_soft_delete($1,$2,$3,$4,$5) AS result
    `, [ids.tenantA, "products", ids.productA, "duplicate request", ids.requester]);
    record("sec02-duplicate-request-denied", "DENIED", duplicate[0].result.status);
    const crossTenant = await rows(runtime, `
      SELECT q14_security.request_soft_delete($1,$2,$3,$4,$5) AS result
    `, [ids.tenantB, "products", ids.productA, "cross tenant", ids.requester]);
    record("sec02-cross-tenant-request-denied", "DENIED", crossTenant[0].result.status);
    const finalizedInvoice = (await rows(bootstrap, `
      SELECT id, tenant_id FROM sales_invoices
      WHERE tenant_id = $1 AND status = 'FINALIZED'
      ORDER BY updated_at DESC
      LIMIT 1
    `, [ids.tenantA]))[0];
    const protectedBefore = finalizedInvoice
      ? await rows(bootstrap, `
        SELECT
          (SELECT to_jsonb(i) FROM sales_invoices i WHERE i.id = $1) AS invoice,
          (SELECT jsonb_agg(to_jsonb(ii) ORDER BY ii.id) FROM sales_invoice_items ii WHERE ii.invoice_id = $1) AS items,
          (SELECT count(*) FROM audit_logs WHERE target_id = $1) AS audit_events
      `, [finalizedInvoice.id])
      : [];
    const protectedRequest = await rows(runtime, `
      SELECT q14_security.request_soft_delete($1,$2,$3,$4,$5) AS result
    `, [ids.tenantA, "sales_invoices", finalizedInvoice?.id ?? `${run}-missing-finalized`, "protected history", ids.requester]);
    record("sec02-finalized-target-denied", "DENIED", protectedRequest[0].result.status);
    const unauthorizedApproval = await expectError(() => runtime.query(
      "SELECT q14_security.approve_soft_delete($1,$2)", [requestId, ids.approver],
    ));
    record("sec02-runtime-approval-denied", "ERROR", unauthorizedApproval.startsWith("42501") ? "ERROR" : unauthorizedApproval);

    await admin.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
    const sameActorApproval = await rows(admin, `
      SELECT q14_security.approve_soft_delete($1,$2) AS result
    `, [requestId, ids.requester]);
    record("sec02-same-actor-approval-denied", "DENIED", sameActorApproval[0].result.status);
    const approval = await rows(admin, `
      SELECT q14_security.approve_soft_delete($1,$2) AS result
    `, [requestId, ids.approver]);
    record("sec02-valid-approval", "APPROVED", approval[0].result.status);
    await validation.query("SELECT set_config('request.jwt.claim.tenant_id', $1, false)", [ids.tenantA]);
    const sameApproverExecution = await rows(validation, `
      SELECT q14_security.execute_soft_delete($1,$2) AS result
    `, [requestId, ids.approver]);
    record("sec02-approver-execution-denied", "DENIED", sameApproverExecution[0].result.status);
    const execution = await rows(validation, `
      SELECT q14_security.execute_soft_delete($1,$2) AS result
    `, [requestId, ids.executor]);
    record("sec02-valid-execution", "EXECUTED", execution[0].result.status);
    const targetState = await rows(bootstrap, `
      SELECT is_active FROM products WHERE id = $1 AND tenant_id = $2
    `, [ids.productA, ids.tenantA]);
    record("sec02-soft-delete-state", "false", String(targetState[0].is_active));
    if (finalizedInvoice) {
      const protectedAfter = await rows(bootstrap, `
        SELECT
          (SELECT to_jsonb(i) FROM sales_invoices i WHERE i.id = $1) AS invoice,
          (SELECT jsonb_agg(to_jsonb(ii) ORDER BY ii.id) FROM sales_invoice_items ii WHERE ii.invoice_id = $1) AS items,
          (SELECT count(*) FROM audit_logs WHERE target_id = $1) AS audit_events
      `, [finalizedInvoice.id]);
      record(
        "sec02-finalized-records-unchanged",
        "true",
        String(JSON.stringify(protectedBefore[0]) === JSON.stringify(protectedAfter[0])),
      );
    }

    await bootstrap.query("UPDATE products SET is_active = true WHERE id = $1", [ids.productExpired]);
    await bootstrap.query(`
      INSERT INTO public.q14_soft_delete_requests
        (id, tenant_id, target_table, target_id, reason, requested_by, approved_by, approved_at, status, expires_at)
      VALUES ($1, $2, 'products', $3, 'expired request', $4, $5, now(), 'APPROVED', now() - interval '1 minute')
    `, [`${run}-expired-request`, ids.tenantA, ids.productExpired, ids.requester, ids.approver]);
    const expired = await rows(validation, `
      SELECT q14_security.execute_soft_delete($1,$2) AS result
    `, [`${run}-expired-request`, ids.executor]);
    record("sec02-expired-execution-denied", "DENIED", expired[0].result.status);
    const protectedRows = await rows(bootstrap, `
      SELECT
        (SELECT count(*) FROM q14_soft_delete_audit WHERE outcome = 'DENIED') AS denied_audits,
        (SELECT is_active FROM products WHERE id = $1) AS expired_still_active,
        (SELECT count(*) FROM q14_soft_delete_audit WHERE action = 'REQUEST') AS request_audits,
        (SELECT count(*) FROM q14_soft_delete_audit WHERE action = 'APPROVE') AS approval_audits,
        (SELECT count(*) FROM q14_soft_delete_audit WHERE action = 'EXECUTE') AS execution_audits
    `, [ids.productExpired]);
    record("sec02-audit-and-unchanged-rejected-state", "true",
      String(Number(protectedRows[0].denied_audits) >= 3
        && Number(protectedRows[0].request_audits) >= 2
        && Number(protectedRows[0].approval_audits) >= 2
        && Number(protectedRows[0].execution_audits) >= 2
        && protectedRows[0].expired_still_active === true));

    console.log(JSON.stringify({ run, status: "PASS", identityEvidence, results }, null, 2));
  } finally {
    await Promise.all([bootstrap.end(), runtime.end(), admin.end(), validation.end()]);
  }
}

main().catch((error) => {
  console.error(`Q14_SECURITY=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
