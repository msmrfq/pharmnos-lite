import { createHash } from "node:crypto";

export const INVOICE_RENDERING_VERSION = "invoice-a4-landscape-v1";

export const PHARMNOS_PLATFORM_FOOTER = {
  attribution: "Printed with Pharmnos Lite",
  address: "Pharmnos Lite",
  supportEmail: "support@pharmnoslite.com",
  phone: "+91 00000 00000",
} as const;

export type InvoiceTaxSummary = {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
};

export function summarizeInvoiceTax(lines: Array<Partial<InvoiceTaxSummary>>): InvoiceTaxSummary {
  return lines.reduce<InvoiceTaxSummary>(
    (summary, line) => ({
      cgst: summary.cgst + Number(line.cgst ?? 0),
      sgst: summary.sgst + Number(line.sgst ?? 0),
      igst: summary.igst + Number(line.igst ?? 0),
      cess: summary.cess + Number(line.cess ?? 0),
    }),
    { cgst: 0, sgst: 0, igst: 0, cess: 0 },
  );
}

export function stableInvoiceReferences(invoiceId: string, invoiceNo: string): {
  qrPayload: string;
  barcodeValue: string;
} {
  const identity = `${invoiceId}:${invoiceNo}`;
  const digest = createHash("sha256").update(identity, "utf8").digest("hex").slice(0, 24);
  return {
    qrPayload: `pharmnos://invoice/${invoiceId}?ref=${digest}`,
    barcodeValue: invoiceNo,
  };
}

export function createImmutableInvoiceSnapshot(input: Record<string, unknown>): {
  snapshot: Record<string, unknown>;
  hash: string;
} {
  const snapshot = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  const canonical = JSON.stringify(snapshot);
  return {
    snapshot,
    hash: createHash("sha256").update(canonical, "utf8").digest("hex"),
  };
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount)) return "Amount unavailable";

  const raw = String(amount);
  const sign = raw.startsWith("-") ? "-" : "";
  const unsignedRaw = sign ? raw.slice(1) : raw;
  const [mantissa = "0", exponentText] = unsignedRaw.toLowerCase().split("e");
  const exponent = Number(exponentText ?? 0);
  const [wholePart, fractionPart = ""] = mantissa.split(".");
  const digits = `${wholePart}${fractionPart}`.replace(/^0+(?=\d)/, "") || "0";
  const decimalPlaces = fractionPart.length - exponent;
  const decimalIndex = digits.length - decimalPlaces;
  const wholeDigits = decimalIndex > 0 ? digits.slice(0, decimalIndex) : "0";
  const fractionDigits = decimalIndex > 0 ? digits.slice(decimalIndex) : `${"0".repeat(-decimalIndex)}${digits}`;
  let cents = `${fractionDigits}00`.slice(0, 2);
  if ((fractionDigits[2] ?? "0") >= "5") {
    cents = String(Number(cents) + 1).padStart(2, "0");
  }
  let normalizedWhole = BigInt(wholeDigits || "0");
  if (cents === "100") {
    normalizedWhole += 1n;
    cents = "00";
  }
  const fixed = `${sign}${normalizedWhole.toString()}.${cents}`;
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [rupees, paise] = unsigned.split(".");
  const rupeeValue = BigInt(rupees ?? "0");
  const paiseValue = Number(paise ?? "0");

  const belowThousand = (value: bigint): string => {
    const ones = [
      "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
      "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
      "seventeen", "eighteen", "nineteen",
    ];
    const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    const number = Number(value);
    if (number < 20) return ones[number] ?? "";
    if (number < 100) return `${tens[Math.floor(number / 10)] ?? ""}${number % 10 ? ` ${ones[number % 10] ?? ""}` : ""}`;
    return `${ones[Math.floor(number / 100)]} hundred${number % 100 ? ` ${belowThousand(BigInt(number % 100))}` : ""}`;
  };

  const groups: Array<[bigint, string]> = [
    [1000000000n, "arab"],
    [10000000n, "crore"],
    [100000n, "lakh"],
    [1000n, "thousand"],
    [1n, ""],
  ];
  const parts: string[] = [];
  let remainder = rupeeValue;
  for (const [unit, label] of groups) {
    const count = remainder / unit;
    if (count > 0n) {
      parts.push(`${belowThousand(count)}${label ? ` ${label}` : ""}`);
      remainder %= unit;
    }
  }
  const rupeeWords = parts.length ? parts.join(" ") : "zero";
  const paiseWords = paiseValue ? ` and ${belowThousand(BigInt(paiseValue))} paise` : "";
  return `${negative ? "minus " : ""}Indian Rupees ${rupeeWords}${paiseWords} only`;
}
