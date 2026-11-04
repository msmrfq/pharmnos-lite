CREATE UNIQUE INDEX "purchase_invoices_tenant_id_supplier_id_supplier_invoice_no_key"
  ON "purchase_invoices"("tenant_id", "supplier_id", "supplier_invoice_no")
  WHERE "supplier_invoice_no" IS NOT NULL
    AND btrim("supplier_invoice_no") <> '';
