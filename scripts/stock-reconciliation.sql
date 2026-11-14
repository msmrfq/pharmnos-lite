-- Pharmnos Lite — read-only stock counter vs movement reconciliation.
--
-- Authoritative model (PRD 8.7 / 22.1):
--   stock_movements.quantity_delta is the auditable ledger.
--   product_batches.available_qty is the materialized counter.
--
-- Expected equation for every batch:
--   product_batches.available_qty = SUM(stock_movements.quantity_delta)
--
-- Batches created before the OPENING_STOCK fix may carry an untagged opening
-- balance. The query reports that residual explicitly instead of assuming the
-- counter is wrong. A non-zero residual is a reconciliation finding, not proof
-- of data loss.
--
-- This script is read-only. Run it against a disposable or read-replica target;
-- it performs no INSERT, UPDATE, DELETE, or DDL.

WITH movement_totals AS (
  SELECT
    m.tenant_id,
    m.batch_id,
    SUM(m.quantity_delta)::bigint AS movement_total,
    COUNT(*)::bigint AS movement_count
  FROM public.stock_movements AS m
  WHERE m.batch_id IS NOT NULL
  GROUP BY m.tenant_id, m.batch_id
)
SELECT
  b.tenant_id,
  b.id AS batch_id,
  b.product_id,
  b.batch_no,
  b.available_qty,
  COALESCE(m.movement_total, 0) AS movement_total,
  b.available_qty - COALESCE(m.movement_total, 0) AS unexplained_residual,
  COALESCE(m.movement_count, 0) AS movement_count,
  CASE
    WHEN COALESCE(m.movement_total, 0) = 0 AND b.available_qty > 0
      THEN 'UNTAGGED_OPENING_BALANCE_SUSPECTED'
    WHEN b.available_qty <> COALESCE(m.movement_total, 0)
      THEN 'COUNTER_MOVEMENT_MISMATCH'
    ELSE 'RECONCILED'
  END AS classification
FROM public.product_batches AS b
LEFT JOIN movement_totals AS m
  ON m.tenant_id = b.tenant_id
 AND m.batch_id = b.id
WHERE b.available_qty <> COALESCE(m.movement_total, 0)
ORDER BY b.tenant_id, b.product_id, b.batch_no;
