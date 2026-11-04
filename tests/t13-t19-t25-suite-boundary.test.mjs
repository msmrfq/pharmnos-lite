import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const t13Runner = fs.readFileSync("scripts/gstin-verification-test.cjs", "utf8");
const t25Runner = fs.readFileSync("scripts/gst-calculator-test.cjs", "utf8");
const t13Suite = fs.readFileSync("tests/gstin-verification.test.ts", "utf8");
const t25Suite = fs.readFileSync("tests/gst-calculator.test.ts", "utf8");
const t19Runner = fs.readFileSync("scripts/purchase-gst-application-acceptance.cjs", "utf8");

test("T13 has a dedicated GSTIN suite, command, and evidence path", () => {
  assert.equal(packageJson.scripts["test:t13:gstin"], "node scripts/gstin-verification-test.cjs");
  assert.match(t13Runner, /functionId: "DGM-T13"/);
  assert.match(t13Runner, /gstin-verification\.test\.ts/);
  assert.match(t13Runner, /sourceFiles:\s*\[/);
  assert.match(t13Runner, /T13_EVIDENCE_FILE/);
  assert.match(t13Suite, /DGM-T13: exactly 15 GSTIN characters/);
  assert.doesNotMatch(t25Suite, /DGM-T13/);
});

test("T19 owns purchase revision-safety execution and evidence metadata", () => {
  assert.equal(
    packageJson.scripts["test:t19:purchase-gst"],
    "node scripts/purchase-gst-application-acceptance.cjs",
  );
  assert.match(t19Runner, /function: "DGM-T19"/);
  assert.match(t19Runner, /suite: "t19-purchase-gst-revision-safety"/);
  assert.match(t19Runner, /runId: run/);
  assert.match(t19Runner, /evidence\.passed = evidence\.tests\.length - failedCount/);
  assert.match(t19Runner, /evidence\.executionStatus = failedCount === 0 \? "PASS" : "FAIL"/);
  assert.match(t19Runner, /evidenceRecordingSucceeded: true/);
  assert.match(t19Runner, /suiteName: "purchase-gst"/);
});

test("T25 owns the calculator suite without a combined T13/T19/T25 runner", () => {
  assert.equal(packageJson.scripts["test:t25:gst-calculation"], "node scripts/gst-calculator-test.cjs");
  assert.match(t25Runner, /functionId: "DGM-T25"/);
  assert.match(t25Runner, /gst-calculator\.test\.ts/);
  assert.match(t25Runner, /sourceFiles:\s*\[/);
  assert.match(t25Runner, /T25_EVIDENCE_FILE/);
  assert.match(t25Suite, /T25 GST calculation and treatment suite/);
  assert.doesNotMatch(t25Runner, /t13|t19/i);
  assert.doesNotMatch(t13Runner, /t25|t19/i);
});
