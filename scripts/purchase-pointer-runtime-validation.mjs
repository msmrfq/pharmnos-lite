#!/usr/bin/env node

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";

const { Client } = pg;
const run = `purchase-pointer-${Date.now()}`;

function loadEnv() {
  for (const file of [".env.financial-e2e"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

function databaseUrl(raw, database) {
  const url = new URL(raw);
  url.pathname = `/${database}`;
  url.searchParams.set("application_name", "pharmnos-purchase-pointer-runtime");
  return url.toString();
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

function migrate(url) {
  const result = spawnSync(process.env.ComSpec, ["/d", "/c", "pnpm exec prisma migrate deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);
}

async function expectForeignKey(client, statement) {
  try {
    await client.query(statement);
    return false;
  } catch (error) {
    return error?.code === "23503";
  }
}

async function main() {
  loadEnv();
  const admin = await connect(databaseUrl(process.env.TEST_DATABASE_URL, "postgres"));
  const database = `${process.env.TEST_DATABASE_NAME}_${run}`;
  await admin.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
  const url = databaseUrl(process.env.TEST_DATABASE_URL, database);
  migrate(url);
  const client = await connect(url);
  const ids = {
    tenantA: `${run}-tenant-a`,
    tenantB: `${run}-tenant-b`,
    userA: `${run}-user-a`,
    userB: `${run}-user-b`,
    roleA: `${run}-role-a`,
    roleB: `${run}-role-b`,
    membershipA: `${run}-membership-a`,
    membershipB: `${run}-membership-b`,
    supplierA: `${run}-supplier-a`,
    supplierB: `${run}-supplier-b`,
    invoiceA: `${run}-invoice-a`,
    invoiceB: `${run}-invoice-b`,
    evidenceA: `${run}-evidence-a`,
    evidenceB: `${run}-evidence-b`,
    calculationA: `${run}-calculation-a`,
    calculationB: `${run}-calculation-b`,
    decisionA: `${run}-decision-a`,
    decisionB: `${run}-decision-b`,
  };
  const results = [];
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO tenants (id, slug, business_name, updated_at) VALUES ($1,$2,'Pointer Tenant A',now()),($3,$4,'Pointer Tenant B',now())",
      [ids.tenantA, `${run}-tenant-a`, ids.tenantB, `${run}-tenant-b`],
    );
    await client.query(
      "INSERT INTO users (id, external_id, email, updated_at) VALUES ($1,$2,$3,now()),($4,$5,$6,now())",
      [ids.userA, `${run}-user-a`, `${run}-a@example.invalid`, ids.userB, `${run}-user-b`, `${run}-b@example.invalid`],
    );
    await client.query(
      "INSERT INTO roles (id, tenant_id, name, updated_at) VALUES ($1,$2,'Pointer Role A',now()),($3,$4,'Pointer Role B',now())",
      [ids.roleA, ids.tenantA, ids.roleB, ids.tenantB],
    );
    await client.query(
      "INSERT INTO memberships (id, tenant_id, user_id, role_id, updated_at) VALUES ($1,$2,$3,$4,now()),($5,$6,$7,$8,now())",
      [ids.membershipA, ids.tenantA, ids.userA, ids.roleA, ids.membershipB, ids.tenantB, ids.userB, ids.roleB],
    );
    await client.query(
      "INSERT INTO suppliers (id, tenant_id, business_name, updated_at) VALUES ($1,$2,'Supplier A',now()),($3,$4,'Supplier B',now())",
      [ids.supplierA, ids.tenantA, ids.supplierB, ids.tenantB],
    );
    await client.query(
      "INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,invoice_date,gross_amount,net_amount,updated_at) VALUES ($1,$2,'PTR-A',$3,now(),100,118,now()),($4,$2,'PTR-B',$3,now(),100,118,now()),($5,$6,'PTR-CROSS',$7,now(),100,118,now())",
      [ids.invoiceA, ids.tenantA, ids.supplierA, ids.invoiceB, `${run}-invoice-cross`, ids.tenantB, ids.supplierB],
    );
    await client.query(
      "INSERT INTO purchase_gst_evidence_revisions (id,tenant_id,purchase_invoice_id,revision_number,revision_kind,capture_channel,captured_by_membership_id) VALUES ($1,$2,$3,1,'INITIAL','runtime',$4),($5,$2,$6,1,'INITIAL','runtime',$4),($7,$8,$9,1,'INITIAL','runtime',$10)",
      [ids.evidenceA, ids.tenantA, ids.invoiceA, ids.membershipA, ids.evidenceB, ids.invoiceB, `${run}-evidence-cross`, ids.tenantB, `${run}-invoice-cross`, ids.membershipB],
    );
    await client.query(
      "INSERT INTO purchase_gst_calculations (id,tenant_id,purchase_invoice_id,evidence_revision_id,rule_version) VALUES ($1,$2,$3,$4,'runtime-v1'),($5,$2,$6,$7,'runtime-v1'),($8,$9,$10,$11,'runtime-v1')",
      [ids.calculationA, ids.tenantA, ids.invoiceA, ids.evidenceA, ids.calculationB, ids.invoiceB, ids.evidenceB, `${run}-calculation-cross`, ids.tenantB, `${run}-invoice-cross`, `${run}-evidence-cross`],
    );
    await client.query(
      "INSERT INTO purchase_gst_accounting_decisions (id,tenant_id,purchase_invoice_id,evidence_revision_id,calculation_id,accepted_value_source,decision_reference,decision_outcome,rationale,decided_by_membership_id) VALUES ($1,$2,$3,$4,$5,'APPLICATION_CALCULATED','PTR-A','ACCEPTED','runtime',$6),($7,$2,$8,$9,$10,'APPLICATION_CALCULATED','PTR-B','ACCEPTED','runtime',$6),($11,$12,$13,$14,$15,'APPLICATION_CALCULATED','PTR-CROSS','ACCEPTED','runtime',$16)",
      [ids.decisionA, ids.tenantA, ids.invoiceA, ids.evidenceA, ids.calculationA, ids.membershipA, ids.decisionB, ids.invoiceB, ids.evidenceB, ids.calculationB, `${run}-decision-cross`, ids.tenantB, `${run}-invoice-cross`, `${run}-evidence-cross`, `${run}-calculation-cross`, ids.membershipB],
    );
    await client.query("COMMIT");

    await client.query(`
      UPDATE purchase_invoices
      SET current_gst_evidence_revision_id = $1,
          current_gst_calculation_id = $2,
          current_gst_accounting_decision_id = $3
      WHERE tenant_id = $4 AND id = $5
    `, [ids.evidenceA, ids.calculationA, ids.decisionA, ids.tenantA, ids.invoiceA]);
    results.push(["valid pointer assignment", "PASS"]);

    results.push(["missing target rejection", await expectForeignKey(client, `
      UPDATE purchase_invoices
      SET current_gst_calculation_id = '${run}-missing'
      WHERE tenant_id = '${ids.tenantA}' AND id = '${ids.invoiceA}'
    `) ? "PASS" : "FAIL"]);
    results.push(["cross-tenant rejection", await expectForeignKey(client, `
      UPDATE purchase_invoices
      SET current_gst_calculation_id = '${run}-calculation-cross'
      WHERE tenant_id = '${ids.tenantA}' AND id = '${ids.invoiceA}'
    `) ? "PASS" : "FAIL"]);
    results.push(["cross-invoice rejection", await expectForeignKey(client, `
      UPDATE purchase_invoices
      SET current_gst_calculation_id = '${ids.calculationB}'
      WHERE tenant_id = '${ids.tenantA}' AND id = '${ids.invoiceA}'
    `) ? "PASS" : "FAIL"]);

    const deleteRestricted = await client.query(
      `DELETE FROM purchase_gst_calculations WHERE id = $1`,
      [ids.calculationA],
    ).then(() => false).catch((error) => error?.code === "23503");
    results.push(["delete restriction", deleteRestricted ? "PASS" : "FAIL"]);

    await client.query(`
      UPDATE purchase_invoices
      SET current_gst_calculation_id = NULL,
          current_gst_evidence_revision_id = NULL,
          current_gst_accounting_decision_id = NULL
      WHERE tenant_id = $1 AND id = $2
    `, [ids.tenantA, ids.invoiceA]);
    await client.query(`
      UPDATE purchase_invoices
      SET current_gst_evidence_revision_id = $1,
          current_gst_calculation_id = $2,
          current_gst_accounting_decision_id = $3
      WHERE tenant_id = $4 AND id = $5
    `, [ids.evidenceA, ids.calculationA, ids.decisionA, ids.tenantA, ids.invoiceA]);
    results.push(["pointer replacement", "PASS"]);

    await client.query("BEGIN");
    await client.query(
      `UPDATE purchase_invoices SET current_gst_calculation_id = NULL WHERE tenant_id = $1 AND id = $2`,
      [ids.tenantA, ids.invoiceA],
    );
    await client.query("ROLLBACK");
    const rollback = await client.query(
      `SELECT current_gst_calculation_id FROM purchase_invoices WHERE id = $1`,
      [ids.invoiceA],
    );
    results.push(["transaction rollback", rollback.rows[0].current_gst_calculation_id === ids.calculationA ? "PASS" : "FAIL"]);

    const legacy = await client.query(
      `INSERT INTO purchase_invoices (id,tenant_id,invoice_no,supplier_id,invoice_date,gross_amount,net_amount,updated_at)
       VALUES ($1,$2,'PTR-LEGACY',$3,now(),100,100,now()) RETURNING current_gst_calculation_id`,
      [`${run}-legacy`, ids.tenantA, ids.supplierA],
    );
    results.push(["legacy nullable pointer", legacy.rows[0].current_gst_calculation_id === null ? "PASS" : "FAIL"]);

    const concurrent = await Promise.all([
      client.query(`UPDATE purchase_invoices SET gst_record_version = gst_record_version + 1 WHERE id = $1 AND gst_record_version = 0`, [ids.invoiceA]),
      client.query(`UPDATE purchase_invoices SET gst_record_version = gst_record_version + 1 WHERE id = $1 AND gst_record_version = 0`, [ids.invoiceA]),
    ]);
    results.push(["concurrent guarded update", concurrent.filter((result) => result.rowCount === 1).length === 1 ? "PASS" : "FAIL"]);

    if (results.some(([, status]) => status !== "PASS")) throw new Error(JSON.stringify(results));
    console.log(JSON.stringify({ run, status: "PASS — SCOPED", results, database }, null, 2));
  } finally {
    await client.end();
    await admin.end();
  }
}

main().catch((error) => {
  console.error(`PURCHASE_POINTERS=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
