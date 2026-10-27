#!/usr/bin/env node

import {
  calculatePurchaseInvoiceTotals,
  calculatePurchaseLineTotals,
} from "../src/domain/services/purchase-calculator.service";
import {
  calculatePurchaseGstExpected,
  canCompletePurchaseAccounting,
  notYetReconciledPurchaseGst,
  reconcilePurchaseGstEvidence,
  resolvePurchaseGstReconciliation,
  type AccountingAcceptedPurchaseGst,
  type CalculatedPurchaseGstExpected,
  type SupplierDeclaredPurchaseGstEvidence,
} from "../src/domain/services/purchase-gst-reconciliation.service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert(actual === expected, `${message} (expected ${String(expected)}, got ${String(actual)})`);
}

const declared: SupplierDeclaredPurchaseGstEvidence = {
  source_document_reference: "supplier-invoice-001",
  amounts: {
    taxable_value: "100.00",
    cgst: "9.00",
    sgst: "9.00",
    igst: "0.00",
    cess: null,
    invoice_total: "118.00",
    round_off: "0.00",
  },
};

const calculated: CalculatedPurchaseGstExpected = {
  rule_version: "purchase-gst-rules-v1",
  amounts: {
    taxable_value: 100,
    cgst: 9,
    sgst: 9,
    igst: 0,
    cess: null,
    invoice_total: 118,
    round_off: 0,
  },
};

const notReconciled = notYetReconciledPurchaseGst();
assertEqual(notReconciled.status, "NOT_RECONCILED", "new evidence starts as not reconciled");
assert(!canCompletePurchaseAccounting(notReconciled, null), "not-reconciled evidence cannot pass the completion guard");

const expectedIntra = calculatePurchaseGstExpected(
  { gross_amount: 100, total_discount: 0, total_tax: 18, round_off: 0, net_amount: 118 },
  {
    supplier_state_at_transaction: "Maharashtra",
    recipient_state_at_transaction: "Maharashtra",
    delivery_state_at_transaction: "Maharashtra",
    supply_scenario: "INTRA_STATE",
  },
);
assertEqual(expectedIntra.rule_version, "purchase-gst-rules-v1", "purchase calculation records its rule version");
assertEqual(expectedIntra.amounts.cgst, 9, "intra-state calculation splits CGST");
assertEqual(expectedIntra.amounts.sgst, 9, "intra-state calculation splits SGST");
assertEqual(expectedIntra.amounts.igst, 0, "intra-state calculation does not assign IGST");
const expectedInter = calculatePurchaseGstExpected(
  { gross_amount: 100, total_discount: 0, total_tax: 18, round_off: 0, net_amount: 118 },
  {
    supplier_state_at_transaction: "Maharashtra",
    recipient_state_at_transaction: "Gujarat",
    delivery_state_at_transaction: "Gujarat",
    supply_scenario: "INTER_STATE",
  },
);
assertEqual(expectedInter.amounts.igst, 18, "inter-state calculation assigns aggregate tax to IGST");
assertEqual(expectedInter.amounts.cgst, 0, "inter-state calculation does not assign CGST");

const matching = reconcilePurchaseGstEvidence({
  ...declared,
  amounts: { ...declared.amounts, cess: "0.00" },
}, {
  ...calculated,
  amounts: { ...calculated.amounts, cess: 0 },
});
assertEqual(matching.status, "MATCHED", "matching values produce a matched result");
assert(!matching.material_discrepancy, "matching values are not marked discrepant");
assertEqual(matching.rule_version, "purchase-gst-rules-v1", "calculation rule version is carried into reconciliation");
assertEqual(matching.source_document_reference, "supplier-invoice-001", "source-document reference is preserved");
assertEqual(declared.amounts.cgst, "9.00", "supplier source precision remains unchanged");
assertEqual(declared.amounts.cess, null, "missing supplier components remain missing");
const missing = reconcilePurchaseGstEvidence(declared, calculated);
assertEqual(missing.comparisons.find((item) => item.field === "cess")?.status, "MISSING", "missing components are not treated as zero");
assert(!canCompletePurchaseAccounting(matching, null), "matched reconciliation without accounting acceptance is blocked");

const discrepant = reconcilePurchaseGstEvidence(declared, {
  ...calculated,
  amounts: {
    ...calculated.amounts,
    sgst: 9.01,
  },
});
assertEqual(discrepant.status, "DISCREPANCY_REQUIRES_REVIEW", "different values require review");
assertEqual(discrepant.differing_fields[0], "sgst", "the differing field is identified");
assert(!canCompletePurchaseAccounting(discrepant, null), "an unresolved discrepancy cannot pass the posting guard");
assertEqual(declared.amounts.sgst, "9.00", "reconciliation does not mutate supplier evidence");

const accepted: AccountingAcceptedPurchaseGst = {
  amounts: { ...calculated.amounts, cess: 0 },
  source: "EXPLICIT_DECISION",
  decision_reference: "decision-001",
};
assert(canCompletePurchaseAccounting(matching, accepted), "matched reconciliation requires and accepts explicit accounting values");
const resolved = resolvePurchaseGstReconciliation(discrepant, {
  decision_reference: "decision-001",
  decision: "Accept calculated SGST after review",
  rationale: "Supplier correction was reviewed and documented.",
  approved_by: "accountant-001",
  resolved_at: "2026-10-22T15:51:00.000Z",
  accepted,
});
assertEqual(resolved.status, "RESOLVED", "explicit resolution produces a resolved result");
assert(canCompletePurchaseAccounting(resolved, accepted), "an explicitly resolved discrepancy can pass with accepted accounting values");
assertEqual(resolved.resolution.accepted.amounts.sgst, 9, "accepted values remain separate from supplier evidence");
assertEqual(declared.amounts.sgst, "9.00", "resolution does not mutate supplier evidence");
accepted.amounts.sgst = 999;
assertEqual(resolved.resolution.accepted.amounts.sgst, 9, "resolved accepted values are defensively copied");

const decimalArtifactExpected: CalculatedPurchaseGstExpected = {
  ...calculated,
  amounts: { ...calculated.amounts, cgst: 0.1 + 0.2, cess: 0, taxable_value: 0.3, invoice_total: 0.3 },
};
const decimalArtifact = reconcilePurchaseGstEvidence({
  ...declared,
  amounts: { ...declared.amounts, taxable_value: "0.30", cgst: "0.30", cess: "0.00", invoice_total: "0.30" },
}, decimalArtifactExpected);
assertEqual(decimalArtifact.comparisons.find((item) => item.field === "cgst")?.status, "MATCHED", "binary floating-point artifacts do not create a false discrepancy");
const equivalentScale = reconcilePurchaseGstEvidence(declared, {
  ...calculated,
  amounts: { ...calculated.amounts, cgst: "9.0", cess: 0 },
});
assertEqual(equivalentScale.comparisons.find((item) => item.field === "cgst")?.status, "MATCHED", "equivalent decimal representations match");
const largeDecimal = reconcilePurchaseGstEvidence({
  ...declared,
  amounts: { ...declared.amounts, taxable_value: "9007199254740993.00", cess: "0.00" },
}, {
  ...calculated,
  amounts: { ...calculated.amounts, taxable_value: "9007199254740993.0", cess: 0 },
});
assertEqual(largeDecimal.comparisons.find((item) => item.field === "taxable_value")?.status, "MATCHED", "large decimal strings compare without safe-integer loss");
const invalid = reconcilePurchaseGstEvidence(declared, {
  ...calculated,
  amounts: { ...calculated.amounts, cgst: " ", cess: 0 },
});
assertEqual(invalid.comparisons.find((item) => item.field === "cgst")?.status, "INVALID", "whitespace-only values are invalid evidence");
assert(invalid.invalid_fields.includes("cgst"), "invalid numeric evidence is reported");
const invalidText = reconcilePurchaseGstEvidence(declared, {
  ...calculated,
  amounts: { ...calculated.amounts, cgst: "not-a-number", cess: 0 },
});
assertEqual(invalidText.comparisons.find((item) => item.field === "cgst")?.status, "INVALID", "malformed numeric strings are invalid evidence");
const missingRule = reconcilePurchaseGstEvidence(declared, { ...calculated, rule_version: " " });
assertEqual(missingRule.rule_version, null, "missing rule versions remain unavailable");
assert(!canCompletePurchaseAccounting(missingRule, accepted), "missing rule versions cannot pass completion");
assert(!canCompletePurchaseAccounting(resolved, { ...accepted, amounts: { ...accepted.amounts, cess: null } }), "incomplete accepted values are blocked");
assert(!canCompletePurchaseAccounting(resolved, {
  ...accepted,
  amounts: {
    taxable_value: null,
    cgst: null,
    sgst: null,
    igst: null,
    cess: null,
    invoice_total: null,
    round_off: null,
  },
}), "all-null accepted values are blocked");
assert(!canCompletePurchaseAccounting(resolved, { ...accepted, decision_reference: "other-decision" }), "mismatched accepted decision references are blocked");
let rejectedResolution = false;
try {
  resolvePurchaseGstReconciliation(discrepant, {
    decision_reference: "decision-001",
    decision: "Accept calculated SGST after review",
    rationale: "Reviewed.",
    approved_by: "accountant-001",
    resolved_at: "2026-10-22T15:51:00.000Z",
    accepted: { ...accepted, decision_reference: "other-decision" },
  });
} catch {
  rejectedResolution = true;
}
assert(rejectedResolution, "mismatched resolution references are rejected");
let rejectedReresolution = false;
try {
  resolvePurchaseGstReconciliation(resolved, {
    decision_reference: "decision-002",
    decision: "Re-resolve",
    rationale: "Not permitted.",
    approved_by: "accountant-001",
    resolved_at: "2026-10-22T15:52:00.000Z",
    accepted,
  });
} catch {
  rejectedReresolution = true;
}
assert(rejectedReresolution, "already resolved reconciliations cannot be resolved again");

const line = calculatePurchaseLineTotals({
  quantity: 3,
  purchase_rate: 10.005,
  discount_pct: 0,
  gst_rate: 18,
});
const totals = calculatePurchaseInvoiceTotals([line]);
assertEqual(line.gross, 30.02, "existing purchase line rounding remains unchanged");
assertEqual(line.gst_amount, 5.4, "existing purchase aggregate tax rounding remains unchanged");
assertEqual(totals.round_off, -0.42, "existing signed whole-unit invoice rounding remains unchanged");
assertEqual(totals.net_amount, 35, "existing purchase net amount remains unchanged");

if (failed > 0) {
  console.error(`\n${failed} purchase GST reconciliation test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${passed} purchase GST reconciliation assertions passed.`);
}
