import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/domain/services/financial-temporal-classification.ts", import.meta.url),
  "utf8",
);
const businessDateSource = await readFile(
  new URL("../src/lib/utils/business-date.ts", import.meta.url),
  "utf8",
);
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const businessDateJavaScript = ts.transpileModule(businessDateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const businessDateModule = { exports: {} };
vm.runInNewContext(businessDateJavaScript, {
  Date,
  Intl,
  exports: businessDateModule.exports,
  module: businessDateModule,
});
const testModule = { exports: {} };
vm.runInNewContext(javascript, {
  Date,
  RangeError,
  BigInt,
  exports: testModule.exports,
  module: testModule,
  require(specifier) {
    if (specifier === "@/lib/utils/business-date") return businessDateModule.exports;
    throw new Error(`Unexpected classifier dependency: ${specifier}`);
  },
});
const {
  accountFinancialTemporalExceptions,
  classifyFinancialTemporalEvidence,
  FINANCIAL_TEMPORAL_CLASSIFICATION_RULE_VERSION,
} = testModule.exports;

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function evidence(value, overrides = {}) {
  return {
    value,
    evidenceRef: "doc:invoice-1",
    tenantId: "tenant-1",
    sourceId: "ledger-1",
    eventId: "event-1",
    producerVersion: "app-release-1",
    producerVerified: true,
    immutable: true,
    attestationRef: "attestation:review-1",
    attestationVerified: true,
    guaranteeEvidenceRef: "policy:recording-contract-1",
    ...overrides,
  };
}

function record(overrides = {}) {
  return {
    tenantId: "tenant-1",
    sourceId: "ledger-1",
    eventId: "event-1",
    businessDate: [evidence("2026-11-09")],
    eventInstant: [evidence("2026-11-09T18:00:00Z", { timezoneContractVerified: true })],
    recordingTime: [
      evidence("2026-11-10T01:00:00+05:30", { guarantee: "application-accepted" }),
    ],
    ...overrides,
  };
}

test("classifies dates, event instants, and recording guarantees independently", () => {
  const result = classifyFinancialTemporalEvidence(record({
    eventInstant: undefined,
    recordingTime: undefined,
  }));

  assert.equal(result.ruleVersion, FINANCIAL_TEMPORAL_CLASSIFICATION_RULE_VERSION);
  assert.deepEqual(plain(result.businessDate), {
    status: "classified",
    value: "2026-11-09",
    evidenceRefs: ["doc:invoice-1"],
    reasonCodes: [],
  });
  assert.equal(result.eventInstant.status, "unknown");
  assert.equal(result.recordingTime.status, "unknown");
});

test("conflicting source values block classification and preserve conflict evidence references", () => {
  const result = classifyFinancialTemporalEvidence(record({
    businessDate: [
      evidence("2026-11-09", { evidenceRef: "doc:one" }),
      evidence("2026-11-10", { evidenceRef: "doc:two", producerVerified: false }),
    ],
  }));

  assert.deepEqual(plain(result.businessDate), {
    status: "conflict",
    value: null,
    evidenceRefs: ["doc:one", "doc:two"],
    reasonCodes: ["conflicting_values"],
  });
});

test("does not promote unsupported or timezone-less legacy evidence", () => {
  const result = classifyFinancialTemporalEvidence(record({
    businessDate: [evidence("2026-11-09", { immutable: false })],
    eventInstant: [evidence("2026-11-09T18:00:00", { timezoneContractVerified: true })],
    recordingTime: [evidence("2026-11-10T01:00:00Z", { guarantee: "transaction-time", producerVerified: false })],
  }));

  assert.equal(result.businessDate.status, "unknown");
  assert.deepEqual(plain(result.businessDate.reasonCodes), ["evidence_not_immutable"]);
  assert.equal(result.eventInstant.status, "unknown");
  assert.deepEqual(plain(result.eventInstant.reasonCodes), ["invalid_temporal_value"]);
  assert.equal(result.recordingTime.status, "unknown");
  assert.deepEqual(plain(result.recordingTime.reasonCodes), ["producer_not_verified"]);
});

test("requires valid zoned timestamps and an explicitly supported recording guarantee", () => {
  const result = classifyFinancialTemporalEvidence(record({
    eventInstant: [
      evidence("2026-02-31T12:00:00Z", { timezoneContractVerified: true }),
    ],
    recordingTime: [
      evidence("2026-11-10T01:00:00Z", { guarantee: "toString" }),
    ],
  }));

  assert.equal(result.eventInstant.status, "unknown");
  assert.deepEqual(plain(result.eventInstant.reasonCodes), ["invalid_temporal_value"]);
  assert.equal(result.recordingTime.status, "unknown");
  assert.deepEqual(plain(result.recordingTime.reasonCodes), ["recording_guarantee_not_verified"]);
});

test("reuses the strict business-date parser and rejects year zero", () => {
  const result = classifyFinancialTemporalEvidence(record({
    businessDate: [evidence("0000-01-01")],
    eventInstant: [
      evidence("0000-01-01T00:00:00Z", { timezoneContractVerified: true }),
    ],
  }));

  assert.equal(result.businessDate.status, "unknown");
  assert.equal(result.eventInstant.status, "unknown");
});

test("requires explicit trusted-attestation and recording-guarantee evidence", () => {
  const result = classifyFinancialTemporalEvidence(record({
    businessDate: [evidence("2026-11-09", { attestationVerified: false })],
    recordingTime: [
      evidence("2026-11-10T01:00:00Z", {
        guarantee: "commit-visible",
        guaranteeEvidenceRef: "",
      }),
    ],
  }));

  assert.deepEqual(plain(result.businessDate.reasonCodes), ["trusted_attestation_not_verified"]);
  assert.deepEqual(plain(result.recordingTime.reasonCodes), ["recording_guarantee_evidence_missing"]);
});

test("does not infer business date from event instant or recording time", () => {
  const result = classifyFinancialTemporalEvidence(record({ businessDate: undefined }));

  assert.equal(result.businessDate.status, "unknown");
  assert.equal(result.eventInstant.value, "2026-11-09T18:00:00.000Z");
  assert.equal(result.recordingTime.value.instant, "2026-11-09T19:30:00.000Z");
  assert.equal(result.recordingTime.value.guarantee, "application-accepted");
});

test("requires row identity before accepting matching evidence", () => {
  const result = classifyFinancialTemporalEvidence(record({ tenantId: "" }));

  assert.equal(result.businessDate.status, "unknown");
  assert.deepEqual(plain(result.businessDate.reasonCodes), [
    "evidence_identity_mismatch",
    "record_identity_missing",
  ]);
});

test("uses explicit Asia/Kolkata conversion rules identically across host timezones", () => {
  const originalTimezone = process.env.TZ;
  try {
    const outputs = [];
    for (const timezone of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
      process.env.TZ = timezone;
      outputs.push(classifyFinancialTemporalEvidence(record({
        eventInstant: [
          evidence("2026-11-09T18:00:00Z", {
            timezoneContractVerified: true,
            evidenceRef: `instant:${timezone}`,
          }),
        ],
      })).eventInstant.value);
    }
    assert.deepEqual(outputs, Array(3).fill("2026-11-09T18:00:00.000Z"));
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test("exception accounting is exact, deterministic, and counts a row once across unknown dimensions", () => {
  const rows = [
    { ...record(), rowId: "row-1", debit: "999999999999.99", credit: "0.01" },
    {
      ...record({ businessDate: undefined, eventInstant: undefined, recordingTime: undefined }),
      rowId: "row-2",
      debit: "12.34",
      credit: "25.67",
    },
  ];
  const first = accountFinancialTemporalExceptions(rows);
  const second = accountFinancialTemporalExceptions([...rows].reverse());

  assert.deepEqual(plain(first), plain(second));
  assert.deepEqual(plain(first.total), {
    rows: 2,
    debit: "1000000000012.33",
    credit: "25.68",
    signed: "999999999986.65",
  });
  assert.deepEqual(plain(first.exceptions), {
    rows: 1,
    debit: "12.34",
    credit: "25.67",
    signed: "-13.33",
  });
  assert.deepEqual(plain(first.byDimension.businessDate.unknown), {
    rows: 1,
    debit: "12.34",
    credit: "25.67",
    signed: "-13.33",
  });
  assert.deepEqual(plain(first.byDimension.eventInstant.unknown), plain(first.exceptions));
});

test("rejects duplicate accounting rows and amounts outside ledger precision", () => {
  assert.throws(() => accountFinancialTemporalExceptions([
    { ...record(), rowId: "duplicate", debit: "1.00", credit: "0.00" },
    { ...record(), rowId: "duplicate", debit: "1.00", credit: "0.00" },
  ]), /unique, non-empty row IDs/);
  assert.throws(() => accountFinancialTemporalExceptions([
    { ...record(), rowId: "bad-money", debit: "0.005", credit: "0.00" },
  ]), /at most two places/);
});

test("accepts only literal true verification flags and string values from untyped callers", () => {
  const result = classifyFinancialTemporalEvidence(record({
    businessDate: [evidence("2026-11-09", { producerVerified: "false" })],
    eventInstant: [
      evidence(new Date("2026-11-09T18:00:00Z"), { timezoneContractVerified: true }),
      null,
    ],
    recordingTime: [
      evidence("2026-11-10T01:00:00Z", { guarantee: "commit-visible", immutable: 1 }),
    ],
  }));

  assert.equal(result.businessDate.status, "unknown");
  assert.deepEqual(plain(result.businessDate.reasonCodes), ["producer_not_verified"]);
  assert.equal(result.eventInstant.status, "unknown");
  assert.equal(result.eventInstant.value, null);
  assert.equal(result.recordingTime.status, "unknown");
  assert.deepEqual(plain(result.recordingTime.reasonCodes), ["evidence_not_immutable"]);
  assert.throws(() => accountFinancialTemporalExceptions([
    { ...record(), rowId: "numeric-money", debit: 5, credit: "0.00" },
  ]), /at most two places/);
});

test("foreign-tenant evidence is neither accepted nor allowed to leak its reference or force a conflict", () => {
  const result = classifyFinancialTemporalEvidence(record({
    businessDate: [
      evidence("2026-11-09", { evidenceRef: "doc:own" }),
      evidence("2026-11-10", { evidenceRef: "doc:other-tenant", tenantId: "tenant-2" }),
    ],
  }));

  assert.equal(result.businessDate.status, "unknown");
  assert.equal(result.businessDate.value, null);
  assert.deepEqual(plain(result.businessDate.evidenceRefs), ["doc:own"]);
  assert.deepEqual(plain(result.businessDate.reasonCodes), ["evidence_identity_mismatch"]);
});
