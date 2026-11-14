-- Create test tenant
INSERT INTO public.tenants (id, business_name, slug, created_at, updated_at)
VALUES ('tenant_a', 'Test Pharmacy A', 'test-a', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenants (id, business_name, slug, created_at, updated_at)
VALUES ('tenant_b', 'Test Pharmacy B', 'test-b', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create users (external_id matches Supabase Auth user ID pattern)
INSERT INTO public.users (id, external_id, full_name, email, created_at, updated_at)
VALUES ('user_a', 'auth_user_a', 'Test User A', 'usera@test.com', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, external_id, full_name, email, created_at, updated_at)
VALUES ('user_b', 'auth_user_b', 'Test User B', 'userb@test.com', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create roles per tenant
INSERT INTO public.roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at)
VALUES ('role_admin_a', 'tenant_a', 'Admin', 'ADMIN', 'Administrator', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at)
VALUES ('role_admin_b', 'tenant_b', 'Admin', 'ADMIN', 'Administrator', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at)
VALUES ('role_pharmacist_a', 'tenant_a', 'Pharmacist', 'MANAGER', 'Pharmacist', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, tenant_id, name, system_role, description, is_default, created_at, updated_at)
VALUES ('role_pharmacist_b', 'tenant_b', 'Pharmacist', 'MANAGER', 'Pharmacist', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create permissions using correct PermissionAction enum values
INSERT INTO public.role_permissions (id, role_id, permission, created_at)
SELECT gen_random_uuid(), r.id, p::"PermissionAction", NOW()
FROM public.roles r
CROSS JOIN LATERAL (VALUES 
  ('view_inventory'), ('view_customer'), ('view_supplier'), ('view_invoice'),
  ('view_purchase'), ('view_reports'), ('manage_hsn_catalog'),
  ('manage_business_profile'), ('edit_purchase'), ('create_payment'),
  ('view_customer_ledger'), ('view_supplier_ledger')
) AS perms(p)
WHERE r.id IN ('role_admin_a', 'role_admin_b', 'role_pharmacist_a', 'role_pharmacist_b')
ON CONFLICT DO NOTHING;

-- Create memberships
INSERT INTO public.memberships (id, user_id, tenant_id, role_id, status, created_at, updated_at)
VALUES ('membership_a', 'user_a', 'tenant_a', 'role_admin_a', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.memberships (id, user_id, tenant_id, role_id, status, created_at, updated_at)
VALUES ('membership_b', 'user_b', 'tenant_b', 'role_admin_b', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create business profiles
INSERT INTO public.business_profiles (id, tenant_id, state, invoice_prefix, purchase_prefix, invoice_next_seq, purchase_next_seq, near_expiry_days, created_at, updated_at)
VALUES (gen_random_uuid(), 'tenant_a', 'Maharashtra', 'INV', 'PUR', 1, 1, 60, NOW(), NOW())
ON CONFLICT DO NOTHING;

INSERT INTO public.business_profiles (id, tenant_id, state, invoice_prefix, purchase_prefix, invoice_next_seq, purchase_next_seq, near_expiry_days, created_at, updated_at)
VALUES (gen_random_uuid(), 'tenant_b', 'Maharashtra', 'INV', 'PUR', 1, 1, 60, NOW(), NOW())
ON CONFLICT DO NOTHING;

SELECT 'Setup complete' AS status;