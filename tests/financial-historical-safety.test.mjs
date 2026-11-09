import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");
const classifierSource = await read("../src/domain/services/financial-temporal-classification.ts");
const businessDateSource = await read("../src/lib/utils/business-date.ts");
const migrationSource = await read("../prisma/migrations/0028_financial_event_dates/migration.sql");
const schemaSource = await read("../prisma/schema.prisma");

function load(source, context) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { Date, Intl, RangeError, BigInt, ...context, exports: module.exports, module });
  return module.exports;
}

const businessDateModule = load(businessDateSource, {});
const { accountFinancialTemporalExceptions, classifyFinancialTemporalEvidence } = load(classifierSource, {
  require(specifier) {
    if (specifier === "@/lib/utils/business-date") return businessDateModule;
    throw new Error(`Unexpected classifier dependency: ${specifier}`);
  },
});

const plain = (value) => JSON.parse(JSON.stringify(value));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function evidence(value, overrides = {}) {
  return {
    value,
    evidenceRef: "doc:1",
    tenantId: "tenant-1",
    sourceId: "ledger-1",
    eventId: "event-1",
    producerVersion: "app-release-1",
    producerVerified: true,
    immutable: true,
    attestationRef: "attestation:1",
    attestationVerified: true,
    guaranteeEvidenceRef: "policy:recording-contract-1",
    ...overrides,
  };
}

function instantEvidence(value, overrides = {}) {
  return evidence(value, { timezoneContractVerified: true, ...overrides });
}

function recordingEvidence(value, guarantee, overrides = {}) {
  return evidence(value, { guarantee, ...overrides });
}

function record(overrides = {}) {
  return {
    tenantId: "tenant-1",
    sourceId: "ledger-1",
    eventId: "event-1",
    ...overrides,
  };
}

// ---- Migration 0028 ----------------------------------------------------------------------------

const migrationSql = migrationSource
  .split(/\r?\n/)
  .filter((line) => !/^\s*--/.test(line))
  .join("\n")
  .replace(/COMMENT\s+ON\s+[\s\S]*?'\s*;/gi, "");

const TYPED_COLUMNS = [
  "effective_date",
  "effective_date_basis",
  "occurred_at",
  "recorded_at",
  "due_date_business",
  "finalized_recorded_at",
  "requested_business_date",
  "requested_occurred_at",
  "requested_recorded_at",
  "completed_effective_date",
  "completed_effective_date_basis",
  "completed_occurred_at",
  "completed_recorded_at",
];
const SYSTEM_ASSIGNED_COLUMNS = new Set([
  "recorded_at",
  "finalized_recorded_at",
  "requested_recorded_at",
  "completed_recorded_at",
]);

test("migration 0028 contains no data-changing statement and therefore no historical backfill", () => {
  assert.doesNotMatch(migrationSql, /\bINSERT\s+INTO\b/i);
  assert.doesNotMatch(migrationSql, /\bUPDATE\s+["\w.]+\s+SET\b/i);
  assert.doesNotMatch(migrationSql, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migrationSql, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migrationSql, /\bCOPY\b/i);
  assert.doesNotMatch(migrationSql, /\bMERGE\s+INTO\b/i);
  assert.doesNotMatch(migrationSql, /\bSELECT\b/i);
});

test("migration 0028 never derives a typed temporal value from a legacy column or created_at", () => {
  assert.doesNotMatch(migrationSql, /\b(entry_date|payment_date|invoice_date|created_at)\b/i);
  assert.doesNotMatch(migrationSql, /\bdue_date\b/i);
  assert.doesNotMatch(migrationSql, /\bDEFAULT\b/i);
  assert.doesNotMatch(migrationSql, /\bGENERATED\b/i);
  assert.doesNotMatch(migrationSql, /\b(now|current_timestamp|statement_timestamp|transaction_timestamp)\b/i);
});

test("migration 0028 adds every typed column as nullable with no default so legacy rows stay NULL", () => {
  const added = [...migrationSql.matchAll(/ADD COLUMN\s+"(\w+)"\s+([^,;]+)/g)];
  assert.ok(added.length > 0);
  const addedNames = new Set(added.map((match) => match[1]));
  for (const column of TYPED_COLUMNS) {
    assert.ok(addedNames.has(column), `${column} is added`);
  }
  for (const [, name, type] of added) {
    assert.match(
      type.trim(),
      /^(DATE|TIMESTAMPTZ\(3\)|"FinancialDateBasis")$/,
      `${name} must be a bare nullable typed column`,
    );
  }
});

test("migration 0028 trigger assignments are limited to database-assigned recording times", () => {
  const assignments = [...migrationSql.matchAll(/NEW\.(\w+)\s*:=\s*([^;]+);/g)];
  assert.ok(assignments.length > 0);
  for (const [, column, expression] of assignments) {
    assert.ok(SYSTEM_ASSIGNED_COLUMNS.has(column), `trigger must not assign ${column}`);
    assert.equal(expression.trim(), "clock_timestamp()");
  }
  assert.doesNotMatch(
    migrationSql,
    /NEW\.(effective_date|effective_date_basis|occurred_at|due_date_business|requested_business_date|requested_occurred_at|completed_effective_date|completed_effective_date_basis|completed_occurred_at)\s*:=/,
  );
});

test("migration 0028 cannot classify history by evidence and rejects unknown or unsupported provenance", () => {
  assert.equal([...migrationSql.matchAll(/EVIDENCE_CLASSIFIED/g)].length, 1, "enum value only, never accepted by a check");
  for (const constraint of [
    "payments_effective_date_basis_check",
    "customer_ledgers_effective_date_basis_check",
    "supplier_ledgers_effective_date_basis_check",
    "payment_refunds_completed_effective_date_basis_check",
  ]) {
    assert.ok(migrationSql.includes(constraint), `${constraint} exists`);
  }
  // Legacy rows (both NULL) remain valid; AMBIGUOUS/UNCLASSIFIED never carry a date.
  assert.match(migrationSql, /"effective_date" IS NULL AND "effective_date_basis" IS NULL/);
  assert.match(migrationSql, /'AMBIGUOUS'::"FinancialDateBasis",\s*'UNCLASSIFIED'::"FinancialDateBasis"/);
});

test("recorded and effective values become immutable after write so a later update cannot backfill history", () => {
  assert.match(migrationSql, /NEW\.effective_date IS DISTINCT FROM OLD\.effective_date/);
  assert.match(migrationSql, /NEW\.occurred_at IS DISTINCT FROM OLD\.occurred_at/);
  assert.match(migrationSql, /NEW\.recorded_at IS DISTINCT FROM OLD\.recorded_at/);
  assert.match(migrationSql, /Finalized invoice business dates are immutable/);
  assert.match(migrationSql, /Completed refund financial dates are immutable/);
});

test("migration 0028 never describes recorded timestamps as commit-visible knowledge time", () => {
  const flat = migrationSource.replace(/\s*\r?\n--\s*/g, " ");
  for (const match of flat.matchAll(/commit-visible/gi)) {
    assert.match(
      flat.slice(Math.max(0, match.index - 5), match.index),
      /NOT\s$/i,
      "commit-visible may only appear in a disclaimer",
    );
  }
  for (const [statement] of migrationSource.matchAll(/COMMENT\s+ON\s+COLUMN\s+"\w+"\."\w*recorded_at"[\s\S]*?'\s*;/gi)) {
    assert.match(statement, /NOT commit-visible time/);
    assert.match(statement, /NOT proof of historical knowledge/);
  }
});

test("prisma schema keeps the legacy columns required and every typed column nullable", () => {
  const model = (name) => {
    const match = schemaSource.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
    assert.ok(match, `model ${name} exists`);
    return match[0];
  };
  const field = (block, name) => {
    const match = block.match(new RegExp(`^\\s+${name}\\s+(\\S+)`, "m"));
    assert.ok(match, `${name} exists`);
    return match[1];
  };
  assert.equal(field(model("sales_invoices"), "invoice_date"), "DateTime");
  assert.equal(field(model("purchase_invoices"), "invoice_date"), "DateTime");
  assert.equal(field(model("payments"), "payment_date"), "DateTime");
  assert.equal(field(model("customer_ledgers"), "entry_date"), "DateTime");
  assert.equal(field(model("supplier_ledgers"), "entry_date"), "DateTime");
  for (const [name, columns] of [
    ["sales_invoices", ["effective_date", "due_date_business", "finalized_recorded_at"]],
    ["purchase_invoices", ["effective_date", "due_date_business", "finalized_recorded_at"]],
    ["payments", ["effective_date", "effective_date_basis", "occurred_at", "recorded_at"]],
    ["customer_ledgers", ["effective_date", "effective_date_basis", "occurred_at", "recorded_at"]],
    ["supplier_ledgers", ["effective_date", "effective_date_basis", "occurred_at", "recorded_at"]],
    ["payment_allocations", ["effective_date", "occurred_at", "recorded_at"]],
    ["allocation_reversals", ["effective_date", "occurred_at", "recorded_at"]],
    ["payment_reversals", ["effective_date", "occurred_at", "recorded_at"]],
    ["payment_refunds", ["requested_business_date", "requested_occurred_at", "requested_recorded_at",
      "completed_effective_date", "completed_effective_date_basis", "completed_occurred_at", "completed_recorded_at"]],
  ]) {
    const block = model(name);
    for (const column of columns) {
      assert.match(field(block, column), /\?$/, `${name}.${column} must be nullable`);
    }
  }
});

// ---- Classifier is evidence-only ---------------------------------------------------------------

test("classifier source reads no legacy column, created_at, host clock or host-local date getter", () => {
  const code = classifierSource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
  assert.doesNotMatch(code, /\b(entry_date|payment_date|invoice_date|due_date|created_at)\b/);
  assert.doesNotMatch(code, /Date\.now\(|new Date\(\s*\)|getTimezoneOffset|toLocale|\.getHours|\.getDate\(|\.getMonth|\.getFullYear|process\.env/);
});

test("timezone-less legacy values are never promoted, even with every verification flag set", () => {
  const legacyInstants = [
    "2026-11-09T00:00:00",
    "2026-11-09T00:00:00.000",
    "2026-11-09T18:30:00",
    "2026-11-09 18:30:00",
    "2026-11-09 18:30:00+05:30",
    "2026-11-09",
    "2026-11-09T24:00:00Z",
    "2026-11-09T18:30:00+0530",
    "1731177000000",
  ];
  const legacyBusinessDates = [
    "2026-11-09T00:00:00",
    "2026-11-09T00:00:00.000Z",
    "09/11/2026",
    "2026-11-09 ",
    "2026-02-30",
  ];
  for (const value of legacyInstants) {
    const result = classifyFinancialTemporalEvidence(record({
      eventInstant: [instantEvidence(value)],
      recordingTime: [recordingEvidence(value, "commit-visible")],
    }));
    for (const dimension of ["eventInstant", "recordingTime"]) {
      assert.equal(result[dimension].status, "unknown", `${dimension} ${JSON.stringify(value)}`);
      assert.equal(result[dimension].value, null);
      assert.deepEqual(plain(result[dimension].reasonCodes), ["invalid_temporal_value"]);
      assert.deepEqual(plain(result[dimension].evidenceRefs), ["doc:1"]);
    }
  }
  for (const value of legacyBusinessDates) {
    const result = classifyFinancialTemporalEvidence(record({ businessDate: [evidence(value)] }));
    assert.equal(result.businessDate.status, "unknown", JSON.stringify(value));
    assert.equal(result.businessDate.value, null);
    assert.deepEqual(plain(result.businessDate.reasonCodes), ["invalid_temporal_value"]);
  }
});

test("a midnight-looking or created_at-labelled value is not a business date, instant or knowledge time", () => {
  const result = classifyFinancialTemporalEvidence(record({
    eventInstant: [instantEvidence("2026-11-09T00:00:00Z", { timezoneContractVerified: false })],
    recordingTime: [recordingEvidence("2026-11-09T00:00:00Z", "commit-visible", {
      evidenceRef: "column:created_at",
      attestationVerified: false,
    })],
  }));

  assert.equal(result.businessDate.status, "unknown");
  assert.deepEqual(plain(result.businessDate.reasonCodes), ["no_evidence"]);
  assert.equal(result.eventInstant.status, "unknown");
  assert.deepEqual(plain(result.eventInstant.reasonCodes), ["timezone_contract_not_verified"]);
  assert.equal(result.recordingTime.status, "unknown");
  assert.deepEqual(plain(result.recordingTime.reasonCodes), ["trusted_attestation_not_verified"]);
});

test("a proven business date or instant does not establish knowledge time, and vice versa", () => {
  const dateOnly = classifyFinancialTemporalEvidence(record({
    businessDate: [evidence("2026-11-01")],
    eventInstant: [instantEvidence("2026-11-01T10:00:00+05:30")],
  }));
  assert.equal(dateOnly.businessDate.status, "classified");
  assert.equal(dateOnly.eventInstant.status, "classified");
  assert.equal(dateOnly.recordingTime.status, "unknown");
  assert.deepEqual(plain(dateOnly.recordingTime.reasonCodes), ["no_evidence"]);

  const recordingOnly = classifyFinancialTemporalEvidence(record({
    recordingTime: [recordingEvidence("2026-11-09T10:00:00Z", "commit-visible")],
  }));
  assert.equal(recordingOnly.recordingTime.status, "classified");
  assert.equal(recordingOnly.businessDate.status, "unknown");
  assert.equal(recordingOnly.eventInstant.status, "unknown");
});

test("ambiguous and conflicting evidence stays unclassified with preserved originals and reason codes", () => {
  const original = deepFreeze(record({
    businessDate: [
      evidence("2026-11-09", { evidenceRef: "doc:a" }),
      evidence("2026-11-10", { evidenceRef: "doc:b" }),
    ],
    eventInstant: [
      instantEvidence("2026-11-09T18:30:00Z", { evidenceRef: "instant:a" }),
      instantEvidence("2026-11-09T18:30:01Z", { evidenceRef: "instant:b" }),
    ],
    recordingTime: [
      recordingEvidence("2026-11-10T01:00:00Z", "transaction-time", { evidenceRef: "rec:a" }),
      recordingEvidence("2026-11-10T01:00:00Z", "commit-visible", {
        evidenceRef: "rec:b",
        producerVerified: false,
      }),
    ],
  }));
  const before = JSON.stringify(original);
  const result = classifyFinancialTemporalEvidence(original);

  assert.equal(JSON.stringify(original), before, "input evidence is never rewritten");
  assert.deepEqual(plain(result.businessDate), {
    status: "conflict",
    value: null,
    evidenceRefs: ["doc:a", "doc:b"],
    reasonCodes: ["conflicting_values"],
  });
  assert.deepEqual(plain(result.eventInstant), {
    status: "conflict",
    value: null,
    evidenceRefs: ["instant:a", "instant:b"],
    reasonCodes: ["conflicting_values"],
  });
  // Same instant, one unverified claim of commit visibility: the unverified claim is not promoted.
  assert.equal(result.recordingTime.status, "classified");
  assert.deepEqual(plain(result.recordingTime.value), {
    instant: "2026-11-10T01:00:00.000Z",
    guarantee: "transaction-time",
  });
  assert.deepEqual(plain(result.recordingTime.evidenceRefs), ["rec:a"]);
});

test("equivalent instants in different offsets agree, but a different instant never silently wins", () => {
  const agree = classifyFinancialTemporalEvidence(record({
    eventInstant: [
      instantEvidence("2026-11-09T18:30:00Z", { evidenceRef: "utc" }),
      instantEvidence("2026-11-10T00:00:00+05:30", { evidenceRef: "ist" }),
    ],
  }));
  assert.equal(agree.eventInstant.status, "classified");
  assert.equal(agree.eventInstant.value, "2026-11-09T18:30:00.000Z");

  const disagree = classifyFinancialTemporalEvidence(record({
    eventInstant: [
      instantEvidence("2026-11-09T18:30:00Z", { evidenceRef: "utc" }),
      instantEvidence("2026-11-10T00:00:00Z", { evidenceRef: "misread-ist" }),
    ],
  }));
  assert.equal(disagree.eventInstant.status, "conflict");
  assert.equal(disagree.eventInstant.value, null);
});

test("another tenant's or row's evidence is never accepted or echoed", () => {
  for (const mismatch of [{ tenantId: "tenant-2" }, { sourceId: "ledger-2" }, { eventId: "event-2" }]) {
    const result = classifyFinancialTemporalEvidence(record({
      businessDate: [
        evidence("2026-11-09", { evidenceRef: "doc:own" }),
        evidence("2026-11-12", { evidenceRef: "doc:foreign", ...mismatch }),
      ],
    }));
    assert.equal(result.businessDate.status, "unknown");
    assert.deepEqual(plain(result.businessDate.evidenceRefs), ["doc:own"]);
    assert.ok(result.businessDate.reasonCodes.includes("evidence_identity_mismatch"));
  }
});

test("late-recorded backdated, unknown-recording and unverified-recording events remain distinguishable", () => {
  const proven = {
    businessDate: [evidence("2026-11-01")],
    eventInstant: [instantEvidence("2026-11-01T10:00:00+05:30")],
  };
  const lateRecorded = classifyFinancialTemporalEvidence(record({
    ...proven,
    recordingTime: [recordingEvidence("2026-11-09T10:00:00+05:30", "transaction-time")],
  }));
  const unknownRecording = classifyFinancialTemporalEvidence(record(proven));
  const unverifiedRecording = classifyFinancialTemporalEvidence(record({
    ...proven,
    recordingTime: [recordingEvidence("2026-11-09T10:00:00+05:30", "commit-visible", { producerVerified: false })],
  }));

  for (const result of [lateRecorded, unknownRecording, unverifiedRecording]) {
    assert.equal(result.businessDate.status, "classified");
    assert.equal(result.businessDate.value, "2026-11-01");
    assert.equal(result.eventInstant.value, "2026-11-01T04:30:00.000Z");
  }

  assert.equal(lateRecorded.recordingTime.status, "classified");
  assert.deepEqual(plain(lateRecorded.recordingTime.value), {
    instant: "2026-11-09T04:30:00.000Z",
    guarantee: "transaction-time",
  });
  assert.ok(lateRecorded.recordingTime.value.instant.slice(0, 10) > lateRecorded.businessDate.value);

  assert.equal(unknownRecording.recordingTime.status, "unknown");
  assert.deepEqual(plain(unknownRecording.recordingTime.reasonCodes), ["no_evidence"]);
  assert.equal(unverifiedRecording.recordingTime.status, "unknown");
  assert.deepEqual(plain(unverifiedRecording.recordingTime.reasonCodes), ["producer_not_verified"]);

  const outputs = [lateRecorded, unknownRecording, unverifiedRecording].map((result) => JSON.stringify(result.recordingTime));
  assert.equal(new Set(outputs).size, 3);
});

test("a pre-commit recording label is reported as such and never upgraded to commit-visible", () => {
  const result = classifyFinancialTemporalEvidence(record({
    recordingTime: [
      recordingEvidence("2026-11-09T10:00:00Z", "application-accepted", { evidenceRef: "rec:app" }),
      recordingEvidence("2026-11-09T10:00:00Z", "transaction-time", { evidenceRef: "rec:txn" }),
    ],
  }));

  assert.equal(result.recordingTime.status, "classified");
  assert.equal(result.recordingTime.value.guarantee, "transaction-time");
  assert.notEqual(result.recordingTime.value.guarantee, "commit-visible");
});

// ---- Dry-run determinism -----------------------------------------------------------------------

function populationRow(rowId, debit, credit, evidenceOverrides) {
  return {
    ...record({ sourceId: `ledger-${rowId}`, eventId: `event-${rowId}` }),
    rowId,
    debit,
    credit,
    ...evidenceOverrides(rowId),
  };
}

function buildPopulation() {
  const own = (rowId, value, overrides = {}) => evidence(value, {
    sourceId: `ledger-${rowId}`,
    eventId: `event-${rowId}`,
    evidenceRef: `doc:${rowId}`,
    ...overrides,
  });
  const instant = (rowId, value, overrides = {}) => own(rowId, value, { timezoneContractVerified: true, ...overrides });
  const recording = (rowId, value, guarantee, overrides = {}) => own(rowId, value, { guarantee, ...overrides });
  return [
    populationRow("r1", "100.00", "0.00", (id) => ({
      businessDate: [own(id, "2026-11-01")],
      eventInstant: [instant(id, "2026-11-01T10:00:00+05:30")],
      recordingTime: [recording(id, "2026-11-01T10:00:05+05:30", "commit-visible")],
    })),
    populationRow("r2", "0.00", "40.10", (id) => ({
      businessDate: [own(id, "2026-11-01")],
      recordingTime: [
        recording(id, "2026-11-09T10:00:00Z", "application-accepted", { evidenceRef: "doc:r2:a" }),
        recording(id, "2026-11-09T10:00:00Z", "transaction-time", { evidenceRef: "doc:r2:b" }),
      ],
    })),
    populationRow("r3", "12.34", "0.00", (id) => ({
      businessDate: [own(id, "2026-11-02", { evidenceRef: "doc:r3:a" }), own(id, "2026-11-03", { evidenceRef: "doc:r3:b" })],
    })),
    populationRow("r4", "0.00", "7.07", (id) => ({
      eventInstant: [instant(id, "2026-11-02T18:00:00")],
      recordingTime: [recording(id, "2026-11-02", "commit-visible")],
    })),
    populationRow("r5", "999999999999.99", "0.01", () => ({})),
    populationRow("r6", "5.55", "5.55", (id) => ({
      businessDate: [own(id, "2026-11-04"), own(id, "2026-11-04", { evidenceRef: "doc:r6:dup" })],
      eventInstant: [
        instant(id, "2026-11-04T00:00:00+05:30", { evidenceRef: "doc:r6:ist" }),
        instant(id, "2026-11-03T18:30:00Z", { evidenceRef: "doc:r6:utc" }),
      ],
    })),
    populationRow("r7", "1.01", "0.00", (id) => ({
      businessDate: [own(id, "2026-11-05", { tenantId: "tenant-2" })],
    })),
  ];
}

function seededShuffle(items, seed) {
  const copy = [...items];
  let state = seed;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swap = state % (index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function reorderEvidence(row, seed) {
  const next = { ...row };
  for (const key of ["businessDate", "eventInstant", "recordingTime"]) {
    if (row[key]) next[key] = seededShuffle(row[key], seed);
  }
  return next;
}

test("dry-run classification is repeatable and independent of row and evidence order", () => {
  const population = deepFreeze(buildPopulation());
  const baseline = plain(accountFinancialTemporalExceptions(population));

  assert.deepEqual(plain(accountFinancialTemporalExceptions(population)), baseline);
  assert.deepEqual(plain(accountFinancialTemporalExceptions([...population].reverse())), baseline);
  for (const seed of [1, 7, 42, 2026, 110926]) {
    const shuffled = seededShuffle(population, seed).map((row) => reorderEvidence(row, seed + 1));
    assert.deepEqual(plain(accountFinancialTemporalExceptions(shuffled)), baseline, `seed ${seed}`);
    for (const row of shuffled) {
      const original = population.find((candidate) => candidate.rowId === row.rowId);
      assert.deepEqual(
        plain(classifyFinancialTemporalEvidence(row)),
        plain(classifyFinancialTemporalEvidence(original)),
        `${row.rowId} seed ${seed}`,
      );
    }
  }
});

test("dry-run output does not depend on the host timezone", () => {
  const population = buildPopulation();
  const originalTimezone = process.env.TZ;
  try {
    const outputs = [];
    for (const timezone of ["Asia/Kolkata", "UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      process.env.TZ = timezone;
      outputs.push(JSON.stringify(accountFinancialTemporalExceptions(population)));
    }
    assert.equal(new Set(outputs).size, 1);
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("dry-run exception accounting counts each unclassified row once with exact amounts", () => {
  const result = plain(accountFinancialTemporalExceptions(buildPopulation()));

  // r1 is fully classified; every other row is an exception in at least one dimension.
  assert.deepEqual(result.total, {
    rows: 7,
    debit: "1000000000118.89",
    credit: "52.73",
    signed: "1000000000066.16",
  });
  assert.deepEqual(result.exceptions, {
    rows: 6,
    debit: "1000000000018.89",
    credit: "52.73",
    signed: "999999999966.16",
  });
  assert.equal(result.exceptions.rows + 1, result.total.rows);

  const { businessDate, eventInstant, recordingTime } = result.byDimension;
  for (const dimension of [businessDate, eventInstant, recordingTime]) {
    const rows = dimension.classified.rows + dimension.unknown.rows + dimension.conflict.rows;
    assert.equal(rows, result.total.rows, "each row lands in exactly one status per dimension");
  }
  assert.equal(businessDate.conflict.rows, 1, "r3 has conflicting business dates");
  assert.equal(businessDate.conflict.debit, "12.34");
  assert.equal(businessDate.classified.rows, 3, "r1, r2 and r6 have a proven business date");
  assert.equal(recordingTime.classified.rows, 2, "r1 and r2 have verified recording evidence");
  assert.equal(recordingTime.unknown.rows, 5);
  assert.equal(eventInstant.classified.rows, 2, "r1 and r6 have a verified zoned instant");
});

test("dry-run never mutates frozen evidence and rejects duplicate row identities rather than double counting", () => {
  const population = deepFreeze(buildPopulation());
  const snapshot = JSON.stringify(population);
  accountFinancialTemporalExceptions(population);
  assert.equal(JSON.stringify(population), snapshot);

  assert.throws(
    () => accountFinancialTemporalExceptions([...population, population[0]]),
    /unique, non-empty row IDs/,
  );
});
