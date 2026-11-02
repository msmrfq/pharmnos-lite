import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/gst/place-of-supply.ts", "utf8");
const stateSource = fs.readFileSync("src/lib/constants/indian-states.ts", "utf8");
const action = fs.readFileSync("src/app/_actions/purchases.actions.ts", "utf8");

test("purchase POS uses the centralized state resolver and rejects incomplete facts", () => {
  assert.match(source, /normalizeState/);
  assert.match(source, /determinePlaceOfSupply/);
  assert.match(source, /Supplier, recipient, and delivery states are required/);
  assert.match(source, /Delivery state must match/);
  assert.match(source, /Supply scenario does not match/);
  assert.match(source, /UNSUPPORTED_UTGST/);
  assert.match(stateSource, /INDIAN_UNION_TERRITORIES/);
  assert.match(stateSource, /UNSUPPORTED_UTGST/);
  assert.match(action, /resolvePurchaseSupplyFacts/);
});

test("purchase POS selector is backed by the complete domestic catalog", () => {
  const selector = fs.readFileSync("src/components/gst/gst-state-select.tsx", "utf8");
  assert.match(selector, /INDIAN_REGIONS/);
  assert.match(selector, /datalist/);
  assert.match(selector, /placeholder/);
});
