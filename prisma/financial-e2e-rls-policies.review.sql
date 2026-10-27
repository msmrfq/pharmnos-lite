-- REVIEW SPECIFICATION ONLY - DO NOT EXECUTE.
-- This file expands the tenant-RLS contract into explicit policy definitions.
-- It contains no executable provisioning authorization and must be incorporated
-- into a separately reviewed, catalog-guarded artifact before any database run.
--
-- Supported local principals are intentionally not expanded here:
--   pharmnos_e2e          bootstrap/provisioning owner
--   pharmnos_e2e_runtime  ordinary non-superuser/non-BYPASSRLS verifier
-- No browser or application backend role is assumed to exist.
--
-- Canonical fail-closed claim expression:
--   NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')
-- A missing, empty, or non-matching claim denies access.

-- Common table policy contract
-- For each table below, the final executable artifact must:
--   ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_select_<table> ON public.<table>
--     FOR SELECT TO pharmnos_e2e_runtime
--     USING (<predicate>);
--   CREATE POLICY tenant_insert_<table> ON public.<table>
--     FOR INSERT TO pharmnos_e2e_runtime
--     WITH CHECK (<predicate>);
--   CREATE POLICY tenant_update_<table> ON public.<table>
--     FOR UPDATE TO pharmnos_e2e_runtime
--     USING (<predicate>) WITH CHECK (<predicate>);
--
-- No policy is implied for roles not named by the repository. Missing roles
-- must cause provisioning to stop rather than be created implicitly.

-- Direct tenant_id tables: predicate is
--   tenant_id::text = NULLIF(current_setting(
--     'request.jwt.claim.tenant_id', true), '')

-- tenants: root table has no tenant_id. Predicate is:
--   id::text = NULLIF(current_setting(
--     'request.jwt.claim.tenant_id', true), '')
-- Required policies:
--   tenant_select_tenants
--   tenant_insert_tenants
--   tenant_update_tenants
-- `DELETE` is not granted to the runtime role.

-- users: no tenant_id column exists in the Prisma schema. Predicate is:
--   EXISTS (
--     SELECT 1 FROM public.memberships AS m
--     WHERE m.user_id = users.id
--       AND m.tenant_id::text = NULLIF(current_setting(
--         'request.jwt.claim.tenant_id', true), '')
--   )
-- Required policies:
--   tenant_select_users / tenant_insert_users / tenant_update_users

-- memberships
-- tenant_select_memberships / tenant_insert_memberships /
-- tenant_update_memberships
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- roles
-- tenant_select_roles / tenant_insert_roles / tenant_update_roles
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- role_permissions: no tenant_id column. Predicate is:
--   EXISTS (
--     SELECT 1 FROM public.roles AS r
--     WHERE r.id = role_permissions.role_id
--       AND r.tenant_id::text = NULLIF(current_setting(
--         'request.jwt.claim.tenant_id', true), '')
--   )
-- Required policies:
--   tenant_select_role_permissions
--   tenant_insert_role_permissions
--   tenant_update_role_permissions

-- business_profiles
-- tenant_select_business_profiles / tenant_insert_business_profiles /
-- tenant_update_business_profiles
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- products
-- tenant_select_products / tenant_insert_products / tenant_update_products
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- product_batches
-- tenant_select_product_batches / tenant_insert_product_batches /
-- tenant_update_product_batches
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- customers
-- tenant_select_customers / tenant_insert_customers /
-- tenant_update_customers
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- suppliers
-- tenant_select_suppliers / tenant_insert_suppliers /
-- tenant_update_suppliers
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- purchase_invoices
-- tenant_select_purchase_invoices / tenant_insert_purchase_invoices /
-- tenant_update_purchase_invoices
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')
-- Finalized GST fields require the separate finalized-invoice protection
-- contract in financial-e2e-security-controls.review.sql.

-- purchase_posting_operations
-- tenant_select_purchase_posting_operations /
-- tenant_insert_purchase_posting_operations /
-- tenant_update_purchase_posting_operations
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')
-- UPDATE is additionally constrained by the posting-transition control.

-- purchase_invoice_items
-- tenant_select_purchase_invoice_items /
-- tenant_insert_purchase_invoice_items /
-- tenant_update_purchase_invoice_items
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- Immutable GST history tables: SELECT and INSERT only; no UPDATE/DELETE
-- policy and no direct runtime UPDATE/DELETE privilege.

-- purchase_gst_evidence_revisions
-- tenant_select_purchase_gst_evidence_revisions /
-- tenant_insert_purchase_gst_evidence_revisions
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- purchase_gst_line_evidence
-- tenant_select_purchase_gst_line_evidence /
-- tenant_insert_purchase_gst_line_evidence
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- purchase_gst_calculations
-- tenant_select_purchase_gst_calculations /
-- tenant_insert_purchase_gst_calculations
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- purchase_gst_accounting_decisions
-- tenant_select_purchase_gst_accounting_decisions /
-- tenant_insert_purchase_gst_accounting_decisions
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- purchase_gst_reconciliation_events
-- tenant_select_purchase_gst_reconciliation_events /
-- tenant_insert_purchase_gst_reconciliation_events
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- purchase_gst_reconciliation_event_lines
-- tenant_select_purchase_gst_reconciliation_event_lines /
-- tenant_insert_purchase_gst_reconciliation_event_lines
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- sales_invoices
-- tenant_select_sales_invoices / tenant_insert_sales_invoices /
-- tenant_update_sales_invoices
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- sales_invoice_items
-- tenant_select_sales_invoice_items / tenant_insert_sales_invoice_items /
-- tenant_update_sales_invoice_items
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- payments
-- tenant_select_payments / tenant_insert_payments / tenant_update_payments
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- stock_movements
-- tenant_select_stock_movements / tenant_insert_stock_movements /
-- tenant_update_stock_movements
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- customer_ledgers
-- tenant_select_customer_ledgers / tenant_insert_customer_ledgers /
-- tenant_update_customer_ledgers
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- supplier_ledgers
-- tenant_select_supplier_ledgers / tenant_insert_supplier_ledgers /
-- tenant_update_supplier_ledgers
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')

-- audit_logs
-- tenant_select_audit_logs / tenant_insert_audit_logs
-- Predicate: tenant_id::text = NULLIF(current_setting(
--   'request.jwt.claim.tenant_id', true), '')
-- Audit rows are append-only for the runtime role; no UPDATE/DELETE policy.

-- Required denial tests after authorized provisioning:
--   missing claim => zero rows and INSERT/UPDATE denied;
--   tenant A claim => tenant B rows invisible and rejected on write;
--   runtime role remains rolsuper=false and rolbypassrls=false;
--   FORCE RLS is true for every table listed above.
