CREATE SCHEMA IF NOT EXISTS q14_security;
REVOKE ALL ON SCHEMA q14_security FROM PUBLIC;
GRANT USAGE ON SCHEMA q14_security TO "pharmnos_e2e", "pharmnos_e2e_runtime",
    "pharmnos_e2e_admin", "pharmnos_e2e_validation";

CREATE TABLE IF NOT EXISTS public.q14_trigger_allowlist (
    trigger_name text PRIMARY KEY,
    table_name text NOT NULL,
    purpose text NOT NULL,
    protection_class text NOT NULL CHECK (
        protection_class IN ('ELIGIBLE_MAINTENANCE', 'TENANT_ISOLATION', 'SECURITY', 'AUDIT', 'IMMUTABILITY', 'REFERENTIAL_INTEGRITY', 'FINALIZED_HISTORY')
    ),
    eligible boolean NOT NULL,
    expected_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.q14_maintenance_probe (
    id text PRIMARY KEY,
    marker text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION q14_security.eligible_probe_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS q14_eligible_maintenance_trigger ON public.q14_maintenance_probe;
CREATE TRIGGER q14_eligible_maintenance_trigger
BEFORE UPDATE ON public.q14_maintenance_probe
FOR EACH ROW EXECUTE FUNCTION q14_security.eligible_probe_trigger();

INSERT INTO public.q14_trigger_allowlist
    (trigger_name, table_name, purpose, protection_class, eligible)
VALUES
    ('q14_eligible_maintenance_trigger', 'q14_maintenance_probe', 'Q14_ALLOWLISTED_PROBE_MAINTENANCE', 'ELIGIBLE_MAINTENANCE', true),
    ('prevent_purchase_gst_evidence_revisions_mutation', 'purchase_gst_evidence_revisions', 'IMMUTABLE_GST_HISTORY', 'IMMUTABILITY', false),
    ('prevent_purchase_gst_line_evidence_mutation', 'purchase_gst_line_evidence', 'IMMUTABLE_GST_HISTORY', 'IMMUTABILITY', false),
    ('prevent_purchase_gst_calculations_mutation', 'purchase_gst_calculations', 'IMMUTABLE_GST_HISTORY', 'IMMUTABILITY', false),
    ('prevent_purchase_gst_accounting_decisions_mutation', 'purchase_gst_accounting_decisions', 'IMMUTABLE_GST_HISTORY', 'IMMUTABILITY', false),
    ('prevent_purchase_gst_reconciliation_events_mutation', 'purchase_gst_reconciliation_events', 'IMMUTABLE_RECONCILIATION_HISTORY', 'IMMUTABILITY', false),
    ('prevent_purchase_gst_reconciliation_event_lines_mutation', 'purchase_gst_reconciliation_event_lines', 'IMMUTABLE_RECONCILIATION_HISTORY', 'IMMUTABILITY', false),
    ('prevent_finalized_purchase_mutation', 'purchase_invoices', 'FINALIZED_PURCHASE_HISTORY', 'FINALIZED_HISTORY', false),
    ('prevent_finalized_purchase_item_mutation', 'purchase_invoice_items', 'FINALIZED_PURCHASE_HISTORY', 'FINALIZED_HISTORY', false),
    ('prevent_finalized_sales_invoice_mutation', 'sales_invoices', 'FINALIZED_SALES_HISTORY', 'FINALIZED_HISTORY', false),
    ('prevent_finalized_sales_item_mutation', 'sales_invoice_items', 'FINALIZED_SALES_HISTORY', 'FINALIZED_HISTORY', false),
    ('guard_purchase_posting_transition', 'purchase_posting_operations', 'POSTING_INTEGRITY', 'SECURITY', false),
    ('guard_sales_posting_transition', 'sales_posting_operations', 'POSTING_INTEGRITY', 'SECURITY', false)
ON CONFLICT (trigger_name) DO UPDATE
SET table_name = EXCLUDED.table_name,
    purpose = EXCLUDED.purpose,
    protection_class = EXCLUDED.protection_class,
    eligible = EXCLUDED.eligible,
    expected_enabled = EXCLUDED.expected_enabled;

CREATE TABLE IF NOT EXISTS public.q14_maintenance_audit (
    id text PRIMARY KEY,
    operation_id text NOT NULL,
    actor_id text NOT NULL,
    actor_db_role text NOT NULL,
    trigger_name text NOT NULL,
    table_name text NOT NULL,
    purpose text NOT NULL,
    action text NOT NULL CHECK (action IN ('DISABLE_ENABLE')),
    outcome text NOT NULL,
    authorization_result text NOT NULL,
    changed_state text NOT NULL,
    restoration_attempted boolean NOT NULL,
    restored boolean NOT NULL,
    post_verification boolean NOT NULL,
    error_detail text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.q14_soft_delete_requests (
    id text PRIMARY KEY,
    tenant_id text NOT NULL,
    target_table text NOT NULL CHECK (target_table IN ('products', 'customers', 'suppliers')),
    target_id text NOT NULL,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
    requested_by text NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT now(),
    approved_by text,
    approved_at timestamptz,
    executed_by text,
    executed_at timestamptz,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
    status text NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'EXECUTED', 'REJECTED', 'EXPIRED')),
    CONSTRAINT q14_soft_delete_target_key UNIQUE (tenant_id, target_table, target_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS q14_soft_delete_active_request_key
ON public.q14_soft_delete_requests (tenant_id, target_table, target_id)
WHERE status IN ('REQUESTED', 'APPROVED');

CREATE TABLE IF NOT EXISTS public.q14_soft_delete_audit (
    id text PRIMARY KEY,
    request_id text NOT NULL,
    tenant_id text NOT NULL,
    actor_id text NOT NULL,
    actor_db_role text NOT NULL,
    action text NOT NULL CHECK (action IN ('REQUEST', 'APPROVE', 'EXECUTE', 'DENY')),
    target_table text NOT NULL,
    target_id text NOT NULL,
    outcome text NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.q14_maintenance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.q14_maintenance_audit FORCE ROW LEVEL SECURITY;
ALTER TABLE public.q14_soft_delete_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.q14_soft_delete_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.q14_soft_delete_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.q14_soft_delete_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS q14_soft_delete_request_tenant_read ON public.q14_soft_delete_requests;
CREATE POLICY q14_soft_delete_request_tenant_read
ON public.q14_soft_delete_requests FOR SELECT TO "pharmnos_e2e_runtime"
USING (tenant_id = public.financial_context_tenant_id());

DROP POLICY IF EXISTS q14_soft_delete_audit_tenant_read ON public.q14_soft_delete_audit;
CREATE POLICY q14_soft_delete_audit_tenant_read
ON public.q14_soft_delete_audit FOR SELECT TO "pharmnos_e2e_runtime"
USING (tenant_id = public.financial_context_tenant_id());

REVOKE ALL ON TABLE public.q14_trigger_allowlist, public.q14_maintenance_probe,
    public.q14_maintenance_audit, public.q14_soft_delete_requests,
    public.q14_soft_delete_audit FROM PUBLIC;
REVOKE ALL ON TABLE public.q14_trigger_allowlist, public.q14_maintenance_probe,
    public.q14_maintenance_audit, public.q14_soft_delete_requests,
    public.q14_soft_delete_audit FROM "pharmnos_e2e_runtime";
GRANT SELECT ON TABLE public.q14_soft_delete_requests, public.q14_soft_delete_audit
    TO "pharmnos_e2e_runtime";

CREATE OR REPLACE FUNCTION q14_security.verify_trigger_state(p_trigger_name text, p_table_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $function$
DECLARE
    actual_enabled "char";
BEGIN
    SELECT t.tgenabled INTO actual_enabled
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = p_trigger_name AND c.relname = p_table_name AND n.nspname = 'public';
    RETURN actual_enabled = 'O';
END;
$function$;

CREATE OR REPLACE FUNCTION q14_security.maintain_allowlisted_trigger(
    p_trigger_name text,
    p_table_name text,
    p_purpose text,
    p_actor_id text,
    p_simulate_operation_failure boolean DEFAULT false,
    p_simulate_restore_failure boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, q14_security
AS $function$
DECLARE
    allowlist_row public.q14_trigger_allowlist%ROWTYPE;
    operation_id text := 'q14-maint-' || md5(clock_timestamp()::text || random()::text);
    audit_id text := 'q14-audit-' || md5(clock_timestamp()::text || random()::text);
    caller_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
    restored boolean := false;
    post_verified boolean := false;
    restoration_attempted boolean := false;
    restoration_error text;
    operation_error text;
BEGIN
    SELECT * INTO allowlist_row
    FROM public.q14_trigger_allowlist
    WHERE trigger_name = p_trigger_name AND table_name = p_table_name;

    IF caller_role <> 'pharmnos_e2e_admin'
       OR nullif(btrim(p_actor_id), '') IS NULL
       OR nullif(btrim(p_purpose), '') IS NULL
       OR allowlist_row.trigger_name IS NULL
       OR allowlist_row.eligible IS NOT TRUE
       OR allowlist_row.protection_class <> 'ELIGIBLE_MAINTENANCE'
       OR allowlist_row.purpose <> p_purpose
       OR q14_security.verify_trigger_state(p_trigger_name, p_table_name) IS NOT TRUE
    THEN
        INSERT INTO public.q14_maintenance_audit
            (id, operation_id, actor_id, actor_db_role, trigger_name, table_name, purpose,
             action, outcome, authorization_result, changed_state, restoration_attempted,
             restored, post_verification, error_detail)
        VALUES
            (audit_id, operation_id, coalesce(p_actor_id, ''), caller_role,
             coalesce(p_trigger_name, ''), coalesce(p_table_name, ''), coalesce(p_purpose, ''),
             'DISABLE_ENABLE', 'DENIED', 'FAIL_CLOSED', 'UNCHANGED', false, false, false,
             'Authorization, purpose, allowlist, protection class, or precondition failed');
        RETURN jsonb_build_object('status', 'DENIED', 'operation_id', operation_id);
    END IF;

    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', p_table_name, p_trigger_name);
    BEGIN
        IF p_simulate_operation_failure THEN
            RAISE EXCEPTION 'SIMULATED_MAINTENANCE_FAILURE';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        operation_error := SQLERRM;
    END;

    restoration_attempted := true;
    BEGIN
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I', p_table_name, p_trigger_name);
        IF p_simulate_restore_failure THEN
            RAISE EXCEPTION 'SIMULATED_RESTORATION_FAILURE';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        restoration_error := SQLERRM;
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I', p_table_name, p_trigger_name);
    END;

    restored := q14_security.verify_trigger_state(p_trigger_name, p_table_name);
    post_verified := restored;
    INSERT INTO public.q14_maintenance_audit
        (id, operation_id, actor_id, actor_db_role, trigger_name, table_name, purpose,
         action, outcome, authorization_result, changed_state, restoration_attempted,
         restored, post_verification, error_detail)
    VALUES
        (audit_id, operation_id, p_actor_id, caller_role, p_trigger_name, p_table_name,
         p_purpose, 'DISABLE_ENABLE',
         CASE WHEN restored AND operation_error IS NULL AND restoration_error IS NULL THEN 'SUCCESS'
              WHEN restored THEN 'FAILED_OPERATION_RESTORED'
              ELSE 'FAIL_CLOSED_RESTORE_UNCERTAIN' END,
         'AUTHORIZED', 'DISABLED_THEN_ENABLED', restoration_attempted, restored,
         post_verified, coalesce(operation_error, restoration_error));
    RETURN jsonb_build_object(
        'status', CASE WHEN restored AND operation_error IS NULL AND restoration_error IS NULL THEN 'PASS' ELSE 'RECOVERED' END,
        'operation_id', operation_id,
        'restoration_attempted', restoration_attempted,
        'restored', restored,
        'post_verification', post_verified
    );
EXCEPTION WHEN OTHERS THEN
    BEGIN
        EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I', p_table_name, p_trigger_name);
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    INSERT INTO public.q14_maintenance_audit
        (id, operation_id, actor_id, actor_db_role, trigger_name, table_name, purpose,
         action, outcome, authorization_result, changed_state, restoration_attempted,
         restored, post_verification, error_detail)
    VALUES
        (audit_id, operation_id, coalesce(p_actor_id, ''), caller_role,
         coalesce(p_trigger_name, ''), coalesce(p_table_name, ''), coalesce(p_purpose, ''),
         'DISABLE_ENABLE', 'FAIL_CLOSED_RESTORE_UNCERTAIN', 'AUTHORIZED',
         'UNKNOWN', true, false, false, SQLERRM);
    RETURN jsonb_build_object('status', 'FAIL_CLOSED_RESTORE_UNCERTAIN', 'operation_id', operation_id);
END;
$function$;

CREATE OR REPLACE FUNCTION q14_security.request_soft_delete(
    p_tenant_id text, p_target_table text, p_target_id text, p_reason text, p_actor_id text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, q14_security
AS $function$
DECLARE
    request_id text := 'q14-delete-' || md5(clock_timestamp()::text || random()::text);
    target_exists boolean := false;
    caller_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
BEGIN
    IF caller_role <> 'pharmnos_e2e_runtime'
       OR public.financial_context_tenant_id() <> p_tenant_id
       OR nullif(btrim(p_reason), '') IS NULL
       OR p_target_table NOT IN ('products', 'customers', 'suppliers')
    THEN
        INSERT INTO public.q14_soft_delete_audit
            (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason)
        VALUES ('q14-sda-' || md5(request_id || 'auth'), request_id, coalesce(p_tenant_id, ''),
                coalesce(p_actor_id, ''), caller_role, 'DENY', coalesce(p_target_table, ''),
                coalesce(p_target_id, ''), 'DENIED', 'REQUEST_AUTHORIZATION_FAILED');
        RETURN jsonb_build_object('status', 'DENIED', 'reason', 'REQUEST_AUTHORIZATION_FAILED');
    END IF;
    IF p_target_table = 'products' THEN
        SELECT EXISTS (SELECT 1 FROM public.products WHERE id = p_target_id AND tenant_id = p_tenant_id AND is_active) INTO target_exists;
    ELSIF p_target_table = 'customers' THEN
        SELECT EXISTS (SELECT 1 FROM public.customers WHERE id = p_target_id AND tenant_id = p_tenant_id AND is_active) INTO target_exists;
    ELSE
        SELECT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_target_id AND tenant_id = p_tenant_id AND is_active) INTO target_exists;
    END IF;
    IF NOT target_exists THEN
        INSERT INTO public.q14_soft_delete_audit
            (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason)
        VALUES ('q14-sda-' || md5(request_id || 'target'), request_id, p_tenant_id,
                p_actor_id, caller_role, 'DENY', p_target_table, p_target_id, 'DENIED',
                'TARGET_NOT_ACTIVE_OR_NOT_FOUND');
        RETURN jsonb_build_object('status', 'DENIED', 'reason', 'TARGET_NOT_ACTIVE_OR_NOT_FOUND');
    END IF;
    INSERT INTO public.q14_soft_delete_requests
        (id, tenant_id, target_table, target_id, reason, requested_by, status)
    VALUES (request_id, p_tenant_id, p_target_table, p_target_id, p_reason, p_actor_id, 'REQUESTED');
    INSERT INTO public.q14_soft_delete_audit
        (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason)
    VALUES ('q14-sda-' || md5(request_id), request_id, p_tenant_id, p_actor_id, caller_role,
            'REQUEST', p_target_table, p_target_id, 'REQUESTED', p_reason);
    RETURN jsonb_build_object('status', 'REQUESTED', 'request_id', request_id);
EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.q14_soft_delete_audit
        (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason)
    VALUES ('q14-sda-' || md5(request_id || 'duplicate'), request_id, p_tenant_id,
            p_actor_id, caller_role, 'DENY', p_target_table, p_target_id, 'DENIED',
            'DUPLICATE_ACTIVE_REQUEST');
    RETURN jsonb_build_object('status', 'DENIED', 'reason', 'DUPLICATE_ACTIVE_REQUEST');
END;
$function$;

CREATE OR REPLACE FUNCTION q14_security.approve_soft_delete(
    p_request_id text, p_actor_id text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, q14_security
AS $function$
DECLARE
    request_row public.q14_soft_delete_requests%ROWTYPE;
    caller_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
BEGIN
    SELECT * INTO request_row FROM public.q14_soft_delete_requests WHERE id = p_request_id FOR UPDATE;
    IF caller_role <> 'pharmnos_e2e_admin'
       OR request_row.id IS NULL
       OR request_row.status <> 'REQUESTED'
       OR request_row.expires_at <= now()
       OR request_row.requested_by = p_actor_id
       OR public.financial_context_tenant_id() <> request_row.tenant_id
    THEN
        INSERT INTO public.q14_soft_delete_audit
            (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason)
        VALUES ('q14-sda-' || md5(coalesce(p_request_id, '') || coalesce(p_actor_id, '') || 'approval'),
                coalesce(p_request_id, ''), coalesce(request_row.tenant_id, ''),
                coalesce(p_actor_id, ''), caller_role, 'DENY',
                coalesce(request_row.target_table, ''), coalesce(request_row.target_id, ''),
                'DENIED', 'APPROVAL_AUTHORIZATION_FAILED');
        RETURN jsonb_build_object('status', 'DENIED', 'reason', 'APPROVAL_AUTHORIZATION_FAILED');
    END IF;
    UPDATE public.q14_soft_delete_requests
    SET approved_by = p_actor_id, approved_at = now(), status = 'APPROVED'
    WHERE id = p_request_id AND status = 'REQUESTED';
    INSERT INTO public.q14_soft_delete_audit
        (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome)
    VALUES ('q14-sda-' || md5(p_request_id || p_actor_id), p_request_id, request_row.tenant_id,
            p_actor_id, caller_role, 'APPROVE', request_row.target_table, request_row.target_id, 'APPROVED');
    RETURN jsonb_build_object('status', 'APPROVED', 'request_id', p_request_id);
END;
$function$;

CREATE OR REPLACE FUNCTION q14_security.execute_soft_delete(
    p_request_id text, p_actor_id text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, q14_security
AS $function$
DECLARE
    request_row public.q14_soft_delete_requests%ROWTYPE;
    affected integer := 0;
    caller_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
BEGIN
    SELECT * INTO request_row FROM public.q14_soft_delete_requests WHERE id = p_request_id FOR UPDATE;
    IF caller_role <> 'pharmnos_e2e_validation'
       OR request_row.id IS NULL
       OR request_row.status <> 'APPROVED'
       OR request_row.expires_at <= now()
       OR request_row.requested_by = p_actor_id
       OR request_row.approved_by = p_actor_id
       OR public.financial_context_tenant_id() <> request_row.tenant_id
    THEN
        INSERT INTO public.q14_soft_delete_audit
            (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome, reason)
        VALUES ('q14-sda-' || md5(coalesce(p_request_id, '') || coalesce(p_actor_id, '') || 'execution'),
                coalesce(p_request_id, ''), coalesce(request_row.tenant_id, ''),
                coalesce(p_actor_id, ''), caller_role, 'DENY',
                coalesce(request_row.target_table, ''), coalesce(request_row.target_id, ''),
                'DENIED', 'EXECUTION_AUTHORIZATION_FAILED');
        RETURN jsonb_build_object('status', 'DENIED', 'reason', 'EXECUTION_AUTHORIZATION_FAILED');
    END IF;
    IF request_row.target_table = 'products' THEN
        UPDATE public.products SET is_active = false, updated_at = now()
        WHERE id = request_row.target_id AND tenant_id = request_row.tenant_id AND is_active;
    ELSIF request_row.target_table = 'customers' THEN
        UPDATE public.customers SET is_active = false, updated_at = now()
        WHERE id = request_row.target_id AND tenant_id = request_row.tenant_id AND is_active;
    ELSIF request_row.target_table = 'suppliers' THEN
        UPDATE public.suppliers SET is_active = false, updated_at = now()
        WHERE id = request_row.target_id AND tenant_id = request_row.tenant_id AND is_active;
    ELSE
        RETURN jsonb_build_object('status', 'DENIED', 'reason', 'PROTECTED_TARGET');
    END IF;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN
        RETURN jsonb_build_object('status', 'DENIED', 'reason', 'TARGET_STATE_CHANGED');
    END IF;
    UPDATE public.q14_soft_delete_requests
    SET executed_by = p_actor_id, executed_at = now(), status = 'EXECUTED'
    WHERE id = p_request_id AND status = 'APPROVED';
    INSERT INTO public.q14_soft_delete_audit
        (id, request_id, tenant_id, actor_id, actor_db_role, action, target_table, target_id, outcome)
    VALUES ('q14-sda-' || md5(p_request_id || p_actor_id), p_request_id, request_row.tenant_id,
            p_actor_id, caller_role, 'EXECUTE', request_row.target_table, request_row.target_id, 'EXECUTED');
    RETURN jsonb_build_object('status', 'EXECUTED', 'request_id', p_request_id);
END;
$function$;

REVOKE ALL ON FUNCTION q14_security.maintain_allowlisted_trigger(text, text, text, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION q14_security.request_soft_delete(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION q14_security.approve_soft_delete(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION q14_security.execute_soft_delete(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION q14_security.maintain_allowlisted_trigger(text, text, text, text, boolean, boolean) TO "pharmnos_e2e_admin";
GRANT EXECUTE ON FUNCTION q14_security.request_soft_delete(text, text, text, text, text) TO "pharmnos_e2e_runtime";
GRANT EXECUTE ON FUNCTION q14_security.approve_soft_delete(text, text) TO "pharmnos_e2e_admin";
GRANT EXECUTE ON FUNCTION q14_security.execute_soft_delete(text, text) TO "pharmnos_e2e_validation";
REVOKE "pharmnos_e2e_admin", "pharmnos_e2e_validation" FROM "pharmnos_e2e";

REVOKE UPDATE, DELETE ON TABLE public.q14_maintenance_audit, public.q14_soft_delete_audit
    FROM "pharmnos_e2e_runtime", "pharmnos_e2e_admin", "pharmnos_e2e_validation";
