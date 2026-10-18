export type PurchaseLineTotals = {
    gross: number;
    discount_amount: number;
    gst_amount: number;
    line_total: number;
};

export type PurchaseInvoiceTotals = {
    gross_amount: number;
    total_discount: number;
    total_tax: number;
    round_off: number;
    net_amount: number;
};

function round2(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
}

export function calculatePurchaseLineTotals(line: {
    quantity: number | string | null | undefined;
    purchase_rate: number | string | null | undefined;
    discount_pct: number | string | null | undefined;
    gst_rate: number | string | null | undefined;
}): PurchaseLineTotals {
    const quantity = Number(line.quantity ?? 0);
    const rate = Number(line.purchase_rate ?? 0);
    const discountPct = Number(line.discount_pct ?? 0);
    const gstPct = Number(line.gst_rate ?? 0);
    const gross = round2(quantity * rate);
    const discount_amount = round2(gross * (discountPct / 100));
    const taxable = round2(gross - discount_amount);
    const gst_amount = round2(taxable * (gstPct / 100));
    const line_total = round2(taxable + gst_amount);
    return { gross, discount_amount, gst_amount, line_total };
}

export function calculatePurchaseInvoiceTotals(lines: PurchaseLineTotals[]): PurchaseInvoiceTotals {
    const gross_amount = round2(lines.reduce((sum, line) => sum + line.gross, 0));
    const total_discount = round2(lines.reduce((sum, line) => sum + line.discount_amount, 0));
    const total_tax = round2(lines.reduce((sum, line) => sum + line.gst_amount, 0));
    const subtotal = round2(gross_amount - total_discount + total_tax);
    const rounded = Math.round(subtotal);
    const round_off = round2(rounded - subtotal);
    const net_amount = round2(subtotal + round_off);
    return { gross_amount, total_discount, total_tax, round_off, net_amount };
}
