ALTER TYPE "PermissionAction" ADD VALUE IF NOT EXISTS 'create_payment';

ALTER TABLE "payments"
  ADD COLUMN "supplier_id" TEXT,
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "request_payload_hash" TEXT;

CREATE INDEX "payments_tenant_id_supplier_id_idx"
  ON "payments"("tenant_id", "supplier_id");

CREATE UNIQUE INDEX "payments_tenant_idempotency_key"
  ON "payments"("tenant_id", "idempotency_key");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
