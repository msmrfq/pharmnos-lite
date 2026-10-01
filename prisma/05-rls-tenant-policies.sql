-- =====================================================================
-- 05-rls-tenant-policies.sql  (idempotent, safe to run repeatedly)
-- Project: Pharmnos Lite
-- Purpose: Create tenant-scoped RLS policies on all 19 business tables.
-- Deploy:  Supabase MCP execute_sql  (NEVER Dashboard SQL Editor paste
--          for storage schema; this file is public schema only so either
--          works, but MCP execute_sql is project standard).
--
-- Structure:
--   1. Helper function  jwt_tenant_id()  → text (safe null fallback)
--   2. ALTER TABLE … ENABLE ROW LEVEL SECURITY  (19 tables)
--   3. DROP IF EXISTS + CREATE POLICY per table  (19 tables)
--
-- Policy pattern PERMISSIVE FOR ALL:
--   USING      (tenant_id = jwt_tenant_id())    -- reads + existing writes
--   WITH CHECK (tenant_id = jwt_tenant_id())    -- new / updated rows
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper function: safely extract app_metadata.tenant_id from JWT.
--    Returns NULL on any failure (policy becomes "deny all" safely).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jwt_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT NULLIF(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::text,
    ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.jwt_tenant_id() TO authenticated, anon;

-- ---------------------------------------------------------------------
-- 2. Ensure RLS is enabled on every table. (Idempotent: ALTER … ENABLE
--    is repeatable without error in Postgres.)
--    ORDER matches 01-apply-schema-with-rls.sql L770-788 VERBATIM.
-- ---------------------------------------------------------------------
ALTER TABLE public.tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledgers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ledgers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs             ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Idempotent DROP IF EXISTS + CREATE POLICY on all 19 tables.
--    Single policy name "tenant_isolation_policy" per table for
--    predictable audit / pg_policies queries.
-- ---------------------------------------------------------------------

-- 3/1 tenants
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.tenants;
CREATE POLICY "tenant_isolation_policy" ON public.tenants
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (id = public.jwt_tenant_id())
  WITH CHECK (id = public.jwt_tenant_id());

-- 3/2 users (no tenant_id column; scoped via memberships.user_id → memberships.tenant_id)
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.users;
CREATE POLICY "tenant_isolation_policy" ON public.users
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = public.users.id
        AND m.tenant_id = public.jwt_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = public.users.id
        AND m.tenant_id = public.jwt_tenant_id()
    )
  );

-- 3/3 roles
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.roles;
CREATE POLICY "tenant_isolation_policy" ON public.roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/4 role_permissions (no tenant_id column; scoped via roles.id = role_id → roles.tenant_id)
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.role_permissions;
CREATE POLICY "tenant_isolation_policy" ON public.role_permissions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = public.role_permissions.role_id
        AND r.tenant_id = public.jwt_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = public.role_permissions.role_id
        AND r.tenant_id = public.jwt_tenant_id()
    )
  );

-- 3/5 memberships
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.memberships;
CREATE POLICY "tenant_isolation_policy" ON public.memberships
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/6 business_profiles
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.business_profiles;
CREATE POLICY "tenant_isolation_policy" ON public.business_profiles
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/7 customers
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.customers;
CREATE POLICY "tenant_isolation_policy" ON public.customers
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/8 suppliers
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.suppliers;
CREATE POLICY "tenant_isolation_policy" ON public.suppliers
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/9 products
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.products;
CREATE POLICY "tenant_isolation_policy" ON public.products
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/10 product_batches
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.product_batches;
CREATE POLICY "tenant_isolation_policy" ON public.product_batches
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/11 sales_invoices
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.sales_invoices;
CREATE POLICY "tenant_isolation_policy" ON public.sales_invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/12 sales_invoice_items
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.sales_invoice_items;
CREATE POLICY "tenant_isolation_policy" ON public.sales_invoice_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/13 purchase_invoices
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.purchase_invoices;
CREATE POLICY "tenant_isolation_policy" ON public.purchase_invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/14 purchase_invoice_items
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.purchase_invoice_items;
CREATE POLICY "tenant_isolation_policy" ON public.purchase_invoice_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/15 stock_movements
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.stock_movements;
CREATE POLICY "tenant_isolation_policy" ON public.stock_movements
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/16 payments
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.payments;
CREATE POLICY "tenant_isolation_policy" ON public.payments
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/17 customer_ledgers
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.customer_ledgers;
CREATE POLICY "tenant_isolation_policy" ON public.customer_ledgers
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/18 supplier_ledgers
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.supplier_ledgers;
CREATE POLICY "tenant_isolation_policy" ON public.supplier_ledgers
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- 3/19 audit_logs
DROP POLICY IF EXISTS "tenant_isolation_policy" ON public.audit_logs;
CREATE POLICY "tenant_isolation_policy" ON public.audit_logs
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());
