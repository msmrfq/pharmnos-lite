const STATE_DEFINITIONS = [
    ["Andhra Pradesh", "AP"],
    ["Arunachal Pradesh", "AR"],
    ["Assam", "AS"],
    ["Bihar", "BR"],
    ["Chhattisgarh", "CG"],
    ["Goa", "GA"],
    ["Gujarat", "GJ"],
    ["Haryana", "HR"],
    ["Himachal Pradesh", "HP"],
    ["Jharkhand", "JH"],
    ["Karnataka", "KA"],
    ["Kerala", "KL"],
    ["Madhya Pradesh", "MP"],
    ["Maharashtra", "MH"],
    ["Manipur", "MN"],
    ["Meghalaya", "ML"],
    ["Mizoram", "MZ"],
    ["Nagaland", "NL"],
    ["Odisha", "OD"],
    ["Punjab", "PB"],
    ["Rajasthan", "RJ"],
    ["Sikkim", "SK"],
    ["Tamil Nadu", "TN"],
    ["Telangana", "TG"],
    ["Tripura", "TR"],
    ["Uttar Pradesh", "UP"],
    ["Uttarakhand", "UT"],
    ["West Bengal", "WB"],
    ["Andaman and Nicobar Islands", "AN"],
    ["Chandigarh", "CH"],
    ["Dadra and Nagar Haveli and Daman and Diu", "DD"],
    ["Delhi", "DL"],
    ["Jammu and Kashmir", "JK"],
    ["Ladakh", "LA"],
    ["Lakshadweep", "LD"],
    ["Puducherry", "PY"],
] as const;

const normalizeStateLabel = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const STATE_NAME_TO_CODE = Object.freeze(
    Object.fromEntries(
        STATE_DEFINITIONS.map(([name, code]) => [normalizeStateLabel(name), code]),
    ) as Record<string, string>,
);

export const STATE_CODE_TO_NAME = Object.freeze(
    Object.fromEntries(
        STATE_DEFINITIONS.map(([name, code]) => [code, name]),
    ) as Record<string, string>,
);

export const VALID_STATE_CODES = Object.freeze(
    Array.from(new Set(Object.values(STATE_NAME_TO_CODE))).sort(),
);

/**
 * GSTIN prefix mapping used by this application.
 *
 * Prefixes 01-38 are the supported state/UT prefix set. Prefixes 25, 26, and
 * 28 are retained as historical inputs and normalized to the current internal
 * state representation where the application has only one canonical value.
 * This is intentionally a lossy application normalization, not a claim that
 * historical GSTIN prefixes are interchangeable or that the GSTIN is valid.
 *
 * Prefixes 97 (Other Territory) and 99 (OIDAR) are special-purpose prefixes,
 * not physical Indian state/UT values, and therefore remain unsupported for
 * state normalization and place-of-supply decisions.
 *
 * The supplied GST Portal July 2025 report and CBIC January 2024 customs
 * advisory are recorded in the GST audit-validation specification. Neither
 * was text-extractable in this environment as a complete authoritative
 * historical prefix table, so uncertain mappings remain unchanged.
 */
const GSTIN_STATE_PREFIX_TO_CODE: Record<string, string> = {
    "01": "JK", // Jammu & Kashmir
    "02": "HP", // Himachal Pradesh
    "03": "PB", // Punjab
    "04": "CH", // Chandigarh
    "05": "UT", // Uttarakhand
    "06": "HR", // Haryana
    "07": "DL", // Delhi
    "08": "RJ", // Rajasthan
    "09": "UP", // Uttar Pradesh
    "10": "BR", // Bihar
    "11": "SK", // Sikkim
    "12": "AR", // Arunachal Pradesh
    "13": "NL", // Nagaland
    "14": "MN", // Manipur
    "15": "MZ", // Mizoram
    "16": "TR", // Tripura
    "17": "ML", // Meghalaya
    "18": "AS", // Assam
    "19": "WB", // West Bengal
    "20": "JH", // Jharkhand
    "21": "OD", // Odisha
    "22": "CG", // Chhattisgarh
    "23": "MP", // Madhya Pradesh
    "24": "GJ", // Gujarat
    "25": "DD", // Daman & Diu (merged)
    "26": "DD", // Dadra & Nagar Haveli (merged)
    "27": "MH", // Maharashtra
    "28": "AP", // Andhra Pradesh (old, pre-bifurcation)
    "29": "KA", // Karnataka
    "30": "GA", // Goa
    "31": "LD", // Lakshadweep
    "32": "KL", // Kerala
    "33": "TN", // Tamil Nadu
    "34": "PY", // Puducherry
    "35": "AN", // Andaman & Nicobar Islands
    "36": "TG", // Telangana
    "37": "AP", // Andhra Pradesh (new, post-bifurcation)
    "38": "LA", // Ladakh
};

export const UNSUPPORTED_GSTIN_STATE_PREFIXES = Object.freeze(["97", "99"]);

const GSTIN_FORMAT_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

export function normalizeState(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    const upper = raw.toUpperCase();
    if (/^[A-Z]{2}$/.test(upper) && VALID_STATE_CODES.includes(upper)) {
        return upper;
    }

    const normalizedName = normalizeStateLabel(raw);
    return STATE_NAME_TO_CODE[normalizedName] ?? null;
}

export function isValidStateCode(value: string | null | undefined): boolean {
    return normalizeState(value) !== null && /^[A-Z]{2}$/.test(String(value ?? "").trim().toUpperCase());
}

export function getStateName(code: string | null | undefined): string | null {
    if (code === null || code === undefined) return null;
    const normalized = normalizeState(code);
    if (!normalized) return null;
    return STATE_CODE_TO_NAME[normalized] ?? null;
}

export function getStateCodeFromGstin(gstin: string | null | undefined): string | null {
    if (gstin === null || gstin === undefined) return null;

    const cleaned = String(gstin).trim().toUpperCase();
    if (!GSTIN_FORMAT_REGEX.test(cleaned)) return null;

    const statePrefix = cleaned.slice(0, 2);
    return GSTIN_STATE_PREFIX_TO_CODE[statePrefix] ?? null;
}

/**
 * Result of place-of-supply determination.
 * - "INTRA": Both states resolved and are the same (intra-state supply, CGST+SGST).
 * - "INTER": Both states resolved and are different (inter-state supply, IGST).
 * - "UNKNOWN": One or both states could not be resolved; caller MUST handle explicitly.
 *   This prevents silent misclassification of tax liability.
 */
export type PlaceOfSupplyResult =
    | { type: "INTRA" }
    | { type: "INTER" }
    | { type: "UNKNOWN"; reason: "MISSING_SUPPLIER" | "MISSING_BUYER" | "INVALID_SUPPLIER" | "INVALID_BUYER" | "BOTH_INVALID" };

export function determinePlaceOfSupply(
    supplierState?: string | null,
    buyerState?: string | null,
): PlaceOfSupplyResult {
    const supplier = normalizeState(supplierState);
    const buyer = normalizeState(buyerState);

    const supplierMissing = supplierState === null || supplierState === undefined || String(supplierState).trim() === "";
    const buyerMissing = buyerState === null || buyerState === undefined || String(buyerState).trim() === "";
    const supplierInvalid = !supplierMissing && !supplier;
    const buyerInvalid = !buyerMissing && !buyer;

    if (supplierMissing && buyerMissing) {
        return { type: "UNKNOWN", reason: "BOTH_INVALID" };
    }
    if (supplierMissing) {
        return { type: "UNKNOWN", reason: "MISSING_SUPPLIER" };
    }
    if (buyerMissing) {
        return { type: "UNKNOWN", reason: "MISSING_BUYER" };
    }
    if (supplierInvalid && buyerInvalid) {
        return { type: "UNKNOWN", reason: "BOTH_INVALID" };
    }
    if (supplierInvalid) {
        return { type: "UNKNOWN", reason: "INVALID_SUPPLIER" };
    }
    if (buyerInvalid) {
        return { type: "UNKNOWN", reason: "INVALID_BUYER" };
    }

    return supplier === buyer ? { type: "INTRA" } : { type: "INTER" };
}
