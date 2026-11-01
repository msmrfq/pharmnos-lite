import assert from "node:assert/strict";
import test from "node:test";

const source = await import("../src/domain/services/inventory-valuation.service.ts");

test("pending eligibility never creates an approved inventory cost", () => {
  const result = source.resolveInventoryValuation({
    acceptedTaxableValue: 100,
    acceptedGst: 18,
    eligibilityStatus: "PENDING",
  });
  assert.equal(result.status, "PENDING");
  assert.equal(result.inventoryAcquisitionCost, null);
});

test("fully recoverable GST stays separate from inventory cost", () => {
  const result = source.resolveInventoryValuation({
    acceptedTaxableValue: 100,
    acceptedGst: 18,
    eligibilityStatus: "RECOVERABLE",
    recoverableItc: 18,
    nonRecoverableGst: 0,
    approvedDirectAcquisitionCost: 0,
    policyVersion: "VAL-1",
    decisionReference: "DEC-1",
    decidedByMembershipId: "MEM-1",
  });
  assert.deepEqual(
    {
      status: result.status,
      recoverableItc: result.recoverableItc,
      nonRecoverableGst: result.nonRecoverableGst,
      inventoryAcquisitionCost: result.inventoryAcquisitionCost,
    },
    {
      status: "APPROVED",
      recoverableItc: 18,
      nonRecoverableGst: 0,
      inventoryAcquisitionCost: 100,
    },
  );
});

test("partial recovery requires an exact GST split", () => {
  const result = source.resolveInventoryValuation({
    acceptedTaxableValue: 100,
    acceptedGst: 18,
    eligibilityStatus: "PARTIALLY_RECOVERABLE",
    recoverableItc: 10,
    nonRecoverableGst: 8,
    approvedDirectAcquisitionCost: 2,
    policyVersion: "VAL-1",
    decisionReference: "DEC-2",
    decidedByMembershipId: "MEM-1",
  });
  assert.equal(result.status, "APPROVED");
  assert.equal(result.inventoryAcquisitionCost, 110);
});

test("mismatched split remains pending", () => {
  const result = source.resolveInventoryValuation({
    acceptedTaxableValue: 100,
    acceptedGst: 18,
    eligibilityStatus: "NON_RECOVERABLE",
    recoverableItc: 1,
    nonRecoverableGst: 17,
    approvedDirectAcquisitionCost: 0,
    policyVersion: "VAL-1",
    decisionReference: "DEC-3",
    decidedByMembershipId: "MEM-1",
  });
  assert.equal(result.status, "PENDING");
  assert.equal(result.inventoryAcquisitionCost, null);
});

test("subsequent valuation corrections are explicit deltas", () => {
  assert.deepEqual(
    source.calculateInventoryValuationAdjustment(
      { recoverableItc: 18, nonRecoverableGst: 0, inventoryAcquisitionCost: 100 },
      { recoverableItc: 10, nonRecoverableGst: 8, inventoryAcquisitionCost: 110 },
    ),
    {
      recoverableItcDelta: -8,
      nonRecoverableGstDelta: 8,
      inventoryAcquisitionCostDelta: 10,
    },
  );
});
