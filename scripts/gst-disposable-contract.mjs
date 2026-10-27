import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_PATH = ".obsidian-vault/specs/gst-audit-validation-and-plan.md";
const REQUIRED_IDS = Array.from({ length: 20 }, (_, index) =>
    `GST-${String(index + 1).padStart(3, "0")}`);
const EVIDENCE_LEVELS = Object.freeze({
    "GST-014": "APPLICATION_PATH_DATABASE_E2E",
    "GST-015": "APPLICATION_PATH_DATABASE_E2E",
    "GST-016": "APPLICATION_PATH_DATABASE_E2E",
});

const REQUIREMENTS = Object.freeze([
    ["GST-001", "Canonical sales GST calculation", "Implemented and verified", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-002", "Component-wise rounding and preview/server parity", "Implemented and verified", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-003", "Discount normalization", "Implemented and verified", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-004", "State name/code normalization", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-005", "Fail-closed place-of-supply handling", "Implemented and verified", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-006", "Sales tax-component persistence", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-007", "Sales place-of-supply persistence", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-008", "Purchase intra/inter-state GST calculation", "Outstanding", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-009", "Purchase tax-component persistence", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-010", "Business-profile state validation", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-011", "Historical invoice tax integrity and printing", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-012", "Schema and historical-data strategy", "Outstanding legacy-data decision remains", "BLOCKED"],
    ["GST-013", "Purchase GST regression coverage", "Partially implemented / limited", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-014", "Rollback and ledger consistency", "Real finalizeSalesInvoiceAction rollback and persisted-state assertions passed", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-015", "Invoice-sequence rollback", "Real finalizePurchaseAction rollback and persisted-state assertions passed", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-016", "Historical invoice immutability", "Authenticated print data path, snapshot fidelity, missing-snapshot handling, and finalized mutation protection passed", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-017", "Authoritative GSTIN prefix verification", "Unclear — further evidence required", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-018", "Special-prefix handling for 97/99", "Deferred by explicit decision", "BLOCKED"],
    ["GST-019", "Financial E2E infrastructure", "Blocked pending prerequisites", "EXECUTABLE_DB_PREFLIGHT"],
    ["GST-020", "Financial E2E execution", "Blocked pending prerequisites", "BLOCKED"],
].map(([id, title, sourceStatus, executionStatus]) => Object.freeze({
    id,
    title,
    source: PLAN_PATH,
    sourceStatus,
    executionStatus,
    evidenceLevel: EVIDENCE_LEVELS[id] ?? "PURE_OR_SCHEMA_CONTRACT",
})));

export function getGstContract() {
    return REQUIREMENTS;
}

export function validateGstContract(contract = REQUIREMENTS) {
    const errors = [];
    if (!Array.isArray(contract) || contract.length !== REQUIRED_IDS.length) {
        errors.push("The GST contract must contain exactly GST-001 through GST-020.");
        return { ok: false, errors };
    }
    const ids = contract.map((entry) => entry?.id);
    if (JSON.stringify(ids) !== JSON.stringify(REQUIRED_IDS)) {
        errors.push("GST scenario identifiers must be ordered and contiguous.");
    }
    for (const entry of contract) {
        if (!entry?.title || entry.source !== PLAN_PATH ||
            !["EXECUTABLE_DB_PREFLIGHT", "PURE_ONLY", "BLOCKED"].includes(entry.executionStatus) ||
            !["PURE_OR_SCHEMA_CONTRACT", "DATABASE_LEVEL_CONTRACT", "PURE_AND_DATABASE_LEVEL_CONTRACT", "APPLICATION_PATH_DATABASE_E2E"].includes(entry.evidenceLevel)) {
            errors.push(`GST contract entry is incomplete: ${entry?.id ?? "unknown"}.`);
        }
    }
    if (!fs.existsSync(path.resolve(ROOT, PLAN_PATH))) {
        errors.push(`GST contract source is missing: ${PLAN_PATH}.`);
    }
    return { ok: errors.length === 0, errors };
}

export { REQUIRED_IDS };
