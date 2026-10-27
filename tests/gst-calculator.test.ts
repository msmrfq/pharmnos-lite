#!/usr/bin/env node
/**
 * Simple test runner for GST calculator and state normalization
 * Run with: npx tsx tests/gst-calculator.test.ts
 */

import {
  normalizeState,
  getStateName,
  isValidStateCode,
  getStateCodeFromGstin,
  determinePlaceOfSupply,
  type PlaceOfSupplyResult,
  STATE_NAME_TO_CODE,
  STATE_CODE_TO_NAME,
  VALID_STATE_CODES,
  UNSUPPORTED_GSTIN_STATE_PREFIXES,
} from "../src/lib/constants/indian-states";

import {
  gstCalculator,
  canMarkSalesInvoiceComplete,
  splitLineGst,
  calculateGstTotals,
  detectPlaceOfSupply,
  requireResolvedPlaceOfSupply,
  selectFinalizedInvoiceValue,
  buildInvoicePrintSnapshot,
  hasCompleteSalesSnapshotFacts,
  toPersistedSalesTaxFacts,
  toTaxableGstLine,
  type LineItemTaxable,
  type GstConfig,
  type PlaceOfSupplyResult as GstPlaceOfSupplyResult
} from "../src/domain/services/gst-calculator.service";
import { businessProfileStateSchema } from "../src/lib/validation/tenant.schemas";
import { businessProfileSchema } from "../src/lib/validation/tenant.schemas";
import { toBusinessProfileUpdate } from "../src/app/_actions/settings.actions";
import {
  calculatePurchaseInvoiceTotals,
  calculatePurchaseLineTotals,
} from "../src/domain/services/purchase-calculator.service";
import { PurchaseInvoiceLineCreateSchema } from "../src/lib/validation/purchases.schemas";

let passed = 0;
let failed = 0;

{
  const finalized = buildInvoicePrintSnapshot(
    {
      tax_data_status: "COMPLETE",
      seller_name_snapshot: "Historical seller",
      customer_name_snapshot: "Historical customer",
      customer: { business_name: "Current customer" },
      items: [{
        product_name_snapshot: "Historical product",
        hsn_code_snapshot: "3004",
        product: { name: "Current product", hsn_code: "9999" },
      }],
    },
    "Current seller",
  );
  assert(finalized.sellerName === "Historical seller", "Print loader prefers seller snapshot");
  assert(finalized.customerName === "Historical customer", "Print loader prefers customer snapshot");
  assert(finalized.items[0]?.productName === "Historical product", "Print loader prefers product snapshot");
  assert(finalized.items[0]?.hsnCode === "3004", "Print loader prefers HSN snapshot");

  const legacy = buildInvoicePrintSnapshot(
    {
      tax_data_status: "LEGACY_AGGREGATE_ONLY",
      seller_name_snapshot: null,
      customer_name_snapshot: null,
      customer: { business_name: "Current customer" },
      items: [{
        product_name_snapshot: null,
        product: { name: "Current product" },
      }],
    },
    "Current seller",
  );
  assert(legacy.sellerName === "Current seller", "Legacy print loader uses disclosed current fallback");
  assert(legacy.customerName === "Current customer", "Legacy print loader uses current customer fallback");
  assert(legacy.items[0]?.productName === "Current product", "Legacy print loader uses current product fallback");
}

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  const pass = actual === expected;
  if (pass) {
    console.log(`✅ PASS: ${message} (${actual})`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message} - Expected: ${expected}, Got: ${actual}`);
    failed++;
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  const pass = Math.abs(actual - expected) <= tolerance;
  if (pass) {
    console.log(`✅ PASS: ${message} (${actual} ≈ ${expected})`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message} - Expected: ${expected} ± ${tolerance}, Got: ${actual}`);
    failed++;
  }
}

console.log("=== State Normalization Tests ===\n");

// Test normalizeState with state names
assertEqual(normalizeState("Maharashtra"), "MH", "normalizeState: Full state name 'Maharashtra'");
assertEqual(normalizeState("maharashtra"), "MH", "normalizeState: Lowercase state name");
assertEqual(normalizeState("MAHARASHTRA"), "MH", "normalizeState: Uppercase state name");
assertEqual(normalizeState("  Maharashtra  "), "MH", "normalizeState: State name with whitespace");
assertEqual(normalizeState("Tamil Nadu"), "TN", "normalizeState: Multi-word state name 'Tamil Nadu'");
assertEqual(normalizeState("tamil nadu"), "TN", "normalizeState: Lowercase multi-word state name");
assertEqual(normalizeState("Uttar Pradesh"), "UP", "normalizeState: 'Uttar Pradesh'");
assertEqual(normalizeState("Delhi"), "DL", "normalizeState: Union Territory 'Delhi'");

// Test normalizeState with state codes
assertEqual(normalizeState("MH"), "MH", "normalizeState: State code 'MH'");
assertEqual(normalizeState("mh"), "MH", "normalizeState: Lowercase state code 'mh'");
assertEqual(normalizeState("  MH  "), "MH", "normalizeState: State code with whitespace");

// Test normalizeState with invalid inputs
assertEqual(normalizeState(""), null, "normalizeState: Empty string");
assertEqual(normalizeState(null), null, "normalizeState: null input");
assertEqual(normalizeState(undefined), null, "normalizeState: undefined input");
assertEqual(normalizeState("InvalidState"), null, "normalizeState: Invalid state name");
assertEqual(normalizeState("XX"), null, "normalizeState: Invalid state code 'XX'");

// Test getStateName
assertEqual(getStateName("MH"), "Maharashtra", "getStateName: Valid code 'MH'");
assertEqual(getStateName("mh"), "Maharashtra", "getStateName: Lowercase code 'mh'");
assertEqual(getStateName("XX"), null, "getStateName: Invalid code 'XX'");
assertEqual(getStateName(null), null, "getStateName: null input");

// Test isValidStateCode
assert(isValidStateCode("MH"), "isValidStateCode: Valid code 'MH'");
assert(isValidStateCode("mh"), "isValidStateCode: Lowercase code 'mh'");
assert(!isValidStateCode("XX"), "isValidStateCode: Invalid code 'XX'");
assert(!isValidStateCode(""), "isValidStateCode: Empty string");
assert(!isValidStateCode(null), "isValidStateCode: null input");

// Test getStateCodeFromGstin
const gstinStatePrefixCases: Array<[string, string]> = [
  ["01", "JK"], ["02", "HP"], ["03", "PB"], ["04", "CH"], ["05", "UT"],
  ["06", "HR"], ["07", "DL"], ["08", "RJ"], ["09", "UP"], ["10", "BR"],
  ["11", "SK"], ["12", "AR"], ["13", "NL"], ["14", "MN"], ["15", "MZ"],
  ["16", "TR"], ["17", "ML"], ["18", "AS"], ["19", "WB"], ["20", "JH"],
  ["21", "OD"], ["22", "CG"], ["23", "MP"], ["24", "GJ"], ["25", "DD"],
  ["26", "DD"], ["27", "MH"], ["28", "AP"], ["29", "KA"], ["30", "GA"],
  ["31", "LD"], ["32", "KL"], ["33", "TN"], ["34", "PY"], ["35", "AN"],
  ["36", "TG"], ["37", "AP"], ["38", "LA"],
];

for (const [prefix, expectedCode] of gstinStatePrefixCases) {
  assertEqual(
    getStateCodeFromGstin(`${prefix}AACXX0000B1ZP`),
    expectedCode,
    `getStateCodeFromGstin: Prefix ${prefix}`,
  );
}

assertEqual(getStateCodeFromGstin(""), null, "getStateCodeFromGstin: Empty string");
assertEqual(getStateCodeFromGstin("27"), null, "getStateCodeFromGstin: Prefix-only input is not a GSTIN");
assertEqual(getStateCodeFromGstin("MH"), null, "getStateCodeFromGstin: Standalone code uses normalizeState instead");
assertEqual(getStateCodeFromGstin("27AACXX0000B1"), null, "getStateCodeFromGstin: Short identifier");
assertEqual(getStateCodeFromGstin("27AACXX0000B1ZP!"), null, "getStateCodeFromGstin: Invalid character");
assertEqual(getStateCodeFromGstin(" 27aacxx0000b1zp "), "MH", "getStateCodeFromGstin: Valid lowercase input with whitespace");
assertEqual(getStateCodeFromGstin("00AACXX0000B1ZP"), null, "getStateCodeFromGstin: Unsupported prefix 00");
assertEqual(getStateCodeFromGstin("39AACXX0000B1ZP"), null, "getStateCodeFromGstin: Unsupported prefix 39");
for (const prefix of UNSUPPORTED_GSTIN_STATE_PREFIXES) {
  assertEqual(
    getStateCodeFromGstin(`${prefix}AACXX0000B1ZP`),
    null,
    `getStateCodeFromGstin: Special-purpose prefix ${prefix} is not a state`,
  );
  assertEqual(
    determinePlaceOfSupply(getStateCodeFromGstin(`${prefix}AACXX0000B1ZP`), "MH").type,
    "UNKNOWN",
    `determinePlaceOfSupply: Special-purpose prefix ${prefix} cannot resolve supplier state`,
  );
}
assertEqual(getStateCodeFromGstin("99AACXX0000B1ZP"), null, "getStateCodeFromGstin: Unsupported prefix 99");
assertEqual(getStateCodeFromGstin(null), null, "getStateCodeFromGstin: null input");

// GSTIN prefixes and standalone state inputs use different validation paths.
assertEqual(normalizeState("AP"), "AP", "normalizeState: Standalone AP state code");
assertEqual(normalizeState("Ladakh"), "LA", "normalizeState: Current Ladakh state name");
assertEqual(normalizeState("Dadra and Nagar Haveli and Daman and Diu"), "DD", "normalizeState: Merged UT canonical name");
assertEqual(normalizeState("97"), null, "normalizeState: Numeric GSTIN prefix is not a state input");
assertEqual(normalizeState("99"), null, "normalizeState: OIDAR prefix is not a state input");

// Test business-profile state validation uses the canonical state contract.
assertEqual(
  businessProfileStateSchema.parse(" Maharashtra "),
  "MH",
  "businessProfileStateSchema: State name normalized to canonical code",
);
assertEqual(
  businessProfileStateSchema.parse("mh"),
  "MH",
  "businessProfileStateSchema: State code normalized to uppercase",
);
assertEqual(
  businessProfileStateSchema.parse(""),
  null,
  "businessProfileStateSchema: Blank state remains optional",
);
assert(
  (() => {
    try {
      businessProfileStateSchema.parse("NotAState");
      return false;
    } catch {
      return true;
    }
  })(),
  "businessProfileStateSchema: Unsupported state rejected",
);
const parsedBusinessProfile = businessProfileSchema.parse({
  businessName: "Pharmnos Lite",
  state: "Maharashtra",
  invoicePrefix: "INV",
  purchasePrefix: "PUR",
  nearExpiryDays: "60",
});
const businessProfileUpdate = toBusinessProfileUpdate(parsedBusinessProfile);
assertEqual(
  businessProfileUpdate.state,
  "MH",
  "Business profile action mapping: normalized state persisted",
);
assertEqual(
  businessProfileUpdate.address_line_1,
  null,
  "Business profile action mapping: blank address persists as null",
);

const purchaseLineFacts = calculatePurchaseLineTotals({
  quantity: 2,
  purchase_rate: 100,
  discount_pct: 10,
  gst_rate: 18,
});
assertEqual(purchaseLineFacts.gross, 200, "Purchase facts: pre-discount gross");
assertEqual(purchaseLineFacts.discount_amount, 20, "Purchase facts: discount");
assertEqual(purchaseLineFacts.gst_amount, 32.40, "Purchase facts: aggregate GST");
assertEqual(purchaseLineFacts.line_total, 212.40, "Purchase facts: line total");
const purchaseInvoiceFacts = calculatePurchaseInvoiceTotals([purchaseLineFacts]);
assertEqual(purchaseInvoiceFacts.total_tax, 32.40, "Purchase facts: invoice tax");
assertEqual(purchaseInvoiceFacts.round_off, -0.40, "Purchase facts: existing whole-unit round-off");
assertEqual(purchaseInvoiceFacts.net_amount, 212, "Purchase facts: invoice net amount");

const zeroPurchaseFacts = calculatePurchaseLineTotals({
  quantity: 0,
  purchase_rate: 0,
  discount_pct: 0,
  gst_rate: 18,
});
assertEqual(zeroPurchaseFacts.gross, 0, "Purchase facts: zero gross remains zero");
assertEqual(zeroPurchaseFacts.gst_amount, 0, "Purchase facts: zero tax remains zero");
assertEqual(zeroPurchaseFacts.line_total, 0, "Purchase facts: zero line remains zero");

const invalidPurchaseFacts = calculatePurchaseLineTotals({
  quantity: "not-a-number",
  purchase_rate: undefined,
  discount_pct: "invalid",
  gst_rate: "invalid",
});
assertEqual(invalidPurchaseFacts.gross, 0, "Purchase facts: non-finite gross input is neutralized");
assertEqual(invalidPurchaseFacts.gst_amount, 0, "Purchase facts: non-finite tax input is neutralized");

const multiLinePurchaseFacts = calculatePurchaseInvoiceTotals([
  calculatePurchaseLineTotals({ quantity: 1, purchase_rate: 100.25, discount_pct: 0, gst_rate: 0 }),
  calculatePurchaseLineTotals({ quantity: 1, purchase_rate: 100.25, discount_pct: 0, gst_rate: 0 }),
]);
assertEqual(multiLinePurchaseFacts.gross_amount, 200.50, "Purchase facts: multi-line gross total");
assertEqual(multiLinePurchaseFacts.round_off, 0.50, "Purchase facts: positive whole-unit round-off");
assertEqual(multiLinePurchaseFacts.net_amount, 201, "Purchase facts: rounded multi-line net amount");

assert(
  PurchaseInvoiceLineCreateSchema.safeParse({
    product_id: "product-1",
    batch_no: "BATCH-1",
    quantity: "2",
    free_qty: "0",
    purchase_rate: "100.25",
    discount_pct: "5",
    gst_rate: "18",
    mrp: "120",
    sale_rate: "110",
  }).success,
  "Purchase schema: valid line accepted",
);
assert(
  !PurchaseInvoiceLineCreateSchema.safeParse({
    product_id: "product-1",
    batch_no: "BATCH-1",
    quantity: "0",
    free_qty: "0",
    purchase_rate: "100",
    discount_pct: "0",
    gst_rate: "18",
  }).success,
  "Purchase schema: zero quantity rejected",
);
assert(
  !PurchaseInvoiceLineCreateSchema.safeParse({
    product_id: "product-1",
    batch_no: "BATCH-1",
    quantity: "1",
    free_qty: "0",
    purchase_rate: "-1",
    discount_pct: "0",
    gst_rate: "18",
  }).success,
  "Purchase schema: negative purchase rate rejected",
);

// Test determinePlaceOfSupply
assertEqual(determinePlaceOfSupply("Maharashtra", "Maharashtra").type, "INTRA", "determinePlaceOfSupply: Same state names");
assertEqual(determinePlaceOfSupply("MH", "MH").type, "INTRA", "determinePlaceOfSupply: Same state codes");
assertEqual(determinePlaceOfSupply("Maharashtra", "MH").type, "INTRA", "determinePlaceOfSupply: Name vs code same state");
assertEqual(determinePlaceOfSupply("MH", "Maharashtra").type, "INTRA", "determinePlaceOfSupply: Code vs name same state");
assertEqual(determinePlaceOfSupply("Maharashtra", "Karnataka").type, "INTER", "determinePlaceOfSupply: Different state names");
assertEqual(determinePlaceOfSupply("MH", "KA").type, "INTER", "determinePlaceOfSupply: Different state codes");
assertEqual(determinePlaceOfSupply("Maharashtra", "KA").type, "INTER", "determinePlaceOfSupply: Name vs code different states");
assertEqual(determinePlaceOfSupply("Karnataka", "Karnataka").type, "INTRA", "determinePlaceOfSupply: Non-Maharashtra same state");
assertEqual(determinePlaceOfSupply("KA", "MH").type, "INTER", "determinePlaceOfSupply: Non-Maharashtra supplier");
assertEqual(determinePlaceOfSupply("", "MH").type, "UNKNOWN", "determinePlaceOfSupply: Missing supplier state");
assertEqual(determinePlaceOfSupply("MH", "").type, "UNKNOWN", "determinePlaceOfSupply: Missing buyer state");
assertEqual(determinePlaceOfSupply("   ", "MH").type, "UNKNOWN", "determinePlaceOfSupply: Whitespace-only supplier state");
assertEqual(determinePlaceOfSupply("MH", "   ").type, "UNKNOWN", "determinePlaceOfSupply: Whitespace-only buyer state");
assertEqual(determinePlaceOfSupply("   ", "   ").type, "UNKNOWN", "determinePlaceOfSupply: Both whitespace-only states");
assertEqual(determinePlaceOfSupply(null, "MH").type, "UNKNOWN", "determinePlaceOfSupply: null supplier state");
assertEqual(determinePlaceOfSupply("MH", null).type, "UNKNOWN", "determinePlaceOfSupply: null buyer state");
assertEqual(determinePlaceOfSupply("InvalidState", "MH").type, "UNKNOWN", "determinePlaceOfSupply: Invalid supplier state");
assertEqual(determinePlaceOfSupply("MH", "InvalidState").type, "UNKNOWN", "determinePlaceOfSupply: Invalid buyer state");
assertEqual(determinePlaceOfSupply("", "").type, "UNKNOWN", "determinePlaceOfSupply: Both missing");
assertEqual(determinePlaceOfSupply("InvalidState", "InvalidState2").type, "UNKNOWN", "determinePlaceOfSupply: Both invalid");

// Test that UNKNOWN results have correct reason
const missingSupplier = determinePlaceOfSupply("", "MH");
assertEqual(missingSupplier.type, "UNKNOWN", "determinePlaceOfSupply: Missing supplier - type");
if (missingSupplier.type === "UNKNOWN") {
  assertEqual(missingSupplier.reason, "MISSING_SUPPLIER", "determinePlaceOfSupply: Missing supplier - reason");
}

const missingBuyer = determinePlaceOfSupply("MH", "");
assertEqual(missingBuyer.type, "UNKNOWN", "determinePlaceOfSupply: Missing buyer - type");
if (missingBuyer.type === "UNKNOWN") {
  assertEqual(missingBuyer.reason, "MISSING_BUYER", "determinePlaceOfSupply: Missing buyer - reason");
}

const invalidSupplier = determinePlaceOfSupply("InvalidState", "MH");
assertEqual(invalidSupplier.type, "UNKNOWN", "determinePlaceOfSupply: Invalid supplier - type");
if (invalidSupplier.type === "UNKNOWN") {
  assertEqual(invalidSupplier.reason, "INVALID_SUPPLIER", "determinePlaceOfSupply: Invalid supplier - reason");
}

const invalidBuyer = determinePlaceOfSupply("MH", "InvalidState");
assertEqual(invalidBuyer.type, "UNKNOWN", "determinePlaceOfSupply: Invalid buyer - type");
if (invalidBuyer.type === "UNKNOWN") {
  assertEqual(invalidBuyer.reason, "INVALID_BUYER", "determinePlaceOfSupply: Invalid buyer - reason");
}

const bothInvalid = determinePlaceOfSupply("", "");
assertEqual(bothInvalid.type, "UNKNOWN", "determinePlaceOfSupply: Both missing - type");
if (bothInvalid.type === "UNKNOWN") {
  assertEqual(bothInvalid.reason, "BOTH_INVALID", "determinePlaceOfSupply: Both missing - reason");
}

assertEqual(
  requireResolvedPlaceOfSupply(determinePlaceOfSupply("MH", "MH")),
  "INTRA",
  "requireResolvedPlaceOfSupply: Same state accepted",
);
assertEqual(
  requireResolvedPlaceOfSupply(determinePlaceOfSupply("MH", "KA")),
  "INTER",
  "requireResolvedPlaceOfSupply: Different state accepted",
);
assert(
  (() => {
    try {
      requireResolvedPlaceOfSupply(determinePlaceOfSupply("", "MH"));
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes("states are valid");
    }
  })(),
  "requireResolvedPlaceOfSupply: Missing supplier rejected",
);
assert(
  (() => {
    try {
      requireResolvedPlaceOfSupply(determinePlaceOfSupply("MH", "InvalidState"));
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes("states are valid");
    }
  })(),
  "requireResolvedPlaceOfSupply: Invalid customer rejected",
);

console.log("\n=== GST Calculator Tests ===\n");

// Test splitLineGst - Intra-state
const intraConfig: GstConfig = { placeOfSupply: "INTRA", rounding: "HALF_UP" };

const draftDiscountLine = toTaxableGstLine({
  quantity: 2,
  sale_rate: 100,
  trade_discount_pct: 10,
  gst_rate: 18,
});
const persistedDiscountLine = toTaxableGstLine({
  quantity: 2,
  sale_rate: 100,
  discount_pct: 10,
  gst_rate: 18,
});
assertEqual(draftDiscountLine.taxable_value, 180, "toTaxableGstLine: Draft discount field");
assertEqual(persistedDiscountLine.taxable_value, 180, "toTaxableGstLine: Persisted discount field");
const draftDiscountTotals = calculateGstTotals([draftDiscountLine], intraConfig);
const persistedDiscountTotals = calculateGstTotals([persistedDiscountLine], intraConfig);
assertEqual(draftDiscountTotals.total_tax, persistedDiscountTotals.total_tax, "toTaxableGstLine: Equivalent discount totals");
assertEqual(draftDiscountTotals.grand_total, persistedDiscountTotals.grand_total, "toTaxableGstLine: Equivalent grand totals");

const intraRoundingLine = splitLineGst(
  { taxable_value: 10.10, gst_rate_pct: 5 },
  intraConfig,
);
assertEqual(intraRoundingLine.cgst_amount, 0.25, "splitLineGst 5% INTRA on ₹10.10: CGST");
assertEqual(intraRoundingLine.sgst_amount, 0.25, "splitLineGst 5% INTRA on ₹10.10: SGST");
assertEqual(intraRoundingLine.line_total, 10.60, "splitLineGst 5% INTRA on ₹10.10: line total");
const persistedIntraFacts = toPersistedSalesTaxFacts(intraRoundingLine);
assertEqual(persistedIntraFacts.taxable_amount, 10.10, "Persisted sales facts INTRA: taxable amount");
assertEqual(persistedIntraFacts.gst_amount, 0.50, "Persisted sales facts INTRA: aggregate GST");
assertEqual(
  persistedIntraFacts.gst_amount,
  persistedIntraFacts.cgst_amount + persistedIntraFacts.sgst_amount + persistedIntraFacts.igst_amount + persistedIntraFacts.cess_amount,
  "Persisted sales facts INTRA: components reconcile to aggregate GST",
);
assertEqual(persistedIntraFacts.line_total, 10.60, "Persisted sales facts INTRA: line total");
assertEqual(
  gstCalculator.computeLine(
    toTaxableGstLine({ quantity: 1, sale_rate: 10.10, trade_discount_pct: 0, gst_rate: 5 }),
    { placeOfSupply: "INTRA" },
  ).line_total,
  intraRoundingLine.line_total,
  "Billing preview parity: canonical INTRA line total",
);
const intraRoundingTotals = calculateGstTotals(
  [{ taxable_value: 10.10, gst_rate_pct: 5 }],
  intraConfig,
);
assertEqual(intraRoundingTotals.total_tax, 0.50, "calculateGstTotals 5% INTRA on ₹10.10: aggregate tax");
assertEqual(
  intraRoundingTotals.total_tax,
  intraRoundingTotals.lines.reduce((sum, line) => sum + line.cgst_amount + line.sgst_amount + line.igst_amount, 0),
  "calculateGstTotals 5% INTRA: aggregate tax equals canonical line components",
);

const multiLineRoundingTotals = calculateGstTotals(
  [
    { taxable_value: 10.10, gst_rate_pct: 5 },
    { taxable_value: 10.10, gst_rate_pct: 5 },
  ],
  intraConfig,
);
assertEqual(multiLineRoundingTotals.total_tax, 1.00, "calculateGstTotals multiple 5% INTRA lines: per-line tax rounding");
assertEqual(multiLineRoundingTotals.grand_total, 21.20, "calculateGstTotals multiple 5% INTRA lines: grand total");

const line1: LineItemTaxable = { taxable_value: 1000, gst_rate_pct: 18 };
const result1 = splitLineGst(line1, intraConfig);
assertEqual(result1.gst_rate_pct, 18, "splitLineGst INTRA: Rate preserved");
assertEqual(result1.cgst_amount, 90, "splitLineGst INTRA: CGST = 1000 * 9% = 90");
assertEqual(result1.sgst_amount, 90, "splitLineGst INTRA: SGST = 1000 * 9% = 90");
assertEqual(result1.igst_amount, 0, "splitLineGst INTRA: IGST = 0");
assertEqual(result1.line_total, 1180, "splitLineGst INTRA: Line total = 1000 + 90 + 90 = 1180");

// Test splitLineGst - Inter-state
const interConfig: GstConfig = { placeOfSupply: "INTER", rounding: "HALF_UP" };

const interRoundingLine = splitLineGst(
  { taxable_value: 10.10, gst_rate_pct: 5 },
  interConfig,
);
assertEqual(interRoundingLine.igst_amount, 0.51, "splitLineGst 5% INTER on ₹10.10: IGST");
assertEqual(interRoundingLine.line_total, 10.61, "splitLineGst 5% INTER on ₹10.10: line total");
const persistedInterFacts = toPersistedSalesTaxFacts(interRoundingLine);
assertEqual(persistedInterFacts.gst_amount, 0.51, "Persisted sales facts INTER: aggregate GST");
assertEqual(persistedInterFacts.igst_amount, 0.51, "Persisted sales facts INTER: IGST");
assertEqual(persistedInterFacts.line_total, 10.61, "Persisted sales facts INTER: line total");
assertEqual(
  gstCalculator.computeLine(
    toTaxableGstLine({ quantity: 1, sale_rate: 10.10, trade_discount_pct: 0, gst_rate: 5 }),
    { placeOfSupply: "INTER" },
  ).line_total,
  interRoundingLine.line_total,
  "Billing preview parity: canonical INTER line total",
);

assert(
  hasCompleteSalesSnapshotFacts({
    sellerName: "Pharmnos Lite",
    sellerState: "MH",
    customerName: "Customer",
    customerState: "MH",
    productNames: ["Product"],
  }),
  "Sales snapshot readiness: complete facts accepted",
);
assert(
  !hasCompleteSalesSnapshotFacts({
    sellerName: "Pharmnos Lite",
    sellerState: "MH",
    customerName: "Customer",
    customerState: "MH",
    productNames: [null],
  }),
  "Sales snapshot readiness: missing product snapshot rejected",
);
assert(
  canMarkSalesInvoiceComplete({
    sellerName: "Pharmnos Lite",
    sellerState: "MH",
    customerName: "Customer",
    customerState: "MH",
    productNames: ["Product"],
    placeOfSupplyCode: "MH",
    lines: [persistedIntraFacts],
  }),
  "Sales completeness: complete tax and snapshot facts accepted",
);
assert(
  !canMarkSalesInvoiceComplete({
    sellerName: "Pharmnos Lite",
    sellerState: "MH",
    customerName: "Customer",
    customerState: "MH",
    productNames: ["Product"],
    placeOfSupplyCode: null,
    lines: [persistedIntraFacts],
  }),
  "Sales completeness: unresolved place of supply rejected",
);
assertEqual(
  selectFinalizedInvoiceValue(true, "Snapshot name", "Current name"),
  "Snapshot name",
  "Invoice printing: complete record prefers persisted snapshot",
);
assertEqual(
  selectFinalizedInvoiceValue(true, null, "Current name"),
  null,
  "Invoice printing: complete record does not substitute current data for a missing snapshot",
);
assertEqual(
  selectFinalizedInvoiceValue(false, "Snapshot name", "Current name"),
  "Current name",
  "Invoice printing: legacy record falls back to current display data",
);

const line2: LineItemTaxable = { taxable_value: 1000, gst_rate_pct: 18 };
const result2 = splitLineGst(line2, interConfig);
assertEqual(result2.gst_rate_pct, 18, "splitLineGst INTER: Rate preserved");
assertEqual(result2.cgst_amount, 0, "splitLineGst INTER: CGST = 0");
assertEqual(result2.sgst_amount, 0, "splitLineGst INTER: SGST = 0");
assertEqual(result2.igst_amount, 180, "splitLineGst INTER: IGST = 1000 * 18% = 180");
assertEqual(result2.line_total, 1180, "splitLineGst INTER: Line total = 1000 + 180 = 1180");

// Test splitLineGst - Zero rate
const line3: LineItemTaxable = { taxable_value: 1000, gst_rate_pct: 0 };
const result3 = splitLineGst(line3, intraConfig);
assertEqual(result3.cgst_amount, 0, "splitLineGst Zero rate: CGST = 0");
assertEqual(result3.sgst_amount, 0, "splitLineGst Zero rate: SGST = 0");
assertEqual(result3.igst_amount, 0, "splitLineGst Zero rate: IGST = 0");
assertEqual(result3.line_total, 1000, "splitLineGst Zero rate: Line total = taxable only");

// Test splitLineGst - Non-taxable
const line4: LineItemTaxable = { taxable_value: 1000, gst_rate_pct: 18, is_non_taxable: true };
const result4 = splitLineGst(line4, intraConfig);
assertEqual(result4.cgst_amount, 0, "splitLineGst Non-taxable: CGST = 0");
assertEqual(result4.sgst_amount, 0, "splitLineGst Non-taxable: SGST = 0");
assertEqual(result4.igst_amount, 0, "splitLineGst Non-taxable: IGST = 0");
assertEqual(result4.line_total, 1000, "splitLineGst Non-taxable: Line total = taxable only");

// Test splitLineGst - Different rates
const rates = [0.25, 3, 5, 12, 18, 28];
for (const rate of rates) {
  const line: LineItemTaxable = { taxable_value: 1000, gst_rate_pct: rate };
  const intraResult = splitLineGst(line, intraConfig);
  const interResult = splitLineGst(line, interConfig);

  const expectedHalf = Math.round(1000 * (rate / 2) / 100 * 100) / 100;
  const expectedFull = Math.round(1000 * rate / 100 * 100) / 100;

  assertEqual(intraResult.cgst_amount, expectedHalf, `splitLineGst Rate ${rate}% INTRA: CGST`);
  assertEqual(intraResult.sgst_amount, expectedHalf, `splitLineGst Rate ${rate}% INTRA: SGST`);
  assertEqual(interResult.igst_amount, expectedFull, `splitLineGst Rate ${rate}% INTER: IGST`);
}

// Test calculateGstTotals - Multiple lines, intra-state
const linesIntra: LineItemTaxable[] = [
  { taxable_value: 1000, gst_rate_pct: 18 },
  { taxable_value: 500, gst_rate_pct: 12 },
  { taxable_value: 2000, gst_rate_pct: 5 },
];
const totalsIntra = calculateGstTotals(linesIntra, intraConfig);
assertEqual(totalsIntra.lines.length, 3, "calculateGstTotals INTRA: 3 lines");
assertEqual(totalsIntra.total_taxable, 3500, "calculateGstTotals INTRA: Total taxable");
assertEqual(totalsIntra.total_cgst, 90 + 30 + 50, "calculateGstTotals INTRA: Total CGST");
assertEqual(totalsIntra.total_sgst, 90 + 30 + 50, "calculateGstTotals INTRA: Total SGST");
assertEqual(totalsIntra.total_igst, 0, "calculateGstTotals INTRA: Total IGST = 0");
assertEqual(totalsIntra.total_tax, (90 + 30 + 50) * 2, "calculateGstTotals INTRA: Total tax");
assertEqual(totalsIntra.place_of_supply, "INTRA", "calculateGstTotals INTRA: Place of supply");

// Test calculateGstTotals - Multiple lines, inter-state
const linesInter: LineItemTaxable[] = [
  { taxable_value: 1000, gst_rate_pct: 18 },
  { taxable_value: 500, gst_rate_pct: 12 },
];
const totalsInter = calculateGstTotals(linesInter, interConfig);
assertEqual(totalsInter.lines.length, 2, "calculateGstTotals INTER: 2 lines");
assertEqual(totalsInter.total_taxable, 1500, "calculateGstTotals INTER: Total taxable");
assertEqual(totalsInter.total_cgst, 0, "calculateGstTotals INTER: Total CGST = 0");
assertEqual(totalsInter.total_sgst, 0, "calculateGstTotals INTER: Total SGST = 0");
assertEqual(totalsInter.total_igst, 180 + 60, "calculateGstTotals INTER: Total IGST");
assertEqual(totalsInter.total_tax, 180 + 60, "calculateGstTotals INTER: Total tax");
assertEqual(totalsInter.place_of_supply, "INTER", "calculateGstTotals INTER: Place of supply");

// Test rounding modes
const lineRound: LineItemTaxable = { taxable_value: 100.125, gst_rate_pct: 18 };
const resultHalfUp = splitLineGst(lineRound, { placeOfSupply: "INTRA", rounding: "HALF_UP" });
const resultDown = splitLineGst(lineRound, { placeOfSupply: "INTRA", rounding: "DOWN" });
const resultNone = splitLineGst(lineRound, { placeOfSupply: "INTRA", rounding: "NONE" });

// 100.125 * 9% = 9.01125
assertEqual(resultHalfUp.cgst_amount, 9.01, "splitLineGst HALF_UP: CGST rounded to 9.01");
assertEqual(resultDown.cgst_amount, 9.01, "splitLineGst DOWN: CGST floored to 9.01");
assertClose(resultNone.cgst_amount, 9.01125, 0.0001, "splitLineGst NONE: CGST not rounded");

// Test gstCalculator service
const calc = gstCalculator;
const serviceResult = calc.computeTotals([
  { taxable_value: 1000, gst_rate_pct: 18 },
], { placeOfSupply: "INTRA" });
assertEqual(serviceResult.total_cgst, 90, "gstCalculator.computeTotals INTRA: CGST");
assertEqual(serviceResult.total_sgst, 90, "gstCalculator.computeTotals INTRA: SGST");
assertEqual(serviceResult.total_igst, 0, "gstCalculator.computeTotals INTRA: IGST");

const serviceResultInter = calc.computeTotals([
  { taxable_value: 1000, gst_rate_pct: 18 },
], { placeOfSupply: "INTER" });
assertEqual(serviceResultInter.total_cgst, 0, "gstCalculator.computeTotals INTER: CGST");
assertEqual(serviceResultInter.total_sgst, 0, "gstCalculator.computeTotals INTER: SGST");
assertEqual(serviceResultInter.total_igst, 180, "gstCalculator.computeTotals INTER: IGST");

// Test detectPlaceOfSupply (exported function)
assertEqual(detectPlaceOfSupply("MH", "MH").type, "INTRA", "detectPlaceOfSupply: Same codes");
assertEqual(detectPlaceOfSupply("MH", "KA").type, "INTER", "detectPlaceOfSupply: Different codes");
assertEqual(detectPlaceOfSupply("Maharashtra", "Karnataka").type, "INTER", "detectPlaceOfSupply: Names normalized");
assertEqual(detectPlaceOfSupply("Maharashtra", "MH").type, "INTRA", "detectPlaceOfSupply: Name vs code same");
assertEqual(detectPlaceOfSupply("", "MH").type, "UNKNOWN", "detectPlaceOfSupply: Missing supplier");
assertEqual(detectPlaceOfSupply("MH", "").type, "UNKNOWN", "detectPlaceOfSupply: Missing buyer");

// Test GstCalculatorService.detectPlace method
assertEqual(calc.detectPlace("MH", "MH").type, "INTRA", "GstCalculatorService.detectPlace: Same codes");
assertEqual(calc.detectPlace("MH", "KA").type, "INTER", "GstCalculatorService.detectPlace: Different codes");
assertEqual(calc.detectPlace("Maharashtra", "Karnataka").type, "INTER", "GstCalculatorService.detectPlace: Names normalized");
assertEqual(calc.detectPlace("Maharashtra", "MH").type, "INTRA", "GstCalculatorService.detectPlace: Name vs code same");
assertEqual(calc.detectPlace("", "MH").type, "UNKNOWN", "GstCalculatorService.detectPlace: Missing supplier");
assertEqual(calc.detectPlace("MH", "").type, "UNKNOWN", "GstCalculatorService.detectPlace: Missing buyer");

// Test that UNKNOWN results from service methods have correct reason
const svcMissingSupplier = calc.detectPlace("", "MH");
assertEqual(svcMissingSupplier.type, "UNKNOWN", "GstCalculatorService.detectPlace: Missing supplier - type");
if (svcMissingSupplier.type === "UNKNOWN") {
  assertEqual(svcMissingSupplier.reason, "MISSING_SUPPLIER", "GstCalculatorService.detectPlace: Missing supplier - reason");
}

const svcMissingBuyer = calc.detectPlace("MH", "");
assertEqual(svcMissingBuyer.type, "UNKNOWN", "GstCalculatorService.detectPlace: Missing buyer - type");
if (svcMissingBuyer.type === "UNKNOWN") {
  assertEqual(svcMissingBuyer.reason, "MISSING_BUYER", "GstCalculatorService.detectPlace: Missing buyer - reason");
}

console.log("\n=== Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}