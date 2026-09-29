export type GstPlaceOfSupply = "INTRA" | "INTER";

export type GstRounding = "NONE" | "HALF_UP" | "DOWN";

export type GstRate = 0 | 0.25 | 3 | 5 | 12 | 18 | 28;

export type LineItemTaxable = {
  line_id?: string;
  taxable_value: number;
  gst_rate_pct: GstRate | number;
  is_non_taxable?: boolean;
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

function round(value: number, mode: GstRounding = "HALF_UP"): number {
  if (mode === "NONE") return value;
  if (mode === "DOWN") return Math.floor(value * 100) / 100;
  return Math.round(value * 100) / 100;
}

export function splitLineGst(
  line: LineItemTaxable,
  cfg: GstConfig,
): GstLineSplit {
  const rate = Math.max(0, Number(line.gst_rate_pct) || 0);
  const taxable = Number(line.taxable_value) || 0;

  if (line.is_non_taxable || rate === 0) {
    return {
      line_id: line.line_id,
      taxable_value: taxable,
      gst_rate_pct: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      cess_amount: 0,
      line_total: taxable,
    };
  }

  const halfRate = rate / 2;
  const rounding = cfg.rounding ?? "HALF_UP";

  if (cfg.placeOfSupply === "INTRA") {
    const cgst = round((taxable * halfRate) / 100, rounding);
    const sgst = round((taxable * halfRate) / 100, rounding);
    return {
      line_id: line.line_id,
      taxable_value: taxable,
      gst_rate_pct: rate,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: 0,
      cess_amount: 0,
      line_total: round(taxable + cgst + sgst, rounding),
    };
  }

  const igst = round((taxable * rate) / 100, rounding);
  return {
    line_id: line.line_id,
    taxable_value: taxable,
    gst_rate_pct: rate,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: igst,
    cess_amount: 0,
    line_total: round(taxable + igst, rounding),
  };
}

export function calculateGstTotals(
  lines: LineItemTaxable[],
  cfg: GstConfig,
): GstTotals {
  const splits = lines.map((l) => splitLineGst(l, cfg));
  const sumTaxable = splits.reduce((s, l) => s + l.taxable_value, 0);
  const sumCgst = splits.reduce((s, l) => s + l.cgst_amount, 0);
  const sumSgst = splits.reduce((s, l) => s + l.sgst_amount, 0);
  const sumIgst = splits.reduce((s, l) => s + l.igst_amount, 0);
  const sumCess = splits.reduce((s, l) => s + (l.cess_amount ?? 0), 0);
  const sumTax = sumCgst + sumSgst + sumIgst + sumCess;
  const gross = sumTaxable + sumTax;
  const rounding = cfg.rounding ?? "HALF_UP";
  const rounded = round(gross, rounding);
  const diff = round(rounded - gross, "HALF_UP");

  return {
    lines: splits,
    total_taxable: round(sumTaxable, "HALF_UP"),
    total_cgst: round(sumCgst, "HALF_UP"),
    total_sgst: round(sumSgst, "HALF_UP"),
    total_igst: round(sumIgst, "HALF_UP"),
    total_cess: round(sumCess, "HALF_UP"),
    total_tax: round(sumTax, "HALF_UP"),
    gross_total: round(gross, "HALF_UP"),
    round_off_applied: diff,
    grand_total: round(rounded, "HALF_UP"),
    place_of_supply: cfg.placeOfSupply,
    rounding,
  };
}

export function detectPlaceOfSupply(
  supplierStateCode?: string | null,
  placeOfDeliveryStateCode?: string | null,
): GstPlaceOfSupply {
  if (!supplierStateCode || !placeOfDeliveryStateCode) return "INTRA";
  return supplierStateCode === placeOfDeliveryStateCode ? "INTRA" : "INTER";
}

export function formatGstRate(rate: number): string {
  if (!rate || rate <= 0) return "Exempt";
  const n = Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/\.?0+$/, "");
  return `${n}%`;
}

export class GstCalculatorService {
  constructor(private readonly defaultConfig: Partial<GstConfig> = {}) {}

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
  ): GstPlaceOfSupply {
    return detectPlaceOfSupply(supplierStateCode, buyerStateCode);
  }
}

export const gstCalculator = new GstCalculatorService({
  placeOfSupply: "INTRA",
  rounding: "HALF_UP",
  defaultState: "Maharashtra",
});
