import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const provisioningSource = fs.readFileSync(
    new URL("../scripts/financial-e2e-provision-local.mjs", import.meta.url),
    "utf8",
);

test("guarded provisioning defines finalized sales immutability controls", () => {
    assert.match(provisioningSource, /CREATE OR REPLACE FUNCTION public\.prevent_finalized_sales_mutation\(\)/);
    assert.match(provisioningSource, /IF OLD\.status = 'FINALIZED'::public\."InvoiceStatus"/);
    assert.match(provisioningSource, /RAISE EXCEPTION 'Finalized sales invoice facts are immutable'/);
    assert.match(provisioningSource, /RAISE EXCEPTION 'Finalized sales invoice lines are immutable'/);
    assert.match(provisioningSource, /CREATE TRIGGER prevent_finalized_sales_invoice_mutation[\s\S]*ON public\."sales_invoices"/);
    assert.match(provisioningSource, /CREATE TRIGGER prevent_finalized_sales_item_mutation[\s\S]*ON public\."sales_invoice_items"/);
    assert.match(provisioningSource, /BEFORE UPDATE OR DELETE/);
});

test("sales line protection uses tenant-qualified finalized-parent lookup", () => {
    assert.match(
        provisioningSource,
        /FROM public\."sales_invoices"[\s\S]*WHERE id = OLD\.invoice_id AND tenant_id = OLD\.tenant_id/,
    );
    assert.match(
        provisioningSource,
        /IF invoice_status = 'FINALIZED'::public\."InvoiceStatus"[\s\S]*RETURN NEW;/,
    );
});

test("finalized sales payment rollups remain mutable", () => {
    const guard = provisioningSource.slice(
        provisioningSource.indexOf("CREATE OR REPLACE FUNCTION public.prevent_finalized_sales_mutation"),
        provisioningSource.indexOf("CREATE OR REPLACE FUNCTION public.prevent_finalized_sales_mutation") + 5000,
    );
    assert.doesNotMatch(guard, /NEW\.paid_amount IS DISTINCT FROM OLD\.paid_amount/);
    assert.doesNotMatch(guard, /NEW\.balance_due IS DISTINCT FROM OLD\.balance_due/);
});

test("the guarded workflow applies controls after the generated baseline in one transaction", () => {
    assert.match(provisioningSource, /await client\.query\(baseline\);/);
    assert.match(provisioningSource, /await client\.query\(buildControlSql\(contextSigningSecret\)\);/);
    assert.match(provisioningSource, /await client\.query\("COMMIT"\);/);
    assert.match(provisioningSource, /const BASELINE_PATH = new URL\("\.\.\/prisma\/financial-e2e-schema-provisioning\.generated\.sql"/);
});
