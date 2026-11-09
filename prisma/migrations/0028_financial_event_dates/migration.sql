CREATE TYPE "FinancialDateBasis" AS ENUM (
  'EXPLICIT',
  'DERIVED_FROM_OCCURRED_AT',
  'EVIDENCE_CLASSIFIED',
  'AMBIGUOUS',
  'UNCLASSIFIED'
);

ALTER TABLE "sales_invoices"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "due_date_business" DATE,
  ADD COLUMN "finalized_recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "purchase_invoices"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "due_date_business" DATE,
  ADD COLUMN "finalized_recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "payments"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "effective_date_basis" "FinancialDateBasis",
  ADD COLUMN "occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "customer_ledgers"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "effective_date_basis" "FinancialDateBasis",
  ADD COLUMN "occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "supplier_ledgers"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "effective_date_basis" "FinancialDateBasis",
  ADD COLUMN "occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "payment_allocations"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "allocation_reversals"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "payment_reversals"
  ADD COLUMN "effective_date" DATE,
  ADD COLUMN "occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(3);

ALTER TABLE "payment_refunds"
  ADD COLUMN "requested_business_date" DATE,
  ADD COLUMN "requested_occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "requested_recorded_at" TIMESTAMPTZ(3),
  ADD COLUMN "completed_effective_date" DATE,
  ADD COLUMN "completed_effective_date_basis" "FinancialDateBasis",
  ADD COLUMN "completed_occurred_at" TIMESTAMPTZ(3),
  ADD COLUMN "completed_recorded_at" TIMESTAMPTZ(3);

-- Existing rows remain NULL. The same check permits unknown legacy provenance
-- while rejecting a populated date without an explicit classification.
-- BEGIN GENERATED BASELINE FINANCIAL TEMPORAL CONTROLS
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_effective_date_basis_check"
  CHECK (
    ("effective_date" IS NULL AND "effective_date_basis" IS NULL)
    OR (
      "effective_date" IS NOT NULL
      AND "effective_date_basis" IS NOT NULL
      AND "effective_date_basis" IN (
        'EXPLICIT'::"FinancialDateBasis",
        'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
      )
    )
    OR (
      "effective_date" IS NULL
      AND "effective_date_basis" IS NOT NULL
      AND "effective_date_basis" IN (
        'AMBIGUOUS'::"FinancialDateBasis",
        'UNCLASSIFIED'::"FinancialDateBasis"
      )
    )
  ),
  ADD CONSTRAINT "payments_derived_date_requires_occurred_at_check"
  CHECK (
    "effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "occurred_at" IS NOT NULL
  ),
  ADD CONSTRAINT "payments_derived_date_matches_occurred_at_check"
  CHECK (
    "effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "effective_date" = ("occurred_at" AT TIME ZONE 'Asia/Kolkata')::date
  );

ALTER TABLE "customer_ledgers"
  ADD CONSTRAINT "customer_ledgers_effective_date_basis_check"
  CHECK (
    ("effective_date" IS NULL AND "effective_date_basis" IS NULL)
    OR (
      "effective_date" IS NOT NULL
      AND "effective_date_basis" IS NOT NULL
      AND "effective_date_basis" IN (
        'EXPLICIT'::"FinancialDateBasis",
        'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
      )
    )
    OR (
      "effective_date" IS NULL
      AND "effective_date_basis" IS NOT NULL
      AND "effective_date_basis" IN (
        'AMBIGUOUS'::"FinancialDateBasis",
        'UNCLASSIFIED'::"FinancialDateBasis"
      )
    )
  ),
  ADD CONSTRAINT "customer_ledgers_derived_date_requires_occurred_at_check"
  CHECK (
    "effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "occurred_at" IS NOT NULL
  ),
  ADD CONSTRAINT "customer_ledgers_derived_date_matches_occurred_at_check"
  CHECK (
    "effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "effective_date" = ("occurred_at" AT TIME ZONE 'Asia/Kolkata')::date
  );

ALTER TABLE "supplier_ledgers"
  ADD CONSTRAINT "supplier_ledgers_effective_date_basis_check"
  CHECK (
    ("effective_date" IS NULL AND "effective_date_basis" IS NULL)
    OR (
      "effective_date" IS NOT NULL
      AND "effective_date_basis" IS NOT NULL
      AND "effective_date_basis" IN (
        'EXPLICIT'::"FinancialDateBasis",
        'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
      )
    )
    OR (
      "effective_date" IS NULL
      AND "effective_date_basis" IS NOT NULL
      AND "effective_date_basis" IN (
        'AMBIGUOUS'::"FinancialDateBasis",
        'UNCLASSIFIED'::"FinancialDateBasis"
      )
    )
  ),
  ADD CONSTRAINT "supplier_ledgers_derived_date_requires_occurred_at_check"
  CHECK (
    "effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "occurred_at" IS NOT NULL
  ),
  ADD CONSTRAINT "supplier_ledgers_derived_date_matches_occurred_at_check"
  CHECK (
    "effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "effective_date" = ("occurred_at" AT TIME ZONE 'Asia/Kolkata')::date
  );

ALTER TABLE "payment_refunds"
  ADD CONSTRAINT "payment_refunds_completed_effective_date_basis_check"
  CHECK (
    ("completed_effective_date" IS NULL AND "completed_effective_date_basis" IS NULL)
    OR (
      "completed_effective_date" IS NOT NULL
      AND "completed_effective_date_basis" IS NOT NULL
      AND "completed_effective_date_basis" IN (
        'EXPLICIT'::"FinancialDateBasis",
        'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
      )
    )
    OR (
      "completed_effective_date" IS NULL
      AND "completed_effective_date_basis" IS NOT NULL
      AND "completed_effective_date_basis" IN (
        'AMBIGUOUS'::"FinancialDateBasis",
        'UNCLASSIFIED'::"FinancialDateBasis"
      )
    )
  ),
  ADD CONSTRAINT "payment_refunds_derived_completion_requires_occurred_at_check"
  CHECK (
    "completed_effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "completed_occurred_at" IS NOT NULL
  ),
  ADD CONSTRAINT "payment_refunds_derived_completion_matches_occurred_at_check"
  CHECK (
    "completed_effective_date_basis" IS DISTINCT FROM 'DERIVED_FROM_OCCURRED_AT'::"FinancialDateBasis"
    OR "completed_effective_date" = ("completed_occurred_at" AT TIME ZONE 'Asia/Kolkata')::date
  );

-- The producer owns occurred_at and derives effective_date once. These
-- triggers only assign acceptance/recording time; they never derive or
-- overwrite an effective date or event instant.
CREATE OR REPLACE FUNCTION public.assign_financial_recorded_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.recorded_at IS NOT NULL THEN
    RAISE EXCEPTION 'recorded_at is database-assigned'
      USING ERRCODE = '42501';
  END IF;
  NEW.recorded_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_financial_recorded_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.recorded_at IS DISTINCT FROM OLD.recorded_at
     OR NEW.effective_date IS DISTINCT FROM OLD.effective_date
     OR NEW.occurred_at IS DISTINCT FROM OLD.occurred_at
     OR (to_jsonb(NEW) -> 'effective_date_basis')
          IS DISTINCT FROM (to_jsonb(OLD) -> 'effective_date_basis')
  THEN
    RAISE EXCEPTION 'Recorded financial event dates and instants are immutable'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "payments_assign_recorded_at"
  BEFORE INSERT ON "payments"
  FOR EACH ROW EXECUTE FUNCTION public.assign_financial_recorded_at();
CREATE TRIGGER "payments_protect_financial_dates"
  BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_recorded_at();

CREATE TRIGGER "customer_ledgers_assign_recorded_at"
  BEFORE INSERT ON "customer_ledgers"
  FOR EACH ROW EXECUTE FUNCTION public.assign_financial_recorded_at();
CREATE TRIGGER "customer_ledgers_protect_financial_dates"
  BEFORE UPDATE ON "customer_ledgers"
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_recorded_at();

CREATE TRIGGER "supplier_ledgers_assign_recorded_at"
  BEFORE INSERT ON "supplier_ledgers"
  FOR EACH ROW EXECUTE FUNCTION public.assign_financial_recorded_at();
CREATE TRIGGER "supplier_ledgers_protect_financial_dates"
  BEFORE UPDATE ON "supplier_ledgers"
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_recorded_at();

CREATE TRIGGER "payment_allocations_assign_recorded_at"
  BEFORE INSERT ON "payment_allocations"
  FOR EACH ROW EXECUTE FUNCTION public.assign_financial_recorded_at();
CREATE TRIGGER "payment_allocations_protect_financial_dates"
  BEFORE UPDATE ON "payment_allocations"
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_recorded_at();

CREATE TRIGGER "allocation_reversals_assign_recorded_at"
  BEFORE INSERT ON "allocation_reversals"
  FOR EACH ROW EXECUTE FUNCTION public.assign_financial_recorded_at();
CREATE TRIGGER "allocation_reversals_protect_financial_dates"
  BEFORE UPDATE ON "allocation_reversals"
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_recorded_at();

CREATE TRIGGER "payment_reversals_assign_recorded_at"
  BEFORE INSERT ON "payment_reversals"
  FOR EACH ROW EXECUTE FUNCTION public.assign_financial_recorded_at();
CREATE TRIGGER "payment_reversals_protect_financial_dates"
  BEFORE UPDATE ON "payment_reversals"
  FOR EACH ROW EXECUTE FUNCTION public.protect_financial_recorded_at();

CREATE OR REPLACE FUNCTION public.guard_invoice_financial_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.finalized_recorded_at IS NOT NULL THEN
      RAISE EXCEPTION 'finalized_recorded_at is database-assigned'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'FINALIZED'::public."InvoiceStatus" THEN
      NEW.finalized_recorded_at := clock_timestamp();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.finalized_recorded_at IS DISTINCT FROM OLD.finalized_recorded_at THEN
    RAISE EXCEPTION 'finalized_recorded_at is database-assigned and immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'FINALIZED'::public."InvoiceStatus"
     AND (
       NEW.effective_date IS DISTINCT FROM OLD.effective_date
       OR NEW.due_date_business IS DISTINCT FROM OLD.due_date_business
     )
  THEN
    RAISE EXCEPTION 'Finalized invoice business dates are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status <> 'FINALIZED'::public."InvoiceStatus"
     AND NEW.status = 'FINALIZED'::public."InvoiceStatus"
  THEN
    NEW.finalized_recorded_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "sales_invoices_guard_financial_dates"
  BEFORE INSERT OR UPDATE ON "sales_invoices"
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_financial_dates();
CREATE TRIGGER "purchase_invoices_guard_financial_dates"
  BEFORE INSERT OR UPDATE ON "purchase_invoices"
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_financial_dates();

CREATE OR REPLACE FUNCTION public.guard_refund_financial_dates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_recorded_at IS NOT NULL
       OR NEW.completed_recorded_at IS NOT NULL
       OR NEW.completed_effective_date IS NOT NULL
       OR NEW.completed_effective_date_basis IS NOT NULL
       OR NEW.completed_occurred_at IS NOT NULL
    THEN
      RAISE EXCEPTION 'Refund completion facts cannot be set before completion'
        USING ERRCODE = '42501';
    END IF;
    NEW.requested_recorded_at := clock_timestamp();
    RETURN NEW;
  END IF;

  IF NEW.requested_recorded_at IS DISTINCT FROM OLD.requested_recorded_at
     OR NEW.requested_business_date IS DISTINCT FROM OLD.requested_business_date
     OR NEW.requested_occurred_at IS DISTINCT FROM OLD.requested_occurred_at
     OR NEW.completed_recorded_at IS DISTINCT FROM OLD.completed_recorded_at
  THEN
    RAISE EXCEPTION 'Refund request and recorded timestamps are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'COMPLETED'::public."FinancialRefundStatus"
     AND (
       NEW.completed_effective_date IS DISTINCT FROM OLD.completed_effective_date
       OR NEW.completed_effective_date_basis IS DISTINCT FROM OLD.completed_effective_date_basis
       OR NEW.completed_occurred_at IS DISTINCT FROM OLD.completed_occurred_at
     )
  THEN
    RAISE EXCEPTION 'Completed refund financial dates are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status <> 'COMPLETED'::public."FinancialRefundStatus"
     AND (
       NEW.completed_effective_date IS NOT NULL
       OR NEW.completed_effective_date_basis IS NOT NULL
       OR NEW.completed_occurred_at IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'Refund completion facts require a completion transition'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status <> 'COMPLETED'::public."FinancialRefundStatus"
     AND NEW.status = 'COMPLETED'::public."FinancialRefundStatus"
  THEN
    NEW.completed_recorded_at := clock_timestamp();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER "payment_refunds_guard_financial_dates"
  BEFORE INSERT OR UPDATE ON "payment_refunds"
  FOR EACH ROW EXECUTE FUNCTION public.guard_refund_financial_dates();

REVOKE EXECUTE ON FUNCTION public.assign_financial_recorded_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_financial_recorded_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_invoice_financial_dates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_refund_financial_dates() FROM PUBLIC;

-- Recorded-time guarantee. These columns hold the database server wall-clock
-- value of clock_timestamp() at the moment the triggering statement executes
-- inside a still-open transaction. That is BEFORE commit: it is NOT
-- commit-visible time, NOT commit order, and NOT proof of what was known or
-- visible to any reader at that instant. Callers cannot supply or change it.
-- NULL means a row written before this migration (unknown, never backfilled).
COMMENT ON COLUMN "payments"."recorded_at" IS
  'Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "customer_ledgers"."recorded_at" IS
  'Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "supplier_ledgers"."recorded_at" IS
  'Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "payment_allocations"."recorded_at" IS
  'Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "allocation_reversals"."recorded_at" IS
  'Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "payment_reversals"."recorded_at" IS
  'Pre-commit database acceptance time: clock_timestamp() assigned by a BEFORE INSERT trigger while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "sales_invoices"."finalized_recorded_at" IS
  'Pre-commit database acceptance time of finalization: clock_timestamp() assigned by the invoice guard trigger when a statement inserts the invoice as FINALIZED or moves it to FINALIZED, inside a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = not finalized, or finalized before this migration (unknown).';
COMMENT ON COLUMN "purchase_invoices"."finalized_recorded_at" IS
  'Pre-commit database acceptance time of finalization: clock_timestamp() assigned by the invoice guard trigger when a statement inserts the invoice as FINALIZED or moves it to FINALIZED, inside a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = not finalized, or finalized before this migration (unknown).';
COMMENT ON COLUMN "payment_refunds"."requested_recorded_at" IS
  'Pre-commit database acceptance time of the refund request: clock_timestamp() assigned by the refund guard trigger on INSERT while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = legacy row, unknown.';
COMMENT ON COLUMN "payment_refunds"."completed_recorded_at" IS
  'Pre-commit database acceptance time of refund completion: clock_timestamp() assigned by the refund guard trigger on the transition to COMPLETED while the statement executes in a still-open transaction. NOT commit-visible time, NOT commit order, NOT proof of historical knowledge at that instant. Caller-supplied values are rejected and updates are blocked. NULL = not completed, or completed before this migration (unknown).';
COMMENT ON TYPE "FinancialDateBasis" IS
  'Provenance of a financial effective date. EXPLICIT and DERIVED_FROM_OCCURRED_AT are the only values assignable by the application. AMBIGUOUS and UNCLASSIFIED are valid only with a NULL date and are distinct from NULL (never classified). EVIDENCE_CLASSIFIED is reserved and rejected by CHECK constraints because no durable, inspectable provenance record exists.';
-- END GENERATED BASELINE FINANCIAL TEMPORAL CONTROLS
