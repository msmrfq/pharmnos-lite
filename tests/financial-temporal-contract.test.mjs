import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function load(path, resolve) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(resolve, module, module.exports);
  return module.exports;
}

const businessDate = load("../src/lib/utils/business-date.ts", (name) => {
  throw new Error(`Unexpected dependency ${name}`);
});
const temporal = load("../src/lib/utils/financial-temporal.ts", (name) => {
  if (name === "@/lib/utils/business-date") return businessDate;
  throw new Error(`Unexpected dependency ${name}`);
});
const { resolveFinancialTemporal, captureSystemInstant, ledgerTemporalFields, paymentTemporalFields, eventTemporalFields } = temporal;

if (process.env.FINANCIAL_TEMPORAL_CHILD === "1") {
  const dateOnly = resolveFinancialTemporal({ businessDate: "2026-11-09" });
  const instant = resolveFinancialTemporal({ occurredAt: captureSystemInstant(new Date("2026-11-09T18:30:00.000Z")) });
  process.stdout.write(JSON.stringify({
    dateOnly: [dateOnly.effectiveDate.toISOString(), dateOnly.effectiveDateBasis, dateOnly.occurredAt],
    instant: [instant.effectiveDate.toISOString(), instant.effectiveDateBasis, instant.occurredAt.toISOString()],
  }));
} else {
  test("date-only input round-trips unchanged with no invented instant", () => {
    for (const value of ["2024-02-29", "2026-12-31", "2027-01-01", "2026-11-09"]) {
      const resolved = resolveFinancialTemporal({ businessDate: value });
      assert.equal(resolved.effectiveBusinessDate, value);
      assert.equal(resolved.effectiveDate.toISOString(), `${value}T00:00:00.000Z`);
      assert.equal(resolved.effectiveDateBasis, "EXPLICIT");
      assert.equal(resolved.occurredAt, null);
      assert.equal(resolved.legacyTimestamp.toISOString(), `${value}T00:00:00.000Z`);
    }
  });

  test("a genuine instant derives its IST date at UTC/IST boundaries", () => {
    const cases = [
      ["2026-11-09T18:29:59.999Z", "2026-11-09"],
      ["2026-11-09T18:30:00.000Z", "2026-11-10"],
      ["2026-12-31T18:30:00.000Z", "2027-01-01"],
      ["2024-02-28T18:30:00.000Z", "2024-02-29"],
      ["2026-11-09T00:00:00.000Z", "2026-11-09"],
    ];
    for (const [iso, expected] of cases) {
      const resolved = resolveFinancialTemporal({ occurredAt: captureSystemInstant(new Date(iso)) });
      assert.equal(resolved.effectiveBusinessDate, expected, iso);
      assert.equal(resolved.effectiveDateBasis, "DERIVED_FROM_OCCURRED_AT");
      assert.equal(resolved.occurredAt.toISOString(), iso);
      assert.equal(resolved.legacyTimestamp.toISOString(), iso);
    }
  });

  test("the same semantics hold across host timezones", () => {
    const expected = {
      dateOnly: ["2026-11-09T00:00:00.000Z", "EXPLICIT", null],
      instant: ["2026-11-10T00:00:00.000Z", "DERIVED_FROM_OCCURRED_AT", "2026-11-09T18:30:00.000Z"],
    };
    for (const zone of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        env: { ...process.env, TZ: zone, FINANCIAL_TEMPORAL_CHILD: "1" },
      });
      assert.equal(result.status, 0, `${zone}: ${result.stderr}`);
      assert.deepEqual(JSON.parse(result.stdout), expected, zone);
    }
  });

  test("ambiguous, conflicting, missing and malformed inputs are rejected", () => {
    const instant = captureSystemInstant(new Date("2026-11-09T05:00:00.000Z"));
    const rejected = [
      undefined,
      null,
      {},
      new Date("2026-11-09T00:00:00.000Z"),
      { businessDate: "2026-11-09", occurredAt: instant },
      { businessDate: undefined, occurredAt: undefined },
      { entry_date: new Date("2026-11-09T00:00:00.000Z") },
      { businessDate: "2026-11-09", entry_date: new Date() },
      { businessDate: new Date("2026-11-09T00:00:00.000Z") },
      { businessDate: "2026-02-29" },
      { businessDate: "2026-11-09T00:00:00Z" },
      { businessDate: " 2026-11-09" },
      { businessDate: "0000-01-01" },
      { occurredAt: "2026-11-09T05:00:00.000Z" },
      { occurredAt: new Date(NaN) },
    ];
    for (const input of rejected) {
      assert.throws(() => resolveFinancialTemporal(input), (error) => error instanceof TypeError || error instanceof RangeError, JSON.stringify(input));
    }
    assert.throws(() => captureSystemInstant(new Date(NaN)), RangeError);
    assert.throws(() => captureSystemInstant("2026-11-09"), RangeError);
  });

  test("resolution does not alias or mutate the caller's instant", () => {
    const instant = captureSystemInstant(new Date("2026-11-09T05:00:00.000Z"));
    const resolved = resolveFinancialTemporal({ occurredAt: instant });
    assert.notEqual(resolved.occurredAt, instant);
    resolved.occurredAt.setTime(0);
    assert.equal(instant.toISOString(), "2026-11-09T05:00:00.000Z");
  });

  test("column mappers keep effective date, instant and legacy value independent", () => {
    const dateOnly = resolveFinancialTemporal({ businessDate: "2026-11-09" });
    assert.deepEqual(
      Object.keys(ledgerTemporalFields(dateOnly)).sort(),
      ["effective_date", "effective_date_basis", "entry_date", "occurred_at"],
    );
    assert.equal(ledgerTemporalFields(dateOnly).occurred_at, null);
    assert.equal(paymentTemporalFields(dateOnly).payment_date.toISOString(), "2026-11-09T00:00:00.000Z");
    assert.throws(() => eventTemporalFields(dateOnly), TypeError);
    const instant = resolveFinancialTemporal({ occurredAt: captureSystemInstant(new Date("2026-11-09T19:00:00.000Z")) });
    assert.equal(eventTemporalFields(instant).effective_date.toISOString(), "2026-11-10T00:00:00.000Z");
    assert.equal(eventTemporalFields(instant).occurred_at.toISOString(), "2026-11-09T19:00:00.000Z");
  });
}