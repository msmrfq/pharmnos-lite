CREATE TYPE "FinancialRefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FinancialReversalStatus" AS ENUM ('COMPLETED');

ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'CHEQUE';
ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'NEFT';

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_tenant_id_id_key" UNIQUE ("tenant_id", "id");
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_tenant_id_id_key" UNIQUE ("tenant_id", "id");
ALTER TABLE "sales_invoices"
  ADD COLUMN "due_date" TIMESTAMP(3);
ALTER TABLE "purchase_invoices"
  ADD COLUMN "due_date" TIMESTAMP(3);

CREATE TABLE "payment_allocations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "sales_invoice_id" TEXT,
  "purchase_invoice_id" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_payload_hash" TEXT NOT NULL,
  "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "allocated_by" TEXT,
  "legacy_unallocated" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_allocations_tenant_id_id_key" UNIQUE ("tenant_id", "id"),
  CONSTRAINT "payment_allocations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_allocations_one_invoice_check"
    CHECK (("sales_invoice_id" IS NOT NULL)::int + ("purchase_invoice_id" IS NOT NULL)::int = 1),
  CONSTRAINT "payment_allocations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_allocations_payment_fkey"
    FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_allocations_sales_invoice_fkey"
    FOREIGN KEY ("tenant_id", "sales_invoice_id") REFERENCES "sales_invoices"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payment_allocations_purchase_invoice_fkey"
    FOREIGN KEY ("tenant_id", "purchase_invoice_id") REFERENCES "purchase_invoices"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "allocation_reversals" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "allocation_id" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "request_payload_hash" TEXT NOT NULL,
  "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "allocation_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "allocation_reversals_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "allocation_reversals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "allocation_reversals_allocation_fkey"
    FOREIGN KEY ("tenant_id", "allocation_id") REFERENCES "payment_allocations"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "payment_refunds" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "FinancialRefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "idempotency_key" TEXT NOT NULL,
  "request_payload_hash" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  "requested_by" TEXT,
  "completed_by" TEXT,
  "reason" TEXT,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_refunds_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_refunds_payment_fkey"
    FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "payment_reversals" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" "FinancialReversalStatus" NOT NULL DEFAULT 'COMPLETED',
  "idempotency_key" TEXT NOT NULL,
  "request_payload_hash" TEXT NOT NULL,
  "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversed_by" TEXT,
  "reason" TEXT,
  CONSTRAINT "payment_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_reversals_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_reversals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_reversals_payment_fkey"
    FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "payments"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payment_allocations_tenant_idempotency_key"
  ON "payment_allocations" ("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "allocation_reversal_once"
  ON "allocation_reversals" ("tenant_id", "allocation_id");
CREATE UNIQUE INDEX "allocation_reversals_tenant_idempotency_key"
  ON "allocation_reversals" ("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "payment_refunds_tenant_idempotency_key"
  ON "payment_refunds" ("tenant_id", "idempotency_key");
CREATE UNIQUE INDEX "payment_reversal_once"
  ON "payment_reversals" ("tenant_id", "payment_id");
CREATE UNIQUE INDEX "payment_reversals_tenant_idempotency_key"
  ON "payment_reversals" ("tenant_id", "idempotency_key");

CREATE INDEX "payment_allocations_tenant_payment_allocated_at_idx"
  ON "payment_allocations" ("tenant_id", "payment_id", "allocated_at");
CREATE INDEX "payment_allocations_tenant_sales_allocated_at_idx"
  ON "payment_allocations" ("tenant_id", "sales_invoice_id", "allocated_at");
CREATE INDEX "payment_allocations_tenant_purchase_allocated_at_idx"
  ON "payment_allocations" ("tenant_id", "purchase_invoice_id", "allocated_at");
CREATE INDEX "allocation_reversals_tenant_reversed_at_idx"
  ON "allocation_reversals" ("tenant_id", "reversed_at");
CREATE INDEX "payment_refunds_tenant_payment_status_idx"
  ON "payment_refunds" ("tenant_id", "payment_id", "status");
CREATE INDEX "payment_reversals_tenant_reversed_at_idx"
  ON "payment_reversals" ("tenant_id", "reversed_at");
