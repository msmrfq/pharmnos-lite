-- =====================================================================
-- 07-post-release-index-review.sql  (P7 T9, idempotent, CONCURRENTLY)
-- Project: Pharmnos Lite
-- Purpose: Add composite btree indexes missing after EXPLAIN ANALYZE of
--          the 5 FR5.1 queries plus the new P7 report pages (batch-expiry,
--          daybook supplier-side aging).
-- Deploy:  ONE LINE AT A TIME via Supabase MCP execute_sql (each CREATE
--          INDEX CONCURRENTLY runs OUTSIDE a transaction lock, so do NOT
--          multi-statement blob deploy — one execute_sql call per index).
-- Evidence: Every index below has a comment above it citing the EXPLAIN
--           ANALYZE plan or report page filter pattern that motivated it.
-- =====================================================================

-- from EXPLAIN ANALYZE FR5.1 query Q5 (customer dues aging):
--   customers outer Index Scan using customers_tenant_id_business_name_idx
--   → SubPlan 1 customer_ledgers WHERE tenant_id = c.tenant_id AND customer_id = c.id
--   → currently only customer_ledgers_tenant_id_entry_date_idx exists;
--   rows=1 actual time N/A but ledgers grow fast. Composite (tenant_id, customer_id)
--   makes the per-customer aging subquery index-only for future data volumes.
CREATE INDEX CONCURRENTLY IF NOT EXISTS customer_ledgers_tenant_id_customer_id_idx
  ON public.customer_ledgers USING btree (tenant_id, customer_id);

-- from P7 T4 batch-expiry report page (route /reports/batch-expiry):
--   product_batches filter WHERE tenant_id=ctx AND available_qty > 0
--   ORDER BY (expiry_date - today) ASC = ORDER BY expiry_date ASC
--   Existing indexes:
--     product_batches_tenant_id_expiry_date_idx  (tenant_id, expiry_date)
--     product_batches_tenant_id_available_qty_idx (tenant_id, available_qty)
--   The report combines both predicates: (tenant_id, status avail>0) + expiry sort.
--   Adding composite (tenant_id, available_qty, expiry_date) avoids re-sort for
--   the days_left ASC prioritization used in FEFO + near-expiry lists.
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_batches_tenant_avail_expiry_idx
  ON public.product_batches USING btree (tenant_id, available_qty, expiry_date);
