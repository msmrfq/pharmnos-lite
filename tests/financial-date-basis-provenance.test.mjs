import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { validateTemporalMigration } from "../scripts/financial-e2e-provisioning-static-guard.mjs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync("prisma/migrations/0028_financial_event_dates/migration.sql", "utf8");
const baseline = fs.readFileSync("prisma/financial-e2e-schema-provisioning.generated.sql", "utf8");

function load(path, resolve) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(resolve, module, module.exports);
  return module.exports;
}

const businessDate = load("../src/lib/utils/business-date.ts", (name) => { throw new Error(`Unexpected dependency ${name}`); });
const temporal = load("../src/lib/utils/financial-temporal.ts", (name) => {
  if (name === "@/lib/utils/business-date") return businessDate;
  throw new Error(`Unexpected dependency ${name}`);
});

const BASIS_CHECKS = [
  { table: "payments", name: "payments_effective_date_basis_check", date: "effective_date", basis: "effective_date_basis" },
  { table: "customer_ledgers", name: "customer_ledgers_effective_date_basis_check", date: "effective_date", basis: "effective_date_basis" },
  { table: "supplier_ledgers", name: "supplier_ledgers_effective_date_basis_check", date: "effective_date", basis: "effective_date_basis" },
  { table: "payment_refunds", name: "payment_refunds_completed_effective_date_basis_check", date: "completed_effective_date", basis: "completed_effective_date_basis" },
];
const ALL_BASES = ["EXPLICIT", "DERIVED_FROM_OCCURRED_AT", "EVIDENCE_CLASSIFIED", "AMBIGUOUS", "UNCLASSIFIED"];

function constraintBody(sql, name) {
  const start = sql.indexOf(`ADD CONSTRAINT "${name}"`);
  assert.ok(start >= 0, `${name} is missing`);
  const rest = sql.slice(start + 1);
  const ends = [rest.indexOf("ADD CONSTRAINT"), rest.indexOf(";")].filter((index) => index >= 0);
  return rest.slice(0, Math.min(...ends)).replace(/\s+/g, " ");
}

/** Builds an evaluator from the SQL text itself, so removing a literal from the CHECK changes the result. */
function evaluator(body, { date, basis }) {
  const literal = (list) => new Set([...list.matchAll(/'([A-Z_]+)'::"FinancialDateBasis"/g)].map((match) => match[1]));
  const inList = (text) => text.match(/IN \(([^)]*)\)/)?.[1] ?? "";
  const branches = body.slice(body.indexOf("CHECK (") + 7).split(/\) OR \(/);
  assert.equal(branches.length, 3, "three-branch classification contract");
  assert.match(branches[0], new RegExp(`"${date}" IS NULL AND "${basis}" IS NULL`));
  assert.match(branches[1], new RegExp(`"${date}" IS NOT NULL AND "${basis}" IS NOT NULL`));
  assert.match(branches[2], new RegExp(`"${date}" IS NULL AND "${basis}" IS NOT NULL`));
  const withDate = literal(inList(branches[1]));
  const withoutDate = literal(inList(branches[2]));
  return (row) => (
    (row.date === null && row.basis === null) ||
    (row.date !== null && row.basis !== null && withDate.has(row.basis)) ||
    (row.date === null && row.basis !== null && withoutDate.has(row.basis))
  );
}

test("DB CHECKs accept only the four assignable shapes and reject EVIDENCE_CLASSIFIED everywhere", () => {
  for (const spec of BASIS_CHECKS) {
    for (const [label, sql] of [["migration", migration], ["baseline", baseline]]) {
      const accepts = evaluator(constraintBody(sql, spec.name), spec);
      const day = "2026-11-09";
      assert.equal(accepts({ date: null, basis: null }), true, `${spec.table} legacy NULL/NULL (${label})`);
      assert.equal(accepts({ date: day, basis: "EXPLICIT" }), true);
      assert.equal(accepts({ date: day, basis: "DERIVED_FROM_OCCURRED_AT" }), true);
      assert.equal(accepts({ date: null, basis: "AMBIGUOUS" }), true);
      assert.equal(accepts({ date: null, basis: "UNCLASSIFIED" }), true);
      for (const hasDate of [true, false]) {
        assert.equal(accepts({ date: hasDate ? day : null, basis: "EVIDENCE_CLASSIFIED" }), false, `${spec.table} EVIDENCE_CLASSIFIED rejected (${label})`);
      }
      assert.equal(accepts({ date: day, basis: "AMBIGUOUS" }), false, "an ambiguous basis cannot carry a date");
      assert.equal(accepts({ date: day, basis: "UNCLASSIFIED" }), false, "an unclassified basis cannot carry a date");
      assert.equal(accepts({ date: day, basis: null }), false, "a populated date requires a basis (missing provenance rejected)");
      assert.equal(accepts({ date: null, basis: "EXPLICIT" }), false, "an explicit basis requires a date");
      assert.equal(accepts({ date: null, basis: "DERIVED_FROM_OCCURRED_AT" }), false);
    }
  }
});

test("AMBIGUOUS, UNCLASSIFIED and legacy NULL remain three distinguishable stored states", () => {
  for (const spec of BASIS_CHECKS) {
    const accepts = evaluator(constraintBody(migration, spec.name), spec);
    const states = [
      { date: null, basis: null },
      { date: null, basis: "AMBIGUOUS" },
      { date: null, basis: "UNCLASSIFIED" },
    ];
    assert.ok(states.every(accepts));
    assert.equal(new Set(states.map((state) => String(state.basis))).size, 3);
  }
});

test("a derived basis needs a consistent genuine instant", () => {
  for (const [table, date, basis, instant] of [
    ["payments", "effective_date", "effective_date_basis", "occurred_at"],
    ["customer_ledgers", "effective_date", "effective_date_basis", "occurred_at"],
    ["supplier_ledgers", "effective_date", "effective_date_basis", "occurred_at"],
    ["payment_refunds", "completed_effective_date", "completed_effective_date_basis", "completed_occurred_at"],
  ]) {
    const requires = [...migration.matchAll(new RegExp(`ADD CONSTRAINT "${table}_derived_(?:date|completion)_requires_occurred_at_check"[\\s\\S]*?\\);`, "g"))][0]?.[0].replace(/\s+/g, " ") ?? "";
    assert.ok(requires.includes(`"${basis}" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis" OR "${instant}" IS NOT NULL`), `${table} requires an instant`);
    const matches = [...migration.matchAll(new RegExp(`ADD CONSTRAINT "${table}_derived_(?:date|completion)_matches_occurred_at_check"[\\s\\S]*?\\);`, "g"))][0]?.[0].replace(/\s+/g, " ") ?? "";
    assert.ok(matches.includes(`"${date}" = ("${instant}" AT TIME ZONE 'Asia/Kolkata')::date`), `${table} derives the IST date`);
  }
});

test("application code cannot assign EVIDENCE_CLASSIFIED, AMBIGUOUS or UNCLASSIFIED as a basis", () => {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const match of text.matchAll(/\b(?:completed_)?effective_date_basis\s*:\s*([^,\n}]+)/g)) {
        found.push([full, match[1].trim()]);
      }
    }
  };
  walk("src");
  assert.ok(found.length > 0, "expected producers to assign a basis");
  const allowed = [
    /^true$/,
    /^"EXPLICIT"$/,
    /^"DERIVED_FROM_OCCURRED_AT"$/,
    /^(?:[\w$]+\.)+effectiveDateBasis$/,
    /^[\w$.]+ \? "EXPLICIT" : "DERIVED_FROM_OCCURRED_AT"$/,
    /^(?:string|unknown|FinancialDateBasis|EffectiveDateBasis)(?: \| (?:null|undefined))*;?$/,
    // Read-back of the row that was just created (ledger-impact result mapping), not an assignment.
    /^row\.effective_date_basis \?\? null$/,
  ];
  const rejected = found.filter(([, value]) => !allowed.some((pattern) => pattern.test(value)));
  assert.deepEqual(rejected, []);
});

test("reader trust sets and the typed contract exclude every unprovable basis", () => {
  const trusted = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        for (const match of fs.readFileSync(full, "utf8").matchAll(/(?:TRUSTED_DATE_BASES|trustedDateBases)[^=]*=\s*new Set\(\[([^\]]*)\]\)/g)) {
          trusted.push(match[1].replace(/\s/g, ""));
        }
      }
    }
  };
  walk("src");
  assert.ok(trusted.length > 0);
  for (const list of trusted) assert.equal(list, '"EXPLICIT","DERIVED_FROM_OCCURRED_AT"');

  const instant = temporal.captureSystemInstant(new Date("2026-11-09T05:00:00.000Z"));
  for (const basis of ["EVIDENCE_CLASSIFIED", "AMBIGUOUS", "UNCLASSIFIED", "EXPLICIT"]) {
    assert.throws(() => temporal.resolveFinancialTemporal({ businessDate: "2026-11-09", effectiveDateBasis: basis }), /Unsupported financial temporal field/);
    assert.throws(() => temporal.resolveFinancialTemporal({ occurredAt: instant, effectiveDateBasis: basis }), /Unsupported financial temporal field/);
  }
  const produced = new Set([
    temporal.resolveFinancialTemporal({ businessDate: "2026-11-09" }).effectiveDateBasis,
    temporal.resolveFinancialTemporal({ occurredAt: instant }).effectiveDateBasis,
  ]);
  assert.deepEqual([...produced].sort(), ["DERIVED_FROM_OCCURRED_AT", "EXPLICIT"]);
});

test("the static guard flags a migration that would admit EVIDENCE_CLASSIFIED", () => {
  assert.deepEqual(validateTemporalMigration(migration, schema), []);
  const unsafe = migration.replace(
    /('AMBIGUOUS'::"FinancialDateBasis")/,
    "$1, 'EVIDENCE_CLASSIFIED'::\"FinancialDateBasis\"",
  );
  assert.notEqual(unsafe, migration);
  assert.ok(validateTemporalMigration(unsafe, schema).some((error) => error.includes("EVIDENCE_CLASSIFIED")));
});

test("basis, effective date, occurred-at and recorded time cannot be rewritten after insert", () => {
  const protect = migration.match(/FUNCTION public\.protect_financial_recorded_at\(\)[\s\S]*?\$function\$;/)?.[0].replace(/\s+/g, " ") ?? "";
  for (const fragment of [
    "NEW.recorded_at IS DISTINCT FROM OLD.recorded_at",
    "NEW.effective_date IS DISTINCT FROM OLD.effective_date",
    "NEW.occurred_at IS DISTINCT FROM OLD.occurred_at",
    "(to_jsonb(NEW) -> 'effective_date_basis') IS DISTINCT FROM (to_jsonb(OLD) -> 'effective_date_basis')",
    "ERRCODE = '42501'",
  ]) {
    assert.ok(protect.includes(fragment), `protect trigger omits ${fragment}`);
  }
  for (const table of ["payments", "customer_ledgers", "supplier_ledgers", "payment_allocations", "allocation_reversals", "payment_reversals"]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER "${table}_protect_financial_dates"\\s+BEFORE UPDATE ON "${table}"`));
  }
  const refund = migration.match(/FUNCTION public\.guard_refund_financial_dates\(\)[\s\S]*?\$function\$;/)?.[0].replace(/\s+/g, " ") ?? "";
  for (const fragment of [
    "NEW.requested_business_date IS DISTINCT FROM OLD.requested_business_date",
    "NEW.requested_occurred_at IS DISTINCT FROM OLD.requested_occurred_at",
    "OLD.status = 'COMPLETED'::public.\"FinancialRefundStatus\" AND ( NEW.completed_effective_date IS DISTINCT FROM OLD.completed_effective_date OR NEW.completed_effective_date_basis IS DISTINCT FROM OLD.completed_effective_date_basis OR NEW.completed_occurred_at IS DISTINCT FROM OLD.completed_occurred_at )",
  ]) {
    assert.ok(refund.includes(fragment), `refund guard omits ${fragment}`);
  }
  const invoice = migration.match(/FUNCTION public\.guard_invoice_financial_dates\(\)[\s\S]*?\$function\$;/)?.[0].replace(/\s+/g, " ") ?? "";
  assert.ok(invoice.includes("OLD.status = 'FINALIZED'::public.\"InvoiceStatus\" AND ( NEW.effective_date IS DISTINCT FROM OLD.effective_date OR NEW.due_date_business IS DISTINCT FROM OLD.due_date_business )"));
});

const TEMPORAL_MODELS = [
  "sales_invoices", "purchase_invoices", "payments", "customer_ledgers", "supplier_ledgers",
  "payment_allocations", "allocation_reversals", "payment_reversals", "payment_refunds",
];

test("no evidence-reference column exists, so tenant isolation of evidence references is not applicable", () => {
  // EVIDENCE_CLASSIFIED stays blocked precisely because no durable, inspectable
  // provenance record exists. If a column, table or relation for evidence is ever
  // added, this test must fail so that tenant isolation (RLS, grants, composite
  // tenant foreign keys), immutability and fixtures are designed and tested first.
  const forbiddenName = /evidence|provenance|attestation|classified_by|classification|source_ref/i;
  for (const name of TEMPORAL_MODELS) {
    const block = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, "m"))?.[1] ?? "";
    assert.ok(block, `${name} model`);
    const fields = block.split("\n").map((line) => line.trim().split(/\s+/)[0]).filter((token) => token && !token.startsWith("@") && !token.startsWith("//"));
    assert.deepEqual(fields.filter((field) => forbiddenName.test(field) && !/gst_evidence/.test(field)), [], `${name} gained an evidence-like field`);
  }
  const models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((match) => match[1]);
  assert.deepEqual(models.filter((model) => /(date|temporal|effective|ledger|payment|refund|invoice).*(evidence|provenance|attestation)|(evidence|provenance|attestation).*(date|temporal)/i.test(model)), []);

  const added = [...migration.matchAll(/ADD COLUMN "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(added.length > 0);
  assert.deepEqual(added.filter((column) => forbiddenName.test(column)), []);
  assert.deepEqual([...new Set(added)].sort(), [
    "completed_effective_date", "completed_effective_date_basis", "completed_occurred_at", "completed_recorded_at",
    "due_date_business", "effective_date", "effective_date_basis", "finalized_recorded_at",
    "occurred_at", "recorded_at", "requested_business_date", "requested_occurred_at", "requested_recorded_at",
  ]);
  assert.deepEqual([...schema.match(/enum FinancialDateBasis \{([\s\S]*?)\}/)[1].split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("//"))], ALL_BASES);
});
