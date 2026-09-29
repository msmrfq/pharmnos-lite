-- =====================================================================
-- Pharmnos Lite — Step 1/3: Schema + RLS bootstrap on Supabase Free
-- Run ONE time in Supabase Dashboard SQL Editor (NOT Table Editor).
-- Idempotent: safe to re-click Run if connection drops mid-execution.
-- =====================================================================

-- 1. Ensure `prisma` role (created earlier in SQL Editor) has grants + default privileges
GRANT USAGE, CREATE ON SCHEMA public TO prisma;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO prisma;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO prisma;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES    TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO prisma;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON ROUTINES  TO prisma;

-- 2. Idempotency: cleanly drop every Pharmnos table/type (if they exist) in reverse FK order
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name IN (
        'audit_logs','supplier_ledgers','customer_ledgers','stock_movements','payments',
        'sales_invoice_items','sales_invoices','purchase_invoice_items','purchase_invoices',
        'product_batches','products','business_profiles','role_permissions','suppliers',
        'customers','memberships','roles','users','tenants'
      )
  LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
  END LOOP;

  FOR r IN
    SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
      AND typname IN (
        'SystemRole','PermissionAction','InvoiceStatus','PaymentMode',
        'StockMovementType','ScheduleClass','AuditEventType','LedgerEntryType'
      )
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE');
  END LOOP;
END $$;

-- =====================================================================
-- 3. Auto-generated DDL from prisma/schema.prisma via prisma migrate diff
-- =====================================================================

-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('ADMIN', 'BILLING', 'INVENTORY', 'MANAGER');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('manage_users', 'manage_roles', 'manage_business_profile', 'create_product', 'edit_product', 'view_product', 'create_customer', 'edit_customer', 'view_customer', 'create_supplier', 'edit_supplier', 'view_supplier', 'create_purchase', 'edit_purchase', 'view_purchase', 'finalize_purchase', 'create_invoice', 'edit_invoice', 'view_invoice', 'finalize_invoice', 'cancel_invoice', 'view_inventory', 'adjust_stock', 'manage_batches', 'view_customer_ledger', 'view_supplier_ledger', 'view_reports', 'view_audit_log');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD', 'UPI', 'CREDIT', 'MIXED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'SALES_RETURN_IN', 'PURCHASE_RETURN_OUT', 'OPENING_STOCK');

-- CreateEnum
CREATE TYPE "ScheduleClass" AS ENUM ('H', 'H1', 'X', 'SCHEDULE_H', 'SCHEDULE_H1', 'SCHEDULE_X', 'OTC', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('AUTH_LOGIN', 'AUTH_LOGOUT', 'USER_INVITED', 'USER_ROLE_CHANGED', 'BUSINESS_PROFILE_UPDATED', 'INVOICE_CREATED', 'INVOICE_FINALIZED', 'INVOICE_CANCELLED', 'PURCHASE_CREATED', 'PURCHASE_FINALIZED', 'STOCK_ADJUSTED', 'PRICE_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INVOICE', 'PAYMENT_RECEIVED', 'CREDIT_NOTE', 'PURCHASE', 'PAYMENT_MADE', 'DEBIT_NOTE', 'OPENING_BALANCE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "external_id" TEXT,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "invited_by" TEXT,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_role" "SystemRole",
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission" "PermissionAction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "gstin" TEXT,
    "pan" TEXT,
    "drug_license_no_1" TEXT,
    "drug_license_no_2" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'INV',
    "invoice_next_seq" INTEGER NOT NULL DEFAULT 1,
    "purchase_prefix" TEXT NOT NULL DEFAULT 'PUR',
    "purchase_next_seq" INTEGER NOT NULL DEFAULT 1,
    "default_gst_rate" DECIMAL(5,2),
    "near_expiry_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "generic_name" TEXT,
    "manufacturer" TEXT,
    "pack_size" TEXT,
    "hsn_code" TEXT,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "schedule_classification" "ScheduleClass",
    "mrp" DECIMAL(12,2),
    "standard_sale_rate" DECIMAL(12,2),
    "purchase_rate" DECIMAL(12,2),
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_batches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_no" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "mrp" DECIMAL(12,2),
    "purchase_rate" DECIMAL(12,2),
    "sale_rate" DECIMAL(12,2),
    "received_qty" INTEGER NOT NULL DEFAULT 0,
    "available_qty" INTEGER NOT NULL DEFAULT 0,
    "supplier_id" TEXT,
    "purchase_id" TEXT,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT,
    "business_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "billing_address_1" TEXT,
    "billing_address_2" TEXT,
    "billing_city" TEXT,
    "billing_state" TEXT,
    "billing_pincode" TEXT,
    "gstin" TEXT,
    "drug_license_no_1" TEXT,
    "drug_license_no_2" TEXT,
    "credit_limit" DECIMAL(14,2),
    "opening_balance" DECIMAL(14,2),
    "receivable_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" TEXT,
    "business_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address_1" TEXT,
    "address_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "gstin" TEXT,
    "drug_license_no" TEXT,
    "opening_balance" DECIMAL(14,2),
    "payable_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "supplier_invoice_no" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "total_discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_no" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "free_qty" INTEGER NOT NULL DEFAULT 0,
    "purchase_rate" DECIMAL(12,2) NOT NULL,
    "discount_pct" DECIMAL(5,2),
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "mrp" DECIMAL(12,2),
    "sale_rate" DECIMAL(12,2),
    "line_total" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "customer_id" TEXT,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "is_cash_sale" BOOLEAN NOT NULL DEFAULT false,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "total_discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payment_mode" "PaymentMode",
    "notes" TEXT,
    "created_by" TEXT,
    "finalized_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "batch_no" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "free_qty" INTEGER NOT NULL DEFAULT 0,
    "sale_rate" DECIMAL(12,2) NOT NULL,
    "mrp" DECIMAL(12,2),
    "discount_pct" DECIMAL(5,2),
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "gst_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "invoice_id" TEXT,
    "entry_type" "LedgerEntryType" NOT NULL,
    "payment_mode" "PaymentMode",
    "amount" DECIMAL(14,2) NOT NULL,
    "reference_no" TEXT,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "unit_rate" DECIMAL(12,2),
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_ledgers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "invoice_id" TEXT,
    "narration" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ledgers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "purchase_id" TEXT,
    "narration" TEXT,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_type" "AuditEventType" NOT NULL,
    "actor_id" TEXT,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_external_id_key" ON "users"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key" ON "memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_key" ON "role_permissions"("role_id", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_tenant_id_key" ON "business_profiles"("tenant_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_idx" ON "products"("tenant_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_name_idx" ON "products"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "products_tenant_id_is_active_idx" ON "products"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "product_batches_tenant_id_idx" ON "product_batches"("tenant_id");

-- CreateIndex
CREATE INDEX "product_batches_tenant_id_expiry_date_idx" ON "product_batches"("tenant_id", "expiry_date");

-- CreateIndex
CREATE INDEX "product_batches_tenant_id_available_qty_idx" ON "product_batches"("tenant_id", "available_qty");

-- CreateIndex
CREATE UNIQUE INDEX "product_batches_tenant_id_product_id_batch_no_key" ON "product_batches"("tenant_id", "product_id", "batch_no");

-- CreateIndex
CREATE INDEX "customers_tenant_id_idx" ON "customers"("tenant_id");

-- CreateIndex
CREATE INDEX "customers_tenant_id_business_name_idx" ON "customers"("tenant_id", "business_name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_code_key" ON "customers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers"("tenant_id");

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_business_name_idx" ON "suppliers"("tenant_id", "business_name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_invoices_tenant_id_idx" ON "purchase_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_tenant_id_status_idx" ON "purchase_invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "purchase_invoices_tenant_id_supplier_id_idx" ON "purchase_invoices"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_invoices_tenant_id_invoice_date_idx" ON "purchase_invoices"("tenant_id", "invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_tenant_id_invoice_no_key" ON "purchase_invoices"("tenant_id", "invoice_no");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_tenant_id_idx" ON "purchase_invoice_items"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_purchase_id_idx" ON "purchase_invoice_items"("purchase_id");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_product_id_idx" ON "purchase_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_id_idx" ON "sales_invoices"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_id_status_idx" ON "sales_invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_id_customer_id_idx" ON "sales_invoices"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "sales_invoices_tenant_id_invoice_date_idx" ON "sales_invoices"("tenant_id", "invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_tenant_id_invoice_no_key" ON "sales_invoices"("tenant_id", "invoice_no");

-- CreateIndex
CREATE INDEX "sales_invoice_items_tenant_id_idx" ON "sales_invoice_items"("tenant_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_invoice_id_idx" ON "sales_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_product_id_idx" ON "sales_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_invoice_items_batch_id_idx" ON "sales_invoice_items"("batch_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_customer_id_idx" ON "payments"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_invoice_id_idx" ON "payments"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_payment_date_idx" ON "payments"("tenant_id", "payment_date");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_idx" ON "stock_movements"("tenant_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_product_id_idx" ON "stock_movements"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_batch_id_idx" ON "stock_movements"("tenant_id", "batch_id");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_movement_type_idx" ON "stock_movements"("tenant_id", "movement_type");

-- CreateIndex
CREATE INDEX "stock_movements_tenant_id_created_at_idx" ON "stock_movements"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_ledgers_tenant_id_idx" ON "customer_ledgers"("tenant_id");

-- CreateIndex
CREATE INDEX "customer_ledgers_tenant_id_customer_id_idx" ON "customer_ledgers"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_ledgers_tenant_id_entry_date_idx" ON "customer_ledgers"("tenant_id", "entry_date");

-- CreateIndex
CREATE INDEX "supplier_ledgers_tenant_id_idx" ON "supplier_ledgers"("tenant_id");

-- CreateIndex
CREATE INDEX "supplier_ledgers_tenant_id_supplier_id_idx" ON "supplier_ledgers"("tenant_id", "supplier_id");

-- CreateIndex
CREATE INDEX "supplier_ledgers_tenant_id_entry_date_idx" ON "supplier_ledgers"("tenant_id", "entry_date");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_event_type_idx" ON "audit_logs"("tenant_id", "event_type");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_actor_id_idx" ON "audit_logs"("tenant_id", "actor_id");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledgers" ADD CONSTRAINT "customer_ledgers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledgers" ADD CONSTRAINT "customer_ledgers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_ledgers" ADD CONSTRAINT "customer_ledgers_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledgers" ADD CONSTRAINT "supplier_ledgers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledgers" ADD CONSTRAINT "supplier_ledgers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledgers" ADD CONSTRAINT "supplier_ledgers_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- 4. GRANT authenticated-only access (anon gets NO writes, reference lookups only)
-- =====================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT          ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT          ON SEQUENCES TO authenticated;

-- Cross-tenant reference tables (read-only, public lookup):
GRANT SELECT ON public.roles, public.role_permissions TO anon;

-- =====================================================================
-- 5. RLS enable on every business table (DB-layer defense in depth)
--    Default deny = no policies created yet; Data API returns 0 rows today.
--    TENANT-SCOPED POLICIES run AFTER seed (Step 3/3 file later).
-- =====================================================================
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
