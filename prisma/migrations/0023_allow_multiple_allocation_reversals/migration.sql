DROP INDEX IF EXISTS "allocation_reversal_once";

CREATE INDEX "allocation_reversals_tenant_allocation_reversed_at_idx"
  ON "allocation_reversals" ("tenant_id", "allocation_id", "reversed_at");
