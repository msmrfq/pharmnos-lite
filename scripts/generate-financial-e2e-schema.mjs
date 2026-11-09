import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifact = path.join(root, "prisma", "financial-e2e-schema-provisioning.generated.sql");
const prisma = path.join(root, "node_modules", "prisma", "build", "index.js");
const result = spawnSync(process.execPath, [
  prisma, "migrate", "diff", "--from-empty", "--to-schema-datamodel",
  path.join(root, "prisma", "schema.prisma"), "--script",
], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Prisma schema generation failed: ${result.stderr}`);

const migration = fs.readFileSync(path.join(root, "prisma", "migrations", "0025_payment_receipt_sequence", "migration.sql"), "utf8");
const check = migration.match(/CONSTRAINT "payment_receipt_sequences_next_value_check"\s+CHECK \("next_value" > 0\)/g);
if (check?.length !== 1) throw new Error("Receipt sequence migration check constraint is missing or ambiguous.");
const table = /CREATE TABLE "payment_receipt_sequences" \([\s\S]*?\n\);/g;
const matches = result.stdout.match(table);
if (matches?.length !== 1) throw new Error("Generated receipt sequence table is missing or ambiguous.");
const receiptTable = matches[0].replace(
  '    CONSTRAINT "payment_receipt_sequences_pkey" PRIMARY KEY ("tenant_id","prefix")',
  `    CONSTRAINT "payment_receipt_sequences_pkey" PRIMARY KEY ("tenant_id","prefix"),\n    ${check[0]}`,
);
if (receiptTable === matches[0]) throw new Error("Generated receipt sequence primary key changed unexpectedly.");
const governance = fs.readFileSync(path.join(root, "prisma", "financial-e2e-schema-governance-controls.sql"), "utf8");
const refundMigration = fs.readFileSync(path.join(root, "prisma", "migrations", "0027_refund_lifecycle", "migration.sql"), "utf8");
const temporalMigration = fs.readFileSync(path.join(root, "prisma", "migrations", "0028_financial_event_dates", "migration.sql"), "utf8");
function uniqueMatch(pattern, label) {
  const matches = [...refundMigration.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Refund baseline ${label} is missing or ambiguous.`);
  return matches[0];
}
const refundChecks = [
  ["payments", "payments_one_counterparty_check"],
  ["payment_refunds", "payment_refunds_approved_actor_pair_check"],
  ["payment_refunds", "payment_refunds_rejected_actor_pair_check"],
  ["payment_refunds", "payment_refunds_cancelled_actor_pair_check"],
].map(([tableName, constraint]) => {
  const match = uniqueMatch(new RegExp(`ADD CONSTRAINT "${constraint}"\\s+(CHECK \\([^\\n]+\\));`, "g"), constraint);
  return `ALTER TABLE "${tableName}" ADD CONSTRAINT "${constraint}" ${match[1]};`;
});
const refundIndex = uniqueMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_refund_lifecycle_idempotency_key"[\s\S]*?;\s*/g, "index")[0].trim();
const refundFunction = uniqueMatch(/CREATE OR REPLACE FUNCTION public\.guard_payment_refund_lifecycle\(\)[\s\S]*?\$function\$;/g, "function")[0];
const refundTrigger = uniqueMatch(/CREATE TRIGGER "payment_refunds_lifecycle_guard"[\s\S]*?EXECUTE FUNCTION public\.guard_payment_refund_lifecycle\(\);/g, "trigger")[0];
const refundControls = [...refundChecks, refundIndex, refundFunction, refundTrigger].join("\n\n");
const temporalBlocks = [...temporalMigration.matchAll(/-- BEGIN GENERATED BASELINE FINANCIAL TEMPORAL CONTROLS\s*([\s\S]*?)\s*-- END GENERATED BASELINE FINANCIAL TEMPORAL CONTROLS/g)];
if (temporalBlocks.length !== 1) throw new Error("Financial temporal baseline controls are missing or ambiguous.");
const temporalControls = temporalBlocks[0][1].trim();
const generated = "-- Generated offline from the current Prisma schema plus checked HSN/SAC governance controls; complete baseline.\n\n" +
  result.stdout.replace(table, () => receiptTable).trimEnd() + "\n\n" + governance.trimEnd() + "\n\n" +
  refundControls + "\n\n" + temporalControls + "\n";
if (process.argv.slice(2).length === 1 && process.argv[2] === "--write") {
  fs.writeFileSync(artifact, generated, "utf8");
} else if (process.argv.slice(2).length === 1 && process.argv[2] === "--check") {
  if (fs.readFileSync(artifact, "utf8") !== generated) throw new Error("Generated schema artifact is stale.");
} else {
  throw new Error("Specify --write or --check.");
}
