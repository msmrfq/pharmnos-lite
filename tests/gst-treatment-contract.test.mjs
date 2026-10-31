import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const treatmentSource = fs.readFileSync(
  path.join(process.cwd(), "src", "lib", "gst", "treatment.ts"),
  "utf8",
);

const labels = [
  "Registered Business – Regular",
  "Registered Business – Composition",
  "Unregistered Business",
  "Consumer",
  "Overseas",
  "Special Economic Zone",
  "Deemed Export",
  "UIN Holders",
];

test("GST treatment contract retains the eight approved labels", () => {
  for (const label of labels) {
    assert.match(treatmentSource, new RegExp(label));
  }
});

test("GST treatment contract validates labels and rejects unsupported categories", () => {
  assert.match(treatmentSource, /isGstTreatmentLabel/);
  assert.match(treatmentSource, /validateGstTreatment/);
  assert.match(treatmentSource, /SUPPORTED_TREATMENTS/);
  assert.match(
    treatmentSource,
    /is visible for classification but is not enabled/,
  );
});
