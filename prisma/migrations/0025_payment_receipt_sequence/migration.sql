ALTER TABLE "payments"
  ADD COLUMN "receipt_no" TEXT;

CREATE UNIQUE INDEX "payments_tenant_receipt_no"
  ON "payments"("tenant_id", "receipt_no");

CREATE TABLE "payment_receipt_sequences" (
  "tenant_id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "next_value" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "payment_receipt_sequences_pkey" PRIMARY KEY ("tenant_id", "prefix"),
  CONSTRAINT "payment_receipt_sequences_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_receipt_sequences_next_value_check"
    CHECK ("next_value" > 0)
);
