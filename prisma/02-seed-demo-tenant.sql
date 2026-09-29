-- =====================================================================
-- Pharmnos Lite — Step 2/3: Seed demo tenant (SIMPLEST SQL EVER edition)
-- Paste into Supabase Dashboard SQL Editor → Run.
-- No parser edge cases: every insert is plain INSERT INTO ... VALUES ().
-- Idempotency guard for each row: plain SELECT count BEFORE insert (one line).
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Demo tenant (Maharashtra Pharma Distributors / Pune)
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.tenants WHERE id = 'tn_maharashtra_pharma_0000000000001') = 0 THEN
  INSERT INTO public.tenants (id, slug, business_name, created_at, updated_at) VALUES
    ('tn_maharashtra_pharma_0000000000001', 'maharashtra-pharma-distributors', 'Maharashtra Pharma Distributors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Tenant business profile
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.business_profiles WHERE id = 'bp_maharashtra_pharma_0000000000001') = 0 THEN
  INSERT INTO public.business_profiles (
    id, tenant_id, address_line_1, address_line_2, city, state, pincode, country,
    gstin, pan, drug_license_no_1, drug_license_no_2, contact_phone, contact_email,
    invoice_prefix, invoice_next_seq, purchase_prefix, purchase_next_seq,
    default_gst_rate, near_expiry_days, created_at, updated_at
  ) VALUES (
    'bp_maharashtra_pharma_0000000000001', 'tn_maharashtra_pharma_0000000000001',
    'Shop 12, Central Market', 'Near Shivaji Chowk', 'Pune', 'Maharashtra', '411001', 'India',
    '27AACXX0000B1ZP', 'AACXX0000B', 'MH/2008/PH-001234', 'MH/2008/PH-005678',
    '+91 98 8888 0012', 'accounts@maharashtrapharma.in',
    'INV', 1, 'PUR', 1,
    18.00, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Four system roles (ADMIN/BILLING/INVENTORY/MANAGER)
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.roles WHERE tenant_id = 'tn_maharashtra_pharma_0000000000001') = 0 THEN
  INSERT INTO public.roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at) VALUES
    ('rl_admin_maha_0000000000001',     'tn_maharashtra_pharma_0000000000001', 'ADMIN',      'ADMIN'::public."SystemRole",     'Full access to every feature and tenant setting.',                 true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rl_billing_maha_0000000000001',   'tn_maharashtra_pharma_0000000000001', 'BILLING',    'BILLING'::public."SystemRole",   'Create/finalize invoices, receive payments, view ledgers.',       false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rl_inventory_maha_0000000000001', 'tn_maharashtra_pharma_0000000000001', 'INVENTORY',  'INVENTORY'::public."SystemRole", 'Manage products/batches, purchases, stock adjustments, FEFO.',    false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('rl_manager_maha_0000000000001',   'tn_maharashtra_pharma_0000000000001', 'MANAGER',    'MANAGER'::public."SystemRole",   'Read-only oversight: view purchases/invoices/inventory/reports.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4a. ADMIN (28 rows) — all 28 PermissionAction enum values
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.role_permissions WHERE role_id = 'rl_admin_maha_0000000000001') = 0 THEN
  INSERT INTO public.role_permissions (id, role_id, permission, created_at) VALUES
    ('rp_admin_maha_0001', 'rl_admin_maha_0000000000001', 'manage_users'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0002', 'rl_admin_maha_0000000000001', 'manage_roles'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0003', 'rl_admin_maha_0000000000001', 'manage_business_profile'::public."PermissionAction", CURRENT_TIMESTAMP),
    ('rp_admin_maha_0004', 'rl_admin_maha_0000000000001', 'create_product'::public."PermissionAction",          CURRENT_TIMESTAMP),
    ('rp_admin_maha_0005', 'rl_admin_maha_0000000000001', 'edit_product'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0006', 'rl_admin_maha_0000000000001', 'view_product'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0007', 'rl_admin_maha_0000000000001', 'create_customer'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_admin_maha_0008', 'rl_admin_maha_0000000000001', 'edit_customer'::public."PermissionAction",           CURRENT_TIMESTAMP),
    ('rp_admin_maha_0009', 'rl_admin_maha_0000000000001', 'view_customer'::public."PermissionAction",           CURRENT_TIMESTAMP),
    ('rp_admin_maha_0010', 'rl_admin_maha_0000000000001', 'create_supplier'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_admin_maha_0011', 'rl_admin_maha_0000000000001', 'edit_supplier'::public."PermissionAction",           CURRENT_TIMESTAMP),
    ('rp_admin_maha_0012', 'rl_admin_maha_0000000000001', 'view_supplier'::public."PermissionAction",           CURRENT_TIMESTAMP),
    ('rp_admin_maha_0013', 'rl_admin_maha_0000000000001', 'create_purchase'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_admin_maha_0014', 'rl_admin_maha_0000000000001', 'edit_purchase'::public."PermissionAction",           CURRENT_TIMESTAMP),
    ('rp_admin_maha_0015', 'rl_admin_maha_0000000000001', 'view_purchase'::public."PermissionAction",           CURRENT_TIMESTAMP),
    ('rp_admin_maha_0016', 'rl_admin_maha_0000000000001', 'finalize_purchase'::public."PermissionAction",       CURRENT_TIMESTAMP),
    ('rp_admin_maha_0017', 'rl_admin_maha_0000000000001', 'create_invoice'::public."PermissionAction",          CURRENT_TIMESTAMP),
    ('rp_admin_maha_0018', 'rl_admin_maha_0000000000001', 'edit_invoice'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0019', 'rl_admin_maha_0000000000001', 'view_invoice'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0020', 'rl_admin_maha_0000000000001', 'finalize_invoice'::public."PermissionAction",        CURRENT_TIMESTAMP),
    ('rp_admin_maha_0021', 'rl_admin_maha_0000000000001', 'cancel_invoice'::public."PermissionAction",          CURRENT_TIMESTAMP),
    ('rp_admin_maha_0022', 'rl_admin_maha_0000000000001', 'view_inventory'::public."PermissionAction",          CURRENT_TIMESTAMP),
    ('rp_admin_maha_0023', 'rl_admin_maha_0000000000001', 'adjust_stock'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0024', 'rl_admin_maha_0000000000001', 'manage_batches'::public."PermissionAction",          CURRENT_TIMESTAMP),
    ('rp_admin_maha_0025', 'rl_admin_maha_0000000000001', 'view_customer_ledger'::public."PermissionAction",    CURRENT_TIMESTAMP),
    ('rp_admin_maha_0026', 'rl_admin_maha_0000000000001', 'view_supplier_ledger'::public."PermissionAction",    CURRENT_TIMESTAMP),
    ('rp_admin_maha_0027', 'rl_admin_maha_0000000000001', 'view_reports'::public."PermissionAction",            CURRENT_TIMESTAMP),
    ('rp_admin_maha_0028', 'rl_admin_maha_0000000000001', 'view_audit_log'::public."PermissionAction",          CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4b. BILLING (9 rows) — prisma/seed.ts L43-52 verbatim
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.role_permissions WHERE role_id = 'rl_billing_maha_0000000000001') = 0 THEN
  INSERT INTO public.role_permissions (id, role_id, permission, created_at) VALUES
    ('rp_billing_maha_0001', 'rl_billing_maha_0000000000001', 'view_product'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_billing_maha_0002', 'rl_billing_maha_0000000000001', 'view_customer'::public."PermissionAction",        CURRENT_TIMESTAMP),
    ('rp_billing_maha_0003', 'rl_billing_maha_0000000000001', 'view_supplier'::public."PermissionAction",        CURRENT_TIMESTAMP),
    ('rp_billing_maha_0004', 'rl_billing_maha_0000000000001', 'create_invoice'::public."PermissionAction",       CURRENT_TIMESTAMP),
    ('rp_billing_maha_0005', 'rl_billing_maha_0000000000001', 'edit_invoice'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_billing_maha_0006', 'rl_billing_maha_0000000000001', 'view_invoice'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_billing_maha_0007', 'rl_billing_maha_0000000000001', 'finalize_invoice'::public."PermissionAction",     CURRENT_TIMESTAMP),
    ('rp_billing_maha_0008', 'rl_billing_maha_0000000000001', 'view_customer_ledger'::public."PermissionAction", CURRENT_TIMESTAMP),
    ('rp_billing_maha_0009', 'rl_billing_maha_0000000000001', 'view_inventory'::public."PermissionAction",       CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4c. INVENTORY (12 rows) — prisma/seed.ts L54-66 verbatim
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.role_permissions WHERE role_id = 'rl_inventory_maha_0000000000001') = 0 THEN
  INSERT INTO public.role_permissions (id, role_id, permission, created_at) VALUES
    ('rp_inventory_maha_0001', 'rl_inventory_maha_0000000000001', 'view_product'::public."PermissionAction",      CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0002', 'rl_inventory_maha_0000000000001', 'create_product'::public."PermissionAction",    CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0003', 'rl_inventory_maha_0000000000001', 'edit_product'::public."PermissionAction",      CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0004', 'rl_inventory_maha_0000000000001', 'view_customer'::public."PermissionAction",     CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0005', 'rl_inventory_maha_0000000000001', 'view_supplier'::public."PermissionAction",     CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0006', 'rl_inventory_maha_0000000000001', 'create_purchase'::public."PermissionAction",   CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0007', 'rl_inventory_maha_0000000000001', 'edit_purchase'::public."PermissionAction",     CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0008', 'rl_inventory_maha_0000000000001', 'view_purchase'::public."PermissionAction",     CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0009', 'rl_inventory_maha_0000000000001', 'finalize_purchase'::public."PermissionAction", CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0010', 'rl_inventory_maha_0000000000001', 'view_inventory'::public."PermissionAction",    CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0011', 'rl_inventory_maha_0000000000001', 'adjust_stock'::public."PermissionAction",      CURRENT_TIMESTAMP),
    ('rp_inventory_maha_0012', 'rl_inventory_maha_0000000000001', 'manage_batches'::public."PermissionAction",    CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4d. MANAGER (10 rows) — prisma/seed.ts L68-78 verbatim
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.role_permissions WHERE role_id = 'rl_manager_maha_0000000000001') = 0 THEN
  INSERT INTO public.role_permissions (id, role_id, permission, created_at) VALUES
    ('rp_manager_maha_0001', 'rl_manager_maha_0000000000001', 'view_product'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_manager_maha_0002', 'rl_manager_maha_0000000000001', 'view_customer'::public."PermissionAction",        CURRENT_TIMESTAMP),
    ('rp_manager_maha_0003', 'rl_manager_maha_0000000000001', 'view_supplier'::public."PermissionAction",        CURRENT_TIMESTAMP),
    ('rp_manager_maha_0004', 'rl_manager_maha_0000000000001', 'view_purchase'::public."PermissionAction",        CURRENT_TIMESTAMP),
    ('rp_manager_maha_0005', 'rl_manager_maha_0000000000001', 'view_invoice'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_manager_maha_0006', 'rl_manager_maha_0000000000001', 'view_inventory'::public."PermissionAction",       CURRENT_TIMESTAMP),
    ('rp_manager_maha_0007', 'rl_manager_maha_0000000000001', 'view_customer_ledger'::public."PermissionAction", CURRENT_TIMESTAMP),
    ('rp_manager_maha_0008', 'rl_manager_maha_0000000000001', 'view_supplier_ledger'::public."PermissionAction", CURRENT_TIMESTAMP),
    ('rp_manager_maha_0009', 'rl_manager_maha_0000000000001', 'view_reports'::public."PermissionAction",         CURRENT_TIMESTAMP),
    ('rp_manager_maha_0010', 'rl_manager_maha_0000000000001', 'view_audit_log'::public."PermissionAction",       CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Demo admin user: Rajesh Kumar (owner@maharashtrapharma.in)
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.users WHERE email = 'owner@maharashtrapharma.in') = 0 THEN
  INSERT INTO public.users (id, external_id, email, full_name, phone, avatar_url, created_at, updated_at) VALUES
    ('usr_rajesh_kumar_0000000000001', 'demo-rajesh-0001', 'owner@maharashtrapharma.in', 'Rajesh Kumar', '+91 98 8888 0012', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
END IF; END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Admin membership: Rajesh Kumar → ADMIN → status active
-- ═══════════════════════════════════════════════════════════════════════
DO $$ BEGIN IF (SELECT count(*) FROM public.memberships WHERE tenant_id = 'tn_maharashtra_pharma_0000000000001' AND user_id = 'usr_rajesh_kumar_0000000000001') = 0 THEN
  INSERT INTO public.memberships (
    id, tenant_id, user_id, role_id, status, invited_by, invited_at, joined_at, created_at, updated_at
  ) VALUES (
    'mb_rajesh_admin_0000000000001', 'tn_maharashtra_pharma_0000000000001', 'usr_rajesh_kumar_0000000000001',
    'rl_admin_maha_0000000000001', 'active', 'usr_rajesh_kumar_0000000000001',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );
END IF; END $$;
