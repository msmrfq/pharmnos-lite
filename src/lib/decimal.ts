export type DecimalInput = Decimal | bigint | number | string;
export type DecimalRoundingMode = "NONE" | "HALF_UP" | "DOWN";

export const DECIMAL_CALCULATION_SCALE = 18;

const POWERS_OF_TEN: bigint[] = [1n];

function powerOfTen(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error("Decimal scale must be a non-negative integer.");
  }
  for (let index = POWERS_OF_TEN.length; index <= scale; index += 1) {
    POWERS_OF_TEN[index] = POWERS_OF_TEN[index - 1]! * 10n;
  }
  return POWERS_OF_TEN[scale]!;
}

function normalize(coefficient: bigint, scale: number): { coefficient: bigint; scale: number } {
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  let normalizedScale = scale;
  let normalizedCoefficient = coefficient;
  while (normalizedScale > 0 && normalizedCoefficient % 10n === 0n) {
    normalizedCoefficient /= 10n;
    normalizedScale -= 1;
  }
  return { coefficient: normalizedCoefficient, scale: normalizedScale };
}

function parseDecimalString(value: string): { coefficient: bigint; scale: number } {
  const raw = value.trim();
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
  if (!match) throw new Error(`Invalid decimal value: ${value}`);

  const sign = match[1] === "-" ? -1n : 1n;
  const integerPart = match[2] ?? "0";
  const fractionPart = match[3] ?? "";
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent)) throw new Error(`Invalid decimal exponent: ${value}`);

  const digits = BigInt(`${integerPart}${fractionPart}`) * sign;
  const scale = fractionPart.length - exponent;
  if (scale >= 0) return normalize(digits, scale);
  return normalize(digits * powerOfTen(-scale), 0);
}

function roundedQuotient(numerator: bigint, denominator: bigint, mode: DecimalRoundingMode): bigint {
  if (denominator === 0n) throw new Error("Cannot divide by zero.");
  if (mode === "NONE") return numerator / denominator;

  const positiveDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) return quotient;

  if (mode === "DOWN") {
    const sameSign = (numerator < 0n) === (denominator < 0n);
    return sameSign ? quotient : quotient - 1n;
  }

  const shouldRoundAwayFromZero =
    (remainder < 0n ? -remainder : remainder) * 2n >= positiveDenominator;
  if (!shouldRoundAwayFromZero) return quotient;
  return quotient + ((numerator < 0n) === (denominator < 0n) ? 1n : -1n);
}

function formatCoefficient(coefficient: bigint, scale: number, fixed: boolean): string {
  const negative = coefficient < 0n;
  const digits = (negative ? -coefficient : coefficient).toString();
  if (scale === 0) return `${negative ? "-" : ""}${digits}`;

  const padded = digits.padStart(scale + 1, "0");
  const splitAt = padded.length - scale;
  const integerPart = padded.slice(0, splitAt);
  const fractionPart = padded.slice(splitAt);
  const formatted = `${integerPart}.${fractionPart}`;
  if (fixed) return `${negative ? "-" : ""}${formatted}`;
  const trimmedFraction = fractionPart.replace(/0+$/, "");
  return `${negative ? "-" : ""}${trimmedFraction ? `${integerPart}.${trimmedFraction}` : integerPart}`;
}

export class Decimal {
  readonly coefficient: bigint;
  readonly scale: number;

  private constructor(coefficient: bigint, scale: number) {
    const normalized = normalize(coefficient, scale);
    this.coefficient = normalized.coefficient;
    this.scale = normalized.scale;
  }

  static from(value: DecimalInput): Decimal {
    if (value instanceof Decimal) return value;
    if (typeof value === "bigint") return new Decimal(value, 0);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error(`Invalid decimal number: ${value}`);
      return Decimal.from(String(value));
    }
    const parsed = parseDecimalString(value);
    return new Decimal(parsed.coefficient, parsed.scale);
  }

  static zero(): Decimal {
    return new Decimal(0n, 0);
  }

  static tryFrom(value: DecimalInput | null | undefined): Decimal | null {
    if (value === null || value === undefined || value === "") return null;
    try {
      return Decimal.from(value);
    } catch (error) {
      if (error instanceof Error) return null;
      throw error;
    }
  }

  add(value: DecimalInput): Decimal {
    const other = Decimal.from(value);
    const scale = Math.max(this.scale, other.scale);
    const coefficient =
      this.coefficient * powerOfTen(scale - this.scale) +
      other.coefficient * powerOfTen(scale - other.scale);
    return new Decimal(coefficient, scale);
  }

  subtract(value: DecimalInput): Decimal {
    return this.add(Decimal.from(value).negate());
  }

  multiply(value: DecimalInput): Decimal {
    const other = Decimal.from(value);
    return new Decimal(this.coefficient * other.coefficient, this.scale + other.scale);
  }

  divide(
    value: DecimalInput,
    scale = DECIMAL_CALCULATION_SCALE,
    mode: DecimalRoundingMode = "HALF_UP",
  ): Decimal {
    const other = Decimal.from(value);
    if (other.coefficient === 0n) throw new Error("Cannot divide by zero.");
    if (!Number.isInteger(scale) || scale < 0) {
      throw new Error("Decimal division scale must be a non-negative integer.");
    }

    const exponent = other.scale + scale - this.scale;
    let numerator = this.coefficient;
    let denominator = other.coefficient;
    if (exponent >= 0) numerator *= powerOfTen(exponent);
    else denominator *= powerOfTen(-exponent);
    return new Decimal(roundedQuotient(numerator, denominator, mode), scale);
  }

  round(scale: number, mode: DecimalRoundingMode = "HALF_UP"): Decimal {
    if (!Number.isInteger(scale) || scale < 0) {
      throw new Error("Decimal rounding scale must be a non-negative integer.");
    }
    if (mode === "NONE" || scale >= this.scale) return this;

    const divisor = powerOfTen(this.scale - scale);
    return new Decimal(roundedQuotient(this.coefficient, divisor, mode), scale);
  }

  negate(): Decimal {
    return new Decimal(-this.coefficient, this.scale);
  }

  abs(): Decimal {
    return this.coefficient < 0n ? this.negate() : this;
  }

  isZero(): boolean {
    return this.coefficient === 0n;
  }

  isNegative(): boolean {
    return this.coefficient < 0n;
  }

  compare(value: DecimalInput): -1 | 0 | 1 {
    const other = Decimal.from(value);
    const scale = Math.max(this.scale, other.scale);
    const left = this.coefficient * powerOfTen(scale - this.scale);
    const right = other.coefficient * powerOfTen(scale - other.scale);
    if (left === right) return 0;
    return left < right ? -1 : 1;
  }

  toString(): string {
    return formatCoefficient(this.coefficient, this.scale, false);
  }

  toFixed(scale: number, mode: DecimalRoundingMode = "HALF_UP"): string {
    const rounded = this.round(scale, mode);
    const fixedCoefficient = rounded.coefficient * powerOfTen(scale - rounded.scale);
    return formatCoefficient(fixedCoefficient, scale, true);
  }

  toNumber(): number {
    return Number(this.toString());
  }
}

export function decimalOrZero(value: DecimalInput | null | undefined): Decimal {
  return Decimal.tryFrom(value) ?? Decimal.zero();
}

export function sumDecimals(values: Iterable<DecimalInput>): Decimal {
  let total = Decimal.zero();
  for (const value of values) total = total.add(value);
  return total;
}

export function roundHalfUp(value: DecimalInput, scale = 2): Decimal {
  return Decimal.from(value).round(scale, "HALF_UP");
}

export function roundDown(value: DecimalInput, scale = 2): Decimal {
  return Decimal.from(value).round(scale, "DOWN");
}

export function roundSection170NearestRupee(value: DecimalInput): Decimal {
  return Decimal.from(value).round(0, "HALF_UP");
}
