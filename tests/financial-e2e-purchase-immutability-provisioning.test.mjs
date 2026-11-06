import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const provisioningSource = fs.readFileSync(
    new URL("../scripts/financial-e2e-provision-local.mjs", import.meta.url),
    "utf8",
);
const normalMigrationSource = fs.readFileSync(
    new URL("../prisma/migrations/0015_purchase_finalized_immutability/migration.sql", import.meta.url),
    "utf8",
);
const deleteGuardMigration = fs.readFileSync(
    new URL("../prisma/migrations/0021_reject_finalized_purchase_deletes/migration.sql", import.meta.url),
    "utf8",
);
const securityContract = fs.readFileSync(
    new URL("../prisma/financial-e2e-security-controls.review.sql", import.meta.url),
    "utf8",
);
const rlsContract = fs.readFileSync(
    new URL("../prisma/financial-e2e-rls-policies.review.sql", import.meta.url),
    "utf8",
);
const q14Contract = fs.readFileSync(
    new URL("../prisma/financial-e2e-q14-security-controls.sql", import.meta.url),
    "utf8",
);

const purchaseGuard = provisioningSource.match(
    /CREATE OR REPLACE FUNCTION public\.prevent_finalized_purchase_mutation\(\)[\s\S]*?AS \$function\$[\s\S]*?\$function\$/,
)?.[0] ?? "";
const normalPurchaseGuard = normalMigrationSource.match(
    /CREATE OR REPLACE FUNCTION public\.prevent_finalized_purchase_mutation\(\)[\s\S]*?AS \$function\$[\s\S]*?\$function\$/,
)?.[0] ?? "";

test("provisioning guards finalized purchase parents and items for update and delete", () => {
    assert.match(purchaseGuard, /IF TG_TABLE_NAME = 'purchase_invoices'/);
    assert.match(provisioningSource, /CREATE TRIGGER prevent_finalized_purchase_mutation[\s\S]*BEFORE UPDATE OR DELETE/);
    assert.match(provisioningSource, /CREATE TRIGGER prevent_finalized_purchase_item_mutation[\s\S]*BEFORE UPDATE OR DELETE/);
    assert.match(purchaseGuard, /FROM public\."purchase_invoices"[\s\S]*WHERE id = OLD\.purchase_id AND tenant_id = OLD\.tenant_id/);
    assert.match(purchaseGuard, /IF purchase_status IS NULL[\s\S]*Purchase invoice parent is missing/);
    assert.match(purchaseGuard, /IF TG_OP = 'DELETE' THEN[\s\S]*RETURN OLD;/);
});

test("finalized purchase parent financial and GST values are covered", () => {
    for (const field of [
        "invoice_no",
        "gross_amount",
        "total_discount",
        "total_tax",
        "round_off",
        "net_amount",
        "finalized_at",
        "current_gst_evidence_revision_id",
        "current_gst_calculation_id",
        "current_gst_accounting_decision_id",
        "gst_reconciliation_status",
        "gst_accounting_acceptance_status",
        "gst_record_version",
    ]) {
        assert.match(
            `${purchaseGuard}\n${securityContract}`,
            new RegExp(field),
            `parent field ${field}`,
        );
    }
    assert.match(purchaseGuard, /Finalized purchase invoice values are immutable/);
});

test("finalized purchase items cover accepted, tax, and amount values", () => {
    for (const field of [
        "gst_rate",
        "gst_amount",
        "calculated_taxable_value",
        "calculated_cgst",
        "calculated_sgst",
        "calculated_igst",
        "calculated_cess",
        "accepted_taxable_value",
        "accepted_cgst",
        "accepted_sgst",
        "accepted_igst",
        "accepted_cess",
        "accepted_line_total",
        "accepted_value_source",
        "accepted_reason",
        "accepted_at",
        "accepted_by_membership_id",
        "accepted_decision_id",
        "gst_acceptance_status",
        "gst_discrepancy_details",
        "gst_acceptance_reference",
        "line_total",
    ]) {
        assert.match(purchaseGuard, new RegExp(`NEW\\.${field}`), `item field ${field}`);
    }
    assert.match(purchaseGuard, /round\([\s\S]*NEW\.accepted_cgst[\s\S]*NEW\.accepted_cess[\s\S]*2/);
    assert.match(purchaseGuard, /NEW\.line_total IS NOT DISTINCT FROM round\(NEW\.accepted_line_total, 2\)/);
    assert.match(purchaseGuard, /Finalized purchase invoice lines and accepted GST values are immutable/);
});

test("draft finalization and post-finalization deletion cannot bypass the guard", () => {
    assert.match(purchaseGuard, /OLD\.finalized_at IS NULL[\s\S]*NEW\.finalized_at IS NOT NULL/);
    assert.match(purchaseGuard, /NEW\.status = 'FINALIZED'::public\."InvoiceStatus"[\s\S]*NEW\.finalized_at IS NULL[\s\S]*NEW\.invoice_no IS NOT DISTINCT FROM OLD\.invoice_no/);
    assert.match(purchaseGuard, /Purchase invoice must use the controlled finalization transition/);
    assert.match(purchaseGuard, /purchase_finalized_at IS NULL[\s\S]*NEW\.gst_rate IS NOT DISTINCT FROM OLD\.gst_rate/);
    assert.match(provisioningSource, /REVOKE DELETE ON TABLE public\.\$\{ident\("purchase_invoices"\)\}, public\.\$\{ident\("purchase_invoice_items"\)\}/);
    assert.match(securityContract, /public\.purchase_invoices,[\s\S]*public\.purchase_invoice_items[\s\S]*FROM pharmnos_e2e_runtime/);
    assert.doesNotMatch(rlsContract, /tenant_delete_purchase_(?:invoices|invoice_items)/);
    assert.match(q14Contract, /prevent_finalized_purchase_item_mutation[\s\S]*FINALIZED_PURCHASE_HISTORY/);
});

test("normal migration installs the finalized purchase guards", () => {
    assert.match(normalPurchaseGuard, /IF TG_TABLE_NAME = 'purchase_invoices'/);
    assert.match(
        normalMigrationSource,
        /CREATE TRIGGER prevent_finalized_purchase_mutation[\s\S]*BEFORE UPDATE OR DELETE/,
    );
    assert.match(
        normalMigrationSource,
        /CREATE TRIGGER prevent_finalized_purchase_item_mutation[\s\S]*BEFORE UPDATE OR DELETE/,
    );
    assert.match(
        normalPurchaseGuard,
        /FROM public\."purchase_invoices"[\s\S]*WHERE id = OLD\.purchase_id AND tenant_id = OLD\.tenant_id/,
    );
    assert.match(normalPurchaseGuard, /IF OLD\.status = 'FINALIZED'::public\."InvoiceStatus"/);
    assert.match(normalPurchaseGuard, /IF purchase_status = 'FINALIZED'::public\."InvoiceStatus"/);
    assert.match(normalPurchaseGuard, /IF purchase_status IS NULL[\s\S]*Purchase invoice parent is missing/);
    assert.match(normalPurchaseGuard, /IF TG_OP = 'DELETE' THEN[\s\S]*RETURN OLD;/);
    assert.match(normalMigrationSource, /REVOKE EXECUTE ON FUNCTION public\.prevent_finalized_purchase_mutation\(\) FROM PUBLIC/);
});

test("delete guard migration rejects finalized purchase deletes explicitly", () => {
    assert.match(deleteGuardMigration, /CREATE OR REPLACE FUNCTION public\.reject_finalized_purchase_delete\(\)/);
    assert.match(deleteGuardMigration, /Finalized purchase invoices cannot be deleted/);
    assert.match(deleteGuardMigration, /Finalized purchase invoice items cannot be deleted/);
    assert.match(deleteGuardMigration, /BEFORE DELETE ON public\."purchase_invoices"/);
    assert.match(deleteGuardMigration, /BEFORE DELETE ON public\."purchase_invoice_items"/);
    assert.match(deleteGuardMigration, /USING ERRCODE = '42501'/);
});

test("normal migration protects the finalized purchase financial and GST snapshots", () => {
    for (const field of [
        "invoice_no",
        "gross_amount",
        "total_discount",
        "total_tax",
        "round_off",
        "net_amount",
        "finalized_at",
        "current_gst_evidence_revision_id",
        "current_gst_calculation_id",
        "current_gst_accounting_decision_id",
        "gst_reconciliation_status",
        "gst_accounting_acceptance_status",
        "gst_record_version",
    ]) {
        assert.match(normalPurchaseGuard, new RegExp(`NEW\\.${field}`), `parent field ${field}`);
    }
    for (const field of [
        "gst_rate",
        "gst_amount",
        "calculated_taxable_value",
        "calculated_cgst",
        "calculated_sgst",
        "calculated_igst",
        "calculated_cess",
        "accepted_taxable_value",
        "accepted_cgst",
        "accepted_sgst",
        "accepted_igst",
        "accepted_cess",
        "accepted_line_total",
        "accepted_value_source",
        "accepted_reason",
        "accepted_at",
        "accepted_by_membership_id",
        "accepted_decision_id",
        "gst_acceptance_status",
        "gst_discrepancy_details",
        "gst_acceptance_reference",
        "line_total",
    ]) {
        assert.match(normalPurchaseGuard, new RegExp(`NEW\\.${field}`), `item field ${field}`);
    }
    assert.match(normalPurchaseGuard, /round\([\s\S]*NEW\.accepted_cgst[\s\S]*NEW\.accepted_cess[\s\S]*2/);
    assert.match(normalPurchaseGuard, /NEW\.line_total IS NOT DISTINCT FROM round\(NEW\.accepted_line_total, 2\)/);
    assert.match(normalPurchaseGuard, /OLD\.finalized_at IS NULL[\s\S]*NEW\.finalized_at IS NOT NULL/);
    assert.match(normalPurchaseGuard, /NEW\.status = 'FINALIZED'::public\."InvoiceStatus"[\s\S]*NEW\.finalized_at IS NULL[\s\S]*NEW\.invoice_no IS NOT DISTINCT FROM OLD\.invoice_no/);
    assert.match(normalPurchaseGuard, /Purchase invoice must use the controlled finalization transition/);
    assert.match(normalPurchaseGuard, /Finalized purchase invoice values are immutable/);
    assert.match(normalPurchaseGuard, /Finalized purchase invoice lines and accepted GST values are immutable/);
});
