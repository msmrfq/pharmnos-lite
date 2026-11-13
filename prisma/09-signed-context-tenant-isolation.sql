-- ============================================================================
-- Pharmnos Lite — Signed-context tenant isolation (direct Prisma/runtime path)
-- Deployable, idempotent SQL module. Apply AFTER `prisma migrate deploy` (0001–0031)
-- and AFTER 01-apply-schema-with-rls.sql if using the hosted Supabase path.
--
-- This is NOT the E2E disposable provisioner and NOT the PostgREST gateway path.
-- It installs the HMAC-signed `pharmnos.auth_context` verification used by the
-- application's direct Prisma/PostgreSQL connection (ADR 0010 / 0011).
--
-- Relationship to the other RLS artifacts (documented, not accidental):
--   * prisma/05-rls-tenant-policies.sql  -> PostgREST gateway, auth.jwt() app-metadata.
--   * prisma/migrations (0001..0031)     -> schema, no general RLS (only 0020 policy).
--   * this file                           -> direct app path, signed context, FORCE RLS.
-- All policy sets are PERMISSIVE and OR together; a role that satisfies either the
-- JWT gateway policy or the signed-context policy is permitted.
--
-- Security model:
--   * tenant identity = Supabase Auth subject -> exactly one active membership.
--   * the application writes a 60-second HMAC-SHA256 `pharmnos.auth_context` GUC,
--     transaction-locally, via establishTenantContext().
--   * missing / expired / malformed / wrong-signature context returns no row -> the
--     policy predicate is false -> the statement is DENIED (fail closed).
--   * FORCE ROW LEVEL SECURITY binds every role except superuser/BYPASSRLS, so the
--     application runtime role must be non-superuser and NOBYPASSRLS.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS pharmnos_private;

CREATE TABLE IF NOT EXISTS pharmnos_private.auth_context_keys (
  key_name text PRIMARY KEY,
  signing_secret text NOT NULL
);

CREATE TABLE IF NOT EXISTS pharmnos_private.auth_context_replays (
  nonce text PRIMARY KEY,
  first_transaction_id bigint NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

REVOKE ALL ON SCHEMA pharmnos_private FROM PUBLIC;
REVOKE ALL ON TABLE pharmnos_private.auth_context_keys FROM PUBLIC;
REVOKE ALL ON TABLE pharmnos_private.auth_context_replays FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Operator provisioning step (run once; never commit a secret).
-- The value MUST equal the DATABASE_AUTH_CONTEXT_SIGNING_SECRET the application
-- uses to sign the context. Leave commented out in the artifact.
-- ----------------------------------------------------------------------------
-- INSERT INTO pharmnos_private.auth_context_keys (key_name, signing_secret)
-- VALUES ('financial-auth-context', '[SET VIA SQL EDITOR — DO NOT COMMIT A SECRET]');

-- ----------------------------------------------------------------------------
-- Verify the signed context and return the bound subject/tenant, or no rows.
-- SECURITY DEFINER so callers never need direct access to the signing key.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pharmnos_private.verify_auth_context(context text)
RETURNS TABLE(subject_id text, tenant_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pharmnos_private
AS $function$
DECLARE
  payload text;
  supplied_signature text;
  expected_signature text;
  signing_secret text;
  expires_at bigint;
  context_nonce text;
  accepted_transaction_id bigint;
  context_subject text;
  context_tenant text;
BEGIN
  IF context IS NULL OR split_part(context, '.', 2) = '' THEN RETURN; END IF;
  payload := split_part(context, '.', 1);
  supplied_signature := split_part(context, '.', 2);
  SELECT k.signing_secret INTO signing_secret
  FROM pharmnos_private.auth_context_keys AS k
  WHERE k.key_name = 'financial-auth-context';
  IF signing_secret IS NULL THEN RETURN; END IF;
  expected_signature := encode(public.hmac(payload, signing_secret, 'sha256'), 'hex');
  IF supplied_signature <> expected_signature THEN RETURN; END IF;
  IF split_part(payload, '|', 1) <> 'v1' THEN RETURN; END IF;
  expires_at := split_part(payload, '|', 4)::bigint;
  IF expires_at <= extract(epoch FROM clock_timestamp())::bigint THEN RETURN; END IF;
  context_nonce := split_part(payload, '|', 5);
  IF context_nonce !~ '^[0-9a-f]{32}$' THEN RETURN; END IF;
  context_subject := NULLIF(split_part(payload, '|', 2), '');
  context_tenant := NULLIF(split_part(payload, '|', 3), '');
  IF context_subject IS NULL THEN RETURN; END IF;
  IF context_tenant IS NULL THEN
    SELECT min(m.tenant_id::text) INTO context_tenant
    FROM public.users AS u
    JOIN public.memberships AS m ON m.user_id = u.id
    WHERE u.external_id = context_subject
      AND m.status = 'active'
    HAVING count(*) = 1;
  END IF;
  IF context_tenant IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS u
    JOIN public.memberships AS m ON m.user_id = u.id
    WHERE u.external_id = context_subject
      AND m.tenant_id::text = context_tenant
      AND m.status = 'active'
  ) THEN RETURN; END IF;
  subject_id := context_subject;
  tenant_id := context_tenant;
  INSERT INTO pharmnos_private.auth_context_replays (nonce, first_transaction_id)
  VALUES (context_nonce, txid_current())
  ON CONFLICT (nonce) DO NOTHING;
  SELECT r.first_transaction_id INTO accepted_transaction_id
  FROM pharmnos_private.auth_context_replays AS r
  WHERE r.nonce = context_nonce;
  IF accepted_transaction_id <> txid_current() THEN RETURN; END IF;
  RETURN NEXT;
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.financial_context_subject()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pharmnos_private
AS $function$
  SELECT subject_id FROM pharmnos_private.verify_auth_context(current_setting('pharmnos.auth_context', true)) LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.financial_context_tenant_id()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, pharmnos_private
AS $function$
  SELECT tenant_id FROM pharmnos_private.verify_auth_context(current_setting('pharmnos.auth_context', true)) LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.financial_context_is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pharmnos_private
AS $function$
DECLARE
  context_subject text;
  context_tenant text;
BEGIN
  SELECT subject_id, tenant_id INTO context_subject, context_tenant
  FROM pharmnos_private.verify_auth_context(current_setting('pharmnos.auth_context', true)) LIMIT 1;
  IF context_subject IS NULL OR context_tenant IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.memberships AS m
    JOIN public.users AS u ON u.id = m.user_id
    JOIN public.roles AS r ON r.id = m.role_id
    WHERE m.tenant_id::text = context_tenant
      AND m.status = 'active'
      AND u.external_id = context_subject
      AND r.system_role = 'ADMIN'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION pharmnos_private.verify_auth_context(text) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Per-table signed-context policies. All are PERMISSIVE; FORCE RLS binds the
-- application runtime role (which must be non-superuser / NOBYPASSRLS).
-- ----------------------------------------------------------------------------

-- tenants: id IS the tenant.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signed_ctx_select" ON public.tenants;
DROP POLICY IF EXISTS "signed_ctx_insert" ON public.tenants;
DROP POLICY IF EXISTS "signed_ctx_update" ON public.tenants;
CREATE POLICY "signed_ctx_select" ON public.tenants FOR SELECT USING (id::text = public.financial_context_tenant_id());
CREATE POLICY "signed_ctx_insert" ON public.tenants FOR INSERT WITH CHECK (id::text = public.financial_context_tenant_id());
CREATE POLICY "signed_ctx_update" ON public.tenants FOR UPDATE USING (id::text = public.financial_context_tenant_id()) WITH CHECK (id::text = public.financial_context_tenant_id());

-- users: reachable through the authenticated subject.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signed_ctx_select" ON public.users;
DROP POLICY IF EXISTS "signed_ctx_insert" ON public.users;
DROP POLICY IF EXISTS "signed_ctx_update" ON public.users;
CREATE POLICY "signed_ctx_select" ON public.users FOR SELECT USING (external_id = public.financial_context_subject());
CREATE POLICY "signed_ctx_insert" ON public.users FOR INSERT WITH CHECK (external_id = public.financial_context_subject());
CREATE POLICY "signed_ctx_update" ON public.users FOR UPDATE USING (external_id = public.financial_context_subject()) WITH CHECK (external_id = public.financial_context_subject());

-- roles / role_permissions / memberships: admin-gated writes; subject-aware reads.
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signed_ctx_select" ON public.roles;
DROP POLICY IF EXISTS "signed_ctx_insert" ON public.roles;
DROP POLICY IF EXISTS "signed_ctx_update" ON public.roles;
CREATE POLICY "signed_ctx_select" ON public.roles FOR SELECT USING (
  (tenant_id::text = public.financial_context_tenant_id())
  OR EXISTS (
    SELECT 1 FROM public.memberships AS m
    JOIN public.users AS u ON u.id = m.user_id
    WHERE m.role_id = roles.id
      AND m.status = 'active'
      AND u.external_id = public.financial_context_subject()
      AND m.tenant_id::text = public.financial_context_tenant_id()
  )
);
CREATE POLICY "signed_ctx_insert" ON public.roles FOR INSERT WITH CHECK (
  (tenant_id::text = public.financial_context_tenant_id()) AND public.financial_context_is_admin()
);
CREATE POLICY "signed_ctx_update" ON public.roles FOR UPDATE
  USING ((tenant_id::text = public.financial_context_tenant_id()) AND public.financial_context_is_admin())
  WITH CHECK ((tenant_id::text = public.financial_context_tenant_id()) AND public.financial_context_is_admin());

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signed_ctx_select" ON public.role_permissions;
DROP POLICY IF EXISTS "signed_ctx_insert" ON public.role_permissions;
DROP POLICY IF EXISTS "signed_ctx_update" ON public.role_permissions;
CREATE POLICY "signed_ctx_select" ON public.role_permissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.roles AS r
    WHERE r.id = role_permissions.role_id
      AND r.tenant_id::text = public.financial_context_tenant_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.roles AS r
    JOIN public.memberships AS m ON m.role_id = r.id
    JOIN public.users AS u ON u.id = m.user_id
    WHERE r.id = role_permissions.role_id
      AND m.status = 'active'
      AND u.external_id = public.financial_context_subject()
      AND m.tenant_id::text = public.financial_context_tenant_id()
  )
);
CREATE POLICY "signed_ctx_insert" ON public.role_permissions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.roles AS r
    WHERE r.id = role_permissions.role_id
      AND r.tenant_id::text = public.financial_context_tenant_id()
  )
  AND public.financial_context_is_admin()
);
CREATE POLICY "signed_ctx_update" ON public.role_permissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.roles AS r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id::text = public.financial_context_tenant_id()
    )
    AND public.financial_context_is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles AS r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id::text = public.financial_context_tenant_id()
    )
    AND public.financial_context_is_admin()
  );

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signed_ctx_select" ON public.memberships;
DROP POLICY IF EXISTS "signed_ctx_insert" ON public.memberships;
DROP POLICY IF EXISTS "signed_ctx_update" ON public.memberships;
CREATE POLICY "signed_ctx_select" ON public.memberships FOR SELECT USING (
  (tenant_id::text = public.financial_context_tenant_id())
  OR (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users AS u
      WHERE u.id = memberships.user_id
        AND u.external_id = public.financial_context_subject()
        AND memberships.tenant_id::text = public.financial_context_tenant_id()
    )
  )
);
CREATE POLICY "signed_ctx_insert" ON public.memberships FOR INSERT WITH CHECK (
  (tenant_id::text = public.financial_context_tenant_id()) AND public.financial_context_is_admin()
);
CREATE POLICY "signed_ctx_update" ON public.memberships FOR UPDATE
  USING ((tenant_id::text = public.financial_context_tenant_id()) AND public.financial_context_is_admin())
  WITH CHECK ((tenant_id::text = public.financial_context_tenant_id()) AND public.financial_context_is_admin());

-- Every remaining tenant-scoped table: direct tenant predicate; immutable tables
-- and audit_logs get no UPDATE policy.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'business_profiles','products','product_batches','customers','suppliers',
    'purchase_invoices','purchase_supplier_documents','purchase_posting_operations',
    'sales_posting_operations','purchase_invoice_items',
    'purchase_gst_evidence_revisions','purchase_gst_line_evidence','purchase_gst_calculations',
    'purchase_gst_accounting_decisions','purchase_gst_reconciliation_events',
    'purchase_gst_reconciliation_event_lines','inventory_valuation_decisions',
    'inventory_valuation_adjustments','sales_invoices','sales_invoice_items',
    'payments','payment_receipt_sequences','payment_allocations','allocation_reversals',
    'payment_refunds','payment_reversals','stock_movements','customer_ledgers',
    'supplier_ledgers','audit_logs','hsn_sac_catalog_history','gst_rate_rule_history'
  ];
  immutable text[] := ARRAY[
    'purchase_gst_evidence_revisions','purchase_gst_line_evidence','purchase_gst_calculations',
    'purchase_gst_accounting_decisions','purchase_gst_reconciliation_events',
    'purchase_gst_reconciliation_event_lines','inventory_valuation_decisions',
    'inventory_valuation_adjustments','hsn_sac_catalog_history','gst_rate_rule_history'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'signed-context RLS: skipping missing table %', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "signed_ctx_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "signed_ctx_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "signed_ctx_update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "signed_ctx_select" ON public.%I FOR SELECT USING (tenant_id::text = public.financial_context_tenant_id())', t);
    EXECUTE format('CREATE POLICY "signed_ctx_insert" ON public.%I FOR INSERT WITH CHECK (tenant_id::text = public.financial_context_tenant_id())', t);
    IF NOT (t = ANY(immutable)) AND t <> 'audit_logs' THEN
      EXECUTE format('CREATE POLICY "signed_ctx_update" ON public.%I FOR UPDATE USING (tenant_id::text = public.financial_context_tenant_id()) WITH CHECK (tenant_id::text = public.financial_context_tenant_id())', t);
    END IF;
  END LOOP;
END $$;

-- GST catalog (hsn_sac_catalog, gst_rate_rules): read-only for the app.
DO $$
DECLARE
  t text;
  catalog text[] := ARRAY['hsn_sac_catalog','gst_rate_rules'];
BEGIN
  FOREACH t IN ARRAY catalog LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "signed_ctx_select" ON public.%I', t);
    EXECUTE format('CREATE POLICY "signed_ctx_select" ON public.%I FOR SELECT USING (tenant_id::text = public.financial_context_tenant_id())', t);
  END LOOP;
END $$;
