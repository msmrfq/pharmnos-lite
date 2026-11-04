-- Rebuild the supplier-invoice uniqueness key on the normalized value so
-- legacy whitespace cannot bypass the application normalization contract.
DROP INDEX IF EXISTS "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key";

CREATE UNIQUE INDEX "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key"
  ON "purchase_invoices"("tenant_id", "supplier_id", btrim("supplier_invoice_no"))
  WHERE "supplier_invoice_no" IS NOT NULL
    AND btrim("supplier_invoice_no") <> '';
