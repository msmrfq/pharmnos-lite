import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | bigint | string, currency = "INR"): string {
  const num = typeof value === "string" ? Number(value) : Number(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

export function formatDate(input: Date | string | number, pattern = "PPP"): string {
  const date = typeof input === "object" ? input : new Date(input);
  if (pattern === "PPP") {
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  if (pattern === "PP") {
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return date.toLocaleString("en-IN");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function generateInvoiceNo(prefix: string, seq: number, width = 5): string {
  return `${prefix}-${String(seq).padStart(width, "0")}`;
}
