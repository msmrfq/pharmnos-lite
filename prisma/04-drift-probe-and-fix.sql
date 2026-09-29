-- =====================================================================
-- Pharmnos Lite — Drift probe + auto-fix (run before seed if anything feels off)
-- Paste into Supabase Dashboard SQL Editor → Run.
-- Does TWO things:
--   1) SILENTLY RE-APPLIES (idempotently): unique indexes, GRANTs, RLS enable,
--      enum usage grants, prisma role grants — whatever is missing, no errors.
--   2) RETURNS a 12-row result grid: actual vs expected for every critical dimension
--      so you can screenshot/copy and paste back. Nothing is hidden.
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- PART 1. Idempotent fix-ups (silent. Re-running every line is safe.)
-- ═══════════════════════════════════════════════════════════════════════

-- 1a. Re-create unique indexes IF NOT EXISTS (the 14 from schema.prisma L407-521)
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key"                       ON public.tenants("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "users_external_id_key"                  ON public.users("external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key"                        ON public.users("email");
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_tenant_id_user_id_key"      ON public.memberships("tenant_id","user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_id_name_key"               ON public.roles("tenant_id","name");
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_id_permission_key" ON public.role_permissions("role_id","permission");
CREATE UNIQUE INDEX IF NOT EXISTS "business_profiles_tenant_id_key"        ON public.business_profiles("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "products_tenant_id_sku_key"             ON public.products("tenant_id","sku");
CREATE UNIQUE INDEX IF NOT EXISTS "product_batches_tenant_id_product_id_batch_no_key" ON public.product_batches("tenant_id","product_id","batch_no");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_id_code_key"           ON public.customers("tenant_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenant_id_code_key"           ON public.suppliers("tenant_id","code");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoices_tenant_id_invoice_no_key" ON public.purchase_invoices("tenant_id","invoice_no");
CREATE UNIQUE INDEX IF NOT EXISTS "sales_invoices_tenant_id_invoice_no_key" ON public.sales_invoices("tenant_id","invoice_no");

-- 1b. Add the non-unique lookup indexes too (the rest of initial-schema.sql CreateIndex lines)
CREATE INDEX IF NOT EXISTS "tenants_slug_idx"                                          ON public.tenants("slug");
CREATE INDEX IF NOT EXISTS "memberships_tenant_id_idx"                                 ON public.memberships("tenant_id");
CREATE INDEX IF NOT EXISTS "memberships_user_id_idx"                                   ON public.memberships("user_id");
CREATE INDEX IF NOT EXISTS "roles_tenant_id_idx"                                       ON public.roles("tenant_id");
CREATE INDEX IF NOT EXISTS "role_permissions_role_id_idx"                              ON public.role_permissions("role_id");
CREATE INDEX IF NOT EXISTS "products_tenant_id_idx"                                    ON public.products("tenant_id");
CREATE INDEX IF NOT EXISTS "products_tenant_id_name_idx"                               ON public.products("tenant_id","name");
CREATE INDEX IF NOT EXISTS "products_tenant_id_is_active_idx"                          ON public.products("tenant_id","is_active");
CREATE INDEX IF NOT EXISTS "product_batches_tenant_id_idx"                             ON public.product_batches("tenant_id");
CREATE INDEX IF NOT EXISTS "product_batches_tenant_id_expiry_date_idx"                 ON public.product_batches("tenant_id","expiry_date");
CREATE INDEX IF NOT EXISTS "product_batches_tenant_id_available_qty_idx"               ON public.product_batches("tenant_id","available_qty");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx"                                   ON public.customers("tenant_id");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_business_name_idx"                     ON public.customers("tenant_id","business_name");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_idx"                                   ON public.suppliers("tenant_id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_business_name_idx"                     ON public.suppliers("tenant_id","business_name");
CREATE INDEX IF NOT EXISTS "purchase_invoices_tenant_id_idx"                           ON public.purchase_invoices("tenant_id");
CREATE INDEX IF NOT EXISTS "purchase_invoices_tenant_id_status_idx"                    ON public.purchase_invoices("tenant_id","status");
CREATE INDEX IF NOT EXISTS "purchase_invoices_tenant_id_supplier_id_idx"               ON public.purchase_invoices("tenant_id","supplier_id");
CREATE INDEX IF NOT EXISTS "purchase_invoices_tenant_id_invoice_date_idx"              ON public.purchase_invoices("tenant_id","invoice_date");
CREATE INDEX IF NOT EXISTS "purchase_invoice_items_tenant_id_idx"                      ON public.purchase_invoice_items("tenant_id");
CREATE INDEX IF NOT EXISTS "purchase_invoice_items_purchase_id_idx"                    ON public.purchase_invoice_items("purchase_id");
CREATE INDEX IF NOT EXISTS "purchase_invoice_items_product_id_idx"                     ON public.purchase_invoice_items("product_id");
CREATE INDEX IF NOT EXISTS "sales_invoices_tenant_id_idx"                              ON public.sales_invoices("tenant_id");
CREATE INDEX IF NOT EXISTS "sales_invoices_tenant_id_status_idx"                       ON public.sales_invoices("tenant_id","status");
CREATE INDEX IF NOT EXISTS "sales_invoices_tenant_id_customer_id_idx"                  ON public.sales_invoices("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "sales_invoices_tenant_id_invoice_date_idx"                 ON public.sales_invoices("tenant_id","invoice_date");
CREATE INDEX IF NOT EXISTS "sales_invoice_items_tenant_id_idx"                         ON public.sales_invoice_items("tenant_id");
CREATE INDEX IF NOT EXISTS "sales_invoice_items_invoice_id_idx"                        ON public.sales_invoice_items("invoice_id");
CREATE INDEX IF NOT EXISTS "sales_invoice_items_product_id_idx"                        ON public.sales_invoice_items("product_id");
CREATE INDEX IF NOT EXISTS "sales_invoice_items_batch_id_idx"                          ON public.sales_invoice_items("batch_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_idx"                                    ON public.payments("tenant_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_customer_id_idx"                        ON public.payments("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_invoice_id_idx"                         ON public.payments("tenant_id","invoice_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_payment_date_idx"                       ON public.payments("tenant_id","payment_date");
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_idx"                             ON public.stock_movements("tenant_id");
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_product_id_idx"                  ON public.stock_movements("tenant_id","product_id");
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_batch_id_idx"                    ON public.stock_movements("tenant_id","batch_id");
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_movement_type_idx"               ON public.stock_movements("tenant_id","movement_type");
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_created_at_idx"                  ON public.stock_movements("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "customer_ledgers_tenant_id_idx"                            ON public.customer_ledgers("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_ledgers_tenant_id_customer_id_idx"                ON public.customer_ledgers("tenant_id","customer_id");
CREATE INDEX IF NOT EXISTS "customer_ledgers_tenant_id_entry_date_idx"                 ON public.customer_ledgers("tenant_id","entry_date");
CREATE INDEX IF NOT EXISTS "supplier_ledgers_tenant_id_idx"                            ON public.supplier_ledgers("tenant_id");
CREATE INDEX IF NOT EXISTS "supplier_ledgers_tenant_id_supplier_id_idx"                ON public.supplier_ledgers("tenant_id","supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_ledgers_tenant_id_entry_date_idx"                 ON public.supplier_ledgers("tenant_id","entry_date");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx"                                  ON public.audit_logs("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_event_type_idx"                       ON public.audit_logs("tenant_id","event_type");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_created_at_idx"                       ON public.audit_logs("tenant_id","created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_actor_id_idx"                         ON public.audit_logs("tenant_id","actor_id");

-- 1c. Re-enable RLS on each business table (idempotent — ENABLE ROW LEVEL SECURITY repeated is fine, no error)
ALTER TABLE IF EXISTS public.tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.memberships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.product_batches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sales_invoice_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_ledgers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_ledgers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs             ENABLE ROW LEVEL SECURITY;

-- 1d. Re-apply GRANTs (authenticated gets CRUD; anon gets SELECT on roles+role_permissions only; prisma gets ALL)
GRANT USAGE, CREATE ON SCHEMA public TO prisma;
GRANT ALL   ON ALL TABLES    IN SCHEMA public TO prisma;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA public TO prisma;
GRANT ALL   ON ALL ROUTINES  IN SCHEMA public TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES  TO prisma;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT                 ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT                 ON SEQUENCES TO authenticated;

GRANT SELECT ON public.roles, public.role_permissions TO anon;

-- 1e. GRANT USAGE on Pharmnos enum types to public + authenticated + prisma (so casting never fails)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' LOOP
    EXECUTE 'GRANT USAGE ON TYPE public.' || quote_ident(r.typname) || ' TO public, authenticated, prisma';
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- PART 2. Return 12-row drift report grid (screenshot/copy this back)
-- ═══════════════════════════════════════════════════════════════════════

-- Grid A (8 rows): global counts + unique indexes + RLS enabled tally + enum types tally
SELECT 'tables_count'          AS "dimension", COUNT(*)::TEXT                           AS "actual", '19' AS "expected" FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name IN ('tenants','users','memberships','roles','role_permissions','business_profiles','products','product_batches','customers','suppliers','purchase_invoices','purchase_invoice_items','sales_invoices','sales_invoice_items','payments','stock_movements','customer_ledgers','supplier_ledgers','audit_logs')
UNION ALL
SELECT 'unique_indexes_count',  COUNT(*)::TEXT, '14' FROM pg_indexes WHERE schemaname='public' AND indexname IN (
  'tenants_slug_key','users_external_id_key','users_email_key','memberships_tenant_id_user_id_key','roles_tenant_id_name_key',
  'role_permissions_role_id_permission_key','business_profiles_tenant_id_key','products_tenant_id_sku_key',
  'product_batches_tenant_id_product_id_batch_no_key','customers_tenant_id_code_key','suppliers_tenant_id_code_key',
  'purchase_invoices_tenant_id_invoice_no_key','sales_invoices_tenant_id_invoice_no_key'
)
UNION ALL
SELECT 'rls_enabled_count',      COUNT(*)::TEXT, '19' FROM pg_tables t WHERE t.schemaname='public' AND t.tablename IN ('tenants','users','memberships','roles','role_permissions','business_profiles','products','product_batches','customers','suppliers','purchase_invoices','purchase_invoice_items','sales_invoices','sales_invoice_items','payments','stock_movements','customer_ledgers','supplier_ledgers','audit_logs') AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t.tablename AND c.relrowsecurity)
UNION ALL
SELECT 'enum_types_count',       COUNT(*)::TEXT, '8'  FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' AND typname IN ('SystemRole','PermissionAction','InvoiceStatus','PaymentMode','StockMovementType','ScheduleClass','AuditEventType','LedgerEntryType')
UNION ALL
SELECT 'permissionaction_enum_labels_count', COUNT(*)::TEXT, '28' FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='PermissionAction'
UNION ALL
SELECT 'tenants_rows',            COUNT(*)::TEXT, '0 / will be 1 after seed'  FROM public.tenants
UNION ALL
SELECT 'roles_rows',              COUNT(*)::TEXT, '0 / will be 4 after seed'  FROM public.roles
UNION ALL
SELECT 'role_permissions_rows',   COUNT(*)::TEXT, '0 / will be 59 after seed' FROM public.role_permissions
ORDER BY 1;
