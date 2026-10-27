export type PurchaseSourceAmount = string | number;

export type PurchaseGstAmountFacts = {
  taxable_value: PurchaseSourceAmount | null;
  cgst: PurchaseSourceAmount | null;
  sgst: PurchaseSourceAmount | null;
  igst: PurchaseSourceAmount | null;
  cess: PurchaseSourceAmount | null;
  invoice_total: PurchaseSourceAmount | null;
  round_off: PurchaseSourceAmount | null;
};

export type SupplierDeclaredPurchaseGstEvidence = {
  source_document_reference: string | null;
  amounts: PurchaseGstAmountFacts;
};

export type CalculatedPurchaseGstExpected = {
  rule_version: string;
  amounts: PurchaseGstAmountFacts;
};

export type PurchaseGstSupplyFacts = {
  supplier_state_at_transaction: string;
  recipient_state_at_transaction: string;
  delivery_state_at_transaction: string;
  supply_scenario: "INTRA_STATE" | "INTER_STATE";
};

export function calculatePurchaseGstExpected(
  totals: {
    gross_amount: number;
    total_discount: number;
    total_tax: number;
    round_off: number;
    net_amount: number;
  },
  facts: PurchaseGstSupplyFacts,
): CalculatedPurchaseGstExpected {
  const taxableValue = Math.round((totals.gross_amount - totals.total_discount) * 100) / 100;
  const aggregateTax = Math.round(totals.total_tax * 100) / 100;
  const isIntraState = facts.supply_scenario === "INTRA_STATE";
  return {
    rule_version: "purchase-gst-rules-v1",
    amounts: {
      taxable_value: taxableValue,
      cgst: isIntraState ? Math.round((aggregateTax / 2) * 100) / 100 : 0,
      sgst: isIntraState ? Math.round((aggregateTax / 2) * 100) / 100 : 0,
      igst: isIntraState ? 0 : aggregateTax,
      cess: 0,
      invoice_total: Math.round(totals.net_amount * 100) / 100,
      round_off: Math.round(totals.round_off * 100) / 100,
    },
  };
}

export type AccountingAcceptedPurchaseGst = {
  amounts: PurchaseGstAmountFacts;
  source: "SUPPLIER_DECLARED" | "APPLICATION_CALCULATED" | "EXPLICIT_DECISION";
  decision_reference: string;
};

export type PurchaseGstReconciliationStatus =
  | "NOT_RECONCILED"
  | "MATCHED"
  | "DISCREPANCY_REQUIRES_REVIEW"
  | "RESOLVED";

export type PurchaseGstAmountField = keyof PurchaseGstAmountFacts;

export type PurchaseGstAmountComparison = {
  field: PurchaseGstAmountField;
  status: "MATCHED" | "MISSING" | "DIFFERENT" | "INVALID";
  declared: PurchaseSourceAmount | null;
  calculated: PurchaseSourceAmount | null;
};

export type PurchaseGstReconciliation = {
  status: PurchaseGstReconciliationStatus;
  source_document_reference: string | null;
  rule_version: string | null;
  comparisons: PurchaseGstAmountComparison[];
  missing_fields: PurchaseGstAmountField[];
  differing_fields: PurchaseGstAmountField[];
  invalid_fields: PurchaseGstAmountField[];
  material_discrepancy: boolean;
};

export type PurchaseGstResolution = {
  decision_reference: string;
  decision: string;
  rationale: string;
  approved_by: string;
  resolved_at: string;
  accepted: AccountingAcceptedPurchaseGst;
};

export type ResolvedPurchaseGstReconciliation = PurchaseGstReconciliation & {
  status: "RESOLVED";
  resolution: PurchaseGstResolution;
};

export function notYetReconciledPurchaseGst(): PurchaseGstReconciliation {
  return {
    status: "NOT_RECONCILED",
    source_document_reference: null,
    rule_version: null,
    comparisons: [],
    missing_fields: [],
    differing_fields: [],
    invalid_fields: [],
    material_discrepancy: false,
  };
}

const AMOUNT_FIELDS: PurchaseGstAmountField[] = [
  "taxable_value",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "invoice_total",
  "round_off",
];

function isPresent(value: PurchaseSourceAmount | null): value is PurchaseSourceAmount {
  return value !== null;
}

function decimalText(value: PurchaseSourceAmount): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const text = Number.isInteger(value) ? String(value) : value.toPrecision(15);
    const scientific = text.match(/^([+-]?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i);
    if (!scientific) return text;
    const [, sign = "", integer = "", fraction = "", exponentText = "0"] = scientific;
    const digits = `${integer}${fraction}`;
    const decimalPosition = integer.length + Number(exponentText);
    if (decimalPosition <= 0) return `${sign}0.${"0".repeat(-decimalPosition)}${digits}`;
    if (decimalPosition >= digits.length) return `${sign}${digits}${"0".repeat(decimalPosition - digits.length)}`;
    return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
  }
  const trimmed = value.trim();
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed) ? trimmed : null;
}

function canonicalDecimal(value: PurchaseSourceAmount): string | null {
  const text = decimalText(value);
  if (text === null) return null;
  const sign = text.startsWith("-") ? "-" : "";
  const unsigned = text.replace(/^[-+]/, "");
  const [integerPart = "", fractionPart = ""] = unsigned.split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  const fraction = fractionPart.replace(/0+$/, "");
  const normalized = `${integer || "0"}${fraction ? `.${fraction}` : ""}`;
  return normalized === "0" ? "0" : `${sign}${normalized}`;
}

function amountsMatch(
  declared: PurchaseSourceAmount,
  calculated: PurchaseSourceAmount,
): "MATCHED" | "DIFFERENT" | "INVALID" {
  const declaredDecimal = canonicalDecimal(declared);
  const calculatedDecimal = canonicalDecimal(calculated);
  if (declaredDecimal === null || calculatedDecimal === null) return "INVALID";
  return declaredDecimal === calculatedDecimal ? "MATCHED" : "DIFFERENT";
}

export function reconcilePurchaseGstEvidence(
  declared: SupplierDeclaredPurchaseGstEvidence,
  calculated: CalculatedPurchaseGstExpected,
): PurchaseGstReconciliation {
  const ruleVersion = calculated.rule_version.trim();
  const comparisons: PurchaseGstAmountComparison[] = AMOUNT_FIELDS.map((field) => {
    const declaredValue = declared.amounts[field];
    const calculatedValue = calculated.amounts[field];

    if (!isPresent(declaredValue) || !isPresent(calculatedValue)) {
      return {
        field,
        status: "MISSING" as const,
        declared: declaredValue,
        calculated: calculatedValue,
      };
    }

    return {
      field,
      status: amountsMatch(declaredValue, calculatedValue),
      declared: declaredValue,
      calculated: calculatedValue,
    };
  });

  const missing_fields = comparisons
    .filter((comparison) => comparison.status === "MISSING")
    .map((comparison) => comparison.field);
  const differing_fields = comparisons
    .filter((comparison) => comparison.status === "DIFFERENT")
    .map((comparison) => comparison.field);
  const invalid_fields = comparisons
    .filter((comparison) => comparison.status === "INVALID")
    .map((comparison) => comparison.field);
  const material_discrepancy =
    !ruleVersion ||
    missing_fields.length > 0 ||
    differing_fields.length > 0 ||
    invalid_fields.length > 0;

  return {
    status: material_discrepancy
      ? "DISCREPANCY_REQUIRES_REVIEW"
      : "MATCHED",
    source_document_reference: declared.source_document_reference,
    rule_version: ruleVersion || null,
    comparisons,
    missing_fields,
    differing_fields,
    invalid_fields,
    material_discrepancy,
  };
}

function hasCompleteValidAcceptedAmounts(accepted: AccountingAcceptedPurchaseGst): boolean {
  return accepted.decision_reference.trim().length > 0 &&
    ["SUPPLIER_DECLARED", "APPLICATION_CALCULATED", "EXPLICIT_DECISION"].includes(accepted.source) &&
    AMOUNT_FIELDS.every((field) => {
    const value = accepted.amounts[field];
    return value !== null && canonicalDecimal(value) !== null;
    });
}

/**
 * Pure data guard only. Authorization and persistence-backed audit verification
 * remain responsibilities of the later accounting workflow.
 */
export function canCompletePurchaseAccounting(
  reconciliation: PurchaseGstReconciliation | ResolvedPurchaseGstReconciliation,
  accepted: AccountingAcceptedPurchaseGst | null,
): boolean {
  if (!accepted || !hasCompleteValidAcceptedAmounts(accepted)) return false;
  if (reconciliation.status === "MATCHED") return true;
  return reconciliation.status === "RESOLVED" &&
    "resolution" in reconciliation &&
    reconciliation.resolution.accepted.decision_reference === accepted.decision_reference;
}

export function resolvePurchaseGstReconciliation(
  reconciliation: PurchaseGstReconciliation,
  resolution: PurchaseGstResolution,
): ResolvedPurchaseGstReconciliation {
  if (reconciliation.status !== "DISCREPANCY_REQUIRES_REVIEW") {
    throw new Error("Only a review-required purchase GST discrepancy can be resolved.");
  }
  if (!reconciliation.rule_version) {
    throw new Error("A purchase GST discrepancy requires a calculation rule version.");
  }
  if (
    !resolution.decision_reference.trim() ||
    !resolution.decision.trim() ||
    !resolution.rationale.trim() ||
    !resolution.approved_by.trim() ||
    !resolution.resolved_at.trim() ||
    !resolution.accepted.decision_reference.trim() ||
    resolution.accepted.decision_reference !== resolution.decision_reference ||
    !hasCompleteValidAcceptedAmounts(resolution.accepted)
  ) {
    throw new Error("A purchase GST resolution requires auditable decision details.");
  }

  return {
    ...reconciliation,
    status: "RESOLVED",
    resolution: {
      ...resolution,
      accepted: {
        ...resolution.accepted,
        amounts: { ...resolution.accepted.amounts },
      },
    },
  };
}
