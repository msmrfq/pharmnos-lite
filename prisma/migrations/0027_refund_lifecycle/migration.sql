ALTER TYPE "FinancialRefundStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFUND_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFUND_APPROVED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFUND_REJECTED';
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'REFUND_CANCELLED';

ALTER TABLE "payment_refunds"
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "rejected_by" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_reason" TEXT;

DO $payment_counterparty_constraints$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_customer_id_fkey'
  ) THEN
    ALTER TABLE "payments" DROP CONSTRAINT "payments_customer_id_fkey";
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_supplier_id_fkey'
  ) THEN
    ALTER TABLE "payments" DROP CONSTRAINT "payments_supplier_id_fkey";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_tenant_customer_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_tenant_customer_fkey"
      FOREIGN KEY ("tenant_id", "customer_id")
      REFERENCES "customers" ("tenant_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_tenant_supplier_fkey'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_tenant_supplier_fkey"
      FOREIGN KEY ("tenant_id", "supplier_id")
      REFERENCES "suppliers" ("tenant_id", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payments'::regclass
      AND conname = 'payments_one_counterparty_check'
  ) THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_one_counterparty_check"
      CHECK (("customer_id" IS NOT NULL)::int + ("supplier_id" IS NOT NULL)::int = 1);
  END IF;
END;
$payment_counterparty_constraints$;

DO $refund_constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_approved_actor_pair_check') THEN
    ALTER TABLE "payment_refunds"
      ADD CONSTRAINT "payment_refunds_approved_actor_pair_check"
      CHECK (("approved_at" IS NULL) = ("approved_by" IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_rejected_actor_pair_check') THEN
    ALTER TABLE "payment_refunds"
      ADD CONSTRAINT "payment_refunds_rejected_actor_pair_check"
      CHECK (("rejected_at" IS NULL) = ("rejected_by" IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_cancelled_actor_pair_check') THEN
    ALTER TABLE "payment_refunds"
      ADD CONSTRAINT "payment_refunds_cancelled_actor_pair_check"
      CHECK (("cancelled_at" IS NULL) = ("cancelled_by" IS NULL));
  END IF;
END;
$refund_constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_refund_lifecycle_idempotency_key"
  ON "audit_logs" ("tenant_id", (("metadata" ->> 'idempotencyKey')))
  WHERE "target_type" = 'payment_refund'
    AND "metadata" ->> 'refundLifecycleVersion' = '1';

CREATE OR REPLACE FUNCTION public.guard_payment_refund_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text <> 'REQUESTED'
       OR NEW.approved_at IS NOT NULL
       OR NEW.rejected_at IS NOT NULL
       OR NEW.completed_at IS NOT NULL
       OR NEW.cancelled_at IS NOT NULL
       OR NEW.approved_by IS NOT NULL
       OR NEW.rejected_by IS NOT NULL
       OR NEW.completed_by IS NOT NULL
       OR NEW.cancelled_by IS NOT NULL
       OR NEW.requested_by IS NULL
       OR NEW.resolution_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Refunds must be created as REQUESTED'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.request_payload_hash IS DISTINCT FROM OLD.request_payload_hash
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.reason IS DISTINCT FROM OLD.reason THEN
    RAISE EXCEPTION 'Refund request facts are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status::text = 'REQUESTED'
     AND NEW.status::text = 'APPROVED'
     AND NEW.approved_by IS NOT NULL
     AND NEW.approved_at IS NOT NULL
     AND NEW.rejected_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.cancelled_at IS NULL
     AND NEW.rejected_by IS NULL
     AND NEW.completed_by IS NULL
     AND NEW.cancelled_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'REQUESTED'
     AND NEW.status::text = 'REJECTED'
     AND NEW.rejected_by IS NOT NULL
     AND NEW.rejected_at IS NOT NULL
     AND NEW.approved_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.cancelled_at IS NULL
     AND NEW.approved_by IS NULL
     AND NEW.completed_by IS NULL
     AND NEW.cancelled_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'REQUESTED'
     AND NEW.status::text = 'CANCELLED'
     AND NEW.cancelled_by IS NOT NULL
     AND NEW.cancelled_at IS NOT NULL
     AND NEW.approved_at IS NULL
     AND NEW.rejected_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.approved_by IS NULL
     AND NEW.rejected_by IS NULL
     AND NEW.completed_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'APPROVED'
     AND NEW.status::text = 'COMPLETED'
     AND NEW.approved_by IS NOT NULL
     AND NEW.approved_at IS NOT NULL
     AND NEW.completed_by IS NOT NULL
     AND NEW.completed_at IS NOT NULL
     AND NEW.rejected_at IS NULL
     AND NEW.cancelled_at IS NULL
     AND NEW.rejected_by IS NULL
     AND NEW.cancelled_by IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.status::text = 'APPROVED'
     AND NEW.status::text = 'CANCELLED'
     AND NEW.approved_by IS NOT NULL
     AND NEW.approved_at IS NOT NULL
     AND NEW.cancelled_by IS NOT NULL
     AND NEW.cancelled_at IS NOT NULL
     AND NEW.rejected_at IS NULL
     AND NEW.completed_at IS NULL
     AND NEW.completed_by IS NULL
     AND NEW.rejected_by IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid or immutable refund lifecycle transition: % to %',
    OLD.status, NEW.status
    USING ERRCODE = '23514';
END;
$function$;

DO $refund_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'payment_refunds_lifecycle_guard'
      AND tgrelid = 'public.payment_refunds'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER "payment_refunds_lifecycle_guard"
      BEFORE INSERT OR UPDATE ON "payment_refunds"
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_payment_refund_lifecycle();
  END IF;
END;
$refund_trigger$;
