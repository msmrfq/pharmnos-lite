import { calculatePurchaseLineGst } from "@/domain/services/purchase-calculator.service";
import { Decimal } from "@/lib/decimal";

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
  line_calculations?: PurchaseLineGstExpected[];
  amounts: PurchaseGstAmountFacts;
};

export type PurchaseLineGstExpected = {
  hsn_sac_code: string | null;
  hsn_sac_catalog_id: string | null;
  rule_version: string;
  rule_source_reference: string | null;
  amounts: {
    taxable_value: PurchaseSourceAmount;
    cgst: PurchaseSourceAmount;
    sgst: PurchaseSourceAmount;
    igst: PurchaseSourceAmount;
    cess: PurchaseSourceAmount;
    line_total: PurchaseSourceAmount;
  };
};

export type PurchaseLineGstEvidence = {
    taxable_value: PurchaseSourceAmount | null;
    cgst: PurchaseSourceAmount | null;
    sgst: PurchaseSourceAmount | null;
    igst: PurchaseSourceAmount | null;
    cess: PurchaseSourceAmount | null;
    line_total: PurchaseSourceAmount | null;
};

export function reconcilePurchaseGstLineEvidence(
  declared: PurchaseLineGstEvidence,
  calculated: PurchaseLineGstExpected["amounts"],
) {
  const fields: Array<keyof PurchaseLineGstEvidence> = [
    "taxable_value",
    "cgst",
    "sgst",
    "igst",
    "cess",
    "line_total",
  ];
  const differingFields = fields.filter((field) => {
    const declaredValue = declared[field];
    const calculatedValue = calculated[field];
    if (declaredValue === null || calculatedValue === null) return true;
    return amountsMatch(declaredValue, calculatedValue) !== "MATCHED";
  });
  return {
    status: differingFields.length === 0 ? "MATCHED" : "DISCREPANCY_REQUIRES_REVIEW",
    differing_fields: differingFields,
  } as const;
}

export type PurchaseGstSupplyFacts = {
  supplier_state_at_transaction: string;
  recipient_state_at_transaction: string;
  delivery_state_at_transaction: string;
  supply_scenario: "INTRA_STATE" | "INTER_STATE";
};

type PurchaseCalculationLine = {
  quantity: number | string | null | undefined;
  purchase_rate: number | string | null | undefined;
  discount_pct: number | string | null | undefined;
  gst_rate: number | string | null | undefined;
  hsn_sac_code?: string | null;
  hsn_sac_catalog_id?: string | null;
  rule_version?: string;
  rule_source_reference?: string | null;
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
  lines: PurchaseCalculationLine[],
): CalculatedPurchaseGstExpected {
  if (lines.length === 0) {
    throw new Error("Purchase GST calculation is blocked: governed purchase lines are required.");
  }
  for (const [index, line] of lines.entries()) {
    const quantity = Number(line.quantity);
    const rate = Number(line.purchase_rate);
    const discountPct = Number(line.discount_pct);
    const gstRate = Number(line.gst_rate);
    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(rate) ||
      !Number.isFinite(discountPct) ||
      !Number.isFinite(gstRate) ||
      quantity < 0 ||
      rate < 0 ||
      discountPct < 0 ||
      discountPct > 100 ||
      gstRate < 0 ||
      !line.hsn_sac_code?.trim() ||
      !line.hsn_sac_catalog_id?.trim() ||
      !line.rule_version?.trim() ||
      !line.rule_source_reference?.trim()
    ) {
      throw new Error(`Purchase GST calculation is blocked: line ${index + 1} lacks complete governed facts.`);
    }
  }
  const lineCalculations = lines.map((line) => {
    const lineGst = calculatePurchaseLineGst(line, facts.supply_scenario);
    return {
      hsn_sac_code: line.hsn_sac_code ?? null,
      hsn_sac_catalog_id: line.hsn_sac_catalog_id ?? null,
      rule_version: line.rule_version?.trim() || "UNRESOLVED",
      rule_source_reference: line.rule_source_reference ?? null,
      amounts: {
        taxable_value: lineGst.taxable_value,
        cgst: lineGst.cgst,
        sgst: lineGst.sgst,
        igst: lineGst.igst,
        cess: lineGst.cess,
        line_total: lineGst.line_total,
      },
    };
  });
  const lineTotals = lineCalculations.reduce<{
    taxableValue: Decimal;
    cgst: Decimal;
    sgst: Decimal;
    igst: Decimal;
    lineTotal: Decimal;
  }>((totals, line) => ({
    taxableValue: totals.taxableValue.add(line.amounts.taxable_value),
    cgst: totals.cgst.add(line.amounts.cgst),
    sgst: totals.sgst.add(line.amounts.sgst),
    igst: totals.igst.add(line.amounts.igst),
    lineTotal: totals.lineTotal.add(line.amounts.line_total),
  }), {
    taxableValue: Decimal.zero(),
    cgst: Decimal.zero(),
    sgst: Decimal.zero(),
    igst: Decimal.zero(),
    lineTotal: Decimal.zero(),
  });
  const taxableValue = lineTotals.taxableValue.round(2, "HALF_UP");
  const aggregateTax = lineTotals.cgst
    .add(lineTotals.sgst)
    .add(lineTotals.igst)
    .round(2, "HALF_UP");
  const isIntraState = facts.supply_scenario === "INTRA_STATE";
  const ruleVersions = [...new Set(lineCalculations.map((line) => line.rule_version))];
  const calculatedLineTotal = lineTotals.lineTotal.round(2, "HALF_UP");
  const calculatedRoundOff = Decimal.from(totals.round_off).round(2, "HALF_UP");
  return {
    rule_version: ruleVersions.length === 0
      ? "purchase-gst-rules-v1"
      : ruleVersions.length === 1
        ? ruleVersions[0] ?? "UNRESOLVED"
        : "MIXED",
    line_calculations: lineCalculations,
    amounts: {
      taxable_value: taxableValue.toNumber(),
      cgst: isIntraState
        ? lineTotals.cgst.round(2, "HALF_UP").toNumber()
        : 0,
      sgst: isIntraState
        ? lineTotals.sgst.round(2, "HALF_UP").toNumber()
        : 0,
      igst: isIntraState ? 0 : aggregateTax.toNumber(),
      cess: 0,
      invoice_total: calculatedLineTotal.add(calculatedRoundOff).round(2, "HALF_UP").toNumber(),
      round_off: calculatedRoundOff.toNumber(),
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
    }) &&
    Number(accepted.amounts.cess ?? 0) === 0;
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
