#!/usr/bin/env node

const path = require("node:path");
const { runOfflineSuite } = require("./offline-suite-runner.cjs");

runOfflineSuite({
  functionId: "DGM-T13",
  suite: "t13-gstin-verification",
  testFile: path.join("tests", "gstin-verification.test.ts"),
  sourceFiles: [
    "tests/gstin-verification.test.ts",
    "src/lib/validation/gstin.ts",
    "src/lib/validation/tenant.schemas.ts",
    "src/lib/validation/masters.schemas.ts",
  ],
  evidenceEnvironmentVariable: "T13_EVIDENCE_FILE",
  runIdEnvironmentVariable: "T13_SUITE_RUN_ID",
  defaultEvidenceSlug: "t13-gstin-verification",
  command: "pnpm test:t13:gstin",
  evidenceMarker: "T13_GSTIN_EVIDENCE",
  resultsMarker: "T13_GSTIN_RESULTS",
  failuresMarker: "T13_GSTIN_FAILURES",
});
