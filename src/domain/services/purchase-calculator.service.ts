import {
  DECIMAL_CALCULATION_SCALE,
  Decimal,
  decimalOrZero,
  sumDecimals,
} from "@/lib/decimal";

type PurchaseLineInput = {
  quantity: number | string | null | undefined;
  purchase_rate: number | string | null | undefined;
  discount_pct: number | string | null | undefined;
  gst_rate: number | string | null | undefined;
};

export type PurchaseLineTotals = {
  gross: number;
  discount_amount: number;
  gst_amount: number;
  line_total: number;
};

export type ExactPurchaseLineTotals = {
  gross: Decimal;
  discount_amount: Decimal;
  taxable_value: Decimal;
  gst_amount: Decimal;
  line_total: Decimal;
};

export type PurchaseInvoiceTotals = {
  gross_amount: number;
  total_discount: number;
  total_tax: number;
  round_off: number;
  net_amount: number;
};

export function round2(value: number): number {
  return Decimal.tryFrom(value)?.round(2, "HALF_UP").toNumber() ?? 0;
}

export type PurchaseLineGstCalculation = {
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gst_amount: number;
  line_total: number;
};

export type InclusivePurchaseLineGstCalculation = {
  supplier_declared_amount: Decimal;
  taxable_value: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  cess: Decimal;
  gst_amount: Decimal;
};

export function calculatePurchaseLineTotalsExact(line: PurchaseLineInput): ExactPurchaseLineTotals {
  const quantity = decimalOrZero(line.quantity);
  const rate = decimalOrZero(line.purchase_rate);
  const discountPct = decimalOrZero(line.discount_pct);
  const gstPct = decimalOrZero(line.gst_rate);
  const gross = quantity.multiply(rate);
  const discount_amount = gross.multiply(discountPct).divide(100, DECIMAL_CALCULATION_SCALE);
  const taxableValue = gross.subtract(discount_amount);
  const taxable_value = taxableValue.isNegative() ? Decimal.zero() : taxableValue;
  const gst_amount = taxable_value.multiply(gstPct).divide(100, DECIMAL_CALCULATION_SCALE);
  return {
    gross,
    discount_amount,
    taxable_value,
    gst_amount,
    line_total: taxable_value.add(gst_amount),
  };
}

export function calculatePurchaseLineGst(
  line: PurchaseLineInput,
  scenario: "INTRA_STATE" | "INTER_STATE",
): PurchaseLineGstCalculation {
  const exact = calculatePurchaseLineTotalsExact(line);
  const rate = decimalOrZero(line.gst_rate);
  const normalizedRate = rate.isNegative() ? Decimal.zero() : rate;
  const componentTax = exact.taxable_value
    .multiply(normalizedRate)
    .divide(100, DECIMAL_CALCULATION_SCALE);
  const halfComponentTax = componentTax.divide(2, DECIMAL_CALCULATION_SCALE);
  const intraState = scenario === "INTRA_STATE";
  const cgst = intraState ? halfComponentTax.round(2, "HALF_UP") : Decimal.zero();
  const sgst = intraState ? halfComponentTax.round(2, "HALF_UP") : Decimal.zero();
  const igst = intraState ? Decimal.zero() : componentTax.round(2, "HALF_UP");
  const taxableValue = exact.taxable_value.round(2, "HALF_UP");
  const gstAmount = sumDecimals([cgst, sgst, igst]).round(2, "HALF_UP");
  return {
    taxable_value: taxableValue.toNumber(),
    cgst: cgst.toNumber(),
    sgst: sgst.toNumber(),
    igst: igst.toNumber(),
    cess: 0,
    gst_amount: gstAmount.toNumber(),
    line_total: taxableValue.add(gstAmount).round(2, "HALF_UP").toNumber(),
  };
}

export function calculatePurchaseLineTotals(line: PurchaseLineInput): PurchaseLineTotals {
  const exact = calculatePurchaseLineTotalsExact(line);
  return {
    gross: exact.gross.round(2, "HALF_UP").toNumber(),
    discount_amount: exact.discount_amount.round(2, "HALF_UP").toNumber(),
    gst_amount: exact.gst_amount.round(2, "HALF_UP").toNumber(),
    line_total: exact.line_total.round(2, "HALF_UP").toNumber(),
  };
}

export function extractInclusivePurchaseLineGst(
  line: {
    inclusive_amount: number | string;
    gst_rate: number | string | null | undefined;
  },
  scenario: "INTRA_STATE" | "INTER_STATE",
): InclusivePurchaseLineGstCalculation {
  const supplierDeclaredAmount = Decimal.from(line.inclusive_amount);
  const rate = decimalOrZero(line.gst_rate);
  const normalizedRate = rate.isNegative() ? Decimal.zero() : rate;
  const taxableValue = supplierDeclaredAmount
    .multiply(100)
    .divide(Decimal.from(100).add(normalizedRate), DECIMAL_CALCULATION_SCALE);
  const gstAmount = supplierDeclaredAmount.subtract(taxableValue);
  const componentTax = taxableValue
    .multiply(normalizedRate)
    .divide(100, DECIMAL_CALCULATION_SCALE);
  const halfComponentTax = componentTax.divide(2, DECIMAL_CALCULATION_SCALE);
  const intraState = scenario === "INTRA_STATE";
  return {
    supplier_declared_amount: supplierDeclaredAmount,
    taxable_value: taxableValue,
    cgst: intraState ? halfComponentTax : Decimal.zero(),
    sgst: intraState ? halfComponentTax : Decimal.zero(),
    igst: intraState ? Decimal.zero() : componentTax,
    cess: Decimal.zero(),
    gst_amount: gstAmount,
  };
}

export function roundCommercialInvoiceTotal(value: Decimal): Decimal {
  return value.round(0, "HALF_UP");
}

export function calculatePurchaseInvoiceTotals(lines: PurchaseLineTotals[]): PurchaseInvoiceTotals {
  const grossAmount = sumDecimals(lines.map((line) => line.gross)).round(2, "HALF_UP");
  const totalDiscount = sumDecimals(lines.map((line) => line.discount_amount)).round(2, "HALF_UP");
  const totalTax = sumDecimals(lines.map((line) => line.gst_amount)).round(2, "HALF_UP");
  const subtotal = grossAmount.subtract(totalDiscount).add(totalTax);
  const rounded = roundCommercialInvoiceTotal(subtotal);
  const roundOff = rounded.subtract(subtotal).round(2, "HALF_UP");
  const netAmount = subtotal.add(roundOff).round(2, "HALF_UP");
  return {
    gross_amount: grossAmount.toNumber(),
    total_discount: totalDiscount.toNumber(),
    total_tax: totalTax.toNumber(),
    round_off: roundOff.toNumber(),
    net_amount: netAmount.toNumber(),
  };
}
