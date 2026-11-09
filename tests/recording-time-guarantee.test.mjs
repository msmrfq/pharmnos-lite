import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(() => { throw new Error("unexpected dependency"); }, module, module.exports);
  return module.exports;
}

const { RECORDING_TIME_GUARANTEE, RECORDING_TIME_DISCLOSURE } = load("../src/lib/utils/recording-time-guarantee.ts");
const migration = fs.readFileSync("prisma/migrations/0028_financial_event_dates/migration.sql", "utf8");
const baseline = fs.readFileSync("prisma/financial-e2e-schema-provisioning.generated.sql", "utf8");
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

const RECORDED_COLUMNS = [
  ["payments", "recorded_at"],
  ["customer_ledgers", "recorded_at"],
  ["supplier_ledgers", "recorded_at"],
  ["payment_allocations", "recorded_at"],
  ["allocation_reversals", "recorded_at"],
  ["payment_reversals", "recorded_at"],
  ["sales_invoices", "finalized_recorded_at"],
  ["purchase_invoices", "finalized_recorded_at"],
  ["payment_refunds", "requested_recorded_at"],
  ["payment_refunds", "completed_recorded_at"],
];

test("the guarantee constant and disclosure state the pre-commit meaning honestly", () => {
  assert.equal(RECORDING_TIME_GUARANTEE, "DB_STATEMENT_EXECUTION_PRE_COMMIT");
  assert.equal(typeof RECORDING_TIME_DISCLOSURE, "string");
  assert.equal(RECORDING_TIME_DISCLOSURE.match(/[.!?]/g)?.length, 1, "exactly one sentence");
  assert.match(RECORDING_TIME_DISCLOSURE, /before commit/);
  assert.match(RECORDING_TIME_DISCLOSURE, /not commit-visible time/);
  assert.match(RECORDING_TIME_DISCLOSURE, /does not prove what was known/);
  assert.doesNotMatch(RECORDING_TIME_DISCLOSURE, /\bknowledge-as-of\b|\bas-of proof\b/i);
});

test("every recorded-time column has a pre-commit SQL comment in the migration and baseline", () => {
  for (const [table, column] of RECORDED_COLUMNS) {
    for (const [label, sql] of [["migration", migration], ["baseline", baseline]]) {
      const comment = sql.match(new RegExp(`COMMENT ON COLUMN "${table}"\\."${column}" IS\\s+'([^']*)'`))?.[1];
      assert.ok(comment, `${label} lacks a comment for ${table}.${column}`);
      assert.match(comment, /Pre-commit/);
      assert.match(comment, /still-open transaction/);
      assert.match(comment, /NOT commit-visible time/);
      assert.match(comment, /NOT proof of historical knowledge/);
      assert.match(comment, /Caller-supplied values are rejected and updates are blocked/);
    }
  }
});

test("every recorded-time Prisma field carries the same guarantee as a doc comment", () => {
  for (const [table, column] of RECORDED_COLUMNS) {
    const block = schema.match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? "";
    const doc = block.match(new RegExp(`((?:^[ \\t]*///.*\\r?\\n)+)[ \\t]*${column}[ \\t]+DateTime`, "m"))?.[1] ?? "";
    assert.match(doc, /Pre-commit/, `${table}.${column}`);
    assert.match(doc, /NOT commit-visible time/, `${table}.${column}`);
    assert.match(doc, /NOT proof of historical knowledge/, `${table}.${column}`);
  }
});

test("the only recorded-time source is clock_timestamp() in triggers and no caller can supply it", () => {
  const assigned = [...migration.matchAll(/NEW\.(\w*recorded_at)\s*:=\s*([^;]+);/g)];
  assert.deepEqual(
    assigned.map((match) => [match[1], match[2].trim()]).sort(),
    [
      ["completed_recorded_at", "clock_timestamp()"],
      ["finalized_recorded_at", "clock_timestamp()"],
      ["finalized_recorded_at", "clock_timestamp()"],
      ["recorded_at", "clock_timestamp()"],
      ["requested_recorded_at", "clock_timestamp()"],
    ],
  );
  assert.doesNotMatch(migration, /\bDEFAULT\s+(?:now|current_timestamp|transaction_timestamp|statement_timestamp)/i);
  assert.doesNotMatch(migration, /NEW\.\w*recorded_at\s*:=\s*(?:now|transaction_timestamp|statement_timestamp)\(/i);
  for (const column of ["recorded_at", "finalized_recorded_at", "requested_recorded_at", "completed_recorded_at"]) {
    assert.match(migration, new RegExp(`NEW\\.${column} IS NOT NULL`), `${column} insert override must be rejected`);
  }
});

test("application code never writes a recorded-time column", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && /\b(?:finalized_|requested_|completed_)?recorded_at\s*:\s*(?:new Date|Date\.now|captureSystemInstant|[\w$.]*occurredAt|[\w$.]*now\(|clock_timestamp)/.test(fs.readFileSync(full, "utf8"))) {
        offenders.push(full);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});

test("UPDATE paths cannot rewrite recorded time on any table", () => {
  const protect = migration.match(/FUNCTION public\.protect_financial_recorded_at\(\)[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(protect, /NEW\.recorded_at IS DISTINCT FROM OLD\.recorded_at/);
  for (const table of ["payments", "customer_ledgers", "supplier_ledgers", "payment_allocations", "allocation_reversals", "payment_reversals"]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER "${table}_protect_financial_dates"\\s+BEFORE UPDATE ON "${table}"`));
    assert.match(migration, new RegExp(`CREATE TRIGGER "${table}_assign_recorded_at"\\s+BEFORE INSERT ON "${table}"`));
  }
  const invoice = migration.match(/FUNCTION public\.guard_invoice_financial_dates\(\)[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(invoice, /NEW\.finalized_recorded_at IS DISTINCT FROM OLD\.finalized_recorded_at/);
  const refund = migration.match(/FUNCTION public\.guard_refund_financial_dates\(\)[\s\S]*?\$function\$;/)?.[0] ?? "";
  assert.match(refund, /NEW\.requested_recorded_at IS DISTINCT FROM OLD\.requested_recorded_at/);
  assert.match(refund, /NEW\.completed_recorded_at IS DISTINCT FROM OLD\.completed_recorded_at/);
  for (const table of ["sales_invoices", "purchase_invoices"]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER "${table}_guard_financial_dates"\\s+BEFORE INSERT OR UPDATE ON "${table}"`));
  }
  assert.match(migration, /CREATE TRIGGER "payment_refunds_guard_financial_dates"\s+BEFORE INSERT OR UPDATE ON "payment_refunds"/);
});

test("audit rows carry their own created_at and are not part of the recorded-time guarantee", () => {
  const audit = schema.match(/model audit_logs \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(audit, /created_at\s+DateTime\s+@default\(now\(\)\)/);
  assert.doesNotMatch(audit, /recorded_at/);
  assert.doesNotMatch(migration, /audit_logs/);
});
