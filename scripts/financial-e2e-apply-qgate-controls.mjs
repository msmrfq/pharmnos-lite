#!/usr/bin/env node

import fs from "node:fs";
import pg from "pg";

const { Client } = pg;
const BOOTSTRAP_ROLE = "pharmnos_e2e";
const RUNTIME_ROLE = "pharmnos_e2e_runtime";
const ADMIN_ROLE = "pharmnos_e2e_admin";
const VALIDATION_ROLE = "pharmnos_e2e_validation";

function loadEnv() {
  for (const file of [".env.financial-e2e"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function connectionUrl(raw, user, password, applicationName) {
  const url = new URL(raw);
  url.username = user;
  url.password = password;
  url.searchParams.set("application_name", applicationName);
  return url.toString();
}

async function main() {
  loadEnv();
  const client = new Client({
    connectionString: connectionUrl(
      process.env.TEST_DATABASE_URL,
      process.env.FINANCIAL_E2E_DB_USER,
      process.env.FINANCIAL_E2E_DB_PASSWORD,
      "pharmnos-financial-e2e-qgate-controls",
    ),
  });
  await client.connect();
  try {
    await client.query(fs.readFileSync("prisma/financial-e2e-q14-security-controls.sql", "utf8"));
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ADMIN_ROLE}') THEN
          CREATE ROLE "${ADMIN_ROLE}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${VALIDATION_ROLE}') THEN
          CREATE ROLE "${VALIDATION_ROLE}" NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
      REVOKE UPDATE ON TABLE public."sales_posting_operations" FROM "${RUNTIME_ROLE}";
      GRANT UPDATE (status, result_invoice_no, result_sales_id, updated_at)
        ON TABLE public."sales_posting_operations" TO "${RUNTIME_ROLE}";
      REVOKE EXECUTE ON FUNCTION public.guard_sales_posting_transition() FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.guard_sales_posting_transition() TO "${BOOTSTRAP_ROLE}";
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.sales_posting_operations'::regclass
            AND conname = 'sales_posting_operations_status_check'
        ) THEN
          ALTER TABLE public."sales_posting_operations"
            ADD CONSTRAINT "sales_posting_operations_status_check"
            CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'));
        END IF;
      END
      $$;
      CREATE OR REPLACE FUNCTION public.guard_sales_posting_transition()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = pg_catalog, public
      AS $function$
      BEGIN
        IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
           OR NEW.sales_invoice_id IS DISTINCT FROM OLD.sales_invoice_id
           OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.request_payload_hash IS DISTINCT FROM OLD.request_payload_hash THEN
          RAISE EXCEPTION 'Sales posting operation identity is immutable' USING ERRCODE = '23514';
        END IF;
        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'PROCESSING' AND NEW.status IN ('COMPLETED', 'FAILED')) THEN
          RAISE EXCEPTION 'Invalid sales posting transition' USING ERRCODE = '23514';
        END IF;
        IF NEW.status = 'PROCESSING'
           AND (NEW.result_invoice_no IS NOT NULL OR NEW.result_sales_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Processing sales operation cannot have a result' USING ERRCODE = '23514';
        END IF;
        IF NEW.status = 'COMPLETED'
           AND (NEW.result_invoice_no IS NULL OR NEW.result_sales_id IS NULL) THEN
          RAISE EXCEPTION 'Completed sales operation requires a result' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $function$;
      DROP TRIGGER IF EXISTS guard_sales_posting_transition
        ON public."sales_posting_operations";
      CREATE TRIGGER guard_sales_posting_transition
        BEFORE UPDATE ON public."sales_posting_operations"
        FOR EACH ROW EXECUTE FUNCTION public.guard_sales_posting_transition();
    `);
    const report = await client.query(`
      SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls,
             pg_get_userbyid(c.relowner) AS owner,
             has_table_privilege(r.rolname, 'public.sales_posting_operations', 'UPDATE') AS update_table,
             EXISTS (
               SELECT 1 FROM information_schema.role_column_grants g
               WHERE g.grantee = r.rolname
                 AND g.table_schema = 'public'
                 AND g.table_name = 'sales_posting_operations'
                 AND g.column_name = 'status'
                 AND g.privilege_type = 'UPDATE'
             ) AS update_status,
             EXISTS (
               SELECT 1 FROM information_schema.role_column_grants g
               WHERE g.grantee = r.rolname
                 AND g.table_schema = 'public'
                 AND g.table_name = 'sales_posting_operations'
                 AND g.column_name = 'request_payload_hash'
                 AND g.privilege_type = 'UPDATE'
             ) AS update_hash
      FROM pg_roles r
      CROSS JOIN pg_class c
      WHERE r.rolname IN ($1, $2, $3, $4)
        AND c.oid = 'public.sales_posting_operations'::regclass
      ORDER BY r.rolname
    `, [BOOTSTRAP_ROLE, RUNTIME_ROLE, ADMIN_ROLE, VALIDATION_ROLE]);
    console.log(JSON.stringify({ status: "PASS", controls: report.rows }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`QGATE_CONTROLS=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
