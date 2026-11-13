-- Workstream D: allow multiple empty-numbered drafts per tenant while
-- preserving final invoice-number uniqueness.
--
-- Draft creation persists invoice_no = '' for both sales and purchase drafts,
-- but the baseline unique index on (tenant_id, invoice_no) treats the empty
-- string as a value, so a second draft in the same tenant collides. Rebuild
-- both indexes as partial unique indexes that only constrain non-empty
-- invoice numbers (i.e. finalized/real numbers, and any explicitly supplied
-- draft number), mirroring the established partial-index pattern in 0016.
DROP INDEX IF EXISTS "sales_invoices_tenant_id_invoice_no_key";
DROP INDEX IF EXISTS "purchase_invoices_tenant_id_invoice_no_key";

CREATE UNIQUE INDEX "sales_invoices_tenant_id_invoice_no_key"
  ON "sales_invoices"("tenant_id", "invoice_no")
  WHERE "invoice_no" <> '';

CREATE UNIQUE INDEX "purchase_invoices_tenant_id_invoice_no_key"
  ON "purchase_invoices"("tenant_id", "invoice_no")
  WHERE "invoice_no" <> '';
