#!/usr/bin/env node

const path = require("node:path");
const { runOfflineSuite } = require("./offline-suite-runner.cjs");

runOfflineSuite({
  functionId: "DGM-T25",
  suite: "t25-gst-calculation-treatment",
  testFile: path.join("tests", "gst-calculator.test.ts"),
  sourceFiles: [
    "tests/gst-calculator.test.ts",
    "src/lib/constants/indian-states.ts",
    "src/lib/gst/place-of-supply.ts",
    "src/domain/services/gst-calculator.service.ts",
    "src/domain/services/purchase-calculator.service.ts",
    "src/lib/decimal.ts",
    "src/lib/validation/tenant.schemas.ts",
    "src/lib/validation/masters.schemas.ts",
    "src/lib/validation/purchases.schemas.ts",
    "src/app/_actions/settings.actions.ts",
  ],
  evidenceEnvironmentVariable: "T25_EVIDENCE_FILE",
  runIdEnvironmentVariable: "T25_SUITE_RUN_ID",
  defaultEvidenceSlug: "t25-gst-calculation-treatment",
  command: "pnpm test:t25:gst-calculation",
  evidenceMarker: "T25_GST_CALCULATION_EVIDENCE",
  resultsMarker: "T25_GST_CALCULATION_RESULTS",
  failuresMarker: "T25_GST_CALCULATION_FAILURES",
});
