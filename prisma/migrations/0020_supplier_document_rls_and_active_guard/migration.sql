DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

ALTER TABLE "purchase_supplier_documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_supplier_documents_tenant_isolation"
  ON "purchase_supplier_documents"
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING ("tenant_id" = NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = NULLIF(current_setting('request.jwt.claim.tenant_id', true), ''));

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_supplier_documents_one_active_per_purchase_key"
  ON "purchase_supplier_documents"("tenant_id", "purchase_invoice_id")
  WHERE "replaced_at" IS NULL;
