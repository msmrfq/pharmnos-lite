import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const source = readFileSync(new URL("../src/lib/utils/business-date.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { parseBusinessDate, businessDateToPrismaDate, businessDateFromPrismaDate, businessDateToday } = module.exports;

if (process.env.BUSINESS_DATE_ADAPTER_CHILD === "1") {
  const dates = ["2024-02-29", "2026-12-31", "2027-01-01"];
  process.stdout.write(JSON.stringify({
    roundTrips: dates.map((date) => businessDateFromPrismaDate(businessDateToPrismaDate(parseBusinessDate(date)))),
    boundaries: ["2026-11-09T18:29:59.999Z", "2026-11-09T18:30:00.000Z"].map(
      (instant) => businessDateToday(new Date(instant)),
    ),
  }));
} else {
  test("business date adapter round-trips and uses IST independently of host timezone", () => {
    const expected = {
      roundTrips: ["2024-02-29", "2026-12-31", "2027-01-01"],
      boundaries: ["2026-11-09", "2026-11-10"],
    };
    for (const zone of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        encoding: "utf8",
        env: { ...process.env, TZ: zone, BUSINESS_DATE_ADAPTER_CHILD: "1" },
      });
      assert.equal(result.status, 0, `${zone}: ${result.stderr}`);
      assert.deepEqual(JSON.parse(result.stdout), expected, zone);
    }
  });

  test("business date rejects invalid dates, timestamp inputs and noncanonical strings", () => {
    for (const value of ["0000-01-01", "2026-02-29", "2026-04-31", "2026-13-01", " 2026-11-09", "2026-11-09T00:00:00Z"]) {
      assert.throws(() => parseBusinessDate(value), RangeError, value);
    }
  });

  test("Prisma date adapter rejects genuine instants rather than silently truncating", () => {
    assert.throws(() => businessDateFromPrismaDate(new Date("2026-11-09T18:30:00.000Z")), RangeError);
    assert.throws(() => businessDateFromPrismaDate(new Date(NaN)), RangeError);
  });
}
