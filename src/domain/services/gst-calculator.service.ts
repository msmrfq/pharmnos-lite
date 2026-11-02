import { determinePlaceOfSupply, type PlaceOfSupplyResult } from "@/lib/constants/indian-states";
import {
  DECIMAL_CALCULATION_SCALE,
  Decimal,
  decimalOrZero,
  sumDecimals,
} from "@/lib/decimal";

export type GstPlaceOfSupply = "INTRA" | "INTER";

export type GstRounding = "NONE" | "HALF_UP" | "DOWN";

export type GstRate = 0 | 0.25 | 3 | 5 | 12 | 18 | 28;

export type LineItemTaxable = {
  line_id?: string;
  taxable_value: number;
  gst_rate_pct: GstRate | number;
  is_non_taxable?: boolean;
};

export type SalesGstLineInput = {
  quantity: number | string | null | undefined;
  sale_rate: number | string | null | undefined;
  gst_rate: number | string | null | undefined;
  trade_discount_pct?: number | string | null;
  discount_pct?: number | string | null;
};

export type GstLineSplit = {
  line_id?: string;
  taxable_value: number;
  gst_rate_pct: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount?: number;
  line_total: number;
};

export type PersistedSalesTaxFacts = {
  taxable_amount: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  line_total: number;
};

export type SalesLineAmounts = {
  gross_amount: number;
  discount_amount: number;
  taxable_value: number;
};

export type SalesSnapshotReadiness = {
  sellerName?: string | null;
  sellerState?: string | null;
  customerName?: string | null;
  customerState?: string | null;
  productNames: Array<string | null | undefined>;
};

export type SalesFinalizationFacts = SalesSnapshotReadiness & {
  placeOfSupplyCode?: string | null;
  lines: Array<{
    taxable_amount?: number | null;
    cgst_amount?: number | null;
    sgst_amount?: number | null;
    igst_amount?: number | null;
    cess_amount?: number | null;
  }>;
};

export function toPersistedSalesTaxFacts(line: GstLineSplit): PersistedSalesTaxFacts {
  const cess = decimalOrZero(line.cess_amount);
  const gst = sumDecimals([
    line.cgst_amount,
    line.sgst_amount,
    line.igst_amount,
    cess,
  ]).round(2, "HALF_UP");
  return {
    taxable_amount: line.taxable_value,
    gst_amount: gst.toNumber(),
    cgst_amount: line.cgst_amount,
    sgst_amount: line.sgst_amount,
    igst_amount: line.igst_amount,
    cess_amount: cess.toNumber(),
    line_total: line.line_total,
  };
}

export function hasCompleteSalesSnapshotFacts(input: SalesSnapshotReadiness): boolean {
  return Boolean(
    input.sellerName?.trim() &&
    input.sellerState?.trim() &&
    input.customerName?.trim() &&
    input.customerState?.trim() &&
    input.productNames.length > 0 &&
    input.productNames.every((name) => Boolean(name?.trim())),
  );
}

export function canMarkSalesInvoiceComplete(input: SalesFinalizationFacts): boolean {
  return Boolean(
    hasCompleteSalesSnapshotFacts(input) &&
    input.placeOfSupplyCode?.trim() &&
    input.lines.length > 0 &&
    input.lines.every((line) => [
      line.taxable_amount,
      line.cgst_amount,
      line.sgst_amount,
      line.igst_amount,
      line.cess_amount,
    ].every((value) => typeof value === "number" && Number.isFinite(value))),
  );
}

export function selectFinalizedInvoiceValue<T>(
  isComplete: boolean,
  snapshotValue: T | null | undefined,
  currentValue: T | null | undefined,
): T | null | undefined {
  return isComplete ? snapshotValue : currentValue;
}

export type InvoicePrintSnapshotInput = {
  tax_data_status?: string | null;
  seller_name_snapshot?: string | null;
  customer_name_snapshot?: string | null;
  place_of_supply_code?: string | null;
  customer?: { business_name?: string | null } | null;
  items?: Array<{
    product_name_snapshot?: string | null;
    generic_name_snapshot?: string | null;
    hsn_code_snapshot?: string | null;
    batch_expiry_snapshot?: Date | string | null;
    product?: {
      name?: string | null;
      generic_name?: string | null;
      hsn_code?: string | null;
    } | null;
    batch?: { expiry_date?: Date | string | null } | null;
  }>;
};

export function buildInvoicePrintSnapshot(
  invoice: InvoicePrintSnapshotInput,
  currentSellerName: string | null | undefined,
) {
  const isComplete = invoice.tax_data_status === "COMPLETE";
  const snapshot = <T,>(value: T | null | undefined, current: T | null | undefined) =>
    selectFinalizedInvoiceValue(isComplete, value, current);

  return {
    isComplete,
    sellerName: snapshot(invoice.seller_name_snapshot, currentSellerName),
    customerName: snapshot(invoice.customer_name_snapshot, invoice.customer?.business_name),
    placeOfSupply: invoice.place_of_supply_code ?? null,
    items: (invoice.items ?? []).map((item) => ({
      productName: snapshot(item.product_name_snapshot, item.product?.name),
      genericName: snapshot(item.generic_name_snapshot, item.product?.generic_name),
      hsnCode: snapshot(item.hsn_code_snapshot, item.product?.hsn_code),
      batchExpiry: snapshot(
        item.batch_expiry_snapshot,
        item.batch?.expiry_date ?? null,
      ),
    })),
  };
}

export type GstTotals = {
  lines: GstLineSplit[];
  total_taxable: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_cess: number;
  total_tax: number;
  gross_total: number;
  round_off_applied: number;
  grand_total: number;
  place_of_supply: GstPlaceOfSupply;
  rounding: GstRounding;
};

export type GstConfig = {
  placeOfSupply: GstPlaceOfSupply;
  rounding?: GstRounding;
  defaultState?: string;
};

// Re-export the PlaceOfSupplyResult type for callers that need to handle unresolved state
export type { PlaceOfSupplyResult };

function roundDecimal(value: Decimal, mode: GstRounding = "HALF_UP"): Decimal {
  return value.round(2, mode);
}

function calculateSalesLineAmountsExact(item: SalesGstLineInput): {
  gross: Decimal;
  discount_amount: Decimal;
  taxable_value: Decimal;
} {
  const quantity = decimalOrZero(item.quantity);
  const saleRate = decimalOrZero(item.sale_rate);
  const discountPct = decimalOrZero(item.trade_discount_pct ?? item.discount_pct);
  const gross = quantity.multiply(saleRate);
  const discount = gross.multiply(discountPct).divide(100, DECIMAL_CALCULATION_SCALE);
  const taxable = gross.subtract(discount);
  return {
    gross,
    discount_amount: discount,
    taxable_value: taxable.isNegative() ? Decimal.zero() : taxable,
  };
}

export function calculateSalesLineAmounts(item: SalesGstLineInput): SalesLineAmounts {
  const amounts = calculateSalesLineAmountsExact(item);
  return {
    gross_amount: amounts.gross.round(2, "HALF_UP").toNumber(),
    discount_amount: amounts.discount_amount.round(2, "HALF_UP").toNumber(),
    taxable_value: amounts.taxable_value.toNumber(),
  };
}

export function toTaxableGstLine(item: SalesGstLineInput): LineItemTaxable {
  const amounts = calculateSalesLineAmountsExact(item);

  return {
    taxable_value: amounts.taxable_value.toNumber(),
    gst_rate_pct: decimalOrZero(item.gst_rate).toNumber(),
  };
}

export function splitLineGst(
  line: LineItemTaxable,
  cfg: GstConfig,
): GstLineSplit {
  const inputRate = decimalOrZero(line.gst_rate_pct);
  const rate = inputRate.isNegative() ? Decimal.zero() : inputRate;
  const taxable = decimalOrZero(line.taxable_value);

  if (line.is_non_taxable || rate.isZero()) {
    return {
      line_id: line.line_id,
      taxable_value: taxable.toNumber(),
      gst_rate_pct: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      cess_amount: 0,
      line_total: taxable.toNumber(),
    };
  }

  const rounding = cfg.rounding ?? "HALF_UP";

  if (cfg.placeOfSupply === "INTRA") {
    const halfRate = rate.divide(2, DECIMAL_CALCULATION_SCALE);
    const componentTax = taxable
      .multiply(halfRate)
      .divide(100, DECIMAL_CALCULATION_SCALE);
    const cgst = roundDecimal(componentTax, rounding);
    const sgst = roundDecimal(componentTax, rounding);
    return {
      line_id: line.line_id,
      taxable_value: taxable.toNumber(),
      gst_rate_pct: rate.toNumber(),
      cgst_amount: cgst.toNumber(),
      sgst_amount: sgst.toNumber(),
      igst_amount: 0,
      cess_amount: 0,
      line_total: roundDecimal(taxable.add(cgst).add(sgst), rounding).toNumber(),
    };
  }

  const igst = roundDecimal(
    taxable.multiply(rate).divide(100, DECIMAL_CALCULATION_SCALE),
    rounding,
  );
  return {
    line_id: line.line_id,
    taxable_value: taxable.toNumber(),
    gst_rate_pct: rate.toNumber(),
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: igst.toNumber(),
    cess_amount: 0,
    line_total: roundDecimal(taxable.add(igst), rounding).toNumber(),
  };
}

export function calculateGstTotals(
  lines: LineItemTaxable[],
  cfg: GstConfig,
): GstTotals {
  const splits = lines.map((l) => splitLineGst(l, cfg));
  const sumTaxable = sumDecimals(splits.map((line) => line.taxable_value));
  const sumCgst = sumDecimals(splits.map((line) => line.cgst_amount));
  const sumSgst = sumDecimals(splits.map((line) => line.sgst_amount));
  const sumIgst = sumDecimals(splits.map((line) => line.igst_amount));
  const sumCess = sumDecimals(splits.map((line) => line.cess_amount ?? 0));
  const sumTax = sumDecimals([sumCgst, sumSgst, sumIgst, sumCess]);
  const gross = sumTaxable.add(sumTax);
  const rounding = cfg.rounding ?? "HALF_UP";
  const rounded = roundDecimal(gross, rounding);
  const diff = rounded.subtract(gross).round(2, "HALF_UP");

  return {
    lines: splits,
    total_taxable: sumTaxable.round(2, "HALF_UP").toNumber(),
    total_cgst: sumCgst.round(2, "HALF_UP").toNumber(),
    total_sgst: sumSgst.round(2, "HALF_UP").toNumber(),
    total_igst: sumIgst.round(2, "HALF_UP").toNumber(),
    total_cess: sumCess.round(2, "HALF_UP").toNumber(),
    total_tax: sumTax.round(2, "HALF_UP").toNumber(),
    gross_total: gross.round(2, "HALF_UP").toNumber(),
    round_off_applied: diff.toNumber(),
    grand_total: rounded.round(2, "HALF_UP").toNumber(),
    place_of_supply: cfg.placeOfSupply,
    rounding,
  };
}

export function detectPlaceOfSupply(
  supplierStateCode?: string | null,
  placeOfDeliveryStateCode?: string | null,
): PlaceOfSupplyResult {
  return determinePlaceOfSupply(supplierStateCode, placeOfDeliveryStateCode);
}

export function requireResolvedPlaceOfSupply(result: PlaceOfSupplyResult): GstPlaceOfSupply {
  if (result.type === "UNKNOWN") {
    throw new Error("Cannot finalize invoice until supplier and customer states are valid.");
  }
  return result.type;
}

export function formatGstRate(rate: number): string {
  if (!rate || rate <= 0) return "Exempt";
  const n = Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/\.?0+$/, "");
  return `${n}%`;
}

export class GstCalculatorService {
  private readonly defaultConfig: Partial<GstConfig>;

  constructor(defaultConfig: Partial<GstConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  computeLine(line: LineItemTaxable, override: Partial<GstConfig> = {}): GstLineSplit {
    return splitLineGst(line, {
      placeOfSupply: this.defaultConfig.placeOfSupply ?? "INTRA",
      rounding: this.defaultConfig.rounding ?? "HALF_UP",
      defaultState: this.defaultConfig.defaultState,
      ...override,
    });
  }

  computeTotals(
    lines: LineItemTaxable[],
    override: Partial<GstConfig> = {},
  ): GstTotals {
    return calculateGstTotals(lines, {
      placeOfSupply: this.defaultConfig.placeOfSupply ?? "INTRA",
      rounding: this.defaultConfig.rounding ?? "HALF_UP",
      defaultState: this.defaultConfig.defaultState,
      ...override,
    });
  }

  detectPlace(
    supplierStateCode?: string | null,
    buyerStateCode?: string | null,
  ): PlaceOfSupplyResult {
    return detectPlaceOfSupply(supplierStateCode, buyerStateCode);
  }
}

export const gstCalculator = new GstCalculatorService({
  placeOfSupply: "INTRA",
  rounding: "HALF_UP",
});
